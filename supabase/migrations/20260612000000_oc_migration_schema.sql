-- ===========================================================================
-- Migración oc-system → ERP · Fase 1 (esquema)
-- Campos necesarios para recibir las órdenes del portal legado.
-- Todo aditivo y nullable → seguro y reversible.
-- ===========================================================================

-- centro_costo_id en ordenes_compra: el PUENTE hacia el proyecto (modelo
-- proyecto-céntrico). En oc-system la OC tiene `centroCosto` (texto); aquí se
-- resuelve a la FK del catálogo centros_costo.
ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS centro_costo_id UUID REFERENCES centros_costo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_texto TEXT,          -- valor original de oc-system (trazabilidad)
  ADD COLUMN IF NOT EXISTS detraccion JSONB,                 -- objeto detracción del legado
  ADD COLUMN IF NOT EXISTS banco_seleccionado TEXT,          -- banco de pago elegido en la OC
  ADD COLUMN IF NOT EXISTS cuenta_seleccionada JSONB,        -- cuenta bancaria elegida
  ADD COLUMN IF NOT EXISTS comprador_email TEXT,             -- comprador (oc-system guarda email, no UUID)
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,                  -- marcador de lote (reversibilidad)
  ADD COLUMN IF NOT EXISTS migrado_id TEXT;                  -- _id original en Firestore

CREATE INDEX IF NOT EXISTS idx_oc_centro_costo ON ordenes_compra(centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_oc_migrado ON ordenes_compra(migrado_de);

-- Marcadores de migración en catálogos (reversibilidad + trazabilidad)
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT;

ALTER TABLE centros_costo
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT,
  ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL;
