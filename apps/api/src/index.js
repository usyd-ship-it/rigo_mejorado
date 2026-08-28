import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pool } from "./lib/db.js";
import reportesRouter from "./routes/reportes.js";
import mandoRouter from "./routes/mando.js";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(helmet());
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

// CORS por ruta, no global — un cors() global habría interceptado el
// preflight OPTIONS antes de que llegara al de /mando (el paquete cors
// responde y corta el ciclo para OPTIONS, nunca llama a next()).
// /reportes es público por diseño; /mando restringido a su origen real
// por variable de entorno (spec §3.8: dominio separado del portal).
const mandoCors = cors({
  origin: process.env.MANDO_ORIGIN || "http://localhost:3001",
  allowedHeaders: ["Content-Type", "Authorization"],
});

app.use("/reportes", cors(), reportesRouter);
app.use("/mando", mandoCors, mandoRouter);

app.listen(PORT, () => {
  console.log(`rigo-api escuchando en http://localhost:${PORT}`);
});
