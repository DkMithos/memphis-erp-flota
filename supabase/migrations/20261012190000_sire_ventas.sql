-- ─────────────────────────────────────────────────────────────────────────────
-- Semana 2 del plan de carga (2026-10-12) · SIRE de ventas (facturas emitidas).
--
-- · `comprobantes_pago.cliente_id`: la factura emitida apunta al cliente del CRM
--   (tabla `clientes`), como la recibida apunta a `proveedores`.
-- · `sire_importar_ventas(p_filas, p_archivo, p_corte)`: el mismo contrato que
--   `sire_importar_compras`, pero el emisor es el tenant y el receptor es el
--   cliente. Entran facturas (01), boletas (03), notas de crédito (07) y de
--   débito (08). Periodo < p_corte → `historica` (venta de un ejercicio cerrado,
--   sin asiento); si no → `emitida` (por cobrar hasta que Finanzas la cierre).
--   Las notas de crédito nunca generan asiento al entrar: el cargador decide
--   después si anulan la factura (NC por el total → factura `anulada`, lo que
--   revierte su asiento) o si son parciales (entonces sí se contabilizan).
--   `trg_factura_compromiso` ya ignora los emitidos (migración 20261012150000):
--   el lado de cobro lo llevan las valorizaciones.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.comprobantes_pago add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
create index if not exists idx_comprobantes_pago_cliente on public.comprobantes_pago (cliente_id) where cliente_id is not null;
create index if not exists idx_comprobantes_pago_emitidos on public.comprobantes_pago (tenant_id, fecha_emision) where direccion = 'emitido';

