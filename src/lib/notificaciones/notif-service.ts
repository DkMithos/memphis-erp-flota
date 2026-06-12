/**
 * Memphis ERP — Servicio de notificaciones (Fase 1)
 *
 * Helper que invoca la Edge Function `teams-notify` para enviar notificaciones
 * a Teams cuando ocurren eventos del ERP. La función custodia las credenciales
 * de Microsoft Graph; este helper solo arma el payload y lo envía.
 *
 * El canal destino se configura en el flujo de Power Automate (server-side),
 * por lo que el frontend NO especifica destino — solo el contenido.
 *
 * Uso:
 *   import { enviarNotificacionTeams } from '@/lib/notificaciones/notif-service';
 *   await enviarNotificacionTeams({
 *     tipo: 'OC_POR_APROBAR',
 *     titulo: 'OC-0042 pendiente de aprobación',
 *     cuerpo: 'Requiere tu aprobación',
 *     accionUrl: 'https://erp.memphismaquinarias.com/compras/ordenes/OC-0042',
 *     hechos: [
 *       { label: 'Proveedor', value: 'INNOVANTEK SAC' },
 *       { label: 'Monto', value: 'S/ 12,500.00' },
 *     ],
 *   });
 */

import { supabase } from '../supabase/client';

/** Tipos de evento notificables (catálogo §8.2 del doc de arquitectura) */
export type TipoNotificacion =
  | 'OT_VENCIDA'
  | 'OT_PROXIMA'
  | 'OC_POR_APROBAR'
  | 'MANTENIMIENTO_BIO_PROXIMO'
  | 'PRESUPUESTO_EN_RIESGO'
  | 'DOCUMENTO_POR_VENCER'
  | 'CALIBRACION_VENCIDA';

/** Par clave/valor que se muestra como FactSet en la tarjeta de Teams */
export interface HechoNotificacion {
  label: string;
  value: string;
}

export interface NotificacionInput {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string;
  accionUrl?: string;
  hechos?: HechoNotificacion[];
  datos?: Record<string, unknown>;
}

export interface NotificacionResult {
  ok: boolean;
  messageId?: string | null;
  error?: string;
}

/**
 * Envía una notificación a Teams vía la Edge Function `teams-notify`.
 * Resiliente: nunca lanza — devuelve { ok:false, error } para que el flujo
 * de negocio no se interrumpa si la notificación falla.
 */
export async function enviarNotificacionTeams(
  input: NotificacionInput,
): Promise<NotificacionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('teams-notify', {
      body: input,
    });
    if (error) {
      console.warn('[notif] teams-notify error:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, messageId: data?.messageId ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[notif] teams-notify excepción:', msg);
    return { ok: false, error: msg };
  }
}
