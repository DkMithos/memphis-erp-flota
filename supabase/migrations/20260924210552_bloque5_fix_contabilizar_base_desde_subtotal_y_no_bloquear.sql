-- Las facturas que suben los proveedores por el portal traen subtotal/igv/total
-- pero op_gravada = 0 (factura-ingest no la llenaba): contabilizar calculaba
-- base 0 y reventaba, y como corría dentro del trigger, BLOQUEABA la
-- conformidad ("No se pudo actualizar: la factura no cuadra"). Dos arreglos:
--  1) la base sale de las op_* y, si están en cero, del subtotal (o total − IGV);
--  2) contabilizar nunca bloquea la operación de Compras: si falla, el motivo
--     queda en comprobantes_pago.contabilizacion_error y Contabilidad lo ve.
alter table public.comprobantes_pago add column if not exists contabilizacion_error text;

update public.comprobantes_pago set op_gravada = subtotal
 where coalesce(op_gravada, 0) + coalesce(op_exonerada, 0) + coalesce(op_inafecta, 0) + coalesce(op_exportacion, 0) = 0
   and coalesce(subtotal, 0) > 0 and coalesce(igv, 0) > 0;

create or replace function public.contabilizar_comprobante(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; v_tc numeric; v_cdc uuid; v_base numeric; v_igv numeric; v_total numeric; v_gasto text; v_lineas jsonb; v_asiento uuid;
        v_periodo text; v_corr int; v_nc boolean; v_dif numeric; v_base_doc numeric;
begin
  select * into c from comprobantes_pago where id = p_id;
  if not found or c.estado <> 'activo' or coalesce(c.estado_flujo, '') = 'anulada' then return null; end if;
  if c.asiento_id is not null then return c.asiento_id; end if;

  v_tc := case when c.moneda = 'USD' then (case when coalesce(c.tipo_cambio, 0) > 1 then c.tipo_cambio else tc_vigente(c.fecha_emision) end) else 1 end;
  v_cdc := cdc_de_comprobante(c.centro_costo_id, c.proyecto_id);
  -- Base en la moneda del documento: las op_*; si vienen en cero (portal), el subtotal; si no, total − IGV.
  v_base_doc := coalesce(c.op_gravada, 0) + coalesce(c.op_exonerada, 0) + coalesce(c.op_inafecta, 0) + coalesce(c.op_exportacion, 0) + coalesce(c.otros_tributos, 0);
  if v_base_doc = 0 then v_base_doc := coalesce(nullif(c.subtotal, 0), coalesce(c.total, 0) - coalesce(c.igv, 0)); end if;
  v_base := round(v_base_doc * v_tc, 2);
  v_igv := round(coalesce(c.igv, 0) * v_tc, 2);
  v_total := round(coalesce(c.total, 0) * v_tc, 2);
  v_dif := v_total - v_base - v_igv;
  if abs(v_dif) <= 0.05 then v_base := v_base + v_dif; else raise exception 'La factura % no cuadra: base %, IGV %, total %', c.numero_completo, v_base, v_igv, v_total; end if;
  v_nc := c.tipo = '07';

  if c.direccion = 'recibido' then
    v_gasto := case when c.recepcion_id is not null
                      or (c.orden_compra_id is not null and exists (select 1 from recepciones r where r.orden_id = c.orden_compra_id and r.estado <> 'rechazado'))
                    then cta_cfg(c.tenant_id, 'cta_compra_bienes') else cta_cfg(c.tenant_id, 'cta_compra_servicios') end;
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta', v_gasto, 'debe', case when v_nc then 0 else v_base end, 'haber', case when v_nc then v_base else 0 end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_igv'), 'debe', case when v_nc then 0 else v_igv end, 'haber', case when v_nc then v_igv else 0 end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_proveedores'), 'debe', case when v_nc then v_total else 0 end, 'haber', case when v_nc then 0 else v_total end, 'cdc', v_cdc));
    v_asiento := asiento_crear(c.tenant_id, c.fecha_emision,
      'Factura ' || c.numero_completo || coalesce(' · ' || c.razon_social_emisor, '') || coalesce(' · OC ' || c.orden_compra_numero, ''),
      'automatico', c.moneda, v_tc, c.tipo, c.serie, c.numero, c.ruc_emisor, c.razon_social_emisor, 'comprobantes', c.numero_completo, v_lineas, c.creado_por);
    v_periodo := to_char(c.fecha_emision, 'YYYYMM');
    if not exists (select 1 from registro_compras where comprobante_id = c.id) then
      select coalesce(max(correlativo), 0) + 1 into v_corr from registro_compras where tenant_id = c.tenant_id and periodo = v_periodo;
      insert into registro_compras (tenant_id, periodo, correlativo, fecha_emision, fecha_vencimiento, tipo_comprobante, serie, numero, tipo_doc_identidad,
        ruc_proveedor, razon_social_proveedor, base_imponible_gravada, igv, base_imponible_no_gravada, otros_tributos, importe_total, moneda, tipo_cambio, estado, comprobante_id, asiento_id)
      values (c.tenant_id, v_periodo, v_corr, c.fecha_emision, c.fecha_vencimiento, c.tipo, c.serie, c.numero, '6',
        c.ruc_emisor, coalesce(c.razon_social_emisor, 'SIN NOMBRE'), coalesce(nullif(c.op_gravada, 0), v_base_doc), coalesce(c.igv, 0),
        coalesce(c.op_exonerada, 0) + coalesce(c.op_inafecta, 0), coalesce(c.otros_tributos, 0), coalesce(c.total, 0), c.moneda, v_tc, 'activo', c.id, v_asiento);
    else
      update registro_compras set asiento_id = v_asiento where comprobante_id = c.id;
    end if;
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_clientes'), 'debe', case when v_nc then 0 else v_total end, 'haber', case when v_nc then v_total else 0 end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_ventas'), 'debe', case when v_nc then v_base else 0 end, 'haber', case when v_nc then 0 else v_base end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_igv'), 'debe', case when v_nc then v_igv else 0 end, 'haber', case when v_nc then 0 else v_igv end, 'cdc', v_cdc));
    v_asiento := asiento_crear(c.tenant_id, c.fecha_emision,
      'Venta ' || c.numero_completo || coalesce(' · ' || c.razon_social_receptor, ''),
      'automatico', c.moneda, v_tc, c.tipo, c.serie, c.numero, c.ruc_receptor, c.razon_social_receptor, 'comprobantes', c.numero_completo, v_lineas, c.creado_por);
    v_periodo := to_char(c.fecha_emision, 'YYYYMM');
    if not exists (select 1 from registro_ventas where comprobante_id = c.id) then
      select coalesce(max(correlativo), 0) + 1 into v_corr from registro_ventas where tenant_id = c.tenant_id and periodo = v_periodo;
      insert into registro_ventas (tenant_id, periodo, correlativo, fecha_emision, tipo_comprobante, serie, numero, tipo_doc_identidad_cliente, doc_identidad_cliente,
        razon_social_cliente, base_imponible_gravada, igv, base_imponible_exonerada, base_imponible_inafecta, exportacion, importe_total, moneda, tipo_cambio, estado, comprobante_id, asiento_id)
      values (c.tenant_id, v_periodo, v_corr, c.fecha_emision, c.tipo, c.serie, c.numero, '6', c.ruc_receptor,
        c.razon_social_receptor, coalesce(nullif(c.op_gravada, 0), v_base_doc), coalesce(c.igv, 0), coalesce(c.op_exonerada, 0), coalesce(c.op_inafecta, 0), coalesce(c.op_exportacion, 0),
        coalesce(c.total, 0), c.moneda, v_tc, 'activo', c.id, v_asiento);
    else
      update registro_ventas set asiento_id = v_asiento where comprobante_id = c.id;
    end if;
  end if;

  update comprobantes_pago set asiento_id = v_asiento, contabilizado = true, contabilizacion_error = null where id = c.id;
  return v_asiento;
end $$;

-- El trigger nunca bloquea a Compras: si contabilizar falla, queda el motivo.
create or replace function public.trg_comprobante_contabilizar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_al text;
begin
  if new.estado = 'anulado' or coalesce(new.estado_flujo, '') = 'anulada' then
    perform anular_contabilizacion_comprobante(new.id);
    return null;
  end if;
  if new.asiento_id is not null or new.estado <> 'activo' then return null; end if;
  v_al := cta_cfg(new.tenant_id, 'contabilizar_al');
  if new.direccion = 'emitido'
     or (v_al = 'conforme' and coalesce(new.estado_flujo, '') in ('conforme', 'programada_pago', 'pagada'))
     or (v_al = 'recibida' and coalesce(new.estado_flujo, 'recibida') not in ('observada', 'anulada')) then
    begin
      perform contabilizar_comprobante(new.id);
    exception when others then
      update comprobantes_pago set contabilizacion_error = left(SQLERRM, 500) where id = new.id;
    end;
  end if;
  return null;
end $$;
