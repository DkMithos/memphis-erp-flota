-- ============================================================
-- Proyectos
-- ============================================================

CREATE TABLE proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  codigo TEXT NOT NULL,         -- PRY-YYYY-NNN
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL DEFAULT 'interno'
    CHECK (tipo IN ('interno', 'cliente', 'infraestructura', 'mejora', 'investigacion')),
  estado TEXT NOT NULL DEFAULT 'planificacion'
    CHECK (estado IN ('planificacion', 'en_ejecucion', 'pausado', 'completado', 'cancelado')),
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
  -- Fechas
  fecha_inicio DATE,
  fecha_fin_estimada DATE,
  fecha_fin_real DATE,
  -- Financiero
  presupuesto NUMERIC(15,2),
  costo_real NUMERIC(15,2) DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'PEN',
  -- Responsables
  gerente_proyecto TEXT,
  cliente_id UUID,              -- referencia opcional a clientes CRM
  -- Progreso
  porcentaje_avance INTEGER NOT NULL DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
  -- Metadata
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_proyectos" ON proyectos USING (tenant_id = auth_tenant_id());

-- Fases del proyecto
CREATE TABLE fases_proyecto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')),
  fecha_inicio DATE,
  fecha_fin DATE,
  porcentaje_avance INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE fases_proyecto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_fases" ON fases_proyecto USING (tenant_id = auth_tenant_id());

-- Tareas
CREATE TABLE tareas_proyecto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES fases_proyecto(id),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'bloqueada', 'cancelada')),
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
  asignado_a TEXT,
  fecha_inicio DATE,
  fecha_vencimiento DATE,
  fecha_completada DATE,
  estimacion_horas NUMERIC(8,2),
  horas_reales NUMERIC(8,2),
  orden INTEGER NOT NULL DEFAULT 1,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tareas_proyecto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_tareas" ON tareas_proyecto USING (tenant_id = auth_tenant_id());

-- Miembros del equipo del proyecto
CREATE TABLE miembros_proyecto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  user_id UUID,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL,            -- Gerente, Analista, Desarrollador, etc.
  horas_asignadas NUMERIC(8,2),
  UNIQUE(proyecto_id, nombre)
);
ALTER TABLE miembros_proyecto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_miembros" ON miembros_proyecto USING (tenant_id = auth_tenant_id());
