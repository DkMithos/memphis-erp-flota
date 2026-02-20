/**
 * VEHICLE PUBLIC VIEW - Helpers
 * Funciones puras para la vista pública del vehículo (QR)
 * Solo expone información no sensible
 */

import { Vehiculo, DocumentoVehiculo, EstadoDocumento } from './vehiculos-config';
import { OrdenTrabajo } from './ot-store';

// ============================================================================
// TYPES
// ============================================================================

export type EstadoMantenimiento = 'vigente' | 'proximo' | 'vencido';

export interface MaintenanceStatus {
  estado: EstadoMantenimiento;
  kmActual: number;
  kmProximo: number;
  kmRestantes: number;
  mensaje: string;
}

export interface DocumentStatus {
  estado: EstadoDocumento;
  diasRestantes: number | null;
  mensaje: string;
}

export interface ComplianceMetrics {
  cumplimientoPreventivo: number; // 0-100%
  cumplimientoDocumental: number; // 0-100%
  disponibilidad: number; // 0-100%
}

// ============================================================================
// HELPERS: MANTENIMIENTO
// ============================================================================

/**
 * Calcula estado de mantenimiento por kilometraje
 * 
 * @param kmActual - Kilometraje actual del vehículo
 * @param kmProximo - Kilometraje del próximo mantenimiento
 * @param umbralKm - Umbral de km para considerar "próximo" (default: 1000)
 * @returns Estado del mantenimiento
 */
export function calcMaintenanceStatusByKm(
  kmActual: number,
  kmProximo: number,
  umbralKm: number = 1000
): MaintenanceStatus {
  const kmRestantes = kmProximo - kmActual;

  let estado: EstadoMantenimiento;
  let mensaje: string;

  if (kmRestantes < 0) {
    estado = 'vencido';
    mensaje = `Mantenimiento vencido hace ${Math.abs(kmRestantes)} km`;
  } else if (kmRestantes <= umbralKm) {
    estado = 'proximo';
    mensaje = `Próximo mantenimiento en ${kmRestantes} km`;
  } else {
    estado = 'vigente';
    mensaje = `Próximo mantenimiento en ${kmRestantes} km`;
  }

  return {
    estado,
    kmActual,
    kmProximo,
    kmRestantes,
    mensaje
  };
}

/**
 * Calcula estado de documento por fecha de vencimiento
 * 
 * @param fechaVencimiento - Fecha de vencimiento del documento (ISO)
 * @param umbralDias - Umbral de días para considerar "próximo a vencer" (default: 30)
 * @returns Estado del documento
 */
export function calcDocStatusByDate(
  fechaVencimiento: string,
  umbralDias: number = 30
): DocumentStatus {
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let estado: EstadoDocumento;
  let mensaje: string;

  if (diasRestantes < 0) {
    estado = 'vencido';
    mensaje = `Vencido hace ${Math.abs(diasRestantes)} días`;
  } else if (diasRestantes <= umbralDias) {
    estado = 'proximo_a_vencer';
    mensaje = `Vence en ${diasRestantes} días`;
  } else {
    estado = 'vigente';
    mensaje = `Vigente por ${diasRestantes} días`;
  }

  return {
    estado,
    diasRestantes,
    mensaje
  };
}

/**
 * Calcula porcentaje de cumplimiento de mantenimientos preventivos
 * 
 * @param realizados - Número de preventivos realizados
 * @param total - Total de preventivos contratados
 * @returns Porcentaje de cumplimiento (0-100)
 */
export function calcCompliancePreventivo(realizados: number, total: number): number {
  if (total === 0) return 100; // Si no hay plan, se considera 100%
  const porcentaje = (realizados / total) * 100;
  return Math.min(100, Math.round(porcentaje));
}

/**
 * Calcula porcentaje de cumplimiento documental
 * 
 * @param vigentes - Número de documentos vigentes
 * @param totalDocs - Total de documentos del vehículo
 * @returns Porcentaje de cumplimiento (0-100)
 */
export function calcComplianceDocs(vigentes: number, totalDocs: number): number {
  if (totalDocs === 0) return 100; // Si no hay documentos, se considera 100%
  const porcentaje = (vigentes / totalDocs) * 100;
  return Math.round(porcentaje);
}

