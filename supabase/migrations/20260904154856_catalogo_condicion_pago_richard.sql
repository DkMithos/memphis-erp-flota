-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904154856  name: catalogo_condicion_pago_richard

-- El catálogo de condiciones de pago pasa a ser el vocabulario que definió
-- Richard al revisar las 108 grafías (04/09/2026). Son 13 valores.
--
-- Las opciones anteriores se DESACTIVAN, no se borran: hay órdenes históricas
-- que las usaron y desactivar conserva el rastro sin ofrecerlas al escribir.
--
-- "SEGÚN LO ACORDADO" es la salida para las condiciones compuestas. Richard
-- dejó dicho que en esos casos el detalle va en las observaciones de la orden.

update catalogos set activo = false
where tipo = 'condicion_pago';

insert into catalogos (tenant_id, tipo, key, label, orden, activo, es_sistema)
select t.id, 'condicion_pago', v.key, v.label, v.orden, true, false
from tenants t
cross join (values
  ('contado',       'AL CONTADO',           1),
  ('adelantado',    'PAGO POR ADELANTADO',  2),
  ('credito_7',     'CRÉDITO 7 DÍAS',       3),
  ('credito_15',    'CRÉDITO 15 DÍAS',      4),
  ('credito_21',    'CRÉDITO 21 DÍAS',      5),
  ('credito_30',    'CRÉDITO 30 DÍAS',      6),
  ('credito_45',    'CRÉDITO 45 DÍAS',      7),
  ('credito_60',    'CRÉDITO 60 DÍAS',      8),
  ('credito_90',    'CRÉDITO 90 DÍAS',      9),
  ('credito_120',   'CRÉDITO 120 DÍAS',    10),
  ('credito_150',   'CRÉDITO 150 DÍAS',    11),
  ('ciprl',         'CIPRL',               12),
  ('segun_acordado','SEGÚN LO ACORDADO',   13)
) as v(key, label, orden)
on conflict do nothing;

-- Si alguna key ya existía desactivada arriba, se reactiva con su etiqueta nueva.
update catalogos c
set activo = true, label = v.label, orden = v.orden
from (values
  ('contado','AL CONTADO',1), ('adelantado','PAGO POR ADELANTADO',2),
  ('credito_7','CRÉDITO 7 DÍAS',3), ('credito_15','CRÉDITO 15 DÍAS',4),
  ('credito_21','CRÉDITO 21 DÍAS',5), ('credito_30','CRÉDITO 30 DÍAS',6),
  ('credito_45','CRÉDITO 45 DÍAS',7), ('credito_60','CRÉDITO 60 DÍAS',8),
  ('credito_90','CRÉDITO 90 DÍAS',9), ('credito_120','CRÉDITO 120 DÍAS',10),
  ('credito_150','CRÉDITO 150 DÍAS',11), ('ciprl','CIPRL',12),
  ('segun_acordado','SEGÚN LO ACORDADO',13)
) as v(key, label, orden)
where c.tipo = 'condicion_pago' and c.key = v.key;
