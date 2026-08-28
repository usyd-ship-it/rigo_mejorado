"use client";

import { useEffect, useState } from "react";
import { apiMando } from "../lib/api-mando";

export default function ExpedienteDrawer({ reporteId, onClose }) {
  // reporte se reinicia en cada apertura — no hay caché entre drawers,
  // así las url_firmada (expiran 15 min) siempre vienen frescas del
  // fetch de esta sesión del drawer, nunca de una apertura anterior.
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setReporte(null);
    setError(null);
    apiMando(`/mando/reportes/${reporteId}`)
      .then(setReporte)
      .catch((err) => setError(err.message));
  }, [reporteId]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,26,30,.45)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 80,
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#F5F2EC",
          width: "min(480px, 100vw)",
          height: "100vh",
          overflowY: "auto",
          padding: "1.25rem",
          fontFamily: "sans-serif",
          color: "#241A1E",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {reporte && (
              <>
                <h2 style={{ color: "#7A1F2B", fontFamily: "monospace", margin: 0 }}>{reporte.folio}</h2>
                <p style={{ fontSize: "0.68rem", color: "#6F5E63", margin: "4px 0 0" }}>ID interno: {reporte.id}</p>
              </>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar expediente">
            ✕
          </button>
        </div>

        {error && <p style={{ color: "#B3392E" }}>Error: {error}</p>}
        {!reporte && !error && <p>Cargando…</p>}

        {reporte && (
          <>
            <Seccion titulo="Descripción">
              <p>{reporte.descripcion || "—"}</p>
            </Seccion>

            <Seccion titulo="Ubicación">
              <p style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                {reporte.ubicacion.lat != null ? reporte.ubicacion.lat.toFixed(5) : "—"},{" "}
                {reporte.ubicacion.lng != null ? reporte.ubicacion.lng.toFixed(5) : "—"}
              </p>
              <p>Colonia: {reporte.ubicacion.colonia_calculada ?? "—"}</p>
              <p>Zona: {reporte.ubicacion.zona_seccion ?? "—"}</p>
              <p style={{ fontSize: "0.7rem", color: "#6F5E63" }}>Mapa: pendiente, milestone aparte.</p>
            </Seccion>

            <Seccion titulo="Asignación">
              <p>Secretaría: {reporte.asignacion.secretaria ?? "—"}</p>
              <p>Dirección: {reporte.asignacion.direccion_area ?? "—"}</p>
              <p>Enlace gestor: {reporte.asignacion.enlace_gestor ?? "—"}</p>
              <p>Cuadrilla: {reporte.asignacion.cuadrilla ?? "—"}</p>
            </Seccion>

            <Seccion titulo="Evidencia">
              {reporte.evidencias.length === 0 && (
                <p style={{ fontSize: "0.8rem", color: "#6F5E63" }}>Sin fotos adjuntas.</p>
              )}
              {reporte.evidencias.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {reporte.evidencias.map((ev) => (
                      <img
                        key={ev.id}
                        src={ev.url_firmada}
                        alt="evidencia"
                        style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #E4DCD2" }}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: "0.65rem", color: "#6F5E63", marginTop: 6 }}>
                    URLs firmadas — expiran en 15 min, no se guardan más allá de este drawer.
                  </p>
                </>
              )}
            </Seccion>

            <Seccion titulo="Contacto del ciudadano">
              <p style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                {reporte.contacto
                  ? `${reporte.contacto.nombre ?? "—"} · ${reporte.contacto.telefono ?? "—"}`
                  : "Sin contacto registrado"}
              </p>
            </Seccion>

            <Seccion titulo="Bitácora de auditoría">
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {reporte.bitacora.length === 0 && (
                  <li style={{ fontSize: "0.8rem", color: "#6F5E63" }}>Sin entradas todavía.</li>
                )}
                {reporte.bitacora.map((b) => (
                  <li key={b.id} style={{ borderTop: "1px dashed #E4DCD2", padding: "0.4rem 0", fontSize: "0.8rem" }}>
                    <time style={{ display: "block", fontFamily: "monospace", fontSize: "0.65rem", color: "#6F5E63" }}>
                      {new Date(b.creado_en).toLocaleString("es-MX")}
                    </time>
                    <span>
                      {b.evento}
                      {b.estatus_anterior && b.estatus_nuevo ? `: ${b.estatus_anterior} → ${b.estatus_nuevo}` : ""}
                      {b.usuario_nombre ? ` — ${b.usuario_nombre}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Seccion>
          </>
        )}
      </aside>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4DCD2",
        borderRadius: 12,
        padding: "0.9rem 1rem",
        marginTop: "0.8rem",
      }}
    >
      <h3 style={{ fontSize: "0.8rem", margin: "0 0 0.5rem" }}>{titulo}</h3>
      {children}
    </div>
  );
}
