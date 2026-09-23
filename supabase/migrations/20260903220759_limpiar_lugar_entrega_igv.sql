-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903220759  name: limpiar_lugar_entrega_igv

-- 10 órdenes del Excel 2024 quedaron con "I.G.V 18%" en el lugar de entrega.
--
-- No es un dato de entrega: es una etiqueta de la hoja de origen que cayó en la
-- columna equivocada al migrar. Se comprobó que el resto de la fila está bien
-- (subtotal + IGV = total cuadra en las 10, y condiciones y observaciones son
-- coherentes), así que el corrimiento afectó solo a esta columna.
--
-- Se pasa a NULL y no a otro texto: el Excel de origen nunca tuvo el lugar de
-- entrega de estas órdenes, y "no consta" es lo cierto. El valor anterior queda
-- en observaciones para no perder el rastro de la corrección.

update ordenes_compra
set lugar_entrega = null,
    observaciones = trim(both ' ·' from
      coalesce(observaciones, '') ||
      ' · [03/09/2026] El lugar de entrega decía "I.G.V 18%", etiqueta mal migrada del Excel 2024; se dejó vacío.')
where upper(trim(lugar_entrega)) like 'I.G.V%'
   or upper(trim(lugar_entrega)) like 'IGV%';
