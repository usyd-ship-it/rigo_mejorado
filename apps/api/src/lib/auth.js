import { createClient } from "@supabase/supabase-js";
import { pool } from "./db.js";

// Perezoso a propósito: createClient valida la URL de forma síncrona,
// y no queremos que el servidor entero truene por faltar credenciales
// de Supabase mientras nadie llame a /mando (ver R2/Turnstile, mismo criterio).
let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseAdmin;
}

// Verifica el Bearer token de Supabase Auth y exige que el usuario tenga
// fila en usuarios_mando — separado de auth.users porque no todo el que
// tiene cuenta de Supabase debe poder entrar a Mando.
export async function requireMando(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ errors: [{ campo: null, motivo: "falta token" }] });
  }

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ errors: [{ campo: null, motivo: "token inválido" }] });
  }

  const { rows } = await pool.query("select id, nombre, rol from usuarios_mando where id = $1", [
    data.user.id,
  ]);
  if (rows.length === 0) {
    return res.status(403).json({ errors: [{ campo: null, motivo: "usuario sin acceso a Mando" }] });
  }

  req.usuario = rows[0];
  next();
}
