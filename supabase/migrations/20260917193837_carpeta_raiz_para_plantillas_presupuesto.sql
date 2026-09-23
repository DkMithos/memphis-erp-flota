-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260917193837  name: carpeta_raiz_para_plantillas_presupuesto

-- Separar carpetas de SharePoint por USO. La de Shirley es 'documentos' (solo su
-- expediente). Se añade una raíz 'presupuesto' que apunta a COMPRAS/General, el
-- árbol donde Antonio guarda las plantillas de presupuesto por proyecto. Así el
-- importador de presupuesto navega ese árbol sin exponerlo en el módulo
-- Documentos de Shirley (que sigue viendo solo lo suyo).
alter table public.documentos_carpetas
  add column if not exists uso text not null default 'documentos';

comment on column public.documentos_carpetas.uso is
  'Para qué función es la carpeta: documentos (módulo Documentos) o presupuesto (importador de presupuesto de proyecto).';

-- Raíz de presupuestos: mismo drive de COMPRAS que la carpeta de Shirley,
-- pero apuntando a "General" (la ruta relativa direcciona la raíz en Graph).
insert into public.documentos_carpetas
  (tenant_id, nombre, descripcion, drive_id, item_id, ruta, ruta_relativa, uso, activo, orden)
select
  d.tenant_id,
  'Proyectos (COMPRAS)',
  'Árbol de proyectos de COMPRAS en SharePoint. Se usa para elegir la plantilla de presupuesto de cada proyecto.',
  d.drive_id,
  'na',                    -- no se usa: la raíz se direcciona por ruta_relativa
  'COMPRAS / General',
  'General',
  'presupuesto',
  true,
  1
from public.documentos_carpetas d
where d.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  and d.uso = 'documentos'
  and not exists (
    select 1 from public.documentos_carpetas x
    where x.tenant_id = d.tenant_id and x.uso = 'presupuesto'
  )
limit 1;
