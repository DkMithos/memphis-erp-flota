-- ─────────────────────────────────────────────────────────────────────────────
-- BANCOS · Sprint 3 (2026-10-09)
--
-- Contabilidad reconstruía a mano, desde los PDF del banco y el "Histórico de
-- Movimientos" de BBVA, cada pago con su centro de costo (1,194 filas en 2026).
-- Ahora:
--   1. `movimientos_bancarios`: cada línea del histórico BBVA (una por cuenta),
--      sin duplicados (cuenta + n.º de documento + fecha + importe).
--   2. `saldos_bancarios`: los "Saldo Final" que el histórico trae por día.
--   3. `bancos_importar_movimientos`: carga un extracto y concilia solo: primero
--      por n.º de operación contra las transacciones del ERP (los pagos de los
--      lotes lo guardan en `referencia_numero`), luego por importe y fecha.
--      Lo que no cruza se clasifica por el concepto (ITF, comisión, SUNAT,
--      AFP, detracción, cambio de moneda, abono…).
--   4. `bancos_registrar_movimiento`: lo que el ERP no tenía (ITF, comisiones,
--      cambios de moneda, abonos) se registra como transacción con su centro
--      de costo, y así el acumulado por CC lo arma el sistema.
--   5. `v_pagos_acumulados` / `v_pagos_por_mes`: el "Pagos acumulados con CC"
--      y el "resumen por mes" que Contabilidad armaba en Excel.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.movimientos_bancarios (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id),
  cuenta_bancaria_id uuid not null references cuentas_bancarias(id),
  fecha_operacion    date not null,
  fecha_valor        date,
  codigo             text,
  numero_doc         text,
  concepto           text,
  importe            numeric(14,2) not null,          -- firmado: negativo = cargo
  oficina            text,
  clasificacion      text not null default 'por_clasificar',
  transaccion_id     uuid references transacciones(id) on delete set null,
  conciliado_en      timestamptz,
  conciliado_por     text,                            -- 'auto:operacion' | 'auto:importe' | 'manual'
  centro_costo_id    uuid references centros_costo(id),
  proyecto_id        uuid references proyectos(id),
  notas              text,
  origen_archivo     text,
  fila               int,
  importado_en       timestamptz not null default now(),
  importado_por      uuid,
  unique (cuenta_bancaria_id, numero_doc, fecha_operacion, importe)
);
create index if not exists mov_banc_cuenta_fecha_idx on movimientos_bancarios (cuenta_bancaria_id, fecha_operacion);
create index if not exists mov_banc_sin_conciliar_idx on movimientos_bancarios (tenant_id) where transaccion_id is null;

create table if not exists public.saldos_bancarios (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id),
  cuenta_bancaria_id uuid not null references cuentas_bancarias(id),
  fecha              date not null,
  saldo              numeric(14,2) not null,
  origen_archivo     text,
  importado_en       timestamptz not null default now(),
  unique (cuenta_bancaria_id, fecha)
);

alter table transacciones
  add column if not exists movimiento_bancario_id uuid references movimientos_bancarios(id) on delete set null,
  add column if not exists conciliado_en timestamptz;

alter table movimientos_bancarios enable row level security;
alter table saldos_bancarios enable row level security;
drop policy if exists mov_banc_sel on movimientos_bancarios;
create policy mov_banc_sel on movimientos_bancarios for select using (tenant_id = auth_tenant_id() and (lote_puede_ver() or auth_tiene_permiso('contabilidad', 'ver')));
drop policy if exists mov_banc_wr on movimientos_bancarios;
create policy mov_banc_wr on movimientos_bancarios for all
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'editar')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'editar')));
drop policy if exists saldos_banc_sel on saldos_bancarios;
create policy saldos_banc_sel on saldos_bancarios for select using (tenant_id = auth_tenant_id() and (lote_puede_ver() or auth_tiene_permiso('contabilidad', 'ver')));
drop policy if exists saldos_banc_wr on saldos_bancarios;
create policy saldos_banc_wr on saldos_bancarios for all
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'editar')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'editar')));

