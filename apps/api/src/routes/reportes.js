import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import sanitizeHtml from "sanitize-html";
import { fileTypeFromBuffer } from "file-type";
import { eventualidadPorCodigo } from "@rigo/catalogo";
import { pool } from "../lib/db.js";
import { subirEvidencia } from "../lib/r2.js";
import { verificarTurnstile } from "../lib/turnstile.js";

const router = Router();

// Matamoros, Tamaulipas — bounding box PROVISIONAL. B4 lo reemplaza por
// punto-en-polígono real contra la cartografía zona_seccion de BG.
const MATAMOROS_BBOX = { latMin: 25.55, latMax: 26.05, lngMin: -97.75, lngMax: -97.25 };

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

const limiterReportes = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10 });

// Endpoint de solo lectura, pero público y sin auth — el riesgo real no
// es carga, es enumeración: el folio es predecible (código + consecutivo
// global de 6 dígitos, §CLAUDE.md "mecánica del folio"), así que alguien
// podría barrer folios al azar buscando cuáles existen. Más holgado que
// limiterReportes (que protege un INSERT) pero acotado para que barrer
// miles de folios sea impráctico; un ciudadano real revisando su propio
// folio unas cuantas veces en una sesión no lo topa.
const limiterConsultaFolio = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
});

function subirFotos(req, res, next) {
  upload.array("fotos", 5)(req, res, (err) => {
    if (!err) return next();
    const esLimite = ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(err.code);
    res.status(esLimite ? 413 : 400).json({ errors: [{ campo: "fotos", motivo: err.message }] });
  });
}

// Idempotencia en memoria — suficiente para una sola instancia del
// proceso; si escalamos a varias instancias, mover a Redis o a una tabla.
const idempotenciaCache = new Map();
const IDEMPOTENCIA_TTL_MS = 5 * 60 * 1000;

function limpiarIdempotenciaVencida() {
  const ahora = Date.now();
  for (const [key, entrada] of idempotenciaCache) {
    if (entrada.expira < ahora) idempotenciaCache.delete(key);
  }
}

