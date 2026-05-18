/**
 * CONFIGURACIÓN CENTRALIZADA - ÓRDENES DE COMPRA Y SERVICIO
 * Single source of truth para estados, tipos y validaciones
 * Garantiza consistencia UI/UX en módulo Órdenes
 */

import { FileText, Clock, CheckCircle, XCircle, Ban, Send, Package, Truck, type LucideIcon } from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_ORDENES = import.meta.env.DEV;

// ============================================================================
// TIPOS Y ESTADOS
// ============================================================================

export type TipoOrden = 
  | 'oc'           // Orden de Compra (bienes)
  | 'os';          // Orden de Servicio

export type EstadoOrden = 
  | 'borrador'              // Creada pero no enviada
  | 'pendiente_aprobacion'  // Enviada, esperando aprobación
  | 'aprobada'              // Aprobada, lista para ejecutar
  | 'en_ejecucion'          // En proceso de ejecución
  | 'recepcion_parcial'     // Recepción parcial de items
  | 'recepcion_completa'    // Recepción completa, orden cerrada
  | 'anulada';              // Anulada con motivo

export type MonedaOrden = 
  | 'PEN'          // Soles peruanos
  | 'USD';         // Dólares americanos

export type RolUsuario = 
  | 'admin_sistemas'
  | 'compras'
  | 'gerencia_aprobaciones'
  | 'operaciones';

// ============================================================================
// CONFIGURACIÓN DE BADGES
// ============================================================================

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const ORDEN_ESTADO_CONFIG: Record<EstadoOrden, BadgeConfig> = {
  borrador: {
    label: 'Borrador',
    icon: FileText,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  },
  pendiente_aprobacion: {
    label: 'Pendiente Aprobación',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  aprobada: {
    label: 'Aprobada',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  en_ejecucion: {
    label: 'En Ejecución',
    icon: Truck,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  recepcion_parcial: {
    label: 'Recepción Parcial',
    icon: Package,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  },
  recepcion_completa: {
    label: 'Recepción Completa',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  anulada: {
    label: 'Anulada',
    icon: Ban,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

export const ORDEN_TIPO_LABELS: Record<TipoOrden, string> = {
  oc: 'Orden de Compra (OC)',
  os: 'Orden de Servicio (OS)'
};

export const ORDEN_TIPO_PREFIX: Record<TipoOrden, string> = {
  oc: 'OC',
  os: 'OS'
};

export const ORDEN_MONEDA_LABELS: Record<MonedaOrden, string> = {
  PEN: 'Soles (S/)',
  USD: 'Dólares ($)'
};

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
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
 * Valida condiciones de pago/entrega
 */
export function validarCondiciones(condiciones: string): ValidationResult {
  const condicionesLimpias = condiciones.trim();
  
  if (condicionesLimpias.length > 0 && condicionesLimpias.length < 10) {
    return { valid: false, error: 'Las condiciones deben tener al menos 10 caracteres' };
  }
  
  return { valid: true };
}

// ============================================================================
// HELPERS DE NORMALIZACIÓN Y CÁLCULO
// ============================================================================

/**
 * Genera ID único para orden según tipo
 */
export function generarIdOrden(tipo: TipoOrden, ultimoNumero: number): string {
  const siguiente = ultimoNumero + 1;
  const prefix = ORDEN_TIPO_PREFIX[tipo];
  return `${prefix}-${String(siguiente).padStart(4, '0')}`;
}

/**
 * Extrae número secuencial del ID de la orden
 */
export function extraerNumeroSecuencial(ordenId: string): number | null {
  const match = ordenId.match(/(?:OC|OS)-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extrae tipo de orden desde el ID
 */
export function extraerTipoDesdeId(ordenId: string): TipoOrden | null {
  if (ordenId.startsWith('OC-')) return 'oc';
  if (ordenId.startsWith('OS-')) return 'os';
  return null;
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
export function formatearMonto(monto: number, moneda: MonedaOrden): string {
  const simbolo = moneda === 'PEN' ? 'S/' : '$';
  return `${simbolo} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calcula totales de una orden
 */
export interface TotalesOrden {
  subtotal: number;
  impuestos: number;
  total: number;
}

export function calcularTotales(
  items: Array<{ cantidad: number; precioUnitario: number }>,
  tasaImpuesto: number = 0.18 // IGV 18% por defecto
): TotalesOrden {
  const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
  const impuestos = subtotal * tasaImpuesto;
  const total = subtotal + impuestos;
  
  return { subtotal, impuestos, total };
}

// ============================================================================
// RBAC - Control de Acceso
// ============================================================================

interface PermisosOrden {
  crear: boolean;
  editar: boolean;
  anular: boolean;
  aprobar: boolean;
  rechazar: boolean;
  marcarEnEjecucion: boolean;
  ver: boolean;
}

export const PERMISOS_POR_ROL: Record<RolUsuario, PermisosOrden> = {
  admin_sistemas: {
    crear: true,
    editar: true,
    anular: true,
    aprobar: true,
    rechazar: true,
    marcarEnEjecucion: true,
    ver: true
  },
  compras: {
    crear: true,
    editar: true,
    anular: false,
    aprobar: false,
    rechazar: false,
    marcarEnEjecucion: true,
    ver: true
  },
  gerencia_aprobaciones: {
    crear: false,
    editar: false,
    anular: false,
    aprobar: true,
    rechazar: true,
    marcarEnEjecucion: false,
    ver: true
  },
  operaciones: {
    crear: false,
    editar: false,
    anular: false,
    aprobar: false,
    rechazar: false,
    marcarEnEjecucion: false,
    ver: true
  }
};

export function tienePermiso(rol: RolUsuario, accion: keyof PermisosOrden): boolean {
  const permisos = PERMISOS_POR_ROL[rol] ?? PERMISOS_POR_ROL.admin_sistemas;
  return permisos[accion];
}

/**
 * Verifica si una orden puede editarse según su estado
 */
export function puedeEditarOrden(estado: EstadoOrden): boolean {
  return estado === 'borrador';
}

/**
 * Verifica si una orden puede anularse según su estado
 */
export function puedeAnularOrden(estado: EstadoOrden): boolean {
  return estado !== 'anulada' && estado !== 'recepcion_completa';
}

/**
 * Verifica si una orden puede aprobarse/rechazarse según su estado
 */
export function puedeRevisarOrden(estado: EstadoOrden): boolean {
  return estado === 'pendiente_aprobacion';
}

/**
 * Verifica si una orden puede marcarse como en ejecución
 */
export function puedeMarcarEnEjecucion(estado: EstadoOrden): boolean {
  return estado === 'aprobada';
}

/**
 * Verifica si una orden puede recibir recepciones
 */
export function puedeRecibirOrden(estado: EstadoOrden): boolean {
  return estado === 'aprobada' || estado === 'en_ejecucion' || estado === 'recepcion_parcial';
}
