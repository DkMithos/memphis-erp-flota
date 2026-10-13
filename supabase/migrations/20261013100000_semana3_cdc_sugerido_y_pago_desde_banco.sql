-- ─────────────────────────────────────────────────────────────────────────────
-- Semana 3 del plan de carga (2026-10-13) · CxP limpia para el lote del 6-nov.
--
-- #3b  CDC sugerido para las facturas sin centro de costo: el "CDC habitual" del
--      proveedor (el más frecuente en sus pagos y facturas ya clasificadas). Es
--      una SUGERENCIA (vista) que Contabilidad confirma desde Facturas de
--      proveedores; `factura_aplicar_cdc` la aplica a las facturas elegidas.
-- #7   Pagar facturas desde un movimiento del banco: para los pagos de set-oct
--      hechos fuera del ERP (antes del primer lote). El cargo del extracto se
--      cruza con una o varias facturas conformes de la misma moneda cuya suma
--      pendiente coincide; nace una transacción por factura (como lo haría el
--      lote), el compromiso y la factura quedan pagados y el movimiento conciliado.
-- ─────────────────────────────────────────────────────────────────────────────

-- #3b · sugerencia
create or replace view public.v_facturas_cdc_sugerido as
with hist as (
  -- CDC observado por proveedor: pagos históricos/ERP enlazados a sus facturas + facturas ya clasificadas
  select c.tenant_id, c.proveedor_id, t.centro_costo_id, count(*) as n
    from transacciones t join comprobantes_pago c on c.id = t.comprobante_id
   where t.centro_costo_id is not null and c.proveedor_id is not null
   group by 1, 2, 3
  union all
  select c.tenant_id, c.proveedor_id, c.centro_costo_id, count(*)
    from comprobantes_pago c
   where c.centro_costo_id is not null and c.proveedor_id is not null and c.direccion = 'recibido'
   group by 1, 2, 3
), agg as (
  select tenant_id, proveedor_id, centro_costo_id, sum(n) as n,
         sum(n) / sum(sum(n)) over (partition by tenant_id, proveedor_id) as pct,
         row_number() over (partition by tenant_id, proveedor_id order by sum(n) desc) as rk
    from hist group by 1, 2, 3
)
select c.id as comprobante_id, c.tenant_id, c.proveedor_id,
       a.centro_costo_id, cc.codigo as cdc_codigo, cc.proyecto_id, p.codigo as proyecto_codigo,
       a.n::int as pagos, round(a.pct, 2) as confianza
  from comprobantes_pago c
  join agg a on a.tenant_id = c.tenant_id and a.proveedor_id = c.proveedor_id and a.rk = 1
  join centros_costo cc on cc.id = a.centro_costo_id
  left join proyectos p on p.id = cc.proyecto_id
 where c.direccion = 'recibido' and c.centro_costo_id is null
   and coalesce(c.estado_flujo, 'recibida') in ('recibida', 'validada', 'conforme', 'programada_pago');
grant select on public.v_facturas_cdc_sugerido to authenticated;

create or replace function public.factura_aplicar_cdc(p_ids uuid[], p_centro_costo uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; r record; v_cc uuid; v_proy uuid; n int := 0;
begin
  if not (auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'editar') or auth_tiene_permiso('compras', 'editar')) then
    raise exception 'Sin permiso para asignar centro de costo (contabilidad.editar)';
  end if;
  v_tenant := auth_tenant_id();
  for r in select c.id, s.centro_costo_id as sugerido from comprobantes_pago c
             left join v_facturas_cdc_sugerido s on s.comprobante_id = c.id
            where c.id = any(p_ids) and c.tenant_id = v_tenant and c.direccion = 'recibido' loop
    v_cc := coalesce(p_centro_costo, r.sugerido);
    if v_cc is null then continue; end if;
    select proyecto_id into v_proy from centros_costo where id = v_cc and tenant_id = v_tenant;
    if not found then raise exception 'Centro de costo no válido'; end if;
    update comprobantes_pago
       set centro_costo_id = v_cc, proyecto_id = coalesce(proyecto_id, v_proy),
           observaciones = concat_ws(' · ', nullif(observaciones, ''), case when p_centro_costo is null then 'CDC sugerido por el historial del proveedor, confirmado' else null end)
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- #7 · facturas que podrían explicar un cargo del banco
create or replace function public.bancos_facturas_candidatas(p_mov uuid)
returns table (comprobante_id uuid, compromiso_id uuid, numero_completo text, proveedor text, fecha_emision date, fecha_vencimiento date,
               moneda text, total numeric, pendiente numeric, diferencia numeric)
language sql stable security definer set search_path = public as $$
  select c.id, f.id, c.numero_completo, c.razon_social_emisor, c.fecha_emision, coalesce(c.fecha_vencimiento, f.fecha_vencimiento), c.moneda, c.total,
         greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, c.total) - coalesce(f.monto_pagado, 0), 0) as pendiente,
         abs(greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, c.total) - coalesce(f.monto_pagado, 0), 0) - abs(m.importe)) as diferencia
    from movimientos_bancarios m
    join cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
    join comprobantes_pago c on c.tenant_id = m.tenant_id and c.direccion = 'recibido' and c.moneda = cb.moneda
         and c.estado_flujo in ('conforme', 'programada_pago') and c.fecha_emision <= m.fecha_operacion + 5
    join flujo_compromisos f on f.comprobante_id = c.id
   where m.id = p_mov and m.tenant_id = auth_tenant_id() and bancos_puede_operar()
     and coalesce(f.monto_pagado, 0) < coalesce(f.monto_presupuestado, f.monto_ejecutado, c.total) - 0.01
   order by diferencia, c.fecha_emision desc
   limit 300;
