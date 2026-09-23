-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260630152623  name: oc_tipo_cambio_por_orden

-- Tipo de cambio por orden (canónico). Ideal: SBS/SUNAT del día de emisión.
-- Fallback actual: TC real por OC migrado del Excel de operaciones (3.40 / 3.45).
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS tipo_cambio numeric;
COMMENT ON COLUMN ordenes_compra.tipo_cambio IS
  'Tipo de cambio USD->PEN aplicado a la orden (rate del día de emisión, SBS/SUNAT). Migrados: 3.40/3.45 del Excel de operaciones. NULL para órdenes en PEN.';

-- Poblar órdenes USD migradas con su TC real
UPDATE ordenes_compra
   SET tipo_cambio = 3.40
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13'
   AND moneda='USD' AND tipo_cambio IS NULL;

-- Las 22 órdenes con TC 3.45
UPDATE ordenes_compra
   SET tipo_cambio = 3.45
 WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13'
   AND moneda='USD'
   AND numero IN ('MM-000265','MM-000280','MM-000302','MM-000317','MM-000318','MM-000319',
                  'MM-000320','MM-000337','MM-000343','MM-000344','MM-000363','MM-000365',
                  'MM-000371','MM-000372','MM-000378','MM-000379','MM-000383','MM-000398',
                  'MM-000462','MM-000463','MM-000640','MM-000748');
