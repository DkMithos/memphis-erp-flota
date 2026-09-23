-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260910174518  name: cotizaciones_tipo_bienes_servicios

-- BIENES O SERVICIOS EN LA COTIZACIÓN
--
-- El formulario ya lo preguntaba ("Tipo *: Bienes / Servicios") pero la tabla no
-- tenía dónde guardarlo: al leer se asumía 'bienes' para todo. De ahí sale
-- además el tipo de la orden — OC para bienes, OS para servicios — así que la
-- elección se perdía justo antes de servir para algo.

alter table cotizaciones
  add column if not exists tipo text not null default 'bienes';

alter table cotizaciones drop constraint if exists cotizaciones_tipo_check;
alter table cotizaciones add constraint cotizaciones_tipo_check
  check (tipo in ('bienes', 'servicios'));

comment on column cotizaciones.tipo is
  'bienes | servicios. Decide si la orden que salga de aquí es OC u OS.';

-- Las migradas del legado se quedan en el valor por defecto ('bienes'): es lo
-- que el ERP venía asumiendo, así que nada cambia de lo que ya se veía. Las que
-- son servicios se irán corrigiendo al editarlas.
