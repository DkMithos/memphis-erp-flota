-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903211503  name: catalogos_lugar_entrega_y_condiciones

-- Catálogos para cerrar la entrada de texto libre en Órdenes de Compra.
--
-- Hoy `condiciones_pago` tiene 108 valores distintos en 1,297 órdenes y
-- `lugar_entrega` tiene 125. "30 días" está escrito de seis formas y
-- "SEGÚN COORDINADO" de cuatro.
--
-- El lugar de entrega es MIXTO (decisión de Kevin, 03/09): hay destinos que se
-- repiten y hay direcciones de obra que son únicas. Por eso el catálogo trae
-- los frecuentes y la UI ofrece "Otro" para escribir la dirección.

-- Lugares de entrega frecuentes, tomados de las órdenes reales.
insert into catalogos (tenant_id, tipo, key, label, orden, activo, es_sistema)
select t.id, 'lugar_entrega', v.key, v.label, v.orden, true, false
from tenants t
cross join (values
  ('ica',              'ICA',                       1),
  ('lima',             'LIMA',                      2),
  ('cusco',            'CUSCO',                     3),
  ('loreto',           'LORETO',                    4),
  ('iquitos',          'IQUITOS',                   5),
  ('comas',            'COMAS, LIMA',               6),
  ('oficina_central',  'OFICINA CENTRAL',           7),
  ('almacen_pp',       'ALMACÉN DE PUENTE PIEDRA',  8),
  ('segun_coordinado', 'SEGÚN COORDINADO',          9)
) as v(key, label, orden)
where not exists (
  select 1 from catalogos c
  where c.tenant_id = t.id and c.tipo = 'lugar_entrega' and c.key = v.key
);

-- Condiciones de pago que el equipo usa de verdad y no estaban en el catálogo.
-- No se fuerzan dentro de las 7 existentes: son condiciones distintas.
insert into catalogos (tenant_id, tipo, key, label, orden, activo, es_sistema)
select t.id, 'condicion_pago', v.key, v.label, v.orden, true, false
from tenants t
cross join (values
  ('adelantado', 'Pago por adelantado', 20),
  ('ciprl',      'CIPRL',               21),
  ('transferencia_contra_entrega', 'Transferencia contra entrega', 22)
) as v(key, label, orden)
where not exists (
  select 1 from catalogos c
  where c.tenant_id = t.id and c.tipo = 'condicion_pago' and c.key = v.key
);
