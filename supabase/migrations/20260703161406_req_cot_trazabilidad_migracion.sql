-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260703161406  name: req_cot_trazabilidad_migracion

ALTER TABLE requerimientos_compra ADD COLUMN IF NOT EXISTS migrado_de text;
ALTER TABLE requerimientos_compra ADD COLUMN IF NOT EXISTS migrado_id text;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS migrado_de text;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS migrado_id text;
