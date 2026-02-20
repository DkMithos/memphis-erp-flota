/**
 * STORE DE COTIZACIONES DE COMPRA
 * Context global para gestión de cotizaciones en el módulo Compras
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
// TIPOS
// ============================================================================

export interface ItemCotizacion {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number; // Calculado
}

export interface Cotizacion {
  // Identificación
  id: string;
  requerimientoId: string; // Requerido - relación con Requerimiento
  
  // Proveedor
  proveedorId: string | null; // Opcional - puede integrarse con Directorio
  proveedorNombre: string;
  
  // Clasificación
  tipo: TipoCotizacion;
  moneda: MonedaCotizacion;
  estado: EstadoCotizacion;
  
  // Validez
  validezDias: number; // 7, 15, 30, 45, 60, 90
  fechaEmision: string; // ISO date
  fechaVencimiento: string; // ISO date (calculado)
  
  // Items
  items: ItemCotizacion[];
  
  // Totales
  subtotal: number; // Calculado
  impuestos: number; // Calculado (18% IGV)
  total: number; // Calculado
  
  // Términos y condiciones
  terminos: string | null;
  observaciones: string | null;
  
  // Aprobación/Rechazo
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  rechazadoPor: string | null;
  rechazadoEn: string | null;
  motivoRechazo: string | null;
  
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

export interface NuevaCotizacionInput {
  requerimientoId: string;
  proveedorId?: string | null;
  proveedorNombre: string;
  tipo: TipoCotizacion;
  moneda: MonedaCotizacion;
  validezDias: number;
  items: Omit<ItemCotizacion, 'id' | 'subtotal'>[];
  terminos?: string;
  observaciones?: string;
}

export interface ActualizarCotizacionInput extends Partial<NuevaCotizacionInput> {
  // Solo campos editables
}

interface CotizacionStoreContext {
  cotizaciones: Cotizacion[];
  obtenerCotizacionPorId: (id: string) => Cotizacion | undefined;
  obtenerCotizacionesPorRequerimiento: (requerimientoId: string) => Cotizacion[];
  crearCotizacion: (input: NuevaCotizacionInput) => Cotizacion;
  actualizarCotizacion: (id: string, input: ActualizarCotizacionInput) => void;
  cambiarEstado: (id: string, nuevoEstado: EstadoCotizacion) => void;
  aprobarCotizacion: (id: string, aprobadoPor: string) => void;
  rechazarCotizacion: (id: string, rechazadoPor: string, motivo: string) => void;
  anularCotizacion: (id: string, motivo: string) => void;
  cargarCotizacionesIniciales: () => void;
  // Mock de usuario actual
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const CotizacionContext = createContext<CotizacionStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const cotizacionesSeed: Cotizacion[] = [
  {
    id: 'COT-0001',
    requerimientoId: 'REQ-0001',
    proveedorId: null,
    proveedorNombre: 'Repuestos Automotrices SAC',
    tipo: 'bienes',
    moneda: 'PEN',
    estado: 'enviada',
    validezDias: 15,
    fechaEmision: '2025-01-03T10:00:00Z',
    fechaVencimiento: '2025-01-18T10:00:00Z',
    items: [
      {
        id: 'item-1',
        descripcion: 'Pastillas de freno delanteras Brembo',
        cantidad: 2,
        unidad: 'juego',
        precioUnitario: 380,
        subtotal: 760
      },
      {
        id: 'item-2',
        descripcion: 'Filtro de aceite premium',
        cantidad: 4,
        unidad: 'unidad',
        precioUnitario: 48,
        subtotal: 192
      },
      {
        id: 'item-3',
        descripcion: 'Aceite sintético Shell Helix Ultra 5W-30',
        cantidad: 8,
        unidad: 'litro',
        precioUnitario: 68,
        subtotal: 544
      }
    ],
    subtotal: 1496,
    impuestos: 269.28, // 18% IGV
    total: 1765.28,
    terminos: 'Pago contraentrega. Garantía 6 meses en repuestos.',
    observaciones: 'Entrega en 48 horas.',
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-03T10:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'COT-0002',
    requerimientoId: 'REQ-0001',
    proveedorId: null,
    proveedorNombre: 'Autopartes Premium EIRL',
    tipo: 'bienes',
    moneda: 'PEN',
    estado: 'aprobada',
    validezDias: 15,
    fechaEmision: '2025-01-03T14:00:00Z',
    fechaVencimiento: '2025-01-18T14:00:00Z',
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
    terminos: 'Pago a 30 días. Garantía 1 año en repuestos.',
    observaciones: 'Entrega inmediata, stock disponible.',
    aprobadoPor: 'gerencia@kesa.com',
    aprobadoEn: '2025-01-04T09:00:00Z',
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-03T14:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'COT-0003',
    requerimientoId: 'REQ-0002',
    proveedorId: null,
    proveedorNombre: 'Equipos Médicos del Perú SA',
    tipo: 'bienes',
    moneda: 'USD',
    estado: 'aprobada',
    validezDias: 30,
    fechaEmision: '2025-01-03T09:00:00Z',
    fechaVencimiento: '2025-02-02T09:00:00Z',
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
    terminos: 'Pago 50% adelanto, 50% contraentrega. Garantía 2 años.',
    observaciones: 'Incluye capacitación y servicio técnico por 1 año.',
    aprobadoPor: 'gerencia@kesa.com',
    aprobadoEn: '2025-01-04T10:00:00Z',
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-03T09:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'COT-0004',
    requerimientoId: 'REQ-0003',
    proveedorId: null,
    proveedorNombre: 'Distribuidora Microsoft Perú',
    tipo: 'servicios',
    moneda: 'USD',
    estado: 'borrador',
    validezDias: 30,
    fechaEmision: '2025-01-05T11:00:00Z',
    fechaVencimiento: '2025-02-04T11:00:00Z',
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
    terminos: 'Pago anual anticipado. Soporte técnico incluido.',
    observaciones: null,
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2025-01-05T11:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'COT-0005',
    requerimientoId: 'REQ-0005',
    proveedorId: null,
    proveedorNombre: 'Herramientas Industriales SAC',
    tipo: 'bienes',
    moneda: 'PEN',
    estado: 'anulada',
    validezDias: 15,
    fechaEmision: '2024-12-29T10:00:00Z',
    fechaVencimiento: '2025-01-13T10:00:00Z',
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
    terminos: 'Pago contraentrega.',
    observaciones: null,
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2024-12-29T10:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: 'admin@kesa.com',
      anuladoEn: '2025-01-02T09:45:00Z',
      motivoAnulacion: 'Cotización anulada porque el requerimiento asociado REQ-0005 fue cancelado por solicitud duplicada. No se procesará orden de compra.'
    }
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function CotizacionStoreProvider({ children }: { children: React.ReactNode }) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  
  // Mock de usuario actual
  const usuarioActual = {
    email: 'admin@kesa.com',
    nombre: 'Administrador',
    rol: 'admin_empresa' as RolUsuario
  };

  // Cargar cotizaciones iniciales SOLO una vez al montar
  useEffect(() => {
    if (cotizaciones.length === 0) {
      if (DEBUG_COTIZACIONES) {
        console.log('[COT_SEED_LOADING]', { seedSize: cotizacionesSeed.length });
      }
      setCotizaciones(cotizacionesSeed);
    }
  }, []);

  // Cargar cotizaciones iniciales (con guard idempotente)
  const cargarCotizacionesIniciales = useCallback(() => {
    if (cotizaciones.length === 0) {
      if (DEBUG_COTIZACIONES) {
        console.log('[COT_SEED_MANUAL_LOADING]', { seedSize: cotizacionesSeed.length });
      }
      setCotizaciones(cotizacionesSeed);
    } else if (DEBUG_COTIZACIONES) {
      console.log('[COT_SEED_SKIP]', { 
        reason: 'Ya hay cotizaciones en el store', 
        currentSize: cotizaciones.length 
      });
    }
  }, [cotizaciones.length]);

  // Obtener cotización por ID
  const obtenerCotizacionPorId = useCallback((id: string) => {
    return cotizaciones.find(c => c.id === id);
  }, [cotizaciones]);

  // Obtener cotizaciones por requerimiento
  const obtenerCotizacionesPorRequerimiento = useCallback((requerimientoId: string) => {
    return cotizaciones.filter(c => c.requerimientoId === requerimientoId);
  }, [cotizaciones]);

  // Calcular fecha de vencimiento
  const calcularFechaVencimiento = (fechaEmision: string, validezDias: number): string => {
    const fecha = new Date(fechaEmision);
    fecha.setDate(fecha.getDate() + validezDias);
    return fecha.toISOString();
  };

  // Crear nueva cotización
  const crearCotizacion = useCallback((input: NuevaCotizacionInput): Cotizacion => {
    // Obtener el último número secuencial
    const numeros = cotizaciones
      .map(c => extraerNumeroSecuencial(c.id))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo ID
    const id = generarIdCotizacion(ultimoNumero);
    const timestamp = new Date().toISOString();

    // Generar items con IDs y subtotales
    const items: ItemCotizacion[] = input.items.map((item, idx) => ({
      ...item,
      id: `item-${idx + 1}`,
      subtotal: item.cantidad * item.precioUnitario
    }));

    // Calcular totales
    const { subtotal, impuestos, total } = calcularTotales(items);

    // Calcular fecha de vencimiento
    const fechaVencimiento = calcularFechaVencimiento(timestamp, input.validezDias);

    // Crear objeto cotización
    const nuevaCotizacion: Cotizacion = {
      id,
      requerimientoId: input.requerimientoId,
      proveedorId: input.proveedorId || null,
      proveedorNombre: normalizeProveedorNombre(input.proveedorNombre),
      tipo: input.tipo,
      moneda: input.moneda,
      estado: 'borrador',
      validezDias: input.validezDias,
      fechaEmision: timestamp,
      fechaVencimiento,
      items,
      subtotal,
      impuestos,
      total,
      terminos: input.terminos?.trim() || null,
      observaciones: input.observaciones?.trim() || null,
      aprobadoPor: null,
      aprobadoEn: null,
      rechazadoPor: null,
      rechazadoEn: null,
      motivoRechazo: null,
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
    const sizeBeforeAdd = cotizaciones.length;
    setCotizaciones(prev => {
      const newState = [nuevaCotizacion, ...prev];
      
      if (DEBUG_COTIZACIONES) {
        console.log('[COT_CREATED]', {
          id: nuevaCotizacion.id,
          requerimientoId: nuevaCotizacion.requerimientoId,
          proveedor: nuevaCotizacion.proveedorNombre,
          items: nuevaCotizacion.items.length,
          total: nuevaCotizacion.total,
          sizeAfter: newState.length,
          sizeBefore: sizeBeforeAdd,
          position: 'FIRST'
        });
      }
      
      return newState;
    });

    return nuevaCotizacion;
  }, [cotizaciones, usuarioActual.email]);

  // Actualizar cotización
  const actualizarCotizacion = useCallback((id: string, input: ActualizarCotizacionInput) => {
    const timestamp = new Date().toISOString();
    
    setCotizaciones(prev => prev.map(c => {
      if (c.id === id) {
        // Recalcular items si cambiaron
        let items = c.items;
        let subtotal = c.subtotal;
        let impuestos = c.impuestos;
        let total = c.total;
        
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

        // Recalcular fecha vencimiento si cambió validezDias
        let fechaVencimiento = c.fechaVencimiento;
        if (input.validezDias) {
          fechaVencimiento = calcularFechaVencimiento(c.fechaEmision, input.validezDias);
        }

        const actualizado: Cotizacion = {
          ...c,
          ...(input.proveedorNombre && { proveedorNombre: normalizeProveedorNombre(input.proveedorNombre) }),
          ...(input.proveedorId !== undefined && { proveedorId: input.proveedorId }),
          ...(input.tipo && { tipo: input.tipo }),
          ...(input.moneda && { moneda: input.moneda }),
          ...(input.validezDias && { validezDias: input.validezDias }),
          ...(input.terminos !== undefined && { terminos: input.terminos?.trim() || null }),
          ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() || null }),
          items,
          subtotal,
          impuestos,
          total,
          fechaVencimiento,
          auditoria: {
            ...c.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_COTIZACIONES) {
          console.log('[COT_UPDATED]', {
            id: actualizado.id,
            cambios: Object.keys(input)
          });
        }

        return actualizado;
      }
      return c;
    }));
  }, [usuarioActual.email]);

  // Cambiar estado
  const cambiarEstado = useCallback((id: string, nuevoEstado: EstadoCotizacion) => {
    const timestamp = new Date().toISOString();
    
    setCotizaciones(prev => prev.map(c => {
      if (c.id === id) {
        const actualizado: Cotizacion = {
          ...c,
          estado: nuevoEstado,
          auditoria: {
            ...c.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_COTIZACIONES) {
          console.log('[COT_ESTADO_CHANGED]', {
            id: actualizado.id,
            estadoAnterior: c.estado,
            estadoNuevo: nuevoEstado
          });
        }

        return actualizado;
      }
      return c;
    }));
  }, [usuarioActual.email]);

  // Aprobar cotización
  const aprobarCotizacion = useCallback((id: string, aprobadoPor: string) => {
    const timestamp = new Date().toISOString();
    
    setCotizaciones(prev => prev.map(c => {
      if (c.id === id) {
        const aprobado: Cotizacion = {
          ...c,
          estado: 'aprobada',
          aprobadoPor,
          aprobadoEn: timestamp,
          auditoria: {
            ...c.auditoria,
            modificadoPor: aprobadoPor,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_COTIZACIONES) {
          console.log('[COT_APPROVED]', {
            id: aprobado.id,
            aprobadoPor
          });
        }

        return aprobado;
      }
      return c;
    }));
  }, []);

  // Rechazar cotización
  const rechazarCotizacion = useCallback((id: string, rechazadoPor: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setCotizaciones(prev => prev.map(c => {
      if (c.id === id) {
        const rechazado: Cotizacion = {
          ...c,
          estado: 'rechazada',
          rechazadoPor,
          rechazadoEn: timestamp,
          motivoRechazo: motivo.trim(),
          auditoria: {
            ...c.auditoria,
            modificadoPor: rechazadoPor,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_COTIZACIONES) {
          console.log('[COT_REJECTED]', {
            id: rechazado.id,
            rechazadoPor,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return rechazado;
      }
      return c;
    }));
  }, []);

  // Anular cotización
  const anularCotizacion = useCallback((id: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setCotizaciones(prev => prev.map(c => {
      if (c.id === id) {
        const anulado: Cotizacion = {
          ...c,
          estado: 'anulada',
          auditoria: {
            ...c.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp,
            anuladoPor: usuarioActual.email,
            anuladoEn: timestamp,
            motivoAnulacion: motivo.trim()
          }
        };

        if (DEBUG_COTIZACIONES) {
          console.log('[COT_CANCELLED]', {
            id: anulado.id,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return anulado;
      }
      return c;
    }));
  }, [usuarioActual.email]);

  const value: CotizacionStoreContext = {
    cotizaciones,
    obtenerCotizacionPorId,
    obtenerCotizacionesPorRequerimiento,
    crearCotizacion,
    actualizarCotizacion,
    cambiarEstado,
    aprobarCotizacion,
    rechazarCotizacion,
    anularCotizacion,
    cargarCotizacionesIniciales,
    usuarioActual
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
