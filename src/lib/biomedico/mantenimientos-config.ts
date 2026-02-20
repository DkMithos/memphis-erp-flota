/**
 * CONFIGURACIÓN CENTRALIZADA - MANTENIMIENTOS BIOMÉDICOS
 * Single source of truth para estados y tipos de mantenimientos
 * Reutiliza patrón de OT de Flota sin SLA ni costos complejos
 */

import { 
  Clock, 
  Wrench, 
  Activity,
  CheckCircle, 
  XCircle,
  AlertTriangle,
  type LucideIcon
} from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_MANTENIMIENTO_BIO = true;

// ============================================================================
// TIPOS DE ESTADO Y MANTENIMIENTO - Estandarizados
// ============================================================================

export type EstadoMantenimientoBio = 
  | 'programado' 
  | 'en_ejecucion' 
  | 'completado' 
  | 'cancelado';

export type TipoMantenimientoBio = 
  | 'preventivo' 
  | 'correctivo' 
  | 'calibracion';

export type PrioridadMantenimientoBio = 
  | 'baja' 
  | 'media' 
  | 'alta' 
  | 'urgente';

// ============================================================================
// CONFIGURACIÓN DE BADGES - WCAG AA Compliant
// ============================================================================

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}

/**
 * Configuración de badges para estados de mantenimientos
 */
export const MANTENIMIENTO_ESTADO_CONFIG: Record<EstadoMantenimientoBio, BadgeConfig> = {
  programado: {
    label: 'Programado',
    icon: Clock,
    variant: 'outline',
    className: 'text-blue-600 border-blue-600'
  },
  en_ejecucion: {
    label: 'En Ejecución',
    icon: Wrench,
    variant: 'default',
    className: 'bg-primary text-primary-foreground'
  },
  completado: {
    label: 'Completado',
    icon: CheckCircle,
    variant: 'outline',
    className: 'text-green-600 border-green-600'
  },
  cancelado: {
    label: 'Cancelado',
    icon: XCircle,
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

/**
 * Configuración de badges para tipos de mantenimiento
 */
export const MANTENIMIENTO_TIPO_CONFIG: Record<TipoMantenimientoBio, { label: string; className: string }> = {
  preventivo: {
    label: 'Preventivo',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  correctivo: {
    label: 'Correctivo',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  calibracion: {
    label: 'Calibración',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  }
};

/**
 * Configuración de badges para prioridad
 */
export const MANTENIMIENTO_PRIORIDAD_CONFIG: Record<PrioridadMantenimientoBio, BadgeConfig> = {
  baja: {
    label: 'Baja',
    icon: AlertTriangle,
    variant: 'outline',
    className: 'text-gray-600 border-gray-300'
  },
  media: {
    label: 'Media',
    icon: AlertTriangle,
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  alta: {
    label: 'Alta',
    icon: AlertTriangle,
    variant: 'default',
    className: 'bg-yellow-600 text-white'
  },
  urgente: {
    label: 'Urgente',
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-destructive text-destructive-foreground'
  }
};

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Genera un número de mantenimiento biomédico secuencial
 * Formato: MB-YYYY-XXX
 */
export function generarNumeroMantenimiento(ultimoNumero?: number): string {
  const year = new Date().getFullYear();
  const numero = (ultimoNumero || 0) + 1;
  const numeroFormateado = numero.toString().padStart(3, '0');
  return `MB-${year}-${numeroFormateado}`;
}

/**
 * Valida si un string tiene formato de número de mantenimiento válido
 */
export function validarNumeroMantenimiento(numero: string): boolean {
  const regex = /^MB-\d{4}-\d{3}$/;
  return regex.test(numero);
}

/**
 * Extrae el número secuencial de un número de mantenimiento
 */
export function extraerNumeroSecuencial(numero: string): number | null {
  const match = numero.match(/^MB-\d{4}-(\d{3})$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Determina si un mantenimiento está activo (no completado ni cancelado)
 */
export function isActiveMantenimiento(estado: EstadoMantenimientoBio): boolean {
  return !['completado', 'cancelado'].includes(estado);
}

/**
 * Obtiene el label amigable de un estado
 */
export function obtenerLabelEstado(estado: EstadoMantenimientoBio): string {
  return MANTENIMIENTO_ESTADO_CONFIG[estado]?.label || 'Desconocido';
}

/**
 * Obtiene el label amigable de un tipo
 */
export function obtenerLabelTipo(tipo: TipoMantenimientoBio): string {
  return MANTENIMIENTO_TIPO_CONFIG[tipo]?.label || 'Desconocido';
}

/**
 * Obtiene el label amigable de una prioridad
 */
export function obtenerLabelPrioridad(prioridad: PrioridadMantenimientoBio): string {
  return MANTENIMIENTO_PRIORIDAD_CONFIG[prioridad]?.label || 'Desconocido';
}
