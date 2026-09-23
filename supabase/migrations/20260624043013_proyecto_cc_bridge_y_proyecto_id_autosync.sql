-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260624043013  name: proyecto_cc_bridge_y_proyecto_id_autosync

-- 1) Puente CC -> proyecto (1:1 confirmado por Gerencia)
UPDATE centros_costo SET proyecto_id = m.pid
FROM (VALUES
  ('GAMAZONPNP','3892aafd-ddc3-4910-a7a8-89809541bbb2'::uuid),
  ('GCUSCOAMBU','9ba5ad0b-3710-40cb-ad82-324c03048fdd'::uuid),
  ('GCUSCOPNP','6fb8525e-58b7-4936-8337-38d9585248c8'::uuid),
  ('GHUANUCOPNP','cd49baae-b857-4c36-ab54-26ca1f2047bd'::uuid),
  ('GOREICAPNP','7d93c394-dc25-4dd2-8ab3-f966340f9cc5'::uuid),
  ('GLOREBOMBE','4a72a7c0-f816-458e-b5b0-184823136107'::uuid),
  ('MPCUSCOSERENAZGO','b9301e09-447b-49d6-a8d6-8ae9ce1a2be4'::uuid)
) AS m(codigo, pid)
WHERE centros_costo.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND centros_costo.codigo=m.codigo;

-- 2) Columna proyecto_id en OCs y gastos (denormalizada, auto-sincronizada por trigger)
ALTER TABLE ordenes_compra   ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL;
ALTER TABLE gastos_caja_chica ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_oc_proyecto ON ordenes_compra(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_gasto_cc_proyecto ON gastos_caja_chica(proyecto_id);

-- 3) Triggers: derivar proyecto_id desde el centro de costo (se mantiene solo, también para OCs nuevas)
CREATE OR REPLACE FUNCTION set_oc_proyecto_from_cc() RETURNS trigger AS $$
BEGIN
  IF NEW.centro_costo_id IS NOT NULL THEN
    SELECT proyecto_id INTO NEW.proyecto_id FROM centros_costo WHERE id = NEW.centro_costo_id;
  ELSE NEW.proyecto_id := NULL; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_oc_proyecto ON ordenes_compra;
CREATE TRIGGER trg_oc_proyecto BEFORE INSERT OR UPDATE OF centro_costo_id ON ordenes_compra
  FOR EACH ROW EXECUTE FUNCTION set_oc_proyecto_from_cc();

CREATE OR REPLACE FUNCTION set_gasto_proyecto_from_cc() RETURNS trigger AS $$
BEGIN
  IF NEW.centro_costo IS NOT NULL THEN
    SELECT proyecto_id INTO NEW.proyecto_id FROM centros_costo
      WHERE codigo = NEW.centro_costo AND tenant_id = NEW.tenant_id LIMIT 1;
  ELSE NEW.proyecto_id := NULL; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gasto_proyecto ON gastos_caja_chica;
CREATE TRIGGER trg_gasto_proyecto BEFORE INSERT OR UPDATE OF centro_costo ON gastos_caja_chica
  FOR EACH ROW EXECUTE FUNCTION set_gasto_proyecto_from_cc();

-- 4) Backfill de lo existente
UPDATE ordenes_compra o SET proyecto_id = cc.proyecto_id
  FROM centros_costo cc WHERE cc.id = o.centro_costo_id AND cc.proyecto_id IS NOT NULL;
UPDATE gastos_caja_chica g SET proyecto_id = cc.proyecto_id
  FROM centros_costo cc WHERE cc.codigo = g.centro_costo AND cc.tenant_id = g.tenant_id AND cc.proyecto_id IS NOT NULL;
