-- ===========================================================================
-- Fix creación de requerimientos + soporte de moneda
-- - creado_por es UUID (no email): el código guardaba el email → fallaba el INSERT.
--   Ahora creado_por = user.id y el email/nombre del solicitante van aparte.
-- - moneda: requerimientos ahora soportan PEN/USD (antes solo PEN implícito).
-- ===========================================================================

ALTER TABLE requerimientos_compra
  ADD COLUMN IF NOT EXISTS moneda             text NOT NULL DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS solicitante_email  text,
  ADD COLUMN IF NOT EXISTS solicitante_nombre text;
