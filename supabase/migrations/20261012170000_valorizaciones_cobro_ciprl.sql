-- ─────────────────────────────────────────────────────────────────────────────
-- Semana 2 del plan de carga (2026-10-12) · Valorizaciones como lado de ingresos.
--
-- 1) `sync_compromiso_de_valorizacion`: el Excel de flujo (Flujo de proyectos.xlsx)
--    registra el COBRO como CIPRL, que se emite neto de la supervisión y por eso
--    difiere de la valorización hasta ~8 % (Cusco Serenazgo: valo 6.48 M vs CIPRL
--    6.01 M). Antes la deduplicación aceptaba ±1 % y solo para pagadas: ahora es
--    ±8 %, para pagadas (contra filas PAGADO) y pendientes (contra PENDIENTE /
--    proyectado), sola o sumada con las demás del proyecto en el mismo estado.
--    Mientras el área PROYECTOS siga viniendo del Excel, manda el Excel; cuando se
--    corte, las valorizaciones del ERP toman el relevo.
-- 2) `valorizaciones_resincronizar()`: vuelve a correr la sincronización de todas
--    las valorizaciones. La llama flujo-import después de reemplazar las filas del
--    Excel, para que al desaparecer una fila del Excel aparezca el compromiso del ERP.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_compromiso_de_valorizacion(p_val uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v record; p record; v_fecha date; v_dias int; v_tiene_pagos boolean; v_fecha_cobro date; v_dup boolean;
        v_pagada boolean; v_suma numeric; v_tol numeric := 0.08;
begin
  select * into v from valorizaciones where id = p_val;
  if not found then return; end if;
  select exists (select 1 from transacciones t join flujo_compromisos f on f.id = t.compromiso_id where f.valorizacion_id = p_val) into v_tiene_pagos;

  v_pagada := v.estado = 'pagada';
  select coalesce(sum(x.monto), 0) into v_suma
    from valorizaciones x
   where x.proyecto_id = v.proyecto_id
     and (x.estado = 'pagada') = v_pagada
     and x.estado in ('presentada', 'aprobada', 'facturada', 'pagada');

  -- ¿El Excel ya trae este cobro (CIPRL)? Sola (±8 %) o agrupada con las demás del proyecto en el mismo estado.
  v_dup := not v_tiene_pagos and v.monto > 0 and exists (
      select 1 from flujo_compromisos e
       where e.proyecto_id = v.proyecto_id and e.sentido = 'cobrar' and e.fuente = 'excel'
         and (upper(coalesce(e.estado_pago, '')) like 'PAGADO%') = v_pagada
         and (abs(coalesce(e.monto_presupuestado, e.monto_ejecutado, 0) - v.monto) <= v.monto * v_tol
              or (v_suma > 0 and abs(coalesce(e.monto_presupuestado, e.monto_ejecutado, 0) - v_suma) <= v_suma * v_tol)));

  if v.estado not in ('presentada', 'aprobada', 'facturada', 'pagada') or v_dup then
    delete from flujo_compromisos f where f.valorizacion_id = p_val
       and not exists (select 1 from transacciones t where t.compromiso_id = f.id);
    return;
  end if;

  select codigo, nombre, entidad_cliente into p from proyectos where id = v.proyecto_id;
  v_dias := coalesce((select valor from parametros_financieros where clave = 'dias_cobro_valorizacion'), 30)::int;
  v_fecha_cobro := coalesce(v.fecha_pago, v.fecha_aprobacion, v.fecha_presentacion, current_date);
  v_fecha := case when v.estado = 'pagada' then v_fecha_cobro
                  when v.fecha_aprobacion is not null then v.fecha_aprobacion + v_dias
                  else coalesce(v.fecha_presentacion, current_date) + v_dias + 15 end;

  insert into flujo_compromisos (
    tenant_id, area, cdc, proyecto_id, concepto, categoria, proveedor, moneda, tc,
    mes_vencimiento, fecha_vencimiento, vencimiento_estimado, monto_presupuestado, monto_ejecutado,
    monto_pagado, fecha_pagado, estado_pago, sentido, origen, fuente, valorizacion_id, referencia_doc)
  values (
    v.tenant_id, 'PROYECTOS', p.codigo, v.proyecto_id,
    'Valorización N° ' || v.numero || coalesce(' · ' || p.codigo, '') || coalesce(' · ' || nullif(left(v.descripcion, 60), ''), ''),
    'valorizacion', p.entidad_cliente, coalesce(v.moneda, 'PEN'),
    case when coalesce(v.moneda, 'PEN') = 'USD' then tc_vigente(coalesce(v.fecha_presentacion, current_date)) end,
    date_trunc('month', v_fecha)::date, v_fecha, v.estado <> 'pagada', v.monto, v.monto,
    case when v.estado = 'pagada' then v.monto else 0 end,
    case when v.estado = 'pagada' then v_fecha_cobro end,
    case when v.estado = 'pagada' then 'PAGADO' else 'PENDIENTE' end,
    'cobrar', case when v.estado in ('facturada', 'pagada') then 'real' else 'comprometido' end, 'erp', p_val, 'VAL-' || v.numero)
  on conflict (valorizacion_id) where valorizacion_id is not null do update set
    monto_presupuestado = excluded.monto_presupuestado, monto_ejecutado = excluded.monto_ejecutado,
    fecha_vencimiento = excluded.fecha_vencimiento, mes_vencimiento = excluded.mes_vencimiento,
    vencimiento_estimado = excluded.vencimiento_estimado, origen = excluded.origen,
    proyecto_id = excluded.proyecto_id, concepto = excluded.concepto, cdc = excluded.cdc,
    monto_pagado = case when v_tiene_pagos then flujo_compromisos.monto_pagado else excluded.monto_pagado end,
    fecha_pagado = case when v_tiene_pagos then flujo_compromisos.fecha_pagado else excluded.fecha_pagado end,
    estado_pago  = case when v_tiene_pagos then flujo_compromisos.estado_pago else excluded.estado_pago end;
end $$;

create or replace function public.valorizaciones_resincronizar() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from valorizaciones loop
    perform sync_compromiso_de_valorizacion(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.valorizaciones_resincronizar() from public;
grant execute on function public.valorizaciones_resincronizar() to service_role;
