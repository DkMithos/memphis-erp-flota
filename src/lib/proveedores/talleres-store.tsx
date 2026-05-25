/**
 * STORE DE TALLERES (Red de Talleres Autorizados)
 * Conectado a Supabase — tabla talleres
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { dbTalleres } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { TallerDB } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface TallerFrontend {
  _dbId: string;
  id: string;              // TAL-NNNN
  proveedorId?: string;
  proveedorNombre?: string;
  proveedorDbId?: string;
  nombre: string;
  tipo: 'mecanico' | 'electrico' | 'carroceria' | 'neumaticos' | 'aire_acondicionado' | 'general' | 'especializado';
  estado: 'activo' | 'inactivo' | 'suspendido';
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  especialidades: string[];
  marcasAutorizadas: string[];
  horarioAtencion?: string;
  tiempoRespuestaHoras?: number;
  moneda: string;
  condicionesPago?: string;
  observaciones?: string;
  creadoEn: string;
}

export interface NuevoTallerInput {
  nombre: string;
  tipo: TallerFrontend['tipo'];
  proveedorId?: string;
  proveedorDbId?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  especialidades?: string[];
  marcasAutorizadas?: string[];
  horarioAtencion?: string;
  tiempoRespuestaHoras?: number;
  moneda?: string;
  condicionesPago?: string;
  observaciones?: string;
}

export interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface TalleresContextValue {
  talleres: TallerFrontend[];
  loading: boolean;
  crearTaller: (input: NuevoTallerInput) => Promise<TallerFrontend>;
  actualizarTaller: (dbId: string, data: Partial<TallerFrontend>) => Promise<CrudResult>;
  cambiarEstado: (dbId: string, estado: TallerFrontend['estado']) => Promise<CrudResult>;
  eliminarTaller: (dbId: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TalleresContext = createContext<TalleresContextValue | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: TallerDB): TallerFrontend {
  const prov = row.proveedor as { codigo: string; razon_social: string } | null;
  return {
    _dbId: row.id,
    id: row.codigo,
    proveedorId: prov?.codigo ?? undefined,
    proveedorNombre: prov?.razon_social ?? undefined,
    proveedorDbId: row.proveedor_id ?? undefined,
    nombre: row.nombre,
    tipo: row.tipo,
    estado: row.estado,
    contactoNombre: row.contacto_nombre ?? undefined,
    contactoTelefono: row.contacto_telefono ?? undefined,
    contactoEmail: row.contacto_email ?? undefined,
    departamento: row.departamento ?? undefined,
    provincia: row.provincia ?? undefined,
    distrito: row.distrito ?? undefined,
    direccion: row.direccion ?? undefined,
    especialidades: row.especialidades ?? [],
    marcasAutorizadas: row.marcas_autorizadas ?? [],
    horarioAtencion: row.horario_atencion ?? undefined,
    tiempoRespuestaHoras: row.tiempo_respuesta_horas ?? undefined,
    moneda: row.moneda,
    condicionesPago: row.condiciones_pago ?? undefined,
    observaciones: row.observaciones ?? undefined,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function TalleresProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [talleres, setTalleres] = useState<TallerFrontend[]>([]);
  const talleresRef = useRef(talleres);
  useEffect(() => { talleresRef.current = talleres; }, [talleres]);
  const [loading, setLoading] = useState(true);

  const fetchTalleres = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await dbTalleres.list(tenantId);
    if (error) {
      console.error('[TALLERES] Error al cargar:', error.message);
    } else if (data) {
      setTalleres((data as TallerDB[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchTalleres();
  }, [fetchTalleres]);

  const crearTaller = useCallback(async (input: NuevoTallerInput): Promise<TallerFrontend> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const numeros = talleres.map(t => {
      const m = t.id.match(/^TAL-(\d{4})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const codigo = `TAL-${siguiente.toString().padStart(4, '0')}`;

    const { data, error } = await dbTalleres.insert({
      tenant_id: tenantId,
      codigo,
      nombre: input.nombre,
      tipo: input.tipo,
      estado: 'activo',
      proveedor_id: input.proveedorDbId ?? null,
      contacto_nombre: input.contactoNombre ?? null,
      contacto_telefono: input.contactoTelefono ?? null,
      contacto_email: input.contactoEmail ?? null,
      departamento: input.departamento ?? null,
      provincia: input.provincia ?? null,
      distrito: input.distrito ?? null,
      direccion: input.direccion ?? null,
      especialidades: input.especialidades ?? [],
      marcas_autorizadas: input.marcasAutorizadas ?? [],
      horario_atencion: input.horarioAtencion ?? null,
      tiempo_respuesta_horas: input.tiempoRespuestaHoras ?? null,
      moneda: input.moneda ?? 'PEN',
      condiciones_pago: input.condicionesPago ?? null,
      observaciones: input.observaciones ?? null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });

    if (error) throw new Error(error.message);

    const nuevo = mapFromDB({
      ...(data as TallerDB),
      proveedor: input.proveedorId ? { codigo: input.proveedorId, razon_social: '' } : null,
    });
    setTalleres(prev => [nuevo, ...prev]);
    return nuevo;
  }, [talleres, tenantId, user]);

  const actualizarTaller = useCallback(async (
    dbId: string,
    updates: Partial<TallerFrontend>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const found = talleresRef.current.some(t => t._dbId === dbId);
    if (!found) return { exito: false, errores: ['Taller no encontrado'] };

    const ahora = new Date().toISOString();
    const payload: Record<string, unknown> = {
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (updates.nombre !== undefined) payload.nombre = updates.nombre;
    if (updates.tipo !== undefined) payload.tipo = updates.tipo;
    if (updates.estado !== undefined) payload.estado = updates.estado;
    if (updates.contactoNombre !== undefined) payload.contacto_nombre = updates.contactoNombre;
    if (updates.contactoTelefono !== undefined) payload.contacto_telefono = updates.contactoTelefono;
    if (updates.contactoEmail !== undefined) payload.contacto_email = updates.contactoEmail;
    if (updates.departamento !== undefined) payload.departamento = updates.departamento;
    if (updates.provincia !== undefined) payload.provincia = updates.provincia;
    if (updates.distrito !== undefined) payload.distrito = updates.distrito;
    if (updates.direccion !== undefined) payload.direccion = updates.direccion;
    if (updates.especialidades !== undefined) payload.especialidades = updates.especialidades;
    if (updates.marcasAutorizadas !== undefined) payload.marcas_autorizadas = updates.marcasAutorizadas;
    if (updates.horarioAtencion !== undefined) payload.horario_atencion = updates.horarioAtencion;
    if (updates.tiempoRespuestaHoras !== undefined) payload.tiempo_respuesta_horas = updates.tiempoRespuestaHoras;
    if (updates.moneda !== undefined) payload.moneda = updates.moneda;
    if (updates.condicionesPago !== undefined) payload.condiciones_pago = updates.condicionesPago;
    if (updates.observaciones !== undefined) payload.observaciones = updates.observaciones;

    const { error } = await dbTalleres.update(dbId, payload as Partial<TallerDB>);
    if (error) return { exito: false, errores: [error.message] };

    setTalleres(prev => prev.map(t => t._dbId === dbId ? { ...t, ...updates } : t));
    return { exito: true };
  }, [user]);

  const cambiarEstado = useCallback(async (
    dbId: string,
    estado: TallerFrontend['estado']
  ): Promise<CrudResult> => {
    return actualizarTaller(dbId, { estado });
  }, [actualizarTaller]);

  const eliminarTaller = useCallback(async (dbId: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };
    const { error } = await dbTalleres.delete(dbId);
    if (error) return { exito: false, errores: [error.message] };
    setTalleres(prev => prev.filter(t => t._dbId !== dbId));
    return { exito: true };
  }, [user]);

  const value: TalleresContextValue = {
    talleres,
    loading,
    crearTaller,
    actualizarTaller,
    cambiarEstado,
    eliminarTaller,
  };

  return (
    <TalleresContext.Provider value={value}>
      {children}
    </TalleresContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useTalleresStore() {
  const context = useContext(TalleresContext);
  if (!context) throw new Error('useTalleresStore debe usarse dentro de TalleresProvider');
  return context;
}
