-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260910150955  name: cotizacion_archivos

-- ADJUNTAR EL DOCUMENTO DE LA COTIZACIÓN
--
-- La cotización del proveedor llega como PDF (o foto, o Excel) por correo o
-- WhatsApp. Hasta ahora el ERP guardaba los importes pero no el papel, así que
-- el documento que respalda la compra seguía viviendo fuera del sistema.
--
-- Una cotización puede traer más de un archivo (la propuesta y su ficha
-- técnica), por eso es una tabla y no una columna. Mismo patrón que
-- `fianza_cargos`.

create table if not exists cotizacion_archivos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  nombre        text not null,
  storage_path  text not null unique,
  mime          text,
  tamano_bytes  bigint,
  subido_por    uuid references auth.users(id) on delete set null,
  subido_en     timestamptz not null default now()
);

create index if not exists ix_cotizacion_archivos_cotizacion
  on cotizacion_archivos (cotizacion_id);

alter table cotizacion_archivos enable row level security;

drop policy if exists ti_cotizacion_archivos on cotizacion_archivos;
create policy ti_cotizacion_archivos on cotizacion_archivos
  for all
  using (tenant_id = (select auth_tenant_id()))
  with check (tenant_id = (select auth_tenant_id()));

-- Bucket privado. Se admite lo que de verdad manda un proveedor: PDF, una foto
-- del documento, o el Excel/Word con el que cotiza.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cotizaciones', 'cotizaciones', false, 10485760,
  array[
    'application/pdf',
    'image/jpeg','image/png','image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- La ruta es <tenant>/<cotizacion>/<marca de tiempo>-<nombre>, así que el
-- primer tramo identifica al tenant y sirve para aislarlo.
drop policy if exists cotizaciones_archivo_leer on storage.objects;
create policy cotizaciones_archivo_leer on storage.objects
  for select using (
    bucket_id = 'cotizaciones'
    and (storage.foldername(name))[1] = (auth_tenant_id())::text
    and auth_tiene_permiso('compras', 'ver')
  );

drop policy if exists cotizaciones_archivo_subir on storage.objects;
create policy cotizaciones_archivo_subir on storage.objects
  for insert with check (
    bucket_id = 'cotizaciones'
    and (storage.foldername(name))[1] = (auth_tenant_id())::text
    and (auth_tiene_permiso('compras', 'crear') or auth_tiene_permiso('compras', 'editar'))
  );

drop policy if exists cotizaciones_archivo_borrar on storage.objects;
create policy cotizaciones_archivo_borrar on storage.objects
  for delete using (
    bucket_id = 'cotizaciones'
    and (storage.foldername(name))[1] = (auth_tenant_id())::text
    and (auth_tiene_permiso('compras', 'eliminar') or auth_tiene_permiso('compras', 'editar'))
  );
