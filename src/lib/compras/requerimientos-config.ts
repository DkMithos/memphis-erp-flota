/**
 * CONFIGURACIÓN CENTRALIZADA - REQUERIMIENTOS DE COMPRA
 * Single source of truth para estados, tipos y validaciones
 * Garantiza consistencia UI/UX en módulo Requerimientos
 */

import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, Ban, type LucideIcon } from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_REQUERIMIENTOS = import.meta.env.DEV;

// ============================================================================
// TIPOS Y ESTADOS
// ============================================================================

export type EstadoRequerimiento = 
  | 'borrador'     // Creado pero no enviado
  | 'enviado'      // Enviado para aprobación
  | 'aprobado'     // Aprobado, listo para OC
  | 'rechazado'    // Rechazado por gerencia
  | 'anulado';     // Anulado con motivo

export type PrioridadRequerimiento = 
  | 'alta'         // Urgente, < 24h
  | 'media'        // Normal, < 1 semana
  | 'baja';        // Puede esperar

export type CentroCosto = 
  | 'flota'
  | 'biomedico'
  | 'administracion'
  | 'operaciones'
  | 'ti'
  | 'mantenimiento';

export type RolUsuario = 
  | 'admin_empresa'
  | 'compras'
  | 'operaciones'
  | 'gerencia';

// ============================================================================
// CONFIGURACIÓN DE BADGES
// ============================================================================

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const REQUERIMIENTO_ESTADO_CONFIG: Record<EstadoRequerimiento, BadgeConfig> = {
  borrador: {
    label: 'Borrador',
    icon: FileText,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  },
  enviado: {
    label: 'Enviado',
    icon: Clock,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  aprobado: {
    label: 'Aprobado',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  rechazado: {
    label: 'Rechazado',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  anulado: {
    label: 'Anulado',
    icon: Ban,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

export const REQUERIMIENTO_PRIORIDAD_CONFIG: Record<PrioridadRequerimiento, BadgeConfig> = {
  alta: {
    label: 'Alta',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  media: {
    label: 'Media',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  baja: {
    label: 'Baja',
    icon: Clock,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

export const CENTRO_COSTO_LABELS: Record<CentroCosto, string> = {
  flota: 'Flota',
  biomedico: 'Biomédico',
  administracion: 'Administración',
  operaciones: 'Operaciones',
  ti: 'Tecnología',
  mantenimiento: 'Mantenimiento'
};

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida título del requerimiento
 */
export function validarTitulo(titulo: string): ValidationResult {
  const tituloLimpio = titulo.trim();
  
  if (tituloLimpio.length < 5) {
    return { valid: false, error: 'El título debe tener al menos 5 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Valida descripción del requerimiento
 */
export function validarDescripcion(descripcion: string): ValidationResult {
  const descripcionLimpia = descripcion.trim();
  
  if (descripcionLimpia.length < 10) {
    return { valid: false, error: 'La descripción debe tener al menos 10 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Valida formato de email
 */
export function validarEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Formato de email inválido' };
  }
  
  return { valid: true };
}

/**
 * Valida cantidad (debe ser mayor a 0)
 */
export function validarCantidad(cantidad: number): ValidationResult {
  if (cantidad <= 0) {
    return { valid: false, error: 'La cantidad debe ser mayor a 0' };
  }
  
  return { valid: true };
}

/**
 * Valida motivo de anulación (mínimo 30 caracteres)
 */
export function validarMotivoAnulacion(motivo: string): ValidationResult {
  const motivoLimpio = motivo.trim();
  
  if (motivoLimpio.length < 30) {
    return { valid: false, error: `El motivo debe tener al menos 30 caracteres (${motivoLimpio.length}/30)` };
  }
  
  return { valid: true };
}

// ============================================================================
// HELPERS DE NORMALIZACIÓN
// ============================================================================

/**
 * Normaliza email (lowercase y trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Genera ID único para requerimiento
 */
export function generarIdRequerimiento(ultimoNumero: number): string {
  const siguiente = ultimoNumero + 1;
  return `REQ-${String(siguiente).padStart(4, '0')}`;
}

/**
 * Extrae número secuencial del ID del requerimiento
 */
export function extraerNumeroSecuencial(requerimientoId: string): number | null {
  const match = requerimientoId.match(/REQ-(\d+)/);
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
 * Formatea monto a moneda
 */
export function formatearMonto(monto: number): string {
  return `S/ ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// RBAC - Control de Acceso
// ============================================================================

interface PermisosRequerimiento {
  crear: boolean;
  editar: boolean;
  anular: boolean;
  aprobar: boolean;
  rechazar: boolean;
  ver: boolean;
}

export const PERMISOS_POR_ROL: Record<RolUsuario, PermisosRequerimiento> = {
  admin_empresa: {
    crear: true,
    editar: true,
    anular: true,
    aprobar: true,
    rechazar: true,
    ver: true
  },
  compras: {
    crear: true,
    editar: true,
    anular: false,
    aprobar: false,
    rechazar: false,
    ver: true
  },
  operaciones: {
    crear: false,
    editar: false,
    anular: false,
    aprobar: false,
    rechazar: false,
    ver: true
  },
  gerencia: {
    crear: false,
    editar: false,
    anular: false,
    aprobar: true,
    rechazar: true,
    ver: true
  }
};

export function tienePermiso(rol: RolUsuario, accion: keyof PermisosRequerimiento): boolean {
  const permisos = PERMISOS_POR_ROL[rol] ?? PERMISOS_POR_ROL.admin_empresa;
  return permisos[accion];
}

/**
 * Verifica si un requerimiento puede editarse según su estado
 */
export function puedeEditarRequerimiento(estado: EstadoRequerimiento): boolean {
  return estado === 'borrador' || estado === 'rechazado';
}

/**
 * Verifica si un requerimiento puede anularse según su estado
 */
export function puedeAnularRequerimiento(estado: EstadoRequerimiento): boolean {
  return estado !== 'anulado';
}

/**
 * Verifica si un requerimiento puede aprobarse/rechazarse según su estado
 */
export function puedeRevisarRequerimiento(estado: EstadoRequerimiento): boolean {
  return estado === 'enviado';
}
