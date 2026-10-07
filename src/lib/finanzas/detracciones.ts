/**
 * DETRACCIONES — lecturas, archivo del Banco de la Nación y constancias de SUNAT.
 *
 * El archivo de pago masivo lo arma la base (`detraccion_lote_generar`): aquí
 * solo se descarga. La consulta de constancias que SUNAT entrega (CSV con `;`
 * o Excel) se lee en el navegador y se manda como JSON a
 * `detracciones_importar_constancias`, que cierra las pendientes.
 */
import { supabase } from '../supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;
const lanzar = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const num = (v: unknown) => Number(v ?? 0);

export type EstadoDetraccion = 'pendiente' | 'depositado' | 'liberado';

export interface Detraccion {
  id: string;
  estado: EstadoDetraccion;
  origen: 'erp' | 'sunat' | string;
  proveedor: string | null;
  rucProveedor: string | null;
  cuentaDetraccion: string | null;
  codigo: string | null;
  bienServicio: string | null;
  tasa: number | null;
  base: number | null;
  monto: number;
  monedaOrigen: string | null;
  tipoCambio: number | null;
  periodo: string | null;
  tipoComprobante: string | null;
  serie: string | null;
  numero: string | null;
  comprobanteNumero: string | null;
  comprobanteTotal: number | null;
  fechaPagoProveedor: string | null;
  vence: string | null;
  vencida: boolean;
  fechaDeposito: string | null;
  numeroConstancia: string | null;
  lotePagoNumero: string | null;
  loteBnId: string | null;
  archivoBn: string | null;
  archivoGeneradoEn: string | null;
  observaciones: string | null;
  creadoEn: string;
}

export interface LoteBn {
  id: string; anio: number; secuencia: number; nombreArchivo: string; cantidad: number; totalSoles: number;
  generadoEn: string; anuladoEn: string | null;
}

function mapDet(r: Record<string, any>): Detraccion {
  return {
    id: r.id, estado: r.estado, origen: r.origen ?? 'erp',
    proveedor: r.proveedor ?? r.razon_social ?? null, rucProveedor: r.ruc_proveedor ?? null, cuentaDetraccion: r.cuenta_detraccion ?? null,
    codigo: r.codigo_bien_servicio ?? null, bienServicio: r.bien_servicio ?? r.descripcion_bien_servicio ?? null,
    tasa: r.tasa == null ? null : num(r.tasa), base: r.base_detraccion == null ? null : num(r.base_detraccion),
    monto: num(r.monto_detraccion), monedaOrigen: r.moneda_origen ?? null, tipoCambio: r.tipo_cambio == null ? null : num(r.tipo_cambio),
    periodo: r.periodo ?? null, tipoComprobante: r.tipo_comprobante ?? null, serie: r.serie ?? null, numero: r.numero ?? null,
    comprobanteNumero: r.comprobante_numero ?? null, comprobanteTotal: r.comprobante_total == null ? null : num(r.comprobante_total),
    fechaPagoProveedor: r.fecha_pago_proveedor ?? null, vence: r.vence ?? null, vencida: Boolean(r.vencida),
    fechaDeposito: r.fecha_deposito ?? null, numeroConstancia: r.numero_constancia ?? null,
    lotePagoNumero: r.lote_pago_numero ?? null, loteBnId: r.lote_bn_id ?? null, archivoBn: r.archivo_bn ?? null,
    archivoGeneradoEn: r.archivo_generado_en ?? null, observaciones: r.observaciones ?? null, creadoEn: r.creado_en,
  };
}

export async function cargarDetracciones(): Promise<Detraccion[]> {
  const { data, error } = await db.from('v_detracciones').select('*').order('creado_en', { ascending: false }).limit(2000);
  lanzar(error);
  return (data ?? []).map(mapDet);
}

export async function cargarLotesBn(): Promise<LoteBn[]> {
  const { data, error } = await db.from('detraccion_lotes').select('id, anio, secuencia, nombre_archivo, cantidad, total_soles, generado_en, anulado_en').order('generado_en', { ascending: false }).limit(100);
  lanzar(error);
  return (data ?? []).map((r: Record<string, any>) => ({
    id: r.id, anio: num(r.anio), secuencia: num(r.secuencia), nombreArchivo: r.nombre_archivo, cantidad: num(r.cantidad),
    totalSoles: num(r.total_soles), generadoEn: r.generado_en, anuladoEn: r.anulado_en ?? null,
  }));
}

