/**
 * CONFIGURACIÓN CENTRALIZADA - RECEPCIONES Y CONFORMIDAD
 * Single source of truth para estados y validaciones de recepciones
 * Garantiza consistencia UI/UX en módulo Recepciones
 */

import { Package, CheckCircle, AlertTriangle, Ban, type LucideIcon } from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_RECEPCIONES = true;

// ============================================================================
// TIPOS Y ESTADOS
// ============================================================================

export type EstadoRecepcion = 
  | 'pendiente'    // Recepción pendiente de validación
  | 'conforme'     // Recepción conforme
  | 'observada'    // Recepción con observaciones
  | 'anulada';     // Recepción anulada

// ============================================================================
// CONFIGURACIÓN DE BADGES
// ============================================================================

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const RECEPCION_ESTADO_CONFIG: Record<EstadoRecepcion, BadgeConfig> = {
  pendiente: {
    label: 'Pendiente',
    icon: Package,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  conforme: {
    label: 'Conforme',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  observada: {
    label: 'Observada',
    icon: AlertTriangle,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  },
  anulada: {
    label: 'Anulada',
    icon: Ban,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida motivo de anulación (mínimo 30 caracteres)
 */
export function validarMotivoAnulacion(motivo: string): ValidationResult {
  const motivoLimpio = motivo.trim();
  
  if (motivoLimpio.length < 30) {
    return { 
      valid: false, 
      error: `El motivo de anulación debe tener al menos 30 caracteres (${motivoLimpio.length}/30)` 
    };
  }
  
  return { valid: true };
}

/**
 * Valida observaciones de recepción
 */
export function validarObservaciones(observaciones: string, requerido: boolean = false): ValidationResult {
  const observacionesLimpias = observaciones.trim();
  
  if (requerido && observacionesLimpias.length === 0) {
    return { valid: false, error: 'Las observaciones son obligatorias para recepciones con observaciones' };
  }
  
  if (observacionesLimpias.length > 0 && observacionesLimpias.length < 10) {
    return { valid: false, error: 'Las observaciones deben tener al menos 10 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Valida cantidad recibida contra cantidad ordenada
 */
export function validarCantidadRecibida(cantidadRecibida: number, cantidadOrdenada: number): ValidationResult {
  if (cantidadRecibida < 0) {
    return { valid: false, error: 'La cantidad recibida no puede ser negativa' };
  }
  
  if (cantidadRecibida > cantidadOrdenada) {
    return { 
      valid: false, 
      error: `La cantidad recibida (${cantidadRecibida}) excede la cantidad ordenada (${cantidadOrdenada})` 
    };
  }
  
  return { valid: true };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Genera ID único para recepción
 */
export function generarIdRecepcion(ultimoNumero: number): string {
  const siguiente = ultimoNumero + 1;
  return `REC-${String(siguiente).padStart(4, '0')}`;
}

/**
 * Extrae número secuencial del ID de la recepción
 */
export function extraerNumeroSecuencial(recepcionId: string): number | null {
  const match = recepcionId.match(/REC-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Formatea fecha ISO a fecha local
 */
export function formatearFecha(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Calcula porcentaje de recepción
 */
export function calcularPorcentajeRecepcion(cantidadRecibida: number, cantidadOrdenada: number): number {
  if (cantidadOrdenada === 0) return 0;
  return Math.round((cantidadRecibida / cantidadOrdenada) * 100);
}

/**
 * Determina si una recepción es completa o parcial
 */
export function esRecepcionCompleta(
  itemsRecibidos: Array<{ cantidadRecibida: number }>,
  itemsOrdenados: Array<{ cantidad: number }>
): boolean {
  if (itemsRecibidos.length !== itemsOrdenados.length) return false;
  
  return itemsRecibidos.every((itemRecibido, idx) => {
    const itemOrdenado = itemsOrdenados[idx];
    return itemRecibido.cantidadRecibida >= itemOrdenado.cantidad;
  });
}

/**
 * Calcula totales de items recibidos vs ordenados
 */
export interface ResumenRecepcion {
  totalItemsOrdenados: number;
  totalItemsRecibidos: number;
  porcentajeGlobal: number;
  esCompleta: boolean;
  itemsPendientes: number;
}

export function calcularResumenRecepcion(
  itemsRecibidos: Array<{ cantidadRecibida: number }>,
  itemsOrdenados: Array<{ cantidad: number }>
): ResumenRecepcion {
  const totalItemsOrdenados = itemsOrdenados.reduce((sum, item) => sum + item.cantidad, 0);
  const totalItemsRecibidos = itemsRecibidos.reduce((sum, item) => sum + item.cantidadRecibida, 0);
  
  const porcentajeGlobal = totalItemsOrdenados > 0 
    ? Math.round((totalItemsRecibidos / totalItemsOrdenados) * 100) 
    : 0;
  
  const esCompleta = totalItemsRecibidos >= totalItemsOrdenados;
  const itemsPendientes = Math.max(0, totalItemsOrdenados - totalItemsRecibidos);
  
  return {
    totalItemsOrdenados,
    totalItemsRecibidos,
    porcentajeGlobal,
    esCompleta,
    itemsPendientes
  };
}

// ============================================================================
// RBAC - Control de Acceso para Recepciones
// ============================================================================

export type RolUsuario = 
  | 'admin_sistemas'
  | 'compras'
  | 'gerencia_aprobaciones'
  | 'operaciones';

interface PermisosRecepcion {
  crear: boolean;
  editar: boolean;
  anular: boolean;
  ver: boolean;
}

export const PERMISOS_RECEPCION_POR_ROL: Record<RolUsuario, PermisosRecepcion> = {
  admin_sistemas: {
    crear: true,
    editar: true,
    anular: true,
    ver: true
  },
  compras: {
    crear: true,
    editar: true,
    anular: false,
    ver: true
  },
  gerencia_aprobaciones: {
    crear: false,
    editar: false,
    anular: false,
    ver: true
  },
  operaciones: {
    crear: true, // Operaciones puede registrar recepciones
    editar: true,
    anular: false,
    ver: true
  }
};

export function tienePermisoRecepcion(rol: RolUsuario, accion: keyof PermisosRecepcion): boolean {
  return PERMISOS_RECEPCION_POR_ROL[rol][accion];
}

/**
 * Verifica si una recepción puede editarse según su estado
 */
export function puedeEditarRecepcion(estado: EstadoRecepcion): boolean {
  return estado === 'pendiente';
}

/**
 * Verifica si una recepción puede anularse según su estado
 */
export function puedeAnularRecepcion(estado: EstadoRecepcion): boolean {
  return estado !== 'anulada';
}
