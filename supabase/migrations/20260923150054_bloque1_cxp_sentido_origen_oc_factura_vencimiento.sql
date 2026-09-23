-- Migración aplicada en producción vía Supabase (2026-09-23).
-- version: 20260923150054  name: bloque1_cxp_sentido_origen_oc_factura_vencimiento
-- ============================================================================
-- BLOQUE 1 · Cuentas por pagar por mes (según docs/PLAN-CxP.md, decisiones 26-27/08)
--  1) flujo_compromisos evoluciona al modelo CxP: sentido (pagar/cobrar, montos
--     SIEMPRE positivos), origen (real/comprometido/proyectado), enlaces a OC y
--     factura, proyecto derivado del CDC, fecha de vencimiento, referencia del doc.
--  2) centros_costo.area (dueño del CDC), rellenado por mayoría desde el flujo.
--  3) OC: dias_credito y fecha_vencimiento_pago derivados de la condición de pago.
--  4) OC aprobada → compromiso (sync); factura → compromiso (real).
--     (La versión definitiva de sync_compromiso_de_oc está en 20260923151242.)
--  5) Vistas v_cxp / v_cxc / v_cxp_por_mes (security invoker: respeta RLS por área).
-- ============================================================================

-- 1) MODELO CxP SOBRE flujo_compromisos -----------------------------------------
alter table public.flujo_compromisos
  add column if not exists sentido          text not null default 'pagar',
  add column if not exists origen           text not null default 'proyectado',
  add column if not exists orden_compra_id  uuid references public.ordenes_compra(id) on delete set null,
  add column if not exists comprobante_id   uuid references public.comprobantes_pago(id) on delete set null,
  add column if not exists proyecto_id      uuid references public.proyectos(id) on delete set null,
  add column if not exists fecha_vencimiento date,
  add column if not exists referencia_doc   text;
alter table public.flujo_compromisos drop constraint if exists flujo_sentido_chk;
alter table public.flujo_compromisos add constraint flujo_sentido_chk check (sentido in ('pagar','cobrar'));
alter table public.flujo_compromisos drop constraint if exists flujo_origen_chk;
alter table public.flujo_compromisos add constraint flujo_origen_chk check (origen in ('real','comprometido','proyectado'));
comment on column public.flujo_compromisos.sentido is 'pagar = cuenta por pagar · cobrar = cuenta por cobrar (CIPRL, valorizaciones). Montos siempre positivos; nunca codificar por signo.';
comment on column public.flujo_compromisos.origen  is 'real = con factura · comprometido = con OC/aprobación · proyectado = estimación/recurrencia (Excel).';

create unique index if not exists flujo_compromisos_oc_erp_unica on public.flujo_compromisos(orden_compra_id) where orden_compra_id is not null and fuente = 'erp';
create unique index if not exists flujo_compromisos_factura_unica on public.flujo_compromisos(comprobante_id) where comprobante_id is not null and orden_compra_id is null;
create index if not exists flujo_compromisos_cxp_idx on public.flujo_compromisos(tenant_id, sentido, fecha_vencimiento);

update public.flujo_compromisos
   set sentido = 'cobrar',
       monto_presupuestado = abs(monto_presupuestado),
       monto_ejecutado     = abs(monto_ejecutado),
       monto_pagado        = abs(monto_pagado)
 where coalesce(monto_presupuestado, 0) < 0 or coalesce(monto_ejecutado, 0) < 0;
update public.flujo_compromisos set origen = 'real' where upper(coalesce(estado_pago, '')) like 'PAGADO%';
update public.flujo_compromisos set fecha_vencimiento = mes_vencimiento where fecha_vencimiento is null and mes_vencimiento is not null;

create or replace function public.set_flujo_proyecto_from_cc() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.centro_costo_id is not null then
    select proyecto_id into new.proyecto_id from centros_costo where id = new.centro_costo_id;
  elsif new.orden_compra_id is null and new.comprobante_id is null then
    new.proyecto_id := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_flujo_proyecto on public.flujo_compromisos;
create trigger trg_flujo_proyecto before insert or update of centro_costo_id on public.flujo_compromisos
  for each row execute function public.set_flujo_proyecto_from_cc();
