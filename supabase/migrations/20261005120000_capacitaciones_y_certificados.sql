-- ============================================================================
-- CAPACITACIONES Y CERTIFICADOS (2026-10-05)
--
-- Algunas entregas de bienes de los proyectos incluyen capacitaciones al
-- personal de la entidad (conducción, soporte vital básico, uso de equipos…).
-- Hasta hoy la constancia se armaba fuera del ERP, en un taller local
-- (repo plantilla-diplomas) que no sabía nada de proyectos ni participantes.
--
-- Ahora todo sale del ERP:
--   · capacitacion_cursos        — catálogo de cursos con su temario y horas
--   · certificado_plantillas     — el modelo del certificado: estándar con logo
--                                  del consorcio o un fondo completo subido
--   · capacitaciones             — cada sesión dictada, amarrada al proyecto
--   · capacitacion_participantes — asistentes con su FIRMA (pad en el ERP o
--                                  enlace/QR en su propio celular)
--   · certificados               — emisión: snapshot de datos + plantilla,
--                                  código correlativo y token opaco para el QR
--   · certificado_accesos        — bitácora del portal público (anti-abuso)
--
-- Permisos: se reutiliza el módulo `proyectos` (ver / crear / editar / aprobar
-- para emitir / eliminar para revocar). Las lecturas públicas (QR, portal por
-- DNI, formulario de firma) NO pasan por RLS: las sirve la Edge Function
-- `capacitaciones-publico` con el rol de servicio, con límite por IP.
-- ============================================================================

-- ─── 1. Catálogo de cursos ──────────────────────────────────────────────────
create table if not exists public.capacitacion_cursos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  codigo        text,
  nombre        text not null,
  descripcion   text,
  -- [{ "tema": "Soporte vital básico (BLS)", "horas": 4 }, …]
  temario       jsonb not null default '[]'::jsonb,
  horas_total   numeric(8,2) not null default 0,
  activo        boolean not null default true,
  creado_por    text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists capacitacion_cursos_tenant_idx on public.capacitacion_cursos(tenant_id);

-- ─── 2. Plantillas de certificado ───────────────────────────────────────────
create table if not exists public.certificado_plantillas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  nombre           text not null,
  descripcion      text,
  -- 'estandar'       → diseño institucional del ERP: solo se cambia logo, sello,
  --                    colores, textos y firmante.
  -- 'fondo_completo' → el consorcio sube su propio modelo (imagen A4 horizontal)
  --                    y el ERP escribe encima nombre, curso, horas, fecha y QR.
  modo             text not null default 'estandar' check (modo in ('estandar','fondo_completo')),
  es_default       boolean not null default false,
  -- A qué aplica por defecto (ambos nulos = plantilla general)
  proyecto_id      uuid references public.proyectos(id) on delete set null,
  curso_id         uuid references public.capacitacion_cursos(id) on delete set null,
  consorcio_nombre text,
  -- Recursos en el bucket público `certificados` (carpeta = tenant_id)
  logo_url         text,
  sello_url        text,
  fondo_url        text,   -- foto de fondo (estándar) o modelo completo (fondo_completo)
  firma_url        text,   -- rúbrica del firmante
  color_acento     text not null default '#b28b45',
  color_primario   text not null default '#17364c',
  color_secundario text not null default '#24718a',
  color_texto      text not null default '#17364c',
  titulo           text not null default 'Certificado',
  texto_otorga     text not null default 'Se otorga el presente a',
  texto_reconocimiento text not null default 'Por haber participado en la capacitación en',
  ciudad           text not null default 'Lima',
  firmante_nombre  text,
  firmante_cargo   text,
  mostrar_temario  boolean not null default true,
  mostrar_dni      boolean not null default true,
  mostrar_qr       boolean not null default true,
  mostrar_proyecto boolean not null default true,
  -- Ajustes finos de posición (fondo_completo): { "texto_top": 30, "texto_alto": 55, "qr_pos": "br" }
  layout           jsonb not null default '{}'::jsonb,
  activa           boolean not null default true,
  creado_por       text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index if not exists certificado_plantillas_tenant_idx on public.certificado_plantillas(tenant_id);
