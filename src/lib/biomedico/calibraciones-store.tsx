/**
 * STORE DE CALIBRACIONES BIOMÉDICAS
 * Conectado a Supabase — tabla calibraciones_biomedicas
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbCalibraciones } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { CalibracionBiomedica } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Calibracion {
  _dbId: string;
  id: string;              // CAL-YYYY-NNN (numero display)
  equipoId: string;        // codigo del equipo (EB-YYYY-NNN)
  equipoNombre: string;
  equipoDbId: string;      // UUID FK
  tipo: 'interna' | 'externa' | 'verificacion';
  estado: 'programada' | 'en_proceso' | 'aprobada' | 'rechazada' | 'vencida';
  fechaProgramada: string;
  fechaRealizada?: string;
  fechaVencimiento?: string;
  responsable?: string;
  proveedorCalibracion?: string;
  resultado?: 'aprobada' | 'rechazada' | 'con_observaciones';
  incertidumbre?: string;
  certificadoNumero?: string;
  observaciones?: string;
  creadoPor?: string;
  creadoEn: string;
}

export interface NuevaCalibracionInput {
  equipoId: string;        // display code EB-...
  equipoDbId: string;      // UUID
  tipo: Calibracion['tipo'];
  fechaProgramada: string;
  responsable?: string;
  observaciones?: string;
}

export interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface CalibracionesContextValue {
  calibraciones: Calibracion[];
  loading: boolean;
  crearCalibracion: (input: NuevaCalibracionInput) => Promise<Calibracion>;
  actualizarEstado: (dbId: string, estado: Calibracion['estado'], extras?: Partial<Calibracion>) => Promise<CrudResult>;
  eliminarCalibracion: (dbId: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CalibracionesContext = createContext<CalibracionesContextValue | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: CalibracionBiomedica): Calibracion {
  const equipo = row.equipo as { codigo: string; nombre: string } | null;
  return {
    _dbId: row.id,
    id: row.numero,
    equipoId: equipo?.codigo ?? '',
    equipoNombre: equipo?.nombre ?? '',
    equipoDbId: row.equipo_id,
    tipo: row.tipo,
    estado: row.estado,
    fechaProgramada: row.fecha_programada,
    fechaRealizada: row.fecha_realizada ?? undefined,
    fechaVencimiento: row.fecha_vencimiento ?? undefined,
    responsable: row.responsable ?? undefined,
    proveedorCalibracion: row.proveedor_calibracion ?? undefined,
    resultado: row.resultado ?? undefined,
    incertidumbre: row.incertidumbre ?? undefined,
    certificadoNumero: row.certificado_numero ?? undefined,
    observaciones: row.observaciones ?? undefined,
    creadoPor: row.creado_por ?? undefined,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function CalibracionesProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [calibraciones, setCalibraciones] = useState<Calibracion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalibraciones = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await dbCalibraciones.list(tenantId);
    if (error) {
      console.error('[CALIBRACIONES] Error al cargar:', error.message);
    } else if (data) {
      setCalibraciones((data as CalibracionBiomedica[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchCalibraciones();
  }, [fetchCalibraciones]);

  const crearCalibracion = useCallback(async (input: NuevaCalibracionInput): Promise<Calibracion> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const year = new Date().getFullYear();
    const numeros = calibraciones.map(c => {
      const m = c.id.match(/^CAL-\d{4}-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const numero = `CAL-${year}-${siguiente.toString().padStart(3, '0')}`;

    const { data, error } = await dbCalibraciones.insert({
      tenant_id: tenantId,
      equipo_id: input.equipoDbId,
      numero,
      tipo: input.tipo,
      estado: 'programada' as const,
      fecha_programada: input.fechaProgramada,
      responsable: input.responsable ?? null,
      observaciones: input.observaciones ?? null,
      creado_por: user.id,
    });

    if (error) throw new Error(error.message);

    const nuevo = mapFromDB({
      ...(data as CalibracionBiomedica),
      equipo: { codigo: input.equipoId, nombre: '' },
    });
    setCalibraciones(prev => [nuevo, ...prev]);
    return nuevo;
  }, [calibraciones, tenantId, user]);

  const actualizarEstado = useCallback(async (
    dbId: string,
    estado: Calibracion['estado'],
    extras?: Partial<Calibracion>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    let found = false;
    setCalibraciones(prev => {
      found = prev.some(c => c._dbId === dbId);
      return prev;
    });
    if (!found) return { exito: false, errores: ['Calibración no encontrada'] };

    const ahora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      estado,
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (extras?.fechaRealizada !== undefined) updatePayload.fecha_realizada = extras.fechaRealizada;
    if (extras?.fechaVencimiento !== undefined) updatePayload.fecha_vencimiento = extras.fechaVencimiento;
    if (extras?.resultado !== undefined) updatePayload.resultado = extras.resultado;
    if (extras?.incertidumbre !== undefined) updatePayload.incertidumbre = extras.incertidumbre;
    if (extras?.certificadoNumero !== undefined) updatePayload.certificado_numero = extras.certificadoNumero;
    if (extras?.observaciones !== undefined) updatePayload.observaciones = extras.observaciones;

    const { error } = await dbCalibraciones.update(dbId, updatePayload);
    if (error) return { exito: false, errores: [error.message] };

    setCalibraciones(prev => prev.map(c =>
      c._dbId === dbId ? { ...c, estado, ...extras } : c
    ));

    return { exito: true };
  }, [user]);

  const eliminarCalibracion = useCallback(async (dbId: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const { error } = await dbCalibraciones.delete(dbId);
    if (error) return { exito: false, errores: [error.message] };

    setCalibraciones(prev => prev.filter(c => c._dbId !== dbId));
    return { exito: true };
  }, [user]);

  const value: CalibracionesContextValue = {
    calibraciones,
    loading,
    crearCalibracion,
    actualizarEstado,
    eliminarCalibracion,
  };

  return (
    <CalibracionesContext.Provider value={value}>
      {children}
    </CalibracionesContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCalibracionesStore() {
  const context = useContext(CalibracionesContext);
  if (!context) throw new Error('useCalibracionesStore debe usarse dentro de CalibracionesProvider');
  return context;
}