update public.flujo_compromisos f set proyecto_id = c.proyecto_id
  from public.centros_costo c where c.id = f.centro_costo_id and f.proyecto_id is distinct from c.proyecto_id;

-- 2) ÁREA DUEÑA DEL CENTRO DE COSTO --------------------------------------------
alter table public.centros_costo add column if not exists area text;
comment on column public.centros_costo.area is 'Área dueña del CDC (ADMINISTRACION/CONTABILIDAD/TI/PROYECTOS). Rellenada por mayoría desde el flujo; corregible en Admin.';
update public.centros_costo cc set area = s.area
  from (
    select distinct on (centro_costo_id) centro_costo_id, area
    from (select centro_costo_id, area, count(*) n from public.flujo_compromisos where centro_costo_id is not null group by 1, 2) x
    order by centro_costo_id, n desc
  ) s
 where s.centro_costo_id = cc.id and cc.area is null;
update public.centros_costo set area = 'PROYECTOS' where area is null and proyecto_id is not null;

-- 3) VENCIMIENTO DE PAGO DE LA OC ----------------------------------------------
alter table public.ordenes_compra
  add column if not exists dias_credito int,
  add column if not exists fecha_vencimiento_pago date;
comment on column public.ordenes_compra.fecha_vencimiento_pago is 'Derivada de condiciones_pago (fecha_emision + dias_credito). Editable; obligatoria a mano para CIPRL / según lo acordado.';

create or replace function public.dias_credito_de(p text) returns int
language sql immutable as $$
  select case
    when p is null or btrim(p) = '' then null
    when p ~* '(contado|adelantad|anticip)' then 0
    when p ~* '\d+\s*d[ií]as?' then (regexp_match(p, '(\d+)\s*d[ií]as?', 'i'))[1]::int
    else null end;
$$;

create or replace function public.set_oc_vencimiento_pago() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.condiciones_pago is distinct from old.condiciones_pago then
    new.dias_credito := dias_credito_de(new.condiciones_pago);
    new.fecha_vencimiento_pago := null;
  end if;
  if new.dias_credito is null then new.dias_credito := dias_credito_de(new.condiciones_pago); end if;
  if new.fecha_vencimiento_pago is null and new.dias_credito is not null and new.fecha_emision is not null then
    new.fecha_vencimiento_pago := new.fecha_emision::date + new.dias_credito;
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_vencimiento_pago on public.ordenes_compra;
create trigger trg_oc_vencimiento_pago before insert or update of condiciones_pago, fecha_emision, dias_credito on public.ordenes_compra
  for each row execute function public.set_oc_vencimiento_pago();

update public.ordenes_compra set dias_credito = dias_credito_de(condiciones_pago) where dias_credito is null;
update public.ordenes_compra set fecha_vencimiento_pago = fecha_emision::date + dias_credito
 where fecha_vencimiento_pago is null and dias_credito is not null and fecha_emision is not null;

-- 4) TRIGGERS OC → COMPROMISO · FACTURA → COMPROMISO ---------------------------
-- sync_compromiso_de_oc: ver 20260923151242 (versión definitiva con cxp_desde).
create or replace function public.trg_oc_compromiso() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform sync_compromiso_de_oc(new.id); return null; end $$;

