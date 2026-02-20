/**
 * KESA ERP - Flota → Vehículos Store
 * Context + Provider con CRUD completo y auditoría
 * v3.0.0 - Con soporte para contratos, plan preventivo y documentos
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Vehiculo,
  EstadoVehiculo,
  TipoVehiculo,
  VehiculoVinculoContrato,
  PlanPreventivoContratado,
  VehiculoDocumento,
  generateVehiculoId,
  normalizePlaca,
  validarVehiculo,
  validarMotivoInactivacion,
  validarVinculoContrato,
  validarPlanPreventivo,
  validarDocumento,
  generarDocumentoId,
  logDebug,
  DEBUG_VEHICULOS
} from './vehiculos-config';
import { generatePublicToken } from './vehicle-public';

// ============================================================================
// TYPES
// ============================================================================

interface VehiculosContextType {
  vehiculos: Vehiculo[];
  crearVehiculo: (data: Omit<Vehiculo, 'id' | 'creadoPor' | 'creadoEn' | 'estado'>) => { exito: boolean; vehiculoId?: string; errores?: string[] };
  actualizarVehiculo: (id: string, data: Partial<Vehiculo>) => { exito: boolean; errores?: string[] };
  inactivarVehiculo: (id: string, motivo: string) => { exito: boolean; errores?: string[] };
  activarVehiculo: (id: string) => { exito: boolean; errores?: string[] };
  obtenerVehiculo: (id: string) => Vehiculo | undefined;
  obtenerVehiculoPorToken: (token: string) => Vehiculo | undefined;
  obtenerVehiculosPorEstado: (estado: EstadoVehiculo) => Vehiculo[];
  obtenerVehiculosPorTipo: (tipo: TipoVehiculo) => Vehiculo[];
  buscarVehiculos: (query: string) => Vehiculo[];
  ensurePublicToken: (id: string) => void;
  // Contrato y Plan Preventivo
  actualizarVinculoContrato: (vehiculoId: string, vinculo: VehiculoVinculoContrato) => { exito: boolean; errores?: string[] };
  actualizarPlanPreventivo: (vehiculoId: string, plan: PlanPreventivoContratado) => { exito: boolean; errores?: string[] };
  // Documentos
  agregarDocumentoVehiculo: (vehiculoId: string, documento: Omit<VehiculoDocumento, 'id' | 'creadoPor' | 'creadoEn'>) => { exito: boolean; documentoId?: string; errores?: string[] };
  actualizarDocumentoVehiculo: (vehiculoId: string, documentoId: string, data: Partial<VehiculoDocumento>) => { exito: boolean; errores?: string[] };
  eliminarDocumentoVehiculo: (vehiculoId: string, documentoId: string) => { exito: boolean; errores?: string[] };
  obtenerDocumentosVehiculo: (vehiculoId: string) => VehiculoDocumento[];
}

const VehiculosContext = createContext<VehiculosContextType | undefined>(undefined);

// ============================================================================
// SEED DATA (Idempotente)
// ============================================================================

const SEED_VEHICULOS: Vehiculo[] = [
  {
    id: 'VH-001',
    placa: 'ABC-123',
    vin: 'WDB9066791N123456',
    tipo: 'ambulancia',
    marca: 'Mercedes Benz',
    modelo: 'Sprinter 316',
    año: 2022,
    color: 'Blanco',
    motor: 'OM651',
    combustible: 'diesel',
    capacidad: '3.5 ton',
    kilometraje: 48500,
    ubicacionActual: 'Base Central',
    estado: 'activo',
    ultimoMantenimiento: '2024-10-20',
    proximoMantenimiento: '2024-12-20',
    planPreventivo: {
      totalPreventivosContratados: 12,
      frecuenciaKm: 10000,
      frecuenciaDias: 90,
      inicioContrato: '2024-01-01',
      finContrato: '2025-12-31'
    },
    documentos: [
      {
        id: 'DOC-001',
        tipo: 'SOAT',
        numero: 'SOAT-2024-001',
        fechaEmision: '2024-01-15',
        fechaVencimiento: '2025-01-15'
      },
      {
        id: 'DOC-002',
        tipo: 'Revisión Técnica',
        numero: 'RT-2024-001',
        fechaEmision: '2024-03-10',
        fechaVencimiento: '2025-03-10'
      },
      {
        id: 'DOC-003',
        tipo: 'Seguro Vehicular',
        numero: 'SEG-2024-001',
        fechaEmision: '2024-01-01',
        fechaVencimiento: '2025-01-01'
      }
    ],
    publicViewEnabled: true,
    publicToken: generatePublicToken('VH-001'),
    creadoPor: 'admin@kesa.com',
    creadoEn: '2024-01-15T10:00:00Z'
  },
  {
    id: 'VH-002',
    placa: 'DEF-456',
    vin: 'JTDBT923781234567',
    tipo: 'camioneta',
    marca: 'Toyota',
    modelo: 'Hilux 4x4',
    año: 2021,
    color: 'Plateado',
    motor: '1GD-FTV',
    combustible: 'diesel',
    capacidad: '1 ton',
    kilometraje: 95800,
    ubicacionActual: 'Base Norte',
    estado: 'activo',
    ultimoMantenimiento: '2024-11-15',
    proximoMantenimiento: '2025-01-15',
    planPreventivo: {
      totalPreventivosContratados: 8,
      frecuenciaKm: 15000,
      frecuenciaDias: 120,
      inicioContrato: '2024-02-01',
      finContrato: '2025-12-31'
    },
    documentos: [
      {
        id: 'DOC-004',
        tipo: 'SOAT',
        numero: 'SOAT-2024-002',
        fechaEmision: '2024-02-10',
        fechaVencimiento: '2025-02-10'
      },
      {
        id: 'DOC-005',
        tipo: 'Revisión Técnica',
        numero: 'RT-2024-002',
        fechaEmision: '2024-04-05',
        fechaVencimiento: '2024-12-25' // Próximo a vencer
      }
    ],
    publicViewEnabled: true,
    publicToken: generatePublicToken('VH-002'),
    creadoPor: 'admin@kesa.com',
    creadoEn: '2024-02-10T14:30:00Z'
  },
  {
    id: 'VH-003',
    placa: 'GHI-789',
    vin: 'KMHSH81XDEU123456',
    tipo: 'van',
    marca: 'Hyundai',
    modelo: 'H-1',
    año: 2023,
    color: 'Negro',
    motor: 'D4CB',
    combustible: 'diesel',
    capacidad: '12 pasajeros',
    kilometraje: 32000,
    ubicacionActual: 'Base Sur',
    estado: 'activo',
    ultimoMantenimiento: '2024-11-25',
    proximoMantenimiento: '2025-01-02',
    planPreventivo: {
      totalPreventivosContratados: 6,
      frecuenciaKm: 8000,
      frecuenciaDias: 60,
      inicioContrato: '2024-03-01',
      finContrato: '2025-12-31'
    },
    documentos: [
      {
        id: 'DOC-006',
        tipo: 'SOAT',
        numero: 'SOAT-2024-003',
        fechaEmision: '2024-03-05',
        fechaVencimiento: '2024-11-20' // Vencido
      },
      {
        id: 'DOC-007',
        tipo: 'Tarjeta de Propiedad',
        numero: 'TP-789-2023',
        fechaEmision: '2023-01-10',
        observaciones: 'En trámite de renovación'
      }
    ],
    publicViewEnabled: true,
    publicToken: generatePublicToken('VH-003'),
    creadoPor: 'admin@kesa.com',
    creadoEn: '2024-03-05T09:15:00Z'
  },
  {
    id: 'VH-004',
    placa: 'JKL-012',
    vin: 'WDB9066791N654321',
    tipo: 'ambulancia',
    marca: 'Mercedes Benz',
    modelo: 'Sprinter 319',
    año: 2022,
    color: 'Blanco',
    motor: 'OM651',
    combustible: 'diesel',
    capacidad: '3.5 ton',
    kilometraje: 52000,
    ubicacionActual: 'Taller Externo',
    estado: 'en_taller',
    ultimoMantenimiento: '2024-11-20',
    proximoMantenimiento: '2025-01-10',
    documentos: [
      {
        id: 'DOC-008',
        tipo: 'SOAT',
        numero: 'SOAT-2024-004',
        fechaEmision: '2024-01-20',
        fechaVencimiento: '2025-01-20'
      }
    ],
    publicViewEnabled: true,
    publicToken: generatePublicToken('VH-004'),
    creadoPor: 'admin@kesa.com',
    creadoEn: '2024-01-20T11:00:00Z'
  },
  {
    id: 'VH-005',
    placa: 'MNO-345',
    vin: 'JN1TANS50U0123456',
    tipo: 'camioneta',
    marca: 'Nissan',
    modelo: 'Frontier',
    año: 2020,
    color: 'Azul',
    motor: 'YD25DDTi',
    combustible: 'diesel',
    capacidad: '1 ton',
    kilometraje: 78500,
    ubicacionActual: 'Base Este',
    estado: 'activo',
    ultimoMantenimiento: '2024-11-10',
    proximoMantenimiento: '2024-12-28',
    publicViewEnabled: true,
    publicToken: generatePublicToken('VH-005'),
    creadoPor: 'admin@kesa.com',
    creadoEn: '2024-02-15T16:45:00Z'
  },
  {
    id: 'VH-006',
    placa: 'PQR-678',
    tipo: 'auto',
    marca: 'Toyota',
    modelo: 'Corolla',
    año: 2019,
    color: 'Rojo',
    combustible: 'gasolina',
    capacidad: '5 pasajeros',
    kilometraje: 125000,
    ubicacionActual: 'Base Central',
    estado: 'inactivo',
    ultimoMantenimiento: '2024-08-15',
    publicViewEnabled: false, // Vista pública deshabilitada para vehículo inactivo
    publicToken: generatePublicToken('VH-006'),
    creadoPor: 'admin@kesa.com',
    creadoEn: '2023-12-01T08:30:00Z',
    inactivadoPor: 'admin@kesa.com',
    inactivadoEn: '2024-10-15T14:00:00Z',
    motivoInactivacion: 'Vehículo dado de baja por desgaste excesivo y alto costo de mantenimiento. Se decidió reemplazar por unidad más nueva.'
  }
];

const STORAGE_KEY = 'kesa_flota_vehiculos';

// ============================================================================
// PROVIDER
// ============================================================================

export function VehiculosStoreProvider({ children }: { children: ReactNode }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [inicializado, setInicializado] = useState(false);

  // Cargar datos del localStorage al iniciar (seed idempotente)
  useEffect(() => {
    if (inicializado) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        logDebug('Datos cargados desde localStorage:', parsed.length, 'vehículos');
        
        // Normalizar vehículos: asegurar que documentos sea siempre array
        const vehiculosNormalizados = parsed.map((v: Vehiculo) => ({
          ...v,
          documentos: v.documentos || [],
        }));
        
        setVehiculos(vehiculosNormalizados);
      } else {
        // Primera carga: usar seed (ya normalizado)
        logDebug('Primera carga: inicializando con seed data');
        const seedNormalizado = SEED_VEHICULOS.map(v => ({
          ...v,
          documentos: v.documentos || [],
        }));
        setVehiculos(seedNormalizado);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedNormalizado));
      }
    } catch (error) {
      console.error('[VEHICULOS] Error al cargar datos:', error);
      const seedNormalizado = SEED_VEHICULOS.map(v => ({
        ...v,
        documentos: v.documentos || [],
      }));
      setVehiculos(seedNormalizado);
    }
    
    setInicializado(true);
  }, [inicializado]);

  // Guardar en localStorage cada vez que cambian los vehículos
  useEffect(() => {
    if (!inicializado) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehiculos));
      logDebug('Datos guardados en localStorage:', vehiculos.length, 'vehículos');
    } catch (error) {
      console.error('[VEHICULOS] Error al guardar datos:', error);
    }
  }, [vehiculos, inicializado]);

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Crear nuevo vehículo
   */
  const crearVehiculo = (
    data: Omit<Vehiculo, 'id' | 'creadoPor' | 'creadoEn' | 'estado'>
  ): { exito: boolean; vehiculoId?: string; errores?: string[] } => {
    logDebug('Intentando crear vehículo:', data);

    // Validar datos
    const placasExistentes = vehiculos.map(v => normalizePlaca(v.placa));
    const vinsExistentes = vehiculos
      .filter(v => v.vin)
      .map(v => v.vin!.trim().toUpperCase());

    const validacion = validarVehiculo(data, placasExistentes, vinsExistentes);

    if (!validacion.valido) {
      logDebug('Validación fallida:', validacion.errores);
      return {
        exito: false,
        errores: validacion.errores
      };
    }

    // Generar ID
    const nuevoId = generateVehiculoId(vehiculos);

    // Crear vehículo con auditoría
    const nuevoVehiculo: Vehiculo = {
      ...data,
      id: nuevoId,
      placa: normalizePlaca(data.placa),
      vin: data.vin ? data.vin.trim().toUpperCase() : undefined,
      estado: 'activo',
      publicViewEnabled: data.publicViewEnabled ?? true, // Default: habilitado
      publicToken: data.publicToken || generatePublicToken(nuevoId), // Genera token si no viene
      creadoPor: 'admin@kesa.com', // TODO: obtener de contexto de usuario
      creadoEn: new Date().toISOString()
    };

    setVehiculos(prev => [...prev, nuevoVehiculo]);

    logDebug('Vehículo creado exitosamente:', nuevoId);

    return {
      exito: true,
      vehiculoId: nuevoId
    };
  };

  /**
   * Actualizar vehículo existente
   */
  const actualizarVehiculo = (
    id: string,
    data: Partial<Vehiculo>
  ): { exito: boolean; errores?: string[] } => {
    logDebug('Intentando actualizar vehículo:', id, data);

    const vehiculoExistente = vehiculos.find(v => v.id === id);

    if (!vehiculoExistente) {
      return {
        exito: false,
        errores: ['Vehículo no encontrado']
      };
    }

    // No permitir cambiar placa en edición (o validar que no exista)
    if (data.placa && normalizePlaca(data.placa) !== normalizePlaca(vehiculoExistente.placa)) {
      return {
        exito: false,
        errores: ['No se permite cambiar la placa del vehículo']
      };
    }

    // Validar datos actualizados
    const vehiculoActualizado = { ...vehiculoExistente, ...data };
    
    const placasExistentes = vehiculos
      .filter(v => v.id !== id)
      .map(v => normalizePlaca(v.placa));
    
    const vinsExistentes = vehiculos
      .filter(v => v.id !== id && v.vin)
      .map(v => v.vin!.trim().toUpperCase());

    const validacion = validarVehiculo(
      vehiculoActualizado,
      placasExistentes,
      vinsExistentes,
      id
    );

    if (!validacion.valido) {
      logDebug('Validación fallida:', validacion.errores);
      return {
        exito: false,
        errores: validacion.errores
      };
    }

    // Actualizar con auditoría
    setVehiculos(prev =>
      prev.map(v =>
        v.id === id
          ? {
              ...v,
              ...data,
              modificadoPor: 'admin@kesa.com', // TODO: obtener de contexto
              modificadoEn: new Date().toISOString()
            }
          : v
      )
    );

    logDebug('Vehículo actualizado exitosamente:', id);

    return { exito: true };
  };

  /**
   * Inactivar vehículo (soft delete)
   */
  const inactivarVehiculo = (
    id: string,
    motivo: string
  ): { exito: boolean; errores?: string[] } => {
    logDebug('Intentando inactivar vehículo:', id, motivo);

    const vehiculoExistente = vehiculos.find(v => v.id === id);

    if (!vehiculoExistente) {
      return {
        exito: false,
        errores: ['Vehículo no encontrado']
      };
    }

    if (vehiculoExistente.estado === 'inactivo') {
      return {
        exito: false,
        errores: ['El vehículo ya está inactivo']
      };
    }

    // Validar motivo
    const validacionMotivo = validarMotivoInactivacion(motivo);
    if (!validacionMotivo.valido) {
      return {
        exito: false,
        errores: validacionMotivo.errores
      };
    }

    // Inactivar con auditoría
    setVehiculos(prev =>
      prev.map(v =>
        v.id === id
          ? {
              ...v,
              estado: 'inactivo',
              inactivadoPor: 'admin@kesa.com', // TODO: obtener de contexto
              inactivadoEn: new Date().toISOString(),
              motivoInactivacion: motivo
            }
          : v
      )
    );

    logDebug('Vehículo inactivado exitosamente:', id);

    return { exito: true };
  };

  /**
   * Activar vehículo
   */
  const activarVehiculo = (id: string): { exito: boolean; errores?: string[] } => {
    logDebug('Intentando activar vehículo:', id);

    const vehiculoExistente = vehiculos.find(v => v.id === id);

    if (!vehiculoExistente) {
      return {
        exito: false,
        errores: ['Vehículo no encontrado']
      };
    }

    if (vehiculoExistente.estado !== 'inactivo') {
      return {
        exito: false,
        errores: ['El vehículo no está inactivo']
      };
    }

    // Activar con auditoría
    setVehiculos(prev =>
      prev.map(v =>
        v.id === id
          ? {
              ...v,
              estado: 'activo',
              modificadoPor: 'admin@kesa.com', // TODO: obtener de contexto
              modificadoEn: new Date().toISOString(),
              // Limpiar campos de inactivación
              inactivadoPor: undefined,
              inactivadoEn: undefined,
              motivoInactivacion: undefined
            }
          : v
      )
    );

    logDebug('Vehículo activado exitosamente:', id);

    return { exito: true };
  };

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  const obtenerVehiculo = (id: string): Vehiculo | undefined => {
    return vehiculos.find(v => v.id === id);
  };

  const obtenerVehiculoPorToken = (token: string): Vehiculo | undefined => {
    return vehiculos.find(v => v.publicToken === token);
  };

  const obtenerVehiculosPorEstado = (estado: EstadoVehiculo): Vehiculo[] => {
    return vehiculos.filter(v => v.estado === estado);
  };

  const obtenerVehiculosPorTipo = (tipo: TipoVehiculo): Vehiculo[] => {
    return vehiculos.filter(v => v.tipo === tipo);
  };

  const buscarVehiculos = (query: string): Vehiculo[] => {
    if (!query || query.trim() === '') {
      return vehiculos;
    }

    const queryLower = query.toLowerCase().trim();

    return vehiculos.filter(v => {
      return (
        v.placa.toLowerCase().includes(queryLower) ||
        v.vin?.toLowerCase().includes(queryLower) ||
        v.marca.toLowerCase().includes(queryLower) ||
        v.modelo.toLowerCase().includes(queryLower) ||
        v.id.toLowerCase().includes(queryLower)
      );
    });
  };

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Garantiza que el vehículo tenga un token público
   * Si no existe, lo genera automáticamente (idempotente)
   */
  const ensurePublicToken = (id: string) => {
    const vehiculoExistente = vehiculos.find(v => v.id === id);

    if (!vehiculoExistente) {
      logDebug('Vehículo no encontrado para generar token público:', id);
      return;
    }

    if (vehiculoExistente.publicToken) {
      logDebug('Vehículo ya tiene token público:', id);
      return; // ✅ IDEMPOTENTE: No regenera
    }

    const nuevoToken = generatePublicToken(id);

    setVehiculos(prev =>
      prev.map(v =>
        v.id === id
          ? {
              ...v,
              publicToken: nuevoToken
            }
          : v
      )
    );

    logDebug('Token público generado para vehículo:', id);
  };

  // ============================================================================
  // DOCUMENTS OPERATIONS
  // ============================================================================

  /**
   * Agregar documento a vehículo
   */
  const agregarDocumentoVehiculo = (
    vehiculoId: string,
    documento: Omit<VehiculoDocumento, 'id' | 'creadoPor' | 'creadoEn'>
  ): { exito: boolean; documentoId?: string; errores?: string[] } => {
    logDebug('Intentando agregar documento a vehículo:', vehiculoId, documento);

    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);

    if (!vehiculoExistente) {
      return {
        exito: false,
        errores: ['Vehículo no encontrado']
      };
    }

    // Validar documento
    const validacion = validarDocumento(documento);
    if (!validacion.valido) {
      return {
        exito: false,
        errores: validacion.errores
      };
    }

    // Generar ID
    const nuevoId = generarDocumentoId();

    // Crear documento con auditoría
    const nuevoDocumento: VehiculoDocumento = {
      ...documento,
      id: nuevoId,
      creadoPor: 'admin@kesa.com', // TODO: obtener de contexto de usuario
      creadoEn: new Date().toISOString()
    };

    setVehiculos(prev =>
      prev.map(v =>
        v.id === vehiculoId
          ? {
              ...v,
              documentos: [...v.documentos, nuevoDocumento]
            }
          : v
      )
    );

    logDebug('Documento agregado exitosamente:', nuevoId);

    return {
      exito: true,
      documentoId: nuevoId
    };
  };

  /**
   * Actualizar documento de vehículo
   */
  const actualizarDocumentoVehiculo = (
    vehiculoId: string,
    documentoId: string,
    data: Partial<VehiculoDocumento>
  ): { exito: boolean; errores?: string[] } => {
    logDebug('Intentando actualizar documento:', vehiculoId, documentoId, data);

    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);

    if (!vehiculoExistente) {
      return {
        exito: false,
        errores: ['Vehículo no encontrado']
      };
    }

    const documentoExistente = vehiculoExistente.documentos?.find(d => d.id === documentoId);

    if (!documentoExistente) {
      return {
        exito: false,
        errores: ['Documento no encontrado']
      };
    }

    // Validar datos actualizados
    const documentoActualizado = { ...documentoExistente, ...data };
    
    const validacion = validarDocumento(
      documentoActualizado
    );

    if (!validacion.valido) {
      logDebug('Validación fallida:', validacion.errores);
      return {
        exito: false,
        errores: validacion.errores
      };
    }

    // Actualizar con auditoría
    setVehiculos(prev =>
      prev.map(v =>
        v.id === vehiculoId
          ? {
              ...v,
              documentos: (v.documentos || []).map(d =>
                d.id === documentoId
                  ? {
                      ...d,
                      ...data,
                      modificadoPor: 'admin@kesa.com', // TODO: obtener de contexto
                      modificadoEn: new Date().toISOString()
                    }
                  : d
              )
            }
          : v
      )
    );

    logDebug('Documento actualizado exitosamente:', documentoId);

    return { exito: true };
  };

  /**
   * Eliminar documento de vehículo
   */
  const eliminarDocumentoVehiculo = (
    vehiculoId: string,
    documentoId: string
  ): { exito: boolean; errores?: string[] } => {
    logDebug('Intentando eliminar documento:', vehiculoId, documentoId);

    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);

    if (!vehiculoExistente) {
      return {
        exito: false,
        errores: ['Vehículo no encontrado']
      };
    }

    const documentoExistente = vehiculoExistente.documentos.find(d => d.id === documentoId);

    if (!documentoExistente) {
      return {
        exito: false,
        errores: ['Documento no encontrado']
      };
    }

    // Eliminar con auditoría
    setVehiculos(prev =>
      prev.map(v =>
        v.id === vehiculoId
          ? {
              ...v,
              documentos: v.documentos.filter(d => d.id !== documentoId)
            }
          : v
      )
    );

    logDebug('Documento eliminado exitosamente:', documentoId);

    return { exito: true };
  };

  /**
   * Obtener documentos de vehículo
   */
  const obtenerDocumentosVehiculo = (vehiculoId: string): VehiculoDocumento[] => {
    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);

    if (!vehiculoExistente) {
      return [];
    }

    return vehiculoExistente.documentos || [];
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: VehiculosContextType = {
    vehiculos,
    crearVehiculo,
    actualizarVehiculo,
    inactivarVehiculo,
    activarVehiculo,
    obtenerVehiculo,
    obtenerVehiculoPorToken,
    obtenerVehiculosPorEstado,
    obtenerVehiculosPorTipo,
    buscarVehiculos,
    ensurePublicToken,
    // Contrato y Plan Preventivo
    actualizarVinculoContrato: (vehiculoId: string, vinculo: VehiculoVinculoContrato) => {
      const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);

      if (!vehiculoExistente) {
        return {
          exito: false,
          errores: ['Vehículo no encontrado']
        };
      }

      // Validar vinculo
      const validacion = validarVinculoContrato(vinculo);
      if (!validacion.valido) {
        return {
          exito: false,
          errores: validacion.errores
        };
      }

      // Actualizar con auditoría
      setVehiculos(prev =>
        prev.map(v =>
          v.id === vehiculoId
            ? {
                ...v,
                vinculoContrato: vinculo,
                modificadoPor: 'admin@kesa.com', // TODO: obtener de contexto
                modificadoEn: new Date().toISOString()
              }
            : v
        )
      );

      logDebug('Vinculo de contrato actualizado exitosamente:', vehiculoId);

      return { exito: true };
    },
    actualizarPlanPreventivo: (vehiculoId: string, plan: PlanPreventivoContratado) => {
      const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);

      if (!vehiculoExistente) {
        return {
          exito: false,
          errores: ['Vehículo no encontrado']
        };
      }

      // Validar plan
      const validacion = validarPlanPreventivo(plan);
      if (!validacion.valido) {
        return {
          exito: false,
          errores: validacion.errores
        };
      }

      // Actualizar con auditoría
      setVehiculos(prev =>
        prev.map(v =>
          v.id === vehiculoId
            ? {
                ...v,
                planPreventivo: plan,
                modificadoPor: 'admin@kesa.com', // TODO: obtener de contexto
                modificadoEn: new Date().toISOString()
              }
            : v
        )
      );

      logDebug('Plan preventivo actualizado exitosamente:', vehiculoId);

      return { exito: true };
    },
    // Documentos
    agregarDocumentoVehiculo,
    actualizarDocumentoVehiculo,
    eliminarDocumentoVehiculo,
    obtenerDocumentosVehiculo
  };

  return (
    <VehiculosContext.Provider value={value}>
      {children}
    </VehiculosContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useVehiculos() {
  const context = useContext(VehiculosContext);
  
  if (context === undefined) {
    throw new Error('useVehiculos debe usarse dentro de VehiculosStoreProvider');
  }
  
  return context;
}