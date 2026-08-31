/**
 * useNotifications — Notificaciones en tiempo real vía Supabase Realtime.
 *
 * El canal es UNO SOLO por tenant y por pestaña, compartido entre todos los
 * componentes que usen el hook.
 *
 * Antes cada componente abría `supabase.channel('notif-<tenant>')` por su
 * cuenta. Con un único consumidor (la barra superior) funcionaba; en cuanto el
 * Home empezó a usar el hook, el segundo montaje añadía callbacks sobre el
 * canal que el primero ya había suscrito y supabase-js lanzaba:
 *
 *   cannot add `postgres_changes` callbacks for realtime:notif-<tenant>
 *   after `subscribe()`
 *
 * La excepción subía hasta el ErrorBoundary y tumbaba la aplicación entera.
 * Darle un nombre distinto a cada canal lo habría callado, pero duplicaría las
 * notificaciones que se insertan desde los handlers. Se comparte una sola
 * suscripción con conteo de referencias.
 */
import { useState, useEffect, useCallback } from 'react';
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

// ── Estado compartido por tenant ────────────────────────────────────────────

type Oyente = (n: Notificacion[]) => void;

interface Compartido {
  canal: ReturnType<typeof supabase.channel> | null;
  oyentes: Set<Oyente>;
  datos: Notificacion[];
}

const compartidos = new Map<string, Compartido>();

function estado(tenantId: string): Compartido {
  let c = compartidos.get(tenantId);
  if (!c) {
    c = { canal: null, oyentes: new Set(), datos: [] };
    compartidos.set(tenantId, c);
  }
  return c;
}

/** Publica una nueva lista a todos los componentes montados. */
function emitir(tenantId: string, cambio: (prev: Notificacion[]) => Notificacion[]): void {
  const c = estado(tenantId);
  c.datos = cambio(c.datos);
  for (const oyente of c.oyentes) oyente(c.datos);
}

async function cargar(tenantId: string): Promise<void> {
  const { data } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('creado_en', { ascending: false })
    .limit(50);
  if (data) emitir(tenantId, () => (data as Record<string, unknown>[]).map(mapRow));
}

function abrirCanal(tenantId: string): ReturnType<typeof supabase.channel> {
  return supabase.channel(`notif-${tenantId}`)
    // Notificaciones propias (otras sesiones o usuarios del mismo tenant)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `tenant_id=eq.${tenantId}` },
      (payload) => {
        const nueva = mapRow(payload.new as Record<string, unknown>);
        emitir(tenantId, prev =>
          prev.some(n => n.id === nueva.id) ? prev : [nueva, ...prev].slice(0, 50));
      },
    )
    // Nuevas OTs
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ordenes_trabajo', filter: `tenant_id=eq.${tenantId}` },
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
      },
    )
    // Tareas vencidas (detectadas al cambiar fecha_vencimiento)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tareas_proyecto', filter: `tenant_id=eq.${tenantId}` },
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
      },
    )
    .subscribe();
}

/** Registra un componente. Devuelve la función para darlo de baja. */
function suscribir(tenantId: string, oyente: Oyente): () => void {
  const c = estado(tenantId);
  const primero = c.oyentes.size === 0;
  c.oyentes.add(oyente);

  if (primero) {
    c.canal = abrirCanal(tenantId);
    void cargar(tenantId);
  } else {
    // Ya hay datos cargados: el que llega tarde los recibe de inmediato.
    oyente(c.datos);
  }

  return () => {
    c.oyentes.delete(oyente);
    if (c.oyentes.size === 0 && c.canal) {
      void supabase.removeChannel(c.canal);
      c.canal = null;
    }
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const { tenantId } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>(
    () => (tenantId ? estado(tenantId).datos : []),
  );

  useEffect(() => {
    if (!tenantId) {
      setNotificaciones([]);
      return;
    }
    return suscribir(tenantId, setNotificaciones);
  }, [tenantId]);

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  const pushNotificacion = useCallback(async (
    notif: Omit<Notificacion, 'id' | 'leida' | 'creadoEn'>,
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
      const nueva = mapRow(data as Record<string, unknown>);
      emitir(tenantId, prev =>
        prev.some(n => n.id === nueva.id) ? prev : [nueva, ...prev].slice(0, 50));
    }
  }, [tenantId]);

  const marcarLeida = useCallback(async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    if (tenantId) emitir(tenantId, prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }, [tenantId]);

  const marcarTodasLeidas = useCallback(async () => {
    if (!tenantId) return;
    await supabase.from('notificaciones').update({ leida: true })
      .eq('tenant_id', tenantId).eq('leida', false);
    emitir(tenantId, prev => prev.map(n => ({ ...n, leida: true })));
  }, [tenantId]);

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, pushNotificacion };
}
