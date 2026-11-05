/**
 * Informe para Contabilidad (2026-11-05): lo que el ERP necesita que revisen después de cargar el SIRE de octubre, las
 * notas de crédito/débito de todo 2026 y el cruce de pagos de agosto-setiembre. Sale como Excel, una hoja por tema.
 * Uso: PGUSER=<rol temporal solo lectura> PGPASS=<clave> node scripts/sire-historico/7-informe-contabilidad.mjs <plan_pagos.json> <salida.xlsx>
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const reqRepo = createRequire('C:/Users/URSULA/Proyectos/memphis-erp-flota/package.json');
const XLSX = reqRepo('xlsx');
const pg = createRequire(process.env.PGTOOL ?? 'C:/Users/URSULA/AppData/Local/Temp/claude/bae2337a37463163/8d33990c-93a6-418b-ae32-d99f46f984d7/scratchpad/pgtool/package.json')('pg');
const [planPath, salida] = process.argv.slice(2);
const T = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (sql, params = []) => (await c.query(sql, params)).rows;
const num = (v) => (v == null ? null : Number(v));

const anuladas = (await q(`
  select f.numero_completo "Factura", f.ruc_emisor "RUC", f.razon_social_emisor "Proveedor", f.fecha_emision::text "Emisión", f.moneda "Moneda", f.total "Total factura",
         n.numero_completo "Nota de crédito", n.fecha_emision::text "Fecha NC", n.total "Total NC", n.periodo_sire "Periodo SIRE NC",
         case when exists (select 1 from transacciones t where t.comprobante_id = f.id and t.estado <> 'anulada') then 'SÍ' else 'no' end "Tenía pagos",
         coalesce((select string_agg(t.numero || ' ' || t.monto, ', ') from transacciones t where t.comprobante_id = f.id and t.estado <> 'anulada'), '') "Pagos registrados",
         f.asiento_id is not null "Factura con asiento", n.asiento_id is not null "NC con asiento"
    from comprobantes_pago f join comprobantes_pago n on n.afecta_comprobante_id = f.id and n.tipo = '07'
   where f.tenant_id = $1 and f.estado_flujo = 'cancelada_nc' order by f.fecha_emision, f.numero_completo`, [T])).map((r) => ({ ...r, 'Total factura': num(r['Total factura']), 'Total NC': num(r['Total NC']) }));

const pagadasNC = (await q(`
  select f.numero_completo "Factura", f.razon_social_emisor "Proveedor", f.moneda "Moneda", f.total "Total factura", n.numero_completo "Nota de crédito", n.total "Total NC", n.fecha_emision::text "Fecha NC",
         fc.monto_pagado "Pagado en el ERP", (select string_agg(t.numero || ' ' || coalesce(t.fecha_pago, t.fecha)::text || ' ' || t.monto, ', ') from transacciones t where t.comprobante_id = f.id and t.estado <> 'anulada') "Pagos",
         case when n.total >= f.total - 0.05 then 'NC por el total: devolución o saldo a favor' else 'NC parcial sobre factura ya pagada: saldo a favor ' || round(n.total, 2) end "Qué revisar"
    from comprobantes_pago n join comprobantes_pago f on f.id = n.afecta_comprobante_id left join flujo_compromisos fc on fc.comprobante_id = f.id
   where n.tenant_id = $1 and n.tipo = '07' and exists (select 1 from transacciones t where t.comprobante_id = f.id and t.estado <> 'anulada') order by n.total desc`, [T])).map((r) => ({ ...r, 'Total factura': num(r['Total factura']), 'Total NC': num(r['Total NC']), 'Pagado en el ERP': num(r['Pagado en el ERP']) }));

const ncMayor = (await q(`
  select n.numero_completo "Nota de crédito", n.fecha_emision::text "Fecha NC", n.moneda "Moneda", n.total "Total NC", f.numero_completo "Factura que modifica", f.fecha_emision::text "Emisión factura", f.total "Total factura", f.tipo_cambio "TC factura", f.periodo_sire "Periodo SIRE factura", f.razon_social_emisor "Proveedor",
         'La NC supera a la factura: confirmar si la factura entró con el importe correcto o si la NC aplica a otro documento' "Qué revisar"
    from comprobantes_pago n join comprobantes_pago f on f.id = n.afecta_comprobante_id where n.tenant_id = $1 and n.tipo = '07' and n.total > f.total + 0.05 order by n.numero_completo`, [T])).map((r) => ({ ...r, 'Total NC': num(r['Total NC']), 'Total factura': num(r['Total factura']), 'TC factura': num(r['TC factura']) }));

const nd = (await q(`
  select n.numero_completo "Nota de débito", n.fecha_emision::text "Fecha ND", n.moneda "Moneda", n.total "Total ND", f.numero_completo "Factura", f.razon_social_emisor "Proveedor", f.total "Total factura", f.estado_flujo "Estado factura",
         coalesce((select fc.monto_presupuestado::text from flujo_compromisos fc where fc.comprobante_id = f.id limit 1), '') "Saldo en CxP"
    from comprobantes_pago n join comprobantes_pago f on f.id = n.afecta_comprobante_id where n.tenant_id = $1 and n.tipo = '08' order by n.fecha_emision`, [T])).map((r) => ({ ...r, 'Total ND': num(r['Total ND']), 'Total factura': num(r['Total factura']) }));

const sinProv = (await q(`
  select c.ruc_emisor "RUC", c.razon_social_emisor "Razón social (SIRE)", c.numero_completo "Factura", c.fecha_emision::text "Emisión", c.moneda "Moneda", c.total "Total", c.estado_flujo "Estado",
         case when c.asiento_id is null then 'sin asiento (no tiene proveedor)' else '' end "Observación"
    from comprobantes_pago c where c.tenant_id = $1 and c.origen = 'sire' and c.periodo_sire = '202610' and c.proveedor_id is null order by c.ruc_emisor, c.numero_completo`, [T])).map((r) => ({ ...r, Total: num(r.Total) }));

const noCuadran = (await q(`
  select c.numero_completo "Factura", c.razon_social_emisor "Proveedor", c.periodo_sire "Periodo", c.moneda "Moneda", c.total "Total", c.op_gravada "Base gravada", c.igv "IGV", c.op_exonerada + c.op_inafecta "No gravado", c.contabilizacion_error "Error al contabilizar"
    from comprobantes_pago c where c.tenant_id = $1 and c.contabilizacion_error is not null and c.estado = 'activo' and coalesce(c.estado_flujo,'') not in ('anulada','historica','cancelada_nc') order by c.periodo_sire, c.numero_completo`, [T])).map((r) => ({ ...r, Total: num(r.Total), 'Base gravada': num(r['Base gravada']), IGV: num(r.IGV), 'No gravado': num(r['No gravado']) }));

const cargos = (await q(`
  select m.fecha_operacion::text "Fecha", cb.nombre "Cuenta", m.numero_doc "OPE", m.concepto "Concepto", -m.importe "Importe", coalesce(m.clasificacion, '') "Clasificación en Bancos", coalesce(m.notas, '') "Notas"
    from movimientos_bancarios m join cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
   where m.tenant_id = $1 and m.importe < 0 and m.fecha_operacion between '2026-08-01' and '2026-09-30' and m.transaccion_id is null order by m.fecha_operacion, cb.nombre`, [T])).map((r) => ({ ...r, Importe: num(r.Importe) }));

const vencidas = (await q(`
  select c.numero_completo "Factura", c.razon_social_emisor "Proveedor", c.ruc_emisor "RUC", c.fecha_emision::text "Emisión", c.fecha_vencimiento::text "Vencimiento", c.moneda "Moneda", c.total "Total", c.estado_flujo "Estado", c.periodo_sire "Periodo SIRE", coalesce(c.orden_compra_numero, '') "OC"
    from comprobantes_pago c where c.tenant_id = $1 and c.direccion = 'recibido' and c.estado = 'activo' and c.tipo not in ('07', '08') and c.estado_flujo in ('conforme', 'programada_pago') and c.fecha_vencimiento < current_date
     and not exists (select 1 from transacciones t where t.comprobante_id = c.id and t.estado <> 'anulada') order by c.fecha_vencimiento, c.numero_completo`, [T])).map((r) => ({ ...r, Total: num(r.Total) }));

await c.end();

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const fila = (p, motivo) => ({ Mes: p.mes, Cuenta: p.cuenta, 'Fecha pago': p.fecha, OPE: p.ope, Moneda: p.moneda, Monto: p.monto, 'Tipo doc': p.tipo, Comprobante: p.comprobante, 'Razón social': p.razon, Descripción: p.descripcion, Motivo: motivo });
const sinFactura = plan.filter((p) => p.estado === 'sin_factura').map((p) => fila(p, 'El comprobante no está en el ERP (no vino en el SIRE o tiene otra serie/número)'));
const ambiguas = plan.filter((p) => p.estado === 'factura_ambigua').map((p) => ({ ...fila(p, 'Hay varias facturas con esa serie-número y ninguna coincide con el importe pagado'), Candidatas: (p.candidatos ?? []).join(' | ') }));
const detraccionBloque = plan.filter((p) => p.estado === 'revisar_trx_generica_multiple' || p.estado === 'reusar_trx_generica').map((p) => fila(p, 'Depósito de detracción/cambio de moneda ya registrado en bloque el 13-oct; la factura se cerró con el neto'));

const resumen = [
  ['Informe para Contabilidad · ERP Memphis · 5 de noviembre de 2026'],
  [],
  ['Qué se hizo hoy en el ERP', 'Detalle'],
  ['SIRE Compras de octubre', '402 facturas nuevas (S/ 5.93 M + US$ 2.67 M); 61 sin proveedor en el directorio (hoja "SIRE oct sin proveedor").'],
  ['Importes en dólares del SIRE', 'El SIRE los trae en soles: 1,777 comprobantes de 2024-2026 se corrigieron dividiendo entre el TC; 75 asientos regenerados.'],
  ['Notas de crédito y débito', '7 de octubre + 97 de enero a setiembre importadas y aplicadas a su factura (hojas "Facturas anuladas por NC", "Notas de débito").'],
  ['Pagos de agosto y setiembre', '373 pagos de los PAGOS 202608/202609 conciliados con el banco; 364 facturas pasaron a pagadas, 2 parciales.'],
  [],
  ['Qué necesita revisar Contabilidad', 'Hoja'],
  ['Facturas ya pagadas que después recibieron nota de crédito (devolución o saldo a favor)', 'Pagadas con NC'],
  ['Notas de crédito de RIMAC que superan el total de la factura que modifican', 'NC mayor que factura'],
  ['61 facturas del SIRE de octubre cuyo RUC no existe como proveedor (Compras los crea; 38 no tienen asiento por eso)', 'SIRE oct sin proveedor'],
  ['Facturas sin asiento por error al contabilizar (sin proveedor, o base + IGV no cuadra con el total)', 'Sin asiento (con error)'],
  ['Pagos de agosto-setiembre cuyo comprobante no está en el ERP (recibos Integratel, notas de débito, EMTRAMED F002-21148)', 'Pagos sin factura'],
  ['Pagos a personas que no coinciden con ninguna factura (Macher, Guerreros, Zegarra)', 'Pagos ambiguos'],
  ['Cargos del banco de agosto-setiembre sin conciliar (proveedores, préstamos, caja chica, por clasificar)', 'Cargos sin conciliar'],
  ['Facturas conformes vencidas sin pago registrado (casi todas de octubre: faltan el extracto de octubre y el cruce de pagos)', 'Conformes vencidas'],
  [],
  ['Pendientes de Contabilidad con el ERP', ''],
  ['Subir el SIRE Ventas de setiembre y octubre; los XML de compras desde agosto; detracciones depositadas desde el 7-oct', ''],
  ['Subir el extracto BBVA de octubre (soles y dólares) y el PAGOS 202610 para correr el cruce de pagos', ''],
  ['Pagar a PACÍFICO F028-1130026 por S/ 11,019.31 (factura + nota de débito FD12-209486)', ''],
];

const wb = XLSX.utils.book_new();
const add = (nombre, filas, anchos) => { const ws = Array.isArray(filas[0]) ? XLSX.utils.aoa_to_sheet(filas) : XLSX.utils.json_to_sheet(filas); if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, nombre); };
add('Resumen', resumen, [95, 110]);
add('Facturas anuladas por NC', anuladas, [16, 13, 40, 11, 8, 14, 16, 11, 14, 12, 11, 30, 12, 12]);
add('Pagadas con NC', pagadasNC, [16, 40, 8, 14, 16, 12, 11, 14, 40, 55]);
add('NC mayor que factura', ncMayor, [16, 11, 8, 12, 18, 12, 13, 10, 12, 32, 70]);
add('Notas de débito', nd, [16, 11, 8, 12, 16, 40, 13, 14, 12]);
add('SIRE oct sin proveedor', sinProv, [13, 45, 16, 11, 8, 13, 10, 32]);
add('Sin asiento (con error)', noCuadran, [16, 40, 9, 8, 12, 13, 11, 11, 70]);
add('Pagos sin factura', sinFactura, [9, 7, 11, 12, 7, 12, 20, 16, 36, 40, 60]);
add('Pagos ambiguos', ambiguas, [9, 7, 11, 12, 7, 12, 20, 16, 36, 40, 60, 60]);
add('Detracciones en bloque', detraccionBloque, [9, 7, 11, 12, 7, 12, 20, 16, 36, 40, 60]);
add('Cargos sin conciliar', cargos, [11, 18, 12, 50, 13, 20, 50]);
add('Conformes vencidas', vencidas, [16, 40, 13, 11, 11, 8, 13, 14, 10, 11]);
XLSX.writeFile(wb, salida);
console.log('hojas:', { anuladas: anuladas.length, pagadasNC: pagadasNC.length, ncMayor: ncMayor.length, nd: nd.length, sinProv: sinProv.length, noCuadran: noCuadran.length, sinFactura: sinFactura.length, ambiguas: ambiguas.length, detraccionBloque: detraccionBloque.length, cargos: cargos.length, vencidas: vencidas.length });
