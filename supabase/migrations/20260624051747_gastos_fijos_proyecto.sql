-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260624051747  name: gastos_fijos_proyecto

CREATE TABLE IF NOT EXISTS gastos_fijos_proyecto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  concepto text NOT NULL,        -- consultoria | contraprestacion | ir_mensual | venta_ciprl
  descripcion text NOT NULL,
  porcentaje numeric NOT NULL,
  base text NOT NULL DEFAULT 'contrato_total',
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'PEN',
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, concepto)
);
ALTER TABLE gastos_fijos_proyecto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ti_gastos_fijos ON gastos_fijos_proyecto;
CREATE POLICY ti_gastos_fijos ON gastos_fijos_proyecto FOR ALL USING (tenant_id = auth_tenant_id());
CREATE INDEX IF NOT EXISTS idx_gfijo_proyecto ON gastos_fijos_proyecto(proyecto_id);

-- Recalcula los 4 gastos fijos de un proyecto = % × (monto_contrato + monto_adenda)
CREATE OR REPLACE FUNCTION recalc_gastos_fijos_proyecto(p_id uuid) RETURNS void AS $$
DECLARE base numeric; t_id uuid; mon text;
BEGIN
  SELECT (coalesce(monto_contrato,0)+coalesce(monto_adenda,0)), tenant_id, coalesce(moneda,'PEN')
    INTO base, t_id, mon FROM proyectos WHERE id = p_id;
  IF t_id IS NULL THEN RETURN; END IF;
  DELETE FROM gastos_fijos_proyecto WHERE proyecto_id = p_id;
  IF base IS NULL OR base = 0 THEN RETURN; END IF;
  INSERT INTO gastos_fijos_proyecto (tenant_id, proyecto_id, concepto, descripcion, porcentaje, base, monto, moneda) VALUES
    (t_id, p_id, 'consultoria',      'Servicio de consultoría',  0.100, 'contrato_total', round(base*0.100,2), mon),
    (t_id, p_id, 'contraprestacion', 'Contraprestación privada', 0.050, 'contrato_total', round(base*0.050,2), mon),
    (t_id, p_id, 'ir_mensual',       'Pago a cuenta IR mensual', 0.035, 'contrato_total', round(base*0.035,2), mon),
    (t_id, p_id, 'venta_ciprl',      'Venta de CIPRL',           0.040, 'contrato_total', round(base*0.040,2), mon);
END; $$ LANGUAGE plpgsql;

-- Trigger: recalcular cuando cambie el contrato del proyecto
CREATE OR REPLACE FUNCTION trg_recalc_gastos_fijos() RETURNS trigger AS $$
BEGIN PERFORM recalc_gastos_fijos_proyecto(NEW.id); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_proyecto_gastos_fijos ON proyectos;
CREATE TRIGGER trg_proyecto_gastos_fijos AFTER INSERT OR UPDATE OF monto_contrato, monto_adenda ON proyectos
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_gastos_fijos();

-- Poblar para todos los proyectos existentes
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM proyectos WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' LOOP
    PERFORM recalc_gastos_fijos_proyecto(r.id);
  END LOOP;
END$$;