-- Una sola plantilla por defecto por tenant
create unique index if not exists certificado_plantillas_default_uniq
  on public.certificado_plantillas(tenant_id) where es_default;

-- ─── 3. Capacitaciones (sesiones dictadas) ──────────────────────────────────
create table if not exists public.capacitaciones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  codigo             text,                       -- CAP-YYYY-NNN (trigger)
  proyecto_id        uuid references public.proyectos(id) on delete set null,
  curso_id           uuid references public.capacitacion_cursos(id) on delete set null,
  plantilla_id       uuid references public.certificado_plantillas(id) on delete set null,
  titulo             text not null,
  descripcion        text,
  temario            jsonb not null default '[]'::jsonb,   -- copia editable del curso
  horas_total        numeric(8,2) not null default 0,
  fecha_inicio       date not null,
  fecha_fin          date,
  lugar              text,
  ciudad             text,
  instructor_nombre  text,
  instructor_cargo   text,
  entidad_beneficiaria text,                      -- p. ej. "GORE CUSCO"
  estado             text not null default 'programada'
                     check (estado in ('programada','en_curso','cerrada','anulada')),
  -- Enlace/QR para que el participante firme desde su celular
  asistencia_token   uuid not null default gen_random_uuid() unique,
  asistencia_abierta boolean not null default false,
  observaciones      text,
  creado_por         text,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
create index if not exists capacitaciones_tenant_idx on public.capacitaciones(tenant_id, fecha_inicio desc);
create index if not exists capacitaciones_proyecto_idx on public.capacitaciones(proyecto_id);
create unique index if not exists capacitaciones_codigo_uniq on public.capacitaciones(tenant_id, codigo);

-- ─── 4. Participantes (con firma) ───────────────────────────────────────────
create table if not exists public.capacitacion_participantes (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  capacitacion_id  uuid not null references public.capacitaciones(id) on delete cascade,
  dni              text not null check (dni ~ '^[0-9A-Za-z]{6,12}$'),
  nombres          text not null,
  apellidos        text not null,
  cargo            text,
  institucion      text,
  email            text,
  telefono         text,
  -- PNG (data URI) recortado; privado, nunca sale por el portal público
  firma_data_url   text,
  firmado_en       timestamptz,
  firma_origen     text check (firma_origen in ('erp','enlace')),
  firma_ip         text,
  firma_user_agent text,
  asistio          boolean not null default true,
  nota             text,
  orden            int,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (capacitacion_id, dni)
);
create index if not exists capacitacion_participantes_cap_idx on public.capacitacion_participantes(capacitacion_id);
create index if not exists capacitacion_participantes_dni_idx on public.capacitacion_participantes(dni);

-- ─── 5. Certificados emitidos ───────────────────────────────────────────────
create table if not exists public.certificados (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  capacitacion_id   uuid not null references public.capacitaciones(id) on delete cascade,
  participante_id   uuid not null unique references public.capacitacion_participantes(id) on delete cascade,
  codigo            text,                        -- CERT-YYYY-NNNNN (trigger)
  token             uuid not null default gen_random_uuid() unique,   -- va en el QR
  estado            text not null default 'emitido' check (estado in ('emitido','revocado')),
  emitido_en        timestamptz not null default now(),
  emitido_por       text,
  emitido_por_email text,
  revocado_en       timestamptz,
  revocado_por      text,
  motivo_revocacion text,
  -- Snapshots: lo que se imprimió ese día. Cambiar la plantilla o el curso
  -- después NO altera un certificado ya emitido.
  datos             jsonb not null,
  plantilla         jsonb not null,
  creado_en         timestamptz not null default now()
);
create index if not exists certificados_tenant_idx on public.certificados(tenant_id, emitido_en desc);
create index if not exists certificados_cap_idx on public.certificados(capacitacion_id);
create unique index if not exists certificados_codigo_uniq on public.certificados(tenant_id, codigo);

