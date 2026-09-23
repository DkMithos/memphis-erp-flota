-- Migración aplicada en producción vía Supabase (2026-09-23).
-- version: 20260923151242  name: bloque1_cxp_desde_go_live
--
-- Las OC anteriores al go-live se gestionaron (y pagaron) en el sistema
-- anterior y en el Excel: el ERP no sabe su estado de pago. Generarles un
-- compromiso "pendiente" inflaba la deuda con S/ 67 M "vencidos" que no lo son.
-- Desde `cxp_desde` (go-live, ajustable por Finanzas) la OC aprobada sí genera
-- su cuenta por pagar; lo anterior solo entra si el Excel lo trae.
insert into public.parametros_financieros (clave, valor, descripcion)
values ('cxp_desde', 20260701, 'AAAAMMDD: desde qué fecha de emisión una OC aprobada genera cuenta por pagar (go-live jul-2026). Antes: solo lo que trae el Excel.')
on conflict (clave) do nothing;

create or replace function public.cxp_desde() returns date
language sql stable set search_path = public as $$
  select coalesce(to_date((select valor::bigint::text from parametros_financieros where clave = 'cxp_desde'), 'YYYYMMDD'), date '2026-07-01');
$$;

create or replace function public.sync_compromiso_de_oc(p_oc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_area text;
begin
  select oc.*, c.codigo as cc_codigo, c.area as cc_area, p.razon_social as prov_nombre
    into r
    from ordenes_compra oc
    left join centros_costo c on c.id = oc.centro_costo_id
    left join proveedores p on p.id = oc.proveedor_id
   where oc.id = p_oc;
  if not found then return; end if;

  -- No es compromiso vivo: borrador/enviada/anulada, o anterior al go-live
  -- (histórico del sistema anterior). Se retira la fila generada por el ERP
  -- salvo que ya esté pagada o tenga factura.
  if r.estado not in ('aprobada', 'recibida_parcial', 'recibida_total')
     or coalesce(r.fecha_emision::date, current_date) < cxp_desde() then
    delete from flujo_compromisos
     where orden_compra_id = p_oc and fuente = 'erp' and comprobante_id is null
       and upper(coalesce(estado_pago, '')) not like 'PAGADO%';
    return;
  end if;

  -- Si el Excel ya trae esta OC (una o varias cuotas), el Excel manda hasta que
  -- el flujo sea nativo: no duplicar.
  if exists (select 1 from flujo_compromisos where orden_compra_id = p_oc and fuente = 'excel') then return; end if;

  v_area := case when r.proyecto_id is not null then 'PROYECTOS' else coalesce(r.cc_area, 'ADMINISTRACION') end;

  insert into flujo_compromisos (
    tenant_id, area, cdc, centro_costo_id, proyecto_id, concepto, categoria, proveedor, proveedor_id,
    moneda, tc, mes_vencimiento, fecha_vencimiento, monto_presupuestado, monto_ejecutado,
    estado_pago, sentido, origen, fuente, orden_compra_id, referencia_doc, creado_por)
  values (
    r.tenant_id, v_area, r.cc_codigo, r.centro_costo_id, r.proyecto_id,
    'OC ' || r.numero || coalesce(' · ' || nullif(left(r.observaciones, 80), ''), ''),
    coalesce(r.tipo, 'oc'), r.prov_nombre, r.proveedor_id,
    r.moneda, r.tipo_cambio,
    date_trunc('month', coalesce(r.fecha_vencimiento_pago, r.fecha_emision::date))::date,
    r.fecha_vencimiento_pago, r.total, r.total,
    'PENDIENTE', 'pagar', 'comprometido', 'erp', r.id, r.numero, r.creado_por)
  on conflict (orden_compra_id) where orden_compra_id is not null and fuente = 'erp' do update set
    monto_presupuestado = excluded.monto_presupuestado,
    monto_ejecutado     = excluded.monto_ejecutado,
    moneda              = excluded.moneda,
    tc                  = coalesce(flujo_compromisos.tc, excluded.tc),
    fecha_vencimiento   = coalesce(flujo_compromisos.fecha_vencimiento, excluded.fecha_vencimiento),
    mes_vencimiento     = coalesce(flujo_compromisos.mes_vencimiento, excluded.mes_vencimiento),
    proyecto_id         = excluded.proyecto_id,
    centro_costo_id     = coalesce(flujo_compromisos.centro_costo_id, excluded.centro_costo_id),
    proveedor_id        = coalesce(flujo_compromisos.proveedor_id, excluded.proveedor_id),
    origen              = case when flujo_compromisos.comprobante_id is not null then 'real' else 'comprometido' end;
end $$;

-- Relleno: cada OC aprobada/recibida desde el go-live sin fila del Excel genera su compromiso.
do $$
declare v uuid;
begin
  for v in select id from ordenes_compra
            where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
              and estado in ('aprobada', 'recibida_parcial', 'recibida_total')
  loop
    perform sync_compromiso_de_oc(v);
  end loop;
end $$;