create or replace function public.sire_importar_ventas(p_filas jsonb, p_archivo text default null, p_corte text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; t record; f jsonb; v_tipo text; v_serie text; v_num text; v_ruc text; v_total numeric; v_moneda text; v_tc numeric;
        v_fe date; v_fv date; v_cli uuid; v_periodo text; v_estado text; v_bi numeric; v_igv numeric; v_ex numeric; v_inaf numeric; v_otros numeric;
        v_obs text; n_nuevas int := 0; n_existen int := 0; n_nc int := 0; n_saltadas int := 0; n_sin_cli int := 0; n_hist int := 0;
begin
  if not (auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('compras', 'editar')) then
    raise exception 'Sin permiso para importar el SIRE de ventas (contabilidad.editar)';
  end if;
  v_tenant := auth_tenant_id();
  select ruc, coalesce(nullif(razon_social, ''), nombre) as nombre into t from tenants where id = v_tenant;
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_tipo := lpad(regexp_replace(coalesce(f->>'tipo', ''), '[^0-9]', '', 'g'), 2, '0');
    v_serie := upper(trim(coalesce(f->>'serie', '')));
    v_num := regexp_replace(coalesce(f->>'numero', ''), '[^0-9]', '', 'g');
    v_ruc := regexp_replace(coalesce(f->>'ruc', ''), '[^0-9]', '', 'g');
    v_total := nullif(regexp_replace(coalesce(f->>'total', ''), '[^0-9.\-]', '', 'g'), '')::numeric;
    v_moneda := case when upper(coalesce(f->>'moneda', 'PEN')) in ('USD', 'US$', 'DOLARES') then 'USD' else 'PEN' end;
    v_tc := nullif(regexp_replace(coalesce(f->>'tc', ''), '[^0-9.]', '', 'g'), '')::numeric;
    v_bi := coalesce(nullif(regexp_replace(coalesce(f->>'bi_gravada', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_igv := coalesce(nullif(regexp_replace(coalesce(f->>'igv', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_ex := coalesce(nullif(regexp_replace(coalesce(f->>'exonerado', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_inaf := coalesce(nullif(regexp_replace(coalesce(f->>'inafecto', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    v_otros := coalesce(nullif(regexp_replace(coalesce(f->>'otros_tributos', ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
    begin
      v_fe := nullif(left(f->>'fecha_emision', 10), '')::date;
      v_fv := nullif(left(f->>'fecha_vencimiento', 10), '')::date;
    exception when others then v_fe := null; v_fv := null; end;
    -- El SIRE trae las notas de crédito con signo negativo: se guardan en positivo (el tipo 07 ya dice que restan).
    if v_tipo = '07' then v_total := abs(v_total); v_bi := abs(v_bi); v_igv := abs(v_igv); v_ex := abs(v_ex); v_inaf := abs(v_inaf); v_otros := abs(v_otros); end if;
    if v_tipo not in ('01', '03', '07', '08') or v_serie = '' or v_num = '' or v_ruc = '' or v_fe is null or v_total is null or v_total <= 0 then
      n_saltadas := n_saltadas + 1; continue;
    end if;
    if exists (select 1 from comprobantes_pago where tenant_id = v_tenant and direccion = 'emitido' and tipo = v_tipo and upper(serie) = v_serie and ltrim(numero, '0') = ltrim(v_num, '0')) then
      n_existen := n_existen + 1; continue;
    end if;
    v_periodo := nullif(regexp_replace(coalesce(f->>'periodo', ''), '[^0-9]', '', 'g'), '');
    if v_periodo is null then v_periodo := to_char(v_fe, 'YYYYMM'); end if;
    v_estado := case when p_corte is not null and v_periodo < p_corte then 'historica' else 'emitida' end;
    -- Ejercicios cerrados y notas de crédito/débito entran sin asiento (el cargador decide después qué hacer con las notas).
    perform set_config('app.sin_asiento', case when v_periodo < '202601' or v_tipo in ('07', '08') then '1' else '0' end, true);
    select id into v_cli from clientes where tenant_id = v_tenant and ruc = v_ruc limit 1;
    if v_cli is null then n_sin_cli := n_sin_cli + 1; end if;
    v_obs := concat_ws(' · ',
      'SIRE de ventas ' || coalesce(p_archivo, '') || ' (periodo ' || v_periodo || ')',
      case when v_tipo in ('07', '08') and coalesce(f->>'mod_serie', '') <> '' then
        case when v_tipo = '07' then 'Nota de crédito' else 'Nota de débito' end || ' tipo ' || coalesce(nullif(f->>'tipo_nota', ''), '?')
        || ' sobre ' || coalesce(nullif(f->>'mod_tipo', ''), '01') || ' ' || (f->>'mod_serie') || '-' || ltrim(coalesce(f->>'mod_numero', ''), '0') end);
    insert into comprobantes_pago (tenant_id, direccion, tipo, serie, numero, numero_completo, fecha_emision, fecha_vencimiento,
                                   ruc_emisor, razon_social_emisor, ruc_receptor, razon_social_receptor,
                                   op_gravada, op_exonerada, op_inafecta, otros_tributos, subtotal, igv, total, moneda, tipo_cambio,
                                   estado, estado_flujo, cliente_id, origen, periodo_sire, observaciones)
    values (v_tenant, 'emitido', v_tipo, v_serie, v_num, v_serie || '-' || v_num, v_fe, coalesce(v_fv, v_fe + 30),
            t.ruc, t.nombre, v_ruc, nullif(trim(f->>'razon_social'), ''),
            v_bi, v_ex, v_inaf, v_otros, v_bi + v_ex + v_inaf, v_igv, v_total, v_moneda, case when v_moneda = 'USD' and coalesce(v_tc, 0) > 1 then v_tc else 1 end,
            'activo', v_estado, v_cli, 'sire', v_periodo, v_obs);
    n_nuevas := n_nuevas + 1;
    if v_tipo in ('07', '08') then n_nc := n_nc + 1; elsif v_estado = 'historica' then n_hist := n_hist + 1; end if;
  end loop;
  perform set_config('app.sin_asiento', '0', true);
  return jsonb_build_object('nuevas', n_nuevas, 'ya_existian', n_existen, 'notas', n_nc, 'historicas', n_hist, 'saltadas', n_saltadas, 'sin_cliente_en_directorio', n_sin_cli);
end $$;
