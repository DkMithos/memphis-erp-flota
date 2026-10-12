-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 · Obligaciones financieras (préstamos, cheques diferidos, letras,
-- deuda tributaria y fraccionamientos) como compromisos del flujo · 2026-10-12
--
-- Hoy viven en `Libro obligaciones memphis.xlsx` (Administración) y en
-- `CONTROL DE LA DEUDA 2023-2026` (Contabilidad), y entran al flujo solo si
-- alguien las digita en BD CONTA / Flujo Administración. Aquí cada obligación
-- tiene su cronograma de cuotas y cada cuota es un compromiso (fuente 'erp',
-- categoría 'financiamiento'): aparece en el flujo de caja, en Cuentas por pagar
-- y se paga por lotes como cualquier otra línea. El pago cierra la cuota y, con
-- la última, la obligación.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists obligaciones_financieras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  numero text not null,                                  -- OBL-AAAA-NNN
  tipo text not null check (tipo in ('prestamo', 'cheque_diferido', 'letra', 'deuda_tributaria', 'fraccionamiento', 'otro')),
  acreedor text not null,
  proveedor_id uuid references proveedores(id) on delete set null,
  concepto text,
  documento text,                                        -- contrato, pagaré, n.º de cheque, resolución SUNAT
  moneda text not null default 'PEN',
  capital numeric not null default 0,
  interes_total numeric not null default 0,              -- interés pactado en monto (si se conoce)
  tasa_interes numeric,                                  -- tasa mensual, informativa
  interes_tipo text,                                     -- compensatorio | moratorio | compensatorio+moratorio
  penalidad text,
  fecha_contrato date,
  fecha_vencimiento date,
  estado text not null default 'vigente' check (estado in ('vigente', 'vencida', 'pagada', 'renegociada', 'anulada')),
  area text not null default 'ADMINISTRACION',
  cdc text,
  centro_costo_id uuid references centros_costo(id) on delete set null,
  proyecto_id uuid references proyectos(id) on delete set null,
  observaciones text,
  origen_archivo text,
  creado_por uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, numero)
);

create table if not exists obligaciones_cuotas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  obligacion_id uuid not null references obligaciones_financieras(id) on delete cascade,
  numero int not null,
  vencimiento date not null,
  capital numeric not null default 0,
  interes numeric not null default 0,
  total numeric not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'anulada')),
  pagado numeric not null default 0,
  fecha_pago date,
  compromiso_id uuid references flujo_compromisos(id) on delete set null,
  notas text,
  unique (obligacion_id, numero)
);
create index if not exists obligaciones_cuotas_venc_idx on obligaciones_cuotas (tenant_id, estado, vencimiento);

alter table flujo_compromisos add column if not exists obligacion_cuota_id uuid references obligaciones_cuotas(id) on delete set null;
create unique index if not exists flujo_compromisos_oblig_cuota_uq on flujo_compromisos (obligacion_cuota_id) where obligacion_cuota_id is not null;

alter table obligaciones_financieras enable row level security;
alter table obligaciones_cuotas enable row level security;
drop policy if exists oblig_sel on obligaciones_financieras;
create policy oblig_sel on obligaciones_financieras for select
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('finanzas', 'flujo') or auth_tiene_permiso('contabilidad', 'ver')));
drop policy if exists oblig_cuotas_sel on obligaciones_cuotas;
create policy oblig_cuotas_sel on obligaciones_cuotas for select
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('finanzas', 'flujo') or auth_tiene_permiso('contabilidad', 'ver')));
-- Las escrituras pasan por las funciones (security definer): no hay política de insert/update/delete.

create or replace function public.obligacion_puede_editar() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_tiene_permiso('finanzas', 'editar') or auth_tiene_permiso('finanzas', 'crear') or auth_tiene_permiso('contabilidad', 'editar');
$$;

