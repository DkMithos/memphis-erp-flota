-- ─────────────────────────────────────────────────────────────────────────────
-- DETRACCIONES · Sprint 2 (2026-10-08)
--
-- 1. Cada detracción que nace al pagar una línea del lote queda con todo lo que
--    el Banco de la Nación pide: RUC y razón social del proveedor, su cuenta de
--    detracciones, código de bien/servicio, periodo tributario (mes de emisión
--    del comprobante), tipo, serie y número del comprobante.
-- 2. `detraccion_lote_generar(ids)` arma el archivo de PAGO MASIVO DE
--    DETRACCIONES (formato NPD / R13.2 que Contabilidad generaba con la macro
--    `Macro detracciones.xlsm`): nombre D<RUC><AA><SSSS>.TXT, cabecera
--    "*" + RUC(11) + razón social(35) + año(2) + secuencia(4) + total(15, en
--    centavos), y un registro de 107 posiciones por detracción.
-- 3. `detracciones_importar_constancias(filas)` lee la consulta de constancias
--    que SUNAT devuelve (CSV/Excel "detracciones depositadas") y cierra cada
--    detracción pendiente: número de constancia, fecha de depósito, estado
--    `depositado`. Lo que SUNAT trae y el ERP no conocía se registra como
--    depositado con origen `sunat` (los depósitos hechos fuera del ERP).
-- 4. `v_detracciones` con el vencimiento legal: el depósito del adquirente
--    debe hacerse al pagar o, a más tardar, el 5.º día hábil del mes siguiente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Lotes enviados al Banco de la Nación
create table if not exists public.detraccion_lotes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id),
  anio           int not null,
  secuencia      int not null,
  nombre_archivo text not null,
  cantidad       int not null default 0,
  total_soles    numeric(14,2) not null default 0,
  contenido      text not null,
  generado_por   uuid,
  generado_en    timestamptz not null default now(),
  anulado_en     timestamptz,
  anulado_por    uuid,
  unique (tenant_id, anio, secuencia)
);
alter table detraccion_lotes enable row level security;
drop policy if exists detraccion_lotes_sel on detraccion_lotes;
create policy detraccion_lotes_sel on detraccion_lotes for select using (tenant_id = auth_tenant_id() and lote_puede_ver());
drop policy if exists detraccion_lotes_wr on detraccion_lotes;
create policy detraccion_lotes_wr on detraccion_lotes for all
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar')));

-- Lo que el archivo del BN y la constancia de SUNAT necesitan, en la propia detracción
alter table detracciones
  add column if not exists ruc_proveedor         text,
  add column if not exists razon_social          text,
  add column if not exists cuenta_detraccion     text,
  add column if not exists tipo_comprobante      text default '01',
  add column if not exists serie                 text,
  add column if not exists numero                text,
  add column if not exists tipo_operacion        text default '01',
  add column if not exists fecha_pago_proveedor  date,
  add column if not exists lote_bn_id            uuid references detraccion_lotes(id) on delete set null,
  add column if not exists origen                text default 'erp',
  add column if not exists observaciones         text;
alter table detracciones alter column codigo_bien_servicio drop not null;
alter table detracciones alter column tasa drop not null;
alter table detracciones alter column base_detraccion drop not null;
create index if not exists detracciones_tenant_estado_idx on detracciones (tenant_id, estado);
create index if not exists detracciones_ruc_doc_idx on detracciones (tenant_id, ruc_proveedor, serie, numero);

-- Las detracciones no tenían RLS propia visible aquí: la dejamos explícita.
alter table detracciones enable row level security;
drop policy if exists detracciones_sel on detracciones;
create policy detracciones_sel on detracciones for select
  using (tenant_id = auth_tenant_id() and (lote_puede_ver() or auth_tiene_permiso('contabilidad', 'ver')));
drop policy if exists detracciones_wr on detracciones;
create policy detracciones_wr on detracciones for all
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar')));