router.post("/", limiterReportes, subirFotos, async (req, res) => {
  limpiarIdempotenciaVencida();

  const idempotencyKey = req.body.idempotency_key;
  if (idempotencyKey && idempotenciaCache.has(idempotencyKey)) {
    return res.status(201).json(idempotenciaCache.get(idempotencyKey).respuesta);
  }

  const {
    eventualidad_cod,
    descripcion,
    lat,
    lng,
    ubicacion_confirmada,
    direccion_texto,
    nombre,
    telefono,
    turnstile_token,
  } = req.body;

  const errores = [];

  if (!eventualidad_cod || !eventualidadPorCodigo(eventualidad_cod)) {
    errores.push({ campo: "eventualidad_cod", motivo: "código inválido" });
  }

  const desc = typeof descripcion === "string" ? descripcion.trim() : "";
  if (desc.length < 10 || desc.length > 2000) {
    errores.push({ campo: "descripcion", motivo: "debe tener entre 10 y 2000 caracteres" });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    errores.push({ campo: "lat/lng", motivo: "coordenada inválida" });
  } else if (
    latNum < MATAMOROS_BBOX.latMin ||
    latNum > MATAMOROS_BBOX.latMax ||
    lngNum < MATAMOROS_BBOX.lngMin ||
    lngNum > MATAMOROS_BBOX.lngMax
  ) {
    errores.push({ campo: "lat/lng", motivo: "fuera de los límites del municipio" });
  }

  if (ubicacion_confirmada !== "true" && ubicacion_confirmada !== true) {
    errores.push({ campo: "ubicacion_confirmada", motivo: "requerido" });
  }

  if (!turnstile_token) {
    errores.push({ campo: "turnstile_token", motivo: "requerido" });
  }

  if (direccion_texto && direccion_texto.length > 300) {
    errores.push({ campo: "direccion_texto", motivo: "máximo 300 caracteres" });
  }

  const archivos = req.files || [];
  const archivosValidados = [];
  for (const archivo of archivos) {
    const tipoReal = await fileTypeFromBuffer(archivo.buffer);
    if (!tipoReal || !TIPOS_PERMITIDOS.has(tipoReal.mime)) {
      errores.push({
        campo: "fotos",
        motivo: `archivo "${archivo.originalname}" no es jpeg/png/webp válido`,
      });
      continue;
    }
    archivosValidados.push({ archivo, mime: tipoReal.mime });
  }

  if (errores.length > 0) {
    return res.status(400).json({ errors: errores });
  }

  const turnstileOk = await verificarTurnstile(turnstile_token, req.ip);
  if (!turnstileOk) {
    return res.status(403).json({ errors: [{ campo: "turnstile_token", motivo: "verificación fallida" }] });
  }

  const descripcionLimpia = sanitizeHtml(desc, { allowedTags: [], allowedAttributes: {} });
  const direccionLimpia = direccion_texto
    ? sanitizeHtml(direccion_texto.trim(), { allowedTags: [], allowedAttributes: {} })
    : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let contactoId = null;
    if (nombre || telefono) {
      const { rows } = await client.query(
        "insert into contactos (nombre, telefono) values ($1, $2) returning id",
        [nombre || null, telefono || null]
      );
      contactoId = rows[0].id;
    }

    const { rows: reporteRows } = await client.query(
      `insert into reportes
         (eventualidad_cod, descripcion, ubicacion, ubicacion_verificada,
          direccion_texto, origen, contacto_id)
       values
         ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, 'WEB', $7)
       returning id, folio, estatus, creado_en`,
      [eventualidad_cod, descripcionLimpia, lngNum, latNum, true, direccionLimpia, contactoId]
    );
    const reporte = reporteRows[0];

    for (const { archivo, mime } of archivosValidados) {
      const objectKey = `reportes/${reporte.id}/${randomUUID()}`;
      await subirEvidencia({ objectKey, buffer: archivo.buffer, mimeType: mime });
      await client.query(
        "insert into evidencias (reporte_id, object_key, mime_type, tamano_bytes) values ($1, $2, $3, $4)",
        [reporte.id, objectKey, mime, archivo.size]
      );
    }

    await client.query(
      `insert into bitacora (reporte_id, evento, estatus_nuevo) values ($1, 'cambio_estatus', 'recibido')`,
      [reporte.id]
    );

    await client.query("COMMIT");

    const respuesta = { folio: reporte.folio, estatus: reporte.estatus, creado_en: reporte.creado_en };

    if (idempotencyKey) {
      idempotenciaCache.set(idempotencyKey, { respuesta, expira: Date.now() + IDEMPOTENCIA_TTL_MS });
    }

    res.status(201).json(respuesta);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  } finally {
    client.release();
  }
});

// Consulta pública de folio — el ciudadano ve estrictamente lo que
// necesita para dar seguimiento a SU reporte. Nunca contacto (ni
// enmascarado), evidencias, bitácora, coordenadas exactas ni
// duplicado_de — eso vive solo en GET /mando/reportes/:id (con auth).
// El folio se busca tal cual llega, sin reformatear ni parsearlo en
// partes — su forma interna (código + consecutivo) es un detalle de
// apps/api, no algo que este endpoint deba entender o validar.
router.get("/:folio", limiterConsultaFolio, async (req, res) => {
  const { folio } = req.params;

  try {
    const { rows } = await pool.query(
      `select
         r.folio, r.estatus, r.colonia_calculada, r.creado_en, r.actualizado_en,
         e.codigo as eventualidad_cod, e.nombre as eventualidad_nombre
       from reportes r
       join eventualidades e on e.codigo = r.eventualidad_cod
       where r.folio = $1`,
      [folio]
    );

    if (rows.length === 0) {
      return res.status(404).json({ errors: [{ campo: "folio", motivo: "reporte no encontrado" }] });
    }
    const r = rows[0];

    res.json({
      folio: r.folio,
      estatus: r.estatus,
      eventualidad: { codigo: r.eventualidad_cod, nombre: r.eventualidad_nombre },
      colonia_calculada: r.colonia_calculada,
      creado_en: r.creado_en,
      actualizado_en: r.actualizado_en,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

export default router;
