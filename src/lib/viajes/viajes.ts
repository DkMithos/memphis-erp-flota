/**
 * VIAJES, PASAJES Y VIÁTICOS (sprint 5, #9).
 *
 * Flujo (Kevin, 16/10/2026): personal solicita → jefatura aprueba → Carolina da la
 * última aprobación. Rendición: personal rinde → jefatura revisa → Carolina aprueba
 * (reembolso o devolución según saldo). La lógica vive en SQL (`viaje_solicitar`,
 * `viaje_aprobar`, `rendicion_*`); aquí solo tipos, lecturas y llamadas.
 * Lo usan la pantalla del ERP (`/viajes`) y la app móvil (`/app`).
 */
import { supabase } from '../supabase/client';

export type EstadoViaje = 'solicitado' | 'aprobado_jefatura' | 'aprobado' | 'rechazado' | 'en_curso' | 'rendido' | 'cerrado' | 'anulado';
export type EstadoRendicion = 'borrador' | 'presentada' | 'observada' | 'revisada_jefatura' | 'aprobada' | 'liquidada';
export type TipoGasto = 'alimentacion' | 'hospedaje' | 'movilidad' | 'peaje' | 'pasaje' | 'otro';
export type TipoComprobante = 'factura' | 'boleta' | 'recibo' | 'ticket' | 'sin_comprobante' | 'otro';