export async function contenidoLoteBn(id: string): Promise<{ nombre: string; contenido: string }> {
  const { data, error } = await db.from('detraccion_lotes').select('nombre_archivo, contenido').eq('id', id).single();
  lanzar(error);
  return { nombre: data.nombre_archivo, contenido: data.contenido };
}

/** Genera el archivo en la base y lo descarga. Devuelve nombre y totales. */
export async function generarArchivoBn(ids: string[]): Promise<{ loteId: string; nombre: string; cantidad: number; total: number }> {
  const { data, error } = await db.rpc('detraccion_lote_generar', { p_ids: ids });
  lanzar(error);
  const fila = Array.isArray(data) ? data[0] : data;
  descargarTxt(fila.nombre_archivo, fila.contenido);
  return { loteId: fila.lote_id, nombre: fila.nombre_archivo, cantidad: num(fila.cantidad), total: num(fila.total_soles) };
}

export async function anularLoteBn(id: string): Promise<void> {
  const { error } = await db.rpc('detraccion_lote_anular', { p_lote: id });
  lanzar(error);
}

/** El BN espera texto plano ANSI con fin de línea CRLF: se baja tal cual lo armó la base. */
export function descargarTxt(nombre: string, contenido: string): void {
  const blob = new Blob([contenido], { type: 'text/plain;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface FilaConstancia {
  constancia: string; periodo: string; ruc: string; proveedor: string; fecha: string; monto: string;
  tipo_bien: string; tipo_cp: string; serie: string; numero: string; cuenta: string;
}

/**
 * Lee la consulta de constancias de SUNAT. Acepta el CSV (separado por `;`,
 * cabecera "Tipo de Cuenta;Numero de Cuenta;Numero Constancia;…") y el Excel
 * que Contabilidad guarda con las mismas columnas. Las columnas se ubican por
 * nombre, no por posición.
 */
export async function leerConstancias(archivo: File): Promise<FilaConstancia[]> {
  let filas: string[][];
  if (/\.xlsx?$/i.test(archivo.name)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    filas = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' }) as unknown[][]).map(r => r.map(c => (c == null ? '' : String(c))));
  } else {
    const texto = await archivo.text();
    const sep = texto.split('\n')[0].includes(';') ? ';' : ',';
    filas = texto.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
  }
  if (filas.length < 2) return [];
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const hdr = filas[0].map(norm);
  const col = (...nombres: string[]) => { for (const n of nombres) { const i = hdr.findIndex(h => h.includes(norm(n))); if (i >= 0) return i; } return -1; };
  const iConst = col('numeroconstancia', 'constancia');
  const iPer = col('periodotributario', 'periodo');
  const iRuc = col('rucproveedor');
  const iProv = col('nombreproveedor');
  const iFecha = col('fechapago');
  const iMonto = col('montodeposito', 'monto');
  const iBien = col('tipobien');
  const iTipoCp = col('tipodecomprobante');
  const iSerie = col('seriedecomprobante', 'serie');
  const iNum = col('numerodecomprobante');
  const iCta = col('numerodecuenta');
  if (iConst < 0 || iRuc < 0 || iMonto < 0) throw new Error('No reconozco las columnas: se esperan "Numero Constancia", "RUC Proveedor" y "Monto Deposito" (consulta de constancias de SUNAT).');
  const g = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return filas.slice(1).filter(r => g(r, iConst) && g(r, iRuc)).map(r => ({
    constancia: g(r, iConst), periodo: g(r, iPer), ruc: g(r, iRuc), proveedor: g(r, iProv), fecha: g(r, iFecha), monto: g(r, iMonto),
    tipo_bien: g(r, iBien), tipo_cp: g(r, iTipoCp), serie: g(r, iSerie), numero: g(r, iNum), cuenta: g(r, iCta),
  }));
}

export async function importarConstancias(filas: FilaConstancia[]): Promise<{ cerradas: number; nuevas: number; yaRegistradas: number; saltadas: number; nuevasSinComprobante: number }> {
  const { data, error } = await db.rpc('detracciones_importar_constancias', { p_filas: filas });
  lanzar(error);
  return { cerradas: num(data?.cerradas), nuevas: num(data?.nuevas), yaRegistradas: num(data?.ya_registradas), saltadas: num(data?.saltadas), nuevasSinComprobante: num(data?.nuevas_sin_comprobante) };
}

export async function editarDetraccion(id: string, campos: { cuenta_detraccion?: string | null; codigo_bien_servicio?: string | null; serie?: string | null; numero?: string | null; periodo?: string | null; observaciones?: string | null }): Promise<void> {
  const { error } = await db.from('detracciones').update(campos).eq('id', id);
  lanzar(error);
}

export const soles0 = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
export const soles2 = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
