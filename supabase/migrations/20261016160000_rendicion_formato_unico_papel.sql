-- 2026-10-16 · Carolina: las rendiciones siguen en PAPEL. El trabajador entrega el Formato Único de Reembolso y Liquidación
-- (Anexo 2 de la política, el Excel de Administración) impreso, firmado y con todas las facturas y boletas.
-- El ERP imprime ese formato con lo que el viajero cargó en la app, y la aprobación final de Administración exige que el
-- papel esté recibido (`papel_recibido_en`). Datos nuevos del formato: banco, cuenta, CCI y moneda del reembolso; en la
-- planilla de movilidad, lugar de origen y destino de cada desplazamiento.

alter table public.viaje_rendiciones
  add column if not exists banco text,
  add column if not exists cuenta text,
  add column if not exists cci text,
  add column if not exists moneda_reembolso text not null default 'PEN',
  add column if not exists formato_impreso_en timestamptz,
  add column if not exists papel_recibido_en timestamptz,
  add column if not exists papel_recibido_por uuid;
alter table public.viaje_rendicion_items
  add column if not exists lugar_origen text,
  add column if not exists lugar_destino text;

-- Guardar (borrador) ahora recibe los datos bancarios y el origen/destino de la movilidad.
create or replace function public.rendicion_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); v_uid uuid := auth.uid(); pa record; v record; r_id uuid; q jsonb; v_num text; v_anio text; v_n int; v_gast numeric := 0;
begin
  select * into pa from viaje_pasajeros where id = (p->>'pasajero_id')::uuid and tenant_id = v_tenant;
  if not found then raise exception 'Viajero no encontrado'; end if;
  select * into v from viajes where id = pa.viaje_id;
  if not (pa.user_id = v_uid or v.solicitado_por = v_uid or auth_tiene_permiso('viajes', 'editar')) then raise exception 'Solo el viajero (o Administración) puede rendir'; end if;
  if v.estado not in ('aprobado', 'en_curso', 'rendido') then raise exception 'El viaje debe estar aprobado para rendir (está %)', v.estado; end if;

  select id into r_id from viaje_rendiciones where viaje_id = v.id and pasajero_id = pa.id;
  if r_id is null then
    v_anio := to_char(current_date, 'YYYY');
    select coalesce(max(substring(numero from '^RD-\d{4}-(\d+)$')::int), 0) + 1 into v_n from viaje_rendiciones where tenant_id = v_tenant and numero like 'RD-' || v_anio || '-%';
    v_num := 'RD-' || v_anio || '-' || lpad(v_n::text, 4, '0');
    insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, notas, banco, cuenta, cci, moneda_reembolso)
    values (v_tenant, v.id, pa.id, v_num, coalesce(nullif(p->>'fecha', '')::date, current_date), 'borrador', nullif(p->>'notas', ''),
            nullif(p->>'banco', ''), nullif(p->>'cuenta', ''), nullif(p->>'cci', ''), coalesce(nullif(p->>'moneda_reembolso', ''), 'PEN')) returning id into r_id;
  else
    if exists (select 1 from viaje_rendiciones where id = r_id and estado not in ('borrador', 'observada')) then raise exception 'La rendición ya fue presentada; pide a Administración que la observe para corregirla'; end if;
    update viaje_rendiciones set fecha = coalesce(nullif(p->>'fecha', '')::date, fecha), notas = coalesce(nullif(p->>'notas', ''), notas), estado = 'borrador',
           banco = coalesce(nullif(p->>'banco', ''), banco), cuenta = coalesce(nullif(p->>'cuenta', ''), cuenta), cci = coalesce(nullif(p->>'cci', ''), cci),
           moneda_reembolso = coalesce(nullif(p->>'moneda_reembolso', ''), moneda_reembolso), actualizado_en = now() where id = r_id;
    delete from viaje_rendicion_items where rendicion_id = r_id;
  end if;

  for q in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    if coalesce((q->>'monto')::numeric, 0) <= 0 then continue; end if;
    insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, comprobante_numero, ruc, proveedor_nombre, moneda, monto, tc, sustentado, foto_path, lugar_origen, lugar_destino, creado_por)
    values (v_tenant, r_id, coalesce(nullif(q->>'fecha', '')::date, current_date), coalesce(nullif(q->>'tipo_gasto', ''), 'otro'), nullif(q->>'descripcion', ''),
            coalesce(nullif(q->>'comprobante_tipo', ''), 'sin_comprobante'), nullif(q->>'comprobante_numero', ''), nullif(q->>'ruc', ''), nullif(q->>'proveedor_nombre', ''),
            coalesce(nullif(q->>'moneda', ''), 'PEN'), (q->>'monto')::numeric,
            case when coalesce(nullif(q->>'moneda', ''), 'PEN') = 'USD' then coalesce((q->>'tc')::numeric, tc_vigente(coalesce(nullif(q->>'fecha', '')::date, current_date))) else 1 end,
            coalesce((q->>'sustentado')::boolean, coalesce(nullif(q->>'comprobante_tipo', ''), 'sin_comprobante') <> 'sin_comprobante'), nullif(q->>'foto_path', ''),
            nullif(q->>'lugar_origen', ''), nullif(q->>'lugar_destino', ''), v_uid);
  end loop;
  select coalesce(sum(monto_soles), 0) into v_gast from viaje_rendicion_items where rendicion_id = r_id;
  update viaje_rendiciones set gastado = v_gast, entregado = pa.adelanto_entregado, saldo = v_gast - pa.adelanto_entregado where id = r_id;
  return jsonb_build_object('id', r_id, 'gastado', v_gast, 'entregado', pa.adelanto_entregado, 'saldo', v_gast - pa.adelanto_entregado);
