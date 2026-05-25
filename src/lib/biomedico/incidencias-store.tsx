/**
 * STORE DE INCIDENCIAS BIOMÉDICAS
 * Conectado a Supabase — tabla incidencias_biomedicas
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { dbIncidencias } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { IncidenciaBiomedica } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Incidencia {
  _dbId: string;
  id: string;              // INC-YYYY-NNN
  equipoId: string;
  equipoNombre: string;
  equipoDbId: string;
  tipo: 'falla' | 'error_usuario' | 'accidente' | 'deterioro' | 'otro';
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  estado: 'abierta' | 'en_investigacion' | 'resuelta' | 'cerrada';
  fechaOcurrencia: string;
  descripcion: string;
  accionesTomadas?: string;
  reportadoPor?: string;
  resueltoPor?: string;
  fechaResolucion?: string;
  requiereMantenimiento: boolean;
  creadoEn: string;
}

export interface NuevaIncidenciaInput {
  equipoId: string;
  equipoDbId: string;
  tipo: Incidencia['tipo'];
  severidad: Incidencia['severidad'];
  fechaOcurrencia: string;
  descripcion: string;
  reportadoPor?: string;
  requiereMantenimiento: boolean;
}

export interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface IncidenciasContextValue {
  incidencias: Incidencia[];
  loading: boolean;
  crearIncidencia: (input: NuevaIncidenciaInput) => Promise<Incidencia>;
  actualizarEstado: (dbId: string, estado: Incidencia['estado'], extras?: Partial<Incidencia>) => Promise<CrudResult>;
  eliminarIncidencia: (dbId: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const IncidenciasContext = createContext<IncidenciasContextValue | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: IncidenciaBiomedica): Incidencia {
  const equipo = row.equipo as { codigo: string; nombre: string } | null;
  return {
    _dbId: row.id,
    id: row.numero,
    equipoId: equipo?.codigo ?? '',
    equipoNombre: equipo?.nombre ?? '',
    equipoDbId: row.equipo_id,
    tipo: row.tipo,
    severidad: row.severidad,
    estado: row.estado,
    fechaOcurrencia: row.fecha_ocurrencia,
    descripcion: row.descripcion,
    accionesTomadas: row.acciones_tomadas ?? undefined,
    reportadoPor: row.reportado_por ?? undefined,
    resueltoPor: row.resuelto_por ?? undefined,
    fechaResolucion: row.fecha_resolucion ?? undefined,
    requiereMantenimiento: row.requiere_mantenimiento,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function IncidenciasProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const incidenciasRef = useRef(incidencias);
  useEffect(() => { incidenciasRef.current = incidencias; }, [incidencias]);
  const [loading, setLoading] = useState(true);

  const fetchIncidencias = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await dbIncidencias.list(tenantId);
    if (error) {
      console.error('[INCIDENCIAS] Error al cargar:', error.message);
    } else if (data) {
      setIncidencias((data as IncidenciaBiomedica[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchIncidencias();
  }, [fetchIncidencias]);

  const crearIncidencia = useCallback(async (input: NuevaIncidenciaInput): Promise<Incidencia> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const year = new Date().getFullYear();
    const numeros = incidencias.map(i => {
      const m = i.id.match(/^INC-\d{4}-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const numero = `INC-${year}-${siguiente.toString().padStart(3, '0')}`;

    const { data, error } = await dbIncidencias.insert({
      tenant_id: tenantId,
      equipo_id: input.equipoDbId,
      numero,
      tipo: input.tipo,
      severidad: input.severidad,
      estado: 'abierta' as const,
      fecha_ocurrencia: input.fechaOcurrencia,
      descripcion: input.descripcion,
      reportado_por: input.reportadoPor ?? null,
      requiere_mantenimiento: input.requiereMantenimiento,
      creado_por: user.id,
    });

    if (error) throw new Error(error.message);

    const nueva = mapFromDB({
      ...(data as IncidenciaBiomedica),
      equipo: { codigo: input.equipoId, nombre: '' },
    });
    setIncidencias(prev => [nueva, ...prev]);
    return nueva;
  }, [incidencias, tenantId, user]);

  const actualizarEstado = useCallback(async (
    dbId: string,
    estado: Incidencia['estado'],
    extras?: Partial<Incidencia>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const found = incidenciasRef.current.some(i => i._dbId === dbId);
    if (!found) return { exito: false, errores: ['Incidencia no encontrada'] };

    const ahora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      estado,
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (extras?.accionesTomadas !== undefined) updatePayload.acciones_tomadas = extras.accionesTomadas;
    if (extras?.resueltoPor !== undefined) updatePayload.resuelto_por = extras.resueltoPor;
    if (extras?.fechaResolucion !== undefined) updatePayload.fecha_resolucion = extras.fechaResolucion;

    const { error } = await dbIncidencias.update(dbId, updatePayload);
    if (error) return { exito: false, errores: [error.message] };

    setIncidencias(prev => prev.map(i =>
      i._dbId === dbId ? { ...i, estado, ...extras } : i
    ));

    return { exito: true };
  }, [user]);

  const eliminarIncidencia = useCallback(async (dbId: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const { error } = await dbIncidencias.delete(dbId);
    if (error) return { exito: false, errores: [error.message] };

    setIncidencias(prev => prev.filter(i => i._dbId !== dbId));
    return { exito: true };
  }, [user]);

  const value: IncidenciasContextValue = {
    incidencias,
    loading,
    crearIncidencia,
    actualizarEstado,
    eliminarIncidencia,
  };

  return (
    <IncidenciasContext.Provider value={value}>
      {children}
    </IncidenciasContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useIncidenciasStore() {
  const context = useContext(IncidenciasContext);
  if (!context) throw new Error('useIncidenciasStore debe usarse dentro de IncidenciasProvider');
  return context;
}
