-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260826211737  name: add_contacto_to_proveedores

-- El PDF de la orden imprime "Contacto:" (la persona de contacto del proveedor),
-- pero la columna no existía: el legado oc-system la guarda y el ERP la perdía.
alter table proveedores add column if not exists contacto text;

comment on column proveedores.contacto is
  'Persona de contacto del proveedor. Se imprime en el PDF de la orden de compra.';
