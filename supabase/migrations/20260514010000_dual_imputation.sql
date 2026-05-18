-- ============================================================================
-- MIGRACIÓN: Imputación Dual (proyecto_id + centro_costo_id)
-- Agrega columnas FK nullable a tablas operativas
-- REFERENCIA — aplicar manualmente en Supabase Dashboard o CLI
-- ============================================================================

-- 1. Órdenes de Trabajo (flota)
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES centros_costo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ot_proyecto ON ordenes_trabajo(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ot_centro_costo ON ordenes_trabajo(centro_costo_id) WHERE centro_costo_id IS NOT NULL;

-- 2. Requerimientos de Compra
ALTER TABLE requerimientos_compra
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES centros_costo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_req_proyecto ON requerimientos_compra(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_req_centro_costo ON requerimientos_compra(centro_costo_id) WHERE centro_costo_id IS NOT NULL;

-- 3. Cotizaciones
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES centros_costo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cot_proyecto ON cotizaciones(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cot_centro_costo ON cotizaciones(centro_costo_id) WHERE centro_costo_id IS NOT NULL;

-- 4. Órdenes de Compra
ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES centros_costo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_oc_proyecto ON ordenes_compra(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oc_centro_costo ON ordenes_compra(centro_costo_id) WHERE centro_costo_id IS NOT NULL;

-- 5. Gastos de Caja Chica
ALTER TABLE gastos_caja_chica
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES centros_costo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gcc_proyecto ON gastos_caja_chica(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gcc_centro_costo ON gastos_caja_chica(centro_costo_id) WHERE centro_costo_id IS NOT NULL;

-- 6. Mantenimientos Biomédicos
ALTER TABLE mantenimientos_biomedicos
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES centros_costo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mb_proyecto ON mantenimientos_biomedicos(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mb_centro_costo ON mantenimientos_biomedicos(centro_costo_id) WHERE centro_costo_id IS NOT NULL;

-- 7. Transacciones (ya tiene centro_costo_id → solo agregar proyecto_id)
ALTER TABLE transacciones
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trx_proyecto ON transacciones(proyecto_id) WHERE proyecto_id IS NOT NULL;

-- 8. Presupuesto Líneas (ya tiene centro_costo_id → solo agregar proyecto_id)
ALTER TABLE presupuesto_lineas
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pl_proyecto ON presupuesto_lineas(proyecto_id) WHERE proyecto_id IS NOT NULL;

-- ============================================================================
-- NOTA: Las columnas son nullable para no romper registros existentes.
-- Los índices parciales (WHERE ... IS NOT NULL) optimizan queries filtradas.
-- ============================================================================
