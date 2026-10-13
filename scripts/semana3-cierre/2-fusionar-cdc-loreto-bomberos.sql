-- 2026-10-13 · Pedido de Kevin: "hay dos centros de costo de Loreto Bomberos, anula uno, solo debemos tener uno".
-- Los dos vinieron de la migración de oc-system (22/06/2026) y apuntan al mismo proyecto 04LORBOM25:
--   GLORETOBOM (9127e52b…): el código que usa Finanzas en el Flujo de proyectos (333 compromisos del Excel), 8 OC, 6 facturas.
--   GLOREBOMBE (cb93696c…): el código que usaba Compras en oc-system (61 OC, 36 requerimientos, 17 facturas, 46 pagos históricos).
-- Se conserva GLORETOBOM (misma familia GLORETO* que el resto y es el que cada reimportación del flujo vuelve a buscar) y todo lo
-- que apuntaba a GLOREBOMBE pasa a GLORETOBOM; GLOREBOMBE queda INACTIVO (no se borra: conserva su historial de auditoría y
-- deja de aparecer en los selectores). Con app.sin_asiento = '1' para que mover una factura de CDC no genere asientos.
-- Primero con ROLLBACK, luego COMMIT.
begin;
select set_config('app.sin_asiento', '1', true);
create temp table _cc on commit drop as
select (select id from centros_costo where codigo = 'GLORETOBOM' and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13') as bueno,
       (select id from centros_costo where codigo = 'GLOREBOMBE' and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13') as viejo;

update transacciones t set centro_costo_id = c.bueno from _cc c where t.centro_costo_id = c.viejo;
update comprobantes_pago x set centro_costo_id = c.bueno from _cc c where x.centro_costo_id = c.viejo;
update flujo_compromisos f set centro_costo_id = c.bueno, cdc = 'GLORETOBOM' from _cc c where f.centro_costo_id = c.viejo or f.cdc = 'GLOREBOMBE';
update ordenes_compra o set centro_costo_id = c.bueno from _cc c where o.centro_costo_id = c.viejo;
update requerimientos_compra r set centro_costo_id = c.bueno, centro_costo = 'GLORETOBOM' from _cc c where r.centro_costo_id = c.viejo or r.centro_costo = 'GLOREBOMBE';
update cotizaciones q set centro_costo_id = c.bueno from _cc c where q.centro_costo_id = c.viejo;
update recepciones r set centro_costo_id = c.bueno from _cc c where r.centro_costo_id = c.viejo;
update asientos_lineas a set centro_costo_id = c.bueno from _cc c where a.centro_costo_id = c.viejo;
update lotes_pago_items l set centro_costo_id = c.bueno, cdc = 'GLORETOBOM' from _cc c where l.centro_costo_id = c.viejo or l.cdc = 'GLOREBOMBE';
update obligaciones_financieras o set centro_costo_id = c.bueno, cdc = 'GLORETOBOM' from _cc c where o.centro_costo_id = c.viejo or o.cdc = 'GLOREBOMBE';
update movimientos_bancarios m set centro_costo_id = c.bueno from _cc c where m.centro_costo_id = c.viejo;
update presupuesto_lineas p set centro_costo_id = c.bueno from _cc c where p.centro_costo_id = c.viejo;
update gastos_caja_chica g set centro_costo = 'GLORETOBOM' where g.centro_costo = 'GLOREBOMBE';
update ingresos_caja_chica g set centro_costo = 'GLORETOBOM' where g.centro_costo = 'GLOREBOMBE';

update centros_costo cc set activo = false,
       nombre = 'GLOREBOMBE (fusionado en GLORETOBOM el 13/10/2026)',
       descripcion = concat_ws(' · ', nullif(descripcion, ''), 'Código duplicado de GORE Loreto - Bomberos que venía de oc-system; todo su historial pasó a GLORETOBOM el 13/10/2026 por pedido de Kevin.')
  from _cc c where cc.id = c.viejo;

select 'referencias_que_quedan_al_viejo' k, (select jsonb_build_object(
   'transacciones', (select count(*) from transacciones t, _cc c where t.centro_costo_id = c.viejo),
   'facturas', (select count(*) from comprobantes_pago x, _cc c where x.centro_costo_id = c.viejo),
   'compromisos', (select count(*) from flujo_compromisos f, _cc c where f.centro_costo_id = c.viejo or f.cdc = 'GLOREBOMBE'),
   'ordenes', (select count(*) from ordenes_compra o, _cc c where o.centro_costo_id = c.viejo),
   'requerimientos', (select count(*) from requerimientos_compra r, _cc c where r.centro_costo_id = c.viejo or r.centro_costo = 'GLOREBOMBE'),
   'caja', (select count(*) from gastos_caja_chica where centro_costo = 'GLOREBOMBE'),
   'asientos_lineas', (select count(*) from asientos_lineas a, _cc c where a.centro_costo_id = c.viejo))::text) v
union all select 'gloretobom_despues', (select jsonb_build_object(
   'transacciones', (select count(*) from transacciones t, _cc c where t.centro_costo_id = c.bueno),
   'facturas', (select count(*) from comprobantes_pago x, _cc c where x.centro_costo_id = c.bueno),
   'compromisos', (select count(*) from flujo_compromisos f, _cc c where f.centro_costo_id = c.bueno),
   'ordenes', (select count(*) from ordenes_compra o, _cc c where o.centro_costo_id = c.bueno),
   'requerimientos', (select count(*) from requerimientos_compra r, _cc c where r.centro_costo_id = c.bueno),
   'caja', (select count(*) from gastos_caja_chica where centro_costo = 'GLORETOBOM'),
   'asientos_lineas', (select count(*) from asientos_lineas a, _cc c where a.centro_costo_id = c.bueno))::text)
union all select 'cdc_loreto_bomberos', (select jsonb_agg(jsonb_build_object('codigo', codigo, 'activo', activo, 'nombre', nombre))::text from centros_costo where codigo in ('GLORETOBOM', 'GLOREBOMBE'))
union all select 'asientos_nuevos', (select count(*)::text from asientos_contables where creado_en > now() - interval '5 minutes');
rollback;
