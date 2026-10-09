-- Razón social legal del tenant, para la cabecera del archivo de pago masivo de
-- detracciones del Banco de la Nación ("MEMPHIS MAQUINARIAS SAC", no el nombre
-- comercial que usa la interfaz). 2026-10-09, pedido de Kevin.
alter table tenants add column if not exists razon_social text;
update tenants set razon_social = 'MEMPHIS MAQUINARIAS SAC' where id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and razon_social is null;

create or replace function public.detraccion_lote_generar(p_ids uuid[]) returns table (lote_id uuid, nombre_archivo text, contenido text, cantidad int, total_soles numeric)
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; v_anio int; v_sec int; v_total numeric := 0; v_n int := 0; v_lineas text := ''; d record; v_id uuid; v_nombre text; v_cab text;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería (finanzas.lotes_pagar)'; end if;
  v_tenant := auth_tenant_id();
  select ruc, coalesce(nullif(razon_social, ''), nombre) as nombre into t from tenants where id = v_tenant;
  if coalesce(t.ruc, '') = '' then raise exception 'El tenant no tiene RUC configurado'; end if;

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
      || lpad('0', 9, '0')
      || d.codigo_bien_servicio
      || lpad(right(regexp_replace(d.cuenta_detraccion, '[^0-9]', '', 'g'), 11), 11, '0')
      || lpad((round(d.monto_detraccion, 0) * 100)::bigint::text, 15, '0')
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
