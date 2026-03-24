/**
 * Memphis ERP - Flota → Análisis Preventivo Enterprise
 * Lógica pura para análisis de extras (piezas/servicios adicionales)
 * en mantenimientos preventivos y correctivos
 * 
 * v1.0.0
 */

import { OrdenTrabajo } from './ot-store';
import { OTExtraItem, TipoOT, CriticidadOT } from './ot-config';

// ============================================================================
// TYPES
// ============================================================================

export interface PreventiveAnalyticsFilters {
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  tipoOT?: TipoOT; // 'preventivo' | 'correctivo' | 'predictivo' | undefined (all)
  criticidad?: CriticidadOT; // 'baja' | 'media' | 'alta' | 'critica' | undefined (all)
  taller?: string; // nombre del taller
  vehiculoPlaca?: string; // búsqueda parcial
  soloPreventivos?: boolean; // shortcut para tipoOT='preventivo'
  incluirEliminados?: boolean; // por defecto false
}

export interface ExtraAggregated {
  descripcion: string;
  categoria?: string;
  tipo: 'pieza' | 'servicio';
  frecuencia: number; // # ocurrencias
  vehiculosImpactados: number; // distinct vehiculoPlaca
  talleresImpactados: number; // distinct taller
  costoTotal: number;
  costoPromedio: number;
  topMotivo: string; // motivo más frecuente
  ultimaOcurrencia: string; // max fecha
  // Datos raw para drill-down
  placas: string[];
  talleres: string[];
  motivos: Record<string, number>; // motivo -> count
}

export interface PreventiveKPIs {
  totalExtras: number;
  totalPiezas: number;
  totalServicios: number;
  vehiculosImpactados: number;
  costoTotal: number;
  indiceRecurrencia: number; // extras / OTs (handle division by 0)
}

export interface CampaignRecommendation {
  titulo: string;
  descripcion: string;
  placas: string[]; // max 20 para display
  placasTotal: number; // total count
  talleres: string[];
  motivoTop: string;
  costoTotal: number;
  frecuencia: number;
  rangoFechas?: string;
}

