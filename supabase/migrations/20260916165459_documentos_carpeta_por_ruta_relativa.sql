-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916165459  name: documentos_carpeta_por_ruta_relativa

-- La raíz se direcciona POR RUTA, no por id de item.
--
-- El id que devuelve la exploración (014MUEHV…) no le vale a Graph para pedir
-- los hijos: responde 400 "Invalid request". La ruta relativa dentro del drive
-- sí funciona, y además es legible: si alguien mueve la carpeta se ve enseguida
-- qué hay que corregir.
--
-- Los ids de las SUBCARPETAS no dan problema porque salen de la propia
-- respuesta de Graph, no de fuera.

alter table documentos_carpetas
  add column if not exists ruta_relativa text;

comment on column documentos_carpetas.ruta_relativa is
  'Ruta dentro del drive, sin la biblioteca: "General/05. ARCHIVOS VARIOS/...". Es lo que Graph entiende.';

alter table documentos_carpetas alter column item_id drop not null;

update documentos_carpetas
   set ruta_relativa = 'General/05. ARCHIVOS VARIOS/Resumen Facturas y CIPRL - Proyectos OXI'
 where nombre = 'Facturas y CIPRL — Proyectos OXI';
