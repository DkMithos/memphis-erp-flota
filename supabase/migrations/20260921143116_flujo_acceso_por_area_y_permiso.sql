-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260921143116  name: flujo_acceso_por_area_y_permiso

-- 1. Renombrar el área CONTA → CONTABILIDAD (nombre correcto).
update public.flujo_compromisos set area = 'CONTABILIDAD' where area = 'CONTA';

-- 2. Permiso propio del flujo financiero: así Proyectos (Miguelangel) entra a
--    ESTA pantalla sin que le abramos todo Finanzas.
insert into public.permisos (id, modulo, accion, descripcion)
values (gen_random_uuid(), 'finanzas', 'flujo', 'Ver el flujo financiero (limitado a su área)')
on conflict do nothing;

-- Otorgarlo a los roles de las áreas. Administrador ya lo tiene todo por código.
insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
cross join public.permisos p
where p.modulo='finanzas' and p.accion='flujo'
  and r.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13'
  and r.nombre in ('Contabilidad','Administración','Proyectos')
on conflict do nothing;

-- 3. Quién ve TODAS las áreas, además de los Administradores: Carolina.
create table if not exists public.flujo_ve_todo (
  user_id uuid primary key,
  nota text,
  creado_en timestamptz not null default now()
);
insert into public.flujo_ve_todo (user_id, nota)
values ('8b9e2da7-bed1-40cf-b7d2-41a9a045968f', 'Carolina Okamura — ve todas las áreas del flujo')
on conflict (user_id) do nothing;
alter table public.flujo_ve_todo enable row level security;
drop policy if exists flujo_ve_todo_sel on public.flujo_ve_todo;
create policy flujo_ve_todo_sel on public.flujo_ve_todo for select using (true);

-- 4. ¿El usuario actual ve todas las áreas? (Administrador o en la lista.)
create or replace function public.flujo_ve_todo_actual()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
      select 1 from usuarios_roles ur join roles r on r.id = ur.rol_id
      where ur.user_id = auth.uid() and r.nombre = 'Administrador'
    ) or exists (
      select 1 from flujo_ve_todo v where v.user_id = auth.uid()
    );
$$;

-- 5. ¿Puede el usuario actual ver ESTA área? Ve-todo, o tiene el rol del área.
create or replace function public.flujo_puede_ver(p_area text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.flujo_ve_todo_actual()
    or exists (
      select 1 from usuarios_roles ur join roles r on r.id = ur.rol_id
      where ur.user_id = auth.uid()
        and r.nombre = case upper(p_area)
          when 'CONTABILIDAD' then 'Contabilidad'
          when 'ADMINISTRACION' then 'Administración'
          when 'PROYECTOS' then 'Proyectos'
          else null end
    );
$$;

grant execute on function public.flujo_ve_todo_actual() to authenticated, anon;
grant execute on function public.flujo_puede_ver(text) to authenticated, anon;

-- 6. RLS de flujo_compromisos: lectura por área; escritura solo ve-todo.
--    (La importación entra por service role y salta RLS, así que sigue igual.)
drop policy if exists flujo_comp_rw on public.flujo_compromisos;
drop policy if exists flujo_comp_sel on public.flujo_compromisos;
drop policy if exists flujo_comp_wr on public.flujo_compromisos;
create policy flujo_comp_sel on public.flujo_compromisos
  for select using (tenant_id = auth_tenant_id() and public.flujo_puede_ver(area));
create policy flujo_comp_wr on public.flujo_compromisos
  for all using (tenant_id = auth_tenant_id() and public.flujo_ve_todo_actual())
  with check (tenant_id = auth_tenant_id() and public.flujo_ve_todo_actual());
