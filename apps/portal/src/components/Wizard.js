"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EVENTUALIDADES } from "@rigo/catalogo";
import StepIndicator from "./StepIndicator";
import StepPlaceholder from "./StepPlaceholder";
import StepCategoria from "./steps/StepCategoria";
import StepDetalles, { esDescripcionValida, hayFotoConError } from "./steps/StepDetalles";
import styles from "./Wizard.module.css";

// Leaflet (dentro de StepUbicacion) toca window/document al importarse
// — no soporta SSR. Mismo patrón que apps/mando/app/reportes/page.js.
const StepUbicacion = dynamic(() => import("./steps/StepUbicacion"), { ssr: false });

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
  const [idempotencyKey] = useState(generarIdempotencyKey);

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
          <StepPlaceholder
            icono="✅"
            titulo="Confirmar"
            descripcion="Vas a revisar un resumen completo de tu reporte — categoría, ubicación, descripción y fotos — antes de enviarlo."
            nota={`idempotency_key lista para el envío: ${idempotencyKey}`}
          />
        )}

        {esUltimoPaso && (
          <StepPlaceholder
            icono="🎫"
            titulo="Folio"
            descripcion="En cuanto el servidor reciba tu reporte, te va a asignar un folio con el que podrás consultar su estatus más adelante."
          />
        )}
      </div>

      <footer className={styles.pie}>
        <button type="button" className="btn btn-borde" onClick={retroceder} disabled={pasoActual === 0}>
          Atrás
        </button>
        <button
          type="button"
          className="btn btn-primario"
          onClick={continuar}
          disabled={!puedeContinuar || esUltimoPaso}
        >
          Continuar
        </button>
      </footer>
    </section>
  );
}
