-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260622213639  name: caja_chica_ingresos_y_marcadores_migracion

-- Tabla nueva: ingresos de caja chica (decisión: modelar cada ingreso, no agregar)
CREATE TABLE IF NOT EXISTS ingresos_caja_chica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  caja_id uuid NOT NULL REFERENCES cajas_chicas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  descripcion text NOT NULL,
  tipo text NOT NULL DEFAULT 'reembolso',   -- 'apertura' | 'reembolso' | 'otro'
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'PEN',
  fecha date,                                -- nullable: la apertura puede no traer fecha
  origen text,                               -- razón social / quién aporta
  comprobante_numero text,
  comprobante_tipo text,
  centro_costo text,
  estado text NOT NULL DEFAULT 'registrado',
  migrado_de text,
  migrado_id text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ingresos_caja_chica ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ti_ingresos_cc ON ingresos_caja_chica;
CREATE POLICY ti_ingresos_cc ON ingresos_caja_chica FOR ALL USING (tenant_id = auth_tenant_id());
CREATE INDEX IF NOT EXISTS idx_ing_caja ON ingresos_caja_chica(caja_id);
CREATE INDEX IF NOT EXISTS idx_ing_migrado ON ingresos_caja_chica(migrado_de);

-- Marcadores de migración (reversibilidad) en las tablas de caja existentes
ALTER TABLE cajas_chicas
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT;
ALTER TABLE gastos_caja_chica
  ADD COLUMN IF NOT EXISTS migrado_de TEXT,
  ADD COLUMN IF NOT EXISTS migrado_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cajas_migrado ON cajas_chicas(migrado_de);
CREATE INDEX IF NOT EXISTS idx_gastos_cc_migrado ON gastos_caja_chica(migrado_de);
