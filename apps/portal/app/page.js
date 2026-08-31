import Wizard from "../src/components/Wizard";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <header className={styles.encabezado}>
        <div className={styles.marca}>
          <span className={styles.logo}>
            RIGO<span>+</span>
          </span>
          <span className={styles.leyenda}>Municipio de Heroica Matamoros</span>
        </div>
      </header>

      <main className={styles.main}>
        <p className="eyebrow">Reporte ciudadano</p>
        <h1>Cuéntanos qué está pasando</h1>
        <p className={styles.lead}>
          Levanta un reporte en unos minutos, sin necesidad de crear una cuenta. Vas a poder consultar su
          avance con el folio que te demos al final.
        </p>

        <Wizard />
      </main>
    </>
  );
}
