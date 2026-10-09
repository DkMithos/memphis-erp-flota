/**
 * BANCOS — movimientos importados de BBVA, conciliación y acumulado por centro de costo.
 */
import { supabase } from '../supabase/client';
import type { HojaBbva } from './bancos-bbva';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;
const lanzar = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const num = (v: unknown) => Number(v ?? 0);

export type Clasificacion = 'por_clasificar' | 'pago_proveedor' | 'abono' | 'itf' | 'comision' | 'sunat' | 'planilla' | 'detraccion' | 'cambio_moneda' | 'caja_chica' | 'prestamo' | 'interes_ganado' | 'otro';

export const CLASIFICACION: Record<Clasificacion, { label: string; categoria: string }> = {
  por_clasificar: { label: 'Por clasificar', categoria: '' },
  pago_proveedor: { label: 'Pago a proveedor', categoria: 'Pago a proveedores' },
  abono:          { label: 'Abono / cobro', categoria: 'Cobro' },
  itf:            { label: 'ITF', categoria: 'ITF' },
  comision:       { label: 'Comisión bancaria', categoria: 'Comisiones bancarias' },
  sunat:          { label: 'Pago a SUNAT', categoria: 'Impuestos SUNAT' },
  planilla:       { label: 'Planilla / AFP', categoria: 'Planilla' },
  detraccion:     { label: 'Detracción', categoria: 'Detracción SPOT' },
  cambio_moneda:  { label: 'Cambio de moneda', categoria: 'Cambio de moneda' },
  caja_chica:     { label: 'Caja chica', categoria: 'Caja chica' },
  prestamo:       { label: 'Préstamo / cuota', categoria: 'Préstamos' },
  interes_ganado: { label: 'Interés ganado', categoria: 'Intereses' },
  otro:           { label: 'Otro', categoria: 'Otros' },
};

export interface ResumenCuenta {
  cuentaId: string; nombre: string; moneda: 'PEN' | 'USD'; tipo: string;
  saldoInicial: number; saldoInicialFecha: string; saldoErp: number;
  saldoBanco: number | null; saldoBancoFecha: string | null;
  movimientos: number; sinConciliar: number; cargosSinConciliar: number; abonosSinConciliar: number;
  desde: string | null; hasta: string | null; transaccionesSinBanco: number;
}

export interface Movimiento {
  id: string; cuentaId: string; cuentaNombre: string; cuentaMoneda: 'PEN' | 'USD';
  fechaOperacion: string; fechaValor: string | null; codigo: string | null; numeroDoc: string | null;
  concepto: string | null; importe: number; oficina: string | null; clasificacion: Clasificacion;
  transaccionId: string | null; transaccionNumero: string | null; transaccionCategoria: string | null; transaccionDescripcion: string | null;
  proveedorNombre: string | null; conciliadoEn: string | null; conciliadoPor: string | null;
  centroCostoId: string | null; centroCostoCodigo: string | null; proyectoId: string | null; proyectoCodigo: string | null;
  notas: string | null; mes: string; origenArchivo: string | null;
}

export interface TransaccionCandidata { id: string; numero: string; fecha: string; monto: number; moneda: string; tipo: string; descripcion: string | null; proveedor: string | null; referencia: string | null; categoria: string | null }

export interface AcumuladoFila { mes: string; tipo: string; centroCosto: string; proyecto: string; categoria: string; moneda: string; movimientos: number; monto: number; montoSoles: number }

export async function cargarResumen(): Promise<ResumenCuenta[]> {
  const { data, error } = await db.from('v_bancos_resumen').select('*');
  lanzar(error);
  return (data ?? []).map((r: Record<string, any>) => ({
    cuentaId: r.cuenta_bancaria_id, nombre: r.nombre, moneda: r.moneda, tipo: r.tipo,
    saldoInicial: num(r.saldo_inicial), saldoInicialFecha: r.saldo_inicial_fecha, saldoErp: num(r.saldo_erp),
    saldoBanco: r.saldo_banco == null ? null : num(r.saldo_banco), saldoBancoFecha: r.saldo_banco_fecha ?? null,
    movimientos: num(r.movimientos), sinConciliar: num(r.sin_conciliar), cargosSinConciliar: num(r.cargos_sin_conciliar), abonosSinConciliar: num(r.abonos_sin_conciliar),
    desde: r.desde ?? null, hasta: r.hasta ?? null, transaccionesSinBanco: num(r.transacciones_sin_banco),
  }));
}

export async function cargarMovimientos(cuentaId: string, mes?: string): Promise<Movimiento[]> {
  let q = db.from('v_movimientos_bancarios').select('*').eq('cuenta_bancaria_id', cuentaId).order('fecha_operacion', { ascending: false }).order('fila', { ascending: false }).limit(3000);
  if (mes) q = q.eq('mes', mes);
  const { data, error } = await q;
  lanzar(error);
  return (data ?? []).map((r: Record<string, any>): Movimiento => ({
    id: r.id, cuentaId: r.cuenta_bancaria_id, cuentaNombre: r.cuenta_nombre, cuentaMoneda: r.cuenta_moneda,
    fechaOperacion: r.fecha_operacion, fechaValor: r.fecha_valor ?? null, codigo: r.codigo ?? null, numeroDoc: r.numero_doc ?? null,
    concepto: r.concepto ?? null, importe: num(r.importe), oficina: r.oficina ?? null, clasificacion: (r.clasificacion ?? 'por_clasificar') as Clasificacion,
    transaccionId: r.transaccion_id ?? null, transaccionNumero: r.transaccion_numero ?? null, transaccionCategoria: r.transaccion_categoria ?? null,
    transaccionDescripcion: r.transaccion_descripcion ?? null, proveedorNombre: r.proveedor_nombre ?? null,
    conciliadoEn: r.conciliado_en ?? null, conciliadoPor: r.conciliado_por ?? null,
    centroCostoId: r.centro_costo_id ?? null, centroCostoCodigo: r.centro_costo_codigo ?? null, proyectoId: r.proyecto_id ?? null, proyectoCodigo: r.proyecto_codigo ?? null,
    notas: r.notas ?? null, mes: r.mes, origenArchivo: r.origen_archivo ?? null,
  }));
}

