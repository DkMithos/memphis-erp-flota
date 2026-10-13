-- 2026-10-13 · Pedido de Kevin: "revisa los 79 centros de costo y fusiona los duplicados".
-- Revisión del catálogo completo: un centro de costo está duplicado cuando dos códigos apuntan al MISMO proyecto. Se encontraron
-- cuatro pares (además de Loreto Bomberos, ya fusionado en el script 2):
--   LORETOAMB      → GLORETOAMB   (GORE Loreto - Ambulancias; el viejo tenía 32 OC, 39 pagos, 17 facturas; el bueno sigue la familia GLORETO*)
--   MUNSMSERENAZGO → MPSANMIGUEL  (MP San Miguel - Serenazgo; el viejo se creó a mano en el ERP con 7 OC; el bueno es el código del proyecto)
--   GLORETOHOSPM   → GLORETOHOSP  (GORE Loreto - Hospitales móviles; el viejo no tiene uso)
--   GICAPATRUL     → GOREICAPNP   (GORE Ica - Patrulleros; GICAPATRUL ya estaba inactivo pero conservaba 1 OC, 1 factura y 3 líneas de asiento)
-- Los demás centros de costo son distintos entre sí (áreas administrativas, tributos, TI por rubro) y no se tocan.
-- Regla: se conserva el código del proyecto, todo lo que apuntaba al viejo pasa al bueno (FK y columnas de texto), el viejo queda
-- INACTIVO con nombre "(fusionado en …)". Con app.sin_asiento = '1'. Primero con ROLLBACK, luego COMMIT.
begin;
select set_config('app.sin_asiento', '1', true);
create temp table _par on commit drop as
select v.id as viejo, v.codigo as cod_viejo, b.id as bueno, b.codigo as cod_bueno
  from (values ('LORETOAMB', 'GLORETOAMB'), ('MUNSMSERENAZGO', 'MPSANMIGUEL'), ('GLORETOHOSPM', 'GLORETOHOSP'), ('GICAPATRUL', 'GOREICAPNP')) m(cv, cb)
  join centros_costo v on v.codigo = m.cv and v.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  join centros_costo b on b.codigo = m.cb and b.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
select 'pares' k, (select jsonb_agg(jsonb_build_object('viejo', cod_viejo, 'bueno', cod_bueno)) from _par)::text v;

update transacciones t set centro_costo_id = p.bueno from _par p where t.centro_costo_id = p.viejo;
update comprobantes_pago x set centro_costo_id = p.bueno from _par p where x.centro_costo_id = p.viejo;
update flujo_compromisos f set centro_costo_id = p.bueno, cdc = p.cod_bueno from _par p where f.centro_costo_id = p.viejo or f.cdc = p.cod_viejo;
update ordenes_compra o set centro_costo_id = p.bueno from _par p where o.centro_costo_id = p.viejo;
update requerimientos_compra r set centro_costo_id = p.bueno, centro_costo = p.cod_bueno from _par p where r.centro_costo_id = p.viejo or r.centro_costo = p.cod_viejo;
update cotizaciones q set centro_costo_id = p.bueno from _par p where q.centro_costo_id = p.viejo;
update recepciones r set centro_costo_id = p.bueno from _par p where r.centro_costo_id = p.viejo;
update asientos_lineas a set centro_costo_id = p.bueno from _par p where a.centro_costo_id = p.viejo;
update lotes_pago_items l set centro_costo_id = p.bueno, cdc = p.cod_bueno from _par p where l.centro_costo_id = p.viejo or l.cdc = p.cod_viejo;
update obligaciones_financieras o set centro_costo_id = p.bueno, cdc = p.cod_bueno from _par p where o.centro_costo_id = p.viejo or o.cdc = p.cod_viejo;
update movimientos_bancarios m set centro_costo_id = p.bueno from _par p where m.centro_costo_id = p.viejo;
update presupuesto_lineas pl set centro_costo_id = p.bueno from _par p where pl.centro_costo_id = p.viejo;
update gastos_caja_chica g set centro_costo = p.cod_bueno from _par p where g.centro_costo = p.cod_viejo;
update ingresos_caja_chica g set centro_costo = p.cod_bueno from _par p where g.centro_costo = p.cod_viejo;

update centros_costo cc set activo = false,
       nombre = p.cod_viejo || ' (fusionado en ' || p.cod_bueno || ' el 13/10/2026)',
       descripcion = concat_ws(' · ', nullif(descripcion, ''), 'Código duplicado del mismo proyecto; todo su historial pasó a ' || p.cod_bueno || ' el 13/10/2026 por pedido de Kevin.')
  from _par p where cc.id = p.viejo;
-- el bueno de San Miguel hereda el nombre legible que tenía el viejo
update centros_costo set nombre = 'MP San Miguel - Serenazgo' where codigo = 'MPSANMIGUEL' and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and nombre = 'MPSANMIGUEL';

select 'referencias_al_viejo' k, (select jsonb_build_object(
   'transacciones', (select count(*) from transacciones t, _par p where t.centro_costo_id = p.viejo),
   'facturas', (select count(*) from comprobantes_pago x, _par p where x.centro_costo_id = p.viejo),
   'compromisos', (select count(*) from flujo_compromisos f, _par p where f.centro_costo_id = p.viejo or f.cdc = p.cod_viejo),
   'ordenes', (select count(*) from ordenes_compra o, _par p where o.centro_costo_id = p.viejo),
   'requerimientos', (select count(*) from requerimientos_compra r, _par p where r.centro_costo_id = p.viejo or r.centro_costo = p.cod_viejo),
   'caja', (select count(*) from gastos_caja_chica g, _par p where g.centro_costo = p.cod_viejo),
   'asientos_lineas', (select count(*) from asientos_lineas a, _par p where a.centro_costo_id = p.viejo))::text) v
union all select 'buenos_despues', (select jsonb_agg(jsonb_build_object('codigo', p.cod_bueno,
   'trx', (select count(*) from transacciones t where t.centro_costo_id = p.bueno), 'oc', (select count(*) from ordenes_compra o where o.centro_costo_id = p.bueno),
   'fact', (select count(*) from comprobantes_pago x where x.centro_costo_id = p.bueno), 'comp', (select count(*) from flujo_compromisos f where f.centro_costo_id = p.bueno),
   'caja', (select count(*) from gastos_caja_chica g where g.centro_costo = p.cod_bueno)))::text from _par p)
union all select 'catalogo', (select jsonb_build_object('total', count(*), 'activos', count(*) filter (where activo), 'inactivos', count(*) filter (where not activo))::text from centros_costo where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13')
union all select 'proyectos_con_mas_de_un_cdc_activo', (select coalesce(jsonb_agg(x), '[]'::jsonb)::text from (select p.codigo, string_agg(cc.codigo, ', ') cdcs from centros_costo cc join proyectos p on p.id = cc.proyecto_id where cc.activo and cc.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' group by p.codigo having count(*) > 1) x)
union all select 'asientos_nuevos', (select count(*)::text from asientos_contables where creado_en > now() - interval '5 minutes');
rollback;
