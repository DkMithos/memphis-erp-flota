-- Bloque 3 — La cadena por proyecto: lo recibido vale lo que dice la OC, el
-- pago es una transacción que cierra el compromiso (y la factura), la
-- valorización es una cuenta por cobrar y el cobro la cierra. Todo termina en
-- proyecto_cadena(): presupuesto → comprometido → recibido → facturado → pagado
-- y valorizado → cobrado.

-- ── 1. Recepción valorada ─────────────────────────────────────────────────
alter table public.recepcion_items
  add column if not exists orden_item_id   uuid references public.orden_items(id) on delete set null,
  add column if not exists precio_unitario numeric,
  add column if not exists valor_recibido  numeric;
comment on column public.recepcion_items.valor_recibido is 'cantidad_recibida × precio del ítem de la OC (sin IGV, en la moneda de la OC).';
create index if not exists recepcion_items_orden_item_idx on public.recepcion_items(orden_item_id);

create or replace function public.set_recepcion_item_valor() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_oc uuid;
begin
  -- Si el formulario no dijo qué ítem de la OC es, se busca por descripción dentro de esa OC.
  if new.orden_item_id is null then
    select r.orden_id into v_oc from recepciones r where r.id = new.recepcion_id;
    select oi.id into new.orden_item_id from orden_items oi
     where oi.orden_id = v_oc and lower(trim(oi.descripcion)) = lower(trim(coalesce(new.descripcion, '')))
     order by oi.id limit 1;
  end if;
  if new.orden_item_id is not null and new.precio_unitario is null then
    select case when coalesce(oi.cantidad, 0) > 0 then oi.precio_total / oi.cantidad else oi.precio_unitario end
      into new.precio_unitario from orden_items oi where oi.id = new.orden_item_id;
  end if;
  new.valor_recibido := coalesce(new.cantidad_recibida, 0) * coalesce(new.precio_unitario, 0);
  return new;
end $$;
drop trigger if exists trg_recepcion_item_valor on public.recepcion_items;
create trigger trg_recepcion_item_valor
  before insert or update of orden_item_id, cantidad_recibida, precio_unitario, descripcion
  on public.recepcion_items for each row execute function public.set_recepcion_item_valor();

create or replace view public.v_oc_recepcion with (security_invoker = true) as
  select o.id as orden_compra_id, o.tenant_id, o.proyecto_id, o.numero, o.moneda, o.subtotal as pedido_sin_igv,
         coalesce(sum(ri.valor_recibido) filter (where r.estado <> 'rechazado'), 0) as recibido_sin_igv,
         count(distinct r.id) filter (where r.estado <> 'rechazado') as recepciones,
         case when o.subtotal > 0
              then round(coalesce(sum(ri.valor_recibido) filter (where r.estado <> 'rechazado'), 0) / o.subtotal * 100, 1) end as pct_recibido
    from public.ordenes_compra o
    left join public.recepciones r on r.orden_id = o.id
    left join public.recepcion_items ri on ri.recepcion_id = r.id
   where o.estado not in ('anulada', 'borrador', 'rechazada')
   group by o.id;
grant select on public.v_oc_recepcion to authenticated;

-- ── 2. El pago es una transacción enlazada ───────────────────────────────
alter table public.transacciones
  add column if not exists comprobante_id   uuid references public.comprobantes_pago(id) on delete set null,
  add column if not exists orden_compra_id  uuid references public.ordenes_compra(id) on delete set null,
  add column if not exists compromiso_id    uuid references public.flujo_compromisos(id) on delete set null,
  add column if not exists valorizacion_id  uuid references public.valorizaciones(id) on delete set null;
create index if not exists transacciones_compromiso_idx on public.transacciones(compromiso_id);
create index if not exists transacciones_comprobante_idx on public.transacciones(comprobante_id);

