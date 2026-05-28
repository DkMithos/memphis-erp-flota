/**
 * PROYECTO-FINANCIERO — Cálculos financieros por proyecto
 *
 * Gasto Real = Σ OCs aprobadas/en ejecución + Σ Gastos Caja Chica aprobados
 * NUNCA incluir OTs (cada OT genera una OC; contarlas duplicaría el gasto).
 *
 * Soporta PEN y USD — convierte a la moneda del proyecto usando tipo de cambio.
 */

import { supabase } from '../supabase/client';
import type { AdendaProyectoDB } from '../supabase/types';

// ============================================================================
// TIPOS
// ============================================================================

/** Resumen de una OC asociada al proyecto */
export interface OCProyecto {
  id: string;
  numero: string;
  proveedorNombre: string;
  total: number;
  moneda: string;
  estado: string;
  fecha: string;
}

/** Resumen de un gasto de caja chica asociado al proyecto */
export interface GastoCCProyecto {
  id: string;
  numero: string;
  descripcion: string;
  monto: number;
  moneda: string;
  categoria: string;
  fecha: string;
}

/** Adenda del proyecto (frontend) */
export interface AdendaProyecto {
  _dbId: string;
  numero: number;
  descripcion: string;
  monto: number;
  moneda: string;
  fecha?: string;
  documentoUrl?: string;
}

/** KPIs financieros del proyecto */
export interface ProyectoFinanciero {
  // Contrato
  montoContrato: number;
  montoAdendas: number;         // Σ adendas individuales
  montoContratoTotal: number;   // contrato + adendas
  moneda: string;               // moneda base del proyecto

  // Gasto real (solo OCs + Caja Chica, NUNCA OTs)
  gastoOCs: number;             // Σ total de OCs aprobadas/en ejecución
  gastoCajaChica: number;       // Σ monto de gastos caja chica aprobados
  gastoTotal: number;           // OCs + Caja Chica

  // Techo y disponibilidad
  presupuesto: number;          // techo o tope que no se puede pasar
  saldoDisponible: number;      // presupuesto - gastoTotal
  porcentajeEjecutado: number;  // (gastoTotal / presupuesto) * 100

  // Utilidad y margen
  utilidad: number;             // montoContratoTotal - gastoTotal
  margenGanancia: number;       // (utilidad / montoContratoTotal) * 100

  // Detalle
  adendas: AdendaProyecto[];
  ocs: OCProyecto[];
  gastosCajaChica: GastoCCProyecto[];

  // Conteo
  totalOCs: number;
  totalGastosCajaChica: number;
}

// ============================================================================
// TIPO DE CAMBIO POR DEFECTO (PEN/USD)
// En producción se puede parametrizar o leer de la DB
// ============================================================================

const TIPO_CAMBIO_DEFAULT = 3.75; // 1 USD = 3.75 PEN

/** Convierte un monto a la moneda destino usando tipo de cambio fijo */
function convertirMoneda(monto: number, monedaOrigen: string, monedaDestino: string): number {
  if (monedaOrigen === monedaDestino) return monto;
  if (monedaOrigen === 'USD' && monedaDestino === 'PEN') return monto * TIPO_CAMBIO_DEFAULT;
  if (monedaOrigen === 'PEN' && monedaDestino === 'USD') return monto / TIPO_CAMBIO_DEFAULT;
  return monto; // misma o desconocida
}

// ============================================================================
// QUERIES
// ============================================================================

/** Obtiene adendas de un proyecto */
export async function fetchAdendasProyecto(proyectoId: string): Promise<AdendaProyecto[]> {
  const { data, error } = await supabase
    .from('adendas_proyecto')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('numero');

  if (error) {
    console.error('[FINANCIERO] Error cargando adendas:', error.message);
    return [];
  }

  return (data as AdendaProyectoDB[]).map(row => ({
    _dbId: row.id,
    numero: row.numero,
    descripcion: row.descripcion,
    monto: row.monto,
    moneda: row.moneda,
    fecha: row.fecha ?? undefined,
    documentoUrl: row.documento_url ?? undefined,
  }));
}

/** Obtiene OCs aprobadas/en ejecución de un proyecto */
export async function fetchOCsProyecto(proyectoId: string): Promise<OCProyecto[]> {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('id, numero, total, moneda, estado, fecha_emision, proveedor:proveedores(razon_social)')
    .eq('proyecto_id', proyectoId)
    .in('estado', ['aprobada', 'en_ejecucion', 'completada', 'recibida']);

  if (error) {
    console.error('[FINANCIERO] Error cargando OCs:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    numero: row.numero,
    proveedorNombre: row.proveedor?.razon_social ?? 'Sin proveedor',
    total: row.total ?? 0,
    moneda: row.moneda ?? 'PEN',
    estado: row.estado,
    fecha: row.fecha_emision,
  }));
}

