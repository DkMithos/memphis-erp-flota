/**
 * STORE DE ÓRDENES DE TRABAJO
 * Context global para gestión de OTs en el módulo Flota
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  generarNumeroOT, 
  extraerNumeroSecuencial, 
  determinarEstadoInicial,
  normalizeOTStatus,
  DEBUG_OT,
  type EstadoOT, 
  type TipoOT, 
  type CriticidadOT,
  type OTExtraItem
} from './ot-config';

// ============================================================================
// TIPOS
// ============================================================================

export interface OrdenTrabajo {
  // Identificación
  id: string;
  numeroOT: string;
  vehiculoId: string;
  vehiculoPlaca: string;
  
  // Clasificación
  tipo: TipoOT;
  criticidad: CriticidadOT;
  estado: EstadoOT;
  
  // Descripción
  titulo: string;
  descripcion: string;
  
  // Fechas y SLA
  fechaCreacion: string;
  fechaProgramada: string;
  fechaInicio: string | null;
  fechaCierre: string | null;
  slaEstimado: number; // horas
  slaReal: number | null; // horas
  
  // Kilometraje
  kilometrajeRegistro: number;
  
  // Integración con otros módulos
  taller: {
    id: string;
    nombre: string;
    tipo: 'interno' | 'externo';
  };
  
  repuestos: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
  }>;
  
  costos: {
    manoObra: number;
    repuestos: number;
    terceros: number;
    otros: number;
    total: number;
  };
  
  // Auditoría obligatoria
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    cerradoPor: string | null;
    cerradoEn: string | null;
  };
  
  // Observaciones
  observaciones: string | null;
  notasCierre: string | null;
  
  // Extras (hallazgos/adicionales)
  extras: OTExtraItem[];
}

export interface NuevaOrdenTrabajoInput {
  vehiculoId: string;
  vehiculoPlaca: string;
  tipo: TipoOT;
  criticidad: CriticidadOT;
  titulo: string;
  descripcion: string;
  fechaProgramada: string;
  slaEstimado: number;
  kilometrajeRegistro: number;
  taller: {
    id: string;
    nombre: string;
    tipo: 'interno' | 'externo';
  };
  costos?: {
    manoObra: number;
    repuestos: number;
    terceros: number;
    otros: number;
  };
  observaciones?: string;
}

interface OTStoreContext {
  ordenes: OrdenTrabajo[];
  obtenerOTPorNumero: (numeroOT: string) => OrdenTrabajo | undefined;
  obtenerOTsPorVehiculo: (vehiculoId: string) => OrdenTrabajo[];
  crearOrdenTrabajo: (input: NuevaOrdenTrabajoInput) => OrdenTrabajo;
  actualizarEstadoOT: (numeroOT: string, nuevoEstado: EstadoOT) => void;
  iniciarOT: (numeroOT: string) => void;
  pausarOT: (numeroOT: string) => void;
  aprobarOT: (numeroOT: string) => void;
  cerrarOT: (numeroOT: string, notasCierre?: string) => void;
  anularOT: (numeroOT: string, motivo: string) => void;
  agregarExtra: (numeroOT: string, extra: OTExtraItem) => void;
  eliminarExtra: (numeroOT: string, extraId: string, motivo: string) => void;
  cargarOTsIniciales: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const OTContext = createContext<OTStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const ordenesTrabajoSeed: OrdenTrabajo[] = [
  {
    id: 'OT-001',
    numeroOT: 'OT-2024-001',
    vehiculoId: 'VH-001',
    vehiculoPlaca: 'ABC-123',
    tipo: 'preventivo',
    criticidad: 'alta',
    estado: 'programada',
    titulo: 'Mantenimiento Preventivo 50,000 km',
    descripcion: 'Cambio de aceite, filtros, revisión de frenos y suspensión',
    fechaCreacion: '2024-12-01 09:00',
    fechaProgramada: '2024-12-20 08:00',
    fechaInicio: null,
    fechaCierre: null,
    slaEstimado: 4,
    slaReal: null,
    kilometrajeRegistro: 48500,
    taller: {
      id: 'TALLER-001',
      nombre: 'Mercedes Benz Servicio Oficial',
      tipo: 'externo'
    },
    repuestos: [],
    costos: {
      manoObra: 450.00,
      repuestos: 1200.00,
      terceros: 0,
      otros: 200.00,
      total: 1850.00
    },
    auditoria: {
      creadoPor: 'sistema.automatico@kesa.com',
      creadoEn: '2024-12-01 09:00:00',
      modificadoPor: null,
      modificadoEn: null,
      cerradoPor: null,
      cerradoEn: null
    },
    observaciones: 'Generado automáticamente por sistema al alcanzar 48,500 km',
    notasCierre: null,
    extras: []
  },
  {
    id: 'OT-002',
    numeroOT: 'OT-2024-002',
    vehiculoId: 'VH-001',
    vehiculoPlaca: 'ABC-123',
    tipo: 'correctivo',
    criticidad: 'critica',
    estado: 'en_ejecucion',
    titulo: 'Reparación de sistema de frenos',
    descripcion: 'Desgaste crítico de pastillas de freno delanteras detectado en inspección rutinaria',
    fechaCreacion: '2024-12-24 14:30',
    fechaProgramada: '2024-12-25 08:00',
    fechaInicio: '2024-12-25 08:15',
    fechaCierre: null,
    slaEstimado: 3,
    slaReal: null,
    kilometrajeRegistro: 48500,
    taller: {
      id: 'TALLER-002',
      nombre: 'Taller Interno - Base Central',
      tipo: 'interno'
    },
    repuestos: [
      {
        id: 'REP-001',
        nombre: 'Pastillas de freno delanteras OEM',
        cantidad: 1,
        costoUnitario: 280.00,
        costoTotal: 280.00
      },
      {
        id: 'REP-002',
        nombre: 'Líquido de frenos DOT 4',
        cantidad: 2,
        costoUnitario: 25.00,
        costoTotal: 50.00
      }
    ],
    costos: {
      manoObra: 150.00,
      repuestos: 330.00,
      terceros: 0,
      otros: 0,
      total: 480.00
    },
    auditoria: {
      creadoPor: 'juan.perez@kesa.com',
      creadoEn: '2024-12-24 14:30:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-12-25 08:15:00',
      cerradoPor: null,
      cerradoEn: null
    },
    observaciones: 'Vehículo fuera de servicio hasta completar reparación',
    notasCierre: null,
    extras: []
  },
  {
    id: 'OT-003',
    numeroOT: 'OT-2024-003',
    vehiculoId: 'VH-001',
    vehiculoPlaca: 'ABC-123',
    tipo: 'correctivo',
    criticidad: 'media',
    estado: 'espera_repuesto',
    titulo: 'Reemplazo de batería',
    descripcion: 'Batería con bajo voltaje, requiere reemplazo preventivo',
    fechaCreacion: '2024-12-20 10:00',
    fechaProgramada: '2024-12-23 09:00',
    fechaInicio: '2024-12-23 09:10',
    fechaCierre: null,
    slaEstimado: 2,
    slaReal: null,
    kilometrajeRegistro: 48200,
    taller: {
      id: 'TALLER-002',
      nombre: 'Taller Interno - Base Central',
      tipo: 'interno'
    },
    repuestos: [
      {
        id: 'REP-003',
        nombre: 'Batería 12V 100Ah AGM',
        cantidad: 1,
        costoUnitario: 450.00,
        costoTotal: 450.00
      }
    ],
    costos: {
      manoObra: 50.00,
      repuestos: 450.00,
      terceros: 0,
      otros: 0,
      total: 500.00
    },
    auditoria: {
      creadoPor: 'ana.garcia@kesa.com',
      creadoEn: '2024-12-20 10:00:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-12-23 09:10:00',
      cerradoPor: null,
      cerradoEn: null
    },
    observaciones: 'Batería en tránsito desde proveedor, ETA 2 días',
    notasCierre: null,
    extras: []
  },
  {
    id: 'OT-004',
    numeroOT: 'OT-2024-004',
    vehiculoId: 'VH-001',
    vehiculoPlaca: 'ABC-123',
    tipo: 'preventivo',
    criticidad: 'baja',
    estado: 'cerrada',
    titulo: 'Mantenimiento Preventivo 40,000 km',
    descripcion: 'Mantenimiento preventivo programado - Cambio de aceite y filtros',
    fechaCreacion: '2024-10-01 09:00',
    fechaProgramada: '2024-10-20 08:00',
    fechaInicio: '2024-10-20 08:05',
    fechaCierre: '2024-10-20 11:30',
    slaEstimado: 4,
    slaReal: 3.4,
    kilometrajeRegistro: 40000,
    taller: {
      id: 'TALLER-001',
      nombre: 'Mercedes Benz Servicio Oficial',
      tipo: 'externo'
    },
    repuestos: [
      {
        id: 'REP-004',
        nombre: 'Aceite sintético 5W-30 (5L)',
        cantidad: 2,
        costoUnitario: 85.00,
        costoTotal: 170.00
      },
      {
        id: 'REP-005',
        nombre: 'Filtro de aceite OEM',
        cantidad: 1,
        costoUnitario: 45.00,
        costoTotal: 45.00
      },
      {
        id: 'REP-006',
        nombre: 'Filtro de aire',
        cantidad: 1,
        costoUnitario: 35.00,
        costoTotal: 35.00
      },
      {
        id: 'REP-007',
        nombre: 'Filtro de combustible',
        cantidad: 1,
        costoUnitario: 55.00,
        costoTotal: 55.00
      }
    ],
    costos: {
      manoObra: 250.00,
      repuestos: 305.00,
      terceros: 0,
      otros: 50.00,
      total: 605.00
    },
    auditoria: {
      creadoPor: 'sistema.automatico@kesa.com',
      creadoEn: '2024-10-01 09:00:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-10-20 08:05:00',
      cerradoPor: 'carlos.mendoza@kesa.com',
      cerradoEn: '2024-10-20 11:30:00'
    },
    observaciones: 'Mantenimiento programado cumplido a tiempo',
    notasCierre: 'Trabajo completado sin inconvenientes. Vehículo operativo.',
    extras: []
  },
  {
    id: 'OT-005',
    numeroOT: 'OT-2024-005',
    vehiculoId: 'VH-001',
    vehiculoPlaca: 'ABC-123',
    tipo: 'correctivo',
    criticidad: 'baja',
    estado: 'anulada',
    titulo: 'Revisión de sistema eléctrico',
    descripcion: 'Alerta de fallo eléctrico - Para revisión',
    fechaCreacion: '2024-11-10 15:20',
    fechaProgramada: '2024-11-12 10:00',
    fechaInicio: null,
    fechaCierre: null,
    slaEstimado: 2,
    slaReal: null,
    kilometrajeRegistro: 42500,
    taller: {
      id: 'TALLER-002',
      nombre: 'Taller Interno - Base Central',
      tipo: 'interno'
    },
    repuestos: [],
    costos: {
      manoObra: 0,
      repuestos: 0,
      terceros: 0,
      otros: 0,
      total: 0
    },
    auditoria: {
      creadoPor: 'juan.perez@kesa.com',
      creadoEn: '2024-11-10 15:20:00',
      modificadoPor: 'ana.garcia@kesa.com',
      modificadoEn: '2024-11-11 09:00:00',
      cerradoPor: 'ana.garcia@kesa.com',
      cerradoEn: '2024-11-11 09:00:00'
    },
    observaciones: 'OT anulada - Falsa alarma, sistema eléctrico operativo',
    notasCierre: 'Diagnóstico confirmó que no hay falla real. OT anulada.',
    extras: []
  },
  {
    id: 'OT-006',
    numeroOT: 'OT-2024-006',
    vehiculoId: 'VH-001',
    vehiculoPlaca: 'ABC-123',
    tipo: 'correctivo',
    criticidad: 'alta',
    estado: 'espera_aprobacion',
    titulo: 'Reparación mayor de motor - Revisión de inyectores',
    descripcion: 'Falla en inyector #3 detectada por diagnóstico computarizado',
    fechaCreacion: '2024-12-26 11:00',
    fechaProgramada: '2024-12-28 08:00',
    fechaInicio: null,
    fechaCierre: null,
    slaEstimado: 8,
    slaReal: null,
    kilometrajeRegistro: 48600,
    taller: {
      id: 'TALLER-001',
      nombre: 'Mercedes Benz Servicio Oficial',
      tipo: 'externo'
    },
    repuestos: [
      {
        id: 'REP-008',
        nombre: 'Inyector Common Rail OEM',
        cantidad: 1,
        costoUnitario: 850.00,
        costoTotal: 850.00
      }
    ],
    costos: {
      manoObra: 650.00,
      repuestos: 850.00,
      terceros: 200.00,
      otros: 100.00,
      total: 1800.00
    },
    auditoria: {
      creadoPor: 'carlos.mendoza@kesa.com',
      creadoEn: '2024-12-26 11:00:00',
      modificadoPor: null,
      modificadoEn: null,
      cerradoPor: null,
      cerradoEn: null
    },
    observaciones: 'Requiere aprobación de Gerencia por costo superior a $1,500 USD',
    notasCierre: null,
    extras: []
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function OTStoreProvider({ children }: { children: React.ReactNode }) {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);

  useEffect(() => {
    if (ordenes.length === 0) {
      if (DEBUG_OT) {
        console.log('[OT_SEED_LOADING]', { seedSize: ordenesTrabajoSeed.length });
      }
      setOrdenes(ordenesTrabajoSeed);
    }
  }, []);

  const cargarOTsIniciales = useCallback(() => {
    if (ordenes.length === 0) {
      if (DEBUG_OT) {
        console.log('[OT_SEED_MANUAL_LOADING]', { seedSize: ordenesTrabajoSeed.length });
      }
      setOrdenes(ordenesTrabajoSeed);
    } else if (DEBUG_OT) {
      console.log('[OT_SEED_SKIP]', { reason: 'Ya hay OTs en el store', currentSize: ordenes.length });
    }
  }, [ordenes.length]);

  // Obtener OT por número
  const obtenerOTPorNumero = useCallback((numeroOT: string) => {
    return ordenes.find(ot => ot.numeroOT === numeroOT);
  }, [ordenes]);

  // Obtener OTs por vehículo
  const obtenerOTsPorVehiculo = useCallback((vehiculoId: string) => {
    return ordenes.filter(ot => ot.vehiculoId === vehiculoId);
  }, [ordenes]);

  // Crear nueva OT
  const crearOrdenTrabajo = useCallback((input: NuevaOrdenTrabajoInput): OrdenTrabajo => {
    // Obtener el último número secuencial
    const numeros = ordenes
      .map(ot => extraerNumeroSecuencial(ot.numeroOT))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo número OT
    const numeroOT = generarNumeroOT(ultimoNumero);
    const id = `OT-${ultimoNumero + 1}`.padStart(7, '0');

    // Usuario actual (mock - en producción viene del auth context)
    const usuarioActual = 'admin@kesa.com';
    const timestamp = new Date().toISOString();

    // Calcular costos totales
    const costos = input.costos || { manoObra: 0, repuestos: 0, terceros: 0, otros: 0 };
    const total = costos.manoObra + costos.repuestos + costos.terceros + costos.otros;

    // Determinar estado inicial basado en costo total
    const estadoInicial = determinarEstadoInicial(total);

    // Crear objeto OT
    const nuevaOT: OrdenTrabajo = {
      id,
      numeroOT,
      vehiculoId: input.vehiculoId,
      vehiculoPlaca: input.vehiculoPlaca,
      tipo: input.tipo,
      criticidad: input.criticidad,
      estado: estadoInicial,
      titulo: input.titulo,
      descripcion: input.descripcion,
      fechaCreacion: timestamp,
      fechaProgramada: input.fechaProgramada,
      fechaInicio: null,
      fechaCierre: null,
      slaEstimado: input.slaEstimado,
      slaReal: null,
      kilometrajeRegistro: input.kilometrajeRegistro,
      taller: input.taller,
      repuestos: [],
      costos: {
        ...costos,
        total
      },
      auditoria: {
        creadoPor: usuarioActual,
        creadoEn: timestamp,
        modificadoPor: null,
        modificadoEn: null,
        cerradoPor: null,
        cerradoEn: null
      },
      observaciones: input.observaciones || null,
      notasCierre: null,
      extras: []
    };

    // Agregar al INICIO del store para visibilidad inmediata
    const sizeBeforeAdd = ordenes.length;
    setOrdenes(prev => {
      const newState = [nuevaOT, ...prev];
      
      if (DEBUG_OT) {
        console.log('[OT_CREATED]', {
          numeroOT: nuevaOT.numeroOT,
          estadoKey: nuevaOT.estado,
          costoTotal: total,
          sizeAfter: newState.length,
          sizeBefore: sizeBeforeAdd,
          position: 'FIRST'
        });
      }
      
      return newState;
    });

    if (DEBUG_OT) {
      console.log('[OT_STORE_AFTER_CREATE]', {
        totalOTs: ordenes.length + 1,
        nuevaOT: {
          numeroOT: nuevaOT.numeroOT,
          titulo: nuevaOT.titulo,
          estado: nuevaOT.estado
        }
      });
    }

    return nuevaOT;
  }, [ordenes]);

  // Actualizar estado de OT
  const actualizarEstadoOT = useCallback((numeroOT: string, nuevoEstado: EstadoOT) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...ot,
          estado: nuevoEstado,
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp,
            ...(nuevoEstado === 'cerrada' || nuevoEstado === 'anulada' ? {
              cerradoPor: usuarioActual,
              cerradoEn: timestamp
            } : {})
          }
        };
      }
      return ot;
    }));
  }, []);

  // Iniciar OT
  const iniciarOT = useCallback((numeroOT: string) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...ot,
          estado: 'en_ejecucion',
          fechaInicio: timestamp,
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp
          }
        };
      }
      return ot;
    }));
  }, []);

  // Pausar OT
  const pausarOT = useCallback((numeroOT: string) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...ot,
          estado: 'pausada',
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp
          }
        };
      }
      return ot;
    }));
  }, []);

  // Aprobar OT
  const aprobarOT = useCallback((numeroOT: string) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...ot,
          estado: 'en_ejecucion',
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp
          }
        };
      }
      return ot;
    }));
  }, []);

  // Cerrar OT
  const cerrarOT = useCallback((numeroOT: string, notasCierre?: string) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...ot,
          estado: 'cerrada',
          fechaCierre: timestamp,
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp,
            cerradoPor: usuarioActual,
            cerradoEn: timestamp
          },
          notasCierre: notasCierre || null
        };
      }
      return ot;
    }));
  }, []);

  // Anular OT
  const anularOT = useCallback((numeroOT: string, motivo: string) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...ot,
          estado: 'anulada',
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp,
            cerradoPor: usuarioActual,
            cerradoEn: timestamp
          },
          notasCierre: motivo
        };
      }
      return ot;
    }));
  }, []);

  // Agregar extra a OT
  const agregarExtra = useCallback((numeroOT: string, extra: OTExtraItem) => {
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        return {
          ...ot,
          extras: [...ot.extras, extra]
        };
      }
      return ot;
    }));
  }, []);

  // Eliminar extra de OT (soft delete)
  const eliminarExtra = useCallback((numeroOT: string, extraId: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    const usuarioActual = 'admin@kesa.com';
    
    setOrdenes(prev => prev.map(ot => {
      if (ot.numeroOT === numeroOT) {
        return {
          ...ot,
          extras: ot.extras.map(extra => 
            extra.id === extraId
              ? {
                  ...extra,
                  eliminado: true,
                  motivoEliminacion: motivo,
                  eliminadoPor: usuarioActual,
                  fechaEliminacion: timestamp
                }
              : extra
          ),
          auditoria: {
            ...ot.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp
          }
        };
      }
      return ot;
    }));
  }, []);

  const value: OTStoreContext = {
    ordenes,
    obtenerOTPorNumero,
    obtenerOTsPorVehiculo,
    crearOrdenTrabajo,
    actualizarEstadoOT,
    iniciarOT,
    pausarOT,
    aprobarOT,
    cerrarOT,
    anularOT,
    agregarExtra,
    eliminarExtra,
    cargarOTsIniciales
  };

  return <OTContext.Provider value={value}>{children}</OTContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOTStore() {
  const context = useContext(OTContext);
  if (!context) {
    throw new Error('useOTStore debe usarse dentro de OTStoreProvider');
  }
  return context;
}