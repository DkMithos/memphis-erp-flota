-- =============================================================================
-- Migration: Crear proyecto GORE ICA - PNP y asignar TODOS los vehículos a proyectos
-- Memphis ERP — Carga histórica Commit 1
-- Fecha: 2026-05-25
-- =============================================================================
-- RESUMEN:
--   1. Crear proyecto PRY-2026-007 GORE ICA - PNP
--   2. Asignar 200 motos Ica + 50 camionetas Ica -> GORE ICA
--   3. Asignar 23 camionetas Huánuco -> GORE HUÁNUCO
--   4. Asignar 46 camionetas Cusco -> GORE CUSCO PNP
--   5. Asignar 59 ambulancias Cusco -> GORE CUSCO AMBULANCIAS
--   6. Asignar 8 camionetas Loreto -> GORE LORETO BOMBEROS
-- =============================================================================

BEGIN;

-- Guardar conteo previo para verificación
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM vehiculos
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND proyecto_id IS NULL;
  RAISE NOTICE 'Vehículos sin proyecto ANTES: %', v_count;
END $$;

-- 1. Crear proyecto GORE ICA - PNP
-- ID generado: 7d93c394-dc25-4dd2-8ab3-f966340f9cc5
INSERT INTO proyectos (
  tenant_id, codigo, nombre, estado, prioridad, porcentaje_avance,
  fecha_inicio, fecha_fin_estimada, moneda,
  entidad_cliente, region,
  creado_por, creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PRY-2026-007',
  'GORE ICA - PNP',
  'en_ejecucion',
  'alta',
  50,
  '2025-01-01',
  '2026-12-31',
  'PEN',
  'Gobierno Regional de Ica',
  'Ica',
  'system',
  NOW()
);

-- 2. Asignar motos Ica (200) -> GORE ICA - PNP
UPDATE vehiculos
SET proyecto_id = (SELECT id FROM proyectos WHERE codigo = 'PRY-2026-007' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'),
    modificado_en = NOW()
WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  AND tipo = 'motocicleta'
  AND ubicacion_actual = 'Ica'
  AND proyecto_id IS NULL;

-- 3. Asignar camionetas Ica (50) -> GORE ICA - PNP
UPDATE vehiculos
SET proyecto_id = (SELECT id FROM proyectos WHERE codigo = 'PRY-2026-007' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'),
    modificado_en = NOW()
WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  AND tipo = 'camioneta'
  AND ubicacion_actual = 'Ica'
  AND proyecto_id IS NULL;

-- 4. Asignar camionetas Huánuco (23) -> PRY-2026-001 GORE HUÁNUCO - PNP
UPDATE vehiculos
SET proyecto_id = 'cd49baae-b857-4c36-ab54-26ca1f2047bd',
    modificado_en = NOW()
WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  AND tipo = 'camioneta'
  AND ubicacion_actual = 'Huanuco'
  AND proyecto_id IS NULL;

-- 5. Asignar camionetas Cusco (46) -> PRY-2026-006 GORE CUSCO - PNP
UPDATE vehiculos
SET proyecto_id = '6fb8525e-58b7-4936-8337-38d9585248c8',
    modificado_en = NOW()
WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  AND tipo = 'camioneta'
  AND ubicacion_actual = 'Cusco'
  AND proyecto_id IS NULL;

-- 6. Asignar ambulancias Cusco (59) -> PRY-2026-005 GORE CUSCO - AMBULANCIAS
UPDATE vehiculos
SET proyecto_id = '9ba5ad0b-3710-40cb-ad82-324c03048fdd',
    modificado_en = NOW()
WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  AND tipo = 'ambulancia'
  AND ubicacion_actual = 'Cusco'
  AND proyecto_id IS NULL;

-- 7. Asignar camionetas Loreto (8) -> PRY-2026-003 GORE LORETO - BOMBEROS
UPDATE vehiculos
SET proyecto_id = '4a72a7c0-f816-458e-b5b0-184823136107',
    modificado_en = NOW()
WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  AND tipo = 'camioneta'
  AND ubicacion_actual = 'Loreto'
  AND proyecto_id IS NULL;

-- Verificación final
DO $$
DECLARE
  v_sin_proy INT;
  v_con_proy INT;
  v_ica INT;
  v_huanuco INT;
  v_cusco_pnp INT;
  v_cusco_ambu INT;
  v_loreto INT;
BEGIN
  SELECT COUNT(*) INTO v_sin_proy FROM vehiculos
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND proyecto_id IS NULL;

  SELECT COUNT(*) INTO v_con_proy FROM vehiculos
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND proyecto_id IS NOT NULL;

  SELECT COUNT(*) INTO v_ica FROM vehiculos v
  JOIN proyectos p ON v.proyecto_id = p.id
  WHERE v.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND p.codigo = 'PRY-2026-007';

  SELECT COUNT(*) INTO v_huanuco FROM vehiculos v
  JOIN proyectos p ON v.proyecto_id = p.id
  WHERE v.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND p.codigo = 'PRY-2026-001';

  SELECT COUNT(*) INTO v_cusco_pnp FROM vehiculos v
  JOIN proyectos p ON v.proyecto_id = p.id
  WHERE v.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND p.codigo = 'PRY-2026-006';

  SELECT COUNT(*) INTO v_cusco_ambu FROM vehiculos v
  JOIN proyectos p ON v.proyecto_id = p.id
  WHERE v.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND p.codigo = 'PRY-2026-005';

  SELECT COUNT(*) INTO v_loreto FROM vehiculos v
  JOIN proyectos p ON v.proyecto_id = p.id
  WHERE v.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' AND p.codigo = 'PRY-2026-003';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN POST-MIGRATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Vehículos SIN proyecto: % (esperado: 0)', v_sin_proy;
  RAISE NOTICE 'Vehículos CON proyecto: % (esperado: 386)', v_con_proy;
  RAISE NOTICE 'GORE ICA: % (esperado: 250)', v_ica;
  RAISE NOTICE 'GORE HUÁNUCO: % (esperado: 23)', v_huanuco;
  RAISE NOTICE 'GORE CUSCO PNP: % (esperado: 46)', v_cusco_pnp;
  RAISE NOTICE 'GORE CUSCO AMBULANCIAS: % (esperado: 59)', v_cusco_ambu;
  RAISE NOTICE 'GORE LORETO: % (esperado: 8)', v_loreto;
  RAISE NOTICE '========================================';

  -- Abortar si algo no cuadra
  IF v_sin_proy != 0 THEN
    RAISE EXCEPTION 'ERROR: Quedan % vehículos sin proyecto!', v_sin_proy;
  END IF;
END $$;

COMMIT;
