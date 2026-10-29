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
 *
 * LEÍDAS POR PERSONA (2026-09-30). La tabla `notificaciones` es por tenant y su
 * `leida` es una sola marca para todos: si Richard marcaba un aviso, se le
 * borraba también a Miguelángel. Ahora cada persona tiene sus lecturas en
 * `notificaciones_lecturas`, y un aviso se ve como leído si YO lo leí o si el
 * sistema lo cerró para todos (`leida = true`, que ponen los triggers cuando
 * la orden queda aprobada/rechazada). Cuando alguien firma una etapa, el
 * trigger de `orden_aprobaciones` le anota la lectura solo a él: a los demás
 * firmantes el aviso les sigue pendiente, que es lo correcto.
 *
 * DIRIGIDAS (2026-10-29). Un aviso puede venir DIRIGIDO a personas concretas
 * (`dirigida = true` + `notificaciones_destinatarios`): la base solo se lo
 * entrega a ellas (RLS) y aquí se muestra siempre, sin filtro por módulo. Así
 * la solicitud de firma de una orden le llega solo a la etapa en turno, la de
 * un viaje a su jefatura, y el resultado a quien lo pidió. Los avisos generales
 * (sin destinatario) siguen filtrándose por módulo como antes. Los avisos de OT
 * nueva y tarea vencida ya no los inserta el navegador (cada sesión abierta
 * metía uno): los crean triggers en la base.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions, type Modulo, type Accion } from '../rbac/usePermissions';
import { puedeVerRuta } from '../rbac/rutas';

/**
 * A qué módulo pertenece cada aviso.
 *
 * La tabla `notificaciones` no tiene destinatario: se guarda por tenant y la ve
 * todo el mundo. Así, a Richard —Compras y Proveedores— le llegaban avisos de
 * caja chica ("Aprobación requerida: GCC-2026-001") y el resumen de
 * vencimientos de flota y biomédico. Aquí se filtra por el módulo del aviso.
 *
 * Un `entidad_tipo` que no esté en esta tabla se MUESTRA: lo que no se puede
 * clasificar suele ser un aviso general del sistema, y callarlo es peor que
 * enseñarlo. Si aparece un tipo nuevo de un módulo concreto, va en esta lista.
 */
const RUTA_DE_ENTIDAD: Record<string, string> = {
  orden_compra: '/compras',
  cotizacion: '/compras',
  requerimiento: '/compras',
  recepcion: '/compras',
  factura_proveedor: '/compras',
  factura: '/compras',
  proveedor: '/proveedores',
  caja_chica: '/finanzas',
  lote_pago: '/finanzas/lotes-pago',
  transaccion: '/finanzas',
  presupuesto: '/finanzas',
  orden_trabajo: '/flota',
  vehiculo: '/flota',
  // El resumen de vencimientos cuenta documentos y OTs de flota.
  vencimientos: '/flota',
  calibracion: '/biomedico',
  equipo_biomedico: '/biomedico',
  tarea: '/proyectos',
  proyecto: '/proyectos',
  carta_fianza: '/fianzas',
  cliente: '/crm',
  articulo: '/inventario',
};

/**
 * ¿Este aviso pide una aprobación?
 *
 * Lo escribe `approvals-dispatch` como "Aprobación requerida: MM-001253". Los
 * avisos guardados antes de que la función llevara tildes dicen "Aprobacion",
 * así que se comparan sin acentos.
 */
export function esSolicitudDeAprobacion(titulo: string | undefined): boolean {
  if (!titulo) return false;
  const limpio = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return limpio.startsWith('aprobacion requerida');
}

/** ¿Le corresponde este aviso a quien lo está mirando? */
export function puedeVerNotificacion(
  entidadTipo: string | undefined,
  can: (m: Modulo, a: Accion) => boolean,
): boolean {
  const ruta = entidadTipo ? RUTA_DE_ENTIDAD[entidadTipo] : undefined;
  if (!ruta) return true; // sin módulo conocido: aviso general
  return puedeVerRuta(ruta, can);
}

/** ¿Puede aprobar en el módulo del aviso? Un aviso general nunca cuenta. */
export function puedeAprobarNotificacion(
  entidadTipo: string | undefined,
  can: (m: Modulo, a: Accion) => boolean,
): boolean {
  const ruta = entidadTipo ? RUTA_DE_ENTIDAD[entidadTipo] : undefined;
  if (!ruta) return false;
  const modulo = ruta.replace('/', '') as Modulo;
  return can(modulo, 'aprobar');
}

export interface Notificacion {
  id: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  titulo: string;
  mensaje?: string;
  /** Leída por mí o cerrada para todos por el sistema. */
  leida: boolean;
  /** Dirigida a mí (la base ya decidió que me corresponde): se muestra siempre. */
  dirigida: boolean;
  entidadTipo?: string;
  entidadId?: string;
  creadoEn: string;
}

