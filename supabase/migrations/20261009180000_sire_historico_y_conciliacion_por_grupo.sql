-- ─────────────────────────────────────────────────────────────────────────────
-- Carga histórica del SIRE 2024-2026 y conciliación bancaria por grupo · 2026-10-09
--
-- 1. La unicidad de comprobantes incluye el RUC del emisor: dos proveedores
--    distintos pueden emitir E001-13 (series electrónicas repetidas).
-- 2. Estado de flujo `historica`: factura cargada del SIRE de un periodo ya
--    cerrado cuyo pago no se identificó en el ERP. No crea compromiso ni entra
--    a Cuentas por pagar; Contabilidad la revisa y la marca pagada o pendiente.
-- 3. Las facturas de periodos anteriores a 2026 no generan asiento en el ERP
--    (esos años viven en SISCONT): `app.sin_asiento = '1'` durante la carga.
-- 4. `sire_enlazar_pago_historico` suma una segunda pasada: mismo proveedor,
--    misma moneda e importe igual al total o al neto de detracción/retención.
-- 5. `bancos_conciliar_auto` suma la pasada por grupo: un solo movimiento del
--    banco (una operación) paga varias facturas; se concilia si la suma de las
--    transacciones con ese n.º de operación es igual al importe del movimiento.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. unicidad con RUC
alter table comprobantes_pago drop constraint if exists comprobantes_pago_tenant_id_tipo_serie_numero_key;
create unique index if not exists comprobantes_pago_unico_por_emisor
  on comprobantes_pago (tenant_id, coalesce(ruc_emisor, ''), tipo, serie, numero);

-- 2. compromiso: una factura `historica` no es deuda viva
create or replace function public.trg_factura_compromiso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_area text; v_cc record; v_venc_oc date;
begin
  if new.estado_flujo = 'anulada' then
    update flujo_compromisos set comprobante_id = null, desfase_dias = null,
           origen = case when orden_compra_id is not null then 'comprometido' else origen end
     where comprobante_id = new.id;
    return null;
  end if;
  if new.estado_flujo = 'historica' then
    -- si venía de `conforme`, se retira el compromiso que no tenga OC ni pagos
    delete from flujo_compromisos fc where fc.comprobante_id = new.id and fc.orden_compra_id is null
      and not exists (select 1 from transacciones t where t.compromiso_id = fc.id);
    return null;
  end if;

  if new.orden_compra_id is not null then
    perform sync_compromiso_de_oc(new.orden_compra_id);
    select fecha_vencimiento_pago into v_venc_oc from ordenes_compra where id = new.orden_compra_id;
    update flujo_compromisos set
      comprobante_id       = new.id,
      origen               = 'real',
      fecha_vencimiento    = coalesce(new.fecha_vencimiento, fecha_vencimiento),
      mes_vencimiento      = coalesce(date_trunc('month', new.fecha_vencimiento)::date, mes_vencimiento),
      vencimiento_estimado = case when new.fecha_vencimiento is not null then false else vencimiento_estimado end,
      desfase_dias         = case when new.fecha_vencimiento is not null and v_venc_oc is not null then new.fecha_vencimiento - v_venc_oc else desfase_dias end,
      referencia_doc       = coalesce(new.numero_completo, referencia_doc),
      estado_pago          = case when new.estado_flujo = 'pagada' then 'PAGADO' else estado_pago end
    where orden_compra_id = new.orden_compra_id;
    return null;
  end if;

  select codigo, area, proyecto_id into v_cc from centros_costo where id = new.centro_costo_id;
  v_area := case when coalesce(new.proyecto_id, v_cc.proyecto_id) is not null then 'PROYECTOS' else coalesce(v_cc.area, 'ADMINISTRACION') end;
  insert into flujo_compromisos (
    tenant_id, area, cdc, centro_costo_id, proyecto_id, concepto, categoria, proveedor, proveedor_id,
    moneda, tc, mes_vencimiento, fecha_vencimiento, monto_presupuestado, monto_ejecutado,
    estado_pago, sentido, origen, fuente, comprobante_id, referencia_doc, creado_por)
  values (
    new.tenant_id, v_area, v_cc.codigo, new.centro_costo_id, coalesce(new.proyecto_id, v_cc.proyecto_id),
    'Factura ' || coalesce(new.numero_completo, new.serie || '-' || new.numero), 'factura',
    new.razon_social_emisor, new.proveedor_id,
    new.moneda, new.tipo_cambio,
    date_trunc('month', coalesce(new.fecha_vencimiento, new.fecha_emision))::date,
    new.fecha_vencimiento, new.total, new.total,
    case when new.estado_flujo = 'pagada' then 'PAGADO' else 'PENDIENTE' end,
    'pagar', 'real', 'erp', new.id, new.numero_completo, new.creado_por)
  on conflict (comprobante_id) where comprobante_id is not null and orden_compra_id is null do update set
    monto_presupuestado = excluded.monto_presupuestado, monto_ejecutado = excluded.monto_ejecutado,
    fecha_vencimiento = excluded.fecha_vencimiento, mes_vencimiento = excluded.mes_vencimiento,
    estado_pago = case when new.estado_flujo = 'pagada' then 'PAGADO' else flujo_compromisos.estado_pago end;
  return null;
