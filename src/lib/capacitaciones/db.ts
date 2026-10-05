/**
 * Acceso a datos del módulo (cliente autenticado, bajo RLS por tenant).
 * Las lecturas públicas NO pasan por aquí: ver `publico.ts`.
 */
import { supabase } from '../supabase/client';
import type {
  AccesoPortal, Capacitacion, Certificado, Curso, DatosCertificado, Participante, Plantilla, PlantillaSnapshot,
} from './types';

const t = (tabla: string) => (supabase as any).from(tabla);

function lanzar(error: any, contexto: string): never {
  console.error(`[capacitaciones] ${contexto}:`, error);
  throw new Error(error?.message || contexto);
}

// ─── Cursos ─────────────────────────────────────────────────────────────────
export const dbCursos = {
  async listar(tenantId: string): Promise<Curso[]> {
    const { data, error } = await t('capacitacion_cursos').select('*').eq('tenant_id', tenantId).order('nombre');
    if (error) lanzar(error, 'listar cursos');
    return (data ?? []).map((c: any) => ({ ...c, horas_total: Number(c.horas_total ?? 0), temario: c.temario ?? [] }));
  },
  async guardar(curso: Partial<Curso> & { tenant_id: string; nombre: string }): Promise<Curso> {
    const payload = { ...curso };
    delete (payload as any).horas_total; // lo calcula el trigger
    const q = curso.id
      ? t('capacitacion_cursos').update(payload).eq('id', curso.id)
      : t('capacitacion_cursos').insert(payload);
    const { data, error } = await q.select('*').single();
    if (error) lanzar(error, 'guardar curso');
    return data;
  },
  async eliminar(id: string): Promise<void> {
    const { error } = await t('capacitacion_cursos').delete().eq('id', id);
    if (error) lanzar(error, 'eliminar curso');
  },
};

