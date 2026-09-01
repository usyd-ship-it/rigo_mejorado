import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../lib/db.js";
import { requireMando } from "../lib/auth.js";
import { urlFirmada } from "../lib/r2.js";
import { subirFotos, validarReporte, crearReporte } from "../lib/reportes.js";

const router = Router();
router.use(requireMando);

// Más holgado que el público (POST /reportes: 10/hora, para desconocidos
// anónimos) porque son operadores ya autenticados, no cero porque una
// cuenta comprometida o un bug de UI en bucle no debería poder crear
// reportes sin límite.
const limiterReportesManual = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20 });

const ESTATUS_VALIDOS = [
  "recibido",
  "clasificado",
  "en_atencion",
  "en_espera",
  "resuelto",
  "cerrado",
  "reabierto",
  "improcedente",
];

const EVIDENCIA_URL_TTL_SEGUNDOS = 900; // 15 min

function maskNombre(nombre) {
  if (!nombre) return null;
  const primerEspacio = nombre.indexOf(" ");
  return primerEspacio === -1 ? nombre[0] + "···" : nombre[0] + "···" + nombre.slice(primerEspacio);
}

function maskTelefono(telefono) {
  if (!telefono) return null;
  return telefono.slice(0, 3) + " ··· " + telefono.slice(-4);
}

// Compartida entre GET /reportes y GET /reportes/mapa — mismo comportamiento
// exacto que antes (primer campo inválido corta con error), sin duplicar.
function construirFiltrosReportes(query) {
  const { estatus, zona, colonia, fecha_desde, fecha_hasta } = query;
  const condiciones = [];
  const valores = [];

  if (estatus) {
    if (!ESTATUS_VALIDOS.includes(estatus)) {
      return { error: { campo: "estatus", motivo: "valor inválido" } };
    }
    valores.push(estatus);
    condiciones.push(`r.estatus = $${valores.length}`);
  }
  if (zona) {
    valores.push(zona);
    condiciones.push(`r.zona_seccion = $${valores.length}`);
  }
  if (colonia) {
    valores.push(colonia);
    condiciones.push(`r.colonia_calculada = $${valores.length}`);
  }
  if (fecha_desde) {
    if (Number.isNaN(Date.parse(fecha_desde))) {
      return { error: { campo: "fecha_desde", motivo: "fecha inválida" } };
    }
    valores.push(fecha_desde);
    condiciones.push(`r.creado_en >= $${valores.length}`);
  }
  if (fecha_hasta) {
    if (Number.isNaN(Date.parse(fecha_hasta))) {
      return { error: { campo: "fecha_hasta", motivo: "fecha inválida" } };
    }
    valores.push(fecha_hasta);
    condiciones.push(`r.creado_en <= $${valores.length}`);
  }

  return { condiciones, valores };
}

