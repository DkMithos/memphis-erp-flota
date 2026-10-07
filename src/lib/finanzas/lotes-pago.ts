/**
 * LOTES DE PAGO — tipos, llamadas a la base y exportación para el banco.
 *
 * Todo el cálculo (detracción, retención, neto, alertas) vive en SQL
 * (`lote_pago_recalcular`); aquí solo se leen vistas y se llaman las funciones.
 * Así la cifra que ve Compras, la que valida Contabilidad y la que paga
 * Tesorería es exactamente la misma.
 */
import { supabase } from '../supabase/client';
import { exportToExcelMultiHoja } from '../shared/export-utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

export type EstadoLote = 'borrador' | 'en_revision' | 'validado' | 'por_pagar' | 'pagado' | 'conciliado' | 'anulado';
export type TipoLinea = 'factura' | 'orden' | 'compromiso' | 'adelanto' | 'letra' | 'sin_comprobante';
export type RetencionTipo = 'ninguna' | 'igv' | 'cuarta';

export interface Lote {
  id: string;
  numero: string;
  estado: EstadoLote;
  fechaPrevistaPago: string | null;
  notas: string | null;
  creadoEn: string;
  creadoPorEmail: string | null;
  enviadoRevisionEn: string | null;
  validadoEn: string | null;
  validadoPorEmail: string | null;
  enviadoTesoreriaEn: string | null;
  pagadoEn: string | null;
  anuladoEn: string | null;
  motivoAnulacion: string | null;
  lineas: number;
  lineasPendientes: number;
  lineasPagadas: number;
  lineasConAlertas: number;
  lineasAjustadas: number;
  brutoPen: number;
  brutoUsd: number;
  netoPen: number;
  netoUsd: number;
  detraccionSoles: number;
  retencionPen: number;
  retencionUsd: number;
  netoTotalSoles: number;
}

export interface LoteItem {
  id: string;
  loteId: string;
  orden: number;
  tipoLinea: TipoLinea;
  compromisoId: string | null;
  comprobanteId: string | null;
  ordenCompraId: string | null;
  proveedorId: string | null;
  proveedor: string | null;
  ruc: string | null;
  proyectoId: string | null;
  proyectoCodigo: string | null;
  cdc: string | null;
  concepto: string | null;
  referenciaDoc: string | null;
  comprobanteNumero: string | null;
  comprobanteTotal: number | null;
  moneda: 'PEN' | 'USD';
  monto: number;
  tc: number;
  fechaTc: string | null;
  banco: string | null;
  cuenta: string | null;
  cci: string | null;
  monedaCuenta: string | null;
  cuentaDetraccion: string | null;
  detraccionAplica: boolean;
  detraccionCodigo: string | null;
  detraccionDescripcion: string | null;
  detraccionTasa: number | null;
  detraccionBase: number | null;
  detraccionSoles: number;
  detraccionMonto: number;
  retencionTipo: RetencionTipo;
  retencionTasa: number | null;
  retencionMonto: number;
  neto: number;
  netoSoles: number;
  alertas: string[];
  ajustado: boolean;
  ajustadoPorEmail: string | null;
  ajustadoEn: string | null;
  ajusteMotivo: string | null;
  estado: 'pendiente' | 'pagada' | 'excluida';
  fechaPago: string | null;
  cuentaBancariaId: string | null;
  cuentaOrigenNombre: string | null;
  numeroOperacion: string | null;
  voucherPath: string | null;
  motivoExclusion: string | null;
  notas: string | null;
}

export interface CuentaBancaria {
  id: string;
  nombre: string;
  banco: string;
  numero: string | null;
  cci: string | null;
  moneda: 'PEN' | 'USD';
  tipo: 'corriente' | 'ahorro' | 'detracciones';
  saldoInicial: number;
  saldoInicialFecha: string;
  saldoActual: number;
  movimientos: number;
  ultimoMovimiento: string | null;
  activa: boolean;
}

export interface CodigoDetraccion { codigo: string; descripcion: string; tasa: number; }

export interface Bitacora {
  id: string; itemId: string | null; accion: string; detalle: Record<string, unknown> | null; creadoEn: string; userId: string | null;
}

