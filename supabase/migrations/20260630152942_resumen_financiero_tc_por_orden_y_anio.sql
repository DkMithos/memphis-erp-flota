-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260630152942  name: resumen_financiero_tc_por_orden_y_anio

DROP FUNCTION IF EXISTS proyectos_financiero_resumen(uuid);
CREATE FUNCTION public.proyectos_financiero_resumen(p_tenant uuid)
RETURNS TABLE(
  proyecto_id uuid, anio_convenio int,
  monto_contrato numeric, monto_adenda numeric, monto_contrato_total numeric,
  presupuesto numeric, moneda text,
  monto_cobrado numeric, monto_pendiente_cobro numeric,
  gasto_ocs numeric, gasto_caja numeric, gasto_fijos numeric, gasto_total numeric,
  total_ocs bigint, total_gastos_caja bigint,
  saldo_disponible numeric, utilidad numeric, margen numeric, pct_ejecutado numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT p.id,
      extract(year from p.fecha_firma_convenio)::int AS anio_conv,
      coalesce(p.monto_contrato,0) AS contrato,
      coalesce(p.monto_adenda,0)   AS adenda,
      p.presupuesto,
      coalesce(p.moneda,'PEN')     AS moneda,
      coalesce(p.monto_cobrado,0)  AS cobrado,
      coalesce((SELECT sum(CASE WHEN o.moneda='USD' THEN o.total*coalesce(o.tipo_cambio,3.40) ELSE o.total END)
                FROM ordenes_compra o
                WHERE o.proyecto_id=p.id
                  AND o.estado IN ('aprobada','en_ejecucion','completada','recibida')),0) AS gasto_ocs,
      coalesce((SELECT count(*) FROM ordenes_compra o
                WHERE o.proyecto_id=p.id
                  AND o.estado IN ('aprobada','en_ejecucion','completada','recibida')),0) AS n_ocs,
      coalesce((SELECT sum(CASE WHEN g.moneda='USD' THEN g.monto*3.40 ELSE g.monto END)
                FROM gastos_caja_chica g
                WHERE g.proyecto_id=p.id AND g.estado='aprobado'),0) AS gasto_caja,
      coalesce((SELECT count(*) FROM gastos_caja_chica g
                WHERE g.proyecto_id=p.id AND g.estado='aprobado'),0) AS n_caja,
      coalesce((SELECT sum(gf.monto) FROM gastos_fijos_proyecto gf WHERE gf.proyecto_id=p.id),0) AS gasto_fijos
    FROM proyectos p
    WHERE p.tenant_id = p_tenant
  )
  SELECT
    b.id, b.anio_conv,
    b.contrato, b.adenda, b.contrato + b.adenda,
    b.presupuesto, b.moneda,
    b.cobrado, (b.contrato + b.adenda) - b.cobrado,
    b.gasto_ocs, b.gasto_caja, b.gasto_fijos, (b.gasto_ocs + b.gasto_caja),
    b.n_ocs, b.n_caja,
    coalesce(b.presupuesto,0) - (b.gasto_ocs + b.gasto_caja),
    (b.contrato + b.adenda) - (b.gasto_ocs + b.gasto_caja),
    CASE WHEN (b.contrato + b.adenda) > 0
         THEN round((((b.contrato + b.adenda) - b.gasto_ocs - b.gasto_caja) / (b.contrato + b.adenda)) * 100, 2)
         ELSE 0 END,
    CASE WHEN coalesce(b.presupuesto,0) > 0
         THEN round(((b.gasto_ocs + b.gasto_caja) / b.presupuesto) * 100, 2)
         ELSE 0 END
  FROM base b;
$function$;

-- Gasto por año CALENDARIO (fecha real de OC / caja), para vista de flujo anual
CREATE OR REPLACE FUNCTION public.proyectos_gasto_por_anio(p_tenant uuid)
RETURNS TABLE(proyecto_id uuid, anio int, gasto_ocs numeric, gasto_caja numeric, gasto_total numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH oc AS (
    SELECT o.proyecto_id, extract(year from o.fecha_emision)::int AS anio,
           sum(CASE WHEN o.moneda='USD' THEN o.total*coalesce(o.tipo_cambio,3.40) ELSE o.total END) AS g
    FROM ordenes_compra o
    JOIN proyectos p ON p.id=o.proyecto_id AND p.tenant_id=p_tenant
    WHERE o.proyecto_id IS NOT NULL
      AND o.estado IN ('aprobada','en_ejecucion','completada','recibida')
      AND o.fecha_emision IS NOT NULL
    GROUP BY 1,2
  ), caja AS (
    SELECT g.proyecto_id, extract(year from g.fecha)::int AS anio,
           sum(CASE WHEN g.moneda='USD' THEN g.monto*3.40 ELSE g.monto END) AS g
    FROM gastos_caja_chica g
    JOIN proyectos p ON p.id=g.proyecto_id AND p.tenant_id=p_tenant
    WHERE g.proyecto_id IS NOT NULL AND g.estado='aprobado' AND g.fecha IS NOT NULL
    GROUP BY 1,2
  )
  SELECT coalesce(oc.proyecto_id, caja.proyecto_id),
         coalesce(oc.anio, caja.anio),
         coalesce(oc.g,0), coalesce(caja.g,0), coalesce(oc.g,0)+coalesce(caja.g,0)
  FROM oc FULL OUTER JOIN caja
    ON oc.proyecto_id=caja.proyecto_id AND oc.anio=caja.anio;
$function$;
