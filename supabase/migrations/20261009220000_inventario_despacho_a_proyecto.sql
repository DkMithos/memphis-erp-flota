-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 · Inventario: despacho a proyecto y transferencia entre proyectos
-- (pasos 6 y 14 del "flujo correcto" de Kevin, PLAN-DATOS-GERENCIA 10.1).
--
-- El stock vive por artículo × almacén × proyecto (`stock_almacen`). Un despacho
-- mueve ítems del almacén general (sin proyecto) a un proyecto; una transferencia
-- los mueve de un proyecto a otro. Cada línea genera dos movimientos del kardex
-- con el mismo n.º de despacho (DSP-AAAA-NNNN): una salida del origen y una
-- entrada al destino, así `v_stock_proyecto` y el costo por proyecto cuadran solos.
-- ─────────────────────────────────────────────────────────────────────────────

alter table movimientos_inventario drop constraint if exists movimientos_inventario_motivo_check;
alter table movimientos_inventario add constraint movimientos_inventario_motivo_check
  check (motivo = any (array['compra','devolucion','consumo','mantenimiento','ajuste_positivo','ajuste_negativo',
                             'transferencia_entrada','transferencia_salida','merma','inicial',
                             'despacho_proyecto','transferencia_proyecto']));

-- p_lineas: [{articulo_id, cantidad, notas?}]
create or replace function public.inventario_despachar(
  p_almacen uuid, p_proyecto_destino uuid, p_lineas jsonb,
  p_proyecto_origen uuid default null, p_referencia text default null, p_notas text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); l jsonb; a record; v_disp numeric; v_cant numeric; v_num text; v_anio text; v_n int;
        v_motivo text; v_tc numeric; v_nota text; v_dest text; v_orig text; n int := 0; v_ids uuid[] := '{}';
begin
  if not (auth_tiene_permiso('inventario', 'crear') or auth_tiene_permiso('inventario', 'editar')) then
    raise exception 'Sin permiso para despachar (inventario.crear)';
  end if;
  if p_proyecto_destino is null then raise exception 'Falta el proyecto de destino'; end if;
  if p_proyecto_origen is not null and p_proyecto_origen = p_proyecto_destino then raise exception 'El proyecto de origen y el de destino son el mismo'; end if;
  if not exists (select 1 from almacenes where id = p_almacen and tenant_id = v_tenant) then raise exception 'Almacén no válido'; end if;
  if jsonb_array_length(coalesce(p_lineas, '[]'::jsonb)) = 0 then raise exception 'No hay líneas que despachar'; end if;

  select codigo || ' · ' || nombre into v_dest from proyectos where id = p_proyecto_destino;
  if p_proyecto_origen is not null then select codigo || ' · ' || nombre into v_orig from proyectos where id = p_proyecto_origen; end if;
  v_motivo := case when p_proyecto_origen is null then 'despacho_proyecto' else 'transferencia_proyecto' end;

  -- número correlativo del despacho (una referencia para todas sus líneas)
  v_anio := to_char(now(), 'YYYY');
  select coalesce(max(substring(referencia_id from '^DSP-\d{4}-(\d+)$')::int), 0) + 1 into v_n
    from movimientos_inventario where tenant_id = v_tenant and referencia_tipo = 'despacho' and referencia_id like 'DSP-' || v_anio || '-%';
  v_num := 'DSP-' || v_anio || '-' || lpad(v_n::text, 4, '0');

  -- 1) validar todo antes de mover nada
  for l in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (l->>'cantidad')::numeric;
    select * into a from articulos where id = (l->>'articulo_id')::uuid and tenant_id = v_tenant;
    if not found then raise exception 'Artículo no encontrado (%)', l->>'articulo_id'; end if;
    if coalesce(v_cant, 0) <= 0 then raise exception 'La cantidad de % debe ser mayor a 0', a.nombre; end if;
    select coalesce(cantidad, 0) into v_disp from stock_almacen
     where articulo_id = a.id and almacen_id = p_almacen and coalesce(proyecto_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_proyecto_origen, '00000000-0000-0000-0000-000000000000'::uuid);
    if coalesce(v_disp, 0) < v_cant then
      raise exception 'Stock insuficiente de % en %: hay % y se pide %', a.nombre, coalesce(v_orig, 'el almacén general'), coalesce(v_disp, 0), v_cant;
    end if;
  end loop;

  -- 2) mover: salida del origen + entrada al destino, mismo número
  for l in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (l->>'cantidad')::numeric;
    select * into a from articulos where id = (l->>'articulo_id')::uuid;
    v_tc := case when coalesce(a.moneda, 'PEN') = 'USD' then tc_vigente(current_date) else 1 end;
    v_nota := concat_ws(' · ', v_num, case when p_proyecto_origen is null then 'Despacho a ' || v_dest else 'Transferencia de ' || v_orig || ' a ' || v_dest end,
                        nullif(p_referencia, ''), nullif(p_notas, ''), nullif(l->>'notas', ''));
    v_ids := v_ids || kardex_registrar(v_tenant, a.id, p_almacen, p_proyecto_origen, 'salida', v_motivo, v_cant, a.precio_unitario, a.moneda, v_tc,
                                       'despacho', v_num, null, null, null, v_nota, now(), coalesce(auth.uid()::text, 'despacho'));
    v_ids := v_ids || kardex_registrar(v_tenant, a.id, p_almacen, p_proyecto_destino, 'entrada', v_motivo, v_cant, a.precio_unitario, a.moneda, v_tc,
                                       'despacho', v_num, null, null, null, v_nota, now(), coalesce(auth.uid()::text, 'despacho'));
    n := n + 1;
  end loop;
  return jsonb_build_object('numero', v_num, 'lineas', n, 'movimientos', v_ids);
end $$;
grant execute on function public.inventario_despachar(uuid, uuid, jsonb, uuid, text, text) to authenticated;

-- Un despacho por fila (sus líneas agrupadas), para la pantalla.
create or replace view v_despachos as
select m.tenant_id, m.referencia_id as numero, min(m.fecha) as fecha, m.almacen_id, al.nombre as almacen,
       max(m.motivo) as motivo,
       (array_agg(m.proyecto_id) filter (where m.tipo = 'entrada'))[1] as proyecto_destino_id,
       max(pd.codigo) filter (where m.tipo = 'entrada') as proyecto_destino,
       (array_agg(m.proyecto_id) filter (where m.tipo = 'salida'))[1] as proyecto_origen_id,
       max(po.codigo) filter (where m.tipo = 'salida') as proyecto_origen,
       count(*) filter (where m.tipo = 'entrada') as lineas,
       sum(m.cantidad) filter (where m.tipo = 'entrada') as unidades,
       sum(coalesce(m.costo_total_soles, 0)) filter (where m.tipo = 'entrada') as valor_soles,
       string_agg(a.nombre || ' × ' || trim(to_char(m.cantidad, 'FM999999990.###')), ', ' order by a.nombre) filter (where m.tipo = 'entrada') as detalle,
       max(m.realizado_por) as realizado_por, max(m.notas) as notas
  from movimientos_inventario m
  join articulos a on a.id = m.articulo_id
  left join almacenes al on al.id = m.almacen_id
  left join proyectos pd on pd.id = m.proyecto_id and m.tipo = 'entrada'
  left join proyectos po on po.id = m.proyecto_id and m.tipo = 'salida'
 where m.referencia_tipo = 'despacho' and coalesce(m.revertido, false) = false
 group by m.tenant_id, m.referencia_id, m.almacen_id, al.nombre;
grant select on v_despachos to authenticated;
