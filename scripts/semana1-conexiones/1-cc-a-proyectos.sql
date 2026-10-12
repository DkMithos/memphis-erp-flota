-- Semana 1 del plan de carga (2026-10-12) · Paso 1: cada centro de costo de proyecto apunta a su proyecto.
-- Fuente de los nombres: "PROYECTOS - TOTALES.xlsx › Status Proyectos" (Operaciones), carpetas de 02/03 en General - PROYECTOS,
-- y las descripciones de los pagos históricos del propio CDC. Los proyectos que no existían (liquidados, renting, ideas) se crean
-- con el código del CDC para que la trazabilidad sea directa. Los nombres marcados "inferido" deben confirmarse con Operaciones.
-- Se ejecuta primero con ROLLBACK (mirar los contadores) y luego con COMMIT.
begin;
create temp table _mapa (cc text, proy text, nombre text, entidad text, region text, estado text, fase text, modalidad text, situacion text, monto numeric, descripcion text) on commit drop;
insert into _mapa values
 ('GLORETOPNP',    'GLORETOPNP',  'GORE LORETO - PNP (20 camionetas + 30 motos)',             'GORE LORETO',       'Loreto',   'completado',    'post_ejecucion', 'oxi',  null, 6772606.20, 'Consorcio Memphis Selva I (Memphis 90 %, Promotora Génesis 10 %). Liquidado.'),
 ('GLORETOSC',     'GLORETOSC',   'GORE LORETO - SEGURIDAD CIUDADANA (29 camionetas + 43 motos)','GORE LORETO',     'Loreto',   'completado',    'post_ejecucion', 'oxi',  null, 9580435.78, 'Consorcio Memphis Selva I. Liquidado.'),
 ('CMSELVAI',      'CMSELVAI',    'CONSORCIO MEMPHIS SELVA I (gastos comunes Loreto PNP y SC)','GORE LORETO',      'Loreto',   'completado',    'post_ejecucion', 'otro', null, null,       'Gastos del consorcio que no se separaron entre Loreto PNP y Loreto SC (asesorías, utilidades, notaría).'),
 ('GLORETOAMB',    'GLORETOAMB',  'GORE LORETO - AMBULANCIAS (9)',                            'GORE LORETO',       'Loreto',   'completado',    'post_ejecucion', 'oxi',  null, 4809889.02, 'Liquidación entregada el 08/05. CDC también escrito como LORETOAMB.'),
 ('LORETOAMB',     'GLORETOAMB',  null, null, null, null, null, null, null, null, null),
 ('MSS-30',        'MSS-30',      'MUNICIPALIDAD DE SANTIAGO DE SURCO - Contrato 030-2022 (flota de serenazgo)', 'MUNICIPALIDAD DE SANTIAGO DE SURCO', 'Lima', 'en_ejecucion', 'ejecucion', 'otro', null, null, 'Nombre inferido del CDC, del contrato 030-2022 (carpeta de Contabilidad 2026) y de los pagos (baterías, llantas, flota JOY). Confirmar con Operaciones.'),
 ('MDI',           'MDI',         'MDI - Municipalidad Distrital de Independencia (flota de serenazgo)', 'MUNICIPALIDAD DISTRITAL DE INDEPENDENCIA', 'Lima', 'en_ejecucion', 'ejecucion', 'otro', null, null, 'Nombre inferido (chips de flota, mantenimiento, Autofondo/Perumotor; órdenes de embargo a la Municipalidad de Independencia). Confirmar con Operaciones.'),
 ('MPSANMIGUEL',   'MPSANMIGUEL', 'MP SAN MIGUEL - SERENAZGO',                                'MUNICIPALIDAD DE SAN MIGUEL', 'Lima', 'liquidacion', 'post_ejecucion', 'otro', 'arbitraje', null, 'Fianzas CESCE/Secrex y ejecución de laudo. CDC también escrito como MUNSMSERENAZGO.'),
 ('MUNSMSERENAZGO','MPSANMIGUEL', null, null, null, null, null, null, null, null, null),
 ('INMPAN',        'INMPAN',      'INMUEBLES PANAMERICANA - camioneta en renting',            'INMUEBLES PANAMERICANA', 'Lima', 'completado', 'post_ejecucion', 'otro', null, null, 'Camioneta Chevrolet Colorado equipada (GPS, defensas) entregada en renting.'),
 ('C-OXI',         'C-OXI',       'CORPORACIÓN OXI - arrendamiento de vehículos',             'CORPORACIÓN OXI',   'Lima',     'completado',    'post_ejecucion', 'otro', null, null,       'Arrendamiento de vehículos Chevrolet a OXI (cuotas, SOAT, mantenimiento).'),
 ('GCUSCOBOM',     'GCUSCOBOM',   'GORE CUSCO - BOMBEROS',                                    'GORE CUSCO',        'Cusco',    'planificacion', 'idea',           'oxi',  null, 26682430.14, 'Idea (CUI 2715753).'),
 ('GSANMARTINAMB', 'GSANMARTINAMB','GORE SAN MARTÍN - AMBULANCIAS',                           'GORE SAN MARTÍN',   'San Martín','planificacion','idea',           'oxi',  null, null,       'Idea.'),
 ('GSANMARTINBOMB','SMARTBOM',    null, null, null, null, null, null, null, null, null),
 ('GICAAMB18',     'GICAAMB18',   'GORE ICA - AMBULANCIAS (18)',                              'GORE ICA',          'Ica',      'planificacion', 'idea',           'oxi',  null, null,       'Idea.'),
 ('GICAAMB27',     'GICAAMB27',   'GORE ICA - AMBULANCIAS (27)',                              'GORE ICA',          'Ica',      'planificacion', 'idea',           'oxi',  null, null,       'Idea.'),
 ('GAMAZONAMB',    'GAMAZONAMB',  'GORE AMAZONAS - AMBULANCIAS RURALES (26)',                 'GORE AMAZONAS',     'Amazonas', 'planificacion', 'idea',           'oxi',  null, null,       'Idea (TDR enviado 29/04).'),
 ('GANCASHAMB',    'GANCASHAMB',  'GORE ÁNCASH - AMBULANCIAS (41)',                           'GORE ÁNCASH',       'Áncash',   'planificacion', 'idea',           'oxi',  null, null,       'Idea; viáticos de prospección marzo-abril 2025.'),
 ('GANCASHCOER',   'GANCASHCOER', 'GORE ÁNCASH - COER',                                       'GORE ÁNCASH',       'Áncash',   'planificacion', 'idea',           'oxi',  null, null,       'Idea (12X COER Áncash).'),
 ('GAREQUIPA',     'GAREQUIPA',   'GORE AREQUIPA - PATRULLEROS (100)',                        'GORE AREQUIPA',     'Arequipa', 'cancelado',     'idea',           'oxi',  null, null,       'Descartado: presupuesto bajo.'),
 ('GCAJAMARCA',    'GCAJAMARCA',  'GORE CAJAMARCA (por evaluar)',                             'GORE CAJAMARCA',    'Cajamarca','planificacion', 'idea',           'oxi',  null, null,       'Pendiente de revisión de factibilidad.'),
 ('GPASCO',        'GPASCO',      'GORE PASCO (idea)',                                        'GORE PASCO',        'Pasco',    'planificacion', 'idea',           'oxi',  null, null,       'Idea sin ficha en el Status de proyectos.'),
 ('GUCAYALI',      'GUCAYALI',    'GORE UCAYALI (idea)',                                      'GORE UCAYALI',      'Ucayali',  'planificacion', 'idea',           'oxi',  null, null,       'Idea sin ficha en el Status de proyectos.'),
 ('GLOREBUSES',    'GLOREBUSES',  'GORE LORETO - BUSES (30)',                                 'GORE LORETO',       'Loreto',   'planificacion', 'idea',           'oxi',  null, null,       'Idea (presentación 12/05).'),
 ('GLORETOHIDRO',  'GLORETOHIDRO','GORE LORETO - HIDROAMBULANCIAS (12)',                      'GORE LORETO',       'Loreto',   'planificacion', 'idea',           'oxi',  null, null,       'Idea.'),
 ('GLORETOMAQ',    'GLORETOMAQ',  'GORE LORETO - MAQUINARIA',                                 'GORE LORETO',       'Loreto',   'planificacion', 'idea',           'oxi',  null, null,       'Idea.'),
 ('GLORETOHOSP',   'LORMOVS',     null, null, null, null, null, null, null, null, null),
 ('GLORETOHOSPM',  'LORMOVS',     null, null, null, null, null, null, null, null, null),
 ('MGUERRABUS',    'MGUERRABUS',  'MARINA DE GUERRA - BUSES (40 urbanos + 20 interprovinciales)', 'MARINA DE GUERRA DEL PERÚ', 'Lima', 'planificacion', 'idea', 'otro', null, null, 'Idea.'),
 ('MMAJESPNP',     'MMAJESPNP',   'MUNICIPALIDAD DE MAJES - PATRULLEROS, MOTOS Y BUS',        'MUNICIPALIDAD DE MAJES', 'Arequipa', 'planificacion', 'idea',        'oxi',  null, null,       'Idea (cotización enviada 05/05).'),
 ('MPLIMAATU',     'MPLIMAATU',   'ATU LIMA - VIDEOVIGILANCIA VEHICULAR (8,100 sistemas)',    'ATU - LIMA',        'Lima',     'planificacion', 'actos_previos',  'otro', null, null,       'En convocatoria: alquiler de sistemas de video para vehículos.');

