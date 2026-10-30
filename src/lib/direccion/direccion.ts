/**
 * Dirección — el ERP visto por los socios y Gerencia (Kevin, 29/10/2026): no operan módulos, ven tableros con
 * fecha de corte y rango de fechas, descargan lo que quieran analizar y firman lo que les toca.
 *
 * Todo sale de funciones SQL `security definer` (`direccion_resumen`, `direccion_detalle`, `direccion_por_firmar`)
 * porque las tablas de Finanzas tienen RLS por permiso y Gerencia no tiene Finanzas: el permiso que manda aquí es
 * `direccion.ver` (o Finanzas/Administración).
 */
import { supabase } from '../supabase/client';

export interface Monto { pen: number; usd: number }
export interface MontoN extends Monto { compromisos?: number; pagos?: number; cobros?: number; cantidad?: number; soles_equiv?: number; por_conformar?: number; sin_fecha_pen?: number; sin_fecha_usd?: number }

export interface Resumen {
  desde: string; hasta: string; corte: string; generado_en: string; tc_referencia: number | null;
  deuda: { hoy: MontoN; vencida_hoy: MontoN; al_corte: MontoN; por_pagar_rango: MontoN };
  /** Lo proyectado en el Excel de flujo (previsión, no deuda registrada). */
  proyectado: { pen: number; usd: number; compromisos: number; rango_pen: number; rango_usd: number };
  cobrar: { por_cobrar_rango: MontoN; por_cobrar_total: Monto };
  tesoreria: { pagado_rango: MontoN; cobrado_rango: MontoN };
  compras: { ordenes_rango: MontoN };
  facturas: { facturas_rango: MontoN };
  bancos: { cuenta: string; moneda: string; saldo_corte: number; extracto_hasta: string | null; saldo_inicial_fijado: boolean }[];
  cajas: { caja: string; moneda: string; disponible: number }[];
  serie: { mes: string; pagado_pen: number; pagado_usd: number; cobrado_pen: number; cobrado_usd: number; por_pagar_pen: number; por_pagar_usd: number; por_cobrar_pen: number }[];
  top_proyectos_pagado: { proyecto: string; nombre: string | null; soles: number; pen: number | null; usd: number | null; pagos: number }[];
  top_proveedores_pagado: { proveedor: string; soles: number; pen: number | null; usd: number | null; pagos: number }[];
  top_proveedores_deuda: { proveedor: string; pen: number; usd: number; compromisos: number; vence_primero: string | null }[];
  top_proyectos_deuda: { proyecto: string; nombre: string | null; pen: number; usd: number; compromisos: number }[];
}

export interface PorFirmar {
  ordenes: { id: string; numero: string; fecha: string; moneda: string; total: number; proveedor: string | null; proyecto: string | null; etapa: string }[];
  viajes: { id: string; numero: string; destino: string; fecha_salida: string; estado: string; solicitante: string | null; presupuesto: number | null }[];
  rendiciones: { id: string; numero: string; viaje_id: string; estado: string; gastado: number | null }[];
}

export type TipoDetalle = 'pagos' | 'cobros' | 'por_pagar' | 'por_cobrar' | 'deuda' | 'ordenes' | 'facturas';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const cargarResumen = (desde: string, hasta: string, corte: string) =>
  rpc<Resumen>('direccion_resumen', { p_desde: desde, p_hasta: hasta, p_corte: corte });
export const cargarDetalle = (tipo: TipoDetalle, desde: string, hasta: string, corte: string) =>
  rpc<Record<string, unknown>[]>('direccion_detalle', { p_tipo: tipo, p_desde: desde, p_hasta: hasta, p_corte: corte });
export const cargarPorFirmar = () => rpc<PorFirmar>('direccion_por_firmar', {});

// ── Rangos ─────────────────────────────────────────────────────────────────────
export type Preset = 'mes' | 'mes_anterior' | 'trimestre' | 'anio' | 'ultimos_12' | 'personalizado';
export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'mes', label: 'Este mes' }, { id: 'mes_anterior', label: 'Mes anterior' }, { id: 'trimestre', label: 'Este trimestre' },
  { id: 'anio', label: 'Este año' }, { id: 'ultimos_12', label: 'Últimos 12 meses' }, { id: 'personalizado', label: 'Fechas…' },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const hoyISO = () => iso(new Date());

export function rangoDe(preset: Preset, hoy = new Date()): { desde: string; hasta: string } {
  const y = hoy.getFullYear(); const m = hoy.getMonth();
  const fin = (yy: number, mm: number) => iso(new Date(Date.UTC(yy, mm + 1, 0)));
  const ini = (yy: number, mm: number) => iso(new Date(Date.UTC(yy, mm, 1)));
  switch (preset) {
    case 'mes': return { desde: ini(y, m), hasta: fin(y, m) };
    case 'mes_anterior': return { desde: ini(y, m - 1), hasta: fin(y, m - 1) };
    case 'trimestre': { const q = Math.floor(m / 3) * 3; return { desde: ini(y, q), hasta: fin(y, q + 2) }; }
    case 'anio': return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    case 'ultimos_12': return { desde: ini(y, m - 11), hasta: fin(y, m) };
    default: return { desde: ini(y, m), hasta: fin(y, m) };
  }
}

// ── Formato ────────────────────────────────────────────────────────────────────
export const soles = (n: number | null | undefined) => `S/ ${Math.round(n ?? 0).toLocaleString('es-PE')}`;
export const dolares = (n: number | null | undefined) => `US$ ${Math.round(n ?? 0).toLocaleString('es-PE')}`;
export const fechaCorta = (s: string | null | undefined) => s ? new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesLabel = (ym: string) => `${MES_ABR[Number(ym.slice(5, 7)) - 1]}-${ym.slice(2, 4)}`;

