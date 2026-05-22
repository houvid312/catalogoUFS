export type Product = {
  id: string;
  code: string;
  baseReference: string;
  description: string;
  category: string;
  audience: string;
  color: string;
  price: number | null;
  image: string;
  sourceCatalog: string;
  sourcePage: number;
  pageKey?: string;
  needsReview?: boolean;
  ocrText?: string;
  codeIndexOnPage?: number;
};

export type CartLine = {
  productId: string;
  quantity: number;
};
