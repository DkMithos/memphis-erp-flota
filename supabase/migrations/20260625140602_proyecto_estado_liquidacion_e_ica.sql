-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260625140602  name: proyecto_estado_liquidacion_e_ica

-- Agregar 'liquidacion' a los estados válidos de proyecto
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_estado_check;
ALTER TABLE proyectos ADD CONSTRAINT proyectos_estado_check
  CHECK (estado = ANY (ARRAY['planificacion','en_ejecucion','pausado','completado','cancelado','liquidacion']));

-- GORE ICA - PNP está en liquidación, no en ejecución
UPDATE proyectos SET estado='liquidacion'
WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND id='7d93c394-dc25-4dd2-8ab3-f966340f9cc5';
