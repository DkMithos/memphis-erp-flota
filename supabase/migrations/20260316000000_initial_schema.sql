-- =============================================================================
-- Memphis ERP – Schema inicial
-- Modelo: Shared DB + tenant_id (SaaS multi-tenant)
-- =============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. CORE SAAS — TENANTS & USUARIOS
-- =============================================================================

CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  ruc         TEXT,
  plan        TEXT NOT NULL DEFAULT 'standard',   -- standard | professional | enterprise
  estado      TEXT NOT NULL DEFAULT 'activo',      -- activo | suspendido | cancelado
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Perfil extendido de usuario (extiende auth.users de Supabase)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  apellido      TEXT,
  email         TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'operador',  -- superadmin | admin_empresa | gerencia | compras | operaciones | tecnico | operador
  estado        TEXT NOT NULL DEFAULT 'activo',    -- activo | inactivo | suspendido
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. PROVEEDORES
-- =============================================================================

CREATE TABLE proveedores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,                   -- PROV-0001
  razon_social    TEXT NOT NULL,
  nombre_comercial TEXT,
  ruc             TEXT NOT NULL,
  tipo            TEXT NOT NULL,                   -- bienes | servicios | mixto
  categoria       TEXT NOT NULL,                   -- repuestos | taller | combustible | ...
  estado          TEXT NOT NULL DEFAULT 'activo',  -- activo | inactivo | observado | bloqueado
  condicion       TEXT NOT NULL DEFAULT 'sin_evaluar', -- excelente | bueno | regular | deficiente | sin_evaluar
  score           INT DEFAULT 0,
  -- Contacto
  email           TEXT,
  telefono        TEXT,
  celular         TEXT,
  web             TEXT,
  -- Dirección
  pais            TEXT DEFAULT 'Perú',
  departamento    TEXT,
  provincia       TEXT,
  distrito        TEXT,
  direccion       TEXT,
  -- Información bancaria
  banco           TEXT,
  cuenta_bancaria TEXT,
  cci             TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por  UUID REFERENCES profiles(id),
  modificado_en   TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, codigo),
  UNIQUE(tenant_id, ruc)
);

-- =============================================================================
-- 3. FLOTA — VEHÍCULOS
-- =============================================================================

CREATE TABLE vehiculos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo                TEXT NOT NULL,              -- VH-001
  placa                 TEXT NOT NULL,
  vin                   TEXT,
  tipo                  TEXT NOT NULL,              -- ambulancia | camioneta | van | auto | otro
  marca                 TEXT NOT NULL,
  modelo                TEXT NOT NULL,
  anio                  INT NOT NULL,
  color                 TEXT NOT NULL,
  motor                 TEXT,
  combustible           TEXT NOT NULL,              -- gasolina | diesel | gnv | electrico | hibrido
  capacidad             TEXT,
  kilometraje           INT NOT NULL DEFAULT 0,
  fuente_km             TEXT NOT NULL DEFAULT 'manual', -- manual | gps | mixto
  ubicacion_actual      TEXT NOT NULL DEFAULT 'Base Central',
  estado                TEXT NOT NULL DEFAULT 'activo', -- activo | en_taller | inactivo
  ultimo_mantenimiento  DATE,
  proximo_mantenimiento DATE,
  -- Vista pública QR
  public_view_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  public_token          UUID UNIQUE DEFAULT uuid_generate_v4(),
  -- Vínculo contrato (desnormalizado para MVP; normalizar con tabla contratos en v2)
  contrato_cliente_nombre  TEXT,
  contrato_proyecto_nombre TEXT,
  contrato_nombre          TEXT,
  contrato_tipo            TEXT,                    -- solo_garantia | mantenimiento_y_garantia | solo_mantenimiento | full_service | otro
  contrato_fecha_inicio    DATE,
  contrato_fecha_fin       DATE,
  -- Plan preventivo contratado
  plan_preventivo_habilitado          BOOLEAN NOT NULL DEFAULT FALSE,
  plan_preventivo_tipo                TEXT,         -- por_km | por_meses | mixto
  plan_preventivo_total_contratados   INT DEFAULT 0,
  plan_preventivo_intervalo_km        INT,
  plan_preventivo_intervalo_meses     INT,
  -- Inactivación
  motivo_inactivacion TEXT,
  inactivado_por      UUID REFERENCES profiles(id),
  inactivado_en       TIMESTAMPTZ,
  -- Auditoría
  creado_por          UUID REFERENCES profiles(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por      UUID REFERENCES profiles(id),
  modificado_en       TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, codigo),
  UNIQUE(tenant_id, placa),
  CONSTRAINT vehiculo_anio_valido CHECK (anio >= 1990 AND anio <= 2100)
);

