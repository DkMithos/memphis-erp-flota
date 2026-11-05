-- 2026-11-05 · Kevin: "Sí, aplícalo". El SIRE de SUNAT (propuesta RCE) expresa en SOLES los importes de los comprobantes
-- en moneda extranjera y pone el tipo de cambio en la fila. sire_importar_compras/ventas los guardaron tal cual con
-- moneda 'USD', y el ERP (compromisos, Dirección, asientos) los multiplicaba por el TC otra vez. Prueba: las 71 facturas
-- del portal en USD que también están en el SIRE cuadran como total_SIRE / TC; las FP30 de Perumotor dan las tarifas
-- del contrato (222.67, 328.46, 365.54) al dividir; los pagos históricos en USD coinciden con total / TC.
-- 1) Las funciones de importación dividen entre el TC cuando moneda = 'USD' y TC > 1 (si el archivo trae TC = 1, ya
--    viene en USD: no se toca). 2) Se corrigen las 1,777 filas ya cargadas (origen 'sire', USD, TC > 1): total, subtotal,
--    bases e IGV entre el TC; el trigger de compromisos recalcula montos; los asientos de las contabilizadas se anulan y
--    se vuelven a generar, y el registro de compras/ventas se reactiva con los importes corregidos.
-- La función de 2 parámetros (versión vieja) se elimina para que nadie importe sin la conversión.

drop function if exists public.sire_importar_compras(jsonb, text);

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
    -- El SIRE de SUNAT expresa en SOLES los comprobantes en moneda extranjera (y da el TC en la fila): se pasa a la
    -- moneda del documento aquí, una sola vez, para que total/igv/bases queden en USD como en el portal y las OC.
    if v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then
      v_total := round(v_total / v_tc, 2); v_bi := round(v_bi / v_tc, 2); v_igv := round(v_igv / v_tc, 2); v_ng := round(v_ng / v_tc, 2);
    end if;
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

