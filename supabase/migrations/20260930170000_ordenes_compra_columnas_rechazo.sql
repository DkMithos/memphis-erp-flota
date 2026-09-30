-- El rechazo de una OC escribía motivo_rechazo/rechazado_por/rechazado_en, pero las
-- columnas nunca existieron en ordenes_compra (sí en cotizaciones): PostgREST devolvía
-- "Could not find the 'motivo_rechazo' column of 'ordenes_compra' in the schema cache".
alter table public.ordenes_compra
  add column if not exists motivo_rechazo text,
  add column if not exists rechazado_por uuid references auth.users(id),
  add column if not exists rechazado_en timestamptz;
comment on column public.ordenes_compra.motivo_rechazo is 'Motivo del rechazo (mínimo 30 caracteres, validado en el ERP)';
notify pgrst, 'reload schema';
