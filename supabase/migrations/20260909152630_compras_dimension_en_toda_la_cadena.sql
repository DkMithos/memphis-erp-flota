-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260909152630  name: compras_dimension_en_toda_la_cadena

-- "TODO EL SISTEMA DEBE ESTAR AMARRADO a un centro de costo o proyecto".
--
-- La factura era el único eslabón de la cadena sin dimensión: se sabía a qué
-- orden pertenecía, pero no a qué centro de costo ni a qué proyecto, así que el
-- gasto facturado no se podía cruzar con nada.
--
-- No se pide a mano: se HEREDA de la orden, que es de donde viene la factura.
-- Pedirla otra vez abriría la puerta a que difieran.
alter table comprobantes_pago
  add column if not exists centro_costo_id uuid references centros_costo(id),
  add column if not exists proyecto_id     uuid references proyectos(id);

create or replace function fn_factura_hereda_dimension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.orden_compra_id is not null then
    select o.centro_costo_id, o.proyecto_id
      into new.centro_costo_id, new.proyecto_id
      from ordenes_compra o
     where o.id = new.orden_compra_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_factura_dimension on comprobantes_pago;
create trigger trg_factura_dimension
  before insert or update of orden_compra_id on comprobantes_pago
  for each row execute function fn_factura_hereda_dimension();

create index if not exists idx_comprobantes_proyecto on comprobantes_pago(proyecto_id) where proyecto_id is not null;
create index if not exists idx_comprobantes_cc on comprobantes_pago(centro_costo_id) where centro_costo_id is not null;

-- Las órdenes ya derivan su proyecto del centro de costo (trg_oc_proyecto).
-- Aquí se hace lo mismo para las cotizaciones, que acaban de estrenar columnas:
-- así basta con elegir el centro de costo una vez y el proyecto se deduce solo
-- en toda la cadena.
create or replace function fn_cotizacion_proyecto_desde_cc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.centro_costo_id is not null then
    select cc.proyecto_id into new.proyecto_id
      from centros_costo cc where cc.id = new.centro_costo_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cotizacion_proyecto on cotizaciones;
create trigger trg_cotizacion_proyecto
  before insert or update of centro_costo_id on cotizaciones
  for each row execute function fn_cotizacion_proyecto_desde_cc();