end $$;

-- El viajero (o quien la ve) deja constancia de que imprimió el formato.
create or replace function public.rendicion_marcar_impreso(p_rendicion uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update viaje_rendiciones r set formato_impreso_en = now()
   where r.id = p_rendicion and r.tenant_id = auth_tenant_id() and viaje_puede_ver(r.viaje_id);
end $$;
revoke all on function public.rendicion_marcar_impreso(uuid) from public, anon;
grant execute on function public.rendicion_marcar_impreso(uuid) to authenticated, service_role;

-- Administración marca que recibió el Formato Único en papel con los comprobantes (o lo desmarca).
create or replace function public.rendicion_papel_recibido(p_rendicion uuid, p_recibido boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_tiene_permiso('viajes', 'editar') then raise exception 'Sin permiso (viajes.editar)'; end if;
  update viaje_rendiciones set papel_recibido_en = case when p_recibido then now() end, papel_recibido_por = case when p_recibido then auth.uid() end, actualizado_en = now()
   where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
end $$;
revoke all on function public.rendicion_papel_recibido(uuid, boolean) from public, anon;
grant execute on function public.rendicion_papel_recibido(uuid, boolean) to authenticated, service_role;

-- La aprobación final exige el papel recibido.
create or replace function public.rendicion_aprobar(p_rendicion uuid, p_ok boolean, p_comentario text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v record; pa record;
begin
  if not auth_tiene_permiso('viajes', 'aprobar_final') then raise exception 'La aprobación final es de Administración (viajes.aprobar_final)'; end if;
  select * into r from viaje_rendiciones where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
  if r.estado not in ('revisada_jefatura', 'presentada') then raise exception 'La rendición está % y no admite aprobación final', r.estado; end if;
  if r.estado = 'presentada' and not auth_tiene_permiso('viajes', 'aprobar') then raise exception 'Primero debe revisarla la jefatura'; end if;
  if p_ok and r.papel_recibido_en is null then raise exception 'Falta el Formato Único en papel con las facturas y boletas: márcalo como recibido antes de aprobar'; end if;
  select * into v from viajes where id = r.viaje_id;
  select * into pa from viaje_pasajeros where id = r.pasajero_id;
  if p_ok then
    update viaje_rendiciones set estado = case when r.resultado = 'cuadra' then 'liquidada' else 'aprobada' end, aprobada_por = auth.uid(), aprobada_en = now(),
           comentario_aprobacion = nullif(p_comentario, ''), liquidada_en = case when r.resultado = 'cuadra' then now() end, actualizado_en = now() where id = r.id;
    perform viaje_notificar(r.tenant_id, 'rendicion_aprobada', 'Rendición ' || r.numero || ' aprobada',
                            case r.resultado when 'empresa_reembolsa' then 'Reembolsar S/ ' || to_char(r.saldo, 'FM999G999D00') || ' a ' || pa.nombre
                                             when 'trabajador_devuelve' then pa.nombre || ' devuelve S/ ' || to_char(-r.saldo, 'FM999G999D00') else 'Cuadra con el adelanto' end, v.id);
    perform viaje_cerrar_si_corresponde(v.id);
    return jsonb_build_object('estado', case when r.resultado = 'cuadra' then 'liquidada' else 'aprobada' end, 'resultado', r.resultado, 'saldo', r.saldo);
  else
    if coalesce(p_comentario, '') = '' then raise exception 'Escribe qué hay que corregir'; end if;
    update viaje_rendiciones set estado = 'observada', aprobada_por = auth.uid(), aprobada_en = now(), observacion = p_comentario, actualizado_en = now() where id = r.id;
    perform viaje_notificar(r.tenant_id, 'rendicion_observada', 'Rendición ' || r.numero || ' observada por Administración', p_comentario, v.id);
    return jsonb_build_object('estado', 'observada');
  end if;
end $$;

-- La vista v_viaje_rendiciones usa r.*: se recrea (drop + create, porque cambian columnas en medio) para que vea las nuevas.
drop view if exists public.v_viaje_rendiciones;
create view public.v_viaje_rendiciones with (security_invoker = true) as
select r.*, pa.nombre as viajero, pa.user_id as viajero_user_id, pa.viatico_aprobado, pa.adelanto_entregado, pa.dni as viajero_dni,
       v.numero as viaje_numero, v.destino, v.fecha_salida, v.fecha_retorno, v.proyecto_id, p.codigo as proyecto_codigo, p.nombre as proyecto_nombre, v.estado as viaje_estado,
       (select count(*) from viaje_rendicion_items i where i.rendicion_id = r.id) as items,
       (select count(*) from viaje_rendicion_items i where i.rendicion_id = r.id and not i.sustentado) as items_sin_sustento
  from viaje_rendiciones r
  join viaje_pasajeros pa on pa.id = r.pasajero_id
  join viajes v on v.id = r.viaje_id
  left join proyectos p on p.id = v.proyecto_id;
grant select on public.v_viaje_rendiciones to authenticated, service_role;
revoke all on public.v_viaje_rendiciones from anon;
