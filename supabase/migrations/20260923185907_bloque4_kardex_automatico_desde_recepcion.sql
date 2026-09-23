-- Bloque 4 — Kardex automático: la recepción conforme ES la entrada al
-- almacén. Nadie teclea el movimiento: el artículo se resuelve (o se crea)
-- desde el ítem de la OC, el almacén es el de la recepción o el general, y el
-- movimiento lleva proyecto, OC, recepción, costo y TC. Anular la recepción
-- (o borrar el ítem) genera la salida inversa. Las salidas por consumo o
-- entrega al cliente se registran a mano con su proyecto.

-- ── Catálogo: las unidades vienen de la OC tal cual (UND, JGO, GLB…) ──────
alter table public.articulos drop constraint if exists articulos_unidad_medida_check;
alter table public.articulos add column if not exists origen text default 'manual';
comment on column public.articulos.origen is 'manual | oc (creado por el kardex a partir de un ítem de compra)';

alter table public.orden_items     add column if not exists articulo_id uuid references public.articulos(id) on delete set null;
alter table public.recepcion_items add column if not exists articulo_id uuid references public.articulos(id) on delete set null;
alter table public.recepciones     add column if not exists almacen_id  uuid references public.almacenes(id) on delete set null;

alter table public.movimientos_inventario
  add column if not exists proyecto_id       uuid references public.proyectos(id) on delete set null,
  add column if not exists orden_compra_id   uuid references public.ordenes_compra(id) on delete set null,
  add column if not exists recepcion_id      uuid references public.recepciones(id) on delete set null,
  add column if not exists recepcion_item_id uuid references public.recepcion_items(id) on delete set null,
  add column if not exists moneda            text,
  add column if not exists tipo_cambio       numeric,
  add column if not exists costo_total_soles numeric,
  add column if not exists revertido         boolean not null default false;
create index if not exists movimientos_inventario_proyecto_idx on public.movimientos_inventario(proyecto_id);
create index if not exists movimientos_inventario_recepcion_item_idx on public.movimientos_inventario(recepcion_item_id);

-- Stock por almacén Y por proyecto (lo comprado para un proyecto es de ese proyecto).
alter table public.stock_almacen add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.stock_almacen'::regclass and contype = 'u' loop
    execute format('alter table public.stock_almacen drop constraint %I', c.conname);
  end loop;
