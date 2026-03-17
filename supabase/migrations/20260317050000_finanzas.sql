-- ============================================================
-- Finanzas: Cuentas, Transacciones, Presupuestos, Caja Chica
-- ============================================================

-- Plan de cuentas
CREATE TABLE cuentas_contables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  codigo TEXT NOT NULL,         -- ej: 1.1.01
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('activo', 'pasivo', 'patrimonio', 'ingreso', 'egreso')),
  nivel INTEGER NOT NULL DEFAULT 1,
  cuenta_padre_id UUID REFERENCES cuentas_contables(id),
  moneda TEXT NOT NULL DEFAULT 'PEN',
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cuentas_contables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_cuentas" ON cuentas_contables USING (tenant_id = auth_tenant_id());

-- Centros de costo
CREATE TABLE centros_costo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE centros_costo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_centros" ON centros_costo USING (tenant_id = auth_tenant_id());

-- Transacciones financieras (ingresos y egresos)
CREATE TABLE transacciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  numero TEXT NOT NULL,         -- TRX-YYYY-NNNN
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'transferencia')),
  categoria TEXT NOT NULL,      -- libre: "Combustible", "Mantenimiento", "Salarios", etc.
  subcategoria TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'pagada', 'anulada')),
  monto NUMERIC(15,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'PEN',
  tipo_cambio NUMERIC(10,6) DEFAULT 1,
  monto_soles NUMERIC(15,2),   -- monto convertido a PEN
  fecha DATE NOT NULL,
  fecha_pago DATE,
  descripcion TEXT NOT NULL,
  cuenta_id UUID REFERENCES cuentas_contables(id),
  centro_costo_id UUID REFERENCES centros_costo(id),
  -- Referencias externas
  referencia_numero TEXT,      -- nº doc, factura, recibo
  referencia_tipo TEXT,        -- 'factura', 'boleta', 'recibo', 'planilla'
  proveedor_nombre TEXT,
  -- Aprobación
  aprobado_por TEXT,
  aprobado_en TIMESTAMPTZ,
  -- Adjuntos (solo referencia URL)
  comprobante_url TEXT,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_transacciones" ON transacciones USING (tenant_id = auth_tenant_id());

-- Presupuestos
CREATE TABLE presupuestos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  periodo TEXT NOT NULL,        -- ej: "2026", "2026-Q1", "2026-03"
  tipo TEXT NOT NULL DEFAULT 'anual' CHECK (tipo IN ('mensual', 'trimestral', 'anual')),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobado', 'cerrado')),
  moneda TEXT NOT NULL DEFAULT 'PEN',
  descripcion TEXT,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_presupuestos" ON presupuestos USING (tenant_id = auth_tenant_id());

-- Líneas de presupuesto
CREATE TABLE presupuesto_lineas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  monto_presupuestado NUMERIC(15,2) NOT NULL,
  monto_ejecutado NUMERIC(15,2) NOT NULL DEFAULT 0,
  centro_costo_id UUID REFERENCES centros_costo(id)
);
ALTER TABLE presupuesto_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_presupuesto_lineas" ON presupuesto_lineas USING (tenant_id = auth_tenant_id());

-- Caja Chica
CREATE TABLE cajas_chicas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL,         -- CC-NNN
  responsable TEXT NOT NULL,
  monto_asignado NUMERIC(12,2) NOT NULL,
  monto_disponible NUMERIC(12,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'PEN',
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'en_reposicion', 'cerrada')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cajas_chicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_cajas" ON cajas_chicas USING (tenant_id = auth_tenant_id());

-- Gastos de caja chica
CREATE TABLE gastos_caja_chica (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  caja_id UUID NOT NULL REFERENCES cajas_chicas(id),
  numero TEXT NOT NULL,         -- GCC-YYYY-NNN
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'PEN',
  fecha DATE NOT NULL,
  beneficiario TEXT,
  comprobante_numero TEXT,
  comprobante_tipo TEXT CHECK (comprobante_tipo IN ('boleta', 'factura', 'recibo', 'sin_comprobante')),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  aprobado_por TEXT,
  notas TEXT,
  realizado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE gastos_caja_chica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_gastos_cc" ON gastos_caja_chica USING (tenant_id = auth_tenant_id());
