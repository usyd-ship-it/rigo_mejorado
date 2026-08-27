-- RIGO+ — esquema inicial (B2)
-- Decisiones de diseño (CLAUDE.md §3): ID inmutable vs folio legible,
-- coordenada como única fuente de verdad (colonia/zona se derivan),
-- contacto separado y de acceso restringido, bitácora append-only.

create extension if not exists postgis;

-- 1. Catálogo de eventualidades — espejo de packages/catalogo/src/index.js
create table eventualidades (
  codigo   text primary key,
  nombre   text not null,
  familia  text not null,
  critica  boolean not null default false
);

-- 2. Contactos — separada, acceso restringido (§3.5). Nunca en vistas
--    públicas ni en la API de BG; se une a reportes solo cuando hace falta.
create table contactos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  telefono   text,
  creado_en  timestamptz not null default now()
);

-- 3. Reportes — tabla central
create table reportes (
  id                    uuid primary key default gen_random_uuid(),
  folio                 text not null unique,
  folio_legado          text,
  eventualidad_cod      text not null references eventualidades(codigo),
  estatus               text not null default 'recibido'
                           check (estatus in (
                             'recibido', 'clasificado', 'en_atencion', 'en_espera',
                             'resuelto', 'cerrado', 'reabierto', 'improcedente'
                           )),
  descripcion           text,

  -- ubicación: la coordenada es la única fuente de verdad (§3.2);
  -- colonia_calculada y zona_seccion se derivan por punto-en-polígono (B4)
  ubicacion             geography(point, 4326) not null,
  ubicacion_verificada  boolean not null default false,
  colonia_calculada     text,
  zona_seccion          text,

  -- dirección libre del ciudadano (estilo Google Places) — descriptiva,
  -- nunca fuente de verdad; distinta de direccion_area (dependencia)
  direccion_texto       text,

  -- asignación operativa, separada del estatus público (hallazgo §4)
  secretaria            text,
  direccion_area        text,
  enlace_gestor         text,
  cuadrilla             text,

  origen                text not null check (origen in ('WEB', 'WA', 'CC', 'RIGO')),
  contacto_id           uuid references contactos(id) on delete set null,
  duplicado_de          uuid references reportes(id),

  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

-- 4. Bitácora — append-only; unifica cambios de estatus y auditoría de
--    revelación de contacto (§3.5) en una sola línea de tiempo por reporte
create table bitacora (
  id                uuid primary key default gen_random_uuid(),
  reporte_id        uuid not null references reportes(id) on delete cascade,
  evento            text not null check (evento in (
                       'cambio_estatus', 'revelacion_contacto', 'asignacion', 'nota'
                     )),
  estatus_anterior  text,
  estatus_nuevo     text,
  detalle           jsonb,
  usuario_id        text,
  creado_en         timestamptz not null default now()
);

-- 5. Evidencias — referencias a objetos R2/S3, nunca URLs públicas directas (§3.6)
create table evidencias (
  id            uuid primary key default gen_random_uuid(),
  reporte_id    uuid not null references reportes(id) on delete cascade,
  object_key    text not null,
  mime_type     text not null,
  tamano_bytes  bigint not null,
  creado_en     timestamptz not null default now()
);

-- índices
create index idx_reportes_estatus on reportes (estatus);
create index idx_reportes_eventualidad on reportes (eventualidad_cod);
create index idx_reportes_actualizado_en on reportes (actualizado_en);
create index idx_reportes_folio_legado on reportes (folio_legado) where folio_legado is not null;
create index idx_reportes_ubicacion on reportes using gist (ubicacion);
create index idx_bitacora_reporte_id on bitacora (reporte_id);
create index idx_bitacora_creado_en on bitacora (creado_en);
create index idx_evidencias_reporte_id on evidencias (reporte_id);

-- actualizado_en se refresca solo en cada UPDATE — es lo que consume
-- ?actualizado_desde= del pull incremental de BG (B6)
create or replace function set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_reportes_actualizado_en
  before update on reportes
  for each row
  execute function set_actualizado_en();

-- semilla: catálogo de eventualidades — 27, verbatim (CLAUDE.md §7)
insert into eventualidades (codigo, nombre, familia, critica) values
  ('BAS', 'Bache Superficial', 'Baches y vialidades', false),
  ('BAP', 'Baches Profundos', 'Baches y vialidades', false),
  ('SEM', 'Semáforos', 'Baches y vialidades', false),
  ('SEV', 'Señalamientos Viales', 'Baches y vialidades', false),
  ('LAF', 'Lámpara Fundida', 'Alumbrado público', false),
  ('LPA', 'Lámpara Prende y Apaga', 'Alumbrado público', false),
  ('LPR', 'Lámpara Prendida 24hrs.', 'Alumbrado público', false),
  ('LCO', 'Lámpara Colgando', 'Alumbrado público', false),
  ('SEA', 'Sector Apagado', 'Alumbrado público', false),
  ('FDA', 'Fuga de Agua', 'Agua y drenaje', false),
  ('FDE', 'Fuga de Drenaje', 'Agua y drenaje', true),
  ('AAB', 'Alcantarilla Abierta', 'Agua y drenaje', true),
  ('RBA', 'Recolección de Basura', 'Basura y limpieza', false),
  ('BSC', 'Basurero Clandestino', 'Basura y limpieza', false),
  ('RER', 'Recolección de Ramas', 'Basura y limpieza', false),
  ('ADS', 'Animales en Descomposición', 'Basura y limpieza', false),
  ('LAV', 'Limpieza Áreas Verdes', 'Parques y áreas verdes', false),
  ('CAM', 'Camellones', 'Parques y áreas verdes', false),
  ('RPJ', 'Rehabilitación de Parques y Juegos', 'Parques y áreas verdes', false),
  ('AVP', 'Poda de Árboles en Vía Publica', 'Parques y áreas verdes', false),
  ('PCA', 'Poste Caído', 'Postes y cableado', true),
  ('CAC', 'Cable Caído', 'Postes y cableado', true),
  ('CAE', 'Cables Expuestos', 'Postes y cableado', true),
  ('SCA', 'Servicio Caído', 'Postes y cableado', false),
  ('ABV', 'Autos Abandonados en la Vía Pública', 'Convivencia y vía pública', false),
  ('AMA', 'Atención y Maltrato Animal', 'Convivencia y vía pública', false),
  ('REX', 'Ruido Excesivo', 'Convivencia y vía pública', false);
