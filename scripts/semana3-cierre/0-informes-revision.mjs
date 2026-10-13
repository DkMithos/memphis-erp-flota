// Semana 3 del plan de carga (2026-10-13) · Paso 0: los dos Excel de revisión que salen de las cargas de las semanas 1 y 2.
//   Revision-Finanzas-Contabilidad-<fecha>.xlsx  → banco sin conciliar, transacciones sin banco, SUNAT sin CDC, abonos sin cliente,
//                                                  facturas con error contable, obligaciones vencidas, facturas pagadas sin CDC
//   Revision-Operaciones-Compras-<fecha>.xlsx     → ventas sin proyecto (financistas OXI), proyectos nuevos a confirmar, proveedores sin cuenta
// Uso: PGUSER=<rol_tmp> PGPASS=<clave> node 0-informes-revision.mjs <carpeta_salida>
import pg from 'pg';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const XLSX = createRequire('C:/Users/URSULA/Proyectos/memphis-erp-flota/package.json')('xlsx');
const [out] = process.argv.slice(2);
const T = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const hoy = new Date().toISOString().slice(0, 10);
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

const banco = await q(`select cuenta_nombre as "Cuenta", fecha_operacion as "Fecha", numero_doc as "N° operación", concepto as "Concepto", importe as "Importe", cuenta_moneda as "Moneda", clasificacion as "Clasificación ERP",
  case when clasificacion = 'pago_proveedor' then 'Vincular con la factura o el pago en Finanzas › Bancos (los pagos del Excel con OPE errado están aquí)'
       when clasificacion = 'prestamo' then 'Vincular con la cuota en Obligaciones financieras'
       when clasificacion = 'caja_chica' then 'Transferencia a caja chica: registrar como tal'
       when clasificacion = 'planilla' then 'Registrar como planilla / AFP'
       else 'Clasificar y registrar o vincular en Bancos' end as "Qué hacer"
  from v_movimientos_bancarios where tenant_id = $1 and transaccion_id is null order by cuenta_nombre, fecha_operacion`, [T]);
const sinBanco = await q(`select cb.nombre as "Cuenta", t.numero as "Transacción", t.fecha as "Fecha", t.tipo as "Tipo", t.monto as "Monto", t.moneda as "Moneda", t.categoria as "Categoría", t.proveedor_nombre as "Proveedor", left(t.descripcion, 90) as "Descripción",
  case when t.numero in ('HIST-2026-0036','HIST-2026-0047','HIST-2026-0048','HIST-2026-0050','HIST-2026-0051','HIST-2026-0055','HIST-2026-0057') then 'Signo invertido: el banco muestra un CARGO en dólares (venta de dólares); ya está registrado desde el banco → anular esta fila'
       when t.referencia_tipo = 'historico_contabilidad' then 'Viene del Excel de pagos y no cruza con ningún movimiento del banco: confirmar si se pagó, si está duplicado o si el importe/fecha difieren'
       else 'Sin movimiento de banco: confirmar' end as "Qué hacer"
  from transacciones t join cuentas_bancarias cb on cb.id = t.cuenta_bancaria_id
  where t.tenant_id = $1 and t.estado = 'pagada' and t.movimiento_bancario_id is null and coalesce(t.fecha_pago, t.fecha) >= '2026-01-01' and cb.activa order by cb.nombre, t.fecha`, [T]);
const sunat = await q(`select t.numero as "Transacción", t.fecha as "Fecha", t.monto as "Monto", t.moneda as "Moneda", t.descripcion as "Concepto del banco", '' as "Tributo / CDC (completar)"
  from transacciones t where t.tenant_id = $1 and t.referencia_tipo = 'banco' and t.categoria = 'Impuestos SUNAT' and t.centro_costo_id is null order by t.fecha`, [T]);
const abonos = await q(`select cb.nombre as "Cuenta", t.numero as "Transacción", t.fecha as "Fecha", t.monto as "Monto", t.moneda as "Moneda", t.descripcion as "Concepto del banco", coalesce(p.codigo, '') as "Proyecto (ERP)", '' as "Cliente / proyecto (completar)"
  from transacciones t join cuentas_bancarias cb on cb.id = t.cuenta_bancaria_id left join proyectos p on p.id = t.proyecto_id
  where t.tenant_id = $1 and t.referencia_tipo = 'banco' and t.tipo = 'ingreso' and t.categoria in ('Cobro', 'Devolución / reembolso') order by t.monto desc`, [T]);
const errores = await q(`select numero_completo as "Factura", razon_social_emisor as "Proveedor", fecha_emision as "Emisión", total as "Total", moneda as "Moneda", estado_flujo as "Estado", contabilizacion_error as "Error al contabilizar"
  from comprobantes_pago where tenant_id = $1 and direccion = 'recibido' and contabilizacion_error is not null order by fecha_emision`, [T]);
