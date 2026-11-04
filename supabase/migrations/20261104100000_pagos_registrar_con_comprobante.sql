-- 2026-11-04 · Registrar pagos en lote con comprobante adjunto.
--
-- Kevin: "quiero marcar algunas facturas ya pagadas y subir los comprobantes… veo tedioso el proceso de marcar las facturas
-- pagadas… los no domiciliados que no suben facturas pero están pagados, ¿cómo se marcan?".
-- Antes: tres caminos distintos (Cuentas por pagar un botón por fila y sin datos, Bancos por cargo, Lotes por línea) y en
-- ninguno se podía adjuntar el voucher (solo un campo URL en Transacciones).
-- Ahora: UNA función `pagos_registrar` que recibe compromisos (facturas, órdenes de no domiciliados, obligaciones) y/o
-- facturas, con fecha, cuenta, referencia y el comprobante subido al bucket `vouchers-pagos`; crea una transacción por
-- cada uno (reusa `registrar_pago_compromiso`, que cierra compromiso y factura) y le pega el comprobante. Las facturas
-- conformes que no tienen compromiso (anteriores al corte de CxP) se pagan directo. El mismo diálogo se usa desde
-- Facturas de proveedores (selección múltiple) y desde Cuentas por pagar (donde viven las OC de los no domiciliados).

create or replace function public.pagos_puede_registrar() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_tiene_permiso('finanzas', 'editar') or auth_tiene_permiso('finanzas', 'crear') or auth_tiene_permiso('finanzas', 'flujo');
$$;

-- El bucket ya existía para los lotes (solo tesorería). Ahora sube quien registra pagos y ve quien ve finanzas, compras,
-- contabilidad o Dirección (la factura y su voucher van juntos en la bandeja de Compras).
drop policy if exists vouchers_pagos_leer on storage.objects;
create policy vouchers_pagos_leer on storage.objects for select to authenticated
  using (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text
         and (lote_puede_ver() or auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('compras', 'ver')
              or auth_tiene_permiso('contabilidad', 'ver') or auth_tiene_permiso('direccion', 'ver')));
drop policy if exists vouchers_pagos_subir on storage.objects;
create policy vouchers_pagos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text
              and (auth_tiene_permiso('finanzas', 'lotes_pagar') or pagos_puede_registrar()));
drop policy if exists vouchers_pagos_reemplazar on storage.objects;
create policy vouchers_pagos_reemplazar on storage.objects for update to authenticated
  using (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text
         and (auth_tiene_permiso('finanzas', 'lotes_pagar') or pagos_puede_registrar()));

-- Cuentas para el diálogo (la tabla tiene RLS por permiso de Finanzas; quien registra pagos desde Compras no la ve).
create or replace function public.cuentas_bancarias_breve() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when pagos_puede_registrar() or auth_tiene_permiso('finanzas', 'lotes_pagar')
    then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'moneda', moneda) order by orden, nombre)
                     from cuentas_bancarias where tenant_id = auth_tenant_id() and activa), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
revoke all on function public.cuentas_bancarias_breve() from public, anon;
grant execute on function public.cuentas_bancarias_breve() to authenticated;