create or replace function public.bancos_puede_operar() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar')
      or auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'editar');
$$;

-- Clasificación automática por el concepto del banco. Es una ayuda; se corrige a mano.
create or replace function public.bancos_clasificar_concepto(p_concepto text, p_importe numeric) returns text
language sql immutable as $$
  select case
    when c ~ '^ITF' or c ~ '\mITF\M' then 'itf'
    when c ~ 'COMIS|MANTENIMIENTO DE CUENTA|COMISION DE MANTENIMIENTO|PORTES|GASTOS DE' then 'comision'
    when c ~ 'SUNAT|NPS\M|TRIBUT' then 'sunat'
    when c ~ '\mAFP\M|ONP|ESSALUD|PLAME|PLANILLA|REMUNERAC|GRATIFIC|CTS\M' then 'planilla'
    when c ~ 'SPOT|DETRACC' then 'detraccion'
    when c ~ 'CAMBIO|COMPRA.?VENTA|TIPO DE CAMBIO|\mCV\M|OPERACION DE CAMBIO' then 'cambio_moneda'
    when c ~ 'CAJA CHICA|VIATIC|RENDICION' then 'caja_chica'
    when c ~ 'PRESTAMO|CUOTA|LEASING|AMORTIZ' then 'prestamo'
    when c ~ 'INTERES|INTERESES' and p_importe > 0 then 'interes_ganado'
    when p_importe > 0 and c ~ 'ABONO|DEPOSITO|TRANSF|CIPRL|TESORO|GOBIERNO|MUNICIPAL|GORE' then 'abono'
    when p_importe > 0 then 'abono'
    when c ~ 'TRANSF|TRANSFERENCIA|PAGO' then 'pago_proveedor'
    else 'por_clasificar' end
  from (select upper(coalesce(p_concepto, '')) c) x;
$$;

-- Concilia los movimientos sin transacción de una cuenta.
create or replace function public.bancos_conciliar_auto(p_cuenta uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; v_trx uuid; n_op int := 0; n_imp int := 0;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso para conciliar'; end if;
  for m in select * from movimientos_bancarios where cuenta_bancaria_id = p_cuenta and transaccion_id is null and tenant_id = auth_tenant_id() order by fecha_operacion loop
    v_trx := null;
    -- 1) por número de operación (lo que Tesorería escribe al marcar pagada)
    if coalesce(m.numero_doc, '') <> '' then
      select t.id into v_trx from transacciones t
       where t.tenant_id = m.tenant_id and t.cuenta_bancaria_id = p_cuenta and t.estado = 'pagada' and t.movimiento_bancario_id is null
         and ltrim(regexp_replace(coalesce(t.referencia_numero, ''), '[^0-9]', '', 'g'), '0') = ltrim(regexp_replace(m.numero_doc, '[^0-9]', '', 'g'), '0')
         and ltrim(regexp_replace(m.numero_doc, '[^0-9]', '', 'g'), '0') <> ''
         and ((m.importe < 0 and t.tipo = 'egreso') or (m.importe > 0 and t.tipo = 'ingreso'))
         and abs(abs(m.importe) - t.monto) <= 0.01
       order by abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) limit 1;
      if v_trx is not null then
        update movimientos_bancarios set transaccion_id = v_trx, conciliado_en = now(), conciliado_por = 'auto:operacion', clasificacion = case when m.importe < 0 then 'pago_proveedor' else 'abono' end where id = m.id;
        update transacciones set movimiento_bancario_id = m.id, conciliado_en = now() where id = v_trx;
        n_op := n_op + 1; continue;
      end if;
    end if;
    -- 2) por importe y fecha (hasta 3 días de diferencia), una a una
    select t.id into v_trx from transacciones t
     where t.tenant_id = m.tenant_id and t.cuenta_bancaria_id = p_cuenta and t.estado = 'pagada' and t.movimiento_bancario_id is null
       and ((m.importe < 0 and t.tipo = 'egreso') or (m.importe > 0 and t.tipo = 'ingreso'))
       and abs(abs(m.importe) - t.monto) <= 0.01
       and abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) <= 3
     order by abs(coalesce(t.fecha_pago, t.fecha) - m.fecha_operacion) limit 1;
    if v_trx is not null then
      update movimientos_bancarios set transaccion_id = v_trx, conciliado_en = now(), conciliado_por = 'auto:importe', clasificacion = case when m.importe < 0 then 'pago_proveedor' else 'abono' end where id = m.id;
      update transacciones set movimiento_bancario_id = m.id, conciliado_en = now() where id = v_trx;
      n_imp := n_imp + 1;
    end if;
  end loop;
  return jsonb_build_object('por_operacion', n_op, 'por_importe', n_imp);
