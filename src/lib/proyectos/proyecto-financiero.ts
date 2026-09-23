/**
 * PROYECTO-FINANCIERO — Cálculos financieros por proyecto
 *
 * Es el ESPEJO en TypeScript de `proyecto_financiero(uuid)` en la base (la
 * fuente de verdad que también usan el Panorama y `proyectos.costo_real`).
 * Las dos deben decir lo mismo:
 *   · Gasto real = Σ OC comprometidas (ESTADOS_OC_GASTO) + Σ caja chica aprobada.
 *     NUNCA OTs (cada OT genera una OC; contarlas duplicaría el gasto).
 *   · Utilidad operativa = contrato total − gasto real.
 *   · Ganancia neta = regla de Antonio (16/09/2026), ver `rendimiento.ts`.
 *   · USD → PEN con el TC de cada orden; lo que no lo trae usa el TC vigente
 *     que llega como parámetro (tabla `tipos_cambio`), nunca un valor fijo.
 */

import { supabase } from '../supabase/client';
import type { AdendaProyectoDB } from '../supabase/types';
import { calcularMargen, type ResultadoMargen } from './rendimiento';

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
  tipoCambio?: number;   // TC USD->PEN del día de emisión (SBS/SUNAT); migrados 3.40/3.45
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
  gastoFijos: number;           // Σ gastos fijos de asesoría (consultoría/contraprestación/IR/venta CIPRL)
  gastosFijos: Array<{ concepto: string; descripcion: string; porcentaje: number; monto: number; moneda: string }>;
  gastoTotal: number;           // OCs + Caja Chica + Gastos Fijos

  // Techo y disponibilidad
  presupuesto: number;          // techo o tope que no se puede pasar
  saldoDisponible: number;      // presupuesto - gastoTotal
  porcentajeEjecutado: number;  // (gastoTotal / presupuesto) * 100

  // Utilidad y margen
  utilidad: number;             // montoContratoTotal - gastoTotal
  margenGanancia: number;       // (utilidad / montoContratoTotal) * 100

  // Cobranza (RESUMEN PROYECTOS: monto cobrado / pendiente)
  montoCobrado: number;         // ya cobrado al cliente/entidad
  montoPendienteCobro: number;  // montoContratoTotal - montoCobrado
  anioConvenio?: number;        // año de firma del convenio (cohorte)

  // Ganancia neta (regla de Antonio 16/09/2026): ingresos sin IGV − gasto −
  // consultoría OxI − contraprestación − venta del CIPRL. null si el proyecto
  // no está en soles.
  neto: ResultadoMargen | null;

  // Detalle
  adendas: AdendaProyecto[];
  ocs: OCProyecto[];
  gastosCajaChica: GastoCCProyecto[];

  // Conteo
  totalOCs: number;
  totalGastosCajaChica: number;
}

// ============================================================================
// CONVERSIÓN DE MONEDA — sin ningún tipo de cambio fijo en el código
// ============================================================================

