/**
 * CROSS-REPORT HELPERS
 * Funciones para reportes cruzados por proyecto y centro de costo
 * Consultas directas a Supabase con filtros WHERE proyecto_id/centro_costo_id
 */

import { supabase } from '../supabase/client';
import { convertirAMonedaBase } from '../shared/currency-utils';

// ─── Interfaces ─────────────────────────────────────────────

export interface CrossReportFilters {
  dateFrom: string;       // YYYY-MM-DD
  dateTo: string;         // YYYY-MM-DD
  proyectoId?: string;    // nullable
  centroCostoId?: string; // nullable
  modulos: string[];      // ['transacciones', 'ordenes_trabajo', 'gastos_caja', 'requerimientos']
  tenantId: string;
}

export interface CrossReportRow {
  fecha: string;
  modulo: string;
  tipo: string;
  numero: string;
  descripcion: string;
  monto: number;
  moneda: string;
  proyecto: string | null;
  centroCosto: string | null;
}

export interface CrossReportKPIs {
  totalRegistros: number;
  totalMonto: number;
  porModulo: Record<string, { count: number; monto: number }>;
  porProyecto: Record<string, { count: number; monto: number }>;
  porCentroCosto: Record<string, { count: number; monto: number }>;
}

// ─── Module Labels ──────────────────────────────────────────

export const MODULO_LABELS: Record<string, string> = {
  transacciones: 'Transacciones',
  ordenes_trabajo: 'Órdenes de Trabajo',
  gastos_caja: 'Caja Chica',
  requerimientos: 'Requerimientos',
};

export const MODULOS_DISPONIBLES = Object.keys(MODULO_LABELS);

// ─── Fetch Functions ────────────────────────────────────────

export async function fetchTransaccionesCruzadas(filters: CrossReportFilters): Promise<CrossReportRow[]> {
  let query = supabase
    .from('transacciones')
    .select('fecha, tipo, numero, descripcion, monto, moneda, proyecto_id, centro_costo_id, proyectos(nombre), centros_costo(nombre)')
    .eq('tenant_id', filters.tenantId)
    .gte('fecha', filters.dateFrom)
    .lte('fecha', filters.dateTo);

  if (filters.proyectoId) query = query.eq('proyecto_id', filters.proyectoId);
  if (filters.centroCostoId) query = query.eq('centro_costo_id', filters.centroCostoId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    fecha: row.fecha,
    modulo: 'Transacciones',
    tipo: row.tipo ?? 'transacción',
    numero: row.numero ?? '-',
    descripcion: row.descripcion ?? '',
    monto: row.monto ?? 0,
    moneda: row.moneda ?? 'PEN',
    proyecto: row.proyectos?.nombre ?? null,
    centroCosto: row.centros_costo?.nombre ?? null,
  }));
}

export async function fetchOTsCruzadas(filters: CrossReportFilters): Promise<CrossReportRow[]> {
  let query = supabase
    .from('ordenes_trabajo')
    .select('fecha_inicio, tipo, numero, descripcion, costo_total, proyecto_id, centro_costo_id, proyectos(nombre), centros_costo(nombre)')
    .eq('tenant_id', filters.tenantId)
    .gte('fecha_inicio', filters.dateFrom)
    .lte('fecha_inicio', filters.dateTo);

  if (filters.proyectoId) query = query.eq('proyecto_id', filters.proyectoId);
  if (filters.centroCostoId) query = query.eq('centro_costo_id', filters.centroCostoId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    fecha: row.fecha_inicio,
    modulo: 'Órdenes de Trabajo',
    tipo: row.tipo ?? 'OT',
    numero: row.numero ?? '-',
    descripcion: row.descripcion ?? '',
    monto: row.costo_total ?? 0,
    moneda: 'PEN',
    proyecto: row.proyectos?.nombre ?? null,
    centroCosto: row.centros_costo?.nombre ?? null,
  }));
}

