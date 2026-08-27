import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireMando } from "../lib/auth.js";

const router = Router();
router.use(requireMando);

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
