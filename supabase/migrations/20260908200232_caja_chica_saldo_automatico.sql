-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260908200232  name: caja_chica_saldo_automatico

-- El saldo de una caja chica se calculaba UNA vez, al crearla, y nunca más.
-- Por eso las 41 cajas quedaron desfasadas y hubo que recalcularlas a mano.
-- A partir de aquí lo mantiene la base, que es la única que ve todos los
-- movimientos vengan de donde vengan (pantalla, carga masiva o corrección).
--
-- Modelo, el mismo que usa el Excel de Administración:
--   asignado   = todo lo que entró    (suma de ingresos, incluido el arrastre)
--   disponible = asignado − lo gastado (los rechazados no gastan nada)

create or replace function fn_recalcular_caja(p_caja uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update cajas_chicas c
     set monto_asignado = coalesce((
           select sum(i.monto) from ingresos_caja_chica i where i.caja_id = c.id), 0),
         monto_disponible = coalesce((
           select sum(i.monto) from ingresos_caja_chica i where i.caja_id = c.id), 0)
                          - coalesce((
           select sum(g.monto) from gastos_caja_chica g
            where g.caja_id = c.id and g.estado is distinct from 'rechazado'), 0)
   where c.id = p_caja;
$$;

create or replace function fn_caja_tras_movimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- En un UPDATE que cambia de caja hay que recalcular las dos.
  if tg_op in ('INSERT', 'UPDATE') then
    perform fn_recalcular_caja(new.caja_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.caja_id is distinct from
     (case when tg_op = 'DELETE' then null else new.caja_id end) then
    perform fn_recalcular_caja(old.caja_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_caja_saldo_gastos on gastos_caja_chica;
create trigger trg_caja_saldo_gastos
  after insert or update or delete on gastos_caja_chica
  for each row execute function fn_caja_tras_movimiento();

drop trigger if exists trg_caja_saldo_ingresos on ingresos_caja_chica;
create trigger trg_caja_saldo_ingresos
  after insert or update or delete on ingresos_caja_chica
  for each row execute function fn_caja_tras_movimiento();

-- Deja todas las cajas cuadradas de entrada.
do $$
declare r record;
begin
  for r in select id from cajas_chicas loop
    perform fn_recalcular_caja(r.id);
  end loop;
end $$;
