-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 · Reconciliación Excel vs ERP del flujo financiero
--
-- `flujo_reconciliar(p_area, p_mes)` cruza los compromisos que vienen del Excel
-- (fuente = 'excel') con los que nacen en el ERP (fuente = 'erp': OC aprobadas,
-- facturas del portal/SIRE, compromisos manuales) y explica cada fila que no
-- cuadra. Cruce, en este orden: misma OC · misma referencia documental
-- (n.º de OC o SERIE-NÚMERO de factura) · mismo proveedor e importe (±1).
-- El mes no se usa para cruzar: si cruzan pero caen en meses distintos, la
-- causa es "mes distinto" (ese es justo el desfase que el sprint 4 cierra).
-- ─────────────────────────────────────────────────────────────────────────────

-- Referencia documental normalizada: "MM-290" / "mm-00290" → MM-000290; "MM-S 12" → MM-S-000012;
-- "F040-0010915" → F040-10915. '' si no trae nada reconocible.
create or replace function public.flujo_ref_norm(p text) returns text
language sql immutable as $$
  select case
    when p is null then ''
    when upper(p) ~ 'MM\s*-?\s*S\s*-?\s*\d{1,6}' then 'MM-S-' || lpad((regexp_match(upper(p), 'MM\s*-?\s*S\s*-?\s*(\d{1,6})'))[1], 6, '0')
    when upper(p) ~ 'MM\s*-?\s*\d{1,6}' then 'MM-' || lpad((regexp_match(upper(p), 'MM\s*-?\s*(\d{1,6})'))[1], 6, '0')
    when upper(p) ~ '\m[A-Z][A-Z0-9]{1,3}-\d{1,8}\M' then (regexp_match(upper(p), '\m([A-Z][A-Z0-9]{1,3})-0*(\d{1,8})\M'))[1] || '-' || (regexp_match(upper(p), '\m([A-Z][A-Z0-9]{1,3})-0*(\d{1,8})\M'))[2]
    else '' end;
$$;

