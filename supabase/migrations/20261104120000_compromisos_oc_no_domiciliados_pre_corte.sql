-- 2026-11-04 · Kevin: "crea los compromisos de las 14 OC de no domiciliados que faltan".
-- Son suscripciones de abril-junio 2026 (Supabase, Vercel, Anthropic, Google, VMEG; US$ 20-60 cada una, dos de S/ 1 y S/ 0.02)
-- aprobadas ANTES del corte de cuentas por pagar (cxp_desde = 2026-07-01), por eso `sync_compromiso_de_oc` nunca les creó
-- compromiso y, si se editara la OC, lo borraría (rama "anterior al corte": borra lo de fuente 'erp' no pagado). Para que
-- existan y sobrevivan a esa rama se insertan con la misma forma que el sync pero `fuente = 'manual'`: el sync no los toca
-- (solo borra 'erp' y solo respeta 'excel'), y la unicidad por OC es parcial sobre fuente 'erp', así que tampoco chocan.
-- Quedan PENDIENTES: Finanzas los cierra con "Registrar pago" (comprobante o referencia de la tarjeta) si ya se pagaron.
create or replace function public.compromiso_desde_oc_forzar(p_oc uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r record; v_area text; v_id uuid;
begin
  select oc.*, c.codigo as cc_codigo, c.area as cc_area, p.razon_social as prov_nombre
    into r from ordenes_compra oc
    left join centros_costo c on c.id = oc.centro_costo_id
    left join proveedores p on p.id = oc.proveedor_id
   where oc.id = p_oc;
  if not found then raise exception 'OC no encontrada'; end if;
  if r.estado not in ('aprobada', 'en_ejecucion', 'recibida_parcial', 'recibida_total', 'completada') then
    raise exception 'La OC % está %: no se compromete', r.numero, r.estado;
  end if;
  if exists (select 1 from flujo_compromisos where orden_compra_id = p_oc) then
    select id into v_id from flujo_compromisos where orden_compra_id = p_oc limit 1; return v_id;
  end if;
  v_area := case when r.proyecto_id is not null then 'PROYECTOS' else coalesce(r.cc_area, 'ADMINISTRACION') end;
  insert into flujo_compromisos (
    tenant_id, area, cdc, centro_costo_id, proyecto_id, concepto, categoria, proveedor, proveedor_id,
    moneda, tc, mes_vencimiento, fecha_vencimiento, monto_presupuestado, monto_ejecutado,
    estado_pago, sentido, origen, fuente, orden_compra_id, referencia_doc, creado_por, pago_ligado_a, vencimiento_estimado)
  values (
    r.tenant_id, v_area, r.cc_codigo, r.centro_costo_id, r.proyecto_id,
    'OC ' || r.numero || coalesce(' · ' || nullif(left(r.observaciones, 80), ''), ''),
    coalesce(r.tipo, 'oc'), r.prov_nombre, r.proveedor_id, r.moneda, r.tipo_cambio,
    date_trunc('month', coalesce(r.fecha_vencimiento_pago, r.fecha_emision::date))::date,
    coalesce(r.fecha_vencimiento_pago, r.fecha_emision::date), r.total, r.total,
    'PENDIENTE', 'pagar', 'comprometido', 'manual', r.id, r.numero, r.creado_por, r.pago_ligado_a, coalesce(r.vencimiento_estimado, false))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.compromiso_desde_oc_forzar(uuid) from public, anon;
grant execute on function public.compromiso_desde_oc_forzar(uuid) to authenticated;

do $$
declare o record; n int := 0;
begin
  for o in
    select oc.id from ordenes_compra oc join proveedores p on p.id = oc.proveedor_id
     where p.domiciliado = false and oc.estado in ('aprobada', 'en_ejecucion')
       and not exists (select 1 from flujo_compromisos f where f.orden_compra_id = oc.id)
  loop
    perform compromiso_desde_oc_forzar(o.id); n := n + 1;
  end loop;
  raise notice 'compromisos creados: %', n;
end $$;