/**
 * ¿Le corresponde a esta persona ver este aviso?
 *
 * Lo dirigido a ella, siempre. Lo general, solo si ve el módulo; y a quien solo
 * le toca aprobar (Gerencia, por decisión de Kevin el 10/09) únicamente las
 * solicitudes de aprobación de los módulos donde de verdad aprueba.
 */
export function esVisibleParaMi(
  n: Pick<Notificacion, 'dirigida' | 'titulo' | 'entidadTipo'>,
  can: (m: Modulo, a: Accion) => boolean,
  soloNotificaAprobaciones: boolean,
): boolean {
  if (n.dirigida) return true;
  if (!puedeVerNotificacion(n.entidadTipo, can)) return false;
  if (!soloNotificaAprobaciones) return true;
  return esSolicitudDeAprobacion(n.titulo) && puedeAprobarNotificacion(n.entidadTipo, can);
}

/** Fila cruda; `cerrada` es la marca global (`leida` en la tabla: cerrada para todos). */
interface FilaNotif {
  id: string;
  tipo: Notificacion['tipo'];
  titulo: string;
  mensaje?: string;
  cerrada: boolean;
  dirigida: boolean;
  entidadTipo?: string;
  entidadId?: string;
  creadoEn: string;
}

function mapRow(r: Record<string, unknown>): FilaNotif {
  return {
    id: r.id as string,
    tipo: r.tipo as Notificacion['tipo'],
    titulo: r.titulo as string,
    mensaje: (r.mensaje as string) ?? undefined,
    // `mis_notificaciones` la llama `cerrada`; la tabla cruda (realtime), `leida`.
    cerrada: Boolean(r.cerrada ?? r.leida),
    dirigida: Boolean(r.dirigida),
    entidadTipo: (r.entidad_tipo as string) ?? undefined,
    entidadId: (r.entidad_id as string) ?? undefined,
    creadoEn: r.creado_en as string,
  };
}

/** Cuántos avisos recientes se tienen en memoria (campana y centro de notificaciones). */
const LIMITE = 200;

// ── Estado compartido por tenant + usuario ─────────────────────────────────

type Oyente = (n: Notificacion[]) => void;

interface Compartido {
  canal: ReturnType<typeof supabase.channel> | null;
  oyentes: Set<Oyente>;
  filas: FilaNotif[];
  /** ids de avisos que YO ya leí. */
  lecturas: Set<string>;
}

const compartidos = new Map<string, Compartido>();

function estado(clave: string): Compartido {
  let c = compartidos.get(clave);
  if (!c) {
    c = { canal: null, oyentes: new Set(), filas: [], lecturas: new Set() };
    compartidos.set(clave, c);
  }
  return c;
}

function vista(c: Compartido): Notificacion[] {
  return c.filas.map(f => ({
    id: f.id,
    tipo: f.tipo,
    titulo: f.titulo,
    mensaje: f.mensaje,
    leida: f.cerrada || c.lecturas.has(f.id),
    dirigida: f.dirigida,
    entidadTipo: f.entidadTipo,
    entidadId: f.entidadId,
    creadoEn: f.creadoEn,
  }));
}

/** Publica la lista actual a todos los componentes montados. */
function emitir(clave: string, cambio?: (c: Compartido) => void): void {
  const c = estado(clave);
  if (cambio) cambio(c);
  const lista = vista(c);
  for (const oyente of c.oyentes) oyente(lista);
}

/** La base devuelve solo lo que me corresponde (RLS) con mi lectura ya resuelta. */
async function cargar(clave: string): Promise<void> {
  const { data } = await (supabase.rpc as any)('mis_notificaciones', { p_limite: LIMITE }) as { data: Record<string, unknown>[] | null };
  if (!data) return;
  emitir(clave, c => {
    c.filas = data.map(mapRow);
    c.lecturas = new Set(data.filter(r => r.leida_por_mi === true).map(r => r.id as string));
  });
}

function agregarFila(clave: string, nueva: FilaNotif): void {
  emitir(clave, c => {
    if (!c.filas.some(n => n.id === nueva.id)) {
      c.filas = [nueva, ...c.filas].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(0, LIMITE);
    }
  });
}

/** Un aviso dirigido a mí llegó: se lee por id (la RLS ya me lo permite) y se suma a la lista. */
async function traerUna(clave: string, id: string): Promise<void> {
  const { data } = await supabase.from('notificaciones').select('*').eq('id', id).maybeSingle();
  if (data) agregarFila(clave, mapRow(data as Record<string, unknown>));
}

