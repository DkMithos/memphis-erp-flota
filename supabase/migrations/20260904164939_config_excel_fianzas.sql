-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904164939  name: config_excel_fianzas

-- Destino del botón "Actualizar Excel" de Fianzas.
--
-- Se reutiliza `excel_sync_config`, que ya guarda drive_id/item_id de los
-- archivos de SharePoint. El drive y el item son los del
-- "STATUS DE FIANZAS ACTUALIZADO 2026.xlsx" de Administración.
--
-- Decisión de Kevin (03/09): **el ERP manda**. El Excel pasa a ser una copia de
-- lectura que este botón regenera, y la propia hoja lo advierte.

insert into excel_sync_config (tenant_id, nombre, drive_id, item_id, excel_url, activo)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13',
       'fianzas',
       'b!I_mLU8GLtk6ASRCGKjMULSgD8dZdflBHgO-paUOxse7z8ytHxVkaSaQ0Mj46-Mr4',
       '01B4SALOD7SNFCDWZ4XVBI3EP2YTF7HBAE',
       'https://memphisperu.sharepoint.com/sites/Administracin54/Documentos compartidos/Administración/Fianzas/STATUS DE FIANZAS ACTUALIZADO 2026.xlsx',
       true
where not exists (
  select 1 from excel_sync_config
  where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and nombre = 'fianzas'
);

select nombre, activo from excel_sync_config where nombre = 'fianzas';
