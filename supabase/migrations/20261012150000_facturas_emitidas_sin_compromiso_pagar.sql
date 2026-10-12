-- ─────────────────────────────────────────────────────────────────────────────
-- Semana 1 del plan de carga (2026-10-12): una factura EMITIDA (venta) no es
-- deuda por pagar. `trg_factura_compromiso` no miraba `direccion` y, al cargar
-- el SIRE de ventas, habría creado compromisos "pagar" por cada factura al
-- Estado. El lado de cobro lo llevan las valorizaciones (compromisos `cobrar`);
-- la factura emitida solo se enlaza a ellas. Bloqueo documentado en
-- docs/PLAN-CARGA-DATOS-ERP.md (#5).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_factura_compromiso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_area text; v_cc record; v_venc_oc date;
begin
  if new.direccion = 'emitido' then return null; end if;
  if new.estado_flujo = 'anulada' then
    update flujo_compromisos set comprobante_id = null, desfase_dias = null,
           origen = case when orden_compra_id is not null then 'comprometido' else origen end
     where comprobante_id = new.id;
    return null;
  end if;
  if new.estado_flujo = 'historica' then
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
    -- la factura ahora también propaga su dimensión al compromiso (semana 1: CDC heredado del pago)
    centro_costo_id = coalesce(excluded.centro_costo_id, flujo_compromisos.centro_costo_id),
    proyecto_id = coalesce(excluded.proyecto_id, flujo_compromisos.proyecto_id),
    cdc = coalesce(excluded.cdc, flujo_compromisos.cdc),
    area = case when excluded.proyecto_id is not null then 'PROYECTOS' else flujo_compromisos.area end,
    proveedor_id = coalesce(excluded.proveedor_id, flujo_compromisos.proveedor_id),
    estado_pago = case when new.estado_flujo = 'pagada' then 'PAGADO' else flujo_compromisos.estado_pago end;
  return null;
end $$;

-- El trigger debe correr también cuando cambia el proveedor (lo hereda el compromiso).
drop trigger if exists trg_factura_compromiso on comprobantes_pago;
create trigger trg_factura_compromiso after insert or update of estado_flujo, orden_compra_id, fecha_vencimiento, total, proyecto_id, centro_costo_id, proveedor_id
  on comprobantes_pago for each row execute function trg_factura_compromiso();
