-- 2026-11-05 · Notas de crédito y débito de proveedores (SIRE tipos 07/08) aplicadas a su factura.
-- Contabilidad detectó (archivo "03-notas-credito-facturas-pendientes.xlsx") que el SIRE de octubre trae 6 notas de crédito
-- que anulan por completo 6 facturas que el ERP mostraba conformes y pendientes (COOPAC E001-2311 US$ 2,443,262.41,
-- OXI E001-84 S/ 1,108,458.61, AURA E001-502, SECURENET E001-6, PREMIUM REALTY E001-1, F002-261) y una nota de débito
-- de PACÍFICO (FD12-209486, S/ 2,013.76) que sube la deuda de F028-1130026. El importador saltaba los tipos 07/08.
-- Ahora:
--   · comprobantes_pago.afecta_comprobante_id: la factura que una nota modifica (del SIRE: Tipo/Serie/Nro CP Modificado).
--   · trg_factura_compromiso no crea compromiso propio para notas (07/08): la nota ajusta el compromiso de SU factura.
--   · nota_aplicar(nota): recalcula el saldo de la factura (total − NC + ND); si queda en cero la factura pasa a
--     'cancelada_nc' y su compromiso sin pagos se elimina; si no, el compromiso queda por el neto. La nota se contabiliza
--     como siempre (contabilizar_comprobante ya invierte el asiento cuando tipo = '07') y entra al registro de compras.
--   · sire_importar_compras importa las notas (abs de los importes; USD entre el TC), busca la factura por RUC + serie +
--     número modificado y la aplica. Contadores nuevos: notas_aplicadas, notas_sin_factura.

alter table public.comprobantes_pago add column if not exists afecta_comprobante_id uuid references public.comprobantes_pago(id);
create index if not exists comprobantes_pago_afecta_idx on public.comprobantes_pago (afecta_comprobante_id) where afecta_comprobante_id is not null;

