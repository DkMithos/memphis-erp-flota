-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 5 (1/2) · Inventario: equipamiento con número de serie (#11 del plan de carga).
-- Diseño: docs/DISENO-VIATICOS-Y-UNIDADES.md §2.
--
-- El kardex (`movimientos_inventario` / `stock_almacen`) sigue mandando en CANTIDADES.
-- Aquí se añade la trazabilidad por UNIDAD: una fila por número de serie (o una fila
-- "pendiente de serie" cuando el proveedor no la dio: arneses, lightman), con su
-- estado y dónde está (almacén, vehículo de Flota, proyecto, devuelta al proveedor),
-- y el historial de cada serie en `inventario_unidades_mov`.
--
-- Decisiones (Kevin no las había cerrado; se toman las más conservadoras y quedan
-- escritas aquí para cambiarlas si hace falta):
--   · El equipamiento instalado en un vehículo queda `instalada` (con `vehiculo_id`).
--     `entregada` al Estado es un acto aparte, con acta (`documento_salida`), porque
--     la inmatriculación y el acta no siempre van juntas.
--   · Mantienen las series quienes tengan `inventario.crear` / `inventario.editar`
--     (Logística hoy). No se crea un módulo de permisos nuevo.
--   · Mover el kardex por cantidad es OPCIONAL en cada operación (`p_kardex`): el alta
--     masiva lo hace por defecto (entrada), devolución/baja lo ofrecen (salida), y la
--     instalación/entrega NO lo tocan (el stock por proyecto se mueve con el despacho).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.inventario_unidades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  articulo_id uuid not null references articulos(id),
  serie text,                                   -- null = pendiente de serie
  lote text,
  estado text not null default 'en_almacen'
    check (estado in ('en_almacen','instalada','entregada','devuelta','en_reparacion','baja')),
  almacen_id uuid references almacenes(id),
  proyecto_id uuid references proyectos(id),
  vehiculo_id uuid references vehiculos(id),
  orden_compra_id uuid references ordenes_compra(id),
  comprobante_id uuid references comprobantes_pago(id),
  proveedor_id uuid references proveedores(id),
  valor_usd numeric(14,3),
  valor_soles numeric(14,2),
  tipo_cambio numeric(8,4),
  fecha_ingreso date not null default current_date,
  fecha_salida date,
  documento_salida text,                        -- guía de remisión / acta de entrega
  observaciones text,
  origen text,                                  -- 'excel-la-sirena', 'recepcion', 'manual'
  creado_por text default coalesce(auth.uid()::text, 'sistema'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists inventario_unidades_serie_unica
  on public.inventario_unidades (tenant_id, articulo_id, upper(serie)) where serie is not null;
create index if not exists inventario_unidades_estado_idx on public.inventario_unidades (tenant_id, estado);
create index if not exists inventario_unidades_articulo_idx on public.inventario_unidades (articulo_id);
create index if not exists inventario_unidades_vehiculo_idx on public.inventario_unidades (vehiculo_id) where vehiculo_id is not null;
create index if not exists inventario_unidades_proyecto_idx on public.inventario_unidades (proyecto_id) where proyecto_id is not null;

create table if not exists public.inventario_unidades_mov (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  unidad_id uuid not null references inventario_unidades(id) on delete cascade,
  fecha timestamptz not null default now(),
  tipo text not null check (tipo in ('ingreso','instalacion','entrega','devolucion','reparacion','baja','retorno','traslado')),
  estado_anterior text,
  estado_nuevo text,
  de text,
  a text,
  documento text,
  notas text,
  movimiento_inventario_id uuid references movimientos_inventario(id),
  usuario text default coalesce(auth.uid()::text, 'sistema')
);
create index if not exists inventario_unidades_mov_unidad_idx on public.inventario_unidades_mov (unidad_id, fecha desc);

alter table public.inventario_unidades enable row level security;
alter table public.inventario_unidades_mov enable row level security;
drop policy if exists ti_inventario_unidades on public.inventario_unidades;
create policy ti_inventario_unidades on public.inventario_unidades
  for all using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));
drop policy if exists ti_inventario_unidades_mov on public.inventario_unidades_mov;
create policy ti_inventario_unidades_mov on public.inventario_unidades_mov
  for all using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));
grant select, insert, update, delete on public.inventario_unidades, public.inventario_unidades_mov to authenticated, service_role;
revoke all on public.inventario_unidades, public.inventario_unidades_mov from anon;

