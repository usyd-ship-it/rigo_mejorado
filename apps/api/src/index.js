import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pool } from "./lib/db.js";
import reportesRouter from "./routes/reportes.js";

const PORT = process.env.PORT || 4000;

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

app.use("/reportes", reportesRouter);

app.listen(PORT, () => {
  console.log(`rigo-api escuchando en http://localhost:${PORT}`);
});
