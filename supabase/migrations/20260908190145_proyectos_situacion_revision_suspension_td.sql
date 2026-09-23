-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260908190145  name: proyectos_situacion_revision_suspension_td

-- El Excel de Operaciones usa dos situaciones que el ERP no contemplaba:
-- "REVISIÓN SUSPENSIÓN" (se evalúa levantar o extender una suspensión) y
-- "REVISIÓN TD" (revisión de trato directo). Estaban cayendo en el cajón de
-- 'revision_estado', que no dice lo mismo. Se agregan para poder reflejar el
-- estado real y no uno aproximado.
alter table proyectos drop constraint proyectos_situacion_check;
alter table proyectos add constraint proyectos_situacion_check
  check (situacion is null or situacion = any (array[
    'activo','suspension','revision_estado','revision_suspension','revision_td',
    'arbitraje','plazo_vencido','liquidacion','observado'
  ]));