-- Texto corto de "dónde está" una unidad, para el historial.
create or replace function public.unidad_ubicacion_texto(p_estado text, p_almacen uuid, p_proyecto uuid, p_vehiculo uuid, p_proveedor uuid)
returns text language sql stable set search_path = public as $$
  select concat_ws(' · ',
    case p_estado when 'en_almacen' then 'Almacén' when 'instalada' then 'Instalada' when 'entregada' then 'Entregada'
                  when 'devuelta' then 'Devuelta' when 'en_reparacion' then 'En reparación' when 'baja' then 'Baja' else p_estado end,
    (select nombre from almacenes where id = p_almacen),
    (select codigo from proyectos where id = p_proyecto),
    (select coalesce(placa, codigo) from vehiculos where id = p_vehiculo),
    (select razon_social from proveedores where id = p_proveedor));
$$;

-- ── Alta masiva ─────────────────────────────────────────────────────────────
-- p_series: una serie por elemento (ya limpias). p_sin_serie: cuántas unidades
-- entran SIN serie (p. ej. 236 arneses). Devuelve creadas, repetidas (series que ya
-- existían para ese artículo, se saltan) y el movimiento del kardex si se pidió.
create or replace function public.inventario_unidades_alta(
  p_articulo uuid, p_series text[], p_sin_serie int default 0,
  p_almacen uuid default null, p_proyecto uuid default null, p_proveedor uuid default null,
  p_comprobante uuid default null, p_orden_compra uuid default null,
  p_valor_usd numeric default null, p_valor_soles numeric default null, p_tc numeric default null,
  p_fecha date default current_date, p_lote text default null, p_documento text default null,
  p_notas text default null, p_kardex boolean default true, p_origen text default 'manual'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); a record; s text; v_id uuid; n int := 0; v_rep text[] := '{}';
        v_alm uuid; v_mov uuid; v_moneda text; v_precio numeric; v_tc numeric; v_ubic text; v_series text[] := '{}';
begin
  if not (auth_tiene_permiso('inventario', 'crear') or auth_tiene_permiso('inventario', 'editar')) then
    raise exception 'Sin permiso para registrar unidades (inventario.crear)';
  end if;
  select * into a from articulos where id = p_articulo and tenant_id = v_tenant;
  if not found then raise exception 'Artículo no encontrado'; end if;
  v_alm := coalesce(p_almacen, almacen_por_defecto(v_tenant));
  if not exists (select 1 from almacenes where id = v_alm and tenant_id = v_tenant) then raise exception 'Almacén no válido'; end if;

  -- series limpias y sin repetir dentro del mismo pedido
  foreach s in array coalesce(p_series, '{}') loop
    s := upper(trim(s));
    if s = '' or s = 'NA' or s = 'N/A' or s = 'S/N' then continue; end if;
    if s = any(v_series) then continue; end if;
    v_series := array_append(v_series, s);
  end loop;
  if cardinality(v_series) = 0 and coalesce(p_sin_serie, 0) <= 0 then raise exception 'No hay series ni cantidad sin serie'; end if;

  v_ubic := unidad_ubicacion_texto('en_almacen', v_alm, p_proyecto, null, null);

  foreach s in array v_series loop
    if exists (select 1 from inventario_unidades where tenant_id = v_tenant and articulo_id = p_articulo and upper(serie) = s) then
      v_rep := array_append(v_rep, s); continue;
    end if;
    insert into inventario_unidades (tenant_id, articulo_id, serie, lote, estado, almacen_id, proyecto_id, orden_compra_id, comprobante_id, proveedor_id,
                                     valor_usd, valor_soles, tipo_cambio, fecha_ingreso, observaciones, origen)
    values (v_tenant, p_articulo, s, nullif(p_lote, ''), 'en_almacen', v_alm, p_proyecto, p_orden_compra, p_comprobante, p_proveedor,
            p_valor_usd, p_valor_soles, p_tc, p_fecha, nullif(p_notas, ''), coalesce(p_origen, 'manual'))
    returning id into v_id;
    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_anterior, estado_nuevo, de, a, documento, notas)
    values (v_tenant, v_id, p_fecha, 'ingreso', null, 'en_almacen', null, v_ubic, nullif(p_documento, ''), nullif(p_notas, ''));
    n := n + 1;
  end loop;

  for i in 1..coalesce(p_sin_serie, 0) loop
    insert into inventario_unidades (tenant_id, articulo_id, serie, lote, estado, almacen_id, proyecto_id, orden_compra_id, comprobante_id, proveedor_id,
                                     valor_usd, valor_soles, tipo_cambio, fecha_ingreso, observaciones, origen)
    values (v_tenant, p_articulo, null, nullif(p_lote, ''), 'en_almacen', v_alm, p_proyecto, p_orden_compra, p_comprobante, p_proveedor,
            p_valor_usd, p_valor_soles, p_tc, p_fecha, concat_ws(' · ', 'Pendiente de serie', nullif(p_notas, '')), coalesce(p_origen, 'manual'))
    returning id into v_id;
    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_anterior, estado_nuevo, de, a, documento, notas)
    values (v_tenant, v_id, p_fecha, 'ingreso', null, 'en_almacen', null, v_ubic, nullif(p_documento, ''), 'Sin número de serie');
    n := n + 1;
  end loop;

  -- entrada al kardex por la cantidad creada (una sola línea)
  if p_kardex and n > 0 then
    v_moneda := case when p_valor_usd is not null then 'USD' else 'PEN' end;
    v_precio := coalesce(p_valor_usd, p_valor_soles);
    v_tc := case when v_moneda = 'USD' then coalesce(p_tc, tc_vigente(p_fecha)) else 1 end;
    v_mov := kardex_registrar(v_tenant, p_articulo, v_alm, p_proyecto, 'entrada',
                              case when p_comprobante is not null or p_orden_compra is not null then 'compra' else 'inicial' end,
                              n, v_precio, v_moneda, v_tc, 'unidades', coalesce(nullif(p_documento, ''), 'Alta de unidades'),
                              p_orden_compra, null, null,
                              concat_ws(' · ', 'Alta de ' || n || ' unidades con serie', nullif(p_documento, ''), nullif(p_notas, '')),
                              p_fecha::timestamptz, coalesce(auth.uid()::text, 'unidades'));
    update inventario_unidades_mov m set movimiento_inventario_id = v_mov
      where m.movimiento_inventario_id is null and m.tipo = 'ingreso'
        and m.unidad_id in (select id from inventario_unidades where articulo_id = p_articulo and tenant_id = v_tenant and creado_en >= now() - interval '1 minute');
  end if;

  return jsonb_build_object('creadas', n, 'repetidas', to_jsonb(v_rep), 'movimiento_kardex', v_mov);
