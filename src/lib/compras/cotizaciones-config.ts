/**
 * CONFIGURACIÓN CENTRALIZADA - COTIZACIONES DE COMPRA
 * Single source of truth para estados, tipos y validaciones
 * Garantiza consistencia UI/UX en módulo Cotizaciones
 */

import { FileText, Clock, CheckCircle, XCircle, Ban, Send, type LucideIcon } from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_COTIZACIONES = import.meta.env.DEV;

// ============================================================================
// TIPOS Y ESTADOS
// ============================================================================

export type EstadoCotizacion =
  | 'borrador'     // Creada pero no enviada
  | 'enviada'      // Enviada al proveedor
  | 'recibida'     // Respuesta del proveedor recibida, pendiente de decisión
  | 'aprobada'     // Aprobada, lista para OC
  | 'rechazada'    // Rechazada con motivo
  | 'anulada';     // Anulada con motivo

export type TipoCotizacion = 
  | 'bienes'       // Productos físicos
  | 'servicios';   // Servicios

export type MonedaCotizacion = 
  | 'PEN'          // Soles peruanos
  | 'USD';         // Dólares americanos

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

export const COTIZACION_ESTADO_CONFIG: Record<EstadoCotizacion, BadgeConfig> = {
  borrador: {
    label: 'Borrador',
    icon: FileText,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  },
  enviada: {
    label: 'Enviada',
    icon: Send,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  recibida: {
    label: 'Recibida',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
  },
  aprobada: {
    label: 'Aprobada',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  rechazada: {
    label: 'Rechazada',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  anulada: {
    label: 'Anulada',
    icon: Ban,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

export const COTIZACION_TIPO_LABELS: Record<TipoCotizacion, string> = {
  bienes: 'Bienes',
  servicios: 'Servicios'
};

export const COTIZACION_MONEDA_LABELS: Record<MonedaCotizacion, string> = {
  PEN: 'Soles (S/)',
  USD: 'Dólares ($)'
};

export const VALIDEZ_DIAS_OPTIONS = [7, 15, 30, 45, 60, 90];

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida nombre de proveedor
 */
export function validarProveedorNombre(nombre: string): ValidationResult {
  const nombreLimpio = nombre.trim();
  
  if (nombreLimpio.length < 3) {
    return { valid: false, error: 'El nombre del proveedor debe tener al menos 3 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Valida precio unitario (debe ser >= 0)
 */
export function validarPrecioUnitario(precio: number): ValidationResult {
  if (precio < 0) {
    return { valid: false, error: 'El precio unitario no puede ser negativo' };
  }
  
  return { valid: true };
}

/**
 * Valida cantidad (debe ser > 0)
 */
export function validarCantidad(cantidad: number): ValidationResult {
  if (cantidad <= 0) {
    return { valid: false, error: 'La cantidad debe ser mayor a 0' };
  }
  
  return { valid: true };
}

/**
 * Valida motivo de anulación/rechazo (mínimo 30 caracteres)
 */
export function validarMotivo(motivo: string, tipoAccion: 'anulación' | 'rechazo'): ValidationResult {
  const motivoLimpio = motivo.trim();
  
  if (motivoLimpio.length < 30) {
    return { 
      valid: false, 
      error: `El motivo de ${tipoAccion} debe tener al menos 30 caracteres (${motivoLimpio.length}/30)` 
    };
  }
  
  return { valid: true };
}

/**
 * Valida descripción de item
 */
export function validarDescripcionItem(descripcion: string): ValidationResult {
  const descripcionLimpia = descripcion.trim();
  
  if (descripcionLimpia.length < 3) {
    return { valid: false, error: 'La descripción debe tener al menos 3 caracteres' };
  }
  
  return { valid: true };
}

// ============================================================================
// HELPERS DE NORMALIZACIÓN Y CÁLCULO
// ============================================================================

/**
 * Normaliza nombre de proveedor
 */
export function normalizeProveedorNombre(nombre: string): string {
  return nombre.trim();
}

/**
 * Genera ID único para cotización
 */
export function generarIdCotizacion(ultimoNumero: number): string {
  const siguiente = ultimoNumero + 1;
  return `COT-${String(siguiente).padStart(4, '0')}`;
}

/**
 * Extrae número secuencial del ID de la cotización
 */
export function extraerNumeroSecuencial(cotizacionId: string): number | null {
  const match = cotizacionId.match(/COT-(\d+)/);
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
 * Formatea monto según moneda
 */
export function formatearMonto(monto: number, moneda: MonedaCotizacion): string {
  const simbolo = moneda === 'PEN' ? 'S/' : '$';
  return `${simbolo} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calcula totales de una cotización
 */
export interface TotalesCotizacion {
  subtotal: number;
  impuestos: number;
  total: number;
}

export function calcularTotales(
  items: Array<{ cantidad: number; precioUnitario: number }>,
  tasaImpuesto: number = 0.18 // IGV 18% por defecto
): TotalesCotizacion {
  const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
  const impuestos = subtotal * tasaImpuesto;
  const total = subtotal + impuestos;
  
  return { subtotal, impuestos, total };
}

// ============================================================================
// RBAC - Control de Acceso
// ============================================================================

interface PermisosCotizacion {
  crear: boolean;
  editar: boolean;
  anular: boolean;
  aprobar: boolean;
  rechazar: boolean;
  ver: boolean;
}

export const PERMISOS_POR_ROL: Record<RolUsuario, PermisosCotizacion> = {
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

export function tienePermiso(rol: RolUsuario, accion: keyof PermisosCotizacion): boolean {
  const permisos = PERMISOS_POR_ROL[rol] ?? PERMISOS_POR_ROL.admin_empresa;
  return permisos[accion];
}

/**
 * Verifica si una cotización puede editarse según su estado
 */
export function puedeEditarCotizacion(estado: EstadoCotizacion): boolean {
  return estado === 'borrador' || estado === 'rechazada';
}

/**
 * Verifica si una cotización puede anularse según su estado
 */
export function puedeAnularCotizacion(estado: EstadoCotizacion): boolean {
  return estado !== 'anulada';
}

/**
 * Verifica si una cotización puede aprobarse/rechazarse según su estado
 */
export function puedeRevisarCotizacion(estado: EstadoCotizacion): boolean {
  return estado === 'enviada';
}
