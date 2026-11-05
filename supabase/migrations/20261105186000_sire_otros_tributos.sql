-- 2026-11-05 · El SIRE de compras trae ISC, ICBPER y "Otros Trib/Cargos" (recargo al consumo, propinas) en columnas que el
-- importador no leía: por eso 33 recibos y facturas de set/oct no cuadraban base + IGV contra el total y no tenían asiento.
-- Los lectores suman esas tres columnas en `otros_tributos`; el importador lo guarda (en USD también lo divide entre el TC)
-- y contabilizar_comprobante ya lo incluye en la base. Se parchea sire_importar_compras por texto.
-- Datos: scratchpad/carga/otros-tributos.mjs rellenó otros_tributos en 58 facturas de set/oct y recontabilizó las 33.
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'sire_importar_compras' and pg_get_function_arguments(p.oid) like '%p_corte%';
  v_new := v_def;
  v_new := replace(v_new, 'v_mod_serie text; v_mod_num text; v_mod_tipo text; v_afecta uuid;', 'v_mod_serie text; v_mod_num text; v_mod_tipo text; v_afecta uuid; v_otros numeric;');
  v_new := replace(v_new, 'v_ng := coalesce(nullif(regexp_replace(coalesce(f->>''no_gravada'', ''''), ''[^0-9.\-]'', '''', ''g''), '''')::numeric, 0);',
                          'v_ng := coalesce(nullif(regexp_replace(coalesce(f->>''no_gravada'', ''''), ''[^0-9.\-]'', '''', ''g''), '''')::numeric, 0);
    v_otros := coalesce(nullif(regexp_replace(coalesce(f->>''otros_tributos'', ''''), ''[^0-9.\-]'', '''', ''g''), '''')::numeric, 0);');
  v_new := replace(v_new, 'v_ng := round(v_ng / v_tc, 2);', 'v_ng := round(v_ng / v_tc, 2); v_otros := round(v_otros / v_tc, 2);');
  v_new := replace(v_new, 'v_ng := abs(v_ng); end if;', 'v_ng := abs(v_ng); v_otros := abs(v_otros); end if;');
  v_new := replace(v_new, 'op_gravada, op_exonerada, op_inafecta, subtotal, igv, total, moneda, tipo_cambio,', 'op_gravada, op_exonerada, op_inafecta, otros_tributos, subtotal, igv, total, moneda, tipo_cambio,');
  v_new := replace(v_new, 'v_bi, 0, v_ng, v_bi + v_ng, v_igv, v_total, v_moneda,', 'v_bi, 0, v_ng, v_otros, v_bi + v_ng, v_igv, v_total, v_moneda,');
  if v_new = v_def or v_new not like '%v_otros := round%' or (length(v_new) - length(replace(v_new, 'v_otros, v_bi + v_ng', ''))) / length('v_otros, v_bi + v_ng') <> 2 then
    raise exception 'sire_importar_compras: algún ancla no se encontró';
  end if;
  execute v_new;
end $$;