end $$;
revoke all on function public.inventario_unidades_alta(uuid, text[], int, uuid, uuid, uuid, uuid, uuid, numeric, numeric, numeric, date, text, text, text, boolean, text) from public, anon;
grant execute on function public.inventario_unidades_alta(uuid, text[], int, uuid, uuid, uuid, uuid, uuid, numeric, numeric, numeric, date, text, text, text, boolean, text) to authenticated, service_role;

-- ── Cambio de estado (instalar, entregar, devolver, reparar, baja, retorno) ─────
-- p_ids: unidades elegidas. Reglas: `instalada` exige vehículo (el proyecto se hereda
-- del vehículo si no se manda); `entregada` exige proyecto y acta; `devuelta` exige
-- guía y proveedor (el de la unidad si no se manda); `en_almacen` es el retorno.
-- p_kardex: en devolución/baja, además da SALIDA en el kardex por cantidad (una línea
-- por artículo, desde el almacén de la unidad, stock sin proyecto).
create or replace function public.inventario_unidades_mover(
  p_ids uuid[], p_estado text, p_fecha date default current_date, p_documento text default null,
  p_proyecto uuid default null, p_vehiculo uuid default null, p_almacen uuid default null, p_proveedor uuid default null,
  p_notas text default null, p_kardex boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); u record; v_tipo text; n int := 0; v_proy uuid; v_alm uuid; v_prov uuid; v_de text; v_a text;
        v_art uuid; v_cnt int; v_mov uuid; r record; v_movs uuid[] := '{}';
