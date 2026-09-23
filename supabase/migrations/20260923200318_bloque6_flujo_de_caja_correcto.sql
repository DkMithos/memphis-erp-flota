-- Bloque 6 — Flujo de caja correcto. Un flujo se lee así: INGRESOS (lo que
-- entra: cobros) menos EGRESOS (lo que sale: pagos) = NETO del mes, y el
-- SALDO acumulado arrastra desde un saldo inicial de caja. Nada de montos
-- con signo: el sentido (pagar/cobrar) dice la columna. Y en cada columna,
-- REAL (ya pagado/cobrado, en el mes en que ocurrió) separado de PREVISTO
-- (comprometido por OC/factura o proyectado, en el mes en que vence).

insert into public.parametros_financieros (clave, valor, descripcion) values
  ('saldo_caja_inicial', 0, 'Saldo de caja (soles) al inicio del flujo; lo fija Finanzas con fijar_saldo_caja()'),
  ('saldo_caja_fecha', 20260101, 'Fecha AAAAMMDD a la que corresponde saldo_caja_inicial')
on conflict (clave) do nothing;

create or replace function public.fijar_saldo_caja(p_monto numeric, p_fecha date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (auth_tiene_permiso('finanzas', 'editar') or auth_tiene_permiso('finanzas', 'flujo')) then
    raise exception 'Sin permiso para fijar el saldo de caja (finanzas.editar)';
  end if;
  update parametros_financieros set valor = p_monto where clave = 'saldo_caja_inicial';
  update parametros_financieros set valor = to_char(p_fecha, 'YYYYMMDD')::numeric where clave = 'saldo_caja_fecha';
end $$;
grant execute on function public.fijar_saldo_caja(numeric, date) to authenticated;

-- Cada compromiso, en soles, ubicado en su mes: real (fecha en que se pagó/cobró) o previsto (fecha en que vence).
create or replace view public.v_flujo_mensual with (security_invoker = true) as
  with f as (
    select c.*,
           coalesce(c.fecha_vencimiento, c.mes_vencimiento) as vence,
           upper(coalesce(c.estado_pago, '')) like 'PAGADO%' as pagado,
           coalesce(c.monto_presupuestado, c.monto_ejecutado, 0) as monto,
           case when c.moneda = 'USD' then coalesce(nullif(c.tc, 0), tc_vigente(coalesce(c.fecha_pagado, c.fecha_vencimiento, c.mes_vencimiento, current_date))) else 1 end as tc_ap
      from public.flujo_compromisos c
     where coalesce(c.fecha_vencimiento, c.mes_vencimiento, c.fecha_pagado) between date '2020-01-01' and date '2030-12-31'
  )
  select f.tenant_id, f.area, f.proyecto_id, f.cdc, f.sentido, f.origen, f.fuente,
         to_char(case when f.pagado then coalesce(f.fecha_pagado, f.vence) else f.vence end, 'YYYY-MM') as mes,
         case when f.pagado then coalesce(nullif(f.monto_pagado, 0), f.monto) * f.tc_ap else coalesce(f.monto_pagado, 0) * f.tc_ap end as real_soles,
         case when f.pagado then 0 else greatest(f.monto - coalesce(f.monto_pagado, 0), 0) * f.tc_ap end as previsto_soles,
         (not f.pagado and f.vence < current_date and not (f.pago_ligado_a = 'ciprl' and coalesce(f.vencimiento_estimado, false))) as vencido,
         f.id as compromiso_id, f.concepto, f.proveedor, f.moneda, f.monto, f.tc_ap, f.vence, f.fecha_pagado, f.pagado, f.referencia_doc, f.pago_ligado_a
    from f;
grant select on public.v_flujo_mensual to authenticated;

-- El flujo de caja por mes: ingresos − egresos = neto; saldo acumulado desde el saldo inicial.
-- Sin área ni proyecto = la empresa (arranca del saldo de caja). Con proyecto = caja del proyecto (arranca en 0).
create or replace function public.flujo_caja(p_desde date, p_hasta date, p_area text default null, p_proyecto uuid default null)
returns table (
  mes text,
  ingresos_real numeric, ingresos_previsto numeric, egresos_real numeric, egresos_previsto numeric,
  neto_real numeric, neto_previsto numeric, neto numeric, saldo numeric,
  egresos_vencidos numeric, compromisos bigint, pendientes bigint
)
language sql stable security invoker set search_path = public as $$
  with cfg as (
    select case when p_area is null and p_proyecto is null then coalesce((select valor from parametros_financieros where clave = 'saldo_caja_inicial'), 0) else 0 end as saldo_ini,
           case when p_area is null and p_proyecto is null
                then to_date(coalesce((select valor from parametros_financieros where clave = 'saldo_caja_fecha'), 20260101)::text, 'YYYYMMDD')
                else date_trunc('month', p_desde)::date end as fecha_ini
  ), meses as (
    select to_char(d, 'YYYY-MM') as mes, d::date as inicio
      from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') d
  ), datos as (
    select v.mes,
           sum(v.real_soles)     filter (where v.sentido = 'cobrar') as ing_real,
           sum(v.previsto_soles) filter (where v.sentido = 'cobrar') as ing_prev,
           sum(v.real_soles)     filter (where v.sentido = 'pagar')  as egr_real,
           sum(v.previsto_soles) filter (where v.sentido = 'pagar')  as egr_prev,
           sum(v.previsto_soles) filter (where v.sentido = 'pagar' and v.vencido) as egr_venc,
           count(*) as n, count(*) filter (where not v.pagado) as n_pend
      from v_flujo_mensual v
     where (p_area is null or v.area = p_area)
       and (p_proyecto is null or v.proyecto_id = p_proyecto)
     group by v.mes
  ), previo as (
    -- lo ocurrido entre el saldo inicial y el primer mes pedido, para que el saldo arrastre bien
    select coalesce(sum(case when v.sentido = 'cobrar' then v.real_soles + v.previsto_soles else -(v.real_soles + v.previsto_soles) end), 0) as neto
      from v_flujo_mensual v, cfg
     where (p_area is null or v.area = p_area)
       and (p_proyecto is null or v.proyecto_id = p_proyecto)
       and v.mes >= to_char(cfg.fecha_ini, 'YYYY-MM') and v.mes < to_char(date_trunc('month', p_desde), 'YYYY-MM')
  )
  select m.mes,
         round(coalesce(d.ing_real, 0), 2), round(coalesce(d.ing_prev, 0), 2),
         round(coalesce(d.egr_real, 0), 2), round(coalesce(d.egr_prev, 0), 2),
         round(coalesce(d.ing_real, 0) - coalesce(d.egr_real, 0), 2),
         round(coalesce(d.ing_prev, 0) - coalesce(d.egr_prev, 0), 2),
         round(coalesce(d.ing_real, 0) + coalesce(d.ing_prev, 0) - coalesce(d.egr_real, 0) - coalesce(d.egr_prev, 0), 2),
         round(cfg.saldo_ini + previo.neto
               + sum(coalesce(d.ing_real, 0) + coalesce(d.ing_prev, 0) - coalesce(d.egr_real, 0) - coalesce(d.egr_prev, 0)) over (order by m.mes), 2),
         round(coalesce(d.egr_venc, 0), 2), coalesce(d.n, 0), coalesce(d.n_pend, 0)
    from meses m
    left join datos d on d.mes = m.mes
    cross join cfg cross join previo
   order by m.mes;
$$;
grant execute on function public.flujo_caja(date, date, text, uuid) to authenticated;
