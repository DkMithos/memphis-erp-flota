/**
 * STORE DE PROVEEDORES
 * Context global para gestión de proveedores en el módulo
 * Prototipo funcional - Reemplazar por backend real en producción
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  generarIdProveedor,
  extraerNumeroSecuencial,
  normalizeRUC,
  normalizeEmail,
  normalizeTelefono,
  DEBUG_PROVEEDORES,
  type EstadoProveedor,
  type CondicionProveedor,
  type TipoProveedor,
  type CategoriaProveedor,
  type RolUsuario
} from './proveedores-config';

// ============================================================================
// TIPOS
// ============================================================================

export interface Proveedor {
  // Identificación
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  
  // Clasificación
  tipo: TipoProveedor;
  categorias: CategoriaProveedor[];
  estado: EstadoProveedor;
  condicion: CondicionProveedor;
  
  // Contacto
  email: string;
  telefono: string;
  telefonoAlternativo: string | null;
  direccion: string;
  ciudad: string;
  pais: string;
  
  // Contacto Principal
  contactoPrincipal: {
    nombre: string;
    cargo: string;
    email: string;
    telefono: string;
  } | null;
  
  // Datos Bancarios
  bancos: Array<{
    banco: string;
    numeroCuenta: string;
    tipoCuenta: 'corriente' | 'ahorros';
    moneda: 'PEN' | 'USD';
  }>;
  
  // Evaluación
  calificacion: number; // 0-100
  totalCompras: number; // monto acumulado
  numeroOrdenes: number; // cantidad de OC/OS
  
  // Auditoría obligatoria
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    inactivadoPor: string | null;
    inactivadoEn: string | null;
    motivoInactivacion: string | null;
  };
  
  // Observaciones
  observaciones: string | null;
  documentosAdjuntos: Array<{
    nombre: string;
    tipo: string;
    url: string;
    fechaSubida: string;
  }>;
}

export interface NuevoProveedorInput {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  tipo: TipoProveedor;
  categorias: CategoriaProveedor[];
  email: string;
  telefono: string;
  telefonoAlternativo?: string;
  direccion: string;
  ciudad: string;
  pais: string;
  contactoPrincipal?: {
    nombre: string;
    cargo: string;
    email: string;
    telefono: string;
  };
  observaciones?: string;
}

export interface ActualizarProveedorInput extends Partial<NuevoProveedorInput> {
  // Solo campos editables
}

interface ProveedorStoreContext {
  proveedores: Proveedor[];
  obtenerProveedorPorId: (id: string) => Proveedor | undefined;
  obtenerProveedorPorRUC: (ruc: string) => Proveedor | undefined;
  crearProveedor: (input: NuevoProveedorInput) => Proveedor;
  actualizarProveedor: (id: string, input: ActualizarProveedorInput) => void;
  inactivarProveedor: (id: string, motivo: string) => void;
  activarProveedor: (id: string) => void;
  cargarProveedoresIniciales: () => void;
  // Mock de usuario actual (en producción vendría de auth context)
  usuarioActual: { email: string; rol: RolUsuario };
}

// ============================================================================
// CONTEXT
// ============================================================================

const ProveedorContext = createContext<ProveedorStoreContext | undefined>(undefined);

// ============================================================================
// DATA DE EJEMPLO - Seed inicial
// ============================================================================

const proveedoresSeed: Proveedor[] = [
  {
    id: 'PROV-0001',
    ruc: '20512345678',
    razonSocial: 'Repuestos Automotrices SAC',
    nombreComercial: 'Auto Repuestos Lima',
    tipo: 'bienes',
    categorias: ['repuestos'],
    estado: 'activo',
    condicion: 'excelente',
    email: 'ventas@autorepuestos.com',
    telefono: '987654321',
    telefonoAlternativo: '987654322',
    direccion: 'Av. Grau 1234, Cercado de Lima',
    ciudad: 'Lima',
    pais: 'Perú',
    contactoPrincipal: {
      nombre: 'Juan Pérez García',
      cargo: 'Gerente Comercial',
      email: 'jperez@autorepuestos.com',
      telefono: '987654321'
    },
    bancos: [
      {
        banco: 'BCP',
        numeroCuenta: '1234567890123456',
        tipoCuenta: 'corriente',
        moneda: 'PEN'
      }
    ],
    calificacion: 96,
    totalCompras: 450000,
    numeroOrdenes: 45,
    auditoria: {
      creadoPor: 'admin@kesa.com',
      creadoEn: '2024-01-15 10:00:00',
      modificadoPor: null,
      modificadoEn: null,
      inactivadoPor: null,
      inactivadoEn: null,
      motivoInactivacion: null
    },
    observaciones: 'Proveedor certificado ISO 9001. Entregas puntuales.',
    documentosAdjuntos: []
  },
  {
    id: 'PROV-0002',
    ruc: '20523456789',
    razonSocial: 'Taller Mecánico Rodriguez EIRL',
    nombreComercial: 'Taller Rodriguez',
    tipo: 'servicios',
    categorias: ['taller'],
    estado: 'activo',
    condicion: 'bueno',
    email: 'contacto@tallerrodriguez.com',
    telefono: '912345678',
    telefonoAlternativo: null,
    direccion: 'Jr. Los Pinos 456, San Juan de Lurigancho',
    ciudad: 'Lima',
    pais: 'Perú',
    contactoPrincipal: {
      nombre: 'Carlos Rodriguez',
      cargo: 'Propietario',
      email: 'crodriguez@tallerrodriguez.com',
      telefono: '912345678'
    },
    bancos: [
      {
        banco: 'BBVA',
        numeroCuenta: '0011234567890123',
        tipoCuenta: 'corriente',
        moneda: 'PEN'
      }
    ],
    calificacion: 88,
    totalCompras: 180000,
    numeroOrdenes: 32,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2024-02-10 14:30:00',
      modificadoPor: 'admin@kesa.com',
      modificadoEn: '2024-03-15 09:00:00',
      inactivadoPor: null,
      inactivadoEn: null,
      motivoInactivacion: null
    },
    observaciones: 'Especialista en vehículos Mercedes Benz',
    documentosAdjuntos: []
  },
  {
    id: 'PROV-0003',
    ruc: '20534567890',
    razonSocial: 'Equipos Médicos del Perú SA',
    nombreComercial: 'EMEPSA',
    tipo: 'mixto',
    categorias: ['equipos_medicos', 'insumos'],
    estado: 'activo',
    condicion: 'excelente',
    email: 'ventas@emepsa.com.pe',
    telefono: '998765432',
    telefonoAlternativo: '998765433',
    direccion: 'Av. Arequipa 2345, Lince',
    ciudad: 'Lima',
    pais: 'Perú',
    contactoPrincipal: {
      nombre: 'María Torres Vega',
      cargo: 'Gerente de Ventas',
      email: 'mtorres@emepsa.com.pe',
      telefono: '998765432'
    },
    bancos: [
      {
        banco: 'Interbank',
        numeroCuenta: '2001234567890123',
        tipoCuenta: 'corriente',
        moneda: 'USD'
      },
      {
        banco: 'BCP',
        numeroCuenta: '1919234567890123',
        tipoCuenta: 'corriente',
        moneda: 'PEN'
      }
    ],
    calificacion: 98,
    totalCompras: 850000,
    numeroOrdenes: 67,
    auditoria: {
      creadoPor: 'admin@kesa.com',
      creadoEn: '2023-11-20 11:00:00',
      modificadoPor: null,
      modificadoEn: null,
      inactivadoPor: null,
      inactivadoEn: null,
      motivoInactivacion: null
    },
    observaciones: 'Distribuidor autorizado de equipos GE Healthcare. Garantía extendida.',
    documentosAdjuntos: []
  },
  {
    id: 'PROV-0004',
    ruc: '20545678901',
    razonSocial: 'Combustibles y Lubricantes del Norte SAC',
    nombreComercial: 'Petro Norte',
    tipo: 'bienes',
    categorias: ['combustible'],
    estado: 'observado',
    condicion: 'regular',
    email: 'atencion@petronorte.com',
    telefono: '923456789',
    telefonoAlternativo: null,
    direccion: 'Carretera Panamericana Norte Km 45',
    ciudad: 'Lima',
    pais: 'Perú',
    contactoPrincipal: {
      nombre: 'Luis Mendoza',
      cargo: 'Jefe de Operaciones',
      email: 'lmendoza@petronorte.com',
      telefono: '923456789'
    },
    bancos: [
      {
        banco: 'Scotiabank',
        numeroCuenta: '3001234567890123',
        tipoCuenta: 'corriente',
        moneda: 'PEN'
      }
    ],
    calificacion: 72,
    totalCompras: 320000,
    numeroOrdenes: 28,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2024-03-05 16:00:00',
      modificadoPor: 'admin@kesa.com',
      modificadoEn: '2024-11-20 10:30:00',
      inactivadoPor: null,
      inactivadoEn: null,
      motivoInactivacion: null
    },
    observaciones: 'OBSERVADO: Retrasos en entregas los últimos 3 meses. En evaluación.',
    documentosAdjuntos: []
  },
  {
    id: 'PROV-0005',
    ruc: '20556789012',
    razonSocial: 'Servicios TI Global SAC',
    nombreComercial: null,
    tipo: 'servicios',
    categorias: ['tecnologia', 'servicios_profesionales'],
    estado: 'inactivo',
    condicion: 'deficiente',
    email: 'contacto@tiglobal.com',
    telefono: '934567890',
    telefonoAlternativo: null,
    direccion: 'Av. Javier Prado Este 3456, San Isidro',
    ciudad: 'Lima',
    pais: 'Perú',
    contactoPrincipal: null,
    bancos: [],
    calificacion: 45,
    totalCompras: 85000,
    numeroOrdenes: 8,
    auditoria: {
      creadoPor: 'compras@kesa.com',
      creadoEn: '2024-06-10 09:00:00',
      modificadoPor: 'compras@kesa.com',
      modificadoEn: '2024-09-15 14:00:00',
      inactivadoPor: 'admin@kesa.com',
      inactivadoEn: '2024-12-01 11:00:00',
      motivoInactivacion: 'Incumplimiento reiterado de plazos de entrega y soporte técnico deficiente. Última orden presentó fallas críticas no resueltas en 30 días.'
    },
    observaciones: 'Proveedor inactivado por bajo desempeño.',
    documentosAdjuntos: []
  }
];

// ============================================================================
// PROVIDER
// ============================================================================

export function ProveedorStoreProvider({ children }: { children: React.ReactNode }) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  
  // Mock de usuario actual (en producción vendría de auth context)
  const usuarioActual = {
    email: 'admin@kesa.com',
    rol: 'admin' as RolUsuario
  };

  // Cargar proveedores iniciales SOLO una vez al montar
  useEffect(() => {
    if (proveedores.length === 0) {
      if (DEBUG_PROVEEDORES) {
        console.log('[PROV_SEED_LOADING]', { seedSize: proveedoresSeed.length });
      }
      setProveedores(proveedoresSeed);
    }
  }, []);

  // Cargar proveedores iniciales (con guard idempotente)
  const cargarProveedoresIniciales = useCallback(() => {
    if (proveedores.length === 0) {
      if (DEBUG_PROVEEDORES) {
        console.log('[PROV_SEED_MANUAL_LOADING]', { seedSize: proveedoresSeed.length });
      }
      setProveedores(proveedoresSeed);
    } else if (DEBUG_PROVEEDORES) {
      console.log('[PROV_SEED_SKIP]', { 
        reason: 'Ya hay proveedores en el store', 
        currentSize: proveedores.length 
      });
    }
  }, [proveedores.length]);

  // Obtener proveedor por ID
  const obtenerProveedorPorId = useCallback((id: string) => {
    return proveedores.find(p => p.id === id);
  }, [proveedores]);

  // Obtener proveedor por RUC
  const obtenerProveedorPorRUC = useCallback((ruc: string) => {
    const rucNormalizado = normalizeRUC(ruc);
    return proveedores.find(p => p.ruc === rucNormalizado);
  }, [proveedores]);

  // Crear nuevo proveedor
  const crearProveedor = useCallback((input: NuevoProveedorInput): Proveedor => {
    // Obtener el último número secuencial
    const numeros = proveedores
      .map(p => extraerNumeroSecuencial(p.id))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Generar nuevo ID
    const id = generarIdProveedor(ultimoNumero);
    const timestamp = new Date().toISOString();

    // Crear objeto proveedor
    const nuevoProveedor: Proveedor = {
      id,
      ruc: normalizeRUC(input.ruc),
      razonSocial: input.razonSocial.trim(),
      nombreComercial: input.nombreComercial?.trim() || null,
      tipo: input.tipo,
      categorias: input.categorias,
      estado: 'activo',
      condicion: 'sin_evaluar',
      email: normalizeEmail(input.email),
      telefono: normalizeTelefono(input.telefono),
      telefonoAlternativo: input.telefonoAlternativo ? normalizeTelefono(input.telefonoAlternativo) : null,
      direccion: input.direccion.trim(),
      ciudad: input.ciudad.trim(),
      pais: input.pais.trim(),
      contactoPrincipal: input.contactoPrincipal ? {
        nombre: input.contactoPrincipal.nombre.trim(),
        cargo: input.contactoPrincipal.cargo.trim(),
        email: normalizeEmail(input.contactoPrincipal.email),
        telefono: normalizeTelefono(input.contactoPrincipal.telefono)
      } : null,
      bancos: [],
      calificacion: 0,
      totalCompras: 0,
      numeroOrdenes: 0,
      auditoria: {
        creadoPor: usuarioActual.email,
        creadoEn: timestamp,
        modificadoPor: null,
        modificadoEn: null,
        inactivadoPor: null,
        inactivadoEn: null,
        motivoInactivacion: null
      },
      observaciones: input.observaciones?.trim() || null,
      documentosAdjuntos: []
    };

    // Agregar al INICIO del store para visibilidad inmediata
    const sizeBeforeAdd = proveedores.length;
    setProveedores(prev => {
      const newState = [nuevoProveedor, ...prev];
      
      if (DEBUG_PROVEEDORES) {
        console.log('[PROV_CREATED]', {
          id: nuevoProveedor.id,
          ruc: nuevoProveedor.ruc,
          razonSocial: nuevoProveedor.razonSocial,
          sizeAfter: newState.length,
          sizeBefore: sizeBeforeAdd,
          position: 'FIRST'
        });
      }
      
      return newState;
    });

    return nuevoProveedor;
  }, [proveedores, usuarioActual.email]);

  // Actualizar proveedor
  const actualizarProveedor = useCallback((id: string, input: ActualizarProveedorInput) => {
    const timestamp = new Date().toISOString();
    
    setProveedores(prev => prev.map(p => {
      if (p.id === id) {
        const actualizado: Proveedor = {
          ...p,
          ...(input.razonSocial && { razonSocial: input.razonSocial.trim() }),
          ...(input.nombreComercial !== undefined && { nombreComercial: input.nombreComercial?.trim() || null }),
          ...(input.tipo && { tipo: input.tipo }),
          ...(input.categorias && { categorias: input.categorias }),
          ...(input.email && { email: normalizeEmail(input.email) }),
          ...(input.telefono && { telefono: normalizeTelefono(input.telefono) }),
          ...(input.telefonoAlternativo !== undefined && { 
            telefonoAlternativo: input.telefonoAlternativo ? normalizeTelefono(input.telefonoAlternativo) : null 
          }),
          ...(input.direccion && { direccion: input.direccion.trim() }),
          ...(input.ciudad && { ciudad: input.ciudad.trim() }),
          ...(input.pais && { pais: input.pais.trim() }),
          ...(input.contactoPrincipal && {
            contactoPrincipal: {
              nombre: input.contactoPrincipal.nombre.trim(),
              cargo: input.contactoPrincipal.cargo.trim(),
              email: normalizeEmail(input.contactoPrincipal.email),
              telefono: normalizeTelefono(input.contactoPrincipal.telefono)
            }
          }),
          ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() || null }),
          auditoria: {
            ...p.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_PROVEEDORES) {
          console.log('[PROV_UPDATED]', {
            id: actualizado.id,
            cambios: Object.keys(input)
          });
        }

        return actualizado;
      }
      return p;
    }));
  }, [usuarioActual.email]);

  // Inactivar proveedor (con motivo obligatorio)
  const inactivarProveedor = useCallback((id: string, motivo: string) => {
    const timestamp = new Date().toISOString();
    
    setProveedores(prev => prev.map(p => {
      if (p.id === id) {
        const inactivado: Proveedor = {
          ...p,
          estado: 'inactivo',
          auditoria: {
            ...p.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp,
            inactivadoPor: usuarioActual.email,
            inactivadoEn: timestamp,
            motivoInactivacion: motivo.trim()
          }
        };

        if (DEBUG_PROVEEDORES) {
          console.log('[PROV_INACTIVATED]', {
            id: inactivado.id,
            razonSocial: inactivado.razonSocial,
            motivo: motivo.substring(0, 50) + '...'
          });
        }

        return inactivado;
      }
      return p;
    }));
  }, [usuarioActual.email]);

  // Activar proveedor
  const activarProveedor = useCallback((id: string) => {
    const timestamp = new Date().toISOString();
    
    setProveedores(prev => prev.map(p => {
      if (p.id === id) {
        const activado: Proveedor = {
          ...p,
          estado: 'activo',
          auditoria: {
            ...p.auditoria,
            modificadoPor: usuarioActual.email,
            modificadoEn: timestamp
          }
        };

        if (DEBUG_PROVEEDORES) {
          console.log('[PROV_ACTIVATED]', {
            id: activado.id,
            razonSocial: activado.razonSocial
          });
        }

        return activado;
      }
      return p;
    }));
  }, [usuarioActual.email]);

  const value: ProveedorStoreContext = {
    proveedores,
    obtenerProveedorPorId,
    obtenerProveedorPorRUC,
    crearProveedor,
    actualizarProveedor,
    inactivarProveedor,
    activarProveedor,
    cargarProveedoresIniciales,
    usuarioActual
  };

  return <ProveedorContext.Provider value={value}>{children}</ProveedorContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useProveedorStore() {
  const context = useContext(ProveedorContext);
  if (!context) {
    throw new Error('useProveedorStore debe usarse dentro de ProveedorStoreProvider');
  }
  return context;
}
