/**
 * FLOTA METRICS - EJEMPLOS DE USO
 * Archivo de referencia con ejemplos de cómo usar las funciones de metrics.ts
 * NO IMPORTAR ESTE ARCHIVO EN PRODUCCIÓN - Solo para documentación
 */

import { 
  buildFlotaDashboardMetrics,
  calcDisponibilidad,
  calcMTTR,
  calcMTBF,
  calcSLACumplimiento,
  rankTalleres,
  topFallas,
  topPiezas,
  extractTalleresFromOTs,
  formatCurrency,
  formatPercentage,
  formatNumber
} from './metrics';

// ============================================================================
// EJEMPLO 1: USO BÁSICO - Sin filtros
// ============================================================================

function ejemplo1_UsoBasicoSinFiltros(vehiculos: any[], ots: any[]) {
  const metrics = buildFlotaDashboardMetrics({
    vehiculos,
    ots
  });

  console.log('=== DASHBOARD COMPLETO ===');
  console.log('Total Vehículos:', metrics.kpis.totalVehiculos);
  console.log('Disponibilidad:', formatPercentage(metrics.kpis.disponibilidadPct));
  console.log('MTTR:', metrics.kpis.mttrHoras ? `${formatNumber(metrics.kpis.mttrHoras, 1)} horas` : 'N/A');
  console.log('MTBF:', metrics.kpis.mtbfKm ? `${formatNumber(metrics.kpis.mtbfKm)} km` : 'N/A');
  console.log('Costo Total:', formatCurrency(metrics.kpis.costoTotal));
  console.log('SLA %:', formatPercentage(metrics.kpis.slaCumplimientoPct));
  console.log('Talleres:', metrics.rankingTalleres.length);
  console.log('Top Fallas:', metrics.topFallas.length);
  console.log('Top Piezas:', metrics.topPiezas.length);
}

// ============================================================================
// EJEMPLO 2: CON FILTROS DE FECHA
// ============================================================================

function ejemplo2_FiltrosPorFecha(vehiculos: any[], ots: any[]) {
  // Obtener métricas del último mes
  const hoy = new Date();
  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);

  const metrics = buildFlotaDashboardMetrics({
    vehiculos,
    ots,
    dateFrom: hace30dias.toISOString().split('T')[0], // YYYY-MM-DD
    dateTo: hoy.toISOString().split('T')[0]
  });

  console.log('=== MÉTRICAS ÚLTIMOS 30 DÍAS ===');
  console.log('Costo Total (30d):', formatCurrency(metrics.kpis.costoTotal));
  console.log('OTs procesadas:', metrics.rankingTalleres.reduce((sum, t) => sum + t.otsCount, 0));
}

// ============================================================================
// EJEMPLO 3: FILTRAR POR TIPO DE OT
// ============================================================================

function ejemplo3_FiltroPorTipo(vehiculos: any[], ots: any[]) {
  // Métricas solo de OTs correctivas
  const metricsCorrectivo = buildFlotaDashboardMetrics({
    vehiculos,
    ots,
    tipoOT: 'correctivo'
  });

  // Métricas solo de OTs preventivas
  const metricsPreventivo = buildFlotaDashboardMetrics({
    vehiculos,
    ots,
    tipoOT: 'preventivo'
  });

  console.log('=== COMPARATIVA CORRECTIVO vs PREVENTIVO ===');
  console.log('Costo Correctivo:', formatCurrency(metricsCorrectivo.kpis.costoTotal));
  console.log('Costo Preventivo:', formatCurrency(metricsPreventivo.kpis.costoTotal));
  console.log('MTTR Correctivo:', metricsCorrectivo.kpis.mttrHoras ? `${formatNumber(metricsCorrectivo.kpis.mttrHoras, 1)}h` : 'N/A');
  console.log('MTTR Preventivo:', metricsPreventivo.kpis.mttrHoras ? `${formatNumber(metricsPreventivo.kpis.mttrHoras, 1)}h` : 'N/A');
}

// ============================================================================
// EJEMPLO 4: FILTRAR POR TALLER
// ============================================================================

function ejemplo4_FiltroPorTaller(vehiculos: any[], ots: any[]) {
  // Primero obtener lista de talleres disponibles
  const talleres = extractTalleresFromOTs(ots);

  // Métricas para cada taller
  talleres.forEach(taller => {
    const metrics = buildFlotaDashboardMetrics({
      vehiculos,
      ots,
      tallerNombre: taller.nombre
    });

    console.log(`=== TALLER: ${taller.nombre} (${taller.tipo}) ===`);
    console.log('Costo Total:', formatCurrency(metrics.kpis.costoTotal));
    console.log('SLA %:', formatPercentage(metrics.kpis.slaCumplimientoPct));
    console.log('MTTR:', metrics.kpis.mttrHoras ? `${formatNumber(metrics.kpis.mttrHoras, 1)}h` : 'N/A');
    console.log('---');
  });
}

