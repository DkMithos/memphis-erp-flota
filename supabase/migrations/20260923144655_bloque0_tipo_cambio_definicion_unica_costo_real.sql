-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260923144655  name: bloque0_tipo_cambio_definicion_unica_costo_real

-- ============================================================================
-- BLOQUE 0 · Correcciones de base (auditoría Proyecto 360, 2026-09-23)
--  1) Tipo de cambio en la base (tipos_cambio + tc_vigente), fuera el 3.40 fijo.
--  2) Parámetros del margen (regla de Antonio 16/09/2026) en tabla, no en código.
--  3) UNA sola definición financiera por proyecto: proyecto_financiero(uuid).
--     Estados REALES de OC (aprobada | recibida_parcial | recibida_total).
--  4) proyectos.costo_real mantenido por triggers (antes nunca se actualizaba).
--  5) Columnas de dual_imputation que faltaban en prod.
-- ============================================================================

-- 1) TIPO DE CAMBIO ----------------------------------------------------------
create table if not exists public.tipos_cambio (
  fecha      date primary key,
  compra     numeric(8,4) not null check (compra > 0),
  venta      numeric(8,4) not null check (venta > 0),
  fuente     text not null default 'manual',
  creado_en  timestamptz not null default now()
);
comment on table public.tipos_cambio is 'TC USD→PEN por día (SUNAT/SBS o manual). Global, no por tenant. Las compras se convierten al tipo VENTA.';
alter table public.tipos_cambio enable row level security;
drop policy if exists tipos_cambio_leer on public.tipos_cambio;
create policy tipos_cambio_leer on public.tipos_cambio for select to authenticated using (true);

-- Semilla = el 3.40 que estaba fijo en el código, para NO mover cifras de un día
-- para otro. Finanzas (política de TC) y el job diario lo reemplazan.
insert into public.tipos_cambio (fecha, compra, venta, fuente)
values ('2026-09-23', 3.40, 3.40, 'semilla: igual al 3.40 fijo del codigo anterior; reemplazar por SUNAT/SBS')
on conflict (fecha) do nothing;

create or replace function public.tc_vigente(p_fecha date default current_date)
returns numeric language sql stable set search_path = public as $$
  select coalesce(
    (select venta from tipos_cambio where fecha <= coalesce(p_fecha, current_date) order by fecha desc limit 1),
    (select venta from tipos_cambio order by fecha asc limit 1)
  );
$$;
grant execute on function public.tc_vigente(date) to authenticated;

create or replace function public.fijar_tipo_cambio(p_fecha date, p_compra numeric, p_venta numeric, p_fuente text default 'manual')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (auth_tiene_permiso('finanzas','editar') or auth_tiene_permiso('finanzas','crear')) then
    raise exception 'Sin permiso para fijar el tipo de cambio (finanzas.editar)';
  end if;
  insert into tipos_cambio (fecha, compra, venta, fuente)
  values (p_fecha, p_compra, p_venta, coalesce(p_fuente, 'manual'))
  on conflict (fecha) do update set compra = excluded.compra, venta = excluded.venta, fuente = excluded.fuente;
end $$;
grant execute on function public.fijar_tipo_cambio(date, numeric, numeric, text) to authenticated;

-- La OC en dólares guarda el TC del día al nacer. Antes las creadas en el ERP
-- quedaban sin TC y caían al 3.40 escrito en el SQL.
create or replace function public.set_oc_tipo_cambio() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.moneda = 'USD' and new.tipo_cambio is null then
    new.tipo_cambio := tc_vigente(coalesce(new.fecha_emision::date, current_date));
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_tipo_cambio on public.ordenes_compra;
create trigger trg_oc_tipo_cambio before insert on public.ordenes_compra
  for each row execute function public.set_oc_tipo_cambio();

-- 2) PARÁMETROS DEL MARGEN -----------------------------------------------------
create table if not exists public.parametros_financieros (
  clave text primary key,
  valor numeric not null,
  descripcion text
);
alter table public.parametros_financieros enable row level security;
drop policy if exists parametros_financieros_leer on public.parametros_financieros;
create policy parametros_financieros_leer on public.parametros_financieros for select to authenticated using (true);
insert into public.parametros_financieros (clave, valor, descripcion) values
  ('igv',                      0.18, 'IGV'),
  ('consultoria_oxi',          0.10, 'Consultoría OxI, fracción del convenio (Antonio 16/09/2026)'),
  ('contraprestacion_privada', 0.05, 'Contraprestación privada, fracción del convenio'),
  ('venta_ciprl',              0.04, 'Venta del CIPRL, fracción del convenio')
on conflict (clave) do nothing;

