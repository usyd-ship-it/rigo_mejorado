"use client";

import { useMemo, useState } from "react";
import { FAMILIAS, EVENTUALIDADES, EVENTUALIDADES_CRITICAS } from "@rigo/catalogo";
import styles from "./StepCategoria.module.css";

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function StepCategoria({ eventualidadCod, onSeleccionar }) {
  const [query, setQuery] = useState("");
  const [gruposAbiertosManual, setGruposAbiertosManual] = useState(() => new Set());

  const eventualidadSeleccionada = useMemo(
    () => EVENTUALIDADES.find((e) => e.codigo === eventualidadCod) ?? null,
    [eventualidadCod]
  );

  const esCritica = eventualidadCod ? EVENTUALIDADES_CRITICAS.includes(eventualidadCod) : false;

  const queryNormalizada = normalizar(query.trim());
  const buscando = queryNormalizada.length > 0;

  const eventosPorFamilia = useMemo(() => {
    const mapa = new Map(FAMILIAS.map((familia) => [familia, []]));
    for (const ev of EVENTUALIDADES) {
      if (!buscando || normalizar(ev.nombre).includes(queryNormalizada) || normalizar(ev.codigo).includes(queryNormalizada)) {
        mapa.get(ev.familia)?.push(ev);
      }
    }
    return mapa;
  }, [buscando, queryNormalizada]);

  const familiasVisibles = FAMILIAS.filter((familia) => eventosPorFamilia.get(familia)?.length > 0);

  function alternarGrupo(familia) {
    setGruposAbiertosManual((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(familia)) siguiente.delete(familia);
      else siguiente.add(familia);
      return siguiente;
    });
  }

  function estaAbierta(familia) {
    // Mientras se busca, cada familia con coincidencias se muestra abierta
    // sin depender del toggle manual — el ciudadano no debería tener que
    // expandir algo que el buscador ya encontró por él.
    if (buscando) return true;
    return gruposAbiertosManual.has(familia);
  }

  return (
    <div>
      <label htmlFor="buscador-eventualidad" className="sr-only">
        Buscar tipo de reporte
      </label>
      <div className={styles.buscador}>
        <input
          id="buscador-eventualidad"
          type="search"
          placeholder="Busca por palabra o código, ej. “lámpara” o “LAF”"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {eventualidadSeleccionada && (
        <div className={styles.seleccionActual} role="status">
          <span className={styles.marca} aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>
              {eventualidadSeleccionada.nombre}
              <span className={styles.codigo}>{eventualidadSeleccionada.codigo}</span>
            </strong>
            <p className={styles.familia}>{eventualidadSeleccionada.familia}</p>
          </div>
        </div>
      )}

      {esCritica && (
        <div className={styles.avisoRiesgo} role="alert">
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>Si hay peligro inmediato, llama primero a emergencias</strong>
            <p>
              Este reporte queda registrado para que el ayuntamiento lo atienda, pero no sustituye una llamada de
              emergencia si hay un riesgo para tu seguridad o la de alguien más en este momento.
            </p>
          </div>
        </div>
      )}

      <ul className={styles.grupos}>
        {familiasVisibles.map((familia) => {
          const eventos = eventosPorFamilia.get(familia);
          const abierta = estaAbierta(familia);

          return (
            <li key={familia} className={styles.grupo} data-abierta={abierta}>
              <button
                type="button"
                className={styles.grupoCab}
                aria-expanded={abierta}
                onClick={() => alternarGrupo(familia)}
              >
                <span>{familia}</span>
                <span className={styles.cuenta}>{eventos.length}</span>
                <span className={styles.caret} aria-hidden="true">
                  ▾
                </span>
              </button>

              {abierta && (
                <div className={styles.chips}>
                  {eventos.map((ev) => (
                    <button
                      key={ev.codigo}
                      type="button"
                      className={styles.chip}
                      aria-pressed={ev.codigo === eventualidadCod}
                      onClick={() => onSeleccionar(ev.codigo)}
                    >
                      {ev.nombre}
                      <span className={styles.chipCod}>{ev.codigo}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {familiasVisibles.length === 0 && (
        <p className={styles.sinResultados}>No encontramos coincidencias. Intenta con otra palabra o código.</p>
      )}
    </div>
  );
}
