-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916144114  name: un_solo_centro_de_costo_para_gore_ica

-- GORE ICA ESTABA PARTIDO EN DOS CENTROS DE COSTO.
--
-- `GOREICAPNP` (608 OC desde 2024) y `GICAPATRUL` (106 OC de jun-ago 2026)
-- apuntan al MISMO proyecto, ICAPNP24 "GORE ICA - PNP". Al registrar un
-- requerimiento salían los dos y nadie sabía cuál tocaba. Que son lo mismo lo
-- confirma el propio dato: entre las 608 de GOREICAPNP hay órdenes cuyo
-- `centro_costo_texto` dice "GICAPATRUL" y otras que dicen "ICA" — el sistema
-- viejo usaba las tres grafías para la misma cosa.
--
-- Sobrevive GOREICAPNP, que tiene el histórico completo. Se le pone un nombre
-- legible que sirva a las dos maneras de llamarlo.
--
-- PARA DESHACERLO: `centro_costo_texto` de las órdenes y `centro_costo` (texto)
-- de los requerimientos siguen diciendo 'GICAPATRUL'. Esas filas son las que se
-- movieron; ninguna otra se tocó.

do $$
declare
  v_queda   uuid;
  v_se_va   uuid;
  v_ordenes int;
  v_reqs    int;
begin
  select id into v_queda from centros_costo where codigo = 'GOREICAPNP';
  select id into v_se_va from centros_costo where codigo = 'GICAPATRUL';

  if v_queda is null or v_se_va is null then
    raise notice 'Ya estaba fusionado: no se hace nada';
    return;
  end if;

  update ordenes_compra      set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  get diagnostics v_ordenes = row_count;

  update requerimientos_compra set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  get diagnostics v_reqs = row_count;

  update cotizaciones        set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  update recepciones         set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  update transacciones       set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  update comprobantes_pago   set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  update presupuesto_lineas  set centro_costo_id = v_queda where centro_costo_id = v_se_va;
  update asientos_lineas     set centro_costo_id = v_queda where centro_costo_id = v_se_va;

  -- Un nombre que encuentren tanto los que buscan "ICA" como los que buscan
  -- "patrulleros", que es como lo nombran en Operaciones.
  update centros_costo
     set nombre = 'GORE ICA - PNP (Patrulleros)'
   where id = v_queda;

  -- El duplicado no se borra: se retira de circulación. Borrarlo dejaría sin
  -- sentido el `centro_costo` de texto de los requerimientos que lo nombran.
  update centros_costo
     set activo = false,
         descripcion = 'Duplicado de GOREICAPNP. Fusionado el 2026-09-16; no usar.'
   where id = v_se_va;

  raise notice 'Fusionado: % ordenes y % requerimientos pasaron a GOREICAPNP', v_ordenes, v_reqs;
end $$;