end $$;

-- Carga un extracto (una hoja del Histórico de Movimientos de BBVA ya parseada).
--   p_filas: [{fecha_operacion, fecha_valor, codigo, numero_doc, concepto, importe, oficina, fila}]
--   p_saldos: [{fecha, saldo}]  (los "Saldo Final" que trae el histórico)
create or replace function public.bancos_importar_movimientos(p_cuenta uuid, p_filas jsonb, p_saldos jsonb default '[]'::jsonb, p_archivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; f jsonb; n_nuevos int := 0; n_dup int := 0; n_saltados int := 0; v_imp numeric; v_fecha date; v_conc jsonb; v_min date; v_max date;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso para importar movimientos bancarios'; end if;
  v_tenant := auth_tenant_id();
  if not exists (select 1 from cuentas_bancarias where id = p_cuenta and tenant_id = v_tenant) then raise exception 'Cuenta bancaria no válida'; end if;
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    begin
      v_fecha := left(f->>'fecha_operacion', 10)::date;
      v_imp := (f->>'importe')::numeric;
    exception when others then n_saltados := n_saltados + 1; continue; end;
    if v_fecha is null or v_imp is null or v_imp = 0 then n_saltados := n_saltados + 1; continue; end if;
    begin
      insert into movimientos_bancarios (tenant_id, cuenta_bancaria_id, fecha_operacion, fecha_valor, codigo, numero_doc, concepto, importe, oficina,
                                         clasificacion, origen_archivo, fila, importado_por)
      values (v_tenant, p_cuenta, v_fecha, nullif(left(f->>'fecha_valor', 10), '')::date, nullif(trim(f->>'codigo'), ''), nullif(trim(f->>'numero_doc'), ''),
              nullif(trim(f->>'concepto'), ''), v_imp, nullif(trim(f->>'oficina'), ''),
              bancos_clasificar_concepto(f->>'concepto', v_imp), p_archivo, nullif(f->>'fila', '')::int, auth.uid());
      n_nuevos := n_nuevos + 1;
      v_min := least(coalesce(v_min, v_fecha), v_fecha); v_max := greatest(coalesce(v_max, v_fecha), v_fecha);
    exception when unique_violation then n_dup := n_dup + 1; end;
  end loop;
  for f in select * from jsonb_array_elements(coalesce(p_saldos, '[]'::jsonb)) loop
    begin
      insert into saldos_bancarios (tenant_id, cuenta_bancaria_id, fecha, saldo, origen_archivo)
      values (v_tenant, p_cuenta, left(f->>'fecha', 10)::date, (f->>'saldo')::numeric, p_archivo)
      on conflict (cuenta_bancaria_id, fecha) do update set saldo = excluded.saldo, origen_archivo = excluded.origen_archivo, importado_en = now();
    exception when others then null; end;
  end loop;
  v_conc := bancos_conciliar_auto(p_cuenta);
  return jsonb_build_object('nuevos', n_nuevos, 'duplicados', n_dup, 'saltados', n_saltados, 'desde', v_min, 'hasta', v_max, 'conciliados', v_conc);
end $$;

-- Vincular a mano un movimiento con una transacción del ERP
create or replace function public.bancos_vincular(p_mov uuid, p_trx uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record; t record;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso'; end if;
  select * into m from movimientos_bancarios where id = p_mov and tenant_id = auth_tenant_id();
  select * into t from transacciones where id = p_trx and tenant_id = auth_tenant_id();
  if m.id is null or t.id is null then raise exception 'Movimiento o transacción no encontrados'; end if;
  if m.transaccion_id is not null then raise exception 'El movimiento ya está conciliado'; end if;
  if t.movimiento_bancario_id is not null then raise exception 'La transacción ya está conciliada con otro movimiento'; end if;
  if (m.importe < 0 and t.tipo <> 'egreso') or (m.importe > 0 and t.tipo <> 'ingreso') then raise exception 'El sentido no coincide (cargo/abono vs egreso/ingreso)'; end if;
  update movimientos_bancarios set transaccion_id = p_trx, conciliado_en = now(), conciliado_por = 'manual',
         clasificacion = case when m.importe < 0 then 'pago_proveedor' else 'abono' end,
         centro_costo_id = coalesce(m.centro_costo_id, t.centro_costo_id), proyecto_id = coalesce(m.proyecto_id, t.proyecto_id)
   where id = p_mov;
  update transacciones set movimiento_bancario_id = p_mov, conciliado_en = now(), cuenta_bancaria_id = coalesce(cuenta_bancaria_id, m.cuenta_bancaria_id) where id = p_trx;
end $$;

create or replace function public.bancos_desvincular(p_mov uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso'; end if;
  select * into m from movimientos_bancarios where id = p_mov and tenant_id = auth_tenant_id();
  if m.transaccion_id is not null then update transacciones set movimiento_bancario_id = null, conciliado_en = null where id = m.transaccion_id; end if;
  update movimientos_bancarios set transaccion_id = null, conciliado_en = null, conciliado_por = null where id = p_mov;
end $$;

-- Lo que el ERP no tenía (ITF, comisiones, cambio de moneda, abonos, pagos hechos
-- fuera de un lote) se registra como transacción con su centro de costo.
create or replace function public.bancos_registrar_movimiento(p_mov uuid, p_clasificacion text, p_categoria text, p_centro_costo uuid default null, p_proyecto uuid default null, p_descripcion text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m record; c record; v_id uuid;
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso'; end if;
  select * into m from movimientos_bancarios where id = p_mov and tenant_id = auth_tenant_id();
  if m.id is null then raise exception 'Movimiento no encontrado'; end if;
  if m.transaccion_id is not null then raise exception 'El movimiento ya tiene transacción'; end if;
  select * into c from cuentas_bancarias where id = m.cuenta_bancaria_id;
  insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, fecha, fecha_pago, descripcion,
                             cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, movimiento_bancario_id, conciliado_en,
                             creado_por, aprobado_por, aprobado_en)
  values (m.tenant_id, trx_siguiente_numero(m.tenant_id, m.fecha_operacion), case when m.importe < 0 then 'egreso' else 'ingreso' end,
          coalesce(nullif(p_categoria, ''), initcap(replace(p_clasificacion, '_', ' '))), p_clasificacion, 'pagada', abs(m.importe), c.moneda,
          m.fecha_operacion, m.fecha_operacion, coalesce(nullif(p_descripcion, ''), m.concepto, 'Movimiento bancario'),
          m.cuenta_bancaria_id, p_centro_costo, p_proyecto, m.numero_doc, 'banco', m.id, now(), auth.uid()::text, auth.uid()::text, now())
  returning id into v_id;
  update movimientos_bancarios set transaccion_id = v_id, conciliado_en = now(), conciliado_por = 'manual', clasificacion = p_clasificacion,
         centro_costo_id = p_centro_costo, proyecto_id = p_proyecto where id = p_mov;
  return v_id;
end $$;

create or replace function public.bancos_clasificar(p_mov uuid, p_clasificacion text, p_centro_costo uuid default null, p_proyecto uuid default null, p_notas text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not bancos_puede_operar() then raise exception 'Sin permiso'; end if;
  update movimientos_bancarios set clasificacion = p_clasificacion, centro_costo_id = p_centro_costo, proyecto_id = p_proyecto, notas = coalesce(p_notas, notas)
   where id = p_mov and tenant_id = auth_tenant_id();
end $$;

-- Vistas ---------------------------------------------------------------------------
create or replace view public.v_movimientos_bancarios as
select m.*,
       cb.nombre  as cuenta_nombre, cb.moneda as cuenta_moneda,
       t.numero   as transaccion_numero, t.categoria as transaccion_categoria, t.descripcion as transaccion_descripcion,
       t.proveedor_nombre, t.comprobante_id, t.compromiso_id, t.orden_compra_id,
       cc.codigo  as centro_costo_codigo, p.codigo as proyecto_codigo,
       to_char(m.fecha_operacion, 'YYYY-MM') as mes
  from movimientos_bancarios m
  join cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
  left join transacciones t on t.id = m.transaccion_id
  left join centros_costo cc on cc.id = coalesce(m.centro_costo_id, t.centro_costo_id)
  left join proyectos p on p.id = coalesce(m.proyecto_id, t.proyecto_id);

create or replace view public.v_bancos_resumen as
select c.id as cuenta_bancaria_id, c.nombre, c.moneda, c.tipo, c.saldo_inicial, c.saldo_inicial_fecha,
       s.saldo_actual as saldo_erp,
       (select saldo from saldos_bancarios b where b.cuenta_bancaria_id = c.id order by fecha desc limit 1) as saldo_banco,
       (select fecha from saldos_bancarios b where b.cuenta_bancaria_id = c.id order by fecha desc limit 1) as saldo_banco_fecha,
       (select count(*) from movimientos_bancarios m where m.cuenta_bancaria_id = c.id) as movimientos,
       (select count(*) from movimientos_bancarios m where m.cuenta_bancaria_id = c.id and m.transaccion_id is null) as sin_conciliar,
       (select coalesce(sum(abs(importe)), 0) from movimientos_bancarios m where m.cuenta_bancaria_id = c.id and m.transaccion_id is null and m.importe < 0) as cargos_sin_conciliar,
       (select coalesce(sum(importe), 0) from movimientos_bancarios m where m.cuenta_bancaria_id = c.id and m.transaccion_id is null and m.importe > 0) as abonos_sin_conciliar,
       (select min(fecha_operacion) from movimientos_bancarios m where m.cuenta_bancaria_id = c.id) as desde,
       (select max(fecha_operacion) from movimientos_bancarios m where m.cuenta_bancaria_id = c.id) as hasta,
       (select count(*) from transacciones t where t.cuenta_bancaria_id = c.id and t.estado = 'pagada' and t.movimiento_bancario_id is null) as transacciones_sin_banco
  from cuentas_bancarias c
  join v_cuentas_bancarias_saldo s on s.id = c.id;

-- El "Pagos acumulados con CC": egresos pagados por mes, centro de costo y categoría
create or replace view public.v_pagos_acumulados as
select t.tenant_id, to_char(coalesce(t.fecha_pago, t.fecha), 'YYYY-MM') as mes, t.tipo,
       coalesce(cc.codigo, '(sin CC)') as centro_costo, coalesce(p.codigo, '') as proyecto, coalesce(t.categoria, '(sin categoría)') as categoria,
       t.moneda, count(*) as movimientos, sum(t.monto) as monto, sum(coalesce(t.monto_soles, t.monto)) as monto_soles
  from transacciones t
  left join centros_costo cc on cc.id = t.centro_costo_id
  left join proyectos p on p.id = t.proyecto_id
 where t.estado = 'pagada'
 group by t.tenant_id, 2, t.tipo, 4, 5, 6, t.moneda;

grant select on v_movimientos_bancarios, v_bancos_resumen, v_pagos_acumulados to authenticated;
