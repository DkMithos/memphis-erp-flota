/**
 * STORE DE RECEPCIONES Y CONFORMIDAD
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase/client';
import { dbRecepciones } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type {
  Recepcion as RecepcionDB,
  RecepcionItem as RecepcionItemDB,
} from '../supabase/types';
import {
  generarIdRecepcion,
  extraerNumeroSecuencial,
  DEBUG_RECEPCIONES,
  type EstadoRecepcion,
  type RolUsuario
} from './recepciones-config';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface ItemRecibido {
  id: string;
  _dbId?: string;
  descripcion: string;
  cantidadRecibida: number;
  unidad: string;
  observacionItem: string | null;
}

export interface Recepcion {
  // Identificación — id = numero (REC-NNNN), _dbId = UUID interno
  id: string;
  _dbId: string;
  ordenId: string;
  estado: EstadoRecepcion;

  // Items recibidos
  itemsRecibidos: ItemRecibido[];

  // Conformidad
  conforme: boolean;
  observaciones: string | null;

  // Imputación
  proyectoId?: string | null;
  centroCostoId?: string | null;

  // Fechas
  fechaRecepcion: string;

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

export interface ItemRecepcionInput extends Omit<ItemRecibido, 'id' | '_dbId'> {
  cantidadPedida?: number;
}

export interface NuevaRecepcionInput {
  ordenId: string;
  itemsRecibidos: ItemRecepcionInput[];
  estado: EstadoRecepcion;
  observaciones?: string;
  proyectoId?: string | null;
  centroCostoId?: string | null;
  // DB FK: proveedor UUID and orden UUID must be provided from calling context
  ordenDbId?: string;
  proveedorDbId?: string;
}

export interface ActualizarRecepcionInput extends Partial<NuevaRecepcionInput> {}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface RecepcionStoreContext {
  recepciones: Recepcion[];
  loading: boolean;
  obtenerRecepcionPorId: (id: string) => Recepcion | undefined;
  obtenerRecepcionesPorOrden: (ordenId: string) => Recepcion[];
  crearRecepcion: (
    input: NuevaRecepcionInput,
    onOrdenUpdated: (ordenId: string, esCompleta: boolean) => void
  ) => Promise<CrudResult & { recepcion?: Recepcion }>;
  actualizarRecepcion: (id: string, input: ActualizarRecepcionInput) => Promise<CrudResult>;
  anularRecepcion: (id: string, motivo: string) => Promise<CrudResult>;
  cargarRecepcionesIniciales: () => void;
  // Usuario actual derivado de auth
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const RecepcionContext = createContext<RecepcionStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

type RecepcionWithRelations = RecepcionDB & {
  items: RecepcionItemDB[];
  orden?: { numero: string; tipo: string } | null;
  proveedor?: { razon_social: string } | null;
};

function mapFromDB(row: RecepcionWithRelations): Recepcion {
  const items: ItemRecibido[] = (row.items ?? []).map(item => ({
    id: item.id,
    _dbId: item.id,
    descripcion: item.descripcion,
    cantidadRecibida: item.cantidad_recibida,
    unidad: item.unidad,
    observacionItem: item.observaciones,
  }));

  const conforme = row.estado === 'conforme';

  // Map DB estado to frontend EstadoRecepcion
  // DB: 'pendiente' | 'conforme' | 'observado' | 'rechazado'
  // Frontend: 'pendiente' | 'conforme' | 'observada' | 'anulada'
  const estadoMap: Record<string, EstadoRecepcion> = {
    pendiente: 'pendiente',
    conforme: 'conforme',
    observado: 'observada',
    rechazado: 'anulada',
  };

  const estadoFrontend = estadoMap[row.estado] ?? ('conforme' as EstadoRecepcion);

  return {
    id: row.numero,
    _dbId: row.id,
    ordenId: row.orden?.numero ?? row.orden_id, // use display numero if available
    estado: estadoFrontend,
    itemsRecibidos: items,
    conforme,
    observaciones: row.observaciones,
    proyectoId: (row as any).proyecto_id ?? null,
    centroCostoId: (row as any).centro_costo_id ?? null,
    fechaRecepcion: row.fecha_recepcion,
    auditoria: {
      creadoPor: row.creado_por ?? '',
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null,
    },
  };
}

// Map frontend estado to DB estado
function estadoFrontendToDb(estado: EstadoRecepcion): string {
  const map: Record<EstadoRecepcion, string> = {
    pendiente: 'pendiente',
    conforme: 'conforme',
    observada: 'observado',
    anulada: 'rechazado',
  };
  return map[estado] ?? 'conforme';
}

// ============================================================================
// PROVIDER
// ============================================================================

export function RecepcionStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user, profile } = useAuth();
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const recepcionesRef = useRef(recepciones);
  useEffect(() => { recepcionesRef.current = recepciones; }, [recepciones]);
  const [loading, setLoading] = useState(true);

  const usuarioActual = {
    email: user?.email ?? profile?.email ?? 'operaciones@kesa.com',
    nombre: profile ? `${profile.nombre} ${profile.apellido ?? ''}`.trim() : 'Operaciones',
    rol: (profile?.rol as RolUsuario) ?? ('operaciones' as RolUsuario),
  };

  const fetchRecepciones = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await dbRecepciones.list();

    if (error) {
      console.error('[RECEPCIONES] Error al cargar:', error.message);
    } else if (data) {
      const mapped = (data as RecepcionWithRelations[]).map(mapFromDB);
      setRecepciones(mapped);
      if (DEBUG_RECEPCIONES) {
        console.log('[RECEPCIONES] Cargadas desde Supabase:', mapped.length);
      }
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchRecepciones();
  }, [fetchRecepciones]);

  const cargarRecepcionesIniciales = useCallback(() => {
    fetchRecepciones();
  }, [fetchRecepciones]);

  // ============================================================================
  // QUERIES
  // ============================================================================

  const obtenerRecepcionPorId = useCallback(
    (id: string) => recepciones.find(r => r.id === id),
    [recepciones]
  );

  const obtenerRecepcionesPorOrden = useCallback(
    (ordenId: string) => recepciones.filter(r => r.ordenId === ordenId),
    [recepciones]
  );

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearRecepcion = useCallback(
    async (
      input: NuevaRecepcionInput,
      onOrdenUpdated: (ordenId: string, esCompleta: boolean) => void
    ): Promise<CrudResult & { recepcion?: Recepcion }> => {
      if (!tenantId || !user) {
        return { exito: false, errores: ['Sin sesión activa'] };
      }

      const ordenDbId = input.ordenDbId;
      const proveedorDbId = input.proveedorDbId;

      if (!ordenDbId || !proveedorDbId) {
        return { exito: false, errores: ['Se requieren IDs de BD para orden y proveedor'] };
      }

      const numeros = recepciones
        .map(r => extraerNumeroSecuencial(r.id))
        .filter((n): n is number => n !== null);
      const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
      const nuevoCodigo = generarIdRecepcion(ultimoNumero);

      const timestamp = new Date().toISOString();
      const conforme = input.estado === 'conforme';

      const { data: inserted, error: errRec } = await dbRecepciones.create({
        tenant_id: tenantId,
        numero: nuevoCodigo,
        orden_id: ordenDbId,
        proveedor_id: proveedorDbId,
        estado: estadoFrontendToDb(input.estado),
        fecha_recepcion: timestamp,
        numero_guia: null,
        numero_factura: null,
        observaciones: input.observaciones?.trim() ?? null,
        proyecto_id: input.proyectoId ?? null,
        centro_costo_id: input.centroCostoId ?? null,
        creado_por: user.id,
        modificado_por: null,
        modificado_en: null,
      } as any);

      if (errRec || !inserted) {
        console.error('[RECEPCIONES] Error al crear:', errRec?.message);
        return { exito: false, errores: [errRec?.message ?? 'Error desconocido'] };
      }

      const dbRow = inserted as RecepcionDB;

      // Insert items en batch (atómico)
      const itemsPayload = input.itemsRecibidos.map(item => ({
        tenant_id: tenantId,
        recepcion_id: dbRow.id,
        descripcion: item.descripcion.trim(),
        unidad: item.unidad,
        cantidad_pedida: item.cantidadRecibida,
        cantidad_recibida: item.cantidadRecibida,
        conforme,
        observaciones: item.observacionItem ?? null,
      }));
      const { data: itemsData, error: errItems } = await supabase
        .from('recepcion_items')
        .insert(itemsPayload)
        .select();
      if (errItems) {
        console.error('[RECEPCIONES] Error al crear items:', errItems.message);
      }
      const itemsInserted = (itemsData ?? []) as RecepcionItemDB[];

      const nueva = mapFromDB({
        ...dbRow,
        items: itemsInserted,
        orden: { numero: input.ordenId, tipo: 'oc' },
        proveedor: null,
      });
      setRecepciones(prev => [nueva, ...prev]);

      if (DEBUG_RECEPCIONES) {
        console.log('[REC_CREATED]', { id: nueva.id, ordenId: nueva.ordenId, estado: nueva.estado });
      }

      // Trigger order state update — recepción completa solo si cada item tiene cantidadPedida
      // y cantidadRecibida >= cantidadPedida. Sin cantidadPedida no se puede afirmar completitud.
      const tieneInfoPedida = input.itemsRecibidos.every(item => item.cantidadPedida != null);
      const esCompleta = tieneInfoPedida && input.itemsRecibidos.length > 0 &&
        input.itemsRecibidos.every(item => item.cantidadRecibida >= (item.cantidadPedida!));
      onOrdenUpdated(input.ordenId, esCompleta);

      return { exito: true, recepcion: nueva };
    },
    [recepciones, tenantId, user]
  );

  const actualizarRecepcion = useCallback(
    async (id: string, input: ActualizarRecepcionInput): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = recepcionesRef.current.find(r => r.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Recepción no encontrada'] };

      const ahora = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        modificado_por: user.id,
        modificado_en: ahora,
      };

      if (input.estado !== undefined) updatePayload.estado = estadoFrontendToDb(input.estado);
      if (input.observaciones !== undefined) updatePayload.observaciones = input.observaciones?.trim() ?? null;

      const { error } = await dbRecepciones.update(dbId, updatePayload);

      if (error) {
        console.error('[RECEPCIONES] Error al actualizar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      if (input.itemsRecibidos !== undefined && tenantId) {
        await supabase.from('recepcion_items').delete().eq('recepcion_id', dbId);

        const conforme = (input.estado ?? 'conforme') === 'conforme';
        const itemsPayload = input.itemsRecibidos.map(item => ({
          tenant_id: tenantId,
          recepcion_id: dbId,
          descripcion: item.descripcion.trim(),
          unidad: item.unidad,
          cantidad_pedida: item.cantidadRecibida,
          cantidad_recibida: item.cantidadRecibida,
          conforme,
          observaciones: item.observacionItem ?? null,
        }));
        const { data: newItemsData } = await supabase
          .from('recepcion_items')
          .insert(itemsPayload)
          .select();
        const newItemsInserted = (newItemsData ?? []) as RecepcionItemDB[];

        setRecepciones(prev =>
          prev.map(r => {
            if (r.id !== id) return r;
            const newItems: ItemRecibido[] = newItemsInserted.map(dbItem => ({
              id: dbItem.id,
              _dbId: dbItem.id,
              descripcion: dbItem.descripcion,
              cantidadRecibida: dbItem.cantidad_recibida,
              unidad: dbItem.unidad,
              observacionItem: dbItem.observaciones,
            }));
            const estado = input.estado ?? r.estado;
            return {
              ...r,
              ...(input.estado !== undefined && { estado }),
              ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() ?? null }),
              itemsRecibidos: newItems,
              conforme: estado === 'conforme',
              auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      } else {
        setRecepciones(prev =>
          prev.map(r => {
            if (r.id !== id) return r;
            const estado = input.estado ?? r.estado;
            return {
              ...r,
              ...(input.estado !== undefined && { estado }),
              ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() ?? null }),
              conforme: estado === 'conforme',
              auditoria: { ...r.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      }

      return { exito: true };
    },
    [user, tenantId]
  );

  const anularRecepcion = useCallback(
    async (id: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = recepcionesRef.current.find(r => r.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Recepción no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbRecepciones.update(dbId, {
        estado: 'rechazado', // Use rechazado as DB equivalent for anulada
        observaciones: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[RECEPCIONES] Error al anular:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setRecepciones(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                estado: 'anulada' as EstadoRecepcion,
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

      if (DEBUG_RECEPCIONES) {
        console.log('[REC_CANCELLED]', { id });
      }

      return { exito: true };
    },
    [user]
  );

  const value: RecepcionStoreContext = {
    recepciones,
    loading,
    obtenerRecepcionPorId,
    obtenerRecepcionesPorOrden,
    crearRecepcion,
    actualizarRecepcion,
    anularRecepcion,
    cargarRecepcionesIniciales,
    usuarioActual,
  };

  return <RecepcionContext.Provider value={value}>{children}</RecepcionContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRecepcionesStore() {
  const context = useContext(RecepcionContext);
  if (!context) {
    throw new Error('useRecepcionesStore debe usarse dentro de RecepcionStoreProvider');
  }
  return context;
}