-- Vencimiento legal del depósito: 5.º día hábil (lunes a viernes) del mes
-- siguiente al pago. No descuenta feriados: si cae en uno, vence antes, no después.
create or replace function public.detraccion_vence(p_fecha_pago date) returns date
language sql immutable as $$
  select d from (
    select d, row_number() over (order by d) rn
      from generate_series(date_trunc('month', p_fecha_pago)::date + interval '1 month',
                           date_trunc('month', p_fecha_pago)::date + interval '1 month' + interval '14 days', '1 day') d
     where extract(isodow from d) < 6
  ) x where rn = 5;
$$;

-- Texto plano para el archivo del BN: mayúsculas, sin tildes ni ñ, ancho fijo.
create or replace function public.bn_texto(p text, p_ancho int) returns text
language sql immutable as $$
  select rpad(left(regexp_replace(upper(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNAEIOUUN')), '[^A-Z0-9 .&/-]', ' ', 'g'), p_ancho), p_ancho, ' ');
$$;

-- 1) El pago de una línea del lote deja la detracción lista para el archivo
create or replace function public.lote_pago_marcar_pagada(
  p_item uuid, p_fecha date, p_cuenta uuid, p_numero_operacion text,
  p_voucher_path text default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare it record; l record; cta record; comp record; prov record; v_trx uuid; v_det uuid; v_ret uuid; v_cta_bn uuid; v_num text; v_desc text;
        v_serie text; v_numero text; v_tipo_cp text; v_periodo text; v_ref text;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería (finanzas.lotes_pagar)'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found then raise exception 'Línea no encontrada'; end if;
  select * into l from lotes_pago where id = it.lote_id;
  if l.estado <> 'por_pagar' then raise exception 'El lote no está en pago (estado %)', l.estado; end if;
  if it.estado <> 'pendiente' then raise exception 'La línea ya está %', it.estado; end if;
  if p_fecha is null then raise exception 'Indique la fecha del pago'; end if;
  select * into cta from cuentas_bancarias where id = p_cuenta and tenant_id = it.tenant_id;
  if not found then raise exception 'Cuenta bancaria de origen no válida'; end if;
  if cta.moneda <> it.moneda then raise exception 'La cuenta % es en % y la línea en %', cta.nombre, cta.moneda, it.moneda; end if;
  select * into comp from comprobantes_pago where id = it.comprobante_id;
  select * into prov from proveedores where id = it.proveedor_id;
  v_desc := coalesce(it.concepto, 'Pago') || coalesce(' · ' || it.referencia_doc, '') || ' · ' || l.numero;

  v_num := trx_siguiente_numero(it.tenant_id, p_fecha);
  insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                             cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                             compromiso_id, comprobante_id, orden_compra_id, comprobante_url, creado_por, aprobado_por, aprobado_en)
  values (it.tenant_id, v_num, 'egreso', 'Pago a proveedores', it.tipo_linea, 'pagada', it.neto, it.moneda, it.tc, p_fecha, p_fecha, v_desc,
          p_cuenta, it.centro_costo_id, it.proyecto_id, p_numero_operacion, 'lote_pago', it.proveedor,
          it.compromiso_id, it.comprobante_id, it.orden_compra_id, p_voucher_path, auth.uid()::text, auth.uid()::text, now())
  returning id into v_trx;

  if it.detraccion_aplica and it.detraccion_monto > 0 then
    select id into v_cta_bn from cuentas_bancarias where tenant_id = it.tenant_id and tipo = 'detracciones' and activa order by orden limit 1;
    insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                               cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                               compromiso_id, comprobante_id, orden_compra_id, creado_por, aprobado_por, aprobado_en)
    values (it.tenant_id, trx_siguiente_numero(it.tenant_id, p_fecha), 'egreso', 'Detracción SPOT', it.detraccion_codigo, 'pagada',
            it.detraccion_monto, it.moneda, it.tc, p_fecha, p_fecha, 'Detracción ' || coalesce(it.detraccion_codigo, '') || ' · ' || v_desc,
            v_cta_bn, it.centro_costo_id, it.proyecto_id, null, 'detraccion', it.proveedor,
            it.compromiso_id, it.comprobante_id, it.orden_compra_id, auth.uid()::text, auth.uid()::text, now());
    -- Serie y número del comprobante: del XML si existe; si no, de la referencia de la línea ("E001-38").
    v_ref := coalesce(comp.numero_completo, it.referencia_doc, '');
    v_serie := coalesce(comp.serie, split_part(v_ref, '-', 1));
    v_numero := coalesce(comp.numero, split_part(v_ref, '-', 2));
    v_tipo_cp := coalesce(comp.tipo, '01');
    v_periodo := to_char(coalesce(comp.fecha_emision, p_fecha), 'YYYYMM');
    insert into detracciones (tenant_id, comprobante_id, proveedor_id, lote_item_id, codigo_bien_servicio, descripcion_bien_servicio, tasa,
                              base_detraccion, monto_detraccion, moneda_origen, tipo_cambio, estado, cuenta_bancaria_id, periodo,
                              ruc_proveedor, razon_social, cuenta_detraccion, tipo_comprobante, serie, numero, fecha_pago_proveedor, origen)
    values (it.tenant_id, it.comprobante_id, it.proveedor_id, it.id, coalesce(it.detraccion_codigo, '037'),
            (select descripcion from detraccion_codigos where codigo = it.detraccion_codigo), it.detraccion_tasa,
            coalesce(it.detraccion_base, it.monto), it.detraccion_soles, it.moneda, it.tc, 'pendiente', v_cta_bn, v_periodo,
            coalesce(prov.ruc, it.ruc), coalesce(prov.razon_social, it.proveedor), it.cuenta_detraccion, v_tipo_cp,
            nullif(v_serie, ''), nullif(regexp_replace(v_numero, '[^0-9]', '', 'g'), ''), p_fecha, 'erp')
    returning id into v_det;
  end if;

  if it.retencion_tipo <> 'ninguna' and it.retencion_monto > 0 then
    insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                               centro_costo_id, proyecto_id, referencia_tipo, proveedor_nombre, compromiso_id, comprobante_id, orden_compra_id,
                               creado_por, aprobado_por, aprobado_en)
    values (it.tenant_id, trx_siguiente_numero(it.tenant_id, p_fecha), 'egreso',
            case it.retencion_tipo when 'igv' then 'Retención IGV' else 'Retención 4ta categoría' end, it.retencion_tipo, 'pagada',
            it.retencion_monto, it.moneda, it.tc, p_fecha, p_fecha, 'Retención · ' || v_desc,
            it.centro_costo_id, it.proyecto_id, 'retencion', it.proveedor, it.compromiso_id, it.comprobante_id, it.orden_compra_id,
            auth.uid()::text, auth.uid()::text, now());
    insert into retenciones_percepciones (tenant_id, comprobante_id, proveedor_id, lote_item_id, tipo, regimen, tasa, base, monto, moneda, fecha, estado, periodo)
    values (it.tenant_id, it.comprobante_id, it.proveedor_id, it.id, 'retencion', it.retencion_tipo, it.retencion_tasa, it.monto, it.retencion_monto,
            it.moneda, p_fecha, 'pendiente', to_char(p_fecha, 'YYYY-MM'))
    returning id into v_ret;
  end if;

  update lotes_pago_items set estado = 'pagada', fecha_pago = p_fecha, cuenta_bancaria_id = p_cuenta, numero_operacion = p_numero_operacion,
         voucher_path = coalesce(p_voucher_path, voucher_path), transaccion_id = v_trx, detraccion_id = v_det, retencion_id = v_ret,
         notas = coalesce(p_notas, notas)
   where id = p_item;
  perform lote_bitacora(it.lote_id, p_item, 'pagar', jsonb_build_object('fecha', p_fecha, 'cuenta', cta.nombre, 'operacion', p_numero_operacion, 'neto', it.neto, 'moneda', it.moneda));

  if not exists (select 1 from lotes_pago_items where lote_id = it.lote_id and estado = 'pendiente') then
    update lotes_pago set estado = 'pagado', pagado_en = now() where id = it.lote_id and estado = 'por_pagar';
    perform lote_notificar(it.lote_id, 'success', 'Lote de pago completado: ' || l.numero, 'Todas las líneas están pagadas o excluidas.');
  end if;
  return v_trx;
end $$;

-- 2) Archivo de pago masivo para el Banco de la Nación
create or replace function public.detraccion_lote_generar(p_ids uuid[]) returns table (lote_id uuid, nombre_archivo text, contenido text, cantidad int, total_soles numeric)
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; v_anio int; v_sec int; v_total numeric := 0; v_n int := 0; v_lineas text := ''; d record; v_id uuid; v_nombre text; v_cab text;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería (finanzas.lotes_pagar)'; end if;
  v_tenant := auth_tenant_id();
  select ruc, nombre into t from tenants where id = v_tenant;
  if coalesce(t.ruc, '') = '' then raise exception 'El tenant no tiene RUC configurado'; end if;

  -- Validaciones de cada detracción antes de armar nada
  for d in select * from detracciones where id = any(p_ids) and tenant_id = v_tenant order by razon_social, serie, numero loop
    if d.estado <> 'pendiente' then raise exception 'La detracción de % % ya está %', d.razon_social, coalesce(d.serie || '-' || d.numero, ''), d.estado; end if;
    if d.lote_bn_id is not null then raise exception 'La detracción de % ya está en el archivo de otro lote', d.razon_social; end if;
    if coalesce(d.ruc_proveedor, '') !~ '^\d{11}$' then raise exception 'Detracción de %: el proveedor no tiene RUC de 11 dígitos', coalesce(d.razon_social, '?'); end if;
    if coalesce(regexp_replace(d.cuenta_detraccion, '[^0-9]', '', 'g'), '') = '' then raise exception 'Detracción de %: falta la cuenta de detracciones del proveedor en el Banco de la Nación', d.razon_social; end if;
    if coalesce(d.codigo_bien_servicio, '') !~ '^\d{3}$' then raise exception 'Detracción de %: código de bien/servicio inválido (%)', d.razon_social, d.codigo_bien_servicio; end if;
    if coalesce(d.serie, '') = '' or coalesce(d.numero, '') = '' then raise exception 'Detracción de %: falta serie o número del comprobante', d.razon_social; end if;
    if coalesce(d.monto_detraccion, 0) <= 0 then raise exception 'Detracción de %: importe en cero', d.razon_social; end if;
  end loop;
  if not exists (select 1 from detracciones where id = any(p_ids) and tenant_id = v_tenant) then raise exception 'No hay detracciones para el archivo'; end if;

  v_anio := extract(year from current_date)::int;
  select coalesce(max(secuencia), 0) + 1 into v_sec from detraccion_lotes where tenant_id = v_tenant and anio = v_anio;
  v_nombre := 'D' || t.ruc || to_char(v_anio % 100, 'FM00') || lpad(v_sec::text, 4, '0') || '.TXT';

  for d in select * from detracciones where id = any(p_ids) and tenant_id = v_tenant order by razon_social, serie, numero loop
    v_total := v_total + round(d.monto_detraccion, 0);
    v_n := v_n + 1;
    v_lineas := v_lineas
      || '6'
      || d.ruc_proveedor
      || bn_texto(d.razon_social, 35)
      || lpad('0', 9, '0')                                                  -- proforma: no aplica
      || d.codigo_bien_servicio
      || lpad(right(regexp_replace(d.cuenta_detraccion, '[^0-9]', '', 'g'), 11), 11, '0')
      || lpad((round(d.monto_detraccion, 0) * 100)::bigint::text, 15, '0')  -- centavos
      || coalesce(d.tipo_operacion, '01')
      || coalesce(d.periodo, to_char(coalesce(d.fecha_pago_proveedor, current_date), 'YYYYMM'))
      || coalesce(d.tipo_comprobante, '01')
      || rpad(left(upper(d.serie), 4), 4, ' ')
      || lpad(right(regexp_replace(d.numero, '[^0-9]', '', 'g'), 8), 8, '0')
      || E'\r\n';
  end loop;
  v_cab := '*' || t.ruc || bn_texto(t.nombre, 35) || to_char(v_anio % 100, 'FM00') || lpad(v_sec::text, 4, '0')
        || lpad((v_total * 100)::bigint::text, 15, '0') || E'\r\n';

  insert into detraccion_lotes (tenant_id, anio, secuencia, nombre_archivo, cantidad, total_soles, contenido, generado_por)
  values (v_tenant, v_anio, v_sec, v_nombre, v_n, v_total, v_cab || v_lineas, auth.uid()) returning id into v_id;
  update detracciones set lote_bn_id = v_id where id = any(p_ids) and tenant_id = v_tenant;

  return query select v_id, v_nombre, v_cab || v_lineas, v_n, v_total;
