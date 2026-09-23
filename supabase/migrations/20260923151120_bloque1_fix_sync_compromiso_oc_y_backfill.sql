-- Migración aplicada en producción vía Supabase (2026-09-23).
-- version: 20260923151120  name: bloque1_fix_sync_compromiso_oc_y_backfill
--
-- Corrigió sync_compromiso_de_oc: la variable record se llamaba igual que el
-- alias de la tabla ("o") y PL/pgSQL la resolvía como el record sin asignar.
-- Corre en el trigger de OC, así que sin esto ninguna OC podía aprobarse.
-- La función quedó reemplazada por la versión definitiva de 20260923151242
-- (misma lógica + regla cxp_desde), que es la que se conserva aquí como
-- referencia; el backfill de esta migración también se repitió allí.

drop trigger if exists trg_oc_compromiso on public.ordenes_compra;
create trigger trg_oc_compromiso
  after insert or update of estado, total, moneda, tipo_cambio, fecha_vencimiento_pago, proyecto_id, centro_costo_id, proveedor_id
  on public.ordenes_compra for each row execute function public.trg_oc_compromiso();
