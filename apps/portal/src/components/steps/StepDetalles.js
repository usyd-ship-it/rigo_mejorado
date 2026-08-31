"use client";

import { useRef, useState } from "react";
import styles from "./StepDetalles.module.css";

export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 2000;
const MAX_FOTOS = 5;

// Mismos límites que valida POST /reportes en apps/api/src/routes/
// reportes.js (TIPOS_PERMITIDOS, multer fileSize) — si cambian allá,
// hay que cambiarlos aquí también. Es una validación de UX (avisar
// temprano); el servidor la vuelve a hacer con file-type sobre el
// archivo recibido.
const TAMANO_MAX_BYTES = 8 * 1024 * 1024;

// Detección de tipo real por firma de bytes — el mismo motivo que ya
// tiene el servidor para no confiar en la extensión ni en el
// Content-Type que declara el navegador.
const FIRMAS = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

async function detectarTipoReal(file) {
  const cabecera = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  for (const firma of FIRMAS) {
    if (firma.bytes.every((b, i) => cabecera[i] === b)) return firma.mime;
  }
  // WEBP: contenedor RIFF con la etiqueta "WEBP" a partir del byte 8
  if (
    cabecera[0] === 0x52 &&
    cabecera[1] === 0x49 &&
    cabecera[2] === 0x46 &&
    cabecera[3] === 0x46 &&
    cabecera[8] === 0x57 &&
    cabecera[9] === 0x45 &&
    cabecera[10] === 0x42 &&
    cabecera[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function idUnico() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function esDescripcionValida(descripcion) {
  const longitud = (descripcion ?? "").trim().length;
  return longitud >= DESCRIPCION_MIN && longitud <= DESCRIPCION_MAX;
}

export function hayFotoConError(fotos) {
  return (fotos ?? []).some((foto) => foto.error);
}

export default function StepDetalles({ detalles, onCambiar }) {
  const inputRef = useRef(null);
  const [avisoLote, setAvisoLote] = useState("");

  const descripcion = detalles.descripcion ?? "";
  const fotos = detalles.fotos ?? [];
  const longitudRecortada = descripcion.trim().length;
  const descripcionValida = esDescripcionValida(descripcion);

  async function manejarSeleccion(evento) {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = ""; // permite re-elegir el mismo archivo si lo quitan y lo agregan de nuevo

    if (!archivos.length) return;

    const cupo = MAX_FOTOS - fotos.length;
    const admitidos = archivos.slice(0, Math.max(cupo, 0));
    const excedentes = archivos.length - admitidos.length;

    if (admitidos.length === 0) {
      setAvisoLote(`Ya tienes ${MAX_FOTOS} fotos — quita alguna antes de agregar más.`);
      return;
    }

    const nuevos = await Promise.all(
      admitidos.map(async (file) => {
        let error = null;
        const tipoReal = await detectarTipoReal(file);
        if (!tipoReal) {
          error = "Tipo de archivo no permitido (solo JPG, PNG o WEBP).";
        } else if (file.size > TAMANO_MAX_BYTES) {
          error = `Pesa ${(file.size / 1024 / 1024).toFixed(1)} MB — el máximo es 8 MB.`;
        }
        return {
          id: idUnico(),
          file,
          previewUrl: error ? null : URL.createObjectURL(file),
          error,
        };
      })
    );

    onCambiar({ fotos: [...fotos, ...nuevos] });
    setAvisoLote(
      excedentes > 0
        ? `Solo se permiten ${MAX_FOTOS} fotos; se ${
            excedentes === 1 ? "ignoró 1 archivo adicional" : `ignoraron ${excedentes} archivos adicionales`
          }.`
        : ""
    );
  }

  function quitarFoto(id) {
    const objetivo = fotos.find((f) => f.id === id);
    if (objetivo?.previewUrl) URL.revokeObjectURL(objetivo.previewUrl);
    onCambiar({ fotos: fotos.filter((f) => f.id !== id) });
    setAvisoLote("");
  }

  return (
    <div>
      <div className={styles.campo}>
        <label htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          value={descripcion}
          maxLength={DESCRIPCION_MAX}
          placeholder="Ej. La luminaria de la esquina lleva dos semanas apagada; en la noche la calle queda totalmente oscura."
          onChange={(e) => onCambiar({ descripcion: e.target.value })}
        />
        <div className={styles.contador} data-valido={descripcionValida}>
          {descripcion.length}/{DESCRIPCION_MAX} caracteres
          {longitudRecortada < DESCRIPCION_MIN && ` — escribe al menos ${DESCRIPCION_MIN}`}
        </div>
      </div>

      <div className={styles.campo}>
        <label htmlFor="fotos">
          Fotos <span className={styles.opcional}>(opcional, hasta {MAX_FOTOS})</span>
        </label>
        <button
          type="button"
          className={styles.dropzone}
          onClick={() => inputRef.current?.click()}
          disabled={fotos.length >= MAX_FOTOS}
        >
          <span aria-hidden="true">📷</span>
          Toca para agregar fotos
          <span>JPG, PNG o WEBP · máx. 8 MB cada una</span>
        </button>
        <input
          ref={inputRef}
          id="fotos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={manejarSeleccion}
        />
        {avisoLote && <p className={styles.avisoLote}>{avisoLote}</p>}

        {fotos.length > 0 && (
          <ul className={styles.grid}>
            {fotos.map((foto) => (
              <li key={foto.id} className={styles.miniatura} data-error={Boolean(foto.error)}>
                {foto.error ? (
                  <div className={styles.miniaturaError}>
                    <span aria-hidden="true">⚠️</span>
                    <p>{foto.error}</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.previewUrl} alt="" />
                )}
                <button
                  type="button"
                  className={styles.quitar}
                  onClick={() => quitarFoto(foto.id)}
                  aria-label={`Quitar ${foto.file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.filaDos}>
        <div className={styles.campo}>
          <label htmlFor="nombre">
            Nombre <span className={styles.opcional}>(opcional)</span>
          </label>
          <input
            id="nombre"
            type="text"
            value={detalles.nombre ?? ""}
            placeholder="Nombre y apellido"
            onChange={(e) => onCambiar({ nombre: e.target.value })}
          />
        </div>
        <div className={styles.campo}>
          <label htmlFor="telefono">
            Teléfono <span className={styles.opcional}>(opcional)</span>
          </label>
          <input
            id="telefono"
            type="tel"
            inputMode="numeric"
            value={detalles.telefono ?? ""}
            placeholder="868 000 0000"
            onChange={(e) => onCambiar({ telefono: e.target.value })}
          />
        </div>
      </div>
      <p className={styles.notaContacto}>
        Opcional — solo si quieres que te contactemos para más información sobre tu reporte. Puedes seguir su
        avance sin darlos, consultando tu folio.
      </p>
    </div>
  );
}
