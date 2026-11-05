-- 2026-11-05 · El compromiso de una factura debe ser su total NETO de notas de crédito/débito aplicadas.
-- trg_factura_compromiso ponía siempre new.total al (re)crear el compromiso, y se dispara con cualquier update de
-- estado_flujo (recalc_pago_compromiso lo hace), así que pisaba el saldo que nota_aplicar acababa de fijar
-- (PACÍFICO F028-1130026 + ND FD12-209486 volvía de 11,019.31 a 9,005.55). Se parchea el trigger: monto = total − NC + ND.
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'trg_factura_compromiso';
  v_new := replace(v_def, 'new.fecha_vencimiento, new.total, new.total,',
    'new.fecha_vencimiento, '
    || 'round(coalesce(new.total, 0) - coalesce((select sum(x.total) from comprobantes_pago x where x.afecta_comprobante_id = new.id and x.tipo = ''07'' and x.estado = ''activo'' and coalesce(x.estado_flujo, '''') <> ''anulada''), 0) + coalesce((select sum(x.total) from comprobantes_pago x where x.afecta_comprobante_id = new.id and x.tipo = ''08'' and x.estado = ''activo'' and coalesce(x.estado_flujo, '''') <> ''anulada''), 0), 2), '
    || 'round(coalesce(new.total, 0) - coalesce((select sum(x.total) from comprobantes_pago x where x.afecta_comprobante_id = new.id and x.tipo = ''07'' and x.estado = ''activo'' and coalesce(x.estado_flujo, '''') <> ''anulada''), 0) + coalesce((select sum(x.total) from comprobantes_pago x where x.afecta_comprobante_id = new.id and x.tipo = ''08'' and x.estado = ''activo'' and coalesce(x.estado_flujo, '''') <> ''anulada''), 0), 2),');
  if v_new = v_def then raise exception 'trg_factura_compromiso: no se encontró el ancla (new.total, new.total)'; end if;
  execute v_new;
end $$;
