-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260807172207  name: proyectos_excel_items_valorizaciones


-- N27 puntos 5/7/9: el espejo del Excel ahora guarda el DETALLE de items (con su
-- estatus) y de VALORIZACIONES por proyecto, mas agregados listos para la UI:
--   * avance por CANTIDAD  = items_entregados / items
--   * box de valorizacion  = monto acumulado + cantidad + ultima fecha
-- El detalle fino va en datos_raw->'items_detalle' / ->'valorizaciones'.
ALTER TABLE public.proyectos_excel_sync
  ADD COLUMN IF NOT EXISTS items_entregados integer,
  ADD COLUMN IF NOT EXISTS valorizaciones_cantidad integer,
  ADD COLUMN IF NOT EXISTS valorizaciones_monto numeric,
  ADD COLUMN IF NOT EXISTS valorizacion_ultima_fecha date;

COMMENT ON COLUMN public.proyectos_excel_sync.items_entregados IS
  'Items con estatus ENTREGADO/RECEPCIONADO (avance por cantidad). Fuente: bloque ITEMS del Excel.';
COMMENT ON COLUMN public.proyectos_excel_sync.valorizaciones_monto IS
  'Suma de importes del bloque VALORIZACIONES del Excel.';

