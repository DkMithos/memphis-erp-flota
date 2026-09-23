-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916152754  name: cotizacion_tarifario_recurrente

-- EL TARIFARIO: UNA COTIZACIÓN QUE NO SE GASTA.
--
-- Los mantenimientos de flota son siempre los mismos y al mismo precio: cambio
-- de aceite, filtros, frenos. Pero el ERP pide requerimiento + cotización para
-- cada orden, y con una flota grande eso es papeleo puro para Compras — por
-- cada camioneta, todos los meses, el mismo trámite con las mismas cifras.
--
-- Un TARIFARIO es una cotización que se negocia y se aprueba UNA VEZ con el
-- taller, y de la que salen tantas órdenes como haga falta. No cambia nada del
-- circuito de control: el tarifario se aprueba igual que cualquier cotización,
-- y cada orden que sale de él sigue pasando por el flujo de montos.
--
-- Técnicamente ya se podían generar varias órdenes de la misma cotización —
-- nada lo impedía— pero no había manera de decir cuáles están pensadas para
-- eso, así que nadie lo hacía y el selector las mezclaba todas.

alter table cotizaciones
  add column if not exists es_tarifario boolean not null default false,
  add column if not exists tarifario_vigencia date;

comment on column cotizaciones.es_tarifario is
  'Cotización recurrente: se aprueba una vez y de ella salen varias órdenes. Pensada para mantenimientos de flota, donde el precio no cambia.';
comment on column cotizaciones.tarifario_vigencia is
  'Hasta cuándo vale el precio acordado. Vencida, sigue consultable pero deja de ofrecerse para órdenes nuevas.';

create index if not exists idx_cotizaciones_tarifario
  on cotizaciones(tenant_id, es_tarifario) where es_tarifario;