/** Encabezados para la descarga: la clave de cada columna, legible. */
export function encabezados(filas: Record<string, unknown>[]): Record<string, string> {
  const claves = filas.length ? Object.keys(filas[0]) : [];
  const h: Record<string, string> = {};
  for (const k of claves) h[k] = k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  return h;
}

export const ETIQUETA_DETALLE: Record<TipoDetalle, string> = {
  pagos: 'Pagos del rango', cobros: 'Cobros del rango', por_pagar: 'Por pagar en el rango', por_cobrar: 'Por cobrar en el rango',
  deuda: 'Deuda completa (todo lo pendiente)', ordenes: 'Órdenes de compra del rango', facturas: 'Facturas recibidas en el rango',
};

// ── OKRs ───────────────────────────────────────────────────────────────────────
export interface Objetivo { id: string; periodo: string; titulo: string; descripcion: string | null; responsable: string | null; estado: 'activo' | 'cerrado' | 'cancelado'; orden: number }
export interface ResultadoClave {
  id: string; objetivo_id: string; titulo: string; unidad: string; valor_inicial: number; meta: number; valor_actual: number;
  direccion: 'subir' | 'bajar'; fuente: string | null; notas: string | null; orden: number; actualizado_en: string;
  /** Calculados por la vista: valor (automático si hay fuente) y avance 0-100. */
  valor: number; avance_pct: number;
}
export const FUENTES_OKR: { id: string; label: string; unidad: string }[] = [
  { id: 'cxp_vencida_pen', label: 'Cuentas por pagar vencidas (S/)', unidad: 'S/' },
  { id: 'cxp_vencida_usd', label: 'Cuentas por pagar vencidas (US$)', unidad: 'US$' },
  { id: 'cxp_pendiente_pen', label: 'Deuda pendiente (S/)', unidad: 'S/' },
  { id: 'cxp_pendiente_usd', label: 'Deuda pendiente (US$)', unidad: 'US$' },
  { id: 'cobrado_anio_pen', label: 'Cobrado en el año (S/)', unidad: 'S/' },
  { id: 'pagado_anio_pen', label: 'Pagado en el año (S/)', unidad: 'S/' },
  { id: 'pagado_anio_usd', label: 'Pagado en el año (US$)', unidad: 'US$' },
  { id: 'facturas_por_conformar', label: 'Facturas por conformar', unidad: 'facturas' },
  { id: 'cartas_vencidas', label: 'Cartas al Estado vencidas', unidad: 'cartas' },
  { id: 'cartas_sin_plazo', label: 'Cartas al Estado sin plazo', unidad: 'cartas' },
  { id: 'proyectos_en_ejecucion', label: 'Proyectos en ejecución', unidad: 'proyectos' },
  { id: 'valorizaciones_por_cobrar', label: 'Valorizaciones por cobrar', unidad: 'valorizaciones' },
  { id: 'oc_en_aprobacion', label: 'Órdenes en aprobación', unidad: 'órdenes' },
  { id: 'bancos_sin_conciliar', label: 'Movimientos de banco sin conciliar', unidad: 'movimientos' },
];

export async function cargarOKRs(): Promise<{ objetivos: Objetivo[]; resultados: ResultadoClave[] }> {
  const [o, r] = await Promise.all([
    (supabase.from('okr_objetivos') as any).select('*').order('periodo', { ascending: false }).order('orden').order('creado_en'),
    (supabase.from('v_okr_resultados') as any).select('*').order('orden').order('actualizado_en'),
  ]);
  if (o.error) throw new Error(o.error.message);
  if (r.error) throw new Error(r.error.message);
  return { objetivos: (o.data ?? []) as Objetivo[], resultados: (r.data ?? []) as ResultadoClave[] };
}
export async function guardarObjetivo(tenantId: string, o: Partial<Objetivo> & { titulo: string; periodo: string }, userId?: string) {
  const fila = { tenant_id: tenantId, periodo: o.periodo, titulo: o.titulo, descripcion: o.descripcion ?? null, responsable: o.responsable ?? null, estado: o.estado ?? 'activo', orden: o.orden ?? 0, actualizado_en: new Date().toISOString(), ...(o.id ? {} : { creado_por: userId ?? null }) };
  const q = o.id ? (supabase.from('okr_objetivos') as any).update(fila).eq('id', o.id) : (supabase.from('okr_objetivos') as any).insert(fila);
  const { error } = await q; if (error) throw new Error(error.message);
}
export async function guardarResultado(tenantId: string, r: Partial<ResultadoClave> & { objetivo_id: string; titulo: string; meta: number }, userId?: string) {
  const fila = { tenant_id: tenantId, objetivo_id: r.objetivo_id, titulo: r.titulo, unidad: r.unidad ?? 'S/', valor_inicial: r.valor_inicial ?? 0, meta: r.meta,
    valor_actual: r.valor_actual ?? 0, direccion: r.direccion ?? 'subir', fuente: r.fuente || null, notas: r.notas ?? null, orden: r.orden ?? 0, actualizado_por: userId ?? null, actualizado_en: new Date().toISOString() };
  const q = r.id ? (supabase.from('okr_resultados') as any).update(fila).eq('id', r.id) : (supabase.from('okr_resultados') as any).insert(fila);
  const { error } = await q; if (error) throw new Error(error.message);
}
export async function eliminarObjetivo(id: string) { const { error } = await (supabase.from('okr_objetivos') as any).delete().eq('id', id); if (error) throw new Error(error.message); }
export async function eliminarResultado(id: string) { const { error } = await (supabase.from('okr_resultados') as any).delete().eq('id', id); if (error) throw new Error(error.message); }