end $$;

-- 3. contabilización: se puede apagar por transacción (cargas de años cerrados)
create or replace function public.trg_comprobante_contabilizar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_al text;
begin
  if new.estado = 'anulado' or coalesce(new.estado_flujo, '') = 'anulada' then
    perform anular_contabilizacion_comprobante(new.id);
    return null;
  end if;
  if new.asiento_id is not null or new.estado <> 'activo' then return null; end if;
  if coalesce(current_setting('app.sin_asiento', true), '') = '1' then return null; end if;
  v_al := cta_cfg(new.tenant_id, 'contabilizar_al');
  if new.direccion = 'emitido'
     or (v_al = 'conforme' and coalesce(new.estado_flujo, '') in ('conforme', 'programada_pago', 'pagada'))
     or (v_al = 'recibida' and coalesce(new.estado_flujo, 'recibida') not in ('observada', 'anulada', 'historica')) then
    begin
      perform contabilizar_comprobante(new.id);
    exception when others then
      update comprobantes_pago set contabilizacion_error = left(SQLERRM, 500) where id = new.id;
    end;
  end if;
  return null;
end $$;

-- 4. enlace con el pago histórico: por número de comprobante o por proveedor + importe
create or replace function public.sire_enlazar_pago_historico(p_comprobante uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; v_trx uuid; v_trxs uuid[]; v_patron text; v_comp uuid; v_prov5 text; v_como text; v_est text; v_pagado numeric; v_monto numeric;
begin
  select * into c from comprobantes_pago where id = p_comprobante;
  if c.id is null then return null; end if;
  v_prov5 := upper(left(regexp_replace(coalesce(c.razon_social_emisor, ''), '\s', '', 'g'), 5));
  v_patron := '\m' || upper(c.serie) || '-0*' || ltrim(c.numero, '0') || '\M';

  -- pasada 1: la descripción del pago menciona "SERIE-NUMERO" y el proveedor coincide (todas las cuotas)
  select array_agg(t.id order by abs(coalesce(t.monto, 0) - coalesce(c.total, 0))) into v_trxs from transacciones t
   where t.tenant_id = c.tenant_id and t.referencia_tipo = 'historico_contabilidad' and t.comprobante_id is null
     and t.tipo = 'egreso' and t.estado = 'pagada'
     and upper(coalesce(t.descripcion, '')) ~ v_patron
     and (t.proveedor_nombre is null or v_prov5 = '' or upper(left(regexp_replace(t.proveedor_nombre, '\s', '', 'g'), 5)) = v_prov5);
  if v_trxs is not null then v_trx := v_trxs[1]; end if;
  v_como := 'número de comprobante';

  -- pasada 2: mismo proveedor, misma moneda, pagado entre 5 días antes y 240 después de la emisión,
  -- por el total o por el neto de detracción (4/10/12 %) o retención (3 %)
  if v_trx is null and v_prov5 <> '' and coalesce(c.total, 0) > 0 then
    select t.id into v_trx from transacciones t
     where t.tenant_id = c.tenant_id and t.referencia_tipo = 'historico_contabilidad' and t.comprobante_id is null
       and t.tipo = 'egreso' and t.estado = 'pagada'
       and coalesce(t.moneda, 'PEN') = coalesce(c.moneda, 'PEN')
       and upper(left(regexp_replace(coalesce(t.proveedor_nombre, ''), '\s', '', 'g'), 5)) = v_prov5
       and coalesce(t.fecha_pago, t.fecha) between c.fecha_emision - 5 and c.fecha_emision + 240
       and (abs(t.monto - c.total) <= 0.05
            or abs(t.monto - round(c.total * 0.97, 2)) <= 1.00
            or abs(t.monto - round(c.total * 0.96, 2)) <= 1.00
            or abs(t.monto - round(c.total * 0.90, 2)) <= 1.00
            or abs(t.monto - round(c.total * 0.88, 2)) <= 1.00)
     order by abs(t.monto - c.total), abs(coalesce(t.fecha_pago, t.fecha) - c.fecha_emision) limit 1;
    v_como := 'proveedor e importe';
  end if;

  if v_trx is null then return null; end if;

  -- una `historica` pasa a `conforme` para que exista el compromiso, y el pago la cierra
  if c.estado_flujo = 'historica' then
    update comprobantes_pago set estado_flujo = 'conforme', conforme_en = coalesce(conforme_en, now()) where id = c.id;
  end if;
  select id into v_comp from flujo_compromisos where comprobante_id = c.id order by importado_en desc nulls last limit 1;
  update transacciones set comprobante_id = c.id, compromiso_id = coalesce(v_comp, compromiso_id) where id = any(coalesce(v_trxs, array[v_trx]));
  if v_comp is not null then
    perform recalc_pago_compromiso(v_comp, true);
    -- el pago histórico es el neto (sin la detracción o retención, que se depositan aparte): si cubre ≥ 85 % del total, la factura se da por pagada
    select estado_pago, coalesce(monto_pagado, 0), coalesce(monto_presupuestado, monto_ejecutado, 0) into v_est, v_pagado, v_monto from flujo_compromisos where id = v_comp;
    if v_est = 'PARCIAL' and v_monto > 0 and v_pagado >= v_monto * 0.85 then
      update flujo_compromisos set estado_pago = 'PAGADO',
             observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Diferencia de ' || round(v_monto - v_pagado, 2) || ' ' || coalesce(moneda, 'PEN') || ' = detracción/retención depositada aparte')
       where id = v_comp;
      update comprobantes_pago set estado_flujo = 'pagada' where id = c.id;
    end if;
  end if;
  update comprobantes_pago
     set observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Pago histórico ' || (select string_agg(numero, ', ' order by numero) from transacciones where id = any(coalesce(v_trxs, array[v_trx]))) || ' enlazado por ' || v_como)
   where id = c.id;
  return v_trx;
end $$;

-- p_corte: periodo (AAAAMM) desde el que las facturas sin pago identificado quedan `conforme` (deuda viva);
--          las anteriores a ese periodo sin pago quedan `historica`. Nulo = todas `conforme` (uso mensual).
create or replace function public.sire_importar_compras(p_filas jsonb, p_archivo text default null, p_corte text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; f jsonb; v_tipo text; v_serie text; v_num text; v_ruc text; v_total numeric; v_moneda text; v_tc numeric;
        v_fe date; v_fv date; v_prov uuid; v_id uuid; v_pag uuid; v_periodo text; v_estado text; v_ef text; v_pp numeric; v_pm numeric;
        n_nuevas int := 0; n_existen int := 0; n_pagadas int := 0; n_nc int := 0; n_saltadas int := 0; n_sin_prov int := 0; n_hist int := 0; n_parcial int := 0;
        v_bi numeric; v_igv numeric; v_ng numeric;
begin
  if not (auth_tiene_permiso('compras', 'editar') or auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'lotes_validar')) then
    raise exception 'Sin permiso para importar el SIRE (compras.editar o contabilidad.editar)';
  end if;
  v_tenant := auth_tenant_id();
  select ruc, coalesce(nullif(razon_social, ''), nombre) as nombre into t from tenants where id = v_tenant;
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_tipo := lpad(regexp_replace(coalesce(f->>'tipo', ''), '[^0-9]', '', 'g'), 2, '0');
    v_serie := upper(trim(coalesce(f->>'serie', '')));
    v_num := regexp_replace(coalesce(f->>'numero', ''), '[^0-9]', '', 'g');
    v_ruc := regexp_replace(coalesce(f->>'ruc', ''), '[^0-9]', '', 'g');
    v_total := nullif(regexp_replace(coalesce(f->>'total', ''), '[^0-9.\-]', '', 'g'), '')::numeric;
    v_moneda := case when upper(coalesce(f->>'moneda', 'PEN')) in ('USD', 'US$', 'DOLARES') then 'USD' else 'PEN' end;
    v_tc := nullif(regexp_replace(coalesce(f->>'tc', ''), '[^0-9.]', '', 'g'), '')::numeric;
    v_bi := coalesce(nullif(regexp_replace(coalesce(f->>'bi_gravada', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_igv := coalesce(nullif(regexp_replace(coalesce(f->>'igv', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_ng := coalesce(nullif(regexp_replace(coalesce(f->>'no_gravada', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    begin
      v_fe := nullif(left(f->>'fecha_emision', 10), '')::date;
      v_fv := nullif(left(f->>'fecha_vencimiento', 10), '')::date;
    exception when others then v_fe := null; v_fv := null; end;
    if v_tipo = '07' or v_tipo = '08' then n_nc := n_nc + 1; continue; end if;
    if v_serie = '' or v_num = '' or v_ruc = '' or v_fe is null or v_total is null or v_total <= 0 then n_saltadas := n_saltadas + 1; continue; end if;
    if exists (select 1 from comprobantes_pago where tenant_id = v_tenant and tipo = v_tipo and upper(serie) = v_serie and ltrim(numero, '0') = ltrim(v_num, '0') and (ruc_emisor is null or ruc_emisor = v_ruc)) then
      n_existen := n_existen + 1; continue;
    end if;
    v_periodo := nullif(regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'), '');
    if v_periodo is null then v_periodo := to_char(v_fe, 'YYYYMM'); end if;
    v_estado := case when p_corte is not null and v_periodo < p_corte then 'historica' else 'conforme' end;
    -- los periodos anteriores a 2026 ya están contabilizados fuera del ERP: sin asiento
    perform set_config('app.sin_asiento', case when v_periodo < '202601' then '1' else '0' end, true);
    select id into v_prov from proveedores where tenant_id = v_tenant and ruc = v_ruc limit 1;
    if v_prov is null then n_sin_prov := n_sin_prov + 1; end if;
    insert into comprobantes_pago (tenant_id, direccion, tipo, serie, numero, numero_completo, fecha_emision, fecha_vencimiento,
                                   ruc_emisor, razon_social_emisor, ruc_receptor, razon_social_receptor,
                                   op_gravada, op_exonerada, op_inafecta, subtotal, igv, total, moneda, tipo_cambio,
                                   tiene_detraccion, estado, estado_flujo, proveedor_id, origen, periodo_sire, conforme_en)
    values (v_tenant, 'recibido', v_tipo, v_serie, v_num, v_serie || '-' || v_num, v_fe, coalesce(v_fv, v_fe + 30),
            v_ruc, nullif(trim(f->>'razon_social'), ''), t.ruc, t.nombre,
            v_bi, 0, v_ng, v_bi + v_ng, v_igv, v_total, v_moneda, case when v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then v_tc else 1 end,
            coalesce(f->>'detraccion', '') <> '', 'activo', v_estado, v_prov, 'sire', v_periodo, case when v_estado = 'conforme' then now() else null end)
    returning id into v_id;
    n_nuevas := n_nuevas + 1;
    v_pag := sire_enlazar_pago_historico(v_id);
    if v_pag is not null and v_estado = 'historica' then
      -- periodo cerrado con pago parcial que no cierra la factura (cuotas, factoring): no es deuda viva confiable → vuelve a histórica
      select estado_flujo into v_ef from comprobantes_pago where id = v_id;
      if v_ef <> 'pagada' then
        select coalesce(monto_pagado, 0), coalesce(monto_presupuestado, monto_ejecutado, 0) into v_pp, v_pm from flujo_compromisos where comprobante_id = v_id limit 1;
        update transacciones set comprobante_id = null, compromiso_id = null where comprobante_id = v_id;
        perform anular_contabilizacion_comprobante(v_id);
        update comprobantes_pago set estado_flujo = 'historica', conforme_en = null, asiento_id = null, contabilizado = false,
               observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Pago parcial histórico ' || coalesce(v_pp, 0) || ' de ' || coalesce(v_pm, 0) || ' ' || v_moneda || ': no cierra la factura, queda histórica para revisión')
         where id = v_id;
        n_parcial := n_parcial + 1; v_pag := null;
      end if;
    end if;
    if v_pag is not null then n_pagadas := n_pagadas + 1;
    elsif v_estado = 'historica' then n_hist := n_hist + 1; end if;
  end loop;
  perform set_config('app.sin_asiento', '0', true);
  return jsonb_build_object('nuevas', n_nuevas, 'ya_existian', n_existen, 'enlazadas_a_pago_historico', n_pagadas, 'historicas_sin_pago', n_hist, 'historicas_con_pago_parcial', n_parcial,
                            'notas_credito_omitidas', n_nc, 'saltadas', n_saltadas, 'sin_proveedor_en_directorio', n_sin_prov);
end $$;

-- 5. conciliación bancaria: operación, grupo por operación, importe
create or replace function public.bancos_conciliar_auto(p_cuenta uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; v_trx uuid; v_ope text; n_op int := 0; n_grp int := 0; n_imp int := 0; v_n int; v_suma numeric;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso para conciliar'; end if;
  for m in select * from movimientos_bancarios where cuenta_bancaria_id = p_cuenta and transaccion_id is null and tenant_id = auth_tenant_id() order by fecha_operacion loop
    v_trx := null;
    v_ope := ltrim(regexp_replace(coalesce(m.numero_doc, ''), '[^0-9]', '', 'g'), '0');
    if v_ope <> '' then
      -- a) una transacción con ese n.º de operación y el mismo importe
      select t.id into v_trx from transacciones t
       where t.tenant_id = m.tenant_id and t.cuenta_bancaria_id = p_cuenta and t.estado = 'pagada' and t.movimiento_bancario_id is null
         and ltrim(regexp_replace(coalesce(t.referencia_numero, ''), '[^0-9]', '', 'g'), '0') = v_ope
         and ((m.importe < 0 and t.tipo = 'egreso') or (m.importe > 0 and t.tipo = 'ingreso'))
         and abs(abs(m.importe) - t.monto) <= 0.01
       order by abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) limit 1;
      if v_trx is not null then
        update movimientos_bancarios set transaccion_id = v_trx, conciliado_en = now(), conciliado_por = 'auto:operacion', clasificacion = case when m.importe < 0 then 'pago_proveedor' else 'abono' end where id = m.id;
        update transacciones set movimiento_bancario_id = m.id, conciliado_en = now() where id = v_trx;
        n_op := n_op + 1; continue;
      end if;
      -- b) varias transacciones con ese n.º de operación cuya suma es el importe del movimiento (un pago, varias facturas)
      select count(*), coalesce(sum(t.monto), 0), (array_agg(t.id order by t.fecha, t.numero))[1] into v_n, v_suma, v_trx from transacciones t
       where t.tenant_id = m.tenant_id and t.cuenta_bancaria_id = p_cuenta and t.estado = 'pagada' and t.movimiento_bancario_id is null
         and ltrim(regexp_replace(coalesce(t.referencia_numero, ''), '[^0-9]', '', 'g'), '0') = v_ope
         and ((m.importe < 0 and t.tipo = 'egreso') or (m.importe > 0 and t.tipo = 'ingreso'))
         and abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) <= 10;
      if v_n > 1 and abs(abs(m.importe) - v_suma) <= 0.05 then
        update transacciones t set movimiento_bancario_id = m.id, conciliado_en = now()
         where t.tenant_id = m.tenant_id and t.cuenta_bancaria_id = p_cuenta and t.estado = 'pagada' and t.movimiento_bancario_id is null
           and ltrim(regexp_replace(coalesce(t.referencia_numero, ''), '[^0-9]', '', 'g'), '0') = v_ope
           and ((m.importe < 0 and t.tipo = 'egreso') or (m.importe > 0 and t.tipo = 'ingreso'))
           and abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) <= 10;
        update movimientos_bancarios set transaccion_id = v_trx, conciliado_en = now(), conciliado_por = 'auto:operacion-grupo(' || v_n || ')', clasificacion = case when m.importe < 0 then 'pago_proveedor' else 'abono' end where id = m.id;
        n_grp := n_grp + 1; continue;
      end if;
      v_trx := null;
    end if;
    -- c) mismo importe a ±3 días
    select t.id into v_trx from transacciones t
     where t.tenant_id = m.tenant_id and t.cuenta_bancaria_id = p_cuenta and t.estado = 'pagada' and t.movimiento_bancario_id is null
       and ((m.importe < 0 and t.tipo = 'egreso') or (m.importe > 0 and t.tipo = 'ingreso'))
       and abs(abs(m.importe) - t.monto) <= 0.01
       and abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) <= 3
     order by abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) limit 1;
    if v_trx is not null then
      update movimientos_bancarios set transaccion_id = v_trx, conciliado_en = now(), conciliado_por = 'auto:importe', clasificacion = case when m.importe < 0 then 'pago_proveedor' else 'abono' end where id = m.id;
      update transacciones set movimiento_bancario_id = m.id, conciliado_en = now() where id = v_trx;
      n_imp := n_imp + 1;
    end if;
  end loop;
  return jsonb_build_object('por_operacion', n_op, 'por_grupo_de_operacion', n_grp, 'por_importe', n_imp);
end $$;