export interface FilteredResult {
  otsFiltradas: OrdenTrabajo[];
  extrasFiltrados: OTExtraItem[];
  extrasConOT: Array<{ extra: OTExtraItem; ot: OrdenTrabajo }>; // para metadata
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

/**
 * Filtra OTs y extras según criterios
 */
export function filterOTsWithExtras(
  ots: OrdenTrabajo[],
  filters: PreventiveAnalyticsFilters
): FilteredResult {
  // 1. Filtrar OTs
  let otsFiltradas = ots;

  // Tipo OT
  if (filters.soloPreventivos) {
    otsFiltradas = otsFiltradas.filter(ot => ot.tipo === 'preventivo');
  } else if (filters.tipoOT) {
    otsFiltradas = otsFiltradas.filter(ot => ot.tipo === filters.tipoOT);
  }

  // Criticidad
  if (filters.criticidad) {
    otsFiltradas = otsFiltradas.filter(ot => ot.criticidad === filters.criticidad);
  }

  // Taller
  if (filters.taller) {
    otsFiltradas = otsFiltradas.filter(ot => ot.taller.nombre === filters.taller);
  }

  // Vehículo (búsqueda parcial case-insensitive)
  if (filters.vehiculoPlaca) {
    const searchLower = filters.vehiculoPlaca.toLowerCase().trim();
    otsFiltradas = otsFiltradas.filter(ot =>
      ot.vehiculoPlaca.toLowerCase().includes(searchLower)
    );
  }

  // Fechas (usar fechaRegistro del extra si existe, sino fechaProgramada del OT)
  // Haremos el filtro de fechas al nivel de extras

  // 2. Extraer extras de OTs filtradas con metadata
  const extrasConOT: Array<{ extra: OTExtraItem; ot: OrdenTrabajo }> = [];

  otsFiltradas.forEach(ot => {
    ot.extras.forEach(extra => {
      // Filtro eliminados
      if (!filters.incluirEliminados && extra.eliminado) {
        return;
      }

      // Filtro de fechas
      const fechaExtra = extra.fechaRegistro || ot.fechaProgramada;
      
      if (filters.dateFrom) {
        if (fechaExtra < filters.dateFrom) return;
      }
      
      if (filters.dateTo) {
        if (fechaExtra > filters.dateTo) return;
      }

      extrasConOT.push({ extra, ot });
    });
  });

  const extrasFiltrados = extrasConOT.map(item => item.extra);

  return {
    otsFiltradas,
    extrasFiltrados,
    extrasConOT
  };
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Agrupa extras por descripción para generar dataset de tabla
 */
export function aggregateExtrasByDescription(
  extrasConOT: Array<{ extra: OTExtraItem; ot: OrdenTrabajo }>,
  tipo?: 'pieza' | 'servicio'
): ExtraAggregated[] {
  // Filtrar por tipo si se especifica
  const filteredExtras = tipo
    ? extrasConOT.filter(item => item.extra.tipo === tipo)
    : extrasConOT;

  // Agrupar por descripción (case-insensitive)
  const grouped = new Map<string, {
    descripcion: string;
    categoria?: string;
    tipo: 'pieza' | 'servicio';
    items: Array<{ extra: OTExtraItem; ot: OrdenTrabajo }>;
  }>();

  filteredExtras.forEach(item => {
    const key = item.extra.descripcion.toLowerCase().trim();
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        descripcion: item.extra.descripcion,
        categoria: item.extra.categoria,
        tipo: item.extra.tipo,
        items: []
      });
    }

    grouped.get(key)!.items.push(item);
  });

  // Calcular métricas para cada grupo
  const aggregated: ExtraAggregated[] = [];

  grouped.forEach(group => {
    const { items } = group;

    // Distinct vehiculos
    const placasSet = new Set<string>();
    items.forEach(item => placasSet.add(item.ot.vehiculoPlaca));
    const placas = Array.from(placasSet);

    // Distinct talleres
    const talleresSet = new Set<string>();
    items.forEach(item => talleresSet.add(item.ot.taller.nombre));
    const talleres = Array.from(talleresSet);

    // Motivos count
    const motivosMap: Record<string, number> = {};
    items.forEach(item => {
      const motivo = item.extra.motivo || 'Sin motivo';
      motivosMap[motivo] = (motivosMap[motivo] || 0) + 1;
    });

    // Top motivo
    let topMotivo = 'N/A';
    let maxCount = 0;
    Object.entries(motivosMap).forEach(([motivo, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topMotivo = motivo;
      }
    });

    // Costo total y promedio
    const costoTotal = items.reduce((sum, item) => sum + item.extra.costoTotal, 0);
    const costoPromedio = costoTotal / items.length;

    // Última ocurrencia (max fecha)
    const fechas = items.map(item => item.extra.fechaRegistro || item.ot.fechaProgramada);
    const ultimaOcurrencia = fechas.sort().reverse()[0];

    aggregated.push({
      descripcion: group.descripcion,
      categoria: group.categoria,
      tipo: group.tipo,
      frecuencia: items.length,
      vehiculosImpactados: placas.length,
      talleresImpactados: talleres.length,
      costoTotal,
      costoPromedio,
      topMotivo,
      ultimaOcurrencia,
      placas,
      talleres,
      motivos: motivosMap
    });
  });

  // Ordenar por frecuencia desc, luego costo total desc
  return aggregated.sort((a, b) => {
    if (b.frecuencia !== a.frecuencia) {
      return b.frecuencia - a.frecuencia;
    }
    return b.costoTotal - a.costoTotal;
  });
}

// ============================================================================
// KPI FUNCTIONS
// ============================================================================

/**
 * Calcula KPIs del análisis
 */
export function computePreventiveKPIs(
  extrasFiltrados: OTExtraItem[],
  otsFiltradas: OrdenTrabajo[],
  extrasConOT: Array<{ extra: OTExtraItem; ot: OrdenTrabajo }>
): PreventiveKPIs {
  const totalExtras = extrasFiltrados.length;
  
  const totalPiezas = extrasFiltrados.filter(e => e.tipo === 'pieza').length;
  const totalServicios = extrasFiltrados.filter(e => e.tipo === 'servicio').length;

  // Vehículos impactados (distinct)
  const vehiculosSet = new Set<string>();
  extrasConOT.forEach(item => vehiculosSet.add(item.ot.vehiculoPlaca));
  const vehiculosImpactados = vehiculosSet.size;

  // Costo total
  const costoTotal = extrasFiltrados.reduce((sum, e) => sum + e.costoTotal, 0);

  // Índice de recurrencia (evitar división por 0)
  const indiceRecurrencia = otsFiltradas.length > 0
    ? totalExtras / otsFiltradas.length
    : 0;

  return {
    totalExtras,
    totalPiezas,
    totalServicios,
    vehiculosImpactados,
    costoTotal,
    indiceRecurrencia
  };
}

