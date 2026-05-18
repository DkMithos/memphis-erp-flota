/**
 * STORE DE EVALUACIONES DE PROVEEDORES
 * Conectado a Supabase — tabla evaluaciones_proveedores
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { dbEvaluaciones } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { EvaluacionProveedor } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Evaluacion {
  _dbId: string;
  id: string;              // EVA-YYYY-NNN
  proveedorId: string;     // display code PROV-NNNN
  proveedorNombre: string;
  proveedorDbId: string;   // UUID FK
  periodo: string;
  tipo: 'mensual' | 'trimestral' | 'anual' | 'puntual';
  estado: 'borrador' | 'en_revision' | 'aprobada' | 'rechazada';
  calidad?: number;
  entrega?: number;
  precio?: number;
  servicio?: number;
  documentacion?: number;
  puntajeTotal?: number;
  resultado?: 'excelente' | 'bueno' | 'regular' | 'deficiente';
  evaluador?: string;
  comentarios?: string;
  accionesMejora?: string;
  creadoPor?: string;
  creadoEn: string;
}

export interface NuevaEvaluacionInput {
  proveedorId: string;
  proveedorDbId: string;
  periodo: string;
  tipo: Evaluacion['tipo'];
  calidad?: number;
  entrega?: number;
  precio?: number;
  servicio?: number;
  documentacion?: number;
  evaluador?: string;
  comentarios?: string;
}

export interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface EvaluacionesContextValue {
  evaluaciones: Evaluacion[];
  loading: boolean;
  crearEvaluacion: (input: NuevaEvaluacionInput) => Promise<Evaluacion>;
  actualizarEvaluacion: (dbId: string, data: Partial<Evaluacion>) => Promise<CrudResult>;
  aprobarEvaluacion: (dbId: string) => Promise<CrudResult>;
  eliminarEvaluacion: (dbId: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const EvaluacionesContext = createContext<EvaluacionesContextValue | undefined>(undefined);

// ============================================================================
// HELPERS
// ============================================================================

function calcularPuntaje(
  calidad?: number,
  entrega?: number,
  precio?: number,
  servicio?: number,
  documentacion?: number
): { puntajeTotal?: number; resultado?: Evaluacion['resultado'] } {
  const criterios = [calidad, entrega, precio, servicio, documentacion].filter(
    (v): v is number => v !== undefined && v !== null
  );
  if (criterios.length === 0) return {};
  const puntajeTotal = criterios.reduce((a, b) => a + b, 0) / criterios.length;
  let resultado: Evaluacion['resultado'];
  if (puntajeTotal >= 90) resultado = 'excelente';
  else if (puntajeTotal >= 70) resultado = 'bueno';
  else if (puntajeTotal >= 50) resultado = 'regular';
  else resultado = 'deficiente';
  return { puntajeTotal: Math.round(puntajeTotal * 100) / 100, resultado };
}

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: EvaluacionProveedor): Evaluacion {
  const prov = row.proveedor as { codigo: string; razon_social: string } | null;
  return {
    _dbId: row.id,
    id: row.numero,
    proveedorId: prov?.codigo ?? '',
    proveedorNombre: prov?.razon_social ?? '',
    proveedorDbId: row.proveedor_id,
    periodo: row.periodo,
    tipo: row.tipo,
    estado: row.estado,
    calidad: row.calidad ?? undefined,
    entrega: row.entrega ?? undefined,
    precio: row.precio ?? undefined,
    servicio: row.servicio ?? undefined,
    documentacion: row.documentacion ?? undefined,
    puntajeTotal: row.puntaje_total ?? undefined,
    resultado: row.resultado ?? undefined,
    evaluador: row.evaluador ?? undefined,
    comentarios: row.comentarios ?? undefined,
    accionesMejora: row.acciones_mejora ?? undefined,
    creadoPor: row.creado_por ?? undefined,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function EvaluacionesProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const evaluacionesRef = useRef(evaluaciones);
  useEffect(() => { evaluacionesRef.current = evaluaciones; }, [evaluaciones]);
  const [loading, setLoading] = useState(true);

  const fetchEvaluaciones = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await dbEvaluaciones.list(tenantId);
    if (error) {
      console.error('[EVALUACIONES] Error al cargar:', error.message);
    } else if (data) {
      setEvaluaciones((data as EvaluacionProveedor[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchEvaluaciones();
  }, [fetchEvaluaciones]);

  const crearEvaluacion = useCallback(async (input: NuevaEvaluacionInput): Promise<Evaluacion> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const year = new Date().getFullYear();
    const numeros = evaluaciones.map(e => {
      const m = e.id.match(/^EVA-\d{4}-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const numero = `EVA-${year}-${siguiente.toString().padStart(3, '0')}`;

    const { puntajeTotal, resultado } = calcularPuntaje(
      input.calidad, input.entrega, input.precio, input.servicio, input.documentacion
    );

    const { data, error } = await dbEvaluaciones.insert({
      tenant_id: tenantId,
      proveedor_id: input.proveedorDbId,
      numero,
      periodo: input.periodo,
      tipo: input.tipo,
      estado: 'borrador',
      calidad: input.calidad ?? null,
      entrega: input.entrega ?? null,
      precio: input.precio ?? null,
      servicio: input.servicio ?? null,
      documentacion: input.documentacion ?? null,
      puntaje_total: puntajeTotal ?? null,
      resultado: resultado ?? null,
      evaluador: input.evaluador ?? null,
      comentarios: input.comentarios ?? null,
      acciones_mejora: null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });

    if (error) throw new Error(error.message);

    const nuevo = mapFromDB({
      ...(data as EvaluacionProveedor),
      proveedor: { codigo: input.proveedorId, razon_social: '' },
    });
    setEvaluaciones(prev => [nuevo, ...prev]);
    return nuevo;
  }, [evaluaciones, tenantId, user]);

  const actualizarEvaluacion = useCallback(async (
    dbId: string,
    updates: Partial<Evaluacion>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const ahora = new Date().toISOString();
    const payload: Record<string, unknown> = {
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (updates.periodo !== undefined) payload.periodo = updates.periodo;
    if (updates.tipo !== undefined) payload.tipo = updates.tipo;
    if (updates.estado !== undefined) payload.estado = updates.estado;
    if (updates.calidad !== undefined) payload.calidad = updates.calidad;
    if (updates.entrega !== undefined) payload.entrega = updates.entrega;
    if (updates.precio !== undefined) payload.precio = updates.precio;
    if (updates.servicio !== undefined) payload.servicio = updates.servicio;
    if (updates.documentacion !== undefined) payload.documentacion = updates.documentacion;
    if (updates.evaluador !== undefined) payload.evaluador = updates.evaluador;
    if (updates.comentarios !== undefined) payload.comentarios = updates.comentarios;
    if (updates.accionesMejora !== undefined) payload.acciones_mejora = updates.accionesMejora;

    // Recalculate score if any criteria changed
    const hasCriteriaUpdate =
      updates.calidad !== undefined ||
      updates.entrega !== undefined ||
      updates.precio !== undefined ||
      updates.servicio !== undefined ||
      updates.documentacion !== undefined;

    const existingEval = evaluacionesRef.current.find(e => e._dbId === dbId);
    if (!existingEval) return { exito: false, errores: ['Evaluación no encontrada'] };

    let recalcPayload: { puntaje_total?: number; resultado?: string } = {};
    if (hasCriteriaUpdate) {
      const cal = updates.calidad ?? existingEval.calidad;
      const ent = updates.entrega ?? existingEval.entrega;
      const pre = updates.precio ?? existingEval.precio;
      const ser = updates.servicio ?? existingEval.servicio;
      const doc = updates.documentacion ?? existingEval.documentacion;
      const { puntajeTotal, resultado } = calcularPuntaje(cal, ent, pre, ser, doc);
      if (puntajeTotal !== undefined) {
        recalcPayload = { puntaje_total: puntajeTotal, resultado: resultado ?? undefined };
      }
    }

    Object.assign(payload, recalcPayload);

    const { error } = await dbEvaluaciones.update(dbId, payload as Partial<EvaluacionProveedor>);
    if (error) return { exito: false, errores: [error.message] };

    setEvaluaciones(prev => prev.map(e => {
      if (e._dbId !== dbId) return e;
      const updated = { ...e, ...updates };
      if (recalcPayload.puntaje_total !== undefined) {
        updated.puntajeTotal = recalcPayload.puntaje_total;
        updated.resultado = recalcPayload.resultado as Evaluacion['resultado'];
      }
      return updated;
    }));

    return { exito: true };
  }, [user]);

  const aprobarEvaluacion = useCallback(async (dbId: string): Promise<CrudResult> => {
    return actualizarEvaluacion(dbId, { estado: 'aprobada' });
  }, [actualizarEvaluacion]);

  const eliminarEvaluacion = useCallback(async (dbId: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };
    const { error } = await dbEvaluaciones.delete(dbId);
    if (error) return { exito: false, errores: [error.message] };
    setEvaluaciones(prev => prev.filter(e => e._dbId !== dbId));
    return { exito: true };
  }, [user]);

  const value: EvaluacionesContextValue = {
    evaluaciones,
    loading,
    crearEvaluacion,
    actualizarEvaluacion,
    aprobarEvaluacion,
    eliminarEvaluacion,
  };

  return (
    <EvaluacionesContext.Provider value={value}>
      {children}
    </EvaluacionesContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useEvaluacionesStore() {
  const context = useContext(EvaluacionesContext);
  if (!context) throw new Error('useEvaluacionesStore debe usarse dentro de EvaluacionesProvider');
  return context;
}