export const ESTADO_VIAJE: Record<EstadoViaje, { label: string; corto: string; clase: string }> = {
  solicitado:        { label: 'Solicitado · espera jefatura', corto: 'Solicitado', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  aprobado_jefatura: { label: 'Aprobado por jefatura · espera Administración', corto: 'Jefatura OK', clase: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  aprobado:          { label: 'Aprobado', corto: 'Aprobado', clase: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  en_curso:          { label: 'En curso (con adelanto)', corto: 'En curso', clase: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200' },
  rendido:           { label: 'Rendición presentada', corto: 'Rendido', clase: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200' },
  cerrado:           { label: 'Cerrado', corto: 'Cerrado', clase: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' },
  rechazado:         { label: 'Rechazado', corto: 'Rechazado', clase: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  anulado:           { label: 'Anulado', corto: 'Anulado', clase: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};
export const ESTADO_RENDICION: Record<EstadoRendicion, { label: string; clase: string }> = {
  borrador:          { label: 'Borrador', clase: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' },
  presentada:        { label: 'Presentada · espera jefatura', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  observada:         { label: 'Observada · corregir', clase: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  revisada_jefatura: { label: 'Revisada por jefatura · espera Administración', clase: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  aprobada:          { label: 'Aprobada · por liquidar', clase: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  liquidada:         { label: 'Liquidada', clase: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' },
};
export const TIPO_GASTO: Record<TipoGasto, string> = { alimentacion: 'Alimentación', hospedaje: 'Hospedaje', movilidad: 'Movilidad', peaje: 'Peaje', pasaje: 'Pasaje', otro: 'Otro' };
export const TIPO_COMPROBANTE: Record<TipoComprobante, string> = { factura: 'Factura', boleta: 'Boleta', recibo: 'Recibo', ticket: 'Ticket', sin_comprobante: 'Sin comprobante', otro: 'Otro' };
export const RESULTADO: Record<string, string> = { empresa_reembolsa: 'La empresa reembolsa', trabajador_devuelve: 'El trabajador devuelve', cuadra: 'Cuadra con el adelanto' };

export interface Viaje {
  id: string; numero: string; proyecto_id: string | null; centro_costo_id: string | null; motivo: string; origen: string; destino: string;
  fecha_salida: string; fecha_retorno: string; hora_salida: string | null; hora_retorno: string | null; medio_sugerido: string | null;
  requiere_pasajes: boolean; requiere_viaticos: boolean; con_hospedaje: boolean; estado: EstadoViaje;
  solicitado_por: string; solicitado_en: string;
  aprobado_jefatura_por: string | null; aprobado_jefatura_en: string | null; comentario_jefatura: string | null;
  aprobado_por: string | null; aprobado_en: string | null; comentario_aprobacion: string | null;
  rechazado_por: string | null; rechazado_en: string | null; motivo_rechazo: string | null;
  cerrado_en: string | null; presupuesto_viaticos: number; tope_excedido: boolean; justificacion_tope: string | null; observaciones: string | null; origen_datos: string;
  proyecto_codigo: string | null; proyecto_nombre: string | null; cdc: string | null; solicitante: string | null; jefatura_nombre: string | null; aprobador_nombre: string | null;
  viajeros: number; viajeros_nombres: string | null; adelantos: number; reservas_soles: number; reservas_pagadas_soles: number; rendido: number; saldo_rendiciones: number;
  rendiciones_por_revisar: number; rendiciones_por_liquidar: number;
}
export interface Pasajero {
  id: string; viaje_id: string; user_id: string | null; nombre: string; dni: string | null; cargo: string | null; es_externo: boolean; dias: number; con_hospedaje: boolean;
  tarifa_diaria: number; viatico_calculado: number; viatico_solicitado: number; viatico_aprobado: number | null; cuenta_abono: string | null;
  adelanto_entregado: number; adelanto_fecha: string | null; adelanto_medio: string | null; adelanto_referencia: string | null; notas: string | null;
}
export interface Reserva {
  id: string; viaje_id: string; pasajero_id: string | null; codigo_reserva: string | null; tipo: 'aereo' | 'terrestre' | 'hospedaje' | 'otro'; proveedor_id: string | null; empresa: string | null;
  tramo: 'ida' | 'vuelta' | 'multitramo' | null; origen: string | null; destino: string | null; fecha_salida: string | null; hora_salida: string | null; fecha_llegada: string | null; hora_llegada: string | null;
  moneda: string; costo: number; tc: number | null; costo_soles: number; pago: 'transferencia' | 'tarjeta' | 'efectivo' | 'pendiente'; origen_pago: string | null;
  estado_pago: 'pendiente' | 'pagado'; fecha_pago: string | null; comprobante_id: string | null; observaciones: string | null;
}
export interface Rendicion {
  id: string; viaje_id: string; pasajero_id: string; numero: string; fecha: string; estado: EstadoRendicion; entregado: number; gastado: number; saldo: number;
  resultado: 'empresa_reembolsa' | 'trabajador_devuelve' | 'cuadra' | null; tope_excedido: boolean; justificacion: string | null; presentada_en: string | null;
  revisada_por: string | null; revisada_en: string | null; comentario_jefatura: string | null; aprobada_por: string | null; aprobada_en: string | null; comentario_aprobacion: string | null;
  observacion: string | null; liquidada_en: string | null; liquidacion_medio: string | null; liquidacion_referencia: string | null; notas: string | null;
  viajero: string; viajero_user_id: string | null; viatico_aprobado: number | null; adelanto_entregado: number; viaje_numero: string; destino: string; fecha_salida: string; fecha_retorno: string;
  proyecto_id: string | null; proyecto_codigo: string | null; viaje_estado: EstadoViaje; items: number; items_sin_sustento: number;
}
export interface RendicionItem {
  id?: string; fecha: string; tipo_gasto: TipoGasto; descripcion: string | null; comprobante_tipo: TipoComprobante; comprobante_numero: string | null; ruc: string | null;
  proveedor_nombre: string | null; moneda: string; monto: number; tc: number | null; monto_soles?: number; sustentado: boolean; foto_path: string | null; aceptado?: boolean; observacion?: string | null;
}
export interface Tarifa { id: string; concepto: string; descripcion: string; monto: number; moneda: string; unidad: string; requiere_sustento: boolean; vigente_desde: string; vigente_hasta: string | null; activo: boolean; notas: string | null }

const PAGE = 1000;
async function todo<T>(q: (d: number, h: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let d = 0; ; d += PAGE) {
    const { data, error } = await q(d, d + PAGE - 1);
    if (error) throw error;
    const lote = (data ?? []) as T[]; out.push(...lote);
    if (lote.length < PAGE) break;
  }
  return out;
}

export const cargarViajes = () => todo<Viaje>((d, h) => supabase.from('v_viajes').select('*').order('fecha_salida', { ascending: false }).range(d, h));
export async function cargarViaje(id: string): Promise<Viaje | null> {
  const { data, error } = await supabase.from('v_viajes').select('*').eq('id', id).maybeSingle();
  if (error) throw error; return (data ?? null) as Viaje | null;
}
export async function cargarPasajeros(viajeId: string): Promise<Pasajero[]> {
  const { data, error } = await supabase.from('viaje_pasajeros').select('*').eq('viaje_id', viajeId).order('creado_en');
  if (error) throw error; return (data ?? []) as Pasajero[];
}
export async function cargarReservas(viajeId: string): Promise<Reserva[]> {
  const { data, error } = await supabase.from('viaje_reservas').select('*').eq('viaje_id', viajeId).order('fecha_salida').order('creado_en');
  if (error) throw error; return (data ?? []) as Reserva[];
}
export async function cargarRendiciones(viajeId?: string): Promise<Rendicion[]> {
  let q = supabase.from('v_viaje_rendiciones').select('*').order('fecha', { ascending: false });
  if (viajeId) q = q.eq('viaje_id', viajeId);
  const { data, error } = await q.range(0, 999);
  if (error) throw error; return (data ?? []) as Rendicion[];
}
export async function cargarItemsRendicion(rendicionId: string): Promise<RendicionItem[]> {
  const { data, error } = await supabase.from('viaje_rendicion_items').select('*').eq('rendicion_id', rendicionId).order('fecha').order('creado_en');
  if (error) throw error; return (data ?? []) as RendicionItem[];
}
export async function cargarTarifas(): Promise<Tarifa[]> {
  const { data, error } = await supabase.from('viaticos_tarifas').select('*').order('concepto').order('vigente_desde', { ascending: false });
  if (error) throw error; return (data ?? []) as Tarifa[];
}
export function tarifaVigente(tarifas: Tarifa[], concepto: string, fecha = new Date().toISOString().slice(0, 10)): number {
  const t = tarifas.filter(x => x.concepto === concepto && x.activo && x.vigente_desde <= fecha && (!x.vigente_hasta || x.vigente_hasta >= fecha))
    .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0];
  return t ? Number(t.monto) : 0;
}

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message ?? String(error));
  return data as T;
};

export interface PasajeroInput { user_id?: string | null; nombre: string; dni?: string; cargo?: string; es_externo?: boolean; dias?: number; con_hospedaje?: boolean; viatico_solicitado?: number | null; cuenta_abono?: string; notas?: string }
export interface SolicitudViaje {
  proyecto_id?: string | null; centro_costo_id?: string | null; motivo: string; origen?: string; destino: string; fecha_salida: string; fecha_retorno: string;
  hora_salida?: string; hora_retorno?: string; medio_sugerido?: string; requiere_pasajes?: boolean; requiere_viaticos?: boolean; con_hospedaje?: boolean;
  justificacion_tope?: string; observaciones?: string; origen_datos?: 'erp' | 'app'; pasajeros: PasajeroInput[];
}
export const solicitarViaje = (p: SolicitudViaje) => rpc<{ id: string; numero: string; presupuesto_viaticos: number; tope_excedido: boolean }>('viaje_solicitar', { p });
export const aprobarViaje = (id: string, comentario?: string) => rpc<{ estado: EstadoViaje }>('viaje_aprobar', { p_viaje: id, p_comentario: comentario ?? null });
export const rechazarViaje = (id: string, motivo: string) => rpc<void>('viaje_rechazar', { p_viaje: id, p_motivo: motivo });
export const anularViaje = (id: string, motivo?: string) => rpc<void>('viaje_anular', { p_viaje: id, p_motivo: motivo ?? null });
export const cerrarViaje = (id: string, notas?: string) => rpc<void>('viaje_cerrar', { p_viaje: id, p_notas: notas ?? null });
export const registrarAdelanto = (pasajeroId: string, monto: number, fecha: string, medio?: string, referencia?: string) =>
  rpc<void>('viaje_registrar_adelanto', { p_pasajero: pasajeroId, p_monto: monto, p_fecha: fecha, p_medio: medio ?? null, p_referencia: referencia ?? null });
export const guardarRendicion = (p: { viaje_id: string; pasajero_id: string; fecha?: string; notas?: string; items: RendicionItem[] }) =>
  rpc<{ id: string; gastado: number; entregado: number; saldo: number }>('rendicion_guardar', { p });
export const presentarRendicion = (id: string, justificacion?: string) => rpc<{ estado: EstadoRendicion; resultado: string; saldo: number; tope_excedido: boolean }>('rendicion_presentar', { p_rendicion: id, p_justificacion: justificacion ?? null });
export const revisarRendicion = (id: string, ok: boolean, comentario?: string) => rpc<{ estado: EstadoRendicion }>('rendicion_revisar', { p_rendicion: id, p_ok: ok, p_comentario: comentario ?? null });
export const aprobarRendicion = (id: string, ok: boolean, comentario?: string) => rpc<{ estado: EstadoRendicion; resultado?: string; saldo?: number }>('rendicion_aprobar', { p_rendicion: id, p_ok: ok, p_comentario: comentario ?? null });
export const liquidarRendicion = (id: string, medio: string, referencia?: string, fecha?: string) =>
  rpc<void>('rendicion_liquidar', { p_rendicion: id, p_medio: medio, p_referencia: referencia ?? null, p_fecha: fecha ?? new Date().toISOString().slice(0, 10) });

/** Reservas y tarifas se editan directo (RLS: viajes.editar / viajes.tarifas). */
export async function guardarReserva(r: Partial<Reserva> & { viaje_id: string; tenant_id?: string }): Promise<void> {
  const { id, costo_soles: _cs, ...resto } = r as Reserva & { tenant_id?: string };
  void _cs;
  if (id) { const { error } = await supabase.from('viaje_reservas').update(resto as never).eq('id', id); if (error) throw error; }
  else { const { error } = await supabase.from('viaje_reservas').insert(resto as never); if (error) throw error; }
}
export async function borrarReserva(id: string): Promise<void> { const { error } = await supabase.from('viaje_reservas').delete().eq('id', id); if (error) throw error; }
export async function guardarTarifa(t: Partial<Tarifa> & { tenant_id?: string }): Promise<void> {
  const { id, ...resto } = t;
  if (id) { const { error } = await supabase.from('viaticos_tarifas').update(resto as never).eq('id', id); if (error) throw error; }
  else { const { error } = await supabase.from('viaticos_tarifas').insert(resto as never); if (error) throw error; }
}

/** Foto del comprobante desde el celular → bucket privado `viajes-sustentos` (carpeta = tenant). */
export async function subirSustento(tenantId: string, viajeId: string, archivo: File | Blob, nombre?: string): Promise<string> {
  const ext = (nombre ?? (archivo as File).name ?? 'jpg').split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${tenantId}/${viajeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('viajes-sustentos').upload(path, archivo, { contentType: (archivo as File).type || 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
export async function urlSustento(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('viajes-sustentos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export const soles = (n: number | null | undefined) => `S/ ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
export const diasEntre = (a: string, b: string) => Math.max(1, Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000) + 1);
/** Pendientes de aprobación para quien tiene el permiso: lo que la app muestra en "Por aprobar". */
export function pendientesDe(viajes: Viaje[], rendiciones: Rendicion[], puedeJefatura: boolean, puedeFinal: boolean) {
  return {
    viajes: viajes.filter(v => (puedeJefatura && v.estado === 'solicitado') || (puedeFinal && v.estado === 'aprobado_jefatura')),
    rendiciones: rendiciones.filter(r => (puedeJefatura && r.estado === 'presentada') || (puedeFinal && r.estado === 'revisada_jefatura')),
  };
}
