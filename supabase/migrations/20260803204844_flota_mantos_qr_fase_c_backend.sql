-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260803204844  name: flota_mantos_qr_fase_c_backend


-- =============================================================================
-- FLOTA · Fase C — Backend del portal de talleres (identidad + lecturas + consumo)
-- El costo NUNCA se expone al taller (N25): el taller no tiene SELECT sobre
-- vehiculo_mantenimientos; lee sus citas por taller_mis_citas() (sin costo/moneda).
-- =============================================================================

-- 1. Identidad del taller en RLS (espejo de auth_proveedor_id).
--    El JWT del taller trae app_metadata.tipo='taller' + taller_id, SIN tenant_id
--    (igual que proveedores): asi ninguna politica interna del ERP lo deja pasar.
CREATE OR REPLACE FUNCTION public.auth_taller_id()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path TO 'public','pg_catalog'
AS $$
  SELECT CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'tipo') = 'taller'
    THEN (auth.jwt() -> 'app_metadata' ->> 'taller_id')::uuid
    ELSE NULL
  END;
$$;

-- 2. handle_new_user: las cuentas del portal de talleres tampoco crean profile
--    interno ni reciben tenant en app_metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_catalog'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_domain    TEXT;
BEGIN
  -- Cuentas de portales externos (proveedores / talleres): sin profile interno y
  -- SIN tenant en app_metadata.
  IF lower(split_part(COALESCE(NEW.email, ''), '@', 2)) IN
       ('proveedores.memphismaquinarias.com', 'talleres.memphismaquinarias.com')
     OR (NEW.raw_app_meta_data->>'tipo') IN ('proveedor', 'taller') THEN
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

-- 3. Lectura de citas del taller autenticado — SIN costo ni moneda (N25).
--    SECURITY DEFINER: no requiere SELECT del taller sobre las tablas base.
--    Filtra por auth_taller_id() (el taller solo ve SUS citas).
CREATE OR REPLACE FUNCTION public.taller_mis_citas()
RETURNS TABLE (
  id uuid,
  vehiculo_id uuid,
  codigo text,
  placa text,
  vin text,
  numero_padron text,
  flota_nombre text,
  public_token text,
  km_servicio integer,
  fecha_programada date,
  hora_cita time,
  estado text,
  km_odometro numeric,
  requiere_aprobacion boolean,
  confirmado_taller_en timestamptz,
  observaciones text,
  creado_en timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_catalog'
AS $$
  SELECT
    m.id,
    m.vehiculo_id,
    v.codigo::text,
    v.placa::text,
    v.vin::text,
    v.numero_padron::text,
    f.nombre::text,
    v.public_token::text,
    m.km_servicio,
    m.fecha_programada,
    m.hora_cita,
    m.estado::text,
    m.km_odometro,
    m.requiere_aprobacion,
    m.confirmado_taller_en,
    m.observaciones::text,
    m.creado_en
  FROM vehiculo_mantenimientos m
  JOIN vehiculos v ON v.id = m.vehiculo_id
  LEFT JOIN flotas f ON f.id = v.flota_id
  WHERE (SELECT auth_taller_id()) IS NOT NULL
    AND m.taller_id = (SELECT auth_taller_id())
  ORDER BY m.fecha_programada DESC NULLS LAST, m.creado_en DESC;
$$;

REVOKE ALL ON FUNCTION public.taller_mis_citas() FROM public;
GRANT EXECUTE ON FUNCTION public.taller_mis_citas() TO authenticated;

-- 4. Consumo del contrato: el cierre de Memphis (estado 'confirmado') tambien
--    cuenta contra el contrato, no solo el historico 'ejecutado'.
CREATE OR REPLACE VIEW public.v_vehiculo_consumo
WITH (security_invoker = true) AS
  SELECT
    v.id AS vehiculo_id,
    v.tenant_id,
    v.flota_id,
    f.proyecto_id,
    c.id AS contrato_id,
    c.moneda,
    c.cantidad_servicios AS servicios_contratados,
    c.costo_total_por_vehiculo AS provision_total,
    count(m.id) FILTER (WHERE m.estado = ANY (ARRAY['ejecutado','confirmado'])) AS servicios_ejecutados,
    COALESCE(sum(m.costo) FILTER (WHERE m.estado = ANY (ARRAY['ejecutado','confirmado'])), 0::numeric) AS gastado,
    (c.costo_total_por_vehiculo
      - COALESCE(sum(m.costo) FILTER (WHERE m.estado = ANY (ARRAY['ejecutado','confirmado'])), 0::numeric)
    ) AS saldo_provision
  FROM vehiculos v
    JOIN flotas f ON f.id = v.flota_id
    LEFT JOIN flota_contratos c ON c.flota_id = f.id AND c.estado = 'activo'
    LEFT JOIN vehiculo_mantenimientos m
      ON m.vehiculo_id = v.id AND (m.contrato_id = c.id OR m.contrato_id IS NULL)
  GROUP BY v.id, v.tenant_id, v.flota_id, f.proyecto_id, c.id, c.moneda,
           c.cantidad_servicios, c.costo_total_por_vehiculo;

