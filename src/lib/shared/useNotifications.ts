/**
 * useNotifications — Notificaciones en tiempo real via Supabase Realtime
 * Suscribe a cambios en ordenes_trabajo, tareas_proyecto y articulos (stock bajo)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

export interface Notificacion {
  id: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  titulo: string;
  mensaje?: string;
  leida: boolean;
  entidadTipo?: string;
  entidadId?: string;
  creadoEn: string;
}

function mapRow(r: Record<string, unknown>): Notificacion {
  return {
    id: r.id as string,
    tipo: r.tipo as Notificacion['tipo'],
    titulo: r.titulo as string,
    mensaje: (r.mensaje as string) ?? undefined,
    leida: r.leida as boolean,
    entidadTipo: (r.entidad_tipo as string) ?? undefined,
    entidadId: (r.entidad_id as string) ?? undefined,
    creadoEn: r.creado_en as string,
  };
}

export function useNotifications() {
  const { tenantId } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  // ── Carga inicial ──────────────────────────────────────────────────────────

  const fetchNotificaciones = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false })
      .limit(50);
    if (data) setNotificaciones((data as Record<string, unknown>[]).map(mapRow));
  }, [tenantId]);

  // ── Insertar notificación ─────────────────────────────────────────────────

  const pushNotificacion = useCallback(async (
    notif: Omit<Notificacion, 'id' | 'leida' | 'creadoEn'>
  ) => {
    if (!tenantId) return;
    const { data } = await supabase.from('notificaciones').insert({
      tenant_id: tenantId,
      tipo: notif.tipo,
      titulo: notif.titulo,
      mensaje: notif.mensaje ?? null,
      entidad_tipo: notif.entidadTipo ?? null,
      entidad_id: notif.entidadId ?? null,
    }).select().single();
    if (data) {
      setNotificaciones(prev => [mapRow(data as Record<string, unknown>), ...prev].slice(0, 50));
    }
  }, [tenantId]);

  // ── Marcar como leída ─────────────────────────────────────────────────────

  const marcarLeida = useCallback(async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }, []);

  const marcarTodasLeidas = useCallback(async () => {
    if (!tenantId) return;
    await supabase.from('notificaciones').update({ leida: true })
      .eq('tenant_id', tenantId).eq('leida', false);
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  }, [tenantId]);

  // ── Realtime subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return;

    fetchNotificaciones();

    // Canal para notificaciones propias (otras sesiones/usuarios del mismo tenant)
    const channel = supabase.channel(`notif-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const nueva = mapRow(payload.new as Record<string, unknown>);
          setNotificaciones(prev => {
            if (prev.some(n => n.id === nueva.id)) return prev;
            return [nueva, ...prev].slice(0, 50);
          });
        }
      )
      // Nuevas OTs
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ordenes_trabajo',
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          const ot = payload.new as Record<string, unknown>;
          await supabase.from('notificaciones').insert({
            tenant_id: tenantId,
            tipo: 'info',
            titulo: `Nueva OT: ${ot.numero_ot}`,
            mensaje: `${ot.titulo} — ${ot.taller_nombre}`,
            entidad_tipo: 'orden_trabajo',
            entidad_id: ot.numero_ot as string,
          });
        }
      )
      // Tareas vencidas (detectadas al cambiar fecha_vencimiento)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tareas_proyecto',
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          const t = payload.new as Record<string, unknown>;
          const hoy = new Date().toISOString().split('T')[0];
          if (
            t.estado !== 'completada' && t.estado !== 'cancelada' &&
            t.fecha_vencimiento && (t.fecha_vencimiento as string) < hoy
          ) {
            await supabase.from('notificaciones').insert({
              tenant_id: tenantId,
              tipo: 'warning',
              titulo: `Tarea vencida: ${t.titulo}`,
              mensaje: `Venció el ${t.fecha_vencimiento}`,
              entidad_tipo: 'tarea',
              entidad_id: t.id as string,
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [tenantId, fetchNotificaciones]);

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, pushNotificacion };
}
