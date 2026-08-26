// Catálogo oficial RIGO+ — verbatim contra CLAUDE.md §5 y §7.
// El código es la llave de compatibilidad con Tactica/Mando: no traducir nombres.

export const FAMILIAS = [
  "Baches y vialidades",
  "Alumbrado público",
  "Agua y drenaje",
  "Basura y limpieza",
  "Parques y áreas verdes",
  "Postes y cableado",
  "Convivencia y vía pública",
];

export const EVENTUALIDADES = [
  { familia: "Baches y vialidades", nombre: "Bache Superficial", codigo: "BAS" },
  { familia: "Baches y vialidades", nombre: "Baches Profundos", codigo: "BAP" },
  { familia: "Baches y vialidades", nombre: "Semáforos", codigo: "SEM" },
  { familia: "Baches y vialidades", nombre: "Señalamientos Viales", codigo: "SEV" },

  { familia: "Alumbrado público", nombre: "Lámpara Fundida", codigo: "LAF" },
  { familia: "Alumbrado público", nombre: "Lámpara Prende y Apaga", codigo: "LPA" },
  { familia: "Alumbrado público", nombre: "Lámpara Prendida 24hrs.", codigo: "LPR" },
  { familia: "Alumbrado público", nombre: "Lámpara Colgando", codigo: "LCO" },
  { familia: "Alumbrado público", nombre: "Sector Apagado", codigo: "SEA" },

  { familia: "Agua y drenaje", nombre: "Fuga de Agua", codigo: "FDA" },
  { familia: "Agua y drenaje", nombre: "Fuga de Drenaje", codigo: "FDE" },
  { familia: "Agua y drenaje", nombre: "Alcantarilla Abierta", codigo: "AAB" },

  { familia: "Basura y limpieza", nombre: "Recolección de Basura", codigo: "RBA" },
  { familia: "Basura y limpieza", nombre: "Basurero Clandestino", codigo: "BSC" },
  { familia: "Basura y limpieza", nombre: "Recolección de Ramas", codigo: "RER" },
  { familia: "Basura y limpieza", nombre: "Animales en Descomposición", codigo: "ADS" },

  { familia: "Parques y áreas verdes", nombre: "Limpieza Áreas Verdes", codigo: "LAV" },
  { familia: "Parques y áreas verdes", nombre: "Camellones", codigo: "CAM" },
  { familia: "Parques y áreas verdes", nombre: "Rehabilitación de Parques y Juegos", codigo: "RPJ" },
  { familia: "Parques y áreas verdes", nombre: "Poda de Árboles en Vía Publica", codigo: "AVP" },

  { familia: "Postes y cableado", nombre: "Poste Caído", codigo: "PCA" },
  { familia: "Postes y cableado", nombre: "Cable Caído", codigo: "CAC" },
  { familia: "Postes y cableado", nombre: "Cables Expuestos", codigo: "CAE" },
  { familia: "Postes y cableado", nombre: "Servicio Caído", codigo: "SCA" },

  { familia: "Convivencia y vía pública", nombre: "Autos Abandonados en la Vía Pública", codigo: "ABV" },
  { familia: "Convivencia y vía pública", nombre: "Atención y Maltrato Animal", codigo: "AMA" },
  { familia: "Convivencia y vía pública", nombre: "Ruido Excesivo", codigo: "REX" },
];

// Aviso de riesgo automático (CLAUDE.md §7)
export const EVENTUALIDADES_CRITICAS = ["CAC", "CAE", "PCA", "AAB", "FDE"];

// Enum de estatus — CLAUDE.md §5. La granularidad operativa
// (Dirección / Enlace Gestor / Cuadrilla) vive en asignación, no aquí.
export const ESTATUS = {
  recibido: { etiqueta: "Recibido", visible_ciudadano: true, color: "#6F5E63" },
  clasificado: { etiqueta: "Clasificado", visible_ciudadano: true, color: "#C2953A" },
  en_atencion: { etiqueta: "En atención", visible_ciudadano: true, color: "#B67A1C" },
  en_espera: { etiqueta: "En espera", visible_ciudadano: true, color: "#7C6A93" },
  resuelto: { etiqueta: "Resuelto", visible_ciudadano: true, color: "#2E7D4F" },
  cerrado: { etiqueta: "Cerrado", visible_ciudadano: true, color: "#1F5A38" },
  reabierto: { etiqueta: "Reabierto", visible_ciudadano: true, color: "#B3392E" },
  improcedente: { etiqueta: "Improcedente", visible_ciudadano: true, color: "#9C8D8F" },
};

export function eventualidadPorCodigo(codigo) {
  return EVENTUALIDADES.find((e) => e.codigo === codigo);
}
