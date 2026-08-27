// Carga única (no es parte del servidor): SECCION.shp/COLONIA.shp de
// Tamaulipas, filtrados a Matamoros (municipio='22'), hacia las tablas
// zona_seccion/colonias. Ver migrations/0003_cartografia.sql — fuente
// PROVISIONAL, pendiente confirmar con Miguel/BG (CLAUDE.md §10, punto 9).
//
// Uso: node scripts/cargar_cartografia.js

import "dotenv/config";
import { read } from "shapefile";
import { pool } from "../src/lib/db.js";

const SHP_DIR =
  "/Users/raulcrenteriac/Desktop/MATAMOROS/Estadistica_Electoral_2027/04_RIGO/PRODUCTOS/shapefiles- POLIGONOS_MAPAS_ULTIMO";

const MUNICIPIO_MATAMOROS = "22";

async function cargarSecciones(client) {
  const { features } = await read(`${SHP_DIR}/SECCION.shp`, `${SHP_DIR}/SECCION.dbf`);
  const deMatamoros = features.filter((f) => String(f.properties.municipio) === MUNICIPIO_MATAMOROS);

  for (const f of deMatamoros) {
    await client.query(
      `insert into zona_seccion (seccion, entidad, distrito_f, distrito_l, tipo, geom)
       values ($1, $2, $3, $4, $5, ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))))`,
      [
        String(f.properties.seccion),
        String(f.properties.entidad),
        String(f.properties.distrito_f),
        String(f.properties.distrito_l),
        String(f.properties.tipo),
        JSON.stringify(f.geometry),
      ]
    );
  }
  return deMatamoros.length;
}

async function cargarColonias(client) {
  const { features } = await read(`${SHP_DIR}/COLONIA.shp`, `${SHP_DIR}/COLONIA.dbf`);
  const deMatamoros = features.filter((f) => String(f.properties.MUNICIPIO) === MUNICIPIO_MATAMOROS);

  for (const f of deMatamoros) {
    await client.query(
      `insert into colonias (nombre, clasificacion, cp, geom)
       values ($1, $2, $3, ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))))`,
      [
        f.properties.NOMBRE,
        String(f.properties.CLASIFICAC),
        String(f.properties.CP),
        JSON.stringify(f.geometry),
      ]
    );
  }
  return deMatamoros.length;
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const nSecciones = await cargarSecciones(client);
  const nColonias = await cargarColonias(client);
  await client.query("COMMIT");
  console.log(`Cargadas ${nSecciones} secciones y ${nColonias} colonias de Matamoros.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
