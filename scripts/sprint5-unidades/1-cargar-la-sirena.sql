-- 2026-10-15 · Sprint 5 (#11) · Carga del Excel "MEMPHIS_IVENTARIO LA SIRENA ULTIMO.xlsx" (hoja DEVOLUCIÓN, 546 unidades)
-- a `inventario_unidades`. Fuente: General - PROYECTOS/06. CARPETAS VARIAS/Logistica/INVENTARIO GENERAL (copia del 2026-10-15).
-- Qué trae: 70 BODYCAM Hikvision (con serie, F002-5489 SUMTEC), 236 ARNÉS Hikvision (sin serie, misma factura),
-- 200 LIGHTMAN LED rojo DKT (sin serie, F001-2 DKT) y 40 TABLET Lenovo P11 (con serie, F001-1 DKT). Todo en custodia de
-- Corporación La Sirena (Lurín). Decisiones: se crea el almacén "La Sirena - Lurín (custodia)", 4 artículos tipo equipo,
-- fecha de ingreso = fecha de la factura (el Excel no trae fecha; queda anotado en observaciones), una entrada al kardex
-- por artículo (motivo inicial, precio y TC del Excel). Las 166 bodycams devueltas a SUMTEC el 20/10/2025 (guía EG07-00000067)
-- NO se cargan: la hoja no da sus series. Se ejecuta como UNA transacción por el MCP de Supabase; marca origen = 'excel-la-sirena'.
-- Revertir: delete from inventario_unidades where origen = 'excel-la-sirena'; borrar los MOV con realizado_por = 'excel-la-sirena'
-- y recalcular stock_almacen/stock_actual de los 4 artículos; borrar los artículos y el almacén con origen/codigo indicados.
do $$
declare v_t uuid := 'e4b16a80-8500-418e-afaa-0e976b7d9b13'; v_alm uuid; v_body uuid; v_arn uuid; v_light uuid; v_tab uuid; v_mov uuid; s text; v_id uuid;
        v_sumtec uuid := '5844aa0f-8e9d-51b1-ade6-435b22033fa9'; v_dkt uuid := '3bd18af2-1df0-5e0a-9c53-e3ec96c7045c';
        v_f5489 uuid := '84b4a73c-4c89-41be-bb79-a604fdddf029'; v_f1 uuid := '88b9b0fd-e021-46a5-a38b-b9704879746c'; v_f2 uuid := 'd99e9930-732d-477d-ab31-2612286b7d0f';
        v_nota text := 'Cargado del Excel LA SIRENA (15/10/2026); fecha de ingreso = fecha de la factura';
begin
  if exists (select 1 from inventario_unidades where tenant_id = v_t and origen = 'excel-la-sirena') then raise exception 'Ya cargado'; end if;

  insert into almacenes (tenant_id, codigo, nombre, tipo, ubicacion, responsable, estado)
  values (v_t, 'ALM-002', 'La Sirena - Lurín (custodia)', 'general', 'Corporación La Sirena S.A.C., Lurín', 'Logística', 'activo')
  returning id into v_alm;

  insert into articulos (tenant_id, codigo, nombre, descripcion, unidad_medida, tipo, stock_actual, stock_minimo, precio_unitario, moneda, marca, modelo, activo, creado_por, origen)
  values (v_t, 'ART-0002', 'Bodycam Hikvision DS-MCW407', 'Body camera 4G Linux Big Button 128 GB (DS-MCW407 128/GLE(D)(O-STD))', 'unidad', 'equipo', 0, 0, 469.203, 'USD', 'HIKVISION', 'DS-MCW407 128/GLE(D)(O-STD)', true, 'excel-la-sirena', 'excel-la-sirena')
  returning id into v_body;

  insert into articulos (tenant_id, codigo, nombre, descripcion, unidad_medida, tipo, stock_actual, stock_minimo, precio_unitario, moneda, marca, modelo, activo, creado_por, origen)
  values (v_t, 'ART-0003', 'Arnés de pecho para bodycam Hikvision', 'Body Camera Chest Harness, hebilla telescópica (DS-MH1711-HM(O-STD))', 'unidad', 'equipo', 0, 0, 26.479, 'USD', 'HIKVISION', 'DS-MH1711-HM(O-STD)', true, 'excel-la-sirena', 'excel-la-sirena')
  returning id into v_arn;

  insert into articulos (tenant_id, codigo, nombre, descripcion, unidad_medida, tipo, stock_actual, stock_minimo, precio_unitario, moneda, marca, modelo, activo, creado_por, origen)
  values (v_t, 'ART-0004', 'Lightman LED rojo', 'Baliza LED roja para patrullero (DKT Soluciones)', 'unidad', 'equipo', 0, 0, 200, 'PEN', 'DKT SOLUCIONES', 'LED ROJO', true, 'excel-la-sirena', 'excel-la-sirena')
  returning id into v_light;

  insert into articulos (tenant_id, codigo, nombre, descripcion, unidad_medida, tipo, stock_actual, stock_minimo, precio_unitario, moneda, marca, modelo, activo, creado_por, origen)
  values (v_t, 'ART-0005', 'Tablet Lenovo P11', 'Tablet Lenovo Tab P11', 'unidad', 'equipo', 0, 0, 359.9, 'USD', 'LENOVO', 'P11', true, 'excel-la-sirena', 'excel-la-sirena')
  returning id into v_tab;

  -- BODYCAM ×70 con serie
  foreach s in array array['AZ9627549','AZ9627550','AZ9627551','AZ9627553','AZ9627554','AZ9627555','AZ9627559','AZ9627561','AZ9627564','AZ9627566','AZ9627568','AZ9627569','AZ9627570','AZ9627571','AZ9627573','AZ9627574','AZ9627575','AZ9627576','AZ9627577','AZ9627578','AZ9627579','AZ9627580','AZ9627581','AZ9627583','AZ9627589','AZ9627595','AZ9627596','AZ9627598','AZ9627599','AZ9627601','AZ9627604','AZ9627605','AZ9627610','AZ9627611','AZ9627612','AZ9627613','AZ9627614','AZ9627616','AZ9627619','AZ9627620','AZ9627621','AZ9627622','AZ9627625','AZ9627626','AZ9627631','AZ9627634','AZ9627635','AZ9627636','AZ9627637','AZ9627639','AZ9627641','AZ9627642','AZ9627643','AZ9627644','AZ9627645','AZ9627646','AZ9627647','AZ9627648','AZ9627649','AZ9627650','AZ9627651','AZ9627563','AZ9627565','AZ9627597','AZ9627608','AZ9627615','AZ9627618','AZ9627633','AZ9627638','AZ9627556'] loop
    insert into inventario_unidades (tenant_id, articulo_id, serie, estado, almacen_id, comprobante_id, proveedor_id, valor_usd, valor_soles, tipo_cambio, fecha_ingreso, observaciones, origen, creado_por)
    values (v_t, v_body, s, 'en_almacen', v_alm, v_f5489, v_sumtec, 469.203, 1759.51, 3.75, '2024-05-29', v_nota, 'excel-la-sirena', 'excel-la-sirena') returning id into v_id;
    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_nuevo, a, documento, notas, usuario) values (v_t, v_id, '2024-05-29', 'ingreso', 'en_almacen', 'Almacén · La Sirena - Lurín (custodia)', 'F002-5489', v_nota, 'excel-la-sirena');
  end loop;

  v_mov := kardex_registrar(v_t, v_body, v_alm, null, 'entrada', 'inicial', 70, 469.203, 'USD', 3.75, 'unidades', 'LA SIRENA 2026-10', null, null, null, 'Carga inicial de 70 bodycams con serie desde el Excel LA SIRENA (F002-5489 SUMTEC)', '2024-05-29', 'excel-la-sirena');
  update inventario_unidades_mov set movimiento_inventario_id = v_mov where unidad_id in (select id from inventario_unidades where articulo_id = v_body);

  -- TABLET ×40 con serie
  foreach s in array array['HVA5JBQM','HVA5JBN0','HVA5JBQN','HVA5JBQQ','HVA5JBQG','HVA5JBMA','HVA5JBJC','HVA5JBJA','HVA5JBJ6','HVA5JBHB','HVA5JBQB','HVA5JBZ4','HVA5JBX8','HVA5JBVN','HVA5JBLR','HVA5JCOA','HVA5JBZO','HVA5JBY9','HVA5JBWS','HVA5JBY4','HVA5JBGS','HVA5JBZ2','HVA5JBZS','HVA5JBGQ','HVA5JBM8','HVA5JBQT','HVA5JBPM','HVA5JBRM','HVA5JBNF','HVA5JBSE','HVA5JBP6','HVA5JBPS','HVA5JBP5','HVA5JBPE','HVA5JBPV','HVA5JBSR','HVA5JBTY','HVA5JBVL','HVA5JBWA','HVA5JBKX'] loop
    insert into inventario_unidades (tenant_id, articulo_id, serie, estado, almacen_id, comprobante_id, proveedor_id, valor_usd, valor_soles, tipo_cambio, fecha_ingreso, observaciones, origen, creado_por)
    values (v_t, v_tab, s, 'en_almacen', v_alm, v_f1, v_dkt, 359.9, 1352.5, 3.758, '2024-10-28', v_nota, 'excel-la-sirena', 'excel-la-sirena') returning id into v_id;
    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_nuevo, a, documento, notas, usuario) values (v_t, v_id, '2024-10-28', 'ingreso', 'en_almacen', 'Almacén · La Sirena - Lurín (custodia)', 'F001-1', v_nota, 'excel-la-sirena');
  end loop;

  v_mov := kardex_registrar(v_t, v_tab, v_alm, null, 'entrada', 'inicial', 40, 359.9, 'USD', 3.758, 'unidades', 'LA SIRENA 2026-10', null, null, null, 'Carga inicial de 40 tablets con serie desde el Excel LA SIRENA (F001-1 DKT)', '2024-10-28', 'excel-la-sirena');
  update inventario_unidades_mov set movimiento_inventario_id = v_mov where unidad_id in (select id from inventario_unidades where articulo_id = v_tab);

  -- ARNÉS ×236 sin serie
  for i in 1..236 loop
    insert into inventario_unidades (tenant_id, articulo_id, serie, estado, almacen_id, comprobante_id, proveedor_id, valor_usd, valor_soles, tipo_cambio, fecha_ingreso, observaciones, origen, creado_por)
    values (v_t, v_arn, null, 'en_almacen', v_alm, v_f5489, v_sumtec, 26.479, 99.51, 3.758, '2024-05-29', 'Pendiente de serie · ' || v_nota, 'excel-la-sirena', 'excel-la-sirena') returning id into v_id;
    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_nuevo, a, documento, notas, usuario) values (v_t, v_id, '2024-05-29', 'ingreso', 'en_almacen', 'Almacén · La Sirena - Lurín (custodia)', 'F002-5489', 'Sin número de serie', 'excel-la-sirena');
  end loop;

  v_mov := kardex_registrar(v_t, v_arn, v_alm, null, 'entrada', 'inicial', 236, 26.479, 'USD', 3.758, 'unidades', 'LA SIRENA 2026-10', null, null, null, 'Carga inicial de 236 arneses (sin serie) desde el Excel LA SIRENA (F002-5489 SUMTEC)', '2024-05-29', 'excel-la-sirena');
  update inventario_unidades_mov set movimiento_inventario_id = v_mov where unidad_id in (select id from inventario_unidades where articulo_id = v_arn);

  -- LIGHTMAN ×200 sin serie
  for i in 1..200 loop
    insert into inventario_unidades (tenant_id, articulo_id, serie, estado, almacen_id, comprobante_id, proveedor_id, valor_usd, valor_soles, tipo_cambio, fecha_ingreso, observaciones, origen, creado_por)
    values (v_t, v_light, null, 'en_almacen', v_alm, v_f2, v_dkt, null, 200, null, '2024-10-28', 'Pendiente de serie · ' || v_nota, 'excel-la-sirena', 'excel-la-sirena') returning id into v_id;
    insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_nuevo, a, documento, notas, usuario) values (v_t, v_id, '2024-10-28', 'ingreso', 'en_almacen', 'Almacén · La Sirena - Lurín (custodia)', 'F001-2', 'Sin número de serie', 'excel-la-sirena');
  end loop;

  v_mov := kardex_registrar(v_t, v_light, v_alm, null, 'entrada', 'inicial', 200, 200, 'PEN', 1, 'unidades', 'LA SIRENA 2026-10', null, null, null, 'Carga inicial de 200 lightman (sin serie) desde el Excel LA SIRENA (F001-2 DKT)', '2024-10-28', 'excel-la-sirena');
  update inventario_unidades_mov set movimiento_inventario_id = v_mov where unidad_id in (select id from inventario_unidades where articulo_id = v_light);

end $$;

select a.codigo, a.nombre, a.stock_actual, count(u.id) as unidades, count(u.serie) as con_serie, sum(u.valor_soles) as valor_soles,
       (select count(*) from inventario_unidades_mov m join inventario_unidades x on x.id = m.unidad_id where x.articulo_id = a.id and m.movimiento_inventario_id is not null) as mov_enlazados
  from articulos a left join inventario_unidades u on u.articulo_id = a.id
 where a.origen = 'excel-la-sirena' group by a.id, a.codigo, a.nombre, a.stock_actual order by a.codigo;
