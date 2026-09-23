-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260624043442  name: bloquear_gastos_en_caja_cerrada

CREATE OR REPLACE FUNCTION block_gasto_caja_cerrada() RETURNS trigger AS $$
DECLARE est text;
BEGIN
  SELECT estado INTO est FROM cajas_chicas WHERE id = NEW.caja_id;
  IF est = 'cerrada' THEN
    RAISE EXCEPTION 'No se pueden registrar movimientos en una caja CERRADA'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_gasto_caja_cerrada ON gastos_caja_chica;
CREATE TRIGGER trg_block_gasto_caja_cerrada BEFORE INSERT ON gastos_caja_chica
  FOR EACH ROW EXECUTE FUNCTION block_gasto_caja_cerrada();

DROP TRIGGER IF EXISTS trg_block_ingreso_caja_cerrada ON ingresos_caja_chica;
CREATE TRIGGER trg_block_ingreso_caja_cerrada BEFORE INSERT ON ingresos_caja_chica
  FOR EACH ROW EXECUTE FUNCTION block_gasto_caja_cerrada();
