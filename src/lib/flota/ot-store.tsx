/**
 * KESA ERP - Flota → Órdenes de Trabajo Store
 * v2.0.0 - Conectado a Supabase (reemplaza mock/seed data)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import type { OrdenTrabajoDB, OTRepuesto, OTExtra } from '../supabase/types';
import { logAudit } from '../shared/audit';
import {
  generarNumeroOT,
  extraerNumeroSecuencial,
  determinarEstadoInicial,
  normalizeOTStatus,
  DEBUG_OT,
  type EstadoOT,
  type TipoOT,
  type CriticidadOT,
  type OTExtraItem
} from './ot-config';

// ============================================================================
// TIPOS
// ============================================================================

export interface OrdenTrabajo {
  // Identificación
  id: string;           // = numero_ot en DB (OT-2024-001)
  _dbId: string;        // UUID interno de la DB (para FK)
  numeroOT: string;
  vehiculoId: string;   // = vehiculo codigo (VH-001)
  vehiculoPlaca: string;

  // Clasificación
  tipo: TipoOT;
  criticidad: CriticidadOT;
  estado: EstadoOT;

  // Descripción
  titulo: string;
  descripcion: string;

  // Fechas y SLA
  fechaCreacion: string;
  fechaProgramada: string;
  fechaInicio: string | null;
  fechaCierre: string | null;
  slaEstimado: number;
  slaReal: number | null;

  // Kilometraje
  kilometrajeRegistro: number;

  // Taller
  taller: {
    id: string;
    nombre: string;
    tipo: 'interno' | 'externo';
  };

  repuestos: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
  }>;

  costos: {
    manoObra: number;
    repuestos: number;
    terceros: number;
    otros: number;
    total: number;
  };

  // Auditoría
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    cerradoPor: string | null;
    cerradoEn: string | null;
  };

  observaciones: string | null;
  notasCierre: string | null;

  // Extras (hallazgos)
  extras: OTExtraItem[];
}

export interface NuevaOrdenTrabajoInput {
  vehiculoId: string;
  vehiculoPlaca: string;
  tipo: TipoOT;
  criticidad: CriticidadOT;
  titulo: string;
  descripcion: string;
  fechaProgramada: string;
  slaEstimado: number;
  kilometrajeRegistro: number;
  taller: {
    id: string;
    nombre: string;
    tipo: 'interno' | 'externo';
  };
  costos?: {
    manoObra: number;
    repuestos: number;
    terceros: number;
    otros: number;
  };
  observaciones?: string;
}

type CrudResult = { exito: boolean; errores?: string[] };

interface OTStoreContext {
  ordenes: OrdenTrabajo[];
  loading: boolean;
  obtenerOTPorNumero: (numeroOT: string) => OrdenTrabajo | undefined;
  obtenerOTsPorVehiculo: (vehiculoId: string) => OrdenTrabajo[];
  crearOrdenTrabajo: (input: NuevaOrdenTrabajoInput) => Promise<OrdenTrabajo>;
  actualizarEstadoOT: (numeroOT: string, nuevoEstado: EstadoOT) => Promise<CrudResult>;
  iniciarOT: (numeroOT: string) => Promise<CrudResult>;
  pausarOT: (numeroOT: string) => Promise<CrudResult>;
  aprobarOT: (numeroOT: string) => Promise<CrudResult>;
  cerrarOT: (numeroOT: string, notasCierre?: string) => Promise<CrudResult>;
  anularOT: (numeroOT: string, motivo: string) => Promise<CrudResult>;
  agregarExtra: (numeroOT: string, extra: OTExtraItem) => Promise<CrudResult>;
  eliminarExtra: (numeroOT: string, extraId: string, motivo: string) => Promise<CrudResult>;
  cargarOTsIniciales: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const OTContext = createContext<OTStoreContext | undefined>(undefined);

// ============================================================================
// MAPPERS DB ↔ FRONTEND
// ============================================================================

function mapRepuestoFromDB(r: OTRepuesto): OrdenTrabajo['repuestos'][0] {
  return {
    id: r.id,
    nombre: r.nombre,
    cantidad: r.cantidad,
    costoUnitario: r.costo_unitario,
    costoTotal: r.costo_total,
  };
}

function mapExtraFromDB(e: OTExtra): OTExtraItem {
  return {
    id: e.id,
    tipo: e.tipo,
    categoria: e.categoria ?? undefined,
    descripcion: e.descripcion,
    motivo: e.motivo,
    cantidad: e.cantidad,
    costoUnitario: e.costo_unitario,
    costoTotal: e.costo_total,
    fechaRegistro: e.fecha_registro,
    registradoPor: e.registrado_por ?? '',
    eliminado: e.eliminado,
    motivoEliminacion: e.motivo_eliminacion ?? undefined,
    eliminadoPor: e.eliminado_por ?? undefined,
    fechaEliminacion: e.fecha_eliminacion ?? undefined,
  };
}

function mapFromDB(
  ot: OrdenTrabajoDB,
  repuestos: OTRepuesto[],
  extras: OTExtra[]
): OrdenTrabajo {
  return {
    id: ot.numero_ot,
    _dbId: ot.id,
    numeroOT: ot.numero_ot,
    vehiculoId: ot.vehiculo_id,   // stored as vehiculo codigo (VH-001) when inserting
    vehiculoPlaca: ot.vehiculo_placa,
    tipo: ot.tipo as TipoOT,
    criticidad: ot.criticidad as CriticidadOT,
    estado: normalizeOTStatus(ot.estado) as EstadoOT,
    titulo: ot.titulo,
    descripcion: ot.descripcion,
    fechaCreacion: ot.creado_en,
    fechaProgramada: ot.fecha_programada,
    fechaInicio: ot.fecha_inicio,
    fechaCierre: ot.fecha_cierre,
    slaEstimado: ot.sla_estimado_horas ?? 0,
    slaReal: ot.sla_real_horas,
    kilometrajeRegistro: ot.kilometraje_registro,
    taller: {
      id: ot.taller_nombre, // no separate taller_id in DB; use nombre as key
      nombre: ot.taller_nombre,
      tipo: ot.taller_tipo,
    },
    repuestos: repuestos.map(mapRepuestoFromDB),
    costos: {
      manoObra: ot.costo_mano_obra,
      repuestos: ot.costo_repuestos,
      terceros: ot.costo_terceros,
      otros: ot.costo_otros,
      total: ot.costo_total,
    },
    auditoria: {
      creadoPor: ot.creado_por ?? '',
      creadoEn: ot.creado_en,
      modificadoPor: ot.modificado_por,
      modificadoEn: ot.modificado_en,
      cerradoPor: ot.cerrado_por,
      cerradoEn: ot.fecha_cierre,
    },
    observaciones: ot.motivo_anulacion ?? null, // reuse for general observaciones field
    notasCierre: null,
    extras: extras.map(mapExtraFromDB),
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function OTStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------------------------------
  // FETCH INICIAL
  // --------------------------------------------------------------------------

  const fetchOrdenes = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*, repuestos:ot_repuestos(*), extras:ot_extras(*)')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('[ot-store.fetch]', error.message);
        return;
      }

      const mapped = (data ?? []).map((row: any) =>
        mapFromDB(
          row as OrdenTrabajoDB,
          (row.repuestos ?? []) as OTRepuesto[],
          (row.extras ?? []) as OTExtra[]
        )
      );
      setOrdenes(mapped);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  const cargarOTsIniciales = useCallback(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  // --------------------------------------------------------------------------
  // QUERIES (sync, sobre estado local)
  // --------------------------------------------------------------------------

  const obtenerOTPorNumero = useCallback(
    (numeroOT: string) => ordenes.find(ot => ot.numeroOT === numeroOT),
    [ordenes]
  );

  const obtenerOTsPorVehiculo = useCallback(
    (vehiculoId: string) => ordenes.filter(ot => ot.vehiculoId === vehiculoId),
    [ordenes]
  );

  // --------------------------------------------------------------------------
  // CREAR OT
  // --------------------------------------------------------------------------

  const crearOrdenTrabajo = useCallback(async (input: NuevaOrdenTrabajoInput): Promise<OrdenTrabajo> => {
    const numeros = ordenes
      .map(ot => extraerNumeroSecuencial(ot.numeroOT))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const numeroOT = generarNumeroOT(ultimoNumero);

    const costos = input.costos ?? { manoObra: 0, repuestos: 0, terceros: 0, otros: 0 };
    const estadoInicial = determinarEstadoInicial(
      costos.manoObra + costos.repuestos + costos.terceros + costos.otros
    );

    const insertPayload = {
      tenant_id: tenantId!,
      numero_ot: numeroOT,
      vehiculo_id: input.vehiculoId,
      vehiculo_placa: input.vehiculoPlaca,
      tipo: input.tipo,
      criticidad: input.criticidad,
      estado: estadoInicial,
      titulo: input.titulo,
      descripcion: input.descripcion,
      fecha_programada: input.fechaProgramada,
      sla_estimado_horas: input.slaEstimado,
      kilometraje_registro: input.kilometrajeRegistro,
      taller_nombre: input.taller.nombre,
      taller_tipo: input.taller.tipo,
      costo_mano_obra: costos.manoObra,
      costo_repuestos: costos.repuestos,
      costo_terceros: costos.terceros,
      costo_otros: costos.otros,
      creado_por: user?.email ?? null,
      motivo_anulacion: input.observaciones ?? null,
    };

    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      console.error('[ot-store.crear]', error?.message);
      throw new Error(error?.message ?? 'Error al crear la OT');
    }

    const nuevaOT = mapFromDB(data as OrdenTrabajoDB, [], []);

    if (DEBUG_OT) {
      console.log('[OT_CREATED]', { numeroOT: nuevaOT.numeroOT, estado: nuevaOT.estado });
    }

    setOrdenes(prev => [nuevaOT, ...prev]);
    logAudit({ tenantId: tenantId!, usuarioEmail: user?.email ?? null, accion: 'crear', entidadTipo: 'orden_trabajo', entidadId: nuevaOT.numeroOT, entidadLabel: nuevaOT.titulo });
    return nuevaOT;
  }, [ordenes, tenantId, user]);

  // --------------------------------------------------------------------------
  // HELPERS DE UPDATE
  // --------------------------------------------------------------------------

  const updateOT = useCallback(async (
    numeroOT: string,
    patch: Record<string, unknown>,
    localPatch: (ot: OrdenTrabajo) => Partial<OrdenTrabajo>
  ): Promise<CrudResult> => {
    // Read current OT from state snapshot via functional update trick
    let dbId: string | undefined;
    setOrdenes(prev => {
      dbId = prev.find(o => o.numeroOT === numeroOT)?._dbId;
      return prev;
    });

    if (!dbId) return { exito: false, errores: ['OT no encontrada'] };

    const { error } = await supabase
      .from('ordenes_trabajo')
      .update(patch)
      .eq('id', dbId);

    if (error) {
      console.error('[ot-store.update]', error.message);
      return { exito: false, errores: [error.message] };
    }

    setOrdenes(prev =>
      prev.map(o => o.numeroOT === numeroOT ? { ...o, ...localPatch(o) } : o)
    );
    return { exito: true };
  }, []);

  // --------------------------------------------------------------------------
  // CAMBIOS DE ESTADO
  // --------------------------------------------------------------------------

  const actualizarEstadoOT = useCallback(async (numeroOT: string, nuevoEstado: EstadoOT): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;
    const isFinal = nuevoEstado === 'cerrada' || nuevoEstado === 'anulada';

    return updateOT(
      numeroOT,
      {
        estado: nuevoEstado,
        modificado_por: email,
        modificado_en: ts,
        ...(isFinal ? { cerrado_por: email, fecha_cierre: ts } : {}),
      },
      (ot) => ({
        estado: nuevoEstado,
        auditoria: {
          ...ot.auditoria,
          modificadoPor: email,
          modificadoEn: ts,
          ...(isFinal ? { cerradoPor: email, cerradoEn: ts } : {}),
        },
        ...(isFinal ? { fechaCierre: ts } : {}),
      })
    );
  }, [updateOT, user]);

  const iniciarOT = useCallback(async (numeroOT: string): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;
    return updateOT(
      numeroOT,
      { estado: 'en_ejecucion', fecha_inicio: ts, modificado_por: email, modificado_en: ts },
      () => ({ estado: 'en_ejecucion', fechaInicio: ts })
    );
  }, [updateOT, user]);

  const pausarOT = useCallback(async (numeroOT: string): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;
    // 'pausada' no está en EstadoOT; usamos espera_repuesto como equivalente
    return updateOT(
      numeroOT,
      { estado: 'espera_repuesto', modificado_por: email, modificado_en: ts },
      () => ({ estado: 'espera_repuesto' as EstadoOT })
    );
  }, [updateOT, user]);

  const aprobarOT = useCallback(async (numeroOT: string): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;
    const result = await updateOT(
      numeroOT,
      { estado: 'en_ejecucion', aprobado_por: email, aprobado_en: ts, modificado_por: email, modificado_en: ts },
      () => ({ estado: 'en_ejecucion' })
    );
    if (result.exito && tenantId) logAudit({ tenantId, usuarioEmail: email, accion: 'aprobar', entidadTipo: 'orden_trabajo', entidadId: numeroOT });
    return result;
  }, [updateOT, user, tenantId]);

  const cerrarOT = useCallback(async (numeroOT: string, notasCierre?: string): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;
    const result = await updateOT(
      numeroOT,
      { estado: 'cerrada', fecha_cierre: ts, cerrado_por: email, modificado_por: email, modificado_en: ts },
      () => ({ estado: 'cerrada', fechaCierre: ts, notasCierre: notasCierre ?? null })
    );
    if (result.exito && tenantId) logAudit({ tenantId, usuarioEmail: email, accion: 'cerrar', entidadTipo: 'orden_trabajo', entidadId: numeroOT });
    return result;
  }, [updateOT, user, tenantId]);

  const anularOT = useCallback(async (numeroOT: string, motivo: string): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;
    const result = await updateOT(
      numeroOT,
      { estado: 'anulada', motivo_anulacion: motivo, cerrado_por: email, fecha_cierre: ts, modificado_por: email, modificado_en: ts },
      () => ({ estado: 'anulada', observaciones: motivo, notasCierre: motivo, fechaCierre: ts })
    );
    if (result.exito && tenantId) logAudit({ tenantId, usuarioEmail: email, accion: 'eliminar', entidadTipo: 'orden_trabajo', entidadId: numeroOT, entidadLabel: `Anulada: ${motivo}` });
    return result;
  }, [updateOT, user, tenantId]);

  // --------------------------------------------------------------------------
  // EXTRAS
  // --------------------------------------------------------------------------

  const agregarExtra = useCallback(async (numeroOT: string, extra: OTExtraItem): Promise<CrudResult> => {
    const ot = ordenes.find(o => o.numeroOT === numeroOT);
    if (!ot) return { exito: false, errores: ['OT no encontrada'] };

    const { data, error } = await supabase
      .from('ot_extras')
      .insert({
        tenant_id: tenantId!,
        orden_trabajo_id: ot._dbId,
        tipo: extra.tipo,
        categoria: extra.categoria ?? null,
        descripcion: extra.descripcion,
        motivo: extra.motivo,
        cantidad: extra.cantidad,
        costo_unitario: extra.costoUnitario,
        eliminado: false,
        registrado_por: user?.email ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[ot-store.agregarExtra]', error?.message);
      return { exito: false, errores: [error?.message ?? 'Error al agregar extra'] };
    }

    const nuevoExtra = mapExtraFromDB(data as OTExtra);
    setOrdenes(prev =>
      prev.map(o =>
        o.numeroOT === numeroOT
          ? { ...o, extras: [...o.extras, nuevoExtra] }
          : o
      )
    );
    return { exito: true };
  }, [ordenes, tenantId, user]);

  const eliminarExtra = useCallback(async (numeroOT: string, extraId: string, motivo: string): Promise<CrudResult> => {
    const ts = new Date().toISOString();
    const email = user?.email ?? null;

    const { error } = await supabase
      .from('ot_extras')
      .update({
        eliminado: true,
        motivo_eliminacion: motivo,
        eliminado_por: email,
        fecha_eliminacion: ts,
      })
      .eq('id', extraId);

    if (error) {
      console.error('[ot-store.eliminarExtra]', error.message);
      return { exito: false, errores: [error.message] };
    }

    setOrdenes(prev =>
      prev.map(o =>
        o.numeroOT === numeroOT
          ? {
              ...o,
              extras: o.extras.map(ex =>
                ex.id === extraId
                  ? { ...ex, eliminado: true, motivoEliminacion: motivo, eliminadoPor: email ?? '', fechaEliminacion: ts }
                  : ex
              ),
            }
          : o
      )
    );
    return { exito: true };
  }, [user]);

  // --------------------------------------------------------------------------
  // VALUE
  // --------------------------------------------------------------------------

  const value: OTStoreContext = {
    ordenes,
    loading,
    obtenerOTPorNumero,
    obtenerOTsPorVehiculo,
    crearOrdenTrabajo,
    actualizarEstadoOT,
    iniciarOT,
    pausarOT,
    aprobarOT,
    cerrarOT,
    anularOT,
    agregarExtra,
    eliminarExtra,
    cargarOTsIniciales,
  };

  return <OTContext.Provider value={value}>{children}</OTContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOTStore() {
  const context = useContext(OTContext);
  if (!context) {
    throw new Error('useOTStore debe usarse dentro de OTStoreProvider');
  }
  return context;
}
