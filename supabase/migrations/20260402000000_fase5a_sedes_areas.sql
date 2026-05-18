-- =============================================================================
-- FASE 5A — CLIENTES / SEDES / ÁREAS CLÍNICAS
-- Jerarquía: Cliente (hospital/clínica) → Sede (local/campus) → Área Clínica
-- Equipos biomédicos se vinculan a un área dentro de una sede de un cliente.
-- =============================================================================

-- 1. CLIENTES BIO (hospitales, clínicas, centros de salud)
-- =============================================================================

CREATE TABLE clientes_bio (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,               -- CLI-001
  nombre          TEXT NOT NULL,
  ruc             TEXT,
  tipo            TEXT NOT NULL DEFAULT 'hospital',  -- hospital | clinica | centro_salud | laboratorio | otro
  sector          TEXT NOT NULL DEFAULT 'privado',    -- publico | privado | mixto
  estado          TEXT NOT NULL DEFAULT 'activo',     -- activo | inactivo
  -- Contacto
  telefono        TEXT,
  email           TEXT,
  direccion       TEXT,
  distrito        TEXT,
  provincia       TEXT,
  departamento    TEXT,
  -- Contrato
  contrato_activo BOOLEAN NOT NULL DEFAULT FALSE,
  contrato_inicio DATE,
  contrato_fin    DATE,
  -- Auditoría
  observaciones   TEXT,
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por  UUID REFERENCES profiles(id),
  modificado_en   TIMESTAMPTZ,
  UNIQUE(tenant_id, codigo)
);

-- 2. SEDES (locales / campus de un cliente)
-- =============================================================================

CREATE TABLE sedes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES clientes_bio(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,               -- SED-001
  nombre          TEXT NOT NULL,               -- "Sede Central", "Piso 3 – Torre A"
  direccion       TEXT,
  distrito        TEXT,
  provincia       TEXT,
  departamento    TEXT,
  telefono        TEXT,
  responsable     TEXT,
  estado          TEXT NOT NULL DEFAULT 'activo',  -- activo | inactivo
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por  UUID REFERENCES profiles(id),
  modificado_en   TIMESTAMPTZ,
  UNIQUE(tenant_id, codigo)
);

-- 3. ÁREAS CLÍNICAS (servicios dentro de una sede)
-- =============================================================================

CREATE TABLE areas_clinicas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sede_id         UUID NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,               -- AREA-001
  nombre          TEXT NOT NULL,               -- "UCI", "Emergencias", "Rayos X"
  tipo            TEXT,                        -- ucl | emergencias | cirugia | diagnostico | consulta | laboratorio | otro
  piso            TEXT,
  responsable     TEXT,
  estado          TEXT NOT NULL DEFAULT 'activo',
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por  UUID REFERENCES profiles(id),
  modificado_en   TIMESTAMPTZ,
  UNIQUE(tenant_id, codigo)
);

-- 4. VINCULAR EQUIPOS BIOMÉDICOS A LA JERARQUÍA
-- =============================================================================
-- Añadimos FKs opcionales a la tabla existente.
-- Nullable para no romper equipos ya existentes sin jerarquía.

ALTER TABLE equipos_biomedicos
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes_bio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sede_id    UUID REFERENCES sedes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_id    UUID REFERENCES areas_clinicas(id) ON DELETE SET NULL;

-- 5. HISTORIAL DE CAMBIOS DE UBICACIÓN (RN-10)
-- =============================================================================

