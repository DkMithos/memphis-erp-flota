-- Semana 2 del plan de carga (2026-10-12) · Paso 1: valorizaciones reales de los proyectos en ejecución.
-- Fuente: "RESUMEN PROYECTOS.xlsx" (OPERACIONES TEAM), bloque "N° Valorización | Fecha | Importe | Mes CIPRL" de cada hoja "#",
-- cruzado con "12.Seguimiento de proyectos 05.10.26.xlsx" (Monto Cobrado CIPRL por proyecto) y con los CIPRL PAGADO del
-- "Flujo de proyectos.xlsx" ya importado (flujo_compromisos fuente excel, sentido cobrar) para decidir el estado:
--   pagada     = su CIPRL ya se cobró (fecha_pago = mes del CIPRL según el flujo/RESUMEN; aproximada al día 1)
--   presentada = valorizada, CIPRL todavía por cobrar
-- Solo entran las valorizaciones con importe > 0 (las de importe 0 son informes mensuales sin monto valorizado: no son un
-- hecho financiero y llenarían la CxC de ceros). fecha_presentacion = mes de la valorización (día 1, aproximado).
-- Se borran antes las 16 valorizaciones de ejemplo creadas el 25/05/2026 (admin@kesa.com, montos redondos: 4 000 000,
-- 18 000 000…) que no corresponden a ninguna valorización real y generaban 7 compromisos de cobro ficticios.
-- Además: (a) las filas del Excel de flujo con CDC mal escrito (GCUZCOAMBU, MPCUSCOPNP, MSS) se enlazan a su centro de costo
-- real (el trigger trg_flujo_proyecto les pone el proyecto); (b) proyectos.monto_cobrado toma el "Monto Cobrado CIPRL" del
-- Seguimiento del 05.10.26. Primero con ROLLBACK, luego COMMIT.
begin;

-- 0) fuera las valorizaciones de ejemplo (sus compromisos se borran por trigger; ninguna tiene cobros registrados)
delete from valorizaciones v
 where v.creado_por = 'admin@kesa.com' and v.creado_en::date = '2026-05-25'
   and not exists (select 1 from transacciones t join flujo_compromisos f on f.id = t.compromiso_id where f.valorizacion_id = v.id);

-- 1) valorizaciones reales
create temp table _val (proy text, numero int, fecha date, monto numeric, estado text, fecha_pago date, hoja text, nota text) on commit drop;
insert into _val values
 ('01CUSMUN24', 1, '2025-03-01', 6482606.56, 'pagada',     '2025-10-01', '# MP CUSCO - SERENAZGO', 'CIPRL 1 cobrado S/ 6 009 107.76 (oct-2025, neto de supervisión)'),
 ('01CUSMUN24', 3, '2025-05-01', 1042440.00, 'presentada', null,         '# MP CUSCO - SERENAZGO', 'CIPRL 2 solicitado (S/ 1 065 090 por cobrar según el flujo)'),
 ('01CUSMUN24', 7, '2026-04-01',   22650.00, 'presentada', null,         '# MP CUSCO - SERENAZGO', null),
 ('02CUSAMB25', 7, '2026-04-01', 35888370.21, 'pagada',    '2026-08-01', '# GORE CUSCO - AMBULANCIAS', 'CIPRL emitido el 18/08/2026 (Mes CIPRL ago-2026)'),
 ('03HNCPNP25', 3, '2025-08-01', 4726500.00, 'pagada',     '2025-12-01', '# GORE HUÁNUCO - PNP', 'CIPRL 1 S/ 4 726 500 (dic-2025)'),
 ('03HNCPNP25', 13, '2026-06-01', 2215000.00, 'pagada',    '2026-08-01', '# GORE HUÁNUCO - PNP', 'CIPRL 2 S/ 2 134 435.41 (ago-2026, neto de supervisión)'),
 ('04LORBOM25', 3, '2025-12-01', 16543724.49, 'pagada',    '2026-02-01', '# GORE LORETO - BOMBEROS', 'CPRL 1 S/ 16 543 724.49 (feb-2026); camionetas'),
 ('05AMAPNP25', 1, '2026-02-01',  426686.60, 'pagada',     '2026-06-01', '# GORE AMAZONAS - PNP', 'CIPRL 1 S/ 1 106 696.85 (jun-2026) cubre valos 1 y 2'),
 ('05AMAPNP25', 2, '2026-03-01',  676010.25, 'pagada',     '2026-06-01', '# GORE AMAZONAS - PNP', 'CIPRL 1 S/ 1 106 696.85 (jun-2026) cubre valos 1 y 2'),
 ('05AMAPNP25', 5, '2026-06-01',   38000.00, 'presentada', null,         '# GORE AMAZONAS - PNP', null),
 ('05AMAPNP25', 6, '2026-07-01', 11046586.08, 'presentada', null,        '# GORE AMAZONAS - PNP', 'CIPRL 2 S/ 11 056 686.08 por cobrar (flujo lo proyecta en sep-2026)'),
 ('06CUSPNP25', 1, '2025-12-01', 9464842.61, 'pagada',     '2026-04-01', '# GORE CUSCO - PNP', 'CIPRL 1 S/ 9 464 842.61 (abr-2026)'),
 ('06CUSPNP25', 4, '2026-03-01', 1419726.39, 'pagada',     '2026-07-01', '# GORE CUSCO - PNP', 'CIPRL 2 S/ 1 440 623.74 (jul-2026)');

