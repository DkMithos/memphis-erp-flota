-- ===========================================================================
-- SPRINT 1 GERENCIA: Tabla adendas_proyecto
-- Reemplaza el campo escalar monto_adenda por adendas individuales
-- ===========================================================================

CREATE TABLE IF NOT EXISTS adendas_proyecto (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  numero      INT  NOT NULL,                        -- Adenda N.o 1, 2, 3...
  descripcion TEXT NOT NULL DEFAULT '',
  monto       NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda      TEXT NOT NULL DEFAULT 'PEN',           -- PEN | USD
  fecha       DATE,
  documento_url TEXT,                                -- link al documento escaneado
  creado_por  UUID,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, proyecto_id, numero)
);

-- RLS
ALTER TABLE adendas_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adendas_proyecto: tenant completo" ON adendas_proyecto
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Índice para consultas frecuentes
CREATE INDEX idx_adendas_proyecto_proyecto ON adendas_proyecto(proyecto_id);