// ─── Plantillas ─────────────────────────────────────────────────────────────
export const dbPlantillas = {
  async listar(tenantId: string): Promise<Plantilla[]> {
    const { data, error } = await t('certificado_plantillas').select('*').eq('tenant_id', tenantId).order('es_default', { ascending: false }).order('nombre');
    if (error) lanzar(error, 'listar plantillas');
    return (data ?? []).map((p: any) => ({ ...p, layout: p.layout ?? {} }));
  },
  async guardar(p: Partial<Plantilla> & { tenant_id: string; nombre: string }): Promise<Plantilla> {
    // Solo una por defecto: si esta pasa a serlo, las demás dejan de serlo.
    if (p.es_default) {
      await t('certificado_plantillas').update({ es_default: false }).eq('tenant_id', p.tenant_id).neq('id', p.id ?? '00000000-0000-0000-0000-000000000000');
    }
    const q = p.id
      ? t('certificado_plantillas').update(p).eq('id', p.id)
      : t('certificado_plantillas').insert(p);
    const { data, error } = await q.select('*').single();
    if (error) lanzar(error, 'guardar plantilla');
    return { ...data, layout: data.layout ?? {} };
  },
  async eliminar(id: string): Promise<void> {
    const { error } = await t('certificado_plantillas').delete().eq('id', id);
    if (error) lanzar(error, 'eliminar plantilla');
  },
  /**
   * Sube logo / sello / fondo / rúbrica al bucket público `certificados`
   * (carpeta del tenant) y devuelve la URL pública. Nombre con uuid: no se
   * pisa nada y la URL no se adivina.
   */
  async subirRecurso(tenantId: string, archivo: File, tipo: 'logo' | 'sello' | 'fondo' | 'firma'): Promise<string> {
    const ext = (archivo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const ruta = `${tenantId}/${tipo}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('certificados').upload(ruta, archivo, {
      cacheControl: '31536000', upsert: false, contentType: archivo.type || undefined,
    });
    if (error) lanzar(error, 'subir recurso');
    return supabase.storage.from('certificados').getPublicUrl(ruta).data.publicUrl;
  },
  /** La rúbrica del firmante puede salir de "Mi firma" del propio usuario. */
  async subirFirmaDataUrl(tenantId: string, dataUrl: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob();
    const archivo = new File([blob], 'firma.png', { type: 'image/png' });
    return this.subirRecurso(tenantId, archivo, 'firma');
  },
};

// ─── Capacitaciones ─────────────────────────────────────────────────────────
const SELECT_CAP = `*, proyecto:proyectos(id, codigo, nombre, entidad_cliente, region),
  participantes:capacitacion_participantes(id, firmado_en, asistio),
  certificados(id, estado)`;

function mapCap(c: any): Capacitacion {
  const parts: any[] = c.participantes ?? [];
  const certs: any[] = c.certificados ?? [];
  const { participantes: _p, certificados: _c, ...resto } = c;
  void _p; void _c;
  return {
    ...resto,
    temario: c.temario ?? [],
    horas_total: Number(c.horas_total ?? 0),
    total_participantes: parts.filter(p => p.asistio !== false).length,
    total_firmados: parts.filter(p => p.firmado_en).length,
    total_certificados: certs.filter(x => x.estado === 'emitido').length,
  };
}

export const dbCapacitaciones = {
  async listar(tenantId: string, filtro?: { proyecto_id?: string | null }): Promise<Capacitacion[]> {
    let q = t('capacitaciones').select(SELECT_CAP).eq('tenant_id', tenantId).order('fecha_inicio', { ascending: false });
    if (filtro?.proyecto_id) q = q.eq('proyecto_id', filtro.proyecto_id);
    const { data, error } = await q;
    if (error) lanzar(error, 'listar capacitaciones');
    return (data ?? []).map(mapCap);
  },
  async obtener(id: string): Promise<Capacitacion | null> {
    const { data, error } = await t('capacitaciones').select(SELECT_CAP).eq('id', id).maybeSingle();
    if (error) lanzar(error, 'obtener capacitación');
    return data ? mapCap(data) : null;
  },
  async crear(c: Partial<Capacitacion> & { tenant_id: string; titulo: string; fecha_inicio: string }): Promise<Capacitacion> {
    const payload = limpiarCap(c);
    const { data, error } = await t('capacitaciones').insert(payload).select(SELECT_CAP).single();
    if (error) lanzar(error, 'crear capacitación');
    return mapCap(data);
  },
  async actualizar(id: string, c: Partial<Capacitacion>): Promise<Capacitacion> {
    const payload = limpiarCap(c);
    const { data, error } = await t('capacitaciones').update(payload).eq('id', id).select(SELECT_CAP).single();
    if (error) lanzar(error, 'actualizar capacitación');
    return mapCap(data);
  },
  async regenerarTokenAsistencia(id: string): Promise<string> {
    const token = crypto.randomUUID();
    const { error } = await t('capacitaciones').update({ asistencia_token: token }).eq('id', id);
    if (error) lanzar(error, 'regenerar enlace');
    return token;
  },
};

/** Quita los campos derivados/embebidos antes de escribir. */
function limpiarCap(c: Partial<Capacitacion>): Record<string, unknown> {
  const { proyecto: _p, total_participantes: _a, total_firmados: _b, total_certificados: _d, horas_total: _h, codigo: _k, ...resto } = c as any;
  void _p; void _a; void _b; void _d; void _h; void _k;
  return resto;
}

// ─── Participantes ──────────────────────────────────────────────────────────
const SELECT_PART = `*, certificado:certificados(id, codigo, token, estado, emitido_en)`;

function mapPart(p: any): Participante {
  const cert = Array.isArray(p.certificado) ? p.certificado[0] ?? null : p.certificado ?? null;
  return { ...p, certificado: cert };
}

export const dbParticipantes = {
  async listar(capacitacionId: string): Promise<Participante[]> {
    const { data, error } = await t('capacitacion_participantes').select(SELECT_PART)
      .eq('capacitacion_id', capacitacionId).order('orden', { ascending: true, nullsFirst: false }).order('apellidos');
    if (error) lanzar(error, 'listar participantes');
    return (data ?? []).map(mapPart);
  },
  async agregar(p: Partial<Participante> & { tenant_id: string; capacitacion_id: string; dni: string; nombres: string; apellidos: string }): Promise<Participante> {
    const { certificado: _c, ...payload } = p as any; void _c;
    const { data, error } = await t('capacitacion_participantes').insert(payload).select(SELECT_PART).single();
    if (error) {
      if (String(error.code) === '23505') throw new Error(`El DNI ${p.dni} ya está registrado en esta capacitación`);
      lanzar(error, 'agregar participante');
    }
    return mapPart(data);
  },
  /** Importación en lote: ignora DNIs ya registrados y devuelve cuántos entraron. */
  async agregarVarios(filas: (Partial<Participante> & { tenant_id: string; capacitacion_id: string; dni: string; nombres: string; apellidos: string })[]): Promise<{ insertados: number; omitidos: number }> {
    if (!filas.length) return { insertados: 0, omitidos: 0 };
    const { data, error } = await t('capacitacion_participantes')
      .upsert(filas, { onConflict: 'capacitacion_id,dni', ignoreDuplicates: true })
      .select('id');
    if (error) lanzar(error, 'importar participantes');
    const insertados = (data ?? []).length;
    return { insertados, omitidos: filas.length - insertados };
  },
  async actualizar(id: string, p: Partial<Participante>): Promise<Participante> {
    const { certificado: _c, ...payload } = p as any; void _c;
    const { data, error } = await t('capacitacion_participantes').update(payload).eq('id', id).select(SELECT_PART).single();
    if (error) lanzar(error, 'actualizar participante');
    return mapPart(data);
  },
  /** Firma tomada en el ERP (tablet/pantalla táctil de la oficina o en campo). */
  async firmarEnErp(id: string, firmaDataUrl: string): Promise<Participante> {
    return this.actualizar(id, {
      firma_data_url: firmaDataUrl, firmado_en: new Date().toISOString(), firma_origen: 'erp', asistio: true,
    } as Partial<Participante>);
  },
  async quitarFirma(id: string): Promise<Participante> {
    return this.actualizar(id, { firma_data_url: null, firmado_en: null, firma_origen: null } as Partial<Participante>);
  },
  async eliminar(id: string): Promise<void> {
    const { error } = await t('capacitacion_participantes').delete().eq('id', id);
    if (error) lanzar(error, 'eliminar participante');
  },
};

// ─── Certificados ───────────────────────────────────────────────────────────
const SELECT_CERT = `*, participante:capacitacion_participantes(id, dni, nombres, apellidos, email)`;

export const dbCertificados = {
  async listarPorCapacitacion(capacitacionId: string): Promise<Certificado[]> {
    const { data, error } = await t('certificados').select(SELECT_CERT).eq('capacitacion_id', capacitacionId).order('codigo');
    if (error) lanzar(error, 'listar certificados');
    return data ?? [];
  },
  async listar(tenantId: string, limite = 500): Promise<Certificado[]> {
    const { data, error } = await t('certificados').select(SELECT_CERT).eq('tenant_id', tenantId).order('emitido_en', { ascending: false }).limit(limite);
    if (error) lanzar(error, 'listar certificados');
    return data ?? [];
  },
  async obtener(id: string): Promise<Certificado | null> {
    const { data, error } = await t('certificados').select(SELECT_CERT).eq('id', id).maybeSingle();
    if (error) lanzar(error, 'obtener certificado');
    return data;
  },
  /** Emite en lote: una fila por participante, con sus snapshots ya resueltos. */
  async emitir(filas: {
    tenant_id: string; capacitacion_id: string; participante_id: string;
    datos: DatosCertificado; plantilla: PlantillaSnapshot; emitido_por: string | null; emitido_por_email: string | null;
  }[]): Promise<Certificado[]> {
    if (!filas.length) return [];
    // Uno por uno: el trigger del correlativo usa un advisory lock por transacción,
    // y así cada certificado recibe su número en orden.
    const out: Certificado[] = [];
    for (const f of filas) {
      const { data, error } = await t('certificados').insert(f).select(SELECT_CERT).single();
      if (error) {
        if (String(error.code) === '23505') continue; // ya tenía certificado
        lanzar(error, 'emitir certificado');
      }
      out.push(data);
    }
    return out;
  },
  async revocar(id: string, motivo: string, por: string | null): Promise<void> {
    const { error } = await t('certificados').update({
      estado: 'revocado', revocado_en: new Date().toISOString(), revocado_por: por, motivo_revocacion: motivo,
    }).eq('id', id);
    if (error) lanzar(error, 'revocar certificado');
  },
  /** Reemite: borra el revocado y deja al participante listo para una nueva emisión. */
  async eliminarRevocado(id: string): Promise<void> {
    const { error } = await t('certificados').delete().eq('id', id).eq('estado', 'revocado');
    if (error) lanzar(error, 'eliminar certificado revocado');
  },
};

export const dbAccesos = {
  async recientes(tenantId: string, limite = 100): Promise<AccesoPortal[]> {
    const { data, error } = await t('certificado_accesos').select('id, tipo, certificado_id, capacitacion_id, ip, resultado, creado_en')
      .eq('tenant_id', tenantId).order('creado_en', { ascending: false }).limit(limite);
    if (error) lanzar(error, 'bitácora del portal');
    return data ?? [];
  },
};

/** Rúbrica registrada por el usuario en "Mi firma" (si la tiene). */
export async function miFirmaRegistrada(userId: string): Promise<{ imagen: string; nombre: string | null } | null> {
  const { data } = await t('firmas_usuario').select('imagen, nombre').eq('user_id', userId).maybeSingle();
  return data?.imagen ? { imagen: data.imagen, nombre: data.nombre ?? null } : null;
}
