"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EVENTUALIDADES } from "@rigo/catalogo";
import StepIndicator from "./StepIndicator";
import StepCategoria from "./steps/StepCategoria";
import StepDetalles, { esDescripcionValida, hayFotoConError } from "./steps/StepDetalles";
import StepFolio from "./steps/StepFolio";
import styles from "./Wizard.module.css";

// Leaflet (dentro de StepUbicacion) toca window/document al importarse
// — no soporta SSR. Mismo patrón que apps/mando/app/reportes/page.js.
const StepUbicacion = dynamic(() => import("./steps/StepUbicacion"), { ssr: false });

// El widget de Turnstile (dentro de StepConfirmar) también toca
// window/document al cargar su script — mismo motivo.
const StepConfirmar = dynamic(() => import("./steps/StepConfirmar"), { ssr: false });

const PASOS = [
  { id: "categoria", etiqueta: "Categoría" },
  { id: "ubicacion", etiqueta: "Ubicación" },
  { id: "detalles", etiqueta: "Detalles" },
  { id: "confirmar", etiqueta: "Confirmar" },
  { id: "folio", etiqueta: "Folio" },
];

function generarIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Wizard() {
  const [pasoActual, setPasoActual] = useState(0);
  const [pasoMaximoVisitado, setPasoMaximoVisitado] = useState(0);
  const [eventualidadCod, setEventualidadCod] = useState(null);

  // Nombres de campo exactos del contrato de POST /reportes (apps/api)
  // para que el paso de Confirmar no tenga que traducir nada.
  const [ubicacion, setUbicacion] = useState({
    lat: null,
    lng: null,
    precision_m: null,
    ubicacion_confirmada: false,
    direccion_texto: null,
  });

  function actualizarUbicacion(parcial) {
    setUbicacion((prev) => ({ ...prev, ...parcial }));
  }

  // Mismos nombres de campo que espera POST /reportes.
  const [detalles, setDetalles] = useState({
    descripcion: "",
    fotos: [],
    nombre: "",
    telefono: "",
  });

  function actualizarDetalles(parcial) {
    setDetalles((prev) => ({ ...prev, ...parcial }));
  }

  // Una sola llave por sesión del wizard — viaja como idempotency_key en
  // POST /reportes (apps/api) para que un doble clic en "Enviar" no cree
  // dos reportes. Se genera aquí, no en el paso de confirmación, porque
  // debe sobrevivir a que el ciudadano navegue de un lado a otro.
  const [idempotencyKey, setIdempotencyKey] = useState(generarIdempotencyKey);

  // Respuesta { folio, estatus, creado_en } de POST /reportes, mostrada
  // tal cual en StepFolio.
  const [resultadoEnvio, setResultadoEnvio] = useState(null);

  function manejarExitoEnvio(respuesta) {
    setResultadoEnvio(respuesta);
    const siguiente = PASOS.length - 1;
    setPasoActual(siguiente);
    setPasoMaximoVisitado((max) => Math.max(max, siguiente));
  }

  // "Levantar otro reporte": vuelve al paso 1 y borra TODO — incluida
  // la llave de idempotencia, que debe ser nueva para la siguiente
  // sesión de envío, nunca la misma que ya se usó (o se intentó usar).
  function reiniciarWizard() {
    detalles.fotos.forEach((foto) => {
      if (foto.previewUrl) URL.revokeObjectURL(foto.previewUrl);
    });

    setPasoActual(0);
    setPasoMaximoVisitado(0);
    setEventualidadCod(null);
    setUbicacion({
      lat: null,
      lng: null,
      precision_m: null,
      ubicacion_confirmada: false,
      direccion_texto: null,
    });
    setDetalles({
      descripcion: "",
      fotos: [],
      nombre: "",
      telefono: "",
    });
    setResultadoEnvio(null);
    setIdempotencyKey(generarIdempotencyKey());
  }

  const eventualidadSeleccionada = useMemo(
    () => EVENTUALIDADES.find((e) => e.codigo === eventualidadCod) ?? null,
    [eventualidadCod]
  );

  const esUltimoPaso = pasoActual === PASOS.length - 1;
  const puedeContinuar =
    pasoActual === 0
      ? Boolean(eventualidadCod)
      : pasoActual === 1
        ? ubicacion.ubicacion_confirmada === true
        : pasoActual === 2
          ? esDescripcionValida(detalles.descripcion) && !hayFotoConError(detalles.fotos)
          : true;

  function irA(indice) {
    if (indice < 0 || indice >= PASOS.length || indice > pasoMaximoVisitado) return;
    setPasoActual(indice);
  }

  function continuar() {
    if (!puedeContinuar || esUltimoPaso) return;
    const siguiente = pasoActual + 1;
    setPasoActual(siguiente);
    setPasoMaximoVisitado((max) => Math.max(max, siguiente));
  }

  function retroceder() {
    setPasoActual((p) => Math.max(p - 1, 0));
  }

  return (
    <section className={styles.wizard} aria-label="Asistente para levantar un reporte">
      <StepIndicator pasos={PASOS} pasoActual={pasoActual} pasoMaximoVisitado={pasoMaximoVisitado} onIrA={irA} />

      <div className={styles.cuerpo}>
        {pasoActual === 0 && (
          <StepCategoria eventualidadCod={eventualidadCod} onSeleccionar={setEventualidadCod} />
        )}

        {pasoActual === 1 && <StepUbicacion ubicacion={ubicacion} onCambiar={actualizarUbicacion} />}

        {pasoActual === 2 && <StepDetalles detalles={detalles} onCambiar={actualizarDetalles} />}

        {pasoActual === 3 && (
          <StepConfirmar
            eventualidadSeleccionada={eventualidadSeleccionada}
            ubicacion={ubicacion}
            detalles={detalles}
            idempotencyKey={idempotencyKey}
            onExito={manejarExitoEnvio}
          />
        )}

        {esUltimoPaso && <StepFolio resultadoEnvio={resultadoEnvio} onReiniciar={reiniciarWizard} />}
      </div>

      <footer className={styles.pie}>
        <button type="button" className="btn btn-borde" onClick={retroceder} disabled={pasoActual === 0}>
          Atrás
        </button>
        {pasoActual < 3 && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={continuar}
            disabled={!puedeContinuar || esUltimoPaso}
          >
            Continuar
          </button>
        )}
      </footer>
    </section>
  );
}
