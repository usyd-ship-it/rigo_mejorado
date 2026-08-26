import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Pool } from "pg";

const PORT = process.env.PORT || 4000;

// Supabase pooler exige TLS; rejectUnauthorized:false es punto de partida
// para desarrollo — revisar antes de producción (spec punto 9, HTTPS total).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rigo-api" });
});

app.get("/health/db", async (_req, res) => {
  try {
    const { rows } = await pool.query("select now()");
    res.json({ ok: true, now: rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`rigo-api escuchando en http://localhost:${PORT}`);
});
