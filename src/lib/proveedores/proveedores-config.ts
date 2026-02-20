/**
 * CONFIGURACIÓN CENTRALIZADA - PROVEEDORES
 * Single source of truth para estados, tipos y validaciones
 * Garantiza consistencia UI/UX en módulo Proveedores
 */

import { Building2, CheckCircle, XCircle, AlertTriangle, type LucideIcon } from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_PROVEEDORES = true;

// ============================================================================
// TIPOS Y ESTADOS
// ============================================================================

export type EstadoProveedor = 'activo' | 'inactivo' | 'observado' | 'bloqueado';

export type CondicionProveedor = 
  | 'excelente'    // +95 puntos, sin incidencias
  | 'bueno'        // 80-94 puntos
  | 'regular'      // 60-79 puntos
  | 'deficiente'   // <60 puntos
  | 'sin_evaluar'; // Nuevo proveedor

export type TipoProveedor = 
  | 'bienes'       // Vende productos/repuestos
  | 'servicios'    // Presta servicios (talleres, mantenimiento)
  | 'mixto';       // Ambos

export type CategoriaProveedor =
  | 'repuestos'
  | 'taller'
  | 'combustible'
  | 'seguros'
  | 'equipos_medicos'
  | 'insumos'
  | 'servicios_profesionales'
  | 'construccion'
  | 'tecnologia'
  | 'otros';

// ============================================================================
// CONFIGURACIÓN DE BADGES
// ============================================================================

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const PROVEEDOR_ESTADO_CONFIG: Record<EstadoProveedor, BadgeConfig> = {
  activo: {
    label: 'Activo',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  inactivo: {
    label: 'Inactivo',
    icon: XCircle,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  },
  observado: {
    label: 'Observado',
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  bloqueado: {
    label: 'Bloqueado',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  }
};

export const PROVEEDOR_CONDICION_CONFIG: Record<CondicionProveedor, BadgeConfig> = {
  excelente: {
    label: 'Excelente',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  bueno: {
    label: 'Bueno',
    icon: CheckCircle,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  regular: {
    label: 'Regular',
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  deficiente: {
    label: 'Deficiente',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  sin_evaluar: {
    label: 'Sin Evaluar',
    icon: AlertTriangle,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

export const PROVEEDOR_TIPO_CONFIG: Record<TipoProveedor, { label: string; className: string }> = {
  bienes: {
    label: 'Bienes',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  servicios: {
    label: 'Servicios',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  },
  mixto: {
    label: 'Mixto',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
  }
};

export const PROVEEDOR_CATEGORIA_LABELS: Record<CategoriaProveedor, string> = {
  repuestos: 'Repuestos y Autopartes',
  taller: 'Taller / Mantenimiento',
  combustible: 'Combustible y Lubricantes',
  seguros: 'Seguros',
  equipos_medicos: 'Equipos Médicos',
  insumos: 'Insumos Médicos',
  servicios_profesionales: 'Servicios Profesionales',
  construccion: 'Construcción',
  tecnologia: 'Tecnología',
  otros: 'Otros'
};

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida formato de RUC peruano (11 dígitos)
 */
export function validarRUC(ruc: string): ValidationResult {
  const rucLimpio = ruc.replace(/\D/g, '');
  
  if (rucLimpio.length !== 11) {
    return { valid: false, error: 'El RUC debe tener 11 dígitos' };
  }
  
  if (!rucLimpio.startsWith('10') && !rucLimpio.startsWith('20')) {
    return { valid: false, error: 'El RUC debe iniciar con 10 (persona) o 20 (empresa)' };
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
 * Valida formato de teléfono (9 dígitos, empieza con 9)
 */
export function validarTelefono(telefono: string): ValidationResult {
  const telLimpio = telefono.replace(/\D/g, '');
  
  if (telLimpio.length !== 9) {
    return { valid: false, error: 'El teléfono debe tener 9 dígitos' };
  }
  
  if (!telLimpio.startsWith('9')) {
    return { valid: false, error: 'El teléfono celular debe iniciar con 9' };
  }
  
  return { valid: true };
}

/**
 * Valida razón social (mínimo 3 caracteres)
 */
export function validarRazonSocial(razonSocial: string): ValidationResult {
  const razonLimpia = razonSocial.trim();
  
  if (razonLimpia.length < 3) {
    return { valid: false, error: 'La razón social debe tener al menos 3 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Valida dirección (mínimo 10 caracteres)
 */
export function validarDireccion(direccion: string): ValidationResult {
  const dirLimpia = direccion.trim();
  
  if (dirLimpia.length < 10) {
    return { valid: false, error: 'La dirección debe tener al menos 10 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Valida motivo de inactivación (mínimo 30 caracteres)
 */
export function validarMotivoInactivacion(motivo: string): ValidationResult {
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
 * Normaliza RUC (elimina espacios y caracteres no numéricos)
 */
export function normalizeRUC(ruc: string): string {
  return ruc.replace(/\D/g, '');
}

/**
 * Normaliza teléfono (elimina espacios y caracteres no numéricos)
 */
export function normalizeTelefono(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

/**
 * Normaliza email (lowercase y trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Genera ID único para proveedor
 */
export function generarIdProveedor(ultimoNumero: number): string {
  const siguiente = ultimoNumero + 1;
  return `PROV-${String(siguiente).padStart(4, '0')}`;
}

/**
 * Extrae número secuencial del ID del proveedor
 */
export function extraerNumeroSecuencial(proveedorId: string): number | null {
  const match = proveedorId.match(/PROV-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================================================
// RBAC - Control de Acceso
// ============================================================================

export type RolUsuario = 'admin' | 'gerencia' | 'compras' | 'operaciones';

interface PermisosProveedor {
  crear: boolean;
  editar: boolean;
  inactivar: boolean;
  ver: boolean;
}

export const PERMISOS_POR_ROL: Record<RolUsuario, PermisosProveedor> = {
  admin: {
    crear: true,
    editar: true,
    inactivar: true,
    ver: true
  },
  gerencia: {
    crear: false,
    editar: false,
    inactivar: false,
    ver: true
  },
  compras: {
    crear: true,
    editar: true,
    inactivar: false,
    ver: true
  },
  operaciones: {
    crear: false,
    editar: false,
    inactivar: false,
    ver: true
  }
};

export function tienePermiso(rol: RolUsuario, accion: keyof PermisosProveedor): boolean {
  return PERMISOS_POR_ROL[rol][accion];
}
