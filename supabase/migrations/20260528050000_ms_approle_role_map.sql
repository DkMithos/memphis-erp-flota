-- ===========================================================================
-- App Roles de Entra ID → roles del ERP
-- ms-user-sync lee los App Roles asignados al usuario en Azure (modo app-only)
-- y sincroniza usuarios_roles según este mapeo (value del App Role → rol_id).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ms_approle_role_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_role_value  TEXT NOT NULL,           -- value del App Role en Entra ID (ej. 'Compras')
  rol_id          UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, app_role_value, rol_id)
);

ALTER TABLE ms_approle_role_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ms_approle_role_map: tenant completo" ON ms_approle_role_map
  FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE INDEX IF NOT EXISTS idx_ms_approle_role_map_tenant ON ms_approle_role_map(tenant_id);

-- Seed: 6 App Roles que calzan exacto con roles del ERP (tenant Memphis Maquinarias)
INSERT INTO ms_approle_role_map (tenant_id, app_role_value, rol_id) VALUES
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Administrador',     'f8cbeb8f-8282-46e1-9219-e2611290ddd4'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Gerencia',          '8db8aa72-3bb8-46d7-bb7d-dbe43dfadf51'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Compras',           'b7bd3033-97f3-4829-bd3b-1a4e558af85c'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Tecnico_Flota',     '0c7e075f-fa06-4aa9-9195-5731beb5d87f'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Tecnico_Biomedico', '862fd1bc-e98c-4741-8b0a-c2cb0add07d5'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Operador',          '0df0ffce-8418-4349-add1-7cd430530c20')
ON CONFLICT (tenant_id, app_role_value, rol_id) DO NOTHING;
