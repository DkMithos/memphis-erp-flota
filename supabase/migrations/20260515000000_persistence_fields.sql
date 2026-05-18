-- ============================================================================
-- FASE 2: Columnas faltantes para persistencia completa
-- Aplicar manualmente en Supabase Dashboard → SQL Editor
-- ============================================================================

-- ─── EQUIPOS BIOMÉDICOS ─────────────────────────────────────────────────────
ALTER TABLE equipos_biomedicos
  ADD COLUMN IF NOT EXISTS especificaciones JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fecha_instalacion DATE,
  ADD COLUMN IF NOT EXISTS garantia_proveedor TEXT,
  ADD COLUMN IF NOT EXISTS garantia_fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- ─── COTIZACIONES ───────────────────────────────────────────────────────────
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprobado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rechazado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rechazado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

-- ─── ÓRDENES DE COMPRA ─────────────────────────────────────────────────────
ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS rechazado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rechazado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS en_ejecucion_desde TIMESTAMPTZ;

-- ─── PROVEEDORES ────────────────────────────────────────────────────────────
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS motivo_cambio_estado TEXT;

-- ─── VERIFICACIÓN ───────────────────────────────────────────────────────────
-- Verificar que las columnas se crearon correctamente:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'equipos_biomedicos' AND column_name IN ('especificaciones','fecha_instalacion','garantia_proveedor','garantia_fecha_inicio','observaciones');
