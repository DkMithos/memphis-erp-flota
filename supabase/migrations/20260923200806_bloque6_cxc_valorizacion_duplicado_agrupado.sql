-- El Excel a veces agrupa varias valorizaciones en un solo cobro (Huánuco:
-- 2.5 M + 2.23 M = una fila de 4,726,500). También eso es duplicado.
create or replace function public.sync_compromiso_de_valorizacion(p_val uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v record; p record; v_fecha date; v_dias int; v_tiene_pagos boolean; v_fecha_cobro date; v_dup boolean;
begin
  select * into v from valorizaciones where id = p_val;
  if not found then return; end if;
  select exists (select 1 from transacciones t join flujo_compromisos f on f.id = t.compromiso_id where f.valorizacion_id = p_val) into v_tiene_pagos;

  -- ¿El Excel ya trae este cobro? Sola (monto ±1 %) o agrupada con las demás pagadas del proyecto.
  v_dup := v.estado = 'pagada' and not v_tiene_pagos and exists (
      select 1 from flujo_compromisos e
       where e.proyecto_id = v.proyecto_id and e.sentido = 'cobrar' and e.fuente = 'excel'
         and upper(coalesce(e.estado_pago, '')) like 'PAGADO%'
         and (abs(coalesce(e.monto_presupuestado, e.monto_ejecutado, 0) - v.monto) <= v.monto * 0.01
              or abs(coalesce(e.monto_presupuestado, e.monto_ejecutado, 0)
                     - (select sum(x.monto) from valorizaciones x where x.proyecto_id = v.proyecto_id and x.estado = 'pagada'))
                 <= coalesce(e.monto_presupuestado, e.monto_ejecutado, 1) * 0.01));

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
select public.sync_compromiso_de_valorizacion(id) from public.valorizaciones;
