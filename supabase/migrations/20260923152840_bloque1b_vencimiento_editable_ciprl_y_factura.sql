-- Migración aplicada en producción vía Supabase (2026-09-23).
-- version: 20260923152840  name: bloque1b_vencimiento_editable_ciprl_y_factura
-- ============================================================================
-- BLOQUE 1b · Vencimientos: la factura manda cuando existe; CIPRL es un evento.
--  · OC: pago_ligado_a (ciprl | acordado), fecha de vencimiento editable
--    (vencimiento_manual) y marcada como estimada cuando hereda la fecha del
--    CIPRL del proyecto.
--  · Proyecto: fecha_ciprl_estimada / fecha_ciprl_cobro → se heredan a las OC
--    ligadas a CIPRL que no tengan fecha manual.
--  · Factura: si el XML no trae vencimiento, emisión + días de crédito de la OC;
--    al enlazarse, su fecha manda y se registra el desfase con la OC.
--  · v_cxp: lo ligado a CIPRL sin fecha (o con fecha estimada) NO está vencido.
-- ============================================================================

alter table public.ordenes_compra
  add column if not exists pago_ligado_a        text,
  add column if not exists vencimiento_manual   boolean not null default false,
  add column if not exists vencimiento_estimado boolean not null default false;
alter table public.ordenes_compra drop constraint if exists oc_pago_ligado_chk;
alter table public.ordenes_compra add constraint oc_pago_ligado_chk check (pago_ligado_a is null or pago_ligado_a in ('ciprl','acordado'));
comment on column public.ordenes_compra.pago_ligado_a is 'ciprl = se paga cuando la empresa cobra el CIPRL del proyecto · acordado = fecha a convenir (hay que ponerla a mano).';

alter table public.proyectos
  add column if not exists fecha_ciprl_estimada date,
  add column if not exists fecha_ciprl_cobro    date;
comment on column public.proyectos.fecha_ciprl_estimada is 'Cuándo Finanzas espera cobrar el CIPRL (se entera ~1 día antes). Las OC ligadas a CIPRL la heredan como vencimiento ESTIMADO.';
comment on column public.proyectos.fecha_ciprl_cobro is 'Fecha real del cobro del CIPRL: vuelve firme el vencimiento de las OC ligadas.';

alter table public.flujo_compromisos
  add column if not exists pago_ligado_a        text,
  add column if not exists vencimiento_estimado boolean not null default false,
  add column if not exists desfase_dias         int;
comment on column public.flujo_compromisos.desfase_dias is 'Vencimiento de la factura − vencimiento proyectado por la OC (días). Positivo = el proveedor dio más plazo; negativo = exige antes.';

create or replace function public.pago_ligado_de(p text) returns text
language sql immutable as $$
  select case when p ~* 'ciprl' then 'ciprl' when p ~* 'acordad' then 'acordado' else null end;
$$;

-- Vencimiento de la OC: manual > factura (vía compromiso) > CIPRL del proyecto > emisión + días.
create or replace function public.set_oc_vencimiento_pago() returns trigger
language plpgsql set search_path = public as $$
declare v_est date; v_cobro date;
begin
  if tg_op = 'INSERT' then
    new.pago_ligado_a := coalesce(new.pago_ligado_a, pago_ligado_de(new.condiciones_pago));
  elsif new.condiciones_pago is distinct from old.condiciones_pago then
    new.dias_credito  := dias_credito_de(new.condiciones_pago);
    new.pago_ligado_a := pago_ligado_de(new.condiciones_pago);
    if not new.vencimiento_manual then new.fecha_vencimiento_pago := null; new.vencimiento_estimado := false; end if;
  end if;
  if new.dias_credito is null then new.dias_credito := dias_credito_de(new.condiciones_pago); end if;

  -- La fecha puesta a mano manda.
  if new.vencimiento_manual and new.fecha_vencimiento_pago is not null then return new; end if;
  new.vencimiento_manual := false;

  if new.fecha_vencimiento_pago is null and new.dias_credito is not null and new.fecha_emision is not null then
    new.fecha_vencimiento_pago := new.fecha_emision::date + new.dias_credito;
    new.vencimiento_estimado := false;
  end if;

  -- CIPRL: hereda la fecha del proyecto (cobro real > estimada).
  if new.pago_ligado_a = 'ciprl' and new.proyecto_id is not null
     and (new.fecha_vencimiento_pago is null or new.vencimiento_estimado) then
    select fecha_ciprl_estimada, fecha_ciprl_cobro into v_est, v_cobro from proyectos where id = new.proyecto_id;
    if v_cobro is not null then new.fecha_vencimiento_pago := v_cobro; new.vencimiento_estimado := false;
    elsif v_est is not null then new.fecha_vencimiento_pago := v_est; new.vencimiento_estimado := true; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_vencimiento_pago on public.ordenes_compra;
