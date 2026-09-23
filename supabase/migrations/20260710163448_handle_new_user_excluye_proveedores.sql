-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260710163448  name: handle_new_user_excluye_proveedores

-- Portal proveedores: las cuentas con app_metadata.tipo='proveedor' NO son personal
-- interno → no llevan profile ni tenant_id en app_metadata (el aislamiento del portal
-- depende de que auth_tenant_id() sea NULL para ellas).
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
  IF (NEW.raw_app_meta_data->>'tipo') = 'proveedor' THEN
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
