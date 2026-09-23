-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904204023  name: normalizar_unidad_cotizacion_items

-- En `cotizacion_items` quedaban 61 filas con un número en la columna `unidad`
-- ("1", "5", "390"…). A diferencia de los requerimientos, aquí **el precio sí
-- está correctamente registrado**: las 61 tienen `precio_unitario > 0`.
--
-- Es decir, ese número no guarda información que se pueda perder: es residuo de
-- la migración en una columna que debía llevar la unidad. Se normaliza a UND.
--
-- La tabla no tiene columna de observaciones donde dejar la nota, pero el dato
-- de valor (precio, cantidad, descuento, total) está intacto y no se toca.

update cotizacion_items
set unidad = 'UND'
where unidad ~ '^[0-9]';
