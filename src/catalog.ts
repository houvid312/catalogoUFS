import type { CartLine, Product } from "./types";

export const WHATSAPP_PHONE = "573126125065";
const PENDING_DESCRIPTION_PREFIX = "referencia pendiente";

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const uniqueSorted = (items: string[]) =>
  Array.from(new Set(items)).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));

export const productMatchesQuery = (product: Product, query: string) => {
  const normalized = normalizeText(query);
  if (!normalized) {
    return true;
  }

  const haystack = normalizeText(
    [
      product.code,
      product.baseReference,
      product.description,
      product.category,
      product.audience,
      product.color,
      product.pageKey ?? "",
      String(product.sourcePage),
      product.sourceCatalog,
    ].join(" "),
  );

  return haystack.includes(normalized);
};

export const codePriority = (product: Product, query: string) => {
  const normalizedQuery = normalizeText(query);
  const normalizedCode = normalizeText(product.code);
  const normalizedBase = normalizeText(product.baseReference);

  if (!normalizedQuery) {
    return 4;
  }
  if (normalizedCode === normalizedQuery) {
    return 0;
  }
  if (normalizedCode.startsWith(normalizedQuery)) {
    return 1;
  }
  if (normalizedBase === normalizedQuery || normalizedBase.startsWith(normalizedQuery)) {
    return 2;
  }
  return 3;
};

export const buildWhatsappUrl = (products: Product[], cart: CartLine[]) => {
  const productById = new Map(products.map((product) => [product.id, product]));
  const lines = cart
    .map((line) => {
      const product = productById.get(line.productId);
      if (!product) {
        return null;
      }

      const price = product.price ? `${formatMoney(product.price)} c/u` : "Consultar precio";
      const category = product.category === "Por revisar" ? "Prenda deportiva" : product.category;
      const description = product.description.trim().toLowerCase().startsWith(PENDING_DESCRIPTION_PREFIX)
        ? `${category} ${product.audience}`.trim()
        : product.description;
      const code = product.code.replace(/\s+-+\s*$/g, "").trim();
      return `- ${code} x${line.quantity} · ${description} · ${price}`;
    })
    .filter(Boolean);

  const pricedTotal = cart.reduce((total, line) => {
    const product = productById.get(line.productId);
    return total + (product?.price ?? 0) * line.quantity;
  }, 0);

  const hasConsult = cart.some((line) => productById.get(line.productId)?.price == null);
  const totalLine = pricedTotal > 0
    ? `Total estimado: ${formatMoney(pricedTotal)}${hasConsult ? " + productos por consultar" : ""}`
    : "Total: por confirmar";

  const message = [
    "Hola, quiero hacer este pedido UFS:",
    "",
    ...lines,
    "",
    totalLine,
    "",
    "¿Me confirmas disponibilidad, tallas y colores?",
  ].join("\n");

  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
};