/** Obtiene gastos de caja chica aprobados de un proyecto */
export async function fetchGastosCCProyecto(proyectoId: string): Promise<GastoCCProyecto[]> {
  const { data, error } = await supabase
    .from('gastos_caja_chica')
    .select('id, numero, descripcion, monto, moneda, categoria, fecha')
    .eq('proyecto_id', proyectoId)
    .eq('estado', 'aprobado');

  if (error) {
    console.error('[FINANCIERO] Error cargando gastos CC:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    numero: row.numero,
    descripcion: row.descripcion,
    monto: row.monto ?? 0,
    moneda: row.moneda ?? 'PEN',
    categoria: row.categoria,
    fecha: row.fecha,
  }));
}

// ============================================================================
// CÁLCULO PRINCIPAL
// ============================================================================

/**
 * Calcula TODOS los KPIs financieros de un proyecto.
 *
 * @param proyecto — datos base del proyecto (del store)
 * @param tipoCambio — tipo de cambio USD→PEN (default 3.75)
 */
export async function calcularFinancieroProyecto(
  proyecto: {
    _dbId: string;
    montoContrato?: number;
    presupuesto?: number;
    moneda: string;
  },
  tipoCambio: number = TIPO_CAMBIO_DEFAULT
): Promise<ProyectoFinanciero> {
  const monedaBase = proyecto.moneda || 'PEN';

  // Fetch en paralelo
  const [adendas, ocs, gastosCC] = await Promise.all([
    fetchAdendasProyecto(proyecto._dbId),
    fetchOCsProyecto(proyecto._dbId),
    fetchGastosCCProyecto(proyecto._dbId),
  ]);

  // Sumar adendas (convertir a moneda base)
  const montoAdendas = adendas.reduce(
    (sum, a) => sum + convertirMoneda(a.monto, a.moneda, monedaBase),
    0
  );

  const montoContrato = proyecto.montoContrato ?? 0;
  const montoContratoTotal = montoContrato + montoAdendas;

  // Sumar OCs (convertir a moneda base)
  const gastoOCs = ocs.reduce(
    (sum, oc) => sum + convertirMoneda(oc.total, oc.moneda, monedaBase),
    0
  );

  // Sumar gastos caja chica (convertir a moneda base)
  const gastoCajaChica = gastosCC.reduce(
    (sum, g) => sum + convertirMoneda(g.monto, g.moneda, monedaBase),
    0
  );

  const gastoTotal = gastoOCs + gastoCajaChica;

  // Presupuesto (techo) — si no existe, usar monto contrato total
  const presupuesto = proyecto.presupuesto ?? montoContratoTotal;

  // Saldo y ejecución
  const saldoDisponible = presupuesto - gastoTotal;
  const porcentajeEjecutado = presupuesto > 0
    ? Math.round((gastoTotal / presupuesto) * 10000) / 100
    : 0;

  // Utilidad y margen
  const utilidad = montoContratoTotal - gastoTotal;
  const margenGanancia = montoContratoTotal > 0
    ? Math.round((utilidad / montoContratoTotal) * 10000) / 100
    : 0;

  return {
    montoContrato,
    montoAdendas,
    montoContratoTotal,
    moneda: monedaBase,
    gastoOCs,
    gastoCajaChica,
    gastoTotal,
    presupuesto,
    saldoDisponible,
    porcentajeEjecutado,
    utilidad,
    margenGanancia,
    adendas,
    ocs,
    gastosCajaChica: gastosCC,
    totalOCs: ocs.length,
    totalGastosCajaChica: gastosCC.length,
  };
}

// ============================================================================
// HELPERS DE FORMATO
// ============================================================================

/** Formatea un monto con símbolo de moneda */
export function formatMonto(monto: number, moneda: string = 'PEN'): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  return `${simbolo} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Color semáforo para porcentaje de ejecución presupuestal */
export function colorEjecucion(porcentaje: number): 'green' | 'yellow' | 'red' {
  if (porcentaje < 70) return 'green';
  if (porcentaje < 90) return 'yellow';
  return 'red';
}

/** Color semáforo para margen de ganancia */
export function colorMargen(margen: number): 'green' | 'yellow' | 'red' {
  if (margen > 20) return 'green';
  if (margen > 10) return 'yellow';
  return 'red';
}
