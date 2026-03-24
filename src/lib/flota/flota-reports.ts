/**
 * Memphis ERP - Flota → Reportes
 * Lógica pura para generación de reportes enterprise
 * 
 * v1.0.0
 */

import { Vehiculo, VehiculoDocumento, calcEstadoDocumento, calcDiasRestantesDocumento, TipoVehiculo, EstadoVehiculo, TipoDocumentoVehiculo } from './vehiculos-config';
import { OrdenTrabajo } from './ot-store';
import { TipoOT, CriticidadOT, EstadoOT } from './ot-config';

// ============================================================================
// TYPES - REPORTE VEHÍCULOS
// ============================================================================

export interface VehiculosReportFilters {
  busqueda?: string; // placa, marca, modelo
  estado?: EstadoVehiculo;
  tipo?: TipoVehiculo;
  clienteProyecto?: string; // búsqueda en vinculoContrato
  soloConDocsVencidos?: boolean;
  soloConPreventivosPoragotarse?: boolean; // restantes <= 1
}

export interface VehiculoReportRow {
  placa: string;
  marca: string;
  modelo: string;
  año: number;
  tipo: string;
  clienteProyecto: string; // "Cliente X / Proyecto Y" o "N/A"
  contratoTipo: string;
  contratoFechaFin: string;
  kilometraje: number;
  preventivosTotal: number;
  preventivosUsados: number;
  preventivosRestantes: number;
  docsVigentes: number;
  docsProximos: number;
  docsVencidos: number;
  estado: string;
}

export interface VehiculosReportKPIs {
  total: number;
  porEstado: Record<string, number>;
  porTipo: Record<string, number>;
  conDocsVencidos: number;
  conDocsProximos: number;
  preventivosRestantesCriticos: number; // <= 1
}

// ============================================================================
// TYPES - REPORTE MANTENIMIENTOS
// ============================================================================

export interface OTsReportFilters {
  dateFrom?: string;
  dateTo?: string;
  estado?: EstadoOT;
  tipo?: TipoOT;
  criticidad?: CriticidadOT;
  taller?: string;
  placa?: string;
  soloConExtras?: boolean;
  soloCerradas?: boolean;
}

export interface OTReportRow {
  numeroOT: string;
  placa: string;
  tipo: string;
  criticidad: string;
  estado: string;
  taller: string;
  fechaProgramada: string;
  fechaInicio?: string;
  fechaCierre?: string;
  slaEstimado: number; // horas
  slaReal?: number; // horas (solo si cerrada)
  costoTotal: number;
  extrasPiezas: number;
  extrasServicios: number;
  extrasCosto: number;
  observaciones: string;
}

export interface OTsReportKPIs {
  total: number;
  porEstado: Record<string, number>;
  porTipo: Record<string, number>;
  porCriticidad: Record<string, number>;
  costoTotal: number;
  extrasPiezas: number;
  extrasServicios: number;
  slaCumplimiento: number; // % (solo cerradas)
}

// ============================================================================
// TYPES - REPORTE DOCUMENTOS
// ============================================================================

export interface DocumentosReportFilters {
  clienteProyecto?: string;
  tipoDocumento?: TipoDocumentoVehiculo;
  estadoDocumento?: 'vigente' | 'proximo' | 'vencido';
  vencimientoFrom?: string; // ISO date
  vencimientoTo?: string; // ISO date
}

export interface DocReportRow {
  placa: string;
  clienteProyecto: string;
  tipoDoc: string;
  nombre: string;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: string;
  diasRestantes: number;
}

export interface DocumentosReportKPIs {
  total: number;
  vigentes: number;
  proximos: number;
  vencidos: number;
  porTipoDocumento: Record<string, number>;
}

// ============================================================================
// REPORTE VEHÍCULOS
// ============================================================================

/**
 * Construye filas del reporte de vehículos
 */
