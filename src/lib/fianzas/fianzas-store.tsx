/**
 * Fianzas — cartas fianza de fiel cumplimiento ante las entidades.
 *
 * El modelo respeta la hoja que mantiene Administración: una fianza por
 * contrato/entidad, y debajo la cadena de cartas (la original y sus
 * renovaciones). `fin` y `fechaRenovacion` NO se editan: las calcula la base
 * con las mismas fórmulas del Excel (FIN = INICIO + PLAZO − 1, RENOVACIÓN =
 * FIN − 5), para que no puedan volver a teclearse mal.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

export type EstadoCarta = 'vigente' | 'renovada' | 'devuelta';

export interface CartaFianza {
  id: string;
  fianzaId: string;
  numero: string;
  aseguradora: string | null;
  tipo: string | null;
  inicio: string;
  plazoDias: number;
  /** Calculada en la base. */
  fin: string;
  /** Calculada en la base. */
  fechaRenovacion: string;
  montoAfianzado: number | null;
  costoRenovacion: number | null;
  encaje: number | null;
  estado: EstadoCarta;
  notas: string | null;
  migradoDe: string | null;
}

export interface Fianza {
  id: string;
  concurso: string | null;
  nombreProyecto: string;
  proyectoId: string | null;
  proyectoNombre: string | null;
  consorcio: string | null;
  entidad: string;
  montoContrato: number | null;
  porcentaje: number | null;
  notas: string | null;
  cartas: CartaFianza[];
}

export interface CargoFianza {
  id: string;
  fianzaId: string;
  cartaId: string | null;
  nombre: string;
  storagePath: string | null;
  sharepointUrl: string | null;
  subidoPor: string | null;
  subidoEn: string;
  tamanoBytes: number | null;
  mime: string | null;
}

export const BUCKET_CARGOS = 'cargos-fianzas';

/** Días que faltan para renovar. Negativo = ya pasó la fecha. */
export function diasParaRenovar(carta: CartaFianza): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(carta.fechaRenovacion + 'T00:00:00');
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

export type Urgencia = 'vencida' | 'critica' | 'proxima' | 'holgada';

/**
 * Semáforo de la renovación. Los cortes salen de cómo trabaja Administración:
 * la fecha de renovación ya viene 5 días antes del vencimiento, así que
 * llegar a 0 significa que la carta vence esta semana.
 */
export function urgencia(carta: CartaFianza): Urgencia {
  const d = diasParaRenovar(carta);
  if (d < 0) return 'vencida';
  if (d <= 15) return 'critica';
  if (d <= 45) return 'proxima';
  return 'holgada';
}

interface FianzasContext {
  fianzas: Fianza[];
  cargos: CargoFianza[];
  loading: boolean;
  recargar: () => Promise<void>;
  guardarCarta: (fianzaId: string, carta: Partial<CartaFianza> & { numero: string; inicio: string; plazoDias: number }) => Promise<string | null>;
  actualizarCarta: (id: string, cambios: Partial<CartaFianza>) => Promise<string | null>;
  guardarFianza: (f: Partial<Fianza> & { nombreProyecto: string; entidad: string }) => Promise<string | null>;
  registrarCargo: (c: { fianzaId: string; cartaId?: string | null; nombre: string; sharepointUrl?: string | null }) => Promise<string | null>;
  /** Sube el archivo al bucket y deja el registro del cargo. */
  subirCargo: (c: { fianzaId: string; cartaId?: string | null; archivo: File }) => Promise<string | null>;
  /** URL firmada y temporal para ver o descargar un cargo guardado. */
  urlDeCargo: (cargo: CargoFianza, descargar?: boolean) => Promise<string | null>;
  eliminarCargo: (cargo: CargoFianza) => Promise<string | null>;
  eliminarCarta: (id: string) => Promise<string | null>;
}

const Ctx = createContext<FianzasContext | undefined>(undefined);

/* eslint-disable @typescript-eslint/no-explicit-any */
const tabla = (n: string) => supabase.from(n) as any;

function mapCarta(r: any): CartaFianza {
  return {
    id: r.id,
    fianzaId: r.fianza_id,
    numero: r.numero,
    aseguradora: r.aseguradora,
    tipo: r.tipo,
    inicio: r.inicio,
    plazoDias: r.plazo_dias,
    fin: r.fin,
    fechaRenovacion: r.fecha_renovacion,
    montoAfianzado: r.monto_afianzado === null ? null : Number(r.monto_afianzado),
    costoRenovacion: r.costo_renovacion === null ? null : Number(r.costo_renovacion),
    encaje: r.encaje === null ? null : Number(r.encaje),
    estado: r.estado,
    notas: r.notas,
    migradoDe: r.migrado_de,
  };
}

