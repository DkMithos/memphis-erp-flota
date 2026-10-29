-- 2026-10-29 · Notificaciones por destinatario y según el flujo de aprobación.
--
-- Hasta hoy `notificaciones` era por tenant: todo aviso lo veía todo el mundo y cada pantalla lo filtraba por módulo.
-- Gerencia veía órdenes que todavía no le tocaba firmar, Personal veía el resumen de flota, y los avisos de viajes
-- nunca se guardaron (la función escribía 'viaje_solicitado' en `tipo`, que solo admite info/warning/error/success,
-- y el error se tragaba en silencio: 109 viajes, 0 avisos).
--
-- Ahora un aviso puede ir DIRIGIDO a personas concretas (`dirigida = true` + filas en `notificaciones_destinatarios`)
-- y solo ellas lo ven (RLS). `notif_emitir` resuelve destinatarios por usuarios, roles o permisos (modulo.accion),
-- excluye a quien hizo la acción y, si un rol/permiso no tiene a nadie, se lo entrega a los Administradores para
-- que no se pierda. Los avisos sin destinatario (generales) siguen funcionando como antes.
--
-- Flujos:
--   OC      enviada → aviso a los roles de la etapa EN TURNO (comprador → operaciones → gerencia según el monto);
--           cada firma cierra el aviso anterior y avisa a la etapa siguiente; aprobada/rechazada → avisa al comprador.
--   Viajes  solicitado → jefatura (viajes.aprobar); jefatura OK → Administración (aprobar_final) + solicitante;
--           aprobado/rechazado → solicitante y viajeros; rendición presentada → jefatura; revisada → Administración;
--           observada/aprobada → solicitante y viajero.
--   Lotes   en revisión → Contabilidad (lotes_validar); devuelto → quien lo armó; validado → Compras (lotes_armar);
--           por pagar → Tesorería (lotes_pagar); pagado → quien lo armó + Compras + Contabilidad.
--   Caja chica (approvals-dispatch) → roles del nivel. Resumen de vencimientos → quien ve Flota/Biomédico.
--   OT nueva → flota.aprobar/editar. Tarea vencida → a quien está asignada.

-- 1. Destinatarios ------------------------------------------------------------------------------------------------
alter table public.notificaciones add column if not exists dirigida boolean not null default false;

