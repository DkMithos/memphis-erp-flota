-- Un compromiso sin centro de costo (valorización, prueba manual) perdía su
-- proyecto: el disparador lo ponía en null. El CDC solo AÑADE el proyecto; nunca lo borra.
create or replace function public.set_flujo_proyecto_from_cc() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.centro_costo_id is not null then
    select coalesce(cc.proyecto_id, new.proyecto_id) into new.proyecto_id
      from centros_costo cc where cc.id = new.centro_costo_id;
  end if;
  return new;
end $$;

-- Las CxC de valorizaciones que nacieron sin proyecto se rehacen.
select public.sync_compromiso_de_valorizacion(id) from public.valorizaciones;
