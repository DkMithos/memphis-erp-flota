-- Migración aplicada en producción vía Supabase (2026-09-23).
-- version: 20260923153740  name: bloque2_partidas_en_la_cadena_de_compras
-- ============================================================================
-- BLOQUE 2 · El presupuesto como origen: la partida viaja por la cadena.
--  1) Partidas estables: única (presupuesto_id, item) + vigente. El importador
--     hace upsert por código en vez de borrar y reinsertar, así los enlaces
--     sobreviven a una nueva versión de la plantilla.
--  2) partida_id (proyecto) y presupuesto_linea_id (área) en los ítems de
--     requerimiento, cotización y orden.
--  3) v_partida_ejecucion: presupuestado / solicitado / comprometido / saldo
--     por partida hoja, en soles sin IGV (como la plantilla).
-- ============================================================================

alter table public.proyecto_presupuesto_lineas add column if not exists vigente boolean not null default true;
comment on column public.proyecto_presupuesto_lineas.vigente is 'false = la partida ya no está en la última versión de la plantilla; se conserva porque hay ítems enlazados.';
delete from public.proyecto_presupuesto_lineas a
 using public.proyecto_presupuesto_lineas b
 where a.presupuesto_id = b.presupuesto_id and a.item = b.item and a.id < b.id;
create unique index if not exists proyecto_presupuesto_lineas_item_unico on public.proyecto_presupuesto_lineas(presupuesto_id, item);

alter table public.requerimiento_items
  add column if not exists partida_id uuid references public.proyecto_presupuesto_lineas(id) on delete set null,
  add column if not exists presupuesto_linea_id uuid references public.presupuesto_lineas(id) on delete set null;
alter table public.cotizacion_items
  add column if not exists partida_id uuid references public.proyecto_presupuesto_lineas(id) on delete set null,
  add column if not exists presupuesto_linea_id uuid references public.presupuesto_lineas(id) on delete set null;
alter table public.orden_items
  add column if not exists partida_id uuid references public.proyecto_presupuesto_lineas(id) on delete set null,
  add column if not exists presupuesto_linea_id uuid references public.presupuesto_lineas(id) on delete set null;
create index if not exists idx_req_items_partida on public.requerimiento_items(partida_id) where partida_id is not null;
create index if not exists idx_cot_items_partida on public.cotizacion_items(partida_id) where partida_id is not null;
create index if not exists idx_oc_items_partida  on public.orden_items(partida_id) where partida_id is not null;
comment on column public.orden_items.partida_id is 'Partida del presupuesto del proyecto a la que se imputa el ítem (hereda del requerimiento → cotización).';
comment on column public.orden_items.presupuesto_linea_id is 'Línea del presupuesto de ÁREA (centro de costo) cuando el gasto no es de proyecto.';

create or replace view public.v_partida_ejecucion with (security_invoker = true) as
  with oc as (
    select oi.partida_id,
           sum(oi.precio_total * case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end) as comprometido,
           count(distinct o.id) as ordenes
      from public.orden_items oi
      join public.ordenes_compra o on o.id = oi.orden_id
     where oi.partida_id is not null
       and o.estado in ('aprobada','recibida_parcial','recibida_total')
     group by oi.partida_id
  ), req as (
    select ri.partida_id,
           sum(ri.cantidad * coalesce(ri.costo_estimado_unitario, 0)
               * case when r.moneda = 'USD' then tc_vigente(coalesce(r.creado_en::date, current_date)) else 1 end) as solicitado,
           count(distinct r.id) as requerimientos
      from public.requerimiento_items ri
      join public.requerimientos_compra r on r.id = ri.requerimiento_id
     where ri.partida_id is not null and r.estado <> 'anulado'
     group by ri.partida_id
  )
  select l.tenant_id, l.presupuesto_id, pp.proyecto_id, l.id as partida_id,
         l.item, l.nivel, l.es_hoja, l.vigente, l.descripcion, l.unidad, l.cantidad,
         coalesce(l.total_sin_igv, 0)                        as presupuestado,
         coalesce(req.solicitado, 0)                          as solicitado,
         coalesce(req.requerimientos, 0)                      as requerimientos,
         coalesce(oc.comprometido, 0)                         as comprometido,
         coalesce(oc.ordenes, 0)                              as ordenes,
         coalesce(l.total_sin_igv, 0) - coalesce(oc.comprometido, 0) as saldo,
         case when coalesce(l.total_sin_igv, 0) > 0 then round(coalesce(oc.comprometido, 0) / l.total_sin_igv * 100, 1) else null end as pct_comprometido,
         (coalesce(oc.comprometido, 0) > coalesce(l.total_sin_igv, 0) + 0.005) as sobregirada
    from public.proyecto_presupuesto_lineas l
    join public.proyecto_presupuestos pp on pp.id = l.presupuesto_id
    left join oc  on oc.partida_id  = l.id
    left join req on req.partida_id = l.id
   where l.es_hoja;
grant select on public.v_partida_ejecucion to authenticated;

create or replace view public.v_partidas_proyecto with (security_invoker = true) as
  select l.tenant_id, pp.proyecto_id, l.id as partida_id, l.item, l.descripcion, l.unidad, l.cantidad,
         coalesce(l.total_sin_igv, 0) as presupuestado, l.orden
    from public.proyecto_presupuesto_lineas l
    join public.proyecto_presupuestos pp on pp.id = l.presupuesto_id
   where l.es_hoja and l.vigente;
grant select on public.v_partidas_proyecto to authenticated;
