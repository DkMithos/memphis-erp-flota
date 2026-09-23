-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916151830  name: revision_de_ordenes_por_operaciones_2026_09

-- REVISIÓN DE ÓRDENES POR OPERACIONES (archivo OCs_por_proyecto_revision.xlsx,
-- sitio TI, revisado el 15/09/2026).
--
-- Operaciones repasó las 1.097 órdenes migradas y anotó, orden por orden, lo que
-- había que corregir. Esto lleva esas anotaciones al ERP. Hasta ahora el ERP
-- daba cifras que no cuadraban con las suyas justo por estas filas.
--
-- Tres tipos de corrección, y una decisión propia que conviene leer:
--
-- 1. ANULADAS: órdenes que figuraban aprobadas y en realidad se anularon.
-- 2. DUPLICADAS: filas que la migración duplicó. Operaciones escribió
--    "duplicada eliminar". NO SE BORRAN: se anulan con el motivo puesto. El
--    efecto sobre las cifras es el mismo —una orden anulada no suma— pero
--    queda rastro de que existieron y de por qué se fueron. Borrarlas es
--    irreversible y esa es una decisión de Kevin, no de esta migración.
-- 3. REASIGNADAS: compras imputadas al proyecto equivocado.
--
-- Cada cambio deja su motivo escrito en la propia orden.

do $$
declare
  v_cusco_pnp_cc    uuid := '3105965e-ef0d-587b-ab03-4bcf49561891';
  v_cusco_pnp_pr    uuid := '6fb8525e-58b7-4936-8337-38d9585248c8';
  v_huanuco_cc      uuid := 'dee40270-8644-5ac7-bc9a-bf4217861ff8';
  v_huanuco_pr      uuid := 'cd49baae-b857-4c36-ab54-26ca1f2047bd';
  v_hidroamb_cc     uuid := '762f6869-4447-542e-9a26-4a83ff68b3d4';
  v_hidroamb_pr     uuid := 'dec97ef4-2b2a-442a-b158-a36f14776499';
  v_nota   text := ' (revisión de Operaciones, 15/09/2026)';
  n int;
begin
  -- 1. Anuladas que el ERP tenía como aprobadas.
  update ordenes_compra
     set estado = 'anulada',
         motivo_anulacion = coalesce(motivo_anulacion, 'Anulada según revisión de Operaciones' || v_nota),
         modificado_en = now()
   where numero in ('MM-000769','MM-000470','MM-000412','MM-000466','MM-000306','MM-000461',
                    'MM-000322','MM-000464','MM-000309','MM-000298','MM-000344','MM-000365',
                    'MM-000853','MM-000877','MM-000331','MM-000796')
     and estado <> 'anulada';
  get diagnostics n = row_count;
  raise notice 'anuladas: %', n;

  -- 2. Duplicadas de la migración. Se anulan, no se borran.
  update ordenes_compra
     set estado = 'anulada',
         motivo_anulacion = 'Duplicada de la migración; marcada para eliminar por Operaciones' || v_nota,
         modificado_en = now()
   where numero in ('MM-000804','MM-000411','MM-000814','MM-000815','MM-000818','MM-000816',
                    'MM-000253-B')
     and estado <> 'anulada';
  get diagnostics n = row_count;
  raise notice 'duplicadas anuladas: %', n;

  -- 3a. Reasignadas a GORE CUSCO - PNP.
  update ordenes_compra
     set centro_costo_id = v_cusco_pnp_cc,
         proyecto_id     = v_cusco_pnp_pr,
         observaciones   = concat_ws(E'\n', nullif(observaciones,''),
                            'Reasignada a GORE CUSCO - PNP' || v_nota),
         modificado_en = now()
   where numero in ('MM-000542','MM-000281','MM-000446','MM-000321','MM-000416',
                    'MM-000364','MM-000330','MM-000471')
     and (centro_costo_id is distinct from v_cusco_pnp_cc);
  get diagnostics n = row_count;
  raise notice 'a cusco pnp: %', n;

  -- 3b. Reasignada a GORE HUÁNUCO - PNP.
  update ordenes_compra
     set centro_costo_id = v_huanuco_cc,
         proyecto_id     = v_huanuco_pr,
         observaciones   = concat_ws(E'\n', nullif(observaciones,''),
                            'Reasignada a GORE HUÁNUCO - PNP' || v_nota),
         modificado_en = now()
   where numero = 'MM-000447'
     and (centro_costo_id is distinct from v_huanuco_cc);
  get diagnostics n = row_count;
  raise notice 'a huanuco: %', n;

  -- 3c. Reasignada a GORE CUSCO - HIDROAMBULANCIAS.
  update ordenes_compra
     set centro_costo_id = v_hidroamb_cc,
         proyecto_id     = v_hidroamb_pr,
         observaciones   = concat_ws(E'\n', nullif(observaciones,''),
                            'Reasignada a GORE CUSCO - HIDROAMBULANCIAS' || v_nota),
         modificado_en = now()
   where numero = 'MM-000795'
     and (centro_costo_id is distinct from v_hidroamb_cc);
  get diagnostics n = row_count;
  raise notice 'a hidroambulancias: %', n;
end $$;
