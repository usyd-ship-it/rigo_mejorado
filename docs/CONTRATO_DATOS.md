# Contrato de datos — RIGO+ Mando (API interna)

**Alcance de este documento.** Esto documenta la API real que ya existe hoy entre `apps/mando` (frontend) y `apps/api` (backend): `GET /mando/resumen`, `GET /mando/reportes`, `GET /mando/reportes/mapa`, `GET /mando/reportes/:id`. **No es** el contrato de pull incremental para Buen Gobierno (`GET /api/v1/reportes`, con API key) que describe el prototipo `mando.html` — ese es un endpoint distinto, de B6, todavía no construido. Ver la sección "Discrepancias con el prototipo" para la relación entre ambos.

Migrado casi verbatim, donde aplica, de la vista "Contrato de datos" de `rigo-mejorado/mando.html` (líneas 349–423) — es la única versión previa que existe en el proyecto; no hay ningún otro `.md` de contrato, y `tableros_60_facilitadores-MMM.html` no tiene sección equivalente.

---

## 1. Autenticación

Los cuatro endpoints están montados bajo `router.use(requireMando)` en `apps/api/src/routes/mando.js` — **todos** requieren:

1. Header `Authorization: Bearer <access_token>` — el `access_token` de la sesión activa de Supabase Auth (mismo mecanismo de `apps/mando`, login de B5).
2. El `id` del usuario autenticado (`auth.users.id`) debe tener una fila correspondiente en `usuarios_mando` — tener cuenta de Supabase no basta.

Sin token → `401`. Token válido pero sin fila en `usuarios_mando` → `403`. Ninguno de los cuatro endpoints usa ni expone `usuarios_mando.rol` para diferenciar acceso todavía — cualquier fila en `usuarios_mando` (`admin` u `operador`) pasa el gate por igual.

CORS: `/mando/*` está restringido al origen de `MANDO_ORIGIN` (variable de entorno), no abierto como `/reportes` (portal público).

---

## 2. Enum de estatus

Los 8 valores válidos, **en el orden real** de `ESTATUS_VALIDOS` (`apps/api/src/routes/mando.js`):

| # | Valor máquina |
|---|---|
| 1 | `recibido` |
| 2 | `clasificado` |
| 3 | `en_atencion` |
| 4 | `en_espera` |
| 5 | `resuelto` |
| 6 | `cerrado` |
| 7 | `reabierto` |
| 8 | `improcedente` |

Es el mismo enum documentado en `CLAUDE.md §5` y en el `CHECK` constraint de `reportes.estatus` (migración `0001_init_schema.sql`) — no hay divergencia aquí entre prototipo, código y documento madre.

---

## 3. Formato de folio — ⚠️ advertencia, no solo dato

Formato: `[CÓDIGO_EVENTUALIDAD]-[consecutivo de 6 dígitos]`. Ejemplo **real**, confirmado end-to-end en B3: `LAF-026409`.

**El folio se congela una sola vez, en el `INSERT`, vía un trigger `BEFORE INSERT` (`0002_folio_generation.sql`) — nunca se regenera, ni al reclasificar `eventualidad_cod`.** Cualquier código que lea `reportes.folio` debe tratarlo como texto opaco e inmutable una vez asignado: **nunca reformatear, nunca recalcular, nunca reconstruir a partir de `eventualidad_cod` + un contador.**

Esta advertencia existe porque ya causó un error real en una sesión anterior: el primer borrador del contrato de `POST /reportes` (B3) asumió el formato `RIGO-2026-######` (el que sí aparece en el JSON de ejemplo de `mando.html`) antes de que se confirmara la decisión real (formato `[COD]-######`, motivada por el bug de folios dobles del visor Tactica — ver `CLAUDE.md §4`). Si vuelves a tocar código de folio, parte de este documento o de las migraciones `0001`/`0002`, no del ejemplo del prototipo.

---

## 4. Endpoints

### 4.1 `GET /mando/resumen`

- **Auth:** `requireMando`.
- **Query params:** ninguno.
- **Respuesta `200`:**