export async function importarHoja(cuentaId: string, hoja: HojaBbva, archivo: string): Promise<{ nuevos: number; duplicados: number; saltados: number; desde: string | null; hasta: string | null; porOperacion: number; porImporte: number }> {
  const { data, error } = await db.rpc('bancos_importar_movimientos', {
    p_cuenta: cuentaId, p_filas: hoja.movimientos, p_saldos: hoja.saldos, p_archivo: `${archivo} · ${hoja.hoja}`,
  });
  lanzar(error);
  return {
    nuevos: num(data?.nuevos), duplicados: num(data?.duplicados), saltados: num(data?.saltados), desde: data?.desde ?? null, hasta: data?.hasta ?? null,
    porOperacion: num(data?.conciliados?.por_operacion), porImporte: num(data?.conciliados?.por_importe),
  };
}

export async function conciliarAuto(cuentaId: string): Promise<{ porOperacion: number; porImporte: number }> {
  const { data, error } = await db.rpc('bancos_conciliar_auto', { p_cuenta: cuentaId });
  lanzar(error);
  return { porOperacion: num(data?.por_operacion), porImporte: num(data?.por_importe) };
}

export async function candidatas(cuentaId: string, importe: number, fecha: string): Promise<TransaccionCandidata[]> {
  const d = new Date(fecha + 'T00:00:00Z'); const a = new Date(d); a.setUTCDate(a.getUTCDate() - 15); const b = new Date(d); b.setUTCDate(b.getUTCDate() + 15);
  const { data, error } = await db.from('transacciones')
    .select('id, numero, fecha, fecha_pago, monto, moneda, tipo, descripcion, proveedor_nombre, referencia_numero, categoria')
    .eq('estado', 'pagada').is('movimiento_bancario_id', null).eq('tipo', importe < 0 ? 'egreso' : 'ingreso')
    .or(`cuenta_bancaria_id.eq.${cuentaId},cuenta_bancaria_id.is.null`)
    .gte('fecha', a.toISOString().slice(0, 10)).lte('fecha', b.toISOString().slice(0, 10))
    .order('fecha', { ascending: false }).limit(100);
  lanzar(error);
  const abs = Math.abs(importe);
  return (data ?? []).map((r: Record<string, any>): TransaccionCandidata => ({
    id: r.id, numero: r.numero, fecha: r.fecha_pago ?? r.fecha, monto: num(r.monto), moneda: r.moneda ?? 'PEN', tipo: r.tipo,
    descripcion: r.descripcion ?? null, proveedor: r.proveedor_nombre ?? null, referencia: r.referencia_numero ?? null, categoria: r.categoria ?? null,
  })).sort((x: TransaccionCandidata, y: TransaccionCandidata) => Math.abs(x.monto - abs) - Math.abs(y.monto - abs));
}

export const vincular = async (movId: string, trxId: string) => { const { error } = await db.rpc('bancos_vincular', { p_mov: movId, p_trx: trxId }); lanzar(error); };
export const desvincular = async (movId: string) => { const { error } = await db.rpc('bancos_desvincular', { p_mov: movId }); lanzar(error); };
export const registrar = async (args: { movId: string; clasificacion: Clasificacion; categoria: string; centroCostoId?: string | null; proyectoId?: string | null; descripcion?: string | null }) => {
  const { error } = await db.rpc('bancos_registrar_movimiento', { p_mov: args.movId, p_clasificacion: args.clasificacion, p_categoria: args.categoria, p_centro_costo: args.centroCostoId ?? null, p_proyecto: args.proyectoId ?? null, p_descripcion: args.descripcion ?? null });
  lanzar(error);
};
export const clasificar = async (movId: string, clasificacion: Clasificacion, centroCostoId?: string | null, proyectoId?: string | null) => {
  const { error } = await db.rpc('bancos_clasificar', { p_mov: movId, p_clasificacion: clasificacion, p_centro_costo: centroCostoId ?? null, p_proyecto: proyectoId ?? null });
  lanzar(error);
};

export async function cargarAcumulado(desdeMes: string, hastaMes: string): Promise<AcumuladoFila[]> {
  const { data, error } = await db.from('v_pagos_acumulados').select('*').gte('mes', desdeMes).lte('mes', hastaMes).order('mes').order('centro_costo');
  lanzar(error);
  return (data ?? []).map((r: Record<string, any>) => ({
    mes: r.mes, tipo: r.tipo, centroCosto: r.centro_costo, proyecto: r.proyecto ?? '', categoria: r.categoria, moneda: r.moneda,
    movimientos: num(r.movimientos), monto: num(r.monto), montoSoles: num(r.monto_soles),
  }));
}

export const dinero = (n: number, m: string) => `${m === 'USD' ? 'US$' : 'S/'} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
