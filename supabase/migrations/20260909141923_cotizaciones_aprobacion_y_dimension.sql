-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260909141923  name: cotizaciones_aprobacion_y_dimension

-- El módulo de cotizaciones lee y escribe siete columnas que la tabla nunca
-- tuvo: aprobar reventaba con "Could not find the 'aprobado_en' column", y la
-- dimensión (proyecto / centro de costo) se leía siempre como null.
--
-- Se añaden con el mismo tipo y significado que en requerimientos_compra, para
-- que la trazabilidad de quién aprueba sea igual en los dos pasos de la cadena.
alter table cotizaciones
  add column if not exists aprobado_por    uuid references auth.users(id),
  add column if not exists aprobado_en     timestamptz,
  add column if not exists rechazado_por   uuid references auth.users(id),
  add column if not exists rechazado_en    timestamptz,
  add column if not exists motivo_rechazo  text,
  add column if not exists proyecto_id     uuid references proyectos(id),
  add column if not exists centro_costo_id uuid references centros_costo(id);

comment on column cotizaciones.aprobado_por is 'Usuario que aprobó la cotización (uuid, no correo).';

-- Las 225 migradas del legado llegaron como "recibida" y no traen aprobación:
-- se dejan como están, que es la verdad de lo que hay.
create index if not exists idx_cotizaciones_proyecto on cotizaciones(proyecto_id) where proyecto_id is not null;
