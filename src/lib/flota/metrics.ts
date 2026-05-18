/**
 * FLOTA → DASHBOARD METRICS
 * Funciones puras para cálculo de KPIs y métricas enterprise
 * Sin dependencias del DOM, 100% testeable
 * 
 * IMPORTANTE:
 * - Todas las funciones son puras (sin side effects)
 * - Los filtros de fecha usan ot.fechaProgramada como base
 * - Los cálculos de costos incluyen extras activos (no eliminados)
 */

import { OrdenTrabajo } from './ot-store';
import { Vehiculo } from './vehiculos-config';
import { OTExtraItem } from './ot-config';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEBUG_FLOTA_METRICS = false;

// ============================================================================
// TYPES
// ============================================================================

export interface FlotaDashboardMetrics {
  kpis: {
    totalVehiculos: number;
    disponibilidadPct: number;
    mtbfKm: number | null;
    mttrHoras: number | null;
    costoTotal: number;
    slaCumplimientoPct: number;
  };
  rankingTalleres: Array<{
    nombre: string;
    tipo: 'interno' | 'externo';
    otsCount: number;
    slaPct: number;
    mttrHoras: number | null;
    costoTotal: number;
    costoPromedio: number;
  }>;
  topFallas: Array<{
    key: string;
    count: number;
    costoTotal: number;
  }>;
  topPiezas: Array<{
    key: string;
    cantidadTotal: number;
    costoTotal: number;
  }>;
}

export interface MetricsFilters {
  vehiculos: Vehiculo[];
  ots: OrdenTrabajo[];
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  tipoOT?: 'preventivo' | 'correctivo' | 'predictivo';
  tallerNombre?: string;
  vehiculoPlaca?: string;
}

// ============================================================================
// HELPERS INTERNOS
// ============================================================================

/**
 * Filtra OTs según criterios
 */
function filterOTs(
  ots: OrdenTrabajo[],
  filters: {
    dateFrom?: string;
    dateTo?: string;
    tipoOT?: string;
    tallerNombre?: string;
    vehiculoPlaca?: string;
  }
): OrdenTrabajo[] {
  let filtered = [...ots];

  // Filtro por rango de fechas (usando fechaProgramada)
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter(ot => {
      const otDate = new Date(ot.fechaProgramada);
      return otDate >= fromDate;
    });
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999); // Incluir todo el día
    filtered = filtered.filter(ot => {
      const otDate = new Date(ot.fechaProgramada);
      return otDate <= toDate;
    });
  }

  // Filtro por tipo
  if (filters.tipoOT) {
    filtered = filtered.filter(ot => ot.tipo === filters.tipoOT);
  }

  // Filtro por taller
  if (filters.tallerNombre) {
    filtered = filtered.filter(ot => ot.taller.nombre === filters.tallerNombre);
  }

  // Filtro por vehículo
  if (filters.vehiculoPlaca) {
    filtered = filtered.filter(ot => ot.vehiculoPlaca === filters.vehiculoPlaca);
  }

  return filtered;
}

/**
 * Calcula el costo total de una OT incluyendo extras activos
 */
function calcOTTotalCost(ot: OrdenTrabajo): number {
  const baseCost = ot.costos.manoObra + ot.costos.repuestos + ot.costos.terceros + ot.costos.otros;
  
  // Sumar extras activos (no eliminados)
  const extrasCost = ot.extras
    .filter(e => !e.eliminado)
    .reduce((sum, e) => sum + e.costoTotal, 0);

  return baseCost + extrasCost;
}

// ============================================================================
// MÉTRICAS: DISPONIBILIDAD
// ============================================================================

/**
 * Calcula disponibilidad de vehículos
 * Disponibles = activos (no en_taller, no inactivos)
 * 
 * FÓRMULA: (activos / total) * 100
 */
export function calcDisponibilidad(vehiculos: Vehiculo[]): {
  activos: number;
  total: number;
  pct: number;
} {
  const total = vehiculos.length;
  
  if (total === 0) {
    return { activos: 0, total: 0, pct: 0 };
  }

  const activos = vehiculos.filter(v => v.estado === 'activo').length;
  const pct = (activos / total) * 100;

  if (DEBUG_FLOTA_METRICS) {
    console.log('[DISPONIBILIDAD]', { activos, total, pct: pct.toFixed(2) });
  }

  return { activos, total, pct };
}

// ============================================================================
// MÉTRICAS: MTTR (Mean Time To Repair)
// ============================================================================

/**
 * Calcula MTTR (Mean Time To Repair) en horas
 * Solo usa OTs con fechaInicio y fechaCierre definidas
 * 
 * FÓRMULA: promedio((fechaCierre - fechaInicio) / 3600000)
 */