-- Documentos del vehículo (SOAT, revisión técnica, etc.)
CREATE TABLE vehiculo_documentos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehiculo_id       UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  codigo            TEXT NOT NULL,                 -- DOC-xxx
  tipo              TEXT NOT NULL,                 -- SOAT | REVISION_TECNICA | TARJETA_PROPIEDAD | SEGURO_VEHICULAR | PERMISO_OPERACION | OTRO
  nombre            TEXT NOT NULL,
  numero            TEXT,
  fecha_emision     DATE,
  fecha_vencimiento DATE NOT NULL,
  archivo_nombre    TEXT,
  archivo_url       TEXT,
  observaciones     TEXT,
  -- Auditoría
  creado_por        UUID REFERENCES profiles(id),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por    UUID REFERENCES profiles(id),
  modificado_en     TIMESTAMPTZ
);

-- =============================================================================
-- 4. FLOTA — ÓRDENES DE TRABAJO (MANTENIMIENTOS)
-- =============================================================================

CREATE TABLE ordenes_trabajo (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_ot             TEXT NOT NULL,             -- OT-2024-001
  vehiculo_id           UUID NOT NULL REFERENCES vehiculos(id),
  vehiculo_placa        TEXT NOT NULL,             -- Desnormalizado para historial
  -- Clasificación
  tipo                  TEXT NOT NULL,             -- preventivo | correctivo | predictivo
  criticidad            TEXT NOT NULL DEFAULT 'media', -- baja | media | alta | critica
  estado                TEXT NOT NULL DEFAULT 'programada', -- programada | en_ejecucion | espera_repuesto | espera_aprobacion | cerrada | anulada
  -- Descripción
  titulo                TEXT NOT NULL,
  descripcion           TEXT NOT NULL,
  -- Taller
  taller_nombre         TEXT NOT NULL,
  taller_tipo           TEXT NOT NULL DEFAULT 'externo', -- interno | externo
  -- Fechas y SLA
  fecha_programada      DATE NOT NULL,
  fecha_inicio          TIMESTAMPTZ,
  fecha_cierre          TIMESTAMPTZ,
  sla_estimado_horas    INT,
  sla_real_horas        INT,
  -- Kilometraje al momento del servicio
  kilometraje_registro  INT NOT NULL DEFAULT 0,
  -- Costos base
  costo_mano_obra       DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_repuestos       DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_terceros        DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_otros           DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_total           DECIMAL(12,2) GENERATED ALWAYS AS (costo_mano_obra + costo_repuestos + costo_terceros + costo_otros) STORED,
  -- Aprobación
  aprobado_por          UUID REFERENCES profiles(id),
  aprobado_en           TIMESTAMPTZ,
  motivo_anulacion      TEXT,
  -- Auditoría
  creado_por            UUID REFERENCES profiles(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por        UUID REFERENCES profiles(id),
  modificado_en         TIMESTAMPTZ,
  cerrado_por           UUID REFERENCES profiles(id),
  -- Restricciones
  UNIQUE(tenant_id, numero_ot)
);

-- Repuestos de la OT
CREATE TABLE ot_repuestos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  cantidad        INT NOT NULL DEFAULT 1,
  costo_unitario  DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_total     DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED
);

