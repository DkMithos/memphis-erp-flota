-- Generado por 1-generar-carga-control-viajes.py · histórico CONTROL DE VIAJES 2026 → viajes (origen_datos = 'excel-control-viajes')
do $$ declare v_t uuid := 'e4b16a80-8500-418e-afaa-0e976b7d9b13'; v_id uuid; v_pa uuid; v_rd uuid; v_n int := 0; v_proy uuid; v_cdc uuid; v_user uuid; begin
  if exists (select 1 from viajes where tenant_id = v_t and origen_datos = 'excel-control-viajes') then raise exception 'Ya cargado'; end if;
  -- 002-MM-GADV-2026 · GABRIELA DUNN · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-GADV-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-03-25', '2026-04-28', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-25'::timestamptz, '2026-03-25'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-28'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 35, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-03-25', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H001', '2026-04-28', 'liquidada', 600.0, 1371.59, 771.5899999999999, 'empresa_reembolsa', '2026-04-28'::timestamptz, '2026-04-28'::timestamptz, '2026-04-28'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 771.59 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-28', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1371.59, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WADBFD', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-03-25', '07:35', '2026-03-25', '09:00', 'USD', 102.28, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-25', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 001-MM-GADV-2026 · GABRIELA DUNN · BUSQUEDA DE NUEVOS PROYECTOS
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-GADV-2026', v_proy, v_cdc, 'Viaje a PUCALLPA (BUSQUEDA DE NUEVOS PROYECTOS)', 'LIMA', 'PUCALLPA', '2026-02-05', '2026-02-05', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, 200.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-05'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 1, true, 0, 200.0, 200.0, 200.0, 200.0, '2026-02-05', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H002', '2026-02-05', 'liquidada', 200.0, 100.0, -100.0, 'trabajador_devuelve', '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 100.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-05', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 100.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CSGQBF', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'PUCALLPA', '2026-02-05', '05:55', '2026-02-05', '07:15', 'USD', 314.99, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-05', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 001-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-01-06', '2026-01-16', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-06'::timestamptz, '2026-01-06'::timestamptz, 1950.0, '$ 417.43 se devolvió al trabajador por 2 pasajes aéreos no utilizados · Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-01-16'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 11, true, 0, 1950.0, 1950.0, 1950.0, 1950.0, '2026-01-06', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H003', '2026-01-16', 'liquidada', 1950.0, 3608.6, 1658.6, 'empresa_reembolsa', '2026-01-16'::timestamptz, '2026-01-16'::timestamptz, '2026-01-16'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1658.6 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-01-16', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 3608.6, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EFQALX', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-16', '15:55', '2026-01-16', '17:20', 'USD', 167.09, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-16', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LNHTLH', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-06', '16:35', '2026-01-06', '18:05', 'USD', 145.94, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-06', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 002-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-02-06', '2026-02-06', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-06'::timestamptz, '2026-02-06'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 1, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-02-06', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H004', '2026-02-06', 'liquidada', 300.0, 417.0, 117.0, 'empresa_reembolsa', '2026-02-06'::timestamptz, '2026-02-06'::timestamptz, '2026-02-06'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 117.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-06', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 417.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WSUMRZ', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-02-06', '06:00', '2026-02-06', '07:25', 'USD', 285.09, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-06', 'Histórico Excel');
  v_n := v_n + 1;
  -- 002-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · CUSCO HIDROAMBULANCIAS
  v_proy := (select id from proyectos where codigo = '07CUSHAM26' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-MACO-2026', v_proy, v_cdc, 'Viaje a PUCALLPA (CUSCO HIDROAMBULANCIAS)', 'LIMA', 'PUCALLPA', '2026-02-05', '2026-02-05', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, 200.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 1, true, 0, 200.0, 200.0, 200.0, 200.0, '2026-02-05', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H005', '2026-02-05', 'borrador', 200.0, 0.0, -200.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 200.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CSGQBF', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'PUCALLPA', '2026-02-05', '05:55', '2026-02-05', '07:15', 'USD', 314.99, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-05', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 003-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-03-04', '2026-03-06', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-04'::timestamptz, '2026-03-04'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 3, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-03-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H006', '2026-03-06', 'liquidada', 300.0, 808.1, 508.1, 'empresa_reembolsa', '2026-03-06'::timestamptz, '2026-03-06'::timestamptz, '2026-03-06'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 508.1 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-06', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 808.1, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IUDEWM', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-03-06', '19:50', '2026-03-06', '21:20', 'USD', 146.23, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-06', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LBUSQU', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-03-04', '07:35', '2026-03-04', '09:00', 'USD', 187.24, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-04', 'Histórico Excel');
  v_n := v_n + 1;
  -- 004-MM-LOMM-2026 · LISBET MONTEZA · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-03-23', '2026-03-25', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-23'::timestamptz, '2026-03-23'::timestamptz, 500.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 3, true, 0, 500.0, 500.0, 500.0, 500.0, '2026-03-23', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H007', '2026-03-25', 'liquidada', 500.0, 660.5, 160.5, 'empresa_reembolsa', '2026-03-25'::timestamptz, '2026-03-25'::timestamptz, '2026-03-25'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 160.5 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-25', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 660.5, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JIPZWD', 'aereo', 'SKY AIRLINE', 'vuelta', 'LIMA', 'TARAPOTO', '2026-03-25', '20:00', '2026-03-25', '21:25', 'USD', 212.71, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-25', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'XIRAPI', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'CHACHAPOYAS', '2026-03-23', '08:40', '2026-03-23', '10:10', 'USD', 151.84, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-23', 'Histórico Excel');
  v_n := v_n + 1;
  -- 004-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-03-31', '2026-04-01', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-31'::timestamptz, '2026-03-31'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-01'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 2, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-03-31', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H008', '2026-04-01', 'liquidada', 600.0, 563.8, -36.200000000000045, 'trabajador_devuelve', '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 36.2 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-01', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 563.8, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'DIUECI', 'aereo', 'SKY AIRLINE', 'vuelta', 'CUSCO', 'LIMA', '2026-04-01', '21:40', '2026-04-01', '23:25', 'USD', 95.87, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-01', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WIKEIO', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-03-31', '06:00', '2026-03-31', '07:20', 'USD', 211.59, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-31', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-MACO-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-01-19', '2026-01-24', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-19'::timestamptz, '2026-01-19'::timestamptz, 1050.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-01-24'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 6, true, 0, 1050.0, 1050.0, 1050.0, 1050.0, '2026-01-19', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H009', '2026-01-24', 'liquidada', 1050.0, 971.68, -78.32000000000005, 'trabajador_devuelve', '2026-01-24'::timestamptz, '2026-01-24'::timestamptz, '2026-01-24'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 78.32 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-01-24', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 971.68, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'GZHUFF', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-19', '21:10', '2026-01-19', '22:40', 'USD', 142.4, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-19', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JXIIXM', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-24', '20:10', '2026-01-24', '21:40', 'USD', 150.57, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-24', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-MACR-2026 · MONICA CHUMAN · BUSQUEDA DE NUEVOS PROYECTOS
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-MACR-2026', v_proy, v_cdc, 'Viaje a IQUITOS (BUSQUEDA DE NUEVOS PROYECTOS)', 'LIMA', 'IQUITOS', '2026-02-05', '2026-02-05', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-05'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MONICA CHUMAN', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H010', '2026-02-05', 'liquidada', 0.0, 160.0, 160.0, 'empresa_reembolsa', '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 160.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-05', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 160.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'NONMWT', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-02-05', '03:30', '2026-02-05', '20:25', 'USD', 397.59, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-05', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'Alojamiento', null, 'IQUITOS', '2026-03-20', 'PEN', 350.0, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 002-MM-RJNN-2026 · RICHARD NAVARRO · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-03-20', '2026-04-01', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-20'::timestamptz, '2026-03-20'::timestamptz, 1300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-01'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 13, true, 0, 1300.0, 1300.0, 1300.0, 1300.0, '2026-03-20', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H011', '2026-04-01', 'liquidada', 1300.0, 2909.52, 1609.52, 'empresa_reembolsa', '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1609.52 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-01', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 2909.52, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MBNSWX', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'CHACHAPOYAS', '2026-03-20', '08:40', '2026-03-20', '10:10', 'USD', 135.32, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-20', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'RAAKQG', 'aereo', 'ATSA AIRLINES', 'vuelta', 'CHACHAPOYAS', 'LIMA', '2026-04-01', '11:10', '2026-04-01', '12:35', 'USD', 217.19, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-01', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-01-13', '2026-01-16', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-13'::timestamptz, '2026-01-13'::timestamptz, 700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-01-16'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 4, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-01-13', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H012', '2026-01-16', 'liquidada', 700.0, 695.0, -5.0, 'trabajador_devuelve', '2026-01-16'::timestamptz, '2026-01-16'::timestamptz, '2026-01-16'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 5.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-01-16', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 695.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'DTZIST', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-13', '06:00', '2026-01-13', '07:25', 'USD', 108.18, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-13', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EFQALX', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-16', '15:55', '2026-01-16', '17:20', 'USD', 167.09, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-16', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 001-MM-SMBS-2026 · SHIRLEY BUJAICO · SAN MARTIN
  v_proy := (select id from proyectos where codigo = 'SMARTBOM' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'sbujaico@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-SMBS-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (SAN MARTIN)', 'LIMA', 'TARAPOTO', '2026-03-04', '2026-03-05', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-04'::timestamptz, '2026-03-04'::timestamptz, 700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-05'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'SHIRLEY BUJAICO', false, 2, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-03-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H013', '2026-03-05', 'liquidada', 700.0, 833.0, 133.0, 'empresa_reembolsa', '2026-03-05'::timestamptz, '2026-03-05'::timestamptz, '2026-03-05'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 133.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-05', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 833.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MPNBWJ', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'TAPAPOTO', '2026-03-04', '07:35', '2026-03-04', '09:00', 'USD', 663.44, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-04', 'Histórico Excel');
  v_n := v_n + 1;
  -- 003-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-01-23', '2026-01-30', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-23'::timestamptz, '2026-01-23'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-01-30'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 8, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-01-23', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H014', '2026-01-30', 'liquidada', 600.0, 2549.47, 1949.4699999999998, 'empresa_reembolsa', '2026-01-30'::timestamptz, '2026-01-30'::timestamptz, '2026-01-30'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1949.47 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-01-30', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 2549.47, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'FGXRBN', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-23', '07:35', '2026-01-23', '09:00', 'USD', 108.18, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-23', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '23/01/2026 - 27/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 406.5, null, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '27/01/2026 - 29/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 300.0, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 002-MM-HJRZ-2026 · HUMBERTO RAMIREZ · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (AMAZONAS)', 'LIMA', 'TARAPOTO', '2026-02-23', '2026-02-27', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-23'::timestamptz, '2026-02-23'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-27'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 5, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-02-23', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H015', '2026-02-27', 'liquidada', 600.0, 928.4, 328.4, 'empresa_reembolsa', '2026-02-27'::timestamptz, '2026-02-27'::timestamptz, '2026-02-27'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 328.4 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-27', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 928.4, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UFCDJS', 'aereo', 'SKY AIRLINE', 'ida', 'LIMA', 'TARAPOTO', '2026-02-23', '05:25', '2026-02-23', '06:50', 'USD', 196.68, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-23', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-NRRR-2026 · NICOLAS ROJAS · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-03-11', '2026-03-11', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-11'::timestamptz, '2026-03-11'::timestamptz, 410.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-11'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 1, true, 0, 410.0, 410.0, 410.0, 410.0, '2026-03-11', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H016', '2026-03-11', 'liquidada', 410.0, 360.3, -49.69999999999999, 'trabajador_devuelve', '2026-03-11'::timestamptz, '2026-03-11'::timestamptz, '2026-03-11'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 49.7 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-11', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 360.3, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'FCLPCY', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-03-11', '05:35', '2026-03-11', '07:25', 'USD', 407.03, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-11', 'Histórico Excel');
  v_n := v_n + 1;
  -- 002-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-02-23', '2026-02-24', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-23'::timestamptz, '2026-02-23'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-24'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 2, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-02-23', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H017', '2026-02-24', 'liquidada', 600.0, 520.1, -79.89999999999998, 'trabajador_devuelve', '2026-02-24'::timestamptz, '2026-02-24'::timestamptz, '2026-02-24'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 79.9 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-24', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 520.1, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'AXJLCY', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-02-23', '06:00', '2026-02-23', '07:25', 'USD', 373.07, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-23', 'Histórico Excel');
  v_n := v_n + 1;
  -- 004-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-02-12', null, true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-12'::timestamptz, '2026-02-12'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-12'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 1, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-02-12', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H018', '2026-02-12', 'liquidada', 600.0, 1165.62, 565.6199999999999, 'empresa_reembolsa', '2026-02-12'::timestamptz, '2026-02-12'::timestamptz, '2026-02-12'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 565.62 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-12', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1165.62, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JABXAF', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-02-12', '06:00', '2026-02-12', '07:25', 'USD', 190.78, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-12', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'Alojamiento', null, 'CUSCO', '2026-03-20', 'PEN', 111.99, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'Cancelado', null, 'CUSCO', '2026-03-20', 'USD', 2.01, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 001-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-01-05', '2026-02-01', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-05'::timestamptz, '2026-01-05'::timestamptz, 3400.0, '$199.09 se perdió en compra de pasajes aéreos · Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-01'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 28, true, 0, 3400.0, 3400.0, 3400.0, 3400.0, '2026-01-05', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H019', '2026-02-01', 'liquidada', 3400.0, 2085.93, -1314.0700000000002, 'trabajador_devuelve', '2026-02-01'::timestamptz, '2026-02-01'::timestamptz, '2026-02-01'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 1314.07 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-01', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 2085.93, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EENMOM', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2029-01-19', '18:45', '2029-01-19', '20:25', 'USD', 165.91, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2029-01-19', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EENMOM2', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-25', '19:50', '2026-01-25', '21:20', 'USD', 1.84, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-25', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EENMOM3', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-28', '20:10', '2026-01-28', '21:40', 'USD', 31.34, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-28', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LNHTLH', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-06', '16:35', '2026-01-06', '18:05', 'USD', 145.94, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-06', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MJOZAQ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-02-01', '19:00', '2026-02-01', '20:30', 'USD', 182.09, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-01', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '26/01/2026 - 28/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 208.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '29/01/2026 - 31/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 238.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '2026-02-01T00:00:00', null, 'CUSCO', '2026-03-20', 'PEN', 104.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '17/01/2026 - 19/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 238.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '20/01/2026 - 25/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 477.0, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '06/01/2026 - 09/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 314.51, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '10/01/2026 - 16/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 556.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 005-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-02-17', '2026-02-21', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-17'::timestamptz, '2026-02-17'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 5, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H020', '2026-02-21', 'liquidada', 0.0, 2507.92, 2507.92, 'empresa_reembolsa', '2026-02-21'::timestamptz, '2026-02-21'::timestamptz, '2026-02-21'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 2507.92 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-21', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 2507.92, 1, true);
  v_n := v_n + 1;
  -- 006-MM-GFMA-2026 · GUSTAVO MONTERO · SAN MARTIN
  v_proy := (select id from proyectos where codigo = 'SMARTBOM' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (SAN MARTIN)', 'LIMA', 'CHACHAPOYAS', '2026-02-24', '2026-02-24', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-24'::timestamptz, '2026-02-24'::timestamptz, 1000.0, 'Devolución de S/ 580.00 se hizo a la cuenta BBVA de la empresa · Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-24'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 1, true, 0, 1000.0, 1000.0, 1000.0, 1000.0, '2026-02-24', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H021', '2026-02-24', 'liquidada', 1000.0, 420.0, -580.0, 'trabajador_devuelve', '2026-02-24'::timestamptz, '2026-02-24'::timestamptz, '2026-02-24'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 580.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-24', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 420.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'PGWYBL', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'CHACHAPOYAS', '2026-02-24', '08:40', '2026-02-24', '10:10', 'USD', 168.36, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-24', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-RJNN-2026 · RICHARD NAVARRO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-01-06', '2026-02-21', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-06'::timestamptz, '2026-01-06'::timestamptz, 3850.0, '$199.09 se perdió en compra de pasajes aéreos · Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 47, true, 0, 3850.0, 3850.0, 3850.0, 3850.0, '2026-01-06', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H022', '2026-02-21', 'liquidada', 3850.0, 4580.66, 730.6599999999999, 'empresa_reembolsa', '2026-02-21'::timestamptz, '2026-02-21'::timestamptz, '2026-02-21'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 730.66 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-21', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 4580.66, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EENMOM', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2029-01-19', '18:45', '2029-01-19', '20:25', 'USD', 165.91, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2029-01-19', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EENMOM2', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-25', '19:50', '2026-01-25', '21:20', 'USD', 1.84, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-25', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EENMOM3', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-01-28', '20:10', '2026-01-28', '21:40', 'USD', 31.34, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-28', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LNHTLH', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-06', '16:35', '2026-01-06', '18:05', 'USD', 145.94, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-06', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MJOZAQ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-02-01', '19:00', '2026-02-01', '20:30', 'USD', 182.09, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-01', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WNKSWP', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-02-12', '07:45', '2026-02-12', '09:10', 'USD', 203.76, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-12', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WPQNDT', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-02-21', '20:10', '2026-02-21', '21:40', 'USD', 171.01, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-21', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '2026-02-01T00:00:00', null, 'CUSCO', '2026-03-20', 'PEN', 104.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '06/01/2026 - 09/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 314.51, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '10/01/2026 - 16/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 556.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '17/01/2026 - 19/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 238.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '20/01/2026 - 25/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 477.0, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '26/01/2026 - 28/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 208.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '29/01/2026 - 31/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 238.5, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 001-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-03-25', '2026-03-25', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-25'::timestamptz, '2026-03-25'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WHUXRH', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-03-25', '07:35', '2026-03-25', '09:00', 'USD', 335.83, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-25', 'Histórico Excel');
  v_n := v_n + 1;
  -- 002-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-02-16', '2026-02-16', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-16'::timestamptz, '2026-02-16'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-16'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UEAGCS', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-02-16', '11:30', '2026-02-16', '12:55', 'USD', 516.37, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-16', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-OTROS-2026 · EXTERNOS · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-01-22', '2026-01-22', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-01-22'::timestamptz, '2026-01-22'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-01-22'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LQCYPB', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-01-06', '19:55', '2026-01-06', '21:25', 'USD', 1013.32, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-01-06', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '06/01/2026 - 16/01/2026', null, 'CUSCO', '2026-03-20', 'PEN', 2580.9, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 003-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-02-06', '2026-02-06', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-06'::timestamptz, '2026-02-06'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SFHVIX', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-02-06', '06:00', '2026-02-06', '19:50', 'USD', 464.07, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-06', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 002-MM-MACR-2026 · MONICA CHUMAN · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-MACR-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-02-06', '2026-02-06', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-06'::timestamptz, '2026-02-06'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MONICA CHUMAN', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SFHVIX', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-02-06', '06:00', '2026-02-06', '19:50', 'USD', 464.07, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-06', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 004-MM-GJMJ-2026 · GUILLERMO MACHER · BUSQUEDA DE NUEVOS PROYECTOS
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a IQUITOS (BUSQUEDA DE NUEVOS PROYECTOS)', 'LIMA', 'IQUITOS', '2026-02-05', '2026-02-05', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-05'::timestamptz, '2026-02-05'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-05'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'NONMWT', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-02-05', '03:30', '2026-02-05', '20:25', 'USD', 397.59, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-02-05', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'Alojamiento', null, 'IQUITOS', '2026-03-20', 'PEN', 350.0, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-03-20', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 007-MM-GFMA-2026 · GUSTAVO MONTERO · SAN MARTIN
  v_proy := (select id from proyectos where codigo = 'SMARTBOM' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (SAN MARTIN)', 'LIMA', 'CHACHAPOYAS', '2026-02-25', '2026-02-28', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-02-25'::timestamptz, '2026-02-25'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-02-28'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 4, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H023', '2026-02-28', 'liquidada', 0.0, 1750.32, 1750.32, 'empresa_reembolsa', '2026-02-28'::timestamptz, '2026-02-28'::timestamptz, '2026-02-28'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1750.32 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-02-28', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1750.32, 1, true);
  v_n := v_n + 1;
  -- 008-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-03-13', '2026-03-20', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-13'::timestamptz, '2026-03-13'::timestamptz, 800.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-20'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 8, true, 0, 800.0, 800.0, 800.0, 800.0, '2026-03-13', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H024', '2026-03-20', 'liquidada', 800.0, 2587.22, 1787.2199999999998, 'empresa_reembolsa', '2026-03-20'::timestamptz, '2026-03-20'::timestamptz, '2026-03-20'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1787.22 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-20', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 2587.22, 1, true);
  v_n := v_n + 1;
  -- 003-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-MACO-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-04-08', '2026-04-09', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-08'::timestamptz, '2026-04-08'::timestamptz, 370.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 2, true, 0, 370.0, 370.0, 370.0, 370.0, '2026-04-08', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H025', '2026-04-09', 'borrador', 370.0, 0.0, -370.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 370.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'OALZIP', 'aereo', 'ATSA AIRLINES', 'multitramo', 'LIMA', 'HUANUCO', '2026-04-08', '08:25', '2026-04-08', '09:15', 'USD', 189.6, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-08', 'Histórico Excel');
  v_n := v_n + 1;
  -- 002-MM-NRRR-2026 · NICOLAS ROJAS · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a LIMA (GORE CUSCO AMBULANCIAS)', 'CUSCO', 'LIMA', '2026-04-01', '2026-04-01', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, 700.0, 'Pasaje de ida se lo compró la supervisión · Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-01'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 1, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-04-01', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H026', '2026-04-01', 'liquidada', 700.0, 602.16, -97.84000000000003, 'trabajador_devuelve', '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, '2026-04-01'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 97.84 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-01', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 602.16, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WZEUBO', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-01', '19:45', '2026-04-01', '21:20', 'USD', 99.78, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-01', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-04-06', '2026-04-06', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-06'::timestamptz, '2026-04-06'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WIWHVW', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-04-06', '07:05', '2026-04-06', '08:25', 'USD', 464.45, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-06', 'Histórico Excel');
  v_n := v_n + 1;
  -- 004-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-MACO-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-13', '2026-04-13', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-13'::timestamptz, '2026-04-13'::timestamptz, 6350.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-13'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 1, true, 0, 6350.0, 6350.0, 6350.0, 6350.0, '2026-04-13', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H027', '2026-04-13', 'liquidada', 6350.0, 8908.0, 2558.0, 'empresa_reembolsa', '2026-04-13'::timestamptz, '2026-04-13'::timestamptz, '2026-04-13'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 2558.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-13', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 8908.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'DVTMUK', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-05-22', '12:15', '2026-05-22', '13:50', 'USD', 142.69, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-22', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EAWKMD', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-04-13', '06:00', '2026-04-13', '07:20', 'USD', 179.84, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-13', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JHJLFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-05-04', '07:05', '2026-05-04', '08:25', 'USD', 199.04, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-04', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UZYDZZ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-30', '19:40', '2026-04-30', '21:20', 'USD', 104.93, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-30', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WNBUXP', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-16', '21:15', '2026-04-16', '22:55', 'USD', 70.71, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-16', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'AIRBNB 27/04/2026 - 29/04/2026', null, 'CUSCO', '2026-04-24', 'PEN', 593.11, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-04-24', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'AIRBNB 29/04/2026 - 30/04/2026', null, 'CUSCO', '2026-04-28', 'PEN', 317.94, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-04-28', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '04/05/2026 - 09/05/2026 
6 PERSONAS', null, 'CUSCO', '2026-05-04', 'PEN', 1374.06, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-05-04', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '09/05/2026 - 13/05/2026
4 PERSONAS', null, 'CUSCO', '2026-05-08', 'PEN', 647.28, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-05-08', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '13/05/2026 - 16/05/2026
4 PERSONAS', null, 'CUSCO', '2026-05-12', 'PEN', 508.09, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-05-12', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '16/05/2026 - 19/05/2026
4 PERSONAS', null, 'CUSCO', '2026-05-15', 'PEN', 510.08, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-05-15', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', '19/05/2026 - 22/05/2026
2 PERSONAS', null, 'CUSCO', '2026-05-19', 'PEN', 505.11, null, 'efectivo', 'Caja chica soles', 'pagado', '2026-05-19', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 006-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-04-08', '2026-04-08', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-08'::timestamptz, '2026-04-08'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-08'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CLSBCK', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-04-08', '07:05', '2026-04-08', '08:25', 'USD', 270.93, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-08', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-LOMM-2026 · LISBET MONTEZA · MUNI CUSCO
  v_proy := (select id from proyectos where codigo = '01CUSMUN24' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (MUNI CUSCO)', 'LIMA', 'CUSCO', '2026-04-13', '2026-04-13', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-13'::timestamptz, '2026-04-13'::timestamptz, 150.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-13'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 1, true, 0, 150.0, 150.0, 150.0, 150.0, '2026-04-13', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H028', '2026-04-13', 'liquidada', 150.0, 263.0, 113.0, 'empresa_reembolsa', '2026-04-13'::timestamptz, '2026-04-13'::timestamptz, '2026-04-13'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 113.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-13', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 263.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EAWKMD', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-04-13', '06:00', '2026-04-13', '07:20', 'USD', 179.84, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-13', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 005-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-07', '2026-04-30', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-07'::timestamptz, '2026-04-07'::timestamptz, 4350.1, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-30'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 24, true, 0, 4350.1, 4350.1, 4350.1, 4350.1, '2026-04-07', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H029', '2026-04-30', 'liquidada', 4350.1, 4480.22, 130.1199999999999, 'empresa_reembolsa', '2026-04-30'::timestamptz, '2026-04-30'::timestamptz, '2026-04-30'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 130.22 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-30', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 4480.22, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'FLHPZR', 'aereo', 'SKY AIRLINE', 'ida', 'LIMA', 'CUSCO', '2026-04-07', '07:05', '2026-04-07', '08:35', 'USD', 86.94, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-07', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UZYDZZ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-30', '19:40', '2026-04-30', '21:20', 'USD', 104.93, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-30', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 004-MM-RJNN-2026 · RICHARD NAVARRO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-27', '2026-04-30', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-27'::timestamptz, '2026-04-27'::timestamptz, 320.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-30'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 4, true, 0, 320.0, 320.0, 320.0, 320.0, '2026-04-27', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H030', '2026-04-30', 'liquidada', 320.0, 484.8, 164.8, 'empresa_reembolsa', '2026-04-30'::timestamptz, '2026-04-30'::timestamptz, '2026-04-30'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 164.8 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-30', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 484.8, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CJOWSO', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-04-27', '04:50', '2026-04-27', '06:10', 'USD', 102.28, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-27', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UZYDZZ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-30', '19:40', '2026-04-30', '21:20', 'USD', 104.93, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-30', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 006-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-04', '2026-05-09', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-04'::timestamptz, '2026-05-04'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-09'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 6, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-05-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H031', '2026-05-09', 'liquidada', 600.0, 939.9, 339.9, 'empresa_reembolsa', '2026-05-09'::timestamptz, '2026-05-09'::timestamptz, '2026-05-09'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 339.9 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-09', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 939.9, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'COAIJP', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-05-09', '09:05', '2026-05-09', '10:40', 'USD', 88.82, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-09', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JHJLFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-05-04', '07:05', '2026-05-04', '08:25', 'USD', 199.04, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-04', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 003-MM-GADV-2026 · GABRIELA DUNN · MUNI CUSCO
  v_proy := (select id from proyectos where codigo = '01CUSMUN24' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-GADV-2026', v_proy, v_cdc, 'Viaje a CUSCO (MUNI CUSCO)', 'LIMA', 'CUSCO', '2026-04-16', '2026-04-18', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-16'::timestamptz, '2026-04-16'::timestamptz, 150.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-18'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 3, true, 0, 150.0, 150.0, 150.0, 150.0, '2026-04-16', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H032', '2026-04-18', 'liquidada', 150.0, 613.38, 463.38, 'empresa_reembolsa', '2026-04-18'::timestamptz, '2026-04-18'::timestamptz, '2026-04-18'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 463.38 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-18', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 613.38, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JOUPKS', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-04-16', '07:05', '2026-04-16', '08:25', 'USD', 77.5, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-16', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-JARZ-2026 · ANTONIO REYES · MUNI CUSCO
  v_proy := (select id from proyectos where codigo = '01CUSMUN24' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (MUNI CUSCO)', 'LIMA', 'CUSCO', '2026-04-21', '2026-04-21', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-21'::timestamptz, '2026-04-21'::timestamptz, 150.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 1, true, 0, 150.0, 150.0, 150.0, 150.0, '2026-04-21', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H033', '2026-04-21', 'liquidada', 150.0, 216.1, 66.1, 'empresa_reembolsa', '2026-04-21'::timestamptz, '2026-04-21'::timestamptz, '2026-04-21'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 66.1 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-21', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 216.1, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'NSRQJV', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-04-21', '07:05', '2026-04-21', '08:25', 'USD', 136.41, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 003-MM-RJNN-2026 · RICHARD NAVARRO · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-04-19', '2026-04-25', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-19'::timestamptz, '2026-04-19'::timestamptz, 1500.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 7, true, 0, 1500.0, 1500.0, 1500.0, 1500.0, '2026-04-19', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H034', '2026-04-25', 'liquidada', 1500.0, 1787.04, 287.03999999999996, 'empresa_reembolsa', '2026-04-25'::timestamptz, '2026-04-25'::timestamptz, '2026-04-25'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 287.04 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-25', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1787.04, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ETYVBC', 'aereo', 'ATSA AIRLINES', 'multitramo', 'LIMA', 'CHACHAPOYAS', '2026-04-19', '08:40', '2026-04-19', '10:10', 'USD', 301.77, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-19', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LUYBJM', 'aereo', 'ATSA AIRLINES', 'vuelta', 'CHACHAPOYAS', 'LIMA', '2026-04-25', '12:15', '2026-04-25', '13:40', 'USD', 147.57, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-25', 'Histórico Excel');
  v_n := v_n + 1;
  -- 009-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '009-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-03-25', '2026-03-27', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-25'::timestamptz, '2026-03-25'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-27'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 3, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H035', '2026-03-27', 'liquidada', 0.0, 1883.92, 1883.92, 'empresa_reembolsa', '2026-03-27'::timestamptz, '2026-03-27'::timestamptz, '2026-03-27'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1883.92 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-27', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1883.92, 1, true);
  v_n := v_n + 1;
  -- 004-MM-GADV-2026 · GABRIELA DUNN · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-GADV-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-27', '2026-04-30', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-27'::timestamptz, '2026-04-27'::timestamptz, 640.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-30'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 4, true, 0, 640.0, 640.0, 640.0, 640.0, '2026-04-27', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H036', '2026-04-30', 'liquidada', 640.0, 784.0, 144.0, 'empresa_reembolsa', '2026-04-30'::timestamptz, '2026-04-30'::timestamptz, '2026-04-30'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 144.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-30', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 784.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IMGGYK', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-04-27', '04:50', '2026-04-27', '06:10', 'USD', 102.28, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-27', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UZYDZZ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-30', '19:40', '2026-04-30', '21:20', 'USD', 104.93, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-30', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 002-MM-OTROS-2026 · EXTERNOS · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-27', '2026-04-29', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-27'::timestamptz, '2026-04-27'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-29'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 3, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IKAFLB', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-04-27', '04:50', '2026-04-27', '06:10', 'USD', 160.1, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-27', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WRRXQL', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-04-29', '18:45', '2026-04-29', '20:25', 'USD', 82.51, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-29', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-RJNN-2026 · RICHARD NAVARRO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-04', '2026-05-19', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-04'::timestamptz, '2026-05-04'::timestamptz, 1600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-19'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 16, true, 0, 1600.0, 1600.0, 1600.0, 1600.0, '2026-05-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H037', '2026-05-19', 'liquidada', 1600.0, 1064.98, -535.02, 'trabajador_devuelve', '2026-05-19'::timestamptz, '2026-05-19'::timestamptz, '2026-05-19'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 535.02 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-19', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1064.98, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IOTWGY', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-05-19', '17:30', '2026-05-19', '19:10', 'USD', 123.81, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-19', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JHJLFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-05-04', '07:05', '2026-05-04', '08:25', 'USD', 199.04, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-04', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 003-MM-OTROS-2026 · EXTERNOS · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-03', '2026-05-09', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-03'::timestamptz, '2026-05-03'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-09'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 7, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MTSRZP', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-05-09', '09:05', '2026-05-09', '10:40', 'USD', 124.99, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-09', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SMVTUD', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-05-03', '21:10', '2026-05-03', '22:35', 'USD', 158.68, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-03', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-GADV-2026 · GABRIELA DUNN · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-GADV-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-04', '2026-05-19', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-04'::timestamptz, '2026-05-04'::timestamptz, 1100.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-19'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 16, true, 0, 1100.0, 1100.0, 1100.0, 1100.0, '2026-05-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H038', '2026-05-19', 'liquidada', 1100.0, 1441.6, 341.5999999999999, 'empresa_reembolsa', '2026-05-19'::timestamptz, '2026-05-19'::timestamptz, '2026-05-19'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 341.6 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-19', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1441.6, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'FAQHQH', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-05-04', '07:05', '2026-05-04', '08:25', 'USD', 248.6, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-04', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IOTWGY', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-05-19', '17:30', '2026-05-19', '19:10', 'USD', 123.81, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-19', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 002-MM-JARZ-2026 · ANTONIO REYES · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-05-20', '2026-05-21', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-20'::timestamptz, '2026-05-20'::timestamptz, 250.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 2, true, 0, 250.0, 250.0, 250.0, 250.0, '2026-05-20', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H039', '2026-05-21', 'liquidada', 250.0, 325.0, 75.0, 'empresa_reembolsa', '2026-05-21'::timestamptz, '2026-05-21'::timestamptz, '2026-05-21'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 75.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-21', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 325.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'BBHODT', 'aereo', 'STAR UP', 'ida', 'LIMA', 'HUANUCO', '2026-05-20', '15:00', '2026-05-20', '15:50', 'USD', 189.6, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-20', 'Histórico Excel');
  v_n := v_n + 1;
  -- 006-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-04', '2026-05-22', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-04'::timestamptz, '2026-05-04'::timestamptz, 2100.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-22'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 19, true, 0, 2100.0, 2100.0, 2100.0, 2100.0, '2026-05-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H040', '2026-05-22', 'liquidada', 2100.0, 1674.6, -425.4000000000001, 'trabajador_devuelve', '2026-05-22'::timestamptz, '2026-05-22'::timestamptz, '2026-05-22'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 425.4 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-22', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1674.6, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JHJLFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-05-04', '07:05', '2026-05-04', '08:25', 'USD', 199.04, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-04', 'Histórico Excel · costo prorrateado entre 4 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LVHHJZ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-05-22', '12:15', '2026-05-22', '13:50', 'USD', 129.19, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-22', 'Histórico Excel');
  v_n := v_n + 1;
  -- 003-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-03-25', '2026-03-28', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-03-25'::timestamptz, '2026-03-25'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-03-28'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 4, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-03-25', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H041', '2026-03-28', 'liquidada', 600.0, 1790.52, 1190.52, 'empresa_reembolsa', '2026-03-28'::timestamptz, '2026-03-28'::timestamptz, '2026-03-28'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1190.52 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-03-28', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1790.52, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WADBFD', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-03-25', '07:35', '2026-03-25', '09:00', 'USD', 102.28, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-03-25', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 007-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-13', '2026-05-13', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-13'::timestamptz, '2026-05-13'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-13'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'QZVWIB', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-05-13', '06:30', '2026-05-13', '07:50', 'USD', 293.35, 3.4, 'efectivo', null, 'pagado', '2026-05-13', 'Histórico Excel');
  v_n := v_n + 1;
  -- 003-MM-NRRR-2026 · NICOLAS ROJAS · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-14', '2026-05-22', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-14'::timestamptz, '2026-04-14'::timestamptz, 700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-22'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 39, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-04-14', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H042', '2026-05-22', 'liquidada', 700.0, 364.6, -335.4, 'trabajador_devuelve', '2026-05-22'::timestamptz, '2026-05-22'::timestamptz, '2026-05-22'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 335.4 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-22', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 364.6, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'GQMLCX', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-04-14', '07:05', '2026-04-14', '08:25', 'USD', 101.1, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-04-14', 'Histórico Excel');
  v_n := v_n + 1;
  -- 008-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-21', '2026-05-21', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-21'::timestamptz, '2026-05-21'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EYCEQV', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-05-21', '07:05', '2026-05-21', '08:25', 'USD', 360.61, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 004-MM-OTROS-2026 · EXTERNOS · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'AREQUIPA', 'IQUITOS', '2026-05-03', '2026-05-05', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-03'::timestamptz, '2026-05-03'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-05'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 3, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UWXSLS', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-05-03', '19:40', '2026-05-03', '21:20', 'USD', 564.77, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-03', 'Histórico Excel');
  v_n := v_n + 1;
  -- 009-MM-GJMJ-2026 · GUILLERMO MACHER · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'gmacher@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '009-MM-GJMJ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-05-26', '2026-05-26', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-26'::timestamptz, '2026-05-26'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-26'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUILLERMO MACHER', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'AOUGBI', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-05-26', '06:15', '2026-05-26', '07:40', 'USD', 352.35, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-05-26', 'Histórico Excel');
  v_n := v_n + 1;
  -- 007-MM-LOMM-2026 · LISBET MONTEZA · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-04', '2026-06-06', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-04'::timestamptz, '2026-06-04'::timestamptz, 700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 3, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-06-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H043', '2026-06-06', 'liquidada', 700.0, 451.2, -248.8, 'trabajador_devuelve', '2026-06-06'::timestamptz, '2026-06-06'::timestamptz, '2026-06-06'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 248.8 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-06', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 451.2, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'HJQMDQ', 'aereo', 'STAR UP', 'ida', 'LIMA', 'HUANUCO', '2026-06-04', '08:25', '2026-06-04', '09:15', 'USD', 101.1, 3.4, 'efectivo', null, 'pagado', '2026-06-04', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WXUDQZ', 'aereo', 'STAR UP', 'vuelta', 'HUANUCO', 'LIMA', '2026-06-06', '09:45', '2026-06-06', '10:35', 'USD', 81.42, 3.4, 'efectivo', null, 'pagado', '2026-06-06', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 006-MM-RJNN-2026 · RICHARD NAVARRO · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-04', '2026-06-06', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-04'::timestamptz, '2026-06-04'::timestamptz, 700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-06'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 3, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-06-04', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H044', '2026-06-06', 'liquidada', 700.0, 546.0, -154.0, 'trabajador_devuelve', '2026-06-06'::timestamptz, '2026-06-06'::timestamptz, '2026-06-06'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 154.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-06', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 546.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'HJQMDQ', 'aereo', 'STAR UP', 'ida', 'LIMA', 'HUANUCO', '2026-06-04', '08:25', '2026-06-04', '09:15', 'USD', 101.1, 3.4, 'efectivo', null, 'pagado', '2026-06-04', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WXUDQZ', 'aereo', 'STAR UP', 'vuelta', 'HUANUCO', 'LIMA', '2026-06-06', '09:45', '2026-06-06', '10:35', 'USD', 81.42, 3.4, 'efectivo', null, 'pagado', '2026-06-06', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 005-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-MACO-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-06-09', null, true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-09'::timestamptz, '2026-06-09'::timestamptz, 1700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 1, true, 0, 1700.0, 1700.0, 1700.0, 1700.0, '2026-06-09', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H045', '2026-06-09', 'borrador', 1700.0, 0.0, -1700.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 1700.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'HQZDJK', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-06-26', '11:20', '2026-06-26', '12:55', 'USD', 159.21, 3.4, 'efectivo', null, 'pagado', '2026-06-26', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IGQQBQ', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-06-09', '06:15', '2026-06-09', '07:40', 'USD', 68.06, 3.4, 'efectivo', null, 'pagado', '2026-06-09', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 09/06/2026 AL 11/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-09', 'PEN', 261.41, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 11/06/2026 AL 13/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-10', 'PEN', 297.11, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 13/06/2026 AL 17/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-11', 'PEN', 562.56, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 17/06/2026 AL 22/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-17', 'PEN', 791.49, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 22/06/2026 AL 24/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-22', 'PEN', 348.65, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 24/06/2026 AL 25/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-24', 'PEN', 171.98, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 25/06/2026 AL 26/06/2026
2 PERSONAS', null, 'CUSCO', '2026-06-25', 'PEN', 171.22, null, 'pendiente', null, 'pendiente', null, 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 007-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-06-09', '2026-06-26', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-09'::timestamptz, '2026-06-09'::timestamptz, 3410.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-26'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 18, true, 0, 3410.0, 3410.0, 3410.0, 3410.0, '2026-06-09', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H046', '2026-06-26', 'liquidada', 3410.0, 3719.3, 309.3000000000002, 'empresa_reembolsa', '2026-06-26'::timestamptz, '2026-06-26'::timestamptz, '2026-06-26'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 309.3 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-26', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 3719.3, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'HQZDJK', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-06-26', '11:20', '2026-06-26', '12:55', 'USD', 159.21, 3.4, 'efectivo', null, 'pagado', '2026-06-26', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IGQQBQ', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-06-09', '06:15', '2026-06-09', '07:40', 'USD', 68.06, 3.4, 'efectivo', null, 'pagado', '2026-06-09', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 007-MM-RJNN-2026 · RICHARD NAVARRO · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-11', '2026-06-13', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-11'::timestamptz, '2026-06-11'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-13'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 3, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-06-11', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H047', '2026-06-13', 'liquidada', 300.0, 490.0, 190.0, 'empresa_reembolsa', '2026-06-13'::timestamptz, '2026-06-13'::timestamptz, '2026-06-13'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 190.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-13', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 490.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ALYOMQ', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'HUANUCO', '2026-06-11', '14:55', '2026-06-11', '15:45', 'USD', 103.46, 3.4, 'efectivo', null, 'pagado', '2026-06-11', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'TVZJXF', 'aereo', 'ATSA AIRLINES', 'vuelta', 'HUANUCO', 'LIMA', '2026-06-13', '16:35', '2026-06-13', '17:20', 'USD', 75.52, 3.4, 'efectivo', null, 'pagado', '2026-06-13', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 008-MM-LOMM-2026 · LISBET MONTEZA · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-11', '2026-06-13', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-11'::timestamptz, '2026-06-11'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-13'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 3, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-06-11', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H048', '2026-06-13', 'liquidada', 300.0, 447.7, 147.7, 'empresa_reembolsa', '2026-06-13'::timestamptz, '2026-06-13'::timestamptz, '2026-06-13'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 147.7 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-13', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 447.7, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ALYOMQ', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'HUANUCO', '2026-06-11', '14:55', '2026-06-11', '15:45', 'USD', 103.46, 3.4, 'efectivo', null, 'pagado', '2026-06-11', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'TVZJXF', 'aereo', 'ATSA AIRLINES', 'vuelta', 'HUANUCO', 'LIMA', '2026-06-13', '16:35', '2026-06-13', '17:20', 'USD', 75.52, 3.4, 'efectivo', null, 'pagado', '2026-06-13', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 008-MM-RJNN-2026 · RICHARD NAVARRO · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (GORE LORETO BOMBEROS)', 'LIMA', 'CHACHAPOYAS', '2026-06-15', '2026-06-18', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-15'::timestamptz, '2026-06-15'::timestamptz, 700.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-18'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 4, true, 0, 700.0, 700.0, 700.0, 700.0, '2026-06-15', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H049', '2026-06-18', 'liquidada', 700.0, 1215.9, 515.9000000000001, 'empresa_reembolsa', '2026-06-18'::timestamptz, '2026-06-18'::timestamptz, '2026-06-18'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 515.9 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-18', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1215.9, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JXTWDC', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'TARAPOTO', '2026-06-15', '15:40', '2026-06-15', '17:15', 'USD', 143.58, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-06-15', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SPSJIC', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TARAPOTO', 'LIMA', '2026-06-18', '20:40', '2026-06-18', '22:05', 'USD', 72.29, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-06-18', 'Histórico Excel');
  v_n := v_n + 1;
  -- 009-MM-LOMM-2026 · LISBET MONTEZA · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '009-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-17', '2026-06-20', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-17'::timestamptz, '2026-06-17'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-20'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 4, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-06-17', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H050', '2026-06-20', 'liquidada', 600.0, 614.2, 14.200000000000045, 'empresa_reembolsa', '2026-06-20'::timestamptz, '2026-06-20'::timestamptz, '2026-06-20'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 14.2 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-20', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 614.2, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'KHZZSM', 'aereo', 'STAR UP', 'vuelta', 'HUANUCO', 'LIMA', '2026-06-20', '09:45', '2026-06-20', '10:35', 'USD', 156.94, 3.4, 'efectivo', null, 'pagado', '2026-06-20', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SDBACG', 'aereo', 'STAR UP', 'ida', 'LIMA', 'HUANUCO', '2026-06-17', '08:25', '2026-06-17', '09:15', 'USD', 101.1, 3.4, 'efectivo', null, 'pagado', '2026-06-17', 'Histórico Excel');
  v_n := v_n + 1;
  -- 003-MM-JARZ-2026 · ANTONIO REYES · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-17', '2026-06-18', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-17'::timestamptz, '2026-06-17'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-18'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 2, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-06-17', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H051', '2026-06-18', 'liquidada', 300.0, 360.0, 60.0, 'empresa_reembolsa', '2026-06-18'::timestamptz, '2026-06-18'::timestamptz, '2026-06-18'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 60.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-18', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 360.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CYUYFZ', 'aereo', 'STAR UP', 'multitramo', 'LIMA', 'HUANUCO', '2026-06-17', '11:55', '2026-06-17', '12:45', 'USD', 182.52, 3.4, 'efectivo', null, 'pagado', '2026-06-17', 'Histórico Excel');
  v_n := v_n + 1;
  -- 010-MM-GFMA-2026 · GUSTAVO MONTERO · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '010-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-04-27', '2026-04-29', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-27'::timestamptz, '2026-04-27'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-29'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 3, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H052', '2026-04-29', 'liquidada', 0.0, 1125.17, 1125.17, 'empresa_reembolsa', '2026-04-29'::timestamptz, '2026-04-29'::timestamptz, '2026-04-29'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1125.17 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-29', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1125.17, 1, true);
  v_n := v_n + 1;
  -- 011-MM-GFMA-2026 · GUSTAVO MONTERO · BUSQUEDA DE NUEVOS PROYECTOS
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '011-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a LORETO (BUSQUEDA DE NUEVOS PROYECTOS)', 'LIMA', 'LORETO', '2026-04-22', '2026-04-24', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-04-22'::timestamptz, '2026-04-22'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-04-24'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 3, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H053', '2026-04-24', 'liquidada', 0.0, 1359.78, 1359.78, 'empresa_reembolsa', '2026-04-24'::timestamptz, '2026-04-24'::timestamptz, '2026-04-24'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1359.78 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-04-24', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1359.78, 1, true);
  v_n := v_n + 1;
  -- 012-MM-GFMA-2026 · GUSTAVO MONTERO · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '012-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-05-02', '2026-05-07', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-05-02'::timestamptz, '2026-05-02'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-05-07'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 6, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H054', '2026-05-07', 'liquidada', 0.0, 1060.77, 1060.77, 'empresa_reembolsa', '2026-05-07'::timestamptz, '2026-05-07'::timestamptz, '2026-05-07'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1060.77 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-05-07', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1060.77, 1, true);
  v_n := v_n + 1;
  -- 004-MM-NRRR-2026 · NICOLAS ROJAS · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-06-25', '2026-06-25', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-25'::timestamptz, '2026-06-25'::timestamptz, 250.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-06-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 1, true, 0, 250.0, 250.0, 250.0, 250.0, '2026-06-25', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H055', '2026-06-25', 'liquidada', 250.0, 410.5, 160.5, 'empresa_reembolsa', '2026-06-25'::timestamptz, '2026-06-25'::timestamptz, '2026-06-25'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 160.5 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-06-25', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 410.5, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JEIYKW', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-06-25', '06:45', '2026-06-25', '08:35', 'USD', 279.59, 3.4, 'efectivo', null, 'pagado', '2026-06-25', 'Histórico Excel');
  v_n := v_n + 1;
  -- 008-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-06-30', '2026-07-14', false, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-06-30'::timestamptz, '2026-06-30'::timestamptz, 1800.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-14'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 15, true, 0, 1800.0, 1800.0, 1800.0, 1800.0, '2026-06-30', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H056', '2026-07-14', 'liquidada', 1800.0, 2633.07, 833.0700000000002, 'empresa_reembolsa', '2026-07-14'::timestamptz, '2026-07-14'::timestamptz, '2026-07-14'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 833.07 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-14', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 2633.07, 1, true);
  v_n := v_n + 1;
  -- 004-MM-JARZ-2026 · ANTONIO REYES · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '004-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-07-02', '2026-07-04', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-02'::timestamptz, '2026-07-02'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-04'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 3, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-07-02', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H057', '2026-07-04', 'liquidada', 300.0, 468.0, 168.0, 'empresa_reembolsa', '2026-07-04'::timestamptz, '2026-07-04'::timestamptz, '2026-07-04'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 168.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-04', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 468.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SBLUFC', 'aereo', 'STAR UP', 'multitramo', 'LIMA', 'HUANUCO', '2026-07-02', '11:55', '2026-07-02', '12:45', 'USD', 256.86, 3.4, 'efectivo', null, 'pagado', '2026-07-02', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-JARZ-2026 · ANTONIO REYES · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-07-08', '2026-07-09', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-08'::timestamptz, '2026-07-08'::timestamptz, 350.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-09'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 2, true, 0, 350.0, 350.0, 350.0, 350.0, '2026-07-08', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H058', '2026-07-09', 'liquidada', 350.0, 385.0, 35.0, 'empresa_reembolsa', '2026-07-09'::timestamptz, '2026-07-09'::timestamptz, '2026-07-09'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 35.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-09', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 385.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EJKLFT', 'aereo', 'ATSA AIRLINES', 'vuelta', 'HUANUCO', 'LIMA', '2026-07-09', '16:25', '2026-07-09', '17:15', 'USD', 81.42, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-09', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'VILLEH', 'aereo', 'STAR UP', 'ida', 'LIMA', 'HUANUCO', '2026-07-08', '11:55', '2026-07-08', '12:45', 'USD', 122.34, 3.4, 'efectivo', null, 'pagado', '2026-07-08', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-OTROS-2026 · EXTERNOS · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a LIMA (AMAZONAS)', 'CHACHAPOYAS', 'LIMA', '2026-07-10', '2026-07-11', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-10'::timestamptz, '2026-07-10'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-11'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 2, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H059', '2026-07-11', 'liquidada', 0.0, 172.83, 172.83, 'empresa_reembolsa', '2026-07-11'::timestamptz, '2026-07-11'::timestamptz, '2026-07-11'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 172.83 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-11', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 172.83, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'KNVTVE', 'aereo', 'ATSA AIRLINES', 'multitramo', 'CHACHAPOYAS', 'LIMA', '2026-07-10', '12:15', '2026-07-10', '13:40', 'USD', 424.49, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-10', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 10/07/2026 AL 11/07/2026
