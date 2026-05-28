/**
 * Memphis ERP — Servicio de notificaciones (Fase 1)
 *
 * Helper que invoca la Edge Function `teams-notify` para enviar notificaciones
 * a Teams cuando ocurren eventos del ERP. La función custodia las credenciales
 * de Microsoft Graph; este helper solo arma el payload y lo envía.
 *
 * Uso:
 *   import { enviarNotificacionTeams } from '@/lib/notificaciones/notif-service';
 *   await enviarNotificacionTeams({
 *     tipo: 'OC_POR_APROBAR',
 *     titulo: 'OC-0042 pendiente de aprobación',
 *     cuerpo: 'Proveedor X · S/ 12,500',
 *     accionUrl: 'https://erp.memphismaquinarias.com/compras/ordenes/OC-0042',
 *     destino: { teamId: '...', channelId: '...' },
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

export interface DestinoTeams {
  /** Mensaje a canal: requiere teamId + channelId */
  teamId?: string;
  channelId?: string;
  /** Mensaje a chat directo/grupal: requiere chatId */
  chatId?: string;
}

export interface NotificacionInput {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string;
  accionUrl?: string;
  destino: DestinoTeams;
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