export const ESTADO_LOTE: Record<EstadoLote, { label: string; clase: string; ayuda: string }> = {
  borrador:    { label: 'Borrador',       clase: 'bg-muted text-foreground',                  ayuda: 'Compras lo está armando' },
  en_revision: { label: 'En revisión',    clase: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', ayuda: 'Esperando a Contabilidad' },
  validado:    { label: 'Validado',       clase: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',     ayuda: 'Contabilidad lo validó; Compras lo envía a tesorería' },
  por_pagar:   { label: 'Por pagar',      clase: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200', ayuda: 'En manos de Tesorería' },
  pagado:      { label: 'Pagado',         clase: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',  ayuda: 'Todas las líneas pagadas o excluidas' },
  conciliado:  { label: 'Conciliado',     clase: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200', ayuda: 'Cruzado con el banco' },
  anulado:     { label: 'Anulado',        clase: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',         ayuda: 'No se pagó' },
};

export const TIPO_LINEA: Record<TipoLinea, string> = {
  factura: 'Factura', orden: 'OC sin factura', compromiso: 'Compromiso', adelanto: 'Adelanto', letra: 'Letra', sin_comprobante: 'Sin comprobante',
};

export const RETENCION: Record<RetencionTipo, string> = { ninguna: 'Sin retención', igv: 'IGV 3 %', cuarta: '4ta cat. 8 %' };

export const simbolo = (m: string) => (m === 'USD' ? 'US$' : 'S/');
export const monto2 = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dinero = (n: number, m: string) => `${simbolo(m)} ${monto2(n)}`;

const num = (v: unknown) => Number(v ?? 0);

function mapLote(r: Record<string, any>): Lote {
  return {
    id: r.id, numero: r.numero, estado: r.estado, fechaPrevistaPago: r.fecha_prevista_pago ?? null, notas: r.notas ?? null,
    creadoEn: r.creado_en, creadoPorEmail: r.creado_por_email ?? null,
    enviadoRevisionEn: r.enviado_revision_en ?? null, validadoEn: r.validado_en ?? null, validadoPorEmail: r.validado_por_email ?? null,
    enviadoTesoreriaEn: r.enviado_tesoreria_en ?? null, pagadoEn: r.pagado_en ?? null, anuladoEn: r.anulado_en ?? null, motivoAnulacion: r.motivo_anulacion ?? null,
    lineas: num(r.lineas), lineasPendientes: num(r.lineas_pendientes), lineasPagadas: num(r.lineas_pagadas),
    lineasConAlertas: num(r.lineas_con_alertas), lineasAjustadas: num(r.lineas_ajustadas),
    brutoPen: num(r.bruto_pen), brutoUsd: num(r.bruto_usd), netoPen: num(r.neto_pen), netoUsd: num(r.neto_usd),
    detraccionSoles: num(r.detraccion_soles), retencionPen: num(r.retencion_pen), retencionUsd: num(r.retencion_usd), netoTotalSoles: num(r.neto_total_soles),
  };
}

function mapItem(r: Record<string, any>): LoteItem {
  return {
    id: r.id, loteId: r.lote_id, orden: num(r.orden), tipoLinea: r.tipo_linea,
    compromisoId: r.compromiso_id ?? null, comprobanteId: r.comprobante_id ?? null, ordenCompraId: r.orden_compra_id ?? null,
    proveedorId: r.proveedor_id ?? null, proveedor: r.proveedor ?? null, ruc: r.ruc ?? null,
    proyectoId: r.proyecto_id ?? null, proyectoCodigo: r.proyecto_codigo ?? null, cdc: r.cdc ?? null,
    concepto: r.concepto ?? null, referenciaDoc: r.referencia_doc ?? null,
    comprobanteNumero: r.comprobante_numero ?? null, comprobanteTotal: r.comprobante_total == null ? null : num(r.comprobante_total),
    moneda: r.moneda === 'USD' ? 'USD' : 'PEN', monto: num(r.monto), tc: num(r.tc) || 1, fechaTc: r.fecha_tc ?? null,
    banco: r.banco ?? null, cuenta: r.cuenta ?? null, cci: r.cci ?? null, monedaCuenta: r.moneda_cuenta ?? null, cuentaDetraccion: r.cuenta_detraccion ?? null,
    detraccionAplica: Boolean(r.detraccion_aplica), detraccionCodigo: r.detraccion_codigo ?? null, detraccionDescripcion: r.detraccion_descripcion ?? null,
    detraccionTasa: r.detraccion_tasa == null ? null : num(r.detraccion_tasa), detraccionBase: r.detraccion_base == null ? null : num(r.detraccion_base),
    detraccionSoles: num(r.detraccion_soles), detraccionMonto: num(r.detraccion_monto),
    retencionTipo: r.retencion_tipo ?? 'ninguna', retencionTasa: r.retencion_tasa == null ? null : num(r.retencion_tasa), retencionMonto: num(r.retencion_monto),
    neto: num(r.neto), netoSoles: num(r.neto_soles), alertas: (r.alertas as string[]) ?? [],
    ajustado: Boolean(r.ajustado), ajustadoPorEmail: r.ajustado_por_email ?? null, ajustadoEn: r.ajustado_en ?? null, ajusteMotivo: r.ajuste_motivo ?? null,
    estado: r.estado, fechaPago: r.fecha_pago ?? null, cuentaBancariaId: r.cuenta_bancaria_id ?? null, cuentaOrigenNombre: r.cuenta_origen_nombre ?? null,
    numeroOperacion: r.numero_operacion ?? null, voucherPath: r.voucher_path ?? null, motivoExclusion: r.motivo_exclusion ?? null, notas: r.notas ?? null,
  };
}

function mapCuenta(r: Record<string, any>): CuentaBancaria {
  return {
    id: r.id, nombre: r.nombre, banco: r.banco, numero: r.numero ?? null, cci: r.cci ?? null, moneda: r.moneda, tipo: r.tipo,
    saldoInicial: num(r.saldo_inicial), saldoInicialFecha: r.saldo_inicial_fecha, saldoActual: num(r.saldo_actual),
    movimientos: num(r.movimientos), ultimoMovimiento: r.ultimo_movimiento ?? null, activa: Boolean(r.activa),
  };
}

const lanzar = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export async function cargarLotes(): Promise<Lote[]> {
  const { data, error } = await db.from('v_lotes_pago').select('*').order('creado_en', { ascending: false }).limit(500);
  lanzar(error);
  return (data ?? []).map(mapLote);
}

export async function cargarLote(id: string): Promise<Lote | null> {
  const { data, error } = await db.from('v_lotes_pago').select('*').eq('id', id).maybeSingle();
  lanzar(error);
  return data ? mapLote(data) : null;
}

export async function cargarItems(loteId: string): Promise<LoteItem[]> {
  const { data, error } = await db.from('v_lotes_pago_items').select('*').eq('lote_id', loteId).order('orden');
  lanzar(error);
  return (data ?? []).map(mapItem);
}

export async function cargarCuentas(): Promise<CuentaBancaria[]> {
  const { data, error } = await db.from('v_cuentas_bancarias_saldo').select('*').order('orden');
  lanzar(error);
  return (data ?? []).map(mapCuenta);
}

export async function cargarCodigosDetraccion(): Promise<CodigoDetraccion[]> {
  const { data, error } = await db.from('detraccion_codigos').select('codigo, descripcion, tasa').eq('vigente', true).order('codigo');
  lanzar(error);
  return (data ?? []).map((r: Record<string, any>) => ({ codigo: r.codigo, descripcion: r.descripcion, tasa: num(r.tasa) }));
}

export async function cargarBitacora(loteId: string): Promise<Bitacora[]> {
  const { data, error } = await db.from('lotes_pago_bitacora').select('id, item_id, accion, detalle, creado_en, user_id').eq('lote_id', loteId).order('creado_en', { ascending: false }).limit(200);
  lanzar(error);
  return (data ?? []).map((r: Record<string, any>) => ({ id: r.id, itemId: r.item_id ?? null, accion: r.accion, detalle: r.detalle ?? null, creadoEn: r.creado_en, userId: r.user_id ?? null }));
}

export async function fijarSaldoInicial(cuentaId: string, saldo: number, fecha: string): Promise<void> {
  const { error } = await db.from('cuentas_bancarias').update({ saldo_inicial: saldo, saldo_inicial_fecha: fecha }).eq('id', cuentaId);
  lanzar(error);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  lanzar(error);
  return data as T;
}

export const crearLote = (fecha: string | null, notas: string | null) => rpc<string>('lote_pago_crear', { p_fecha: fecha, p_notas: notas });
export const agregarCompromisos = (loteId: string, compromisos: string[]) => rpc<number>('lote_pago_agregar', { p_lote: loteId, p_compromisos: compromisos });
export const agregarLineaLibre = (args: { loteId: string; proveedorId: string; monto: number; moneda: 'PEN' | 'USD'; concepto: string; tipoLinea: TipoLinea; ordenCompraId?: string | null; proyectoId?: string | null; centroCostoId?: string | null; referencia?: string | null }) =>
  rpc<string>('lote_pago_agregar_libre', {
    p_lote: args.loteId, p_proveedor: args.proveedorId, p_monto: args.monto, p_moneda: args.moneda, p_concepto: args.concepto,
    p_tipo_linea: args.tipoLinea, p_orden_compra: args.ordenCompraId ?? null, p_proyecto: args.proyectoId ?? null,
    p_centro_costo: args.centroCostoId ?? null, p_referencia: args.referencia ?? null,
  });
export const fijarMonto = (itemId: string, monto: number) => rpc<void>('lote_pago_fijar_monto', { p_item: itemId, p_monto: monto });
export const quitarLinea = (itemId: string) => rpc<void>('lote_pago_quitar', { p_item: itemId });
export const ajustarLinea = (args: { itemId: string; detraccionAplica: boolean; detraccionCodigo: string | null; detraccionTasa: number | null; retencionTipo: RetencionTipo; motivo: string }) =>
  rpc<void>('lote_pago_ajustar', {
    p_item: args.itemId, p_detraccion_aplica: args.detraccionAplica, p_detraccion_codigo: args.detraccionCodigo,
    p_detraccion_tasa: args.detraccionTasa, p_retencion_tipo: args.retencionTipo, p_motivo: args.motivo,
  });
export const deshacerAjuste = (itemId: string) => rpc<void>('lote_pago_desajustar', { p_item: itemId });
export const cambiarEstado = (loteId: string, estado: EstadoLote, motivo?: string) => rpc<void>('lote_pago_cambiar_estado', { p_lote: loteId, p_estado: estado, p_motivo: motivo ?? null });
export const marcarPagada = (args: { itemId: string; fecha: string; cuentaId: string; numeroOperacion: string; voucherPath?: string | null; notas?: string | null }) =>
  rpc<string>('lote_pago_marcar_pagada', {
    p_item: args.itemId, p_fecha: args.fecha, p_cuenta: args.cuentaId, p_numero_operacion: args.numeroOperacion,
    p_voucher_path: args.voucherPath ?? null, p_notas: args.notas ?? null,
  });
export const excluirLinea = (itemId: string, motivo: string) => rpc<void>('lote_pago_excluir', { p_item: itemId, p_motivo: motivo });
export const fijarVoucher = (itemId: string, path: string) => rpc<void>('lote_pago_fijar_voucher', { p_item: itemId, p_path: path });

const BUCKET = 'vouchers-pagos';

/** Sube el voucher al bucket privado, en el folder del tenant. Devuelve la ruta. */
export async function subirVoucher(tenantId: string, loteNumero: string, itemId: string, archivo: File): Promise<string> {
  const ext = (archivo.name.split('.').pop() ?? 'pdf').toLowerCase();
  const path = `${tenantId}/${loteNumero}/${itemId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, { upsert: true, contentType: archivo.type || undefined });
  lanzar(error);
  return path;
}

export async function urlVoucher(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  lanzar(error);
  return data?.signedUrl ?? '';
}

/**
 * EXPORTAR PARA EL BANCO: el Excel que Shirley digita en BBVA, en el orden en
 * que lo hace: primero las cuentas BBVA (transferencia entre cuentas del mismo
 * banco), luego otros bancos por CCI; soles y dólares en hojas separadas; y una
 * hoja aparte con los depósitos de detracción al Banco de la Nación.
 */
export async function exportarParaBanco(lote: Lote, items: LoteItem[]): Promise<void> {
  const vivas = items.filter(i => i.estado !== 'excluida');
  const fila = (i: LoteItem) => ({
    n: i.orden,
    proveedor: i.proveedor ?? '',
    ruc: i.ruc ?? '',
    banco: i.banco ?? '',
    cuenta: i.cuenta ?? '',
    cci: i.cci ?? '',
    moneda: i.moneda,
    neto: i.neto,
    bruto: i.monto,
    detraccion: i.detraccionAplica ? i.detraccionMonto : 0,
    retencion: i.retencionMonto,
    concepto: i.concepto ?? '',
    documento: i.comprobanteNumero ?? i.referenciaDoc ?? '',
    proyecto: i.proyectoCodigo ?? i.cdc ?? '',
    estado: i.estado === 'pagada' ? `Pagada ${i.fechaPago ?? ''} op. ${i.numeroOperacion ?? ''}` : i.estado,
    alertas: i.alertas.join(' | '),
  });
  const headers = {
    n: '#', proveedor: 'Proveedor', ruc: 'RUC', banco: 'Banco', cuenta: 'Cuenta', cci: 'CCI', moneda: 'Moneda',
    neto: 'NETO A TRANSFERIR', bruto: 'Importe bruto', detraccion: 'Detracción', retencion: 'Retención',
    concepto: 'Concepto', documento: 'Factura / OC', proyecto: 'Proyecto / CDC', estado: 'Estado', alertas: 'Alertas',
  };
  const esBbva = (i: LoteItem) => (i.banco ?? '').toUpperCase().includes('BBVA');
  const ordenar = (xs: LoteItem[]) => [...xs].sort((a, b) => Number(esBbva(b)) - Number(esBbva(a)) || a.orden - b.orden);
  const hojas: { nombre: string; data: Record<string, any>[]; headersMap: Record<string, string> }[] = [];
  const pen = ordenar(vivas.filter(i => i.moneda === 'PEN'));
  const usd = ordenar(vivas.filter(i => i.moneda === 'USD'));
  if (pen.length) hojas.push({ nombre: 'Soles', data: pen.map(fila), headersMap: headers });
  if (usd.length) hojas.push({ nombre: 'Dólares', data: usd.map(fila), headersMap: headers });
  const det = vivas.filter(i => i.detraccionAplica && i.detraccionSoles > 0);
  if (det.length) {
    hojas.push({
      nombre: 'Detracciones BN',
      data: det.map(i => ({
        n: i.orden, proveedor: i.proveedor ?? '', ruc: i.ruc ?? '', cuenta_detraccion: i.cuentaDetraccion ?? 'SIN CUENTA DE DETRACCIÓN',
        codigo: i.detraccionCodigo ?? '', descripcion: i.detraccionDescripcion ?? '', tasa: i.detraccionTasa ?? 0,
        base: i.detraccionBase ?? i.monto, moneda: i.moneda, tc: i.tc, monto_soles: i.detraccionSoles,
        documento: i.comprobanteNumero ?? i.referenciaDoc ?? '',
      })),
      headersMap: {
        n: '#', proveedor: 'Proveedor', ruc: 'RUC', cuenta_detraccion: 'Cuenta detracciones BN', codigo: 'Código',
        descripcion: 'Bien / servicio', tasa: 'Tasa', base: 'Base (total comprobante)', moneda: 'Moneda', tc: 'TC', monto_soles: 'DEPÓSITO S/', documento: 'Factura',
      },
    });
  }
  hojas.push({
    nombre: 'Resumen',
    data: [
      { concepto: 'Lote', valor: lote.numero },
      { concepto: 'Estado', valor: ESTADO_LOTE[lote.estado].label },
      { concepto: 'Líneas', valor: vivas.length },
      { concepto: 'Neto a transferir S/', valor: lote.netoPen },
      { concepto: 'Neto a transferir US$', valor: lote.netoUsd },
      { concepto: 'Detracciones a depositar S/', valor: lote.detraccionSoles },
      { concepto: 'Retenciones S/', valor: lote.retencionPen },
      { concepto: 'Retenciones US$', valor: lote.retencionUsd },
      { concepto: 'Generado', valor: new Date().toLocaleString('es-PE') },
    ],
    headersMap: { concepto: 'Concepto', valor: 'Valor' },
  });
  await exportToExcelMultiHoja(`${lote.numero} pagos para el banco`, hojas);
}
