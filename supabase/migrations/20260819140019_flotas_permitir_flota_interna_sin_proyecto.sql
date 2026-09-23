-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260819140019  name: flotas_permitir_flota_interna_sin_proyecto


-- Flotas INTERNAS (vehiculos propios de Memphis): no pertenecen a ningun
-- proyecto de cliente, asi que proyecto_id pasa a ser opcional.
--   proyecto_id NOT NULL  -> flota de proyecto (GORE ICA, CUSCO, etc.)
--   proyecto_id NULL      -> flota interna/administrativa de Memphis
-- Las vistas de consumo y proyeccion siguen funcionando: una flota interna
-- simplemente no tiene contrato ni provision que consumir.
ALTER TABLE public.flotas ALTER COLUMN proyecto_id DROP NOT NULL;

COMMENT ON COLUMN public.flotas.proyecto_id IS
  'Proyecto de cliente al que pertenece la flota. NULL = flota interna de Memphis (vehiculos propios / administrativos).';

