/**
 * VEHICLE LIFECYCLE - Trazabilidad por Activo
 * Funciones puras para hoja de vida de vehículos
 * Soporta multi-nivel: público, cliente, interno
 */

import { Vehiculo } from './vehiculos-config';
import { OrdenTrabajo } from './ot-store';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Plan de preventivos por vehículo
 * Se integra en el tipo Vehiculo (opcional)
 */
export interface PlanPreventivo {
  totalPreventivosContratados: number; // Total de preventivos planificados
  frecuenciaKm?: number; // Cada cuántos km se realiza un preventivo
  frecuenciaDias?: number; // Cada cuántos días se realiza un preventivo
  inicioContrato?: string; // ISO date
  finContrato?: string; // ISO date
}

/**
 * Contadores de preventivos
 */
export interface PreventivoCounters {
  total: number; // Total planificado
  usados: number; // OTs preventivas cerradas
  restantes: number; // total - usados (mín 0)
  porcentajeUso: number; // (usados / total) * 100
}

/**
 * Proyección del próximo preventivo
 */
export interface NextPreventivoProjection {
  // Por kilometraje
  proyeccionKm?: {
    kmActual: number;
    kmProximoPreventivo: number;
    kmRestantes: number;
  };
  // Por fecha
  proyeccionFecha?: {
    fechaUltimoPreventivo: string;
    fechaProximoPreventivo: string;
    diasRestantes: number;
  };
}

/**
 * Resumen público (sanitizado, sin info sensible)
 */
export interface VehiclePublicSummary {
  placa: string;
  marca?: string;
  modelo?: string;
  año?: number;
  estado: 'activo' | 'en_taller' | 'inactivo';
  kilometraje?: number;
  ultimaActualizacion: string;
  proximoMantenimiento?: {
    enKm?: number; // Km restantes
    enDias?: number; // Días restantes
  };
  alertas: string[]; // Mensajes públicos
}

/**
 * Resumen cliente (incluye historial sin costos)
 */
export interface VehicleClientSummary extends VehiclePublicSummary {
  preventivos: PreventivoCounters;
  historialMantenimientos: Array<{
    numeroOT: string;
    tipo: string;
    estado: string;
    fecha: string;
    kilometraje: number;
    taller: string;
  }>;
}

/**
 * Resumen interno (completo con costos y auditoría)
 */
export interface VehicleInternalSummary extends VehicleClientSummary {
  costosTotales: number;
  timeline: Array<{
    fecha: string;
    tipo: 'ot' | 'evento';
    descripcion: string;
    numeroOT?: string;
    costo?: number;
  }>;
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor?: string;
    modificadoEn?: string;
  };
}

// ============================================================================
// HELPERS: PREVENTIVOS
// ============================================================================

/**
 * Calcula contadores de preventivos (total, usados, restantes)
 * 
 * @param vehiculo - Vehículo con plan preventivo
 * @param ots - Lista completa de OTs
 * @returns Contadores de preventivos
 */
export function buildPreventivoCounters(
  vehiculo: Vehiculo & { planPreventivo?: PlanPreventivo },
  ots: OrdenTrabajo[] = [] // Default a array vacío si es undefined
): PreventivoCounters {
  // Total planificado (default 0 si no hay plan)
  const total = vehiculo.planPreventivo?.totalPreventivosContratados || 0;

  // Contar OTs preventivas cerradas de este vehículo
  const usados = ots.filter(
    ot =>
      ot.vehiculoId === vehiculo.id &&
      ot.tipo === 'preventivo' &&
      ot.estado === 'cerrada'
  ).length;

  // Restantes (nunca negativo)
  const restantes = Math.max(0, total - usados);

  // Porcentaje de uso
  const porcentajeUso = total > 0 ? (usados / total) * 100 : 0;

  return {
    total,
    usados,
    restantes,
    porcentajeUso
  };
}

/**
 * Calcula proyección del próximo preventivo
 * 
 * @param vehiculo - Vehículo con plan preventivo
 * @param ots - OTs del vehículo (solo preventivas)
 * @returns Proyección por km y/o fecha
 */
