# Catálogo UFS

Catálogo interactivo estático para Vercel con búsqueda por código, filtros, carrito local y pedido por WhatsApp.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Datos

- Productos: `public/data/products.json`
- Imágenes optimizadas: `public/products`
- Regenerar catálogo desde los PDFs locales:

```bash
python3 -m pip install -r requirements.txt
npm run catalog:build
```

La app incluye un modo `Revisión` para ajustar códigos, precios, descripción, categoría y referencias extra por página antes de publicar. Los cambios quedan en `localStorage`; usa `Exportar products.json` para generar el JSON final.

El carrito genera pedidos para WhatsApp al número `+57 312 6125065`.