-- 3) UNA SOLA DEFINICIÓN FINANCIERA POR PROYECTO -------------------------------
drop function if exists public.proyectos_financiero_resumen(uuid);
drop function if exists public.proyecto_financiero(uuid);

create function public.proyecto_financiero(p_proyecto uuid)
returns table (
  proyecto_id uuid, anio_convenio integer,
  monto_contrato numeric, monto_adenda numeric, monto_contrato_total numeric,
  presupuesto numeric, moneda text, monto_cobrado numeric, monto_pendiente_cobro numeric,
  gasto_ocs numeric, gasto_caja numeric, gasto_fijos numeric, gasto_total numeric,
  total_ocs bigint, total_gastos_caja bigint,
  saldo_disponible numeric, utilidad numeric, margen numeric, pct_ejecutado numeric,
  ingresos_sin_igv numeric, consultoria numeric, contraprestacion numeric, venta_ciprl numeric,
  ganancia_neta numeric, margen_neto numeric
) language sql stable set search_path = public as $$
  with par as (
    select coalesce((select valor from parametros_financieros where clave='igv'), 0.18)                      as igv,
           coalesce((select valor from parametros_financieros where clave='consultoria_oxi'), 0.10)          as cons,
           coalesce((select valor from parametros_financieros where clave='contraprestacion_privada'), 0.05) as contra,
           coalesce((select valor from parametros_financieros where clave='venta_ciprl'), 0.04)              as ciprl
  ), base as (
    select p.id,
      extract(year from p.fecha_firma_convenio)::int as anio_conv,
      coalesce(p.monto_contrato, 0) as contrato,
      coalesce(p.monto_adenda, 0)
        + coalesce((select sum(case when a.moneda = 'USD' then a.monto * tc_vigente(coalesce(a.fecha, current_date)) else a.monto end)
                    from adendas_proyecto a where a.proyecto_id = p.id), 0) as adenda,
      p.presupuesto,
      coalesce(p.moneda, 'PEN') as moneda,
      coalesce(p.monto_cobrado, 0) as cobrado,
      -- Gasto comprometido: OC aprobadas o recibidas (estados reales), al TC de cada orden
      coalesce((select sum(case when o.moneda = 'USD' then o.total * coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else o.total end)
                from ordenes_compra o
                where o.proyecto_id = p.id and o.estado in ('aprobada','recibida_parcial','recibida_total')), 0) as gasto_ocs,
      coalesce((select count(*) from ordenes_compra o
                where o.proyecto_id = p.id and o.estado in ('aprobada','recibida_parcial','recibida_total')), 0) as n_ocs,
      coalesce((select sum(case when g.moneda = 'USD' then g.monto * tc_vigente(g.fecha::date) else g.monto end)
                from gastos_caja_chica g where g.proyecto_id = p.id and g.estado = 'aprobado'), 0) as gasto_caja,
      coalesce((select count(*) from gastos_caja_chica g where g.proyecto_id = p.id and g.estado = 'aprobado'), 0) as n_caja,
      coalesce((select sum(gf.monto) from gastos_fijos_proyecto gf where gf.proyecto_id = p.id), 0) as gasto_fijos
    from proyectos p
    where p.id = p_proyecto
  ), calc as (
    select b.*, par.igv, par.cons, par.contra, par.ciprl,
      (b.contrato + b.adenda)                                   as contrato_total,
      (b.gasto_ocs + b.gasto_caja)                              as gasto_total,
      coalesce(b.presupuesto, b.contrato + b.adenda)            as techo,
      (b.contrato + b.adenda) / (1 + par.igv)                   as ingresos_sin_igv
    from base b, par
  )
  select c.id, c.anio_conv,
    c.contrato, c.adenda, c.contrato_total,
    c.presupuesto, c.moneda, c.cobrado, c.contrato_total - c.cobrado,
    c.gasto_ocs, c.gasto_caja, c.gasto_fijos, c.gasto_total,
    c.n_ocs, c.n_caja,
    c.techo - c.gasto_total                                                                   as saldo_disponible,
    c.contrato_total - c.gasto_total                                                          as utilidad,
    case when c.contrato_total > 0 then round((c.contrato_total - c.gasto_total) / c.contrato_total * 100, 2) else 0 end as margen,
    case when c.techo > 0 then round(c.gasto_total / c.techo * 100, 2) else 0 end             as pct_ejecutado,
    round(c.ingresos_sin_igv, 2),
    round(c.contrato_total * c.cons, 2),
    round(c.contrato_total * c.contra, 2),
    round(c.contrato_total * c.ciprl, 2),
    round(c.ingresos_sin_igv - c.gasto_total - c.contrato_total * (c.cons + c.contra + c.ciprl), 2) as ganancia_neta,
    case when c.ingresos_sin_igv > 0
         then round((c.ingresos_sin_igv - c.gasto_total - c.contrato_total * (c.cons + c.contra + c.ciprl)) / c.ingresos_sin_igv * 100, 2)
         else 0 end                                                                            as margen_neto
  from calc c;
