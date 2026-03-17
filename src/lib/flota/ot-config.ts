/**
 * CONFIGURACIÓN CENTRALIZADA - ÓRDENES DE TRABAJO
 * Single source of truth para estados, tipos y criticidades
 * Garantiza consistencia UI/UX en todo el módulo Flota
 */

import { 
  Clock, 
  Wrench, 
  Package, 
  ShieldAlert, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  type LucideIcon
} from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_OT = import.meta.env.DEV;

// ============================================================================
// TIPOS DE ESTADO DE OT - Estandarizados según SRS
// ============================================================================

export type EstadoOT = 
  | 'programada' 
  | 'en_ejecucion' 
  | 'espera_repuesto' 
  | 'espera_aprobacion' 
  | 'cerrada' 
  | 'anulada';

export type TipoOT = 'preventivo' | 'correctivo' | 'predictivo';

export type CriticidadOT = 'baja' | 'media' | 'alta' | 'critica';

// ============================================================================
// TIPOS PARA EXTRAS (HALLAZGOS/ADICIONALES)
// ============================================================================

export type TipoExtraOT = 'pieza' | 'servicio';

export interface OTExtraItem {
  id: string;
  tipo: TipoExtraOT;
  categoria?: string; // Requerido para piezas (ej: "Eléctrico", "Mecánico", "Neumático")
  descripcion: string;
  motivo: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  fechaRegistro: string;
  registradoPor: string;
  // Soft delete
  eliminado: boolean;
  motivoEliminacion?: string;
  eliminadoPor?: string;
  fechaEliminacion?: string;
}

// ============================================================================
// CONFIGURACIÓN DE BADGES - WCAG AA Compliant
// ============================================================================

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string; // Tokens del design system
}

/**
 * Configuración de badges para estados de OT
 * WCAG AA: Contraste suficiente garantizado
 */
