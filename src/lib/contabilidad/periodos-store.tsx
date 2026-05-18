/**
 * Memphis ERP — Periodos Contables Store
 * Gestión de períodos fiscales: apertura, cierre, ajuste.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { nombrePeriodo } from './fiscal-peru';

export type EstadoPeriodo = 'abierto' | 'cerrado' | 'ajuste';

export interface PeriodoContable {
  id: string;
  tenantId: string;
  anio: number;
  mes: number;
  nombre: string;        // "Enero 2026"
  estado: EstadoPeriodo;
  fechaCierre: string | null;
  cerradoPor: string | null;
  creadoEn: string;
}

export interface NuevoPeriodoInput {
  anio: number;
  mes: number;
}

export interface CrudResult { ok: boolean; error?: string; }

interface PeriodosContextValue {
  periodos: PeriodoContable[];
  loading: boolean;
  error: string | null;
  periodoActual: PeriodoContable | null;   // período abierto más reciente
  crearPeriodo: (input: NuevoPeriodoInput) => Promise<PeriodoContable>;
  cerrarPeriodo: (id: string) => Promise<CrudResult>;
  reabrirPeriodo: (id: string) => Promise<CrudResult>;
  obtenerPorId: (id: string) => PeriodoContable | undefined;
  recargar: () => void;
}

const PeriodosCtx = createContext<PeriodosContextValue | null>(null);

export function usePeriodosStore(): PeriodosContextValue {
  const ctx = useContext(PeriodosCtx);
  if (!ctx) throw new Error('usePeriodosStore fuera de PeriodosProvider');
  return ctx;
}

function mapFromDB(row: any): PeriodoContable {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    anio: row.anio,
    mes: row.mes,
    nombre: row.nombre,
    estado: row.estado as EstadoPeriodo,
    fechaCierre: row.fecha_cierre ?? null,
    cerradoPor: row.cerrado_por ?? null,
    creadoEn: row.creado_en,
  };
}

export function PeriodosProvider({ children }: { children: ReactNode }) {
  const { user, tenantId } = useAuth();
  const [periodos, setPeriodos] = useState<PeriodoContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('periodos_contables')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('anio', { ascending: false })
        .order('mes', { ascending: false });
      if (err) throw err;
      setPeriodos((data ?? []).map(mapFromDB));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar períodos');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { cargar(); }, [cargar]);

  const periodoActual = periodos.find(p => p.estado === 'abierto') ?? null;

  const crearPeriodo = useCallback(async (input: NuevoPeriodoInput): Promise<PeriodoContable> => {
    if (!tenantId) throw new Error('Sin sesión');
    const nombre = nombrePeriodo(input.anio, input.mes);
    const { data, error: err } = await supabase
      .from('periodos_contables')
      .insert({ tenant_id: tenantId, anio: input.anio, mes: input.mes, nombre, estado: 'abierto' })
      .select().single();
    if (err) throw new Error(err.message);
    const nuevo = mapFromDB(data);
    setPeriodos(prev => [nuevo, ...prev]);
    return nuevo;
  }, [tenantId]);

  const cerrarPeriodo = useCallback(async (id: string): Promise<CrudResult> => {
    const { error: err } = await supabase
      .from('periodos_contables')
      .update({ estado: 'cerrado', fecha_cierre: new Date().toISOString(), cerrado_por: user?.id })
      .eq('id', id);
    if (err) return { ok: false, error: err.message };
    setPeriodos(prev => prev.map(p => p.id === id
      ? { ...p, estado: 'cerrado' as EstadoPeriodo, fechaCierre: new Date().toISOString() } : p));
    return { ok: true };
  }, [user]);

  const reabrirPeriodo = useCallback(async (id: string): Promise<CrudResult> => {
    const { error: err } = await supabase
      .from('periodos_contables')
      .update({ estado: 'abierto', fecha_cierre: null, cerrado_por: null })
      .eq('id', id);
    if (err) return { ok: false, error: err.message };
    setPeriodos(prev => prev.map(p => p.id === id
      ? { ...p, estado: 'abierto' as EstadoPeriodo, fechaCierre: null } : p));
    return { ok: true };
  }, []);

  const obtenerPorId = useCallback((id: string) => periodos.find(p => p.id === id), [periodos]);

  return (
    <PeriodosCtx.Provider value={{ periodos, loading, error, periodoActual, crearPeriodo, cerrarPeriodo, reabrirPeriodo, obtenerPorId, recargar: cargar }}>
      {children}
    </PeriodosCtx.Provider>
  );
}