export function calcMTTR(ots: OrdenTrabajo[]): number | null {
  const otsConFechas = ots.filter(ot => ot.fechaInicio && ot.fechaCierre);

  if (otsConFechas.length === 0) {
    if (DEBUG_FLOTA_METRICS) {
      console.log('[MTTR] No hay OTs con fechas completas');
    }
    return null;
  }

  const tiemposReparacion = otsConFechas.map(ot => {
    const inicio = new Date(ot.fechaInicio!).getTime();
    const cierre = new Date(ot.fechaCierre!).getTime();
    const horas = (cierre - inicio) / (1000 * 60 * 60); // ms a horas
    return horas;
  });

  const promedio = tiemposReparacion.reduce((sum, h) => sum + h, 0) / tiemposReparacion.length;

  if (DEBUG_FLOTA_METRICS) {
    console.log('[MTTR]', {
      otsAnalizadas: otsConFechas.length,
      promedioHoras: promedio.toFixed(2)
    });
  }

  return promedio;
}

// ============================================================================
// MÉTRICAS: MTBF (Mean Time Between Failures)
// ============================================================================

/**
 * Calcula MTBF (Mean Time Between Failures) en km
 * Solo usa OTs tipo correctivo, agrupadas por vehículo
 * 
 * FÓRMULA: promedio(delta_km entre fallas consecutivas)
 * 
 * NOTA: Para producción real, esto requeriría un histórico más robusto
 */
export function calcMTBF(ots: OrdenTrabajo[]): number | null {
  // Filtrar solo OTs correctivas
  const correctivas = ots.filter(ot => ot.tipo === 'correctivo');

  if (correctivas.length === 0) {
    if (DEBUG_FLOTA_METRICS) {
      console.log('[MTBF] No hay OTs correctivas');
    }
    return null;
  }

  // Agrupar por vehículo
  const porVehiculo = correctivas.reduce<Record<string, OrdenTrabajo[]>>((acc, ot) => {
    if (!acc[ot.vehiculoPlaca]) {
      acc[ot.vehiculoPlaca] = [];
    }
    acc[ot.vehiculoPlaca].push(ot);
    return acc;
  }, {});

  const deltas: number[] = [];

  // Para cada vehículo, calcular deltas de km entre fallas
  Object.values(porVehiculo).forEach(otsVehiculo => {
    // Ordenar por fecha
    const ordenadas = [...otsVehiculo].sort((a, b) => {
      const dateA = new Date(a.fechaProgramada || a.fechaCreacion).getTime();
      const dateB = new Date(b.fechaProgramada || b.fechaCreacion).getTime();
      return dateA - dateB;
    });

    // Calcular deltas
    for (let i = 1; i < ordenadas.length; i++) {
      const kmActual = ordenadas[i].kilometrajeRegistro;
      const kmAnterior = ordenadas[i - 1].kilometrajeRegistro;
      const delta = kmActual - kmAnterior;

      if (delta > 0) {
        deltas.push(delta);
      }
    }
  });

  if (deltas.length === 0) {
    if (DEBUG_FLOTA_METRICS) {
      console.log('[MTBF] No hay suficientes datos para calcular deltas');
    }
    return null;
  }

  const promedio = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

  if (DEBUG_FLOTA_METRICS) {
    console.log('[MTBF]', {
      correctivasTotal: correctivas.length,
      vehiculosAnalizados: Object.keys(porVehiculo).length,
      deltasCalculados: deltas.length,
      promedioKm: promedio.toFixed(0)
    });
  }

  return promedio;
}

// ============================================================================
// MÉTRICAS: SLA CUMPLIMIENTO
// ============================================================================

/**
 * Calcula porcentaje de cumplimiento de SLA
 * Solo OTs cerradas con fechas completas
 * 
 * FÓRMULA: (OTs con SLA cumplido / total OTs cerradas) * 100
 * 
 * SLA cumplido = slaReal <= slaEstimado
 * Si no hay slaReal, se calcula: (fechaCierre - fechaInicio) en horas
 */
export function calcSLACumplimiento(ots: OrdenTrabajo[]): number {
  const cerradas = ots.filter(ot => 
    ot.estado === 'cerrada' && 
    ot.fechaInicio && 
    ot.fechaCierre
  );

  if (cerradas.length === 0) {
    if (DEBUG_FLOTA_METRICS) {
      console.log('[SLA] No hay OTs cerradas con fechas');
    }
    return 0;
  }

  let cumplidos = 0;

  cerradas.forEach(ot => {
    let slaReal = ot.slaReal;

    // Si no hay slaReal, calcularlo
    if (slaReal === null && ot.fechaInicio && ot.fechaCierre) {
      const inicio = new Date(ot.fechaInicio).getTime();
      const cierre = new Date(ot.fechaCierre).getTime();
      slaReal = (cierre - inicio) / (1000 * 60 * 60); // ms a horas
    }

    if (slaReal !== null && slaReal <= ot.slaEstimado) {
      cumplidos++;
    }
  });

  const pct = (cumplidos / cerradas.length) * 100;

  if (DEBUG_FLOTA_METRICS) {
    console.log('[SLA]', {
      cerradas: cerradas.length,
      cumplidos,
      pct: pct.toFixed(2)
    });
  }

  return pct;
}

