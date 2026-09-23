-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260804194846  name: flota_qr_publico_fase_e


-- =============================================================================
-- FLOTA · Fase E — QR público seguro por token
-- Reemplaza el SELECT anon abierto (que permitía ENUMERAR vehículos y filtraba
-- cliente/contrato/documentos) por un RPC que, dado el token exacto, devuelve
-- SOLO datos no sensibles + cumplimiento + último mantenimiento.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.vehiculo_public_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_catalog'
AS $$
DECLARE
  v_uuid uuid;
  v record;
  v_ejecutados int;
  v_contratados int;
  v_ultimo record;
  v_docs jsonb;
BEGIN
  -- token inválido → no revela nada
  BEGIN
    v_uuid := p_token::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  SELECT id, placa, tipo, marca, modelo, anio, color, estado, kilometraje,
         flota_id, public_view_enabled
    INTO v
    FROM vehiculos
   WHERE public_token = v_uuid
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;                       -- no existe
  END IF;
  IF v.public_view_enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('publico', false);  -- deshabilitado
  END IF;

  -- Cumplimiento: servicios realizados vs contratados (modelo de flota)
  SELECT count(*) INTO v_ejecutados
    FROM vehiculo_mantenimientos m
   WHERE m.vehiculo_id = v.id AND m.estado IN ('ejecutado','confirmado');

  SELECT c.cantidad_servicios INTO v_contratados
    FROM flota_contratos c
   WHERE c.flota_id = v.flota_id AND c.estado = 'activo'
   LIMIT 1;

  -- Último mantenimiento realizado (fecha + km del odómetro)
  SELECT m.fecha_ejecucion, m.km_odometro, m.km_servicio INTO v_ultimo
    FROM vehiculo_mantenimientos m
   WHERE m.vehiculo_id = v.id
     AND m.estado IN ('ejecutado','confirmado')
     AND m.fecha_ejecucion IS NOT NULL
   ORDER BY m.fecha_ejecucion DESC, m.creado_en DESC
   LIMIT 1;

  -- Documentos: solo tipo + estado (SIN números ni datos sensibles)
  SELECT jsonb_agg(jsonb_build_object(
           'tipo', d.tipo,
           'estado', CASE
             WHEN d.fecha_vencimiento < CURRENT_DATE THEN 'vencido'
             WHEN d.fecha_vencimiento <= CURRENT_DATE + 30 THEN 'proximo'
             ELSE 'vigente' END))
    INTO v_docs
    FROM vehiculo_documentos d
   WHERE d.vehiculo_id = v.id;

  RETURN jsonb_build_object(
    'publico', true,
    'placa', v.placa,
    'tipo', v.tipo,
    'marca', v.marca,
    'modelo', v.modelo,
    'anio', v.anio,
    'color', v.color,
    'estado', v.estado,
    'kilometraje', v.kilometraje,
    'en_flota', v.flota_id IS NOT NULL,
    'servicios_ejecutados', COALESCE(v_ejecutados, 0),
    'servicios_contratados', v_contratados,
    'cumplimiento_pct', CASE WHEN COALESCE(v_contratados,0) > 0
      THEN LEAST(100, round(v_ejecutados::numeric / v_contratados * 100))::int ELSE NULL END,
    'ultimo_mantenimiento', CASE WHEN v_ultimo.fecha_ejecucion IS NOT NULL
      THEN jsonb_build_object('fecha', v_ultimo.fecha_ejecucion, 'km', v_ultimo.km_odometro, 'servicio_km', v_ultimo.km_servicio)
      ELSE NULL END,
    'documentos', COALESCE(v_docs, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vehiculo_public_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.vehiculo_public_by_token(text) TO anon, authenticated;

-- Cerrar la enumeración: quitar el SELECT anon abierto sobre vehiculos.
-- El acceso público ahora es SOLO por el RPC anterior (token exacto, campos no sensibles).
DROP POLICY IF EXISTS "vehiculos: public_token acceso sin auth" ON public.vehiculos;