-- ─── 6. Bitácora del portal público ─────────────────────────────────────────
create table if not exists public.certificado_accesos (
  id             bigserial primary key,
  tenant_id      uuid,
  tipo           text not null check (tipo in ('consulta_dni','verificacion','firma','formulario')),
  dni_hash       text,
  certificado_id uuid,
  capacitacion_id uuid,
  ip             text,
  user_agent     text,
  resultado      text,
  creado_en      timestamptz not null default now()
);
create index if not exists certificado_accesos_ip_idx on public.certificado_accesos(ip, creado_en desc);

-- ─── 7. Triggers: horas, códigos, actualizado_en ────────────────────────────
create or replace function public.capacitaciones_touch()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- horas_total siempre sale del temario; nadie lo escribe a mano.
create or replace function public.capacitaciones_calcular_horas()
returns trigger language plpgsql as $$
begin
  select coalesce(sum(nullif(t->>'horas','')::numeric), 0)
    into new.horas_total
    from jsonb_array_elements(coalesce(new.temario, '[]'::jsonb)) t;
  return new;
end $$;

create or replace function public.capacitaciones_asignar_codigo()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_anio text := to_char(coalesce(new.fecha_inicio, current_date), 'YYYY');
  v_n int;
begin
  if coalesce(new.codigo, '') <> '' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.tenant_id::text || ':CAP:' || v_anio));
  select coalesce(max(substring(codigo from '(\d+)$')::int), 0) + 1 into v_n
    from capacitaciones
   where tenant_id = new.tenant_id and codigo like 'CAP-' || v_anio || '-%';
  new.codigo := 'CAP-' || v_anio || '-' || lpad(v_n::text, 3, '0');
  return new;
end $$;

create or replace function public.certificados_asignar_codigo()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_anio text := to_char(coalesce(new.emitido_en, now()), 'YYYY');
  v_n int;
begin
  if coalesce(new.codigo, '') <> '' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.tenant_id::text || ':CERT:' || v_anio));
  select coalesce(max(substring(codigo from '(\d+)$')::int), 0) + 1 into v_n
    from certificados
   where tenant_id = new.tenant_id and codigo like 'CERT-' || v_anio || '-%';
  new.codigo := 'CERT-' || v_anio || '-' || lpad(v_n::text, 5, '0');
  return new;
end $$;

drop trigger if exists capacitacion_cursos_horas on public.capacitacion_cursos;
create trigger capacitacion_cursos_horas before insert or update of temario on public.capacitacion_cursos
  for each row execute function public.capacitaciones_calcular_horas();
drop trigger if exists capacitacion_cursos_touch on public.capacitacion_cursos;
create trigger capacitacion_cursos_touch before update on public.capacitacion_cursos
  for each row execute function public.capacitaciones_touch();

drop trigger if exists certificado_plantillas_touch on public.certificado_plantillas;
create trigger certificado_plantillas_touch before update on public.certificado_plantillas
  for each row execute function public.capacitaciones_touch();

drop trigger if exists capacitaciones_horas on public.capacitaciones;
create trigger capacitaciones_horas before insert or update of temario on public.capacitaciones
  for each row execute function public.capacitaciones_calcular_horas();
drop trigger if exists capacitaciones_codigo on public.capacitaciones;
create trigger capacitaciones_codigo before insert on public.capacitaciones
  for each row execute function public.capacitaciones_asignar_codigo();
drop trigger if exists capacitaciones_touch_trg on public.capacitaciones;
create trigger capacitaciones_touch_trg before update on public.capacitaciones
  for each row execute function public.capacitaciones_touch();

drop trigger if exists capacitacion_participantes_touch on public.capacitacion_participantes;
create trigger capacitacion_participantes_touch before update on public.capacitacion_participantes
  for each row execute function public.capacitaciones_touch();

drop trigger if exists certificados_codigo on public.certificados;
create trigger certificados_codigo before insert on public.certificados
  for each row execute function public.certificados_asignar_codigo();

