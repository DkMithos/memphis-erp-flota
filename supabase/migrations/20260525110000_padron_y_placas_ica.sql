-- =============================================================================
-- Migration: Agregar numero_padron + actualizar placas camionetas Ica
-- Memphis ERP — Carga histórica Commit 2
-- Fecha: 2026-05-25
-- =============================================================================
-- RESUMEN:
--   1. Agregar columna numero_padron (TEXT) a vehiculos — identificador de padrón
--      para motos (Ej: 112, 110) que no tienen placa vehicular
--   2. Actualizar placa de 50 camionetas Ica usando datos del Excel
--      "CONTROL DE MANTENIMIENTO DE CAMIONETAS ICA.xlsx"
--      Match: VIN del Excel → VIN de la DB
--      Placas: formato EPI-NNN o EPH-NNN (placas policiales PNP)
-- =============================================================================

BEGIN;

-- Conteo previo
DO $$
DECLARE
  v_sin_placa INT;
BEGIN
  SELECT COUNT(*) INTO v_sin_placa FROM vehiculos
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
    AND tipo = 'camioneta'
    AND ubicacion_actual = 'Ica'
    AND placa IS NULL;
  RAISE NOTICE 'Camionetas Ica SIN placa ANTES: %', v_sin_placa;
END $$;

-- 1. Agregar columna numero_padron (para motos, usado en Commit 4)
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS numero_padron TEXT;
COMMENT ON COLUMN vehiculos.numero_padron IS 'Número de padrón asignado al vehículo (usado en motos PNP que no tienen placa vehicular)';

-- 2. Actualizar placas de 50 camionetas Ica (VIN → placa del Excel)
UPDATE vehiculos SET placa = 'EPI-013', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002637' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-005', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002647' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-995', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002674' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-006', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002702' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-014', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002709' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-004', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002745' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-009', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002752' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-021', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002776' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-012', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002782' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-022', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002786' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-016', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002788' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-003', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002791' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-017', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002795' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-027', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002799' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-031', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002803' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-030', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002805' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-029', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002811' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-002', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002815' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-015', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002821' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-011', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002824' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-028', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002828' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-007', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002833' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-010', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002840' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-008', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002857' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-989', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002862' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-990', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002866' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-020', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH002872' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-997', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013608' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-019', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013613' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-998', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013620' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-023', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013679' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-026', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013694' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-000', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013719' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-992', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013801' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-024', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013842' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-999', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013858' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-991', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH013969' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-996', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014005' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-993', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014308' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-982', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014409' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-983', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014440' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-994', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014480' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-001', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014534' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-988', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014589' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-987', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014667' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-986', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014683' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-985', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014746' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-018', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014765' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPI-025', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014769' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
UPDATE vehiculos SET placa = 'EPH-984', modificado_en = NOW() WHERE vin = 'MMBJJLC10SH014789' AND tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

-- Verificación final
DO $$
DECLARE
  v_sin_placa INT;
  v_con_placa INT;
  v_tiene_padron BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_sin_placa FROM vehiculos
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
    AND tipo = 'camioneta'
    AND ubicacion_actual = 'Ica'
    AND placa IS NULL;

  SELECT COUNT(*) INTO v_con_placa FROM vehiculos
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
    AND tipo = 'camioneta'
    AND ubicacion_actual = 'Ica'
    AND placa IS NOT NULL;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehiculos' AND column_name = 'numero_padron'
  ) INTO v_tiene_padron;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN COMMIT 2';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Columna numero_padron existe: %', v_tiene_padron;
  RAISE NOTICE 'Camionetas Ica CON placa: % (esperado: 50)', v_con_placa;
  RAISE NOTICE 'Camionetas Ica SIN placa: % (esperado: 0)', v_sin_placa;
  RAISE NOTICE '========================================';

  IF v_sin_placa != 0 THEN
    RAISE EXCEPTION 'ERROR: Quedan % camionetas Ica sin placa!', v_sin_placa;
  END IF;
  IF NOT v_tiene_padron THEN
    RAISE EXCEPTION 'ERROR: Columna numero_padron no fue creada!';
  END IF;
END $$;

COMMIT;