-- Adicionales / hallazgos de la OT (extras)
CREATE TABLE ot_extras (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL,                  -- pieza | servicio
  categoria        TEXT,                           -- Eléctrico | Mecánico | Neumático | ...
  descripcion      TEXT NOT NULL,
  motivo           TEXT NOT NULL,
  cantidad         INT NOT NULL DEFAULT 1,
  costo_unitario   DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_total      DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
  -- Soft delete
  eliminado        BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_eliminacion TEXT,
  eliminado_por    UUID REFERENCES profiles(id),
  fecha_eliminacion TIMESTAMPTZ,
  -- Auditoría
  registrado_por   UUID REFERENCES profiles(id),
  fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. FLOTA — GPS
-- =============================================================================

CREATE TABLE gps_dispositivos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehiculo_id         UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  proveedor           TEXT NOT NULL DEFAULT 'geosatelital', -- geosatelital | otro
  identificador_api   TEXT NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'activo',       -- activo | inactivo
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, vehiculo_id)
);

CREATE TABLE gps_sync_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehiculo_id     UUID NOT NULL REFERENCES vehiculos(id),
  km_recibido     INT NOT NULL,
  km_anterior     INT NOT NULL,
  diferencia      INT GENERATED ALWAYS AS (km_recibido - km_anterior) STORED,
  sync_datetime   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado          TEXT NOT NULL DEFAULT 'ok',              -- ok | error | inconsistente
  error_mensaje   TEXT
);

-- =============================================================================
-- 6. BIOMÉDICO — EQUIPOS
-- =============================================================================

CREATE TABLE equipos_biomedicos (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo                  TEXT NOT NULL,           -- EB-2024-001
  nombre                  TEXT NOT NULL,
  marca                   TEXT NOT NULL,
  modelo                  TEXT NOT NULL,
  serie                   TEXT,
  anio_fabricacion        INT,
  categoria               TEXT NOT NULL,           -- diagnostico | terapeutico | soporte_vital | laboratorio | rehabilitacion
  riesgo                  TEXT NOT NULL DEFAULT 'medio', -- bajo | medio | alto | critico
  estado                  TEXT NOT NULL DEFAULT 'operativo', -- operativo | mantenimiento | fuera_servicio | baja | calibracion
  ubicacion               TEXT NOT NULL,
  servicio_clinico        TEXT,
  -- Datos de adquisición
  fecha_adquisicion       DATE,
  proveedor_id            UUID REFERENCES proveedores(id),
  costo_adquisicion       DECIMAL(12,2),
  -- Garantía y mantenimiento
  garantia_vence          DATE,
  frecuencia_mp_dias      INT DEFAULT 180,
  ultimo_mantenimiento    DATE,
  proximo_mantenimiento   DATE,
  -- Inactivación
  motivo_baja             TEXT,
  dado_de_baja_por        UUID REFERENCES profiles(id),
  dado_de_baja_en         TIMESTAMPTZ,
  -- Auditoría
  creado_por              UUID REFERENCES profiles(id),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por          UUID REFERENCES profiles(id),
  modificado_en           TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, codigo)
);

-- =============================================================================
-- 7. BIOMÉDICO — MANTENIMIENTOS
-- =============================================================================