alter table public.flujo_compromisos add column if not exists valorizacion_id uuid references public.valorizaciones(id) on delete set null;
create unique index if not exists flujo_compromisos_valorizacion_uq on public.flujo_compromisos(valorizacion_id) where valorizacion_id is not null;

-- Hereda proyecto/CDC y encuentra el compromiso que paga (factura → OC → valorización); soles siempre.
create or replace function public.set_transaccion_dimension() returns trigger
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if new.comprobante_id is not null then
    select proyecto_id, centro_costo_id, orden_compra_id into v from comprobantes_pago where id = new.comprobante_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    new.centro_costo_id := coalesce(new.centro_costo_id, v.centro_costo_id);
    new.orden_compra_id := coalesce(new.orden_compra_id, v.orden_compra_id);
    if new.compromiso_id is null then
      select id into new.compromiso_id from flujo_compromisos where comprobante_id = new.comprobante_id order by importado_en desc nulls last limit 1;
    end if;
  end if;
  if new.orden_compra_id is not null then
    select proyecto_id, centro_costo_id into v from ordenes_compra where id = new.orden_compra_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    new.centro_costo_id := coalesce(new.centro_costo_id, v.centro_costo_id);
    if new.compromiso_id is null then
      select id into new.compromiso_id from flujo_compromisos
       where orden_compra_id = new.orden_compra_id and sentido = 'pagar' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'
       order by (fuente = 'erp') desc, importado_en desc nulls last limit 1;
    end if;
  end if;
  if new.valorizacion_id is not null then
    select proyecto_id into v from valorizaciones where id = new.valorizacion_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    if new.compromiso_id is null then
      select id into new.compromiso_id from flujo_compromisos where valorizacion_id = new.valorizacion_id limit 1;
    end if;
  end if;
  if new.compromiso_id is not null and (new.proyecto_id is null or new.centro_costo_id is null) then
    select proyecto_id, centro_costo_id into v from flujo_compromisos where id = new.compromiso_id;
    new.proyecto_id := coalesce(new.proyecto_id, v.proyecto_id);
    new.centro_costo_id := coalesce(new.centro_costo_id, v.centro_costo_id);
  end if;
  if coalesce(new.moneda, 'PEN') = 'USD' then
    new.tipo_cambio := coalesce(new.tipo_cambio, tc_vigente(coalesce(new.fecha_pago, new.fecha)));
    new.monto_soles := round(new.monto * new.tipo_cambio, 2);
  else
    new.monto_soles := new.monto;
  end if;
  return new;
end $$;
drop trigger if exists trg_transaccion_dimension on public.transacciones;
create trigger trg_transaccion_dimension
  before insert or update of comprobante_id, orden_compra_id, compromiso_id, valorizacion_id, monto, moneda, tipo_cambio, fecha, fecha_pago
  on public.transacciones for each row execute function public.set_transaccion_dimension();

