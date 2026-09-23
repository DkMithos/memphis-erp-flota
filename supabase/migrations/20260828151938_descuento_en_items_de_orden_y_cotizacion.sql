-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260828151938  name: descuento_en_items_de_orden_y_cotizacion

-- El portal legado guarda un descuento POR ITEM y es un MONTO, no un porcentaje
-- (verificado: en MM-000590 la suma de (cantidad*PU - descuento) da 5714.32, exactamente
-- el subtotal que reporta el portal). El ERP no tenia donde guardarlo, asi que el detalle
-- impreso no cuadraba con el total de la orden.

alter table orden_items     add column if not exists descuento numeric not null default 0;
alter table cotizacion_items add column if not exists descuento numeric not null default 0;

comment on column orden_items.descuento is
  'Descuento del item en MONTO (no porcentaje), en la moneda del documento.';
comment on column cotizacion_items.descuento is
  'Descuento del item en MONTO (no porcentaje), en la moneda del documento.';

-- precio_total pasa a ser NETO para que el detalle sume igual que el subtotal
alter table orden_items     drop column precio_total;
alter table orden_items     add  column precio_total numeric
  generated always as ((cantidad)::numeric * precio_unitario - descuento) stored;

alter table cotizacion_items drop column precio_total;
alter table cotizacion_items add  column precio_total numeric
  generated always as ((cantidad)::numeric * precio_unitario - descuento) stored;
