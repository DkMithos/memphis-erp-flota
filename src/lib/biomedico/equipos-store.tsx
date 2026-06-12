/**
 * STORE DE EQUIPOS BIOMÉDICOS
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { dbEquiposBiomedicos } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { EquipoBiomedico as EquipoDBRow } from '../supabase/types';
import {
  generarCodigoEquipo,
  extraerNumeroSecuencial,
  DEBUG_BIOMEDICO,
  type EstadoEquipoBiomedico,
  type CategoriaEquipoBiomedico,
  type RiesgoBiomedico,
} from './equipos-config';
import { validateTransition, EQUIPO_BIO_TRANSITIONS } from '../shared/state-machine';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface EquipoBiomedico {
  // Identificación — id = codigo legible (EB-YYYY-NNN), _dbId = UUID interno
  id: string;
  _dbId: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;

  // Clasificación
  categoria: CategoriaEquipoBiomedico;
  riesgo: RiesgoBiomedico;
  estado: EstadoEquipoBiomedico;

  // Ubicación — jerarquía FK + campo libre legacy
  clienteId: string | null;
  sedeId: string | null;
  areaId: string | null;
  ubicacion: {
    area: string;
    subarea: string;
    responsable: string;
  };

  // Especificaciones técnicas (almacenadas como string serializado — no en DB todavía)
  especificaciones: {
    voltaje?: string;
    potencia?: string;
    frecuencia?: string;
    dimensiones?: string;
    peso?: string;
  };

  // Fechas importantes
  fechaAdquisicion: string;
  fechaInstalacion: string;
  fechaUltimoMantenimiento: string | null;
  fechaProximoMantenimiento: string;
  fechaUltimaCalibracion: string | null;
  fechaProximaCalibracion: string | null;

  // Garantía (mapeada desde campos planos de DB)
  garantia: {
    proveedor: string;
    fechaInicio: string;
    fechaVencimiento: string;
    vigente: boolean;
  };

  // Costos
  costos: {
    adquisicion: number;
    mantenimientoPreventivoAnual: number;
    mantenimientoCorrectivo: number;
    calibracion: number;
  };

  // Auditoría
  auditoria: {
    creadoPor: string | null;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
  };

  observaciones: string | null;

  // Proyecto asociado
  proyectoId: string | null;

  // QR público
  publicToken: string | null;
  publicViewEnabled: boolean;
}

export interface NuevoEquipoBiomedicoInput {
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;
  categoria: CategoriaEquipoBiomedico;
  riesgo: RiesgoBiomedico;
  // Jerarquía FK (preferida)
  clienteId?: string | null;
  sedeId?: string | null;
  areaId?: string | null;
  // Campo libre legacy (fallback si no hay jerarquía)
  ubicacion: {
    area: string;
    subarea: string;
    responsable: string;
  };
  especificaciones?: {
    voltaje?: string;
    potencia?: string;
    frecuencia?: string;
    dimensiones?: string;
    peso?: string;
  };
  fechaAdquisicion: string;
  fechaInstalacion: string;
  garantia: {
    proveedor: string;
    fechaInicio: string;
    fechaVencimiento: string;
  };
  costos: {
    adquisicion: number;
    mantenimientoPreventivoAnual: number;
  };
  observaciones?: string;
}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface EquiposStoreContext {
  equipos: EquipoBiomedico[];
  loading: boolean;
  obtenerEquipoPorCodigo: (codigo: string) => EquipoBiomedico | undefined;
  obtenerEquipoPorId: (id: string) => EquipoBiomedico | undefined;
  obtenerEquiposPorCategoria: (categoria: CategoriaEquipoBiomedico) => EquipoBiomedico[];
  obtenerEquiposPorEstado: (estado: EstadoEquipoBiomedico) => EquipoBiomedico[];
  crearEquipo: (input: NuevoEquipoBiomedicoInput) => Promise<EquipoBiomedico>;
  actualizarEquipo: (codigo: string, input: Partial<NuevoEquipoBiomedicoInput>) => Promise<CrudResult>;
  actualizarEstadoEquipo: (codigo: string, nuevoEstado: EstadoEquipoBiomedico) => Promise<CrudResult>;
  togglePublicView: (codigo: string) => Promise<CrudResult>;
  cargarEquiposIniciales: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const EquiposContext = createContext<EquiposStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: EquipoDBRow): EquipoBiomedico {
  // La DB tiene campos planos; reconstruimos los objetos anidados del frontend.
  // Los campos de ubicación se mapean desde: ubicacion (área), servicio_clinico (subárea/responsable).
  // Para compatibilidad, parse de un string JSON serializado si está disponible en el futuro,
  // o usamos los campos disponibles con defaults sensatos.
  const ubicacionStr = row.ubicacion ?? '';
  // Intentar parsear como JSON por si se almacenó serializado
  let area = ubicacionStr;
  let subarea = row.servicio_clinico ?? '';
  let responsable = '';
  try {
    const parsed = JSON.parse(ubicacionStr);
    if (parsed && typeof parsed === 'object') {
      area = parsed.area ?? ubicacionStr;
      subarea = parsed.subarea ?? subarea;
      responsable = parsed.responsable ?? '';
    }
  } catch {
    // No es JSON — campo plano, usar como area
  }

  const garantiaVence = row.garantia_vence ?? null;
  const hoy = new Date();
  const garantiaVigente = garantiaVence ? hoy < new Date(garantiaVence) : false;

  return {
    id: row.codigo,
    _dbId: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    marca: row.marca,
    modelo: row.modelo,
    serie: row.serie ?? '',
    categoria: row.categoria as CategoriaEquipoBiomedico,
    riesgo: row.riesgo as RiesgoBiomedico,
    estado: row.estado as EstadoEquipoBiomedico,
    clienteId: row.cliente_id ?? null,
    sedeId: row.sede_id ?? null,
    areaId: row.area_id ?? null,
    ubicacion: { area, subarea, responsable },
    especificaciones: row.especificaciones ?? {},
    fechaAdquisicion: row.fecha_adquisicion ?? '',
    fechaInstalacion: row.fecha_instalacion ?? row.fecha_adquisicion ?? '',
    fechaUltimoMantenimiento: row.ultimo_mantenimiento ?? null,
    fechaProximoMantenimiento: row.proximo_mantenimiento ?? '',
    fechaUltimaCalibracion: null,
    fechaProximaCalibracion: null,
    garantia: {
      proveedor: row.garantia_proveedor ?? '',
      fechaInicio: row.garantia_fecha_inicio ?? '',
      fechaVencimiento: garantiaVence ?? '',
      vigente: garantiaVigente,
    },
    costos: {
      adquisicion: row.costo_adquisicion ?? 0,
      mantenimientoPreventivoAnual: 0,
      mantenimientoCorrectivo: 0,
      calibracion: 0,
    },
    auditoria: {
      creadoPor: row.creado_por,
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
    },
    observaciones: row.observaciones ?? null,
    proyectoId: row.proyecto_id ?? null,
    publicToken: row.public_token ?? null,
    publicViewEnabled: row.public_view_enabled ?? true,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function EquiposStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [equipos, setEquipos] = useState<EquipoBiomedico[]>([]);
  const equiposRef = useRef(equipos);
  useEffect(() => { equiposRef.current = equipos; }, [equipos]);
  const [loading, setLoading] = useState(true);

  // Carga inicial desde Supabase
  const fetchEquipos = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await dbEquiposBiomedicos.list();

    if (error) {
      console.error('[EQUIPOS_BIO] Error al cargar:', error.message);
    } else if (data) {
      const mapped = (data as EquipoDBRow[]).map(mapFromDB);
      setEquipos(mapped);
      if (DEBUG_BIOMEDICO) {
        console.log('[EQUIPOS_BIO] Cargados desde Supabase:', mapped.length);
      }
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchEquipos();
  }, [fetchEquipos]);

  // cargarEquiposIniciales: legacy shim, triggers re-fetch
  const cargarEquiposIniciales = useCallback(() => {
    fetchEquipos();
  }, [fetchEquipos]);

  // ============================================================================
  // QUERIES (síncronas — operan sobre estado local ya cargado)
  // ============================================================================

  const obtenerEquipoPorCodigo = useCallback((codigo: string) => {
    return equipos.find(eq => eq.codigo === codigo);
  }, [equipos]);

  const obtenerEquipoPorId = useCallback((id: string) => {
    return equipos.find(eq => eq.id === id);
  }, [equipos]);

  const obtenerEquiposPorCategoria = useCallback((categoria: CategoriaEquipoBiomedico) => {
    return equipos.filter(eq => eq.categoria === categoria);
  }, [equipos]);

  const obtenerEquiposPorEstado = useCallback((estado: EstadoEquipoBiomedico) => {
    return equipos.filter(eq => eq.estado === estado);
  }, [equipos]);

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearEquipo = useCallback(async (input: NuevoEquipoBiomedicoInput): Promise<EquipoBiomedico> => {
    if (!tenantId || !user) {
      throw new Error('Sin sesión activa');
    }

    // Determinar siguiente número secuencial
    const numeros = equipos
      .map(eq => extraerNumeroSecuencial(eq.codigo))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const nuevoCodigo = generarCodigoEquipo(ultimoNumero);

    // Calcular frecuencia MP por defecto (180 días)
    const frecuenciaMP = 180;

    // Calcular proximo mantenimiento
    const fechaProxMant = new Date(input.fechaInstalacion);
    fechaProxMant.setDate(fechaProxMant.getDate() + frecuenciaMP);

    // Serializar ubicación como JSON para almacenar en campo `ubicacion` (texto)
    const ubicacionJson = JSON.stringify({
      area: input.ubicacion.area,
      subarea: input.ubicacion.subarea,
      responsable: input.ubicacion.responsable,
    });

    const { data: inserted, error } = await dbEquiposBiomedicos.create({
      tenant_id: tenantId,
      codigo: nuevoCodigo,
      nombre: input.nombre,
      marca: input.marca,
      modelo: input.modelo,
      serie: input.serie,
      anio_fabricacion: null,
      categoria: input.categoria,
      riesgo: input.riesgo,
      estado: 'operativo' as EstadoEquipoBiomedico,
      ubicacion: ubicacionJson,
      servicio_clinico: input.ubicacion.subarea,
      cliente_id: input.clienteId ?? null,
      sede_id: input.sedeId ?? null,
      area_id: input.areaId ?? null,
      fecha_adquisicion: input.fechaAdquisicion,
      fecha_instalacion: input.fechaInstalacion,
      especificaciones: input.especificaciones ?? null,
      garantia_proveedor: input.garantia.proveedor || null,
      garantia_fecha_inicio: input.garantia.fechaInicio || null,
      observaciones: input.observaciones?.trim() ?? null,
      proveedor_id: null,
      costo_adquisicion: input.costos.adquisicion,
      garantia_vence: input.garantia.fechaVencimiento || null,
      frecuencia_mp_dias: frecuenciaMP,
      ultimo_mantenimiento: null,
      proximo_mantenimiento: fechaProxMant.toISOString().split('T')[0],
      motivo_baja: null,
      dado_de_baja_por: null,
      dado_de_baja_en: null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });

    if (error) {
      console.error('[EQUIPOS_BIO] Error al crear:', error.message);
      throw new Error(error.message);
    }

    const nuevo = mapFromDB(inserted as EquipoDBRow);
    // Override with full frontend data that wasn't stored in flat DB columns
    const nuevoConDatos: EquipoBiomedico = {
      ...nuevo,
      ubicacion: input.ubicacion,
      especificaciones: input.especificaciones || {},
      fechaInstalacion: input.fechaInstalacion,
      garantia: {
        proveedor: input.garantia.proveedor,
        fechaInicio: input.garantia.fechaInicio,
        fechaVencimiento: input.garantia.fechaVencimiento,
        vigente: nuevo.garantia.vigente,
      },
      costos: {
        adquisicion: input.costos.adquisicion,
        mantenimientoPreventivoAnual: input.costos.mantenimientoPreventivoAnual,
        mantenimientoCorrectivo: 0,
        calibracion: 0,
      },
      observaciones: input.observaciones ?? null,
    };

    setEquipos(prev => [nuevoConDatos, ...prev]);

    if (DEBUG_BIOMEDICO) {
      console.log('[EQUIPO_BIO_CREATED]', { codigo: nuevoConDatos.codigo, nombre: nuevoConDatos.nombre });
    }

    return nuevoConDatos;
  }, [equipos, tenantId, user]);

  const actualizarEquipo = useCallback(async (
    codigo: string,
    input: Partial<NuevoEquipoBiomedicoInput>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const dbId = equiposRef.current.find(e => e.codigo === codigo)?._dbId;
    if (!dbId) return { exito: false, errores: ['Equipo no encontrado'] };

    const ahora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (input.nombre !== undefined) updatePayload.nombre = input.nombre;
    if (input.marca !== undefined) updatePayload.marca = input.marca;
    if (input.modelo !== undefined) updatePayload.modelo = input.modelo;
    if (input.serie !== undefined) updatePayload.serie = input.serie;
    if (input.categoria !== undefined) updatePayload.categoria = input.categoria;
    if (input.riesgo !== undefined) updatePayload.riesgo = input.riesgo;
    if (input.ubicacion !== undefined) {
      updatePayload.ubicacion = JSON.stringify(input.ubicacion);
      updatePayload.servicio_clinico = input.ubicacion.subarea;
    }
    if (input.clienteId !== undefined) updatePayload.cliente_id = input.clienteId;
    if (input.sedeId !== undefined) updatePayload.sede_id = input.sedeId;
    if (input.areaId !== undefined) updatePayload.area_id = input.areaId;
    if (input.fechaAdquisicion !== undefined) updatePayload.fecha_adquisicion = input.fechaAdquisicion;
    if (input.fechaInstalacion !== undefined) updatePayload.fecha_instalacion = input.fechaInstalacion;
    if (input.especificaciones !== undefined) updatePayload.especificaciones = input.especificaciones;
    if (input.garantia?.fechaVencimiento !== undefined) {
      updatePayload.garantia_vence = input.garantia.fechaVencimiento;
    }
    if (input.garantia?.proveedor !== undefined) updatePayload.garantia_proveedor = input.garantia.proveedor;
    if (input.garantia?.fechaInicio !== undefined) updatePayload.garantia_fecha_inicio = input.garantia.fechaInicio;
    if (input.observaciones !== undefined) updatePayload.observaciones = input.observaciones?.trim() ?? null;
    if (input.costos?.adquisicion !== undefined) {
      updatePayload.costo_adquisicion = input.costos.adquisicion;
    }

    const { error } = await dbEquiposBiomedicos.update(dbId, updatePayload);

    if (error) {
      console.error('[EQUIPOS_BIO] Error al actualizar:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setEquipos(prev => prev.map(eq => {
      if (eq.codigo !== codigo) return eq;
      return {
        ...eq,
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.marca !== undefined && { marca: input.marca }),
        ...(input.modelo !== undefined && { modelo: input.modelo }),
        ...(input.serie !== undefined && { serie: input.serie }),
        ...(input.categoria !== undefined && { categoria: input.categoria }),
        ...(input.riesgo !== undefined && { riesgo: input.riesgo }),
        ...(input.ubicacion !== undefined && { ubicacion: input.ubicacion }),
        ...(input.clienteId !== undefined && { clienteId: input.clienteId }),
        ...(input.sedeId !== undefined && { sedeId: input.sedeId }),
        ...(input.areaId !== undefined && { areaId: input.areaId }),
        ...(input.especificaciones !== undefined && { especificaciones: input.especificaciones }),
        ...(input.garantia !== undefined && {
          garantia: {
            ...eq.garantia,
            proveedor: input.garantia.proveedor ?? eq.garantia.proveedor,
            fechaInicio: input.garantia.fechaInicio ?? eq.garantia.fechaInicio,
            fechaVencimiento: input.garantia.fechaVencimiento ?? eq.garantia.fechaVencimiento,
            vigente: input.garantia.fechaVencimiento
              ? new Date() < new Date(input.garantia.fechaVencimiento)
              : eq.garantia.vigente,
          },
        }),
        ...(input.costos !== undefined && {
          costos: {
            ...eq.costos,
            adquisicion: input.costos.adquisicion ?? eq.costos.adquisicion,
            mantenimientoPreventivoAnual: input.costos.mantenimientoPreventivoAnual ?? eq.costos.mantenimientoPreventivoAnual,
          },
        }),
        ...(input.observaciones !== undefined && { observaciones: input.observaciones ?? null }),
        auditoria: {
          ...eq.auditoria,
          modificadoPor: user.id,
          modificadoEn: ahora,
        },
      };
    }));

    if (DEBUG_BIOMEDICO) {
      console.log('[EQUIPO_BIO_UPDATED]', { codigo, cambios: Object.keys(input) });
    }

    return { exito: true };
  }, [user]);

  const actualizarEstadoEquipo = useCallback(async (
    codigo: string,
    nuevoEstado: EstadoEquipoBiomedico
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const equipoActual = equiposRef.current.find(e => e.codigo === codigo);
    const dbId = equipoActual?._dbId;
    const estadoActual = equipoActual?.estado;
    if (!dbId) return { exito: false, errores: ['Equipo no encontrado'] };

    // Validar transición de estado
    const check = validateTransition(estadoActual!, nuevoEstado, EQUIPO_BIO_TRANSITIONS, 'Equipo Biomédico');
    if (!check.valid) return { exito: false, errores: [check.error] };

    const ahora = new Date().toISOString();
    const { error } = await dbEquiposBiomedicos.update(dbId, {
      estado: nuevoEstado,
      modificado_por: user.id,
      modificado_en: ahora,
    });

    if (error) {
      console.error('[EQUIPOS_BIO] Error al actualizar estado:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setEquipos(prev => prev.map(eq =>
      eq.codigo === codigo
        ? {
            ...eq,
            estado: nuevoEstado,
            auditoria: { ...eq.auditoria, modificadoPor: user.id, modificadoEn: ahora },
          }
        : eq
    ));

    return { exito: true };
  }, [user]);

  const togglePublicView = useCallback(async (codigo: string): Promise<CrudResult> => {
    const equipo = equipos.find(e => e.codigo === codigo);
    if (!equipo) return { exito: false, errores: ['Equipo no encontrado'] };

    const nuevoValor = !equipo.publicViewEnabled;
    const { error } = await dbEquiposBiomedicos.update(equipo._dbId, {
      public_view_enabled: nuevoValor,
    });

    if (error) {
      console.error('[EQUIPOS_BIO] Error al cambiar vista pública:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setEquipos(prev => prev.map(eq =>
      eq.codigo === codigo ? { ...eq, publicViewEnabled: nuevoValor } : eq
    ));

    return { exito: true };
  }, [equipos]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: EquiposStoreContext = {
    equipos,
    loading,
    obtenerEquipoPorCodigo,
    obtenerEquipoPorId,
    obtenerEquiposPorCategoria,
    obtenerEquiposPorEstado,
    crearEquipo,
    actualizarEquipo,
    actualizarEstadoEquipo,
    togglePublicView,
    cargarEquiposIniciales,
  };

  return <EquiposContext.Provider value={value}>{children}</EquiposContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useEquiposStore() {
  const context = useContext(EquiposContext);
  if (!context) {
    throw new Error('useEquiposStore debe usarse dentro de EquiposStoreProvider');
  }
  return context;
}
