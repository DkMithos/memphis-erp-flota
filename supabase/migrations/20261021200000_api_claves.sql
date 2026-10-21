-- 2026-10-21 · API Memphis v1: claves por integración y bitácora de accesos.
-- La API vive en la Edge Function `api` (/functions/v1/api/v1/…); cada sistema externo (Power BI, dashboard de TI,
-- Microsoft 365, un proveedor) recibe su propia clave `mm_live_…` con alcances por módulo (lectura / escritura).
-- Solo se guarda el hash SHA-256 de la clave: el ERP la muestra una sola vez al crearla.

create table if not exists public.api_claves (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  prefijo       text not null,                 -- primeros caracteres visibles (mm_live_ab12…)
  clave_hash    text not null unique,          -- sha256 hex
  alcances      text[] not null default '{}',  -- 'proyectos:leer', 'compras:leer', 'proyectos:escribir', '*:leer'
  activa        boolean not null default true,
  expira_en     timestamptz,
  ultimo_uso_en timestamptz,
  usos          bigint not null default 0,
  creado_por    uuid,
  creado_en     timestamptz not null default now(),
  revocada_en   timestamptz,
  revocada_por  uuid
);
create index if not exists api_claves_tenant_idx on public.api_claves(tenant_id, activa);

create table if not exists public.api_accesos (
  id          bigserial primary key,
  tenant_id   uuid,
  clave_id    uuid references public.api_claves(id) on delete cascade,
  metodo      text not null,
  ruta        text not null,
  estado      int not null,
  ip          text,
  duracion_ms int,
  creado_en   timestamptz not null default now()
);
create index if not exists api_accesos_clave_idx on public.api_accesos(clave_id, creado_en desc);
create index if not exists api_accesos_tenant_idx on public.api_accesos(tenant_id, creado_en desc);

-- Crear clave: devuelve la clave en claro UNA vez. Exige admin.gestionar_usuarios.
create or replace function public.api_clave_crear(p_nombre text, p_descripcion text default null, p_alcances text[] default '{}', p_expira timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_clave text; v_id uuid; v_prefijo text;
begin
  if not auth_tiene_permiso('admin', 'gestionar_usuarios') then raise exception 'Sin permiso (admin.gestionar_usuarios)'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Indique el nombre de la integración'; end if;
  if coalesce(array_length(p_alcances, 1), 0) = 0 then raise exception 'Indique al menos un alcance'; end if;
  v_clave := 'mm_live_' || translate(encode(gen_random_bytes(33), 'base64'), '+/=', 'QzX');
  v_prefijo := left(v_clave, 14) || '…';
  insert into api_claves (tenant_id, nombre, descripcion, prefijo, clave_hash, alcances, expira_en, creado_por)
  values (auth_tenant_id(), trim(p_nombre), nullif(trim(p_descripcion), ''), v_prefijo, encode(digest(v_clave, 'sha256'), 'hex'), p_alcances, p_expira, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'clave', v_clave, 'prefijo', v_prefijo);
end $$;
revoke all on function public.api_clave_crear(text, text, text[], timestamptz) from public, anon;
grant execute on function public.api_clave_crear(text, text, text[], timestamptz) to authenticated;

create or replace function public.api_clave_revocar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_tiene_permiso('admin', 'gestionar_usuarios') then raise exception 'Sin permiso (admin.gestionar_usuarios)'; end if;
  update api_claves set activa = false, revocada_en = now(), revocada_por = auth.uid() where id = p_id and tenant_id = auth_tenant_id() and activa;
  if not found then raise exception 'Clave no encontrada o ya revocada'; end if;
end $$;
revoke all on function public.api_clave_revocar(uuid) from public, anon;
grant execute on function public.api_clave_revocar(uuid) to authenticated;

-- La Edge Function anota el uso (con la clave secreta de Supabase).
create or replace function public.api_clave_tocar(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update api_claves set ultimo_uso_en = now(), usos = usos + 1 where id = p_id;
$$;
revoke all on function public.api_clave_tocar(uuid) from public, anon, authenticated;
grant execute on function public.api_clave_tocar(uuid) to service_role;

-- Solo lectura desde el ERP (la Edge Function escribe con la clave secreta). La clave en claro nunca está en la tabla.
alter table public.api_claves enable row level security;
alter table public.api_accesos enable row level security;
drop policy if exists api_claves_leer on public.api_claves;
create policy api_claves_leer on public.api_claves for select to authenticated using (tenant_id = auth_tenant_id() and auth_tiene_permiso('admin', 'gestionar_usuarios'));
drop policy if exists api_accesos_leer on public.api_accesos;
create policy api_accesos_leer on public.api_accesos for select to authenticated using (tenant_id = auth_tenant_id() and auth_tiene_permiso('admin', 'gestionar_usuarios'));
grant select on public.api_claves, public.api_accesos to authenticated;
grant all on public.api_claves, public.api_accesos to service_role;
grant usage, select on sequence public.api_accesos_id_seq to service_role;

comment on table public.api_claves is 'Claves de la API Memphis v1 (Edge Function api). Solo el hash; alcances por módulo.';
comment on table public.api_accesos is 'Bitácora de cada llamada a la API (clave, ruta, estado, duración) — sirve para el tope por minuto.';
