-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 · Flujo financiero: bitácora de lecturas del Excel y cron 2×/día
--
-- `flujo_importaciones` guarda cada lectura de las bases del flujo (BD CONTA,
-- BD TI, Flujo Administración, Flujo de proyectos): cuándo, qué archivo, con qué
-- fecha de modificación en SharePoint, cuántos compromisos y si salió bien.
-- La pantalla muestra "última lectura" por área; el cron `flujo-import-2xdia`
-- (06:00 y 15:00 hora Perú, como fianzas-import) solo reimporta lo que cambió.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists flujo_importaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  area text,
  archivo text,
  item_id text,
  archivo_modificado timestamptz,          -- lastModifiedDateTime de SharePoint
  importado_en timestamptz not null default now(),
  modo text not null default 'manual',     -- manual | cron
  estado text not null default 'ok',       -- ok | omitido | error
  compromisos int,
  detalle jsonb,
  error text,
  por uuid
);
create index if not exists flujo_importaciones_tenant_area_idx on flujo_importaciones (tenant_id, area, importado_en desc);

alter table flujo_importaciones enable row level security;
drop policy if exists flujo_importaciones_sel on flujo_importaciones;
create policy flujo_importaciones_sel on flujo_importaciones for select
  using (tenant_id = auth_tenant_id());
-- Escribe solo la Edge Function (service role): sin política de insert/update para usuarios.

-- Última lectura buena por área (lo que pinta la pantalla).
create or replace view v_flujo_ultima_lectura as
select distinct on (tenant_id, area) tenant_id, area, archivo, archivo_modificado, importado_en, modo, compromisos
  from flujo_importaciones
 where estado = 'ok'
 order by tenant_id, area, importado_en desc;

-- Cron: dos veces al día, mismo patrón que fianzas-import-2xdia (secreto desde Vault).
select cron.unschedule('flujo-import-2xdia') where exists (select 1 from cron.job where jobname = 'flujo-import-2xdia');
select cron.schedule(
  'flujo-import-2xdia',
  '0 11,20 * * *',
  $cron$
  select net.http_post(
    url := 'https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/flujo-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbXVxd2dyamdqb2Vibnd1bm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzY2NzIsImV4cCI6MjA4NzYxMjY3Mn0.HBtu1hNBxh_KfhtoimmGS10a819-J8s-tAeYrl7e0ig',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"accion":"importar_todo"}'::jsonb
  );
  $cron$
);
