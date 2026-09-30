-- Notificaciones: (1) leídas por persona, (2) se cierran solas al resolverse la aprobación.
--
-- La tabla `notificaciones` no tiene destinatario ni lectura por usuario: `leida` es
-- una sola marca por tenant, así que si Richard marcaba un aviso, desaparecía también
-- para Miguelángel. Y al firmar/aprobar una orden, el aviso "Aprobación requerida"
-- seguía ahí porque nadie lo cerraba.

-- 1. Lecturas por usuario ------------------------------------------------------
create table if not exists public.notificaciones_lecturas (
  notificacion_id uuid not null references public.notificaciones(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  leida_en        timestamptz not null default now(),
  primary key (notificacion_id, user_id)
);
create index if not exists notificaciones_lecturas_user_idx on public.notificaciones_lecturas(user_id);
alter table public.notificaciones_lecturas enable row level security;
drop policy if exists lecturas_propias on public.notificaciones_lecturas;
create policy lecturas_propias on public.notificaciones_lecturas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.notificaciones_lecturas to authenticated;

-- 2. Cerrar (para todos) los avisos de aprobación de una entidad ------------------
create or replace function public.notif_cerrar_aprobacion(p_tenant uuid, p_tipo text, p_ids text[])
returns void language sql security definer set search_path = public as $$
  update notificaciones
     set leida = true
   where tenant_id = p_tenant
     and entidad_tipo = p_tipo
     and entidad_id = any(p_ids)
     and leida = false;
$$;

-- 3. Al resolverse una solicitud en `aprobaciones` (cualquier módulo) se cierran sus avisos
create or replace function public.trg_aprobacion_cierra_avisos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.estado = 'pendiente' and new.estado <> 'pendiente' then
    perform notif_cerrar_aprobacion(new.tenant_id, new.modulo,
      array_remove(array[new.numero, new.entidad_id::text], null));
  end if;
  return new;
end $$;
drop trigger if exists trg_aprobacion_cierra_avisos on public.aprobaciones;
create trigger trg_aprobacion_cierra_avisos after update of estado on public.aprobaciones
  for each row execute function public.trg_aprobacion_cierra_avisos();

-- 4. OC: al salir de "enviada" (aprobada, rechazada, anulada…) se resuelve la solicitud
--    y se cierran los avisos, aunque la aprobación se haya hecho en el ERP y no en Teams.
create or replace function public.trg_oc_cierra_avisos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.estado = 'enviada' and new.estado <> 'enviada' then
    update aprobaciones
       set estado = case new.estado when 'aprobada' then 'aprobada'
                                    when 'rechazada' then 'rechazada'
                                    else 'cancelada' end,
           resuelto_en = coalesce(resuelto_en, now())
     where tenant_id = new.tenant_id and modulo = 'orden_compra'
       and entidad_id = new.id and estado = 'pendiente';
    perform notif_cerrar_aprobacion(new.tenant_id, 'orden_compra', array[new.numero, new.id::text]);
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_cierra_avisos on public.ordenes_compra;
create trigger trg_oc_cierra_avisos after update of estado on public.ordenes_compra
  for each row execute function public.trg_oc_cierra_avisos();

-- 5. Al firmar una etapa, quien firmó ya no tiene ese aviso pendiente (los demás firmantes sí)
create or replace function public.trg_firma_marca_leido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_numero text;
begin
  if new.aprobado_por_email is null then return new; end if;
  select id into v_user from auth.users where lower(email) = lower(new.aprobado_por_email) limit 1;
  if v_user is null then return new; end if;
  select numero into v_numero from ordenes_compra where id = new.orden_id;
  insert into notificaciones_lecturas (notificacion_id, user_id)
  select n.id, v_user
    from notificaciones n
   where n.tenant_id = new.tenant_id and n.entidad_tipo = 'orden_compra'
     and n.entidad_id in (v_numero, new.orden_id::text)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_firma_marca_leido on public.orden_aprobaciones;
create trigger trg_firma_marca_leido after insert or update on public.orden_aprobaciones
  for each row execute function public.trg_firma_marca_leido();

-- 6. Realtime: la publicación estaba vacía, así que la campana nunca recibía cambios en vivo
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notificaciones') then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notificaciones_lecturas') then
    alter publication supabase_realtime add table public.notificaciones_lecturas;
  end if;
end $$;

-- 7. Saneamiento: avisos abiertos de órdenes ya resueltas, y solicitudes "pendientes" de OC que ya no lo están
update notificaciones n set leida = true
  from ordenes_compra o
 where n.leida = false and n.entidad_tipo = 'orden_compra' and o.tenant_id = n.tenant_id
   and n.entidad_id in (o.numero, o.id::text) and o.estado <> 'enviada';
update aprobaciones a
   set estado = case o.estado when 'aprobada' then 'aprobada' when 'rechazada' then 'rechazada' else 'cancelada' end,
       resuelto_en = coalesce(a.resuelto_en, o.modificado_en, now())
  from ordenes_compra o
 where a.modulo = 'orden_compra' and a.estado = 'pendiente' and a.entidad_id = o.id and o.estado <> 'enviada';
-- Quien ya firmó una orden todavía en aprobación no tiene por qué seguir viendo el aviso
insert into notificaciones_lecturas (notificacion_id, user_id)
select n.id, u.id
  from orden_aprobaciones oa
  join ordenes_compra o on o.id = oa.orden_id
  join auth.users u on lower(u.email) = lower(oa.aprobado_por_email)
  join notificaciones n on n.tenant_id = o.tenant_id and n.entidad_tipo = 'orden_compra' and n.entidad_id in (o.numero, o.id::text)
on conflict do nothing;
