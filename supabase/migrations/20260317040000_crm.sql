-- ============================================================
-- CRM: Clientes, Oportunidades, Actividades
-- ============================================================

-- Clientes / Cuentas
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  codigo TEXT NOT NULL,         -- CLI-NNNN
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  tipo TEXT NOT NULL DEFAULT 'empresa'
    CHECK (tipo IN ('empresa', 'persona_natural', 'gobierno', 'ong')),
  sector TEXT,                  -- mineria, construccion, transporte, etc.
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'inactivo', 'prospecto', 'perdido')),
  -- Contacto principal
  contacto_nombre TEXT,
  contacto_cargo TEXT,
  contacto_telefono TEXT,
  contacto_email TEXT,
  -- Ubicación
  departamento TEXT,
  provincia TEXT,
  distrito TEXT,
  direccion TEXT,
  -- Financiero
  ruc TEXT,
  credito_limite NUMERIC(15,2),
  credito_dias INTEGER DEFAULT 30,
  moneda TEXT NOT NULL DEFAULT 'PEN',
  -- Clasificación
  categoria TEXT CHECK (categoria IN ('A', 'B', 'C')),   -- clasificación de cliente
  origen TEXT,                  -- como llegó: referido, web, evento, etc.
  -- Notas
  descripcion TEXT,
  observaciones TEXT,
  -- Responsable
  ejecutivo_cuenta TEXT,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_clientes" ON clientes USING (tenant_id = auth_tenant_id());

-- Oportunidades de negocio
CREATE TABLE oportunidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  codigo TEXT NOT NULL,         -- OPO-YYYY-NNN
  titulo TEXT NOT NULL,
  descripcion TEXT,
  etapa TEXT NOT NULL DEFAULT 'prospecto'
    CHECK (etapa IN ('prospecto', 'calificado', 'propuesta', 'negociacion', 'cerrado_ganado', 'cerrado_perdido')),
  probabilidad INTEGER DEFAULT 10 CHECK (probabilidad BETWEEN 0 AND 100),
  monto_estimado NUMERIC(15,2),
  moneda TEXT NOT NULL DEFAULT 'PEN',
  fecha_cierre_estimada DATE,
  fecha_cierre_real DATE,
  motivo_cierre TEXT,           -- si se ganó o perdió
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  ejecutivo TEXT,
  -- Metadata
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_oportunidades" ON oportunidades USING (tenant_id = auth_tenant_id());

-- Actividades / Interacciones
CREATE TABLE actividades_crm (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  oportunidad_id UUID REFERENCES oportunidades(id),
  tipo TEXT NOT NULL
    CHECK (tipo IN ('llamada', 'reunion', 'email', 'visita', 'propuesta', 'seguimiento', 'otro')),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'realizada', 'cancelada')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_programada TIMESTAMPTZ NOT NULL,
  fecha_realizada TIMESTAMPTZ,
  resultado TEXT,
  proxima_accion TEXT,
  realizado_por TEXT,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE actividades_crm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_actividades_crm" ON actividades_crm USING (tenant_id = auth_tenant_id());
