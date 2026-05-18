/**
 * STORE DE MANTENIMIENTOS BIOMÉDICOS
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { dbMantenimientosBiomedicos } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import { validateTransition, MANTENIMIENTO_BIO_TRANSITIONS } from '../shared/state-machine';
import type { MantenimientoBiomedico as MantenimientoDBRow } from '../supabase/types';
import {
  generarNumeroMantenimiento,
  extraerNumeroSecuencial,
  DEBUG_MANTENIMIENTO_BIO,
  type EstadoMantenimientoBio,
  type TipoMantenimientoBio,
  type PrioridadMantenimientoBio,
} from './mantenimientos-config';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface MantenimientoBiomedico {
  // Identificación
  id: string;
  _dbId: string;
  numeroMantenimiento: string;
  equipoId: string;     // ID frontend (codigo del equipo, ej: EB-2024-001)
  equipoDbId: string;   // UUID interno del equipo en DB (para FK)
  equipoCodigo: string;
  equipoNombre: string;

  // Clasificación
  tipo: TipoMantenimientoBio;
  prioridad: PrioridadMantenimientoBio;
  estado: EstadoMantenimientoBio;

  // Descripción
  titulo: string;
  descripcion: string;

  // Fechas
  fechaCreacion: string;
  fechaProgramada: string;
  fechaInicio: string | null;
  fechaCompletado: string | null;

  // Responsables
  tecnico: {
    id: string;
    nombre: string;
    empresa: string;
  };

  // Actividades realizadas
  actividadesRealizadas: string | null;
  repuestosUtilizados: Array<{
    nombre: string;
    cantidad: number;
    observacion?: string;
  }>;

  // Auditoría
  auditoria: {
    creadoPor: string | null;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    completadoPor: string | null;
    completadoEn: string | null;
  };

  observaciones: string | null;

  // Imputación dual
  proyectoId: string | null;
  centroCostoId: string | null;
}

export interface NuevoMantenimientoBiomedicoInput {
  equipoId: string;       // ID frontend (codigo, ej: EB-2024-001) — también se acepta el _dbId
  equipoDbId?: string;    // UUID del equipo en DB (si disponible)
  equipoCodigo: string;
  equipoNombre: string;
  tipo: TipoMantenimientoBio;
  prioridad: PrioridadMantenimientoBio;
  titulo: string;
  descripcion: string;
  fechaProgramada: string;
  tecnico: {
    id: string;
    nombre: string;
    empresa: string;
  };
  observaciones?: string;
  proyectoId?: string | null;
  centroCostoId?: string | null;
}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface MantenimientosStoreContext {
  mantenimientos: MantenimientoBiomedico[];
  loading: boolean;
  obtenerMantenimientoPorNumero: (numero: string) => MantenimientoBiomedico | undefined;
  obtenerMantenimientosPorEquipo: (equipoId: string) => MantenimientoBiomedico[];
  crearMantenimiento: (input: NuevoMantenimientoBiomedicoInput) => Promise<MantenimientoBiomedico>;
  actualizarEstadoMantenimiento: (numero: string, nuevoEstado: EstadoMantenimientoBio) => Promise<CrudResult>;
  cargarMantenimientosIniciales: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const MantenimientosContext = createContext<MantenimientosStoreContext | undefined>(undefined);

// ============================================================================
// HELPERS — mapeo entre tipos DB y frontend
// ============================================================================

/**
 * La DB usa CriticidadOTDB ('baja' | 'media' | 'alta' | 'critica')
 * El frontend usa PrioridadMantenimientoBio ('baja' | 'media' | 'alta' | 'urgente')
 * Mapeamos 'critica' ↔ 'urgente'
 */
function dbPrioridadToFrontend(p: string): PrioridadMantenimientoBio {
  if (p === 'critica') return 'urgente';
  return p as PrioridadMantenimientoBio;
}

function frontendPrioridadToDB(p: PrioridadMantenimientoBio): string {
  if (p === 'urgente') return 'critica';
  return p;
}

/**
 * La DB usa EstadoMantenimientoBio del types.ts: 'programado' | 'en_ejecucion' | 'completado' | 'anulado'
 * El frontend usa: 'programado' | 'en_ejecucion' | 'completado' | 'cancelado'
 * Mapeamos 'anulado' ↔ 'cancelado'
 */
function dbEstadoToFrontend(e: string): EstadoMantenimientoBio {
  if (e === 'anulado') return 'cancelado';
  return e as EstadoMantenimientoBio;
}

