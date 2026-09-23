-- Antes de firmar una OC, quien aprueba ve si alguna de sus partidas se pasa
-- del presupuesto de Operaciones. Misma regla que v_partida_ejecucion (con IGV,
-- USD al TC de cada orden); "otras" excluye a la propia orden por si ya cuenta.
create or replace function public.oc_partidas_sobregiro(p_oc uuid)
returns table (
  partida_id uuid, item text, descripcion text,
  presupuestado numeric, comprometido_otras numeric, esta_orden numeric, exceso numeric, sobregira boolean
)
language sql stable security invoker set search_path = public as $$
  with esta as (
    select oi.partida_id,
           sum(oi.precio_total
               * (1 + case when coalesce(o.regimen_igv, 'gravado') = 'gravado' then 0.18 else 0 end)
               * case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end) as monto
      from orden_items oi join ordenes_compra o on o.id = oi.orden_id
     where o.id = p_oc and oi.partida_id is not null
     group by oi.partida_id
  ), otras as (
    select oi.partida_id,
           sum(oi.precio_total
               * (1 + case when coalesce(o.regimen_igv, 'gravado') = 'gravado' then 0.18 else 0 end)
               * case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end) as monto
      from orden_items oi join ordenes_compra o on o.id = oi.orden_id
     where o.id <> p_oc and oi.partida_id in (select partida_id from esta)
       and o.estado in ('aprobada','recibida_parcial','recibida_total')
     group by oi.partida_id
  )
  select l.id, l.item, l.descripcion,
         coalesce(l.total_con_igv, l.total_sin_igv * (1 + coalesce(l.igv_tasa, 0.18)), 0) as presupuestado,
         coalesce(ot.monto, 0) as comprometido_otras,
         e.monto as esta_orden,
         coalesce(ot.monto, 0) + e.monto - coalesce(l.total_con_igv, l.total_sin_igv * (1 + coalesce(l.igv_tasa, 0.18)), 0) as exceso,
         (coalesce(ot.monto, 0) + e.monto > coalesce(l.total_con_igv, l.total_sin_igv * (1 + coalesce(l.igv_tasa, 0.18)), 0) + 0.005) as sobregira
    from esta e
    join proyecto_presupuesto_lineas l on l.id = e.partida_id
    left join otras ot on ot.partida_id = e.partida_id
   order by l.orden;
$$;
grant execute on function public.oc_partidas_sobregiro(uuid) to authenticated;
