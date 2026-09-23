-- transacciones.tipo_cambio tiene DEFAULT 1: el coalesce nunca llegaba al TC
-- SUNAT y una transacción en dólares quedaba con monto_soles = monto. Un TC
-- de 1 (o menos) en dólares no es un TC: se toma el del día.
create or replace function public.set_transaccion_dimension() returns trigger
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if new.comprobante_id is not null then
    select proyecto_id, centro_costo_id, orden_compra_id into v from comprobantes_pago where id = new.comprobante_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    new.centro_costo_id := coalesce(new.centro_costo_id, v.centro_costo_id);
    new.orden_compra_id := coalesce(new.orden_compra_id, v.orden_compra_id);
    if new.compromiso_id is null then
      select id into new.compromiso_id from flujo_compromisos where comprobante_id = new.comprobante_id order by importado_en desc nulls last limit 1;
    end if;
  end if;
  if new.orden_compra_id is not null then
    select proyecto_id, centro_costo_id into v from ordenes_compra where id = new.orden_compra_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    new.centro_costo_id := coalesce(new.centro_costo_id, v.centro_costo_id);
    if new.compromiso_id is null then
      select id into new.compromiso_id from flujo_compromisos
       where orden_compra_id = new.orden_compra_id and sentido = 'pagar' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'
       order by (fuente = 'erp') desc, importado_en desc nulls last limit 1;
    end if;
  end if;
  if new.valorizacion_id is not null then
    select proyecto_id into v from valorizaciones where id = new.valorizacion_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    if new.compromiso_id is null then
      select id into new.compromiso_id from flujo_compromisos where valorizacion_id = new.valorizacion_id limit 1;
    end if;
  end if;
  if new.compromiso_id is not null and (new.proyecto_id is null or new.centro_costo_id is null) then
    select proyecto_id, centro_costo_id into v from flujo_compromisos where id = new.compromiso_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    new.centro_costo_id := coalesce(new.centro_costo_id, v.centro_costo_id);
  end if;
  if coalesce(new.moneda, 'PEN') = 'USD' then
    if coalesce(new.tipo_cambio, 0) <= 1 then new.tipo_cambio := tc_vigente(coalesce(new.fecha_pago, new.fecha)); end if;
    new.monto_soles := round(new.monto * new.tipo_cambio, 2);
  else
    new.tipo_cambio := 1;
    new.monto_soles := new.monto;
  end if;
  return new;
end $$;
delete from public.transacciones where numero = 'TRX-QA-USD';