create table if not exists public.notificaciones_destinatarios (
  notificacion_id uuid not null references public.notificaciones(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  primary key (notificacion_id, user_id)
);
create index if not exists notificaciones_destinatarios_user_idx on public.notificaciones_destinatarios(user_id);
alter table public.notificaciones_destinatarios enable row level security;
drop policy if exists destinatarios_propios on public.notificaciones_destinatarios;
create policy destinatarios_propios on public.notificaciones_destinatarios
  for select to authenticated using (user_id = auth.uid());
grant select on public.notificaciones_destinatarios to authenticated;

-- RLS de notificaciones: un aviso dirigido solo lo ve su destinatario; uno general lo ve el tenant (y la campana
-- lo filtra por módulo como hasta ahora). Insertar/actualizar/borrar sigue siendo por tenant.
drop policy if exists ti_notificaciones on public.notificaciones;
drop policy if exists notif_leer on public.notificaciones;
create policy notif_leer on public.notificaciones for select to authenticated
  using (tenant_id = (select auth_tenant_id())
         and (not dirigida or exists (select 1 from public.notificaciones_destinatarios d
                                       where d.notificacion_id = notificaciones.id and d.user_id = auth.uid())));
drop policy if exists notif_insertar on public.notificaciones;
create policy notif_insertar on public.notificaciones for insert to authenticated
  with check (tenant_id = (select auth_tenant_id()));
drop policy if exists notif_actualizar on public.notificaciones;
create policy notif_actualizar on public.notificaciones for update to authenticated
  using (tenant_id = (select auth_tenant_id())) with check (tenant_id = (select auth_tenant_id()));
drop policy if exists notif_borrar on public.notificaciones;
create policy notif_borrar on public.notificaciones for delete to authenticated
  using (tenant_id = (select auth_tenant_id()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notificaciones_destinatarios') then
    alter publication supabase_realtime add table public.notificaciones_destinatarios;
  end if;
end $$;

-- 2. notif_emitir: el único punto por el que se crean avisos dirigidos ---------------------------------------------
-- p_usuarios: destinatarios explícitos. p_roles: nombres de rol. p_permisos: 'modulo.accion'. Se unen (OR).
-- p_excluir: normalmente quien hizo la acción. Si solo se dieron usuarios y ninguno queda, no se crea nada (devuelve
-- null). Si se dieron roles/permisos y nadie los tiene, lo reciben los Administradores. Sin ningún criterio, el aviso
-- es general (dirigida = false).
create or replace function public.notif_emitir(
  p_tenant uuid, p_tipo text, p_titulo text, p_mensaje text, p_entidad_tipo text, p_entidad_id text,
  p_usuarios uuid[] default null, p_roles text[] default null, p_permisos text[] default null, p_excluir uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dirigida boolean; v_dest uuid[]; v_excluir uuid[] := array_remove(coalesce(p_excluir, '{}'), null);
        v_por_rol boolean := p_roles is not null or p_permisos is not null;
begin
  if auth.uid() is not null and p_tenant is distinct from auth_tenant_id() then
    raise exception 'No se puede notificar a otro tenant';
  end if;
  v_dirigida := p_usuarios is not null or v_por_rol;
  if v_dirigida then
    select coalesce(array_agg(distinct ut.user_id), '{}') into v_dest
      from usuarios_tenant ut
     where ut.tenant_id = p_tenant and coalesce(ut.estado, 'activo') = 'activo'
       and not (ut.user_id = any(v_excluir))
       and (ut.user_id = any(array_remove(coalesce(p_usuarios, '{}'), null))
            or exists (select 1 from usuarios_roles ur join roles r on r.id = ur.rol_id
                        where ur.user_id = ut.user_id and ur.tenant_id = p_tenant
                          and lower(trim(r.nombre)) in (select lower(trim(x)) from unnest(coalesce(p_roles, '{}')) x))
            or exists (select 1 from usuarios_roles ur join roles_permisos rp on rp.rol_id = ur.rol_id join permisos p on p.id = rp.permiso_id
                        where ur.user_id = ut.user_id and ur.tenant_id = p_tenant
                          and (p.modulo || '.' || p.accion) = any(coalesce(p_permisos, '{}'))));
    if coalesce(array_length(v_dest, 1), 0) = 0 and v_por_rol then
      select coalesce(array_agg(distinct ur.user_id), '{}') into v_dest
        from usuarios_roles ur join roles r on r.id = ur.rol_id
        join usuarios_tenant ut on ut.user_id = ur.user_id and ut.tenant_id = ur.tenant_id
       where ur.tenant_id = p_tenant and lower(trim(r.nombre)) = 'administrador'
         and coalesce(ut.estado, 'activo') = 'activo' and not (ur.user_id = any(v_excluir));
    end if;
    if coalesce(array_length(v_dest, 1), 0) = 0 then return null; end if;
  end if;
  insert into notificaciones (tenant_id, tipo, titulo, mensaje, leida, entidad_tipo, entidad_id, dirigida)
  values (p_tenant, case when p_tipo in ('info', 'warning', 'error', 'success') then p_tipo else 'info' end,
          p_titulo, p_mensaje, false, p_entidad_tipo, p_entidad_id, v_dirigida)
  returning id into v_id;
  if v_dirigida then
    insert into notificaciones_destinatarios (notificacion_id, user_id) select v_id, unnest(v_dest) on conflict do nothing;
  end if;
  return v_id;
end $$;
revoke all on function public.notif_emitir(uuid, text, text, text, text, text, uuid[], text[], text[], uuid[]) from public, anon;
grant execute on function public.notif_emitir(uuid, text, text, text, text, text, uuid[], text[], text[], uuid[]) to authenticated, service_role;

-- 3. Órdenes de compra: la etapa en turno decide a quién se avisa --------------------------------------------------
-- Misma regla que `etapaEnTurno` del front: el nivel por monto (en soles, con tipoCambioRef) dice qué etapas firman y
-- la primera sin firma es la que está en turno.
create or replace function public.notif_oc_etapa_en_turno(p_orden uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare o record; cfg jsonb; v_tc numeric; v_pen numeric; niv jsonb; etapas text[]; firmadas text[]; e text;
begin
  select * into o from ordenes_compra where id = p_orden;
  if not found then return null; end if;
  select config into cfg from flujo_aprobacion where tenant_id = o.tenant_id;
  v_tc := coalesce((cfg->>'tipoCambioRef')::numeric, 3.4);
  v_pen := case when o.moneda = 'USD' then coalesce(o.total, 0) * v_tc else coalesce(o.total, 0) end;
  select n into niv from jsonb_array_elements(coalesce(cfg->'niveles', '[]'::jsonb)) n
   where v_pen >= coalesce((n->>'montoMin')::numeric, 0) and ((n->>'montoMax') is null or v_pen < (n->>'montoMax')::numeric)
   limit 1;
  if niv is null then niv := coalesce(cfg->'niveles', '[]'::jsonb) -> -1; end if;
  select coalesce(array_agg(x), '{}') into etapas from jsonb_array_elements_text(coalesce(niv->'etapas', '[]'::jsonb)) x;
  if etapas = '{}' then etapas := array['comprador', 'operaciones', 'gerencia']; end if;
  select coalesce(array_agg(etapa), '{}') into firmadas from orden_aprobaciones where orden_id = p_orden;
  foreach e in array etapas loop
    if not (e = any(firmadas)) then return e; end if;
  end loop;
  return null;
end $$;

-- Cierra para todos el aviso de aprobación abierto de la orden y, si sigue en aprobación y queda una etapa por
-- firmar, avisa solo a los roles que pueden firmarla.
create or replace function public.notif_oc_solicitar(p_orden uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o record; cfg jsonb; v_etapa text; v_roles text[]; v_etiqueta text; v_prov text; v_monto text;
begin
  select * into o from ordenes_compra where id = p_orden;
  if not found then return null; end if;
  update notificaciones set leida = true
   where tenant_id = o.tenant_id and entidad_tipo = 'orden_compra' and entidad_id in (o.numero, o.id::text)
     and leida = false and translate(lower(titulo), 'áéíóú', 'aeiou') like 'aprobacion requerida%';
  if o.estado <> 'enviada' then return null; end if;
  v_etapa := notif_oc_etapa_en_turno(p_orden);
  if v_etapa is null then return null; end if;
  select config into cfg from flujo_aprobacion where tenant_id = o.tenant_id;
  select coalesce(array_agg(x), '{}') into v_roles from jsonb_array_elements_text(coalesce(cfg->'rolesPorEtapa'->v_etapa, '[]'::jsonb)) x;
  if v_roles = '{}' then
    v_roles := case v_etapa when 'comprador' then array['Compras'] when 'operaciones' then array['Proyectos', 'Operador'] else array['Gerencia'] end;
  end if;
  v_etiqueta := case v_etapa when 'comprador' then 'Comprador' when 'operaciones' then 'Operaciones' else 'Gerencia' end;
  select razon_social into v_prov from proveedores where id = o.proveedor_id;
  v_monto := case when o.moneda = 'USD' then 'US$ ' else 'S/ ' end || to_char(coalesce(o.total, 0), 'FM999G999G990D00');
  return notif_emitir(o.tenant_id, 'warning', 'Aprobación requerida: ' || o.numero,
                      'Te toca firmar como ' || v_etiqueta || coalesce(' · ' || v_prov, '') || ' · ' || v_monto,
                      'orden_compra', o.numero, null, v_roles, null, null);
end $$;
revoke all on function public.notif_oc_solicitar(uuid) from public, anon;
grant execute on function public.notif_oc_solicitar(uuid) to authenticated, service_role;

-- Al enviar a aprobación (estado → enviada) se avisa a la etapa en turno.
create or replace function public.trg_oc_enviada_avisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'enviada' and (tg_op = 'INSERT' or old.estado is distinct from 'enviada') then
    perform notif_oc_solicitar(new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_enviada_avisa on public.ordenes_compra;
create trigger trg_oc_enviada_avisa after insert or update of estado on public.ordenes_compra
  for each row execute function public.trg_oc_enviada_avisa();

-- Cada firma (o firma borrada al reenviar una orden rechazada) reencamina el aviso a la etapa siguiente.
create or replace function public.trg_firma_reencamina_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notif_oc_solicitar(coalesce(new.orden_id, old.orden_id));
  return coalesce(new, old);
end $$;
drop trigger if exists trg_firma_reencamina_aviso on public.orden_aprobaciones;
create trigger trg_firma_reencamina_aviso after insert or update or delete on public.orden_aprobaciones
  for each row execute function public.trg_firma_reencamina_aviso();

-- Al salir de "enviada" se cierran los avisos (como antes) y, si quedó aprobada o rechazada, se le avisa al comprador.
create or replace function public.trg_oc_cierra_avisos() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dest uuid[];
begin
  if old.estado = 'enviada' and new.estado <> 'enviada' then
    update aprobaciones
       set estado = case new.estado when 'aprobada' then 'aprobada' when 'rechazada' then 'rechazada' else 'cancelada' end,
           resuelto_en = coalesce(resuelto_en, now())
     where tenant_id = new.tenant_id and modulo = 'orden_compra' and entidad_id = new.id and estado = 'pendiente';
    perform notif_cerrar_aprobacion(new.tenant_id, 'orden_compra', array[new.numero, new.id::text]);
    if new.estado in ('aprobada', 'rechazada') then
      v_dest := array_remove(array[new.creado_por,
                 (select u.id from auth.users u where new.comprador_email is not null and lower(u.email) = lower(new.comprador_email) limit 1)], null);
      perform notif_emitir(new.tenant_id, case when new.estado = 'aprobada' then 'success' else 'error' end,
        'Orden ' || new.numero || case when new.estado = 'aprobada' then ' aprobada' else ' rechazada' end,
        case when new.estado = 'aprobada' then 'Ya tiene todas las firmas: se puede ejecutar.'
             else coalesce(nullif(new.motivo_rechazo, ''), 'Revisa el motivo en la orden, corrígela y vuelve a enviarla.') end,
        'orden_compra', new.numero, v_dest, null, null, array[auth.uid()]);
    end if;
  end if;
  return new;
end $$;

-- 4. Viajes y rendiciones: destinatarios según el paso del flujo ---------------------------------------------------
-- Misma firma que antes (los callers no cambian). p_tipo es el PASO ('viaje_solicitado', 'rendicion_presentada'…);
-- el tipo visual (info/warning/success) se deduce aquí. Quien hace la acción no se avisa a sí mismo.
create or replace function public.viaje_notificar(p_tenant uuid, p_tipo text, p_titulo text, p_mensaje text, p_viaje uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v record; v_gente uuid[]; v_actor uuid[] := array_remove(array[auth.uid()], null);
begin
  select * into v from viajes where id = p_viaje;
  select array_remove(array[v.solicitado_por] || coalesce(array_agg(distinct p.user_id), '{}'), null) into v_gente
    from viaje_pasajeros p where p.viaje_id = p_viaje and p.user_id is not null;
  v_gente := coalesce(v_gente, array_remove(array[v.solicitado_por], null));
  case p_tipo
    when 'viaje_solicitado' then
      perform notif_emitir(p_tenant, 'warning', p_titulo, p_mensaje, 'viaje', p_viaje::text, null, null, array['viajes.aprobar'], v_actor);
    when 'viaje_jefatura_ok' then
      perform notif_emitir(p_tenant, 'info', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, array['viajes.aprobar_final'], v_actor);
    when 'viaje_aprobado' then
      perform notif_emitir(p_tenant, 'success', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, null, v_actor);
    when 'viaje_rechazado' then
      perform notif_emitir(p_tenant, 'error', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, null, v_actor);
    when 'rendicion_presentada' then
      perform notif_emitir(p_tenant, 'warning', p_titulo, p_mensaje, 'viaje', p_viaje::text, null, null, array['viajes.aprobar'], v_actor);
    when 'rendicion_jefatura_ok' then
      perform notif_emitir(p_tenant, 'info', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, array['viajes.aprobar_final'], v_actor);
    when 'rendicion_observada' then
      perform notif_emitir(p_tenant, 'warning', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, null, v_actor);
    when 'rendicion_aprobada' then
      perform notif_emitir(p_tenant, 'success', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, null, v_actor);
    else
      perform notif_emitir(p_tenant, 'info', p_titulo, p_mensaje, 'viaje', p_viaje::text, v_gente, null, array['viajes.aprobar_final'], v_actor);
  end case;
exception when others then
  raise warning 'viaje_notificar: %', sqlerrm; -- una notificación nunca tumba la operación, pero ya no se calla
end $$;

-- 5. Lotes de pago: según el estado al que acaba de pasar el lote ---------------------------------------------------
create or replace function public.lote_notificar(p_lote uuid, p_tipo text, p_titulo text, p_mensaje text) returns void
language plpgsql security definer set search_path = public as $$
declare l record; v_mios uuid[]; v_actor uuid[] := array_remove(array[auth.uid()], null);
begin
  select * into l from lotes_pago where id = p_lote;
  if not found then return; end if;
  v_mios := array_remove(array[l.creado_por, l.enviado_revision_por], null);
  case l.estado
    when 'en_revision' then
      perform notif_emitir(l.tenant_id, p_tipo, p_titulo, p_mensaje, 'lote_pago', l.numero, null, null, array['finanzas.lotes_validar'], v_actor);
    when 'validado' then
      perform notif_emitir(l.tenant_id, p_tipo, p_titulo, p_mensaje, 'lote_pago', l.numero, v_mios, null, array['finanzas.lotes_armar'], v_actor);
    when 'por_pagar' then
      perform notif_emitir(l.tenant_id, p_tipo, p_titulo, p_mensaje, 'lote_pago', l.numero, null, null, array['finanzas.lotes_pagar'], v_actor);
    when 'pagado', 'conciliado' then
      perform notif_emitir(l.tenant_id, p_tipo, p_titulo, p_mensaje, 'lote_pago', l.numero, v_mios, null, array['finanzas.lotes_armar', 'finanzas.lotes_validar'], v_actor);
    else -- borrador (devuelto), anulado
      perform notif_emitir(l.tenant_id, p_tipo, p_titulo, p_mensaje, 'lote_pago', l.numero, v_mios, null, null, v_actor);
  end case;
exception when others then
  raise warning 'lote_notificar: %', sqlerrm;
end $$;

-- 6. OT nueva y tarea vencida: antes las insertaba cada navegador abierto (un aviso por sesión) ---------------------
create or replace function public.trg_ot_nueva_avisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notif_emitir(new.tenant_id, 'info', 'Nueva OT: ' || coalesce(new.numero_ot, ''),
                       coalesce(new.titulo, '') || coalesce(' — ' || new.taller_nombre, ''),
                       'orden_trabajo', new.numero_ot, null, null, array['flota.aprobar', 'flota.editar'], array[new.creado_por, auth.uid()]);
  return new;
exception when others then raise warning 'trg_ot_nueva_avisa: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_ot_nueva_avisa on public.ordenes_trabajo;
create trigger trg_ot_nueva_avisa after insert on public.ordenes_trabajo
  for each row execute function public.trg_ot_nueva_avisa();

-- Tarea vencida: solo cuando cambia la fecha o el estado y queda vencida y abierta. Va a quien está asignada
-- (`asignado_a` guarda nombre o correo); si no se reconoce, a quien edita Proyectos.
create or replace function public.trg_tarea_vencida_avisa() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dest uuid[];
begin
  if new.estado in ('completada', 'cancelada') or new.fecha_vencimiento is null or new.fecha_vencimiento >= current_date then return new; end if;
  if old.fecha_vencimiento is not distinct from new.fecha_vencimiento and old.estado is not distinct from new.estado then return new; end if;
  select coalesce(array_agg(ut.user_id), '{}') into v_dest from usuarios_tenant ut
   where ut.tenant_id = new.tenant_id and coalesce(new.asignado_a, '') <> ''
     and (lower(ut.email) = lower(new.asignado_a) or lower(ut.nombre) = lower(new.asignado_a));
  if v_dest = '{}' then
    perform notif_emitir(new.tenant_id, 'warning', 'Tarea vencida: ' || coalesce(new.titulo, ''), 'Venció el ' || to_char(new.fecha_vencimiento, 'DD/MM/YYYY'),
                         'tarea', new.id::text, null, null, array['proyectos.editar'], null);
  else
    perform notif_emitir(new.tenant_id, 'warning', 'Tarea vencida: ' || coalesce(new.titulo, ''), 'Venció el ' || to_char(new.fecha_vencimiento, 'DD/MM/YYYY'),
                         'tarea', new.id::text, v_dest, null, null, null);
  end if;
  return new;
exception when others then raise warning 'trg_tarea_vencida_avisa: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_tarea_vencida_avisa on public.tareas_proyecto;
create trigger trg_tarea_vencida_avisa after update of fecha_vencimiento, estado on public.tareas_proyecto
  for each row execute function public.trg_tarea_vencida_avisa();

-- 7. Mis notificaciones (para el centro de notificaciones, paginado en el cliente) -------------------------------
-- Devuelve lo que esta persona puede ver con su lectura ya resuelta; el filtro por módulo de los avisos generales lo
-- sigue haciendo el cliente, que conoce los permisos.
create or replace function public.mis_notificaciones(p_limite int default 200, p_desde timestamptz default null)
returns table (id uuid, tipo text, titulo text, mensaje text, cerrada boolean, dirigida boolean, leida_por_mi boolean,
               entidad_tipo text, entidad_id text, creado_en timestamptz)
language sql stable security invoker set search_path = public as $$
  select n.id, n.tipo, n.titulo, n.mensaje, n.leida as cerrada, n.dirigida,
         exists (select 1 from notificaciones_lecturas l where l.notificacion_id = n.id and l.user_id = auth.uid()) as leida_por_mi,
         n.entidad_tipo, n.entidad_id, n.creado_en
    from notificaciones n
   where n.tenant_id = auth_tenant_id() and (p_desde is null or n.creado_en >= p_desde)
   order by n.creado_en desc
   limit greatest(1, least(coalesce(p_limite, 200), 1000));
$$;
revoke all on function public.mis_notificaciones(int, timestamptz) from public, anon;
grant execute on function public.mis_notificaciones(int, timestamptz) to authenticated;

-- 8. Saneamiento: los avisos de aprobación abiertos de las órdenes en aprobación pasan a ser dirigidos a la etapa en
--    turno (hoy las 14 esperan a Gerencia). Los generales viejos se cierran para todos.
do $$
declare o record;
begin
  for o in select id from ordenes_compra where estado = 'enviada' loop
    perform notif_oc_solicitar(o.id);
  end loop;
end $$;