function frontendEstadoToDB(e: EstadoMantenimientoBio): string {
  if (e === 'cancelado') return 'anulado';
  return e;
}

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: MantenimientoDBRow): MantenimientoBiomedico {
  // Intentar parsear tecnico desde acciones_realizadas o hallazgos si están serializados
  let tecnicoNombre = row.tecnico_nombre ?? '';
  let tecnicoEmpresa = '';
  let tecnicoId = 'TEC-DB';

  // Deserializar tecnico de tecnico_nombre si está en formato JSON
  try {
    const parsed = JSON.parse(tecnicoNombre);
    if (parsed && typeof parsed === 'object') {
      tecnicoNombre = parsed.nombre ?? tecnicoNombre;
      tecnicoEmpresa = parsed.empresa ?? '';
      tecnicoId = parsed.id ?? tecnicoId;
    }
  } catch {
    // No es JSON — usar como nombre simple
  }

  return {
    id: row.numero,
    _dbId: row.id,
    numeroMantenimiento: row.numero,
    equipoId: row.equipo_codigo,   // usamos codigo como ID frontend
    equipoDbId: row.equipo_id,
    equipoCodigo: row.equipo_codigo,
    equipoNombre: '',  // no en DB directamente (puede venir del join)
    tipo: row.tipo as TipoMantenimientoBio,
    prioridad: dbPrioridadToFrontend(row.prioridad),
    estado: dbEstadoToFrontend(row.estado),
    titulo: row.titulo,
    descripcion: row.descripcion ?? '',
    fechaCreacion: row.creado_en,
    fechaProgramada: row.fecha_programada,
    fechaInicio: row.fecha_inicio ?? null,
    fechaCompletado: row.fecha_cierre ?? null,
    tecnico: {
      id: tecnicoId,
      nombre: tecnicoNombre,
      empresa: tecnicoEmpresa,
    },
    actividadesRealizadas: row.acciones_realizadas ?? null,
    repuestosUtilizados: [],
    auditoria: {
      creadoPor: row.creado_por,
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
      completadoPor: null,
      completadoEn: row.fecha_cierre ?? null,
    },
    observaciones: row.recomendaciones ?? null,
    proyectoId: row.proyecto_id ?? null,
    centroCostoId: row.centro_costo_id ?? null,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function MantenimientosStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [mantenimientos, setMantenimientos] = useState<MantenimientoBiomedico[]>([]);
  const mantenimientosRef = useRef(mantenimientos);
  useEffect(() => { mantenimientosRef.current = mantenimientos; }, [mantenimientos]);
  const [loading, setLoading] = useState(true);

  // Carga inicial desde Supabase
  const fetchMantenimientos = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data, error } = await dbMantenimientosBiomedicos.list();

    if (error) {
      console.error('[MANTENIMIENTOS_BIO] Error al cargar:', error.message);
    } else if (data) {
      // data puede incluir join `equipo` gracias al select en helpers
      const mapped = (data as Array<MantenimientoDBRow & { equipo?: { codigo: string; nombre: string; categoria: string } }>)
        .map(row => {
          const m = mapFromDB(row);
          // Enriquecer con datos del join de equipo si existe
          if (row.equipo) {
            m.equipoNombre = row.equipo.nombre ?? '';
            m.equipoCodigo = row.equipo.codigo ?? m.equipoCodigo;
          }
          return m;
        });
      setMantenimientos(mapped);
      if (DEBUG_MANTENIMIENTO_BIO) {
        console.log('[MANTENIMIENTOS_BIO] Cargados desde Supabase:', mapped.length);
      }
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchMantenimientos();
  }, [fetchMantenimientos]);

  // cargarMantenimientosIniciales: legacy shim, triggers re-fetch
  const cargarMantenimientosIniciales = useCallback(() => {
    fetchMantenimientos();
  }, [fetchMantenimientos]);

  // ============================================================================
  // QUERIES (síncronas)
  // ============================================================================

  const obtenerMantenimientoPorNumero = useCallback((numero: string) => {
    return mantenimientos.find(m => m.numeroMantenimiento === numero);
  }, [mantenimientos]);

  const obtenerMantenimientosPorEquipo = useCallback((equipoId: string) => {
    // Buscar por equipoId (codigo), equipoDbId (UUID) o equipoCodigo
    return mantenimientos.filter(m =>
      m.equipoId === equipoId || m.equipoDbId === equipoId || m.equipoCodigo === equipoId
    );
  }, [mantenimientos]);

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearMantenimiento = useCallback(async (
    input: NuevoMantenimientoBiomedicoInput
  ): Promise<MantenimientoBiomedico> => {
    if (!tenantId || !user) {
      throw new Error('Sin sesión activa');
    }

    // Determinar siguiente número secuencial
    const numeros = mantenimientos
      .map(m => extraerNumeroSecuencial(m.numeroMantenimiento))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const nuevoNumero = generarNumeroMantenimiento(ultimoNumero);

    // Serializar tecnico en tecnico_nombre (JSON) para preservar datos completos
    const tecnicoJson = JSON.stringify({
      id: input.tecnico.id,
      nombre: input.tecnico.nombre,
      empresa: input.tecnico.empresa,
    });

    // FK a equipo: usar equipoDbId si fue pasado, sino equipoId asumiendo que es el UUID
    const equipoDbId = input.equipoDbId ?? input.equipoId;

    const { data: inserted, error } = await dbMantenimientosBiomedicos.create({
      tenant_id: tenantId,
      numero: nuevoNumero,
      equipo_id: equipoDbId,
      equipo_codigo: input.equipoCodigo,
      tipo: input.tipo,
      estado: 'programado',
      prioridad: frontendPrioridadToDB(input.prioridad),
      titulo: input.titulo,
      descripcion: input.descripcion,
      hallazgos: null,
      acciones_realizadas: null,
      recomendaciones: input.observaciones ?? null,
      fecha_programada: input.fechaProgramada,
      fecha_inicio: null,
      fecha_cierre: null,
      tecnico_nombre: tecnicoJson,
      proveedor_id: null,
      costo_mano_obra: 0,
      costo_repuestos: 0,
      proxima_fecha: null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
      proyecto_id: input.proyectoId ?? null,
      centro_costo_id: input.centroCostoId ?? null,
    } as any);

    if (error) {
      console.error('[MANTENIMIENTOS_BIO] Error al crear:', error.message);
      throw new Error(error.message);
    }

    const nuevo = mapFromDB(inserted as MantenimientoDBRow);
    // Enriquecer con datos que no están en DB
    const nuevoCompleto: MantenimientoBiomedico = {
      ...nuevo,
      equipoNombre: input.equipoNombre,
      equipoCodigo: input.equipoCodigo,
      equipoId: input.equipoId,
      equipoDbId: equipoDbId,
      tecnico: input.tecnico,
      observaciones: input.observaciones ?? null,
    };

    setMantenimientos(prev => [nuevoCompleto, ...prev]);

    if (DEBUG_MANTENIMIENTO_BIO) {
      console.log('[MANTENIMIENTO_BIO_CREATED]', {
        numero: nuevoCompleto.numeroMantenimiento,
        equipoCodigo: nuevoCompleto.equipoCodigo,
        tipo: nuevoCompleto.tipo,
      });
    }

    return nuevoCompleto;
  }, [mantenimientos, tenantId, user]);

  const actualizarEstadoMantenimiento = useCallback(async (
    numero: string,
    nuevoEstado: EstadoMantenimientoBio
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    // Validar transición de estado
    const mantActual = mantenimientos.find(m => m.numeroMantenimiento === numero);
    if (mantActual) {
      const check = validateTransition(mantActual.estado, nuevoEstado, MANTENIMIENTO_BIO_TRANSITIONS, `Mantenimiento ${numero}`);
      if (!check.valid) return { exito: false, errores: [check.error] };
    }

    const dbId = mantenimientosRef.current.find(m => m.numeroMantenimiento === numero)?._dbId;
    if (!dbId) return { exito: false, errores: ['Mantenimiento no encontrado'] };

    const ahora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      estado: frontendEstadoToDB(nuevoEstado),
      modificado_por: user.id,
      modificado_en: ahora,
    };

    // Actualizar fechas según estado
    let fechaInicio: string | undefined;
    let fechaCierre: string | undefined;

    const actual = mantenimientosRef.current.find(m => m.numeroMantenimiento === numero);
    if (actual) {
      if (nuevoEstado === 'en_ejecucion' && !actual.fechaInicio) {
        fechaInicio = ahora;
        updatePayload.fecha_inicio = ahora;
      }
      if (nuevoEstado === 'completado') {
        fechaCierre = ahora;
        updatePayload.fecha_cierre = ahora;
      }
    }

    const { error } = await dbMantenimientosBiomedicos.update(dbId, updatePayload);

    if (error) {
      console.error('[MANTENIMIENTOS_BIO] Error al actualizar estado:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setMantenimientos(prev => prev.map(m => {
      if (m.numeroMantenimiento !== numero) return m;
      return {
        ...m,
        estado: nuevoEstado,
        ...(fechaInicio && !m.fechaInicio ? { fechaInicio } : {}),
        ...(fechaCierre ? { fechaCompletado: fechaCierre } : {}),
        auditoria: {
          ...m.auditoria,
          modificadoPor: user.id,
          modificadoEn: ahora,
          ...(nuevoEstado === 'completado' ? {
            completadoPor: user.id,
            completadoEn: ahora,
          } : {}),
        },
      };
    }));

    return { exito: true };
  }, [user]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: MantenimientosStoreContext = {
    mantenimientos,
    loading,
    obtenerMantenimientoPorNumero,
    obtenerMantenimientosPorEquipo,
    crearMantenimiento,
    actualizarEstadoMantenimiento,
    cargarMantenimientosIniciales,
  };

  return <MantenimientosContext.Provider value={value}>{children}</MantenimientosContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMantenimientosStore() {
  const context = useContext(MantenimientosContext);
  if (!context) {
    throw new Error('useMantenimientosStore debe usarse dentro de MantenimientosStoreProvider');
  }
  return context;
}
