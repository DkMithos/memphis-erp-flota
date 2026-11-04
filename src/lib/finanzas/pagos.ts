/**
 * Registrar pagos (uno o muchos) con comprobante adjunto — Kevin, 04/11/2026.
 *
 * Un solo camino para "esto ya se pagó": se eligen facturas o compromisos (órdenes de no domiciliados, obligaciones),
 * se pone fecha, cuenta, referencia y el voucher, y `pagos_registrar` crea una transacción por cada uno, cierra el
 * compromiso y la factura, y deja el comprobante enlazado. Se usa desde Facturas de proveedores y Cuentas por pagar.
 */
import { supabase } from '../supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BUCKET = 'vouchers-pagos';
const MAX_MB = 10;
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export interface ItemPago {
  compromisoId?: string;
  comprobanteId?: string;
  etiqueta: string;
  detalle?: string;
  moneda: string;
  monto: number;
}
export interface ResultadoPagos { pagados: number; transacciones: string[]; omitidos: { id: string; motivo: string }[] }
export interface CuentaBreve { id: string; nombre: string; moneda: string }
export interface PagoDeFactura { id: string; numero: string; fecha: string; monto: number; moneda: string; referencia: string | null; cuenta: string | null; comprobante_url: string | null; estado: string }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const cargarCuentasBreve = () => rpc<CuentaBreve[]>('cuentas_bancarias_breve', {});
export const cargarPagosDeFactura = (comprobanteId: string) => rpc<PagoDeFactura[]>('factura_pagos', { p_comprobante: comprobanteId });
export const adjuntarComprobante = (transaccionId: string, path: string) => rpc<void>('pago_adjuntar_comprobante', { p_transaccion: transaccionId, p_path: path });

export function registrarPagos(args: { items: ItemPago[]; fecha: string; cuentaId: string | null; referencia: string | null; voucherPath: string | null }) {
  return rpc<ResultadoPagos>('pagos_registrar', {
    p_compromisos: args.items.map(i => i.compromisoId).filter(Boolean),
    p_comprobantes: args.items.filter(i => !i.compromisoId).map(i => i.comprobanteId).filter(Boolean),
    p_fecha: args.fecha, p_cuenta: args.cuentaId, p_referencia: args.referencia || null, p_voucher_path: args.voucherPath,
  });
}

export function validarComprobante(archivo: File): string | null {
  if (!TIPOS.includes(archivo.type)) return 'El comprobante debe ser PDF, JPG, PNG o WebP';
  if (archivo.size > MAX_MB * 1024 * 1024) return `El archivo pesa más de ${MAX_MB} MB`;
  return null;
}

/** Sube el voucher al bucket privado, en la carpeta del tenant. Devuelve la ruta (se guarda en `transacciones.comprobante_url`). */
export async function subirComprobantePago(tenantId: string, archivo: File): Promise<string> {
  const err = validarComprobante(archivo); if (err) throw new Error(err);
  const ext = (archivo.name.split('.').pop() ?? 'pdf').toLowerCase();
  const mes = new Date().toISOString().slice(0, 7);
  const path = `${tenantId}/pagos/${mes}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, { upsert: false, contentType: archivo.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

/** `comprobante_url` puede ser un enlace externo (campo viejo) o una ruta del bucket. */
export const esRutaStorage = (v: string) => !/^https?:\/\//i.test(v);
export async function urlComprobante(v: string): Promise<string> {
  if (!esRutaStorage(v)) return v;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(v, 600);
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? '';
}
export async function abrirComprobante(v: string): Promise<void> {
  const u = await urlComprobante(v);
  if (u) window.open(u, '_blank', 'noopener');
}
