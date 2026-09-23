-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260807204737  name: flota_n27_alta_vehiculos_amazonas


-- N27 punto 10 (parte 2/2): alta de los 24 vehiculos de GORE AMAZONAS - PNP
-- (23 motos Hero XPulse + 1 bus Mitsubishi Fuso). No existian en la DB: el
-- Excel vehiculos_data.xlsx trae 410 y la DB tenia 386. Codigo derivado del VIN
-- (mismo criterio que la carga por Excel del modulo Flota). Idempotente por VIN.
INSERT INTO vehiculos (
  tenant_id, proyecto_id, flota_id, tipo_flota, es_administrativo,
  codigo, vin, placa, tipo, marca, modelo, anio, color, motor,
  combustible, capacidad, kilometraje, ubicacion_actual, estado
)
SELECT
  f.tenant_id, f.proyecto_id, f.id, f.tipo, false,
  d.codigo, d.vin, d.placa, d.tipo, d.marca, d.modelo, d.anio, d.color, d.motor,
  d.combustible, d.capacidad, d.km, d.ubicacion, d.estado
FROM (VALUES
  ('VEH-AMABUS-K31577', 'JLBBE63DJSRK31577', NULL, 'bus', 'Mitsubishi', 'MITSUBISHI FUSO', 2025, 'Verde', '4M50E88751', 'diesel', '32+1', 0, 'Amazonas', 'inactivo', 'FL-AMA-BUS'),
  ('VEH-AMAMOT-T00095', 'MBLLDL021TGT00095', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABRGL00144', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00091', 'MBLLDL024TGT00091', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00035', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00105', 'MBLLDL020TGT00105', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00022', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00011', 'MBLLDL022TGT00011', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00015', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00062', 'MBLLDL028TGT00062', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00105', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00039', 'MBLLDL022TGT00039', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00063', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00101', 'MBLLDL023TGT00101', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00077', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00019', 'MBLLDL027TGT00019', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00021', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00029', 'MBLLDL02XTGT00029', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00054', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00060', 'MBLLDL024TGT00060', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00104', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00004', 'MBLLDL025TGT00004', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00047', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00107', 'MBLLDL024TGT00107', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00030', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00031', 'MBLLDL028TGT00031', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00045', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00092', 'MBLLDL026TGT00092', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00032', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00046', 'MBLLDL02XTGT00046', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00079', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00008', 'MBLLDL022TGT00008', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00010', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00014', 'MBLLDL028TGT00014', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00013', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00010', 'MBLLDL020TGT00010', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00008', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00093', 'MBLLDL028TGT00093', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABRGL00096', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00069', 'MBLLDL020TGT00069', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00107', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00037', 'MBLLDL029TGT00037', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00049', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00100', 'MBLLDL021TGT00100', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00076', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT'),
  ('VEH-AMAMOT-T00061', 'MBLLDL026TGT00061', NULL, 'moto', 'Hero', 'MOTOCICLETA XPULSE 200 ADVANCE', 2026, 'Blanca', 'MC20ABSGF00103', 'gasolina', '2 pasajeros', 0, 'Amazonas', 'inactivo', 'FL-AMA-MOT')
) AS d(codigo, vin, placa, tipo, marca, modelo, anio, color, motor, combustible, capacidad, km, ubicacion, estado, flota_codigo)
JOIN flotas f ON f.codigo = d.flota_codigo
  AND f.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
WHERE NOT EXISTS (
  SELECT 1 FROM vehiculos v2
  WHERE v2.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
    AND upper(trim(v2.vin)) = d.vin
);

