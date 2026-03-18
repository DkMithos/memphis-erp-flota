-- =============================================================================
-- GPS Posiciones — tabla de posiciones GPS por vehículo
-- Separada del schema inicial para no romper migraciones existentes
-- =============================================================================

CREATE TABLE IF NOT EXISTS gps_posiciones (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  vehiculo_id       UUID NOT NULL REFERENCES vehiculos(id),
  dispositivo_id    UUID REFERENCES gps_dispositivos(id),
  latitud           NUMERIC(10,7) NOT NULL,
  longitud          NUMERIC(10,7) NOT NULL,
  velocidad         NUMERIC(8,2),
  rumbo             NUMERIC(6,2),
  altitud           NUMERIC(8,2),
  odometro          NUMERIC(12,2),
  evento            TEXT,
  ignicion          BOOLEAN,
  bateria_voltaje   NUMERIC(5,2),
  satelites         INTEGER,
  precision_gps     NUMERIC(5,2),
  direccion_texto   TEXT,
  fecha_dispositivo TIMESTAMPTZ NOT NULL,
  recibido_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gps_posiciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ti_gps_posiciones"
  ON gps_posiciones
  USING (tenant_id = auth_tenant_id());

CREATE INDEX IF NOT EXISTS idx_gps_pos_vehiculo
  ON gps_posiciones(vehiculo_id, fecha_dispositivo DESC);

CREATE INDEX IF NOT EXISTS idx_gps_pos_tenant
  ON gps_posiciones(tenant_id, fecha_dispositivo DESC);
