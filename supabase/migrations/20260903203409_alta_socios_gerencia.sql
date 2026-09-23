-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903203409  name: alta_socios_gerencia

-- Alta de los dos socios de Memphis con rol Gerencia.
--
-- Guillermo Macher ya aparece firmando órdenes en el legado (etapa
-- gerenciaGeneral), así que su correo queda enlazado a esas aprobaciones.
--
-- Entran con Microsoft, como el resto del equipo: se les pone una contraseña
-- aleatoria que nadie conoce ni necesita. Al primer login con Microsoft,
-- Supabase enlaza la identidad azure a esta cuenta por el correo, igual que
-- pasó con kcastillo.
--
-- Los campos de token van en '' y no en null: si quedan nulos, GoTrue falla
-- con "Database error querying schema" al intentar iniciar sesión.

do $$
declare
  v_tenant  uuid := 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
  v_rol     uuid;
  v_user    uuid;
  v_email   text;
  v_nombre  text;
  v_cargo   text;
  r record;
begin
  select id into v_rol from roles where nombre = 'Gerencia' and tenant_id = v_tenant;
  if v_rol is null then
    raise exception 'No existe el rol Gerencia en el tenant';
  end if;

  for r in
    select * from (values
      ('gmacher@memphis.pe',  'Guillermo Macher', 'Socio / Gerencia General'),
      ('mzegarra@memphis.pe', 'Miguel Zegarra',   'Socio / Gerencia')
    ) as t(email, nombre, cargo)
  loop
    v_email := r.email; v_nombre := r.nombre; v_cargo := r.cargo;

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
        v_email, crypt(gen_random_uuid()::text, gen_salt('bf')),
        now(),
        jsonb_build_object('provider','email','providers',jsonb_build_array('email'),
                           'tenant_id', v_tenant::text),
        jsonb_build_object('nombre', v_nombre),
        now(), now(),
        '', '', '', '', '', '', '', ''
      );

      insert into auth.identities (id, user_id, provider, provider_id, identity_data,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_user, 'email', v_user::text,
              jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', false),
              null, now(), now());
    end if;

    insert into usuarios_tenant (tenant_id, user_id, nombre, email, cargo, estado)
    values (v_tenant, v_user, v_nombre, v_email, v_cargo, 'activo')
    on conflict do nothing;

    insert into profiles (id, tenant_id, nombre, email, rol, estado)
    values (v_user, v_tenant, v_nombre, v_email, 'gerencia', 'activo')
    on conflict (id) do nothing;

    insert into usuarios_roles (tenant_id, user_id, rol_id)
    values (v_tenant, v_user, v_rol)
    on conflict do nothing;
  end loop;
end $$;
