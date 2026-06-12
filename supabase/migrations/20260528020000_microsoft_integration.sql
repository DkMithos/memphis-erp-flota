-- ===========================================================================
-- FASE 0 + FASE 1: Integración Microsoft 365
-- - ms_group_role_map: mapeo de grupos de Entra ID → roles del ERP (SSO)
-- - notificaciones_log: auditoría de notificaciones enviadas (Teams)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Mapeo grupo Entra ID → rol ERP (usado por ms-user-sync tras el SSO)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_group_role_map (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ms_group_id  TEXT NOT NULL,                 -- object ID del grupo en Entra ID
  ms_group_nombre TEXT,                        -- displayName del grupo (referencia humana)
  rol_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ms_group_id, rol_id)
);

ALTER TABLE ms_group_role_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ms_group_role_map: tenant completo" ON ms_group_role_map
  FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE INDEX IF NOT EXISTS idx_ms_group_role_map_tenant ON ms_group_role_map(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ms_group_role_map_group ON ms_group_role_map(ms_group_id);

-- ---------------------------------------------------------------------------
-- 2. Log de notificaciones (auditoría de envíos a Teams / futuros canales)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  canal         TEXT NOT NULL DEFAULT 'teams',   -- teams | email | push
  tipo          TEXT NOT NULL,                    -- OT_VENCIDA | OC_POR_APROBAR | ...
  destinatario  TEXT,                             -- email / id Teams / canal
  titulo        TEXT NOT NULL,
  cuerpo        TEXT,
  accion_url    TEXT,                             -- deep link al ERP
  estado        TEXT NOT NULL DEFAULT 'enviado',  -- enviado | error
  error_detalle TEXT,
  datos         JSONB,                            -- payload original del evento
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notificaciones_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificaciones_log: tenant completo" ON notificaciones_log
  FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE INDEX IF NOT EXISTS idx_notificaciones_log_tenant ON notificaciones_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_tipo ON notificaciones_log(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_creado ON notificaciones_log(creado_en DESC);
