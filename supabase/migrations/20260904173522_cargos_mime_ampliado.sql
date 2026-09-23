-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904173522  name: cargos_mime_ampliado

-- En la carpeta de cargos no todo es PDF: hay hojas de cálculo de respaldo
-- (por ejemplo "Calculo luego de aprobación DE.xlsx"). Se aceptan también
-- Excel y Word para no dejar nada afuera al importar.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
]
where id = 'cargos-fianzas';
