/**
 * Memphis ERP — Solicitud de aprobación vía Teams (Approvals one-way)
 *
 * Invoca la Edge Function `approvals-dispatch`: determina el nivel por monto,
 * identifica aprobadores por rol, registra en `aprobaciones` y publica la
 * tarjeta de aprobación en Teams con botón "Aprobar en el ERP".
 *
 * Resiliente: nunca lanza — si falla, el flujo de negocio del ERP continúa.
 */
import { supabase } from '../supabase/client';

export type ModuloAprobacion = 'requerimiento' | 'orden_compra' | 'caja_chica';

export interface SolicitudAprobacionInput {
  modulo: ModuloAprobacion;
  entidadId: string;     // UUID de la fila (_dbId)
  numero?: string;       // código legible (REQ-0001, OC-0001…)
  titulo?: string;
  monto?: number;
  moneda?: 'PEN' | 'USD';
}

export async function solicitarAprobacionTeams(
  input: SolicitudAprobacionInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('approvals-dispatch', { body: input });
    if (error) {
      console.warn('[approvals] dispatch error (no bloquea):', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[approvals] dispatch excepción (no bloquea):', msg);
    return { ok: false, error: msg };
  }
}
