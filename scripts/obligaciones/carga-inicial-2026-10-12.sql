-- Carga inicial de obligaciones financieras (2026-10-12).
-- Fuentes: "Libro obligaciones memphis.xlsx" (Administración, modificado 2026-07-20), "CONTROL DE LA DEUDA 2023-2026" (Contabilidad,
-- hojas FRACCIONAMIENTO 1, REFINANCIAMIENTO I y II, FRACCIONAMIENTO PERDIDO, 2026) y las líneas PRÉSTAMOS de "Flujo Administración.xlsx".
-- Los estados "pagada" salen de los pagos históricos cargados en el ERP (HIST-2026-NNNN) o de las hojas de SUNAT; lo que no tiene
-- pago registrado queda pendiente aunque esté vencido, con la observación "confirmar con Contabilidad".
-- Se ejecuta con la sesión de un usuario con finanzas.editar (set_config del JWT) porque las funciones validan permisos.
do $$
declare v uuid; v_aura uuid := '06bbdeaf-bd8a-518d-b12a-2ba754d5331e'; v_etramed uuid := '41ed4547-a6de-5bc4-a299-972f3c168c0e';
        v_libro text := 'Libro obligaciones memphis.xlsx (Administración, 20/07/2026)'; v_deuda text := 'CONTROL DE LA DEUDA 2023-2026 MEMPHIS MAQUINARIAS.xlsx (Contabilidad)';
        v_flujo text := 'Flujo Administración.xlsx · PRÉSTAMOS (setiembre 2026)'; v_cuotas jsonb;