export function getNextPreventivoProjection(
  vehiculo: Vehiculo & { planPreventivo?: PlanPreventivo },
  ots: OrdenTrabajo[] = [] // Default a array vacío si es undefined
): NextPreventivoProjection {
  const projection: NextPreventivoProjection = {};

  // Filtrar OTs preventivas de este vehículo
  const preventivos = ots.filter(
    ot => ot.vehiculoId === vehiculo.id && ot.tipo === 'preventivo'
  );

  // Proyección por kilometraje
  if (vehiculo.planPreventivo?.frecuenciaKm && vehiculo.kilometraje) {
    const frecuenciaKm = vehiculo.planPreventivo.frecuenciaKm;
    const kmActual = vehiculo.kilometraje;

    // Calcular próximo preventivo basado en frecuencia
    const ciclos = Math.floor(kmActual / frecuenciaKm);
    const kmProximoPreventivo = (ciclos + 1) * frecuenciaKm;
    const kmRestantes = kmProximoPreventivo - kmActual;

    projection.proyeccionKm = {
      kmActual,
      kmProximoPreventivo,
      kmRestantes
    };
  }

  // Proyección por fecha
  if (vehiculo.planPreventivo?.frecuenciaDias && preventivos.length > 0) {
    // Obtener último preventivo cerrado
    const ultimoPreventivo = preventivos
      .filter(ot => ot.estado === 'cerrada' && ot.fechaCierre)
      .sort((a, b) => new Date(b.fechaCierre!).getTime() - new Date(a.fechaCierre!).getTime())[0];

    if (ultimoPreventivo && ultimoPreventivo.fechaCierre) {
      const fechaUltimoPreventivo = ultimoPreventivo.fechaCierre;
      const frecuenciaDias = vehiculo.planPreventivo.frecuenciaDias;

      const fechaUltimo = new Date(fechaUltimoPreventivo);
      const fechaProximo = new Date(fechaUltimo);
      fechaProximo.setDate(fechaProximo.getDate() + frecuenciaDias);

      const hoy = new Date();
      const diasRestantes = Math.ceil(
        (fechaProximo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      );

      projection.proyeccionFecha = {
        fechaUltimoPreventivo,
        fechaProximoPreventivo: fechaProximo.toISOString(),
        diasRestantes
      };
    }
  }

  return projection;
}

// ============================================================================
// HELPERS: RESÚMENES POR NIVEL
// ============================================================================

/**
 * Construye resumen PÚBLICO (sin info sensible)
 * 
 * @param vehiculo - Vehículo completo
 * @param ots - OTs del vehículo
 * @returns Resumen público sanitizado
 */
export function buildVehiclePublicSummary(
  vehiculo: Vehiculo & { planPreventivo?: PlanPreventivo },
  ots: OrdenTrabajo[] = [] // Default a array vacío si es undefined
): VehiclePublicSummary {
  const alertas: string[] = [];

  // Verificar si hay mantenimiento vencido
  if (vehiculo.proximoMantenimiento) {
    const hoy = new Date();
    const fechaProximo = new Date(vehiculo.proximoMantenimiento);
    const diasRestantes = Math.ceil(
      (fechaProximo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diasRestantes < 0) {
      alertas.push('Mantenimiento vencido');
    } else if (diasRestantes <= 7) {
      alertas.push('Próximo mantenimiento');
    }
  }

  // Calcular próximo preventivo (solo si hay plan)
  const projection = getNextPreventivoProjection(vehiculo, ots);
  const proximoMantenimiento: VehiclePublicSummary['proximoMantenimiento'] = {};

  if (projection.proyeccionKm) {
    proximoMantenimiento.enKm = projection.proyeccionKm.kmRestantes;
  }

  if (projection.proyeccionFecha) {
    proximoMantenimiento.enDias = projection.proyeccionFecha.diasRestantes;
  }

  return {
    placa: vehiculo.placa,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    año: vehiculo.año,
    estado: vehiculo.estado,
    kilometraje: vehiculo.kilometraje,
    ultimaActualizacion: vehiculo.modificadoEn || vehiculo.creadoEn,
    proximoMantenimiento: Object.keys(proximoMantenimiento).length > 0 ? proximoMantenimiento : undefined,
    alertas
  };
}

/**
 * Construye resumen CLIENTE (incluye preventivos e historial)
 * 
 * @param vehiculo - Vehículo completo
 * @param ots - OTs del vehículo
 * @returns Resumen cliente
 */
export function buildVehicleClientSummary(
  vehiculo: Vehiculo & { planPreventivo?: PlanPreventivo },
  ots: OrdenTrabajo[] = [] // Default a array vacío si es undefined
): VehicleClientSummary {
  const publicSummary = buildVehiclePublicSummary(vehiculo, ots);
  const preventivos = buildPreventivoCounters(vehiculo, ots);

  // Filtrar OTs de este vehículo
  const otsVehiculo = ots.filter(ot => ot.vehiculoId === vehiculo.id);

  // Historial de mantenimientos (sin costos)
  const historialMantenimientos = otsVehiculo
    .map(ot => ({
      numeroOT: ot.numeroOT,
      tipo: ot.tipo.charAt(0).toUpperCase() + ot.tipo.slice(1),
      estado: ot.estado,
      fecha: ot.fechaProgramada || ot.fechaCreacion,
      kilometraje: ot.kilometrajeRegistro,
      taller: ot.taller.nombre
    }))
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return {
    ...publicSummary,
    preventivos,
    historialMantenimientos
  };
}

/**
 * Construye resumen INTERNO (completo con costos y auditoría)
 * 
 * @param vehiculo - Vehículo completo
 * @param ots - OTs del vehículo
 * @returns Resumen interno completo
 */
export function buildVehicleInternalSummary(
  vehiculo: Vehiculo & { planPreventivo?: PlanPreventivo },
  ots: OrdenTrabajo[] = [] // Default a array vacío si es undefined
): VehicleInternalSummary {
  const clientSummary = buildVehicleClientSummary(vehiculo, ots);

  // Filtrar OTs de este vehículo
  const otsVehiculo = ots.filter(ot => ot.vehiculoId === vehiculo.id);

  // Calcular costos totales (base + extras)
  const costosTotales = otsVehiculo.reduce((total, ot) => {
    const costoBase = ot.costos.total;
    const costoExtras = ot.extras
      .filter(e => !e.eliminado)
      .reduce((sum, e) => sum + e.costoTotal, 0);
    return total + costoBase + costoExtras;
  }, 0);

  // Timeline completo (OTs + eventos clave)
  const timeline: VehicleInternalSummary['timeline'] = [];

  // Agregar OTs al timeline
  otsVehiculo.forEach(ot => {
    const costoOT = ot.costos.total + ot.extras
      .filter(e => !e.eliminado)
      .reduce((sum, e) => sum + e.costoTotal, 0);

    timeline.push({
      fecha: ot.fechaProgramada || ot.fechaCreacion,
      tipo: 'ot',
      descripcion: `${ot.tipo.toUpperCase()}: ${ot.titulo}`,
      numeroOT: ot.numeroOT,
      costo: costoOT
    });
  });

  // Agregar evento de creación del vehículo
  timeline.push({
    fecha: vehiculo.creadoEn,
    tipo: 'evento',
    descripcion: 'Vehículo agregado al sistema'
  });

  // Agregar evento de inactivación si aplica
  if (vehiculo.estado === 'inactivo' && vehiculo.inactivadoEn) {
    timeline.push({
      fecha: vehiculo.inactivadoEn,
      tipo: 'evento',
      descripcion: `Vehículo inactivado: ${vehiculo.motivoInactivacion}`
    });
  }

  // Ordenar timeline por fecha descendente
  timeline.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return {
    ...clientSummary,
    costosTotales,
    timeline,
    auditoria: {
      creadoPor: vehiculo.creadoPor,
      creadoEn: vehiculo.creadoEn,
      modificadoPor: vehiculo.modificadoPor,
      modificadoEn: vehiculo.modificadoEn
    }
  };
}

// ============================================================================
// HELPERS: SANITIZACIÓN
// ============================================================================

/**
 * Sanitiza datos para vista pública (elimina info sensible)
 * 
 * @param data - Objeto con datos potencialmente sensibles
 * @returns Objeto sanitizado
 */
export function sanitizeForPublicView<T extends Record<string, any>>(data: T): Partial<T> {
  const sanitized = { ...data };

  // Campos a eliminar en vista pública
  const sensitiveFields = [
    'costos',
    'costosTotales',
    'costoTotal',
    'costoUnitario',
    'auditoria',
    'creadoPor',
    'modificadoPor',
    'observaciones',
    'notasCierre',
    'extras',
    'repuestos'
  ];

  sensitiveFields.forEach(field => {
    delete sanitized[field];
  });

  return sanitized;
}

// ============================================================================
// HELPERS: QR URL
// ============================================================================

/**
 * Genera URL pública para QR del vehículo
 * ACTUALIZADO: Usa token público en lugar de ID interno
 * 
 * @param vehiculoId - ID del vehículo (se busca el token)
 * @param baseUrl - URL base del sistema (opcional, default: window.location.origin)
 * @returns URL completa para QR
 * @deprecated Usar generateVehicleQRUrl de vehicle-public.ts con token
 */
export function generateVehicleQRUrl(vehiculoId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  // NOTA: Esta función es legacy. En la nueva implementación, debe recibir el token directamente
  // Para compatibilidad temporal, retorna la ruta con ID (debe actualizarse en componentes)
  return `${base}/public/vehiculo/${vehiculoId}?mode=public`;
}

/**
 * Genera URL de impresión de QR
 * 
 * @param vehiculoId - ID del vehículo
 * @returns Ruta relativa para navegación
 */
export function generatePrintQRUrl(vehiculoId: string): string {
  return `/public/vehiculo/${vehiculoId}/print-qr`;
}

// ============================================================================
// HELPERS: FORMATEO
// ============================================================================

/**
 * Formatea fecha para display (sin hora)
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatea fecha y hora para display
 */
export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calcula tiempo relativo (ej: "hace 2 días")
 */
export function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
  return `Hace ${Math.floor(diffDays / 365)} años`;
}