/** Convierte un monto a la moneda destino con el tipo de cambio indicado. */
function convertirMoneda(monto: number, monedaOrigen: string, monedaDestino: string, rate: number): number {
  if (monedaOrigen === monedaDestino) return monto;
  if (monedaOrigen === 'USD' && monedaDestino === 'PEN') return monto * rate;
  if (monedaOrigen === 'PEN' && monedaDestino === 'USD') return monto / rate;
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

/**
 * Estados de OC que cuentan como gasto comprometido del proyecto.
 * Son los estados REALES de `ordenes_compra` (borrador | enviada | aprobada |
 * recibida_parcial | recibida_total | anulada): una OC aprobada sigue siendo
 * gasto cuando ya se recibió, parcial o totalmente. Borradores y enviadas
 * todavía no son un compromiso; anuladas nunca.
 */
export const ESTADOS_OC_GASTO = ['aprobada', 'recibida_parcial', 'recibida_total'] as const;

/** Obtiene OCs comprometidas (aprobadas o recibidas) de un proyecto */
export async function fetchOCsProyecto(proyectoId: string): Promise<OCProyecto[]> {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('id, numero, total, moneda, tipo_cambio, estado, fecha_emision, proveedor:proveedores(razon_social)')
    .eq('proyecto_id', proyectoId)
    .in('estado', [...ESTADOS_OC_GASTO]);

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
    tipoCambio: row.tipo_cambio ?? undefined,
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

/** Obtiene los gastos fijos de asesoría del proyecto (consultoría, contraprestación, IR, venta CIPRL) */
export async function fetchGastosFijosProyecto(proyectoId: string) {
  const { data, error } = await supabase
    .from('gastos_fijos_proyecto')
    .select('concepto, descripcion, porcentaje, monto, moneda')
    .eq('proyecto_id', proyectoId)
    .order('porcentaje', { ascending: false });
  if (error) {
    console.error('[FINANCIERO] Error cargando gastos fijos:', error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    concepto: r.concepto,
    descripcion: r.descripcion,
    porcentaje: r.porcentaje ?? 0,
    monto: r.monto ?? 0,
    moneda: r.moneda ?? 'PEN',
  }));
}

// ============================================================================
// CÁLCULO PRINCIPAL
// ============================================================================

/**
 * Calcula TODOS los KPIs financieros de un proyecto.
 *
 * @param proyecto — datos base del proyecto (del store)
 * @param tipoCambio — TC USD→PEN vigente (de `useTipoCambio`, respaldado por la
 *   tabla `tipos_cambio`). Se usa para adendas, caja chica y las OC que no
 *   traen su propio TC. Obligatorio: aquí ya no vive ningún valor fijo.
 */
export async function calcularFinancieroProyecto(
  proyecto: {
    _dbId: string;
    montoContrato?: number;
    montoAdenda?: number;
    presupuesto?: number;
    moneda: string;
    montoCobrado?: number;
    anioConvenio?: number;
  },
  tipoCambio: number
): Promise<ProyectoFinanciero> {
  const monedaBase = proyecto.moneda || 'PEN';

  // Fetch en paralelo
  const [adendas, ocs, gastosCC, gastosFijos] = await Promise.all([
    fetchAdendasProyecto(proyecto._dbId),
    fetchOCsProyecto(proyecto._dbId),
    fetchGastosCCProyecto(proyecto._dbId),
    fetchGastosFijosProyecto(proyecto._dbId),
  ]);

  // Sumar adendas (convertir a moneda base)
  const montoAdendas = adendas.reduce(
    (sum, a) => sum + convertirMoneda(a.monto, a.moneda, monedaBase, tipoCambio),
    0
  );

  // Valor modificado = inversión inicial (monto_contrato) + adenda/equivalente.
  // El equivalente puede venir de la columna proyecto.montoAdenda y/o de adendas itemizadas.
  const montoContrato = proyecto.montoContrato ?? 0;
  const montoAdendaTotal = (proyecto.montoAdenda ?? 0) + montoAdendas;
  const montoContratoTotal = montoContrato + montoAdendaTotal;

  // Sumar OCs (convertir a moneda base con el TC de cada orden; fallback al global)
  const gastoOCs = ocs.reduce(
    (sum, oc) => sum + convertirMoneda(oc.total, oc.moneda, monedaBase, oc.tipoCambio ?? tipoCambio),
    0
  );

  // Sumar gastos caja chica (convertir a moneda base)
  const gastoCajaChica = gastosCC.reduce(
    (sum, g) => sum + convertirMoneda(g.monto, g.moneda, monedaBase, tipoCambio),
    0
  );

  // Gastos fijos de asesoría (consultoría 10% + contraprestación 5% + IR 3.5% + venta CIPRL 4%).
  // Se muestran en su propio bloque y NO entran en el gasto operativo ni en la
  // utilidad operativa; la ganancia NETA (abajo) sí los descuenta por regla.
  const gastoFijos = gastosFijos.reduce(
    (sum, g) => sum + convertirMoneda(g.monto, g.moneda, monedaBase, tipoCambio),
    0
  );

  // Gasto operativo = Órdenes de Compra + Caja Chica (lo que descuenta la utilidad)
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

  // Cobranza
  const montoCobrado = proyecto.montoCobrado ?? 0;
  const montoPendienteCobro = montoContratoTotal - montoCobrado;

  // Ganancia neta (regla de Antonio): misma cuenta que `proyecto_financiero()`
  // en la base. Los convenios con el Estado están en soles; en otra moneda no
  // aplica.
  const neto = monedaBase === 'PEN'
    ? calcularMargen({ convenio: montoContratoTotal, costo: gastoTotal })
    : null;

  return {
    neto,
    montoContrato,
    montoAdendas: montoAdendaTotal,
    montoContratoTotal,
    moneda: monedaBase,
    gastoOCs,
    gastoCajaChica,
    gastoFijos,
    gastosFijos,
    gastoTotal,
    presupuesto,
    saldoDisponible,
    porcentajeEjecutado,
    utilidad,
    margenGanancia,
    montoCobrado,
    montoPendienteCobro,
    anioConvenio: proyecto.anioConvenio,
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
