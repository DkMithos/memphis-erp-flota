-- ============================================================
-- Evaluaciones de Proveedores
-- ============================================================
CREATE TABLE evaluaciones_proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  numero TEXT NOT NULL,           -- EVA-YYYY-NNN
  periodo TEXT NOT NULL,          -- ej: "2026-Q1", "2026-03"
  tipo TEXT NOT NULL CHECK (tipo IN ('mensual', 'trimestral', 'anual', 'puntual')),
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'en_revision', 'aprobada', 'rechazada')),

  -- Criterios (0-100)
  calidad NUMERIC(5,2),
  entrega NUMERIC(5,2),
  precio NUMERIC(5,2),
  servicio NUMERIC(5,2),
  documentacion NUMERIC(5,2),

  puntaje_total NUMERIC(5,2),     -- promedio calculado
  resultado TEXT CHECK (resultado IN ('excelente', 'bueno', 'regular', 'deficiente')),

  evaluador TEXT,
  comentarios TEXT,
  acciones_mejora TEXT,

  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);

ALTER TABLE evaluaciones_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_evaluaciones" ON evaluaciones_proveedores
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- Contratos de Proveedores
-- ============================================================
CREATE TABLE contratos_proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  numero TEXT NOT NULL,           -- CON-YYYY-NNN
  tipo TEXT NOT NULL CHECK (tipo IN ('servicio', 'suministro', 'mantenimiento', 'consultoria', 'otro')),
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'activo', 'vencido', 'rescindido', 'renovacion')),

  descripcion TEXT NOT NULL,
  monto_total NUMERIC(15,2),
  moneda TEXT NOT NULL DEFAULT 'PEN',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_firma DATE,

  condiciones_pago TEXT,
  penalidades TEXT,
  url_documento TEXT,             -- link al contrato escaneado
  observaciones TEXT,

  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);

ALTER TABLE contratos_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_contratos" ON contratos_proveedores
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- Talleres (Red de Talleres Autorizados)
-- ============================================================
CREATE TABLE talleres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor_id UUID REFERENCES proveedores(id),   -- opcional, puede no tener proveedor asociado
  codigo TEXT NOT NULL,           -- TAL-NNNN
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('mecanico', 'electrico', 'carroceria', 'neumaticos', 'aire_acondicionado', 'general', 'especializado')),
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'inactivo', 'suspendido')),

  -- Contacto
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  contacto_email TEXT,

  -- Ubicación
  departamento TEXT,
  provincia TEXT,
  distrito TEXT,
  direccion TEXT,

  -- Capacidades
  especialidades TEXT[],           -- array de strings
  marcas_autorizadas TEXT[],
  horario_atencion TEXT,
  tiempo_respuesta_horas INTEGER,

  -- Financiero
  moneda TEXT NOT NULL DEFAULT 'PEN',
  condiciones_pago TEXT,

  observaciones TEXT,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);

ALTER TABLE talleres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_talleres" ON talleres
  USING (tenant_id = auth_tenant_id());
