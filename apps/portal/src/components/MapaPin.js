"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./MapaPin.module.css";

// El pin solo se fija con zoom de calle — mismo candado de zoom-lock
// que ya traía rigo_mejorado_propuesta.html (initMapa/fijarPunto).
const ZOOM_MIN_FIJAR = 16;

// Leaflet toca window/document al importarse — no soporta SSR. Se carga
// una sola vez y de forma perezosa (mismo patrón que MapaOperativo.js
// en apps/mando).
let leafletCargado = null;
function cargarLeaflet() {
  if (!leafletCargado) {
    leafletCargado = import("leaflet").then(({ default: L }) => L);
  }
  return leafletCargado;
}

function iconoPin(L) {
  return L.divIcon({
    className: styles.pinEnvoltura,
    html: `<div class="${styles.pin}"></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 36],
  });
}

function aplicarMovimiento(L, mapa, pin, circuloRef, lat, lng, opciones) {
  const ll = L.latLng(lat, lng);
  pin.setLatLng(ll);
  mapa.setView(ll, opciones.zoom ?? mapa.getZoom());

  if (circuloRef.current) {
    mapa.removeLayer(circuloRef.current);
    circuloRef.current = null;
  }
  if (opciones.precisionM) {
    circuloRef.current = L.circle(ll, {
      radius: Math.max(opciones.precisionM, 10),
      color: "#B67A1C",
      weight: 1.5,
      fillColor: "#B67A1C",
      fillOpacity: 0.12,
    }).addTo(mapa);
  }
}

// Un solo pin arrastrable sobre OpenStreetMap. Expone moverA(lat, lng,
// opciones) por ref para que el padre lo mueva desde "usar mi
// ubicación" o el buscador de direcciones sin perder el estado interno
// de Leaflet en cada re-render.
const MapaPin = forwardRef(function MapaPin(
  { centroInicial, zoomInicial, onMover, onZoomInsuficiente },
  ref
) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const pinRef = useRef(null);
  const circuloRef = useRef(null);
  const leafletRef = useRef(null);
  const pendienteRef = useRef(null);

  const onMoverRef = useRef(onMover);
  const onZoomInsuficienteRef = useRef(onZoomInsuficiente);
  onMoverRef.current = onMover;
  onZoomInsuficienteRef.current = onZoomInsuficiente;

  useEffect(() => {
    let cancelado = false;

    cargarLeaflet().then((L) => {
      if (cancelado || !contenedorRef.current || mapaRef.current) return;

      leafletRef.current = L;
      const mapa = L.map(contenedorRef.current).setView(centroInicial, zoomInicial);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapa);

      const pin = L.marker(centroInicial, {
        draggable: true,
        icon: iconoPin(L),
        keyboard: true,
        title: "Arrastra el pin al punto exacto",
      }).addTo(mapa);

      pin.on("dragend", () => {
        const ll = pin.getLatLng();
        onMoverRef.current?.(ll.lat, ll.lng);
      });

      mapa.on("click", (e) => {
        if (mapa.getZoom() < ZOOM_MIN_FIJAR) {
          mapa.setView(e.latlng, Math.min(17, mapa.getZoom() + 3));
          onZoomInsuficienteRef.current?.();
          return;
        }
        pin.setLatLng(e.latlng);
        onMoverRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      mapaRef.current = mapa;
      pinRef.current = pin;

      if (pendienteRef.current) {
        const { lat, lng, opciones } = pendienteRef.current;
        pendienteRef.current = null;
        aplicarMovimiento(L, mapa, pin, circuloRef, lat, lng, opciones);
      }

      setTimeout(() => mapa.invalidateSize(), 80);
    });

    return () => {
      cancelado = true;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
        pinRef.current = null;
        circuloRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    moverA(lat, lng, opciones = {}) {
      const L = leafletRef.current;
      const mapa = mapaRef.current;
      const pin = pinRef.current;
      if (!L || !mapa || !pin) {
        // El mapa todavía no termina de cargar (import perezoso de
        // Leaflet) — se aplica en cuanto esté listo.
        pendienteRef.current = { lat, lng, opciones };
        return;
      }
      aplicarMovimiento(L, mapa, pin, circuloRef, lat, lng, opciones);
    },
  }));

  return (
    <div
      ref={contenedorRef}
      className={styles.mapa}
      role="application"
      aria-label="Mapa para fijar la ubicación del reporte"
    />
  );
});

export default MapaPin;