const oblig = await q(`select numero as "Obligación", tipo as "Tipo", acreedor as "Acreedor", moneda as "Moneda", total as "Total", pagado as "Pagado", saldo as "Saldo", fecha_vencimiento as "Vencimiento", cuotas as "Cuotas", cuotas_pagadas as "Cuotas pagadas", '' as "¿Pagada / renegociada / vigente? (completar)"
  from v_obligaciones where tenant_id = $1 and estado = 'vencida' order by fecha_vencimiento`, [T]);
const sinCdc = await q(`select c.numero_completo as "Factura", c.razon_social_emisor as "Proveedor", c.fecha_emision as "Emisión", c.total as "Total", c.moneda as "Moneda", string_agg(t.numero, ', ') as "Pago(s) enlazado(s)", '' as "CDC / proyecto (completar)"
  from comprobantes_pago c join transacciones t on t.comprobante_id = c.id
  where c.tenant_id = $1 and c.direccion = 'recibido' and c.estado_flujo = 'pagada' and c.centro_costo_id is null group by c.id order by c.fecha_emision`, [T]);
const ncSin = await q(`select numero_completo as "Nota de crédito", fecha_emision as "Emisión", razon_social_receptor as "Cliente", total as "Total", moneda as "Moneda", observaciones as "Referencia"
  from comprobantes_pago where tenant_id = $1 and direccion = 'emitido' and tipo = '07' and observaciones ~ 'sobre 01 E001-(410|392)\\M' order by fecha_emision`, [T]);

const ventasCli = await q(`select c.ruc_receptor as "RUC", max(c.razon_social_receptor) as "Cliente", count(*) as "Comprobantes", round(sum(case when c.tipo = '07' then -1 else 1 end * c.total * case when c.moneda = 'USD' then coalesce(nullif(c.tipo_cambio, 1), tc_vigente(c.fecha_emision)) else 1 end)) as "Neto S/", min(c.fecha_emision) as "Desde", max(c.fecha_emision) as "Hasta", '' as "Proyecto que financia / al que pertenece (completar)"
  from comprobantes_pago c where c.tenant_id = $1 and c.direccion = 'emitido' and c.proyecto_id is null group by c.ruc_receptor order by 4 desc`, [T]);
const ventasDet = await q(`select c.numero_completo as "Comprobante", case c.tipo when '07' then 'Nota de crédito' else 'Factura' end as "Tipo", c.fecha_emision as "Emisión", c.razon_social_receptor as "Cliente", c.total as "Total", c.moneda as "Moneda", c.estado_flujo as "Estado", '' as "Proyecto (completar)"
  from comprobantes_pago c where c.tenant_id = $1 and c.direccion = 'emitido' and c.proyecto_id is null order by c.razon_social_receptor, c.fecha_emision`, [T]);
const proyNuevos = await q(`select codigo as "Código", nombre as "Nombre", estado as "Estado", fase as "Fase", situacion as "Situación", entidad_cliente as "Entidad", monto_contrato as "Monto contrato", descripcion as "Nota de la carga", '' as "¿Correcto? (completar)"
  from proyectos where tenant_id = $1 and creado_por = 'semana1-conexiones' order by estado, codigo`, [T]);
const provSin = await q(`select p.codigo as "Código", p.ruc as "RUC", p.razon_social as "Razón social", p.tipo as "Tipo", (select count(*) from comprobantes_pago c where c.proveedor_id = p.id) as "Facturas", (select max(fecha_emision) from comprobantes_pago c where c.proveedor_id = p.id) as "Última factura", '' as "Banco / cuenta / CCI (completar)", '' as "Condición (buen contribuyente, agente de retención, detracción)"
  from proveedores p where p.tenant_id = $1 and p.migrado_de = 'sire' and coalesce(p.cuenta_bancaria, '') = '' and coalesce(p.cci, '') = '' order by 5 desc`, [T]);
await c.end();

const hoja = (wb, nombre, filas, anchos) => {
  const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ '(sin filas)': '' }]);
  ws['!cols'] = (anchos ?? Object.keys(filas[0] ?? {}).map(() => 18)).map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31));
};
const leeme = (wb, filas) => { const ws = XLSX.utils.aoa_to_sheet(filas); ws['!cols'] = [{ wch: 34 }, { wch: 120 }]; XLSX.utils.book_append_sheet(wb, ws, 'Léeme'); };
mkdirSync(out, { recursive: true });