-- 1) proyectos nuevos (solo los que no existen)
insert into proyectos (tenant_id, codigo, nombre, descripcion, tipo, estado, prioridad, moneda, modalidad, entidad_cliente, region, monto_contrato, fase, situacion, creado_por)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13', m.proy, m.nombre, m.descripcion, 'cliente', m.estado, 'media', 'PEN', m.modalidad, m.entidad, m.region, m.monto, m.fase, m.situacion, 'semana1-conexiones'
  from _mapa m
 where m.nombre is not null and not exists (select 1 from proyectos p where p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and p.codigo = m.proy);

-- 2) el CDC apunta al proyecto y pasa al área PROYECTOS si no tenía área
update centros_costo cc set proyecto_id = p.id, area = coalesce(cc.area, 'PROYECTOS')
  from _mapa m join proyectos p on p.codigo = m.proy and p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
 where cc.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and cc.codigo = m.cc and cc.proyecto_id is null;

-- 3) propagar a lo ya cargado: pagos históricos, compromisos (Excel y ERP), facturas con CDC
update transacciones t set proyecto_id = cc.proyecto_id
  from centros_costo cc where t.centro_costo_id = cc.id and t.proyecto_id is null and cc.proyecto_id is not null;
update flujo_compromisos f set proyecto_id = cc.proyecto_id, area = case when f.area is null or f.area = 'ADMINISTRACION' then 'PROYECTOS' else f.area end
  from centros_costo cc where f.centro_costo_id = cc.id and f.proyecto_id is null and cc.proyecto_id is not null;
