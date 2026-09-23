-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903155109  name: catalogo_tipo_doc_caja

-- Catálogo del tipo de documento de un gasto de caja chica.
--
-- Hasta ahora el campo "Categoría" del formulario era texto libre, así que
-- cada persona podía escribir "Factura", "FACTURA" o "factura " y fragmentar
-- el dato. Los valores de abajo son EXACTAMENTE los que ya usa Administración
-- en las 978 filas migradas, para no inventar un catálogo nuevo.
--
-- Se omite 'MIGRADO' a propósito: es un resto de la migración, no un tipo de
-- documento real. Los 19 gastos que lo tienen se dejan como están (P2: no se
-- pierde información) y quedan visibles para que Administración los reclasifique.

insert into catalogos (tenant_id, tipo, key, label, orden, activo, es_sistema)
select t.id, 'tipo_doc_caja', v.key, v.label, v.orden, true, false
from tenants t
cross join (values
  ('factura',                'FACTURA',                 1),
  ('boleta',                 'BOLETA',                  2),
  ('recibo',                 'RECIBO',                  3),
  ('recibo_honorarios',      'RECIBO POR HONORARIO',    4),
  ('planilla_movilidad',     'PLANILLA DE MOVILIDAD',   5),
  ('autorizacion_viaje',     'AUTORIZACIÓN DE VIAJE',   6),
  ('rendicion_viaticos',     'RENDICIÓN DE VIÁTICOS',   7),
  ('documento_sin_numero',   'DOCUMENTO SIN NUMERO',    8),
  ('sin_documento',          'SIN DOCUMENTO',           9)
) as v(key, label, orden)
where not exists (
  select 1 from catalogos c
  where c.tenant_id = t.id and c.tipo = 'tipo_doc_caja' and c.key = v.key
);
