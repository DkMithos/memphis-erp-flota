/**
 * Correspondencia con el Estado por proyecto (cartas, oficios, informes, memorándums,
 * proveídos…): expedientes (hilos), documentos, plazos de respuesta y a qué responde cada
 * uno. Reemplaza "SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx" (ver migración
 * 20261021170000_correspondencia.sql). Lectura por la vista `v_correspondencia`.
 */
import { supabase } from '../supabase/client';

export type TipoCorrespondencia = 'carta' | 'oficio' | 'informe' | 'memorandum' | 'proveido' | 'resolucion' | 'dictamen' | 'expediente' | 'carta_notarial' | 'accion' | 'otro';
export type EstadoCorrespondencia = 'registrado' | 'pendiente' | 'respondido' | 'cerrado';
export type SentidoCorrespondencia = 'emitido' | 'recibido' | 'interno';

export const TIPO_CORRESPONDENCIA: Record<TipoCorrespondencia, string> = {
  carta: 'Carta', oficio: 'Oficio', informe: 'Informe', memorandum: 'Memorándum', proveido: 'Proveído', resolucion: 'Resolución',
  dictamen: 'Dictamen', expediente: 'Expediente', carta_notarial: 'Carta notarial', accion: 'Acción pendiente', otro: 'Otro',
};
export const ESTADO_CORRESPONDENCIA: Record<EstadoCorrespondencia, { label: string; clase: string }> = {
  registrado: { label: 'Registrado', clase: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  pendiente:  { label: 'Pendiente de respuesta', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  respondido: { label: 'Respondido', clase: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  cerrado:    { label: 'Cerrado', clase: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
};
export const SENTIDO_CORRESPONDENCIA: Record<SentidoCorrespondencia, string> = { emitido: 'Emitido por Memphis', recibido: 'Recibido', interno: 'Interno' };

export interface Hilo {
  id: string; tenant_id: string; proyecto_id: string; titulo: string; descripcion: string | null; estado: 'abierto' | 'cerrado'; orden: number;
  origen_datos: string | null; creado_en: string; actualizado_en: string;
}

export interface Correspondencia {
  id: string; tenant_id: string; proyecto_id: string; hilo_id: string | null; etapa: string | null; numero_doc: string | null;
  tipo: TipoCorrespondencia; sentido: SentidoCorrespondencia; emisor: string | null; receptor: string | null; asunto: string;
  fecha_documento: string | null; fecha_recepcion: string | null; requiere_respuesta: boolean; plazo_dias: number | null; fecha_limite: string | null;
  estado: EstadoCorrespondencia; responde_a: string | null; respondido_en: string | null; responsable_id: string | null;
  archivo_url: string | null; archivo_nombre: string | null; observaciones: string | null; origen_datos: string | null; fila_excel: number | null;
  orden: number; creado_por: string | null; creado_en: string; actualizado_en: string;
  // de la vista
  proyecto_codigo: string; proyecto_nombre: string; hilo_titulo: string | null; hilo_estado: string | null; responde_a_numero: string | null;
  dias_para_vencer: number | null; vencida: boolean; respuestas: number;
}

/** Campos que se escriben (todo lo demás lo pone la base o la vista). */
export type CorrespondenciaInput = Partial<Pick<Correspondencia,
  'id' | 'proyecto_id' | 'hilo_id' | 'etapa' | 'numero_doc' | 'tipo' | 'sentido' | 'emisor' | 'receptor' | 'asunto' | 'fecha_documento' | 'fecha_recepcion' |
  'requiere_respuesta' | 'plazo_dias' | 'fecha_limite' | 'estado' | 'responde_a' | 'respondido_en' | 'responsable_id' | 'archivo_url' | 'archivo_nombre' | 'observaciones'>>;

const PAGINA = 1000;
async function todo<T>(q: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let d = 0; ; d += PAGINA) {
    const { data, error } = await q(d, d + PAGINA - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGINA) return out;
  }
}

export const cargarCorrespondencia = (proyectoId?: string | null) => todo<Correspondencia>((d, h) => {
  let q = supabase.from('v_correspondencia').select('*').order('fecha_documento', { ascending: false, nullsFirst: false }).order('orden', { ascending: false });
  if (proyectoId) q = q.eq('proyecto_id', proyectoId);
  return q.range(d, h);
});

export async function cargarHilos(proyectoId: string): Promise<Hilo[]> {
  const { data, error } = await supabase.from('correspondencia_hilos').select('*').eq('proyecto_id', proyectoId).order('orden', { ascending: false });
  if (error) throw error; return (data ?? []) as Hilo[];
}

export async function guardarHilo(h: Partial<Hilo> & { proyecto_id: string; titulo: string; tenant_id?: string }): Promise<Hilo> {
  const { id, ...resto } = h;
  const q = id ? supabase.from('correspondencia_hilos').update(resto as never).eq('id', id) : supabase.from('correspondencia_hilos').insert(resto as never);
  const { data, error } = await q.select('*').single();
  if (error) throw error; return data as Hilo;
}

export async function guardarCorrespondencia(c: CorrespondenciaInput & { tenant_id?: string; creado_por?: string | null }): Promise<string> {
  const { id, ...resto } = c;
  const limpio = Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, v === '' ? null : v]));
  if (id) {
    const { error } = await supabase.from('correspondencia').update(limpio as never).eq('id', id);
    if (error) throw error; return id;
  }
  const { data, error } = await supabase.from('correspondencia').insert(limpio as never).select('id').single();
  if (error) throw error; return (data as { id: string }).id;
}

export async function eliminarCorrespondencia(id: string): Promise<void> {
  const { error } = await supabase.from('correspondencia').delete().eq('id', id);
  if (error) throw error;
}

export const fechaCorta = (s: string | null | undefined) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** Texto del plazo para la tabla: "vencida hace 3 d", "vence en 2 d", "hoy". */
export function textoPlazo(c: Pick<Correspondencia, 'estado' | 'fecha_limite' | 'dias_para_vencer'>): string | null {
  if (c.estado !== 'pendiente' || !c.fecha_limite || c.dias_para_vencer == null) return null;
  const d = Number(c.dias_para_vencer);
  if (d < 0) return `vencida hace ${-d} d`;
  if (d === 0) return 'vence hoy';
  return `vence en ${d} d`;
}
