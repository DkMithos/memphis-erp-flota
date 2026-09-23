-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904164437  name: storage_cargos_fianzas

-- Almacenamiento de los cargos de fianzas.
--
-- Shirley y Carolina pidieron que los cargos vivan en el sistema y se puedan
-- ver y descargar desde aquí, no solo enlazados a SharePoint.
--
-- Las rutas son `<tenant_id>/<fianza_id>/<archivo>`, así la primera carpeta
-- separa empresas y la política puede compararla contra el tenant de la sesión.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cargos-fianzas', 'cargos-fianzas', false, 20971520,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ¿El usuario actual tiene este permiso? Se usa en las políticas de storage,
-- donde no llega el RBAC del frontend.
-- Se envuelve la consulta en `exists` y se marca STABLE para que Postgres la
-- evalúe una vez por consulta y no una vez por fila.
create or replace function auth_tiene_permiso(p_modulo text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios_roles ur
    join roles_permisos rp on rp.rol_id = ur.rol_id
    join permisos p on p.id = rp.permiso_id
    where ur.user_id = auth.uid()
      and ur.tenant_id = auth_tenant_id()
      and p.modulo = p_modulo
      and p.accion = p_accion
  );
$$;

-- Ver y descargar: quien administra fianzas o quien solo lleva los cargos.
create policy "cargos_fianzas_leer" on storage.objects
  for select using (
    bucket_id = 'cargos-fianzas'
    and (storage.foldername(name))[1] = auth_tenant_id()::text
    and (auth_tiene_permiso('fianzas','cargos') or auth_tiene_permiso('fianzas','ver'))
  );

create policy "cargos_fianzas_subir" on storage.objects
  for insert with check (
    bucket_id = 'cargos-fianzas'
    and (storage.foldername(name))[1] = auth_tenant_id()::text
    and (auth_tiene_permiso('fianzas','cargos') or auth_tiene_permiso('fianzas','crear'))
  );

-- Borrar exige administrar fianzas: Lisbet sube y consulta, no elimina.
create policy "cargos_fianzas_borrar" on storage.objects
  for delete using (
    bucket_id = 'cargos-fianzas'
    and (storage.foldername(name))[1] = auth_tenant_id()::text
    and auth_tiene_permiso('fianzas','eliminar')
  );

-- El cargo puede llevar tamaño y tipo para mostrarlos sin pedir el archivo.
alter table fianza_cargos add column if not exists tamano_bytes bigint;
alter table fianza_cargos add column if not exists mime text;
