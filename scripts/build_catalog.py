from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_DIR = ROOT / "public" / "products"
DATA_DIR = ROOT / "public" / "data"
OCR_CROPS_DIR = Path("/tmp/catalogo_ufs_ocr_crops")

CATALOGS = [
    ("mayo", Path("/Users/dagomezgonza/Downloads/Catálogo UFS MAYO.pdf")),
    ("catalogo", Path("/Users/dagomezgonza/Downloads/Catálogo UFS .pdf")),
]

REFERENCE_META: dict[str, dict[str, Any]] = {
    "LD": {"description": "Leggings deportivos sublimados y fondo enteros", "category": "Leggings", "audience": "Mujer", "price": 93000},
    "SD": {"description": "Short deportivo para mujer", "category": "Shorts", "audience": "Mujer", "price": 79000},
    "TC": {"description": "Top deportivo para mujer", "category": "Tops", "audience": "Mujer", "price": 70000},
    "HL": {"description": "Leggings deportivo de hombre", "category": "Leggings", "audience": "Hombre", "price": 95000},
    "PD": {"description": "Pantaloneta de mujer corta", "category": "Pantalonetas", "audience": "Mujer", "price": 86000},
    "FD": {"description": "Falda deportiva", "category": "Faldas", "audience": "Mujer", "price": 88000},
    "OVERSIZE": {"description": "Camiseta oversize en tallas S a XL", "category": "Camisetas", "audience": "Unisex", "price": 87000},
    "OVER-CORTA": {"description": "Camiseta oversize corta para dama", "category": "Camisetas", "audience": "Mujer", "price": 76000},
    "CD": {"description": "Chaqueta deportiva de mujer", "category": "Chaquetas", "audience": "Mujer", "price": 105000},
    "MD": {"description": "Medias UFS", "category": "Accesorios", "audience": "Unisex", "price": 30000},
    "JH": {"description": "Jogger unisex", "category": "Joggers", "audience": "Unisex", "price": 89000},
    "PH": {"description": "Pantaloneta hombre", "category": "Pantalonetas", "audience": "Hombre", "price": 77000},
    "CMH": {"description": "Camiseta deportiva hombre", "category": "Camisetas", "audience": "Hombre", "price": 75000},
    "VD": {"description": "Vestido deportivo", "category": "Vestidos", "audience": "Mujer", "price": 96000},
    "ENT": {"description": "Enterizo deportivo", "category": "Enterizos", "audience": "Mujer", "price": 113000},
}

EXACT_META: dict[str, dict[str, Any]] = {
    "BL-052": {"description": "Blusa deportiva en malla", "category": "Blusas", "audience": "Mujer", "price": 68000},
    "BL-028C": {"description": "Blusa deportiva en malla corta", "category": "Blusas", "audience": "Mujer", "price": 62000},
    "BL-053": {"description": "Busito ajustado al cuerpo", "category": "Blusas", "audience": "Mujer", "price": 69000},
    "CB-093": {"description": "Buso largo con cierre corto en parte frontal", "category": "Busos", "audience": "Mujer", "price": 88000},
    "CB-085": {"description": "Buso en malla con chompa", "category": "Busos", "audience": "Mujer", "price": 76000},
    "CB-068": {"description": "Buso con cierre completo", "category": "Busos", "audience": "Mujer", "price": 86000},
    "CB-092": {"description": "Camibuso ajustado con escote posterior", "category": "Blusas", "audience": "Mujer", "price": 81000},
    "CB-086": {"description": "Camibuso con malla en mangas", "category": "Blusas", "audience": "Mujer", "price": 82000},
    "CB-087": {"description": "Busito ajustado al cuerpo", "category": "Blusas", "audience": "Mujer", "price": 65000},
    "FD-PLIZADA": {"description": "Falda deportiva plizada", "category": "Faldas", "audience": "Mujer", "price": 90000},
    "VD-012": {"description": "Vestido deportivo de tiras con short interno", "category": "Vestidos", "audience": "Mujer", "price": 96000},
    "VD-011": {"description": "Vestido manga larga con cierre frontal", "category": "Vestidos", "audience": "Mujer", "price": 100000},
    "ENT-LARGO": {"description": "Enterizo largo", "category": "Enterizos", "audience": "Mujer", "price": 125000},
    "ENT-SHORT": {"description": "Enterizo short", "category": "Enterizos", "audience": "Mujer", "price": 113000},
}

