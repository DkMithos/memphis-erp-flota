-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904155434  name: enlazar_fianzas_a_proyectos

-- Enlace de cada fianza al proyecto del ERP.
--
-- Los nombres del Excel de Administración y los del ERP no coinciden literal
-- ("GORE HUANUCO PATRULLEROS" vs "GORE HUÁNUCO - PNP"), así que el enlace se
-- hace a mano una vez y queda hecho. Se prefiere esto a un emparejamiento
-- difuso: con 10 filas, adivinar es peor que decidir.
--
-- Quedan a propósito SIN proyecto:
--   MUNI SAN MIGUEL        — no existe como proyecto en el ERP
--   MAS SEGURIDAD BOMBEROS — carta suelta del convenio de Loreto, ya devuelta

update fianzas f
set proyecto_id = p.id
from proyectos p
where p.tenant_id = f.tenant_id
  and (f.nombre_proyecto, p.nombre) in (
    ('GORE AMAZONAS AMBULANCIAS', 'GORE AMAZONAS - PNP'),
    ('GORE HUANUCO PATRULLEROS',  'GORE HUÁNUCO - PNP'),
    ('GORE CUSCO PATRULLEROS',    'GORE CUSCO - PNP'),
    ('GORE ICA PATRULLEROS',      'GORE ICA - PNP'),
    ('MUNI CUSCO SERENAZGO',      'MP CUSCO - SERENAZGO')
  )
  and f.proyecto_id is null;