select set_config('app.sin_asiento', '1', true);
update comprobantes_pago c set proyecto_id = cc.proyecto_id
  from centros_costo cc where c.centro_costo_id = cc.id and c.proyecto_id is null and cc.proyecto_id is not null;

-- contadores
select 'proyectos_nuevos' k, (select count(*) from proyectos where creado_por = 'semana1-conexiones')::text v
union all select 'cc_con_proyecto', (select count(*) from centros_costo where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and proyecto_id is not null)::text
union all select 'cc_sin_proyecto', (select string_agg(codigo, ', ' order by codigo) from centros_costo where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and proyecto_id is null)
union all select 'trx_hist_con_proyecto', (select jsonb_build_object('total', count(*), 'con_proyecto', count(proyecto_id), 'soles_con_proyecto', round(sum(monto_soles) filter (where proyecto_id is not null)))::text from transacciones where referencia_tipo = 'historico_contabilidad')
union all select 'flujo_con_proyecto', (select jsonb_build_object('excel', count(*) filter (where fuente = 'excel' and proyecto_id is not null), 'erp', count(*) filter (where fuente = 'erp' and proyecto_id is not null))::text from flujo_compromisos)
union all select 'gasto_pagado_por_proyecto_top', (select jsonb_agg(x) from (select p.codigo, round(sum(t.monto_soles)) soles, count(*) n from transacciones t join proyectos p on p.id = t.proyecto_id where t.referencia_tipo = 'historico_contabilidad' group by p.codigo order by 2 desc limit 12) x)::text;
rollback;
