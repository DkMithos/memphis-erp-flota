-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260917195010  name: flujo_financiero_compromisos

-- FLUJO FINANCIERO — un compromiso por fila (lo que hoy vive en BD CONTA/BD TI).
-- El ERP deja de necesitar las tablas dinámicas del Excel: guarda la base y pinta
-- las vistas (por área, por mes, pagado vs pendiente, postergados). `fuente`
-- distingue lo importado del Excel de lo que en el futuro se cree nativo en el
-- ERP: una reimportación solo pisa lo de fuente='excel'.
create table if not exists public.flujo_compromisos (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  area                  text not null,               -- CONTA, TI, … (la BD de origen)
  cdc                   text,                        -- centro de costo (texto tal cual)
  centro_costo_id       uuid references public.centros_costo(id) on delete set null,
  concepto              text,
  categoria             text,
  proveedor             text,                        -- razón social tal cual
  proveedor_id          uuid references public.proveedores(id) on delete set null,
  moneda                text default 'PEN',
  tc                    numeric,
  mes_vencimiento       date,                        -- primer día del mes
  monto_ejecutado       numeric,
  monto_presupuestado   numeric,
  monto_pagado          numeric,
  fecha_pagado          date,                        -- la col "MES PAGADO" trae una fecha dd/mm/yyyy
  estado_pago           text,                        -- PAGADO | PENDIENTE | SALDO A FAVOR | …
  mes_programado        date,
  postergado            numeric,                     -- meses postergados (dif. programado vs vencimiento)
  momento               text,
  observaciones         text,
  fuente                text not null default 'excel',  -- 'excel' | 'erp'
  origen_archivo        text,                        -- 'BD CONTA 2026.xlsx'
  fila                  integer,                     -- fila de origen (traza)
  creado_por            uuid,
  importado_en          timestamptz not null default now()
);

create index if not exists idx_flujo_comp_tenant_area on public.flujo_compromisos (tenant_id, area);
create index if not exists idx_flujo_comp_venc on public.flujo_compromisos (tenant_id, mes_vencimiento);
create index if not exists idx_flujo_comp_cc on public.flujo_compromisos (centro_costo_id);

alter table public.flujo_compromisos enable row level security;

-- RLS por tenant (el gate de módulo es de UI, como en el resto del ERP).
drop policy if exists flujo_comp_rw on public.flujo_compromisos;
create policy flujo_comp_rw on public.flujo_compromisos
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

comment on table public.flujo_compromisos is
  'Flujo financiero: un compromiso de pago por fila. Importado de las BD de Excel (BD CONTA/BD TI) o creado en el ERP (fuente). Reemplaza las tablas dinámicas del Excel.';