1 PERSONA GILBERTO LA TORRE', null, 'LIMA', '2026-07-09', 'PEN', 171.65, null, 'pendiente', 'Caja chica soles', 'pendiente', null, 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 009-MM-RJNN-2026 · RICHARD NAVARRO · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '009-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (AMAZONAS)', 'LIMA', 'TARAPOTO', '2026-07-10', '2026-07-12', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-10'::timestamptz, '2026-07-10'::timestamptz, 500.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-12'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 3, true, 0, 500.0, 500.0, 500.0, 500.0, '2026-07-10', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H060', '2026-07-12', 'liquidada', 500.0, 1207.18, 707.1800000000001, 'empresa_reembolsa', '2026-07-12'::timestamptz, '2026-07-12'::timestamptz, '2026-07-12'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 707.18 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-12', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1207.18, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LBUTVE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'TARAPOTO', '2026-07-10', '15:30', '2026-07-10', '17:00', 'USD', 178.98, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-10', 'Histórico Excel');
  v_n := v_n + 1;
  -- 006-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-MACO-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-07-14', null, true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-14'::timestamptz, '2026-07-14'::timestamptz, 450.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 1, true, 0, 450.0, 450.0, 450.0, 450.0, '2026-07-14', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H061', '2026-07-14', 'borrador', 450.0, 0.0, -450.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 450.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JLHWWR', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-07-14', '08:40', '2026-07-14', '10:00', 'USD', 130.6, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-14', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SEKBGG', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-07-16', '14:50', '2026-07-16', '16:25', 'USD', 65.99, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-16', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 14/07/2026 AL 17/07/2026 
