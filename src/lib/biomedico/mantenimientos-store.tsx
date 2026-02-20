/**
 * STORE DE MANTENIMIENTOS BIOMÉDICOS
 * Context global para gestión de mantenimientos en el módulo Biomédico
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  generarNumeroMantenimiento, 
  extraerNumeroSecuencial,
  DEBUG_MANTENIMIENTO_BIO,
  type EstadoMantenimientoBio, 
  type TipoMantenimientoBio, 
  type PrioridadMantenimientoBio 
} from './mantenimientos-config';

// ============================================================================
// TIPOS
// ============================================================================

export interface MantenimientoBiomedico {
  // Identificación
  id: string;
  numeroMantenimiento: string;
  equipoId: string;
  equipoCodigo: string;
  equipoNombre: string;
  
  // Clasificación
  tipo: TipoMantenimientoBio;
  prioridad: PrioridadMantenimientoBio;
  estado: EstadoMantenimientoBio;
  
  // Descripción
  titulo: string;
  descripcion: string;
  
  // Fechas
  fechaCreacion: string;
  fechaProgramada: string;
  fechaInicio: string | null;
  fechaCompletado: string | null;
  
  // Responsables
  tecnico: {
    id: string;
    nombre: string;
    empresa: string; // 'Interno' o nombre proveedor
  };
  
  // Actividades realizadas
  actividadesRealizadas: string | null;
  repuestosUtilizados: Array<{
    nombre: string;
    cantidad: number;
    observacion?: string;
  }>;
  
  // Auditoría obligatoria
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    completadoPor: string | null;
    completadoEn: string | null;
  };
  
  // Observaciones
  observaciones: string | null;
}

export interface NuevoMantenimientoBiomedicoInput {
  equipoId: string;
  equipoCodigo: string;
  equipoNombre: string;
  tipo: TipoMantenimientoBio;
  prioridad: PrioridadMantenimientoBio;
  titulo: string;
  descripcion: string;
  fechaProgramada: string;
  tecnico: {
    id: string;
    nombre: string;
    empresa: string;
  };
  observaciones?: string;
}

interface MantenimientosStoreContext {
  mantenimientos: MantenimientoBiomedico[];
  obtenerMantenimientoPorNumero: (numero: string) => MantenimientoBiomedico | undefined;
  obtenerMantenimientosPorEquipo: (equipoId: string) => MantenimientoBiomedico[];
  crearMantenimiento: (input: NuevoMantenimientoBiomedicoInput) => MantenimientoBiomedico;
  actualizarEstadoMantenimiento: (numero: string, nuevoEstado: EstadoMantenimientoBio) => void;
  cargarMantenimientosIniciales: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const MantenimientosContext = createContext<MantenimientosStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const mantenimientosSeed: MantenimientoBiomedico[] = [
  {
    id: 'MB-001',
    numeroMantenimiento: 'MB-2024-001',
    equipoId: 'EB-001',
    equipoCodigo: 'EB-2024-001',
    equipoNombre: 'Ventilador Mecánico',
    tipo: 'preventivo',
    prioridad: 'alta',
    estado: 'completado',
    titulo: 'Mantenimiento Preventivo Trimestral',
    descripcion: 'Revisión general de sistema neumático, sensores y calibración de parámetros ventilatorios',
    fechaCreacion: '2024-10-15 09:00',
    fechaProgramada: '2024-11-01 08:00',
    fechaInicio: '2024-11-01 08:15',
    fechaCompletado: '2024-11-01 12:30',
    tecnico: {
      id: 'TEC-001',
      nombre: 'Ing. Roberto Vega',
      empresa: 'Dräger Medical Perú'
    },
    actividadesRealizadas: 'Limpieza de circuitos neumáticos, verificación de fugas, calibración de sensores de presión y flujo, actualización de firmware a v3.2.1',
    repuestosUtilizados: [
      {
        nombre: 'Filtro HEPA',
        cantidad: 2,
        observacion: 'Reemplazo programado'
      },
      {
        nombre: 'Sensor de O2',
        cantidad: 1,
        observacion: 'Por desgaste'
      }
    ],
    auditoria: {
      creadoPor: 'sistema.automatico@kesa.com',
      creadoEn: '2024-10-15 09:00:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-11-01 08:15:00',
      completadoPor: 'carlos.mendoza@kesa.com',
      completadoEn: '2024-11-01 12:30:00'
    },
    observaciones: 'Equipo funcionando correctamente. Próximo mantenimiento en 90 días'
  },
  {
    id: 'MB-002',
    numeroMantenimiento: 'MB-2024-002',
    equipoId: 'EB-003',
    equipoCodigo: 'EB-2024-003',
    equipoNombre: 'Monitor de Signos Vitales',
    tipo: 'correctivo',
    prioridad: 'urgente',
    estado: 'en_ejecucion',
    titulo: 'Falla en sensor de temperatura',
    descripcion: 'Reemplazo de sensor de temperatura defectuoso - Lecturas erráticas detectadas',
    fechaCreacion: '2024-12-20 14:30',
    fechaProgramada: '2024-12-21 08:00',
    fechaInicio: '2024-12-21 08:10',
    fechaCompletado: null,
    tecnico: {
      id: 'TEC-002',
      nombre: 'Ing. María Campos',
      empresa: 'Interno'
    },
    actividadesRealizadas: null,
    repuestosUtilizados: [],
    auditoria: {
      creadoPor: 'ana.garcia@kesa.com',
      creadoEn: '2024-12-20 14:30:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-12-21 08:10:00',
      completadoPor: null,
      completadoEn: null
    },
    observaciones: 'Sensor en tránsito desde proveedor - ETA 24 horas'
  },
  {
    id: 'MB-003',
    numeroMantenimiento: 'MB-2024-003',
    equipoId: 'EB-005',
    equipoCodigo: 'EB-2024-005',
    equipoNombre: 'Bomba de Infusión',
    tipo: 'calibracion',
    prioridad: 'media',
    estado: 'programado',
    titulo: 'Calibración Semestral',
    descripcion: 'Calibración metrológica programada según normativa - Verificación de precisión de flujo',
    fechaCreacion: '2024-12-15 10:00',
    fechaProgramada: '2025-01-02 09:00',
    fechaInicio: null,
    fechaCompletado: null,
    tecnico: {
      id: 'TEC-003',
      nombre: 'Lab. Metrología INDECOPI',
      empresa: 'INDECOPI Perú'
    },
    actividadesRealizadas: null,
    repuestosUtilizados: [],
    auditoria: {
      creadoPor: 'sistema.automatico@kesa.com',
      creadoEn: '2024-12-15 10:00:00',
      modificadoPor: null,
      modificadoEn: null,
      completadoPor: null,
      completadoEn: null
    },
    observaciones: 'Calibración en laboratorio externo acreditado - Duración estimada 2 días'
  },
  {
    id: 'MB-004',
    numeroMantenimiento: 'MB-2024-004',
    equipoId: 'EB-002',
    equipoCodigo: 'EB-2024-002',
    equipoNombre: 'Ecógrafo',
    tipo: 'preventivo',
    prioridad: 'media',
    estado: 'completado',
    titulo: 'Mantenimiento Preventivo Semestral',
    descripcion: 'Revisión general de transductores, sistema de imagen y limpieza profunda',
    fechaCreacion: '2024-09-20 11:00',
    fechaProgramada: '2024-10-05 08:00',
    fechaInicio: '2024-10-05 08:20',
    fechaCompletado: '2024-10-05 14:30',
    tecnico: {
      id: 'TEC-004',
      nombre: 'Ing. Luis Fernández',
      empresa: 'GE Healthcare Perú'
    },
    actividadesRealizadas: 'Limpieza y desinfección de transductores, verificación de conectores, actualización de software, calibración de parámetros de imagen',
    repuestosUtilizados: [
      {
        nombre: 'Gel conductor',
        cantidad: 5,
        observacion: 'Stock de consumibles'
      }
    ],
    auditoria: {
      creadoPor: 'sistema.automatico@kesa.com',
      creadoEn: '2024-09-20 11:00:00',
      modificadoPor: 'juan.perez@kesa.com',
      modificadoEn: '2024-10-05 08:20:00',
      completadoPor: 'juan.perez@kesa.com',
      completadoEn: '2024-10-05 14:30:00'
    },
    observaciones: 'Equipo en óptimas condiciones - Sin observaciones'
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function MantenimientosStoreProvider({ children }: { children: React.ReactNode }) {
  const [mantenimientos, setMantenimientos] = useState<MantenimientoBiomedico[]>([]);

  useEffect(() => {
    if (mantenimientos.length === 0) {
      if (DEBUG_MANTENIMIENTO_BIO) {
        console.log('[MANTENIMIENTOS_SEED_LOADING]', { seedSize: mantenimientosSeed.length });
      }
      setMantenimientos(mantenimientosSeed);
    }
  }, []);

  const cargarMantenimientosIniciales = useCallback(() => {
    if (mantenimientos.length === 0) {
      if (DEBUG_MANTENIMIENTO_BIO) {
        console.log('[MANTENIMIENTOS_SEED_MANUAL_LOADING]', { seedSize: mantenimientosSeed.length });
      }
      setMantenimientos(mantenimientosSeed);
    } else if (DEBUG_MANTENIMIENTO_BIO) {
      console.log('[MANTENIMIENTOS_SEED_SKIP]', { reason: 'Ya hay mantenimientos en el store', currentSize: mantenimientos.length });
    }
  }, [mantenimientos.length]);

  // Obtener mantenimiento por número
  const obtenerMantenimientoPorNumero = useCallback((numero: string) => {
    return mantenimientos.find(mant => mant.numeroMantenimiento === numero);
  }, [mantenimientos]);

  // Obtener mantenimientos por equipo
  const obtenerMantenimientosPorEquipo = useCallback((equipoId: string) => {
    return mantenimientos.filter(mant => mant.equipoId === equipoId);
  }, [mantenimientos]);

  // Crear nuevo mantenimiento
  const crearMantenimiento = useCallback((input: NuevoMantenimientoBiomedicoInput): MantenimientoBiomedico => {
    // Obtener el último número secuencial
    const numeros = mantenimientos
      .map(mant => extraerNumeroSecuencial(mant.numeroMantenimiento))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo número
    const numeroMantenimiento = generarNumeroMantenimiento(ultimoNumero);
    const id = `MB-${(ultimoNumero + 1).toString().padStart(3, '0')}`;

    // Usuario actual (mock - en producción viene del auth context)
    const usuarioActual = 'admin@kesa.com';
    const timestamp = new Date().toISOString();

    // Crear objeto mantenimiento
    const nuevoMantenimiento: MantenimientoBiomedico = {
      id,
      numeroMantenimiento,
      equipoId: input.equipoId,
      equipoCodigo: input.equipoCodigo,
      equipoNombre: input.equipoNombre,
      tipo: input.tipo,
      prioridad: input.prioridad,
      estado: 'programado',
      titulo: input.titulo,
      descripcion: input.descripcion,
      fechaCreacion: timestamp,
      fechaProgramada: input.fechaProgramada,
      fechaInicio: null,
      fechaCompletado: null,
      tecnico: input.tecnico,
      actividadesRealizadas: null,
      repuestosUtilizados: [],
      auditoria: {
        creadoPor: usuarioActual,
        creadoEn: timestamp,
        modificadoPor: null,
        modificadoEn: null,
        completadoPor: null,
        completadoEn: null
      },
      observaciones: input.observaciones || null
    };

    // Agregar al INICIO del store para visibilidad inmediata
    setMantenimientos(prev => {
      const newState = [nuevoMantenimiento, ...prev];
      
      if (DEBUG_MANTENIMIENTO_BIO) {
        console.log('[MANTENIMIENTO_CREATED]', {
          numero: nuevoMantenimiento.numeroMantenimiento,
          equipoCodigo: nuevoMantenimiento.equipoCodigo,
          tipo: nuevoMantenimiento.tipo,
          sizeAfter: newState.length
        });
      }
      
      return newState;
    });

    return nuevoMantenimiento;
  }, [mantenimientos]);

  // Actualizar estado de mantenimiento
  const actualizarEstadoMantenimiento = useCallback((numero: string, nuevoEstado: EstadoMantenimientoBio) => {
    setMantenimientos(prev => prev.map(mant => {
      if (mant.numeroMantenimiento === numero) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...mant,
          estado: nuevoEstado,
          ...(nuevoEstado === 'en_ejecucion' && !mant.fechaInicio ? { fechaInicio: timestamp } : {}),
          ...(nuevoEstado === 'completado' ? { fechaCompletado: timestamp } : {}),
          auditoria: {
            ...mant.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp,
            ...(nuevoEstado === 'completado' ? {
              completadoPor: usuarioActual,
              completadoEn: timestamp
            } : {})
          }
        };
      }
      return mant;
    }));
  }, []);

  const value: MantenimientosStoreContext = {
    mantenimientos,
    obtenerMantenimientoPorNumero,
    obtenerMantenimientosPorEquipo,
    crearMantenimiento,
    actualizarEstadoMantenimiento,
    cargarMantenimientosIniciales
  };

  return <MantenimientosContext.Provider value={value}>{children}</MantenimientosContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMantenimientosStore() {
  const context = useContext(MantenimientosContext);
  if (!context) {
    throw new Error('useMantenimientosStore debe usarse dentro de MantenimientosStoreProvider');
  }
  return context;
}
