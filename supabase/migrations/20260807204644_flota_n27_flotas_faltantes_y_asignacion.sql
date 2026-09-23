-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260807204644  name: flota_n27_flotas_faltantes_y_asignacion


-- N27 punto 10 (parte 1/2): crear las flotas faltantes y asignar la flota a los
-- vehiculos que ya existen pero no la tenian. Fuente: vehiculos_data.xlsx.
-- Convencion de codigo: FL-{REGION}-{TIPO}, como las flotas de ICA ya creadas.
DO $$
DECLARE
  v_tenant uuid := 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
BEGIN

INSERT INTO flotas (tenant_id, proyecto_id, codigo, nombre, tipo, descripcion)
SELECT v_tenant, p.id, x.codigo, x.nombre, x.tipo, x.descripcion
FROM (VALUES
  ('02CUSAMB25', 'FL-CUS-AMB', '59 Ambulancias - GORE CUSCO',         'ambulancia', 'Ambulancia Rural I'),
  ('06CUSPNP25', 'FL-CUS-PNP', '46 Patrulleros - GORE CUSCO',         'camioneta',  'Patrullero PNP'),
  ('03HNCPNP25', 'FL-HNC-PNP', '23 Patrulleros - GORE HUANUCO',       'camioneta',  'Patrullero PNP'),
  ('04LORBOM25', 'FL-LOR-BOM', '8 Vehiculos de rescate - GORE LORETO', 'camioneta',  'Vehiculo de rescate'),
  ('05AMAPNP25', 'FL-AMA-MOT', '23 Motos - GORE AMAZONAS',            'moto',       'Patrullero PNP (Motocicleta)'),
  ('05AMAPNP25', 'FL-AMA-BUS', '1 Bus - GORE AMAZONAS',               'bus',        'Bus del proyecto (Mitsubishi Fuso)')
) AS x(proy_codigo, codigo, nombre, tipo, descripcion)
JOIN proyectos p ON p.codigo = x.proy_codigo AND p.tenant_id = v_tenant
WHERE NOT EXISTS (SELECT 1 FROM flotas f2 WHERE f2.tenant_id = v_tenant AND f2.codigo = x.codigo);

-- Asignar flota a los vehiculos existentes sin flota (cada proyecto tiene un solo tipo)
UPDATE vehiculos v
SET flota_id = f.id, tipo_flota = f.tipo, modificado_en = now()
FROM flotas f
WHERE v.tenant_id = v_tenant
  AND v.flota_id IS NULL
  AND v.proyecto_id = f.proyecto_id
  AND f.codigo IN ('FL-CUS-AMB','FL-CUS-PNP','FL-HNC-PNP','FL-LOR-BOM');

END $$;

