-- ============================================================================
-- BIOMÉDICO EXTRA: Calibraciones, Incidencias, Documentos
-- Fecha: 2026-03-17
-- ============================================================================

-- ============================================================================
-- CALIBRACIONES BIOMÉDICAS
-- ============================================================================

CREATE TABLE calibraciones_biomedicas (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  equipo_id        UUID NOT NULL REFERENCES equipos_biomedicos(id),
  numero           TEXT NOT NULL,                        -- CAL-YYYY-NNN
  tipo             TEXT NOT NULL CHECK (tipo IN ('interna', 'externa', 'verificacion')),
  estado           TEXT NOT NULL DEFAULT 'programada'
                     CHECK (estado IN ('programada', 'en_proceso', 'aprobada', 'rechazada', 'vencida')),
  fecha_programada DATE NOT NULL,
  fecha_realizada  DATE,
  fecha_vencimiento DATE,
  responsable      TEXT,
  proveedor_calibracion TEXT,
  resultado        TEXT CHECK (resultado IN ('aprobada', 'rechazada', 'con_observaciones')),
  incertidumbre    TEXT,
  certificado_numero TEXT,
  observaciones    TEXT,
  creado_por       TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por   TEXT,
  modificado_en    TIMESTAMPTZ
);

CREATE INDEX idx_calibraciones_tenant  ON calibraciones_biomedicas(tenant_id);
CREATE INDEX idx_calibraciones_equipo  ON calibraciones_biomedicas(equipo_id);
CREATE INDEX idx_calibraciones_estado  ON calibraciones_biomedicas(tenant_id, estado);
CREATE INDEX idx_calibraciones_vence   ON calibraciones_biomedicas(tenant_id, fecha_vencimiento);

ALTER TABLE calibraciones_biomedicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON calibraciones_biomedicas
  FOR ALL USING (tenant_id = auth_tenant_id());

-- ============================================================================
-- INCIDENCIAS BIOMÉDICAS
-- ============================================================================

CREATE TABLE incidencias_biomedicas (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID NOT NULL REFERENCES tenants(id),
  equipo_id              UUID NOT NULL REFERENCES equipos_biomedicos(id),
  numero                 TEXT NOT NULL,                  -- INC-YYYY-NNN
  tipo                   TEXT NOT NULL
                           CHECK (tipo IN ('falla', 'error_usuario', 'accidente', 'deterioro', 'otro')),
  severidad              TEXT NOT NULL
                           CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
  estado                 TEXT NOT NULL DEFAULT 'abierta'
                           CHECK (estado IN ('abierta', 'en_investigacion', 'resuelta', 'cerrada')),
  fecha_ocurrencia       TIMESTAMPTZ NOT NULL,
  descripcion            TEXT NOT NULL,
  acciones_tomadas       TEXT,
  reportado_por          TEXT,
  resuelto_por           TEXT,
  fecha_resolucion       TIMESTAMPTZ,
  requiere_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por             TEXT,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modificado_por         TEXT,
  modificado_en          TIMESTAMPTZ
);

CREATE INDEX idx_incidencias_tenant   ON incidencias_biomedicas(tenant_id);
CREATE INDEX idx_incidencias_equipo   ON incidencias_biomedicas(equipo_id);
CREATE INDEX idx_incidencias_estado   ON incidencias_biomedicas(tenant_id, estado);
CREATE INDEX idx_incidencias_severidad ON incidencias_biomedicas(tenant_id, severidad);

ALTER TABLE incidencias_biomedicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON incidencias_biomedicas
  FOR ALL USING (tenant_id = auth_tenant_id());

-- ============================================================================
-- DOCUMENTOS BIOMÉDICOS
-- ============================================================================

CREATE TABLE documentos_biomedicos (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  equipo_id        UUID NOT NULL REFERENCES equipos_biomedicos(id),
  nombre           TEXT NOT NULL,
  tipo             TEXT NOT NULL
                     CHECK (tipo IN ('manual', 'certificado', 'protocolo', 'garantia', 'ficha_tecnica', 'otro')),
  descripcion      TEXT,
  url_storage      TEXT,                               -- Supabase Storage path
  nombre_archivo   TEXT,
  tamano_bytes     INTEGER,
  mime_type        TEXT,
  vigencia         DATE,
  subido_por       TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_bio_tenant  ON documentos_biomedicos(tenant_id);
CREATE INDEX idx_docs_bio_equipo  ON documentos_biomedicos(equipo_id);
CREATE INDEX idx_docs_bio_tipo    ON documentos_biomedicos(tenant_id, tipo);

ALTER TABLE documentos_biomedicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON documentos_biomedicos
  FOR ALL USING (tenant_id = auth_tenant_id());
