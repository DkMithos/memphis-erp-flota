/**
 * Memphis ERP - Proveedores Store
 * v2.0.0 - Conectado a Supabase (reemplaza mock local)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { dbProveedores } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { Proveedor as ProveedorDB } from '../supabase/types';
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
} from './proveedores-config';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Proveedor {
  // Identificación — id = codigo (PROV-NNNN), _dbId = UUID interno
  id: string;
  _dbId: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;

  // Clasificación
  tipo: TipoProveedor;
  categorias: CategoriaProveedor[];   // plural en frontend, singular en DB
  estado: EstadoProveedor;
  condicion: CondicionProveedor;

  // Contacto
  email: string | null;
  telefono: string | null;
  telefonoAlternativo: string | null;
  direccion: string | null;
  ciudad: string | null;   // maps from DB departamento
  pais: string;

  // Contacto principal — no almacenado en DB todavía
  contactoPrincipal: null;

  // Datos bancarios — no almacenados en columnas separadas todavía
  bancos: Array<{
    banco: string;
    numeroCuenta: string;
    tipoCuenta: 'corriente' | 'ahorros';
    moneda: 'PEN' | 'USD';
  }>;

  // Evaluación
  calificacion: number;   // maps from DB score
  totalCompras: number;   // no en DB, default 0
  numeroOrdenes: number;  // no en DB, default 0

  // Auditoría
  auditoria: {
    creadoPor: string | null;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    inactivadoPor: string | null;
    inactivadoEn: string | null;
    motivoInactivacion: string | null;
  };

  observaciones: string | null;
  documentosAdjuntos: [];
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

export interface ActualizarProveedorInput extends Partial<NuevoProveedorInput> {}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface ProveedorStoreContext {
  proveedores: Proveedor[];
  loading: boolean;
  obtenerProveedorPorId: (id: string) => Proveedor | undefined;
  obtenerProveedorPorRUC: (ruc: string) => Proveedor | undefined;
  crearProveedor: (input: NuevoProveedorInput) => Promise<Proveedor>;
  actualizarProveedor: (id: string, input: ActualizarProveedorInput) => Promise<CrudResult>;
  inactivarProveedor: (id: string, motivo: string) => Promise<CrudResult>;
  activarProveedor: (id: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ProveedorContext = createContext<ProveedorStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: ProveedorDB): Proveedor {
  return {
    id: row.codigo,
    _dbId: row.id,
    ruc: row.ruc,
    razonSocial: row.razon_social,
    nombreComercial: row.nombre_comercial,
    tipo: row.tipo as TipoProveedor,
    categorias: [row.categoria as CategoriaProveedor],
    estado: row.estado as EstadoProveedor,
    condicion: row.condicion as CondicionProveedor,
    email: row.email,
    telefono: row.telefono,
    telefonoAlternativo: row.celular,
    direccion: row.direccion,
    ciudad: row.departamento,
    pais: row.pais,
    contactoPrincipal: null,
    bancos: row.banco && row.cuenta_bancaria
      ? [{ banco: row.banco, numeroCuenta: row.cuenta_bancaria, tipoCuenta: 'corriente', moneda: 'PEN' }]
      : [],
    calificacion: row.score,
    totalCompras: 0,
    numeroOrdenes: 0,
    auditoria: {
      creadoPor: row.creado_por,
      creadoEn: row.creado_en,
      modificadoPor: row.modificado_por,
      modificadoEn: row.modificado_en,
      inactivadoPor: null,
      inactivadoEn: null,
      motivoInactivacion: null,
    },
    observaciones: null,
    documentosAdjuntos: [],
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function ProveedorStoreProvider({ children }: { children: ReactNode }) {
  const { tenantId, user } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial desde Supabase
  const fetchProveedores = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data, error } = await dbProveedores.list();

    if (error) {
      console.error('[PROVEEDORES] Error al cargar:', error.message);
    } else if (data) {
      const mapped = (data as ProveedorDB[]).map(mapFromDB);
      setProveedores(mapped);
      if (DEBUG_PROVEEDORES) {
        console.log('[PROVEEDORES] Cargados desde Supabase:', mapped.length);
      }
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  // ============================================================================
  // QUERIES (síncronas — operan sobre estado local ya cargado)
  // ============================================================================

  const obtenerProveedorPorId = (id: string) =>
    proveedores.find(p => p.id === id);

  const obtenerProveedorPorRUC = (ruc: string) => {
    const rucNormalizado = normalizeRUC(ruc);
    return proveedores.find(p => p.ruc === rucNormalizado);
  };

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearProveedor = async (input: NuevoProveedorInput): Promise<Proveedor> => {
    if (!tenantId || !user) {
      throw new Error('Sin sesión activa');
    }

    // Determinar siguiente número secuencial
    const numeros = proveedores
      .map(p => extraerNumeroSecuencial(p.id))
      .filter((n): n is number => n !== null);
    const ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const nuevoCodigo = generarIdProveedor(ultimoNumero);

    const { data: inserted, error } = await dbProveedores.create({
      tenant_id: tenantId,
      codigo: nuevoCodigo,
      razon_social: input.razonSocial.trim(),
      nombre_comercial: input.nombreComercial?.trim() ?? null,
      ruc: normalizeRUC(input.ruc),
      tipo: input.tipo,
      categoria: input.categorias[0] ?? 'otros',
      estado: 'activo' as EstadoProveedor,
      condicion: 'sin_evaluar' as CondicionProveedor,
      score: 0,
      email: normalizeEmail(input.email),
      telefono: normalizeTelefono(input.telefono),
      celular: input.telefonoAlternativo ? normalizeTelefono(input.telefonoAlternativo) : null,
      web: null,
      pais: input.pais.trim(),
      departamento: input.ciudad.trim(),
      provincia: null,
      distrito: null,
      direccion: input.direccion.trim(),
      banco: null,
      cuenta_bancaria: null,
      cci: null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });

    if (error) {
      console.error('[PROVEEDORES] Error al crear:', error.message);
      throw new Error(error.message);
    }

    const nuevo = mapFromDB(inserted as ProveedorDB);
    setProveedores(prev => [nuevo, ...prev]);

    if (DEBUG_PROVEEDORES) {
      console.log('[PROV_CREATED]', { id: nuevo.id, ruc: nuevo.ruc, razonSocial: nuevo.razonSocial });
    }

    return nuevo;
  };

  const actualizarProveedor = async (
    id: string,
    input: ActualizarProveedorInput
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    // Use functional setState to avoid stale closure when reading _dbId
    let dbId: string | undefined;
    setProveedores(prev => {
      const existing = prev.find(p => p.id === id);
      dbId = existing?._dbId;
      return prev;
    });

    if (!dbId) return { exito: false, errores: ['Proveedor no encontrado'] };

    const ahora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (input.razonSocial !== undefined) updatePayload.razon_social = input.razonSocial.trim();
    if (input.nombreComercial !== undefined) updatePayload.nombre_comercial = input.nombreComercial?.trim() ?? null;
    if (input.tipo !== undefined) updatePayload.tipo = input.tipo;
    if (input.categorias !== undefined) updatePayload.categoria = input.categorias[0] ?? 'otros';
    if (input.email !== undefined) updatePayload.email = normalizeEmail(input.email);
    if (input.telefono !== undefined) updatePayload.telefono = normalizeTelefono(input.telefono);
    if (input.telefonoAlternativo !== undefined) {
      updatePayload.celular = input.telefonoAlternativo ? normalizeTelefono(input.telefonoAlternativo) : null;
    }
    if (input.direccion !== undefined) updatePayload.direccion = input.direccion.trim();
    if (input.ciudad !== undefined) updatePayload.departamento = input.ciudad.trim();
    if (input.pais !== undefined) updatePayload.pais = input.pais.trim();
    if (input.observaciones !== undefined) {
      // observaciones not in DB yet; no-op — kept for interface compatibility
    }

    const { error } = await dbProveedores.update(dbId, updatePayload);

    if (error) {
      console.error('[PROVEEDORES] Error al actualizar:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setProveedores(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          ...(input.razonSocial !== undefined && { razonSocial: input.razonSocial.trim() }),
          ...(input.nombreComercial !== undefined && { nombreComercial: input.nombreComercial?.trim() ?? null }),
          ...(input.tipo !== undefined && { tipo: input.tipo }),
          ...(input.categorias !== undefined && { categorias: input.categorias }),
          ...(input.email !== undefined && { email: normalizeEmail(input.email) }),
          ...(input.telefono !== undefined && { telefono: normalizeTelefono(input.telefono) }),
          ...(input.telefonoAlternativo !== undefined && {
            telefonoAlternativo: input.telefonoAlternativo ? normalizeTelefono(input.telefonoAlternativo) : null,
          }),
          ...(input.direccion !== undefined && { direccion: input.direccion.trim() }),
          ...(input.ciudad !== undefined && { ciudad: input.ciudad.trim() }),
          ...(input.pais !== undefined && { pais: input.pais.trim() }),
          ...(input.observaciones !== undefined && { observaciones: input.observaciones?.trim() ?? null }),
          auditoria: {
            ...p.auditoria,
            modificadoPor: user.id,
            modificadoEn: ahora,
          },
        };
      })
    );

    if (DEBUG_PROVEEDORES) {
      console.log('[PROV_UPDATED]', { id, cambios: Object.keys(input) });
    }

    return { exito: true };
  };

  const inactivarProveedor = async (id: string, motivo: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const proveedor = proveedores.find(p => p.id === id);
    if (!proveedor) return { exito: false, errores: ['Proveedor no encontrado'] };
    if (proveedor.estado === 'inactivo') return { exito: false, errores: ['El proveedor ya está inactivo'] };

    const ahora = new Date().toISOString();
    const { error } = await dbProveedores.update(proveedor._dbId, {
      estado: 'inactivo',
      modificado_por: user.id,
      modificado_en: ahora,
    });

    if (error) {
      console.error('[PROVEEDORES] Error al inactivar:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setProveedores(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              estado: 'inactivo' as EstadoProveedor,
              auditoria: {
                ...p.auditoria,
                modificadoPor: user.id,
                modificadoEn: ahora,
                inactivadoPor: user.id,
                inactivadoEn: ahora,
                motivoInactivacion: motivo.trim(),
              },
            }
          : p
      )
    );

    if (DEBUG_PROVEEDORES) {
      console.log('[PROV_INACTIVATED]', { id, motivo: motivo.substring(0, 50) });
    }

    return { exito: true };
  };

  const activarProveedor = async (id: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const proveedor = proveedores.find(p => p.id === id);
    if (!proveedor) return { exito: false, errores: ['Proveedor no encontrado'] };
    if (proveedor.estado !== 'inactivo') return { exito: false, errores: ['El proveedor no está inactivo'] };

    const ahora = new Date().toISOString();
    const { error } = await dbProveedores.update(proveedor._dbId, {
      estado: 'activo',
      modificado_por: user.id,
      modificado_en: ahora,
    });

    if (error) {
      console.error('[PROVEEDORES] Error al activar:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setProveedores(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              estado: 'activo' as EstadoProveedor,
              auditoria: {
                ...p.auditoria,
                modificadoPor: user.id,
                modificadoEn: ahora,
              },
            }
          : p
      )
    );

    if (DEBUG_PROVEEDORES) {
      console.log('[PROV_ACTIVATED]', { id });
    }

    return { exito: true };
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: ProveedorStoreContext = {
    proveedores,
    loading,
    obtenerProveedorPorId,
    obtenerProveedorPorRUC,
    crearProveedor,
    actualizarProveedor,
    inactivarProveedor,
    activarProveedor,
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