function abrirCanal(clave: string, tenantId: string, userId: string): ReturnType<typeof supabase.channel> {
  return supabase.channel(`notif-${tenantId}-${userId}`)
    // Notificaciones nuevas del tenant. Realtime aplica la RLS: un aviso dirigido a
    // otra persona no llega aquí.
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `tenant_id=eq.${tenantId}` },
      (payload) => { agregarFila(clave, mapRow(payload.new as Record<string, unknown>)); },
    )
    // Me pusieron como destinatario de un aviso (por si el evento de arriba se
    // evaluó antes de que existiera la fila de destinatario).
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones_destinatarios', filter: `user_id=eq.${userId}` },
      (payload) => { void traerUna(clave, (payload.new as { notificacion_id: string }).notificacion_id); },
    )
    // Un aviso cerrado para todos (la orden ya se aprobó/rechazó) desaparece en vivo
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notificaciones', filter: `tenant_id=eq.${tenantId}` },
      (payload) => {
        const fila = mapRow(payload.new as Record<string, unknown>);
        emitir(clave, c => {
          c.filas = c.filas.map(n => n.id === fila.id ? fila : n);
        });
      },
    )
    // Mis lecturas hechas en otra pestaña o anotadas por el sistema (firmé una etapa)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones_lecturas', filter: `user_id=eq.${userId}` },
      (payload) => {
        const id = (payload.new as { notificacion_id: string }).notificacion_id;
        emitir(clave, c => { c.lecturas.add(id); });
      },
    )
    .subscribe();
}

/** Registra un componente. Devuelve la función para darlo de baja. */
function suscribir(clave: string, tenantId: string, userId: string, oyente: Oyente): () => void {
  const c = estado(clave);
  const primero = c.oyentes.size === 0;
  c.oyentes.add(oyente);

  if (primero) {
    c.canal = abrirCanal(clave, tenantId, userId);
    void cargar(clave);
  } else {
    // Ya hay datos cargados: el que llega tarde los recibe de inmediato.
    oyente(vista(c));
  }

  return () => {
    c.oyentes.delete(oyente);
    if (c.oyentes.size === 0 && c.canal) {
      void supabase.removeChannel(c.canal);
      c.canal = null;
    }
  };
}

/** Anota mis lecturas (idempotente: la clave primaria es notificación + usuario). */
async function anotarLecturas(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  await (supabase.from('notificaciones_lecturas') as any)
    .upsert(ids.map(id => ({ notificacion_id: id, user_id: userId })), {
      onConflict: 'notificacion_id,user_id', ignoreDuplicates: true,
    });
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const { tenantId, user } = useAuth();
  const userId = user?.id ?? null;
  const clave = tenantId && userId ? `${tenantId}|${userId}` : null;
  const { can, soloNotificaAprobaciones } = usePermissions();
  const [todas, setTodas] = useState<Notificacion[]>(
    () => (clave ? vista(estado(clave)) : []),
  );

  // Lo dirigido a mí se muestra siempre; lo general depende de mis módulos (y a
  // quien solo aprueba, solo le pasan las solicitudes de aprobación). Ver `esVisibleParaMi`.
  const notificaciones = useMemo(
    () => todas.filter(n => esVisibleParaMi(n, can, soloNotificaAprobaciones)),
    [todas, can, soloNotificaAprobaciones],
  );

  useEffect(() => {
    if (!clave || !tenantId || !userId) {
      setTodas([]);
      return;
    }
    return suscribir(clave, tenantId, userId, setTodas);
  }, [clave, tenantId, userId]);

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  /**
   * Crea un aviso. Con `destinatarios` (usuarios, roles o permisos "modulo.accion")
   * va dirigido y solo lo ven ellos; sin destinatarios es general (lo ve quien vea
   * el módulo). Quien lo emite no se lo manda a sí mismo.
   */
  const pushNotificacion = useCallback(async (
    notif: Omit<Notificacion, 'id' | 'leida' | 'creadoEn' | 'dirigida'>
      & { destinatarios?: { usuarios?: string[]; roles?: string[]; permisos?: string[] } },
  ) => {
    if (!tenantId || !clave) return;
    const d = notif.destinatarios;
    const { data: id } = await (supabase.rpc as any)('notif_emitir', {
      p_tenant: tenantId, p_tipo: notif.tipo, p_titulo: notif.titulo, p_mensaje: notif.mensaje ?? null,
      p_entidad_tipo: notif.entidadTipo ?? null, p_entidad_id: notif.entidadId ?? null,
      p_usuarios: d?.usuarios ?? null, p_roles: d?.roles ?? null, p_permisos: d?.permisos ?? null,
      p_excluir: userId ? [userId] : null,
    }) as { data: string | null };
    if (id && !d) await traerUna(clave, id);
  }, [tenantId, clave, userId]);

  // Leer es personal: se anota MI lectura, no se cierra el aviso para los demás.
  const marcarLeida = useCallback(async (id: string) => {
    if (!userId || !clave) return;
    emitir(clave, c => { c.lecturas.add(id); });
    await anotarLecturas(userId, [id]);
  }, [userId, clave]);

  const marcarTodasLeidas = useCallback(async () => {
    if (!userId || !clave) return;
    // Solo las que esta persona ve como pendientes.
    const ids = notificaciones.filter(n => !n.leida).map(n => n.id);
    if (ids.length === 0) return;
    emitir(clave, c => { ids.forEach(id => c.lecturas.add(id)); });
    await anotarLecturas(userId, ids);
  }, [userId, clave, notificaciones]);

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, pushNotificacion };
}
