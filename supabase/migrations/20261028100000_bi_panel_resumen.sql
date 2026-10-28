-- 2026-10-28 · BI & Reportería: el panel decía "lo que todavía no se puede reportar: deuda con proveedores, ingresos por
-- proyecto, contabilidad…", pero desde octubre el ERP tiene facturas (SIRE 2024-2026), cuentas por pagar y cobrar, pagos y
-- extracto bancario, valorizaciones cobradas, plan de cuentas, periodos y TC SUNAT diario. Esta función entrega en UNA
-- llamada los agregados del tenant para las tarjetas nuevas y para calcular, con datos, qué sigue pendiente.
create or replace function public.bi_panel_resumen() returns jsonb
language sql stable security definer set search_path = public as $$
  with t as (select auth_tenant_id() as id),
  anio as (select date_trunc('year', current_date)::date as desde)
  select jsonb_build_object(
    'facturas', (select jsonb_build_object(
        'recibidas', count(*),
        'por_conformar', count(*) filter (where coalesce(estado_flujo, 'recibida') in ('recibida', 'validada')),
        'conformes', count(*) filter (where estado_flujo = 'conforme'),
        'observadas', count(*) filter (where estado_flujo = 'observada'),
        'ultima_emision', max(fecha_emision))
      from comprobantes_pago, t where tenant_id = t.id and direccion = 'recibido'),
    'cxp', (select jsonb_build_object(
        'compromisos', count(*) filter (where estado_pago <> 'PAGADO'),
        'pendiente_pen', coalesce(round(sum(monto_pendiente) filter (where moneda = 'PEN' and estado_pago <> 'PAGADO'), 2), 0),
        'pendiente_usd', coalesce(round(sum(monto_pendiente) filter (where moneda = 'USD' and estado_pago <> 'PAGADO'), 2), 0),
        'vencido_pen', coalesce(round(sum(monto_pendiente) filter (where vencido and moneda = 'PEN' and estado_pago <> 'PAGADO'), 2), 0),
        'vencido_usd', coalesce(round(sum(monto_pendiente) filter (where vencido and moneda = 'USD' and estado_pago <> 'PAGADO'), 2), 0),
        'vencidos', count(*) filter (where vencido and estado_pago <> 'PAGADO'))
      from v_cxp, t where tenant_id = t.id),
    'cxc', (select jsonb_build_object(
        'pendientes', count(*) filter (where estado_pago <> 'PAGADO'),
        'pendiente_pen', coalesce(round(sum(monto_pendiente) filter (where moneda = 'PEN' and estado_pago <> 'PAGADO'), 2), 0),
        'pendiente_usd', coalesce(round(sum(monto_pendiente) filter (where moneda = 'USD' and estado_pago <> 'PAGADO'), 2), 0))
      from v_cxc, t where tenant_id = t.id),
    'tesoreria', (select jsonb_build_object(
        'pagos_anio', count(*) filter (where tipo = 'egreso'),
        'pagado_pen', coalesce(round(sum(monto) filter (where tipo = 'egreso' and moneda = 'PEN'), 2), 0),
        'pagado_usd', coalesce(round(sum(monto) filter (where tipo = 'egreso' and moneda = 'USD'), 2), 0),
        'cobrado_pen', coalesce(round(sum(monto) filter (where tipo = 'ingreso' and moneda = 'PEN'), 2), 0),
        'cobrado_usd', coalesce(round(sum(monto) filter (where tipo = 'ingreso' and moneda = 'USD'), 2), 0))
      from transacciones, t, anio where tenant_id = t.id and estado = 'pagada' and coalesce(fecha_pago, fecha) >= anio.desde),
    'bancos', (select jsonb_build_object(
        'movimientos', count(*),
        'sin_conciliar', count(*) filter (where transaccion_id is null),
        'extracto_hasta', max(fecha_operacion),
        'cuentas_activas', (select count(*) from cuentas_bancarias c, t where c.tenant_id = t.id and c.activa),
        'lotes_pago', (select count(*) from lotes_pago l, t where l.tenant_id = t.id))
      from movimientos_bancarios, t where tenant_id = t.id),
    'proyectos', (select jsonb_build_object(
        'con_contrato', count(*) filter (where coalesce(monto_contrato, 0) > 0),
        'contrato_total', coalesce(round(sum(monto_contrato), 2), 0),
        'cobrado_total', coalesce(round(sum(monto_cobrado), 2), 0),
        'valorizaciones_cobradas', (select count(*) from valorizaciones v, t where v.tenant_id = t.id and v.estado = 'pagada'),
        'valorizaciones_por_cobrar', (select count(*) from valorizaciones v, t where v.tenant_id = t.id and v.estado <> 'pagada'),
        'valorizado_cobrado_pen', (select coalesce(round(sum(monto), 2), 0) from valorizaciones v, t where v.tenant_id = t.id and v.estado = 'pagada' and coalesce(moneda, 'PEN') = 'PEN'),
        'sin_presupuesto', count(*) filter (where coalesce(presupuesto, 0) = 0 and estado = 'en_ejecucion'))
      from proyectos, t where tenant_id = t.id and estado in ('en_ejecucion', 'completado', 'liquidacion')),
    'contabilidad', (select jsonb_build_object(
        'plan_cuentas', (select count(*) from plan_cuentas p, t where p.tenant_id = t.id),
        'periodos_abiertos', (select count(*) from periodos_contables p, t where p.tenant_id = t.id and p.estado = 'abierto'),
        'asientos', (select count(*) from asientos_contables a, t where a.tenant_id = t.id and a.estado <> 'anulado'),
        'tc_fecha', (select max(fecha) from tipos_cambio),
        'facturas_sin_contabilizar', (select count(*) from comprobantes_pago c, t where c.tenant_id = t.id and c.direccion = 'recibido' and c.asiento_id is null and c.estado_flujo in ('conforme', 'programada_pago', 'pagada') and c.fecha_emision >= '2026-01-01'))),
    'operaciones', (select jsonb_build_object(
        'viajes_abiertos', (select count(*) from viajes v, t where v.tenant_id = t.id and v.estado in ('solicitado', 'aprobado_jefatura', 'aprobado', 'en_curso', 'rendido')),
        'rendiciones_por_revisar', (select count(*) from viaje_rendiciones r, t where r.tenant_id = t.id and r.estado in ('presentada', 'revisada')),
        'cartas_pendientes', (select count(*) from correspondencia c, t where c.tenant_id = t.id and c.estado = 'pendiente'),
        'cartas_vencidas', (select count(*) from correspondencia c, t where c.tenant_id = t.id and c.estado = 'pendiente' and c.fecha_limite < current_date),
        'unidades', (select count(*) from inventario_unidades u, t where u.tenant_id = t.id),
        'unidades_en_almacen', (select count(*) from inventario_unidades u, t where u.tenant_id = t.id and u.estado = 'en_almacen'),
        'unidades_instaladas', (select count(*) from inventario_unidades u, t where u.tenant_id = t.id and u.estado in ('instalada', 'entregada')),
        'obligaciones', (select count(*) from obligaciones_financieras o, t where o.tenant_id = t.id and o.estado <> 'cancelada'),
        'presupuesto_area_lineas', (select count(*) from presupuesto_lineas p, t where p.tenant_id = t.id and p.proyecto_id is null),
        'equipos_biomedicos', (select count(*) from equipos_biomedicos e, t where e.tenant_id = t.id),
        'oportunidades_crm', (select count(*) from oportunidades o, t where o.tenant_id = t.id)))
  );
$$;
revoke all on function public.bi_panel_resumen() from public, anon;
grant execute on function public.bi_panel_resumen() to authenticated, service_role;
