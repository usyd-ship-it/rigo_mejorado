-- Identidad de staff de Mando — vive sobre auth.users de Supabase Auth.
-- Sin auto-registro público: el staff se invita desde el dashboard de
-- Supabase (Auth → Invite) o un script de admin, nunca un /signup abierto.

create table usuarios_mando (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null,
  rol             text not null default 'operador' check (rol in ('admin', 'operador')),
  secretaria      text,
  direccion_area  text,
  enlace_gestor   text,
  creado_en       timestamptz not null default now()
);
