/**
 * STORE CRM — Clientes, Oportunidades, Actividades
 * Conectado a Supabase
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbClientes, dbOportunidades, dbActividadesCRM } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import { logAudit } from '../shared/audit';
import { validateTransition, OPORTUNIDAD_TRANSITIONS } from '../shared/state-machine';
import type { ClienteDB, OportunidadDB, ActividadCRMDB } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Cliente {
  _dbId: string;
  id: string;              // CLI-NNNN
  razonSocial: string;
  nombreComercial?: string;
  tipo: ClienteDB['tipo'];
  sector?: string;
  estado: ClienteDB['estado'];
  contactoNombre?: string;
  contactoCargo?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  ruc?: string;
  creditoLimite?: number;
  creditoDias?: number;
  moneda: string;
  categoria?: 'A' | 'B' | 'C';
  origen?: string;
  descripcion?: string;
  observaciones?: string;
  ejecutivoCuenta?: string;
  creadoEn: string;
  oportunidadesActivas?: number;
}

export interface Oportunidad {
  _dbId: string;
  id: string;              // OPO-YYYY-NNN
  clienteId: string;       // display CLI-NNNN
  clienteNombre: string;
  clienteDbId: string;     // UUID
  titulo: string;
  descripcion?: string;
  etapa: OportunidadDB['etapa'];
  probabilidad: number;
  montoEstimado?: number;
  moneda: string;
  fechaCierreEstimada?: string;
  fechaCierreReal?: string;
  motivoCierre?: string;
  prioridad: OportunidadDB['prioridad'];
  ejecutivo?: string;
  creadoEn: string;
  diasHastaCierre?: number;
  valorPonderado?: number;
}

export interface ActividadCRM {
  _dbId: string;
  clienteId: string;
  clienteNombre: string;
  clienteDbId: string;
  oportunidadId?: string;
  oportunidadTitulo?: string;
  oportunidadDbId?: string;
  tipo: ActividadCRMDB['tipo'];
  estado: ActividadCRMDB['estado'];
  titulo: string;
  descripcion?: string;
  fechaProgramada: string;
  fechaRealizada?: string;
  resultado?: string;
  proximaAccion?: string;
  realizadoPor?: string;
  creadoEn: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface CRMContextValue {
  clientes: Cliente[];
  oportunidades: Oportunidad[];
  actividades: ActividadCRM[];
  loading: boolean;
  crearCliente: (data: Omit<Cliente, '_dbId' | 'id' | 'creadoEn' | 'oportunidadesActivas'>) => Promise<Cliente>;
  actualizarCliente: (dbId: string, data: Partial<Cliente>) => Promise<{ exito: boolean }>;
  crearOportunidad: (data: Omit<Oportunidad, '_dbId' | 'id' | 'creadoEn' | 'diasHastaCierre' | 'valorPonderado'>) => Promise<Oportunidad>;
  actualizarOportunidad: (dbId: string, data: Partial<Oportunidad>) => Promise<{ exito: boolean }>;
  crearActividad: (data: Omit<ActividadCRM, '_dbId' | 'creadoEn'>) => Promise<ActividadCRM>;
  completarActividad: (dbId: string, resultado: string, proximaAccion?: string) => Promise<{ exito: boolean }>;
}

const CRMContext = createContext<CRMContextValue | undefined>(undefined);

// ============================================================================
// MAPPERS
// ============================================================================

function calcDiasHastaCierre(fechaStr?: string | null): number | undefined {
  if (!fechaStr) return undefined;
  const diff = new Date(fechaStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function mapClienteFromDB(row: ClienteDB): Cliente {
  return {
    _dbId: row.id,
    id: row.codigo,
    razonSocial: row.razon_social,
    nombreComercial: row.nombre_comercial ?? undefined,
    tipo: row.tipo,
    sector: row.sector ?? undefined,
    estado: row.estado,
    contactoNombre: row.contacto_nombre ?? undefined,
    contactoCargo: row.contacto_cargo ?? undefined,
    contactoTelefono: row.contacto_telefono ?? undefined,
    contactoEmail: row.contacto_email ?? undefined,
    departamento: row.departamento ?? undefined,
    provincia: row.provincia ?? undefined,
    distrito: row.distrito ?? undefined,
    direccion: row.direccion ?? undefined,
    ruc: row.ruc ?? undefined,
    creditoLimite: row.credito_limite ?? undefined,
    creditoDias: row.credito_dias ?? undefined,
    moneda: row.moneda,
    categoria: row.categoria ?? undefined,
    origen: row.origen ?? undefined,
    descripcion: row.descripcion ?? undefined,
    observaciones: row.observaciones ?? undefined,
    ejecutivoCuenta: row.ejecutivo_cuenta ?? undefined,
    creadoEn: row.creado_en,
  };
}

function mapOportunidadFromDB(row: OportunidadDB): Oportunidad {
  const cliente = row.cliente as { codigo: string; razon_social: string } | null;
  const monto = row.monto_estimado ?? undefined;
  const prob = row.probabilidad ?? 0;
  return {
    _dbId: row.id,
    id: row.codigo,
    clienteId: cliente?.codigo ?? '',
    clienteNombre: cliente?.razon_social ?? '',
    clienteDbId: row.cliente_id,
    titulo: row.titulo,
    descripcion: row.descripcion ?? undefined,
    etapa: row.etapa,
    probabilidad: prob,
    montoEstimado: monto,
    moneda: row.moneda,
    fechaCierreEstimada: row.fecha_cierre_estimada ?? undefined,
    fechaCierreReal: row.fecha_cierre_real ?? undefined,
    motivoCierre: row.motivo_cierre ?? undefined,
    prioridad: row.prioridad,
    ejecutivo: row.ejecutivo ?? undefined,
    creadoEn: row.creado_en,
    diasHastaCierre: calcDiasHastaCierre(row.fecha_cierre_estimada),
    valorPonderado: monto !== undefined ? Math.round((monto * prob) / 100) : undefined,
  };
}

function mapActividadFromDB(row: ActividadCRMDB): ActividadCRM {
  const cliente = row.cliente as { codigo: string; razon_social: string } | null;
  const opo = row.oportunidad as { codigo: string; titulo: string } | null;
  return {
    _dbId: row.id,
    clienteId: cliente?.codigo ?? '',
    clienteNombre: cliente?.razon_social ?? '',
    clienteDbId: row.cliente_id,
    oportunidadId: opo?.codigo ?? undefined,
    oportunidadTitulo: opo?.titulo ?? undefined,
    oportunidadDbId: row.oportunidad_id ?? undefined,
    tipo: row.tipo,
    estado: row.estado,
    titulo: row.titulo,
    descripcion: row.descripcion ?? undefined,
    fechaProgramada: row.fecha_programada,
    fechaRealizada: row.fecha_realizada ?? undefined,
    resultado: row.resultado ?? undefined,
    proximaAccion: row.proxima_accion ?? undefined,
    realizadoPor: row.realizado_por ?? undefined,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [actividades, setActividades] = useState<ActividadCRM[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const [resClientes, resOpo, resAct] = await Promise.all([
      dbClientes.list(tenantId),
      dbOportunidades.list(tenantId),
      dbActividadesCRM.list(tenantId),
    ]);
    if (resClientes.data) setClientes((resClientes.data as ClienteDB[]).map(mapClienteFromDB));
    if (resOpo.data) setOportunidades((resOpo.data as OportunidadDB[]).map(mapOportunidadFromDB));
    if (resAct.data) setActividades((resAct.data as ActividadCRMDB[]).map(mapActividadFromDB));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Código secuencial helpers ────────────────────────────────────────────

  function nextClienteCodigo(): string {
    const nums = clientes.map(c => {
      const m = c.id.match(/^CLI-(\d{4})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `CLI-${next.toString().padStart(4, '0')}`;
  }

  function nextOportunidadCodigo(): string {
    const year = new Date().getFullYear();
    const nums = oportunidades.map(o => {
      const m = o.id.match(/^OPO-\d{4}-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `OPO-${year}-${next.toString().padStart(3, '0')}`;
  }

  // ── CRUD Clientes ────────────────────────────────────────────────────────

  const crearCliente = useCallback(async (
    data: Omit<Cliente, '_dbId' | 'id' | 'creadoEn' | 'oportunidadesActivas'>
  ): Promise<Cliente> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');
    const codigo = nextClienteCodigo();
    const { data: row, error } = await dbClientes.insert({
      tenant_id: tenantId,
      codigo,
      razon_social: data.razonSocial,
      nombre_comercial: data.nombreComercial ?? null,
      tipo: data.tipo,
      sector: data.sector ?? null,
      estado: data.estado,
      contacto_nombre: data.contactoNombre ?? null,
      contacto_cargo: data.contactoCargo ?? null,
      contacto_telefono: data.contactoTelefono ?? null,
      contacto_email: data.contactoEmail ?? null,
      departamento: data.departamento ?? null,
      provincia: data.provincia ?? null,
      distrito: data.distrito ?? null,
      direccion: data.direccion ?? null,
      ruc: data.ruc ?? null,
      credito_limite: data.creditoLimite ?? null,
      credito_dias: data.creditoDias ?? null,
      moneda: data.moneda,
      categoria: data.categoria ?? null,
      origen: data.origen ?? null,
      descripcion: data.descripcion ?? null,
      observaciones: data.observaciones ?? null,
      ejecutivo_cuenta: data.ejecutivoCuenta ?? null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });
    if (error) throw new Error(error.message);
    const nuevo = mapClienteFromDB(row as ClienteDB);
    setClientes(prev => [...prev, nuevo].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)));
    logAudit({ tenantId, usuarioEmail: user.email, accion: 'crear', entidadTipo: 'cliente', entidadId: nuevo.id, entidadLabel: nuevo.razonSocial });
    return nuevo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, tenantId, user]);

  const actualizarCliente = useCallback(async (
    dbId: string,
    data: Partial<Cliente>
  ): Promise<{ exito: boolean }> => {
    if (!user) return { exito: false };
    const dbData: Partial<ClienteDB> = {
      razon_social: data.razonSocial,
      nombre_comercial: data.nombreComercial,
      tipo: data.tipo,
      sector: data.sector,
      estado: data.estado,
      contacto_nombre: data.contactoNombre,
      contacto_cargo: data.contactoCargo,
      contacto_telefono: data.contactoTelefono,
      contacto_email: data.contactoEmail,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      direccion: data.direccion,
      ruc: data.ruc,
      credito_limite: data.creditoLimite,
      credito_dias: data.creditoDias,
      moneda: data.moneda,
      categoria: data.categoria,
      origen: data.origen,
      descripcion: data.descripcion,
      observaciones: data.observaciones,
      ejecutivo_cuenta: data.ejecutivoCuenta,
      modificado_por: user.id,
      modificado_en: new Date().toISOString(),
    };
    // Remove undefined keys so we only update fields that were explicitly passed
    Object.keys(dbData).forEach(k => { if ((dbData as Record<string, unknown>)[k] === undefined) delete (dbData as Record<string, unknown>)[k]; });
    const { data: row, error } = await dbClientes.update(dbId, dbData);
    if (error) { console.error('[CRM] actualizarCliente:', error.message); return { exito: false }; }
    const actualizado = mapClienteFromDB(row as ClienteDB);
    setClientes(prev => prev.map(c => c._dbId === dbId ? actualizado : c));
    return { exito: true };
  }, [user]);

  // ── CRUD Oportunidades ───────────────────────────────────────────────────

  const crearOportunidad = useCallback(async (
    data: Omit<Oportunidad, '_dbId' | 'id' | 'creadoEn' | 'diasHastaCierre' | 'valorPonderado'>
  ): Promise<Oportunidad> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');
    const codigo = nextOportunidadCodigo();
    const { data: row, error } = await dbOportunidades.insert({
      tenant_id: tenantId,
      cliente_id: data.clienteDbId,
      codigo,
      titulo: data.titulo,
      descripcion: data.descripcion ?? null,
      etapa: data.etapa,
      probabilidad: data.probabilidad,
      monto_estimado: data.montoEstimado ?? null,
      moneda: data.moneda,
      fecha_cierre_estimada: data.fechaCierreEstimada ?? null,
      fecha_cierre_real: data.fechaCierreReal ?? null,
      motivo_cierre: data.motivoCierre ?? null,
      prioridad: data.prioridad,
      ejecutivo: data.ejecutivo ?? null,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    });
    if (error) throw new Error(error.message);
    const nuevo = mapOportunidadFromDB({
      ...(row as OportunidadDB),
      cliente: { codigo: data.clienteId, razon_social: data.clienteNombre },
    });
    setOportunidades(prev => [nuevo, ...prev]);
    logAudit({ tenantId, usuarioEmail: user.email, accion: 'crear', entidadTipo: 'oportunidad', entidadId: nuevo.id, entidadLabel: nuevo.titulo });
    return nuevo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidades, tenantId, user]);

  const actualizarOportunidad = useCallback(async (
    dbId: string,
    data: Partial<Oportunidad>
  ): Promise<{ exito: boolean }> => {
    if (!user) return { exito: false };

    // Validar transición de etapa si se está cambiando
    if (data.etapa) {
      const opActual = oportunidades.find(o => o._dbId === dbId);
      if (opActual && opActual.etapa !== data.etapa) {
        const check = validateTransition(opActual.etapa, data.etapa, OPORTUNIDAD_TRANSITIONS, 'Oportunidad');
        if (!check.valid) return { exito: false };
      }
    }

    const dbData: Partial<OportunidadDB> = {
      titulo: data.titulo,
      descripcion: data.descripcion ?? null,
      etapa: data.etapa,
      probabilidad: data.probabilidad,
      monto_estimado: data.montoEstimado ?? null,
      moneda: data.moneda,
      fecha_cierre_estimada: data.fechaCierreEstimada ?? null,
      fecha_cierre_real: data.fechaCierreReal ?? null,
      motivo_cierre: data.motivoCierre ?? null,
      prioridad: data.prioridad,
      ejecutivo: data.ejecutivo ?? null,
      modificado_por: user.id,
      modificado_en: new Date().toISOString(),
    };
    Object.keys(dbData).forEach(k => { if ((dbData as Record<string, unknown>)[k] === undefined) delete (dbData as Record<string, unknown>)[k]; });
    const { data: row, error } = await dbOportunidades.update(dbId, dbData);
    if (error) { console.error('[CRM] actualizarOportunidad:', error.message); return { exito: false }; }
    const actual = oportunidades.find(o => o._dbId === dbId);
    const actualizado = mapOportunidadFromDB({
      ...(row as OportunidadDB),
      cliente: actual ? { codigo: actual.clienteId, razon_social: actual.clienteNombre } : null,
    });
    setOportunidades(prev => prev.map(o => o._dbId === dbId ? actualizado : o));
    return { exito: true };
  }, [user, oportunidades]);

  // ── CRUD Actividades ─────────────────────────────────────────────────────

  const crearActividad = useCallback(async (
    data: Omit<ActividadCRM, '_dbId' | 'creadoEn'>
  ): Promise<ActividadCRM> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');
    const { data: row, error } = await dbActividadesCRM.insert({
      tenant_id: tenantId,
      cliente_id: data.clienteDbId,
      oportunidad_id: data.oportunidadDbId ?? null,
      tipo: data.tipo,
      estado: data.estado,
      titulo: data.titulo,
      descripcion: data.descripcion ?? null,
      fecha_programada: data.fechaProgramada,
      fecha_realizada: data.fechaRealizada ?? null,
      resultado: data.resultado ?? null,
      proxima_accion: data.proximaAccion ?? null,
      realizado_por: data.realizadoPor ?? null,
      creado_por: user.id,
    });
    if (error) throw new Error(error.message);
    const nuevo = mapActividadFromDB({
      ...(row as ActividadCRMDB),
      cliente: { codigo: data.clienteId, razon_social: data.clienteNombre },
      oportunidad: data.oportunidadId && data.oportunidadTitulo
        ? { codigo: data.oportunidadId, titulo: data.oportunidadTitulo }
        : null,
    });
    setActividades(prev => [nuevo, ...prev]);
    return nuevo;
  }, [tenantId, user]);

  const completarActividad = useCallback(async (
    dbId: string,
    resultado: string,
    proximaAccion?: string
  ): Promise<{ exito: boolean }> => {
    const ahora = new Date().toISOString();
    const { error } = await dbActividadesCRM.update(dbId, {
      estado: 'realizada',
      resultado,
      proxima_accion: proximaAccion ?? null,
      fecha_realizada: ahora,
      realizado_por: user?.id ?? null,
    });
    if (error) { console.error('[CRM] completarActividad:', error.message); return { exito: false }; }
    setActividades(prev => prev.map(a => a._dbId === dbId
      ? { ...a, estado: 'realizada' as const, resultado, proximaAccion, fechaRealizada: ahora }
      : a
    ));
    return { exito: true };
  }, [user]);

  return (
    <CRMContext.Provider value={{
      clientes,
      oportunidades,
      actividades,
      loading,
      crearCliente,
      actualizarCliente,
      crearOportunidad,
      actualizarOportunidad,
      crearActividad,
      completarActividad,
    }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRMStore() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRMStore must be used within CRMProvider');
  return ctx;
}
