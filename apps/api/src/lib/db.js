import { Pool } from "pg";

// Supabase pooler exige TLS; rejectUnauthorized:false es punto de partida
// para desarrollo — revisar antes de producción (spec punto 9, HTTPS total).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
