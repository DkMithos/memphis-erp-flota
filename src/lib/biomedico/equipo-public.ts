/**
 * EQUIPO BIOMÉDICO PUBLIC VIEW - Helpers
 * Funciones puras para la vista pública del equipo (QR)
 * Solo expone información no sensible (sin costos)
 */

import type { EquipoBiomedico } from './equipos-store';

// ============================================================================
// HELPERS: QR URL
// ============================================================================

/**
 * Genera URL pública para QR del equipo biomédico usando TOKEN
 */
export function generateEquipoQRUrl(publicToken: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/e/${publicToken}`;
}

/**
 * Encuentra equipo por token público
 */
export function findEquipoByToken(equipos: EquipoBiomedico[], token: string): EquipoBiomedico | undefined {
  return equipos.find(e => e.publicToken === token);
}

// ============================================================================
// HELPERS: ESTADO DE MANTENIMIENTO
// ============================================================================

export type EstadoMantenimientoBio = 'al_dia' | 'proximo' | 'vencido' | 'sin_datos';

export interface MantenimientoStatusBio {
  estado: EstadoMantenimientoBio;
  diasRestantes: number | null;
  mensaje: string;
}

/**
 * Calcula estado de mantenimiento del equipo por fecha
 */
export function calcMantenimientoStatus(
  fechaProximo: string | null,
  umbralDias: number = 15
): MantenimientoStatusBio {
  if (!fechaProximo) {
    return { estado: 'sin_datos', diasRestantes: null, mensaje: 'Sin fecha programada' };
  }

  const hoy = new Date();
  const proximo = new Date(fechaProximo);
  const diffMs = proximo.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return {
      estado: 'vencido',
      diasRestantes,
      mensaje: `Vencido hace ${Math.abs(diasRestantes)} días`,
    };
  }

  if (diasRestantes <= umbralDias) {
    return {
      estado: 'proximo',
      diasRestantes,
      mensaje: `Próximo en ${diasRestantes} días`,
    };
  }

  return {
    estado: 'al_dia',
    diasRestantes,
    mensaje: `Al día — próximo en ${diasRestantes} días`,
  };
}

/**
 * Calcula estado de calibración del equipo
 */
export function calcCalibracionStatus(
  fechaProxima: string | null,
  umbralDias: number = 30
): MantenimientoStatusBio {
  if (!fechaProxima) {
    return { estado: 'sin_datos', diasRestantes: null, mensaje: 'Sin calibración programada' };
  }

  return calcMantenimientoStatus(fechaProxima, umbralDias);
}
