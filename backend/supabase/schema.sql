-- Esquema del sistema de refaccionaria.
-- Ejecutar en el SQL Editor de Supabase.
-- El backend usa la service_role key y omite RLS.
-- No hay políticas para anon/authenticated: el navegador no habla con Supabase.

create extension if not exists pgcrypto;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  password_hash text not null,
  telefono text,
  rol text not null default 'cliente' check (rol in ('admin', 'empleado', 'cliente')),
  created_at timestamptz not null default now()
);

create table if not exists autos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios (id) on delete set null,
  marca text not null,
  modelo text not null,
  anio integer not null check (anio between 1900 and 2100),
  placas text,
  vin text,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists piezas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  marca text,
  categoria text,
  descripcion text,
  precio numeric(12, 2) not null default 0 check (precio >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);

create table if not exists auto_piezas (
  auto_id uuid not null references autos (id) on delete cascade,
  pieza_id uuid not null references piezas (id) on delete cascade,
  primary key (auto_id, pieza_id)
);

create unique index if not exists autos_placas_unique on autos (placas) where placas is not null;
create unique index if not exists autos_vin_unique on autos (vin) where vin is not null;
create index if not exists autos_usuario_idx on autos (usuario_id);
create index if not exists piezas_nombre_idx on piezas (nombre);
create index if not exists auto_piezas_pieza_idx on auto_piezas (pieza_id);

create table if not exists ubicaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete cascade,
  latitud double precision not null check (latitud between -90 and 90),
  longitud double precision not null check (longitud between -180 and 180),
  precision_m double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists ubicaciones_usuario_idx on ubicaciones (usuario_id, recorded_at desc);

alter table usuarios enable row level security;
alter table autos enable row level security;
alter table piezas enable row level security;
alter table auto_piezas enable row level security;
alter table ubicaciones enable row level security;