CREATE TABLE mantenimientos_biomedicos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero              TEXT NOT NULL,               -- MB-2024-001
  equipo_id           UUID NOT NULL REFERENCES equipos_biomedicos(id),
  equipo_codigo       TEXT NOT NULL,               -- Desnormalizado
  -- Clasificación
  tipo                TEXT NOT NULL,               -- preventivo | correctivo | calibracion
  estado              TEXT NOT NULL DEFAULT 'programado', -- programado | en_ejecucion | completado | anulado
  prioridad           TEXT NOT NULL DEFAULT 'media', -- baja | media | alta | critica
  -- Descripción
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  hallazgos           TEXT,
  acciones_realizadas TEXT,
  recomendaciones     TEXT,
  -- Fechas
  fecha_programada    DATE NOT NULL,
  fecha_inicio        TIMESTAMPTZ,
  fecha_cierre        TIMESTAMPTZ,
  -- Técnico y costo
  tecnico_nombre      TEXT,
  proveedor_id        UUID REFERENCES proveedores(id),
  costo_mano_obra     DECIMAL(12,2) DEFAULT 0,
  costo_repuestos     DECIMAL(12,2) DEFAULT 0,
  costo_total         DECIMAL(12,2) GENERATED ALWAYS AS (costo_mano_obra + costo_repuestos) STORED,
  -- Próximo mantenimiento programado
  proxima_fecha       DATE,
  -- Auditoría
  creado_por          UUID REFERENCES profiles(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por      UUID REFERENCES profiles(id),
  modificado_en       TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, numero)
);

-- =============================================================================
-- 8. COMPRAS — REQUERIMIENTOS
-- =============================================================================

CREATE TABLE requerimientos_compra (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero          TEXT NOT NULL,                   -- REQ-0001
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'borrador', -- borrador | enviado | aprobado | rechazado | anulado
  prioridad       TEXT NOT NULL DEFAULT 'media',   -- alta | media | baja
  centro_costo    TEXT NOT NULL,                   -- flota | biomedico | administracion | operaciones | ti | mantenimiento
  fecha_requerida DATE,
  motivo_rechazo  TEXT,
  motivo_anulacion TEXT,
  -- Aprobación
  aprobado_por    UUID REFERENCES profiles(id),
  aprobado_en     TIMESTAMPTZ,
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por  UUID REFERENCES profiles(id),
  modificado_en   TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, numero)
);

CREATE TABLE requerimiento_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requerimiento_id        UUID NOT NULL REFERENCES requerimientos_compra(id) ON DELETE CASCADE,
  descripcion             TEXT NOT NULL,
  unidad                  TEXT NOT NULL DEFAULT 'und',
  cantidad                INT NOT NULL DEFAULT 1,
  costo_estimado_unitario DECIMAL(12,2) DEFAULT 0,
  observaciones           TEXT
);

-- =============================================================================
-- 9. COMPRAS — COTIZACIONES
-- =============================================================================

CREATE TABLE cotizaciones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero            TEXT NOT NULL,                 -- COT-0001
  requerimiento_id  UUID REFERENCES requerimientos_compra(id),
  proveedor_id      UUID NOT NULL REFERENCES proveedores(id),
  estado            TEXT NOT NULL DEFAULT 'borrador', -- borrador | enviada | recibida | aprobada | rechazada | anulada
  fecha_emision     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_validez     DATE,
  moneda            TEXT NOT NULL DEFAULT 'PEN',   -- PEN | USD
  subtotal          DECIMAL(12,2) NOT NULL DEFAULT 0,
  igv               DECIMAL(12,2) NOT NULL DEFAULT 0,
  total             DECIMAL(12,2) NOT NULL DEFAULT 0,
  plazo_entrega     TEXT,
  condiciones_pago  TEXT,
  observaciones     TEXT,
  -- Auditoría
  creado_por        UUID REFERENCES profiles(id),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por    UUID REFERENCES profiles(id),
  modificado_en     TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, numero)
);

CREATE TABLE cotizacion_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cotizacion_id    UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  unidad           TEXT NOT NULL DEFAULT 'und',
  cantidad         INT NOT NULL DEFAULT 1,
  precio_unitario  DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_total     DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- =============================================================================
-- 10. COMPRAS — ÓRDENES (OC / OS)
-- =============================================================================

