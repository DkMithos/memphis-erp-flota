/**
 * STORE DE ÓRDENES DE COMPRA Y SERVICIO
 * Context global para gestión de órdenes en el módulo Compras
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
// TIPOS
// ============================================================================

export interface ItemOrden {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number; // Calculado
}

export interface Orden {
  // Identificación
  id: string;
  tipo: TipoOrden;
  estado: EstadoOrden;
  
  // Relaciones
  cotizacionId: string; // Requerido - relación con Cotización
  requerimientoId: string | null; // Derivado desde cotización
  
  // Proveedor
  proveedorNombre: string;
  
  // Clasificación
  moneda: MonedaOrden;
  
  // Fechas
  fechaEmision: string; // ISO date
  fechaEntregaEstimada: string | null; // ISO date
  
  // Items
  items: ItemOrden[];
  
  // Totales
  subtotal: number; // Calculado
  impuestos: number; // Calculado (18% IGV)
  total: number; // Calculado
  
  // Condiciones
  condiciones: string | null;
  
  // Aprobación/Rechazo
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  rechazadoPor: string | null;
  rechazadoEn: string | null;
  motivoRechazo: string | null;
  
  // Control de ejecución
  enEjecucionDesde: string | null;
  
  // Auditoría obligatoria
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
  items: Omit<ItemOrden, 'id' | 'subtotal'>[];
  fechaEntregaEstimada?: string;
  condiciones?: string;
}

export interface ActualizarOrdenInput extends Partial<NuevaOrdenInput> {
  // Solo campos editables
}

interface OrdenStoreContext {
  ordenes: Orden[];
  obtenerOrdenPorId: (id: string) => Orden | undefined;
  obtenerOrdenesPorCotizacion: (cotizacionId: string) => Orden[];
  crearOrdenDesdeCotizacion: (input: NuevaOrdenInput) => Orden;
  actualizarOrden: (id: string, input: ActualizarOrdenInput) => void;
  cambiarEstado: (id: string, nuevoEstado: EstadoOrden) => void;
  aprobarOrden: (id: string, aprobadoPor: string) => void;
  rechazarOrden: (id: string, rechazadoPor: string, motivo: string) => void;
  marcarEnEjecucion: (id: string) => void;
  anularOrden: (id: string, motivo: string) => void;
  aplicarEstadoRecepcion: (ordenId: string, esCompleta: boolean) => void;
  cargarOrdenesIniciales: () => void;
  // Mock de usuario actual
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const OrdenContext = createContext<OrdenStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const ordenesSeed: Orden[] = [
  {
    id: 'OC-0001',
    tipo: 'oc',
    estado: 'aprobada',
    cotizacionId: 'COT-0002',
    requerimientoId: 'REQ-0001',
    proveedorNombre: 'Autopartes Premium EIRL',
    moneda: 'PEN',
    fechaEmision: '2025-01-04T11:00:00Z',
    fechaEntregaEstimada: '2025-01-11T11:00:00Z',
    items: [
      {
        id: 'item-1',
        descripcion: 'Pastillas de freno delanteras marca ACDelco',
        cantidad: 2,
        unidad: 'juego',
        precioUnitario: 340,
        subtotal: 680
      },
      {
        id: 'item-2',
        descripcion: 'Filtro de aceite',
        cantidad: 4,
        unidad: 'unidad',
        precioUnitario: 42,
        subtotal: 168
      },
      {
        id: 'item-3',
        descripcion: 'Aceite sintético Mobil 1 5W-30',
        cantidad: 8,
        unidad: 'litro',
        precioUnitario: 62,
        subtotal: 496
      }
    ],
    subtotal: 1344,
    impuestos: 241.92,
    total: 1585.92,
    condiciones: 'Pago a 30 días. Garantía 1 año en repuestos. Entrega en almacén central.',
    aprobadoPor: 'gerencia@kesa.com',
    aprobadoEn: '2025-01-04T14:00:00Z',
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    enEjecucionDesde: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-04T11:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'OC-0002',
    tipo: 'oc',
    estado: 'recepcion_parcial',
    cotizacionId: 'COT-0003',
    requerimientoId: 'REQ-0002',
    proveedorNombre: 'Equipos Médicos del Perú SA',
    moneda: 'USD',
    fechaEmision: '2025-01-04T12:00:00Z',
    fechaEntregaEstimada: '2025-01-20T12:00:00Z',
    items: [
      {
        id: 'item-1',
        descripcion: 'Monitor multiparamétrico GE Healthcare CARESCAPE B650',
        cantidad: 1,
        unidad: 'unidad',
        precioUnitario: 3200,
        subtotal: 3200
      },
      {
        id: 'item-2',
        descripcion: 'Cables ECG 5 derivaciones',
        cantidad: 2,
        unidad: 'juego',
        precioUnitario: 115,
        subtotal: 230
      }
    ],
    subtotal: 3430,
    impuestos: 617.40,
    total: 4047.40,
    condiciones: 'Pago 50% adelanto, 50% contraentrega. Garantía 2 años. Incluye capacitación.',
    aprobadoPor: 'gerencia@kesa.com',
    aprobadoEn: '2025-01-04T15:00:00Z',
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    enEjecucionDesde: '2025-01-04T16:00:00Z',
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-04T12:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'OS-0001',
    tipo: 'os',
    estado: 'pendiente_aprobacion',
    cotizacionId: 'COT-0004',
    requerimientoId: 'REQ-0003',
    proveedorNombre: 'Distribuidora Microsoft Perú',
    moneda: 'USD',
    fechaEmision: '2025-01-05T13:00:00Z',
    fechaEntregaEstimada: null,
    items: [
      {
        id: 'item-1',
        descripcion: 'Licencia Office 365 Business Premium - Renovación anual',
        cantidad: 50,
        unidad: 'licencia',
        precioUnitario: 48,
        subtotal: 2400
      }
    ],
    subtotal: 2400,
    impuestos: 432,
    total: 2832,
    condiciones: 'Pago anual anticipado. Soporte técnico incluido durante 1 año.',
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    enEjecucionDesde: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-05T13:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'OC-0003',
    tipo: 'oc',
    estado: 'anulada',
    cotizacionId: 'COT-0005',
    requerimientoId: 'REQ-0005',
    proveedorNombre: 'Herramientas Industriales SAC',
    moneda: 'PEN',
    fechaEmision: '2025-01-02T10:00:00Z',
    fechaEntregaEstimada: '2025-01-10T10:00:00Z',
    items: [
      {
        id: 'item-1',
        descripcion: 'Juego de llaves combinadas métricas Stanley',
        cantidad: 2,
        unidad: 'juego',
        precioUnitario: 920,
        subtotal: 1840
      }
    ],
    subtotal: 1840,
    impuestos: 331.20,
    total: 2171.20,
    condiciones: 'Pago contraentrega.',
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    enEjecucionDesde: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-02T10:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: 'admin@kesa.com',
      anuladoEn: '2025-01-02T11:30:00Z',
      motivoAnulacion: 'Orden anulada porque la cotización COT-0005 fue rechazada y el requerimiento REQ-0005 fue cancelado por duplicidad. No procede la compra.'
    }
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function OrdenStoreProvider({ children }: { children: React.ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  
  // Mock de usuario actual
  const usuarioActual = {
    email: 'admin@kesa.com',
    nombre: 'Administrador',
    rol: 'admin_sistemas' as RolUsuario
  };

  // Cargar órdenes iniciales SOLO una vez al montar
  useEffect(() => {
    if (ordenes.length === 0) {
      if (DEBUG_ORDENES) {
        console.log('[ORD_SEED_LOADING]', { seedSize: ordenesSeed.length });
      }
      setOrdenes(ordenesSeed);
    }
  }, []);

  // Cargar órdenes iniciales (con guard idempotente)
  const cargarOrdenesIniciales = useCallback(() => {
    if (ordenes.length === 0) {
      if (DEBUG_ORDENES) {
        console.log('[ORD_SEED_MANUAL_LOADING]', { seedSize: ordenesSeed.length });
      }
      setOrdenes(ordenesSeed);
    } else if (DEBUG_ORDENES) {
      console.log('[ORD_SEED_SKIP]', { 
        reason: 'Ya hay órdenes en el store', 
        currentSize: ordenes.length 
      });
    }
  }, [ordenes.length]);

  // Obtener orden por ID
  const obtenerOrdenPorId = useCallback((id: string) => {
    return ordenes.find(o => o.id === id);
  }, [ordenes]);

  // Obtener órdenes por cotización
  const obtenerOrdenesPorCotizacion = useCallback((cotizacionId: string) => {
    return ordenes.filter(o => o.cotizacionId === cotizacionId);
  }, [ordenes]);

  // Crear nueva orden desde cotización
  const crearOrdenDesdeCotizacion = useCallback((input: NuevaOrdenInput): Orden => {
    // Obtener el último número secuencial para el tipo de orden
    const numeros = ordenes
      .filter(o => o.tipo === input.tipo)
      .map(o => extraerNumeroSecuencial(o.id))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo ID
    const id = generarIdOrden(input.tipo, ultimoNumero);
    const timestamp = new Date().toISOString();

    // Generar items con IDs y subtotales
    const items: ItemOrden[] = input.items.map((item, idx) => ({
      ...item,
      id: `item-${idx + 1}`,
      subtotal: item.cantidad * item.precioUnitario
    }));

    // Calcular totales
    const { subtotal, impuestos, total } = calcularTotales(items);

    // Crear objeto orden
    const nuevaOrden: Orden = {
      id,
      tipo: input.tipo,
      estado: 'borrador',
      cotizacionId: input.cotizacionId,
      requerimientoId: input.requerimientoId || null,
      proveedorNombre: input.proveedorNombre,
      moneda: input.moneda,
      fechaEmision: timestamp,
      fechaEntregaEstimada: input.fechaEntregaEstimada || null,
      items,
      subtotal,
      impuestos,
      total,
      condiciones: input.condiciones?.trim() || null,
      aprobadoPor: null,
      aprobadoEn: null,
      rechazadoPor: null,
      rechazadoEn: null,
      motivoRechazo: null,
      enEjecucionDesde: null,
      auditoria: {
        creadoPor: usuarioActual.email,
        creadoEn: timestamp,
        modificadoPor: null,
        modificadoEn: null,
        anuladoPor: null,
        anuladoEn: null,
        motivoAnulacion: null
      }
    };

    // Agregar al INICIO del store
    setOrdenes(prev => {
      const newState = [nuevaOrden, ...prev];
      
      if (DEBUG_ORDENES) {
        console.log('[ORD_CREATED]', {
          id: nuevaOrden.id,
          tipo: nuevaOrden.tipo,
          cotizacionId: nuevaOrden.cotizacionId,
          proveedor: nuevaOrden.proveedorNombre,
          total: nuevaOrden.total,
          sizeAfter: newState.length
        });
      }
      
      return newState;
    });

    return nuevaOrden;
  }, [ordenes, usuarioActual.email]);

  // Actualizar orden
  const actualizarOrden = useCallback((id: string, input: ActualizarOrdenInput) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === id) {
        // Recalcular items si cambiaron
        let items = o.items;
        let subtotal = o.subtotal;
        let impuestos = o.impuestos;
        let total = o.total;
        
        if (input.items) {
          items = input.items.map((item, idx) => ({
            ...item,
            id: `item-${idx + 1}`,
            subtotal: item.cantidad * item.precioUnitario
          }));
          const totales = calcularTotales(items);
          subtotal = totales.subtotal;
          impuestos = totales.impuestos;
          total = totales.total;
        }

        const actualizado: Orden = {
          ...o,
          ...(input.proveedorNombre && { proveedorNombre: input.proveedorNombre }),
          ...(input.moneda && { moneda: input.moneda }),
          ...(input.fechaEntregaEstimada !== undefined && { fechaEntregaEstimada: input.fechaEntregaEstimada }),
          ...(input.condiciones !== undefined && { condiciones: input.condiciones?.trim() || null }),
          items,
          subtotal,
          impuestos,
          total,
          auditoria: {
            ...o.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_UPDATED]', {
            id: actualizado.id,
            cambios: Object.keys(input)
          });
        }

        return actualizado;
      }
      return o;
    }));
  }, [usuarioActual.email]);

  // Cambiar estado
  const cambiarEstado = useCallback((id: string, nuevoEstado: EstadoOrden) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === id) {
        const actualizado: Orden = {
          ...o,
          estado: nuevoEstado,
          auditoria: {
            ...o.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_ESTADO_CHANGED]', {
            id: actualizado.id,
            estadoAnterior: o.estado,
            estadoNuevo: nuevoEstado
          });
        }

        return actualizado;
      }
      return o;
    }));
  }, [usuarioActual.email]);

  // Aprobar orden
  const aprobarOrden = useCallback((id: string, aprobadoPor: string) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === id) {
        const aprobado: Orden = {
          ...o,
          estado: 'aprobada',
          aprobadoPor,
          aprobadoEn: timestamp,
          auditoria: {
            ...o.auditoria,
            modificadoPor: aprobadoPor,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_APPROVED]', {
            id: aprobado.id,
            aprobadoPor
          });
        }

        return aprobado;
      }
      return o;
    }));
  }, []);

  // Rechazar orden
  const rechazarOrden = useCallback((id: string, rechazadoPor: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === id) {
        // Rechazar orden significa volver a borrador (para que pueda editarse)
        const rechazado: Orden = {
          ...o,
          estado: 'borrador',
          rechazadoPor,
          rechazadoEn: timestamp,
          motivoRechazo: motivo.trim(),
          auditoria: {
            ...o.auditoria,
            modificadoPor: rechazadoPor,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_REJECTED]', {
            id: rechazado.id,
            rechazadoPor,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return rechazado;
      }
      return o;
    }));
  }, []);

  // Marcar en ejecución
  const marcarEnEjecucion = useCallback((id: string) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === id) {
        const enEjecucion: Orden = {
          ...o,
          estado: 'en_ejecucion',
          enEjecucionDesde: timestamp,
          auditoria: {
            ...o.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_EN_EJECUCION]', {
            id: enEjecucion.id
          });
        }

        return enEjecucion;
      }
      return o;
    }));
  }, [usuarioActual.email]);

  // Anular orden
  const anularOrden = useCallback((id: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === id) {
        const anulado: Orden = {
          ...o,
          estado: 'anulada',
          auditoria: {
            ...o.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp,
            anuladoPor: usuarioActual.email,
            anuladoEn: timestamp,
            motivoAnulacion: motivo.trim()
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_CANCELLED]', {
            id: anulado.id,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return anulado;
      }
      return o;
    }));
  }, [usuarioActual.email]);

  // Aplicar estado de recepción (llamado desde recepciones-store)
  const aplicarEstadoRecepcion = useCallback((ordenId: string, esCompleta: boolean) => {
    const timestamp = new Date().toISOString();
    
    setOrdenes(prev => prev.map(o => {
      if (o.id === ordenId) {
        const nuevoEstado: EstadoOrden = esCompleta ? 'recepcion_completa' : 'recepcion_parcial';
        
        const actualizado: Orden = {
          ...o,
          estado: nuevoEstado,
          auditoria: {
            ...o.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_ORDENES) {
          console.log('[ORD_RECEPCION_APLICADA]', {
            id: actualizado.id,
            estadoNuevo: nuevoEstado,
            esCompleta
          });
        }

        return actualizado;
      }
      return o;
    }));
  }, [usuarioActual.email]);

  const value: OrdenStoreContext = {
    ordenes,
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
    usuarioActual
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
