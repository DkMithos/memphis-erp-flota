/**
 * STORE DE REQUERIMIENTOS DE COMPRA
 * Context global para gestión de requerimientos en el módulo Compras
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
// TIPOS
// ============================================================================

export interface ItemRequerimiento {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioEstimado: number;
  comentario: string | null;
}

export interface Requerimiento {
  // Identificación
  id: string;
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
  fechaRequerida: string | null; // ISO date
  
  // Items
  items: ItemRequerimiento[];
  totalEstimado: number; // Calculado
  
  // Aprobación
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

export interface NuevoRequerimientoInput {
  titulo: string;
  descripcion: string;
  centroCosto: CentroCosto;
  prioridad: PrioridadRequerimiento;
  solicitanteNombre: string;
  solicitanteEmail: string;
  fechaRequerida?: string;
  items: Omit<ItemRequerimiento, 'id'>[];
}

export interface ActualizarRequerimientoInput extends Partial<NuevoRequerimientoInput> {
  // Solo campos editables
}

interface RequerimientoStoreContext {
  requerimientos: Requerimiento[];
  obtenerRequerimientoPorId: (id: string) => Requerimiento | undefined;
  crearRequerimiento: (input: NuevoRequerimientoInput) => Requerimiento;
  actualizarRequerimiento: (id: string, input: ActualizarRequerimientoInput) => void;
  cambiarEstado: (id: string, nuevoEstado: EstadoRequerimiento) => void;
  aprobarRequerimiento: (id: string, aprobadoPor: string) => void;
  rechazarRequerimiento: (id: string, rechazadoPor: string, motivo: string) => void;
  anularRequerimiento: (id: string, motivo: string) => void;
  cargarRequerimientosIniciales: () => void;
  // Mock de usuario actual
  usuarioActual: { email: string; nombre: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const RequerimientoContext = createContext<RequerimientoStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const requerimientosSeed: Requerimiento[] = [
  {
    id: 'REQ-0001',
    titulo: 'Repuestos urgentes para ambulancia AMB-001',
    descripcion: 'Se requieren repuestos críticos para la ambulancia AMB-001 que está fuera de servicio. Incluye pastillas de freno, filtros y aceite.',
    centroCosto: 'flota',
    prioridad: 'alta',
    estado: 'enviado',
    solicitanteNombre: 'Carlos Mendoza',
    solicitanteEmail: 'cmendoza@kesa.com',
    fechaRequerida: '2025-01-08',
    items: [
      {
        id: 'item-1',
        descripcion: 'Pastillas de freno delanteras',
        cantidad: 2,
        unidad: 'juego',
        precioEstimado: 350,
        comentario: 'Marca Brembo o equivalente'
      },
      {
        id: 'item-2',
        descripcion: 'Filtro de aceite',
        cantidad: 4,
        unidad: 'unidad',
        precioEstimado: 45,
        comentario: null
      },
      {
        id: 'item-3',
        descripcion: 'Aceite sintético 5W-30',
        cantidad: 8,
        unidad: 'litro',
        precioEstimado: 65,
        comentario: 'Shell Helix Ultra'
      }
    ],
    totalEstimado: 1400,
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'cmendoza@kesa.com',
      creadoEn: '2025-01-02T10:30:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'REQ-0002',
    titulo: 'Equipamiento médico - Monitor de signos vitales',
    descripcion: 'Compra de monitor de signos vitales para área de emergencias. Debe incluir módulos de ECG, SpO2, NIBP y temperatura.',
    centroCosto: 'biomedico',
    prioridad: 'media',
    estado: 'aprobado',
    solicitanteNombre: 'Dra. Ana Torres',
    solicitanteEmail: 'atorres@kesa.com',
    fechaRequerida: '2025-01-15',
    items: [
      {
        id: 'item-1',
        descripcion: 'Monitor de signos vitales multiparamétrico',
        cantidad: 1,
        unidad: 'unidad',
        precioEstimado: 12500,
        comentario: 'Marca GE Healthcare o Philips, con pantalla táctil 15"'
      },
      {
        id: 'item-2',
        descripcion: 'Cables de ECG',
        cantidad: 2,
        unidad: 'juego',
        precioEstimado: 450,
        comentario: '5 derivaciones'
      }
    ],
    totalEstimado: 13400,
    aprobadoPor: 'gerencia@kesa.com',
    aprobadoEn: '2025-01-03T14:00:00Z',
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'atorres@kesa.com',
      creadoEn: '2025-01-02T09:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'REQ-0003',
    titulo: 'Licencias de software Office 365',
    descripcion: 'Renovación de licencias Office 365 Business Premium para 50 usuarios del área administrativa.',
    centroCosto: 'ti',
    prioridad: 'media',
    estado: 'borrador',
    solicitanteNombre: 'Luis García',
    solicitanteEmail: 'lgarcia@kesa.com',
    fechaRequerida: null,
    items: [
      {
        id: 'item-1',
        descripcion: 'Licencia Office 365 Business Premium',
        cantidad: 50,
        unidad: 'licencia',
        precioEstimado: 180,
        comentario: 'Renovación anual'
      }
    ],
    totalEstimado: 9000,
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'lgarcia@kesa.com',
      creadoEn: '2025-01-04T11:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'REQ-0004',
    titulo: 'Material de oficina - Trimestre Q1 2025',
    descripcion: 'Compra de material de oficina para el primer trimestre 2025. Incluye papel, tóner, útiles varios.',
    centroCosto: 'administracion',
    prioridad: 'baja',
    estado: 'rechazado',
    solicitanteNombre: 'María Rodríguez',
    solicitanteEmail: 'mrodriguez@kesa.com',
    fechaRequerida: '2025-01-20',
    items: [
      {
        id: 'item-1',
        descripcion: 'Papel bond A4 75g',
        cantidad: 50,
        unidad: 'paquete',
        precioEstimado: 18,
        comentario: null
      },
      {
        id: 'item-2',
        descripcion: 'Tóner HP LaserJet',
        cantidad: 10,
        unidad: 'unidad',
        precioEstimado: 220,
        comentario: 'Modelo 85A'
      }
    ],
    totalEstimado: 3100,
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: 'gerencia@kesa.com',
    rechazadoEn: '2025-01-04T16:00:00Z',
    motivoRechazo: 'El presupuesto para material de oficina ya fue asignado en diciembre. Revisar con el responsable de compras.',
    auditoria: {
      creadoPor: 'mrodriguez@kesa.com',
      creadoEn: '2025-01-03T10:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: null,
      anuladoEn: null,
      motivoAnulacion: null
    }
  },
  {
    id: 'REQ-0005',
    titulo: 'Herramientas para taller mecánico',
    descripcion: 'Set de herramientas especializadas para mantenimiento de flota pesada.',
    centroCosto: 'mantenimiento',
    prioridad: 'media',
    estado: 'anulado',
    solicitanteNombre: 'Jorge Silva',
    solicitanteEmail: 'jsilva@kesa.com',
    fechaRequerida: null,
    items: [
      {
        id: 'item-1',
        descripcion: 'Juego de llaves combinadas métricas',
        cantidad: 2,
        unidad: 'juego',
        precioEstimado: 850,
        comentario: 'De 8mm a 32mm'
      }
    ],
    totalEstimado: 1700,
    aprobadoPor: null,
    aprobadoEn: null,
    rechazadoPor: null,
    rechazadoEn: null,
    motivoRechazo: null,
    auditoria: {
      creadoPor: 'jsilva@kesa.com',
      creadoEn: '2024-12-28T14:00:00Z',
      modificadoPor: null,
      modificadoEn: null,
      anuladoPor: 'admin@kesa.com',
      anuladoEn: '2025-01-02T09:30:00Z',
      motivoAnulacion: 'Solicitud duplicada. Ya existe REQ-0012 para el mismo propósito aprobado en diciembre. Se anula para evitar compra duplicada.'
    }
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function RequerimientoStoreProvider({ children }: { children: React.ReactNode }) {
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  
  // Mock de usuario actual
  const usuarioActual = {
    email: 'admin@kesa.com',
    nombre: 'Administrador',
    rol: 'admin_empresa' as RolUsuario
  };

  // Cargar requerimientos iniciales SOLO una vez al montar
  useEffect(() => {
    if (requerimientos.length === 0) {
      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_SEED_LOADING]', { seedSize: requerimientosSeed.length });
      }
      setRequerimientos(requerimientosSeed);
    }
  }, []);

  // Cargar requerimientos iniciales (con guard idempotente)
  const cargarRequerimientosIniciales = useCallback(() => {
    if (requerimientos.length === 0) {
      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_SEED_MANUAL_LOADING]', { seedSize: requerimientosSeed.length });
      }
      setRequerimientos(requerimientosSeed);
    } else if (DEBUG_REQUERIMIENTOS) {
      console.log('[REQ_SEED_SKIP]', { 
        reason: 'Ya hay requerimientos en el store', 
        currentSize: requerimientos.length 
      });
    }
  }, [requerimientos.length]);

  // Obtener requerimiento por ID
  const obtenerRequerimientoPorId = useCallback((id: string) => {
    return requerimientos.find(r => r.id === id);
  }, [requerimientos]);

  // Calcular total estimado
  const calcularTotal = (items: ItemRequerimiento[]): number => {
    return items.reduce((sum, item) => sum + (item.cantidad * item.precioEstimado), 0);
  };

  // Crear nuevo requerimiento
  const crearRequerimiento = useCallback((input: NuevoRequerimientoInput): Requerimiento => {
    // Obtener el último número secuencial
    const numeros = requerimientos
      .map(r => extraerNumeroSecuencial(r.id))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo ID
    const id = generarIdRequerimiento(ultimoNumero);
    const timestamp = new Date().toISOString();

    // Generar items con IDs
    const items: ItemRequerimiento[] = input.items.map((item, idx) => ({
      ...item,
      id: `item-${idx + 1}`
    }));

    // Crear objeto requerimiento
    const nuevoRequerimiento: Requerimiento = {
      id,
      titulo: input.titulo.trim(),
      descripcion: input.descripcion.trim(),
      centroCosto: input.centroCosto,
      prioridad: input.prioridad,
      estado: 'borrador',
      solicitanteNombre: input.solicitanteNombre.trim(),
      solicitanteEmail: normalizeEmail(input.solicitanteEmail),
      fechaRequerida: input.fechaRequerida || null,
      items,
      totalEstimado: calcularTotal(items),
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
    const sizeBeforeAdd = requerimientos.length;
    setRequerimientos(prev => {
      const newState = [nuevoRequerimiento, ...prev];
      
      if (DEBUG_REQUERIMIENTOS) {
        console.log('[REQ_CREATED]', {
          id: nuevoRequerimiento.id,
          titulo: nuevoRequerimiento.titulo,
          items: nuevoRequerimiento.items.length,
          total: nuevoRequerimiento.totalEstimado,
          sizeAfter: newState.length,
          sizeBefore: sizeBeforeAdd,
          position: 'FIRST'
        });
      }
      
      return newState;
    });

    return nuevoRequerimiento;
  }, [requerimientos, usuarioActual.email]);

  // Actualizar requerimiento
  const actualizarRequerimiento = useCallback((id: string, input: ActualizarRequerimientoInput) => {
    const timestamp = new Date().toISOString();
    
    setRequerimientos(prev => prev.map(r => {
      if (r.id === id) {
        // Recalcular items si cambiaron
        let items = r.items;
        let totalEstimado = r.totalEstimado;
        
        if (input.items) {
          items = input.items.map((item, idx) => ({
            ...item,
            id: `item-${idx + 1}`
          }));
          totalEstimado = calcularTotal(items);
        }

        const actualizado: Requerimiento = {
          ...r,
          ...(input.titulo && { titulo: input.titulo.trim() }),
          ...(input.descripcion && { descripcion: input.descripcion.trim() }),
          ...(input.centroCosto && { centroCosto: input.centroCosto }),
          ...(input.prioridad && { prioridad: input.prioridad }),
          ...(input.solicitanteNombre && { solicitanteNombre: input.solicitanteNombre.trim() }),
          ...(input.solicitanteEmail && { solicitanteEmail: normalizeEmail(input.solicitanteEmail) }),
          ...(input.fechaRequerida !== undefined && { fechaRequerida: input.fechaRequerida || null }),
          items,
          totalEstimado,
          auditoria: {
            ...r.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_REQUERIMIENTOS) {
          console.log('[REQ_UPDATED]', {
            id: actualizado.id,
            cambios: Object.keys(input)
          });
        }

        return actualizado;
      }
      return r;
    }));
  }, [usuarioActual.email]);

  // Cambiar estado
  const cambiarEstado = useCallback((id: string, nuevoEstado: EstadoRequerimiento) => {
    const timestamp = new Date().toISOString();
    
    setRequerimientos(prev => prev.map(r => {
      if (r.id === id) {
        const actualizado: Requerimiento = {
          ...r,
          estado: nuevoEstado,
          auditoria: {
            ...r.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_REQUERIMIENTOS) {
          console.log('[REQ_ESTADO_CHANGED]', {
            id: actualizado.id,
            estadoAnterior: r.estado,
            estadoNuevo: nuevoEstado
          });
        }

        return actualizado;
      }
      return r;
    }));
  }, [usuarioActual.email]);

  // Aprobar requerimiento
  const aprobarRequerimiento = useCallback((id: string, aprobadoPor: string) => {
    const timestamp = new Date().toISOString();
    
    setRequerimientos(prev => prev.map(r => {
      if (r.id === id) {
        const aprobado: Requerimiento = {
          ...r,
          estado: 'aprobado',
          aprobadoPor,
          aprobadoEn: timestamp,
          auditoria: {
            ...r.auditoria,
            modificadoPor: aprobadoPor,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_REQUERIMIENTOS) {
          console.log('[REQ_APPROVED]', {
            id: aprobado.id,
            aprobadoPor
          });
        }

        return aprobado;
      }
      return r;
    }));
  }, []);

  // Rechazar requerimiento
  const rechazarRequerimiento = useCallback((id: string, rechazadoPor: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setRequerimientos(prev => prev.map(r => {
      if (r.id === id) {
        const rechazado: Requerimiento = {
          ...r,
          estado: 'rechazado',
          rechazadoPor,
          rechazadoEn: timestamp,
          motivoRechazo: motivo.trim(),
          auditoria: {
            ...r.auditoria,
            modificadoPor: rechazadoPor,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_REQUERIMIENTOS) {
          console.log('[REQ_REJECTED]', {
            id: rechazado.id,
            rechazadoPor,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return rechazado;
      }
      return r;
    }));
  }, []);

  // Anular requerimiento
  const anularRequerimiento = useCallback((id: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setRequerimientos(prev => prev.map(r => {
      if (r.id === id) {
        const anulado: Requerimiento = {
          ...r,
          estado: 'anulado',
          auditoria: {
            ...r.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp,
            anuladoPor: usuarioActual.email,
            anuladoEn: timestamp,
            motivoAnulacion: motivo.trim()
          }
        };

        if (DEBUG_REQUERIMIENTOS) {
          console.log('[REQ_CANCELLED]', {
            id: anulado.id,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return anulado;
      }
      return r;
    }));
  }, [usuarioActual.email]);

  const value: RequerimientoStoreContext = {
    requerimientos,
    obtenerRequerimientoPorId,
    crearRequerimiento,
    actualizarRequerimiento,
    cambiarEstado,
    aprobarRequerimiento,
    rechazarRequerimiento,
    anularRequerimiento,
    cargarRequerimientosIniciales,
    usuarioActual
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