export function buildVehiculosReportRows(
  vehiculos: Vehiculo[],
  filters: VehiculosReportFilters
): VehiculoReportRow[] {
  let filtered = vehiculos;

  // Búsqueda
  if (filters.busqueda) {
    const search = filters.busqueda.toLowerCase().trim();
    filtered = filtered.filter(v =>
      v.placa.toLowerCase().includes(search) ||
      v.marca.toLowerCase().includes(search) ||
      v.modelo.toLowerCase().includes(search)
    );
  }

  // Estado
  if (filters.estado) {
    filtered = filtered.filter(v => v.estado === filters.estado);
  }

  // Tipo
  if (filters.tipo) {
    filtered = filtered.filter(v => v.tipo === filters.tipo);
  }

  // Cliente/Proyecto
  if (filters.clienteProyecto) {
    const search = filters.clienteProyecto.toLowerCase().trim();
    filtered = filtered.filter(v => {
      if (!v.vinculoContrato) return false;
      const combined = `${v.vinculoContrato.clienteNombre} ${v.vinculoContrato.proyectoNombre}`.toLowerCase();
      return combined.includes(search);
    });
  }

  // Construir rows
  const rows: VehiculoReportRow[] = filtered.map(v => {
    // Cliente/Proyecto
    const clienteProyecto = v.vinculoContrato
      ? `${v.vinculoContrato.clienteNombre} / ${v.vinculoContrato.proyectoNombre}`
      : 'N/A';

    // Preventivos
    const plan = v.planPreventivoContratado;
    const preventivosTotal = plan?.totalPreventivosContratados || 0;
    const preventivosUsados = 0; // TODO: calcular desde OTs preventivas cerradas
    const preventivosRestantes = Math.max(0, preventivosTotal - preventivosUsados);

    // Documentos (usar documentosVehiculo nuevo o documentos legacy)
    const docs = v.documentosVehiculo || [];
    let docsVigentes = 0;
    let docsProximos = 0;
    let docsVencidos = 0;

    docs.forEach(doc => {
      const estado = calcEstadoDocumento(doc.fechaVencimiento);
      if (estado === 'vigente') docsVigentes++;
      else if (estado === 'proximo') docsProximos++;
      else if (estado === 'vencido') docsVencidos++;
    });

    return {
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      año: v.año,
      tipo: v.tipo,
      clienteProyecto,
      contratoTipo: v.vinculoContrato?.tipoContrato || 'N/A',
      contratoFechaFin: v.vinculoContrato?.fechaFin || 'N/A',
      kilometraje: v.kilometraje,
      preventivosTotal,
      preventivosUsados,
      preventivosRestantes,
      docsVigentes,
      docsProximos,
      docsVencidos,
      estado: v.estado
    };
  });

  // Filtros post-agregación
  let finalRows = rows;

  if (filters.soloConDocsVencidos) {
    finalRows = finalRows.filter(r => r.docsVencidos > 0);
  }

  if (filters.soloConPreventivosPoragotarse) {
    finalRows = finalRows.filter(r => r.preventivosRestantes <= 1 && r.preventivosTotal > 0);
  }

  return finalRows;
}

/**
 * Calcula KPIs del reporte de vehículos
 */
export function calcVehiculosReportKPIs(rows: VehiculoReportRow[]): VehiculosReportKPIs {
  const total = rows.length;

  // Por estado
  const porEstado: Record<string, number> = {};
  rows.forEach(r => {
    porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
  });

  // Por tipo
  const porTipo: Record<string, number> = {};
  rows.forEach(r => {
    porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
  });

  // Docs
  const conDocsVencidos = rows.filter(r => r.docsVencidos > 0).length;
  const conDocsProximos = rows.filter(r => r.docsProximos > 0).length;

  // Preventivos críticos
  const preventivosRestantesCriticos = rows.filter(r => 
    r.preventivosRestantes <= 1 && r.preventivosTotal > 0
  ).length;

  return {
    total,
    porEstado,
    porTipo,
    conDocsVencidos,
    conDocsProximos,
    preventivosRestantesCriticos
  };
}

