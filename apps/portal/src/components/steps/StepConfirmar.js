"use client";

import { useRef, useState } from "react";
import TurnstileWidget from "../TurnstileWidget";
import styles from "./StepConfirmar.module.css";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Etiquetas legibles para los "campo" que devuelve POST /reportes en
// sus errores — si el backend agrega un campo nuevo, cae al nombre
// crudo en vez de romperse.
const CAMPO_ETIQUETAS = {
  eventualidad_cod: "Categoría",
  descripcion: "Descripción",
  "lat/lng": "Ubicación",
  lat: "Ubicación",
  lng: "Ubicación",
  ubicacion_confirmada: "Ubicación",
  direccion_texto: "Dirección",
  fotos: "Fotos",
  turnstile_token: "Verificación de seguridad",
};

export default function StepConfirmar({ eventualidadSeleccionada, ubicacion, detalles, idempotencyKey, onExito }) {
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroresEnvio, setErroresEnvio] = useState([]);

  const fotosValidas = (detalles.fotos ?? []).filter((f) => !f.error);

  function alRecibirToken(token) {
    setTurnstileToken(token);
    setTurnstileError(false);
  }

  function alExpirarToken() {
    setTurnstileToken(null);
  }

  function alFallarTurnstile() {
    setTurnstileToken(null);
    setTurnstileError(true);
  }

  async function enviarReporte() {
    if (!turnstileToken || enviando) return;

    setEnviando(true);
    setErroresEnvio([]);

    const formData = new FormData();
    formData.append("eventualidad_cod", eventualidadSeleccionada?.codigo ?? "");
    formData.append("descripcion", detalles.descripcion ?? "");
    formData.append("lat", String(ubicacion.lat));
    formData.append("lng", String(ubicacion.lng));
    formData.append("ubicacion_confirmada", ubicacion.ubicacion_confirmada ? "true" : "false");
    if (ubicacion.direccion_texto) formData.append("direccion_texto", ubicacion.direccion_texto);
    if (detalles.nombre?.trim()) formData.append("nombre", detalles.nombre.trim());
    if (detalles.telefono?.trim()) formData.append("telefono", detalles.telefono.trim());
    formData.append("turnstile_token", turnstileToken);
    formData.append("idempotency_key", idempotencyKey);
    fotosValidas.forEach((foto) => formData.append("fotos", foto.file));

    try {
      const resp = await fetch(`${API_BASE_URL}/reportes`, { method: "POST", body: formData });
      let datos = null;
      try {
        datos = await resp.json();
      } catch {
        // respuesta sin cuerpo JSON — se maneja abajo con el fallback genérico
      }

      if (resp.ok) {
        onExito(datos);
        return;
      }

      setErroresEnvio(datos?.errors ?? [{ campo: null, motivo: `Ocurrió un error inesperado (código ${resp.status}).` }]);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } catch {
      setErroresEnvio([
        { campo: null, motivo: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo." },
      ]);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <dl className={styles.resumen}>
        <dt>Categoría</dt>
        <dd>
          {eventualidadSeleccionada?.nombre} <span className={styles.coordsMono}>{eventualidadSeleccionada?.codigo}</span>
        </dd>

        <dt>Ubicación</dt>
        <dd>
          {ubicacion.direccion_texto || "Sin dirección detectada — se usan las coordenadas exactas"}
          <span className={styles.coordsMono}>
            {ubicacion.lat?.toFixed(5)}, {ubicacion.lng?.toFixed(5)}
          </span>
        </dd>

        <dt>Descripción</dt>
        <dd className={styles.descripcionTexto}>{detalles.descripcion}</dd>

        <dt>Fotos</dt>
        <dd>{fotosValidas.length > 0 ? `${fotosValidas.length} foto(s) adjunta(s)` : "Sin fotos"}</dd>

        <dt>Contacto</dt>
        <dd>
          {detalles.nombre?.trim() || detalles.telefono?.trim()
            ? [detalles.nombre?.trim(), detalles.telefono?.trim()].filter(Boolean).join(" · ")
            : "No proporcionado"}
        </dd>
      </dl>

      {erroresEnvio.length > 0 && (
        <ul className={styles.errores} role="alert">
          {erroresEnvio.map((error, indice) => (
            <li key={`${error.campo ?? "general"}-${indice}`}>
              {error.campo && <b>{CAMPO_ETIQUETAS[error.campo] ?? error.campo}: </b>}
              {error.motivo}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.seccionTurnstile}>
        <h2>Verificación de seguridad</h2>
        <TurnstileWidget
          ref={turnstileRef}
          sitekey={TURNSTILE_SITE_KEY}
          onToken={alRecibirToken}
          onExpirar={alExpirarToken}
          onError={alFallarTurnstile}
        />
        {turnstileError && (
          <p className={styles.avisoTurnstile}>
            No se pudo cargar la verificación de seguridad. Revisa tu conexión y recarga la página.
          </p>
        )}
      </div>

      <button type="button" className={`btn btn-primario ${styles.enviar}`} onClick={enviarReporte} disabled={!turnstileToken || enviando}>
        {enviando ? "Enviando…" : "Enviar reporte"}
      </button>
    </div>
  );
}
