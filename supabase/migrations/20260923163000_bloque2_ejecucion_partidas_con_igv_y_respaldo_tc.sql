-- Ejecución por partida comparada CON IGV en ambos lados: el PRO-FOR-004 trae
-- los precios con IGV (fórmulas ×1.18) y no dice el IGV por línea, así que
-- estimar el "sin IGV" por partida sería adivinar. La OC sí sabe su régimen.
alter table public.ordenes_compra add column if not exists tipo_cambio_migracion numeric;
comment on column public.ordenes_compra.tipo_cambio_migracion is 'TC que traía la migración (3.40/3.45 por defecto) antes de re-expresar con SUNAT diario (decisión Finanzas 2026-09-23).';

drop view if exists public.v_partida_ejecucion;
create view public.v_partida_ejecucion with (security_invoker = true) as
  with oc as (
    select oi.partida_id,
           sum(oi.precio_total
               * (1 + case when coalesce(o.regimen_igv, 'gravado') = 'gravado' then 0.18 else 0 end)
               * case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end) as comprometido,
           count(distinct o.id) as ordenes
      from public.orden_items oi
      join public.ordenes_compra o on o.id = oi.orden_id
     where oi.partida_id is not null
       and o.estado in ('aprobada','recibida_parcial','recibida_total')
     group by oi.partida_id
  ), req as (
    select ri.partida_id,
           sum(ri.cantidad * coalesce(ri.costo_estimado_unitario, 0) * 1.18
               * case when r.moneda = 'USD' then tc_vigente(coalesce(r.creado_en::date, current_date)) else 1 end) as solicitado,
           count(distinct r.id) as requerimientos
      from public.requerimiento_items ri
      join public.requerimientos_compra r on r.id = ri.requerimiento_id
     where ri.partida_id is not null and r.estado <> 'anulado'
     group by ri.partida_id
  ), base as (
    select l.*, pp.proyecto_id,
           coalesce(l.total_con_igv, l.total_sin_igv * (1 + coalesce(l.igv_tasa, 0.18)), 0) as presupuestado_con_igv
      from public.proyecto_presupuesto_lineas l
      join public.proyecto_presupuestos pp on pp.id = l.presupuesto_id
     where l.es_hoja
  )
  select b.tenant_id, b.presupuesto_id, b.proyecto_id, b.id as partida_id,
         b.item, b.nivel, b.es_hoja, b.vigente, b.descripcion, b.unidad, b.cantidad,
         b.presupuestado_con_igv                               as presupuestado,
         coalesce(b.total_sin_igv, 0)                          as presupuestado_sin_igv,
         coalesce(req.solicitado, 0)                            as solicitado,
         coalesce(req.requerimientos, 0)                        as requerimientos,
         coalesce(oc.comprometido, 0)                           as comprometido,
         coalesce(oc.ordenes, 0)                                as ordenes,
         b.presupuestado_con_igv - coalesce(oc.comprometido, 0) as saldo,
         case when b.presupuestado_con_igv > 0 then round(coalesce(oc.comprometido, 0) / b.presupuestado_con_igv * 100, 1) else null end as pct_comprometido,
         (coalesce(oc.comprometido, 0) > b.presupuestado_con_igv + 0.005) as sobregirada
    from base b
    left join oc  on oc.partida_id  = b.id
    left join req on req.partida_id = b.id;
grant select on public.v_partida_ejecucion to authenticated;
