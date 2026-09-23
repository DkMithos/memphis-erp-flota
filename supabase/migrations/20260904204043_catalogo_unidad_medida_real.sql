-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904204043  name: catalogo_unidad_medida_real

-- El catálogo de unidades traía nombres largos ("Unidad", "Kilogramo (kg)")
-- que nadie usa: en 3,923 ítems reales solo aparecen 7 unidades, y en la forma
-- corta que escribe Compras. Se alinea el catálogo con lo que de verdad se usa
-- y se añaden las de uso previsible.
--
-- Las anteriores se DESACTIVAN, no se borran.

update catalogos set activo = false where tipo = 'unidad_medida';

insert into catalogos (tenant_id, tipo, key, label, orden, activo, es_sistema)
select t.id, 'unidad_medida', v.key, v.label, v.orden, true, false
from tenants t
cross join (values
  ('und',    'UND',     1),
  ('juego',  'JUEGO',   2),
  ('caja',   'CAJA',    3),
  ('paq',    'PAQ',     4),
  ('par',    'PAR',     5),
  ('glb',    'GLB',     6),
  ('horas',  'HORAS',   7),
  ('servicio','SERVICIO', 8),
  ('kg',     'KG',      9),
  ('gr',     'GR',     10),
  ('m',      'M',      11),
  ('m2',     'M2',     12),
  ('m3',     'M3',     13),
  ('lt',     'LT',     14),
  ('gal',    'GAL',    15),
  ('rollo',  'ROLLO',  16),
  ('mes',    'MES',    17)
) as v(key, label, orden)
on conflict do nothing;

update catalogos c
set activo = true, label = v.label, orden = v.orden
from (values
  ('und','UND',1), ('juego','JUEGO',2), ('caja','CAJA',3), ('paq','PAQ',4),
  ('par','PAR',5), ('glb','GLB',6), ('horas','HORAS',7), ('servicio','SERVICIO',8),
  ('kg','KG',9), ('gr','GR',10), ('m','M',11), ('m2','M2',12), ('m3','M3',13),
  ('lt','LT',14), ('gal','GAL',15), ('rollo','ROLLO',16), ('mes','MES',17)
) as v(key, label, orden)
where c.tipo = 'unidad_medida' and c.key = v.key;
