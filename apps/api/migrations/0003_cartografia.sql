-- Cartografía de referencia — zona_seccion y colonias (B4)
-- Punto-en-polígono contra esto deriva reportes.colonia_calculada y
-- reportes.zona_seccion; nunca se capturan como texto libre (§3.2).

-- ⚠️ PENDIENTE — fuente provisional, no confirmada con BG:
-- Los datos se cargan desde el shapefile crudo en
-- "Estadistica_Electoral_2027/04_RIGO/PRODUCTOS/shapefiles- POLIGONOS_MAPAS_ULTIMO/"
-- (SECCION.shp / COLONIA.shp, todo Tamaulipas, filtrado a municipio='22').
-- Filtrado a Matamoros da exactamente 282 secciones, lo cual coincide
-- con "282 secciones, sin huecos ni traslapes" de §3.3 — evidencia
-- fuerte, no prueba. §3.3 exige una sola cartografía, la de BG, nunca
-- una copia paralela: falta confirmar con Miguel/BG que este shapefile
-- es la misma versión/vintage que usa zona_seccion hoy, y no una
-- redistritación distinta. No usar como fuente de verdad en producción
-- hasta cerrar esto (ver CLAUDE.md §10).

create table zona_seccion (
  id           uuid primary key default gen_random_uuid(),
  seccion      text not null,
  entidad      text,
  distrito_f   text,
  distrito_l   text,
  tipo         text,
  geom         geometry(multipolygon, 4326) not null
);

create table colonias (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  clasificacion  text,
  cp             text,
  geom           geometry(multipolygon, 4326) not null
);

create index idx_zona_seccion_geom on zona_seccion using gist (geom);
create index idx_colonias_geom on colonias using gist (geom);

-- deriva colonia_calculada y zona_seccion por punto-en-polígono cada
-- vez que se inserta un reporte, o que se corrige su ubicación
create or replace function set_ubicacion_derivada()
returns trigger as $$
begin
  select c.nombre into new.colonia_calculada
  from colonias c
  where ST_Contains(c.geom, new.ubicacion::geometry)
  limit 1;

  select z.seccion into new.zona_seccion
  from zona_seccion z
  where ST_Contains(z.geom, new.ubicacion::geometry)
  limit 1;

  return new;
end;
$$ language plpgsql;

create trigger trg_reportes_ubicacion_derivada
  before insert or update of ubicacion on reportes
  for each row
  execute function set_ubicacion_derivada();
