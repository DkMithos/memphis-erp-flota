/**
 * STORE DE REQUERIMIENTOS DE COMPRA
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { dbRequerimientos } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type {
  RequerimientoCompra,
  RequerimientoItem as RequerimientoItemDB,
} from '../supabase/types';
import {
  generarIdRequerimiento,
  extraerNumeroSecuencial,
  normalizeEmail,
  DEBUG_REQUERIMIENTOS,
  type EstadoRequerimiento,
  type PrioridadRequerimiento,
  type CentroCosto,
  type RolUsuario
} from './requerimientos-config';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface ItemRequerimiento {
  id: string;
  _dbId?: string; // UUID interno de Supabase
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioEstimado: number;
  comentario: string | null;
}

export interface Requerimiento {
  // Identificación — id = numero (REQ-NNNN), _dbId = UUID interno
  id: string;
  _dbId: string;
  titulo: string;
  descripcion: string;

  // Clasificación
  centroCosto: CentroCosto;
  prioridad: PrioridadRequerimiento;
  estado: EstadoRequerimiento;

  // Solicitante
  solicitanteNombre: string;
  solicitanteEmail: string;

  // Temporal
  fechaRequerida: string | null;

  // Items
  items: ItemRequerimiento[];
  totalEstimado: number;

  // Aprobación
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  rechazadoPor: string | null;
  rechazadoEn: string | null;
  motivoRechazo: string | null;

  // Auditoría
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    anuladoPor: string | null;
    anuladoEn: string | null;
    motivoAnulacion: string | null;
  };
}

export interface NuevoRequerimientoInput {
  titulo: string;
  descripcion: string;
  centroCosto: CentroCosto;
  prioridad: PrioridadRequerimiento;
  solicitanteNombre: string;
  solicitanteEmail: string;
  fechaRequerida?: string;
  items: Omit<ItemRequerimiento, 'id' | '_dbId'>[];
}

export interface ActualizarRequerimientoInput extends Partial<NuevoRequerimientoInput> {}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface RequerimientoStoreContext {
  requerimientos: Requerimiento[];
  loading: boolean;
  obtenerRequerimientoPorId: (id: string) => Requerimiento | undefined;
  crearRequerimiento: (input: NuevoRequerimientoInput) => Promise<CrudResult & { requerimiento?: Requerimiento }>;
  actualizarRequerimiento: (id: string, input: ActualizarRequerimientoInput) => Promise<CrudResult>;
  cambiarEstado: (id: string, nuevoEstado: EstadoRequerimiento) => Promise<CrudResult>;
  aprobarRequerimiento: (id: string, aprobadoPor: string) => Promise<CrudResult>;
  rechazarRequerimiento: (id: string, rechazadoPor: string, motivo: string) => Promise<CrudResult>;
  anularRequerimiento: (id: string, motivo: string) => Promise<CrudResult>;
  cargarRequerimientosIniciales: () => void;
  // Usuario actual derivado de auth
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const RequerimientoContext = createContext<RequerimientoStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

type RequerimientoWithItems = RequerimientoCompra & {
  items: RequerimientoItemDB[];
};

function mapFromDB(row: RequerimientoWithItems): Requerimiento {
  const items: ItemRequerimiento[] = (row.items ?? []).map(item => ({
    id: item.id,
    _dbId: item.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    unidad: item.unidad,
    precioEstimado: item.costo_estimado_unitario,
    comentario: item.observaciones,
  }));

  const totalEstimado = items.reduce(
    (sum, item) => sum + item.cantidad * item.precioEstimado,
    0
  );

  return {
    id: row.numero,
    _dbId: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion ?? '',
    centroCosto: row.centro_costo as CentroCosto,
    prioridad: row.prioridad as PrioridadRequerimiento,
    estado: row.estado as EstadoRequerimiento,
    solicitanteNombre: row.creado_por ?? '',
    solicitanteEmail: row.creado_por ?? '',
    fechaRequerida: row.fecha_requerida,
    items,
    totalEstimado,
    aprobadoPor: row.aprobado_por,
    aprobadoEn: row.aprobado_en,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: row.motivo_rechazo,
    auditoria: {
      creadoPor: row.creado_por ?? '',
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
      anuladoPor: row.estado === 'anulado' ? row.modificado_por : null,
      anuladoEn: row.estado === 'anulado' ? row.modificado_en : null,
      motivoAnulacion: row.motivo_anulacion,
    },
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function RequerimientoStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user, profile } = useAuth();
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [loading, setLoading] = useState(true);

  // Usuario actual derivado del perfil autenticado
  const usuarioActual = {
    email: user?.email ?? profile?.email ?? 'admin@memphis.com.pe',
    nombre: profile ? `${profile.nombre} ${profile.apellido ?? ''}`.trim() : 'Usuario',
    rol: (profile?.rol as RolUsuario) ?? ('admin_empresa' as RolUsuario),
  };

  // Carga inicial desde Supabase
  const fetchRequerimientos = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data, error } = await dbRequerimientos.list();

    if (error) {
      console.error('[REQUERIMIENTOS] Error al cargar:', error.message);
    } else if (data) {
      const mapped = (data as RequerimientoWithItems[]).map(mapFromDB);
      setRequerimientos(mapped);
      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQUERIMIENTOS] Cargados desde Supabase:', mapped.length);
      }
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchRequerimientos();
  }, [fetchRequerimientos]);

  // cargarRequerimientosIniciales — compatibilidad con UI existente
  const cargarRequerimientosIniciales = useCallback(() => {
    fetchRequerimientos();
  }, [fetchRequerimientos]);

  // ============================================================================
  // QUERIES (síncronas)
  // ============================================================================

  const obtenerRequerimientoPorId = useCallback(
    (id: string) => requerimientos.find(r => r.id === id),
    [requerimientos]
  );

  // ============================================================================
  // HELPERS
  // ============================================================================

  const calcularTotal = (items: Omit<ItemRequerimiento, 'id' | '_dbId'>[]): number =>
    items.reduce((sum, item) => sum + item.cantidad * item.precioEstimado, 0);

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearRequerimiento = useCallback(
    async (input: NuevoRequerimientoInput): Promise<CrudResult & { requerimiento?: Requerimiento }> => {
      if (!tenantId || !user) {
        return { exito: false, errores: ['Sin sesión activa'] };
      }

      // Determinar siguiente número secuencial
      const numeros = requerimientos
        .map(r => extraerNumeroSecuencial(r.id))
        .filter((n): n is number => n !== null);
      const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
      const nuevoCodigo = generarIdRequerimiento(ultimoNumero);

      const totalEstimado = calcularTotal(input.items);

      // Insertar cabecera
      const { data: inserted, error: errReq } = await dbRequerimientos.create({
        tenant_id: tenantId,
        numero: nuevoCodigo,
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        estado: 'borrador' as EstadoRequerimiento,
        prioridad: input.prioridad,
        centro_costo: input.centroCosto,
        fecha_requerida: input.fechaRequerida || null,
        motivo_rechazo: null,
        motivo_anulacion: null,
        aprobado_por: null,
        aprobado_en: null,
        creado_por: normalizeEmail(input.solicitanteEmail),
        modificado_por: null,
        modificado_en: null,
      });

      if (errReq || !inserted) {
        console.error('[REQUERIMIENTOS] Error al crear:', errReq?.message);
        return { exito: false, errores: [errReq?.message ?? 'Error desconocido'] };
      }

      const dbRow = inserted as RequerimientoCompra;

      // Insertar items
      const itemsInserted: RequerimientoItemDB[] = [];
      for (const item of input.items) {
        const { data: itemData, error: errItem } = await supabase
          .from('requerimiento_items')
          .insert({
            tenant_id: tenantId,
            requerimiento_id: dbRow.id,
            descripcion: item.descripcion.trim(),
            unidad: item.unidad,
            cantidad: item.cantidad,
            costo_estimado_unitario: item.precioEstimado,
            observaciones: item.comentario ?? null,
          })
          .select()
          .single();

        if (errItem) {
          console.error('[REQUERIMIENTOS] Error al crear item:', errItem.message);
        } else if (itemData) {
          itemsInserted.push(itemData as RequerimientoItemDB);
        }
      }

      const nuevo = mapFromDB({ ...dbRow, items: itemsInserted });
      // Override totalEstimado since it is computed from local items
      nuevo.totalEstimado = totalEstimado;
      setRequerimientos(prev => [nuevo, ...prev]);

      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_CREATED]', { id: nuevo.id, titulo: nuevo.titulo, items: itemsInserted.length });
      }

      return { exito: true, requerimiento: nuevo };
    },
    [requerimientos, tenantId, user]
  );

  const actualizarRequerimiento = useCallback(
    async (id: string, input: ActualizarRequerimientoInput): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      let dbId: string | undefined;
      setRequerimientos(prev => {
        dbId = prev.find(r => r.id === id)?._dbId;
        return prev;
      });
      if (!dbId) return { exito: false, errores: ['Requerimiento no encontrado'] };

      const ahora = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        modificado_por: user.id,
        modificado_en: ahora,
      };

      if (input.titulo !== undefined) updatePayload.titulo = input.titulo.trim();
      if (input.descripcion !== undefined) updatePayload.descripcion = input.descripcion.trim();
      if (input.centroCosto !== undefined) updatePayload.centro_costo = input.centroCosto;
      if (input.prioridad !== undefined) updatePayload.prioridad = input.prioridad;
      if (input.fechaRequerida !== undefined) updatePayload.fecha_requerida = input.fechaRequerida || null;

      const { error } = await dbRequerimientos.update(dbId, updatePayload);

      if (error) {
        console.error('[REQUERIMIENTOS] Error al actualizar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      // If items changed, delete old and insert new
      if (input.items !== undefined && tenantId) {
        // Delete all existing items for this requerimiento
        await supabase.from('requerimiento_items').delete().eq('requerimiento_id', dbId);

        const newItemsInserted: RequerimientoItemDB[] = [];
        for (const item of input.items) {
          const { data: itemData } = await supabase
            .from('requerimiento_items')
            .insert({
              tenant_id: tenantId,
              requerimiento_id: dbId,
              descripcion: item.descripcion.trim(),
              unidad: item.unidad,
              cantidad: item.cantidad,
              costo_estimado_unitario: item.precioEstimado,
              observaciones: item.comentario ?? null,
            })
            .select()
            .single();

          if (itemData) newItemsInserted.push(itemData as RequerimientoItemDB);
        }

        setRequerimientos(prev =>
          prev.map(r => {
            if (r.id !== id) return r;
            const newItems: ItemRequerimiento[] = newItemsInserted.map(dbItem => ({
              id: dbItem.id,
              _dbId: dbItem.id,
              descripcion: dbItem.descripcion,
              cantidad: dbItem.cantidad,
              unidad: dbItem.unidad,
              precioEstimado: dbItem.costo_estimado_unitario,
              comentario: dbItem.observaciones,
            }));
            return {
              ...r,
              ...(input.titulo !== undefined && { titulo: input.titulo.trim() }),
              ...(input.descripcion !== undefined && { descripcion: input.descripcion.trim() }),
              ...(input.centroCosto !== undefined && { centroCosto: input.centroCosto }),
              ...(input.prioridad !== undefined && { prioridad: input.prioridad }),
              ...(input.fechaRequerida !== undefined && { fechaRequerida: input.fechaRequerida || null }),
              ...(input.solicitanteNombre !== undefined && { solicitanteNombre: input.solicitanteNombre.trim() }),
              ...(input.solicitanteEmail !== undefined && { solicitanteEmail: normalizeEmail(input.solicitanteEmail) }),
              items: newItems,
              totalEstimado: newItems.reduce((s, i) => s + i.cantidad * i.precioEstimado, 0),
              auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      } else {
        setRequerimientos(prev =>
          prev.map(r => {
            if (r.id !== id) return r;
            return {
              ...r,
              ...(input.titulo !== undefined && { titulo: input.titulo.trim() }),
              ...(input.descripcion !== undefined && { descripcion: input.descripcion.trim() }),
              ...(input.centroCosto !== undefined && { centroCosto: input.centroCosto }),
              ...(input.prioridad !== undefined && { prioridad: input.prioridad }),
              ...(input.fechaRequerida !== undefined && { fechaRequerida: input.fechaRequerida || null }),
              ...(input.solicitanteNombre !== undefined && { solicitanteNombre: input.solicitanteNombre.trim() }),
              ...(input.solicitanteEmail !== undefined && { solicitanteEmail: normalizeEmail(input.solicitanteEmail) }),
              auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      }

      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_UPDATED]', { id, cambios: Object.keys(input) });
      }

      return { exito: true };
    },
    [user, tenantId]
  );

  const cambiarEstado = useCallback(
    async (id: string, nuevoEstado: EstadoRequerimiento): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      let dbId: string | undefined;
      setRequerimientos(prev => {
        dbId = prev.find(r => r.id === id)?._dbId;
        return prev;
      });
      if (!dbId) return { exito: false, errores: ['Requerimiento no encontrado'] };

      const ahora = new Date().toISOString();
      const { error } = await dbRequerimientos.update(dbId, {
        estado: nuevoEstado,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[REQUERIMIENTOS] Error al cambiar estado:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setRequerimientos(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, estado: nuevoEstado, auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora } }
            : r
        )
      );

      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_ESTADO_CHANGED]', { id, estadoNuevo: nuevoEstado });
      }

      return { exito: true };
    },
    [user]
  );

  const aprobarRequerimiento = useCallback(
    async (id: string, aprobadoPor: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      let dbId: string | undefined;
      setRequerimientos(prev => {
        dbId = prev.find(r => r.id === id)?._dbId;
        return prev;
      });
      if (!dbId) return { exito: false, errores: ['Requerimiento no encontrado'] };

      const ahora = new Date().toISOString();
      const { error } = await dbRequerimientos.update(dbId, {
        estado: 'aprobado' as EstadoRequerimiento,
        aprobado_por: aprobadoPor,
        aprobado_en: ahora,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[REQUERIMIENTOS] Error al aprobar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setRequerimientos(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                estado: 'aprobado' as EstadoRequerimiento,
                aprobadoPor,
                aprobadoEn: ahora,
                auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : r
        )
      );

      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_APPROVED]', { id, aprobadoPor });
      }

      return { exito: true };
    },
    [user]
  );

  const rechazarRequerimiento = useCallback(
    async (id: string, rechazadoPor: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      let dbId: string | undefined;
      setRequerimientos(prev => {
        dbId = prev.find(r => r.id === id)?._dbId;
        return prev;
      });
      if (!dbId) return { exito: false, errores: ['Requerimiento no encontrado'] };

      const ahora = new Date().toISOString();
      const { error } = await dbRequerimientos.update(dbId, {
        estado: 'rechazado' as EstadoRequerimiento,
        motivo_rechazo: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[REQUERIMIENTOS] Error al rechazar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setRequerimientos(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                estado: 'rechazado' as EstadoRequerimiento,
                rechazadoPor,
                rechazadoEn: ahora,
                motivoRechazo: motivo.trim(),
                auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : r
        )
      );

      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_REJECTED]', { id, rechazadoPor });
      }

      return { exito: true };
    },
    [user]
  );

  const anularRequerimiento = useCallback(
    async (id: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      let dbId: string | undefined;
      setRequerimientos(prev => {
        dbId = prev.find(r => r.id === id)?._dbId;
        return prev;
      });
      if (!dbId) return { exito: false, errores: ['Requerimiento no encontrado'] };

      const ahora = new Date().toISOString();
      const { error } = await dbRequerimientos.update(dbId, {
        estado: 'anulado' as EstadoRequerimiento,
        motivo_anulacion: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[REQUERIMIENTOS] Error al anular:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setRequerimientos(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                estado: 'anulado' as EstadoRequerimiento,
                auditoria: {
                  ...r.auditoria,
                  modificadoPor: user.id,
                  modificadoEn: ahora,
                  anuladoPor: user.id,
                  anuladoEn: ahora,
                  motivoAnulacion: motivo.trim(),
                },
              }
            : r
        )
      );

      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_CANCELLED]', { id });
      }

      return { exito: true };
    },
    [user]
  );

  const value: RequerimientoStoreContext = {
    requerimientos,
    loading,
    obtenerRequerimientoPorId,
    crearRequerimiento,
    actualizarRequerimiento,
    cambiarEstado,
    aprobarRequerimiento,
    rechazarRequerimiento,
    anularRequerimiento,
    cargarRequerimientosIniciales,
    usuarioActual,
  };

  return <RequerimientoContext.Provider value={value}>{children}</RequerimientoContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRequerimientosStore() {
  const context = useContext(RequerimientoContext);
  if (!context) {
    throw new Error('useRequerimientosStore debe usarse dentro de RequerimientoStoreProvider');
  }
  return context;
}