CREATE TABLE ordenes_compra (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero           TEXT NOT NULL,                  -- OC-0001 | OS-0001
  tipo             TEXT NOT NULL DEFAULT 'oc',     -- oc | os
  cotizacion_id    UUID REFERENCES cotizaciones(id),
  proveedor_id     UUID NOT NULL REFERENCES proveedores(id),
  estado           TEXT NOT NULL DEFAULT 'borrador', -- borrador | enviada | aprobada | recibida_parcial | recibida_total | anulada
  fecha_emision    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_esperada DATE,
  moneda           TEXT NOT NULL DEFAULT 'PEN',
  subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0,
  igv              DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL DEFAULT 0,
  condiciones_pago TEXT,
  lugar_entrega    TEXT,
  observaciones    TEXT,
  -- Aprobación
  aprobado_por     UUID REFERENCES profiles(id),
  aprobado_en      TIMESTAMPTZ,
  motivo_anulacion TEXT,
  -- Auditoría
  creado_por       UUID REFERENCES profiles(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por   UUID REFERENCES profiles(id),
  modificado_en    TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, numero)
);

CREATE TABLE orden_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_id        UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  unidad          TEXT NOT NULL DEFAULT 'und',
  cantidad        INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_total    DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- =============================================================================
-- 11. COMPRAS — RECEPCIONES
-- =============================================================================

CREATE TABLE recepciones (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero         TEXT NOT NULL,                    -- REC-0001
  orden_id       UUID NOT NULL REFERENCES ordenes_compra(id),
  proveedor_id   UUID NOT NULL REFERENCES proveedores(id),
  estado         TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | conforme | observado | rechazado
  fecha_recepcion DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_guia    TEXT,
  numero_factura TEXT,
  observaciones  TEXT,
  -- Auditoría
  creado_por     UUID REFERENCES profiles(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por UUID REFERENCES profiles(id),
  modificado_en  TIMESTAMPTZ,
  -- Restricciones
  UNIQUE(tenant_id, numero)
);

CREATE TABLE recepcion_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recepcion_id    UUID NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  unidad          TEXT NOT NULL DEFAULT 'und',
  cantidad_pedida INT NOT NULL DEFAULT 0,
  cantidad_recibida INT NOT NULL DEFAULT 0,
  conforme        BOOLEAN NOT NULL DEFAULT TRUE,
  observaciones   TEXT
);

-- =============================================================================
-- 12. ÍNDICES DE RENDIMIENTO
-- =============================================================================

-- Profiles
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);

-- Proveedores
CREATE INDEX idx_proveedores_tenant_id ON proveedores(tenant_id);
CREATE INDEX idx_proveedores_estado ON proveedores(tenant_id, estado);

-- Vehículos
CREATE INDEX idx_vehiculos_tenant_id ON vehiculos(tenant_id);
CREATE INDEX idx_vehiculos_placa ON vehiculos(tenant_id, placa);
CREATE INDEX idx_vehiculos_public_token ON vehiculos(public_token);
CREATE INDEX idx_vehiculos_estado ON vehiculos(tenant_id, estado);

-- Documentos vehículo
CREATE INDEX idx_vehiculo_docs_vehiculo_id ON vehiculo_documentos(vehiculo_id);
CREATE INDEX idx_vehiculo_docs_vencimiento ON vehiculo_documentos(tenant_id, fecha_vencimiento);

-- OTs
CREATE INDEX idx_ots_tenant_id ON ordenes_trabajo(tenant_id);
CREATE INDEX idx_ots_vehiculo_id ON ordenes_trabajo(vehiculo_id);
CREATE INDEX idx_ots_estado ON ordenes_trabajo(tenant_id, estado);
CREATE INDEX idx_ots_tipo ON ordenes_trabajo(tenant_id, tipo);

-- GPS
CREATE INDEX idx_gps_sync_vehiculo ON gps_sync_logs(vehiculo_id);
CREATE INDEX idx_gps_sync_datetime ON gps_sync_logs(tenant_id, sync_datetime DESC);

