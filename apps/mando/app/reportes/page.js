"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiMando } from "../../src/lib/api-mando";
import ExpedienteDrawer from "../../src/components/ExpedienteDrawer";

// Mismos 8 valores que ESTATUS_VALIDOS en apps/api — el <select> solo
// ofrece filtros que el backend realmente acepta.
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

const POR_PAGINA = 50;

export default function ReportesPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ estatus: "", zona: "", colonia: "", fecha_desde: "", fecha_hasta: "" });
  const [drawerId, setDrawerId] = useState(null);

  const cargar = useCallback(() => {
    const params = new URLSearchParams();
    params.set("pagina", String(pagina));
    params.set("por_pagina", String(POR_PAGINA));
    if (filtros.estatus) params.set("estatus", filtros.estatus);
    if (filtros.zona) params.set("zona", filtros.zona);
    if (filtros.colonia) params.set("colonia", filtros.colonia);
    if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
    if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);

    apiMando(`/mando/reportes?${params.toString()}`)
      .then(setDatos)
      .catch((err) => setError(err.message));
  }, [pagina, filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function actualizarFiltro(campo, valor) {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", color: "#241A1E" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
        <h1 style={{ color: "#7A1F2B" }}>RIGO+ Mando — Reportes</h1>
        <Link href="/">← Resumen</Link>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <select value={filtros.estatus} onChange={(e) => actualizarFiltro("estatus", e.target.value)}>
          <option value="">Todos los estatus</option>
          {ESTATUS_VALIDOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input placeholder="Zona" value={filtros.zona} onChange={(e) => actualizarFiltro("zona", e.target.value)} />
        <input
          placeholder="Colonia"
          value={filtros.colonia}
          onChange={(e) => actualizarFiltro("colonia", e.target.value)}
        />
        <input
          type="date"
          aria-label="Fecha desde"
          value={filtros.fecha_desde}
          onChange={(e) => actualizarFiltro("fecha_desde", e.target.value)}
        />
        <input
          type="date"
          aria-label="Fecha hasta"
          value={filtros.fecha_hasta}
          onChange={(e) => actualizarFiltro("fecha_hasta", e.target.value)}
        />
      </div>

      {error && <p style={{ color: "#B3392E" }}>Error: {error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          <div style={{ overflowX: "auto", border: "1px solid #E4DCD2", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#241A1E", color: "#EFE7DA" }}>
                  <th style={{ padding: "8px 12px" }}>Folio</th>
                  <th style={{ padding: "8px 12px" }}>Eventualidad</th>
                  <th style={{ padding: "8px 12px" }}>Estatus</th>
                  <th style={{ padding: "8px 12px" }}>Colonia</th>
                  <th style={{ padding: "8px 12px" }}>Zona</th>
                  <th style={{ padding: "8px 12px" }}>Creado</th>
                </tr>
              </thead>
              <tbody>
                {datos.reportes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#6F5E63" }}>
                      Ningún reporte coincide con los filtros.
                    </td>
                  </tr>
                )}
                {datos.reportes.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDrawerId(r.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setDrawerId(r.id);
                    }}
                    style={{ cursor: "pointer", borderTop: "1px solid #E4DCD2" }}
                  >
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#7A1F2B" }}>{r.folio}</td>
                    <td style={{ padding: "8px 12px" }}>{r.eventualidad.nombre}</td>
                    <td style={{ padding: "8px 12px" }}>{r.estatus}</td>
                    <td style={{ padding: "8px 12px" }}>{r.colonia_calculada ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{r.zona_seccion ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{new Date(r.creado_en).toLocaleString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginTop: "1rem" }}>
            <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              ← anterior
            </button>
            <span style={{ fontSize: "0.85rem" }}>
              página {datos.pagina} · {datos.total} reportes
            </span>
            <button disabled={pagina * datos.por_pagina >= datos.total} onClick={() => setPagina((p) => p + 1)}>
              siguiente →
            </button>
          </div>
        </>
      )}

      {drawerId && <ExpedienteDrawer reporteId={drawerId} onClose={() => setDrawerId(null)} />}
    </main>
  );
}
