-- =============================================================================
-- Migration: Crear proveedores/talleres para mantenimientos Ica
-- Memphis ERP — Carga histórica Commit 3
-- Fecha: 2026-05-25
-- =============================================================================
-- RESUMEN:
--   Crear 7 proveedores (talleres) que aparecen en los Excel de mantenimiento:
--   - 6 talleres de motos (del Excel "Cumplimiento mantenimientos preventivo Motos")
--   - 1 concesionario camionetas (del Excel "CONTROL DE MANTENIMIENTO CAMIONETAS ICA")
--
--   Talleres motos:
--     PROV-0001  IMPORTACIONES P&CIA S.R.L
--     PROV-0002  ARIFE E.I.R.L
--     PROV-0003  7 FALCON E.I.R.L
--     PROV-0004  AQR MOTORS
--     PROV-0005  MOTO Y SERVICIOS ABIGAIL
--     PROV-0006  EL CHINO RAPID SERVICE EIRL
--   Concesionario camionetas:
--     PROV-0007  PERUMOTOR S.A.C (concesionario Mitsubishi - Ica)
-- =============================================================================

BEGIN;

-- Conteo previo
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM proveedores
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
  RAISE NOTICE 'Proveedores ANTES: %', v_count;
END $$;

-- 1. IMPORTACIONES P&CIA S.R.L — taller de motos
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0001',
  'IMPORTACIONES P&CIA S.R.L',
  'IMPORTACIONES P&CIA',
  '20000000001',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- 2. ARIFE E.I.R.L — taller de motos
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0002',
  'ARIFE E.I.R.L',
  'ARIFE',
  '20000000002',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- 3. 7 FALCON E.I.R.L — taller de motos
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0003',
  '7 FALCON E.I.R.L',
  '7 FALCON',
  '20000000003',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- 4. AQR MOTORS — taller de motos
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0004',
  'AQR MOTORS',
  'AQR MOTORS',
  '20000000004',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- 5. MOTO Y SERVICIOS ABIGAIL — taller de motos
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0005',
  'MOTO Y SERVICIOS ABIGAIL',
  'MOTO Y SERVICIOS ABIGAIL',
  '20000000005',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- 6. EL CHINO RAPID SERVICE EIRL — taller de motos
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0006',
  'EL CHINO RAPID SERVICE EIRL',
  'EL CHINO RAPID SERVICE',
  '20000000006',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- 7. PERUMOTOR S.A.C — concesionario Mitsubishi (camionetas L200)
INSERT INTO proveedores (
  tenant_id, codigo, razon_social, nombre_comercial, ruc,
  tipo, categoria, estado, condicion,
  departamento, provincia, distrito,
  creado_en
) VALUES (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'PROV-0007',
  'PERUMOTOR S.A.C',
  'PERUMOTOR',
  '20000000007',
  'servicios',
  'taller',
  'activo',
  'sin_evaluar',
  'Ica', 'Ica', 'Ica',
  NOW()
);

-- Verificación final
DO $$
DECLARE
  v_total INT;
  v_talleres INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM proveedores
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

  SELECT COUNT(*) INTO v_talleres FROM proveedores
  WHERE tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
    AND categoria = 'taller';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN COMMIT 3';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total proveedores: % (esperado: 7)', v_total;
  RAISE NOTICE 'Talleres: % (esperado: 7)', v_talleres;
  RAISE NOTICE '========================================';

  IF v_talleres != 7 THEN
    RAISE EXCEPTION 'ERROR: Se esperaban 7 talleres, hay %!', v_talleres;
  END IF;
END $$;

COMMIT;
