import styles from "./Wizard.module.css";

export default function StepIndicator({ pasos, pasoActual, pasoMaximoVisitado, onIrA }) {
  return (
    <nav className={styles.indicador} aria-label="Progreso del reporte">
      <ol>
        {pasos.map((paso, indice) => {
          const estado = indice === pasoActual ? "activo" : indice < pasoActual ? "hecho" : "pendiente";
          const habilitado = indice <= pasoMaximoVisitado;

          return (
            <li key={paso.id}>
              <button
                type="button"
                className={styles.paso}
                data-estado={estado}
                disabled={!habilitado}
                aria-current={indice === pasoActual ? "step" : undefined}
                onClick={() => onIrA(indice)}
              >
                <span className={styles.numero}>{indice + 1}</span>
                <span>{paso.etiqueta}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
