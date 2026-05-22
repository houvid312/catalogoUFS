# AGENTS.md - Catalogo UFS

## Objetivo

Este proyecto es un catalogo web estatico para Vercel. La app publica vive en `/` y el modulo local de revision vive en `/revision-catalogo-ufs`.

No cambies la UI, el modelo de datos ni el pipeline de extraccion cuando el usuario solo pida cargar o revisar un nuevo catalogo. Primero procesa, valida, exporta y prueba.

## Flujo Para Un Nuevo Catalogo

1. Guardar el PDF nuevo localmente. No subir PDFs crudos al repo salvo que el usuario lo pida.
2. Ejecutar dependencias si hace falta:

```bash
npm install
python3 -m pip install -r requirements.txt
```

3. Regenerar datos e imagenes desde los PDFs configurados en `scripts/build_catalog.py`:

```bash
npm run catalog:build
```

4. Abrir el modulo de revision:

```txt
http://localhost:5173/revision-catalogo-ufs
```

5. Revisar todas las referencias:
- Cada referencia visible cuenta como un producto.
- Si una pagina trae dos codigos, crear dos productos usando la misma imagen.
- Nunca dejar codigos `REVISAR-*` en el JSON final.
- Si falta precio o referencia, confirmarlo con el usuario antes de publicar.
- Mantener precio detal como precio publico.

6. Exportar el JSON revisado desde el modulo local y guardar el resultado en:

```txt
public/data/products.json
public/data/products.reviewed.json
```

7. Validar la raiz publica:
- Busqueda exacta por codigo completo.
- Busqueda por referencia base.
- Filtros combinados por tipo, linea, color y precio.
- Modal de imagen en mobile.
- Carrito: agregar, quitar, cambiar cantidad.
- WhatsApp con numero `573126125065` y mensaje legible.

8. Correr build antes de publicar:

```bash
npm run build
```

## Carga Optima A Futuro

Para catalogos mas grandes, preferir imagenes optimizadas:

- `thumbnail` para cards.
- `image` grande para el modal.
- Formato ideal: WebP o AVIF.
- Separar catalogos por version si crece mucho:

```txt
public/data/catalogs/mayo.json
public/data/catalogs/junio.json
public/data/catalog-index.json
```

La app no debe depender del PDF en produccion. Produccion consume JSON + imagenes optimizadas.

## Publicacion

Repositorio GitHub esperado: `houvid312/catalogoUFS`.

Antes de push:

```bash
npm run build
git status --short
```

No commitear:
- `node_modules`
- `dist`
- `backups`
- PDFs locales de origen

