"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiMando } from "../../src/lib/api-mando";
import ExpedienteDrawer from "../../src/components/ExpedienteDrawer";

// Leaflet toca window/document al importarse — no soporta SSR.
const MapaOperativo = dynamic(() => import("../../src/components/MapaOperativo"), { ssr: false });

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

function construirQuery(filtros, extra = {}) {
  const params = new URLSearchParams();
  if (filtros.estatus) params.set("estatus", filtros.estatus);
  if (filtros.zona) params.set("zona", filtros.zona);
  if (filtros.colonia) params.set("colonia", filtros.colonia);
  if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
  if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);
  Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)));
  return params.toString();
}

export default function ReportesPage() {
  const [filtros, setFiltros] = useState({ estatus: "", zona: "", colonia: "", fecha_desde: "", fecha_hasta: "" });

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [pagina, setPagina] = useState(1);

  const [puntosMapa, setPuntosMapa] = useState([]);
  const [errorMapa, setErrorMapa] = useState(null);

  const [drawerId, setDrawerId] = useState(null);
  const abrirDrawer = useCallback((id) => setDrawerId(id), []);

  // Actualiza tabla y mapa en el sitio cuando el drawer confirma un
  // cambio de estatus exitoso — sin refetch completo de la lista.
  const actualizarEstatusLocal = useCallback((id, nuevoEstatus) => {
    setDatos((prev) =>
      prev ? { ...prev, reportes: prev.reportes.map((r) => (r.id === id ? { ...r, estatus: nuevoEstatus } : r)) } : prev
    );
    setPuntosMapa((prev) => prev.map((p) => (p.id === id ? { ...p, estatus: nuevoEstatus } : p)));
  }, []);

  // Tabla — paginada, depende de filtros + página.
  useEffect(() => {
    apiMando(`/mando/reportes?${construirQuery(filtros, { pagina, por_pagina: POR_PAGINA })}`)
      .then(setDatos)
      .catch((err) => setError(err.message));
  }, [filtros, pagina]);

  // Mapa — SIN paginar, depende solo de filtros. No se sincroniza con
  // la página de la tabla a propósito: el mapa siempre trae todos los
  // puntos que cumplen el filtro, la tabla solo 50 a la vez.
  useEffect(() => {
    apiMando(`/mando/reportes/mapa?${construirQuery(filtros)}`)
      .then((d) => setPuntosMapa(d.reportes))
      .catch((err) => setErrorMapa(err.message));
  }, [filtros]);

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

      {errorMapa && <p style={{ color: "#B3392E" }}>Error del mapa: {errorMapa}</p>}
      <MapaOperativo puntos={puntosMapa} onAbrir={abrirDrawer} />
      <p style={{ fontSize: "0.7rem", color: "#6F5E63", margin: "0.4rem 0 1rem" }}>
        {puntosMapa.length} punto(s) en el mapa (sin paginar) — la tabla de abajo muestra {POR_PAGINA} a la vez.
      </p>

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
                    onClick={() => abrirDrawer(r.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") abrirDrawer(r.id);
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

      {drawerId && (
        <ExpedienteDrawer
          reporteId={drawerId}
          onClose={() => setDrawerId(null)}
          onEstatusCambiado={actualizarEstatusLocal}
        />
      )}
    </main>
  );
}
