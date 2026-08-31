"use client";

import { useState } from "react";
import styles from "./StepFolio.module.css";

function formatearFecha(iso) {
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function StepFolio({ resultadoEnvio, onReiniciar }) {
  const [copiado, setCopiado] = useState(false);
  const [errorCopiar, setErrorCopiar] = useState(false);

  // Defensivo: no debería pasar (a este paso solo se llega tras un 201
  // de StepConfirmar), pero si de alguna forma se aterriza aquí sin
  // resultado, no rompemos la pantalla.
  if (!resultadoEnvio) {
    return (
      <div>
        <p className={styles.vacio}>
          No hay datos de un envío reciente que mostrar aquí. Si acabas de levantar un reporte, vuelve al paso
          de Confirmar para enviarlo.
        </p>
        <div className={styles.acciones}>
          <button type="button" className="btn btn-borde" onClick={onReiniciar}>
            Levantar un reporte
          </button>
        </div>
      </div>
    );
  }

  async function copiarFolio() {
    setErrorCopiar(false);
    try {
      await navigator.clipboard.writeText(resultadoEnvio.folio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErrorCopiar(true);
    }
  }

  return (
    <div>
      <div className={styles.ticket}>
        <div className={styles.ticketTop}>
          <span className={styles.t1}>Reporte ciudadano</span>
          <span className={styles.t2}>H. Matamoros · RIGO+</span>
        </div>

        <div className={styles.ticketMid}>
          <div className={styles.folioLbl}>Folio de seguimiento</div>
          <div className={styles.folioNum}>{resultadoEnvio.folio}</div>
          <span className={styles.chip}>{resultadoEnvio.estatus === "recibido" ? "Recibido" : resultadoEnvio.estatus}</span>
          <div className={styles.fecha}>{formatearFecha(resultadoEnvio.creado_en)}</div>
        </div>

        <div className={styles.ticketSep} />

        <div className={styles.ticketLow}>
          <button type="button" className="btn btn-primario" onClick={copiarFolio}>
            {copiado ? "✓ Folio copiado" : "Copiar folio"}
          </button>
        </div>
        {errorCopiar && (
          <p className={styles.mensaje} role="alert">
            No se pudo copiar automáticamente — selecciona el folio de arriba y cópialo a mano.
          </p>
        )}
      </div>

      <p className={styles.mensaje}>
        <strong>Tu reporte quedó registrado.</strong> Guarda este folio como comprobante — hoy todavía no existe
        una consulta de estatus en línea, así que por ahora esta pantalla y el folio son tu referencia si
        necesitas contactar al municipio directamente sobre este reporte. En cuanto exista esa función de
        consulta, este mismo folio te servirá para usarla.
      </p>

      <div className={styles.acciones}>
        <button type="button" className="btn btn-borde" onClick={onReiniciar}>
          Levantar otro reporte
        </button>
      </div>
    </div>
  );
}