-- Equipos biomédicos
CREATE INDEX idx_equipos_bio_tenant_id ON equipos_biomedicos(tenant_id);
CREATE INDEX idx_equipos_bio_estado ON equipos_biomedicos(tenant_id, estado);

-- Mantenimientos biomédicos
CREATE INDEX idx_mant_bio_equipo_id ON mantenimientos_biomedicos(equipo_id);
CREATE INDEX idx_mant_bio_estado ON mantenimientos_biomedicos(tenant_id, estado);

-- Compras
CREATE INDEX idx_req_tenant_id ON requerimientos_compra(tenant_id);
CREATE INDEX idx_req_estado ON requerimientos_compra(tenant_id, estado);
CREATE INDEX idx_cot_tenant_id ON cotizaciones(tenant_id);
CREATE INDEX idx_oc_tenant_id ON ordenes_compra(tenant_id);
CREATE INDEX idx_oc_estado ON ordenes_compra(tenant_id, estado);
CREATE INDEX idx_rec_tenant_id ON recepciones(tenant_id);

-- =============================================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Activar RLS en todas las tablas operativas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculo_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos_biomedicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimientos_biomedicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE requerimientos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE requerimiento_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_items ENABLE ROW LEVEL SECURITY;

-- Función helper: obtiene el tenant_id del usuario autenticado
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

-- ── PROFILES ──
CREATE POLICY "profiles: ver los del propio tenant"
  ON profiles FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "profiles: insertar los del propio tenant"
  ON profiles FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "profiles: actualizar propio perfil"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── TENANTS ──
CREATE POLICY "tenants: ver el propio"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id());

-- ── PROVEEDORES ──
CREATE POLICY "proveedores: tenant completo"
  ON proveedores FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── VEHÍCULOS ──
CREATE POLICY "vehiculos: tenant completo"
  ON vehiculos FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Vehículos públicos (acceso por token sin autenticación)
CREATE POLICY "vehiculos: public_token acceso sin auth"
  ON vehiculos FOR SELECT
  USING (public_view_enabled = TRUE AND public_token IS NOT NULL);

-- ── DOCUMENTOS VEHÍCULO ──
CREATE POLICY "vehiculo_docs: tenant completo"
  ON vehiculo_documentos FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── ÓRDENES DE TRABAJO ──
CREATE POLICY "ots: tenant completo"
  ON ordenes_trabajo FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "ot_repuestos: tenant completo"
  ON ot_repuestos FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "ot_extras: tenant completo"
  ON ot_extras FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── GPS ──
CREATE POLICY "gps_dispositivos: tenant completo"
  ON gps_dispositivos FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "gps_sync_logs: tenant completo"
  ON gps_sync_logs FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── BIOMÉDICO ──
CREATE POLICY "equipos_bio: tenant completo"
  ON equipos_biomedicos FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "mant_bio: tenant completo"
  ON mantenimientos_biomedicos FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── COMPRAS ──
CREATE POLICY "requerimientos: tenant completo"
  ON requerimientos_compra FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "req_items: tenant completo"
  ON requerimiento_items FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "cotizaciones: tenant completo"
  ON cotizaciones FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "cot_items: tenant completo"
  ON cotizacion_items FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "ordenes_compra: tenant completo"
  ON ordenes_compra FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "orden_items: tenant completo"
  ON orden_items FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "recepciones: tenant completo"
  ON recepciones FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "recepcion_items: tenant completo"
  ON recepcion_items FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- =============================================================================
-- 14. TRIGGERS — updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_tenants
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- 15. FUNCIÓN PARA CREAR PERFIL AUTOMÁTICAMENTE AL REGISTRAR UN USUARIO
-- (Se ejecuta desde un trigger en auth.users vía Supabase Dashboard o con
--  la función signup del cliente pasando metadata: tenant_id, nombre, rol)
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, tenant_id, nombre, apellido, email, rol)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
    NEW.raw_user_meta_data->>'apellido',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'operador')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