// ============================================================================
// REPORTE MANTENIMIENTOS (OTs)
// ============================================================================

/**
 * Construye filas del reporte de OTs
 */
export function buildOTsReportRows(
  ots: OrdenTrabajo[],
  vehiculos: Vehiculo[],
  filters: OTsReportFilters
): OTReportRow[] {
  let filtered = ots;

  // Fechas (usar fechaProgramada)
  if (filters.dateFrom) {
    filtered = filtered.filter(ot => ot.fechaProgramada >= filters.dateFrom!);
  }

  if (filters.dateTo) {
    filtered = filtered.filter(ot => ot.fechaProgramada <= filters.dateTo!);
  }

  // Estado
  if (filters.estado) {
    filtered = filtered.filter(ot => ot.estado === filters.estado);
  }

  // Tipo
  if (filters.tipo) {
    filtered = filtered.filter(ot => ot.tipo === filters.tipo);
  }

  // Criticidad
  if (filters.criticidad) {
    filtered = filtered.filter(ot => ot.criticidad === filters.criticidad);
  }

  // Taller
  if (filters.taller) {
    filtered = filtered.filter(ot => ot.taller.nombre === filters.taller);
  }

  // Placa
  if (filters.placa) {
    const search = filters.placa.toLowerCase().trim();
    filtered = filtered.filter(ot => ot.vehiculoPlaca.toLowerCase().includes(search));
  }

  // Solo cerradas
  if (filters.soloCerradas) {
    filtered = filtered.filter(ot => ot.estado === 'cerrada');
  }

  // Construir rows
  const rows: OTReportRow[] = filtered.map(ot => {
    // Extras
    const extrasActivos = ot.extras.filter(e => !e.eliminado);
    const extrasPiezas = extrasActivos.filter(e => e.tipo === 'pieza').length;
    const extrasServicios = extrasActivos.filter(e => e.tipo === 'servicio').length;
    const extrasCosto = extrasActivos.reduce((sum, e) => sum + e.costoTotal, 0);

    // Costo total (base + extras)
    const costoBase = (ot.costos?.manoObra || 0) + (ot.costos?.repuestos || 0) + (ot.costos?.otros || 0);
    const costoTotal = costoBase + extrasCosto;

    // SLA
    const slaEstimado = ot.slaEstimadoHoras || 0;
    let slaReal: number | undefined;

    if (ot.estado === 'cerrada' && ot.fechaInicio && ot.fechaCierre) {
      const inicio = new Date(ot.fechaInicio).getTime();
      const cierre = new Date(ot.fechaCierre).getTime();
      slaReal = (cierre - inicio) / (1000 * 60 * 60); // horas
    }

    return {
      numeroOT: ot.numeroOT,
      placa: ot.vehiculoPlaca,
      tipo: ot.tipo,
      criticidad: ot.criticidad,
      estado: ot.estado,
      taller: ot.taller.nombre,
      fechaProgramada: ot.fechaProgramada,
      fechaInicio: ot.fechaInicio,
      fechaCierre: ot.fechaCierre,
      slaEstimado,
      slaReal,
      costoTotal,
      extrasPiezas,
      extrasServicios,
      extrasCosto,
      observaciones: ot.observaciones || ''
    };
  });

  // Filtro post-agregación: solo con extras
  let finalRows = rows;

  if (filters.soloConExtras) {
    finalRows = finalRows.filter(r => r.extrasPiezas > 0 || r.extrasServicios > 0);
  }

  return finalRows;
}

/**
 * Calcula KPIs del reporte de OTs
 */
