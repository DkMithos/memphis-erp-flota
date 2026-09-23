-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260630152833  name: proyectos_sincerar_codigos_fase_convenio

-- 1) Nuevas columnas
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_firma_convenio date;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS codigo_inversion text;      -- CIU (código de inversión / CUI)
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS monto_cobrado numeric DEFAULT 0;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fase text;                  -- bucket macro
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS situacion text;             -- estado operativo

COMMENT ON COLUMN proyectos.fecha_firma_convenio IS 'Fecha de firma del Convenio de Inversión (BASE DOCUMENTARIA). El año define la cohorte/código del proyecto.';
COMMENT ON COLUMN proyectos.codigo_inversion IS 'Código Único de Inversión (CIU/CUI) del proyecto.';
COMMENT ON COLUMN proyectos.fase IS 'Bucket macro del ciclo: idea | actos_previos | ejecucion | post_ejecucion';
COMMENT ON COLUMN proyectos.situacion IS 'Estado operativo: activo | suspension | revision_estado | arbitraje | plazo_vencido | liquidacion';

-- constraints permisivos
DO $$ BEGIN
  ALTER TABLE proyectos ADD CONSTRAINT proyectos_fase_check
    CHECK (fase IS NULL OR fase IN ('idea','actos_previos','ejecucion','post_ejecucion'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE proyectos ADD CONSTRAINT proyectos_situacion_check
    CHECK (situacion IS NULL OR situacion IN ('activo','suspension','revision_estado','arbitraje','plazo_vencido','liquidacion','observado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Sincerar los 7 proyectos en ejecución + ICA (por código actual)
UPDATE proyectos SET codigo='01CUSMUN24', codigo_inversion='2619427', fecha_firma_convenio='2024-11-11',
  monto_cobrado=6009107.76, fase='ejecucion', situacion='revision_estado', estado='en_ejecucion'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-004';

UPDATE proyectos SET codigo='02CUSAMB25', codigo_inversion='2648922', fecha_firma_convenio='2025-03-17',
  monto_cobrado=0, fase='ejecucion', situacion='revision_estado', estado='en_ejecucion'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-005';

UPDATE proyectos SET codigo='03HNCPNP25', codigo_inversion='2623368', fecha_firma_convenio='2025-06-09',
  monto_cobrado=4726500, fase='ejecucion', situacion='revision_estado', estado='en_ejecucion'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-001';

UPDATE proyectos SET codigo='04LORBOM25', codigo_inversion='2652192', fecha_firma_convenio='2025-06-15',
  monto_cobrado=16543724.49, fase='ejecucion', situacion='activo', estado='en_ejecucion',
  monto_contrato=43865818.59, monto_adenda=0
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-003';

UPDATE proyectos SET codigo='05AMAPNP25', codigo_inversion='2671067', fecha_firma_convenio='2025-07-08',
  monto_cobrado=0, fase='ejecucion', situacion='activo', estado='en_ejecucion'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-002';

UPDATE proyectos SET codigo='06CUSPNP25', codigo_inversion='2596176', fecha_firma_convenio='2025-07-15',
  monto_cobrado=9563294.99, fase='ejecucion', situacion='suspension', estado='en_ejecucion'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-006';

UPDATE proyectos SET codigo='07CUSHAM26', codigo_inversion='2603112', fecha_firma_convenio='2026-01-26',
  monto_cobrado=0, fase='ejecucion', situacion='activo', estado='en_ejecucion',
  region='Cusco', entidad_cliente='GORE CUSCO', fecha_inicio='2026-04-21'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-008';

-- ICA: post-ejecución / liquidación. Convenio/CIU/cobrado pendientes (no están en RESUMEN PROYECTOS).
UPDATE proyectos SET codigo='ICAPNP', fase='post_ejecucion', situacion='liquidacion', estado='liquidacion'
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND codigo='PRY-2026-007';

-- 3) Proyectos del pipeline (idea / actos previos) para poblar los buckets
INSERT INTO proyectos (id, tenant_id, codigo, nombre, tipo, estado, prioridad, moneda, fase, situacion, region, entidad_cliente, modalidad, creado_por)
VALUES
 (gen_random_uuid(),'e4b16a80-8500-418e-afaa-0e976b7d9b13','SMARTMOVS','GORE SAN MARTIN - MOVIL SALUD','cliente','planificacion','media','PEN','idea',NULL,'San Martín','GORE SAN MARTÍN','oxi','sinceramiento'),
 (gen_random_uuid(),'e4b16a80-8500-418e-afaa-0e976b7d9b13','LORMOVS','GORE LORETO - MOVIL SALUD','cliente','planificacion','media','PEN','idea',NULL,'Loreto','GORE LORETO','oxi','sinceramiento'),
 (gen_random_uuid(),'e4b16a80-8500-418e-afaa-0e976b7d9b13','SMARTBOM','GORE SAN MARTIN - BOMBEROS','cliente','planificacion','media','PEN','actos_previos',NULL,'San Martín','GORE SAN MARTÍN','oxi','sinceramiento')
ON CONFLICT DO NOTHING;
