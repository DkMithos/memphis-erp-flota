-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260626170340  name: fn_proyectos_financiero_resumen

-- Resumen financiero de TODOS los proyectos en una sola consulta (evita el N+1 del dashboard).
-- Convierte USD->PEN a 3.75. Gasto operativo = OCs aprobadas + Caja Chica aprobada (excluye anuladas).
CREATE OR REPLACE FUNCTION proyectos_financiero_resumen(p_tenant uuid)
RETURNS TABLE (
  proyecto_id uuid,
  monto_contrato numeric,
  monto_adenda numeric,
  monto_contrato_total numeric,
  presupuesto numeric,
  moneda text,
  gasto_ocs numeric,
  gasto_caja numeric,
  gasto_fijos numeric,
  gasto_total numeric,
  total_ocs bigint,
  total_gastos_caja bigint,
  saldo_disponible numeric,
  utilidad numeric,
  margen numeric,
  pct_ejecutado numeric
) LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      p.id,
      coalesce(p.monto_contrato,0) AS contrato,
      coalesce(p.monto_adenda,0)   AS adenda,
      p.presupuesto,
      coalesce(p.moneda,'PEN')     AS moneda,
      coalesce((SELECT sum(CASE WHEN o.moneda='USD' THEN o.total*3.75 ELSE o.total END)
                FROM ordenes_compra o
                WHERE o.proyecto_id=p.id
                  AND o.estado IN ('aprobada','en_ejecucion','completada','recibida')),0) AS gasto_ocs,
      coalesce((SELECT count(*) FROM ordenes_compra o
                WHERE o.proyecto_id=p.id
                  AND o.estado IN ('aprobada','en_ejecucion','completada','recibida')),0) AS n_ocs,
      coalesce((SELECT sum(CASE WHEN g.moneda='USD' THEN g.monto*3.75 ELSE g.monto END)
                FROM gastos_caja_chica g
                WHERE g.proyecto_id=p.id AND g.estado='aprobado'),0) AS gasto_caja,
      coalesce((SELECT count(*) FROM gastos_caja_chica g
                WHERE g.proyecto_id=p.id AND g.estado='aprobado'),0) AS n_caja,
      coalesce((SELECT sum(gf.monto) FROM gastos_fijos_proyecto gf WHERE gf.proyecto_id=p.id),0) AS gasto_fijos
    FROM proyectos p
    WHERE p.tenant_id = p_tenant
  )
  SELECT
    b.id,
    b.contrato,
    b.adenda,
    b.contrato + b.adenda                                   AS contrato_total,
    b.presupuesto,
    b.moneda,
    b.gasto_ocs,
    b.gasto_caja,
    b.gasto_fijos,
    (b.gasto_ocs + b.gasto_caja)                            AS gasto_total,
    b.n_ocs,
    b.n_caja,
    coalesce(b.presupuesto,0) - (b.gasto_ocs + b.gasto_caja) AS saldo,
    (b.contrato + b.adenda) - (b.gasto_ocs + b.gasto_caja)   AS utilidad,
    CASE WHEN (b.contrato + b.adenda) > 0
         THEN round(((b.contrato + b.adenda - b.gasto_ocs - b.gasto_caja) / (b.contrato + b.adenda)) * 100, 2)
         ELSE 0 END                                          AS margen,
    CASE WHEN coalesce(b.presupuesto,0) > 0
         THEN round(((b.gasto_ocs + b.gasto_caja) / b.presupuesto) * 100, 2)
         ELSE 0 END                                          AS pct_ejecutado
  FROM base b;
$$;
