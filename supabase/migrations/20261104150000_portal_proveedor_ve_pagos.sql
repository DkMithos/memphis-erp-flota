-- 2026-11-04 · Kevin: "revisa si el proveedor puede descargar el comprobante de ese pago, tendría que poder hacerlo".
-- Hasta hoy el proveedor solo veía el estado "Pagada" en el portal: los pagos (transacciones) tienen RLS por tenant y el
-- usuario del portal no tiene tenant en su JWT, y el bucket `vouchers-pagos` solo lo leían Finanzas/Compras/Contabilidad/
-- Dirección. Aquí se le da al proveedor (auth_proveedor_id()) lo suyo y nada más:
--   · portal_mis_pagos(): los pagos de SUS facturas (número, fecha, monto, referencia y ruta del comprobante).
--   · portal_voucher_es_mio(ruta): true si esa ruta es el comprobante de un pago de una factura suya (security definer,
--     porque la política de storage corre como el proveedor y la RLS de transacciones no le dejaría ver nada).
--   · política de lectura en `vouchers-pagos` para el proveedor sobre esos objetos (firma la URL desde el portal).

create or replace function public.portal_mis_pagos()
returns table (comprobante_id uuid, transaccion text, fecha date, monto numeric, moneda text, referencia text, comprobante_url text)
language sql stable security definer set search_path = public as $$
  select t.comprobante_id, t.numero, coalesce(t.fecha_pago, t.fecha)::date, t.monto, t.moneda, t.referencia_numero, t.comprobante_url
    from transacciones t
    join comprobantes_pago c on c.id = t.comprobante_id
   where auth_proveedor_id() is not null
     and c.proveedor_id = auth_proveedor_id()
     and t.estado <> 'anulada'
   order by coalesce(t.fecha_pago, t.fecha) desc;
$$;
revoke all on function public.portal_mis_pagos() from public, anon;
grant execute on function public.portal_mis_pagos() to authenticated;

create or replace function public.portal_voucher_es_mio(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth_proveedor_id() is not null and exists (
    select 1 from transacciones t join comprobantes_pago c on c.id = t.comprobante_id
     where c.proveedor_id = auth_proveedor_id() and t.estado <> 'anulada' and t.comprobante_url = p_ruta);
$$;
revoke all on function public.portal_voucher_es_mio(text) from public, anon;
grant execute on function public.portal_voucher_es_mio(text) to authenticated;

drop policy if exists vouchers_pagos_proveedor_lee on storage.objects;
create policy vouchers_pagos_proveedor_lee on storage.objects for select to authenticated
  using (bucket_id = 'vouchers-pagos' and portal_voucher_es_mio(name));