// ============================================================================
// EJEMPLO 5: FUNCIONES INDIVIDUALES
// ============================================================================

function ejemplo5_FuncionesIndividuales(vehiculos: any[], ots: any[]) {
  // Calcular disponibilidad
  const disponibilidad = calcDisponibilidad(vehiculos);
  console.log('=== DISPONIBILIDAD ===');
  console.log('Activos:', disponibilidad.activos);
  console.log('Total:', disponibilidad.total);
  console.log('Porcentaje:', formatPercentage(disponibilidad.pct));

  // Calcular MTTR
  const mttr = calcMTTR(ots);
  console.log('\n=== MTTR ===');
  console.log('Horas promedio:', mttr ? formatNumber(mttr, 2) : 'N/A');

  // Calcular MTBF
  const mtbf = calcMTBF(ots);
  console.log('\n=== MTBF ===');
  console.log('Km entre fallas:', mtbf ? formatNumber(mtbf, 0) : 'N/A');

  // Calcular SLA
  const sla = calcSLACumplimiento(ots);
  console.log('\n=== SLA ===');
  console.log('Cumplimiento:', formatPercentage(sla));

  // Ranking de talleres
  const ranking = rankTalleres(ots);
  console.log('\n=== RANKING TALLERES (TOP 3) ===');
  ranking.slice(0, 3).forEach((taller, index) => {
    console.log(`${index + 1}. ${taller.nombre}`);
    console.log(`   OTs: ${taller.otsCount}`);
    console.log(`   SLA: ${formatPercentage(taller.slaPct)}`);
    console.log(`   Costo: ${formatCurrency(taller.costoTotal)}`);
  });

  // Top fallas
  const fallas = topFallas(ots);
  console.log('\n=== TOP 5 FALLAS ===');
  fallas.slice(0, 5).forEach((falla, index) => {
    console.log(`${index + 1}. ${falla.key}: ${falla.count} veces - ${formatCurrency(falla.costoTotal)}`);
  });

  // Top piezas
  const piezas = topPiezas(ots);
  console.log('\n=== TOP 5 PIEZAS ===');
  piezas.slice(0, 5).forEach((pieza, index) => {
    console.log(`${index + 1}. ${pieza.key}: ${pieza.cantidadTotal} uds - ${formatCurrency(pieza.costoTotal)}`);
  });
}

// ============================================================================
// EJEMPLO 6: COMPARATIVA TEMPORAL
// ============================================================================

function ejemplo6_ComparativaTemporal(vehiculos: any[], ots: any[]) {
  const hoy = new Date();
  
  // Mes actual
  const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const metricsActual = buildFlotaDashboardMetrics({
    vehiculos,
    ots,
    dateFrom: inicioMesActual.toISOString().split('T')[0],
    dateTo: hoy.toISOString().split('T')[0]
  });

  // Mes anterior
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const metricsAnterior = buildFlotaDashboardMetrics({
    vehiculos,
    ots,
    dateFrom: inicioMesAnterior.toISOString().split('T')[0],
    dateTo: finMesAnterior.toISOString().split('T')[0]
  });

  console.log('=== COMPARATIVA MES ACTUAL vs ANTERIOR ===');
  console.log('\nCosto Total:');
  console.log('  Actual:', formatCurrency(metricsActual.kpis.costoTotal));
  console.log('  Anterior:', formatCurrency(metricsAnterior.kpis.costoTotal));
  console.log('  Variación:', formatCurrency(metricsActual.kpis.costoTotal - metricsAnterior.kpis.costoTotal));

  console.log('\nSLA:');
  console.log('  Actual:', formatPercentage(metricsActual.kpis.slaCumplimientoPct));
  console.log('  Anterior:', formatPercentage(metricsAnterior.kpis.slaCumplimientoPct));
  console.log('  Variación:', formatNumber(metricsActual.kpis.slaCumplimientoPct - metricsAnterior.kpis.slaCumplimientoPct, 1), 'pp');

  const mttrActual = metricsActual.kpis.mttrHoras || 0;
  const mttrAnterior = metricsAnterior.kpis.mttrHoras || 0;
  console.log('\nMTTR:');
  console.log('  Actual:', formatNumber(mttrActual, 1), 'h');
  console.log('  Anterior:', formatNumber(mttrAnterior, 1), 'h');
  console.log('  Variación:', formatNumber(mttrActual - mttrAnterior, 1), 'h');
}