export const OT_ESTADO_CONFIG: Record<EstadoOT, BadgeConfig> = {
  programada: {
    label: 'Programada',
    icon: Clock,
    variant: 'outline',
    className: 'text-blue-600 border-blue-600'
  },
  en_ejecucion: {
    label: 'En Ejecución',
    icon: Wrench,
    variant: 'default',
    className: 'bg-primary text-primary-foreground' // Usa tokens del theme
  },
  espera_repuesto: {
    label: 'Espera Repuesto',
    icon: Package,
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  espera_aprobacion: {
    label: 'Espera Aprobación',
    icon: ShieldAlert,
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  cerrada: {
    label: 'Cerrada',
    icon: CheckCircle,
    variant: 'outline',
    className: 'text-green-600 border-green-600'
  },
  anulada: {
    label: 'Anulada',
    icon: XCircle,
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

/**
 * Configuración de badges para tipos de OT
 */
export const OT_TIPO_CONFIG: Record<TipoOT, { label: string; className: string }> = {
  preventivo: {
    label: 'Preventivo',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  correctivo: {
    label: 'Correctivo',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  predictivo: {
    label: 'Predictivo',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  }
};

/**
 * Configuración de badges para criticidad
 */
export const OT_CRITICIDAD_CONFIG: Record<CriticidadOT, BadgeConfig> = {
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
  critica: {
    label: 'Crítica',
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-destructive text-destructive-foreground'
  }
};

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Umbral de costo que requiere aprobación gerencial
 * En producción, este valor debe venir de configuración del sistema
 */
export const UMBRAL_APROBACION_GERENCIAL = 1500;

/**
 * Normaliza un string de estado a su key canónico
 * Permite manejar variaciones de input (tildes, mayúsculas, espacios)
 */
export function normalizeOTStatus(input: string): EstadoOT {
  // Normalizar: lowercase, sin tildes, sin espacios extra
  const normalized = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
    .trim()
    .replace(/\s+/g, '_'); // Espacios a guiones bajos

  // Mapeo de variaciones comunes
  const mapping: Record<string, EstadoOT> = {
    'programada': 'programada',
    'programado': 'programada',
    'en_ejecucion': 'en_ejecucion',
    'en_ejecución': 'en_ejecucion',
    'en ejecucion': 'en_ejecucion',
    'ejecucion': 'en_ejecucion',
    'espera_repuesto': 'espera_repuesto',
    'espera repuesto': 'espera_repuesto',
    'esperando_repuesto': 'espera_repuesto',
    'espera_aprobacion': 'espera_aprobacion',
    'espera_aprobación': 'espera_aprobacion',
    'espera aprobacion': 'espera_aprobacion',
    'pendiente_aprobacion': 'espera_aprobacion',
    'cerrada': 'cerrada',
    'cerrado': 'cerrada',
    'completada': 'cerrada',
    'anulada': 'anulada',
    'anulado': 'anulada',
    'cancelada': 'anulada',
    'cancelado': 'anulada'
  };

  const result = mapping[normalized];
  if (!result) {
    console.warn(`Estado OT no reconocido: "${input}". Usando "programada" por defecto.`);
    return 'programada';
  }

  return result;
}

/**
 * Determina si una OT está activa (no cerrada ni anulada)
 */
export function isActiveOT(statusKey: EstadoOT): boolean {
  return !['cerrada', 'anulada'].includes(statusKey);
}

/**
 * Determina el estado inicial de una OT basado en su costo total
 * Si el costo supera el umbral, requiere aprobación gerencial
 */
export function determinarEstadoInicial(costoTotal: number): EstadoOT {
  if (costoTotal > UMBRAL_APROBACION_GERENCIAL) {
    return 'espera_aprobacion';
  }
  return 'programada';
}

/**
 * Genera un número de OT secuencial
 * Formato: OT-YYYY-XXX
 */
export function generarNumeroOT(ultimoNumero?: number): string {
  const year = new Date().getFullYear();
  const numero = (ultimoNumero || 0) + 1;
  const numeroFormateado = numero.toString().padStart(3, '0');
  return `OT-${year}-${numeroFormateado}`;
}

/**
 * Valida si un string tiene formato de número OT válido
 */
export function validarNumeroOT(numeroOT: string): boolean {
  const regex = /^OT-\d{4}-\d{3}$/;
  return regex.test(numeroOT);
}

/**
 * Extrae el número secuencial de un numeroOT
 */
export function extraerNumeroSecuencial(numeroOT: string): number | null {
  const match = numeroOT.match(/^OT-\d{4}-(\d{3})$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Calcula SLA sugerido según tipo y criticidad
 */
export function calcularSLASugerido(tipo: TipoOT, criticidad: CriticidadOT): number {
  // Matriz de SLA en horas
  const slaMatrix: Record<TipoOT, Record<CriticidadOT, number>> = {
    preventivo: {
      baja: 8,
      media: 6,
      alta: 4,
      critica: 2
    },
    correctivo: {
      baja: 6,
      media: 4,
      alta: 2,
      critica: 1
    },
    predictivo: {
      baja: 12,
      media: 8,
      alta: 6,
      critica: 4
    }
  };

  return slaMatrix[tipo][criticidad];
}

/**
 * Obtiene el label amigable de un estado
 */
export function obtenerLabelEstado(estado: EstadoOT): string {
  return OT_ESTADO_CONFIG[estado]?.label || 'Desconocido';
}

/**
 * Obtiene el label amigable de un tipo
 */
export function obtenerLabelTipo(tipo: TipoOT): string {
  return OT_TIPO_CONFIG[tipo]?.label || 'Desconocido';
}

/**
 * Obtiene el label amigable de una criticidad
 */
export function obtenerLabelCriticidad(criticidad: CriticidadOT): string {
  return OT_CRITICIDAD_CONFIG[criticidad]?.label || 'Desconocido';
}

// ============================================================================
// ACCIONES PERMITIDAS POR ESTADO
// ============================================================================

export type AccionOT = 
  | 'iniciar' 
  | 'pausar' 
  | 'aprobar' 
  | 'cerrar' 
  | 'anular' 
  | 'agregar_extras';

/**
 * Determina qué acciones están permitidas según el estado actual de la OT
 * Esta función centraliza la lógica de permisos para evitar hardcode en UI
 */
export function getAllowedActionsByStatus(status: EstadoOT): AccionOT[] {
  const actionsMap: Record<EstadoOT, AccionOT[]> = {
    programada: ['iniciar', 'anular'],
    en_ejecucion: ['pausar', 'cerrar', 'agregar_extras'],
    espera_repuesto: ['cerrar', 'anular'],
    espera_aprobacion: ['aprobar', 'anular'],
    cerrada: [], // No se puede hacer nada
    anulada: []  // No se puede hacer nada
  };

  return actionsMap[status] || [];
}

/**
 * Verifica si una acción específica está permitida para un estado dado
 */
export function isActionAllowed(status: EstadoOT, action: AccionOT): boolean {
  return getAllowedActionsByStatus(status).includes(action);
}

// ============================================================================
// HELPERS PARA EXTRAS (HALLAZGOS/ADICIONALES)
// ============================================================================

/**
 * Crea un nuevo item extra (hallazgo/adicional)
 */
export function createExtraItem(
  tipo: TipoExtraOT,
  descripcion: string,
  motivo: string,
  cantidad: number,
  costoUnitario: number,
  registradoPor: string,
  categoria?: string
): OTExtraItem {
  const id = `EXTRA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const costoTotal = cantidad * costoUnitario;
  const fechaRegistro = new Date().toISOString();

  return {
    id,
    tipo,
    categoria,
    descripcion,
    motivo,
    cantidad,
    costoUnitario,
    costoTotal,
    fechaRegistro,
    registradoPor,
    eliminado: false
  };
}

/**
 * Resume extras por tipo para métricas
 */
export function summarizeExtrasByType(extras: OTExtraItem[]): {
  piezas: { count: number; total: number };
  servicios: { count: number; total: number };
  total: number;
} {
  // Filtrar solo los no eliminados
  const activos = extras.filter(e => !e.eliminado);
  const piezas = activos.filter(e => e.tipo === 'pieza');
  const servicios = activos.filter(e => e.tipo === 'servicio');

  return {
    piezas: {
      count: piezas.length,
      total: piezas.reduce((sum, e) => sum + e.costoTotal, 0)
    },
    servicios: {
      count: servicios.length,
      total: servicios.reduce((sum, e) => sum + e.costoTotal, 0)
    },
    total: activos.reduce((sum, e) => sum + e.costoTotal, 0)
  };
}

/**
 * Calcula el total de un extra
 */
export function calcExtraTotal(cantidad: number, costoUnitario: number): number {
  return cantidad * costoUnitario;
}

/**
 * Validaciones para extras
 */
export interface ValidacionExtra {
  valido: boolean;
  errores: string[];
}

export function validarExtra(
  tipo: TipoExtraOT,
  descripcion: string,
  cantidad: number,
  costoUnitario: number,
  categoria?: string
): ValidacionExtra {
  const errores: string[] = [];

  // Descripción min 5 caracteres
  if (!descripcion || descripcion.trim().length < 5) {
    errores.push('La descripción debe tener al menos 5 caracteres');
  }

  // Cantidad >= 1
  if (cantidad < 1) {
    errores.push('La cantidad debe ser al menos 1');
  }

  // Costo >= 0
  if (costoUnitario < 0) {
    errores.push('El costo unitario no puede ser negativo');
  }

  // Si es pieza, categoría es requerida
  if (tipo === 'pieza' && (!categoria || categoria.trim().length === 0)) {
    errores.push('La categoría es requerida para piezas');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Categorías predefinidas para piezas
 */
export const CATEGORIAS_PIEZAS = [
  'Eléctrico',
  'Mecánico',
  'Neumático',
  'Hidráulico',
  'Carrocería',
  'Motor',
  'Transmisión',
  'Frenos',
  'Suspensión',
  'Otro'
] as const;

// ============================================================================
// TOTALES (BASE + EXTRAS)
// ============================================================================

/**
 * Calcula el total de costos base de una OT
 * (mano de obra + repuestos + terceros + otros)
 */
export function getBaseCostTotal(costos: {
  manoObra: number;
  repuestos: number;
  terceros: number;
  otros: number;
}): number {
  return (
    (costos.manoObra || 0) +
    (costos.repuestos || 0) +
    (costos.terceros || 0) +
    (costos.otros || 0)
  );
}

/**
 * Calcula el total de extras (adicionales) activos de una OT
 */
export function getExtrasTotal(extras: OTExtraItem[]): number {
  return summarizeExtrasByType(extras).total;
}

/**
 * Calcula el gran total de una OT (base + extras)
 */
export function getOTGrandTotal(ot: {
  costos: {
    manoObra: number;
    repuestos: number;
    terceros: number;
    otros: number;
  };
  extras: OTExtraItem[];
}): number {
  return getBaseCostTotal(ot.costos) + getExtrasTotal(ot.extras);
}