-- ============================================================
-- Inventario
-- ============================================================

-- Categorías de artículos
CREATE TABLE categorias_inventario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  codigo TEXT,            -- CAT-NNN
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE categorias_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_categorias" ON categorias_inventario USING (tenant_id = auth_tenant_id());

-- Almacenes / Ubicaciones
CREATE TABLE almacenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL,   -- ALM-NNN
  tipo TEXT NOT NULL DEFAULT 'general'
    CHECK (tipo IN ('general', 'repuestos', 'suministros', 'herramientas', 'consumibles')),
  ubicacion TEXT,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE almacenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_almacenes" ON almacenes USING (tenant_id = auth_tenant_id());

-- Artículos del catálogo
CREATE TABLE articulos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  categoria_id UUID REFERENCES categorias_inventario(id),
  codigo TEXT NOT NULL,         -- ART-NNNN
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad_medida TEXT NOT NULL DEFAULT 'unidad'
    CHECK (unidad_medida IN ('unidad', 'kg', 'litro', 'metro', 'caja', 'par', 'juego', 'rollo', 'galón')),
  tipo TEXT NOT NULL DEFAULT 'suministro'
    CHECK (tipo IN ('repuesto', 'suministro', 'herramienta', 'consumible', 'equipo')),
  -- Stock
  stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_maximo NUMERIC(12,3),
  -- Financiero
  precio_unitario NUMERIC(12,2),
  moneda TEXT NOT NULL DEFAULT 'PEN',
  -- Metadata
  marca TEXT,
  modelo TEXT,
  codigo_fabricante TEXT,
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por TEXT,
  modificado_en TIMESTAMPTZ
);
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_articulos" ON articulos USING (tenant_id = auth_tenant_id());

-- Stock por almacén (detalle de ubicación del stock)
CREATE TABLE stock_almacen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  articulo_id UUID NOT NULL REFERENCES articulos(id),
  almacen_id UUID NOT NULL REFERENCES almacenes(id),
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 0,
  ubicacion_interna TEXT,       -- ej: "Estante A, Fila 3"
  UNIQUE(articulo_id, almacen_id)
);
ALTER TABLE stock_almacen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_stock_almacen" ON stock_almacen USING (tenant_id = auth_tenant_id());

-- Movimientos de inventario (kardex)
CREATE TABLE movimientos_inventario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  articulo_id UUID NOT NULL REFERENCES articulos(id),
  almacen_id UUID NOT NULL REFERENCES almacenes(id),
  numero TEXT NOT NULL,         -- MOV-YYYY-NNNN
  tipo TEXT NOT NULL
    CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'transferencia')),
  motivo TEXT NOT NULL
    CHECK (motivo IN ('compra', 'devolucion', 'consumo', 'mantenimiento', 'ajuste_positivo', 'ajuste_negativo', 'transferencia_entrada', 'transferencia_salida', 'merma', 'inicial')),
  cantidad NUMERIC(12,3) NOT NULL,
  stock_anterior NUMERIC(12,3) NOT NULL,
  stock_nuevo NUMERIC(12,3) NOT NULL,
  precio_unitario NUMERIC(12,2),
  costo_total NUMERIC(12,2),
  referencia_id TEXT,           -- OC número, OT número, etc.
  referencia_tipo TEXT,         -- 'orden_compra', 'ot', 'manual'
  notas TEXT,
  realizado_por TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_movimientos" ON movimientos_inventario USING (tenant_id = auth_tenant_id());