// ============================================================================
// CAMPAIGN RECOMMENDATION
// ============================================================================

/**
 * Genera recomendación de campaña preventiva basada en un agregado
 */
export function buildCampaignRecommendation(
  aggRow: ExtraAggregated,
  rangoFechas?: { desde?: string; hasta?: string }
): CampaignRecommendation {
  const { descripcion, tipo, frecuencia, placas, talleres, costoTotal, motivoTop } = aggRow;

  const titulo = tipo === 'pieza'
    ? `Campaña: Revisión/cambio de ${descripcion}`
    : `Campaña: Servicio preventivo de ${descripcion}`;

  const descripcion_text = 
    `Se detectó ${frecuencia} ocurrencia(s) de "${descripcion}" en ${placas.length} vehículo(s). ` +
    `Motivo principal: ${motivoTop}. ` +
    `Se recomienda programar revisión/mantenimiento preventivo.`;

  // Max 20 placas para display
  const placasDisplay = placas.slice(0, 20);

  let rangoFechasStr = '';
  if (rangoFechas?.desde || rangoFechas?.hasta) {
    const desde = rangoFechas.desde ? new Date(rangoFechas.desde).toLocaleDateString('es-PE') : '(inicio)';
    const hasta = rangoFechas.hasta ? new Date(rangoFechas.hasta).toLocaleDateString('es-PE') : '(hoy)';
    rangoFechasStr = `${desde} - ${hasta}`;
  }

  return {
    titulo,
    descripcion: descripcion_text,
    placas: placasDisplay,
    placasTotal: placas.length,
    talleres,
    motivoTop,
    costoTotal,
    frecuencia,
    rangoFechas: rangoFechasStr
  };
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Convierte rows a CSV seguro (con comillas escapadas)
 */
export function toCSV(
  rows: ExtraAggregated[],
  tipo: 'pieza' | 'servicio'
): string {
  // Headers
  const headers = tipo === 'pieza'
    ? [
        'Pieza/Descripción',
        'Categoría',
        'Frecuencia',
        'Vehículos Impactados',
        'Talleres Impactados',
        'Costo Total',
        'Costo Promedio',
        'Top Motivo',
        'Última Ocurrencia'
      ]
    : [
        'Servicio/Descripción',
        'Frecuencia',
        'Vehículos Impactados',
        'Talleres Impactados',
        'Costo Total',
        'Costo Promedio',
        'Top Motivo',
        'Última Ocurrencia'
      ];

  const lines: string[] = [headers.join(',')];

  rows.forEach(row => {
    const values = tipo === 'pieza'
      ? [
          escapeCsvValue(row.descripcion),
          escapeCsvValue(row.categoria || 'N/A'),
          row.frecuencia.toString(),
          row.vehiculosImpactados.toString(),
          row.talleresImpactados.toString(),
          row.costoTotal.toFixed(2),
          row.costoPromedio.toFixed(2),
          escapeCsvValue(row.topMotivo),
          row.ultimaOcurrencia
        ]
      : [
          escapeCsvValue(row.descripcion),
          row.frecuencia.toString(),
          row.vehiculosImpactados.toString(),
          row.talleresImpactados.toString(),
          row.costoTotal.toFixed(2),
          row.costoPromedio.toFixed(2),
          escapeCsvValue(row.topMotivo),
          row.ultimaOcurrencia
        ];

    lines.push(values.join(','));
  });

  return lines.join('\n');
}

/**
 * Escapa valores CSV (agrega comillas si tiene coma, comilla o salto de línea)
 */
function escapeCsvValue(value: string): string {
  if (!value) return '';
  
  // Si contiene coma, comillas o salto de línea, envolver en comillas
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Escapar comillas duplicándolas
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  
  return value;
}

// ============================================================================
// HELPER: TALLERES ÚNICOS
// ============================================================================

/**
 * Extrae talleres únicos de OTs para dropdown de filtro
 */
export function extractUniqueTalleres(ots: OrdenTrabajo[]): string[] {
  const talleresSet = new Set<string>();
  ots.forEach(ot => talleresSet.add(ot.taller.nombre));
  return Array.from(talleresSet).sort();
}
