"use client";

import { useEffect, useRef, useState } from "react";
import MapaPin from "../MapaPin";
import styles from "./StepUbicacion.module.css";

const CENTRO_MTM = [25.868, -97.503];
const ZOOM_INICIAL = 13;
const ZOOM_PUNTO = 16;
const PRECISION_BAJA_M = 40;

// Mismo bounding box que valida POST /reportes en apps/api/src/routes/
// reportes.js — si cambia allá, hay que cambiarlo aquí también. Es una
// validación de UX (avisar temprano); el servidor la vuelve a hacer.
const MATAMOROS_BBOX = { latMin: 25.55, latMax: 26.05, lngMin: -97.75, lngMax: -97.25 };

function dentroDeMatamoros(lat, lng) {
  return (
    lat >= MATAMOROS_BBOX.latMin &&
    lat <= MATAMOROS_BBOX.latMax &&
    lng >= MATAMOROS_BBOX.lngMin &&
    lng <= MATAMOROS_BBOX.lngMax
  );
}

export default function StepUbicacion({ ubicacion, onCambiar }) {
  const mapaRef = useRef(null);
  const geoReqIdRef = useRef(0);

  const [queryDireccion, setQueryDireccion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [busquedaAviso, setBusquedaAviso] = useState(null);
  const [geolocalizando, setGeolocalizando] = useState(false);
  const [geoAviso, setGeoAviso] = useState(null);
  const [avisoZoom, setAvisoZoom] = useState("");
  const [estadoDireccion, setEstadoDireccion] = useState("");

  const tienePunto = ubicacion.lat != null && ubicacion.lng != null;
  const dentro = tienePunto && dentroDeMatamoros(ubicacion.lat, ubicacion.lng);

  // Geocodificación inversa — solo para MOSTRAR una dirección aproximada
  // bajo el pin. El servidor calcula la colonia sola por coordenada; esto
  // nunca se manda como colonia, nada más se guarda como direccion_texto
  // (mismo nombre que ya acepta POST /reportes) para el paso de Detalles.
  async function verificarDireccion(lat, lng) {
    const idPeticion = ++geoReqIdRef.current;
    setEstadoDireccion("Verificando la dirección del punto…");
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`
      );
      const datos = await resp.json();
      if (idPeticion !== geoReqIdRef.current) return;

      const direccion = datos?.address || {};
      const calle = [direccion.road, direccion.house_number].filter(Boolean).join(" ");
      const zona = direccion.neighbourhood || direccion.suburb || direccion.residential || direccion.quarter || "";
      const texto = [calle, zona].filter(Boolean).join(", ");

      if (!texto) {
        setEstadoDireccion("Sin dirección registrada en este punto; se enviarán las coordenadas exactas.");
        return;
      }
      setEstadoDireccion(`Dirección detectada bajo el pin: ${texto}. Confírmala o mueve el pin.`);
      onCambiar({ direccion_texto: texto });
    } catch {
      if (idPeticion !== geoReqIdRef.current) return;
      setEstadoDireccion("Sin conexión para verificar la dirección; se enviarán las coordenadas exactas.");
    }
  }

  function fijarPunto(lat, lng, precisionM) {
    setAvisoZoom("");
    onCambiar({
      lat,
      lng,
      precision_m: precisionM ?? null,
      ubicacion_confirmada: dentroDeMatamoros(lat, lng),
    });
    verificarDireccion(lat, lng);
  }

  // Si el ciudadano ya había fijado un punto y vuelve a este paso, lo
  // restauramos en el mapa (MapaPin encola el movimiento si Leaflet
  // todavía no termina de cargar) y refrescamos la dirección detectada.
  useEffect(() => {
    if (tienePunto) {
      mapaRef.current?.moverA(ubicacion.lat, ubicacion.lng, {
        zoom: ZOOM_PUNTO,
        precisionM: ubicacion.precision_m,
      });
      verificarDireccion(ubicacion.lat, ubicacion.lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alMoverPin(lat, lng) {
    fijarPunto(lat, lng);
  }

  function alZoomInsuficiente() {
    setAvisoZoom("Acércate un poco más y vuelve a tocar el punto exacto — el pin solo se fija con zoom de calle.");
  }

  function usarMiUbicacion() {
    if (!("geolocation" in navigator)) {
      setGeoAviso({ texto: "Tu navegador no permite geolocalización; coloca el pin directamente en el mapa.", tipo: "aviso" });
      return;
    }
    setGeolocalizando(true);
    setGeoAviso({ texto: "Buscando tu ubicación…", tipo: "info" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const acc = accuracy || 0;
        mapaRef.current?.moverA(latitude, longitude, { zoom: acc > 60 ? 15 : 17, precisionM: acc });
        fijarPunto(latitude, longitude, acc);
        setGeolocalizando(false);
        if (acc > PRECISION_BAJA_M) {
          setGeoAviso({ texto: `Tu GPS tiene un margen de ±${Math.round(acc)} m: arrastra el pin al punto exacto.`, tipo: "aviso" });
        } else {
          setGeoAviso({ texto: "Ubicación detectada con buena precisión. Ajusta el pin si hace falta.", tipo: "exito" });
        }
      },
      () => {
        setGeolocalizando(false);
        setGeoAviso({ texto: "No se pudo obtener tu ubicación (permiso denegado o sin señal). Coloca el pin en el mapa.", tipo: "aviso" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function buscarDireccion(evento) {
    evento.preventDefault();
    const texto = queryDireccion.trim();
    if (!texto) {
      setBusquedaAviso({ texto: "Escribe primero la calle o el cruce.", tipo: "aviso" });
      return;
    }
    setBuscando(true);
    setBusquedaAviso({ texto: "Buscando en el mapa…", tipo: "info" });
    const consulta = encodeURIComponent(`${texto}, Matamoros, Tamaulipas, México`);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=-97.62,25.95,-97.40,25.74&q=${consulta}`
      );
      const resultados = await resp.json();
      if (resultados && resultados.length) {
        const lat = parseFloat(resultados[0].lat);
        const lng = parseFloat(resultados[0].lon);
        mapaRef.current?.moverA(lat, lng, { zoom: 17 });
        fijarPunto(lat, lng);
        setBusquedaAviso({ texto: "Dirección ubicada. Ajusta el pin al punto exacto si hace falta.", tipo: "exito" });
      } else {
        setBusquedaAviso({ texto: "No se encontró esa dirección; afina el texto o coloca el pin a mano.", tipo: "aviso" });
      }
    } catch {
      setBusquedaAviso({ texto: "Sin conexión con el buscador de direcciones; coloca el pin a mano.", tipo: "aviso" });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <div className={styles.acciones}>
        <button type="button" className="btn btn-borde" onClick={usarMiUbicacion} disabled={geolocalizando}>
          📍 {geolocalizando ? "Buscando…" : "Usar mi ubicación"}
        </button>
      </div>
      {geoAviso && (
        <p className={styles.mensaje} data-tipo={geoAviso.tipo}>
          {geoAviso.texto}
        </p>
      )}

      <form className={styles.buscador} onSubmit={buscarDireccion}>
        <label htmlFor="buscador-direccion" className="sr-only">
          Buscar una dirección aproximada
        </label>
        <input
          id="buscador-direccion"
          type="text"
          placeholder="Calle y cruce o referencia, ej. “Sexta y Morelos”"
          value={queryDireccion}
          onChange={(e) => setQueryDireccion(e.target.value)}
        />
        <button type="submit" className="btn btn-borde" disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {busquedaAviso && (
        <p className={styles.mensaje} data-tipo={busquedaAviso.tipo}>
          {busquedaAviso.texto}
        </p>
      )}

      <MapaPin
        ref={mapaRef}
        centroInicial={tienePunto ? [ubicacion.lat, ubicacion.lng] : CENTRO_MTM}
        zoomInicial={tienePunto ? ZOOM_PUNTO : ZOOM_INICIAL}
        onMover={alMoverPin}
        onZoomInsuficiente={alZoomInsuficiente}
      />
      <p className={styles.ayudaMapa}>
        Toca el mapa para acercarte y vuelve a tocar sobre el punto exacto para fijar el pin — o arrástralo
        directamente.
      </p>
      {avisoZoom && (
        <p className={styles.mensaje} data-tipo="aviso">
          {avisoZoom}
        </p>
      )}

      {tienePunto ? (
        <div className={styles.coords} data-estado={dentro ? "ok" : "fuera"}>
          <span aria-hidden="true">{dentro ? "📍" : "⚠️"}</span>
          <span>
            {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
            {ubicacion.precision_m ? ` (±${Math.round(ubicacion.precision_m)} m)` : ""}
            {dentro ? " — punto fijado" : " — este punto parece estar fuera del municipio; revísalo"}
          </span>
        </div>
      ) : (
        <p className={styles.coordsVacio}>Aún no has fijado un punto. Usa tu ubicación, busca una dirección o toca el mapa.</p>
      )}

      {estadoDireccion && <p className={styles.direccionDetectada}>{estadoDireccion}</p>}
    </div>
  );
}
