-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260622175554  name: oc_migration_schema

ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS centro_costo_id UUID REFERENCES centros_costo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_texto TEXT,
  ADD COLUMN IF NOT EXISTS detraccion JSONB,
  ADD COLUMN IF NOT EXISTS banco_seleccionado TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_seleccionada JSONB,
  ADD COLUMN IF NOT EXISTS comprador_email TEXT,
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT;

CREATE INDEX IF NOT EXISTS idx_oc_centro_costo ON ordenes_compra(centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_oc_migrado ON ordenes_compra(migrado_de);

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT;

ALTER TABLE centros_costo
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT,
  ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL;
