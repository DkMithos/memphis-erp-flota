/**
 * logAudit — Registra eventos de auditoría en la tabla audit_logs
 * Llámalo después de operaciones CRUD importantes.
 */
import { supabase } from '../supabase/client';

export async function logAudit(params: {
  tenantId: string;
  usuarioEmail: string | null;
  accion: 'crear' | 'editar' | 'eliminar' | 'aprobar' | 'cerrar' | 'exportar' | 'login';
  entidadTipo: string;
  entidadId?: string;
  entidadLabel?: string;
  detalle?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from('audit_logs').insert({
    tenant_id: params.tenantId,
    usuario_email: params.usuarioEmail,
    accion: params.accion,
    entidad_tipo: params.entidadTipo,
    entidad_id: params.entidadId ?? null,
    entidad_label: params.entidadLabel ?? null,
    detalle: params.detalle ?? null,
  });
}