end $$;

-- Deshacer un archivo que no se llegó a enviar
create or replace function public.detraccion_lote_anular(p_lote uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería'; end if;
  if exists (select 1 from detracciones where lote_bn_id = p_lote and estado = 'depositado') then
    raise exception 'El archivo ya tiene detracciones depositadas: no se anula';
  end if;
  update detracciones set lote_bn_id = null where lote_bn_id = p_lote;
  update detraccion_lotes set anulado_en = now(), anulado_por = auth.uid() where id = p_lote and tenant_id = auth_tenant_id();
end $$;

-- 3) Constancias de SUNAT → detracciones depositadas
--    p_filas: [{constancia, periodo, ruc, proveedor, fecha, monto, tipo_bien, tipo_cp, serie, numero, cuenta}]
create or replace function public.detracciones_importar_constancias(p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; f jsonb; v_id uuid; v_comp uuid; v_prov uuid;
        v_ruc text; v_serie text; v_num text; v_fecha date; v_monto numeric; v_const text;
        n_cerradas int := 0; n_nuevas int := 0; n_ya int := 0; n_saltadas int := 0; v_sin_comp int := 0;
begin
  if not (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('contabilidad', 'editar')) then
    raise exception 'Sin permiso para importar constancias';
  end if;
  v_tenant := auth_tenant_id();
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_const := nullif(trim(f->>'constancia'), '');
    v_ruc := regexp_replace(coalesce(f->>'ruc', ''), '[^0-9]', '', 'g');
    v_serie := upper(trim(coalesce(f->>'serie', '')));
    v_num := regexp_replace(coalesce(f->>'numero', ''), '[^0-9]', '', 'g');
    v_monto := nullif(regexp_replace(coalesce(f->>'monto', ''), '[^0-9.]', '', 'g'), '')::numeric;
    begin
      v_fecha := case when (f->>'fecha') ~ '^\d{2}/\d{2}/\d{4}' then to_date(left(f->>'fecha', 10), 'DD/MM/YYYY')
                      when (f->>'fecha') ~ '^\d{4}-\d{2}-\d{2}' then left(f->>'fecha', 10)::date else null end;
    exception when others then v_fecha := null; end;
    if v_const is null or v_ruc = '' or v_monto is null then n_saltadas := n_saltadas + 1; continue; end if;

    -- Ya registrada esta constancia
    if exists (select 1 from detracciones where tenant_id = v_tenant and numero_constancia = v_const) then n_ya := n_ya + 1; continue; end if;

    -- Pendiente que coincide por RUC + comprobante; si no, por RUC + monto + periodo
    select id into v_id from detracciones
     where tenant_id = v_tenant and estado = 'pendiente' and ruc_proveedor = v_ruc
       and v_serie <> '' and upper(serie) = v_serie and ltrim(numero, '0') = ltrim(v_num, '0')
     order by creado_en limit 1;
    if v_id is null then
      select id into v_id from detracciones
       where tenant_id = v_tenant and estado = 'pendiente' and ruc_proveedor = v_ruc
         and round(monto_detraccion, 0) = round(v_monto, 0)
         and (periodo is null or periodo = regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'))
       order by creado_en limit 1;
    end if;
    if v_id is not null then
      update detracciones set numero_constancia = v_const, fecha_deposito = v_fecha, estado = 'depositado',
             monto_detraccion = coalesce(v_monto, monto_detraccion)
       where id = v_id;
      n_cerradas := n_cerradas + 1;
    else
      -- Depósito hecho fuera del ERP: se registra para que el histórico esté completo
      select id into v_prov from proveedores where tenant_id = v_tenant and ruc = v_ruc limit 1;
      select id into v_comp from comprobantes_pago
       where tenant_id = v_tenant and ruc_emisor = v_ruc and upper(serie) = v_serie and ltrim(numero, '0') = ltrim(v_num, '0') limit 1;
      if v_comp is null then v_sin_comp := v_sin_comp + 1; end if;
      insert into detracciones (tenant_id, comprobante_id, proveedor_id, codigo_bien_servicio, monto_detraccion, estado, periodo,
                                ruc_proveedor, razon_social, cuenta_detraccion, tipo_comprobante, serie, numero, fecha_deposito,
                                numero_constancia, fecha_pago_proveedor, origen)
      values (v_tenant, v_comp, v_prov, nullif(lpad(regexp_replace(coalesce(f->>'tipo_bien', ''), '[^0-9]', '', 'g'), 3, '0'), '000'),
              v_monto, 'depositado', regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'),
              v_ruc, nullif(trim(f->>'proveedor'), ''), nullif(regexp_replace(coalesce(f->>'cuenta', ''), '[^0-9]', '', 'g'), ''),
              nullif(lpad(regexp_replace(coalesce(f->>'tipo_cp', ''), '[^0-9]', '', 'g'), 2, '0'), '00'),
              nullif(v_serie, ''), nullif(v_num, ''), v_fecha, v_const, v_fecha, 'sunat');
      n_nuevas := n_nuevas + 1;
    end if;
  end loop;
  return jsonb_build_object('cerradas', n_cerradas, 'nuevas', n_nuevas, 'ya_registradas', n_ya, 'saltadas', n_saltadas, 'nuevas_sin_comprobante', v_sin_comp);
end $$;

-- 4) Vista para la pantalla
create or replace view public.v_detracciones as
select d.*,
       coalesce(p.razon_social, d.razon_social) as proveedor,
       c.numero_completo       as comprobante_numero,
       c.total                 as comprobante_total,
       c.fecha_emision         as comprobante_fecha,
       lp.numero               as lote_pago_numero,
       bl.nombre_archivo       as archivo_bn,
       bl.generado_en          as archivo_generado_en,
       bl.anulado_en           as archivo_anulado_en,
       case when d.fecha_pago_proveedor is not null then detraccion_vence(d.fecha_pago_proveedor) end as vence,
       case when d.estado = 'pendiente' and d.fecha_pago_proveedor is not null then detraccion_vence(d.fecha_pago_proveedor) < current_date else false end as vencida,
       dc.descripcion          as bien_servicio
  from detracciones d
  left join proveedores p on p.id = d.proveedor_id
  left join comprobantes_pago c on c.id = d.comprobante_id
  left join lotes_pago_items li on li.id = d.lote_item_id
  left join lotes_pago lp on lp.id = li.lote_id
  left join detraccion_lotes bl on bl.id = d.lote_bn_id and bl.anulado_en is null
  left join detraccion_codigos dc on dc.codigo = d.codigo_bien_servicio;
grant select on v_detracciones, detraccion_lotes to authenticated;