// ============================================================================
// EJEMPLO 7: DETECCIÓN DE ANOMALÍAS
// ============================================================================

function ejemplo7_DeteccionAnomalias(vehiculos: any[], ots: any[]) {
  const metrics = buildFlotaDashboardMetrics({ vehiculos, ots });

  console.log('=== DETECCIÓN DE ANOMALÍAS ===');

  // Disponibilidad baja
  if (metrics.kpis.disponibilidadPct < 70) {
    console.log('⚠️  ALERTA: Disponibilidad baja (<70%)', formatPercentage(metrics.kpis.disponibilidadPct));
  }

  // SLA bajo
  if (metrics.kpis.slaCumplimientoPct < 80) {
    console.log('⚠️  ALERTA: SLA bajo (<80%)', formatPercentage(metrics.kpis.slaCumplimientoPct));
  }

  // MTTR alto (más de 8 horas)
  if (metrics.kpis.mttrHoras && metrics.kpis.mttrHoras > 8) {
    console.log('⚠️  ALERTA: MTTR alto (>8h)', formatNumber(metrics.kpis.mttrHoras, 1), 'horas');
  }

  // Talleres con bajo performance
  const talleresConProblemas = metrics.rankingTalleres.filter(t => t.slaPct < 60);
  if (talleresConProblemas.length > 0) {
    console.log('⚠️  ALERTA: Talleres con SLA <60%:');
    talleresConProblemas.forEach(t => {
      console.log(`   - ${t.nombre}: ${formatPercentage(t.slaPct)}`);
    });
  }

  // Fallas recurrentes
  const fallasRecurrentes = metrics.topFallas.filter(f => f.count >= 5);
  if (fallasRecurrentes.length > 0) {
    console.log('⚠️  ALERTA: Fallas recurrentes (≥5 veces):');
    fallasRecurrentes.forEach(f => {
      console.log(`   - ${f.key}: ${f.count} veces`);
    });
  }
}

// ============================================================================
// EJEMPLO 8: EXPORT PARA REPORTE
// ============================================================================

function ejemplo8_ExportReporte(vehiculos: any[], ots: any[]) {
  const metrics = buildFlotaDashboardMetrics({ vehiculos, ots });

  // Objeto serializable para export a JSON/PDF
  const reporte = {
    fechaGeneracion: new Date().toISOString(),
    periodo: 'Completo',
    kpis: {
      totalVehiculos: metrics.kpis.totalVehiculos,
      disponibilidad: formatPercentage(metrics.kpis.disponibilidadPct),
      mttr: metrics.kpis.mttrHoras ? `${formatNumber(metrics.kpis.mttrHoras, 1)} horas` : 'N/A',
      mtbf: metrics.kpis.mtbfKm ? `${formatNumber(metrics.kpis.mtbfKm)} km` : 'N/A',
      costoTotal: formatCurrency(metrics.kpis.costoTotal),
      slaCumplimiento: formatPercentage(metrics.kpis.slaCumplimientoPct)
    },
    talleres: metrics.rankingTalleres.map(t => ({
      nombre: t.nombre,
      tipo: t.tipo,
      ots: t.otsCount,
      sla: formatPercentage(t.slaPct),
      mttr: t.mttrHoras ? `${formatNumber(t.mttrHoras, 1)}h` : 'N/A',
      costoTotal: formatCurrency(t.costoTotal),
      costoPromedio: formatCurrency(t.costoPromedio)
    })),
    topFallas: metrics.topFallas.slice(0, 10).map(f => ({
      descripcion: f.key,
      ocurrencias: f.count,
      costo: formatCurrency(f.costoTotal)
    })),
    topPiezas: metrics.topPiezas.slice(0, 10).map(p => ({
      descripcion: p.key,
      cantidad: p.cantidadTotal,
      costo: formatCurrency(p.costoTotal)
    }))
  };

  console.log('=== REPORTE EXPORTABLE ===');
  console.log(JSON.stringify(reporte, null, 2));

  return reporte;
}

// ============================================================================
// EJEMPLO 9: HELPERS DE FORMATEO
// ============================================================================

