/**
 * STORE DE RECEPCIONES Y CONFORMIDAD
 * Context global para gestión de recepciones en el módulo Compras
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  generarIdRecepcion,
  extraerNumeroSecuencial,
  calcularResumenRecepcion,
  DEBUG_RECEPCIONES,
  type EstadoRecepcion,
  type RolUsuario
} from './recepciones-config';

// ============================================================================
// TIPOS
// ============================================================================

export interface ItemRecibido {
  id: string;
  descripcion: string;
  cantidadRecibida: number;
  unidad: string;
  observacionItem: string | null;
}

export interface Recepcion {
  // Identificación
  id: string;
  ordenId: string; // Requerido - relación con Orden
  estado: EstadoRecepcion;
  
  // Items recibidos
  itemsRecibidos: ItemRecibido[];
  
  // Conformidad
  conforme: boolean; // Derivado: true si estado === 'conforme'
  observaciones: string | null;
  
  // Fechas
  fechaRecepcion: string; // ISO date
  
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

export interface NuevaRecepcionInput {
  ordenId: string;
  itemsRecibidos: Omit<ItemRecibido, 'id'>[];
  estado: EstadoRecepcion; // 'conforme' o 'observada'
  observaciones?: string;
}

export interface ActualizarRecepcionInput extends Partial<NuevaRecepcionInput> {
  // Solo campos editables
}

interface RecepcionStoreContext {
  recepciones: Recepcion[];
  obtenerRecepcionPorId: (id: string) => Recepcion | undefined;
  obtenerRecepcionesPorOrden: (ordenId: string) => Recepcion[];
  crearRecepcion: (input: NuevaRecepcionInput, onOrdenUpdated: (ordenId: string, esCompleta: boolean) => void) => Recepcion;
  actualizarRecepcion: (id: string, input: ActualizarRecepcionInput) => void;
  anularRecepcion: (id: string, motivo: string) => void;
  cargarRecepcionesIniciales: () => void;
  // Mock de usuario actual
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const RecepcionContext = createContext<RecepcionStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const recepcionesSeed: Recepcion[] = [
  {
    id: 'REC-0001',
    ordenId: 'OC-0002',
    estado: 'conforme',
    itemsRecibidos: [
      {
        id: 'item-1',
        descripcion: 'Monitor multiparamétrico GE Healthcare CARESCAPE B650',
        cantidadRecibida: 0, // Aún no recibido
        unidad: 'unidad',
        observacionItem: 'Pendiente de entrega'
      },
      {
        id: 'item-2',
        descripcion: 'Cables ECG 5 derivaciones',
        cantidadRecibida: 2, // Recibido completo
        unidad: 'juego',
        observacionItem: null
      }
    ],
    conforme: true,
    observaciones: 'Recepción parcial - cables entregados en buenas condiciones. Monitor pendiente de entrega por parte del proveedor.',
    fechaRecepcion: '2025-01-05T10:00:00Z',
    auditoria: {
      creadoPor: 'operaciones@kesa.com',
      creadoEn: '2025-01-05T10:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'REC-0002',
    ordenId: 'OC-0001',
    estado: 'conforme',
    itemsRecibidos: [
      {
        id: 'item-1',
        descripcion: 'Pastillas de freno delanteras marca ACDelco',
        cantidadRecibida: 2,
        unidad: 'juego',
        observacionItem: null
      },
      {
        id: 'item-2',
        descripcion: 'Filtro de aceite',
        cantidadRecibida: 4,
        unidad: 'unidad',
        observacionItem: null
      },
      {
        id: 'item-3',
        descripcion: 'Aceite sintético Mobil 1 5W-30',
        cantidadRecibida: 8,
        unidad: 'litro',
        observacionItem: null
      }
    ],
    conforme: true,
    observaciones: 'Recepción completa y conforme. Todos los productos en perfecto estado.',
    fechaRecepcion: '2025-01-05T14:00:00Z',
    auditoria: {
      creadoPor: 'operaciones@kesa.com',
      creadoEn: '2025-01-05T14:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'REC-0003',
    ordenId: 'OC-0001',
    estado: 'observada',
    itemsRecibidos: [
      {
        id: 'item-1',
        descripcion: 'Pastillas de freno delanteras marca ACDelco',
        cantidadRecibida: 1, // Solo recibió 1 de 2
        unidad: 'juego',
        observacionItem: 'Falta 1 juego'
      }
    ],
    conforme: false,
    observaciones: 'Recepción con observaciones - falta 1 juego de pastillas de freno. Se coordina reposición con proveedor.',
    fechaRecepcion: '2025-01-04T16:00:00Z',
    auditoria: {
      creadoPor: 'operaciones@kesa.com',
      creadoEn: '2025-01-04T16:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function RecepcionStoreProvider({ children }: { children: React.ReactNode }) {
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  
  // Mock de usuario actual
  const usuarioActual = {
    email: 'operaciones@kesa.com',
    nombre: 'Operaciones',
    rol: 'operaciones' as RolUsuario
  };

  // Cargar recepciones iniciales SOLO una vez al montar
  useEffect(() => {
    if (recepciones.length === 0) {
      if (DEBUG_RECEPCIONES) {
        console.log('[REC_SEED_LOADING]', { seedSize: recepcionesSeed.length });
      }
      setRecepciones(recepcionesSeed);
    }
  }, []);

  // Cargar recepciones iniciales (con guard idempotente)
  const cargarRecepcionesIniciales = useCallback(() => {
    if (recepciones.length === 0) {
      if (DEBUG_RECEPCIONES) {
        console.log('[REC_SEED_MANUAL_LOADING]', { seedSize: recepcionesSeed.length });
      }
      setRecepciones(recepcionesSeed);
    } else if (DEBUG_RECEPCIONES) {
      console.log('[REC_SEED_SKIP]', { 
        reason: 'Ya hay recepciones en el store', 
        currentSize: recepciones.length 
      });
    }
  }, [recepciones.length]);

  // Obtener recepción por ID
  const obtenerRecepcionPorId = useCallback((id: string) => {
    return recepciones.find(r => r.id === id);
  }, [recepciones]);

  // Obtener recepciones por orden
  const obtenerRecepcionesPorOrden = useCallback((ordenId: string) => {
    return recepciones.filter(r => r.ordenId === ordenId);
  }, [recepciones]);

  // Crear nueva recepción
  const crearRecepcion = useCallback((
    input: NuevaRecepcionInput, 
    onOrdenUpdated: (ordenId: string, esCompleta: boolean) => void
  ): Recepcion => {
    // Obtener el último número secuencial
    const numeros = recepciones
      .map(r => extraerNumeroSecuencial(r.id))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo ID
    const id = generarIdRecepcion(ultimoNumero);
    const timestamp = new Date().toISOString();

    // Generar items recibidos con IDs
    const itemsRecibidos: ItemRecibido[] = input.itemsRecibidos.map((item, idx) => ({
      ...item,
      id: `item-${idx + 1}`
    }));

    // Determinar si es conforme
    const conforme = input.estado === 'conforme';

    // Crear objeto recepción
    const nuevaRecepcion: Recepcion = {
      id,
      ordenId: input.ordenId,
      estado: input.estado,
      itemsRecibidos,
      conforme,
      observaciones: input.observaciones?.trim() || null,
      fechaRecepcion: timestamp,
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
    setRecepciones(prev => {
      const newState = [nuevaRecepcion, ...prev];
      
      if (DEBUG_RECEPCIONES) {
        console.log('[REC_CREATED]', {
          id: nuevaRecepcion.id,
          ordenId: nuevaRecepcion.ordenId,
          estado: nuevaRecepcion.estado,
          itemsCount: nuevaRecepcion.itemsRecibidos.length,
          sizeAfter: newState.length
        });
      }
      
      return newState;
    });

    // IMPORTANTE: Actualizar estado de la orden (parcial/completa)
    // Esto se calcula comparando cantidades recibidas vs ordenadas
    // La lógica de comparación debe hacerse externamente (en el componente)
    // porque necesitamos los datos de la orden original
    
    // Por ahora, llamamos al callback que actualizará el estado de la orden
    // El callback vendrá del store de órdenes
    const totalRecibido = itemsRecibidos.reduce((sum, item) => sum + item.cantidadRecibida, 0);
    const esCompleta = totalRecibido > 0; // Simplificado - en producción comparar con cantidades ordenadas
    
    if (DEBUG_RECEPCIONES) {
      console.log('[REC_ORDEN_UPDATE_TRIGGER]', {
        ordenId: input.ordenId,
        esCompleta,
        totalRecibido
      });
    }
    
    onOrdenUpdated(input.ordenId, esCompleta);

    return nuevaRecepcion;
  }, [recepciones, usuarioActual.email]);

  // Actualizar recepción
  const actualizarRecepcion = useCallback((id: string, input: ActualizarRecepcionInput) => {
    const timestamp = new Date().toISOString();
    
    setRecepciones(prev => prev.map(r => {
      if (r.id === id) {
        // Recalcular items si cambiaron
        let itemsRecibidos = r.itemsRecibidos;
        
        if (input.itemsRecibidos) {
          itemsRecibidos = input.itemsRecibidos.map((item, idx) => ({
            ...item,
            id: `item-${idx + 1}`
          }));
        }

        // Determinar conforme
        const estado = input.estado || r.estado;
        const conforme = estado === 'conforme';

        const actualizado: Recepcion = {
          ...r,
          ...(input.estado && { estado: input.estado }),
          ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() || null }),
          itemsRecibidos,
          conforme,
          auditoria: {
            ...r.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_RECEPCIONES) {
          console.log('[REC_UPDATED]', {
            id: actualizado.id,
            cambios: Object.keys(input)
          });
        }

        return actualizado;
      }
      return r;
    }));
  }, [usuarioActual.email]);

  // Anular recepción
  const anularRecepcion = useCallback((id: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setRecepciones(prev => prev.map(r => {
      if (r.id === id) {
        const anulado: Recepcion = {
          ...r,
          estado: 'anulada',
          auditoria: {
            ...r.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp,
            anuladoPor: usuarioActual.email,
            anuladoEn: timestamp,
            motivoAnulacion: motivo.trim()
          }
        };

        if (DEBUG_RECEPCIONES) {
          console.log('[REC_CANCELLED]', {
            id: anulado.id,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return anulado;
      }
      return r;
    }));
  }, [usuarioActual.email]);

  const value: RecepcionStoreContext = {
    recepciones,
    obtenerRecepcionPorId,
    obtenerRecepcionesPorOrden,
    crearRecepcion,
    actualizarRecepcion,
    anularRecepcion,
    cargarRecepcionesIniciales,
    usuarioActual
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
