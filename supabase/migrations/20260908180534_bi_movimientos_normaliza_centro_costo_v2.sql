-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260908180534  name: bi_movimientos_normaliza_centro_costo_v2

drop view if exists v_bi_movimientos;

-- El centro de costo tiene que ser la misma etiqueta venga de donde venga, o el
-- cruce parte el mismo centro en dos.
--
-- Las órdenes traen `centro_costo_id`, y ese id ya resuelve los alias del
-- legado (GORE-C-AMB → GCUSCOAMBU, ICA → GOREICAPNP). La caja chica solo guarda
-- texto, así que aquí se casa contra el catálogo por código o por nombre; lo
-- que no case viaja tal cual y se marca `en_catalogo = false`, que es
-- información para Administración, no algo que inventar.
--
-- Nada se convierte de moneda: PEN y USD viajan separados hasta que exista la
-- tabla de tipos de cambio por fecha. Anuladas y rechazadas no son compromiso,
-- igual que en las vistas de Gerencia.
create view v_bi_movimientos
with (security_invoker = true) as
  select
    o.tenant_id,
    'orden_compra'::text                          as fuente,
    'egreso'::text                                as flujo,
    o.id,
    o.numero,
    o.fecha_emision                               as fecha,
    to_char(o.fecha_emision, 'YYYY-MM')           as mes,
    o.estado,
    o.moneda,
    o.total                                       as monto,
    o.proyecto_id,
    p.nombre                                      as proyecto,
    o.centro_costo_id,
    coalesce(cc.codigo, o.centro_costo_texto)     as centro_costo,
    (cc.id is not null)                           as en_catalogo,
    prov.razon_social                             as contraparte,
    coalesce(nullif(o.observaciones, ''), o.tipo) as descripcion
  from ordenes_compra o
  left join proyectos     p    on p.id    = o.proyecto_id
  left join centros_costo cc   on cc.id   = o.centro_costo_id
  left join proveedores   prov on prov.id = o.proveedor_id
  where o.estado not in ('anulada', 'rechazada')
    and o.fecha_emision is not null

  union all

  select
    g.tenant_id, 'gasto_caja', 'egreso', g.id, g.numero, g.fecha,
    to_char(g.fecha, 'YYYY-MM'), g.estado, g.moneda, g.monto,
    g.proyecto_id, p.nombre,
    cc.id,
    coalesce(cc.codigo, g.centro_costo),
    (cc.id is not null),
    g.beneficiario, g.descripcion
  from gastos_caja_chica g
  left join proyectos p on p.id = g.proyecto_id
  left join centros_costo cc
         on cc.tenant_id = g.tenant_id
        and (upper(btrim(cc.codigo)) = upper(btrim(g.centro_costo))
          or upper(btrim(cc.nombre)) = upper(btrim(g.centro_costo)))
  where g.estado <> 'rechazado'
    and g.fecha is not null

  union all

  select
    i.tenant_id, 'ingreso_caja', 'ingreso', i.id, i.numero, i.fecha,
    to_char(i.fecha, 'YYYY-MM'), i.estado, i.moneda, i.monto,
    null::uuid, null::text,
    cc.id,
    coalesce(cc.codigo, i.centro_costo),
    (cc.id is not null),
    i.origen, i.descripcion
  from ingresos_caja_chica i
  left join centros_costo cc
         on cc.tenant_id = i.tenant_id
        and (upper(btrim(cc.codigo)) = upper(btrim(i.centro_costo))
          or upper(btrim(cc.nombre)) = upper(btrim(i.centro_costo)))
  where i.fecha is not null;

comment on view v_bi_movimientos is
  'Órdenes de compra, gastos e ingresos de caja chica normalizados para el reporte cruzado. Centro de costo resuelto contra el catálogo cuando se puede (en_catalogo). Sin conversión de moneda.';

revoke all on v_bi_movimientos from anon;
grant select on v_bi_movimientos to authenticated;