begin
  if not auth_tiene_permiso('inventario', 'editar') then raise exception 'Sin permiso para mover unidades (inventario.editar)'; end if;
  if p_estado not in ('en_almacen','instalada','entregada','devuelta','en_reparacion','baja') then raise exception 'Estado no válido: %', p_estado; end if;
  if cardinality(coalesce(p_ids, '{}')) = 0 then raise exception 'No se eligió ninguna unidad'; end if;
  if p_estado = 'instalada' and p_vehiculo is null then raise exception 'Para instalar hay que indicar el vehículo'; end if;
  if p_estado in ('entregada','devuelta') and coalesce(p_documento, '') = '' then raise exception 'Hace falta el documento (acta o guía)'; end if;
  if p_vehiculo is not null and not exists (select 1 from vehiculos where id = p_vehiculo and tenant_id = v_tenant) then raise exception 'Vehículo no válido'; end if;

  v_tipo := case p_estado when 'instalada' then 'instalacion' when 'entregada' then 'entrega' when 'devuelta' then 'devolucion'
                          when 'en_reparacion' then 'reparacion' when 'baja' then 'baja' when 'en_almacen' then 'retorno' end;

  for u in select * from inventario_unidades where id = any(p_ids) and tenant_id = v_tenant loop
    if u.estado in ('baja') then raise exception 'La unidad % está dada de baja', coalesce(u.serie, u.id::text); end if;
    v_proy := coalesce(p_proyecto, case when p_vehiculo is not null then (select proyecto_id from vehiculos where id = p_vehiculo) end,
                       case when p_estado in ('instalada','entregada') then u.proyecto_id end);
    v_alm := case when p_estado = 'en_almacen' then coalesce(p_almacen, u.almacen_id) else u.almacen_id end;
    v_prov := case when p_estado = 'devuelta' then coalesce(p_proveedor, u.proveedor_id) else u.proveedor_id end;
    if p_estado = 'devuelta' and v_prov is null then raise exception 'La unidad % no tiene proveedor: indícalo para la devolución', coalesce(u.serie, u.id::text); end if;
    if p_estado = 'entregada' and v_proy is null then raise exception 'La unidad % no tiene proyecto: indica el proyecto (o el vehículo) al que se entrega', coalesce(u.serie, u.id::text); end if;

    v_de := unidad_ubicacion_texto(u.estado, u.almacen_id, u.proyecto_id, u.vehiculo_id, case when u.estado = 'devuelta' then u.proveedor_id end);
    v_a  := unidad_ubicacion_texto(p_estado, v_alm, case when p_estado = 'en_almacen' then null else v_proy end,
                                   case when p_estado = 'instalada' then p_vehiculo else null end, case when p_estado = 'devuelta' then v_prov end);

    update inventario_unidades set
      estado = p_estado,
      almacen_id = v_alm,
      proyecto_id = case when p_estado = 'en_almacen' then null else v_proy end,
      vehiculo_id = case when p_estado = 'instalada' then p_vehiculo when p_estado = 'entregada' then coalesce(p_vehiculo, u.vehiculo_id) else null end,
      proveedor_id = v_prov,
      fecha_salida = case when p_estado in ('entregada','devuelta','baja') then p_fecha when p_estado = 'en_almacen' then null else fecha_salida end,
      documento_salida = case when p_estado in ('entregada','devuelta','baja') then nullif(p_documento, '') when p_estado = 'en_almacen' then null else documento_salida end,
      observaciones = case when coalesce(p_notas, '') <> '' then concat_ws(' · ', observaciones, p_notas) else observaciones end,
      actualizado_en = now()
    where id = u.id;

    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_anterior, estado_nuevo, de, a, documento, notas)
    values (v_tenant, u.id, p_fecha, v_tipo, u.estado, p_estado, v_de, v_a, nullif(p_documento, ''), nullif(p_notas, ''));
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Ninguna de las unidades elegidas existe'; end if;

  -- salida del kardex por cantidad (devolución / baja), una línea por artículo
  if p_kardex and p_estado in ('devuelta', 'baja') then
    for r in select articulo_id, almacen_id, count(*) as cnt from inventario_unidades where id = any(p_ids) and tenant_id = v_tenant group by articulo_id, almacen_id loop
      select * into u from articulos where id = r.articulo_id;
      v_mov := kardex_registrar(v_tenant, r.articulo_id, coalesce(r.almacen_id, almacen_por_defecto(v_tenant)), null, 'salida',
                                case when p_estado = 'devuelta' then 'devolucion' else 'ajuste_negativo' end,
                                r.cnt, u.precio_unitario, u.moneda, case when coalesce(u.moneda, 'PEN') = 'USD' then tc_vigente(p_fecha) else 1 end,
                                'unidades', coalesce(nullif(p_documento, ''), p_estado), null, null, null,
                                concat_ws(' · ', case when p_estado = 'devuelta' then 'Devolución al proveedor' else 'Baja' end || ' de ' || r.cnt || ' unidades', nullif(p_documento, ''), nullif(p_notas, '')),
                                p_fecha::timestamptz, coalesce(auth.uid()::text, 'unidades'));
      v_movs := array_append(v_movs, v_mov);
      update inventario_unidades_mov m set movimiento_inventario_id = v_mov
        where m.movimiento_inventario_id is null and m.tipo = v_tipo and m.fecha = p_fecha::timestamptz
          and m.unidad_id in (select id from inventario_unidades where id = any(p_ids) and articulo_id = r.articulo_id);
    end loop;
  end if;

  return jsonb_build_object('actualizadas', n, 'estado', p_estado, 'movimientos_kardex', to_jsonb(v_movs));
