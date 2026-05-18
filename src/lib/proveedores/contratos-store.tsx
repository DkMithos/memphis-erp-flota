/**
 * STORE DE CONTRATOS DE PROVEEDORES
 * Conectado a Supabase — tabla contratos_proveedores
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { dbContratos } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { ContratoProveedor } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Contrato {
  _dbId: string;
  id: string;              // CON-YYYY-NNN
  proveedorId: string;
  proveedorNombre: string;
  proveedorDbId: string;
  tipo: 'servicio' | 'suministro' | 'mantenimiento' | 'consultoria' | 'otro';
  estado: 'borrador' | 'activo' | 'vencido' | 'rescindido' | 'renovacion';
  descripcion: string;
  montoTotal?: number;
  moneda: string;
  fechaInicio: string;
  fechaFin: string;
  fechaFirma?: string;
  condicionesPago?: string;
  penalidades?: string;
  urlDocumento?: string;
  observaciones?: string;
  creadoPor?: string;
  creadoEn: string;
  // computed
  diasRestantes?: number;
  estaVencido: boolean;
}

export interface NuevoContratoInput {
  proveedorId: string;
  proveedorDbId: string;
  tipo: Contrato['tipo'];
  descripcion: string;
  montoTotal?: number;
  moneda: string;
  fechaInicio: string;
  fechaFin: string;
  fechaFirma?: string;
  condicionesPago?: string;
  penalidades?: string;
  urlDocumento?: string;
  observaciones?: string;
}

export interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface ContratosContextValue {
  contratos: Contrato[];
  loading: boolean;
  crearContrato: (input: NuevoContratoInput) => Promise<Contrato>;
  actualizarContrato: (dbId: string, data: Partial<Contrato>) => Promise<CrudResult>;
  cambiarEstado: (dbId: string, estado: Contrato['estado'], extras?: Partial<Contrato>) => Promise<CrudResult>;
  eliminarContrato: (dbId: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ContratosContext = createContext<ContratosContextValue | undefined>(undefined);

// ============================================================================
// HELPERS
// ============================================================================

function calcularDiasRestantes(fechaFin: string): number {
  const fin = new Date(fechaFin).getTime();
  const hoy = new Date().getTime();
  return Math.floor((fin - hoy) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: ContratoProveedor): Contrato {
  const prov = row.proveedor as { codigo: string; razon_social: string } | null;
  const diasRestantes = calcularDiasRestantes(row.fecha_fin);
  return {
    _dbId: row.id,
    id: row.numero,
    proveedorId: prov?.codigo ?? '',
    proveedorNombre: prov?.razon_social ?? '',
    proveedorDbId: row.proveedor_id,
    tipo: row.tipo,
    estado: row.estado,
    descripcion: row.descripcion,
    montoTotal: row.monto_total ?? undefined,
    moneda: row.moneda,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    fechaFirma: row.fecha_firma ?? undefined,
    condicionesPago: row.condiciones_pago ?? undefined,
    penalidades: row.penalidades ?? undefined,
    urlDocumento: row.url_documento ?? undefined,
    observaciones: row.observaciones ?? undefined,
    creadoPor: row.creado_por ?? undefined,
    creadoEn: row.creado_en,
    diasRestantes,
    estaVencido: diasRestantes < 0,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function ContratosProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const contratosRef = useRef(contratos);
  useEffect(() => { contratosRef.current = contratos; }, [contratos]);
  const [loading, setLoading] = useState(true);

  const fetchContratos = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await dbContratos.list(tenantId);
    if (error) {
      console.error('[CONTRATOS] Error al cargar:', error.message);
    } else if (data) {
      setContratos((data as ContratoProveedor[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchContratos();
  }, [fetchContratos]);

  const crearContrato = useCallback(async (input: NuevoContratoInput): Promise<Contrato> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const year = new Date().getFullYear();
    const numeros = contratos.map(c => {
      const m = c.id.match(/^CON-\d{4}-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const numero = `CON-${year}-${siguiente.toString().padStart(3, '0')}`;

    const { data, error } = await dbContratos.insert({
      tenant_id: tenantId,
      proveedor_id: input.proveedorDbId,
      numero,
      tipo: input.tipo,
      estado: 'borrador',
      descripcion: input.descripcion,
      monto_total: input.montoTotal ?? null,
      moneda: input.moneda,
      fecha_inicio: input.fechaInicio,
      fecha_fin: input.fechaFin,
      fecha_firma: input.fechaFirma ?? null,
      condiciones_pago: input.condicionesPago ?? null,
      penalidades: input.penalidades ?? null,
      url_documento: input.urlDocumento ?? null,
      observaciones: input.observaciones ?? null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });

    if (error) throw new Error(error.message);

    const nuevo = mapFromDB({
      ...(data as ContratoProveedor),
      proveedor: { codigo: input.proveedorId, razon_social: '' },
    });
    setContratos(prev => [nuevo, ...prev]);
    return nuevo;
  }, [contratos, tenantId, user]);

  const actualizarContrato = useCallback(async (
    dbId: string,
    updates: Partial<Contrato>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const found = contratosRef.current.some(c => c._dbId === dbId);
    if (!found) return { exito: false, errores: ['Contrato no encontrado'] };

    const ahora = new Date().toISOString();
    const payload: Record<string, unknown> = {
      modificado_por: user.id,
      modificado_en: ahora,
    };

    if (updates.tipo !== undefined) payload.tipo = updates.tipo;
    if (updates.estado !== undefined) payload.estado = updates.estado;
    if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion;
    if (updates.montoTotal !== undefined) payload.monto_total = updates.montoTotal;
    if (updates.moneda !== undefined) payload.moneda = updates.moneda;
    if (updates.fechaInicio !== undefined) payload.fecha_inicio = updates.fechaInicio;
    if (updates.fechaFin !== undefined) payload.fecha_fin = updates.fechaFin;
    if (updates.fechaFirma !== undefined) payload.fecha_firma = updates.fechaFirma;
    if (updates.condicionesPago !== undefined) payload.condiciones_pago = updates.condicionesPago;
    if (updates.penalidades !== undefined) payload.penalidades = updates.penalidades;
    if (updates.urlDocumento !== undefined) payload.url_documento = updates.urlDocumento;
    if (updates.observaciones !== undefined) payload.observaciones = updates.observaciones;

    const { error } = await dbContratos.update(dbId, payload as Partial<ContratoProveedor>);
    if (error) return { exito: false, errores: [error.message] };

    setContratos(prev => prev.map(c => {
      if (c._dbId !== dbId) return c;
      const updated = { ...c, ...updates };
      const diasRestantes = calcularDiasRestantes(updated.fechaFin);
      return { ...updated, diasRestantes, estaVencido: diasRestantes < 0 };
    }));

    return { exito: true };
  }, [user]);

  const cambiarEstado = useCallback(async (
    dbId: string,
    estado: Contrato['estado'],
    extras?: Partial<Contrato>
  ): Promise<CrudResult> => {
    return actualizarContrato(dbId, { estado, ...extras });
  }, [actualizarContrato]);

  const eliminarContrato = useCallback(async (dbId: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };
    const { error } = await dbContratos.delete(dbId);
    if (error) return { exito: false, errores: [error.message] };
    setContratos(prev => prev.filter(c => c._dbId !== dbId));
    return { exito: true };
  }, [user]);

  const value: ContratosContextValue = {
    contratos,
    loading,
    crearContrato,
    actualizarContrato,
    cambiarEstado,
    eliminarContrato,
  };

  return (
    <ContratosContext.Provider value={value}>
      {children}
    </ContratosContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useContratosStore() {
  const context = useContext(ContratosContext);
  if (!context) throw new Error('useContratosStore debe usarse dentro de ContratosProvider');
  return context;
}
