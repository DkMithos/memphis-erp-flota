-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903221148  name: accesos_fianzas_y_lisbet

-- Accesos del módulo de Fianzas (decisión de Kevin, 03/09):
--   Carolina Okamura y Shirley Bujaico  → módulo completo
--   Lisbet Monteza                      → SOLO los cargos
--   Administrador                       → todo, por ser administradores

-- 1) Administración (Carolina, Shirley) y Administrador: fianzas completo.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r
join permisos p on p.modulo = 'fianzas'
where r.nombre in ('Administración', 'Administrador')
on conflict do nothing;

-- Gerencia ve y exporta, como en el resto de módulos.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r
join permisos p on p.modulo = 'fianzas' and p.accion in ('ver','exportar')
where r.nombre = 'Gerencia'
on conflict do nothing;

-- 2) Rol nuevo, solo para los cargos.
insert into roles (tenant_id, nombre, descripcion)
select t.id, 'Cargos Fianzas', 'Solo ve y sube los cargos de fianzas. No accede a montos ni al tablero.'
from tenants t
where not exists (
  select 1 from roles r where r.tenant_id = t.id and r.nombre = 'Cargos Fianzas'
);

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r
join permisos p on p.modulo = 'fianzas' and p.accion = 'cargos'
where r.nombre = 'Cargos Fianzas'
on conflict do nothing;

-- 3) Alta de Lisbet Monteza. Entra con Microsoft como el resto del equipo.
do $$
declare
  v_tenant uuid := 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
  v_rol    uuid;
  v_user   uuid;
  v_email  text := 'lmonteza@memphis.pe';
begin
  select id into v_rol from roles where nombre = 'Cargos Fianzas' and tenant_id = v_tenant;
  select id into v_user from auth.users where email = v_email;

  if v_user is null then
    v_user := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email'),
                         'tenant_id', v_tenant::text),
      jsonb_build_object('nombre','Lisbet Monteza'),
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider, provider_id, identity_data,
                                 last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user, 'email', v_user::text,
            jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', false),
            null, now(), now());
  end if;

  insert into usuarios_tenant (tenant_id, user_id, nombre, email, cargo, estado)
  values (v_tenant, v_user, 'Lisbet Monteza', v_email, 'Cargos de fianzas', 'activo')
  on conflict do nothing;

  insert into profiles (id, tenant_id, nombre, email, rol, estado)
  values (v_user, v_tenant, 'Lisbet Monteza', v_email, 'operaciones', 'activo')
  on conflict (id) do nothing;

  insert into usuarios_roles (tenant_id, user_id, rol_id)
  values (v_tenant, v_user, v_rol)
  on conflict do nothing;
end $$;