export async function fetchGastosCruzados(filters: CrossReportFilters): Promise<CrossReportRow[]> {
  let query = supabase
    .from('gastos_caja_chica')
    .select('fecha, categoria, numero_documento, descripcion, monto, proyecto_id, centro_costo_id, proyectos(nombre), centros_costo(nombre)')
    .eq('tenant_id', filters.tenantId)
    .gte('fecha', filters.dateFrom)
    .lte('fecha', filters.dateTo);

  if (filters.proyectoId) query = query.eq('proyecto_id', filters.proyectoId);
  if (filters.centroCostoId) query = query.eq('centro_costo_id', filters.centroCostoId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    fecha: row.fecha,
    modulo: 'Caja Chica',
    tipo: row.categoria ?? 'gasto',
    numero: row.numero_documento ?? '-',
    descripcion: row.descripcion ?? '',
    monto: row.monto ?? 0,
    moneda: 'PEN',
    proyecto: row.proyectos?.nombre ?? null,
    centroCosto: row.centros_costo?.nombre ?? null,
  }));
}

export async function fetchRequerimientosCruzados(filters: CrossReportFilters): Promise<CrossReportRow[]> {
  let query = supabase
    .from('requerimientos_compra')
    .select('fecha_solicitud, tipo, numero, descripcion, monto_estimado, proyecto_id, centro_costo_id, proyectos(nombre), centros_costo(nombre)')
    .eq('tenant_id', filters.tenantId)
    .gte('fecha_solicitud', filters.dateFrom)
    .lte('fecha_solicitud', filters.dateTo);

  if (filters.proyectoId) query = query.eq('proyecto_id', filters.proyectoId);
  if (filters.centroCostoId) query = query.eq('centro_costo_id', filters.centroCostoId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    fecha: row.fecha_solicitud,
    modulo: 'Requerimientos',
    tipo: row.tipo ?? 'requerimiento',
    numero: row.numero ?? '-',
    descripcion: row.descripcion ?? '',
    monto: row.monto_estimado ?? 0,
    moneda: 'PEN',
    proyecto: row.proyectos?.nombre ?? null,
    centroCosto: row.centros_costo?.nombre ?? null,
  }));
}

// ─── Aggregated Fetch ───────────────────────────────────────

export async function fetchCrossReportData(filters: CrossReportFilters): Promise<CrossReportRow[]> {
  const promises: Promise<CrossReportRow[]>[] = [];

  if (filters.modulos.includes('transacciones')) promises.push(fetchTransaccionesCruzadas(filters));
  if (filters.modulos.includes('ordenes_trabajo')) promises.push(fetchOTsCruzadas(filters));
  if (filters.modulos.includes('gastos_caja')) promises.push(fetchGastosCruzados(filters));
  if (filters.modulos.includes('requerimientos')) promises.push(fetchRequerimientosCruzados(filters));

  const results = await Promise.all(promises);
  const allRows = results.flat();

  // Sort by date descending
  allRows.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  return allRows;
}

// ─── KPI Calculation ────────────────────────────────────────

export function calcCrossReportKPIs(rows: CrossReportRow[]): CrossReportKPIs {
  const porModulo: Record<string, { count: number; monto: number }> = {};
  const porProyecto: Record<string, { count: number; monto: number }> = {};
  const porCentroCosto: Record<string, { count: number; monto: number }> = {};
  let totalMonto = 0;

  for (const row of rows) {
    // Convertir a moneda base (PEN) para agregaciones correctas multi-moneda
    const montoBase = convertirAMonedaBase(row.monto, row.moneda);
    totalMonto += montoBase;

    // Por módulo
    if (!porModulo[row.modulo]) porModulo[row.modulo] = { count: 0, monto: 0 };
    porModulo[row.modulo].count++;
    porModulo[row.modulo].monto += montoBase;

    // Por proyecto
    const proy = row.proyecto ?? 'Sin Proyecto';
    if (!porProyecto[proy]) porProyecto[proy] = { count: 0, monto: 0 };
    porProyecto[proy].count++;
    porProyecto[proy].monto += montoBase;

    // Por centro costo
    const cc = row.centroCosto ?? 'Sin Centro Costo';
    if (!porCentroCosto[cc]) porCentroCosto[cc] = { count: 0, monto: 0 };
    porCentroCosto[cc].count++;
    porCentroCosto[cc].monto += montoBase;
  }

  return {
    totalRegistros: rows.length,
    totalMonto,
    porModulo,
    porProyecto,
    porCentroCosto,
  };
}
