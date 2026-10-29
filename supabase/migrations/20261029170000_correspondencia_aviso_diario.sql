-- 2026-10-29 · Correspondencia con el Estado: aviso diario de cartas vencidas y por vencer.
-- Quedó pendiente al construir el módulo ("avisos de correspondencia vencida"). Un job de pg_cron corre de lunes a viernes a las
-- 08:05 de Perú (13:05 UTC) y, solo si hay algo que avisar, emite avisos DIRIGIDOS (notif_emitir): uno por responsable con sus
-- cartas (`correspondencia.responsable_id`) y uno a quienes editan Proyectos (Operaciones) con las cartas sin responsable y el
-- conteo de las que siguen sin plazo. No manda correo: la campana y el centro de notificaciones ya llegan a esas personas; si se
-- quiere correo, se agrega sobre `correo-enviar`.
create or replace function public.correspondencia_aviso_diario() returns int
language plpgsql security definer set search_path = public as $$
declare t record; g record; v_sin int; v_primeras text; v_msg text; v_n int := 0;
begin
  for t in select distinct tenant_id from correspondencia where estado = 'pendiente' loop
    select count(*) into v_sin from correspondencia where tenant_id = t.tenant_id and estado = 'pendiente' and fecha_limite is null;
    for g in
      select responsable_id,
             count(*) filter (where fecha_limite < current_date) as vencidas,
             count(*) filter (where fecha_limite >= current_date) as proximas
        from correspondencia
       where tenant_id = t.tenant_id and estado = 'pendiente' and fecha_limite <= current_date + 7
       group by responsable_id
    loop
      select string_agg(coalesce(numero_doc, left(asunto, 40)) || ' (' || to_char(fecha_limite, 'DD/MM') || ')', ', ' order by fecha_limite)
        into v_primeras
        from (select numero_doc, asunto, fecha_limite from correspondencia
               where tenant_id = t.tenant_id and estado = 'pendiente' and fecha_limite <= current_date + 7
                 and responsable_id is not distinct from g.responsable_id
               order by fecha_limite limit 5) x;
      v_msg := case when g.vencidas > 0 then g.vencidas || ' vencida(s)' else '' end
            || case when g.vencidas > 0 and g.proximas > 0 then ' · ' else '' end
            || case when g.proximas > 0 then g.proximas || ' vence(n) en 7 días' else '' end
            || coalesce(': ' || v_primeras, '')
            || case when g.responsable_id is null and v_sin > 0 then ' · ' || v_sin || ' sin plazo' else '' end;
      if g.responsable_id is not null then
        perform notif_emitir(t.tenant_id, case when g.vencidas > 0 then 'error' else 'warning' end,
                             'Correspondencia: ' || (g.vencidas + g.proximas) || ' carta(s) a tu cargo requieren respuesta', v_msg,
                             'correspondencia', null, array[g.responsable_id], null, null, null);
      else
        perform notif_emitir(t.tenant_id, case when g.vencidas > 0 then 'error' else 'warning' end,
                             'Correspondencia: ' || (g.vencidas + g.proximas) || ' carta(s) sin responsable requieren respuesta', v_msg,
                             'correspondencia', null, null, null, array['proyectos.editar'], null);
      end if;
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
revoke all on function public.correspondencia_aviso_diario() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'correspondencia-aviso-diario') then
    perform cron.unschedule('correspondencia-aviso-diario');
  end if;
  perform cron.schedule('correspondencia-aviso-diario', '5 13 * * 1-5', 'select public.correspondencia_aviso_diario()');
end $$;
