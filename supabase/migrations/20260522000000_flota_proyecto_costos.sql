-- =============================================================================
-- MIGRACIÓN: Flota → Proyecto + Tipo Flota + Costos Plan Preventivo
-- Fecha: 2026-05-22
-- Descripción:
--   1. Agrega proyecto_id y tipo_flota a vehículos
--   2. Agrega campos de costo al plan preventivo (costo total contratado y por servicio)
--   3. Agrega nuevos tipos de catálogo configurables
-- =============================================================================

-- 1. Nuevas columnas en vehiculos
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo_flota TEXT; -- configurable desde catálogos admin
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS plan_preventivo_costo_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS plan_preventivo_costo_por_servicio NUMERIC(12,2) DEFAULT 0;

-- 2. Índice para consultas por proyecto
CREATE INDEX IF NOT EXISTS idx_vehiculos_proyecto_id ON vehiculos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_tipo_flota ON vehiculos(tipo_flota);

-- 3. Seed de catálogos configurables nuevos (si la tabla catalogos existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalogos') THEN
    -- Tipos de Vehículo
    INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema)
    SELECT t.id, 'tipo_vehiculo', v.key, v.label, true, v.orden, v.es_sistema
    FROM tenants t,
    (VALUES
      ('ambulancia', 'Ambulancia', 1, true),
      ('camioneta', 'Camioneta', 2, true),
      ('motocicleta', 'Motocicleta', 3, true),
      ('van', 'Van', 4, true),
      ('auto', 'Auto', 5, true),
      ('patrullero', 'Patrullero', 6, false),
      ('hidro_ambulancia', 'Hidro Ambulancia', 7, false),
      ('hidro_patrulla', 'Hidro Patrulla', 8, false),
      ('camioneta_supervision', 'Camioneta de Supervisión', 9, false),
      ('otro', 'Otro', 10, true)
    ) AS v(key, label, orden, es_sistema)
    ON CONFLICT DO NOTHING;

    -- Tipos de Flota (categoría de uso en proyecto)
    INSERT INTO catalogos (tenant_id, tipo, key, label, descripcion, activo, orden, es_sistema)
    SELECT t.id, 'tipo_flota', v.key, v.label, v.desc, true, v.orden, v.es_sistema
    FROM tenants t,
    (VALUES
      ('patrulleros', 'Patrulleros', 'Vehículos de patrullaje', 1, true),
      ('ambulancias', 'Ambulancias', 'Ambulancias terrestres', 2, true),
      ('hidro_ambulancias', 'Hidro Ambulancias', 'Ambulancias acuáticas', 3, false),
      ('hidro_patrullas', 'Hidro Patrullas', 'Patrullas acuáticas', 4, false),
      ('supervision', 'Supervisión', 'Camionetas de supervisión', 5, false),
      ('carga', 'Carga', 'Vehículos de carga', 6, false),
      ('otro', 'Otro', 'Otros tipos de flota', 7, true)
    ) AS v(key, label, desc, orden, es_sistema)
    ON CONFLICT DO NOTHING;

    -- Tipos de Contrato Flota
    INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema)
    SELECT t.id, 'tipo_contrato_flota', v.key, v.label, true, v.orden, v.es_sistema
    FROM tenants t,
    (VALUES
      ('solo_garantia', 'Solo Garantía', 1, true),
      ('mantenimiento_y_garantia', 'Mantenimiento + Garantía', 2, true),
      ('solo_mantenimiento', 'Solo Mantenimiento', 3, true),
      ('full_service', 'Full Service', 4, true),
      ('otro', 'Otro', 5, true)
    ) AS v(key, label, orden, es_sistema)
    ON CONFLICT DO NOTHING;

    -- Tipos de Documento Vehículo
    INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema)
    SELECT t.id, 'tipo_doc_vehiculo', v.key, v.label, true, v.orden, v.es_sistema
    FROM tenants t,
    (VALUES
      ('SOAT', 'SOAT', 1, true),
      ('REVISION_TECNICA', 'Revisión Técnica', 2, true),
      ('TARJETA_PROPIEDAD', 'Tarjeta de Propiedad', 3, true),
      ('SEGURO_VEHICULAR', 'Seguro Vehicular', 4, true),
      ('PERMISO_OPERACION', 'Permiso de Operación', 5, true),
      ('OTRO', 'Otro', 6, true)
    ) AS v(key, label, orden, es_sistema)
    ON CONFLICT DO NOTHING;

    -- Categorías de Proveedor
    INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema)
    SELECT t.id, 'categoria_proveedor', v.key, v.label, true, v.orden, v.es_sistema
    FROM tenants t,
    (VALUES
      ('repuestos', 'Repuestos', 1, true),
      ('taller', 'Taller', 2, true),
      ('combustible', 'Combustible', 3, true),
      ('seguros', 'Seguros', 4, true),
      ('equipos_medicos', 'Equipos Médicos', 5, true),
      ('insumos', 'Insumos', 6, true),
      ('servicios_profesionales', 'Servicios Profesionales', 7, true),
      ('construccion', 'Construcción', 8, false),
      ('tecnologia', 'Tecnología', 9, false),
      ('otros', 'Otros', 10, true)
    ) AS v(key, label, orden, es_sistema)
    ON CONFLICT DO NOTHING;

    -- Categorías de Equipo Biomédico
    INSERT INTO catalogos (tenant_id, tipo, key, label, activo, orden, es_sistema)
    SELECT t.id, 'categoria_equipo_bio', v.key, v.label, true, v.orden, v.es_sistema
    FROM tenants t,
    (VALUES
      ('diagnostico', 'Diagnóstico', 1, true),
      ('terapeutico', 'Terapéutico', 2, true),
      ('soporte_vital', 'Soporte Vital', 3, true),
      ('laboratorio', 'Laboratorio', 4, true),
      ('rehabilitacion', 'Rehabilitación', 5, true),
      ('imagenologia', 'Imagenología', 6, false),
      ('odontologia', 'Odontología', 7, false)
    ) AS v(key, label, orden, es_sistema)
    ON CONFLICT DO NOTHING;

  END IF;
END $$;
