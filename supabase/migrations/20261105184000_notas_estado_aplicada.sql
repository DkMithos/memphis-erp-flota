-- 2026-11-05 · Las notas de crédito/débito aplicadas a su factura no deben figurar como "conformes" (vencidas, pagables):
-- quedan en estado_flujo 'aplicada' una vez contabilizadas y aplicadas. El importador lo hace al terminar de aplicar.
update comprobantes_pago set estado_flujo = 'aplicada'
 where tipo in ('07', '08') and direccion = 'recibido' and afecta_comprobante_id is not null and estado_flujo = 'conforme';
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'sire_importar_compras' and pg_get_function_arguments(p.oid) like '%p_corte%';
  v_new := replace(v_def, 'else perform nota_aplicar(v_id); n_notas := n_notas + 1; end if;',
                          'else perform nota_aplicar(v_id); update comprobantes_pago set estado_flujo = ''aplicada'' where id = v_id; n_notas := n_notas + 1; end if;');
  if v_new = v_def then raise exception 'sire_importar_compras: no se encontró el ancla de nota_aplicar'; end if;
  execute v_new;
end $$;
