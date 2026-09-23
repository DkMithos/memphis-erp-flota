-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916144158  name: requerimiento_hereda_proyecto_del_centro_costo

-- El requerimiento hereda el proyecto de su centro de costo, igual que ya hacen
-- los gastos de caja chica (fn set_gasto_proyecto_from_cc). Si quien registra
-- elige un proyecto a mano, ese manda: hay compras que se imputan a un proyecto
-- distinto del que sugiere el centro de costo, y el sistema no debe discutirlo.

create or replace function public.set_requerimiento_proyecto_from_cc()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Sin centro de costo por id, se intenta por el código de texto.
  if new.centro_costo_id is null and new.centro_costo is not null then
    select id into new.centro_costo_id
      from centros_costo
     where codigo = new.centro_costo and tenant_id = new.tenant_id
     limit 1;
  end if;

  if new.proyecto_id is null and new.centro_costo_id is not null then
    select proyecto_id into new.proyecto_id
      from centros_costo
     where id = new.centro_costo_id
     limit 1;
  end if;

  return new;
end $$;

drop trigger if exists trg_requerimiento_proyecto_from_cc on requerimientos_compra;
create trigger trg_requerimiento_proyecto_from_cc
  before insert or update of centro_costo, centro_costo_id on requerimientos_compra
  for each row execute function public.set_requerimiento_proyecto_from_cc();