```json
{
  "total": 0,
  "por_estatus": [
    { "estatus": "recibido", "cantidad": 0 },
    { "estatus": "clasificado", "cantidad": 0 },
    { "estatus": "en_atencion", "cantidad": 0 },
    { "estatus": "en_espera", "cantidad": 0 },
    { "estatus": "resuelto", "cantidad": 0 },
    { "estatus": "cerrado", "cantidad": 0 },
    { "estatus": "reabierto", "cantidad": 0 },
    { "estatus": "improcedente", "cantidad": 0 }
  ],
  "porcentaje_resuelto": 0.0
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `total` | `int` | suma de todas las `cantidad` |
| `por_estatus` | `array` | **siempre 8 elementos**, uno por cada valor de `ESTATUS_VALIDOS`, en ese orden — un estatus sin reportes aparece con `cantidad: 0`, nunca se omite |
| `por_estatus[].estatus` | `string` | uno de los 8 valores de §2 |
| `por_estatus[].cantidad` | `int` | |
| `porcentaje_resuelto` | `float` | redondeado a 1 decimal; `(cantidad de "resuelto" / total) * 100`; `0` si `total` es 0 (sin división entre cero) |

---

### 4.2 `GET /mando/reportes`

- **Auth:** `requireMando`.
- **Query params** (todos opcionales; nombre de filtro ≠ necesariamente nombre de campo en la respuesta, ver tabla):

| Parámetro | Tipo | Filtra contra la columna | Validación |
|---|---|---|---|
| `estatus` | `string` | `reportes.estatus` | debe ser uno de los 8 valores de §2 — si no, `400` |
| `zona` | `string` | `reportes.zona_seccion` | igualdad exacta, sin validar valores posibles |
| `colonia` | `string` | `reportes.colonia_calculada` | igualdad exacta |
| `fecha_desde` | `string` (fecha parseable) | `reportes.creado_en >=` | `400` si `Date.parse` falla |
| `fecha_hasta` | `string` (fecha parseable) | `reportes.creado_en <=` | `400` si `Date.parse` falla |
| `pagina` | `int` | — | default `1`, mínimo `1` |
| `por_pagina` | `int` | — | default `50`, máximo `200` |

Nota explícita porque es fácil confundirlo: el parámetro es `?zona=` pero el campo que regresa la respuesta es `zona_seccion`; el parámetro es `?colonia=` pero el campo es `colonia_calculada`.

Orden: `creado_en desc`, fijo — no hay parámetro para cambiarlo hoy.

- **Respuesta `200`:**

```json
{
  "pagina": 1,
  "por_pagina": 50,
  "total": 0,
  "reportes": [
    {
      "id": "<uuid>",
      "folio": "LAF-026409",
      "eventualidad": { "codigo": "LAF", "nombre": "Lámpara Fundida", "familia": "Alumbrado público" },
      "estatus": "recibido",
      "colonia_calculada": null,
      "zona_seccion": null,
      "origen": "WEB",
      "ubicacion": { "lat": 25.8697, "lng": -97.5044 },
      "creado_en": "<timestamptz ISO>",
      "actualizado_en": "<timestamptz ISO>"
    }
  ]
}
```

`origen` ∈ `WEB` | `WA` | `CC` | `RIGO`. `eventualidad` **no incluye `critica`** aquí — sí la incluye el detalle (§4.4); es una asimetría real entre lista y detalle, no un error de este documento.

---

### 4.3 `GET /mando/reportes/mapa`

- **Auth:** `requireMando`.
- **Query params:** exactamente los mismos filtros de §4.2 (`estatus`, `zona`, `colonia`, `fecha_desde`, `fecha_hasta`), misma validación (función compartida `construirFiltrosReportes`, no reimplementada). **Sin `pagina`/`por_pagina` — no aplica, no es paginado.**
- Devuelve **todos** los reportes que cumplen el filtro. No filtra `ubicacion is not null` porque la columna ya es `NOT NULL` en el schema.
- **Respuesta `200`:**

```json
{
  "reportes": [
    { "id": "<uuid>", "folio": "LAF-026409", "estatus": "recibido", "lat": 25.8697, "lng": -97.5044 }
  ]
}
```

Deliberadamente ligero: solo lo necesario para pintar un pin. Sin `descripcion`, `evidencias`, `contacto` ni `bitacora` — eso se pide aparte, vía §4.4, al hacer clic en un pin.

---

### 4.4 `GET /mando/reportes/:id`

- **Auth:** `requireMando`.
- **Path param:** `id` (uuid de `reportes.id`).
- `id` inexistente → `404`. El gate de `requireMando` corre antes que cualquier lookup, así que un usuario sin fila en `usuarios_mando` recibe `403` sin que el `404`/`200` posterior revele si el reporte existe.
- **Respuesta `200`:**

```json
{
  "id": "<uuid>",
  "folio": "LAF-026409",
  "folio_legado": null,
  "eventualidad": { "codigo": "LAF", "nombre": "Lámpara Fundida", "familia": "Alumbrado público", "critica": false },
  "estatus": "recibido",
  "descripcion": null,
  "ubicacion": {
    "lat": 25.8697,
    "lng": -97.5044,
    "verificada": true,
    "colonia_calculada": null,
    "zona_seccion": null
  },
  "direccion_texto": null,
  "asignacion": {
    "secretaria": null,
    "direccion_area": null,
    "enlace_gestor": null,
    "cuadrilla": null
  },
  "origen": "WEB",
  "duplicado_de": null,
  "contacto": null,
  "evidencias": [],
  "bitacora": [],
  "creado_en": "<timestamptz ISO>",
  "actualizado_en": "<timestamptz ISO>"
}
```

`contacto`, si el reporte tiene `contacto_id`:

```json
{ "nombre": "J··· Pérez", "telefono": "868 ··· 4567" }
```

(ejemplos de formato de máscara, no datos reales — ver §5).

`evidencias[]`:

| Campo | Tipo |
|---|---|
| `id` | `uuid` |
| `mime_type` | `string` |
| `tamano_bytes` | `int` |
| `url_firmada` | `string` (URL, expira — ver §5) |
| `expira_en` | `timestamp ISO` |
| `creado_en` | `timestamptz ISO` |

`bitacora[]`:

| Campo | Tipo |
|---|---|
| `id` | `uuid` |
| `evento` | `"cambio_estatus"` \| `"revelacion_contacto"` \| `"asignacion"` \| `"nota"` |
| `estatus_anterior` | `string \| null` — solo si `evento = "cambio_estatus"` |
| `estatus_nuevo` | `string \| null` — solo si `evento = "cambio_estatus"` |
| `detalle` | `object \| null` (jsonb) — el schema lo soporta; **hoy ningún endpoint lo escribe todavía**, siempre viaja `null` en la práctica |
| `usuario_id` | `uuid string \| null` — `null` si el evento fue generado por el sistema |
| `usuario_nombre` | `string \| null` — `usuarios_mando.nombre` vía `LEFT JOIN`; `null` si `usuario_id` es nulo o no coincide |
| `creado_en` | `timestamptz ISO` |

---

## 5. Campos sensibles y su tratamiento

- **Contacto** (`contactos.nombre`, `contactos.telefono`): en `GET /reportes/:id` viajan **siempre enmascarados** — nunca texto plano. Máscara real (`apps/api/src/routes/mando.js`, `maskNombre`/`maskTelefono`): nombre = primer carácter + `···` + todo desde el primer espacio incluido; teléfono = primeros 3 caracteres + ` ··· ` + últimos 4. Ver contacto real solo vía `POST /mando/reportes/:id/revelar-contacto` (fuera de este documento — no es un `GET`), que además escribe una entrada `revelacion_contacto` en `bitacora`, auditando cada acceso.
- **`evidencias[].url_firmada`**: URL firmada de R2, expira en **900 segundos (15 min)** (`EVIDENCIA_URL_TTL_SEGUNDOS`). No debe cachearse ni persistirse más allá de la sesión en que se pidió — cada llamada a `GET /reportes/:id` genera URLs nuevas.

---

## 6. Campos del schema que existen pero no se exponen (todavía)

Confirmado columna por columna contra `apps/api/migrations/0001_init_schema.sql` y el código real de los 4 endpoints — no es una lista de intención, es lo que de verdad no viaja hoy:

| Campo / tabla | Dónde vive | Se expone en |
|---|---|---|
| `reportes.contacto_id` | `reportes` | **En ningún endpoint** — solo se resuelve a `contacto.nombre`/`telefono` (enmascarados); el UUID de la FK nunca viaja |
| `reportes.duplicado_de` | `reportes` | Solo en `GET /reportes/:id` — no en lista ni en mapa |
| `eventualidades.critica` | `eventualidades` | Solo en `GET /reportes/:id` — no en `GET /reportes` (asimetría real, ver §4.2) |
| `usuarios_mando.rol` | `usuarios_mando` | **En ningún endpoint** — se usa solo para el gate de `requireMando` (existencia de fila), no para diferenciar `admin` de `operador` en ninguna respuesta ni en ninguna lógica de autorización todavía |
| `usuarios_mando.secretaria` / `direccion_area` / `enlace_gestor` | `usuarios_mando` | **En ningún endpoint** — solo `usuarios_mando.nombre` sale, vía `bitacora[].usuario_nombre` |
| `zona_seccion.entidad` / `distrito_f` / `distrito_l` / `tipo` / `geom` | `zona_seccion` (cartografía) | **En ningún endpoint** — solo el texto derivado `reportes.zona_seccion` sale; la tabla de cartografía en sí (incluida su geometría) nunca se expone |
| `colonias.clasificacion` / `cp` / `geom` | `colonias` (cartografía) | **En ningún endpoint** — solo `reportes.colonia_calculada` (el nombre) sale |
| `bitacora.detalle` | `bitacora` | Sí se expone (campo presente en la respuesta), pero **ningún código lo escribe todavía** — viaja `null` siempre en la práctica actual |
| `evidencias.object_key` | `evidencias` | **En ningún endpoint** — la key cruda de R2 nunca sale, solo la `url_firmada` derivada (§5) |
| `contactos.id` / `contactos.creado_en` | `contactos` | **En ningún endpoint** — solo `nombre`/`telefono` enmascarados, dentro de `contacto` |

---

## 7. Discrepancias con el prototipo (`mando.html`)

No se resolvieron aquí a propósito — quedan documentadas para que quien las lea decida:

1. **Formato de folio.** El JSON de ejemplo de `mando.html` (sección "Endpoint de pull incremental para BG") usa `"folio": "RIGO-2026-004523"`. El formato real, implementado y verificado end-to-end, es `[COD]-######` (ejemplo real: `LAF-026409`). Ver advertencia completa en §3.
2. **Nombre de campo de zona.** El mismo ejemplo usa `"zona": 41` (numérico, dentro del objeto `ubicacion`). El campo real es `zona_seccion` (`string`, no `int` — la sección es texto, ej. `"41"`), y así se llama en los 4 endpoints reales.
3. **El endpoint documentado en el prototipo no es el que existe hoy.** `mando.html` documenta `GET /api/v1/reportes?actualizado_desde=...` con `X-API-Key`, pensado para el pull incremental de Buen Gobierno (roadmap B6, **no construido todavía**). Los endpoints reales de este documento (`/mando/resumen`, `/mando/reportes`, `/mando/reportes/mapa`, `/mando/reportes/:id`) son la API interna de `apps/mando`, con auth de Supabase Bearer token — un mecanismo y una audiencia distintos. Cuando se construya B6, va a necesitar su propio documento, no una extensión de este.
4. **Columna "¿Visible al ciudadano?"** de la tabla de enum en `mando.html` no tiene equivalente aquí — es información sobre el portal público, no sobre esta API. Sigue vigente en `CLAUDE.md §5`, no se repite en este documento porque no es un campo que ningún endpoint de `/mando` devuelva.