/**
 * Calcula disponibilidad del vehículo
 * Basado en estado operativo y cumplimiento
 * 
 * @param vehiculo - Vehículo
 * @param cumplimientoPreventivo - % de cumplimiento de preventivos
 * @param cumplimientoDocumental - % de cumplimiento documental
 * @returns Porcentaje de disponibilidad (0-100)
 */
export function calcAvailability(
  vehiculo: Vehiculo,
  cumplimientoPreventivo: number,
  cumplimientoDocumental: number
): number {
  // Si está inactivo, disponibilidad 0%
  if (vehiculo.estado === 'inactivo') return 0;

  // Si está en taller, disponibilidad reducida
  if (vehiculo.estado === 'en_taller') return 30;

  // Si está activo, calcular basado en cumplimiento
  // Peso: 60% documental (crítico), 40% preventivos
  const disponibilidad = (cumplimientoDocumental * 0.6) + (cumplimientoPreventivo * 0.4);
  return Math.round(disponibilidad);
}

// ============================================================================
// HELPERS: RESUMEN HISTORIAL
// ============================================================================

/**
 * Obtiene historial resumido de mantenimientos (últimos N)
 * Sin información sensible (sin costos)
 * 
 * @param ots - Todas las OTs
 * @param vehiculoId - ID del vehículo
 * @param limit - Cantidad de registros a retornar (default: 3)
 * @returns Historial resumido
 */
export function getRecentMaintenanceHistory(
  ots: OrdenTrabajo[] = [], // Default a array vacío si es undefined
  vehiculoId: string,
  limit: number = 3
) {
  return ots
    .filter(ot => ot.vehiculoId === vehiculoId && ot.estado === 'cerrada')
    .sort((a, b) => {
      const fechaA = a.fechaCierre || a.fechaCreacion;
      const fechaB = b.fechaCierre || b.fechaCreacion;
      return new Date(fechaB).getTime() - new Date(fechaA).getTime();
    })
    .slice(0, limit)
    .map(ot => ({
      numeroOT: ot.numeroOT,
      tipo: ot.tipo,
      fecha: ot.fechaCierre || ot.fechaCreacion,
      kilometraje: ot.kilometrajeRegistro,
      taller: ot.taller.nombre,
      descripcion: ot.titulo
    }));
}

// ============================================================================
// HELPERS: GENERACIÓN DE TOKEN
// ============================================================================

/**
 * Genera token único para vista pública (UUID simulado)
 * Basado en ID del vehículo para idempotencia
 * 
 * @param vehiculoId - ID del vehículo (VH-001, etc.)
 * @returns Token único (formato UUID-like)
 */
export function generatePublicToken(vehiculoId: string): string {
  // Genera un token pseudo-UUID basado en el ID para idempotencia
  // En producción, usar crypto.randomUUID() o similar
  const base = vehiculoId.replace(/[^0-9]/g, '').padStart(8, '0');
  const part1 = base.substring(0, 8);
  const part2 = `4${base.substring(1, 4)}`; // versión 4 UUID
  const part3 = `a${base.substring(4, 7)}`; // variante 10
  const part4 = base.substring(0, 4);
  const part5 = base.substring(0, 12).padEnd(12, '0');
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

/**
 * Encuentra vehículo por token público
 * 
 * @param vehiculos - Lista de vehículos
 * @param token - Token público
 * @returns Vehículo encontrado o undefined
 */
export function findVehicleByToken(vehiculos: Vehiculo[], token: string): Vehiculo | undefined {
  return vehiculos.find(v => v.publicToken === token);
}

// ============================================================================
// HELPERS: QR URL
// ============================================================================

/**
 * Genera URL pública para QR del vehículo (nueva versión con token)
 * 
 * @param publicToken - Token público del vehículo
 * @param baseUrl - URL base del sistema (opcional, default: window.location.origin)
 * @returns URL completa para QR
 */
export function generateVehicleQRUrl(publicToken: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/v/${publicToken}`;
}

/**
 * Genera URL de impresión de QR (legacy, mantiene ID interno)
 * 
 * @param vehiculoId - ID del vehículo
 * @returns Ruta relativa para navegación interna
 */
export function generatePrintQRUrl(vehiculoId: string): string {
  return `/public/vehiculo/${vehiculoId}/print-qr`;
}