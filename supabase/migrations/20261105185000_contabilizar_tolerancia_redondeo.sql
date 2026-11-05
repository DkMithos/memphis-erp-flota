-- 2026-11-05 · 64 facturas del SIRE de set/oct no se contabilizaban porque base + IGV difiere del total en centavos
-- (redondeo de SUNAT, ICBPER/otros cargos que el SIRE no desglosa en la base, conversión USD→soles): la tolerancia era de
-- 5 centavos. Pasa a 1 sol o 0.2 % del total (lo que sea mayor); la diferencia se absorbe en la base, como ya se hacía.
-- Luego se vuelven a contabilizar las que quedaron con error.
do $$
declare v_def text; v_new text; r record; n int := 0; e int := 0;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'contabilizar_comprobante';
  v_new := replace(v_def, 'if abs(v_dif) <= 0.05 then', 'if abs(v_dif) <= greatest(1.00, abs(v_total) * 0.002) then');
  if v_new = v_def then raise exception 'contabilizar_comprobante: no se encontró el ancla de la tolerancia'; end if;
  execute v_new;
  for r in select id from comprobantes_pago where contabilizacion_error is not null and asiento_id is null and estado = 'activo' and tipo not in ('07', '08')
            and coalesce(estado_flujo, '') in ('conforme', 'programada_pago', 'pagada', 'emitida') loop
    begin
      update comprobantes_pago set contabilizacion_error = null where id = r.id;
      perform contabilizar_comprobante(r.id);
      n := n + 1;
    exception when others then
      e := e + 1;
      update comprobantes_pago set contabilizacion_error = left(SQLERRM, 500) where id = r.id;
    end;
  end loop;
  raise notice 'recontabilizadas % · con error %', n, e;
end $$;
