-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260917191610  name: portal_invitaciones_enlace_opaco

-- Invitaciones del portal: enlace OPACO de Memphis que sustituye al link de
-- recovery de GoTrue. El link de GoTrue se consumía con el PRIMER GET (bots de
-- previsualización de WhatsApp/Teams/Outlook), dejándolo "vencido" antes de que
-- el proveedor hiciera clic. Este código es inerte ante un GET: solo se consume
-- cuando una persona ENVÍA su contraseña (POST explícito a portal-fijar-clave).
create table if not exists public.portal_invitaciones (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  proveedor_id  uuid not null references public.proveedores(id) on delete cascade,
  portal_user_id uuid not null,
  code_hash     text not null unique,      -- sha256(code) en hex; el code nunca se guarda
  email_destino text,
  expira_en     timestamptz not null,
  consumida_en  timestamptz,
  creada_por    uuid,
  creada_en     timestamptz not null default now()
);

create index if not exists idx_portal_invit_proveedor on public.portal_invitaciones (proveedor_id);
create index if not exists idx_portal_invit_vigentes on public.portal_invitaciones (expira_en) where consumida_en is null;

alter table public.portal_invitaciones enable row level security;

-- Solo el personal interno del tenant ve el estado de sus invitaciones.
-- Los proveedores no tienen tenant_id → no ven nada. Las Edge Functions usan
-- service role y saltan RLS para crear/consumir.
drop policy if exists portal_invit_select on public.portal_invitaciones;
create policy portal_invit_select on public.portal_invitaciones
  for select using (tenant_id = auth_tenant_id());

comment on table public.portal_invitaciones is
  'Enlaces de invitación del portal de proveedores (código opaco de un solo uso, consumido solo por acción humana). Reemplaza los links de recovery de GoTrue, que los bots de previsualización quemaban en el primer GET.';
