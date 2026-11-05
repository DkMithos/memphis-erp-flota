-- 2026-11-05 · Una nota de crédito/débito solo se contabiliza si la factura que modifica tiene asiento en el ERP
-- (las históricas de periodos cerrados no lo tienen: su reversión también vive fuera del ERP). Se parchea la línea del
-- set_config en sire_importar_compras sin reescribir la función.
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'sire_importar_compras' and pg_get_function_arguments(p.oid) like '%p_corte%';
  v_new := replace(v_def, 'perform set_config(''app.sin_asiento'', case when v_periodo < ''202601'' or v_afecta is null then ''1'' else ''0'' end, true);',
                          'perform set_config(''app.sin_asiento'', case when v_periodo < ''202601'' or v_afecta is null or not exists (select 1 from comprobantes_pago z where z.id = v_afecta and z.asiento_id is not null) then ''1'' else ''0'' end, true);');
  if v_new = v_def then raise exception 'sire_importar_compras: no se encontró el ancla del set_config de notas'; end if;
  execute v_new;
end $$;
