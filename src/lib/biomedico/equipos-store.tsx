/**
 * STORE DE EQUIPOS BIOMÉDICOS
 * Context global para gestión de equipos en el módulo Biomédico
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  generarCodigoEquipo, 
  extraerNumeroSecuencial,
  DEBUG_BIOMEDICO,
  type EstadoEquipoBiomedico, 
  type CategoriaEquipoBiomedico, 
  type RiesgoBiomedico 
} from './equipos-config';

// ============================================================================
// TIPOS
// ============================================================================

export interface EquipoBiomedico {
  // Identificación
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;
  
  // Clasificación
  categoria: CategoriaEquipoBiomedico;
  riesgo: RiesgoBiomedico;
  estado: EstadoEquipoBiomedico;
  
  // Ubicación
  ubicacion: {
    area: string;
    subarea: string;
    responsable: string;
  };
  
  // Características técnicas
  especificaciones: {
    voltaje?: string;
    potencia?: string;
    frecuencia?: string;
    dimensiones?: string;
    peso?: string;
  };
  
  // Fechas importantes
  fechaAdquisicion: string;
  fechaInstalacion: string;
  fechaUltimoMantenimiento: string | null;
  fechaProximoMantenimiento: string;
  fechaUltimaCalibracion: string | null;
  fechaProximaCalibracion: string | null;
  
  // Garantía
  garantia: {
    proveedor: string;
    fechaInicio: string;
    fechaVencimiento: string;
    vigente: boolean;
  };
  
  // Costos
  costos: {
    adquisicion: number;
    mantenimientoPreventivoAnual: number;
    mantenimientoCorrectivo: number;
    calibracion: number;
  };
  
  // Auditoría obligatoria
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
  };
  
  // Observaciones
  observaciones: string | null;
}

export interface NuevoEquipoBiomedicoInput {
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;
  categoria: CategoriaEquipoBiomedico;
  riesgo: RiesgoBiomedico;
  ubicacion: {
    area: string;
    subarea: string;
    responsable: string;
  };
  especificaciones?: {
    voltaje?: string;
    potencia?: string;
    frecuencia?: string;
    dimensiones?: string;
    peso?: string;
  };
  fechaAdquisicion: string;
  fechaInstalacion: string;
  garantia: {
    proveedor: string;
    fechaInicio: string;
    fechaVencimiento: string;
  };
  costos: {
    adquisicion: number;
    mantenimientoPreventivoAnual: number;
  };
  observaciones?: string;
}

interface EquiposStoreContext {
  equipos: EquipoBiomedico[];
  obtenerEquipoPorCodigo: (codigo: string) => EquipoBiomedico | undefined;
  obtenerEquipoPorId: (id: string) => EquipoBiomedico | undefined;
  obtenerEquiposPorCategoria: (categoria: CategoriaEquipoBiomedico) => EquipoBiomedico[];
  obtenerEquiposPorEstado: (estado: EstadoEquipoBiomedico) => EquipoBiomedico[];
  crearEquipo: (input: NuevoEquipoBiomedicoInput) => EquipoBiomedico;
  actualizarEquipo: (codigo: string, input: Partial<NuevoEquipoBiomedicoInput>) => void;
  actualizarEstadoEquipo: (codigo: string, nuevoEstado: EstadoEquipoBiomedico) => void;
  cargarEquiposIniciales: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const EquiposContext = createContext<EquiposStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const equiposSeed: EquipoBiomedico[] = [
  {
    id: 'EB-001',
    codigo: 'EB-2024-001',
    nombre: 'Ventilador Mecánico',
    marca: 'Dräger',
    modelo: 'Savina 300',
    serie: 'SN-VM-2024-001',
    categoria: 'soporte_vital',
    riesgo: 'critico',
    estado: 'operativo',
    ubicacion: {
      area: 'UCI',
      subarea: 'Cama 3',
      responsable: 'Dr. Carlos Mendoza'
    },
    especificaciones: {
      voltaje: '220V',
      potencia: '150W',
      frecuencia: '50/60Hz',
      dimensiones: '35x40x120cm',
      peso: '25kg'
    },
    fechaAdquisicion: '2024-01-15',
    fechaInstalacion: '2024-02-01',
    fechaUltimoMantenimiento: '2024-11-01',
    fechaProximoMantenimiento: '2025-01-15',
    fechaUltimaCalibracion: '2024-11-01',
    fechaProximaCalibracion: '2025-01-15',
    garantia: {
      proveedor: 'Dräger Medical Perú',
      fechaInicio: '2024-02-01',
      fechaVencimiento: '2027-02-01',
      vigente: true
    },
    costos: {
      adquisicion: 45000.00,
      mantenimientoPreventivoAnual: 2500.00,
      mantenimientoCorrectivo: 0,
      calibracion: 800.00
    },
    auditoria: {
      creadoPor: 'sistema.automatico@kesa.com',
      creadoEn: '2024-01-15 10:00:00',
      modificadoPor: null,
      modificadoEn: null
    },
    observaciones: 'Equipo crítico para soporte vital en UCI'
  },
  {
    id: 'EB-002',
    codigo: 'EB-2024-002',
    nombre: 'Ecógrafo',
    marca: 'GE Healthcare',
    modelo: 'Voluson E10',
    serie: 'SN-ECO-2024-002',
    categoria: 'diagnostico',
    riesgo: 'medio',
    estado: 'operativo',
    ubicacion: {
      area: 'Radiología',
      subarea: 'Sala de Ecografía',
      responsable: 'Dra. Ana García'
    },
    especificaciones: {
      voltaje: '220V',
      potencia: '300W',
      frecuencia: '50/60Hz',
      dimensiones: '60x80x150cm',
      peso: '85kg'
    },
    fechaAdquisicion: '2024-03-20',
    fechaInstalacion: '2024-04-05',
    fechaUltimoMantenimiento: '2024-10-05',
    fechaProximoMantenimiento: '2025-04-05',
    fechaUltimaCalibracion: '2024-10-05',
    fechaProximaCalibracion: '2025-04-05',
    garantia: {
      proveedor: 'GE Healthcare Perú',
      fechaInicio: '2024-04-05',
      fechaVencimiento: '2026-04-05',
      vigente: true
    },
    costos: {
      adquisicion: 85000.00,
      mantenimientoPreventivoAnual: 3500.00,
      mantenimientoCorrectivo: 0,
      calibracion: 1200.00
    },
    auditoria: {
      creadoPor: 'juan.perez@kesa.com',
      creadoEn: '2024-03-20 14:30:00',
      modificadoPor: null,
      modificadoEn: null
    },
    observaciones: null
  },
  {
    id: 'EB-003',
    codigo: 'EB-2024-003',
    nombre: 'Monitor de Signos Vitales',
    marca: 'Philips',
    modelo: 'IntelliVue MX450',
    serie: 'SN-MSV-2024-003',
    categoria: 'diagnostico',
    riesgo: 'alto',
    estado: 'mantenimiento',
    ubicacion: {
      area: 'Emergencia',
      subarea: 'Trauma Shock',
      responsable: 'Dr. Luis Torres'
    },
    especificaciones: {
      voltaje: '220V',
      potencia: '100W',
      frecuencia: '50/60Hz',
      dimensiones: '30x25x35cm',
      peso: '5kg'
    },
    fechaAdquisicion: '2024-02-10',
    fechaInstalacion: '2024-02-15',
    fechaUltimoMantenimiento: '2024-12-20',
    fechaProximoMantenimiento: '2025-01-05',
    fechaUltimaCalibracion: '2024-08-15',
    fechaProximaCalibracion: '2025-02-15',
    garantia: {
      proveedor: 'Philips Medical Perú',
      fechaInicio: '2024-02-15',
      fechaVencimiento: '2027-02-15',
      vigente: true
    },
    costos: {
      adquisicion: 12000.00,
      mantenimientoPreventivoAnual: 1200.00,
      mantenimientoCorrectivo: 450.00,
      calibracion: 300.00
    },
    auditoria: {
      creadoPor: 'ana.garcia@kesa.com',
      creadoEn: '2024-02-10 09:00:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-12-20 11:30:00'
    },
    observaciones: 'En mantenimiento preventivo programado - Reemplazo de sensor de temperatura'
  },
  {
    id: 'EB-004',
    codigo: 'EB-2024-004',
    nombre: 'Desfibrilador',
    marca: 'ZOLL',
    modelo: 'R Series Plus',
    serie: 'SN-DEF-2024-004',
    categoria: 'terapeutico',
    riesgo: 'critico',
    estado: 'operativo',
    ubicacion: {
      area: 'Emergencia',
      subarea: 'Reanimación',
      responsable: 'Dr. Roberto Jiménez'
    },
    especificaciones: {
      voltaje: '220V',
      potencia: '200W',
      frecuencia: '50/60Hz',
      dimensiones: '28x32x38cm',
      peso: '8.5kg'
    },
    fechaAdquisicion: '2024-05-12',
    fechaInstalacion: '2024-05-20',
    fechaUltimoMantenimiento: '2024-11-20',
    fechaProximoMantenimiento: '2025-01-10',
    fechaUltimaCalibracion: '2024-11-20',
    fechaProximaCalibracion: '2025-01-10',
    garantia: {
      proveedor: 'ZOLL Medical Perú',
      fechaInicio: '2024-05-20',
      fechaVencimiento: '2029-05-20',
      vigente: true
    },
    costos: {
      adquisicion: 28000.00,
      mantenimientoPreventivoAnual: 1800.00,
      mantenimientoCorrectivo: 0,
      calibracion: 600.00
    },
    auditoria: {
      creadoPor: 'juan.perez@kesa.com',
      creadoEn: '2024-05-12 16:00:00',
      modificadoPor: null,
      modificadoEn: null
    },
    observaciones: 'Equipo crítico de emergencia - Inspección diaria obligatoria'
  },
  {
    id: 'EB-005',
    codigo: 'EB-2024-005',
    nombre: 'Bomba de Infusión',
    marca: 'B. Braun',
    modelo: 'Infusomat Space',
    serie: 'SN-INF-2024-005',
    categoria: 'terapeutico',
    riesgo: 'alto',
    estado: 'calibracion',
    ubicacion: {
      area: 'UCI',
      subarea: 'Cama 7',
      responsable: 'Dr. Carlos Mendoza'
    },
    especificaciones: {
      voltaje: '220V',
      potencia: '50W',
      frecuencia: '50/60Hz',
      dimensiones: '18x22x28cm',
      peso: '2.5kg'
    },
    fechaAdquisicion: '2024-06-01',
    fechaInstalacion: '2024-06-10',
    fechaUltimoMantenimiento: '2024-12-10',
    fechaProximoMantenimiento: '2025-03-10',
    fechaUltimaCalibracion: '2024-09-10',
    fechaProximaCalibracion: '2025-01-02',
    garantia: {
      proveedor: 'B. Braun Medical Perú',
      fechaInicio: '2024-06-10',
      fechaVencimiento: '2027-06-10',
      vigente: true
    },
    costos: {
      adquisicion: 8500.00,
      mantenimientoPreventivoAnual: 850.00,
      mantenimientoCorrectivo: 0,
      calibracion: 250.00
    },
    auditoria: {
      creadoPor: 'ana.garcia@kesa.com',
      creadoEn: '2024-06-01 11:00:00',
      modificadoPor: 'carlos.mendoza@kesa.com',
      modificadoEn: '2024-12-26 08:00:00'
    },
    observaciones: 'En proceso de calibración programada - Laboratorio externo'
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function EquiposStoreProvider({ children }: { children: React.ReactNode }) {
  const [equipos, setEquipos] = useState<EquipoBiomedico[]>([]);

  useEffect(() => {
    if (equipos.length === 0) {
      if (DEBUG_BIOMEDICO) {
        console.log('[EQUIPOS_SEED_LOADING]', { seedSize: equiposSeed.length });
      }
      setEquipos(equiposSeed);
    }
  }, []);

  const cargarEquiposIniciales = useCallback(() => {
    if (equipos.length === 0) {
      if (DEBUG_BIOMEDICO) {
        console.log('[EQUIPOS_SEED_MANUAL_LOADING]', { seedSize: equiposSeed.length });
      }
      setEquipos(equiposSeed);
    } else if (DEBUG_BIOMEDICO) {
      console.log('[EQUIPOS_SEED_SKIP]', { reason: 'Ya hay equipos en el store', currentSize: equipos.length });
    }
  }, [equipos.length]);

  // Obtener equipo por código
  const obtenerEquipoPorCodigo = useCallback((codigo: string) => {
    return equipos.find(eq => eq.codigo === codigo);
  }, [equipos]);

  // Obtener equipo por ID
  const obtenerEquipoPorId = useCallback((id: string) => {
    return equipos.find(eq => eq.id === id);
  }, [equipos]);

  // Obtener equipos por categoría
  const obtenerEquiposPorCategoria = useCallback((categoria: CategoriaEquipoBiomedico) => {
    return equipos.filter(eq => eq.categoria === categoria);
  }, [equipos]);

  // Obtener equipos por estado
  const obtenerEquiposPorEstado = useCallback((estado: EstadoEquipoBiomedico) => {
    return equipos.filter(eq => eq.estado === estado);
  }, [equipos]);

  // Crear nuevo equipo
  const crearEquipo = useCallback((input: NuevoEquipoBiomedicoInput): EquipoBiomedico => {
    // Obtener el último número secuencial
    const numeros = equipos
      .map(eq => extraerNumeroSecuencial(eq.codigo))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo código
    const codigo = generarCodigoEquipo(ultimoNumero);
    const id = `EB-${(ultimoNumero + 1).toString().padStart(3, '0')}`;

    // Usuario actual (mock - en producción viene del auth context)
    const usuarioActual = 'admin@kesa.com';
    const timestamp = new Date().toISOString();

    // Calcular fecha próximo mantenimiento (180 días por defecto)
    const fechaProximoMant = new Date(input.fechaInstalacion);
    fechaProximoMant.setDate(fechaProximoMant.getDate() + 180);

    // Calcular vigencia de garantía
    const hoy = new Date();
    const vencimientoGarantia = new Date(input.garantia.fechaVencimiento);
    const garantiaVigente = hoy < vencimientoGarantia;

    // Crear objeto equipo
    const nuevoEquipo: EquipoBiomedico = {
      id,
      codigo,
      nombre: input.nombre,
      marca: input.marca,
      modelo: input.modelo,
      serie: input.serie,
      categoria: input.categoria,
      riesgo: input.riesgo,
      estado: 'operativo',
      ubicacion: input.ubicacion,
      especificaciones: input.especificaciones || {},
      fechaAdquisicion: input.fechaAdquisicion,
      fechaInstalacion: input.fechaInstalacion,
      fechaUltimoMantenimiento: null,
      fechaProximoMantenimiento: fechaProximoMant.toISOString().split('T')[0],
      fechaUltimaCalibracion: null,
      fechaProximaCalibracion: null,
      garantia: {
        ...input.garantia,
        vigente: garantiaVigente
      },
      costos: {
        adquisicion: input.costos.adquisicion,
        mantenimientoPreventivoAnual: input.costos.mantenimientoPreventivoAnual,
        mantenimientoCorrectivo: 0,
        calibracion: 0
      },
      auditoria: {
        creadoPor: usuarioActual,
        creadoEn: timestamp,
        modificadoPor: null,
        modificadoEn: null
      },
      observaciones: input.observaciones || null
    };

    // Agregar al INICIO del store para visibilidad inmediata
    setEquipos(prev => {
      const newState = [nuevoEquipo, ...prev];
      
      if (DEBUG_BIOMEDICO) {
        console.log('[EQUIPO_CREATED]', {
          codigo: nuevoEquipo.codigo,
          nombre: nuevoEquipo.nombre,
          estado: nuevoEquipo.estado,
          sizeAfter: newState.length
        });
      }
      
      return newState;
    });

    return nuevoEquipo;
  }, [equipos]);

  // Actualizar equipo
  const actualizarEquipo = useCallback((codigo: string, input: Partial<NuevoEquipoBiomedicoInput>) => {
    setEquipos(prev => prev.map(eq => {
      if (eq.codigo === codigo) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...eq,
          ...(input.nombre && { nombre: input.nombre }),
          ...(input.marca && { marca: input.marca }),
          ...(input.modelo && { modelo: input.modelo }),
          ...(input.serie && { serie: input.serie }),
          ...(input.categoria && { categoria: input.categoria }),
          ...(input.riesgo && { riesgo: input.riesgo }),
          ...(input.ubicacion && { ubicacion: input.ubicacion }),
          ...(input.especificaciones && { especificaciones: input.especificaciones }),
          ...(input.observaciones !== undefined && { observaciones: input.observaciones }),
          auditoria: {
            ...eq.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp
          }
        };
      }
      return eq;
    }));
  }, []);

  // Actualizar estado de equipo
  const actualizarEstadoEquipo = useCallback((codigo: string, nuevoEstado: EstadoEquipoBiomedico) => {
    setEquipos(prev => prev.map(eq => {
      if (eq.codigo === codigo) {
        const timestamp = new Date().toISOString();
        const usuarioActual = 'admin@kesa.com';

        return {
          ...eq,
          estado: nuevoEstado,
          auditoria: {
            ...eq.auditoria,
            modificadoPor: usuarioActual,
            modificadoEn: timestamp
          }
        };
      }
      return eq;
    }));
  }, []);

  const value: EquiposStoreContext = {
    equipos,
    obtenerEquipoPorCodigo,
    obtenerEquipoPorId,
    obtenerEquiposPorCategoria,
    obtenerEquiposPorEstado,
    crearEquipo,
    actualizarEquipo,
    actualizarEstadoEquipo,
    cargarEquiposIniciales
  };

  return <EquiposContext.Provider value={value}>{children}</EquiposContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useEquiposStore() {
  const context = useContext(EquiposContext);
  if (!context) {
    throw new Error('useEquiposStore debe usarse dentro de EquiposStoreProvider');
  }
  return context;
}