// ============================================================================
// RANKING: TALLERES
// ============================================================================

/**
 * Genera ranking de talleres por performance
 * Incluye: count OTs, SLA %, MTTR, costo total y promedio
 * 
 * ORDEN: SLA% desc, MTTR asc, costo promedio asc
 */
export function rankTalleres(ots: OrdenTrabajo[]): Array<{
  nombre: string;
  tipo: 'interno' | 'externo';
  otsCount: number;
  slaPct: number;
  mttrHoras: number | null;
  costoTotal: number;
  costoPromedio: number;
}> {
  if (ots.length === 0) {
    return [];
  }

  // Agrupar por taller
  const porTaller = ots.reduce<Record<string, OrdenTrabajo[]>>((acc, ot) => {
    if (!acc[ot.taller.nombre]) {
      acc[ot.taller.nombre] = [];
    }
    acc[ot.taller.nombre].push(ot);
    return acc;
  }, {});

  const ranking = Object.entries(porTaller).map(([nombre, otsDeEsteTaller]) => {
    const tipo = otsDeEsteTaller[0].taller.tipo;
    const otsCount = otsDeEsteTaller.length;

    // SLA%
    const slaPct = calcSLACumplimiento(otsDeEsteTaller);

    // MTTR
    const mttrHoras = calcMTTR(otsDeEsteTaller);

    // Costos
    const costoTotal = otsDeEsteTaller.reduce((sum, ot) => sum + calcOTTotalCost(ot), 0);
    const costoPromedio = costoTotal / otsCount;

    return {
      nombre,
      tipo,
      otsCount,
      slaPct,
      mttrHoras,
      costoTotal,
      costoPromedio
    };
  });

  // Ordenar: SLA% desc, MTTR asc, costo promedio asc
  ranking.sort((a, b) => {
    // 1. SLA% descendente (mayor es mejor)
    if (a.slaPct !== b.slaPct) {
      return b.slaPct - a.slaPct;
    }

    // 2. MTTR ascendente (menor es mejor)
    const mttrA = a.mttrHoras ?? Infinity;
    const mttrB = b.mttrHoras ?? Infinity;
    if (mttrA !== mttrB) {
      return mttrA - mttrB;
    }

    // 3. Costo promedio ascendente (menor es mejor)
    return a.costoPromedio - b.costoPromedio;
  });

  if (DEBUG_FLOTA_METRICS) {
    console.log('[RANKING_TALLERES]', {
      totalTalleres: ranking.length,
      top3: ranking.slice(0, 3).map(t => ({ nombre: t.nombre, slaPct: t.slaPct.toFixed(2) }))
    });
  }

  return ranking;
}

// ============================================================================
// TOP: FALLAS
// ============================================================================

/**
 * Top fallas más frecuentes (por extras tipo pieza)
 * Agrupa por categoría si existe, sino por descripción
 * 
 * RETORNA: top 10 fallas
 */