end $$;
create unique index if not exists stock_almacen_art_alm_proy_uq
  on public.stock_almacen (articulo_id, almacen_id, (coalesce(proyecto_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- ── Almacén por defecto ──────────────────────────────────────────────────
create or replace function public.almacen_por_defecto(p_tenant uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int;
begin
  select id into v_id from almacenes where tenant_id = p_tenant and estado = 'activo'
   order by (codigo = 'ALM-001') desc, creado_en limit 1;
  if v_id is not null then return v_id; end if;
  select count(*) + 1 into v_n from almacenes where tenant_id = p_tenant;
  insert into almacenes (tenant_id, nombre, codigo, tipo, estado, ubicacion)
  values (p_tenant, 'Almacén general', 'ALM-' || lpad(v_n::text, 3, '0'), 'general', 'activo', 'Creado por el kardex automático')
  returning id into v_id;
  return v_id;
end $$;

-- ── Artículo desde un ítem de compra (se busca por nombre; si no existe, nace) ──
create or replace function public.articulo_para_item(p_tenant uuid, p_descripcion text, p_unidad text, p_precio numeric, p_moneda text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_id uuid; v_n int;
begin
  v_nombre := left(regexp_replace(trim(coalesce(p_descripcion, '')), '\s+', ' ', 'g'), 200);
  if v_nombre = '' then v_nombre := 'Ítem sin descripción'; end if;
  select id into v_id from articulos where tenant_id = p_tenant and lower(nombre) = lower(v_nombre) order by activo desc, creado_en limit 1;
  if v_id is not null then return v_id; end if;
  select coalesce(max(substring(codigo from '^ART-(\d+)$')::int), 0) + 1 into v_n from articulos where tenant_id = p_tenant;
  insert into articulos (tenant_id, codigo, nombre, unidad_medida, tipo, stock_actual, stock_minimo, precio_unitario, moneda, activo, creado_por, origen)
  values (p_tenant, 'ART-' || lpad(v_n::text, 4, '0'), v_nombre, coalesce(nullif(trim(p_unidad), ''), 'UND'), 'suministro', 0, 0,
          p_precio, coalesce(p_moneda, 'PEN'), true, 'kardex', 'oc')
  returning id into v_id;
  return v_id;
end $$;

-- ── El movimiento: una sola puerta de entrada al kardex ──────────────────
create or replace function public.kardex_registrar(
  p_tenant uuid, p_articulo uuid, p_almacen uuid, p_proyecto uuid, p_tipo text, p_motivo text, p_cantidad numeric,
  p_precio numeric, p_moneda text, p_tc numeric, p_ref_tipo text, p_ref_id text,
  p_oc uuid default null, p_recepcion uuid default null, p_recepcion_item uuid default null,
  p_notas text default null, p_fecha timestamptz default now(), p_por text default 'kardex'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ant numeric; v_nuevo numeric; v_delta numeric; v_num text; v_id uuid; v_anio text; v_n int; v_costo numeric;
begin
  if coalesce(p_cantidad, 0) <= 0 then return null; end if;
  v_delta := case when p_tipo = 'entrada' or p_motivo = 'ajuste_positivo' then p_cantidad else -p_cantidad end;
  select coalesce(stock_actual, 0) into v_ant from articulos where id = p_articulo for update;
  v_nuevo := v_ant + v_delta;
  v_anio := to_char(p_fecha, 'YYYY');
  select coalesce(max(substring(numero from '^MOV-\d{4}-(\d+)$')::int), 0) + 1 into v_n
    from movimientos_inventario where tenant_id = p_tenant and numero like 'MOV-' || v_anio || '-%';
  v_num := 'MOV-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  v_costo := case when p_precio is not null then round(p_precio * p_cantidad, 2) end;
  insert into movimientos_inventario (tenant_id, articulo_id, almacen_id, numero, tipo, motivo, cantidad, stock_anterior, stock_nuevo,
    precio_unitario, costo_total, referencia_id, referencia_tipo, notas, realizado_por, fecha,
    proyecto_id, orden_compra_id, recepcion_id, recepcion_item_id, moneda, tipo_cambio, costo_total_soles)
  values (p_tenant, p_articulo, p_almacen, v_num, p_tipo, p_motivo, p_cantidad, v_ant, v_nuevo,
    p_precio, v_costo, p_ref_id, p_ref_tipo, p_notas, p_por, p_fecha,
    p_proyecto, p_oc, p_recepcion, p_recepcion_item, coalesce(p_moneda, 'PEN'), coalesce(p_tc, 1),
    case when v_costo is not null then round(v_costo * coalesce(p_tc, 1), 2) end)
  returning id into v_id;
  update articulos set stock_actual = v_nuevo where id = p_articulo;
  insert into stock_almacen (tenant_id, articulo_id, almacen_id, proyecto_id, cantidad)
  values (p_tenant, p_articulo, p_almacen, p_proyecto, v_delta)
  on conflict (articulo_id, almacen_id, (coalesce(proyecto_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  do update set cantidad = coalesce(stock_almacen.cantidad, 0) + excluded.cantidad;
  return v_id;
end $$;

-- ── Recepción → entrada ──────────────────────────────────────────────────
create or replace function public.kardex_entrada_recepcion_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it record; rec record; v_art uuid; v_alm uuid; v_tc numeric;
begin
  select * into it from recepcion_items where id = p_item;
  if not found or coalesce(it.cantidad_recibida, 0) <= 0 then return; end if;
  -- ya tiene su entrada viva
  if exists (select 1 from movimientos_inventario where recepcion_item_id = p_item and tipo = 'entrada' and not revertido) then return; end if;
  select r.id, r.numero, r.estado, r.proyecto_id, r.almacen_id, r.fecha_recepcion, r.creado_por, r.tenant_id,
         o.id as oc_id, o.numero as oc_numero, o.moneda, o.tipo_cambio, o.fecha_emision
    into rec from recepciones r join ordenes_compra o on o.id = r.orden_id where r.id = it.recepcion_id;
  if not found or rec.estado = 'rechazado' then return; end if;

  v_art := it.articulo_id;
  if v_art is null and it.orden_item_id is not null then select articulo_id into v_art from orden_items where id = it.orden_item_id; end if;
  if v_art is null then v_art := articulo_para_item(rec.tenant_id, it.descripcion, it.unidad, it.precio_unitario, rec.moneda); end if;
  update recepcion_items set articulo_id = v_art where id = it.id and articulo_id is distinct from v_art;
  if it.orden_item_id is not null then update orden_items set articulo_id = coalesce(articulo_id, v_art) where id = it.orden_item_id; end if;

  v_alm := coalesce(rec.almacen_id, almacen_por_defecto(rec.tenant_id));
  if rec.almacen_id is null then update recepciones set almacen_id = v_alm where id = rec.id; end if;
  v_tc := case when rec.moneda = 'USD' then coalesce(rec.tipo_cambio, tc_vigente(coalesce(rec.fecha_emision::date, current_date))) else 1 end;

  perform kardex_registrar(rec.tenant_id, v_art, v_alm, rec.proyecto_id, 'entrada', 'compra', it.cantidad_recibida,
    it.precio_unitario, rec.moneda, v_tc, 'recepcion', rec.numero, rec.oc_id, rec.id, it.id,
    'Recepción ' || rec.numero || ' de la OC ' || rec.oc_numero, coalesce(rec.fecha_recepcion::timestamptz, now()), coalesce(rec.creado_por::text, 'kardex'));
end $$;

-- Reversión (recepción anulada o ítem borrado): salida por devolución, misma cantidad y costo.
create or replace function public.kardex_revertir_recepcion_item(p_item uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select * from movimientos_inventario where recepcion_item_id = p_item and tipo = 'entrada' and not revertido loop
    perform kardex_registrar(m.tenant_id, m.articulo_id, m.almacen_id, m.proyecto_id, 'salida', 'devolucion', m.cantidad,
      m.precio_unitario, m.moneda, m.tipo_cambio, 'recepcion_anulada', m.referencia_id, m.orden_compra_id, m.recepcion_id, null,
      'Reversión de ' || m.numero || ': ' || p_motivo, now(), 'kardex');
    update movimientos_inventario set revertido = true where id = m.id;
  end loop;
end $$;

create or replace function public.trg_recepcion_item_kardex() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform kardex_revertir_recepcion_item(old.id, 'ítem de recepción eliminado');
    return old;
  end if;
  perform kardex_entrada_recepcion_item(new.id);
  return null;
end $$;
drop trigger if exists trg_recepcion_item_kardex_ins on public.recepcion_items;
create trigger trg_recepcion_item_kardex_ins after insert on public.recepcion_items
  for each row execute function public.trg_recepcion_item_kardex();
drop trigger if exists trg_recepcion_item_kardex_del on public.recepcion_items;
create trigger trg_recepcion_item_kardex_del before delete on public.recepcion_items
  for each row execute function public.trg_recepcion_item_kardex();

create or replace function public.trg_recepcion_kardex() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if new.estado = 'rechazado' and old.estado <> 'rechazado' then
    for it in select id from recepcion_items where recepcion_id = new.id loop
      perform kardex_revertir_recepcion_item(it.id, 'recepción anulada');
    end loop;
  elsif old.estado = 'rechazado' and new.estado <> 'rechazado' then
    for it in select id from recepcion_items where recepcion_id = new.id loop
      perform kardex_entrada_recepcion_item(it.id);
    end loop;
  end if;
  return null;
end $$;
drop trigger if exists trg_recepcion_kardex on public.recepciones;
create trigger trg_recepcion_kardex after update of estado on public.recepciones
  for each row execute function public.trg_recepcion_kardex();

-- ── Qué queda en inventario por proyecto ─────────────────────────────────
-- Cantidad neta (entradas − salidas) valorada al costo promedio de sus entradas, en soles sin IGV.
create or replace view public.v_stock_proyecto with (security_invoker = true) as
  with mov as (
    select m.tenant_id, m.proyecto_id, m.articulo_id, m.almacen_id,
           sum(case when m.tipo = 'entrada' or m.motivo = 'ajuste_positivo' then m.cantidad else -m.cantidad end) as cantidad,
           sum(m.cantidad) filter (where m.tipo = 'entrada') as cant_entradas,
           sum(coalesce(m.costo_total_soles, 0)) filter (where m.tipo = 'entrada') as costo_entradas,
           count(*) as movimientos, max(m.fecha) as ultimo_movimiento
      from public.movimientos_inventario m
     where m.proyecto_id is not null
     group by m.tenant_id, m.proyecto_id, m.articulo_id, m.almacen_id
  )
  select mov.tenant_id, mov.proyecto_id, mov.articulo_id, a.codigo, a.nombre, a.unidad_medida, mov.almacen_id, al.nombre as almacen,
         mov.cantidad, mov.movimientos, mov.ultimo_movimiento,
         case when coalesce(mov.cant_entradas, 0) > 0 then round(mov.costo_entradas / mov.cant_entradas, 4) end as costo_promedio_soles,
         case when coalesce(mov.cant_entradas, 0) > 0 then round(mov.cantidad * mov.costo_entradas / mov.cant_entradas, 2) else 0 end as valor_soles
    from mov
    join public.articulos a on a.id = mov.articulo_id
    left join public.almacenes al on al.id = mov.almacen_id
   where mov.cantidad <> 0;
grant select on public.v_stock_proyecto to authenticated;

-- ── La cadena gana el eslabón "inventario" ──────────────────────────────
drop function if exists public.proyecto_cadena(uuid);
create function public.proyecto_cadena(p_proyecto uuid)
returns table (
  proyecto_id uuid,
  presupuesto numeric, comprometido numeric, ordenes bigint,
  recepcionado numeric, recepciones bigint, ordenes_con_recepcion bigint,
  facturado numeric, facturado_en_tramite numeric, facturas bigint,
  pagado numeric, por_pagar numeric, por_pagar_vencido numeric, pagos bigint,
  valorizado numeric, valorizaciones bigint, cobrado numeric, por_cobrar numeric, cobrado_registrado numeric,
  inventario numeric, inventario_items bigint, inventario_entradas numeric, inventario_salidas numeric
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
  ), inv as (
    select coalesce(sum(s.valor_soles), 0) as valor, count(*) as items from v_stock_proyecto s where s.proyecto_id = p_proyecto
  ), invmov as (
    select coalesce(sum(m.costo_total_soles) filter (where m.tipo = 'entrada' and not m.revertido), 0) as entradas,
           coalesce(sum(m.costo_total_soles) filter (where m.tipo = 'salida' and m.motivo <> 'devolucion'), 0) as salidas
      from movimientos_inventario m where m.proyecto_id = p_proyecto
  )
  select p.id,
         coalesce(p.presupuesto, 0),
         coalesce((select sum(oc.total * oc.tc_f) from oc), 0), (select count(*) from oc),
         rec.monto, rec.n, rec.n_oc,
         fac.aceptado, fac.tramite, fac.n,
         cxp.pagado, cxp.pendiente, cxp.vencido, cxp.n,
         val.valorizado, val.n, val.cobrado, val.valorizado - val.cobrado, coalesce(p.monto_cobrado, 0),
         inv.valor, inv.items, invmov.entradas, invmov.salidas
    from proyectos p, rec, fac, cxp, val, inv, invmov
   where p.id = p_proyecto;
$$;
grant execute on function public.proyecto_cadena(uuid) to authenticated;
