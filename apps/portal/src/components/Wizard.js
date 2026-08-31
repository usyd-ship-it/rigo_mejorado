"use client";

import { useMemo, useState } from "react";
import { EVENTUALIDADES } from "@rigo/catalogo";
import StepIndicator from "./StepIndicator";
import StepPlaceholder from "./StepPlaceholder";
import StepCategoria from "./steps/StepCategoria";
import styles from "./Wizard.module.css";

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
  const puedeContinuar = pasoActual === 0 ? Boolean(eventualidadCod) : true;

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

        {pasoActual === 1 && (
          <StepPlaceholder
            icono="📍"
            titulo="Ubicación"
            descripcion="Vas a fijar un pin en el mapa — con zoom-lock a nivel calle, círculo de precisión GPS, confirmación por geocodificación inversa y aviso si el punto queda fuera del municipio. El pin es obligatorio: la colonia se calcula sola a partir de tu coordenada, tú no la escribes."
          />
        )}

        {pasoActual === 2 && (
          <StepPlaceholder
            icono="📝"
            titulo="Detalles"
            descripcion="Aquí vas a describir lo que está pasando (10 a 2000 caracteres), agregar hasta 5 fotos como evidencia, y dejar tu nombre y teléfono si quieres que te avisemos del avance — ambos son opcionales."
          />
        )}

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
