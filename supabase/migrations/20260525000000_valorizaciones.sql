-- Valorizaciones: hitos de facturación y conformidad por proyecto
-- Memphis ERP - Fase 2

CREATE TABLE IF NOT EXISTS valorizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES fases_proyecto(id) ON DELETE SET NULL,
  numero INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','presentada','aprobada','rechazada','facturada','pagada')),
  fecha_presentacion DATE,
  fecha_aprobacion DATE,
  fecha_pago DATE,
  observaciones TEXT,
  conformidad_parcial BOOLEAN DEFAULT FALSE,
  porcentaje_conformidad NUMERIC(5,2),
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_valorizaciones_proyecto ON valorizaciones(proyecto_id);
CREATE INDEX idx_valorizaciones_tenant ON valorizaciones(tenant_id);
CREATE UNIQUE INDEX idx_valorizaciones_numero_unico ON valorizaciones(proyecto_id, numero);

-- RLS
ALTER TABLE valorizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY valorizaciones_tenant ON valorizaciones
  USING (tenant_id = auth_tenant_id());

-- Columnas extra en proyectos para fase 2 (si no existen)
DO $$ BEGIN
  ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS modalidad TEXT;
  ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS entidad_cliente TEXT;
  ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS region TEXT;
  ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS monto_contrato NUMERIC(14,2);
  ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS monto_adenda NUMERIC(14,2);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