create or replace function public.flujo_reconciliar(p_area text default null, p_mes date default null)
returns table (
  lado text, excel_id uuid, erp_id uuid, area text, mes_excel date, mes_erp date, cdc text, concepto text, proveedor text,
  referencia_doc text, moneda text, monto_excel numeric, monto_erp numeric, estado_excel text, estado_erp text,
  diferencia numeric, como text, causa text
)
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); e record; r_id uuid; r record; v_como text; v_ref text; v_prov5 text;
begin
  if not (auth_tiene_permiso('finanzas', 'flujo') or auth_tiene_permiso('finanzas', 'ver')) then
    raise exception 'Sin permiso para ver el flujo financiero';
  end if;

  create temp table if not exists _rec_erp (id uuid primary key, area text, mes date, cdc text, concepto text, proveedor text, proveedor_id uuid, ref text, refn text,
    moneda text, monto numeric, estado text, oc uuid, cp uuid, prov5 text, usado boolean default false) on commit drop;
  truncate _rec_erp;   -- (pg_safeupdate: un DELETE sin WHERE se rechaza desde PostgREST)
  insert into _rec_erp
  select f.id, f.area, f.mes_vencimiento, f.cdc, f.concepto, f.proveedor, f.proveedor_id, f.referencia_doc, flujo_ref_norm(f.referencia_doc),
         coalesce(f.moneda, 'PEN'), coalesce(f.monto_presupuestado, f.monto_ejecutado, 0), f.estado_pago, f.orden_compra_id, f.comprobante_id,
         upper(left(regexp_replace(coalesce(f.proveedor, ''), '\s', '', 'g'), 5)), false
    from flujo_compromisos f
   where f.tenant_id = v_tenant and f.fuente = 'erp' and f.sentido = 'pagar' and flujo_puede_ver(f.area)
     and (p_area is null or f.area = p_area);

  for e in
    select f.id, f.area, f.mes_vencimiento mes, f.cdc, f.concepto, f.proveedor, f.proveedor_id, f.referencia_doc ref, flujo_ref_norm(f.referencia_doc) refn,
           coalesce(f.moneda, 'PEN') moneda, coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) monto, f.estado_pago estado, f.orden_compra_id oc,
           upper(left(regexp_replace(coalesce(f.proveedor, ''), '\s', '', 'g'), 5)) prov5
      from flujo_compromisos f
     where f.tenant_id = v_tenant and f.fuente = 'excel' and f.sentido = 'pagar' and flujo_puede_ver(f.area)
       and (p_area is null or f.area = p_area)
     order by f.mes_vencimiento, f.cdc, f.concepto
  loop
    r_id := null; v_como := null;
    if e.oc is not null then
      select x.id into r_id from _rec_erp x where not x.usado and x.oc = e.oc and x.moneda = e.moneda
       order by abs(x.monto - e.monto), abs(coalesce(x.mes, e.mes) - e.mes) limit 1;
      if r_id is not null then v_como := 'misma OC'; end if;
    end if;
    if r_id is null and e.refn <> '' then
      select x.id into r_id from _rec_erp x where not x.usado and x.refn = e.refn
       order by abs(x.monto - e.monto), abs(coalesce(x.mes, e.mes) - e.mes) limit 1;
      if r_id is not null then v_como := 'misma referencia ' || e.refn; end if;
    end if;
    if r_id is null and e.monto > 0 then
      select x.id into r_id from _rec_erp x
       where not x.usado and x.moneda = e.moneda and abs(x.monto - e.monto) <= 1
         and ((e.proveedor_id is not null and x.proveedor_id = e.proveedor_id) or (e.prov5 <> '' and x.prov5 = e.prov5))
       order by abs(coalesce(x.mes, e.mes) - e.mes) limit 1;
      if r_id is not null then v_como := 'proveedor e importe'; end if;
    end if;

    if r_id is not null then
      update _rec_erp set usado = true where id = r_id;
      select * into r from _rec_erp where id = r_id;
      if p_mes is null or e.mes = p_mes or r.mes = p_mes then
        lado := 'ambos'; excel_id := e.id; erp_id := r.id; area := e.area; mes_excel := e.mes; mes_erp := r.mes; cdc := e.cdc; concepto := e.concepto;
        proveedor := e.proveedor; referencia_doc := coalesce(e.ref, r.ref); moneda := e.moneda; monto_excel := e.monto; monto_erp := r.monto;
        estado_excel := e.estado; estado_erp := r.estado; diferencia := round(e.monto - r.monto, 2); como := v_como;
        causa := case
          when abs(e.monto - r.monto) > 1 and e.mes is distinct from r.mes then 'Monto y mes distintos'
          when abs(e.monto - r.monto) > 1 then 'Monto distinto (Excel ' || e.monto || ' vs ERP ' || r.monto || ')'
          when e.mes is distinct from r.mes then 'Mes distinto: Excel ' || to_char(e.mes, 'YYYY-MM') || ', ERP ' || to_char(r.mes, 'YYYY-MM')
          when upper(coalesce(e.estado, '')) like 'PAGADO%' and upper(coalesce(r.estado, '')) not like 'PAGADO%' then 'Pagado en el Excel, pendiente en el ERP (falta registrar el pago)'
          when upper(coalesce(r.estado, '')) like 'PAGADO%' and upper(coalesce(e.estado, '')) not like 'PAGADO%' then 'Pagado en el ERP, pendiente en el Excel'
          else 'Coincide' end;
        return next;
      end if;
    elsif p_mes is null or e.mes = p_mes then
      lado := 'solo_excel'; excel_id := e.id; erp_id := null; area := e.area; mes_excel := e.mes; mes_erp := null; cdc := e.cdc; concepto := e.concepto;
      proveedor := e.proveedor; referencia_doc := e.ref; moneda := e.moneda; monto_excel := e.monto; monto_erp := null;
      estado_excel := e.estado; estado_erp := null; diferencia := e.monto; como := null;
      v_ref := e.refn;
      causa := case
        when v_ref like 'MM-%' then
          case when exists (select 1 from ordenes_compra o where o.tenant_id = v_tenant and flujo_ref_norm(o.numero) = v_ref)
               then 'La OC ' || v_ref || ' existe en el ERP pero no tiene compromiso (¿no está aprobada?)'
               else 'La OC ' || v_ref || ' no está registrada en el ERP' end
        when v_ref <> '' then
          case when exists (select 1 from comprobantes_pago c where c.tenant_id = v_tenant and flujo_ref_norm(c.numero_completo) = v_ref)
               then 'La factura ' || v_ref || ' está en el ERP pero sin compromiso (histórica o sin conformidad)'
               else 'La factura ' || v_ref || ' no está registrada en el ERP (portal/SIRE)' end
        when upper(coalesce(e.estado, '')) like 'PAGADO%' then 'Gasto pagado sin documento en el Excel (caja chica, planilla, préstamo…): registrarlo como transacción'
        else 'Proyección del Excel sin documento: no existe en el ERP hasta que haya OC o factura' end;
      return next;
    end if;
  end loop;

  for r in select * from _rec_erp where not usado and (p_mes is null or mes = p_mes) order by mes, cdc, concepto loop
    lado := 'solo_erp'; excel_id := null; erp_id := r.id; area := r.area; mes_excel := null; mes_erp := r.mes; cdc := r.cdc; concepto := r.concepto;
    proveedor := r.proveedor; referencia_doc := r.ref; moneda := r.moneda; monto_excel := null; monto_erp := r.monto;
    estado_excel := null; estado_erp := r.estado; diferencia := -r.monto; como := null;
    causa := case
      when r.oc is not null then 'OC aprobada en el ERP que no figura en el Excel'
      when r.cp is not null then 'Factura registrada en el ERP (portal/SIRE) que no figura en el Excel'
      else 'Compromiso creado a mano en el ERP que no figura en el Excel' end;
    return next;
  end loop;
end $$;

grant execute on function public.flujo_reconciliar(text, date) to authenticated;
grant execute on function public.flujo_ref_norm(text) to authenticated;