$$;
grant execute on function public.proyecto_financiero(uuid) to authenticated;

create function public.proyectos_financiero_resumen(p_tenant uuid)
returns table (
  proyecto_id uuid, anio_convenio integer,
  monto_contrato numeric, monto_adenda numeric, monto_contrato_total numeric,
  presupuesto numeric, moneda text, monto_cobrado numeric, monto_pendiente_cobro numeric,
  gasto_ocs numeric, gasto_caja numeric, gasto_fijos numeric, gasto_total numeric,
  total_ocs bigint, total_gastos_caja bigint,
  saldo_disponible numeric, utilidad numeric, margen numeric, pct_ejecutado numeric,
  ingresos_sin_igv numeric, consultoria numeric, contraprestacion numeric, venta_ciprl numeric,
  ganancia_neta numeric, margen_neto numeric
) language sql stable set search_path = public as $$
  select f.* from proyectos p cross join lateral proyecto_financiero(p.id) f where p.tenant_id = p_tenant;
$$;
grant execute on function public.proyectos_financiero_resumen(uuid) to authenticated;

create or replace function public.proyectos_gasto_por_anio(p_tenant uuid)
returns table (proyecto_id uuid, anio integer, gasto_ocs numeric, gasto_caja numeric, gasto_total numeric)
language sql stable set search_path = public as $$
  with oc as (
    select o.proyecto_id, extract(year from o.fecha_emision)::int as anio,
           sum(case when o.moneda = 'USD' then o.total * coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else o.total end) as g
    from ordenes_compra o
    join proyectos p on p.id = o.proyecto_id and p.tenant_id = p_tenant
    where o.proyecto_id is not null
      and o.estado in ('aprobada','recibida_parcial','recibida_total')
      and o.fecha_emision is not null
    group by 1, 2
  ), caja as (
    select g.proyecto_id, extract(year from g.fecha)::int as anio,
           sum(case when g.moneda = 'USD' then g.monto * tc_vigente(g.fecha::date) else g.monto end) as g
    from gastos_caja_chica g
    join proyectos p on p.id = g.proyecto_id and p.tenant_id = p_tenant
    where g.proyecto_id is not null and g.estado = 'aprobado' and g.fecha is not null
    group by 1, 2
  )
  select coalesce(oc.proyecto_id, caja.proyecto_id), coalesce(oc.anio, caja.anio),
         coalesce(oc.g, 0), coalesce(caja.g, 0), coalesce(oc.g, 0) + coalesce(caja.g, 0)
  from oc full outer join caja on oc.proyecto_id = caja.proyecto_id and oc.anio = caja.anio;
$$;
grant execute on function public.proyectos_gasto_por_anio(uuid) to authenticated;

-- 4) proyectos.costo_real MANTENIDO POR LA BASE --------------------------------
create or replace function public.recalc_costo_real_proyecto(p_proyecto uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_proyecto is null then return; end if;
  update proyectos p
     set costo_real = (select gasto_total from proyecto_financiero(p_proyecto))
   where p.id = p_proyecto
     and p.costo_real is distinct from (select gasto_total from proyecto_financiero(p_proyecto));
end $$;

create or replace function public.trg_recalc_costo_real() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform recalc_costo_real_proyecto(old.proyecto_id); end if;
  if tg_op <> 'DELETE' then perform recalc_costo_real_proyecto(new.proyecto_id); end if;
  return null;
end $$;

drop trigger if exists trg_oc_costo_real on public.ordenes_compra;
create trigger trg_oc_costo_real
  after insert or update of estado, total, moneda, tipo_cambio, proyecto_id or delete on public.ordenes_compra
  for each row execute function public.trg_recalc_costo_real();

drop trigger if exists trg_caja_costo_real on public.gastos_caja_chica;
create trigger trg_caja_costo_real
  after insert or update of estado, monto, moneda, proyecto_id or delete on public.gastos_caja_chica
  for each row execute function public.trg_recalc_costo_real();

-- Relleno inicial: todos los proyectos quedan con su costo real de hoy.
update public.proyectos p set costo_real = (select gasto_total from public.proyecto_financiero(p.id));

-- 5) DUAL IMPUTATION: lo que la migración de referencia declaraba y prod no tenía
alter table public.transacciones add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;
create index if not exists idx_trx_proyecto on public.transacciones(proyecto_id) where proyecto_id is not null;
alter table public.presupuesto_lineas add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;
create index if not exists idx_pl_proyecto on public.presupuesto_lineas(proyecto_id) where proyecto_id is not null;
