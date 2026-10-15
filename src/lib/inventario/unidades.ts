/**
 * UNIDADES CON NÚMERO DE SERIE (sprint 5, #11 del plan de carga).
 *
 * El kardex sigue mandando en cantidades; aquí vive la trazabilidad por serie:
 * una fila por unidad (bodycam, tablet, arnés…) con su estado y dónde está
 * (almacén, vehículo de Flota, proyecto, devuelta al proveedor). La lógica de
 * negocio está en SQL: `inventario_unidades_alta` y `inventario_unidades_mover`.
 */
import { supabase } from '../supabase/client';

export type EstadoUnidad = 'en_almacen' | 'instalada' | 'entregada' | 'devuelta' | 'en_reparacion' | 'baja';

export const ESTADO_UNIDAD: Record<EstadoUnidad, { label: string; clase: string; tipoMov: string }> = {
  en_almacen:    { label: 'En almacén',    clase: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100', tipoMov: 'retorno' },
  instalada:     { label: 'Instalada',     clase: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200', tipoMov: 'instalacion' },
  entregada:     { label: 'Entregada',     clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', tipoMov: 'entrega' },
  devuelta:      { label: 'Devuelta',      clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', tipoMov: 'devolucion' },
  en_reparacion: { label: 'En reparación', clase: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200', tipoMov: 'reparacion' },
  baja:          { label: 'Baja',          clase: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', tipoMov: 'baja' },
};
export const ESTADOS_UNIDAD = Object.keys(ESTADO_UNIDAD) as EstadoUnidad[];

export interface Unidad {
  id: string; articulo_id: string; articulo_codigo: string; articulo: string; marca: string | null; modelo: string | null;
  serie: string | null; lote: string | null; estado: EstadoUnidad;
  almacen_id: string | null; almacen: string | null;
  proyecto_id: string | null; proyecto_codigo: string | null; proyecto: string | null;
  vehiculo_id: string | null; vehiculo_codigo: string | null; vehiculo_placa: string | null;
  proveedor_id: string | null; proveedor: string | null;
  comprobante_id: string | null; factura: string | null; orden_compra_id: string | null; orden_compra: string | null;
  valor_usd: number | null; valor_soles: number | null; tipo_cambio: number | null;
  fecha_ingreso: string; fecha_salida: string | null; documento_salida: string | null;
  observaciones: string | null; origen: string | null; creado_en: string; actualizado_en: string;
}

export interface ResumenArticulo {
  articulo_id: string; articulo_codigo: string; articulo: string; marca: string | null; modelo: string | null;
  unidades: number; en_almacen: number; instaladas: number; entregadas: number; devueltas: number; en_reparacion: number; bajas: number;
  sin_serie: number; stock_kardex: number; diferencia: number;
}

export interface MovimientoUnidad {
  id: string; unidad_id: string; fecha: string; tipo: string; estado_anterior: string | null; estado_nuevo: string | null;
  de: string | null; a: string | null; documento: string | null; notas: string | null; usuario: string | null;
}

/**
 * Series pegadas de un Excel o escritas a mano: una por línea, o separadas por
 * coma / punto y coma / tabulador. Se limpian, pasan a mayúsculas y se quitan
 * las repetidas y los "NA" (el Excel de La Sirena los usa para "sin serie").
 */
export function parsearSeries(texto: string): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const cruda of (texto ?? '').split(/[\n\r,;\t]+/)) {
    const s = cruda.trim().toUpperCase();
    if (!s || s === 'NA' || s === 'N/A' || s === 'S/N') continue;
    if (vistas.has(s)) continue;
    vistas.add(s); out.push(s);
  }
  return out;
}

const PAGE = 1000;
async function todo<T>(construir: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await construir(desde, desde + PAGE - 1);
    if (error) throw error;
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < PAGE) break;
  }
  return filas;
}

export function cargarUnidades(): Promise<Unidad[]> {
  return todo<Unidad>((d, h) => supabase.from('v_inventario_unidades').select('*').order('articulo').order('serie', { nullsFirst: false }).range(d, h));
}

export async function cargarUnidadesDeVehiculo(vehiculoDbId: string): Promise<Unidad[]> {
  const { data, error } = await supabase.from('v_inventario_unidades').select('*').eq('vehiculo_id', vehiculoDbId).order('articulo').order('serie');
  if (error) throw error;
  return (data ?? []) as Unidad[];
}

export async function cargarUnidadesDeProyecto(proyectoDbId: string): Promise<Unidad[]> {
  const { data, error } = await supabase.from('v_inventario_unidades').select('*').eq('proyecto_id', proyectoDbId).order('articulo').order('serie');
  if (error) throw error;
  return (data ?? []) as Unidad[];
}

export async function cargarResumenUnidades(): Promise<ResumenArticulo[]> {
  const { data, error } = await supabase.from('v_unidades_por_articulo').select('*').order('articulo');
  if (error) throw error;
  return (data ?? []) as ResumenArticulo[];
}

export async function cargarHistorialUnidad(unidadId: string): Promise<MovimientoUnidad[]> {
  const { data, error } = await supabase.from('inventario_unidades_mov').select('*').eq('unidad_id', unidadId).order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MovimientoUnidad[];
}

export interface AltaUnidadesInput {
  articuloId: string; series: string[]; sinSerie?: number;
  almacenId?: string | null; proyectoId?: string | null; proveedorId?: string | null;
  comprobanteId?: string | null; ordenCompraId?: string | null;
  valorUsd?: number | null; valorSoles?: number | null; tc?: number | null;
  fecha?: string; lote?: string; documento?: string; notas?: string; kardex?: boolean;
}
export async function altaUnidades(i: AltaUnidadesInput): Promise<{ creadas: number; repetidas: string[]; movimiento_kardex: string | null }> {
  const { data, error } = await (supabase as any).rpc('inventario_unidades_alta', {
    p_articulo: i.articuloId, p_series: i.series, p_sin_serie: i.sinSerie ?? 0,
    p_almacen: i.almacenId ?? null, p_proyecto: i.proyectoId ?? null, p_proveedor: i.proveedorId ?? null,
    p_comprobante: i.comprobanteId ?? null, p_orden_compra: i.ordenCompraId ?? null,
    p_valor_usd: i.valorUsd ?? null, p_valor_soles: i.valorSoles ?? null, p_tc: i.tc ?? null,
    p_fecha: i.fecha ?? new Date().toISOString().slice(0, 10), p_lote: i.lote ?? null, p_documento: i.documento ?? null,
    p_notas: i.notas ?? null, p_kardex: i.kardex ?? true, p_origen: 'manual',
  });
  if (error) throw error;
  return data;
}

export interface MoverUnidadesInput {
  ids: string[]; estado: EstadoUnidad; fecha?: string; documento?: string;
  proyectoId?: string | null; vehiculoId?: string | null; almacenId?: string | null; proveedorId?: string | null;
  notas?: string; kardex?: boolean;
}
export async function moverUnidades(i: MoverUnidadesInput): Promise<{ actualizadas: number; estado: string }> {
  const { data, error } = await (supabase as any).rpc('inventario_unidades_mover', {
    p_ids: i.ids, p_estado: i.estado, p_fecha: i.fecha ?? new Date().toISOString().slice(0, 10), p_documento: i.documento ?? null,
    p_proyecto: i.proyectoId ?? null, p_vehiculo: i.vehiculoId ?? null, p_almacen: i.almacenId ?? null, p_proveedor: i.proveedorId ?? null,
    p_notas: i.notas ?? null, p_kardex: i.kardex ?? false,
  });
  if (error) throw error;
  return data;
}

export async function fijarSerie(unidadId: string, serie: string): Promise<void> {
  const { error } = await (supabase as any).rpc('inventario_unidad_serie', { p_id: unidadId, p_serie: serie });
  if (error) throw error;
}

/** Texto del documento que respalda una salida, para el acta. */
export const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