CREATE TABLE historial_ubicacion_equipo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipo_id       UUID NOT NULL REFERENCES equipos_biomedicos(id) ON DELETE CASCADE,
  -- Origen
  cliente_id_anterior  UUID REFERENCES clientes_bio(id) ON DELETE SET NULL,
  sede_id_anterior     UUID REFERENCES sedes(id) ON DELETE SET NULL,
  area_id_anterior     UUID REFERENCES areas_clinicas(id) ON DELETE SET NULL,
  ubicacion_anterior   TEXT,
  -- Destino
  cliente_id_nuevo     UUID REFERENCES clientes_bio(id) ON DELETE SET NULL,
  sede_id_nuevo        UUID REFERENCES sedes(id) ON DELETE SET NULL,
  area_id_nuevo        UUID REFERENCES areas_clinicas(id) ON DELETE SET NULL,
  ubicacion_nueva      TEXT,
  -- Metadatos
  motivo          TEXT,
  fecha_cambio    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  realizado_por   UUID REFERENCES profiles(id)
);

-- 6. ÍNDICES
-- =============================================================================

CREATE INDEX idx_clientes_bio_tenant ON clientes_bio(tenant_id);
CREATE INDEX idx_clientes_bio_estado ON clientes_bio(tenant_id, estado);
CREATE INDEX idx_sedes_tenant ON sedes(tenant_id);
CREATE INDEX idx_sedes_cliente ON sedes(cliente_id);
CREATE INDEX idx_areas_tenant ON areas_clinicas(tenant_id);
CREATE INDEX idx_areas_sede ON areas_clinicas(sede_id);
CREATE INDEX idx_equipos_bio_cliente ON equipos_biomedicos(cliente_id);
CREATE INDEX idx_equipos_bio_sede ON equipos_biomedicos(sede_id);
CREATE INDEX idx_equipos_bio_area ON equipos_biomedicos(area_id);
CREATE INDEX idx_historial_ubicacion_equipo ON historial_ubicacion_equipo(equipo_id);

-- 7. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE clientes_bio ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_ubicacion_equipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_bio: tenant completo"
  ON clientes_bio FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "sedes: tenant completo"
  ON sedes FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "areas_clinicas: tenant completo"
  ON areas_clinicas FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "historial_ubicacion: tenant completo"
  ON historial_ubicacion_equipo FOR ALL
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- 8. SEED — DATOS INICIALES PARA KESA (tenant demo)
-- =============================================================================

DO $$
DECLARE
  v_tenant UUID := 'a0000000-0000-0000-0000-000000000001';
  v_cli    UUID;
  v_sed    UUID;
BEGIN
  -- Cliente demo: Clínica San Felipe
  INSERT INTO clientes_bio (id, tenant_id, codigo, nombre, ruc, tipo, sector, estado, departamento, provincia, distrito, contrato_activo)
  VALUES (
    uuid_generate_v4(), v_tenant, 'CLI-001', 'Clínica San Felipe', '20100128056',
    'clinica', 'privado', 'activo', 'Lima', 'Lima', 'Jesús María', TRUE
  ) RETURNING id INTO v_cli;

  -- Sede 1
  INSERT INTO sedes (id, tenant_id, cliente_id, codigo, nombre, direccion, distrito, departamento, estado)
  VALUES (
    uuid_generate_v4(), v_tenant, v_cli, 'SED-001', 'Sede Principal',
    'Av. Gregorio Escobedo 650', 'Jesús María', 'Lima', 'activo'
  ) RETURNING id INTO v_sed;

  -- Áreas
  INSERT INTO areas_clinicas (tenant_id, sede_id, codigo, nombre, tipo, piso, estado)
  VALUES
    (v_tenant, v_sed, 'AREA-001', 'UCI', 'ucl', '3er piso', 'activo'),
    (v_tenant, v_sed, 'AREA-002', 'Emergencias', 'emergencias', '1er piso', 'activo'),
    (v_tenant, v_sed, 'AREA-003', 'Rayos X', 'diagnostico', '2do piso', 'activo'),
    (v_tenant, v_sed, 'AREA-004', 'Laboratorio', 'laboratorio', '2do piso', 'activo'),
    (v_tenant, v_sed, 'AREA-005', 'Sala de Operaciones', 'cirugia', '4to piso', 'activo');
END $$;
