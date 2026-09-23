-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904203946  name: recuperar_precios_en_columna_unidad

-- En 85 ítems de requerimiento el campo `unidad` no trae una unidad sino un
-- número, y `costo_estimado_unitario` quedó vacío. Es el mismo corrimiento de
-- columna que ya apareció en el lugar de entrega ("I.G.V 18%") y en las
-- condiciones de pago ("SUBTOTAL").
--
-- Ejemplo: "DISCO DE FRENO DELANT." con cantidad 1 y unidad "434.19".
--
-- Se recupera lo inequívoco y se preserva lo dudoso; no se borra nada.

-- 1) Decimales y enteros de 3+ cifras: son precios. Se mueven a su columna.
update requerimiento_items
set costo_estimado_unitario = unidad::numeric,
    unidad = 'UND',
    observaciones = trim(both ' ·' from
      coalesce(observaciones, '') ||
      ' · [04/09/2026] El costo unitario estaba en la columna de unidad ("' || unidad || '"); se movió a su lugar.')
where (unidad ~ '^[0-9]+\.[0-9]+$' or unidad ~ '^[0-9]{3,}$')
  and (costo_estimado_unitario is null or costo_estimado_unitario = 0);

-- 2) Enteros cortos (1, 3, 5, 6, 8, 35, 50): pueden ser precio o un resto de
--    la migración. NO se decide por ellos: la unidad se normaliza para que el
--    desplegable funcione, y el valor original queda anotado para que Compras
--    lo revise.
update requerimiento_items
set observaciones = trim(both ' ·' from
      coalesce(observaciones, '') ||
      ' · [04/09/2026] REVISAR: la columna de unidad decía "' || unidad || '", que no es una unidad. Puede ser el costo unitario.'),
    unidad = 'UND'
where unidad ~ '^[0-9]+$'
  and (costo_estimado_unitario is null or costo_estimado_unitario = 0);

-- 3) Grafías de la misma unidad, en las tres tablas de ítems.
update requerimiento_items set unidad = 'UND'
  where upper(trim(unidad)) in ('UNID.', 'UND', 'UN', 'UNIDAD', 'UNID');
update cotizacion_items set unidad = 'UND'
  where upper(trim(unidad)) in ('UNID.', 'UND', 'UN', 'UNIDAD', 'UNID');
update orden_items set unidad = 'UND'
  where upper(trim(unidad)) in ('UNID.', 'UND', 'UN', 'UNIDAD', 'UNID');

update requerimiento_items set unidad = 'JUEGO' where upper(trim(unidad)) in ('JGO', 'JUEGO');
update cotizacion_items   set unidad = 'JUEGO' where upper(trim(unidad)) in ('JGO', 'JUEGO');
update orden_items        set unidad = 'JUEGO' where upper(trim(unidad)) in ('JGO', 'JUEGO');

update requerimiento_items set unidad = upper(trim(unidad)) where unidad <> upper(trim(unidad));
update cotizacion_items   set unidad = upper(trim(unidad)) where unidad <> upper(trim(unidad));
update orden_items        set unidad = upper(trim(unidad)) where unidad <> upper(trim(unidad));
