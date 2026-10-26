-- 2026-10-26 · Facturas de proveedores: la bandeja cargaba las 6,486 facturas recibidas (7 páginas) y luego pedía
-- pagos (33 llamadas) y CDC sugerido (28 llamadas de ~0.5 s cada una) ANTES de pintar, y repetía todo tras cada
-- conformidad. Ahora la pantalla pide solo la página que ve (vista con el pago ya agregado), el resumen sale de una
-- función y la conformidad puede ser de varias facturas en una sola llamada.

-- Una fila por factura recibida con lo que dice Cuentas por pagar (flujo_compromisos) ya resumido.
create or replace view public.v_facturas_proveedores with (security_invoker = true) as
select c.id, c.tenant_id, c.numero_completo, c.tipo, c.serie, c.numero, c.fecha_emision, c.fecha_vencimiento, c.conforme_en, c.conforme_por,
       c.total, c.subtotal, c.igv, c.moneda, c.tipo_cambio, c.estado_flujo, c.motivo_observacion, c.xml_path, c.pdf_path, c.subido_por_proveedor,
       c.creado_en, c.orden_compra_numero, c.orden_compra_id, c.recepcion_id, c.ruc_emisor, c.razon_social_emisor, c.proveedor_id,
       c.centro_costo_id, cc.codigo as cdc_codigo, c.proyecto_id, c.tiene_detraccion, c.detraccion_monto, c.tiene_retencion, c.retencion_monto,
       c.origen, c.periodo_sire, c.observaciones, c.contabilizado,
       pg.estado_pago as pago_estado, coalesce(pg.monto_pagado, 0) as monto_pagado, pg.fecha_pagado, pg.mes_programado, pg.vence_compromiso
from comprobantes_pago c
left join centros_costo cc on cc.id = c.centro_costo_id
left join lateral (
  select max(f.estado_pago) as estado_pago, sum(f.monto_pagado) as monto_pagado, max(f.fecha_pagado) as fecha_pagado,
         max(f.mes_programado) as mes_programado, max(f.fecha_vencimiento) as vence_compromiso
  from flujo_compromisos f where f.comprobante_id = c.id
) pg on true
where c.direccion = 'recibido';
grant select on public.v_facturas_proveedores to authenticated, service_role;
create index if not exists flujo_compromisos_comprobante_idx on public.flujo_compromisos(comprobante_id);
create index if not exists comprobantes_pago_bandeja_idx on public.comprobantes_pago(tenant_id, direccion, estado_flujo, fecha_emision desc);

-- Resumen de la bandeja (KPIs) en una sola llamada.
create or replace function public.facturas_resumen() returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select c.estado_flujo, c.moneda, c.total,
           coalesce((select sum(f.monto_pagado) from flujo_compromisos f where f.comprobante_id = c.id), 0) as pagado
    from comprobantes_pago c where c.tenant_id = auth_tenant_id() and c.direccion = 'recibido')
  select jsonb_build_object(
    'total', count(*),
    'pendientes', count(*) filter (where coalesce(estado_flujo, 'recibida') in ('recibida', 'validada')),
    'conformes', count(*) filter (where estado_flujo = 'conforme'),
    'observadas', count(*) filter (where estado_flujo = 'observada'),
    'programadas', count(*) filter (where estado_flujo = 'programada_pago'),
    'pagadas', count(*) filter (where estado_flujo = 'pagada'),
    'historicas', count(*) filter (where estado_flujo = 'historica'),
    'por_pagar', coalesce((select jsonb_object_agg(moneda, round(s, 2)) from (select moneda, sum(total - pagado) s from b where estado_flujo in ('conforme', 'programada_pago') group by moneda) x), '{}'::jsonb),
    'pagado', coalesce((select jsonb_object_agg(moneda, round(s, 2)) from (select moneda, sum(case when pagado > 0 then pagado else total end) s from b where pagado > 0 or estado_flujo = 'pagada' group by moneda) x), '{}'::jsonb)
  ) from b;
$$;
revoke all on function public.facturas_resumen() from public, anon;
grant execute on function public.facturas_resumen() to authenticated, service_role;

-- Conformidad de una o varias facturas en una llamada. Solo las que están recibidas/validadas; devuelve cuántas cambió.
create or replace function public.facturas_conformar(p_ids uuid[], p_recepcion uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not auth_tiene_permiso('compras', 'editar') then raise exception 'Sin permiso (compras.editar)'; end if;
  update comprobantes_pago
     set estado_flujo = 'conforme', conforme_por = auth.uid(), conforme_en = now(), motivo_observacion = null,
         recepcion_id = coalesce(p_recepcion, recepcion_id)
   where tenant_id = auth_tenant_id() and id = any(p_ids) and direccion = 'recibido'
     and coalesce(estado_flujo, 'recibida') in ('recibida', 'validada');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.facturas_conformar(uuid[], uuid) from public, anon;
grant execute on function public.facturas_conformar(uuid[], uuid) to authenticated, service_role;
