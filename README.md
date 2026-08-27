# RIGO+ — Municipio de Heroica Matamoros

Rediseño de la plataforma pública de reportes ciudadanos (reemplazo de RIGO), parte de la iniciativa Buen Gobierno.

**Demo en vivo (Pista A, congelada):** https://usyd-ship-it.github.io/rigo_mejorado/
También disponible: `/mando.html`

## Qué es esto

Portal público donde cualquier ciudadano puede reportar baches, fugas, lámparas fundidas, etc. — sin necesidad de cuenta. RIGO+ Mando es el panel interno donde el ayuntamiento gestiona esos reportes.

Nace para resolver problemas reales del sistema actual (Tactica): folios que se duplican al reclasificar, colonias mal capturadas, datos de contacto sin protección, fotos guardadas en disco no persistente.

## Estado actual

**Pista A** — `index.html` / `mando.html`: demo estática funcional, en Pages, ya no se sigue desarrollando.

**Pista B** — backend real, en construcción activa dentro de `apps/`:

- ✅ Base de datos real (Postgres + PostGIS vía Supabase): reportes, contactos protegidos, bitácora de auditoría, evidencias
- ✅ Folios generados en servidor, ID interno inmutable — resuelve de raíz el bug de folios duplicados
- ✅ `POST /reportes` público: rate limiting, CAPTCHA (Turnstile), sanitización, validación de fotos por magic bytes, subida a Cloudflare R2
- ✅ Cartografía real cargada (282 secciones, 569 colonias de Matamoros) — colonia/zona se calculan por coordenada, nunca se capturan como texto
- ✅ Login real de Mando (Supabase Auth), separado del portal público
- 🔲 Interfaz visual de Mando (KPIs, mapa operativo, expedientes) — lógica de datos lista, falta conectar pantalla

## Stack

Next.js (portal + mando) · Express (api) · PostgreSQL + PostGIS (Supabase) · Cloudflare R2 (evidencia) · Cloudflare Turnstile (CAPTCHA)

## Estructura

```
apps/
  portal/     — Next.js, portal ciudadano real
  mando/      — Next.js, panel interno (auth propia)
  api/        — Express, backend + migraciones
packages/
  catalogo/   — catálogo de 27 eventualidades, compartido
index.html    — demo estática (Pista A, congelada)
mando.html    — demo estática (Pista A, congelada)
```