create or replace function public.pagos_registrar(
  p_compromisos uuid[], p_comprobantes uuid[], p_fecha date, p_cuenta uuid default null, p_referencia text default null, p_voucher_path text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := auth_tenant_id(); v_ids uuid[] := array_remove(coalesce(p_compromisos, '{}'), null); c uuid; k uuid;
        v_comp record; v_cmp record; v_tx uuid; v_txs uuid[] := '{}'; v_om jsonb := '[]'::jsonb; v_pag int := 0; v_num text; v_anio text;
begin
  if not pagos_puede_registrar() then raise exception 'Sin permiso para registrar pagos (finanzas.editar)'; end if;
  if p_fecha is null then raise exception 'Falta la fecha de pago'; end if;
  if p_fecha > current_date + 1 then raise exception 'La fecha de pago no puede ser futura'; end if;

  -- Facturas: se paga su compromiso; si no lo tiene (anterior al corte de CxP), se paga directo.
  foreach c in array array_remove(coalesce(p_comprobantes, '{}'), null) loop
    select * into v_comp from comprobantes_pago where id = c and tenant_id = t;
    if not found then v_om := v_om || jsonb_build_object('id', c, 'motivo', 'factura no encontrada'); continue; end if;
    if v_comp.estado_flujo = 'pagada' then v_om := v_om || jsonb_build_object('id', c, 'motivo', v_comp.numero_completo || ' ya está pagada'); continue; end if;
    if v_comp.estado_flujo in ('anulada', 'observada') then v_om := v_om || jsonb_build_object('id', c, 'motivo', v_comp.numero_completo || ' está ' || v_comp.estado_flujo); continue; end if;
    select id into k from flujo_compromisos
     where comprobante_id = c and sentido = 'pagar' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'
     order by importado_en limit 1;
    if found then
      v_ids := array_append(v_ids, k);
    else
      v_anio := to_char(p_fecha, 'YYYY');
      select 'TRX-' || v_anio || '-' || lpad((coalesce(max(substring(numero from '^TRX-\d{4}-(\d+)$')::int), 0) + 1)::text, 4, '0') into v_num
        from transacciones where tenant_id = t and numero like 'TRX-' || v_anio || '-%';
      insert into transacciones (tenant_id, numero, tipo, categoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                                 centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                                 comprobante_id, orden_compra_id, cuenta_bancaria_id, comprobante_url, creado_por, aprobado_por, aprobado_en)
      values (t, v_num, 'egreso', 'Pago a proveedores', 'pagada', coalesce(v_comp.total, 0), coalesce(v_comp.moneda, 'PEN'), v_comp.tipo_cambio,
              p_fecha, p_fecha, 'Pago factura ' || v_comp.numero_completo || coalesce(' · ' || p_referencia, ''),
              v_comp.centro_costo_id, v_comp.proyecto_id, p_referencia, 'factura', v_comp.razon_social_emisor,
              c, v_comp.orden_compra_id, p_cuenta, p_voucher_path, auth.uid()::text, auth.uid()::text, now())
      returning id into v_tx;
      update comprobantes_pago set estado_flujo = 'pagada' where id = c and estado_flujo <> 'pagada';
      v_txs := array_append(v_txs, v_tx); v_pag := v_pag + 1;
    end if;
  end loop;

  -- Compromisos (facturas conformes, órdenes aprobadas de no domiciliados, obligaciones, cuotas): una transacción por cada uno.
  v_ids := coalesce((select array_agg(distinct x) from unnest(v_ids) x), '{}');
  foreach c in array v_ids loop
    select * into v_cmp from flujo_compromisos where id = c and tenant_id = t;
    if not found then v_om := v_om || jsonb_build_object('id', c, 'motivo', 'compromiso no encontrado'); continue; end if;
    if upper(coalesce(v_cmp.estado_pago, '')) like 'PAGADO%' then v_om := v_om || jsonb_build_object('id', c, 'motivo', coalesce(v_cmp.concepto, 'compromiso') || ' ya está pagado'); continue; end if;
    -- p_cuenta va aparte: registrar_pago_compromiso lo guarda en cuenta_id (FK al plan de cuentas), no en cuenta_bancaria_id.
    v_tx := registrar_pago_compromiso(c, p_fecha, null, null, p_referencia);
    update transacciones set comprobante_url = coalesce(p_voucher_path, comprobante_url), cuenta_bancaria_id = coalesce(p_cuenta, cuenta_bancaria_id) where id = v_tx;
    v_txs := array_append(v_txs, v_tx); v_pag := v_pag + 1;
  end loop;

  return jsonb_build_object('pagados', v_pag, 'transacciones', to_jsonb(v_txs), 'omitidos', v_om);
end $$;
revoke all on function public.pagos_registrar(uuid[], uuid[], date, uuid, text, text) from public, anon;
grant execute on function public.pagos_registrar(uuid[], uuid[], date, uuid, text, text) to authenticated;

-- Adjuntar (o reemplazar) el comprobante de un pago ya registrado.
create or replace function public.pago_adjuntar_comprobante(p_transaccion uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (pagos_puede_registrar() or auth_tiene_permiso('finanzas', 'lotes_pagar')) then raise exception 'Sin permiso para adjuntar comprobantes'; end if;
  update transacciones set comprobante_url = p_path, modificado_por = auth.uid()::text, modificado_en = now()
   where id = p_transaccion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Pago no encontrado'; end if;
end $$;
revoke all on function public.pago_adjuntar_comprobante(uuid, text) from public, anon;
grant execute on function public.pago_adjuntar_comprobante(uuid, text) to authenticated;

-- Los pagos de una factura, para verlos junto a ella (con el comprobante).
create or replace function public.factura_pagos(p_comprobante uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth_tiene_permiso('compras', 'ver') or auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('contabilidad', 'ver') or auth_tiene_permiso('direccion', 'ver')
    then coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'numero', x.numero, 'fecha', coalesce(x.fecha_pago, x.fecha), 'monto', x.monto, 'moneda', x.moneda,
                     'referencia', x.referencia_numero, 'cuenta', cb.nombre, 'comprobante_url', x.comprobante_url, 'estado', x.estado) order by coalesce(x.fecha_pago, x.fecha))
                     from transacciones x left join cuentas_bancarias cb on cb.id = x.cuenta_bancaria_id
                    where x.tenant_id = auth_tenant_id() and x.comprobante_id = p_comprobante and x.estado <> 'anulada'), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
revoke all on function public.factura_pagos(uuid) from public, anon;
grant execute on function public.factura_pagos(uuid) to authenticated;

-- Borrar un comprobante (para reemplazar uno equivocado): tesorería o quien edita Finanzas.
drop policy if exists vouchers_pagos_borrar on storage.objects;
create policy vouchers_pagos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text
         and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'editar')));

