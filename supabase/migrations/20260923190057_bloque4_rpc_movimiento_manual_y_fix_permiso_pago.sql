-- 1) registrar_pago_compromiso (Bloque 3) llamaba a tiene_permiso(), que no
--    existe: el helper real es auth_tiene_permiso(). Sin esto el botón "Pagado"
--    de Cuentas por pagar fallaba.
create or replace function public.registrar_pago_compromiso(
  p_compromiso uuid, p_fecha date default current_date, p_monto numeric default null, p_cuenta uuid default null, p_referencia text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; v_num text; v_id uuid; v_monto numeric; v_anio text;
begin
  if not (auth_tiene_permiso('finanzas', 'editar') or auth_tiene_permiso('finanzas', 'flujo') or auth_tiene_permiso('finanzas', 'crear')) then
    raise exception 'Sin permiso para registrar pagos (finanzas.editar)';
  end if;
  select * into c from flujo_compromisos where id = p_compromiso;
  if not found then raise exception 'Compromiso no encontrado'; end if;
  v_monto := coalesce(p_monto, greatest(coalesce(c.monto_presupuestado, c.monto_ejecutado, 0) - coalesce(c.monto_pagado, 0), 0));
  if v_monto <= 0 then raise exception 'No queda nada por pagar en este compromiso'; end if;
  v_anio := to_char(p_fecha, 'YYYY');
  select 'TRX-' || v_anio || '-' || lpad((coalesce(max(substring(numero from '^TRX-\d{4}-(\d+)$')::int), 0) + 1)::text, 4, '0') into v_num
    from transacciones where tenant_id = c.tenant_id and numero like 'TRX-' || v_anio || '-%';
  insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, fecha, fecha_pago, descripcion,
                             cuenta_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                             compromiso_id, comprobante_id, orden_compra_id, valorizacion_id, creado_por, aprobado_por, aprobado_en)
  values (c.tenant_id, v_num, case when c.sentido = 'cobrar' then 'ingreso' else 'egreso' end,
          case when c.sentido = 'cobrar' then 'Cobro de valorización' else 'Pago a proveedores' end, c.categoria, 'pagada',
          v_monto, coalesce(c.moneda, 'PEN'), p_fecha, p_fecha,
          coalesce(c.concepto, 'Pago') || coalesce(' · ' || p_referencia, ''),
          p_cuenta, c.centro_costo_id, c.proyecto_id, coalesce(p_referencia, c.referencia_doc),
          case when c.comprobante_id is not null then 'factura' when c.orden_compra_id is not null then 'orden_compra' when c.valorizacion_id is not null then 'valorizacion' else 'compromiso' end,
          c.proveedor, c.id, c.comprobante_id, c.orden_compra_id, c.valorizacion_id,
          auth.uid()::text, auth.uid()::text, now())
  returning id into v_id;
  return v_id;
end $$;

-- 2) Movimiento manual del kardex (consumo, entrega a proyecto, ajuste, stock
--    inicial): pasa por la misma puerta que la recepción, con permiso de inventario.
revoke execute on function public.kardex_registrar(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, numeric, text, text, uuid, uuid, uuid, text, timestamptz, text) from public, authenticated, anon;

create or replace function public.registrar_movimiento_inventario(
  p_articulo uuid, p_almacen uuid, p_tipo text, p_motivo text, p_cantidad numeric,
  p_precio numeric default null, p_proyecto uuid default null,
  p_ref_tipo text default null, p_ref_id text default null, p_notas text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare a record; v_stock numeric; v_tc numeric;
begin
  if not (auth_tiene_permiso('inventario', 'crear') or auth_tiene_permiso('inventario', 'editar')) then
    raise exception 'Sin permiso para registrar movimientos (inventario.crear)';
  end if;
  select * into a from articulos where id = p_articulo;
  if not found then raise exception 'Artículo no encontrado'; end if;
  if p_tipo not in ('entrada', 'salida', 'ajuste', 'transferencia') then raise exception 'Tipo de movimiento no válido'; end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'La cantidad debe ser mayor a 0'; end if;
  v_stock := coalesce(a.stock_actual, 0) + case when p_tipo = 'entrada' or p_motivo = 'ajuste_positivo' then p_cantidad else -p_cantidad end;
  if v_stock < 0 then
    raise exception 'Stock insuficiente para %: hay % y se pide %', a.nombre, coalesce(a.stock_actual, 0), p_cantidad;
  end if;
  v_tc := case when coalesce(a.moneda, 'PEN') = 'USD' then tc_vigente(current_date) else 1 end;
  return kardex_registrar(a.tenant_id, p_articulo, p_almacen, p_proyecto, p_tipo, p_motivo, p_cantidad,
    coalesce(p_precio, a.precio_unitario), a.moneda, v_tc, coalesce(p_ref_tipo, case when p_ref_id is not null then 'manual' end), p_ref_id,
    null, null, null, p_notas, now(), coalesce(auth.uid()::text, 'manual'));
end $$;
grant execute on function public.registrar_movimiento_inventario(uuid, uuid, text, text, numeric, numeric, uuid, text, text, text) to authenticated;