create or replace function public.sire_importar_ventas(p_filas jsonb, p_archivo text default null, p_corte text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; f jsonb; v_tipo text; v_serie text; v_num text; v_ruc text; v_total numeric; v_moneda text; v_tc numeric;
        v_fe date; v_fv date; v_cli uuid; v_periodo text; v_estado text; v_bi numeric; v_igv numeric; v_ex numeric; v_inaf numeric; v_otros numeric;
        v_obs text; n_nuevas int := 0; n_existen int := 0; n_nc int := 0; n_saltadas int := 0; n_sin_cli int := 0; n_hist int := 0;
begin
  if not (auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('compras', 'editar')) then
    raise exception 'Sin permiso para importar el SIRE de ventas (contabilidad.editar)';
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
    v_ex := coalesce(nullif(regexp_replace(coalesce(f->>'exonerado', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_inaf := coalesce(nullif(regexp_replace(coalesce(f->>'inafecto', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_otros := coalesce(nullif(regexp_replace(coalesce(f->>'otros_tributos', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    begin
      v_fe := nullif(left(f->>'fecha_emision', 10), '')::date;
      v_fv := nullif(left(f->>'fecha_vencimiento', 10), '')::date;
    exception when others then v_fe := null; v_fv := null; end;
    -- El SIRE trae las notas de crédito con signo negativo: se guardan en positivo (el tipo 07 ya dice que restan).
    if v_tipo = '07' then v_total := abs(v_total); v_bi := abs(v_bi); v_igv := abs(v_igv); v_ex := abs(v_ex); v_inaf := abs(v_inaf); v_otros := abs(v_otros); end if;
    -- El SIRE de SUNAT expresa en SOLES los comprobantes en moneda extranjera: se pasa a la moneda del documento.
    if v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then
      v_total := round(v_total / v_tc, 2); v_bi := round(v_bi / v_tc, 2); v_igv := round(v_igv / v_tc, 2);
      v_ex := round(v_ex / v_tc, 2); v_inaf := round(v_inaf / v_tc, 2); v_otros := round(v_otros / v_tc, 2);
    end if;
    if v_tipo not in ('01', '03', '07', '08') or v_serie = '' or v_num = '' or v_ruc = '' or v_fe is null or v_total is null or v_total <= 0 then
      n_saltadas := n_saltadas + 1; continue;
    end if;
    if exists (select 1 from comprobantes_pago where tenant_id = v_tenant and direccion = 'emitido' and tipo = v_tipo and upper(serie) = v_serie and ltrim(numero, '0') = ltrim(v_num, '0')) then
      n_existen := n_existen + 1; continue;
    end if;
    v_periodo := nullif(regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'), '');
    if v_periodo is null then v_periodo := to_char(v_fe, 'YYYYMM'); end if;
    v_estado := case when p_corte is not null and v_periodo < p_corte then 'historica' else 'emitida' end;
    -- Ejercicios cerrados y notas de crédito/débito entran sin asiento (el cargador decide después qué hacer con las notas).
    perform set_config('app.sin_asiento', case when v_periodo < '202601' or v_tipo in ('07', '08') then '1' else '0' end, true);
    select id into v_cli from clientes where tenant_id = v_tenant and ruc = v_ruc limit 1;
    if v_cli is null then n_sin_cli := n_sin_cli + 1; end if;
    v_obs := concat_ws(' · ',
      'SIRE de ventas ' || coalesce(p_archivo, '') || ' (periodo ' || v_periodo || ')',
      case when v_tipo in ('07', '08') and coalesce(f->>'mod_serie', '') <> '' then
        case when v_tipo = '07' then 'Nota de crédito' else 'Nota de débito' end || ' tipo ' || coalesce(nullif(f->>'tipo_nota', ''), '?')
        || ' sobre ' || coalesce(nullif(f->>'mod_tipo', ''), '01') || ' ' || (f->>'mod_serie') || '-' || ltrim(coalesce(f->>'mod_numero', ''), '0') end);
    insert into comprobantes_pago (tenant_id, direccion, tipo, serie, numero, numero_completo, fecha_emision, fecha_vencimiento,
                                   ruc_emisor, razon_social_emisor, ruc_receptor, razon_social_receptor,
                                   op_gravada, op_exonerada, op_inafecta, otros_tributos, subtotal, igv, total, moneda, tipo_cambio,
                                   estado, estado_flujo, cliente_id, origen, periodo_sire, observaciones)
    values (v_tenant, 'emitido', v_tipo, v_serie, v_num, v_serie || '-' || v_num, v_fe, coalesce(v_fv, v_fe + 30),
            t.ruc, t.nombre, v_ruc, nullif(trim(f->>'razon_social'), ''),
            v_bi, v_ex, v_inaf, v_otros, v_bi + v_ex + v_inaf, v_igv, v_total, v_moneda, case when v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then v_tc else 1 end,
            'activo', v_estado, v_cli, 'sire', v_periodo, v_obs);
    n_nuevas := n_nuevas + 1;
    if v_tipo in ('07', '08') then n_nc := n_nc + 1; elsif v_estado = 'historica' then n_hist := n_hist + 1; end if;
  end loop;
  perform set_config('app.sin_asiento', '0', true);
  return jsonb_build_object('nuevas', n_nuevas, 'ya_existian', n_existen, 'notas', n_nc, 'historicas', n_hist, 'saltadas', n_saltadas, 'sin_cliente_en_directorio', n_sin_cli);
end $$;

-- ── Corrección de las filas ya cargadas ──
do $$
declare r record; n int := 0; a int := 0; e int := 0;
begin
  for r in
    select id, tipo_cambio, asiento_id, direccion from comprobantes_pago
     where origen = 'sire' and moneda = 'USD' and tipo_cambio > 1
     order by fecha_emision
  loop
    update comprobantes_pago set
      total          = round(total / tipo_cambio, 2),
      subtotal       = round(coalesce(subtotal, 0) / tipo_cambio, 2),
      op_gravada     = round(coalesce(op_gravada, 0) / tipo_cambio, 2),
      op_exonerada   = round(coalesce(op_exonerada, 0) / tipo_cambio, 2),
      op_inafecta    = round(coalesce(op_inafecta, 0) / tipo_cambio, 2),
      op_exportacion = round(coalesce(op_exportacion, 0) / tipo_cambio, 2),
      igv            = round(coalesce(igv, 0) / tipo_cambio, 2),
      otros_tributos = round(coalesce(otros_tributos, 0) / tipo_cambio, 2),
      observaciones  = concat_ws(' · ', nullif(observaciones, ''), 'Importes pasados de soles a USD el 2026-11-05 (el SIRE los trae en soles; TC ' || tipo_cambio || ')')
    where id = r.id;
    n := n + 1;
    if r.asiento_id is not null then
      perform anular_contabilizacion_comprobante(r.id);
      update comprobantes_pago set asiento_id = null, contabilizado = false, contabilizacion_error = null where id = r.id;
      begin
        perform contabilizar_comprobante(r.id);
        update comprobantes_pago set contabilizado = (asiento_id is not null) where id = r.id;
        if r.direccion = 'recibido' then
          update registro_compras rc set estado = 'activo',
            base_imponible_gravada = coalesce(nullif(c.op_gravada, 0), coalesce(c.subtotal, 0)), igv = coalesce(c.igv, 0),
            base_imponible_no_gravada = coalesce(c.op_exonerada, 0) + coalesce(c.op_inafecta, 0), otros_tributos = coalesce(c.otros_tributos, 0),
            importe_total = coalesce(c.total, 0)
          from comprobantes_pago c where c.id = rc.comprobante_id and rc.comprobante_id = r.id;
        else
          update registro_ventas rv set estado = 'activo', base_imponible_gravada = coalesce(nullif(c.op_gravada, 0), coalesce(c.subtotal, 0)), igv = coalesce(c.igv, 0),
            base_imponible_exonerada = coalesce(c.op_exonerada, 0), base_imponible_inafecta = coalesce(c.op_inafecta, 0), exportacion = coalesce(c.op_exportacion, 0),
            otros_tributos = coalesce(c.otros_tributos, 0), importe_total = coalesce(c.total, 0)
          from comprobantes_pago c where c.id = rv.comprobante_id and rv.comprobante_id = r.id;
        end if;
        a := a + 1;
      exception when others then
        e := e + 1;
        update comprobantes_pago set contabilizacion_error = left(SQLERRM, 500) where id = r.id;
      end;
    end if;
  end loop;
  raise notice 'corregidas % · asientos regenerados % · errores de contabilización %', n, a, e;
end $$;
