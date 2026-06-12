-- ===========================================================================
-- FIX: signups OAuth (Microsoft Entra ID) fallaban con
--   "null value in column tenant_id of relation profiles"
--
-- Causa: handle_new_user() leía tenant_id SOLO de user_metadata, presente en
-- altas por contraseña (admin) pero ausente en logins OAuth → tenant_id NULL.
--
-- Solución: derivar el tenant por el DOMINIO del email cuando no viene en
-- metadata. Mapeo data-driven vía tenant_email_domains.
-- ===========================================================================

-- 1. Mapeo dominio de email → tenant
CREATE TABLE IF NOT EXISTS tenant_email_domains (
  dominio   TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: memphis.pe → Memphis Maquinarias
INSERT INTO tenant_email_domains (dominio, tenant_id)
VALUES ('memphis.pe', 'e4b16a80-8500-418e-afaa-0e976b7d9b13')
ON CONFLICT (dominio) DO NOTHING;

-- 2. Trigger con fallback por dominio para signups OAuth
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
  -- 1) Preferir tenant_id de user_metadata (alta vía admin/contraseña)
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;

  -- 2) Fallback OAuth: derivar tenant por dominio del email
  IF v_tenant_id IS NULL AND NEW.email IS NOT NULL THEN
    v_domain := lower(split_part(NEW.email, '@', 2));
    SELECT tenant_id INTO v_tenant_id
    FROM tenant_email_domains
    WHERE dominio = v_domain;
  END IF;

  -- 3) Sin tenant determinable → denegar con mensaje claro (evita 500 críptico)
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el tenant para % (dominio no mapeado en tenant_email_domains)', NEW.email;
  END IF;

  -- Crear profile
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
    COALESCE(NEW.raw_user_meta_data->>'rol', 'operador')
  );

  -- Sincronizar app_metadata.tenant_id para que auth_tenant_id() funcione en RLS
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data ||
    jsonb_build_object('tenant_id', v_tenant_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
