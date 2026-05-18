/**
 * STORE DE CLIENTES / SEDES / ÁREAS CLÍNICAS
 * Jerarquía para ubicar equipos biomédicos.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbClientesBio, dbSedes, dbAreasClincias } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { ClienteBio, Sede, AreaClinica } from '../supabase/types';

// Re-export for convenience
export type { ClienteBio, Sede, AreaClinica };

export interface NuevoClienteBioInput {
  nombre: string;
  ruc?: string;
  tipo: ClienteBio['tipo'];
  sector: ClienteBio['sector'];
  telefono?: string;
  email?: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  contrato_activo?: boolean;
  contrato_inicio?: string;
  contrato_fin?: string;
  observaciones?: string;
}

export interface NuevaSedeInput {
  cliente_id: string;
  nombre: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  telefono?: string;
  responsable?: string;
}

export interface NuevaAreaInput {
  sede_id: string;
  nombre: string;
  tipo?: string;
  piso?: string;
  responsable?: string;
}

interface SedesStoreContext {
  clientes: ClienteBio[];
  sedes: Sede[];
  areas: AreaClinica[];
  loading: boolean;
  // Selectors
  sedesByCliente: (clienteId: string) => Sede[];
  areasBySede: (sedeId: string) => AreaClinica[];
  clienteById: (id: string) => ClienteBio | undefined;
  sedeById: (id: string) => Sede | undefined;
  areaById: (id: string) => AreaClinica | undefined;
  // CRUD
  crearCliente: (data: NuevoClienteBioInput) => Promise<ClienteBio>;
  actualizarCliente: (id: string, data: Partial<NuevoClienteBioInput>) => Promise<void>;
  crearSede: (data: NuevaSedeInput) => Promise<Sede>;
  actualizarSede: (id: string, data: Partial<NuevaSedeInput>) => Promise<void>;
  crearArea: (data: NuevaAreaInput) => Promise<AreaClinica>;
  actualizarArea: (id: string, data: Partial<NuevaAreaInput>) => Promise<void>;
}

const SedesContext = createContext<SedesStoreContext | undefined>(undefined);

// Contador para códigos
function buildCodigo(prefix: string, existing: { codigo: string }[]): string {
  const nums = existing
    .map(e => parseInt(e.codigo.split('-')[1] ?? '0', 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export function SedesStoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [clientes, setClientes] = useState<ClienteBio[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [areas, setAreas] = useState<AreaClinica[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [rC, rS, rA] = await Promise.all([
        dbClientesBio.list(),
        dbSedes.list(),
        dbAreasClincias.list(),
      ]);
      if (rC.data) setClientes(rC.data as ClienteBio[]);
      if (rS.data) setSedes(rS.data as Sede[]);
      if (rA.data) setAreas(rA.data as AreaClinica[]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sedesByCliente = useCallback((clienteId: string) =>
    sedes.filter(s => s.cliente_id === clienteId), [sedes]);

  const areasBySede = useCallback((sedeId: string) =>
    areas.filter(a => a.sede_id === sedeId), [areas]);

  const clienteById = useCallback((id: string) =>
    clientes.find(c => c.id === id), [clientes]);

  const sedeById = useCallback((id: string) =>
    sedes.find(s => s.id === id), [sedes]);

  const areaById = useCallback((id: string) =>
    areas.find(a => a.id === id), [areas]);

  const crearCliente = useCallback(async (data: NuevoClienteBioInput): Promise<ClienteBio> => {
    if (!tenantId) throw new Error('Sin tenant');
    const codigo = buildCodigo('CLI', clientes);
    const { data: row, error } = await dbClientesBio.create({
      ...data,
      codigo,
      tenant_id: tenantId,
      creado_por: user?.id ?? null,
      modificado_por: null,
      modificado_en: null,
    });
    if (error || !row) throw new Error(error?.message ?? 'Error al crear cliente');
    const nuevo = row as ClienteBio;
    setClientes(prev => [...prev, nuevo]);
    return nuevo;
  }, [tenantId, user, clientes]);

  const actualizarCliente = useCallback(async (id: string, data: Partial<NuevoClienteBioInput>) => {
    const { error } = await dbClientesBio.update(id, { ...data, modificado_por: user?.id ?? null, modificado_en: new Date().toISOString() });
    if (error) throw new Error(error.message);
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, [user]);

  const crearSede = useCallback(async (data: NuevaSedeInput): Promise<Sede> => {
    if (!tenantId) throw new Error('Sin tenant');
    const codigo = buildCodigo('SED', sedes);
    const { data: row, error } = await dbSedes.create({
      ...data,
      codigo,
      tenant_id: tenantId,
      estado: 'activo',
      creado_por: user?.id ?? null,
      modificado_por: null,
      modificado_en: null,
    });
    if (error || !row) throw new Error(error?.message ?? 'Error al crear sede');
    const nueva = row as Sede;
    setSedes(prev => [...prev, nueva]);
    return nueva;
  }, [tenantId, user, sedes]);

  const actualizarSede = useCallback(async (id: string, data: Partial<NuevaSedeInput>) => {
    const { error } = await dbSedes.update(id, { ...data, modificado_por: user?.id ?? null, modificado_en: new Date().toISOString() });
    if (error) throw new Error(error.message);
    setSedes(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, [user]);

  const crearArea = useCallback(async (data: NuevaAreaInput): Promise<AreaClinica> => {
    if (!tenantId) throw new Error('Sin tenant');
    const codigo = buildCodigo('AREA', areas);
    const { data: row, error } = await dbAreasClincias.create({
      ...data,
      codigo,
      tenant_id: tenantId,
      estado: 'activo',
      creado_por: user?.id ?? null,
      modificado_por: null,
      modificado_en: null,
    });
    if (error || !row) throw new Error(error?.message ?? 'Error al crear área');
    const nueva = row as AreaClinica;
    setAreas(prev => [...prev, nueva]);
    return nueva;
  }, [tenantId, user, areas]);

  const actualizarArea = useCallback(async (id: string, data: Partial<NuevaAreaInput>) => {
    const { error } = await dbAreasClincias.update(id, { ...data, modificado_por: user?.id ?? null, modificado_en: new Date().toISOString() });
    if (error) throw new Error(error.message);
    setAreas(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, [user]);

  return (
    <SedesContext.Provider value={{
      clientes, sedes, areas, loading,
      sedesByCliente, areasBySede,
      clienteById, sedeById, areaById,
      crearCliente, actualizarCliente,
      crearSede, actualizarSede,
      crearArea, actualizarArea,
    }}>
      {children}
    </SedesContext.Provider>
  );
}

export function useSedesStore(): SedesStoreContext {
  const ctx = useContext(SedesContext);
  if (!ctx) throw new Error('useSedesStore debe usarse dentro de SedesStoreProvider');
  return ctx;
}
