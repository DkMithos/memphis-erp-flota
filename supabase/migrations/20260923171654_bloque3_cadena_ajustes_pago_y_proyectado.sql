-- Dos ajustes tras probar la cadena:
-- 1) Al borrar la última transacción de un compromiso hay que volverlo a PENDIENTE
--    (el guard "sin transacciones no se toca" es para lo que trae el Excel).
-- 2) "Por pagar" del proyecto no incluye lo PROYECTADO (estimaciones del Excel):
--    solo lo real (factura) y lo comprometido (OC).
create or replace function public.recalc_pago_compromiso(p_compromiso uuid, p_forzar boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c record; v_pagado numeric; v_fecha date; v_monto numeric; v_cerrado boolean;
begin
  select * into c from flujo_compromisos where id = p_compromiso;
  if not found then return; end if;
  if not p_forzar and not exists (select 1 from transacciones where compromiso_id = p_compromiso) then return; end if;

  select coalesce(sum(case when coalesce(t.moneda, 'PEN') = coalesce(c.moneda, 'PEN') then t.monto
                           when coalesce(c.moneda, 'PEN') = 'PEN' then coalesce(t.monto_soles, t.monto * coalesce(t.tipo_cambio, 1))
                           else coalesce(t.monto_soles, t.monto) / coalesce(nullif(c.tc, 0), tc_vigente(coalesce(t.fecha_pago, t.fecha))) end), 0),
         max(coalesce(t.fecha_pago, t.fecha))
    into v_pagado, v_fecha
    from transacciones t
   where t.compromiso_id = p_compromiso and t.estado = 'pagada';

  v_monto := coalesce(c.monto_presupuestado, c.monto_ejecutado, 0);
  v_cerrado := v_monto > 0 and v_pagado >= v_monto - 0.01;

  update flujo_compromisos
     set monto_pagado = v_pagado,
         fecha_pagado = v_fecha,
         estado_pago  = case when v_cerrado then 'PAGADO' when v_pagado > 0 then 'PARCIAL' else 'PENDIENTE' end,
         origen       = case when v_pagado > 0 then 'real' when comprobante_id is not null then 'real' when orden_compra_id is not null then 'comprometido' else origen end
   where id = p_compromiso;

  if c.comprobante_id is not null then
    update comprobantes_pago
       set estado_flujo = case when v_cerrado then 'pagada' when estado_flujo = 'pagada' then 'programada_pago' else estado_flujo end
     where id = c.comprobante_id and coalesce(estado_flujo, '') in ('conforme', 'programada_pago', 'pagada');
  end if;
  if c.valorizacion_id is not null then
    update valorizaciones
       set estado = case when v_cerrado then 'pagada' when estado = 'pagada' then 'facturada' else estado end,
           fecha_pago = case when v_cerrado then v_fecha else null end
     where id = c.valorizacion_id and (v_cerrado or estado = 'pagada');
  end if;
end $$;

create or replace function public.trg_transaccion_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.compromiso_id is not null then perform recalc_pago_compromiso(old.compromiso_id, true); end if;
    return null;
  end if;
  if tg_op = 'UPDATE' and old.compromiso_id is not null and old.compromiso_id is distinct from new.compromiso_id then
    perform recalc_pago_compromiso(old.compromiso_id, true);
  end if;
  if new.compromiso_id is not null then perform recalc_pago_compromiso(new.compromiso_id, true); end if;
  return null;
end $$;

create or replace function public.proyecto_cadena(p_proyecto uuid)
returns table (
  proyecto_id uuid,
  presupuesto numeric, comprometido numeric, ordenes bigint,
  recepcionado numeric, recepciones bigint, ordenes_con_recepcion bigint,
  facturado numeric, facturado_en_tramite numeric, facturas bigint,
  pagado numeric, por_pagar numeric, por_pagar_vencido numeric, pagos bigint,
  valorizado numeric, valorizaciones bigint, cobrado numeric, por_cobrar numeric, cobrado_registrado numeric
)
language sql stable security invoker set search_path = public as $$
  with oc as (
    select o.id, o.proyecto_id, o.regimen_igv, o.moneda,
           (1 + case when coalesce(o.regimen_igv, 'gravado') = 'gravado' then 0.18 else 0 end) as igv_f,
           case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end as tc_f,
           o.total
      from ordenes_compra o
     where o.proyecto_id = p_proyecto and o.estado in ('aprobada', 'recibida_parcial', 'recibida_total')
  ), rec as (
    select coalesce(sum(ri.valor_recibido * oc.igv_f * oc.tc_f), 0) as monto,
           count(distinct r.id) as n, count(distinct r.orden_id) as n_oc
      from recepciones r
      join oc on oc.id = r.orden_id
      left join recepcion_items ri on ri.recepcion_id = r.id
     where r.estado <> 'rechazado'
  ), fac as (
    select coalesce(sum(c.total * case when c.moneda = 'USD' then coalesce(c.tipo_cambio, tc_vigente(c.fecha_emision)) else 1 end)
                    filter (where coalesce(c.estado_flujo, 'recibida') in ('conforme', 'programada_pago', 'pagada')), 0) as aceptado,
           coalesce(sum(c.total * case when c.moneda = 'USD' then coalesce(c.tipo_cambio, tc_vigente(c.fecha_emision)) else 1 end)
                    filter (where coalesce(c.estado_flujo, 'recibida') in ('recibida', 'validada')), 0) as tramite,
           count(*) filter (where coalesce(c.estado_flujo, 'recibida') not in ('anulada', 'observada')) as n
      from comprobantes_pago c
     where c.proyecto_id = p_proyecto and c.direccion = 'recibido' and c.estado = 'activo'
  ), cxp as (
    select coalesce(sum(coalesce(nullif(x.monto_pagado, 0), case when x.pagado then coalesce(x.monto_presupuestado, x.monto_ejecutado, 0) else 0 end) * x.tc_aplicado), 0) as pagado,
           coalesce(sum(x.monto_pendiente * x.tc_aplicado) filter (where not x.pagado and x.origen <> 'proyectado'), 0) as pendiente,
           coalesce(sum(x.monto_pendiente * x.tc_aplicado) filter (where x.vencido and x.origen <> 'proyectado'), 0) as vencido,
           count(*) filter (where x.pagado or coalesce(x.monto_pagado, 0) > 0) as n
      from v_cxp x
     where x.proyecto_id = p_proyecto
  ), val as (
    select coalesce(sum(v.monto * case when v.moneda = 'USD' then tc_vigente(coalesce(v.fecha_presentacion, current_date)) else 1 end)
                    filter (where v.estado in ('presentada', 'aprobada', 'facturada', 'pagada')), 0) as valorizado,
           coalesce(sum(v.monto * case when v.moneda = 'USD' then tc_vigente(coalesce(v.fecha_pago, current_date)) else 1 end)
                    filter (where v.estado = 'pagada'), 0) as cobrado,
           count(*) filter (where v.estado in ('presentada', 'aprobada', 'facturada', 'pagada')) as n
      from valorizaciones v
     where v.proyecto_id = p_proyecto
  )
  select p.id,
         coalesce(p.presupuesto, 0),
         coalesce((select sum(oc.total * oc.tc_f) from oc), 0), (select count(*) from oc),
         rec.monto, rec.n, rec.n_oc,
         fac.aceptado, fac.tramite, fac.n,
         cxp.pagado, cxp.pendiente, cxp.vencido, cxp.n,
         val.valorizado, val.n, val.cobrado, val.valorizado - val.cobrado, coalesce(p.monto_cobrado, 0)
    from proyectos p, rec, fac, cxp, val
   where p.id = p_proyecto;
$$;
