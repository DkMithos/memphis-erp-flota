-- ============================================================================
-- Sprint 3 — Catálogos configurables
-- Tabla para listas desplegables gestionables desde el panel admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalogos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,           -- unidad_medida, condicion_pago, forma_pago, etc.
  key         TEXT NOT NULL,           -- clave interna (und, kg, 30d, etc.)
  label       TEXT NOT NULL,           -- label visible para el usuario
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  es_sistema  BOOLEAN NOT NULL DEFAULT FALSE,  -- items de sistema no se eliminan desde UI
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, tipo, key)
);

-- Índices
CREATE INDEX IF NOT EXISTS catalogos_tenant_tipo_idx ON catalogos (tenant_id, tipo);
CREATE INDEX IF NOT EXISTS catalogos_activo_idx ON catalogos (activo);

-- RLS
ALTER TABLE catalogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogos_tenant_isolation ON catalogos
  USING (tenant_id = current_setting('app.tenant_id', TRUE)::UUID);

CREATE POLICY catalogos_insert_policy ON catalogos
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', TRUE)::UUID);

CREATE POLICY catalogos_update_policy ON catalogos
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', TRUE)::UUID);

CREATE POLICY catalogos_delete_policy ON catalogos
  FOR DELETE USING (
    tenant_id = current_setting('app.tenant_id', TRUE)::UUID
    AND es_sistema = FALSE
  );

-- ============================================================================
-- Seed inicial para tenant KESA
-- ============================================================================

DO $$
DECLARE
  kesa_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Unidades de medida
  INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema) VALUES
    (kesa_id, 'unidad_medida', 'und',      'Unidad',                  TRUE, 1,  TRUE),
    (kesa_id, 'unidad_medida', 'kg',       'Kilogramo (kg)',           TRUE, 2,  TRUE),
    (kesa_id, 'unidad_medida', 'gr',       'Gramo (gr)',               TRUE, 3,  TRUE),
    (kesa_id, 'unidad_medida', 'm',        'Metro (m)',                TRUE, 4,  TRUE),
    (kesa_id, 'unidad_medida', 'm2',       'Metro cuadrado (m²)',      TRUE, 5,  FALSE),
    (kesa_id, 'unidad_medida', 'l',        'Litro (L)',                TRUE, 6,  FALSE),
    (kesa_id, 'unidad_medida', 'gln',      'Galón',                   TRUE, 7,  FALSE),
    (kesa_id, 'unidad_medida', 'caja',     'Caja',                    TRUE, 8,  FALSE),
    (kesa_id, 'unidad_medida', 'paq',      'Paquete',                 TRUE, 9,  FALSE),
    (kesa_id, 'unidad_medida', 'rollo',    'Rollo',                   TRUE, 10, FALSE),
    (kesa_id, 'unidad_medida', 'hr',       'Hora (hr)',                TRUE, 11, TRUE),
    (kesa_id, 'unidad_medida', 'mes',      'Mes',                     TRUE, 12, FALSE),
    (kesa_id, 'unidad_medida', 'servicio', 'Servicio',                TRUE, 13, TRUE)
  ON CONFLICT (tenant_id, tipo, key) DO NOTHING;

  -- Condiciones de pago
  INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema) VALUES
    (kesa_id, 'condicion_pago', 'contado',    'Al contado',                     TRUE, 1, TRUE),
    (kesa_id, 'condicion_pago', '15d',        '15 días',                         TRUE, 2, FALSE),
    (kesa_id, 'condicion_pago', '30d',        '30 días',                         TRUE, 3, TRUE),
    (kesa_id, 'condicion_pago', '45d',        '45 días',                         TRUE, 4, FALSE),
    (kesa_id, 'condicion_pago', '60d',        '60 días',                         TRUE, 5, FALSE),
    (kesa_id, 'condicion_pago', '90d',        '90 días',                         TRUE, 6, FALSE),
    (kesa_id, 'condicion_pago', 'anticipo50', '50% anticipo / 50% entrega',      TRUE, 7, FALSE)
  ON CONFLICT (tenant_id, tipo, key) DO NOTHING;

  -- Formas de pago
  INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema) VALUES
    (kesa_id, 'forma_pago', 'transferencia', 'Transferencia bancaria', TRUE, 1, TRUE),
    (kesa_id, 'forma_pago', 'cheque',        'Cheque',                 TRUE, 2, FALSE),
    (kesa_id, 'forma_pago', 'efectivo',      'Efectivo',               TRUE, 3, TRUE),
    (kesa_id, 'forma_pago', 'deposito',      'Depósito en cuenta',    TRUE, 4, FALSE),
    (kesa_id, 'forma_pago', 'detraccion',    'Cuenta de detracción',  TRUE, 5, FALSE)
  ON CONFLICT (tenant_id, tipo, key) DO NOTHING;

  -- Tipos de comprobante
  INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema) VALUES
    (kesa_id, 'tipo_comprobante', 'factura',      'Factura',                 TRUE, 1, TRUE),
    (kesa_id, 'tipo_comprobante', 'boleta',       'Boleta de venta',         TRUE, 2, TRUE),
    (kesa_id, 'tipo_comprobante', 'recibo',       'Recibo por honorarios',   TRUE, 3, TRUE),
    (kesa_id, 'tipo_comprobante', 'nc',           'Nota de crédito',        TRUE, 4, FALSE),
    (kesa_id, 'tipo_comprobante', 'nd',           'Nota de débito',         TRUE, 5, FALSE),
    (kesa_id, 'tipo_comprobante', 'liquidacion',  'Liquidación de compra',  TRUE, 6, FALSE)
  ON CONFLICT (tenant_id, tipo, key) DO NOTHING;

  -- Zonas IGV
  INSERT INTO catalogos (tenant_id, tipo, key, label, descripcion, activo, orden, es_sistema) VALUES
    (kesa_id, 'zona_igv', 'general',  'Régimen general (18%)', 'IGV 18% aplicable en la mayoría de regiones', TRUE, 1, TRUE),
    (kesa_id, 'zona_igv', 'amazonia', 'Amazonía (0%)',          'Loreto, Ucayali, San Martín, Madre de Dios — Ley 27037', TRUE, 2, TRUE),
    (kesa_id, 'zona_igv', 'selva',    'Selva alta (8%)',        'Zonas de selva alta — tasa reducida', TRUE, 3, TRUE)
  ON CONFLICT (tenant_id, tipo, key) DO NOTHING;

  -- Bancos
  INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema) VALUES
    (kesa_id, 'banco', 'bcp',        'BCP',                 TRUE, 1, TRUE),
    (kesa_id, 'banco', 'bbva',       'BBVA',                TRUE, 2, TRUE),
    (kesa_id, 'banco', 'scotiabank', 'Scotiabank',          TRUE, 3, TRUE),
    (kesa_id, 'banco', 'interbank',  'Interbank',           TRUE, 4, TRUE),
    (kesa_id, 'banco', 'banbif',     'BanBif',              TRUE, 5, FALSE),
    (kesa_id, 'banco', 'pichincha',  'Banco Pichincha',     TRUE, 6, FALSE),
    (kesa_id, 'banco', 'mibanco',    'Mibanco',             TRUE, 7, FALSE),
    (kesa_id, 'banco', 'nacion',     'Banco de la Nación',  TRUE, 8, TRUE)
  ON CONFLICT (tenant_id, tipo, key) DO NOTHING;
END;
$$;