-- Lo pagado de un compromiso = suma de sus transacciones pagadas. Si no tiene
-- ninguna del ERP no se toca (lo que trajo el Excel o "marcar pagado" se respeta).
create or replace function public.recalc_pago_compromiso(p_compromiso uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record; v_pagado numeric; v_fecha date; v_monto numeric; v_cerrado boolean;
begin
  select * into c from flujo_compromisos where id = p_compromiso;
  if not found then return; end if;
  if not exists (select 1 from transacciones where compromiso_id = p_compromiso) then return; end if;

  select coalesce(sum(case when coalesce(t.moneda, 'PEN') = coalesce(c.moneda, 'PEN') then t.monto
                           when coalesce(c.moneda, 'PEN') = 'PEN' then coalesce(t.monto_soles, t.monto * coalesce(t.tipo_cambio, 1))
                           else coalesce(t.monto_soles, t.monto) / coalesce(nullif(c.tc, 0), tc_vigente(coalesce(t.fecha_pago, t.fecha))) end), 0),
         max(coalesce(t.fecha_pago, t.fecha))
    into v_pagado, v_fecha
    from transacciones t
   where t.compromiso_id = p_compromiso and t.estado = 'pagada';

  v_monto := coalesce(c.monto_presupuestado, c.monto_ejecutado, 0);
  v_cerrado := v_monto > 0 and v_pagado >= v_monto - 0.01;

  update flujo_compromisos
     set monto_pagado = v_pagado,
         fecha_pagado = v_fecha,
         estado_pago  = case when v_cerrado then 'PAGADO' when v_pagado > 0 then 'PARCIAL' else 'PENDIENTE' end,
         origen       = case when v_pagado > 0 then 'real' else origen end
   where id = p_compromiso;

  if c.comprobante_id is not null then
    update comprobantes_pago
       set estado_flujo = case when v_cerrado then 'pagada' when estado_flujo = 'pagada' then 'programada_pago' else estado_flujo end
     where id = c.comprobante_id and coalesce(estado_flujo, '') in ('conforme', 'programada_pago', 'pagada');
  end if;
  if c.valorizacion_id is not null then
    update valorizaciones
       set estado = case when v_cerrado then 'pagada' when estado = 'pagada' then 'facturada' else estado end,
           fecha_pago = case when v_cerrado then v_fecha else null end
     where id = c.valorizacion_id and (v_cerrado or estado = 'pagada');
  end if;
end $$;

create or replace function public.trg_transaccion_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.compromiso_id is not null then perform recalc_pago_compromiso(old.compromiso_id); end if;
  if tg_op in ('INSERT', 'UPDATE') and new.compromiso_id is not null and (tg_op = 'INSERT' or new.compromiso_id is distinct from old.compromiso_id or true) then
    perform recalc_pago_compromiso(new.compromiso_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_transaccion_pago on public.transacciones;
create trigger trg_transaccion_pago
  after insert or update of estado, monto, moneda, tipo_cambio, monto_soles, fecha_pago, compromiso_id or delete
  on public.transacciones for each row execute function public.trg_transaccion_pago();

-- Registrar un pago desde Cuentas por pagar: nace la transacción y el disparador cierra el compromiso.
create or replace function public.registrar_pago_compromiso(
  p_compromiso uuid, p_fecha date default current_date, p_monto numeric default null, p_cuenta uuid default null, p_referencia text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; v_num text; v_id uuid; v_monto numeric; v_anio text;
begin
  if not (tiene_permiso('finanzas', 'editar') or tiene_permiso('finanzas', 'flujo')) then
    raise exception 'Sin permiso para registrar pagos';
  end if;
  select * into c from flujo_compromisos where id = p_compromiso;
  if not found then raise exception 'Compromiso no encontrado'; end if;
  v_monto := coalesce(p_monto, greatest(coalesce(c.monto_presupuestado, c.monto_ejecutado, 0) - coalesce(c.monto_pagado, 0), 0));
  if v_monto <= 0 then raise exception 'No queda nada por pagar en este compromiso'; end if;
  v_anio := to_char(p_fecha, 'YYYY');
  select 'TRX-' || v_anio || '-' || lpad((count(*) + 1)::text, 4, '0') into v_num
    from transacciones where tenant_id = c.tenant_id and numero like 'TRX-' || v_anio || '-%';
  insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, fecha, fecha_pago, descripcion,
                             cuenta_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                             compromiso_id, comprobante_id, orden_compra_id, valorizacion_id, creado_por, aprobado_por, aprobado_en)
  values (c.tenant_id, v_num, case when c.sentido = 'cobrar' then 'ingreso' else 'egreso' end,
          case when c.sentido = 'cobrar' then 'Cobro de valorización' else 'Pago a proveedores' end, c.categoria, 'pagada',
          v_monto, coalesce(c.moneda, 'PEN'), p_fecha, p_fecha,
          coalesce(c.concepto, 'Pago') || coalesce(' · ' || p_referencia, ''),
          p_cuenta, c.centro_costo_id, c.proyecto_id, coalesce(p_referencia, c.referencia_doc),
          case when c.comprobante_id is not null then 'factura' when c.orden_compra_id is not null then 'orden_compra' when c.valorizacion_id is not null then 'valorizacion' else 'compromiso' end,
          c.proveedor, c.id, c.comprobante_id, c.orden_compra_id, c.valorizacion_id,
          auth.uid()::text, auth.uid()::text, now())
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.registrar_pago_compromiso(uuid, date, numeric, uuid, text) to authenticated;

-- ── 3. La valorización es una cuenta por cobrar ──────────────────────────
insert into public.parametros_financieros (clave, valor, descripcion)
values ('dias_cobro_valorizacion', 30, 'Días estimados entre la aprobación de una valorización y su cobro (para proyectar la CxC).')
on conflict (clave) do nothing;

create or replace function public.sync_compromiso_de_valorizacion(p_val uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v record; p record; v_fecha date; v_dias int; v_tiene_pagos boolean;
begin
  select * into v from valorizaciones where id = p_val;
  if not found then return; end if;
  if v.estado not in ('presentada', 'aprobada', 'facturada', 'pagada') then
    delete from flujo_compromisos f where f.valorizacion_id = p_val
       and upper(coalesce(f.estado_pago, '')) not like 'PAGADO%'
       and not exists (select 1 from transacciones t where t.compromiso_id = f.id);
    return;
  end if;
  select codigo, nombre, entidad_cliente into p from proyectos where id = v.proyecto_id;
  v_dias := coalesce((select valor from parametros_financieros where clave = 'dias_cobro_valorizacion'), 30)::int;
  v_fecha := case when v.estado = 'pagada' then coalesce(v.fecha_pago, current_date)
                  when v.fecha_aprobacion is not null then v.fecha_aprobacion + v_dias
                  else coalesce(v.fecha_presentacion, current_date) + v_dias + 15 end;
  select exists (select 1 from transacciones t join flujo_compromisos f on f.id = t.compromiso_id where f.valorizacion_id = p_val) into v_tiene_pagos;

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
    case when v.estado = 'pagada' then coalesce(v.fecha_pago, current_date) end,
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

create or replace function public.trg_valorizacion_compromiso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from flujo_compromisos f where f.valorizacion_id = old.id
       and not exists (select 1 from transacciones t where t.compromiso_id = f.id);
    return old;
  end if;
  perform sync_compromiso_de_valorizacion(new.id);
  return null;
end $$;
drop trigger if exists trg_valorizacion_compromiso on public.valorizaciones;
create trigger trg_valorizacion_compromiso
  after insert or update of estado, monto, moneda, fecha_presentacion, fecha_aprobacion, fecha_pago, proyecto_id, descripcion
  on public.valorizaciones for each row execute function public.trg_valorizacion_compromiso();
drop trigger if exists trg_valorizacion_compromiso_del on public.valorizaciones;
create trigger trg_valorizacion_compromiso_del
  before delete on public.valorizaciones for each row execute function public.trg_valorizacion_compromiso();

-- Las 16 valorizaciones que ya existen entran a la CxC.
select public.sync_compromiso_de_valorizacion(id) from public.valorizaciones;

-- ── 4. La cadena completa de un proyecto ─────────────────────────────────
-- Todo en soles CON IGV (como el presupuesto de Operaciones y el total de la OC);
-- dólares al TC de cada documento. "Pagado" y "por pagar" salen del modelo CxP
-- (Excel + ERP), así que valen también para lo anterior al go-live.
create or replace function public.proyecto_cadena(p_proyecto uuid)
returns table (
  proyecto_id uuid,
  presupuesto numeric, comprometido numeric, ordenes bigint,
  recepcionado numeric, recepciones bigint, ordenes_con_recepcion bigint,
  facturado numeric, facturado_en_tramite numeric, facturas bigint,
  pagado numeric, por_pagar numeric, por_pagar_vencido numeric, pagos bigint,
  valorizado numeric, valorizaciones bigint, cobrado numeric, por_cobrar numeric, cobrado_registrado numeric
)
language sql stable security invoker set search_path = public as $$
  with oc as (
    select o.id, o.proyecto_id, o.regimen_igv, o.moneda,
           (1 + case when coalesce(o.regimen_igv, 'gravado') = 'gravado' then 0.18 else 0 end) as igv_f,
           case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end as tc_f,
           o.total
      from ordenes_compra o
     where o.proyecto_id = p_proyecto and o.estado in ('aprobada', 'recibida_parcial', 'recibida_total')
  ), rec as (
    select coalesce(sum(ri.valor_recibido * oc.igv_f * oc.tc_f), 0) as monto,
           count(distinct r.id) as n, count(distinct r.orden_id) as n_oc
      from recepciones r
      join oc on oc.id = r.orden_id
      left join recepcion_items ri on ri.recepcion_id = r.id
     where r.estado <> 'rechazado'
  ), fac as (
    select coalesce(sum(c.total * case when c.moneda = 'USD' then coalesce(c.tipo_cambio, tc_vigente(c.fecha_emision)) else 1 end)
                    filter (where coalesce(c.estado_flujo, 'recibida') in ('conforme', 'programada_pago', 'pagada')), 0) as aceptado,
           coalesce(sum(c.total * case when c.moneda = 'USD' then coalesce(c.tipo_cambio, tc_vigente(c.fecha_emision)) else 1 end)
                    filter (where coalesce(c.estado_flujo, 'recibida') in ('recibida', 'validada')), 0) as tramite,
           count(*) filter (where coalesce(c.estado_flujo, 'recibida') not in ('anulada', 'observada')) as n
      from comprobantes_pago c
     where c.proyecto_id = p_proyecto and c.direccion = 'recibido' and c.estado = 'activo'
  ), cxp as (
    select coalesce(sum(coalesce(x.monto_pagado, case when x.pagado then coalesce(x.monto_presupuestado, x.monto_ejecutado, 0) else 0 end) * x.tc_aplicado), 0) as pagado,
           coalesce(sum(x.monto_pendiente * x.tc_aplicado) filter (where not x.pagado), 0) as pendiente,
           coalesce(sum(x.monto_pendiente * x.tc_aplicado) filter (where x.vencido), 0) as vencido,
           count(*) filter (where x.pagado or coalesce(x.monto_pagado, 0) > 0) as n
      from v_cxp x
     where x.proyecto_id = p_proyecto
  ), val as (
    select coalesce(sum(v.monto * case when v.moneda = 'USD' then tc_vigente(coalesce(v.fecha_presentacion, current_date)) else 1 end)
                    filter (where v.estado in ('presentada', 'aprobada', 'facturada', 'pagada')), 0) as valorizado,
           coalesce(sum(v.monto * case when v.moneda = 'USD' then tc_vigente(coalesce(v.fecha_pago, current_date)) else 1 end)
                    filter (where v.estado = 'pagada'), 0) as cobrado,
           count(*) filter (where v.estado in ('presentada', 'aprobada', 'facturada', 'pagada')) as n
      from valorizaciones v
     where v.proyecto_id = p_proyecto
  )
  select p.id,
         coalesce(p.presupuesto, 0),
         coalesce((select sum(oc.total * oc.tc_f) from oc), 0), (select count(*) from oc),
         rec.monto, rec.n, rec.n_oc,
         fac.aceptado, fac.tramite, fac.n,
         cxp.pagado, cxp.pendiente, cxp.vencido, cxp.n,
         val.valorizado, val.n, val.cobrado, val.valorizado - val.cobrado, coalesce(p.monto_cobrado, 0)
    from proyectos p, rec, fac, cxp, val
   where p.id = p_proyecto;
$$;
grant execute on function public.proyecto_cadena(uuid) to authenticated;
