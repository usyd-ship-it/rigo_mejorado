"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Mismo semáforo de CLAUDE.md §11.
const COLOR_ESTATUS = {
  recibido: "#6F5E63",
  clasificado: "#C2953A",
  en_atencion: "#B67A1C",
  en_espera: "#7C6A93",
  resuelto: "#2E7D4F",
  cerrado: "#1F5A38",
  reabierto: "#B3392E",
  improcedente: "#9C8D8F",
};

// leaflet.markercluster es un UMD viejo que espera `L` como variable
// GLOBAL (L.MarkerClusterGroup = ...), no lo recibe como parámetro del
// import — hay que asignar window.L antes de importarlo, en ese orden.
let leafletCargado = null;
function cargarLeaflet() {
  if (!leafletCargado) {
    leafletCargado = import("leaflet").then(async ({ default: L }) => {
      window.L = L;
      await import("leaflet.markercluster");
      return L;
    });
  }
  return leafletCargado;
}

function iconoColor(L, color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function MapaOperativo({ puntos, onAbrir }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const clusterRef = useRef(null);

  // Mapa + capa de cluster: se crean una sola vez.
  useEffect(() => {
    let cancelado = false;

    cargarLeaflet().then((L) => {
      if (cancelado || !contenedorRef.current || mapaRef.current) return;

      mapaRef.current = L.map(contenedorRef.current).setView([25.868, -97.503], 12);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(mapaRef.current);

      clusterRef.current = L.markerClusterGroup();
      mapaRef.current.addLayer(clusterRef.current);
    });

    return () => {
      cancelado = true;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
        clusterRef.current = null;
      }
    };
  }, []);

  // Pines: se redibujan cada vez que cambian los puntos filtrados.
  useEffect(() => {
    let cancelado = false;

    cargarLeaflet().then((L) => {
      if (cancelado || !clusterRef.current) return;

      clusterRef.current.clearLayers();
      puntos.forEach((p) => {
        if (p.lat == null || p.lng == null) return;
        const marker = L.marker([p.lat, p.lng], {
          icon: iconoColor(L, COLOR_ESTATUS[p.estatus] ?? "#6F5E63"),
        });
        marker.bindPopup(`<b>${p.folio}</b><br>${p.estatus}`);
        marker.on("click", () => onAbrir(p.id));
        clusterRef.current.addLayer(marker);
      });
    });

    return () => {
      cancelado = true;
    };
  }, [puntos, onAbrir]);

  return <div ref={contenedorRef} style={{ height: 420, borderRadius: 12, border: "1px solid #E4DCD2" }} />;
}