begin
  -- ── Préstamos de socios y terceros (Libro obligaciones) ──
  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Sandra Wiese','concepto','Pagos varios (préstamo 400K)','moneda','USD','capital',400000,
       'interes_tipo','compensatorio+moratorio','fecha_contrato','2025-06-17','fecha_vencimiento','2025-12-14','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Intereses moratorios al máximo legal y compensatorios pendientes (monto no indicado en el Libro). El Libro pide "solicitar ampliación de plazo". Sin pago de capital registrado en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-12-14","capital":400000,"interes":0}]');

  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Sandra Wiese','concepto','Pagos varios (préstamo 200K)','moneda','USD','capital',200000,'interes_total',25232.48,
       'interes_tipo','compensatorio+moratorio','fecha_contrato','2025-07-01','fecha_vencimiento','2025-12-28','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Intereses compensatorios pagados el 27/02/2026 (HIST-2026-0426). Capital sin pago registrado en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-12-28","capital":200000,"interes":0},{"numero":2,"vencimiento":"2026-02-27","capital":0,"interes":25232.48,"estado":"pagada","fecha_pago":"2026-02-27","notas":"HIST-2026-0426 intereses compensatorios"}]');

  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Corporación OXI','concepto','Pago de planilla','moneda','PEN','capital',70000,
       'interes_tipo','compensatorio+moratorio','fecha_contrato','2025-09-26','fecha_vencimiento','2025-12-25','documento','Mutuo dinerario 26/09/2025 + pagaré','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','El Libro pide "solicitar ampliación de plazo". Sin devolución registrada en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-12-25","capital":70000,"interes":0}]');

  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Etramed Import SAC','proveedor_id',v_etramed,'concepto','Préstamo US$ 205,000 (devuelto)','moneda','USD','capital',205000,
       'fecha_contrato','2025-12-01','fecha_vencimiento','2026-01-31','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Devuelto en cuatro pagos el 25/02/2026 (HIST-2026-0331 a 0334). El flujo de octubre aún lleva intereses moratorios pendientes sobre este préstamo (S/ 63,063.70): registrarlos como cuota de interés cuando Contabilidad confirme el monto.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-01-31","capital":50000,"interes":0,"estado":"pagada","fecha_pago":"2026-02-25","notas":"HIST-2026-0334"},{"numero":2,"vencimiento":"2026-01-31","capital":50000,"interes":0,"estado":"pagada","fecha_pago":"2026-02-25","notas":"HIST-2026-0333"},{"numero":3,"vencimiento":"2026-01-31","capital":50000,"interes":0,"estado":"pagada","fecha_pago":"2026-02-25","notas":"HIST-2026-0332"},{"numero":4,"vencimiento":"2026-01-31","capital":55000,"interes":0,"estado":"pagada","fecha_pago":"2026-02-25","notas":"HIST-2026-0331"}]');

  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Etramed Import SAC','proveedor_id',v_etramed,'concepto','Préstamo S/ 1,000,000 (Corporación Aura E.I.R.L.)','moneda','PEN','capital',1000000,'interes_total',50000,
       'interes_tipo','compensatorio+moratorio','penalidad','15 % del préstamo por incumplimiento','fecha_contrato','2025-12-01','fecha_vencimiento','2026-01-31','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Capital e intereses compensatorios (S/ 50,000) pendientes según el Libro. Sin pago registrado en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-01-31","capital":1000000,"interes":50000}]');

  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Miguel Zegarra','concepto','Pagos varios (camioneta US$ 100,000 incluida)','moneda','PEN','capital',691567.72,'interes_total',1946.76,
       'fecha_vencimiento','2026-12-31','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','El Libro no indica fecha de contrato ni vencimiento: el saldo se fija al 31/12/2026 para que entre al flujo; corregir cuando se tenga el contrato. Devoluciones registradas: 62,000 (03/02/2026), 350,000 (12/06/2026), 20,900 + 1,254 de interés (12/06/2026), 692.76 de interés (10/02/2026).'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-02-03","capital":62000,"interes":0,"estado":"pagada","fecha_pago":"2026-02-03","notas":"HIST-2026-0059"},{"numero":2,"vencimiento":"2026-02-10","capital":0,"interes":692.76,"estado":"pagada","fecha_pago":"2026-02-10","notas":"HIST-2026-0098"},{"numero":3,"vencimiento":"2026-06-12","capital":350000,"interes":0,"estado":"pagada","fecha_pago":"2026-06-12","notas":"HIST-2026-0813"},{"numero":4,"vencimiento":"2026-06-12","capital":20900,"interes":1254,"estado":"pagada","fecha_pago":"2026-06-12","notas":"HIST-2026-0837"},{"numero":5,"vencimiento":"2026-12-31","capital":258667.72,"interes":0,"notas":"Saldo; vencimiento por confirmar"}]');

  -- ── Cheques diferidos y letra (Libro obligaciones) ──
  v := obligacion_guardar(jsonb_build_object('tipo','cheque_diferido','acreedor','Secrex','concepto','Encaje fianza Loreto Bomberos','moneda','PEN','capital',351207.54,'fecha_vencimiento','2025-12-10','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Cheque diferido; el Libro pide acreditar el pago el miércoles temprano. Sin cobro registrado en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-12-10","capital":351207.54,"interes":0}]');

  v := obligacion_guardar(jsonb_build_object('tipo','cheque_diferido','acreedor','HFM Smart Solutions GMBH Sucursal del Perú','concepto','Radios Gore Cusco','moneda','USD','capital',55014.68,'documento','Cheque con fecha 28/11/2025 (2.ª ampliación)','fecha_vencimiento','2025-12-31','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','El Libro lo lista dos veces (12/12 y 31/12/2025, "solicitar devolución"): es el mismo cheque re-fechado. Sin cobro ni devolución registrados en el ERP.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-12-31","capital":55014.68,"interes":0}]');

  v := obligacion_guardar(jsonb_build_object('tipo','cheque_diferido','acreedor','Corporación Aura','proveedor_id',v_aura,'concepto','Ambulancias Cusco','moneda','USD','capital',50000,'fecha_vencimiento','2026-01-02','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Devuelto el 27/02/2026 (HIST-2026-0424 "devolución cheque").'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-01-02","capital":50000,"interes":0,"estado":"pagada","fecha_pago":"2026-02-27","notas":"HIST-2026-0424"}]');

  v := obligacion_guardar(jsonb_build_object('tipo','cheque_diferido','acreedor','Cesce','concepto','Encaje Cusco Hidroambulancia','moneda','PEN','capital',19555.76,'fecha_vencimiento','2026-01-29','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Sin cobro registrado en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-01-29","capital":19555.76,"interes":0}]');

  v := obligacion_guardar(jsonb_build_object('tipo','letra','acreedor','Corporación Aura','proveedor_id',v_aura,'concepto','Ambulancias Cusco','moneda','USD','capital',400199.16,'fecha_vencimiento','2026-02-09','cdc','PRÉSTAMOS','origen_archivo',v_libro,
       'observaciones','Letra de cambio. Sin pago registrado en el ERP: confirmar con Contabilidad.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-02-09","capital":400199.16,"interes":0}]');

  -- ── Préstamos cortos ya pagados (Flujo Administración, setiembre 2026) ──
  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Imagen Pública Consultores Asociados SAC','concepto','Pagos varios (capital 40,000, 6 % mensual)','moneda','PEN','capital',40000,'interes_total',1974.33,'tasa_interes',6,'interes_tipo','compensatorio','fecha_vencimiento','2026-08-25','cdc','PRÉSTAMOS','origen_archivo',v_flujo));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-08-25","capital":40000,"interes":1974.33,"estado":"pagada","fecha_pago":"2026-08-25","notas":"Pagado según Flujo Administración (set-2026)"}]');
  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Impacto Táctico','concepto','Pago ITAN de junio 2026 (capital 22,300, 6 % mensual)','moneda','PEN','capital',22300,'interes_total',1889.96,'tasa_interes',6,'interes_tipo','compensatorio','fecha_vencimiento','2026-09-18','cdc','PRÉSTAMOS','origen_archivo',v_flujo));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-09-18","capital":22300,"interes":1889.96,"estado":"pagada","fecha_pago":"2026-09-18","notas":"Pagado según Flujo Administración (set-2026)"}]');
  v := obligacion_guardar(jsonb_build_object('tipo','prestamo','acreedor','Susan Hoefken','concepto','Pagos varios (capital 30,000, 6 % mensual)','moneda','PEN','capital',30000,'interes_total',2867,'tasa_interes',6,'interes_tipo','compensatorio','fecha_vencimiento','2026-09-18','cdc','PRÉSTAMOS','origen_archivo',v_flujo));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2026-09-18","capital":30000,"interes":2867,"estado":"pagada","fecha_pago":"2026-09-18","notas":"Pagado según Flujo Administración (set-2026)"}]');

  -- ── SUNAT (CONTROL DE LA DEUDA) ──
  -- Fraccionamiento perdido: IGV marzo 2024 (aprobado 05/08/2024), cuotas 10-12 no pagadas → pasó al Refinanciamiento I
  v := obligacion_guardar(jsonb_build_object('tipo','fraccionamiento','acreedor','SUNAT','concepto','Fraccionamiento IGV marzo 2024 (perdido)','documento','Resolución 023017… aprobado 05/08/2024','moneda','PEN','capital',172900,'interes_total',15430,'fecha_contrato','2024-08-05','fecha_vencimiento','2025-10-31','cdc','FRACCIONAMIENTO SUNAT','origen_archivo',v_deuda,
       'observaciones','Cuotas 1-9 pagadas; 10-12 no pagadas: el fraccionamiento se perdió y la deuda pasó al Refinanciamiento I (IGV marzo 2024).'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2024-10-31","capital":11291,"interes":0,"estado":"pagada","fecha_pago":"2024-10-09","notas":"Cuota de acogimiento"},{"numero":2,"vencimiento":"2024-10-31","capital":0,"interes":3933,"estado":"pagada","fecha_pago":"2024-10-09","notas":"Interés de acogimiento"},{"numero":3,"vencimiento":"2024-11-29","capital":14180,"interes":1275,"estado":"pagada","fecha_pago":"2024-12-27"},{"numero":4,"vencimiento":"2024-12-31","capital":14282,"interes":1173,"estado":"pagada","fecha_pago":"2024-12-27"},{"numero":5,"vencimiento":"2025-01-31","capital":14358,"interes":1070,"estado":"pagada","fecha_pago":"2025-01-06"},{"numero":6,"vencimiento":"2025-02-28","capital":14489,"interes":966,"estado":"pagada","fecha_pago":"2025-02-20"},{"numero":7,"vencimiento":"2025-03-31","capital":14593,"interes":862,"estado":"pagada","fecha_pago":"2025-03-23"},{"numero":8,"vencimiento":"2025-04-30","capital":14698,"interes":757,"estado":"pagada","fecha_pago":"2025-05-02"},{"numero":9,"vencimiento":"2025-05-30","capital":14804,"interes":651,"estado":"pagada","fecha_pago":"2025-05-26"},{"numero":10,"vencimiento":"2025-06-30","capital":14910,"interes":545,"estado":"pagada","fecha_pago":"2025-07-31"},{"numero":11,"vencimiento":"2025-07-31","capital":15018,"interes":437,"estado":"pagada","fecha_pago":"2025-07-31"},{"numero":12,"vencimiento":"2025-08-29","capital":15126,"interes":329,"estado":"anulada","notas":"No pagada: fraccionamiento perdido"},{"numero":13,"vencimiento":"2025-09-30","capital":15235,"interes":220,"estado":"anulada","notas":"No pagada: fraccionamiento perdido"},{"numero":14,"vencimiento":"2025-10-31","capital":15346,"interes":110,"estado":"anulada","notas":"No pagada: fraccionamiento perdido"}]');
  perform obligacion_estado(v, 'renegociada', 'Saldo refinanciado (Refinanciamiento I, IGV marzo 2024)');

  -- Refinanciamiento I: IGV marzo 2024, 12 cuotas oct-2025 a set-2026 (cuota 12 pagada según BD CONTA set-2026)
  v := obligacion_guardar(jsonb_build_object('tipo','fraccionamiento','acreedor','SUNAT','concepto','Refinanciamiento I · IGV marzo 2024','documento','Resolución 023017… · cuota de acogimiento 4,985','moneda','PEN','capital',57409,'interes_total',2804,'fecha_contrato','2025-10-01','fecha_vencimiento','2026-09-30','cdc','REFINANCIAMIENTO - IGV MARZO 2024','origen_archivo',v_deuda,
       'observaciones','12 cuotas; las fechas de pago de las cuotas 10-12 no están en la hoja (BD CONTA las marca pagadas).'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-10-31","capital":4598,"interes":496,"estado":"pagada","fecha_pago":"2025-10-20"},{"numero":2,"vencimiento":"2025-11-28","capital":4631,"interes":380,"estado":"pagada","fecha_pago":"2025-10-20"},{"numero":3,"vencimiento":"2025-12-31","capital":4664,"interes":347,"estado":"pagada","fecha_pago":"2026-01-30"},{"numero":4,"vencimiento":"2026-01-30","capital":4698,"interes":313,"estado":"pagada","fecha_pago":"2026-02-23"},{"numero":5,"vencimiento":"2026-02-27","capital":4732,"interes":279,"estado":"pagada","fecha_pago":"2026-02-26"},{"numero":6,"vencimiento":"2026-03-31","capital":4766,"interes":245,"estado":"pagada","fecha_pago":"2026-02-26"},{"numero":7,"vencimiento":"2026-04-30","capital":4800,"interes":211,"estado":"pagada","fecha_pago":"2026-05-19"},{"numero":8,"vencimiento":"2026-05-29","capital":4834,"interes":177,"estado":"pagada","fecha_pago":"2026-06-12","notas":"HIST-2026-0823"},{"numero":9,"vencimiento":"2026-06-30","capital":4869,"interes":142,"estado":"pagada","fecha_pago":"2026-06-25","notas":"HIST-2026-0910"},{"numero":10,"vencimiento":"2026-07-31","capital":4904,"interes":107,"estado":"pagada","fecha_pago":"2026-07-31","notas":"Fecha de pago aproximada"},{"numero":11,"vencimiento":"2026-08-31","capital":4940,"interes":71,"estado":"pagada","fecha_pago":"2026-08-31","notas":"Fecha de pago aproximada"},{"numero":12,"vencimiento":"2026-09-30","capital":4973,"interes":36,"estado":"pagada","fecha_pago":"2026-09-30","notas":"Fecha de pago aproximada"}]');

  -- Fraccionamiento 1: Renta anual 2024 (454,845), cuotas 1-3 pagadas, 4-12 pasaron al Refinanciamiento II
  v := obligacion_guardar(jsonb_build_object('tipo','fraccionamiento','acreedor','SUNAT','concepto','Fraccionamiento Renta anual 2024','documento','Resolución 023017…','moneda','PEN','capital',454845,'interes_total',35995,'fecha_contrato','2025-07-31','fecha_vencimiento','2026-10-31','cdc','FRACCIONAMIENTO SUNAT','origen_archivo',v_deuda,
       'observaciones','Cuota de acogimiento e interés pagados el 31/07/2025; cuotas 1-3 pagadas; desde la cuota 4 el saldo pasó al Refinanciamiento II.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2025-10-31","capital":27258,"interes":0,"estado":"pagada","fecha_pago":"2025-07-31","notas":"Cuota de acogimiento"},{"numero":2,"vencimiento":"2025-10-31","capital":0,"interes":15719,"estado":"pagada","fecha_pago":"2025-07-31","notas":"Interés de acogimiento"},{"numero":3,"vencimiento":"2025-11-28","capital":34243,"interes":3079,"estado":"pagada","fecha_pago":"2025-12-12"},{"numero":4,"vencimiento":"2025-12-31","capital":34490,"interes":2832,"estado":"pagada","fecha_pago":"2026-01-30","notas":"HIST-2026-0031"},{"numero":5,"vencimiento":"2026-01-30","capital":34738,"interes":2584,"estado":"pagada","fecha_pago":"2026-02-23","notas":"Pagado con CIPRL"}]');
  perform obligacion_estado(v, 'renegociada', 'Cuotas 4-12 (S/ 289,128 de capital) pasaron al Refinanciamiento II (Renta anual 2024)');

  -- Refinanciamiento II: Renta anual 2024, acogimiento 45,737 (02/03/2026) + 60 cuotas desde 30/04/2026 (1.ª 7,723, resto 5,822); 1-6 pagadas (BD CONTA set-2026)
  select jsonb_agg(jsonb_build_object('numero', g + 1, 'vencimiento', (date '2026-04-30' + (g || ' month')::interval)::date, 'capital', case when g = 0 then 7723 else 5822 end, 'interes', 0,
           'estado', case when g < 6 then 'pagada' else 'pendiente' end,
           'fecha_pago', case when g = 0 then '2026-05-04' when g < 6 then to_char((date '2026-04-30' + (g || ' month')::interval)::date, 'YYYY-MM-DD') end,
           'notas', case when g = 0 then 'Pagada 04/05/2026 con interés moratorio 9.27' when g < 6 then 'Fecha de pago aproximada (BD CONTA la marca pagada)' end))
    into v_cuotas from generate_series(0, 59) g;
  v := obligacion_guardar(jsonb_build_object('tipo','fraccionamiento','acreedor','SUNAT','concepto','Refinanciamiento II · Renta anual 2024','documento','Resolución 021017…','moneda','PEN','capital',396958,'fecha_contrato','2026-03-02','fecha_vencimiento','2031-03-31','cdc','REFINANCIAMIENTO - RENTA 2024','origen_archivo',v_deuda,
       'observaciones','Cuota de acogimiento S/ 45,737 pagada el 02/03/2026 (cuenta BBVA) + 60 cuotas mensuales. El Excel no desglosa capital e interés por cuota.'));
  perform obligacion_cuotas_fijar(v, v_cuotas || '[{"numero":0,"vencimiento":"2026-03-02","capital":45737,"interes":0,"estado":"pagada","fecha_pago":"2026-03-02","notas":"Cuota de acogimiento (cuenta BBVA)"}]'::jsonb);

  -- ITAN 2026: 9 cuotas de 25,726 (abril a diciembre); 1-6 pagadas, 7-9 pendientes (BD CONTA oct-dic 2026)
  select jsonb_agg(jsonb_build_object('numero', g, 'vencimiento', (date '2026-03-19' + (g || ' month')::interval)::date, 'capital', 25726, 'interes', 0,
           'estado', case when g <= 6 then 'pagada' else 'pendiente' end,
           'fecha_pago', case when g <= 6 then to_char((date '2026-03-19' + (g || ' month')::interval)::date, 'YYYY-MM-DD') end,
           'notas', 'Vencimiento aproximado (día 19); BD CONTA ' || case when g <= 6 then 'la marca pagada' else 'la lleva pendiente' end))
    into v_cuotas from generate_series(1, 9) g;
  v := obligacion_guardar(jsonb_build_object('tipo','deuda_tributaria','acreedor','SUNAT','concepto','ITAN 2026 en 9 cuotas','moneda','PEN','capital',231534,'fecha_contrato','2026-04-01','fecha_vencimiento','2026-12-19','cdc','ITAN','origen_archivo',v_deuda));
  perform obligacion_cuotas_fijar(v, v_cuotas);

  -- Deuda 2023 en cobranza coactiva (IGV/renta/multas agosto 2023, saldo con intereses al 29/09/2026)
  v := obligacion_guardar(jsonb_build_object('tipo','deuda_tributaria','acreedor','SUNAT','concepto','IGV, renta y multas de agosto 2023 en cobranza coactiva','moneda','PEN','capital',6725.59,'fecha_vencimiento','2023-09-20','cdc','SUNAT','origen_archivo',v_deuda,
       'observaciones','Saldo con intereses calculado al 29/09/2026 en la hoja 2026: IGV 6,291 + multa 314.20 + renta 64 + multa 56.39. El IGV abril 2023 (31,573) figura "en cobranza coactiva / compensación": no se carga hasta que Contabilidad confirme el saldo.'));
  perform obligacion_cuotas_fijar(v, '[{"numero":1,"vencimiento":"2023-09-20","capital":6725.59,"interes":0}]');
end $$;
