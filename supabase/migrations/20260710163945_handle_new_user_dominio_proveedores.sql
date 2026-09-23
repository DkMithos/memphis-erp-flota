-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260710163945  name: handle_new_user_dominio_proveedores

-- GoTrue admin.createUser inserta el usuario ANTES de aplicar el app_metadata
-- custom, así que el trigger no puede ver tipo='proveedor' en el INSERT.
-- Detección robusta: el dominio del alias (@proveedores.memphismaquinarias.com)
-- está reservado para cuentas del portal (N21). Se mantiene también el chequeo
-- por app_metadata como respaldo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_domain    TEXT;
BEGIN
  -- Cuentas del portal de proveedores: sin profile interno y SIN tenant en app_metadata
  IF lower(split_part(COALESCE(NEW.email, ''), '@', 2)) = 'proveedores.memphismaquinarias.com'
     OR (NEW.raw_app_meta_data->>'tipo') = 'proveedor' THEN
    RETURN NEW;
  END IF;

  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;

  IF v_tenant_id IS NULL AND NEW.email IS NOT NULL THEN
    v_domain := lower(split_part(NEW.email, '@', 2));
    SELECT tenant_id INTO v_tenant_id
    FROM tenant_email_domains
    WHERE dominio = v_domain;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el tenant para % (dominio no mapeado en tenant_email_domains)', NEW.email;
  END IF;

  INSERT INTO profiles (id, tenant_id, nombre, apellido, email, rol)
  VALUES (
    NEW.id,
    v_tenant_id,
    COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'apellido',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'sin_rol')
  );

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data ||
    jsonb_build_object('tenant_id', v_tenant_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