-- Estado de la obligación a partir de sus cuotas.
create or replace function public.obligacion_recalcular_estado(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o record; v_total int; v_pag int; v_venc int;
begin
  select * into o from obligaciones_financieras where id = p_id;
  if not found or o.estado in ('anulada', 'renegociada') then return; end if;
  select count(*) filter (where estado <> 'anulada'), count(*) filter (where estado = 'pagada'),
         count(*) filter (where estado = 'pendiente' and vencimiento < current_date)
    into v_total, v_pag, v_venc from obligaciones_cuotas where obligacion_id = p_id;
  update obligaciones_financieras
     set estado = case when v_total > 0 and v_pag = v_total then 'pagada'
                       when v_venc > 0 then 'vencida'
                       when v_total = 0 and o.fecha_vencimiento is not null and o.fecha_vencimiento < current_date then 'vencida'
                       else 'vigente' end,
         actualizado_en = now()
   where id = p_id;
end $$;

-- Cada cuota viva tiene su compromiso en el flujo; se crea o se actualiza aquí.
create or replace function public.obligacion_sincronizar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o record; c record; v_n int; v_concepto text; v_cdc text; v_area text; v_estado text;
begin
  select * into o from obligaciones_financieras where id = p_id;
  if not found then return; end if;
  select count(*) into v_n from obligaciones_cuotas where obligacion_id = p_id and estado <> 'anulada';
  v_area := case when o.tipo in ('deuda_tributaria', 'fraccionamiento') then 'CONTABILIDAD' else coalesce(o.area, 'ADMINISTRACION') end;
  v_cdc := coalesce(o.cdc, case when o.tipo in ('deuda_tributaria', 'fraccionamiento') then 'SUNAT' else 'PRÉSTAMOS' end);
  for c in select * from obligaciones_cuotas where obligacion_id = p_id order by numero loop
    if c.estado = 'anulada' or o.estado = 'anulada' then
      if c.compromiso_id is not null and not exists (select 1 from transacciones t where t.compromiso_id = c.compromiso_id) then
        delete from flujo_compromisos where id = c.compromiso_id;
        update obligaciones_cuotas set compromiso_id = null where id = c.id;
      end if;
      continue;
    end if;
    v_concepto := concat_ws(' · ', o.acreedor, o.concepto, case when v_n > 1 then 'cuota ' || c.numero || ' de ' || v_n else null end);
    v_estado := case when c.estado = 'pagada' then 'PAGADO' else 'PENDIENTE' end;
    if c.compromiso_id is null then
      insert into flujo_compromisos (tenant_id, area, cdc, centro_costo_id, proyecto_id, concepto, categoria, proveedor, proveedor_id,
                                     moneda, mes_vencimiento, fecha_vencimiento, monto_presupuestado, monto_ejecutado, monto_pagado, fecha_pagado,
                                     estado_pago, sentido, origen, fuente, referencia_doc, obligacion_cuota_id, creado_por, observaciones)
      values (o.tenant_id, v_area, v_cdc, o.centro_costo_id, o.proyecto_id, v_concepto, 'financiamiento', o.acreedor, o.proveedor_id,
              o.moneda, date_trunc('month', c.vencimiento)::date, c.vencimiento, c.total, c.total,
              case when c.estado = 'pagada' then coalesce(nullif(c.pagado, 0), c.total) else 0 end, case when c.estado = 'pagada' then c.fecha_pago end,
              v_estado, 'pagar', 'real', 'erp', o.numero || '/' || c.numero, c.id, o.creado_por, o.tipo)
      returning id into c.compromiso_id;
      update obligaciones_cuotas set compromiso_id = c.compromiso_id where id = c.id;
    else
      update flujo_compromisos
         set area = v_area, cdc = v_cdc, concepto = v_concepto, proveedor = o.acreedor, proveedor_id = o.proveedor_id, moneda = o.moneda,
             mes_vencimiento = date_trunc('month', c.vencimiento)::date, fecha_vencimiento = c.vencimiento,
             monto_presupuestado = c.total, monto_ejecutado = c.total, referencia_doc = o.numero || '/' || c.numero,
             centro_costo_id = o.centro_costo_id, proyecto_id = o.proyecto_id,
             -- una cuota marcada pagada a mano (histórica) cierra el compromiso; si hay transacciones, manda recalc_pago_compromiso
             estado_pago = case when c.estado = 'pagada' and not exists (select 1 from transacciones t where t.compromiso_id = c.compromiso_id) then 'PAGADO' else estado_pago end,
             monto_pagado = case when c.estado = 'pagada' and not exists (select 1 from transacciones t where t.compromiso_id = c.compromiso_id) then coalesce(nullif(c.pagado, 0), c.total) else monto_pagado end,
             fecha_pagado = case when c.estado = 'pagada' and not exists (select 1 from transacciones t where t.compromiso_id = c.compromiso_id) then c.fecha_pago else fecha_pagado end
       where id = c.compromiso_id;
    end if;
  end loop;
  perform obligacion_recalcular_estado(p_id);
end $$;

create or replace function public.obligacion_numero(p_tenant uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_anio text := to_char(now(), 'YYYY'); v_n int;
begin
  select coalesce(max(substring(numero from '^OBL-\d{4}-(\d+)$')::int), 0) + 1 into v_n
    from obligaciones_financieras where tenant_id = p_tenant and numero like 'OBL-' || v_anio || '-%';
  return 'OBL-' || v_anio || '-' || lpad(v_n::text, 3, '0');
end $$;

-- Crea o edita la cabecera. p: {id?, tipo, acreedor, proveedor_id?, concepto?, documento?, moneda, capital, interes_total?, tasa_interes?,
--   interes_tipo?, penalidad?, fecha_contrato?, fecha_vencimiento?, area?, cdc?, centro_costo_id?, proyecto_id?, observaciones?, origen_archivo?}
create or replace function public.obligacion_guardar(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); v_id uuid; v_num text;
begin
  if not obligacion_puede_editar() then raise exception 'Sin permiso para registrar obligaciones (finanzas.editar o contabilidad.editar)'; end if;
  if coalesce(p->>'acreedor', '') = '' then raise exception 'Falta el acreedor'; end if;
  if coalesce((p->>'capital')::numeric, 0) <= 0 then raise exception 'El capital debe ser mayor a 0'; end if;
  v_id := nullif(p->>'id', '')::uuid;
  if v_id is null then
    v_num := obligacion_numero(v_tenant);
    insert into obligaciones_financieras (tenant_id, numero, tipo, acreedor, proveedor_id, concepto, documento, moneda, capital, interes_total, tasa_interes,
      interes_tipo, penalidad, fecha_contrato, fecha_vencimiento, area, cdc, centro_costo_id, proyecto_id, observaciones, origen_archivo, creado_por)
    values (v_tenant, v_num, coalesce(p->>'tipo', 'prestamo'), p->>'acreedor', nullif(p->>'proveedor_id', '')::uuid, p->>'concepto', p->>'documento',
      coalesce(nullif(p->>'moneda', ''), 'PEN'), (p->>'capital')::numeric, coalesce((p->>'interes_total')::numeric, 0), nullif(p->>'tasa_interes', '')::numeric,
      nullif(p->>'interes_tipo', ''), nullif(p->>'penalidad', ''), nullif(p->>'fecha_contrato', '')::date, nullif(p->>'fecha_vencimiento', '')::date,
      coalesce(nullif(p->>'area', ''), 'ADMINISTRACION'), nullif(p->>'cdc', ''), nullif(p->>'centro_costo_id', '')::uuid, nullif(p->>'proyecto_id', '')::uuid,
      nullif(p->>'observaciones', ''), nullif(p->>'origen_archivo', ''), auth.uid())
    returning id into v_id;
  else
    update obligaciones_financieras set
      tipo = coalesce(p->>'tipo', tipo), acreedor = p->>'acreedor', proveedor_id = nullif(p->>'proveedor_id', '')::uuid, concepto = p->>'concepto',
      documento = p->>'documento', moneda = coalesce(nullif(p->>'moneda', ''), moneda), capital = (p->>'capital')::numeric,
      interes_total = coalesce((p->>'interes_total')::numeric, 0), tasa_interes = nullif(p->>'tasa_interes', '')::numeric, interes_tipo = nullif(p->>'interes_tipo', ''),
      penalidad = nullif(p->>'penalidad', ''), fecha_contrato = nullif(p->>'fecha_contrato', '')::date, fecha_vencimiento = nullif(p->>'fecha_vencimiento', '')::date,
      area = coalesce(nullif(p->>'area', ''), area), cdc = nullif(p->>'cdc', ''), centro_costo_id = nullif(p->>'centro_costo_id', '')::uuid,
      proyecto_id = nullif(p->>'proyecto_id', '')::uuid, observaciones = nullif(p->>'observaciones', ''), actualizado_en = now()
    where id = v_id and tenant_id = v_tenant;
    if not found then raise exception 'Obligación no encontrada'; end if;
  end if;
  perform obligacion_sincronizar(v_id);
  return v_id;
end $$;

-- Cronograma automático: n cuotas iguales (capital + interés repartidos) desde el primer vencimiento, mensual o única.
-- Reemplaza las cuotas pendientes; las pagadas se conservan y se numeran primero.
create or replace function public.obligacion_cuotas_generar(p_id uuid, p_n int, p_primer_vencimiento date, p_periodicidad text default 'mensual')
returns int
language plpgsql security definer set search_path = public as $$
declare o record; v_pagadas int; v_cap_pag numeric; v_int_pag numeric; v_cap numeric; v_int numeric; i int; v_c numeric; v_i numeric; v_fecha date;
begin
  if not obligacion_puede_editar() then raise exception 'Sin permiso'; end if;
  select * into o from obligaciones_financieras where id = p_id and tenant_id = auth_tenant_id();
  if not found then raise exception 'Obligación no encontrada'; end if;
  if coalesce(p_n, 0) < 1 then raise exception 'Indica cuántas cuotas'; end if;
  -- fuera las pendientes (y sus compromisos sin pagos)
  delete from flujo_compromisos f using obligaciones_cuotas c
   where c.obligacion_id = p_id and c.estado = 'pendiente' and f.id = c.compromiso_id and not exists (select 1 from transacciones t where t.compromiso_id = f.id);
  delete from obligaciones_cuotas where obligacion_id = p_id and estado = 'pendiente';
  select count(*), coalesce(sum(capital), 0), coalesce(sum(interes), 0) into v_pagadas, v_cap_pag, v_int_pag from obligaciones_cuotas where obligacion_id = p_id and estado = 'pagada';
  v_cap := greatest(o.capital - v_cap_pag, 0); v_int := greatest(coalesce(o.interes_total, 0) - v_int_pag, 0);
  for i in 1..p_n loop
    v_c := case when i = p_n then round(v_cap - round(v_cap / p_n, 2) * (p_n - 1), 2) else round(v_cap / p_n, 2) end;
    v_i := case when i = p_n then round(v_int - round(v_int / p_n, 2) * (p_n - 1), 2) else round(v_int / p_n, 2) end;
    v_fecha := case when p_periodicidad = 'mensual' then (p_primer_vencimiento + ((i - 1) || ' month')::interval)::date else p_primer_vencimiento end;
    insert into obligaciones_cuotas (tenant_id, obligacion_id, numero, vencimiento, capital, interes, total)
    values (o.tenant_id, p_id, v_pagadas + i, v_fecha, v_c, v_i, v_c + v_i);
  end loop;
  update obligaciones_financieras set fecha_vencimiento = (select max(vencimiento) from obligaciones_cuotas where obligacion_id = p_id and estado <> 'anulada'), actualizado_en = now() where id = p_id;
  perform obligacion_sincronizar(p_id);
  return p_n;
end $$;

-- Cronograma explícito (carga inicial o edición fina): [{numero, vencimiento, capital, interes, total?, estado?, fecha_pago?, pagado?, notas?}]
create or replace function public.obligacion_cuotas_fijar(p_id uuid, p_cuotas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare o record; q jsonb; n int := 0; v_total numeric;
begin
  if not obligacion_puede_editar() then raise exception 'Sin permiso'; end if;
  select * into o from obligaciones_financieras where id = p_id and tenant_id = auth_tenant_id();
  if not found then raise exception 'Obligación no encontrada'; end if;
  for q in select * from jsonb_array_elements(coalesce(p_cuotas, '[]'::jsonb)) loop
    v_total := coalesce((q->>'total')::numeric, coalesce((q->>'capital')::numeric, 0) + coalesce((q->>'interes')::numeric, 0));
    insert into obligaciones_cuotas (tenant_id, obligacion_id, numero, vencimiento, capital, interes, total, estado, pagado, fecha_pago, notas)
    values (o.tenant_id, p_id, (q->>'numero')::int, (q->>'vencimiento')::date, coalesce((q->>'capital')::numeric, 0), coalesce((q->>'interes')::numeric, 0), v_total,
            coalesce(nullif(q->>'estado', ''), 'pendiente'), coalesce((q->>'pagado')::numeric, case when q->>'estado' = 'pagada' then v_total else 0 end),
            nullif(q->>'fecha_pago', '')::date, nullif(q->>'notas', ''))
    on conflict (obligacion_id, numero) do update set
      vencimiento = excluded.vencimiento, capital = excluded.capital, interes = excluded.interes, total = excluded.total,
      estado = case when obligaciones_cuotas.estado = 'pagada' and exists (select 1 from transacciones t where t.compromiso_id = obligaciones_cuotas.compromiso_id) then obligaciones_cuotas.estado else excluded.estado end,
      pagado = excluded.pagado, fecha_pago = excluded.fecha_pago, notas = coalesce(excluded.notas, obligaciones_cuotas.notas);
    n := n + 1;
  end loop;
  update obligaciones_financieras set fecha_vencimiento = (select max(vencimiento) from obligaciones_cuotas where obligacion_id = p_id and estado <> 'anulada'), actualizado_en = now() where id = p_id;
  perform obligacion_sincronizar(p_id);
  return n;
end $$;

-- Pago histórico (sin transacción en el ERP): cierra la cuota y su compromiso.
create or replace function public.obligacion_cuota_marcar_pagada(p_cuota uuid, p_fecha date, p_monto numeric default null, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not obligacion_puede_editar() then raise exception 'Sin permiso'; end if;
  select * into c from obligaciones_cuotas where id = p_cuota and tenant_id = auth_tenant_id();
  if not found then raise exception 'Cuota no encontrada'; end if;
  update obligaciones_cuotas set estado = 'pagada', pagado = coalesce(p_monto, total), fecha_pago = coalesce(p_fecha, current_date),
         notas = concat_ws(' · ', nullif(notas, ''), nullif(p_nota, '')) where id = p_cuota;
  perform obligacion_sincronizar(c.obligacion_id);
end $$;

-- Cambio de estado de la cabecera: anulada o renegociada cancela las cuotas pendientes (sin pagos) y sus compromisos.
create or replace function public.obligacion_estado(p_id uuid, p_estado text, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if not obligacion_puede_editar() then raise exception 'Sin permiso'; end if;
  select * into o from obligaciones_financieras where id = p_id and tenant_id = auth_tenant_id();
  if not found then raise exception 'Obligación no encontrada'; end if;
  if p_estado not in ('vigente', 'anulada', 'renegociada', 'pagada') then raise exception 'Estado no válido'; end if;
  if p_estado in ('anulada', 'renegociada') then
    update obligaciones_cuotas set estado = 'anulada' where obligacion_id = p_id and estado = 'pendiente';
  end if;
  update obligaciones_financieras set estado = p_estado, observaciones = concat_ws(' · ', nullif(observaciones, ''), nullif(p_nota, '')), actualizado_en = now() where id = p_id;
  perform obligacion_sincronizar(p_id);
  if p_estado in ('vigente', 'pagada') then perform obligacion_recalcular_estado(p_id); update obligaciones_financieras set estado = p_estado where id = p_id and p_estado = 'pagada'; end if;
end $$;

-- El pago real (transacción → compromiso) cierra la cuota.
create or replace function public.trg_compromiso_a_cuota() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_oblig uuid;
begin
  if new.obligacion_cuota_id is null then return null; end if;
  update obligaciones_cuotas
     set pagado = coalesce(new.monto_pagado, 0),
         estado = case when upper(coalesce(new.estado_pago, '')) like 'PAGADO%' then 'pagada' when estado = 'anulada' then 'anulada' else 'pendiente' end,
         fecha_pago = case when upper(coalesce(new.estado_pago, '')) like 'PAGADO%' then coalesce(new.fecha_pagado, fecha_pago, current_date) else null end
   where id = new.obligacion_cuota_id
   returning obligacion_id into v_oblig;
  if v_oblig is not null then perform obligacion_recalcular_estado(v_oblig); end if;
  return null;
end $$;
drop trigger if exists trg_compromiso_a_cuota on flujo_compromisos;
create trigger trg_compromiso_a_cuota after update of estado_pago, monto_pagado, fecha_pagado on flujo_compromisos
  for each row when (new.obligacion_cuota_id is not null) execute function trg_compromiso_a_cuota();

create or replace view v_obligaciones as
select o.*,
       coalesce(q.cuotas, 0) as cuotas, coalesce(q.cuotas_pagadas, 0) as cuotas_pagadas,
       coalesce(q.total_cuotas, o.capital + coalesce(o.interes_total, 0)) as total,
       coalesce(q.pagado, 0) as pagado,
       greatest(coalesce(q.total_cuotas, o.capital + coalesce(o.interes_total, 0)) - coalesce(q.pagado, 0), 0) as saldo,
       q.proximo_vencimiento, coalesce(q.vencido, 0) as vencido,
       p.razon_social as proveedor_razon_social
  from obligaciones_financieras o
  left join lateral (
    select count(*) filter (where c.estado <> 'anulada') as cuotas,
           count(*) filter (where c.estado = 'pagada') as cuotas_pagadas,
           sum(c.total) filter (where c.estado <> 'anulada') as total_cuotas,
           sum(case when c.estado = 'pagada' then coalesce(nullif(c.pagado, 0), c.total) else c.pagado end) filter (where c.estado <> 'anulada') as pagado,
           min(c.vencimiento) filter (where c.estado = 'pendiente') as proximo_vencimiento,
           sum(c.total - c.pagado) filter (where c.estado = 'pendiente' and c.vencimiento < current_date) as vencido
      from obligaciones_cuotas c where c.obligacion_id = o.id
  ) q on true
  left join proveedores p on p.id = o.proveedor_id;
grant select on v_obligaciones to authenticated;

create or replace view v_obligaciones_cuotas as
select c.*, o.numero as obligacion_numero, o.acreedor, o.moneda, o.tipo,
       f.estado_pago as compromiso_estado, f.monto_pagado as compromiso_pagado, f.fecha_pagado as compromiso_fecha_pago,
       (c.estado = 'pendiente' and c.vencimiento < current_date) as vencida
  from obligaciones_cuotas c
  join obligaciones_financieras o on o.id = c.obligacion_id
  left join flujo_compromisos f on f.id = c.compromiso_id;
grant select on v_obligaciones_cuotas to authenticated;

grant execute on function public.obligacion_guardar(jsonb), public.obligacion_cuotas_generar(uuid, int, date, text), public.obligacion_cuotas_fijar(uuid, jsonb),
  public.obligacion_cuota_marcar_pagada(uuid, date, numeric, text), public.obligacion_estado(uuid, text, text), public.obligacion_sincronizar(uuid), public.obligacion_puede_editar() to authenticated;
