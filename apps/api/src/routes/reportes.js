import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../lib/db.js";
import { verificarTurnstile } from "../lib/turnstile.js";
import { subirFotos, validarReporte, crearReporte } from "../lib/reportes.js";

const router = Router();

const limiterReportes = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10 });

// Endpoint de solo lectura, pero público y sin auth — el riesgo real no
// es carga, es enumeración: el folio es predecible (código + consecutivo
// global de 6 dígitos, §CLAUDE.md "mecánica del folio"), así que alguien
// podría barrer folios al azar buscando cuáles existen. Más holgado que
// limiterReportes (que protege un INSERT) pero acotado para que barrer
// miles de folios sea impráctico; un ciudadano real revisando su propio
// folio unas cuantas veces en una sesión no lo topa.
const limiterConsultaFolio = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

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

  const { errores, valores } = await validarReporte(req.body, req.files);

  // turnstile_token es exclusivo de este flujo público — Mando
  // (POST /mando/reportes) no lo pide, el usuario ya está autenticado.
  if (!req.body.turnstile_token) {
    errores.push({ campo: "turnstile_token", motivo: "requerido" });
  }

  if (errores.length > 0) {
    return res.status(400).json({ errors: errores });
  }

  const turnstileOk = await verificarTurnstile(req.body.turnstile_token, req.ip);
  if (!turnstileOk) {
    return res.status(403).json({ errors: [{ campo: "turnstile_token", motivo: "verificación fallida" }] });
  }

  try {
    const respuesta = await crearReporte({ valores, origen: "WEB" });

    if (idempotencyKey) {
      idempotenciaCache.set(idempotencyKey, { respuesta, expira: Date.now() + IDEMPOTENCIA_TTL_MS });
    }

    res.status(201).json(respuesta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

// Consulta pública de folio — el ciudadano ve estrictamente lo que
// necesita para dar seguimiento a SU reporte. Nunca contacto (ni
// enmascarado), evidencias, bitácora, coordenadas exactas ni
// duplicado_de — eso vive solo en GET /mando/reportes/:id (con auth).
// El folio se busca tal cual llega en el parámetro de ruta, sin
// reformatear ni parsearlo en partes — su forma interna (código +
// consecutivo) es un detalle de apps/api, no algo que este endpoint
// deba entender o validar.
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