create trigger trg_oc_vencimiento_pago
  before insert or update of condiciones_pago, fecha_emision, dias_credito, fecha_vencimiento_pago, vencimiento_manual, proyecto_id
  on public.ordenes_compra for each row execute function public.set_oc_vencimiento_pago();

-- Las fechas de CIPRL del proyecto bajan a sus OC ligadas (sin fecha manual).
create or replace function public.trg_proyecto_ciprl_fechas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.fecha_ciprl_cobro, new.fecha_ciprl_estimada) is not null then
    update ordenes_compra
       set fecha_vencimiento_pago = coalesce(new.fecha_ciprl_cobro, new.fecha_ciprl_estimada),
           vencimiento_estimado   = (new.fecha_ciprl_cobro is null)
     where proyecto_id = new.id and pago_ligado_a = 'ciprl' and not vencimiento_manual;
  end if;
  return null;
end $$;
drop trigger if exists trg_proyecto_ciprl on public.proyectos;
create trigger trg_proyecto_ciprl after update of fecha_ciprl_estimada, fecha_ciprl_cobro on public.proyectos
  for each row execute function public.trg_proyecto_ciprl_fechas();

-- OC → compromiso: lleva el ligado/estimado y su fecha manda salvo que ya haya factura.
create or replace function public.sync_compromiso_de_oc(p_oc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_area text;
begin
  select oc.*, c.codigo as cc_codigo, c.area as cc_area, p.razon_social as prov_nombre
    into r
    from ordenes_compra oc
    left join centros_costo c on c.id = oc.centro_costo_id
    left join proveedores p on p.id = oc.proveedor_id
   where oc.id = p_oc;
  if not found then return; end if;

  if r.estado not in ('aprobada', 'recibida_parcial', 'recibida_total')
     or coalesce(r.fecha_emision::date, current_date) < cxp_desde() then
    delete from flujo_compromisos
     where orden_compra_id = p_oc and fuente = 'erp' and comprobante_id is null
       and upper(coalesce(estado_pago, '')) not like 'PAGADO%';
    return;
  end if;

  -- El Excel manda hasta que el flujo sea nativo; pero el ligado a CIPRL se propaga.
  if exists (select 1 from flujo_compromisos where orden_compra_id = p_oc and fuente = 'excel') then
    update flujo_compromisos set pago_ligado_a = r.pago_ligado_a
     where orden_compra_id = p_oc and fuente = 'excel' and pago_ligado_a is distinct from r.pago_ligado_a;
    return;
  end if;

  v_area := case when r.proyecto_id is not null then 'PROYECTOS' else coalesce(r.cc_area, 'ADMINISTRACION') end;

  insert into flujo_compromisos (
    tenant_id, area, cdc, centro_costo_id, proyecto_id, concepto, categoria, proveedor, proveedor_id,
    moneda, tc, mes_vencimiento, fecha_vencimiento, monto_presupuestado, monto_ejecutado,
    estado_pago, sentido, origen, fuente, orden_compra_id, referencia_doc, creado_por,
    pago_ligado_a, vencimiento_estimado)
  values (
    r.tenant_id, v_area, r.cc_codigo, r.centro_costo_id, r.proyecto_id,
    'OC ' || r.numero || coalesce(' · ' || nullif(left(r.observaciones, 80), ''), ''),
    coalesce(r.tipo, 'oc'), r.prov_nombre, r.proveedor_id,
    r.moneda, r.tipo_cambio,
    date_trunc('month', coalesce(r.fecha_vencimiento_pago, r.fecha_emision::date))::date,
    r.fecha_vencimiento_pago, r.total, r.total,
    'PENDIENTE', 'pagar', 'comprometido', 'erp', r.id, r.numero, r.creado_por,
    r.pago_ligado_a, r.vencimiento_estimado)
  on conflict (orden_compra_id) where orden_compra_id is not null and fuente = 'erp' do update set
    monto_presupuestado = excluded.monto_presupuestado,
    monto_ejecutado     = excluded.monto_ejecutado,
    moneda              = excluded.moneda,
    tc                  = coalesce(flujo_compromisos.tc, excluded.tc),
    -- Con factura enlazada manda la factura; si no, la fecha de la OC (manual, CIPRL o derivada).
    fecha_vencimiento   = case when flujo_compromisos.comprobante_id is not null then flujo_compromisos.fecha_vencimiento
                               else coalesce(excluded.fecha_vencimiento, flujo_compromisos.fecha_vencimiento) end,
    mes_vencimiento     = case when flujo_compromisos.comprobante_id is not null then flujo_compromisos.mes_vencimiento
                               else coalesce(date_trunc('month', excluded.fecha_vencimiento)::date, flujo_compromisos.mes_vencimiento) end,
    vencimiento_estimado = case when flujo_compromisos.comprobante_id is not null then false else excluded.vencimiento_estimado end,
    pago_ligado_a       = excluded.pago_ligado_a,
    proyecto_id         = excluded.proyecto_id,
    centro_costo_id     = coalesce(flujo_compromisos.centro_costo_id, excluded.centro_costo_id),
    proveedor_id        = coalesce(flujo_compromisos.proveedor_id, excluded.proveedor_id),
    origen              = case when flujo_compromisos.comprobante_id is not null then 'real' else 'comprometido' end;
end $$;

-- Factura sin vencimiento en el XML: emisión + días de crédito de la OC.
create or replace function public.set_factura_vencimiento() returns trigger
language plpgsql set search_path = public as $$
declare v_dias int;
begin
  if new.fecha_vencimiento is null and new.orden_compra_id is not null and new.fecha_emision is not null then
    select dias_credito into v_dias from ordenes_compra where id = new.orden_compra_id;
    if v_dias is not null then new.fecha_vencimiento := new.fecha_emision::date + v_dias; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_factura_vencimiento on public.comprobantes_pago;
create trigger trg_factura_vencimiento before insert or update of orden_compra_id, fecha_emision
  on public.comprobantes_pago for each row execute function public.set_factura_vencimiento();

-- Factura → compromiso: la fecha de la factura manda; se guarda el desfase con la OC.
create or replace function public.trg_factura_compromiso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_area text; v_cc record; v_venc_oc date;
begin
  if new.estado_flujo = 'anulada' then
    update flujo_compromisos set comprobante_id = null, desfase_dias = null,
           origen = case when orden_compra_id is not null then 'comprometido' else origen end
     where comprobante_id = new.id;
    return null;
  end if;

  if new.orden_compra_id is not null then
    perform sync_compromiso_de_oc(new.orden_compra_id);
    select fecha_vencimiento_pago into v_venc_oc from ordenes_compra where id = new.orden_compra_id;
    update flujo_compromisos set
      comprobante_id       = new.id,
      origen               = 'real',
      fecha_vencimiento    = coalesce(new.fecha_vencimiento, fecha_vencimiento),
      mes_vencimiento      = coalesce(date_trunc('month', new.fecha_vencimiento)::date, mes_vencimiento),
      vencimiento_estimado = case when new.fecha_vencimiento is not null then false else vencimiento_estimado end,
      desfase_dias         = case when new.fecha_vencimiento is not null and v_venc_oc is not null then new.fecha_vencimiento - v_venc_oc else desfase_dias end,
      referencia_doc       = coalesce(new.numero_completo, referencia_doc),
      estado_pago          = case when new.estado_flujo = 'pagada' then 'PAGADO' else estado_pago end
    where orden_compra_id = new.orden_compra_id;
    return null;
  end if;

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

-- Quién puede fijar fechas (Finanzas, Compras o quien lleva el flujo).
create or replace function public.fijar_vencimiento_oc(p_oc uuid, p_fecha date, p_estimado boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (auth_tiene_permiso('finanzas','editar') or auth_tiene_permiso('finanzas','flujo') or auth_tiene_permiso('compras','editar')) then
    raise exception 'Sin permiso para fijar el vencimiento';
  end if;
  update ordenes_compra
     set fecha_vencimiento_pago = p_fecha,
         vencimiento_manual     = (p_fecha is not null),
         vencimiento_estimado   = coalesce(p_estimado, false)
   where id = p_oc
     and tenant_id in (select tenant_id from usuarios_tenant where user_id = auth.uid());
end $$;
grant execute on function public.fijar_vencimiento_oc(uuid, date, boolean) to authenticated;

create or replace function public.fijar_ciprl_proyecto(p_proyecto uuid, p_estimada date, p_cobro date default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (auth_tiene_permiso('finanzas','editar') or auth_tiene_permiso('finanzas','flujo')) then
    raise exception 'Sin permiso para fijar las fechas del CIPRL';
  end if;
  update proyectos set fecha_ciprl_estimada = p_estimada, fecha_ciprl_cobro = p_cobro
   where id = p_proyecto
     and tenant_id in (select tenant_id from usuarios_tenant where user_id = auth.uid());
end $$;
grant execute on function public.fijar_ciprl_proyecto(uuid, date, date) to authenticated;

-- Vistas: se recrean porque f.* cambió de forma.
drop view if exists public.v_cxp_por_mes;
drop view if exists public.v_cxp;
drop view if exists public.v_cxc;

create view public.v_cxp with (security_invoker = true) as
  select f.*,
    coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence,
    to_char(coalesce(f.fecha_vencimiento, f.mes_vencimiento), 'YYYY-MM') as mes,
    greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as monto_pendiente,
    (upper(coalesce(f.estado_pago, '')) like 'PAGADO%') as pagado,
    (coalesce(f.fecha_vencimiento, f.mes_vencimiento) < current_date
       and upper(coalesce(f.estado_pago, '')) not like 'PAGADO%'
       and not (f.pago_ligado_a = 'ciprl' and f.vencimiento_estimado)) as vencido,
    case when f.moneda = 'USD' then coalesce(f.tc, tc_vigente(coalesce(f.fecha_vencimiento, f.mes_vencimiento, current_date))) else 1 end as tc_aplicado
  from public.flujo_compromisos f
  where f.sentido = 'pagar';

create view public.v_cxc with (security_invoker = true) as
  select f.*,
    coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence,
    to_char(coalesce(f.fecha_vencimiento, f.mes_vencimiento), 'YYYY-MM') as mes,
    greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as monto_pendiente,
    (upper(coalesce(f.estado_pago, '')) like 'PAGADO%') as cobrado,
    case when f.moneda = 'USD' then coalesce(f.tc, tc_vigente(coalesce(f.fecha_vencimiento, f.mes_vencimiento, current_date))) else 1 end as tc_aplicado
  from public.flujo_compromisos f
  where f.sentido = 'cobrar';

create view public.v_cxp_por_mes with (security_invoker = true) as
  select tenant_id, mes, area, origen, moneda,
         count(*) as compromisos,
         sum(monto_pendiente) as pendiente,
         sum(monto_pendiente * tc_aplicado) as pendiente_soles,
         sum(case when vencido then monto_pendiente * tc_aplicado else 0 end) as vencido_soles
  from public.v_cxp
  where not pagado
  group by tenant_id, mes, area, origen, moneda;

grant select on public.v_cxp, public.v_cxc, public.v_cxp_por_mes to authenticated;

-- Relleno: OC existentes y compromisos (ERP y Excel) heredan el ligado.
update public.ordenes_compra set pago_ligado_a = pago_ligado_de(condiciones_pago) where pago_ligado_a is null and pago_ligado_de(condiciones_pago) is not null;
update public.flujo_compromisos f set pago_ligado_a = o.pago_ligado_a
  from public.ordenes_compra o where o.id = f.orden_compra_id and f.pago_ligado_a is distinct from o.pago_ligado_a;
