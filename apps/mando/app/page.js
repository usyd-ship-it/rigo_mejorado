"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiMando } from "../src/lib/api-mando";
import { createClient } from "../src/lib/supabase/client";

// Mapeo explícito 1:1 a los valores exactos que devuelve el backend
// (ESTATUS_VALIDOS en apps/api) — nunca una categorización distinta.
const ETIQUETAS = {
  recibido: "Recibido",
  clasificado: "Clasificado",
  en_atencion: "En atención",
  en_espera: "En espera",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  reabierto: "Reabierto",
  improcedente: "Improcedente",
};

export default function Home() {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiMando("/mando/resumen")
      .then(setResumen)
      .catch((err) => setError(err.message));
  }, []);

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", color: "#241A1E" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ color: "#7A1F2B" }}>RIGO+ Mando — Resumen</h1>
        <Link href="/reportes">Ver reportes</Link>
        <button onClick={cerrarSesion} style={{ marginLeft: "auto" }}>
          Cerrar sesión
        </button>
      </div>

      {error && <p style={{ color: "#B3392E" }}>Error: {error}</p>}
      {!resumen && !error && <p>Cargando…</p>}

      {resumen && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
            <Tarjeta etiqueta="Total" valor={resumen.total} />
            {resumen.por_estatus.map((fila) => (
              <Tarjeta key={fila.estatus} etiqueta={ETIQUETAS[fila.estatus] ?? fila.estatus} valor={fila.cantidad} />
            ))}
          </div>

          <div
            style={{
              background: "#E3F0E8",
              border: "1px solid #C7DCCB",
              borderRadius: 12,
              padding: "1rem 1.5rem",
              display: "inline-block",
            }}
          >
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#2E7D4F", lineHeight: 1 }}>
              {resumen.porcentaje_resuelto}%
            </div>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6F5E63" }}>
              resuelto
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function Tarjeta({ etiqueta, valor }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4DCD2",
        borderRadius: 12,
        padding: "0.9rem 1.1rem",
        minWidth: 130,
        boxShadow: "0 1px 2px rgba(36,26,30,.06), 0 8px 22px rgba(36,26,30,.08)",
      }}
    >
      <div style={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6F5E63", marginTop: 4 }}>
        {etiqueta}
      </div>
    </div>
  );
}
