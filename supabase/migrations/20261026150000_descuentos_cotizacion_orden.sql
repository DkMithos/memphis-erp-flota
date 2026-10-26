-- 2026-10-26 · Descuentos en cotizaciones y órdenes (pedido de Compras: "los proveedores dan descuentos por unidad,
-- por ítem, en porcentaje, monto fijo y sobre el subtotal, y no hay dónde ponerlos").
--
-- Por ítem ya existía `descuento` (MONTO total del ítem; `precio_total = cantidad * precio_unitario - descuento`,
-- generado) y lo traen 119 ítems de órdenes y 91 de cotizaciones migradas. Se agrega CÓMO lo dio el proveedor
-- (`descuento_tipo`: porcentaje de la línea, monto por unidad o monto fijo por ítem; `descuento_valor`), para que al
-- editar se vea lo negociado y no solo el resultado.
-- Global (sobre el subtotal): `descuento_global_tipo` (porcentaje | monto), `descuento_global_valor` y
-- `descuento_global` (monto ya calculado) en cotizaciones y órdenes.
-- Regla única de totales (lib/compras/descuentos.ts): bruto = Σ cantidad×precio · − descuentos de ítems · − descuento
-- global = `subtotal` (base imponible) · igv = subtotal × tasa del régimen · total = subtotal + igv.
-- Así `subtotal`/`total` conservan su significado para todo lo que ya los usa (compromisos, CxP, presupuesto, cadena).

alter table public.orden_items
  add column if not exists descuento_tipo  text check (descuento_tipo in ('porcentaje', 'unidad', 'monto')),
  add column if not exists descuento_valor numeric(14,4);
alter table public.cotizacion_items
  add column if not exists descuento_tipo  text check (descuento_tipo in ('porcentaje', 'unidad', 'monto')),
  add column if not exists descuento_valor numeric(14,4);

alter table public.ordenes_compra
  add column if not exists descuento_global_tipo  text check (descuento_global_tipo in ('porcentaje', 'monto')),
  add column if not exists descuento_global_valor numeric(14,4),
  add column if not exists descuento_global       numeric(14,2) not null default 0;
alter table public.cotizaciones
  add column if not exists descuento_global_tipo  text check (descuento_global_tipo in ('porcentaje', 'monto')),
  add column if not exists descuento_global_valor numeric(14,4),
  add column if not exists descuento_global       numeric(14,2) not null default 0;

-- Los migrados traían el descuento como monto fijo por ítem: se deja dicho.
update public.orden_items set descuento_tipo = 'monto', descuento_valor = descuento where coalesce(descuento, 0) <> 0 and descuento_tipo is null;
update public.cotizacion_items set descuento_tipo = 'monto', descuento_valor = descuento where coalesce(descuento, 0) <> 0 and descuento_tipo is null;

comment on column public.orden_items.descuento is 'Descuento del ítem en MONTO (resultado). precio_total = cantidad*precio_unitario - descuento.';
comment on column public.orden_items.descuento_tipo is 'Cómo lo dio el proveedor: porcentaje de la línea | monto por unidad | monto fijo por ítem.';
comment on column public.ordenes_compra.descuento_global is 'Descuento sobre el subtotal, en monto. subtotal (base imponible) = Σ precio_total de ítems - descuento_global.';
comment on column public.cotizaciones.descuento_global is 'Descuento sobre el subtotal, en monto. subtotal (base imponible) = Σ precio_total de ítems - descuento_global.';