export function topFallas(ots: OrdenTrabajo[]): Array<{
  key: string;
  count: number;
  costoTotal: number;
}> {
  // Recolectar todos los extras activos (no eliminados)
  const extras = ots.flatMap(ot => 
    ot.extras.filter(e => !e.eliminado)
  );

  if (extras.length === 0) {
    return [];
  }

  // Agrupar por categoría (si existe) o descripción
  const grupos = extras.reduce<Record<string, { count: number; costoTotal: number }>>((acc, extra) => {
    const key = extra.categoria || extra.descripcion;

    if (!acc[key]) {
      acc[key] = { count: 0, costoTotal: 0 };
    }

    acc[key].count += 1;
    acc[key].costoTotal += extra.costoTotal;

    return acc;
  }, {});

  // Convertir a array y ordenar por count desc
  const ranking = Object.entries(grupos)
    .map(([key, data]) => ({
      key,
      count: data.count,
      costoTotal: data.costoTotal
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (DEBUG_FLOTA_METRICS) {
    console.log('[TOP_FALLAS]', {
      extrasAnalizados: extras.length,
      gruposUnicos: Object.keys(grupos).length,
      top3: ranking.slice(0, 3).map(f => ({ key: f.key, count: f.count }))
    });
  }

  return ranking;
}

// ============================================================================
// TOP: PIEZAS
// ============================================================================

/**
 * Piezas más usadas (extras tipo pieza)
 * Agrupa por descripción
 * 
 * RETORNA: top 10 piezas
 */
export function topPiezas(ots: OrdenTrabajo[]): Array<{
  key: string;
  cantidadTotal: number;
  costoTotal: number;
}> {
  // Recolectar extras tipo pieza activos
  const piezas = ots.flatMap(ot => 
    ot.extras.filter(e => !e.eliminado && e.tipo === 'pieza')
  );

  if (piezas.length === 0) {
    return [];
  }

  // Agrupar por descripción (o categoria+descripcion para más precisión)
  const grupos = piezas.reduce<Record<string, { cantidadTotal: number; costoTotal: number }>>((acc, pieza) => {
    // Key = categoria + descripcion para mejor agrupación
    const key = pieza.categoria 
      ? `${pieza.categoria} - ${pieza.descripcion}`
      : pieza.descripcion;

    if (!acc[key]) {
      acc[key] = { cantidadTotal: 0, costoTotal: 0 };
    }

    acc[key].cantidadTotal += pieza.cantidad;
    acc[key].costoTotal += pieza.costoTotal;

    return acc;
  }, {});

  // Convertir a array y ordenar por cantidad desc
  const ranking = Object.entries(grupos)
    .map(([key, data]) => ({
      key,
      cantidadTotal: data.cantidadTotal,
      costoTotal: data.costoTotal
    }))
    .sort((a, b) => b.cantidadTotal - a.cantidadTotal)
    .slice(0, 10);

  if (DEBUG_FLOTA_METRICS) {
    console.log('[TOP_PIEZAS]', {
      piezasAnalizadas: piezas.length,
      gruposUnicos: Object.keys(grupos).length,
      top3: ranking.slice(0, 3).map(p => ({ key: p.key, cantidad: p.cantidadTotal }))
    });
  }

  return ranking;
}

// ============================================================================
// BUILD DASHBOARD METRICS (FUNCIÓN PRINCIPAL)
// ============================================================================

/**
 * Construye todas las métricas del dashboard en una sola llamada
 * Función principal que usa todas las funciones auxiliares
 * 
 * @param params - Parámetros con vehiculos, OTs y filtros opcionales
 * @returns Objeto completo con KPIs, rankings y tops
 */
export function buildFlotaDashboardMetrics(params: MetricsFilters): FlotaDashboardMetrics {
  const { vehiculos, ots, dateFrom, dateTo, tipoOT, tallerNombre, vehiculoPlaca } = params;

  // Aplicar filtros a OTs
  const otsFiltradas = filterOTs(ots, { dateFrom, dateTo, tipoOT, tallerNombre, vehiculoPlaca });

  if (DEBUG_FLOTA_METRICS) {
    console.log('[BUILD_METRICS]', {
      vehiculosTotal: vehiculos.length,
      otsTotal: ots.length,
      otsFiltradas: otsFiltradas.length,
      filtros: { dateFrom, dateTo, tipoOT, tallerNombre, vehiculoPlaca }
    });
  }

  // KPIs
  const disponibilidad = calcDisponibilidad(vehiculos);
  const mtbfKm = calcMTBF(otsFiltradas);
  const mttrHoras = calcMTTR(otsFiltradas);
  const costoTotal = otsFiltradas.reduce((sum, ot) => sum + calcOTTotalCost(ot), 0);
  const slaCumplimientoPct = calcSLACumplimiento(otsFiltradas);

  const kpis = {
    totalVehiculos: vehiculos.length,
    disponibilidadPct: disponibilidad.pct,
    mtbfKm,
    mttrHoras,
    costoTotal,
    slaCumplimientoPct
  };

  // Rankings y tops
  const rankingTalleres = rankTalleres(otsFiltradas);
  const topFallasData = topFallas(otsFiltradas);
  const topPiezasData = topPiezas(otsFiltradas);

  return {
    kpis,
    rankingTalleres,
    topFallas: topFallasData,
    topPiezas: topPiezasData
  };
}

// ============================================================================
// HELPERS AUXILIARES PARA UI
// ============================================================================

/**
 * Extrae lista única de talleres desde OTs (para filtro de UI)
 */
export function extractTalleresFromOTs(ots: OrdenTrabajo[]): Array<{ nombre: string; tipo: 'interno' | 'externo' }> {
  const talleresMap = new Map<string, 'interno' | 'externo'>();

  ots.forEach(ot => {
    if (!talleresMap.has(ot.taller.nombre)) {
      talleresMap.set(ot.taller.nombre, ot.taller.tipo);
    }
  });

  return Array.from(talleresMap.entries()).map(([nombre, tipo]) => ({ nombre, tipo }));
}

/**
 * Formatea número como moneda PEN (Soles peruanos)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Formatea porcentaje
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Formatea número con separadores de miles
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}