end $$;
revoke all on function public.inventario_unidades_mover(uuid[], text, date, text, uuid, uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.inventario_unidades_mover(uuid[], text, date, text, uuid, uuid, uuid, uuid, text, boolean) to authenticated, service_role;

-- Completar la serie de una unidad "pendiente de serie" (o corregirla).
create or replace function public.inventario_unidad_serie(p_id uuid, p_serie text) returns void
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); s text := upper(trim(coalesce(p_serie, '')));
begin
  if not auth_tiene_permiso('inventario', 'editar') then raise exception 'Sin permiso (inventario.editar)'; end if;
  if s = '' then raise exception 'La serie no puede estar vacía'; end if;
  update inventario_unidades set serie = s, actualizado_en = now(),
         observaciones = nullif(regexp_replace(coalesce(observaciones, ''), '^Pendiente de serie( · )?', ''), '')
   where id = p_id and tenant_id = v_tenant;
  if not found then raise exception 'Unidad no encontrada'; end if;
end $$;
revoke all on function public.inventario_unidad_serie(uuid, text) from public, anon;
grant execute on function public.inventario_unidad_serie(uuid, text) to authenticated, service_role;

-- ── Vistas ──────────────────────────────────────────────────────────────────
create or replace view public.v_inventario_unidades with (security_invoker = true) as
select u.id, u.tenant_id, u.articulo_id, a.codigo as articulo_codigo, a.nombre as articulo, a.marca, a.modelo,
       u.serie, u.lote, u.estado, u.almacen_id, al.nombre as almacen,
       u.proyecto_id, p.codigo as proyecto_codigo, p.nombre as proyecto,
       u.vehiculo_id, v.codigo as vehiculo_codigo, v.placa as vehiculo_placa,
       u.proveedor_id, pr.razon_social as proveedor,
       u.comprobante_id, c.numero_completo as factura, u.orden_compra_id, oc.numero as orden_compra,
       u.valor_usd, u.valor_soles, u.tipo_cambio, u.fecha_ingreso, u.fecha_salida, u.documento_salida,
       u.observaciones, u.origen, u.creado_en, u.actualizado_en
  from inventario_unidades u
  join articulos a on a.id = u.articulo_id
  left join almacenes al on al.id = u.almacen_id
  left join proyectos p on p.id = u.proyecto_id
  left join vehiculos v on v.id = u.vehiculo_id
  left join proveedores pr on pr.id = u.proveedor_id
  left join comprobantes_pago c on c.id = u.comprobante_id
  left join ordenes_compra oc on oc.id = u.orden_compra_id;

-- Series registradas contra el kardex por cantidad: avisa diferencias por artículo.
create or replace view public.v_unidades_por_articulo with (security_invoker = true) as
select a.tenant_id, a.id as articulo_id, a.codigo as articulo_codigo, a.nombre as articulo, a.marca, a.modelo,
       count(u.id) as unidades,
       count(u.id) filter (where u.estado = 'en_almacen') as en_almacen,
       count(u.id) filter (where u.estado = 'instalada') as instaladas,
       count(u.id) filter (where u.estado = 'entregada') as entregadas,
       count(u.id) filter (where u.estado = 'devuelta') as devueltas,
       count(u.id) filter (where u.estado = 'en_reparacion') as en_reparacion,
       count(u.id) filter (where u.estado = 'baja') as bajas,
       count(u.id) filter (where u.serie is null and u.estado <> 'baja') as sin_serie,
       coalesce(a.stock_actual, 0) as stock_kardex,
       coalesce(a.stock_actual, 0) - count(u.id) filter (where u.estado in ('en_almacen','instalada','entregada','en_reparacion')) as diferencia
  from articulos a
  join inventario_unidades u on u.articulo_id = a.id
 group by a.tenant_id, a.id, a.codigo, a.nombre, a.marca, a.modelo, a.stock_actual;

grant select on public.v_inventario_unidades, public.v_unidades_por_articulo to authenticated, service_role;
revoke all on public.v_inventario_unidades, public.v_unidades_por_articulo from anon;