COLOR_SUFFIXES = {
    "AR": "Azul rey",
    "N": "Negro",
    "B": "Blanco",
    "BL": "Blanco",
    "R": "Rosado",
    "RO": "Rosado",
    "G": "Gris",
    "GR": "Gris",
    "V": "Verde",
    "VD": "Verde",
    "M": "Marron",
    "L": "Lila",
    "A": "Amarillo",
    "AMA": "Amarillo",
    "AC": "Azul claro",
    "C": "Cafe",
    "CC": "Cafe claro",
    "GC": "Gris claro",
    "GM": "Gris medio",
    "RM": "Rosado medio",
    "RJ": "Rojo",
    "ROJO": "Rojo",
    "ROSA": "Rosado",
    "NAVY": "Navy",
    "VT": "Verde turquesa",
    "T": "Taupe",
    "SM": "Salmón",
}


@dataclass
class ExtractedImage:
    source_catalog: str
    page: int
    image_path: Path

    @property
    def page_key(self) -> str:
        return f"{self.source_catalog}-p{self.page:03d}"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def optimize_image(raw: bytes, target: Path, max_width: int = 1600) -> None:
    image = Image.open(BytesIO(raw))
    image = ImageOps.exif_transpose(image).convert("RGB")
    if image.width > max_width:
        ratio = max_width / image.width
        image = image.resize((max_width, int(image.height * ratio)), Image.Resampling.LANCZOS)
    image.save(target, format="JPEG", quality=82, optimize=True, progressive=True)


def extract_images() -> list[ExtractedImage]:
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    extracted: list[ExtractedImage] = []
    for source, pdf_path in CATALOGS:
        reader = PdfReader(str(pdf_path))
        for page_index, page in enumerate(reader.pages, start=1):
            images = list(page.images)
            if not images:
                continue
            target = PRODUCTS_DIR / f"{source}-p{page_index:03d}.jpg"
            if not target.exists():
                optimize_image(images[0].data, target)
            extracted.append(ExtractedImage(source, page_index, target))
    return extracted


def run_ocr(images: list[ExtractedImage]) -> dict[str, str]:
    cache_file = DATA_DIR / "ocr-label-cache.json"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OCR_CROPS_DIR.mkdir(parents=True, exist_ok=True)
    cached: dict[str, str] = {}
    if cache_file.exists():
        cached = json.loads(cache_file.read_text())

    crops: dict[str, Path] = {}
    for item in images:
        crop_path = OCR_CROPS_DIR / f"{item.page_key}-label.jpg"
        crops[item.page_key] = crop_path
        if not crop_path.exists():
            image = Image.open(item.image_path).convert("RGB")
            width, height = image.size
            # The catalog prints product references on a bottom black band.
            crop = image.crop((0, int(height * 0.78), width, height))
            crop.save(crop_path, format="JPEG", quality=95)

    missing = [item for item in images if item.page_key not in cached]
    if missing:
        result = subprocess.run(
            ["swift", str(ROOT / "scripts" / "ocr_codes.swift"), *[str(crops[item.page_key]) for item in missing]],
            cwd=ROOT,
            check=True,
            text=True,
            capture_output=True,
        )
        for item in json.loads(result.stdout):
            key = Path(item["image"]).stem.replace("-label", "")
            cached[key] = item.get("text", "")
        cache_file.write_text(json.dumps(cached, ensure_ascii=False, indent=2, sort_keys=True))
    return cached


def clean_ocr_text(text: str) -> str:
    replacements = {
        "—": "-",
        "–": "-",
        "_": "-",
        "  ": " ",
        " O ": " 0 ",
        "O1": "01",
        "O2": "02",
        "O3": "03",
        "O4": "04",
        "O5": "05",
        "O6": "06",
        "O7": "07",
        "O8": "08",
        "O9": "09",
        "TC225": "TC-225",
        "SD124": "SD-124",
        "L D": "LD",
        "VD-O": "VD-0",
        "ENT-O": "ENT-0",
        "OVERSIDE": "OVERSIZE",
    }
    normalized = text.upper()
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return re.sub(r"\s+", " ", normalized).strip()