export function FianzasProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [fianzas, setFianzas] = useState<Fianza[]>([]);
  const [cargos, setCargos] = useState<CargoFianza[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const [f, k, g] = await Promise.all([
      tabla('fianzas').select('*, proyecto:proyectos(nombre)').order('nombre_proyecto'),
      tabla('fianza_cartas').select('*').order('inicio', { ascending: false }),
      tabla('fianza_cargos').select('*').order('subido_en', { ascending: false }),
    ]);

    const porFianza = new Map<string, CartaFianza[]>();
    for (const r of (k.data ?? [])) {
      const c = mapCarta(r);
      if (!porFianza.has(c.fianzaId)) porFianza.set(c.fianzaId, []);
      porFianza.get(c.fianzaId)!.push(c);
    }

    setFianzas((f.data ?? []).map((r: any) => ({
      id: r.id,
      concurso: r.concurso,
      nombreProyecto: r.nombre_proyecto,
      proyectoId: r.proyecto_id,
      proyectoNombre: r.proyecto?.nombre ?? null,
      consorcio: r.consorcio,
      entidad: r.entidad,
      montoContrato: r.monto_contrato === null ? null : Number(r.monto_contrato),
      porcentaje: r.porcentaje === null ? null : Number(r.porcentaje),
      notas: r.notas,
      cartas: porFianza.get(r.id) ?? [],
    })));

    setCargos((g.data ?? []).map((r: any) => ({
      id: r.id,
      fianzaId: r.fianza_id,
      cartaId: r.carta_id,
      nombre: r.nombre,
      storagePath: r.storage_path,
      sharepointUrl: r.sharepoint_url,
      subidoPor: r.subido_por,
      subidoEn: r.subido_en,
      tamanoBytes: r.tamano_bytes === null ? null : Number(r.tamano_bytes),
      mime: r.mime,
    })));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const guardarFianza = useCallback(async (f: Partial<Fianza> & { nombreProyecto: string; entidad: string }) => {
    if (!tenantId) return 'Sin sesión activa';
    const { error } = await tabla('fianzas').upsert({
      ...(f.id ? { id: f.id } : {}),
      tenant_id: tenantId,
      concurso: f.concurso ?? null,
      nombre_proyecto: f.nombreProyecto,
      proyecto_id: f.proyectoId ?? null,
      consorcio: f.consorcio ?? null,
      entidad: f.entidad,
      monto_contrato: f.montoContrato ?? null,
      porcentaje: f.porcentaje ?? null,
      notas: f.notas ?? null,
      actualizado_en: new Date().toISOString(),
    });
    if (error) return error.message;
    await recargar();
    return null;
  }, [tenantId, recargar]);

  const guardarCarta = useCallback(async (
    fianzaId: string,
    carta: Partial<CartaFianza> & { numero: string; inicio: string; plazoDias: number },
  ) => {
    if (!tenantId) return 'Sin sesión activa';
    // Al registrar una carta nueva como vigente, la anterior pasa a renovada:
    // solo una carta de la cadena puede estar vigente a la vez.
    if ((carta.estado ?? 'vigente') === 'vigente') {
      await tabla('fianza_cartas')
        .update({ estado: 'renovada' })
        .eq('fianza_id', fianzaId).eq('estado', 'vigente');
    }
    const { error } = await tabla('fianza_cartas').insert({
      tenant_id: tenantId,
      fianza_id: fianzaId,
      numero: carta.numero,
      aseguradora: carta.aseguradora ?? null,
      tipo: carta.tipo ?? 'FIEL CUMPLIMIENTO',
      inicio: carta.inicio,
      plazo_dias: carta.plazoDias,
      monto_afianzado: carta.montoAfianzado ?? null,
      costo_renovacion: carta.costoRenovacion ?? null,
      encaje: carta.encaje ?? null,
      estado: carta.estado ?? 'vigente',
      notas: carta.notas ?? null,
    });
    if (error) return error.message;
    await recargar();
    return null;
  }, [tenantId, recargar]);

  const actualizarCarta = useCallback(async (id: string, cambios: Partial<CartaFianza>) => {
    const payload: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
    if (cambios.numero !== undefined) payload.numero = cambios.numero;
    if (cambios.aseguradora !== undefined) payload.aseguradora = cambios.aseguradora;
    if (cambios.inicio !== undefined) payload.inicio = cambios.inicio;
    if (cambios.plazoDias !== undefined) payload.plazo_dias = cambios.plazoDias;
    if (cambios.montoAfianzado !== undefined) payload.monto_afianzado = cambios.montoAfianzado;
    if (cambios.costoRenovacion !== undefined) payload.costo_renovacion = cambios.costoRenovacion;
    if (cambios.encaje !== undefined) payload.encaje = cambios.encaje;
    if (cambios.estado !== undefined) payload.estado = cambios.estado;
    if (cambios.notas !== undefined) payload.notas = cambios.notas;
    const { error } = await tabla('fianza_cartas').update(payload).eq('id', id);
    if (error) return error.message;
    await recargar();
    return null;
  }, [recargar]);

  const registrarCargo = useCallback(async (c: {
    fianzaId: string; cartaId?: string | null; nombre: string; sharepointUrl?: string | null;
  }) => {
    if (!tenantId) return 'Sin sesión activa';
    const { error } = await tabla('fianza_cargos').insert({
      tenant_id: tenantId,
      fianza_id: c.fianzaId,
      carta_id: c.cartaId ?? null,
      nombre: c.nombre,
      sharepoint_url: c.sharepointUrl ?? null,
      subido_por: user?.email ?? null,
    });
    if (error) return error.message;
    await recargar();
    return null;
  }, [tenantId, user, recargar]);

  const subirCargo = useCallback(async (c: { fianzaId: string; cartaId?: string | null; archivo: File }) => {
    if (!tenantId) return 'Sin sesión activa';
    // La ruta empieza por el tenant: es lo que compara la política de storage.
    const limpio = c.archivo.name.replace(/[^\w.\- ]+/g, '_');
    const ruta = `${tenantId}/${c.fianzaId}/${Date.now()}-${limpio}`;

    const { error: errSubida } = await supabase.storage
      .from(BUCKET_CARGOS)
      .upload(ruta, c.archivo, { contentType: c.archivo.type || undefined, upsert: false });
    if (errSubida) return errSubida.message;

    const { error } = await tabla('fianza_cargos').insert({
      tenant_id: tenantId,
      fianza_id: c.fianzaId,
      carta_id: c.cartaId ?? null,
      nombre: c.archivo.name,
      storage_path: ruta,
      subido_por: user?.email ?? null,
      tamano_bytes: c.archivo.size,
      mime: c.archivo.type || null,
    });
    if (error) {
      // Si no se pudo registrar, no dejar el archivo suelto en el bucket.
      await supabase.storage.from(BUCKET_CARGOS).remove([ruta]);
      return error.message;
    }
    await recargar();
    return null;
  }, [tenantId, user, recargar]);

  const urlDeCargo = useCallback(async (cargo: CargoFianza, descargar = false) => {
    if (!cargo.storagePath) return cargo.sharepointUrl;
    const { data, error } = await supabase.storage
      .from(BUCKET_CARGOS)
      .createSignedUrl(cargo.storagePath, 300, descargar ? { download: cargo.nombre } : undefined);
    if (error) return null;
    return data?.signedUrl ?? null;
  }, []);

  const eliminarCargo = useCallback(async (cargo: CargoFianza) => {
    if (cargo.storagePath) {
      const { error } = await supabase.storage.from(BUCKET_CARGOS).remove([cargo.storagePath]);
      if (error) return error.message;
    }
    const { error } = await tabla('fianza_cargos').delete().eq('id', cargo.id);
    if (error) return error.message;
    await recargar();
    return null;
  }, [recargar]);

  const eliminarCarta = useCallback(async (id: string) => {
    const { error } = await tabla('fianza_cartas').delete().eq('id', id);
    if (error) return error.message;
    await recargar();
    return null;
  }, [recargar]);

  return (
    <Ctx.Provider value={{ fianzas, cargos, loading, recargar, guardarFianza, guardarCarta, actualizarCarta, registrarCargo, subirCargo, urlDeCargo, eliminarCargo, eliminarCarta }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFianzas() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFianzas debe usarse dentro de FianzasProvider');
  return c;
}
