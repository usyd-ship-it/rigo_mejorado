import { randomUUID } from "node:crypto";
import multer from "multer";
import sanitizeHtml from "sanitize-html";
import { fileTypeFromBuffer } from "file-type";
import { eventualidadPorCodigo } from "@rigo/catalogo";
import { pool } from "./db.js";
import { subirEvidencia } from "./r2.js";

// Matamoros, Tamaulipas — bounding box PROVISIONAL. B4 lo reemplaza por
// punto-en-polígono real contra la cartografía zona_seccion de BG.
export const MATAMOROS_BBOX = { latMin: 25.55, latMax: 26.05, lngMin: -97.75, lngMax: -97.25 };

export const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

// Multer + límites de archivo — compartidos entre POST /reportes
// (público) y POST /mando/reportes (operadores) para que el máximo de
// 5 fotos / 8MB c/u nunca pueda desincronizarse entre los dos flujos.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
});

export function subirFotos(req, res, next) {
  upload.array("fotos", 5)(req, res, (err) => {
    if (!err) return next();
    const esLimite = ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(err.code);
    res.status(esLimite ? 413 : 400).json({ errors: [{ campo: "fotos", motivo: err.message }] });
  });
}

// Validación de campos — compartida entre el flujo público y Mando.
// Deliberadamente NO valida turnstile_token: es específico del flujo
// público (el ciudadano es anónimo); Mando ya pasó por requireMando,
// así que cada ruta agrega esa verificación aparte donde corresponda.
export async function validarReporte(body, archivos) {
  const { eventualidad_cod, descripcion, lat, lng, ubicacion_confirmada, direccion_texto, nombre, telefono } = body;
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

  if (direccion_texto && direccion_texto.length > 300) {
    errores.push({ campo: "direccion_texto", motivo: "máximo 300 caracteres" });
  }

  const archivosValidados = [];
  for (const archivo of archivos || []) {
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

  return {
    errores,
    valores: {
      eventualidadCod: eventualidad_cod,
      descripcionLimpia: sanitizeHtml(desc, { allowedTags: [], allowedAttributes: {} }),
      latNum,
      lngNum,
      direccionLimpia: direccion_texto
        ? sanitizeHtml(direccion_texto.trim(), { allowedTags: [], allowedAttributes: {} })
        : null,
      nombre,
      telefono,
      archivosValidados,
    },
  };
}

// Inserta el reporte ya validado — mismo INSERT para ambos flujos.
// usuarioId es null en el flujo público (anónimo, POST /reportes); en
// Mando (POST /mando/reportes) es req.usuario.id, lo que ya distingue
// en la bitácora un reporte creado por un operador de uno creado
// directamente por el ciudadano, sin necesitar un evento nuevo.
export async function crearReporte({ valores, origen, usuarioId = null }) {
  const { eventualidadCod, descripcionLimpia, latNum, lngNum, direccionLimpia, nombre, telefono, archivosValidados } =
    valores;

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
         ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8)
       returning id, folio, estatus, creado_en`,
      [eventualidadCod, descripcionLimpia, lngNum, latNum, true, direccionLimpia, origen, contactoId]
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
      `insert into bitacora (reporte_id, evento, estatus_nuevo, usuario_id) values ($1, 'cambio_estatus', 'recibido', $2)`,
      [reporte.id, usuarioId]
    );

    await client.query("COMMIT");
    return { folio: reporte.folio, estatus: reporte.estatus, creado_en: reporte.creado_en };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
