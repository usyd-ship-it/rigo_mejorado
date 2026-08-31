import styles from "./Wizard.module.css";

export default function StepPlaceholder({ icono, titulo, descripcion, nota }) {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderIco} aria-hidden="true">
        {icono}
      </span>
      <h2>{titulo}</h2>
      <p>{descripcion}</p>
      <p className={styles.placeholderAviso}>Este paso se conecta en el siguiente milestone.</p>
      {nota && (
        <p className={styles.placeholderNota}>
          <code>{nota}</code>
        </p>
      )}
    </div>
  );
}