create or replace function public.trg_factura_compromiso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_area text; v_cc record;
begin
  if new.estado_flujo = 'anulada' then
    update flujo_compromisos set comprobante_id = null,
           origen = case when orden_compra_id is not null then 'comprometido' else origen end
     where comprobante_id = new.id;
    return null;
  end if;

  if new.orden_compra_id is not null then
    perform sync_compromiso_de_oc(new.orden_compra_id);
    update flujo_compromisos set
      comprobante_id    = new.id,
      origen            = 'real',
      fecha_vencimiento = coalesce(new.fecha_vencimiento, fecha_vencimiento),
      mes_vencimiento   = coalesce(date_trunc('month', new.fecha_vencimiento)::date, mes_vencimiento),
      referencia_doc    = coalesce(new.numero_completo, referencia_doc),
      estado_pago       = case when new.estado_flujo = 'pagada' then 'PAGADO' else estado_pago end
    where orden_compra_id = new.orden_compra_id;
    return null;
  end if;

  -- Factura sin OC (N30): compromiso propio, anclado en la factura.
  select codigo, area, proyecto_id into v_cc from centros_costo where id = new.centro_costo_id;
  v_area := case when coalesce(new.proyecto_id, v_cc.proyecto_id) is not null then 'PROYECTOS' else coalesce(v_cc.area, 'ADMINISTRACION') end;
  insert into flujo_compromisos (
    tenant_id, area, cdc, centro_costo_id, proyecto_id, concepto, categoria, proveedor, proveedor_id,
    moneda, tc, mes_vencimiento, fecha_vencimiento, monto_presupuestado, monto_ejecutado,
    estado_pago, sentido, origen, fuente, comprobante_id, referencia_doc, creado_por)
  values (
    new.tenant_id, v_area, v_cc.codigo, new.centro_costo_id, coalesce(new.proyecto_id, v_cc.proyecto_id),
    'Factura ' || coalesce(new.numero_completo, new.serie || '-' || new.numero), 'factura',
    new.razon_social_emisor, new.proveedor_id,
    new.moneda, new.tipo_cambio,
    date_trunc('month', coalesce(new.fecha_vencimiento, new.fecha_emision))::date,
    new.fecha_vencimiento, new.total, new.total,
    case when new.estado_flujo = 'pagada' then 'PAGADO' else 'PENDIENTE' end,
    'pagar', 'real', 'erp', new.id, new.numero_completo, new.creado_por)
  on conflict (comprobante_id) where comprobante_id is not null and orden_compra_id is null do update set
    monto_presupuestado = excluded.monto_presupuestado, monto_ejecutado = excluded.monto_ejecutado,
    fecha_vencimiento = excluded.fecha_vencimiento, mes_vencimiento = excluded.mes_vencimiento,
    estado_pago = case when new.estado_flujo = 'pagada' then 'PAGADO' else flujo_compromisos.estado_pago end;
  return null;
end $$;
drop trigger if exists trg_factura_compromiso on public.comprobantes_pago;
create trigger trg_factura_compromiso
  after insert or update of estado_flujo, orden_compra_id, fecha_vencimiento, total, proyecto_id, centro_costo_id
  on public.comprobantes_pago for each row execute function public.trg_factura_compromiso();

-- 5) VISTAS -----------------------------------------------------------------------
create or replace view public.v_cxp with (security_invoker = true) as
  select f.*,
    coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence,
    to_char(coalesce(f.fecha_vencimiento, f.mes_vencimiento), 'YYYY-MM') as mes,
    greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as monto_pendiente,
    (upper(coalesce(f.estado_pago, '')) like 'PAGADO%') as pagado,
    (coalesce(f.fecha_vencimiento, f.mes_vencimiento) < current_date
       and upper(coalesce(f.estado_pago, '')) not like 'PAGADO%') as vencido,
    case when f.moneda = 'USD' then coalesce(f.tc, tc_vigente(coalesce(f.fecha_vencimiento, f.mes_vencimiento, current_date))) else 1 end as tc_aplicado
  from public.flujo_compromisos f
  where f.sentido = 'pagar';

create or replace view public.v_cxc with (security_invoker = true) as
  select f.*,
    coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence,
    to_char(coalesce(f.fecha_vencimiento, f.mes_vencimiento), 'YYYY-MM') as mes,
    greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as monto_pendiente,
    (upper(coalesce(f.estado_pago, '')) like 'PAGADO%') as cobrado,
    case when f.moneda = 'USD' then coalesce(f.tc, tc_vigente(coalesce(f.fecha_vencimiento, f.mes_vencimiento, current_date))) else 1 end as tc_aplicado
  from public.flujo_compromisos f
  where f.sentido = 'cobrar';

create or replace view public.v_cxp_por_mes with (security_invoker = true) as
  select tenant_id, mes, area, origen, moneda,
         count(*) as compromisos,
         sum(monto_pendiente) as pendiente,
         sum(monto_pendiente * tc_aplicado) as pendiente_soles,
         sum(case when vencido then monto_pendiente * tc_aplicado else 0 end) as vencido_soles
  from public.v_cxp
  where not pagado
  group by tenant_id, mes, area, origen, moneda;

grant select on public.v_cxp, public.v_cxc, public.v_cxp_por_mes to authenticated;