export function calcOTsReportKPIs(rows: OTReportRow[]): OTsReportKPIs {
  const total = rows.length;

  // Por estado
  const porEstado: Record<string, number> = {};
  rows.forEach(r => {
    porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
  });

  // Por tipo
  const porTipo: Record<string, number> = {};
  rows.forEach(r => {
    porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
  });

  // Por criticidad
  const porCriticidad: Record<string, number> = {};
  rows.forEach(r => {
    porCriticidad[r.criticidad] = (porCriticidad[r.criticidad] || 0) + 1;
  });

  // Costos
  const costoTotal = rows.reduce((sum, r) => sum + r.costoTotal, 0);
  const extrasPiezas = rows.reduce((sum, r) => sum + r.extrasPiezas, 0);
  const extrasServicios = rows.reduce((sum, r) => sum + r.extrasServicios, 0);

  // SLA Cumplimiento (solo cerradas con SLA real)
  const cerradasConSLA = rows.filter(r => r.estado === 'cerrada' && r.slaReal !== undefined);
  const cumplidas = cerradasConSLA.filter(r => r.slaReal! <= r.slaEstimado);
  const slaCumplimiento = cerradasConSLA.length > 0
    ? (cumplidas.length / cerradasConSLA.length) * 100
    : 0;

  return {
    total,
    porEstado,
    porTipo,
    porCriticidad,
    costoTotal,
    extrasPiezas,
    extrasServicios,
    slaCumplimiento
  };
}

// ============================================================================
// REPORTE DOCUMENTOS
// ============================================================================

/**
 * Construye filas del reporte de documentos
 */
export function buildDocumentosReportRows(
  vehiculos: Vehiculo[],
  filters: DocumentosReportFilters
): DocReportRow[] {
  const rows: DocReportRow[] = [];

  vehiculos.forEach(v => {
    const docs = v.documentosVehiculo || [];
    const clienteProyecto = v.vinculoContrato
      ? `${v.vinculoContrato.clienteNombre} / ${v.vinculoContrato.proyectoNombre}`
      : 'N/A';

    docs.forEach(doc => {
      const estado = calcEstadoDocumento(doc.fechaVencimiento);
      const diasRestantes = calcDiasRestantesDocumento(doc.fechaVencimiento);

      // Aplicar filtros
      if (filters.tipoDocumento && doc.tipo !== filters.tipoDocumento) {
        return;
      }

      if (filters.estadoDocumento && estado !== filters.estadoDocumento) {
        return;
      }

      if (filters.vencimientoFrom && doc.fechaVencimiento < filters.vencimientoFrom) {
        return;
      }

      if (filters.vencimientoTo && doc.fechaVencimiento > filters.vencimientoTo) {
        return;
      }

      if (filters.clienteProyecto) {
        const search = filters.clienteProyecto.toLowerCase().trim();
        if (!clienteProyecto.toLowerCase().includes(search)) {
          return;
        }
      }

      rows.push({
        placa: v.placa,
        clienteProyecto,
        tipoDoc: doc.tipo,
        nombre: doc.nombre,
        fechaEmision: doc.fechaEmision || 'N/A',
        fechaVencimiento: doc.fechaVencimiento,
        estado,
        diasRestantes
      });
    });
  });

  return rows;
}

/**
 * Calcula KPIs del reporte de documentos
 */
export function calcDocumentosReportKPIs(rows: DocReportRow[]): DocumentosReportKPIs {
  const total = rows.length;
  const vigentes = rows.filter(r => r.estado === 'vigente').length;
  const proximos = rows.filter(r => r.estado === 'proximo').length;
  const vencidos = rows.filter(r => r.estado === 'vencido').length;

  // Por tipo documento
  const porTipoDocumento: Record<string, number> = {};
  rows.forEach(r => {
    porTipoDocumento[r.tipoDoc] = (porTipoDocumento[r.tipoDoc] || 0) + 1;
  });

  return {
    total,
    vigentes,
    proximos,
    vencidos,
    porTipoDocumento
  };
}