-- 1) Las notas no generan compromiso propio (se parchea el trigger existente sin reescribir el resto de su lógica)
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'trg_factura_compromiso';
  v_new := replace(v_def, 'if new.direccion = ''emitido'' then return null; end if;',
                          'if new.direccion = ''emitido'' or new.tipo in (''07'', ''08'') or coalesce(new.estado_flujo, '''') = ''cancelada_nc'' then return null; end if;');
  if v_new = v_def then raise exception 'trg_factura_compromiso: no se encontró el ancla para parchear'; end if;
  execute v_new;
end $$;

-- 2) Aplicar una nota a su factura
create or replace function public.nota_aplicar(p_nota uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n record; f record; v_nc numeric; v_nd numeric; v_neto numeric; v_comp record; v_accion text;
begin
  select * into n from comprobantes_pago where id = p_nota;
  if n.id is null or n.tipo not in ('07', '08') then raise exception 'No es una nota de crédito/débito'; end if;
  if n.afecta_comprobante_id is null then return jsonb_build_object('aplicada', false, 'motivo', 'sin factura'); end if;
  select * into f from comprobantes_pago where id = n.afecta_comprobante_id;
  select coalesce(sum(total) filter (where tipo = '07'), 0), coalesce(sum(total) filter (where tipo = '08'), 0) into v_nc, v_nd
    from comprobantes_pago where afecta_comprobante_id = f.id and estado = 'activo' and coalesce(estado_flujo, '') <> 'anulada';
  v_neto := round(coalesce(f.total, 0) - v_nc + v_nd, 2);
  select * into v_comp from flujo_compromisos where comprobante_id = f.id order by importado_en desc nulls last limit 1;
  if v_neto <= 0.01 then
    -- anulada por nota de crédito: sale de Cuentas por pagar (si no tiene pagos) y de las listas de pago
    if v_comp.id is not null then
      if exists (select 1 from transacciones t where t.compromiso_id = v_comp.id and t.estado <> 'anulada') then
        update flujo_compromisos set monto_presupuestado = greatest(coalesce(monto_pagado, 0), 0.01), monto_ejecutado = greatest(coalesce(monto_pagado, 0), 0.01),
               observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Factura anulada por ' || n.numero_completo || ': ya tenía pagos, revisar devolución') where id = v_comp.id;
        perform recalc_pago_compromiso(v_comp.id, true);
      else
        delete from flujo_compromisos where id = v_comp.id;
      end if;
    end if;
    update comprobantes_pago set estado_flujo = 'cancelada_nc',
           observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Anulada por nota de crédito ' || n.numero_completo || ' del ' || n.fecha_emision || ' (' || n.moneda || ' ' || n.total || ')')
     where id = f.id;
    v_accion := 'factura cancelada';
  else
    if v_comp.id is not null then
      update flujo_compromisos set monto_presupuestado = v_neto, monto_ejecutado = v_neto,
             observaciones = concat_ws(' · ', nullif(observaciones, ''), case when n.tipo = '07' then 'NC ' else 'ND ' end || n.numero_completo || ' ' || n.moneda || ' ' || n.total || ' → saldo ' || v_neto)
       where id = v_comp.id;
      perform recalc_pago_compromiso(v_comp.id, true);
    end if;
    update comprobantes_pago set observaciones = concat_ws(' · ', nullif(observaciones, ''), case when n.tipo = '07' then 'Nota de crédito ' else 'Nota de débito ' end || n.numero_completo || ' ' || n.moneda || ' ' || n.total || ' → saldo ' || v_neto)
     where id = f.id and coalesce(observaciones, '') not like '%' || n.numero_completo || '%';
    v_accion := 'saldo ajustado';
  end if;
  return jsonb_build_object('aplicada', true, 'accion', v_accion, 'factura', f.numero_completo, 'saldo', v_neto);
end $$;
revoke all on function public.nota_aplicar(uuid) from public, anon;
grant execute on function public.nota_aplicar(uuid) to authenticated;

-- 3) El importador del SIRE trae las notas y las aplica
create or replace function public.sire_importar_compras(p_filas jsonb, p_archivo text default null, p_corte text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; f jsonb; v_tipo text; v_serie text; v_num text; v_ruc text; v_total numeric; v_moneda text; v_tc numeric;
        v_fe date; v_fv date; v_prov uuid; v_id uuid; v_pag uuid; v_periodo text; v_estado text; v_ef text; v_pp numeric; v_pm numeric;
        n_nuevas int := 0; n_existen int := 0; n_pagadas int := 0; n_nc int := 0; n_saltadas int := 0; n_sin_prov int := 0; n_hist int := 0; n_parcial int := 0;
        n_notas int := 0; n_notas_sin_factura int := 0; v_bi numeric; v_igv numeric; v_ng numeric; v_mod_serie text; v_mod_num text; v_mod_tipo text; v_afecta uuid;
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
    -- Las notas de crédito vienen en negativo: se guardan en positivo (el tipo 07 ya dice que restan).
    if v_tipo = '07' then v_total := abs(v_total); v_bi := abs(v_bi); v_igv := abs(v_igv); v_ng := abs(v_ng); end if;
    begin
      v_fe := nullif(left(f->>'fecha_emision', 10), '')::date;
      v_fv := nullif(left(f->>'fecha_vencimiento', 10), '')::date;
    exception when others then v_fe := null; v_fv := null; end;
    if v_serie = '' or v_num = '' or v_ruc = '' or v_fe is null or v_total is null or v_total <= 0 then n_saltadas := n_saltadas + 1; continue; end if;
    if exists (select 1 from comprobantes_pago where tenant_id = v_tenant and tipo = v_tipo and upper(serie) = v_serie and ltrim(numero, '0') = ltrim(v_num, '0') and (ruc_emisor is null or ruc_emisor = v_ruc)) then
      n_existen := n_existen + 1; continue;
    end if;
    v_periodo := nullif(regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'), '');
    if v_periodo is null then v_periodo := to_char(v_fe, 'YYYYMM'); end if;
    select id into v_prov from proveedores where tenant_id = v_tenant and ruc = v_ruc limit 1;

    -- ── Notas de crédito / débito: se amarran a la factura que modifican y se aplican ──
    if v_tipo in ('07', '08') then
      v_mod_serie := upper(trim(coalesce(f->>'mod_serie', '')));
      v_mod_num := regexp_replace(coalesce(f->>'mod_numero', ''), '[^0-9]', '', 'g');
      v_mod_tipo := lpad(regexp_replace(coalesce(f->>'mod_tipo', ''), '[^0-9]', '', 'g'), 2, '0');
      v_afecta := null;
      if v_mod_serie <> '' and v_mod_num <> '' then
        select id into v_afecta from comprobantes_pago
         where tenant_id = v_tenant and direccion = 'recibido' and ruc_emisor = v_ruc and upper(serie) = v_mod_serie and ltrim(numero, '0') = ltrim(v_mod_num, '0')
           and tipo not in ('07', '08') and coalesce(estado_flujo, '') <> 'anulada' order by fecha_emision desc limit 1;
      end if;
      perform set_config('app.sin_asiento', case when v_periodo < '202601' or v_afecta is null then '1' else '0' end, true);
      insert into comprobantes_pago (tenant_id, direccion, tipo, serie, numero, numero_completo, fecha_emision, fecha_vencimiento,
                                     ruc_emisor, razon_social_emisor, ruc_receptor, razon_social_receptor,
                                     op_gravada, op_exonerada, op_inafecta, subtotal, igv, total, moneda, tipo_cambio,
                                     tiene_detraccion, estado, estado_flujo, proveedor_id, origen, periodo_sire, conforme_en, afecta_comprobante_id, observaciones)
      values (v_tenant, 'recibido', v_tipo, v_serie, v_num, v_serie || '-' || v_num, v_fe, coalesce(v_fv, v_fe),
              v_ruc, nullif(trim(f->>'razon_social'), ''), t.ruc, t.nombre,
              v_bi, 0, v_ng, v_bi + v_ng, v_igv, v_total, v_moneda, case when v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then v_tc else 1 end,
              false, 'activo', case when v_afecta is null then 'recibida' else 'conforme' end, v_prov, 'sire', v_periodo, case when v_afecta is null then null else now() end, v_afecta,
              case when v_tipo = '07' then 'Nota de crédito' else 'Nota de débito' end || coalesce(' tipo ' || nullif(f->>'tipo_nota', ''), '')
              || case when v_mod_serie <> '' then ' sobre ' || coalesce(nullif(v_mod_tipo, '00'), '01') || ' ' || v_mod_serie || '-' || ltrim(v_mod_num, '0') else '' end
              || case when v_afecta is null then ' · factura no encontrada en el ERP: aplicar a mano' else '' end)
      returning id into v_id;
      n_nuevas := n_nuevas + 1;
      if v_afecta is null then n_notas_sin_factura := n_notas_sin_factura + 1;
      else perform nota_aplicar(v_id); n_notas := n_notas + 1; end if;
      continue;
    end if;

    v_estado := case when p_corte is not null and v_periodo < p_corte then 'historica' else 'conforme' end;
    -- los periodos anteriores a 2026 ya están contabilizados fuera del ERP: sin asiento
    perform set_config('app.sin_asiento', case when v_periodo < '202601' then '1' else '0' end, true);
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
                            'notas_aplicadas', n_notas, 'notas_sin_factura', n_notas_sin_factura, 'notas_credito_omitidas', 0, 'saltadas', n_saltadas, 'sin_proveedor_en_directorio', n_sin_prov);
end $$;
