/**
 * STORE DE ÓRDENES DE COMPRA Y SERVICIO
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase/client';
import { dbOrdenesCompra } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import { validateTransition, ORDEN_TRANSITIONS } from '../shared/state-machine';
import { solicitarAprobacionTeams } from './solicitar-aprobacion';
import type {
  OrdenCompra as OrdenCompraDB,
  OrdenItem as OrdenItemDB,
} from '../supabase/types';
import {
  generarIdOrden,
  extraerNumeroSecuencial,
  calcularTotales,
  DEBUG_ORDENES,
  type TipoOrden,
  type EstadoOrden,
  type MonedaOrden,
  type RolUsuario
} from './ordenes-config';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface ItemOrden {
  id: string;
  _dbId?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
}

export interface Orden {
  // Identificación — id = numero (OC/OS-NNNN), _dbId = UUID interno
  id: string;
  _dbId: string;
  tipo: TipoOrden;
  estado: EstadoOrden;

  // Relaciones
  cotizacionId: string;
  requerimientoId: string | null;

  // Proveedor
  proveedorNombre: string;

  // Clasificación
  moneda: MonedaOrden;

  // Fechas
  fechaEmision: string;
  fechaEntregaEstimada: string | null;

  // Items
  items: ItemOrden[];

  // Totales
  subtotal: number;
  impuestos: number;
  total: number;

  // Condiciones
  condiciones: string | null;

  // Aprobación
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  rechazadoPor: string | null;
  rechazadoEn: string | null;
  motivoRechazo: string | null;

  // Imputación dual
  proyectoId: string | null;
  centroCostoId: string | null;

  // Control de ejecución
  enEjecucionDesde: string | null;

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

export interface NuevaOrdenInput {
  tipo: TipoOrden;
  cotizacionId: string;
  requerimientoId?: string | null;
  proveedorNombre: string;
  moneda: MonedaOrden;
  items: Omit<ItemOrden, 'id' | '_dbId' | 'subtotal'>[];
  fechaEntregaEstimada?: string;
  condiciones?: string;
  // DB FK: proveedor UUID and cotizacion UUID must be provided from calling context
  proveedorDbId?: string;
  cotizacionDbId?: string;
}

export interface ActualizarOrdenInput extends Partial<NuevaOrdenInput> {}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface OrdenStoreContext {
  ordenes: Orden[];
  loading: boolean;
  obtenerOrdenPorId: (id: string) => Orden | undefined;
  obtenerOrdenesPorCotizacion: (cotizacionId: string) => Orden[];
  crearOrdenDesdeCotizacion: (input: NuevaOrdenInput) => Promise<CrudResult & { orden?: Orden }>;
  actualizarOrden: (id: string, input: ActualizarOrdenInput) => Promise<CrudResult>;
  cambiarEstado: (id: string, nuevoEstado: EstadoOrden) => Promise<CrudResult>;
  aprobarOrden: (id: string, aprobadoPor: string) => Promise<CrudResult>;
  rechazarOrden: (id: string, rechazadoPor: string, motivo: string) => Promise<CrudResult>;
  marcarEnEjecucion: (id: string) => Promise<CrudResult>;
  anularOrden: (id: string, motivo: string) => Promise<CrudResult>;
  aplicarEstadoRecepcion: (ordenId: string, esCompleta: boolean) => Promise<CrudResult>;
  cargarOrdenesIniciales: () => void;
  // Usuario actual derivado de auth
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const OrdenContext = createContext<OrdenStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

type OrdenWithRelations = OrdenCompraDB & {
  items: OrdenItemDB[];
  proveedor?: { razon_social: string; ruc: string } | null;
};

function mapFromDB(row: OrdenWithRelations): Orden {
  const items: ItemOrden[] = (row.items ?? []).map(item => ({
    id: item.id,
    _dbId: item.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    unidad: item.unidad,
    precioUnitario: item.precio_unitario,
    subtotal: item.precio_total,
  }));

  // Derive estado mapping: DB states differ from frontend states
  // DB: 'borrador' | 'enviada' | 'aprobada' | 'recibida_parcial' | 'recibida_total' | 'anulada'
  // Frontend: borrador | pendiente_aprobacion | aprobada | en_ejecucion | recepcion_parcial | recepcion_completa | anulada
  const estadoMap: Record<string, EstadoOrden> = {
    borrador: 'borrador',
    enviada: 'pendiente_aprobacion',
    aprobada: 'aprobada',
    recibida_parcial: 'recepcion_parcial',
    recibida_total: 'recepcion_completa',
    anulada: 'anulada',
  };

  // Si estado DB es 'aprobada' pero tiene en_ejecucion_desde, es en_ejecucion en frontend
  let estadoFrontend = estadoMap[row.estado] ?? ('borrador' as EstadoOrden);
  if (row.estado === 'aprobada' && row.en_ejecucion_desde) {
    estadoFrontend = 'en_ejecucion' as EstadoOrden;
  }

  return {
    id: row.numero,
    _dbId: row.id,
    tipo: row.tipo as TipoOrden,
    estado: estadoFrontend,
    cotizacionId: row.cotizacion_id ?? '',
    requerimientoId: null, // Not stored directly on orden; derive from cotizacion if needed
    proveedorNombre: row.proveedor?.razon_social ?? '',
    moneda: row.moneda as MonedaOrden,
    fechaEmision: row.fecha_emision,
    fechaEntregaEstimada: row.fecha_entrega_esperada,
    items,
    subtotal: row.subtotal,
    impuestos: row.igv,
    total: row.total,
    condiciones: row.condiciones_pago,
    proyectoId: row.proyecto_id ?? null,
    centroCostoId: row.centro_costo_id ?? null,
    aprobadoPor: row.aprobado_por,
    aprobadoEn: row.aprobado_en,
    rechazadoPor: row.rechazado_por ?? null,
    rechazadoEn: row.rechazado_en ?? null,
    motivoRechazo: row.motivo_rechazo ?? null,
    enEjecucionDesde: row.en_ejecucion_desde ?? null,
    auditoria: {
      creadoPor: row.creado_por ?? '',
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
      anuladoPor: row.estado === 'anulada' ? row.modificado_por : null,
      anuladoEn: row.estado === 'anulada' ? row.modificado_en : null,
      motivoAnulacion: row.motivo_anulacion,
    },
  };
}

// Map frontend estado back to DB estado
function estadoFrontendToDb(estadoFrontend: EstadoOrden): string {
  const map: Record<EstadoOrden, string> = {
    borrador: 'borrador',
    pendiente_aprobacion: 'enviada',
    aprobada: 'aprobada',
    en_ejecucion: 'aprobada', // DB doesn't have en_ejecucion
    recepcion_parcial: 'recibida_parcial',
    recepcion_completa: 'recibida_total',
    anulada: 'anulada',
  };
  return map[estadoFrontend] ?? 'borrador';
}

// ============================================================================
// PROVIDER
// ============================================================================

export function OrdenStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user, profile } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const ordenesRef = useRef(ordenes);
  useEffect(() => { ordenesRef.current = ordenes; }, [ordenes]);
  const [loading, setLoading] = useState(true);

  const usuarioActual = {
    email: user?.email ?? profile?.email ?? 'admin@kesa.com',
    nombre: profile ? `${profile.nombre} ${profile.apellido ?? ''}`.trim() : 'Usuario',
    rol: (profile?.rol as RolUsuario) ?? ('admin_sistemas' as RolUsuario),
  };

  const fetchOrdenes = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);

    try {
      const { data, error } = await dbOrdenesCompra.list();

      if (error) {
        console.error('[ORDENES] Error al cargar:', error.message);
      } else if (data) {
        const mapped = (data as OrdenWithRelations[]).map(mapFromDB);
        setOrdenes(mapped);
        if (DEBUG_ORDENES) {
          console.log('[ORDENES] Cargadas desde Supabase:', mapped.length);
        }
      }
    } catch (err) {
      console.error('[ORDENES] Error inesperado al cargar:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  const cargarOrdenesIniciales = useCallback(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  // ============================================================================
  // QUERIES
  // ============================================================================

  const obtenerOrdenPorId = useCallback(
    (id: string) => ordenes.find(o => o.id === id),
    [ordenes]
  );

  const obtenerOrdenesPorCotizacion = useCallback(
    (cotizacionId: string) => ordenes.filter(o => o.cotizacionId === cotizacionId),
    [ordenes]
  );

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearOrdenDesdeCotizacion = useCallback(
    async (input: NuevaOrdenInput): Promise<CrudResult & { orden?: Orden }> => {
      if (!tenantId || !user) {
        return { exito: false, errores: ['Sin sesión activa'] };
      }

      const proveedorDbId = input.proveedorDbId;
      if (!proveedorDbId) {
        return { exito: false, errores: ['Se requiere un proveedor válido con ID de BD'] };
      }

      const numeros = ordenes
        .filter(o => o.tipo === input.tipo)
        .map(o => extraerNumeroSecuencial(o.id))
        .filter((n): n is number => n !== null);
      const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
      const nuevoCodigo = generarIdOrden(input.tipo, ultimoNumero);

      const timestamp = new Date().toISOString();

      const itemsConSubtotal = input.items.map(item => ({
        ...item,
        subtotal: item.cantidad * item.precioUnitario,
      }));

      const { subtotal, impuestos, total } = calcularTotales(
        itemsConSubtotal.map(i => ({ ...i, id: '', subtotal: i.subtotal }))
      );

      const { data: inserted, error: errOrd } = await dbOrdenesCompra.create({
        tenant_id: tenantId,
        numero: nuevoCodigo,
        tipo: input.tipo,
        cotizacion_id: input.cotizacionDbId ?? null,
        proveedor_id: proveedorDbId,
        estado: 'borrador',
        fecha_emision: timestamp,
        fecha_entrega_esperada: input.fechaEntregaEstimada ?? null,
        moneda: input.moneda,
        subtotal,
        igv: impuestos,
        total,
        condiciones_pago: input.condiciones?.trim() ?? null,
        lugar_entrega: null,
        observaciones: null,
        aprobado_por: null,
        aprobado_en: null,
        motivo_anulacion: null,
        creado_por: user.id,
        modificado_por: null,
        modificado_en: null,
      });

      if (errOrd || !inserted) {
        console.error('[ORDENES] Error al crear:', errOrd?.message);
        return { exito: false, errores: [errOrd?.message ?? 'Error desconocido'] };
      }

      const dbRow = inserted as OrdenCompraDB;

      // Insert items en batch (atómico)
      const itemsPayload = itemsConSubtotal.map(item => ({
        tenant_id: tenantId,
        orden_id: dbRow.id,
        descripcion: item.descripcion.trim(),
        unidad: item.unidad,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
      }));
      const { data: itemsData, error: errItems } = await supabase
        .from('orden_items')
        .insert(itemsPayload)
        .select();
      if (errItems) {
        console.error('[ORDENES] Error al crear items:', errItems.message);
      }
      const itemsInserted = (itemsData ?? []) as OrdenItemDB[];

      const nueva = mapFromDB({
        ...dbRow,
        items: itemsInserted,
        proveedor: { razon_social: input.proveedorNombre, ruc: '' },
      });
      nueva.requerimientoId = input.requerimientoId ?? null;
      nueva.cotizacionId = input.cotizacionId; // display code
      setOrdenes(prev => [nueva, ...prev]);

      if (DEBUG_ORDENES) {
        console.log('[ORD_CREATED]', { id: nueva.id, tipo: nueva.tipo, total: nueva.total });
      }

      return { exito: true, orden: nueva };
    },
    [ordenes, tenantId, user]
  );

  const actualizarOrden = useCallback(
    async (id: string, input: ActualizarOrdenInput): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = ordenesRef.current.find(o => o.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const ahora = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        modificado_por: user.id,
        modificado_en: ahora,
      };

      if (input.moneda !== undefined) updatePayload.moneda = input.moneda;
      if (input.condiciones !== undefined) updatePayload.condiciones_pago = input.condiciones?.trim() ?? null;
      if (input.fechaEntregaEstimada !== undefined) updatePayload.fecha_entrega_esperada = input.fechaEntregaEstimada ?? null;

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

      const { error } = await dbOrdenesCompra.update(dbId, updatePayload);

      if (error) {
        console.error('[ORDENES] Error al actualizar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      if (input.items !== undefined && tenantId) {
        await supabase.from('orden_items').delete().eq('orden_id', dbId);

        const itemsPayload = input.items.map(item => ({
          tenant_id: tenantId,
          orden_id: dbId,
          descripcion: item.descripcion.trim(),
          unidad: item.unidad,
          cantidad: item.cantidad,
          precio_unitario: item.precioUnitario,
        }));
        const { data: newItemsData } = await supabase
          .from('orden_items')
          .insert(itemsPayload)
          .select();
        const newItemsInserted = (newItemsData ?? []) as OrdenItemDB[];

        setOrdenes(prev =>
          prev.map(o => {
            if (o.id !== id) return o;
            const newItems: ItemOrden[] = newItemsInserted.map(dbItem => ({
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
              ...o,
              ...(input.moneda !== undefined && { moneda: input.moneda }),
              ...(input.condiciones !== undefined && { condiciones: input.condiciones?.trim() ?? null }),
              ...(input.fechaEntregaEstimada !== undefined && { fechaEntregaEstimada: input.fechaEntregaEstimada ?? null }),
              items: newItems,
              subtotal,
              impuestos,
              total,
              auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      } else {
        setOrdenes(prev =>
          prev.map(o => {
            if (o.id !== id) return o;
            return {
              ...o,
              ...(input.moneda !== undefined && { moneda: input.moneda }),
              ...(input.condiciones !== undefined && { condiciones: input.condiciones?.trim() ?? null }),
              ...(input.fechaEntregaEstimada !== undefined && { fechaEntregaEstimada: input.fechaEntregaEstimada ?? null }),
              auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora },
            };
          })
        );
      }

      if (DEBUG_ORDENES) {
        console.log('[ORD_UPDATED]', { id, cambios: Object.keys(input) });
      }

      return { exito: true };
    },
    [user, tenantId]
  );

  const cambiarEstado = useCallback(
    async (id: string, nuevoEstado: EstadoOrden): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      // Validar transición de estado
      const ordActual = ordenes.find(o => o.id === id);
      if (ordActual) {
        const check = validateTransition(ordActual.estado, nuevoEstado, ORDEN_TRANSITIONS, `Orden ${id}`);
        if (!check.valid) return { exito: false, errores: [check.error] };
      }

      const dbId = ordenesRef.current.find(o => o.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbOrdenesCompra.update(dbId, {
        estado: estadoFrontendToDb(nuevoEstado),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[ORDENES] Error al cambiar estado:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setOrdenes(prev =>
        prev.map(o =>
          o.id === id
            ? { ...o, estado: nuevoEstado, auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora } }
            : o
        )
      );

      // Al enviar a aprobación → solicitar aprobación vía Teams (no bloquea)
      if (nuevoEstado === 'pendiente_aprobacion' && ordActual) {
        void solicitarAprobacionTeams({
          modulo: 'orden_compra',
          entidadId: dbId,
          numero: ordActual.id,
          titulo: ordActual.proveedorNombre,
          monto: ordActual.total,
          moneda: ordActual.moneda as 'PEN' | 'USD',
        });
      }

      return { exito: true };
    },
    [user, ordenes]
  );

  const aprobarOrden = useCallback(
    async (id: string, aprobadoPor: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = ordenesRef.current.find(o => o.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbOrdenesCompra.update(dbId, {
        estado: 'aprobada',
        aprobado_por: aprobadoPor,
        aprobado_en: ahora,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[ORDENES] Error al aprobar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setOrdenes(prev =>
        prev.map(o =>
          o.id === id
            ? {
                ...o,
                estado: 'aprobada' as EstadoOrden,
                aprobadoPor,
                aprobadoEn: ahora,
                auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : o
        )
      );

      if (DEBUG_ORDENES) {
        console.log('[ORD_APPROVED]', { id, aprobadoPor });
      }

      return { exito: true };
    },
    [user]
  );

  const rechazarOrden = useCallback(
    async (id: string, rechazadoPor: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = ordenesRef.current.find(o => o.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbOrdenesCompra.update(dbId, {
        estado: 'rechazada', // rejected state
        rechazado_por: rechazadoPor,
        rechazado_en: ahora,
        motivo_rechazo: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[ORDENES] Error al rechazar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setOrdenes(prev =>
        prev.map(o =>
          o.id === id
            ? {
                ...o,
                estado: 'rechazada' as EstadoOrden,
                rechazadoPor,
                rechazadoEn: ahora,
                motivoRechazo: motivo.trim(),
                auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : o
        )
      );

      return { exito: true };
    },
    [user]
  );

  const marcarEnEjecucion = useCallback(
    async (id: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = ordenesRef.current.find(o => o.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const ahora = new Date().toISOString();
      // Map en_ejecucion to aprobada in DB (DB doesn't have en_ejecucion)
      const { error } = await dbOrdenesCompra.update(dbId, {
        estado: 'aprobada',
        en_ejecucion_desde: ahora,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[ORDENES] Error al marcar en ejecución:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setOrdenes(prev =>
        prev.map(o =>
          o.id === id
            ? {
                ...o,
                estado: 'en_ejecucion' as EstadoOrden,
                enEjecucionDesde: ahora,
                auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora },
              }
            : o
        )
      );

      return { exito: true };
    },
    [user]
  );

  const anularOrden = useCallback(
    async (id: string, motivo: string): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = ordenesRef.current.find(o => o.id === id)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const ahora = new Date().toISOString();
      const { error } = await dbOrdenesCompra.update(dbId, {
        estado: 'anulada',
        motivo_anulacion: motivo.trim(),
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[ORDENES] Error al anular:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setOrdenes(prev =>
        prev.map(o =>
          o.id === id
            ? {
                ...o,
                estado: 'anulada' as EstadoOrden,
                auditoria: {
                  ...o.auditoria,
                  modificadoPor: user.id,
                  modificadoEn: ahora,
                  anuladoPor: user.id,
                  anuladoEn: ahora,
                  motivoAnulacion: motivo.trim(),
                },
              }
            : o
        )
      );

      return { exito: true };
    },
    [user]
  );

  const aplicarEstadoRecepcion = useCallback(
    async (ordenId: string, esCompleta: boolean): Promise<CrudResult> => {
      if (!user) return { exito: false, errores: ['Sin sesión activa'] };

      const dbId = ordenesRef.current.find(o => o.id === ordenId)?._dbId;
      if (!dbId) return { exito: false, errores: ['Orden no encontrada'] };

      const nuevoEstado: EstadoOrden = esCompleta ? 'recepcion_completa' : 'recepcion_parcial';
      const dbEstado = esCompleta ? 'recibida_total' : 'recibida_parcial';
      const ahora = new Date().toISOString();

      const { error } = await dbOrdenesCompra.update(dbId, {
        estado: dbEstado,
        modificado_por: user.id,
        modificado_en: ahora,
      });

      if (error) {
        console.error('[ORDENES] Error al aplicar estado recepción:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setOrdenes(prev =>
        prev.map(o =>
          o.id === ordenId
            ? { ...o, estado: nuevoEstado, auditoria: { ...o.auditoria, modificadoPor: user.id, modificadoEn: ahora } }
            : o
        )
      );

      if (DEBUG_ORDENES) {
        console.log('[ORD_RECEPCION_APLICADA]', { ordenId, nuevoEstado });
      }

      return { exito: true };
    },
    [user]
  );

  const value: OrdenStoreContext = {
    ordenes,
    loading,
    obtenerOrdenPorId,
    obtenerOrdenesPorCotizacion,
    crearOrdenDesdeCotizacion,
    actualizarOrden,
    cambiarEstado,
    aprobarOrden,
    rechazarOrden,
    marcarEnEjecucion,
    anularOrden,
    aplicarEstadoRecepcion,
    cargarOrdenesIniciales,
    usuarioActual,
  };

  return <OrdenContext.Provider value={value}>{children}</OrdenContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOrdenesStore() {
  const context = useContext(OrdenContext);
  if (!context) {
    throw new Error('useOrdenesStore debe usarse dentro de OrdenStoreProvider');
  }
  return context;
}
