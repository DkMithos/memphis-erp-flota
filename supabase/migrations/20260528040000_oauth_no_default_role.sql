-- ===========================================================================
-- GATE DE ACCESO: usuarios nuevos (incl. OAuth) se crean SIN rol por defecto.
-- El acceso se habilita solo cuando un admin les asigna un rol RBAC
-- (usuarios_roles). El frontend muestra "cuenta pendiente" si no hay rol.
--
-- Único cambio vs 20260528030000: rol legacy por defecto 'sin_rol' (antes 'operador').
-- ===========================================================================

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
