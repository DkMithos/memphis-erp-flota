-- ===========================================================================
-- SPRINT 1 GERENCIA: Agregar proyecto_id a equipos_biomedicos
-- Permite asociar equipos biomédicos a proyectos
-- ===========================================================================

ALTER TABLE equipos_biomedicos
  ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES proyectos(id);

CREATE INDEX IF NOT EXISTS idx_equipos_bio_proyecto
  ON equipos_biomedicos(proyecto_id)
  WHERE proyecto_id IS NOT NULL;