-- ─── 8. RLS: aislamiento por tenant (patrón ti_* del resto del ERP) ─────────
alter table public.capacitacion_cursos        enable row level security;
alter table public.certificado_plantillas     enable row level security;
alter table public.capacitaciones             enable row level security;
alter table public.capacitacion_participantes enable row level security;
alter table public.certificados               enable row level security;
alter table public.certificado_accesos        enable row level security;

drop policy if exists ti_capacitacion_cursos on public.capacitacion_cursos;
create policy ti_capacitacion_cursos on public.capacitacion_cursos
  for all to authenticated using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));

drop policy if exists ti_certificado_plantillas on public.certificado_plantillas;
create policy ti_certificado_plantillas on public.certificado_plantillas
  for all to authenticated using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));

drop policy if exists ti_capacitaciones on public.capacitaciones;
create policy ti_capacitaciones on public.capacitaciones
  for all to authenticated using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));

drop policy if exists ti_capacitacion_participantes on public.capacitacion_participantes;
create policy ti_capacitacion_participantes on public.capacitacion_participantes
  for all to authenticated using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));

drop policy if exists ti_certificados on public.certificados;
create policy ti_certificados on public.certificados
  for all to authenticated using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));

-- La bitácora la escribe solo el rol de servicio (Edge Function); el ERP la lee.
drop policy if exists ti_certificado_accesos_leer on public.certificado_accesos;
create policy ti_certificado_accesos_leer on public.certificado_accesos
  for select to authenticated using (tenant_id = (select auth_tenant_id()));

-- ─── 9. Bucket público de recursos de plantilla (logos, sellos, fondos, rúbrica)
-- Público porque esas imágenes se imprimen en cada certificado y las necesita
-- la página de verificación sin sesión. Las firmas de los PARTICIPANTES no van
-- aquí: viven en la tabla, bajo RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', true, 5242880,
        array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists certificados_recursos_leer on storage.objects;
create policy certificados_recursos_leer on storage.objects
  for select using (bucket_id = 'certificados');

drop policy if exists certificados_recursos_subir on storage.objects;
create policy certificados_recursos_subir on storage.objects
  for insert to authenticated with check (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = (select auth_tenant_id())::text
    and (auth_tiene_permiso('proyectos','editar') or auth_tiene_permiso('proyectos','crear'))
  );

drop policy if exists certificados_recursos_actualizar on storage.objects;
create policy certificados_recursos_actualizar on storage.objects
  for update to authenticated using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = (select auth_tenant_id())::text
    and auth_tiene_permiso('proyectos','editar')
  );

drop policy if exists certificados_recursos_borrar on storage.objects;
create policy certificados_recursos_borrar on storage.objects
  for delete to authenticated using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = (select auth_tenant_id())::text
    and auth_tiene_permiso('proyectos','editar')
  );

-- ─── 10. Semilla para Memphis: plantilla estándar + el curso que ya se dictó
insert into public.certificado_plantillas
  (tenant_id, nombre, descripcion, modo, es_default, consorcio_nombre, titulo,
   texto_otorga, texto_reconocimiento, ciudad, firmante_nombre, firmante_cargo)
select t.id, 'Plantilla estándar', 'Diseño institucional: marco azul profundo, detalles dorados y papel marfil. Cambie el logo del consorcio, el sello y el firmante.',
       'estandar', true, null, 'Certificado',
       'Se otorga el presente a', 'Por haber participado en la capacitación en',
       'Lima', null, null
  from public.tenants t
 where not exists (select 1 from public.certificado_plantillas p where p.tenant_id = t.id and p.es_default);

insert into public.capacitacion_cursos (tenant_id, codigo, nombre, descripcion, temario)
select t.id, 'CUR-001', 'Destrezas de Conducción y Soporte Vital Básico (BLS)',
       'Capacitación al personal que opera las ambulancias entregadas.',
       '[{"tema":"Soporte vital básico (BLS)","horas":4},{"tema":"Curso básico de destrezas de conducción","horas":16}]'::jsonb
  from public.tenants t
 where t.id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
   and not exists (select 1 from public.capacitacion_cursos c where c.tenant_id = t.id and c.codigo = 'CUR-001');

notify pgrst, 'reload schema';
