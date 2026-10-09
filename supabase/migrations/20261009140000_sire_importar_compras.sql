-- ─────────────────────────────────────────────────────────────────────────────
-- SIRE COMPRAS → facturas del ERP · Sprint 3 (2026-10-09)
--
-- El SIRE de compras que Contabilidad descarga cada mes de SUNAT trae TODAS las
-- facturas recibidas (315 en setiembre 2026 frente a 40 en el ERP). Importarlo
-- llena `comprobantes_pago` sin esperar al portal ni a la digitación:
--   · una factura por fila (tipo 01/03; las notas de crédito 07 se cuentan y
--     se dejan para revisión), sin duplicar las que ya entraron por el portal
--     (misma serie y número, sin ceros a la izquierda);
--   · nace `conforme` (deuda real en Cuentas por pagar, el trigger
--     trg_factura_compromiso crea el compromiso) salvo que exista un pago
--     histórico que la mencione: entonces se enlaza el pago y queda `pagada`.
-- ─────────────────────────────────────────────────────────────────────────────

alter table comprobantes_pago
  add column if not exists origen text default 'portal',
  add column if not exists periodo_sire text;
create index if not exists comprobantes_pago_ruc_serie_num_idx on comprobantes_pago (tenant_id, ruc_emisor, serie, numero);

-- Enlaza una factura con el pago histórico que la menciona ("· FACTURA F040-10915").
create or replace function public.sire_enlazar_pago_historico(p_comprobante uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; v_trx uuid; v_patron text; v_comp uuid;
begin
  select * into c from comprobantes_pago where id = p_comprobante;
  if c.id is null then return null; end if;
  v_patron := '\m' || upper(c.serie) || '-0*' || ltrim(c.numero, '0') || '\M';
  select t.id into v_trx from transacciones t
   where t.tenant_id = c.tenant_id and t.referencia_tipo = 'historico_contabilidad' and t.comprobante_id is null
     and t.tipo = 'egreso' and t.estado = 'pagada'
     and upper(coalesce(t.descripcion, '')) ~ v_patron
     and (t.proveedor_nombre is null or upper(left(regexp_replace(t.proveedor_nombre, '\s', '', 'g'), 5)) = upper(left(regexp_replace(c.razon_social_emisor, '\s', '', 'g'), 5)))
   order by abs(coalesce(t.monto, 0) - coalesce(c.total, 0)) limit 1;
  if v_trx is not null then
    -- el compromiso lo creó trg_factura_compromiso al insertar la factura; se enlaza explícito
    -- para que trg_transaccion_pago recalcule y cierre factura y compromiso
    select id into v_comp from flujo_compromisos where comprobante_id = c.id order by importado_en desc nulls last limit 1;
    update transacciones set comprobante_id = c.id, compromiso_id = coalesce(v_comp, compromiso_id) where id = v_trx;
    if v_comp is not null then perform recalc_pago_compromiso(v_comp, true); end if;
    return v_trx;
  end if;
  return null;
end $$;

-- p_filas: [{periodo, fecha_emision, fecha_vencimiento, tipo, serie, numero, ruc, razon_social,
--            bi_gravada, igv, no_gravada, total, moneda, tc, detraccion, estado}]
create or replace function public.sire_importar_compras(p_filas jsonb, p_archivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; f jsonb; v_tipo text; v_serie text; v_num text; v_ruc text; v_total numeric; v_moneda text; v_tc numeric;
        v_fe date; v_fv date; v_prov uuid; v_id uuid; v_pag uuid;
        n_nuevas int := 0; n_existen int := 0; n_pagadas int := 0; n_nc int := 0; n_saltadas int := 0; n_sin_prov int := 0; v_bi numeric; v_igv numeric; v_ng numeric;
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
    select id into v_prov from proveedores where tenant_id = v_tenant and ruc = v_ruc limit 1;
    if v_prov is null then n_sin_prov := n_sin_prov + 1; end if;
    insert into comprobantes_pago (tenant_id, direccion, tipo, serie, numero, numero_completo, fecha_emision, fecha_vencimiento,
                                   ruc_emisor, razon_social_emisor, ruc_receptor, razon_social_receptor,
                                   op_gravada, op_exonerada, op_inafecta, subtotal, igv, total, moneda, tipo_cambio,
                                   tiene_detraccion, estado, estado_flujo, proveedor_id, origen, periodo_sire, conforme_en)
    values (v_tenant, 'recibido', v_tipo, v_serie, v_num, v_serie || '-' || v_num, v_fe, coalesce(v_fv, v_fe + 30),
            v_ruc, nullif(trim(f->>'razon_social'), ''), t.ruc, t.nombre,
            v_bi, 0, v_ng, v_bi + v_ng, v_igv, v_total, v_moneda, case when v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then v_tc else 1 end,
            coalesce(f->>'detraccion', '') <> '', 'activo', 'conforme', v_prov, 'sire', regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'), now())
    returning id into v_id;
    n_nuevas := n_nuevas + 1;
    v_pag := sire_enlazar_pago_historico(v_id);
    if v_pag is not null then n_pagadas := n_pagadas + 1; end if;
  end loop;
  return jsonb_build_object('nuevas', n_nuevas, 'ya_existian', n_existen, 'enlazadas_a_pago_historico', n_pagadas, 'notas_credito_omitidas', n_nc, 'saltadas', n_saltadas, 'sin_proveedor_en_directorio', n_sin_prov);
end $$;
