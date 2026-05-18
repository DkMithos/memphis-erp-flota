-- =============================================================================
-- Memphis ERP — RBAC: Roles, Permisos y Asignaciones
-- Migración: 20260323010000_rbac_tables.sql
-- =============================================================================

-- =============================================================================
-- 1. TABLAS RBAC
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  es_sistema  BOOLEAN NOT NULL DEFAULT FALSE,  -- roles de sistema no se pueden borrar
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_en TIMESTAMPTZ,
  UNIQUE(tenant_id, nombre)
);

CREATE TABLE IF NOT EXISTS permisos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modulo      TEXT NOT NULL,   -- flota | biomedico | compras | proveedores | inventario | finanzas | crm | proyectos | admin
  accion      TEXT NOT NULL,   -- ver | crear | editar | eliminar | aprobar | exportar | gestionar_usuarios | gestionar_roles
  descripcion TEXT,
  UNIQUE(modulo, accion)
);

CREATE TABLE IF NOT EXISTS roles_permisos (
  rol_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios_roles (
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rol_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asignado_por UUID REFERENCES profiles(id),
  PRIMARY KEY (user_id, tenant_id, rol_id)
);

-- =============================================================================
-- 2. ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_user_id ON usuarios_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_tenant_id ON usuarios_roles(tenant_id);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;

-- Roles: cada tenant ve solo los suyos
CREATE POLICY "roles: tenant completo"
  ON roles FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Permisos: todos los usuarios autenticados pueden leerlos (son de sistema)
CREATE POLICY "permisos: lectura para autenticados"
  ON permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Roles_permisos: lectura para autenticados del mismo tenant
CREATE POLICY "roles_permisos: lectura para autenticados"
  ON roles_permisos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = roles_permisos.rol_id
        AND r.tenant_id = auth_tenant_id()
    )
  );

-- Usuarios_roles: cada tenant gestiona los suyos
CREATE POLICY "usuarios_roles: tenant completo"
  ON usuarios_roles FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- =============================================================================
-- 4. SEED DE PERMISOS BASE (tabla de sistema — igual para todos los tenants)
-- =============================================================================

INSERT INTO permisos (modulo, accion, descripcion) VALUES
  -- Flota
  ('flota', 'ver',      'Ver módulo de flota y vehículos'),
  ('flota', 'crear',    'Crear vehículos y órdenes de trabajo'),
  ('flota', 'editar',   'Editar vehículos y órdenes de trabajo'),
  ('flota', 'eliminar', 'Eliminar o anular registros de flota'),
  ('flota', 'aprobar',  'Aprobar órdenes de trabajo y presupuestos'),
  ('flota', 'exportar', 'Exportar reportes de flota'),
  -- Biomédico
  ('biomedico', 'ver',      'Ver módulo biomédico'),
  ('biomedico', 'crear',    'Crear equipos y mantenimientos biomédicos'),
  ('biomedico', 'editar',   'Editar equipos biomédicos'),
  ('biomedico', 'eliminar', 'Eliminar registros biomédicos'),
  ('biomedico', 'exportar', 'Exportar reportes biomédicos'),
  -- Compras
  ('compras', 'ver',      'Ver módulo de compras'),
  ('compras', 'crear',    'Crear requerimientos y cotizaciones'),
  ('compras', 'editar',   'Editar documentos de compra'),
  ('compras', 'eliminar', 'Anular documentos de compra'),
  ('compras', 'aprobar',  'Aprobar requerimientos y órdenes de compra'),
  ('compras', 'exportar', 'Exportar reportes de compras'),
  -- Proveedores
  ('proveedores', 'ver',      'Ver directorio de proveedores'),
  ('proveedores', 'crear',    'Crear proveedores'),
  ('proveedores', 'editar',   'Editar proveedores'),
  ('proveedores', 'eliminar', 'Eliminar proveedores'),
  ('proveedores', 'exportar', 'Exportar directorio de proveedores'),
  -- Inventario
  ('inventario', 'ver',      'Ver módulo de inventario'),
  ('inventario', 'crear',    'Crear artículos y movimientos'),
  ('inventario', 'editar',   'Editar inventario'),
  ('inventario', 'eliminar', 'Eliminar registros de inventario'),
  ('inventario', 'exportar', 'Exportar reportes de inventario'),
  -- Finanzas
  ('finanzas', 'ver',      'Ver módulo financiero'),
  ('finanzas', 'crear',    'Crear transacciones y presupuestos'),
  ('finanzas', 'editar',   'Editar transacciones'),
  ('finanzas', 'eliminar', 'Eliminar transacciones'),
  ('finanzas', 'aprobar',  'Aprobar pagos y presupuestos'),
  ('finanzas', 'exportar', 'Exportar reportes financieros'),
  -- CRM
  ('crm', 'ver',      'Ver módulo CRM'),
  ('crm', 'crear',    'Crear clientes y oportunidades'),
  ('crm', 'editar',   'Editar CRM'),
  ('crm', 'eliminar', 'Eliminar registros CRM'),
  ('crm', 'exportar', 'Exportar reportes CRM'),
  -- Proyectos
  ('proyectos', 'ver',      'Ver módulo de proyectos'),
  ('proyectos', 'crear',    'Crear proyectos y tareas'),
  ('proyectos', 'editar',   'Editar proyectos'),
  ('proyectos', 'eliminar', 'Eliminar proyectos'),
  ('proyectos', 'exportar', 'Exportar reportes de proyectos'),
  -- Admin
  ('admin', 'ver',               'Ver módulo de administración'),
  ('admin', 'gestionar_usuarios','Crear, editar y desactivar usuarios'),
  ('admin', 'gestionar_roles',   'Crear y editar roles y permisos')
ON CONFLICT (modulo, accion) DO NOTHING;