function ejemplo9_FormateoDatos() {
  console.log('=== HELPERS DE FORMATEO ===');
  
  // Moneda
  console.log('Costo:', formatCurrency(1234.56)); // $1,234.56
  console.log('Costo:', formatCurrency(0)); // $0.00
  console.log('Costo:', formatCurrency(1000000)); // $1,000,000.00

  // Porcentaje
  console.log('Porcentaje:', formatPercentage(85.5)); // 85.5%
  console.log('Porcentaje:', formatPercentage(100)); // 100.0%
  console.log('Porcentaje:', formatPercentage(0)); // 0.0%

  // Números
  console.log('Entero:', formatNumber(1234567)); // 1,234,567
  console.log('Decimal 1:', formatNumber(1234.5678, 1)); // 1,234.6
  console.log('Decimal 2:', formatNumber(1234.5678, 2)); // 1,234.57
}

// ============================================================================
// EJEMPLO 10: CASO DE USO REAL EN UI
// ============================================================================

function ejemplo10_UsoCasoRealUI(vehiculos: any[], ots: any[]) {
  // Simular filtros de usuario
  const filtrosUsuario = {
    dateFrom: '2024-12-01',
    dateTo: '2024-12-31',
    tipoOT: 'correctivo' as const,
    tallerNombre: undefined
  };

  // Calcular métricas con filtros
  const metrics = buildFlotaDashboardMetrics({
    vehiculos,
    ots,
    ...filtrosUsuario
  });

  // Preparar datos para UI
  const uiData = {
    // KPIs Cards
    kpiCards: [
      {
        title: 'Total Vehículos',
        value: metrics.kpis.totalVehiculos,
        format: 'number',
        icon: 'Truck'
      },
      {
        title: 'Disponibilidad',
        value: metrics.kpis.disponibilidadPct,
        format: 'percentage',
        icon: 'TrendingUp',
        color: metrics.kpis.disponibilidadPct >= 80 ? 'green' : 'yellow'
      },
      {
        title: 'MTTR',
        value: metrics.kpis.mttrHoras,
        format: 'hours',
        icon: 'Timer',
        suffix: 'horas'
      },
      {
        title: 'Costo Total',
        value: metrics.kpis.costoTotal,
        format: 'currency',
        icon: 'DollarSign'
      }
    ],
    
    // Tabla de talleres
    talleresTable: metrics.rankingTalleres.map((t, index) => ({
      rank: index + 1,
      nombre: t.nombre,
      tipo: t.tipo,
      ots: t.otsCount,
      sla: t.slaPct,
      slaFormatted: formatPercentage(t.slaPct),
      slaColor: t.slaPct >= 80 ? 'green' : t.slaPct >= 60 ? 'yellow' : 'red',
      mttr: t.mttrHoras ? formatNumber(t.mttrHoras, 1) : 'N/A',
      costoTotal: formatCurrency(t.costoTotal),
      costoPromedio: formatCurrency(t.costoPromedio)
    })),
    
    // Lista de fallas
    fallasLista: metrics.topFallas.map((f, index) => ({
      rank: index + 1,
      descripcion: f.key,
      count: f.count,
      costo: formatCurrency(f.costoTotal),
      costoPorOcurrencia: formatCurrency(f.costoTotal / f.count)
    })),
    
    // Estado de carga
    loading: false,
    error: null,
    
    // Metadata
    metadata: {
      filtrosAplicados: Object.values(filtrosUsuario).filter(Boolean).length,
      ultimaActualizacion: new Date().toISOString()
    }
  };

  console.log('=== DATOS PREPARADOS PARA UI ===');
  console.log('KPI Cards:', uiData.kpiCards.length);
  console.log('Talleres en tabla:', uiData.talleresTable.length);
  console.log('Fallas listadas:', uiData.fallasLista.length);
  console.log('Filtros aplicados:', uiData.metadata.filtrosAplicados);

  return uiData;
}

// ============================================================================
// EXPORTS (NO USAR EN PRODUCCIÓN)
// ============================================================================

export const EJEMPLOS = {
  ejemplo1_UsoBasicoSinFiltros,
  ejemplo2_FiltrosPorFecha,
  ejemplo3_FiltroPorTipo,
  ejemplo4_FiltroPorTaller,
  ejemplo5_FuncionesIndividuales,
  ejemplo6_ComparativaTemporal,
  ejemplo7_DeteccionAnomalias,
  ejemplo8_ExportReporte,
  ejemplo9_FormateoDatos,
  ejemplo10_UsoCasoRealUI
};

/**
 * NOTAS DE USO:
 * 
 * 1. Este archivo NO debe importarse en producción
 * 2. Es solo para documentación y referencia
 * 3. Todos los ejemplos asumen que vehiculos y ots vienen de los stores
 * 4. Para usar en UI real, ver FlotaDashboard.tsx como referencia
 */
