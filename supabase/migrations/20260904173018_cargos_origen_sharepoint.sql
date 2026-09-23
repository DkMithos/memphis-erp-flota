-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904173018  name: cargos_origen_sharepoint

-- Trazabilidad e idempotencia de la importación de cargos desde SharePoint.
--
-- `origen_item_id` es el id del archivo en el drive de SharePoint. Con él la
-- importación se puede repetir sin duplicar: lo que ya entró, se salta.
-- `carpeta_origen` guarda de qué carpeta de entidad vino, que es lo que
-- Administración usa para organizarlos.

alter table fianza_cargos add column if not exists origen_item_id text;
alter table fianza_cargos add column if not exists carpeta_origen text;

create unique index if not exists uq_fianza_cargos_origen
  on fianza_cargos (tenant_id, origen_item_id)
  where origen_item_id is not null;