const w1 = XLSX.utils.book_new();
leeme(w1, [
  [`Revisión para Finanzas y Contabilidad · ${hoy}`, 'Qué salió de las cargas al ERP (semanas 1 y 2 del plan de carga) y necesita una decisión humana. Cada hoja dice qué hacer y dónde.'],
  ['Banco sin conciliar', `${banco.length} movimientos del extracto BBVA 2026 sin transacción. Finanzas › Bancos: "Vincular" con la factura/pago o "Registrar". Incluye los 102 pagos del Excel con número de operación errado.`],
  ['Trx 2026 sin banco', `${sinBanco.length} transacciones pagadas de 2026 que no cruzan con ningún movimiento del banco: duplicados, errores de signo o importes distintos. Confirmar y anular/corregir en Finanzas › Transacciones.`],
  ['SUNAT sin CDC', `${sunat.length} pagos a SUNAT registrados desde el banco sin tributo: indicar IGV / Renta / fraccionamiento, etc.`],
  ['Abonos sin cliente', `${abonos.length} abonos registrados como cobro sin cliente identificado: indicar cliente y proyecto (los grandes son pagos de las financistas OXI).`],
  ['Facturas con error contable', `${errores.length} facturas 2026 del SIRE que no cuadran base/IGV/total y no generaron asiento.`],
  ['Obligaciones vencidas', `${oblig.length} obligaciones financieras con cuotas vencidas según el Libro de obligaciones: confirmar si se pagaron, se renegociaron o siguen vigentes.`],
  ['Facturas pagadas sin CDC', `${sinCdc.length} facturas del SIRE pagadas cuyo pago no tenía centro de costo en el Excel.`],
  ['NC a facturas 2024', `${ncSin.length} notas de crédito que modifican facturas de 2024 que no están en el ERP (no hay SIRE de ventas 2024). Solo informativo.`],
  ['Nota', 'Las 1,330 transacciones creadas el 13/10/2026 desde el banco llevan "registro masivo 13/10/2026" en la descripción y se pueden revertir con "Desvincular" en Bancos.'],
]);
hoja(w1, 'Banco sin conciliar', banco, [22, 11, 12, 40, 14, 8, 16, 70]);
hoja(w1, 'Trx 2026 sin banco', sinBanco, [22, 16, 11, 9, 14, 8, 18, 30, 60, 80]);
hoja(w1, 'SUNAT sin CDC', sunat, [16, 11, 12, 8, 60, 30]);
hoja(w1, 'Abonos sin cliente', abonos, [22, 16, 11, 14, 8, 60, 12, 36]);
hoja(w1, 'Facturas con error contable', errores, [14, 40, 11, 12, 8, 12, 80]);
hoja(w1, 'Obligaciones vencidas', oblig, [14, 16, 36, 8, 14, 14, 14, 12, 8, 12, 40]);
hoja(w1, 'Facturas pagadas sin CDC', sinCdc, [14, 40, 11, 12, 8, 30, 30]);
hoja(w1, 'NC a facturas 2024', ncSin, [16, 11, 36, 12, 8, 70]);
XLSX.writeFile(w1, `${out}/Revision-Finanzas-Contabilidad-${hoy}.xlsx`);

const w2 = XLSX.utils.book_new();
leeme(w2, [
  [`Revisión para Operaciones y Compras · ${hoy}`, 'Decisiones que el ERP no puede tomar solo tras cargar proyectos, valorizaciones, SIRE de ventas y proveedores.'],
  ['Ventas sin proyecto (por cliente)', `${ventasCli.length} clientes cuyas facturas no tienen proyecto. Indicar qué proyecto financia cada financista OXI (Amazonas Corporation, E.I.G.R., Fondo Investa, Alihcom, Light & Vision…) o a qué proyecto pertenece. Con eso se enlazan todas sus facturas de una vez.`],
  ['Ventas sin proyecto (detalle)', `${ventasDet.length} comprobantes emitidos sin proyecto, por si alguna factura va a un proyecto distinto al del cliente.`],
  ['Proyectos nuevos a confirmar', `${proyNuevos.length} proyectos creados desde los centros de costo (12/10/2026). Confirmar nombre, estado y fase; MSS-30 y MDI tienen el nombre inferido.`],
  ['Proveedores sin cuenta', `${provSin.length} proveedores creados desde el SIRE sin cuenta bancaria ni condición tributaria: Compras los completa antes de pagarles por lote (Proveedores › Directorio).`],
]);
hoja(w2, 'Ventas sin proyecto (cliente)', ventasCli, [13, 40, 13, 14, 11, 11, 50]);
hoja(w2, 'Ventas sin proyecto (detalle)', ventasDet, [14, 15, 11, 40, 14, 8, 11, 24]);
hoja(w2, 'Proyectos nuevos a confirmar', proyNuevos, [14, 55, 13, 14, 11, 36, 14, 70, 20]);
hoja(w2, 'Proveedores sin cuenta', provSin, [11, 13, 45, 15, 9, 13, 36, 44]);
XLSX.writeFile(w2, `${out}/Revision-Operaciones-Compras-${hoy}.xlsx`);
console.log(JSON.stringify({ banco: banco.length, sinBanco: sinBanco.length, sunat: sunat.length, abonos: abonos.length, errores: errores.length, oblig: oblig.length, sinCdc: sinCdc.length, ncSin: ncSin.length, ventasCli: ventasCli.length, ventasDet: ventasDet.length, proyNuevos: proyNuevos.length, provSin: provSin.length }));
