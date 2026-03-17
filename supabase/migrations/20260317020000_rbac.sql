-- ============================================================
-- RBAC: Roles, Permissions, User-Role assignments
-- ============================================================

-- Roles por tenant
CREATE TABLE roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_sistema BOOLEAN NOT NULL DEFAULT FALSE,  -- roles built-in no editables
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_roles" ON roles
  USING (tenant_id = auth_tenant_id());

-- Permisos atómicos
CREATE TABLE permisos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo TEXT NOT NULL,     -- 'flota', 'biomedico', 'compras', 'proveedores', 'finanzas', 'inventario', 'crm', 'proyectos', 'admin'
  accion TEXT NOT NULL,     -- 'ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar'
  descripcion TEXT,
  UNIQUE(modulo, accion)
);

-- Permisos no tienen RLS — son globales del sistema
-- Seed de permisos básicos
INSERT INTO permisos (modulo, accion, descripcion) VALUES
  ('flota', 'ver', 'Ver vehículos y mantenimientos'),
  ('flota', 'crear', 'Crear vehículos y OTs'),
  ('flota', 'editar', 'Editar vehículos y OTs'),
  ('flota', 'eliminar', 'Eliminar registros de flota'),
  ('flota', 'aprobar', 'Aprobar y cerrar OTs'),
  ('biomedico', 'ver', 'Ver equipos biomédicos'),
  ('biomedico', 'crear', 'Crear equipos y mantenimientos'),
  ('biomedico', 'editar', 'Editar equipos biomédicos'),
  ('biomedico', 'eliminar', 'Eliminar registros biomédicos'),
  ('compras', 'ver', 'Ver requerimientos y órdenes'),
  ('compras', 'crear', 'Crear requerimientos'),
  ('compras', 'editar', 'Editar requerimientos'),
  ('compras', 'eliminar', 'Eliminar requerimientos'),
  ('compras', 'aprobar', 'Aprobar órdenes de compra'),
  ('proveedores', 'ver', 'Ver proveedores'),
  ('proveedores', 'crear', 'Crear proveedores'),
  ('proveedores', 'editar', 'Editar proveedores'),
  ('proveedores', 'eliminar', 'Eliminar proveedores'),
  ('inventario', 'ver', 'Ver inventario'),
  ('inventario', 'crear', 'Agregar items al inventario'),
  ('inventario', 'editar', 'Editar inventario'),
  ('inventario', 'eliminar', 'Eliminar del inventario'),
  ('finanzas', 'ver', 'Ver reportes financieros'),
  ('finanzas', 'crear', 'Crear registros financieros'),
  ('finanzas', 'editar', 'Editar registros financieros'),
  ('finanzas', 'aprobar', 'Aprobar transacciones'),
  ('crm', 'ver', 'Ver clientes y oportunidades'),
  ('crm', 'crear', 'Crear clientes y oportunidades'),
  ('crm', 'editar', 'Editar CRM'),
  ('proyectos', 'ver', 'Ver proyectos'),
  ('proyectos', 'crear', 'Crear proyectos'),
  ('proyectos', 'editar', 'Editar proyectos'),
  ('admin', 'ver', 'Ver configuración del sistema'),
  ('admin', 'gestionar_usuarios', 'Gestionar usuarios y roles'),
  ('admin', 'gestionar_roles', 'Crear y editar roles');

-- Asignación de permisos a roles
CREATE TABLE roles_permisos (
  rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

ALTER TABLE roles_permisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_roles_permisos" ON roles_permisos
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = rol_id AND r.tenant_id = auth_tenant_id()
    )
  );

-- Asignación de roles a usuarios
CREATE TABLE usuarios_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,   -- FK a auth.users
  rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  asignado_por TEXT,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, rol_id)
);

ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_usuarios_roles" ON usuarios_roles
  USING (tenant_id = auth_tenant_id());

-- Tabla de usuarios del tenant (perfil extendido)
CREATE TABLE IF NOT EXISTS usuarios_tenant (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,   -- FK a auth.users
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT,
  departamento TEXT,
  telefono TEXT,
  avatar_url TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE usuarios_tenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_usuarios_tenant" ON usuarios_tenant
  USING (tenant_id = auth_tenant_id());
