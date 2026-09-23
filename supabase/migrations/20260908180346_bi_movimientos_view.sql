-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260908180346  name: bi_movimientos_view

-- Movimientos con plata y con dimensión, en un solo sitio.
--
-- El reporte cruzado consultaba columnas que no existen (proyecto_id en
-- ordenes_trabajo, centro_costo_id en gastos, fecha_solicitud en
-- requerimientos), así que devolvía cero filas sin decir nada. Y dejaba fuera
-- las órdenes de compra, que son el gasto real de la empresa.
--
-- Reglas, las mismas que ya usa el tablero de Gerencia:
--   · las órdenes anuladas y rechazadas no son compromiso;
--   · nada se convierte de moneda: PEN y USD viajan separados hasta que exista
--     la tabla de tipos de cambio por fecha.
create or replace view v_bi_movimientos
with (security_invoker = true) as
  select
    o.tenant_id,
    'orden_compra'::text                         as fuente,
    'egreso'::text                               as flujo,
    o.id,
    o.numero,
    o.fecha_emision                              as fecha,
    to_char(o.fecha_emision, 'YYYY-MM')          as mes,
    o.estado,
    o.moneda,
    o.total                                      as monto,
    o.proyecto_id,
    p.nombre                                     as proyecto,
    o.centro_costo_id,
    coalesce(cc.nombre, o.centro_costo_texto)    as centro_costo,
    prov.razon_social                            as contraparte,
    coalesce(nullif(o.observaciones, ''), o.tipo) as descripcion
  from ordenes_compra o
  left join proyectos     p    on p.id    = o.proyecto_id
  left join centros_costo cc   on cc.id   = o.centro_costo_id
  left join proveedores   prov on prov.id = o.proveedor_id
  where o.estado not in ('anulada', 'rechazada')
    and o.fecha_emision is not null

  union all

  select
    g.tenant_id,
    'gasto_caja'::text,
    'egreso'::text,
    g.id,
    g.numero,
    g.fecha,
    to_char(g.fecha, 'YYYY-MM'),
    g.estado,
    g.moneda,
    g.monto,
    g.proyecto_id,
    p.nombre,
    null::uuid,
    g.centro_costo,
    g.beneficiario,
    g.descripcion
  from gastos_caja_chica g
  left join proyectos p on p.id = g.proyecto_id
  where g.estado <> 'rechazado'
    and g.fecha is not null

  union all

  select
    i.tenant_id,
    'ingreso_caja'::text,
    'ingreso'::text,
    i.id,
    i.numero,
    i.fecha,
    to_char(i.fecha, 'YYYY-MM'),
    i.estado,
    i.moneda,
    i.monto,
    null::uuid,
    null::text,
    null::uuid,
    i.centro_costo,
    i.origen,
    i.descripcion
  from ingresos_caja_chica i
  where i.fecha is not null;

comment on view v_bi_movimientos is
  'Órdenes de compra, gastos e ingresos de caja chica normalizados para el reporte cruzado. Sin conversión de moneda: PEN y USD separados.';

revoke all on v_bi_movimientos from anon;
grant select on v_bi_movimientos to authenticated;
