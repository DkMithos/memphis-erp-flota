-- 2026-10-29 · API: GET /v1/cuentas-por-cobrar devolvía 500 en cada llamada (10 veces desde el 22/10, integración
-- "Facturas MA") porque el recurso pide la columna valorizacion_id y la vista v_cxc no la exponía, aunque la tabla base
-- flujo_compromisos sí la tiene. Se agrega al final de la vista (create or replace solo permite añadir columnas al final).
create or replace view public.v_cxc with (security_invoker = true) as
 select id, tenant_id, area, cdc, centro_costo_id, concepto, categoria, proveedor, proveedor_id, moneda, tc,
        mes_vencimiento, monto_ejecutado, monto_presupuestado, monto_pagado, fecha_pagado, estado_pago, mes_programado,
        postergado, momento, observaciones, fuente, origen_archivo, fila, creado_por, importado_en, sentido, origen,
        orden_compra_id, comprobante_id, proyecto_id, fecha_vencimiento, referencia_doc, pago_ligado_a,
        vencimiento_estimado, desfase_dias,
        coalesce(fecha_vencimiento, mes_vencimiento) as vence,
        to_char(coalesce(fecha_vencimiento, mes_vencimiento)::timestamptz, 'YYYY-MM') as mes,
        greatest(coalesce(monto_presupuestado, monto_ejecutado, 0) - coalesce(monto_pagado, 0), 0) as monto_pendiente,
        upper(coalesce(estado_pago, '')) like 'PAGADO%' as cobrado,
        case when moneda = 'USD' then coalesce(tc, tc_vigente(coalesce(fecha_vencimiento, mes_vencimiento, current_date))) else 1 end as tc_aplicado,
        valorizacion_id
   from flujo_compromisos f
  where sentido = 'cobrar';
