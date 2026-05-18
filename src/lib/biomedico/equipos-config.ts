/**
 * CONFIGURACIÓN CENTRALIZADA - EQUIPOS BIOMÉDICOS
 * Single source of truth para estados, categorías y criticidades
 * Garantiza consistencia UI/UX en todo el módulo Biomédico
 */

import { 
  Activity,
  Stethoscope,
  Radio,
  Heart,
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  type LucideIcon
} from 'lucide-react';

// ============================================================================
// DEBUG FLAG
// ============================================================================

export const DEBUG_BIOMEDICO = import.meta.env.DEV;

// ============================================================================
// TIPOS DE ESTADO Y CATEGORÍAS - Estandarizados según SRS
// ============================================================================

export type EstadoEquipoBiomedico = 
  | 'operativo' 
  | 'mantenimiento' 
  | 'fuera_servicio' 
  | 'baja'
  | 'calibracion';

export type CategoriaEquipoBiomedico = 
  | 'diagnostico' 
  | 'terapeutico' 
  | 'soporte_vital' 
  | 'laboratorio'
  | 'rehabilitacion';

export type RiesgoBiomedico = 'bajo' | 'medio' | 'alto' | 'critico';

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
 * Configuración de badges para estados de equipos biomédicos
 * WCAG AA: Contraste suficiente garantizado
 */
export const EQUIPO_ESTADO_CONFIG: Record<EstadoEquipoBiomedico, BadgeConfig> = {
  operativo: {
    label: 'Operativo',
    icon: CheckCircle,
    variant: 'outline',
    className: 'text-green-600 border-green-600'
  },
  mantenimiento: {
    label: 'Mantenimiento',
    icon: Wrench,
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  calibracion: {
    label: 'Calibración',
    icon: Activity,
    variant: 'default',
    className: 'bg-primary text-primary-foreground'
  },
  fuera_servicio: {
    label: 'Fuera de Servicio',
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-destructive text-destructive-foreground'
  },
  baja: {
    label: 'Baja',
    icon: XCircle,
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
};

/**
 * Configuración de badges para categorías de equipos
 */
export const EQUIPO_CATEGORIA_CONFIG: Record<CategoriaEquipoBiomedico, { label: string; icon: LucideIcon; className: string }> = {
  diagnostico: {
    label: 'Diagnóstico',
    icon: Stethoscope,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  terapeutico: {
    label: 'Terapéutico',
    icon: Heart,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  soporte_vital: {
    label: 'Soporte Vital',
    icon: Activity,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  laboratorio: {
    label: 'Laboratorio',
    icon: Radio,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  },
  rehabilitacion: {
    label: 'Rehabilitación',
    icon: Brain,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  }
};

/**
 * Configuración de badges para riesgo biomédico
 */
export const EQUIPO_RIESGO_CONFIG: Record<RiesgoBiomedico, BadgeConfig> = {
  bajo: {
    label: 'Bajo',
    icon: AlertTriangle,
    variant: 'outline',
    className: 'text-gray-600 border-gray-300'
  },
  medio: {
    label: 'Medio',
    icon: AlertTriangle,
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  alto: {
    label: 'Alto',
    icon: AlertTriangle,
    variant: 'default',
    className: 'bg-yellow-600 text-white'
  },
  critico: {
    label: 'Crítico',
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-destructive text-destructive-foreground'
  }
};

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Genera un código de equipo biomédico secuencial
 * Formato: EB-YYYY-XXX
 */
export function generarCodigoEquipo(ultimoNumero?: number): string {
  const year = new Date().getFullYear();
  const numero = (ultimoNumero || 0) + 1;
  const numeroFormateado = numero.toString().padStart(3, '0');
  return `EB-${year}-${numeroFormateado}`;
}

/**
 * Valida si un string tiene formato de código de equipo válido
 */
export function validarCodigoEquipo(codigo: string): boolean {
  const regex = /^EB-\d{4}-\d{3}$/;
  return regex.test(codigo);
}

/**
 * Extrae el número secuencial de un código de equipo
 */
export function extraerNumeroSecuencial(codigo: string): number | null {
  const match = codigo.match(/^EB-\d{4}-(\d{3})$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Determina si un equipo está activo (no dado de baja)
 */
export function isActiveEquipo(estado: EstadoEquipoBiomedico): boolean {
  return estado !== 'baja';
}

/**
 * Obtiene el label amigable de un estado
 */
export function obtenerLabelEstado(estado: EstadoEquipoBiomedico): string {
  return EQUIPO_ESTADO_CONFIG[estado]?.label || 'Desconocido';
}

/**
 * Obtiene el label amigable de una categoría
 */
export function obtenerLabelCategoria(categoria: CategoriaEquipoBiomedico): string {
  return EQUIPO_CATEGORIA_CONFIG[categoria]?.label || 'Desconocido';
}

/**
 * Obtiene el label amigable de un riesgo
 */
export function obtenerLabelRiesgo(riesgo: RiesgoBiomedico): string {
  return EQUIPO_RIESGO_CONFIG[riesgo]?.label || 'Desconocido';
}

/**
 * Calcula la frecuencia de mantenimiento sugerida según categoría y riesgo (en días)
 */
export function calcularFrecuenciaMantenimiento(
  categoria: CategoriaEquipoBiomedico, 
  riesgo: RiesgoBiomedico
): number {
  // Matriz de frecuencia en días
  const frecuenciaMatrix: Record<CategoriaEquipoBiomedico, Record<RiesgoBiomedico, number>> = {
    diagnostico: {
      bajo: 365,
      medio: 180,
      alto: 90,
      critico: 30
    },
    terapeutico: {
      bajo: 180,
      medio: 90,
      alto: 60,
      critico: 30
    },
    soporte_vital: {
      bajo: 90,
      medio: 60,
      alto: 30,
      critico: 15
    },
    laboratorio: {
      bajo: 365,
      medio: 180,
      alto: 90,
      critico: 60
    },
    rehabilitacion: {
      bajo: 365,
      medio: 180,
      alto: 120,
      critico: 60
    }
  };

  return frecuenciaMatrix[categoria][riesgo];
}