def normalize_code(prefix: str, number: str, suffix: str | None = None) -> str:
    code = f"{prefix}-{number}"
    if suffix:
        code = f"{code} {suffix}"
    return code


def extract_codes(text: str) -> list[str]:
    normalized = clean_ocr_text(text)
    codes: list[str] = []
    for match in re.finditer(r"\b([A-Z]{1,5})\s*-\s*([0-9]{2,4}[A-Z]?)(?:\s+(?![A-Z]{1,5}\s*-)([A-Z]{1,5}))?\b", normalized):
        prefix, number, suffix = match.groups()
        if suffix and suffix in {"DE", "EN", "CON", "PARA", "CORTA", "LARGO", "SHORT"}:
            suffix = None
        codes.append(normalize_code(prefix, number, suffix))

    if "OVERSIZE" in normalized:
        codes.append("OVERSIZE")
    if "OVER CORTA" in normalized or "OVER-CORTA" in normalized:
        codes.append("OVER-CORTA")

    seen: set[str] = set()
    unique: list[str] = []
    for code in codes:
        if code not in seen:
            seen.add(code)
            unique.append(code)
    return unique


def base_reference(code: str) -> str:
    if code in {"OVERSIZE", "OVER-CORTA"}:
        return code
    return code.split("-", 1)[0].strip()


def exact_key(code: str) -> str:
    compact = code.replace(" ", "")
    if compact.startswith("BL-028"):
        return "BL-028C"
    if compact.startswith("VD-012"):
        return "VD-012"
    if compact.startswith("VD-011"):
        return "VD-011"
    if compact.startswith("BL-028C"):
        return "BL-028C"
    for candidate in EXACT_META:
        if compact.startswith(candidate.replace(" ", "")):
            return candidate
    return code.split(" ", 1)[0]


def color_from_code(code: str) -> str:
    parts = code.split()
    if len(parts) > 1:
        return COLOR_SUFFIXES.get(parts[-1], parts[-1])
    return "Varios"


def product_from_code(code: str, item: ExtractedImage) -> dict[str, Any]:
    base = base_reference(code)
    metadata = EXACT_META.get(exact_key(code)) or REFERENCE_META.get(base) or {}
    return {
        "id": f"{item.page_key}-{slugify(code)}",
        "code": code,
        "baseReference": base,
        "description": metadata.get("description", "Prenda deportiva UFS"),
        "category": metadata.get("category", "Otros"),
        "audience": metadata.get("audience", "Unisex"),
        "color": color_from_code(code),
        "price": metadata.get("price"),
        "image": f"/products/{item.image_path.name}",
        "sourceCatalog": item.source_catalog,
        "sourcePage": item.page,
        "pageKey": item.page_key,
        "needsReview": metadata.get("price") is None,
    }


def review_product(item: ExtractedImage, index: int, ocr_text: str) -> dict[str, Any]:
    code = f"REVISAR-{item.source_catalog.upper()}-{item.page:03d}"
    return {
        "id": f"{item.page_key}-review-{index}",
        "code": code,
        "baseReference": "REVISAR",
        "description": "Referencia pendiente por confirmar",
        "category": "Por revisar",
        "audience": "Unisex",
        "color": "Varios",
        "price": None,
        "image": f"/products/{item.image_path.name}",
        "sourceCatalog": item.source_catalog,
        "sourcePage": item.page,
        "pageKey": item.page_key,
        "needsReview": True,
        "ocrText": ocr_text,
    }


def build_products() -> list[dict[str, Any]]:
    extracted = extract_images()
    ocr_by_image = run_ocr(extracted)
    products: list[dict[str, Any]] = []

    for item in extracted:
        text = ocr_by_image.get(item.page_key, "")
        codes = extract_codes(text)
        if not codes:
            products.append(review_product(item, 1, text))
            continue
        for index, code in enumerate(codes, start=1):
            product = product_from_code(code, item)
            product["ocrText"] = text
            product["codeIndexOnPage"] = index
            products.append(product)

    products = sorted(products, key=lambda item: (item["sourceCatalog"], item["sourcePage"], item.get("codeIndexOnPage", 999), item["code"]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "products.json").write_text(json.dumps(products, ensure_ascii=False, indent=2))
    return products


if __name__ == "__main__":
    products = build_products()
    priced = sum(1 for product in products if product["price"] is not None)
    print(f"Generated {len(products)} products ({priced} with price).")