router.get("/resumen", async (req, res) => {
  try {
    // unnest(ESTATUS_VALIDOS) como tabla base + LEFT JOIN: garantiza que
    // todo estatus válido aparezca con cantidad 0 si no tiene reportes,
    // en una sola query (no se trae todo a JS para contar ahí).
    const { rows } = await pool.query(
      `select est.estatus, coalesce(count(r.id), 0)::int as cantidad
       from unnest($1::text[]) as est(estatus)
       left join reportes r on r.estatus = est.estatus
       group by est.estatus
       order by array_position($1::text[], est.estatus)`,
      [ESTATUS_VALIDOS]
    );

    const total = rows.reduce((suma, fila) => suma + fila.cantidad, 0);
    const resuelto = rows.find((fila) => fila.estatus === "resuelto");
    const porcentajeResuelto =
      total > 0 ? Math.round(((resuelto?.cantidad ?? 0) / total) * 1000) / 10 : 0;

    res.json({
      total,
      por_estatus: rows,
      porcentaje_resuelto: porcentajeResuelto,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

// Levantar un reporte manualmente (ciudadano en ventanilla o por
// teléfono) — reusa exactamente la misma validación e inserción que
// POST /reportes (apps/api/src/lib/reportes.js), sin turnstile_token
// (el operador ya pasó por requireMando) y con origen fijo en 'CC'
// (valor ya aceptado por el CHECK constraint de reportes.origen; no es
// arbitrario ni viene del body). La bitácora usa el mismo evento
// 'cambio_estatus' / estatus_nuevo 'recibido' que el flujo público,
// pero con usuario_id = req.usuario.id — eso ya distingue un reporte
// creado por un operador de uno anónimo, sin necesitar un evento nuevo.
router.post("/reportes", limiterReportesManual, subirFotos, async (req, res) => {
  const { errores, valores } = await validarReporte(req.body, req.files);

  if (errores.length > 0) {
    return res.status(400).json({ errors: errores });
  }

  try {
    const respuesta = await crearReporte({ valores, origen: "CC", usuarioId: req.usuario.id });
    res.status(201).json(respuesta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

router.get("/reportes", async (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const porPagina = Math.min(200, Math.max(1, parseInt(req.query.por_pagina, 10) || 50));

  const filtro = construirFiltrosReportes(req.query);
  if (filtro.error) {
    return res.status(400).json({ errors: [filtro.error] });
  }
  const { condiciones, valores } = filtro;
  const where = condiciones.length ? `where ${condiciones.join(" and ")}` : "";

  try {
    const { rows: totalRows } = await pool.query(
      `select count(*)::int as total from reportes r ${where}`,
      valores
    );

    const limitIdx = valores.length + 1;
    const offsetIdx = valores.length + 2;
    const { rows } = await pool.query(
      `select
         r.id, r.folio, r.eventualidad_cod,
         e.nombre as eventualidad_nombre, e.familia as eventualidad_familia,
         r.estatus, r.colonia_calculada, r.zona_seccion, r.origen,
         ST_Y(r.ubicacion::geometry) as lat, ST_X(r.ubicacion::geometry) as lng,
         r.creado_en, r.actualizado_en
       from reportes r
       join eventualidades e on e.codigo = r.eventualidad_cod
       ${where}
       order by r.creado_en desc
       limit $${limitIdx} offset $${offsetIdx}`,
      [...valores, porPagina, (pagina - 1) * porPagina]
    );

    res.json({
      pagina,
      por_pagina: porPagina,
      total: totalRows[0].total,
      reportes: rows.map((r) => ({
        id: r.id,
        folio: r.folio,
        eventualidad: { codigo: r.eventualidad_cod, nombre: r.eventualidad_nombre, familia: r.eventualidad_familia },
        estatus: r.estatus,
        colonia_calculada: r.colonia_calculada,
        zona_seccion: r.zona_seccion,
        origen: r.origen,
        ubicacion: { lat: r.lat, lng: r.lng },
        creado_en: r.creado_en,
        actualizado_en: r.actualizado_en,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

// Registrada ANTES de /reportes/:id — si no, Express trataría "mapa"
// como si fuera el :id del reporte y nunca llegaría aquí.
router.get("/reportes/mapa", async (req, res) => {
  const filtro = construirFiltrosReportes(req.query);
  if (filtro.error) {
    return res.status(400).json({ errors: [filtro.error] });
  }
  const { condiciones, valores } = filtro;
  const where = condiciones.length ? `where ${condiciones.join(" and ")}` : "";

  // Sin paginación a propósito: son todos los puntos para el mapa. No
  // hace falta filtrar ubicacion is not null — la columna es NOT NULL.
  try {
    const { rows } = await pool.query(
      `select r.id, r.folio, r.estatus,
              ST_Y(r.ubicacion::geometry) as lat, ST_X(r.ubicacion::geometry) as lng
       from reportes r
       ${where}
       order by r.creado_en desc`,
      valores
    );
    res.json({ reportes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

router.get("/reportes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `select
         r.id, r.folio, r.folio_legado, r.eventualidad_cod,
         e.nombre as eventualidad_nombre, e.familia as eventualidad_familia, e.critica as eventualidad_critica,
         r.estatus, r.descripcion,
         ST_Y(r.ubicacion::geometry) as lat, ST_X(r.ubicacion::geometry) as lng,
         r.ubicacion_verificada, r.colonia_calculada, r.zona_seccion, r.direccion_texto,
         r.secretaria, r.direccion_area, r.enlace_gestor, r.cuadrilla,
         r.origen, r.duplicado_de, r.creado_en, r.actualizado_en,
         c.nombre as contacto_nombre, c.telefono as contacto_telefono
       from reportes r
       join eventualidades e on e.codigo = r.eventualidad_cod
       left join contactos c on c.id = r.contacto_id
       where r.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ errors: [{ campo: "id", motivo: "reporte no encontrado" }] });
    }
    const r = rows[0];

    const { rows: evidenciasRows } = await pool.query(
      "select id, object_key, mime_type, tamano_bytes, creado_en from evidencias where reporte_id = $1 order by creado_en asc",
      [id]
    );
    const evidencias = await Promise.all(
      evidenciasRows.map(async (ev) => ({
        id: ev.id,
        mime_type: ev.mime_type,
        tamano_bytes: ev.tamano_bytes,
        url_firmada: await urlFirmada(ev.object_key, EVIDENCIA_URL_TTL_SEGUNDOS),
        expira_en: new Date(Date.now() + EVIDENCIA_URL_TTL_SEGUNDOS * 1000).toISOString(),
        creado_en: ev.creado_en,
      }))
    );

    const { rows: bitacora } = await pool.query(
      `select b.id, b.evento, b.estatus_anterior, b.estatus_nuevo, b.detalle, b.usuario_id,
              um.nombre as usuario_nombre, b.creado_en
       from bitacora b
       left join usuarios_mando um on um.id::text = b.usuario_id
       where b.reporte_id = $1
       order by b.creado_en desc`,
      [id]
    );

    res.json({
      id: r.id,
      folio: r.folio,
      folio_legado: r.folio_legado,
      eventualidad: {
        codigo: r.eventualidad_cod,
        nombre: r.eventualidad_nombre,
        familia: r.eventualidad_familia,
        critica: r.eventualidad_critica,
      },
      estatus: r.estatus,
      descripcion: r.descripcion,
      ubicacion: {
        lat: r.lat,
        lng: r.lng,
        verificada: r.ubicacion_verificada,
        colonia_calculada: r.colonia_calculada,
        zona_seccion: r.zona_seccion,
      },
      direccion_texto: r.direccion_texto,
      asignacion: {
        secretaria: r.secretaria,
        direccion_area: r.direccion_area,
        enlace_gestor: r.enlace_gestor,
        cuadrilla: r.cuadrilla,
      },
      origen: r.origen,
      duplicado_de: r.duplicado_de,
      contacto: r.contacto_nombre || r.contacto_telefono
        ? { nombre: maskNombre(r.contacto_nombre), telefono: maskTelefono(r.contacto_telefono) }
        : null,
      evidencias,
      bitacora,
      creado_en: r.creado_en,
      actualizado_en: r.actualizado_en,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  }
});

router.patch("/reportes/:id", async (req, res) => {
  const { id } = req.params;
  const { estatus } = req.body;

  if (!ESTATUS_VALIDOS.includes(estatus)) {
    return res.status(400).json({ errors: [{ campo: "estatus", motivo: "valor inválido" }] });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query("select estatus from reportes where id = $1 for update", [id]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ errors: [{ campo: "id", motivo: "reporte no encontrado" }] });
    }
    const estatusAnterior = rows[0].estatus;

    await client.query("update reportes set estatus = $1 where id = $2", [estatus, id]);

    await client.query(
      `insert into bitacora (reporte_id, evento, estatus_anterior, estatus_nuevo, usuario_id)
       values ($1, 'cambio_estatus', $2, $3, $4)`,
      [id, estatusAnterior, estatus, req.usuario.id]
    );

    await client.query("COMMIT");
    res.json({ id, estatus });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  } finally {
    client.release();
  }
});

router.post("/reportes/:id/revelar-contacto", async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `select c.nombre, c.telefono
       from reportes r join contactos c on c.id = r.contacto_id
       where r.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ errors: [{ campo: "id", motivo: "reporte o contacto no encontrado" }] });
    }

    await client.query(`insert into bitacora (reporte_id, evento, usuario_id) values ($1, 'revelacion_contacto', $2)`, [
      id,
      req.usuario.id,
    ]);

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ errors: [{ campo: null, motivo: "error interno" }] });
  } finally {
    client.release();
  }
});

export default router;