insert into valorizaciones (tenant_id, proyecto_id, numero, descripcion, monto, moneda, estado, fecha_presentacion, fecha_pago, observaciones, creado_por)
select p.tenant_id, p.id, v.numero, 'Valorización N° ' || lpad(v.numero::text, 2, '0') || ' · ' || to_char(v.fecha, 'TMMonth YYYY'),
       v.monto, 'PEN', v.estado, v.fecha, v.fecha_pago,
       concat_ws(' · ', 'Cargada el 12/10/2026 desde RESUMEN PROYECTOS.xlsx (hoja "' || v.hoja || '")', 'fechas aproximadas al día 1 del mes', v.nota),
       'semana2-ingresos'
  from _val v join proyectos p on p.codigo = v.proy and p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
on conflict (proyecto_id, numero) do nothing;

-- 2) filas del Excel de flujo con CDC mal escrito → centro de costo real (el trigger pone el proyecto)
update flujo_compromisos f set centro_costo_id = cc.id
  from (values ('GCUZCOAMBU', 'GCUSCOAMBU'), ('MPCUSCOPNP', 'MPCUSCOSERENAZGO'), ('MSS', 'MSS-30')) a(alias, codigo)
  join centros_costo cc on cc.codigo = a.codigo and cc.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
 where f.fuente = 'excel' and f.centro_costo_id is null and f.cdc = a.alias;

-- 3) las valorizaciones nuevas se resincronizan contra el Excel ya enlazado (dedupe ±8 % por proyecto)
select valorizaciones_resincronizar() as resincronizadas;

-- 4) cobrado por proyecto según el Seguimiento del 05.10.26 (Monto Cobrado CIPRL)
update proyectos p set monto_cobrado = s.cobrado
  from (values ('01CUSMUN24', 6009107.76), ('02CUSAMB25', 35888370.21), ('03HNCPNP25', 6795941.41), ('04LORBOM25', 16543724.49),
               ('05AMAPNP25', 1106696.85), ('06CUSPNP25', 10983021.38), ('07CUSHAM26', 0)) s(codigo, cobrado)
 where p.codigo = s.codigo and p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and coalesce(p.monto_cobrado, -1) <> s.cobrado;

-- contadores
select 'valorizaciones' k, (select jsonb_build_object('total', count(*), 'ejemplo_restantes', count(*) filter (where creado_por = 'admin@kesa.com'), 'nuevas', count(*) filter (where creado_por = 'semana2-ingresos'), 'pagadas', count(*) filter (where estado = 'pagada'), 'monto_pagadas', sum(monto) filter (where estado = 'pagada'), 'monto_presentadas', sum(monto) filter (where estado = 'presentada'))::text from valorizaciones) v
union all select 'compromisos_erp_cobrar', (select jsonb_agg(x)::text from (select p.codigo, f.referencia_doc, f.estado_pago, f.monto_presupuestado, f.mes_vencimiento from flujo_compromisos f join proyectos p on p.id = f.proyecto_id where f.valorizacion_id is not null order by 1, 2) x)
union all select 'flujo_excel_cdc_sin_cc', (select jsonb_agg(x)::text from (select cdc, count(*) n from flujo_compromisos where fuente = 'excel' and centro_costo_id is null group by 1 order by 2 desc) x)
union all select 'flujo_cobrar_sin_proyecto', (select count(*)::text from flujo_compromisos where sentido = 'cobrar' and proyecto_id is null)
union all select 'cadena', (select jsonb_agg(x)::text from (select p.codigo, round(c.valorizado) valorizado, c.valorizaciones n, round(c.cobrado) cobrado, round(c.por_cobrar) por_cobrar, round(c.cobrado_registrado) seguimiento from proyectos p cross join lateral proyecto_cadena(p.id) c where p.estado = 'en_ejecucion' and p.modalidad = 'oxi' order by 1) x);
rollback;
