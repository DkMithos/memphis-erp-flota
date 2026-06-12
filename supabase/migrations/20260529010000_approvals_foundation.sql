-- ===========================================================================
-- Approvals (two-way Teams) — Fundación de datos
-- - flujo_aprobacion: config de niveles por monto (migrada de localStorage a BD)
-- - aprobaciones: seguimiento de cada solicitud (vincula ERP ↔ Microsoft Approvals)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS flujo_aprobacion (
  tenant_id       UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  config          JSONB NOT NULL,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por TEXT
);
ALTER TABLE flujo_aprobacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flujo_aprobacion: tenant completo" ON flujo_aprobacion
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

INSERT INTO flujo_aprobacion (tenant_id, config, actualizado_por)
SELECT 'e4b16a80-8500-418e-afaa-0e976b7d9b13', '{
  "tipoCambioRef": 3.75,
  "niveles": [
    {"nivel":1,"label":"Aprobacion Estandar","descripcion":"Montos menores al umbral 1 - 1 aprobador","montoMin":0,"montoMax":10000,"roles":["Gerencia","Administrador"],"aprobadoresRequeridos":1},
    {"nivel":2,"label":"Aprobacion Gerencial","descripcion":"Montos intermedios - 2 aprobadores","montoMin":10000,"montoMax":30000,"roles":["Gerencia","Administrador"],"aprobadoresRequeridos":2},
    {"nivel":3,"label":"Alta Direccion","descripcion":"Montos mayores al umbral 2","montoMin":30000,"montoMax":null,"roles":["Administrador"],"aprobadoresRequeridos":3}
  ]
}'::jsonb, 'sistema'
WHERE NOT EXISTS (SELECT 1 FROM flujo_aprobacion WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13');

CREATE TABLE IF NOT EXISTS aprobaciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  modulo           TEXT NOT NULL,
  entidad_id       UUID NOT NULL,
  numero           TEXT,
  titulo           TEXT,
  monto            NUMERIC(14,2),
  moneda           TEXT NOT NULL DEFAULT 'PEN',
  nivel            INT,
  roles_requeridos TEXT[],
  aprobadores      TEXT[],
  solicitante      TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  aprobador        TEXT,
  comentario       TEXT,
  externo_id       TEXT,
  resuelto_en      TIMESTAMPTZ,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE aprobaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aprobaciones: tenant completo" ON aprobaciones
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE INDEX IF NOT EXISTS idx_aprobaciones_tenant ON aprobaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_entidad ON aprobaciones(modulo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_estado ON aprobaciones(estado);