1 PERSONA', null, 'CUSCO', '2026-07-13', 'PEN', 300.0, null, 'pendiente', 'Caja chica soles', 'pendiente', null, 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 010-MM-RJNN-2026 · RICHARD NAVARRO · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '010-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (AMAZONAS)', 'LIMA', 'TARAPOTO', '2026-07-17', '2026-07-25', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-17'::timestamptz, '2026-07-17'::timestamptz, 1910.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 9, true, 0, 1910.0, 1910.0, 1910.0, 1910.0, '2026-07-17', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H062', '2026-07-25', 'liquidada', 1910.0, 3597.3, 1687.3000000000002, 'empresa_reembolsa', '2026-07-25'::timestamptz, '2026-07-25'::timestamptz, '2026-07-25'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 1687.3 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-25', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 3597.3, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'DOTULA', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'TARAPOTO', '2026-07-17', '15:30', '2026-07-17', '17:00', 'USD', 199.82, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-17', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WJFXFU', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TARAPOTO', 'LIMA', '2026-07-25', '09:35', '2026-07-25', '10:55', 'USD', 185.57, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-25', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 006-MM-OTROS-2026 · EXTERNOS · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a LIMA (GORE LORETO BOMBEROS)', 'IQUITOS', 'LIMA', '2026-07-16', '2026-07-17', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-16'::timestamptz, '2026-07-16'::timestamptz, 1000.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-17'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 2, true, 0, 1000.0, 1000.0, 1000.0, 1000.0, '2026-07-16', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H063', '2026-07-17', 'liquidada', 1000.0, 1000.0, 0.0, 'cuadra', '2026-07-17'::timestamptz, '2026-07-17'::timestamptz, '2026-07-17'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-17', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1000.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JZGRNV', 'aereo', 'LATAM AIRLINES', 'multitramo', 'IQUITOS', 'LIMA', '2026-07-16', '00:05', '2026-07-16', '01:55', 'USD', 228.85, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-16', 'Histórico Excel');
  v_n := v_n + 1;
  -- 006-MM-GADV-2026 · GABRIELA DUNN · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-GADV-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (AMAZONAS)', 'LIMA', 'TARAPOTO', '2026-07-20', '2026-07-25', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-20'::timestamptz, '2026-07-20'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 6, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H064', '2026-07-25', 'liquidada', 0.0, 838.8, 838.8, 'empresa_reembolsa', '2026-07-25'::timestamptz, '2026-07-25'::timestamptz, '2026-07-25'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 838.8 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-25', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 838.8, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WJFXFU', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TARAPOTO', 'LIMA', '2026-07-25', '09:35', '2026-07-25', '10:55', 'USD', 185.57, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-25', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WWRGFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'TARAPOTO', '2026-07-20', '07:25', '2026-07-20', '08:55', 'USD', 216.74, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-20', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 007-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-MACO-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (AMAZONAS)', 'LIMA', 'TARAPOTO', '2026-07-20', null, true, false, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-20'::timestamptz, '2026-07-20'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WJFXFU', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TARAPOTO', 'LIMA', '2026-07-25', '09:35', '2026-07-25', '10:55', 'USD', 185.57, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-25', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WWRGFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'TARAPOTO', '2026-07-20', '07:25', '2026-07-20', '08:55', 'USD', 216.74, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-20', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 20/07/2026 AL 23/07/2026 
