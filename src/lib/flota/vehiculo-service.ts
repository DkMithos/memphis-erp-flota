/**
 * VehiculoService.ts
 * Abstracción de datos para el módulo de Flota.
 * Implementa el patrón Repository para facilitar la migración a API REST.
 */
import { Vehiculo, ValidacionResult, validarVehiculo } from '../../lib/flota/vehiculos-config';

const STORAGE_KEY = 'kesa_flota_vehiculos';
const AUDIT_KEY = 'kesa_flota_auditoria';

export interface AuditEntry {
  id: string;
  entidadId: string;
  accion: 'CREACION' | 'ACTUALIZACION' | 'INACTIVACION' | 'DOCUMENTO_ADD';
  usuario: string;
  fecha: string;
  detalles?: string;
}

export const VehiculoService = {
  /**
   * Obtiene todos los vehículos con manejo de errores y fallback
   */
  getAll: (): Vehiculo[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[VehiculoService] Error reading from storage', error);
      return [];
    }
  },

  /**
   * Guarda la colección completa (Persistencia atómica)
   */
  saveAll: (vehiculos: Vehiculo[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehiculos));
    } catch (error) {
      console.error('[VehiculoService] Error saving to storage', error);
      throw new Error('No se pudo persistir la información de la flota.');
    }
  },

  /**
   * Busca un vehículo por ID o Placa
   */
  getById: (id: string): Vehiculo | undefined => {
    const all = VehiculoService.getAll();
    return all.find(v => v.id === id || v.placa === id);
  },

  /**
   * Valida y crea un nuevo vehículo
   */
  create: (nuevo: Partial<Vehiculo>): { exito: boolean; data?: Vehiculo; errores?: string[] } => {
    const existentes = VehiculoService.getAll();
    const placas = existentes.map(v => v.placa);
    const vins = existentes.map(v => v.vin || '').filter(Boolean);

    const validacion = validarVehiculo(nuevo, placas, vins);
    
    if (!validacion.valido) {
      return { exito: false, errores: validacion.errores };
    }

    // Aquí se asignaría el ID real en un backend
    const vehiculoFinal = {
      ...nuevo,
      id: `VH-${(existentes.length + 1).toString().padStart(3, '0')}`,
      creadoEn: new Date().toISOString(),
    } as Vehiculo;

    const updatedList = [...existentes, vehiculoFinal];
    VehiculoService.saveAll(updatedList);
    
    // Audit Trail
    VehiculoService.logEvent(vehiculoFinal.id, 'CREACION', 'admin@kesa.com', 'Vehículo creado inicialmente');
    
    return { exito: true, data: vehiculoFinal };
  },

  /**
   * Actualiza un vehículo existente con validación y auditoría
   */
  update: (id: string, patch: Partial<Vehiculo>): { exito: boolean; errores?: string[] } => {
    const existentes = VehiculoService.getAll();
    const index = existentes.findIndex(v => v.id === id);
    
    if (index === -1) return { exito: false, errores: ['Vehículo no encontrado'] };

    const vehiculoActualizado = {
      ...existentes[index],
      ...patch,
      modificadoEn: new Date().toISOString(),
    };

    // Validar unicidad excluyendo el actual
    const placas = existentes.filter(v => v.id !== id).map(v => v.placa);
    const vins = existentes.filter(v => v.id !== id).map(v => v.vin || '').filter(Boolean);
    
    const validacion = validarVehiculo(vehiculoActualizado, placas, vins, id);
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    existentes[index] = vehiculoActualizado as Vehiculo;
    VehiculoService.saveAll(existentes);
    
    VehiculoService.logEvent(id, 'ACTUALIZACION', 'admin@kesa.com', JSON.stringify(patch));
    
    return { exito: true };
  },

  /**
   * Registra un evento en el historial inmutable de auditoría
   */
  logEvent: (entidadId: string, accion: AuditEntry['accion'], usuario: string, detalles?: string): void => {
    try {
      const logs: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      const newEntry: AuditEntry = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        entidadId, accion, usuario, detalles,
        fecha: new Date().toISOString(),
      };
      localStorage.setItem(AUDIT_KEY, JSON.stringify([newEntry, ...logs].slice(0, 1000)));
    } catch (e) {
      console.error('[VehiculoService] Audit logging failed', e);
    }
  },

  /**
   * Obtiene el historial de auditoría filtrado por entidad
   */
  getAuditLogs: (entidadId: string): AuditEntry[] => {
    try {
      const logs: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      return logs.filter(log => log.entidadId === entidadId);
    } catch (e) {
      return [];
    }
  }
};

/**
 * Constantes de Layout para asegurar el centrado visual en toda la app
 */
export const LAYOUT_CONFIG = {
  CONTAINER_CENTERED: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  CARD_CENTERED: "flex flex-col items-center justify-center text-center",
  MODAL_CENTERED: "sm:max-w-[600px] mx-auto",
  PRINT_CENTERED: "flex flex-col items-center justify-center w-full"
};