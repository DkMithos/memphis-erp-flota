/**
 * STORE DE COTIZACIONES DE COMPRA
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase/client';
import { dbCotizaciones } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import { validateTransition, COTIZACION_TRANSITIONS } from '../shared/state-machine';
import type {
  Cotizacion as CotizacionDB,
  CotizacionItem as CotizacionItemDB,
} from '../supabase/types';
import {
  generarIdCotizacion,
  extraerNumeroSecuencial,
  normalizeProveedorNombre,
  calcularTotales,
  DEBUG_COTIZACIONES,
  type EstadoCotizacion,
  type TipoCotizacion,
  type MonedaCotizacion,
  type RolUsuario
} from './cotizaciones-config';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface ItemCotizacion {
  id: string;
  _dbId?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
}

export interface Cotizacion {
  // Identificación — id = numero (COT-NNNN), _dbId = UUID interno
  id: string;
  _dbId: string;
  requerimientoId: string;

  // Proveedor
  proveedorId: string | null;
  proveedorNombre: string;

  // Clasificación
  tipo: TipoCotizacion;
  moneda: MonedaCotizacion;
  estado: EstadoCotizacion;

  // Validez
  validezDias: number;
  fechaEmision: string;
  fechaVencimiento: string;

  // Items
  items: ItemCotizacion[];

  // Totales
  subtotal: number;
  impuestos: number;
  total: number;

  // Términos
  terminos: string | null;
  observaciones: string | null;

  // Imputación dual
  proyectoId: string | null;
  centroCostoId: string | null;

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

export interface NuevaCotizacionInput {
  requerimientoId: string;
  requerimientoDbId?: string; // UUID from DB — preferred for FK
  proveedorId?: string | null;
  proveedorNombre: string;
  tipo: TipoCotizacion;
  moneda: MonedaCotizacion;
  validezDias: number;
  items: Omit<ItemCotizacion, 'id' | '_dbId' | 'subtotal'>[];
  terminos?: string;
  observaciones?: string;
}

export interface ActualizarCotizacionInput extends Partial<NuevaCotizacionInput> {}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface CotizacionStoreContext {
  cotizaciones: Cotizacion[];
  loading: boolean;
  obtenerCotizacionPorId: (id: string) => Cotizacion | undefined;
  obtenerCotizacionesPorRequerimiento: (requerimientoId: string) => Cotizacion[];
  crearCotizacion: (input: NuevaCotizacionInput) => Promise<CrudResult & { cotizacion?: Cotizacion }>;
  actualizarCotizacion: (id: string, input: ActualizarCotizacionInput) => Promise<CrudResult>;
  cambiarEstado: (id: string, nuevoEstado: EstadoCotizacion) => Promise<CrudResult>;
  aprobarCotizacion: (id: string, aprobadoPor: string) => Promise<CrudResult>;
  rechazarCotizacion: (id: string, rechazadoPor: string, motivo: string) => Promise<CrudResult>;
  anularCotizacion: (id: string, motivo: string) => Promise<CrudResult>;
  cargarCotizacionesIniciales: () => void;
  // Usuario actual derivado de auth
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const CotizacionContext = createContext<CotizacionStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

type CotizacionWithRelations = CotizacionDB & {
  items: CotizacionItemDB[];
  proveedor?: { razon_social: string; ruc: string } | null;
};

function mapFromDB(row: CotizacionWithRelations): Cotizacion {
  const items: ItemCotizacion[] = (row.items ?? []).map(item => ({
    id: item.id,
    _dbId: item.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    unidad: item.unidad,
    precioUnitario: item.precio_unitario,
    subtotal: item.precio_total,
  }));

  // Parse validez días from fecha_validez
  let validezDias = 30;
  if (row.fecha_validez) {
    const emision = new Date(row.fecha_emision);
    const validez = new Date(row.fecha_validez);
    const diff = Math.round((validez.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) validezDias = diff;
  }

  return {
    id: row.numero,
    _dbId: row.id,
    requerimientoId: row.requerimiento_id ?? '',
    proveedorId: row.proveedor_id,
    proveedorNombre: row.proveedor?.razon_social ?? '',
    tipo: 'bienes' as TipoCotizacion, // DB doesn't store tipo — default
    moneda: row.moneda as MonedaCotizacion,
    estado: row.estado as EstadoCotizacion,
    validezDias,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_validez ?? row.fecha_emision,
    items,
    subtotal: row.subtotal,
    impuestos: row.igv,
    total: row.total,
    terminos: row.condiciones_pago,
    observaciones: row.observaciones,
    proyectoId: row.proyecto_id ?? null,
    centroCostoId: row.centro_costo_id ?? null,
    aprobadoPor: row.aprobado_por ?? null,
    aprobadoEn: row.aprobado_en ?? null,
    rechazadoPor: row.rechazado_por ?? null,
    rechazadoEn: row.rechazado_en ?? null,
    motivoRechazo: row.motivo_rechazo ?? null,
    auditoria: {
      creadoPor: row.creado_por ?? '',
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
      anuladoPor: row.estado === 'anulada' ? row.modificado_por : null,
      anuladoEn: row.estado === 'anulada' ? row.modificado_en : null,
      motivoAnulacion: row.motivo_anulacion ?? null,
    },
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function CotizacionStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user, profile } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const cotizacionesRef = useRef(cotizaciones);
  useEffect(() => { cotizacionesRef.current = cotizaciones; }, [cotizaciones]);
  const [loading, setLoading] = useState(true);

  const usuarioActual = {
    email: user?.email ?? profile?.email ?? 'admin@kesa.com',
    nombre: profile ? `${profile.nombre} ${profile.apellido ?? ''}`.trim() : 'Usuario',
    rol: (profile?.rol as RolUsuario) ?? ('admin_empresa' as RolUsuario),
  };

  const fetchCotizaciones = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);

    try {
      const { data, error } = await dbCotizaciones.list();

      if (error) {
        console.error('[COTIZACIONES] Error al cargar:', error.message);
      } else if (data) {
        const mapped = (data as CotizacionWithRelations[]).map(mapFromDB);
        setCotizaciones(mapped);
        if (DEBUG_COTIZACIONES) {
          console.log('[COTIZACIONES] Cargadas desde Supabase:', mapped.length);
        }
      }
    } catch (err) {
      console.error('[COTIZACIONES] Error inesperado al cargar:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCotizaciones();
  }, [fetchCotizaciones]);

  const cargarCotizacionesIniciales = useCallback(() => {
    fetchCotizaciones();
  }, [fetchCotizaciones]);

  // ============================================================================
  // QUERIES
  // ============================================================================

  const obtenerCotizacionPorId = useCallback(
    // Acepta número (COT-0001, NC 0191-26…) o UUID interno — los enlaces desde
    // órdenes migradas referencian por _dbId.
    (id: string) => cotizaciones.find(c => c.id === id || c._dbId === id),
    [cotizaciones]
  );

  const obtenerCotizacionesPorRequerimiento = useCallback(
    (requerimientoId: string) => cotizaciones.filter(c => c.requerimientoId === requerimientoId),
    [cotizaciones]
  );

  // ============================================================================
  // HELPERS
  // ============================================================================

  const calcularFechaVencimiento = (fechaEmision: string, validezDias: number): string => {
    const fecha = new Date(fechaEmision);
    fecha.setDate(fecha.getDate() + validezDias);
    return fecha.toISOString();
  };

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearCotizacion = useCallback(
    async (input: NuevaCotizacionInput): Promise<CrudResult & { cotizacion?: Cotizacion }> => {
      if (!tenantId || !user) {
        return { exito: false, errores: ['Sin sesión activa'] };
      }

      // Determine proveedor_id: if proveedorId provided use it, otherwise we need an existing proveedor
      const proveedorDbId = input.proveedorId;
      if (!proveedorDbId) {
        return { exito: false, errores: ['Se requiere un proveedor válido con ID de BD'] };
      }

      const numeros = cotizaciones
        .map(c => extraerNumeroSecuencial(c.id))
        .filter((n): n is number => n !== null);
      const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
      const nuevoCodigo = generarIdCotizacion(ultimoNumero);

      const timestamp = new Date().toISOString();

      // Calculate items with subtotals
      const itemsConSubtotal = input.items.map(item => ({
        ...item,
        subtotal: item.cantidad * item.precioUnitario,
      }));

      const { subtotal, impuestos, total } = calcularTotales(
        itemsConSubtotal.map(i => ({ ...i, id: '', subtotal: i.subtotal }))
      );

      const fechaVencimiento = calcularFechaVencimiento(timestamp, input.validezDias);

      // Look up requerimiento _dbId from local state
      // input.requerimientoId is the display code like REQ-0001

      const { data: inserted, error: errCot } = await dbCotizaciones.create({
        tenant_id: tenantId,
        numero: nuevoCodigo,
        requerimiento_id: input.requerimientoDbId || input.requerimientoId || null, // Prefer UUID (_dbId); fall back to display code
        proveedor_id: proveedorDbId,
        estado: 'borrador' as EstadoCotizacion,
        fecha_emision: timestamp,
        fecha_validez: fechaVencimiento,
        moneda: input.moneda,
        subtotal,
        igv: impuestos,
        total,
        plazo_entrega: null,
        condiciones_pago: input.terminos?.trim() ?? null,
        observaciones: input.observaciones?.trim() ?? null,
        creado_por: user.id,
        modificado_por: null,
        modificado_en: null,
      });

      if (errCot || !inserted) {
        console.error('[COTIZACIONES] Error al crear:', errCot?.message);
        return { exito: false, errores: [errCot?.message ?? 'Error desconocido'] };
      }

      const dbRow = inserted as CotizacionDB;

      // Insert items en batch (atómico)
      const itemsPayload = itemsConSubtotal.map(item => ({
        tenant_id: tenantId,
        cotizacion_id: dbRow.id,
        descripcion: item.descripcion.trim(),
        unidad: item.unidad,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
      }));
      const { data: itemsData, error: errItems } = await supabase
        .from('cotizacion_items')
        .insert(itemsPayload)
        .select();
      if (errItems) {
        console.error('[COTIZACIONES] Error al crear items:', errItems.message);
      }
      const itemsInserted = (itemsData ?? []) as CotizacionItemDB[];

      const nueva = mapFromDB({ ...dbRow, items: itemsInserted, proveedor: { razon_social: normalizeProveedorNombre(input.proveedorNombre), ruc: '' } });
      setCotizaciones(prev => [nueva, ...prev]);

      if (DEBUG_COTIZACIONES) {
        console.log('[COT_CREATED]', { id: nueva.id, proveedor: nueva.proveedorNombre });
      }

      return { exito: true, cotizacion: nueva };
    },
    [cotizaciones, tenantId, user]
  );

  const actualizarCotizacion = useCallback(
    async (id: string, input: ActualizarCotizacionInput): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = cotizacionesRef.current.find(c => c.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Cotización no encontrada'] };

      const ahora = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        modificado_por: user.id,
        modificado_en: ahora,
      };

      if (input.moneda !== undefined) updatePayload.moneda = input.moneda;
      if (input.terminos !== undefined) updatePayload.condiciones_pago = input.terminos?.trim() ?? null;
      if (input.observaciones !== undefined) updatePayload.observaciones = input.observaciones?.trim() ?? null;
      if (input.validezDias !== undefined) {
        const cot = cotizaciones.find(c => c.id === id);
        if (cot) {
          updatePayload.fecha_validez = calcularFechaVencimiento(cot.fechaEmision, input.validezDias);
        }
      }

      if (input.items !== undefined) {
        const itemsConSubtotal = input.items.map(item => ({
          ...item,
          subtotal: item.cantidad * item.precioUnitario,
        }));
        const { subtotal, impuestos, total } = calcularTotales(
          itemsConSubtotal.map(i => ({ ...i, id: '', subtotal: i.subtotal }))
        );
        updatePayload.subtotal = subtotal;
        updatePayload.igv = impuestos;
        updatePayload.total = total;
      }

      const { error } = await dbCotizaciones.update(dbId, updatePayload);

      if (error) {
        console.error('[COTIZACIONES] Error al actualizar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      if (input.items !== undefined && tenantId) {
        await supabase.from('cotizacion_items').delete().eq('cotizacion_id', dbId);

        const itemsPayload = input.items.map(item => ({
          tenant_id: tenantId,
          cotizacion_id: dbId,
          descripcion: item.descripcion.trim(),
          unidad: item.unidad,
          cantidad: item.cantidad,
          precio_unitario: item.precioUnitario,
        }));
        const { data: newItemsData } = await supabase
          .from('cotizacion_items')
          .insert(itemsPayload)
          .select();
        const newItemsInserted = (newItemsData ?? []) as CotizacionItemDB[];

        setCotizaciones(prev =>
          prev.map(c => {
            if (c.id !== id) return c;
            const newItems: ItemCotizacion[] = newItemsInserted.map(dbItem => ({
              id: dbItem.id,
              _dbId: dbItem.id,
              descripcion: dbItem.descripcion,
              cantidad: dbItem.cantidad,
              unidad: dbItem.unidad,
              precioUnitario: dbItem.precio_unitario,
              subtotal: dbItem.precio_total,
            }));
            const { subtotal, impuestos, total } = calcularTotales(newItems);
            return {
              ...c,
              ...(input.moneda !== undefined && { moneda: input.moneda }),
              ...(input.validezDias !== undefined && { validezDias: input.validezDias }),
              ...(input.terminos !== undefined && { terminos: input.terminos?.trim() ?? null }),
              ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() ?? null }),
              items: newItems,
              subtotal,
              impuestos,
              total,
              auditoria: { ...c.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      } else {
        setCotizaciones(prev =>
          prev.map(c => {
            if (c.id !== id) return c;
            return {
              ...c,
              ...(input.moneda !== undefined && { moneda: input.moneda }),
              ...(input.validezDias !== undefined && { validezDias: input.validezDias }),
              ...(input.terminos !== undefined && { terminos: input.terminos?.trim() ?? null }),
              ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() ?? null }),
              auditoria: { ...c.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      }

      if (DEBUG_COTIZACIONES) {
        console.log('[COT_UPDATED]', { id, cambios: Object.keys(input) });
      }

      return { exito: true };
    },
    [cotizaciones, user, tenantId]
  );

  const cambiarEstado = useCallback(
    async (id: string, nuevoEstado: EstadoCotizacion): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      // Validar transición de estado
      const cotActual = cotizaciones.find(c => c.id === id);
      if (cotActual) {
        const check = validateTransition(cotActual.estado, nuevoEstado, COTIZACION_TRANSITIONS, `Cotización ${id}`);
        if (!check.valid) return { exito: false, errores: [check.error] };
      }

      const dbId = cotizacionesRef.current.find(c => c.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Cotización no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbCotizaciones.update(dbId, {
        estado: nuevoEstado,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[COTIZACIONES] Error al cambiar estado:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setCotizaciones(prev =>
        prev.map(c =>
          c.id === id
            ? { ...c, estado: nuevoEstado, auditoria: { ...c.auditoria, modificadoPor: user.id, modificadoEn: ahora } }
            : c
        )
      );

      return { exito: true };
    },
    [user]
  );

  const aprobarCotizacion = useCallback(
    async (id: string, aprobadoPor: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = cotizacionesRef.current.find(c => c.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Cotización no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbCotizaciones.update(dbId, {
        estado: 'aprobada' as EstadoCotizacion,
        aprobado_por: aprobadoPor,
        aprobado_en: ahora,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[COTIZACIONES] Error al aprobar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setCotizaciones(prev =>
        prev.map(c =>
          c.id === id
            ? {
                ...c,
                estado: 'aprobada' as EstadoCotizacion,
                aprobadoPor,
                aprobadoEn: ahora,
                auditoria: { ...c.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : c
        )
      );

      if (DEBUG_COTIZACIONES) {
        console.log('[COT_APPROVED]', { id, aprobadoPor });
      }

      return { exito: true };
    },
    [user]
  );

  const rechazarCotizacion = useCallback(
    async (id: string, rechazadoPor: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = cotizacionesRef.current.find(c => c.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Cotización no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbCotizaciones.update(dbId, {
        estado: 'rechazada' as EstadoCotizacion,
        rechazado_por: rechazadoPor,
        rechazado_en: ahora,
        motivo_rechazo: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[COTIZACIONES] Error al rechazar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setCotizaciones(prev =>
        prev.map(c =>
          c.id === id
            ? {
                ...c,
                estado: 'rechazada' as EstadoCotizacion,
                rechazadoPor,
                rechazadoEn: ahora,
                motivoRechazo: motivo.trim(),
                auditoria: { ...c.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : c
        )
      );

      return { exito: true };
    },
    [user]
  );

  const anularCotizacion = useCallback(
    async (id: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = cotizacionesRef.current.find(c => c.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Cotización no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbCotizaciones.update(dbId, {
        estado: 'anulada' as EstadoCotizacion,
        motivo_anulacion: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[COTIZACIONES] Error al anular:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setCotizaciones(prev =>
        prev.map(c =>
          c.id === id
            ? {
                ...c,
                estado: 'anulada' as EstadoCotizacion,
                auditoria: {
                  ...c.auditoria,
                  modificadoPor: user.id,
                  modificadoEn: ahora,
                  anuladoPor: user.id,
                  anuladoEn: ahora,
                  motivoAnulacion: motivo.trim(),
                },
              }
            : c
        )
      );

      return { exito: true };
    },
    [user]
  );

  const value: CotizacionStoreContext = {
    cotizaciones,
    loading,
    obtenerCotizacionPorId,
    obtenerCotizacionesPorRequerimiento,
    crearCotizacion,
    actualizarCotizacion,
    cambiarEstado,
    aprobarCotizacion,
    rechazarCotizacion,
    anularCotizacion,
    cargarCotizacionesIniciales,
    usuarioActual,
  };

  return <CotizacionContext.Provider value={value}>{children}</CotizacionContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCotizacionesStore() {
  const context = useContext(CotizacionContext);
  if (!context) {
    throw new Error('useCotizacionesStore debe usarse dentro de CotizacionStoreProvider');
  }
  return context;
}
