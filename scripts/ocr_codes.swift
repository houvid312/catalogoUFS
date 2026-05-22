import Foundation
import Vision
import AppKit

struct OCRResult: Codable {
    let image: String
    let text: String
}

func recognizeText(in imageURL: URL) throws -> String {
    guard let image = NSImage(contentsOf: imageURL),
          let tiffData = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiffData),
          let cgImage = bitmap.cgImage else {
        throw NSError(domain: "OCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to load image \(imageURL.path)"])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["en-US", "es-ES"]
    request.minimumTextHeight = 0.015

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    return observations
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: " ")
}

let args = CommandLine.arguments.dropFirst()
guard !args.isEmpty else {
    FileHandle.standardError.write(Data("Usage: swift scripts/ocr_codes.swift <image> [image...]\n".utf8))
    exit(2)
}

var results: [OCRResult] = []
for arg in args {
    let url = URL(fileURLWithPath: arg)
    do {
        results.append(OCRResult(image: arg, text: try recognizeText(in: url)))
    } catch {
        results.append(OCRResult(image: arg, text: ""))
        FileHandle.standardError.write(Data("OCR failed for \(arg): \(error)\n".utf8))
    }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(results)
FileHandle.standardOutput.write(data)