4 PERSONA', null, 'TARAPOTO', '2026-07-18', 'PEN', 505.09, null, 'transferencia', 'Caja chica soles', 'pagado', '2026-07-18', 'Histórico Excel · alojamiento');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'hospedaje', 'DEL 23/07/2026 AL 25/07/2026 
4 PERSONA', null, 'TARAPOTO', '2026-07-22', 'PEN', 637.48, null, 'transferencia', 'Caja chica soles', 'pagado', '2026-07-22', 'Histórico Excel · alojamiento');
  v_n := v_n + 1;
  -- 009-MM-HJRZ-2026 · HUMBERTO RAMIREZ · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '009-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (AMAZONAS)', 'LIMA', 'TARAPOTO', '2026-07-20', '2026-07-23', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-20'::timestamptz, '2026-07-20'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-23'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 4, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H065', '2026-07-23', 'liquidada', 0.0, 533.9, 533.9, 'empresa_reembolsa', '2026-07-23'::timestamptz, '2026-07-23'::timestamptz, '2026-07-23'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 533.9 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-23', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 533.9, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ASWMSZ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TARAPOTO', 'LIMA', '2026-07-23', '10:40', '2026-07-23', '12:00', 'USD', 159.61, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-23', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WWRGFE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'TARAPOTO', '2026-07-20', '07:25', '2026-07-20', '08:55', 'USD', 216.74, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-20', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 007-MM-OTROS-2026 · EXTERNOS · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a LIMA (AMAZONAS)', 'TARAPOTO', 'LIMA', '2026-07-19', '2026-07-19', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-19'::timestamptz, '2026-07-19'::timestamptz, 3240.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-19'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 1, true, 0, 3240.0, 3240.0, 3240.0, 3240.0, '2026-07-19', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H066', '2026-07-19', 'liquidada', 3240.0, 3240.0, 0.0, 'cuadra', '2026-07-19'::timestamptz, '2026-07-19'::timestamptz, '2026-07-19'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-19', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 3240.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'NTCYFO', 'aereo', 'LATAM AIRLINES', 'multitramo', 'TARAPOTO', 'LIMA', '2026-07-19', '18:30', '2026-07-19', '19:55', 'USD', 745.62, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-19', 'Histórico Excel');
  v_n := v_n + 1;
  -- 002-MM-SMBS-2026 · SHIRLEY BUJAICO · BUSQUEDA DE NUEVOS PROYECTOS
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'sbujaico@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '002-MM-SMBS-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (BUSQUEDA DE NUEVOS PROYECTOS)', 'LIMA', 'TARAPOTO', '2026-07-21', null, true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-21'::timestamptz, '2026-07-21'::timestamptz, 600.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'SHIRLEY BUJAICO', false, 1, true, 0, 600.0, 600.0, 600.0, 600.0, '2026-07-21', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H067', '2026-07-21', 'liquidada', 600.0, 1375.5, 775.5, 'empresa_reembolsa', '2026-07-21'::timestamptz, '2026-07-21'::timestamptz, '2026-07-21'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 775.5 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-21', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1375.5, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'HAGPME', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'TARAPOTO', '2026-07-21', '18:30', '2026-07-21', '07:55', 'USD', 913.18, 3.4, 'efectivo', 'Caja chica dólares', 'pagado', '2026-07-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 010-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '010-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-07-21', '2026-07-22', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-21'::timestamptz, '2026-07-21'::timestamptz, 400.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-07-22'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 2, true, 0, 400.0, 400.0, 400.0, 400.0, '2026-07-21', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H068', '2026-07-22', 'liquidada', 400.0, 470.0, 70.0, 'empresa_reembolsa', '2026-07-22'::timestamptz, '2026-07-22'::timestamptz, '2026-07-22'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 70.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-07-22', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 470.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'AYGFGX', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-07-22', '18:45', '2026-07-22', '20:25', 'USD', 215.85, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-22', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CXHPYU', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-07-21', '06:15', '2026-07-21', '07:40', 'USD', 142.4, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 011-MM-RJNN-2026 · RICHARD NAVARRO · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '011-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-07-30', '2026-08-02', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-07-30'::timestamptz, '2026-07-30'::timestamptz, 860.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-08-02'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 4, true, 0, 860.0, 860.0, 860.0, 860.0, '2026-07-30', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H069', '2026-08-02', 'liquidada', 860.0, 953.0, 93.0, 'empresa_reembolsa', '2026-08-02'::timestamptz, '2026-08-02'::timestamptz, '2026-08-02'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 93.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-02', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 953.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UCVABQ', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'CHACHAPOYAS', '2026-07-30', '08:40', '2026-07-30', '10:10', 'USD', 256.86, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-07-30', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'YENVIT', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TARAPOTO', 'LIMA', '2026-08-02', '20:30', '2026-08-02', '21:55', 'USD', 215.07, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-02', 'Histórico Excel');
  v_n := v_n + 1;
  -- 013-MM-GFMA-2026 · GUSTAVO MONTERO · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '013-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-08-18', '2026-08-21', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-18'::timestamptz, '2026-08-18'::timestamptz, 800.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-08-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 4, true, 0, 800.0, 800.0, 800.0, 800.0, '2026-08-18', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H070', '2026-08-21', 'liquidada', 800.0, 885.0, 85.0, 'empresa_reembolsa', '2026-08-21'::timestamptz, '2026-08-21'::timestamptz, '2026-08-21'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 85.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-21', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 885.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'CITQWV', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-08-18', '06:45', '2026-08-18', '08:35', 'USD', 415.29, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-18', 'Histórico Excel');
  v_n := v_n + 1;
  -- 010-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '010-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-08-24', '2026-08-28', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-24'::timestamptz, '2026-08-24'::timestamptz, 750.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-08-28'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 5, true, 0, 750.0, 750.0, 750.0, 750.0, '2026-08-24', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H071', '2026-08-28', 'liquidada', 750.0, 1487.84, 737.8399999999999, 'empresa_reembolsa', '2026-08-28'::timestamptz, '2026-08-28'::timestamptz, '2026-08-28'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 737.84 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-28', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1487.84, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EWDZHE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-08-24', '11:40', '2026-08-24', '13:05', 'USD', 75.14, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-24', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IYGTJL', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-08-28', '18:50', '2026-08-28', '20:25', 'USD', 192.25, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-28', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 011-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '011-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-08-24', '2026-08-28', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-24'::timestamptz, '2026-08-24'::timestamptz, 750.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-08-28'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 5, true, 0, 750.0, 750.0, 750.0, 750.0, '2026-08-24', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H072', '2026-08-28', 'liquidada', 750.0, 813.7, 63.700000000000045, 'empresa_reembolsa', '2026-08-28'::timestamptz, '2026-08-28'::timestamptz, '2026-08-28'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 63.7 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-28', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 813.7, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EWDZHE', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2026-08-24', '11:40', '2026-08-24', '13:05', 'USD', 75.14, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-24', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IYGTJL', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-08-28', '18:50', '2026-08-28', '20:25', 'USD', 192.25, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-28', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 007-MM-GADV-2026 · GABRIELA DUNN · CUSCO HIDROAMBULANCIAS
  v_proy := (select id from proyectos where codigo = '07CUSHAM26' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-GADV-2026', v_proy, v_cdc, 'Viaje a PUCALLPA (CUSCO HIDROAMBULANCIAS)', 'LIMA', 'PUCALLPA', '2026-08-25', '2026-08-25', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, 400.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-08-25'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 1, true, 0, 400.0, 400.0, 400.0, 400.0, '2026-08-25', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H073', '2026-08-25', 'liquidada', 400.0, 582.7, 182.70000000000005, 'empresa_reembolsa', '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 182.7 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-25', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 582.7, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EXDHNJ', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'PUCALLPA', '2026-08-25', '06:15', '2026-08-25', '17:20', 'USD', 372.74, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-25', 'Histórico Excel');
  v_n := v_n + 1;
  -- 012-MM-RJNN-2026 · RICHARD NAVARRO · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'rnavarro@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '012-MM-RJNN-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-08-27', '2026-08-29', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-27'::timestamptz, '2026-08-27'::timestamptz, 640.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'RICHARD NAVARRO', false, 3, true, 0, 640.0, 640.0, 640.0, 640.0, '2026-08-27', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H074', '2026-08-29', 'aprobada', 640.0, 643.0, 3.0, 'empresa_reembolsa', '2026-08-29'::timestamptz, '2026-08-29'::timestamptz, null, null, 'Resumen del Excel: reembolso empresa 3.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-29', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 643.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WYNNPV', 'aereo', 'ATSA AIRLINES', 'multitramo', 'LIMA', 'CHACHAPOYAS', '2026-08-27', '08:40', '2026-08-27', '10:10', 'USD', 392.63, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-27', 'Histórico Excel');
  v_n := v_n + 1;
  -- 008-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-MACO-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-08-31', '2026-08-31', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-31'::timestamptz, '2026-08-31'::timestamptz, 250.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 1, true, 0, 250.0, 250.0, 250.0, 250.0, '2026-08-31', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H075', '2026-08-31', 'borrador', 250.0, 0.0, -250.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 250.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SJMLXT', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-08-31', '08:00', '2026-08-31', '09:50', 'USD', 176.93, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-31', 'Histórico Excel');
  v_n := v_n + 1;
  -- 009-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '009-MM-MACO-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-09-01', '2026-09-03', true, false, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-01'::timestamptz, '2026-09-01'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 3, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ASLQQR', 'aereo', 'ATSA AIRLINES', 'multitramo', 'LIMA', 'CHACHAPOYAS', '2026-09-01', '08:40', '2026-09-01', '10:10', 'USD', 392.63, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-01', 'Histórico Excel');
  v_n := v_n + 1;
  -- 005-MM-NRRR-2026 · NICOLAS ROJAS · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '005-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-08-31', '2026-08-31', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-08-31'::timestamptz, '2026-08-31'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-08-31'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H076', '2026-08-31', 'liquidada', 0.0, 194.65, 194.65, 'empresa_reembolsa', '2026-08-31'::timestamptz, '2026-08-31'::timestamptz, '2026-08-31'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 194.65 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-08-31', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 194.65, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MIUZJS', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'IQUITOS', '2026-08-31', '08:00', '2026-08-31', '09:50', 'USD', 187.0, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-08-31', 'Histórico Excel');
  v_n := v_n + 1;
  -- 012-MM-LOMM-2026 · LISBET MONTEZA · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '012-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-09-03', '2026-09-04', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-03'::timestamptz, '2026-09-03'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-09-04'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 2, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-09-03', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H077', '2026-09-04', 'liquidada', 300.0, 379.9, 79.89999999999998, 'empresa_reembolsa', '2026-09-04'::timestamptz, '2026-09-04'::timestamptz, '2026-09-04'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 79.9 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-09-04', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 379.9, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SDMAJR', 'aereo', 'STAR UP', 'multitramo', 'LIMA', 'HUANUCO', '2026-04-03', '08:25', '2026-04-03', '09:15', 'USD', 191.96, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-04-03', 'Histórico Excel');
  v_n := v_n + 1;
  -- 011-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '011-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-09-08', '2026-09-13', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-08'::timestamptz, '2026-09-08'::timestamptz, 1000.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-09-13'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 6, true, 0, 1000.0, 1000.0, 1000.0, 1000.0, '2026-09-08', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H078', '2026-09-13', 'liquidada', 1000.0, 1096.36, 96.3599999999999, 'empresa_reembolsa', '2026-09-13'::timestamptz, '2026-09-13'::timestamptz, '2026-09-13'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 96.36 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-09-13', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1096.36, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ETQKPP', 'aereo', 'LATAM AIRLINES', 'vuelta', 'IQUITOS', 'LIMA', '2026-09-13', '09:10', '2026-09-13', '11:00', 'USD', 99.43, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-13', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'YVQVGY', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'IQUITOS', '2026-09-08', '06:45', '2026-09-08', '08:35', 'USD', 90.48, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-08', 'Histórico Excel');
  v_n := v_n + 1;
  -- 014-MM-GFMA-2026 · GUSTAVO MONTERO · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '014-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-09-09', '2026-09-12', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-09'::timestamptz, '2026-09-09'::timestamptz, 800.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-09-12'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 4, true, 0, 800.0, 800.0, 800.0, 800.0, '2026-09-09', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H079', '2026-09-12', 'liquidada', 800.0, 1402.9, 602.9000000000001, 'empresa_reembolsa', '2026-09-12'::timestamptz, '2026-09-12'::timestamptz, '2026-09-12'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 602.9 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-09-12', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1402.9, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MFGHRZ', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'IQUITOS', '2026-09-09', '06:45', '2026-09-09', '08:35', 'USD', 84.58, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-09', 'Histórico Excel');
  v_n := v_n + 1;
  -- 003-MM-SMBS-2026 · SHIRLEY BUJAICO · PRESENTACION PROPUESTA
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'sbujaico@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '003-MM-SMBS-2026', v_proy, v_cdc, 'Viaje a TARAPOTO (PRESENTACION PROPUESTA)', 'LIMA', 'TARAPOTO', '2026-09-13', '2026-09-15', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-13'::timestamptz, '2026-09-13'::timestamptz, 1000.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-09-15'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'SHIRLEY BUJAICO', false, 3, true, 0, 1000.0, 1000.0, 1000.0, 1000.0, '2026-09-13', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H080', '2026-09-15', 'liquidada', 1000.0, 1719.4, 719.4000000000001, 'empresa_reembolsa', '2026-09-15'::timestamptz, '2026-09-15'::timestamptz, '2026-09-15'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 719.4 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-09-15', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 1719.4, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UMWPHW', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'TARAPOTO', '2026-09-13', '14:05', '2026-09-13', '15:30', 'USD', 403.42, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-13', 'Histórico Excel');
  v_n := v_n + 1;
  -- 001-MM-GG-2026 · GERENCIA · BUSQUEDA DE NUEVOS PROYECTOS
  v_proy := null;
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '001-MM-GG-2026', v_proy, v_cdc, 'Viaje a AREQUIPA (BUSQUEDA DE NUEVOS PROYECTOS)', 'LIMA', 'AREQUIPA', '2026-09-21', '2026-09-21', true, false, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-21'::timestamptz, '2026-09-21'::timestamptz, 0.0, 'Se cambió fecha de pasaje por lo que retornaran a la cuenta $158,12 * 3 · Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-09-21'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GERENCIA', false, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'DEHYIY', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'AREQUIPA', '2026-09-21', '09:15', '2026-09-21', '10:45', 'USD', 594.27, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-21', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JQFENK', 'aereo', 'LATAM AIRLINES', 'vuelta', 'AREQUIPA', 'LIMA', '2026-09-21', '19:20', '2026-09-21', '20:55', 'USD', 661.58, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 013-MM-LOMM-2026 · LISBET MONTEZA · GORE CUSCO PATRULLEROS
  v_proy := (select id from proyectos where codigo = '06CUSPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'lmonteza@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '013-MM-LOMM-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO PATRULLEROS)', 'LIMA', 'CUSCO', '2026-09-17', '2026-09-18', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-17'::timestamptz, '2026-09-17'::timestamptz, 200.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-09-18'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'LISBET MONTEZA', false, 2, true, 0, 200.0, 200.0, 200.0, 200.0, '2026-09-17', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H081', '2026-09-18', 'liquidada', 200.0, 396.7, 196.7, 'empresa_reembolsa', '2026-09-18'::timestamptz, '2026-09-18'::timestamptz, '2026-09-18'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 196.7 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-09-18', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 396.7, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'LSELJF', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'CUSCO', '2029-09-17', '07:25', '2029-09-17', '08:45', 'USD', 202.58, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2029-09-17', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'MSWWLN', 'aereo', 'LATAM AIRLINES', 'vuelta', 'CUSCO', 'LIMA', '2026-09-18', '18:50', '2026-09-18', '20:25', 'USD', 166.29, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-18', 'Histórico Excel');
  v_n := v_n + 1;
  -- 015-MM-GFMA-2026 · GUSTAVO MONTERO · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '015-MM-GFMA-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-09-21', '2026-09-23', true, true, true, 'rendido', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-21'::timestamptz, '2026-09-21'::timestamptz, 800.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 3, true, 0, 800.0, 800.0, 800.0, 800.0, '2026-09-21', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H082', '2026-09-23', 'aprobada', 800.0, 866.0, 66.0, 'empresa_reembolsa', '2026-09-23'::timestamptz, '2026-09-23'::timestamptz, null, null, 'Resumen del Excel: reembolso empresa 66.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-09-23', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 866.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'EAZUTK', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'IQUITOS', '2026-09-21', '06:45', '2026-09-21', '08:35', 'USD', 108.18, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 010-MM-MACO-2026 · MIGUELANGEL CASTAÑEDA · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'mcastaneda@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '010-MM-MACO-2026', v_proy, v_cdc, 'Viaje a CHACHAPOYAS (AMAZONAS)', 'LIMA', 'CHACHAPOYAS', '2026-09-21', '2026-09-22', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-21'::timestamptz, '2026-09-21'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'MIGUELANGEL CASTAÑEDA', false, 2, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-09-21', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H083', '2026-09-22', 'borrador', 300.0, 0.0, -300.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 300.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'DREMZW', 'aereo', 'LATAM AIRLINES', 'vuelta', 'TAPAPOTO', 'LIMA', '2026-09-22', '08:15', '2026-09-22', '09:35', 'USD', 75.83, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-22', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'OSOBTR', 'aereo', 'ATSA AIRLINES', 'ida', 'LIMA', 'CHACHAPOYAS', '2026-09-21', '08:40', '2026-09-21', '10:10', 'USD', 183.7, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-21', 'Histórico Excel');
  v_n := v_n + 1;
  -- 016-MM-GFAM-2026 · GUSTAVO MONTERO · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '016-MM-GFAM-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-09-30', '2026-10-01', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-30'::timestamptz, '2026-09-30'::timestamptz, 400.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 2, true, 0, 400.0, 400.0, 400.0, 400.0, '2026-09-30', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H084', '2026-10-01', 'borrador', 400.0, 0.0, -400.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 400.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'RICIFV', 'aereo', 'STAR UP', 'multitramo', 'LIMA', 'HUANUCO', '2026-09-30', '11:55', '2026-09-30', '12:45', 'USD', 189.6, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-30', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 006-MM-JARZ-2026 · ANTONIO REYES · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-09-30', '2026-10-01', true, true, true, 'cerrado', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-30'::timestamptz, '2026-09-30'::timestamptz, 400.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', '2026-10-01'::timestamptz)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 2, true, 0, 400.0, 400.0, 400.0, 400.0, '2026-09-30', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H085', '2026-10-01', 'liquidada', 400.0, 976.0, 576.0, 'empresa_reembolsa', '2026-10-01'::timestamptz, '2026-10-01'::timestamptz, '2026-10-01'::timestamptz, 'histórico', 'Resumen del Excel: reembolso empresa 576.0 · devolución trabajador 0.0 · pendiente 0.0') returning id into v_rd;
  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, '2026-10-01', 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', 976.0, 1, true);
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'RICIFV', 'aereo', 'STAR UP', 'multitramo', 'LIMA', 'HUANUCO', '2026-09-30', '11:55', '2026-09-30', '12:45', 'USD', 189.6, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-30', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'ZLYRAU', 'aereo', 'STAR UP', 'vuelta', 'HUANUCO', 'LIMA', '2026-10-02', '13:00', '2026-10-02', '01:45', 'USD', 33.04, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-02', 'Histórico Excel');
  v_n := v_n + 1;
  -- 008-MM-GADV-2026 · GABRIELA DUNN · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-GADV-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-10-01', null, true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-10-01'::timestamptz, '2026-10-01'::timestamptz, 1800.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GABRIELA DUNN', false, 1, true, 0, 1800.0, 1800.0, 1800.0, 1800.0, '2026-10-01', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H086', '2026-10-01', 'borrador', 1800.0, 0.0, -1800.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 1800.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JPNQFU', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'IQUITOS', '2026-10-01', '06:45', '2026-10-01', '08:35', 'USD', 122.34, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-01', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UDIHFJ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'IQUITOS', 'LIMA', '2026-10-14', '09:10', '2026-10-14', '11:00', 'USD', 152.65, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-14', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 012-MM-HJRZ-2026 · HUMBERTO RAMIREZ · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := (select user_id from usuarios_tenant where email = 'jramirez@memphis.pe' and tenant_id = v_t limit 1);
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '012-MM-HJRZ-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-10-01', null, true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-10-01'::timestamptz, '2026-10-01'::timestamptz, 3050.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'HUMBERTO RAMIREZ', false, 1, true, 0, 3050.0, 3050.0, 3050.0, 3050.0, '2026-10-01', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H087', '2026-10-01', 'borrador', 3050.0, 0.0, -3050.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 3050.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JPNQFU', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'IQUITOS', '2026-10-01', '06:45', '2026-10-01', '08:35', 'USD', 122.34, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-01', 'Histórico Excel · costo prorrateado entre 2 viajes que comparten la reserva');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UDIHFJ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'IQUITOS', 'LIMA', '2026-10-14', '09:10', '2026-10-14', '11:00', 'USD', 152.65, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-14', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 006-MM-NRRR-2026 · NICOLAS ROJAS · GORE CUSCO AMBULANCIAS
  v_proy := (select id from proyectos where codigo = '02CUSAMB25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '006-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a CUSCO (GORE CUSCO AMBULANCIAS)', 'LIMA', 'CUSCO', '2026-09-30', '2026-09-30', true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-09-30'::timestamptz, '2026-09-30'::timestamptz, 250.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 1, true, 0, 250.0, 250.0, 250.0, 250.0, '2026-09-30', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H088', '2026-09-30', 'borrador', 250.0, 0.0, -250.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 250.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'JKSJXF', 'aereo', 'LATAM AIRLINES', 'multitramo', 'LIMA', 'CUSCO', '2026-09-30', '07:25', '2026-09-30', '08:45', 'USD', 223.73, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-09-30', 'Histórico Excel');
  v_n := v_n + 1;
  -- 007-MM-NRRR-2026 · NICOLAS ROJAS · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-NRRR-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-10-01', null, true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-10-01'::timestamptz, '2026-10-01'::timestamptz, 2000.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'NICOLAS ROJAS', false, 1, true, 0, 2000.0, 2000.0, 2000.0, 2000.0, '2026-10-01', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H089', '2026-10-01', 'borrador', 2000.0, 0.0, -2000.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 2000.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'HFPDNC', 'aereo', 'LATAM AIRLINES', 'ida', 'LIMA', 'IQUITOS', '2026-10-01', '06:45', '2026-10-01', '08:35', 'USD', 128.24, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-01', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'UDIHFJ', 'aereo', 'LATAM AIRLINES', 'vuelta', 'IQUITOS', 'LIMA', '2026-10-14', '09:10', '2026-10-14', '11:00', 'USD', 152.65, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-14', 'Histórico Excel · costo prorrateado entre 3 viajes que comparten la reserva');
  v_n := v_n + 1;
  -- 017-MM-GFAM-2026 · GUSTAVO MONTERO · GORE LORETO BOMBEROS
  v_proy := (select id from proyectos where codigo = '04LORBOM25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '017-MM-GFAM-2026', v_proy, v_cdc, 'Viaje a IQUITOS (GORE LORETO BOMBEROS)', 'LIMA', 'IQUITOS', '2026-10-02', null, false, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-10-02'::timestamptz, '2026-10-02'::timestamptz, 2500.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'GUSTAVO MONTERO', false, 1, true, 0, 2500.0, 2500.0, 2500.0, 2500.0, '2026-10-02', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H090', '2026-10-02', 'borrador', 2500.0, 0.0, -2500.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 2500.0') returning id into v_rd;
  v_n := v_n + 1;
  -- 008-MM-OTROS-2026 · EXTERNOS · AMAZONAS
  v_proy := (select id from proyectos where codigo = '05AMAPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '008-MM-OTROS-2026', v_proy, v_cdc, 'Viaje a LIMA (AMAZONAS)', 'TAPAPOTO', 'LIMA', '2026-10-15', null, true, false, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-10-15'::timestamptz, '2026-10-15'::timestamptz, 0.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'EXTERNOS', true, 1, true, 0, 0.0, 0.0, 0.0, 0.0, null, null) returning id into v_pa;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'IBMBFL', 'aereo', 'STAR UP', 'vuelta', 'LIMA', 'CHACHAPOYAS', '2026-10-17', '08:40', '2026-10-17', '10:10', 'USD', 215.56, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-17', 'Histórico Excel');
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'SMODWY', 'aereo', 'LATAM AIRLINES', 'ida', 'TAPAPOTO', 'LIMA', '2026-10-15', '08:15', '2026-10-15', '09:35', 'USD', 99.43, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-15', 'Histórico Excel');
  v_n := v_n + 1;
  -- 007-MM-JARZ-2026 · ANTONIO REYES · GORE HUANUCO
  v_proy := (select id from proyectos where codigo = '03HNCPNP25' and tenant_id = v_t);
  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;
  v_user := null;
  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)
  values (v_t, '007-MM-JARZ-2026', v_proy, v_cdc, 'Viaje a HUANUCO (GORE HUANUCO)', 'LIMA', 'HUANUCO', '2026-10-15', null, true, true, true, 'en_curso', coalesce(v_user, (select user_id from usuarios_tenant where email = 'cokamura@memphis.pe' and tenant_id = v_t)), '2026-10-15'::timestamptz, '2026-10-15'::timestamptz, 300.0, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF', 'excel-control-viajes', null)
  returning id into v_id;
  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)
  values (v_t, v_id, v_user, 'ANTONIO REYES', false, 1, true, 0, 300.0, 300.0, 300.0, 300.0, '2026-10-15', 'histórico') returning id into v_pa;
  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)
  values (v_t, v_id, v_pa, 'RD-2026-H091', '2026-10-15', 'borrador', 300.0, 0.0, -300.0, 'cuadra', null, null, null, null, 'Resumen del Excel: reembolso empresa 0.0 · devolución trabajador 0.0 · pendiente 300.0') returning id into v_rd;
  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)
  values (v_t, v_id, v_pa, 'WUGUPJ', 'aereo', 'STAR UP', 'ida', 'LIMA', 'HUANUCO', '2026-10-15', '11:55', '2026-10-15', '12:45', 'USD', 109.36, 3.4, 'transferencia', 'Caja chica dólares', 'pagado', '2026-10-15', 'Histórico Excel');
  v_n := v_n + 1;
  raise notice 'viajes cargados: %', v_n;
end $$;
select count(*) viajes, count(*) filter (where estado='cerrado') cerrados, sum(presupuesto_viaticos) adelantos, (select count(*) from viaje_reservas r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') reservas,
       (select sum(costo_soles) from viaje_reservas r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') pasajes_soles,
       (select count(*) from viaje_rendiciones r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') rendiciones,
       (select sum(gastado) from viaje_rendiciones r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') rendido
  from viajes where origen_datos = 'excel-control-viajes';