$$;

create or replace function public.bancos_pagar_facturas(p_mov uuid, p_comprobantes uuid[], p_descripcion text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; cb record; f record; v_suma numeric := 0; v_n int := 0; v_primera uuid; v_num text; v_id uuid; v_pend numeric; v_tol numeric;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso'; end if;
  select * into m from movimientos_bancarios where id = p_mov and tenant_id = auth_tenant_id();
  if m.id is null then raise exception 'Movimiento no encontrado'; end if;
  if m.transaccion_id is not null then raise exception 'El movimiento ya tiene transacción'; end if;
  if m.importe >= 0 then raise exception 'Solo se pagan facturas desde un cargo (importe negativo)'; end if;
  if coalesce(array_length(p_comprobantes, 1), 0) = 0 then raise exception 'Elige al menos una factura'; end if;
  select * into cb from cuentas_bancarias where id = m.cuenta_bancaria_id;

  -- lo pendiente de cada factura elegida, en la moneda de la cuenta
  for f in select c.id as comprobante_id, c.numero_completo, c.moneda, fc.id as compromiso_id,
                  greatest(coalesce(fc.monto_presupuestado, fc.monto_ejecutado, c.total) - coalesce(fc.monto_pagado, 0), 0) as pendiente
             from comprobantes_pago c join flujo_compromisos fc on fc.comprobante_id = c.id
            where c.id = any(p_comprobantes) and c.tenant_id = m.tenant_id and c.direccion = 'recibido' loop
    if f.moneda <> cb.moneda then raise exception 'La factura % está en % y la cuenta en %', f.numero_completo, f.moneda, cb.moneda; end if;
    if f.pendiente <= 0 then raise exception 'La factura % ya está pagada', f.numero_completo; end if;
    v_suma := v_suma + f.pendiente; v_n := v_n + 1;
  end loop;
  if v_n <> array_length(p_comprobantes, 1) then raise exception 'Alguna factura no existe, no es recibida o no tiene compromiso en Cuentas por pagar'; end if;
  -- tolerancia: 1 % del cargo (redondeos, comisión incluida); si no cuadra, que lo diga con la diferencia
  v_tol := greatest(abs(m.importe) * 0.01, 1);
  if abs(v_suma - abs(m.importe)) > v_tol then
    raise exception 'La suma pendiente de las facturas (%) no coincide con el cargo del banco (%): diferencia %. Si el banco pagó neto de detracción o retención, usa un lote de pago.',
      round(v_suma, 2), round(abs(m.importe), 2), round(v_suma - abs(m.importe), 2);
  end if;

  for f in select c.id as comprobante_id, c.numero_completo, c.razon_social_emisor, fc.id as compromiso_id, fc.centro_costo_id, fc.proyecto_id, fc.orden_compra_id, fc.categoria, fc.concepto,
                  greatest(coalesce(fc.monto_presupuestado, fc.monto_ejecutado, c.total) - coalesce(fc.monto_pagado, 0), 0) as pendiente
             from comprobantes_pago c join flujo_compromisos fc on fc.comprobante_id = c.id
            where c.id = any(p_comprobantes) order by c.fecha_emision loop
    -- si la suma difiere del cargo dentro de la tolerancia, la diferencia se absorbe en la última factura
    v_pend := f.pendiente;
    if v_n = 1 then v_pend := abs(m.importe); end if;
    v_num := trx_siguiente_numero(m.tenant_id, m.fecha_operacion);
    insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, fecha, fecha_pago, descripcion,
                               cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                               compromiso_id, comprobante_id, orden_compra_id, movimiento_bancario_id, conciliado_en, creado_por, aprobado_por, aprobado_en)
    values (m.tenant_id, v_num, 'egreso', 'Pago a proveedores', f.categoria, 'pagada', v_pend, cb.moneda, m.fecha_operacion, m.fecha_operacion,
            coalesce(nullif(p_descripcion, ''), 'Pago ' || f.numero_completo || ' · ' || coalesce(m.concepto, 'banco')),
            m.cuenta_bancaria_id, f.centro_costo_id, f.proyecto_id, m.numero_doc, 'factura', f.razon_social_emisor,
            f.compromiso_id, f.comprobante_id, f.orden_compra_id, m.id, now(), auth.uid()::text, auth.uid()::text, now())
    returning id into v_id;
    v_primera := coalesce(v_primera, v_id);
    v_n := v_n - 1;
  end loop;

  update movimientos_bancarios set transaccion_id = v_primera, conciliado_en = now(), conciliado_por = 'manual', clasificacion = 'pago_proveedor',
         notas = concat_ws(' · ', nullif(notas, ''), 'Paga ' || array_length(p_comprobantes, 1) || ' factura(s) desde Bancos')
   where id = p_mov;
  return jsonb_build_object('transaccion', v_primera, 'facturas', array_length(p_comprobantes, 1), 'monto', round(abs(m.importe), 2));
end $$;
