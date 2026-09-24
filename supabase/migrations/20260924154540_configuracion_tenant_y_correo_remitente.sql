-- Configuración general por empresa (texto), para lo que no es contable ni
-- financiero: hoy el buzón remitente de los correos del ERP.
create table if not exists public.configuracion_tenant (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  clave text not null,
  valor text not null,
  descripcion text,
  actualizado_en timestamptz default now(),
  primary key (tenant_id, clave)
);
alter table public.configuracion_tenant enable row level security;
drop policy if exists configuracion_tenant_select on public.configuracion_tenant;
create policy configuracion_tenant_select on public.configuracion_tenant for select to authenticated
  using (tenant_id in (select tenant_id from public.usuarios_tenant where user_id = auth.uid()));
grant select on public.configuracion_tenant to authenticated;

create or replace function public.fijar_configuracion(p_clave text, p_valor text) returns void
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not auth_tiene_permiso('admin', 'editar') then raise exception 'Sin permiso (admin.editar)'; end if;
  select tenant_id into v_tenant from usuarios_tenant where user_id = auth.uid() limit 1;
  insert into configuracion_tenant (tenant_id, clave, valor) values (v_tenant, p_clave, p_valor)
  on conflict (tenant_id, clave) do update set valor = excluded.valor, actualizado_en = now();
end $$;
grant execute on function public.fijar_configuracion(text, text) to authenticated;

insert into public.configuracion_tenant (tenant_id, clave, valor, descripcion) values
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'correo_remitente', 'kcastillo@memphis.pe',
   'Buzón de Microsoft 365 desde el que el ERP envía correos (enlaces del portal, avisos). Debe existir en el tenant de Microsoft.')
on conflict (tenant_id, clave) do nothing;
