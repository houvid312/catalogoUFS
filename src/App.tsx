import { useEffect, useMemo, useState } from "react";
import {
  Expand,
  Filter,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import type { CartLine, Product } from "./types";
import {
  buildWhatsappUrl,
  codePriority,
  formatMoney,
  productMatchesQuery,
  uniqueSorted,
} from "./catalog";

const CART_STORAGE_KEY = "catalogo-ufs-cart";
const REVIEW_STORAGE_KEY = "catalogo-ufs-review-products-v2";
const REVIEW_PATH = "/revision-catalogo-ufs";
const PENDING_DESCRIPTION_PREFIX = "referencia pendiente";

const publicCode = (product: Product) => product.code.replace(/\s+-+\s*$/g, "").trim();

const publicDescription = (product: Product) => {
  const description = product.description.trim();
  if (description && !description.toLowerCase().startsWith(PENDING_DESCRIPTION_PREFIX)) {
    return product.description;
  }

  const category = product.category === "Por revisar" ? "Prenda deportiva" : product.category;
  return `${category} ${product.audience}`.trim();
};

const publicCategory = (product: Product) => {
  return product.category === "Por revisar" ? "Prenda deportiva" : product.category;
};

const readCart = (): CartLine[] => {
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [reviewQuery, setReviewQuery] = useState("");
  const [exportText, setExportText] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [audience, setAudience] = useState("Todos");
  const [color, setColor] = useState("Todos");
  const [includeConsult, setIncludeConsult] = useState(true);
  const [maxPrice, setMaxPrice] = useState(0);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogPreviewProduct, setCatalogPreviewProduct] = useState<Product | null>(null);
  const isReviewPath = currentPath === REVIEW_PATH;

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    fetch("/data/products.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("No se pudo cargar el catálogo");
        }
        return response.json();
      })
      .then((data: Product[]) => {
        const storedReview = window.localStorage.getItem(REVIEW_STORAGE_KEY);
        const activeData = storedReview ? JSON.parse(storedReview) as Product[] : data;
        setSourceProducts(data);
        setProducts(activeData);
        const highestPrice = Math.max(...activeData.map((product) => product.price ?? 0));
        setMaxPrice(highestPrice);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!loading && products.length > 0) {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(products));
    }
  }, [loading, products]);

  const categories = useMemo(() => ["Todas", ...uniqueSorted(products.map((product) => product.category))], [products]);
  const audiences = useMemo(() => ["Todos", ...uniqueSorted(products.map((product) => product.audience))], [products]);
  const colors = useMemo(() => ["Todos", ...uniqueSorted(products.map((product) => product.color))], [products]);
  const highestPrice = useMemo(() => Math.max(...products.map((product) => product.price ?? 0), 0), [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => productMatchesQuery(product, query))
      .filter((product) => category === "Todas" || product.category === category)
      .filter((product) => audience === "Todos" || product.audience === audience)
      .filter((product) => color === "Todos" || product.color === color)
      .filter((product) => {
        if (product.price == null) {
          return includeConsult;
        }
        return !maxPrice || product.price <= maxPrice;
      })
      .sort((a, b) => {
        const priority = codePriority(a, query) - codePriority(b, query);
        return priority || a.code.localeCompare(b.code, "es");
      });
  }, [audience, category, color, includeConsult, maxPrice, products, query]);

  const suggestions = useMemo(() => {
    if (!query.trim()) {
      return products.slice(0, 6);
    }
    return products
      .filter((product) => productMatchesQuery(product, query))
      .sort((a, b) => codePriority(a, query) - codePriority(b, query))
      .slice(0, 6);
  }, [products, query]);

  const cartProducts = useMemo(() => {
    const productById = new Map(products.map((product) => [product.id, product]));
    return cart
      .map((line) => ({ line, product: productById.get(line.productId) }))
      .filter((item): item is { line: CartLine; product: Product } => Boolean(item.product));
  }, [cart, products]);

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = cartProducts.reduce((total, item) => total + (item.product.price ?? 0) * item.line.quantity, 0);
  const whatsappUrl = buildWhatsappUrl(products, cart);
  const reviewCount = products.filter((product) => product.needsReview || product.price == null || product.code.startsWith("REVISAR-")).length;
  const pageCount = new Set(products.map((product) => product.pageKey ?? `${product.sourceCatalog}-${product.sourcePage}`)).size;

  const addToCart = (productId: string) => {
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const setQuantity = (productId: string, quantity: number) => {
    setCart((current) => {
      if (quantity <= 0) {
        return current.filter((line) => line.productId !== productId);
      }
      return current.map((line) => (line.productId === productId ? { ...line, quantity } : line));
    });
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("Todas");
    setAudience("Todos");
    setColor("Todos");
    setIncludeConsult(true);
    setMaxPrice(highestPrice);
    setFiltersOpen(false);
  };

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) {
          return product;
        }
        const code = patch.code ?? product.code;
        const nextProduct = {
          ...product,
          ...patch,
          code,
          baseReference: patch.baseReference ?? code.split("-", 1)[0].trim(),
        };
        const stillNeedsReview =
          nextProduct.code.trim().startsWith("REVISAR-") ||
          nextProduct.code.trim() === "" ||
          nextProduct.description === "Referencia pendiente por confirmar" ||
          nextProduct.category === "Por revisar" ||
          nextProduct.price == null;

        return {
          ...nextProduct,
          needsReview: patch.needsReview ?? stillNeedsReview,
        };
      }),
    );
  };

  const addReferenceForPage = (product: Product) => {
    const id = `${product.pageKey ?? `${product.sourceCatalog}-p${product.sourcePage}`}-manual-${Date.now()}`;
    const nextProduct: Product = {
      ...product,
      id,
      code: "NUEVA-REFERENCIA",
      baseReference: "NUEVA",
      description: "Referencia pendiente por confirmar",
      price: null,
      needsReview: true,
      codeIndexOnPage: undefined,
    };
    setProducts((current) => {
      const index = current.findIndex((item) => item.id === product.id);
      const copy = [...current];
      copy.splice(index + 1, 0, nextProduct);
      return copy;
    });
  };

  const removeProduct = (productId: string) => {
    setProducts((current) => current.filter((product) => product.id !== productId));
    setCart((current) => current.filter((line) => line.productId !== productId));
  };

  const resetReviewDraft = () => {
    window.localStorage.removeItem(REVIEW_STORAGE_KEY);
    setProducts(sourceProducts);
    setCart([]);
  };

  const exportProducts = () => {
    const payload = JSON.stringify(products, null, 2);
    setExportText(payload);
    window.localStorage.setItem("catalogo-ufs-last-export", payload);
    navigator.clipboard?.writeText(payload).catch(() => undefined);

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "products.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportStatus("JSON generado. Si el navegador no descargó el archivo, copia el contenido del panel de abajo.");
  };

  const importProducts = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const nextProducts = JSON.parse(String(reader.result)) as Product[];
      setProducts(nextProducts);
    };
    reader.readAsText(file);
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
    setCartOpen(false);
  };

  const activeFilterCount = [
    query.trim(),
    category !== "Todas",
    audience !== "Todos",
    color !== "Todos",
    maxPrice !== highestPrice,
    !includeConsult,
  ].filter(Boolean).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">UFS Colombia</p>
          <h1>Catálogo deportivo</h1>
        </div>
        <div className="top-actions">
          {isReviewPath && (
            <button className="review-button" type="button" onClick={() => navigateTo("/")}>
              <Settings2 size={20} />
              <span>Catálogo</span>
              {reviewCount > 0 && <strong>{reviewCount}</strong>}
            </button>
          )}
          <button className="cart-button" type="button" onClick={() => setCartOpen(true)}>
            <ShoppingBag size={20} />
            <span>Carrito</span>
            {cartCount > 0 && <strong>{cartCount}</strong>}
          </button>
        </div>
      </header>

      {isReviewPath ? (
        <ReviewWorkspace
          products={products}
          pageCount={pageCount}
          reviewCount={reviewCount}
          query={reviewQuery}
          onQueryChange={setReviewQuery}
          onUpdate={updateProduct}
          onAdd={addReferenceForPage}
          onRemove={removeProduct}
          onExport={exportProducts}
          exportText={exportText}
          exportStatus={exportStatus}
          onClearExport={() => {
            setExportText("");
            setExportStatus("");
          }}
          onImport={importProducts}
          onReset={resetReviewDraft}
        />
      ) : (
      <main className="catalog-home">
        <section className="catalog-hero" aria-label="Catálogo UFS">
          <div className="catalog-hero-copy">
            <p className="eyebrow">Colección UFS</p>
            <h2>Prendas deportivas para armar pedido fácil.</h2>
            <label className="search-field hero-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="Código, prenda o color"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="catalog-hero-stats" aria-label="Resumen del catálogo">
            <span>
              <strong>{products.length}</strong>
              Referencias
            </span>
            <span>
              <strong>{categories.length - 1}</strong>
              Tipos
            </span>
            <span>
              <strong>{cartCount}</strong>
              En carrito
            </span>
          </div>
        </section>

        <div className="catalog-layout">
        {filtersOpen && (
          <button
            className="filters-backdrop"
            type="button"
            onClick={() => setFiltersOpen(false)}
            aria-label="Cerrar filtros"
          />
        )}
        <aside className={`filters-panel ${filtersOpen ? "is-open" : ""}`} aria-label="Filtros del catálogo">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Buscar</p>
              <h2>Filtros</h2>
            </div>
            <button className="filters-close" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">
              <X size={18} />
            </button>
          </div>

          <label className="search-field">
            <Search size={18} />
            <input
              type="search"
              placeholder="TC-225, BL-052, top..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="suggestions" aria-label="Sugerencias de búsqueda">
            {suggestions.map((product) => (
              <button key={product.id} type="button" onClick={() => setQuery(product.code)}>
                {product.code}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <label htmlFor="category">Tipo de prenda</label>
            <select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="audience">Línea</label>
            <select id="audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
              {audiences.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="color">Color</label>
            <select id="color" value={color} onChange={(event) => setColor(event.target.value)}>
              {colors.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <div className="range-label">
              <label htmlFor="price">Precio máximo</label>
              <span>{maxPrice ? formatMoney(maxPrice) : "Todos"}</span>
            </div>
            <input
              id="price"
              type="range"
              min={0}
              max={highestPrice}
              step={1000}
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </div>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={includeConsult}
              onChange={(event) => setIncludeConsult(event.target.checked)}
            />
            <span>Incluir precios por consultar</span>
          </label>

          <button className="ghost-button" type="button" onClick={clearFilters}>
            <RotateCcw size={18} />
            Limpiar {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </button>
        </aside>

        <section className="products-section" aria-live="polite">
          <div className="section-header">
            <div>
              <p className="eyebrow">Resultados</p>
              <h2>{filteredProducts.length} referencias</h2>
            </div>
            <div className="section-actions">
              <span>{products.length} referencias cargadas</span>
              <button className="filter-toggle-button" type="button" onClick={() => setFiltersOpen(true)}>
                <Filter size={18} />
                Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
              </button>
            </div>
          </div>

          {loading && <div className="empty-state">Cargando catálogo...</div>}
          {loadError && <div className="empty-state">{loadError}</div>}

          {!loading && !loadError && filteredProducts.length === 0 && (
            <div className="empty-state">
              <h3>No encontré prendas con esos filtros</h3>
              <p>Prueba con códigos como TC, LD, BL-052 o limpia los filtros activos.</p>
              <button type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>
          )}

          <div className="products-grid">
            {filteredProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-media">
                  <button type="button" className="product-image-button" onClick={() => setCatalogPreviewProduct(product)}>
                    <img src={product.image} alt={`${publicCode(product)} - ${publicDescription(product)}`} loading="lazy" />
                    <span>
                      <Expand size={16} />
                      Ver foto
                    </span>
                  </button>
                </div>
                <div className="product-body">
                  <div>
                    <p className="product-code">{publicCode(product)}</p>
                    <h3>{publicDescription(product)}</h3>
                  </div>
                  <div className="chips">
                    <span>{publicCategory(product)}</span>
                    <span>{product.audience}</span>
                    <span>{product.color}</span>
                  </div>
                  <div className="product-actions">
                    <strong>{product.price ? formatMoney(product.price) : "Consultar"}</strong>
                    <button type="button" onClick={() => addToCart(product.id)} aria-label={`Agregar ${product.code}`}>
                      <Plus size={18} />
                      Agregar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        </div>
      </main>
      )}

      {cartOpen && <button className="drawer-backdrop" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito" />}

      {catalogPreviewProduct && (
        <div className="product-preview-backdrop" role="presentation" onClick={() => setCatalogPreviewProduct(null)}>
          <section className="product-preview-sheet" role="dialog" aria-modal="true" aria-label={`Imagen ${publicCode(catalogPreviewProduct)}`} onClick={(event) => event.stopPropagation()}>
            <button className="product-preview-close" type="button" onClick={() => setCatalogPreviewProduct(null)} aria-label="Cerrar imagen">
              <X size={20} />
            </button>
            <div className="product-preview-image">
              <img src={catalogPreviewProduct.image} alt={publicCode(catalogPreviewProduct)} />
            </div>
            <footer className="product-preview-info">
              <div className="product-preview-heading">
                <span>{publicCategory(catalogPreviewProduct)} · {catalogPreviewProduct.audience}</span>
                <strong>{publicCode(catalogPreviewProduct)}</strong>
              </div>
              <h2>{publicDescription(catalogPreviewProduct)}</h2>
              <div className="product-preview-purchase">
                <span>{catalogPreviewProduct.price ? formatMoney(catalogPreviewProduct.price) : "Consultar"}</span>
                <button
                  type="button"
                  onClick={() => {
                    addToCart(catalogPreviewProduct.id);
                    setCatalogPreviewProduct(null);
                  }}
                >
                  <Plus size={18} />
                  Agregar
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      <aside className={`cart-drawer ${cartOpen ? "is-open" : ""}`} aria-label="Carrito">
        <div className="cart-header">
          <div>
            <p className="eyebrow">Pedido</p>
            <h2>Carrito</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="cart-lines">
          {cartProducts.length === 0 && (
            <div className="empty-cart">
              <ShoppingBag size={28} />
              <p>Tu carrito está vacío.</p>
            </div>
          )}

          {cartProducts.map(({ line, product }) => (
            <div className="cart-line" key={product.id}>
              <img src={product.image} alt={product.code} />
              <div className="cart-line-info">
                <strong>{product.code}</strong>
                <span>{product.price ? formatMoney(product.price) : "Consultar"}</span>
                <div className="quantity-controls">
                  <button type="button" onClick={() => setQuantity(product.id, line.quantity - 1)} aria-label="Restar">
                    <Minus size={16} />
                  </button>
                  <span>{line.quantity}</span>
                  <button type="button" onClick={() => setQuantity(product.id, line.quantity + 1)} aria-label="Sumar">
                    <Plus size={16} />
                  </button>
                  <button type="button" onClick={() => setQuantity(product.id, 0)} aria-label="Quitar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-footer">
          <div className="total-row">
            <span>Total estimado</span>
            <strong>{cartTotal ? formatMoney(cartTotal) : "Por confirmar"}</strong>
          </div>
          <a
            className={`whatsapp-button ${cartProducts.length === 0 ? "is-disabled" : ""}`}
            href={cartProducts.length ? whatsappUrl : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={cartProducts.length === 0}
          >
            <MessageCircle size={20} />
            Enviar por WhatsApp
          </a>
        </div>
      </aside>
    </div>
  );
}

type ReviewWorkspaceProps = {
  products: Product[];
  pageCount: number;
  reviewCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  onUpdate: (productId: string, patch: Partial<Product>) => void;
  onAdd: (product: Product) => void;
  onRemove: (productId: string) => void;
  onExport: () => void;
  exportText: string;
  exportStatus: string;
  onClearExport: () => void;
  onImport: (file: File | undefined) => void;
  onReset: () => void;
};

function ReviewWorkspace({
  products,
  pageCount,
  reviewCount,
  query,
  onQueryChange,
  onUpdate,
  onAdd,
  onRemove,
  onExport,
  exportText,
  exportStatus,
  onClearExport,
  onImport,
  onReset,
}: ReviewWorkspaceProps) {
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const descriptionOptions = useMemo(
    () => uniqueSorted(products.map((product) => product.description)),
    [products],
  );
  const categoryOptions = useMemo(
    () => uniqueSorted(products.map((product) => product.category)),
    [products],
  );
  const audienceOptions = useMemo(
    () => uniqueSorted(products.map((product) => product.audience)),
    [products],
  );
  const colorOptions = useMemo(
    () => uniqueSorted(products.map((product) => product.color)),
    [products],
  );
  const filtered = products
    .filter((product) => {
      if (!normalizedQuery) {
        return true;
      }
      return [
        product.code,
        product.description,
        product.category,
        product.sourceCatalog,
        String(product.sourcePage),
        product.pageKey ?? "",
        product.ocrText ?? "",
        product.needsReview ? "por revisar revisar" : "",
      ].join(" ").toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => Number(Boolean(b.needsReview)) - Number(Boolean(a.needsReview)) || a.sourceCatalog.localeCompare(b.sourceCatalog) || a.sourcePage - b.sourcePage);

  return (
    <main className="review-workspace">
      <section className="review-hero">
        <div>
          <p className="eyebrow">Revisión local</p>
          <h2>Auditar referencias antes de publicar</h2>
          <p>
            Cada fila es una referencia asociada a una página del PDF. Si una página trae dos códigos, deben existir dos filas.
          </p>
        </div>
        <div className="review-stats">
          <span>{products.length} referencias</span>
          <span>{pageCount} páginas</span>
          <span>{reviewCount} por revisar</span>
        </div>
      </section>

      <section className="review-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar código, página, OCR..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <div className="review-actions">
          <label className="import-button">
            Importar JSON
            <input type="file" accept="application/json" onChange={(event) => onImport(event.target.files?.[0])} />
          </label>
          <button className="ghost-button" type="button" onClick={() => onQueryChange("por revisar")}>
            <Filter size={18} />
            Ver por revisar
          </button>
          <button className="ghost-button" type="button" onClick={onReset}>
            <RotateCcw size={18} />
            Descartar draft
          </button>
          <button className="save-button" type="button" onClick={onExport}>
            <Save size={18} />
            Exportar products.json
          </button>
        </div>
      </section>

      {exportText && (
        <section className="export-panel">
          <div>
            <strong>Export listo</strong>
            <p>{exportStatus}</p>
          </div>
          <textarea readOnly value={exportText} aria-label="JSON exportado" />
          <button className="ghost-button" type="button" onClick={onClearExport}>
            <X size={18} />
            Cerrar export
          </button>
        </section>
      )}

      <section className="review-grid">
        {filtered.map((product) => (
          <article className={`review-card ${product.needsReview ? "needs-review" : ""}`} key={product.id}>
            <div className="review-media">
              <button type="button" className="review-image-button" onClick={() => setPreviewProduct(product)}>
                <img src={product.image} alt={product.code} />
                <span>
                  <Expand size={17} />
                  Ver imagen
                </span>
              </button>
            </div>
            <div className="review-form">
              <div className="review-card-heading">
                <span>{product.sourceCatalog} · página {product.sourcePage}</span>
                {product.needsReview && <strong>Revisar</strong>}
              </div>
              <label>
                Código
                <input value={product.code} onChange={(event) => onUpdate(product.id, { code: event.target.value })} />
              </label>
              <label>
                Descripción
                <select value={product.description} onChange={(event) => onUpdate(product.id, { description: event.target.value })}>
                  {descriptionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <div className="review-two-cols">
                <label>
                  Categoría
                  <select value={product.category} onChange={(event) => onUpdate(product.id, { category: event.target.value })}>
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Línea
                  <select value={product.audience} onChange={(event) => onUpdate(product.id, { audience: event.target.value })}>
                    {audienceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="review-two-cols">
                <label>
                  Color
                  <select value={product.color} onChange={(event) => onUpdate(product.id, { color: event.target.value })}>
                    {colorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Precio detal
                  <input
                    inputMode="numeric"
                    value={product.price ?? ""}
                    placeholder="Consultar"
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "");
                      onUpdate(product.id, { price: value ? Number(value) : null, needsReview: !value });
                    }}
                  />
                </label>
              </div>
              <p className="ocr-line">OCR: {product.ocrText || "Sin lectura automática"}</p>
              <div className="review-card-actions">
                <button type="button" onClick={() => onAdd(product)}>
                  <Plus size={16} />
                  Agregar referencia en esta página
                </button>
                <button type="button" onClick={() => onRemove(product.id)}>
                  <Trash2 size={16} />
                  Quitar
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {previewProduct && (
        <div className="image-preview-backdrop" role="presentation" onClick={() => setPreviewProduct(null)}>
          <section className="image-preview-modal" role="dialog" aria-modal="true" aria-label={`Imagen ${previewProduct.code}`} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">{previewProduct.sourceCatalog} · página {previewProduct.sourcePage}</p>
                <h2>{previewProduct.code}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPreviewProduct(null)} aria-label="Cerrar imagen">
                <X size={20} />
              </button>
            </header>
            <img src={previewProduct.image} alt={previewProduct.code} />
            <p>{previewProduct.description}</p>
          </section>
        </div>
      )}
    </main>
  );
}
