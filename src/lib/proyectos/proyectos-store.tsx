/**
 * STORE PROYECTOS — Conectado a Supabase
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbProyectos, dbFasesProyecto, dbTareasProyecto, dbMiembrosProyecto } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import { logAudit } from '../shared/audit';
import { validateTransition, PROYECTO_TRANSITIONS } from '../shared/state-machine';
import type { ProyectoDB, FaseProyectoDB, TareaProyectoDB, MiembroProyectoDB } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Fase {
  _dbId: string;
  proyectoDbId: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  estado: FaseProyectoDB['estado'];
  fechaInicio?: string;
  fechaFin?: string;
  porcentajeAvance: number;
}

export interface Tarea {
  _dbId: string;
  proyectoDbId: string;
  faseDbId?: string;
  titulo: string;
  descripcion?: string;
  estado: TareaProyectoDB['estado'];
  prioridad: TareaProyectoDB['prioridad'];
  asignadoA?: string;
  fechaInicio?: string;
  fechaVencimiento?: string;
  fechaCompletada?: string;
  estimacionHoras?: number;
  horasReales?: number;
  orden: number;
}

export interface MiembroProyecto {
  _dbId: string;
  proyectoDbId: string;
  userId?: string;
  nombre: string;
  rol: string;
  horasAsignadas?: number;
}

export interface Proyecto {
  _dbId: string;
  id: string;              // PRY-YYYY-NNN
  nombre: string;
  descripcion?: string;
  tipo: ProyectoDB['tipo'];
  estado: ProyectoDB['estado'];
  prioridad: ProyectoDB['prioridad'];
  fechaInicio?: string;
  fechaFinEstimada?: string;
  fechaFinReal?: string;
  presupuesto?: number;
  costoReal?: number;
  moneda: string;
  gerenteProyecto?: string;
  porcentajeAvance: number;
  creadoEn: string;
  fases: Fase[];
  tareas: Tarea[];
  miembros: MiembroProyecto[];
  // computed
  tareasTotal: number;
  tareasCompletadas: number;
  diasRestantes?: number;
  estaRetrasado: boolean;
}

// ============================================================================
// MAPPERS DB → FRONTEND
// ============================================================================

function mapFase(row: FaseProyectoDB): Fase {
  return {
    _dbId: row.id,
    proyectoDbId: row.proyecto_id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    orden: row.orden,
    estado: row.estado,
    fechaInicio: row.fecha_inicio ?? undefined,
    fechaFin: row.fecha_fin ?? undefined,
    porcentajeAvance: row.porcentaje_avance,
  };
}

function mapTarea(row: TareaProyectoDB): Tarea {
  return {
    _dbId: row.id,
    proyectoDbId: row.proyecto_id,
    faseDbId: row.fase_id ?? undefined,
    titulo: row.titulo,
    descripcion: row.descripcion ?? undefined,
    estado: row.estado,
    prioridad: row.prioridad,
    asignadoA: row.asignado_a ?? undefined,
    fechaInicio: row.fecha_inicio ?? undefined,
    fechaVencimiento: row.fecha_vencimiento ?? undefined,
    fechaCompletada: row.fecha_completada ?? undefined,
    estimacionHoras: row.estimacion_horas ?? undefined,
    horasReales: row.horas_reales ?? undefined,
    orden: row.orden,
  };
}

function mapMiembro(row: MiembroProyectoDB): MiembroProyecto {
  return {
    _dbId: row.id,
    proyectoDbId: row.proyecto_id,
    userId: row.user_id ?? undefined,
    nombre: row.nombre,
    rol: row.rol,
    horasAsignadas: row.horas_asignadas ?? undefined,
  };
}

function mapProyecto(row: ProyectoDB): Proyecto {
  const fases = (row.fases ?? []).map(mapFase).sort((a, b) => a.orden - b.orden);
  const tareas = (row.tareas ?? []).map(mapTarea);
  const miembros = (row.miembros ?? []).map(mapMiembro);
  const tareasTotal = tareas.length;
  const tareasCompletadas = tareas.filter(t => t.estado === 'completada').length;

  let diasRestantes: number | undefined;
  let estaRetrasado = false;
  if (row.fecha_fin_estimada) {
    const hoy = new Date();
    const fin = new Date(row.fecha_fin_estimada);
    const diff = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    diasRestantes = diff;
    estaRetrasado = diff < 0 && row.estado !== 'completado' && row.estado !== 'cancelado';
  }

  return {
    _dbId: row.id,
    id: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    tipo: row.tipo,
    estado: row.estado,
    prioridad: row.prioridad,
    fechaInicio: row.fecha_inicio ?? undefined,
    fechaFinEstimada: row.fecha_fin_estimada ?? undefined,
    fechaFinReal: row.fecha_fin_real ?? undefined,
    presupuesto: row.presupuesto ?? undefined,
    costoReal: row.costo_real ?? undefined,
    moneda: row.moneda,
    gerenteProyecto: row.gerente_proyecto ?? undefined,
    porcentajeAvance: row.porcentaje_avance,
    creadoEn: row.creado_en,
    fases,
    tareas,
    miembros,
    tareasTotal,
    tareasCompletadas,
    diasRestantes,
    estaRetrasado,
  };
}

// ============================================================================
// CONTEXT
// ============================================================================

interface ProyectosContextValue {
  proyectos: Proyecto[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  crearProyecto: (data: Omit<ProyectoDB, 'id' | 'creado_en' | 'fases' | 'tareas' | 'miembros'>) => Promise<Proyecto>;
  actualizarProyecto: (dbId: string, data: Partial<Omit<ProyectoDB, 'fases' | 'tareas' | 'miembros'>>) => Promise<void>;
  actualizarEstado: (dbId: string, estado: ProyectoDB['estado']) => Promise<void>;
  crearFase: (data: Omit<FaseProyectoDB, 'id'>) => Promise<Fase>;
  actualizarFase: (dbId: string, data: Partial<FaseProyectoDB>) => Promise<void>;
  eliminarFase: (dbId: string) => Promise<void>;
  crearTarea: (data: Omit<TareaProyectoDB, 'id' | 'creado_en'>) => Promise<Tarea>;
  actualizarTarea: (dbId: string, data: Partial<TareaProyectoDB>) => Promise<void>;
  cambiarEstadoTarea: (dbId: string, estado: TareaProyectoDB['estado']) => Promise<void>;
  eliminarTarea: (dbId: string) => Promise<void>;
  crearMiembro: (data: Omit<MiembroProyectoDB, 'id'>) => Promise<MiembroProyecto>;
  eliminarMiembro: (dbId: string) => Promise<void>;
}

const ProyectosContext = createContext<ProyectosContextValue | null>(null);

export function ProyectosProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await dbProyectos.list(tenantId);
      if (err) throw err;
      const mapped = (data ?? []).map((row) =>
        mapProyecto({ ...row, fases: row.fases ?? [], tareas: row.tareas ?? [], miembros: row.miembros ?? [] })
      );
      setProyectos(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando proyectos');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) refresh();
  }, [tenantId, refresh]);

  const crearProyecto = useCallback(async (data: Omit<ProyectoDB, 'id' | 'creado_en' | 'fases' | 'tareas' | 'miembros'>): Promise<Proyecto> => {
    const { data: row, error: err } = await dbProyectos.insert(data);
    if (err || !row) throw err ?? new Error('Error creando proyecto');
    const nuevo = mapProyecto({ ...row, fases: [], tareas: [], miembros: [] });
    setProyectos(prev => [nuevo, ...prev]);
    logAudit({ tenantId: data.tenant_id, usuarioEmail: user?.email ?? null, accion: 'crear', entidadTipo: 'proyecto', entidadId: nuevo._dbId, entidadLabel: nuevo.nombre });
    return nuevo;
  }, [user]);

  const actualizarProyecto = useCallback(async (dbId: string, data: Partial<Omit<ProyectoDB, 'fases' | 'tareas' | 'miembros'>>) => {
    const { data: row, error: err } = await dbProyectos.update(dbId, data);
    if (err || !row) throw err ?? new Error('Error actualizando proyecto');
    setProyectos(prev => prev.map(p => {
      if (p._dbId !== dbId) return p;
      // Preserve existing fases/tareas/miembros — only project-level fields changed
      const base = mapProyecto({ ...row, fases: [], tareas: [], miembros: [] });
      return { ...base, fases: p.fases, tareas: p.tareas, miembros: p.miembros,
        tareasTotal: p.tareasTotal, tareasCompletadas: p.tareasCompletadas };
    }));
  }, []);

  const actualizarEstado = useCallback(async (dbId: string, estado: ProyectoDB['estado']) => {
    // Validar transición de estado
    const proyActual = proyectos.find(p => p._dbId === dbId);
    if (proyActual) {
      const check = validateTransition(proyActual.estado, estado, PROYECTO_TRANSITIONS, `Proyecto`);
      if (!check.valid) {
        console.warn('[PROYECTOS]', check.error);
        return;
      }
    }
    await actualizarProyecto(dbId, { estado });
  }, [actualizarProyecto, proyectos]);

  const crearFase = useCallback(async (data: Omit<FaseProyectoDB, 'id'>): Promise<Fase> => {
    const { data: row, error: err } = await dbFasesProyecto.insert(data);
    if (err || !row) throw err ?? new Error('Error creando fase');
    const nueva = mapFase(row);
    setProyectos(prev => prev.map(p => {
      if (p._dbId !== data.proyecto_id) return p;
      return { ...p, fases: [...p.fases, nueva].sort((a, b) => a.orden - b.orden) };
    }));
    return nueva;
  }, []);

  const actualizarFase = useCallback(async (dbId: string, data: Partial<FaseProyectoDB>) => {
    const { data: row, error: err } = await dbFasesProyecto.update(dbId, data);
    if (err || !row) throw err ?? new Error('Error actualizando fase');
    const actualizada = mapFase(row);
    setProyectos(prev => prev.map(p => {
      const idx = p.fases.findIndex(f => f._dbId === dbId);
      if (idx === -1) return p;
      const fases = [...p.fases];
      fases[idx] = actualizada;
      return { ...p, fases: fases.sort((a, b) => a.orden - b.orden) };
    }));
  }, []);

  const eliminarFase = useCallback(async (dbId: string) => {
    // Verificar que no hay tareas vinculadas a esta fase
    const tareasVinculadas = proyectos.flatMap(p => p.tareas).filter(t => t.faseDbId === dbId);
    if (tareasVinculadas.length > 0) {
      throw new Error(`No se puede eliminar la fase: tiene ${tareasVinculadas.length} tarea(s) vinculada(s). Mueva o elimine las tareas primero.`);
    }
    const { error: err } = await dbFasesProyecto.delete(dbId);
    if (err) throw err;
    setProyectos(prev => prev.map(p => ({
      ...p,
      fases: p.fases.filter(f => f._dbId !== dbId),
    })));
  }, [proyectos]);

  const crearTarea = useCallback(async (data: Omit<TareaProyectoDB, 'id' | 'creado_en'>): Promise<Tarea> => {
    const { data: row, error: err } = await dbTareasProyecto.insert(data);
    if (err || !row) throw err ?? new Error('Error creando tarea');
    const nueva = mapTarea(row);
    setProyectos(prev => prev.map(p => {
      if (p._dbId !== data.proyecto_id) return p;
      const tareasCompletadas = [...p.tareas, nueva].filter(t => t.estado === 'completada').length;
      return {
        ...p,
        tareas: [...p.tareas, nueva],
        tareasTotal: p.tareasTotal + 1,
        tareasCompletadas,
      };
    }));
    logAudit({ tenantId: data.tenant_id, usuarioEmail: user?.email ?? null, accion: 'crear', entidadTipo: 'tarea', entidadId: nueva._dbId, entidadLabel: nueva.titulo });
    return nueva;
  }, [user]);

  const actualizarTarea = useCallback(async (dbId: string, data: Partial<TareaProyectoDB>) => {
    const { data: row, error: err } = await dbTareasProyecto.update(dbId, data);
    if (err || !row) throw err ?? new Error('Error actualizando tarea');
    const actualizada = mapTarea(row);
    setProyectos(prev => prev.map(p => {
      const idx = p.tareas.findIndex(t => t._dbId === dbId);
      if (idx === -1) return p;
      const tareas = [...p.tareas];
      tareas[idx] = actualizada;
      const tareasCompletadas = tareas.filter(t => t.estado === 'completada').length;
      return { ...p, tareas, tareasCompletadas };
    }));
  }, []);

  const cambiarEstadoTarea = useCallback(async (dbId: string, estado: TareaProyectoDB['estado']) => {
    const fechaCompletada = estado === 'completada' ? new Date().toISOString().split('T')[0] : null;
    await actualizarTarea(dbId, { estado, fecha_completada: fechaCompletada });
  }, [actualizarTarea]);

  const eliminarTarea = useCallback(async (dbId: string) => {
    const { error: err } = await dbTareasProyecto.delete(dbId);
    if (err) throw err;
    setProyectos(prev => prev.map(p => {
      const tareas = p.tareas.filter(t => t._dbId !== dbId);
      return {
        ...p,
        tareas,
        tareasTotal: tareas.length,
        tareasCompletadas: tareas.filter(t => t.estado === 'completada').length,
      };
    }));
  }, []);

  const crearMiembro = useCallback(async (data: Omit<MiembroProyectoDB, 'id'>): Promise<MiembroProyecto> => {
    const { data: row, error: err } = await dbMiembrosProyecto.insert(data);
    if (err || !row) throw err ?? new Error('Error agregando miembro');
    const nuevo = mapMiembro(row);
    setProyectos(prev => prev.map(p => {
      if (p._dbId !== data.proyecto_id) return p;
      return { ...p, miembros: [...p.miembros, nuevo] };
    }));
    return nuevo;
  }, []);

  const eliminarMiembro = useCallback(async (dbId: string) => {
    const { error: err } = await dbMiembrosProyecto.delete(dbId);
    if (err) throw err;
    setProyectos(prev => prev.map(p => ({
      ...p,
      miembros: p.miembros.filter(m => m._dbId !== dbId),
    })));
  }, []);

  const value: ProyectosContextValue = {
    proyectos,
    loading,
    error,
    refresh,
    crearProyecto,
    actualizarProyecto,
    actualizarEstado,
    crearFase,
    actualizarFase,
    eliminarFase,
    crearTarea,
    actualizarTarea,
    cambiarEstadoTarea,
    eliminarTarea,
    crearMiembro,
    eliminarMiembro,
  };

  return (
    <ProyectosContext.Provider value={value}>
      {children}
    </ProyectosContext.Provider>
  );
}

export function useProyectos() {
  const ctx = useContext(ProyectosContext);
  if (!ctx) throw new Error('useProyectos must be used within ProyectosProvider');
  return ctx;
}
