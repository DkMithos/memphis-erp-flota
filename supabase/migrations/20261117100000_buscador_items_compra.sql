-- 2026-11-17 · Kevin: "quiero buscar un ítem que se compró, una laptop, pero me sale sin resultados".
-- El buscador de la barra superior solo miraba el NÚMERO de la orden (y nombre de proyecto, proveedor, placa, cliente,
-- artículo). Lo que se compra vive en la descripción de los ítems de las órdenes y cotizaciones, que no se consultaba.
-- buscar_items_compra(término): órdenes de compra y cotizaciones cuyo ítem contiene el término, sin distinguir tildes ni
-- mayúsculas, la más reciente primero y las anuladas al final. Security invoker: manda la RLS del tenant.
create extension if not exists unaccent with schema extensions;

create or replace function public.buscar_items_compra(p_termino text, p_limite int default 6)
returns table (tipo text, numero text, estado text, descripcion text, fecha date, proveedor text, coincidencias int)
language sql stable security invoker set search_path = public, extensions as $$
  with pat as (select extensions.unaccent(lower(p_termino)) as p)
  (select 'oc'::text, o.numero, o.estado, (array_agg(i.descripcion order by i.precio_total desc nulls last))[1], o.fecha_emision::date,
          pr.razon_social, count(*)::int
     from orden_items i
     join ordenes_compra o on o.id = i.orden_id
     left join proveedores pr on pr.id = o.proveedor_id, pat
    where extensions.unaccent(lower(i.descripcion)) like pat.p
    group by o.id, o.numero, o.estado, o.fecha_emision, pr.razon_social
    order by (o.estado = 'anulada'), o.fecha_emision desc nulls last
    limit greatest(coalesce(p_limite, 6), 1))
  union all
  (select 'cotizacion'::text, c.numero, c.estado, (array_agg(i.descripcion order by i.precio_total desc nulls last))[1], c.fecha_emision::date,
          pr.razon_social, count(*)::int
     from cotizacion_items i
     join cotizaciones c on c.id = i.cotizacion_id
     left join proveedores pr on pr.id = c.proveedor_id, pat
    where extensions.unaccent(lower(i.descripcion)) like pat.p
    group by c.id, c.numero, c.estado, c.fecha_emision, pr.razon_social
    order by (c.estado in ('anulada', 'rechazada')), c.fecha_emision desc nulls last
    limit greatest(coalesce(p_limite, 6) / 2, 1));
$$;
revoke all on function public.buscar_items_compra(text, int) from public, anon;
grant execute on function public.buscar_items_compra(text, int) to authenticated;
