/**
 * STORE FINANZAS — Transacciones, Presupuestos, Caja Chica
 * Conectado a Supabase
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbTransacciones, dbPresupuestos, dbCajasChicas, dbGastosCajaChica } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { TransaccionDB, PresupuestoDB, PresupuestoLineaDB, CajaChicaDB, GastoCajaChicaDB } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface Transaccion {
  _dbId: string;
  id: string;              // TRX-YYYY-NNNN
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  categoria: string;
  subcategoria?: string;
  estado: TransaccionDB['estado'];
  monto: number;
  moneda: string;
  tipoCambio?: number;
  montoSoles?: number;
  fecha: string;
  fechaPago?: string;
  descripcion: string;
  referenciaNúmero?: string;
  referenciaTipo?: string;
  proveedorNombre?: string;
  aprobadoPor?: string;
  comprobanteUrl?: string;
  creadoPor?: string;
  creadoEn: string;
}

export interface PresupuestoLinea {
  _dbId: string;
  categoria: string;
  subcategoria?: string;
  montoPresupuestado: number;
  montoEjecutado: number;
  porcentajeEjecucion: number;
  variacion: number;
}

export interface Presupuesto {
  _dbId: string;
  nombre: string;
  periodo: string;
  tipo: PresupuestoDB['tipo'];
  estado: PresupuestoDB['estado'];
  moneda: string;
  descripcion?: string;
  lineas: PresupuestoLinea[];
  creadoEn: string;
  totalPresupuestado: number;
  totalEjecutado: number;
  porcentajeEjecucionGlobal: number;
}

export interface CajaChica {
  _dbId: string;
  id: string;              // CC-NNN
  nombre: string;
  responsable: string;
  montoAsignado: number;
  montoDisponible: number;
  moneda: string;
  estado: CajaChicaDB['estado'];
  porcentajeUsado: number;
}

export interface GastoCajaChica {
  _dbId: string;
  id: string;              // GCC-YYYY-NNN
  cajaId: string;          // CC-NNN
  cajaNombre: string;
  cajaDbId: string;
  descripcion: string;
  categoria: string;
  monto: number;
  moneda: string;
  fecha: string;
  beneficiario?: string;
  comprobanteNumero?: string;
  comprobanteTipo?: GastoCajaChicaDB['comprobante_tipo'];
  estado: GastoCajaChicaDB['estado'];
  aprobadoPor?: string;
  notas?: string;
  realizadoPor?: string;
  creadoEn: string;
}

// ============================================================================
// MAPPERS DB → FRONTEND
// ============================================================================

function mapTransaccion(row: TransaccionDB): Transaccion {
  return {
    _dbId: row.id,
    id: row.numero,
    tipo: row.tipo,
    categoria: row.categoria,
    subcategoria: row.subcategoria ?? undefined,
    estado: row.estado,
    monto: row.monto,
    moneda: row.moneda,
    tipoCambio: row.tipo_cambio ?? undefined,
    montoSoles: row.monto_soles ?? undefined,
    fecha: row.fecha,
    fechaPago: row.fecha_pago ?? undefined,
    descripcion: row.descripcion,
    referenciaNúmero: row.referencia_numero ?? undefined,
    referenciaTipo: row.referencia_tipo ?? undefined,
    proveedorNombre: row.proveedor_nombre ?? undefined,
    aprobadoPor: row.aprobado_por ?? undefined,
    comprobanteUrl: row.comprobante_url ?? undefined,
    creadoPor: row.creado_por ?? undefined,
    creadoEn: row.creado_en,
  };
}

function mapPresupuesto(row: PresupuestoDB): Presupuesto {
  const lineas: PresupuestoLinea[] = (row.lineas ?? []).map((l: PresupuestoLineaDB) => {
    const pct = l.monto_presupuestado > 0
      ? (l.monto_ejecutado / l.monto_presupuestado) * 100
      : 0;
    return {
      _dbId: l.id,
      categoria: l.categoria,
      subcategoria: l.subcategoria ?? undefined,
      montoPresupuestado: l.monto_presupuestado,
      montoEjecutado: l.monto_ejecutado,
      porcentajeEjecucion: pct,
      variacion: l.monto_presupuestado - l.monto_ejecutado,
    };
  });
  const totalPresupuestado = lineas.reduce((s, l) => s + l.montoPresupuestado, 0);
  const totalEjecutado = lineas.reduce((s, l) => s + l.montoEjecutado, 0);
  const pctGlobal = totalPresupuestado > 0 ? (totalEjecutado / totalPresupuestado) * 100 : 0;
  return {
    _dbId: row.id,
    nombre: row.nombre,
    periodo: row.periodo,
    tipo: row.tipo,
    estado: row.estado,
    moneda: row.moneda,
    descripcion: row.descripcion ?? undefined,
    lineas,
    creadoEn: row.creado_en,
    totalPresupuestado,
    totalEjecutado,
    porcentajeEjecucionGlobal: pctGlobal,
  };
}

function mapCajaChica(row: CajaChicaDB): CajaChica {
  const pct = row.monto_asignado > 0
    ? ((row.monto_asignado - row.monto_disponible) / row.monto_asignado) * 100
    : 0;
  return {
    _dbId: row.id,
    id: row.codigo,
    nombre: row.nombre,
    responsable: row.responsable,
    montoAsignado: row.monto_asignado,
    montoDisponible: row.monto_disponible,
    moneda: row.moneda,
    estado: row.estado,
    porcentajeUsado: pct,
  };
}

function mapGasto(row: GastoCajaChicaDB): GastoCajaChica {
  return {
    _dbId: row.id,
    id: row.numero,
    cajaId: row.caja?.codigo ?? '',
    cajaNombre: row.caja?.nombre ?? '',
    cajaDbId: row.caja_id,
    descripcion: row.descripcion,
    categoria: row.categoria,
    monto: row.monto,
    moneda: row.moneda,
    fecha: row.fecha,
    beneficiario: row.beneficiario ?? undefined,
    comprobanteNumero: row.comprobante_numero ?? undefined,
    comprobanteTipo: row.comprobante_tipo ?? undefined,
    estado: row.estado,
    aprobadoPor: row.aprobado_por ?? undefined,
    notas: row.notas ?? undefined,
    realizadoPor: row.realizado_por ?? undefined,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// CONTEXT
// ============================================================================

interface FinanzasContextValue {
  loading: boolean;
  transacciones: Transaccion[];
  presupuestos: Presupuesto[];
  cajasChicas: CajaChica[];
  gastos: GastoCajaChica[];

  // Transacciones
  addTransaccion: (data: Omit<TransaccionDB, 'id' | 'creado_en'>) => Promise<Transaccion>;
  updateTransaccion: (dbId: string, data: Partial<TransaccionDB>) => Promise<void>;

  // Presupuestos
  addPresupuesto: (data: Omit<PresupuestoDB, 'id' | 'creado_en' | 'lineas'>) => Promise<Presupuesto>;
  updatePresupuesto: (dbId: string, data: Partial<PresupuestoDB>) => Promise<void>;
  addLineaPresupuesto: (presupuestoDbId: string, tenantId: string, linea: { categoria: string; subcategoria?: string; monto_presupuestado: number }) => Promise<void>;
  updateLineaPresupuesto: (lineaDbId: string, data: { categoria?: string; subcategoria?: string; monto_presupuestado?: number; monto_ejecutado?: number }) => Promise<void>;
  deleteLineaPresupuesto: (lineaDbId: string, presupuestoDbId: string) => Promise<void>;

  // Cajas Chicas
  addCajaChica: (data: Omit<CajaChicaDB, 'id' | 'creado_en'>) => Promise<CajaChica>;
  updateCajaChica: (dbId: string, data: Partial<CajaChicaDB>) => Promise<void>;

  // Gastos Caja Chica
  addGasto: (data: Omit<GastoCajaChicaDB, 'id' | 'creado_en' | 'caja'>) => Promise<GastoCajaChica>;
  updateGasto: (dbId: string, data: Partial<GastoCajaChicaDB>) => Promise<void>;

  reload: () => Promise<void>;
}

const FinanzasContext = createContext<FinanzasContextValue | null>(null);

export function FinanzasProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [cajasChicas, setCajasChicas] = useState<CajaChica[]>([]);
  const [gastos, setGastos] = useState<GastoCajaChica[]>([]);

  const load = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [t, p, c, g] = await Promise.all([
        dbTransacciones.list(tenantId),
        dbPresupuestos.list(tenantId),
        dbCajasChicas.list(tenantId),
        dbGastosCajaChica.list(tenantId),
      ]);
      setTransacciones((t.data ?? []).map(r => mapTransaccion(r as TransaccionDB)));
      setPresupuestos((p.data ?? []).map(r => mapPresupuesto(r as unknown as PresupuestoDB)));
      setCajasChicas((c.data ?? []).map(r => mapCajaChica(r as CajaChicaDB)));
      setGastos((g.data ?? []).map(r => mapGasto(r as unknown as GastoCajaChicaDB)));
    } catch (err) {
      console.error('[FinanzasStore.load]', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // ── Transacciones ──
  const addTransaccion = useCallback(async (data: Omit<TransaccionDB, 'id' | 'creado_en'>) => {
    const { data: row, error } = await dbTransacciones.insert(data);
    if (error || !row) throw new Error(error?.message ?? 'Error al crear transacción');
    const trx = mapTransaccion(row as TransaccionDB);
    setTransacciones(prev => [trx, ...prev]);
    return trx;
  }, []);

  const updateTransaccion = useCallback(async (dbId: string, data: Partial<TransaccionDB>) => {
    const { data: row, error } = await dbTransacciones.update(dbId, data);
    if (error || !row) throw new Error(error?.message ?? 'Error al actualizar transacción');
    const trx = mapTransaccion(row as TransaccionDB);
    setTransacciones(prev => prev.map(t => t._dbId === dbId ? trx : t));
  }, []);

  // ── Presupuestos ──
  const addPresupuesto = useCallback(async (data: Omit<PresupuestoDB, 'id' | 'creado_en' | 'lineas'>) => {
    const { data: row, error } = await dbPresupuestos.insert(data);
    if (error || !row) throw new Error(error?.message ?? 'Error al crear presupuesto');
    const p = mapPresupuesto({ ...(row as PresupuestoDB), lineas: [] });
    setPresupuestos(prev => [p, ...prev]);
    return p;
  }, []);

  const updatePresupuesto = useCallback(async (dbId: string, data: Partial<PresupuestoDB>) => {
    const { data: row, error } = await dbPresupuestos.update(dbId, data);
    if (error || !row) throw new Error(error?.message ?? 'Error al actualizar presupuesto');
    setPresupuestos(prev => prev.map(p => {
      if (p._dbId !== dbId) return p;
      return mapPresupuesto({ ...(row as PresupuestoDB), lineas: p.lineas.map(l => ({
        id: l._dbId, tenant_id: data.tenant_id ?? '', presupuesto_id: dbId,
        categoria: l.categoria, subcategoria: l.subcategoria ?? null,
        monto_presupuestado: l.montoPresupuestado, monto_ejecutado: l.montoEjecutado,
        centro_costo_id: null,
      })) });
    }));
  }, []);

  const addLineaPresupuesto = useCallback(async (
    presupuestoDbId: string,
    tenantIdVal: string,
    linea: { categoria: string; subcategoria?: string; monto_presupuestado: number }
  ) => {
    const { data: row, error } = await dbPresupuestos.insertLinea({
      tenant_id: tenantIdVal,
      presupuesto_id: presupuestoDbId,
      categoria: linea.categoria,
      subcategoria: linea.subcategoria,
      monto_presupuestado: linea.monto_presupuestado,
      monto_ejecutado: 0,
    });
    if (error || !row) throw new Error(error?.message ?? 'Error al agregar línea');
    const newLinea: PresupuestoLinea = {
      _dbId: (row as PresupuestoLineaDB).id,
      categoria: (row as PresupuestoLineaDB).categoria,
      subcategoria: (row as PresupuestoLineaDB).subcategoria ?? undefined,
      montoPresupuestado: (row as PresupuestoLineaDB).monto_presupuestado,
      montoEjecutado: (row as PresupuestoLineaDB).monto_ejecutado,
      porcentajeEjecucion: 0,
      variacion: (row as PresupuestoLineaDB).monto_presupuestado,
    };
    setPresupuestos(prev => prev.map(p => {
      if (p._dbId !== presupuestoDbId) return p;
      const lineas = [...p.lineas, newLinea];
      const tp = lineas.reduce((s, l) => s + l.montoPresupuestado, 0);
      const te = lineas.reduce((s, l) => s + l.montoEjecutado, 0);
      return { ...p, lineas, totalPresupuestado: tp, totalEjecutado: te, porcentajeEjecucionGlobal: tp > 0 ? (te / tp) * 100 : 0 };
    }));
  }, []);

  const updateLineaPresupuesto = useCallback(async (
    lineaDbId: string,
    data: { categoria?: string; subcategoria?: string; monto_presupuestado?: number; monto_ejecutado?: number }
  ) => {
    const { data: row, error } = await dbPresupuestos.updateLinea(lineaDbId, data);
    if (error || !row) throw new Error(error?.message ?? 'Error al actualizar línea');
    const updated = row as PresupuestoLineaDB;
    setPresupuestos(prev => prev.map(p => {
      const idx = p.lineas.findIndex(l => l._dbId === lineaDbId);
      if (idx === -1) return p;
      const lineas = [...p.lineas];
      const pct = updated.monto_presupuestado > 0 ? (updated.monto_ejecutado / updated.monto_presupuestado) * 100 : 0;
      lineas[idx] = {
        _dbId: updated.id,
        categoria: updated.categoria,
        subcategoria: updated.subcategoria ?? undefined,
        montoPresupuestado: updated.monto_presupuestado,
        montoEjecutado: updated.monto_ejecutado,
        porcentajeEjecucion: pct,
        variacion: updated.monto_presupuestado - updated.monto_ejecutado,
      };
      const tp = lineas.reduce((s, l) => s + l.montoPresupuestado, 0);
      const te = lineas.reduce((s, l) => s + l.montoEjecutado, 0);
      return { ...p, lineas, totalPresupuestado: tp, totalEjecutado: te, porcentajeEjecucionGlobal: tp > 0 ? (te / tp) * 100 : 0 };
    }));
  }, []);

  const deleteLineaPresupuesto = useCallback(async (lineaDbId: string, presupuestoDbId: string) => {
    const { error } = await dbPresupuestos.deleteLinea(lineaDbId);
    if (error) throw new Error(error.message);
    setPresupuestos(prev => prev.map(p => {
      if (p._dbId !== presupuestoDbId) return p;
      const lineas = p.lineas.filter(l => l._dbId !== lineaDbId);
      const tp = lineas.reduce((s, l) => s + l.montoPresupuestado, 0);
      const te = lineas.reduce((s, l) => s + l.montoEjecutado, 0);
      return { ...p, lineas, totalPresupuestado: tp, totalEjecutado: te, porcentajeEjecucionGlobal: tp > 0 ? (te / tp) * 100 : 0 };
    }));
  }, []);

  // ── Cajas Chicas ──
  const addCajaChica = useCallback(async (data: Omit<CajaChicaDB, 'id' | 'creado_en'>) => {
    const { data: row, error } = await dbCajasChicas.insert(data);
    if (error || !row) throw new Error(error?.message ?? 'Error al crear caja chica');
    const c = mapCajaChica(row as CajaChicaDB);
    setCajasChicas(prev => [...prev, c]);
    return c;
  }, []);

  const updateCajaChica = useCallback(async (dbId: string, data: Partial<CajaChicaDB>) => {
    const { data: row, error } = await dbCajasChicas.update(dbId, data);
    if (error || !row) throw new Error(error?.message ?? 'Error al actualizar caja chica');
    const c = mapCajaChica(row as CajaChicaDB);
    setCajasChicas(prev => prev.map(x => x._dbId === dbId ? c : x));
  }, []);

  // ── Gastos Caja Chica ──
  const addGasto = useCallback(async (data: Omit<GastoCajaChicaDB, 'id' | 'creado_en' | 'caja'>) => {
    const { data: row, error } = await dbGastosCajaChica.insert(data);
    if (error || !row) throw new Error(error?.message ?? 'Error al registrar gasto');
    // Reload gastos to get joined caja data
    await load();
    return gastos[0]; // will be refreshed
  }, [load, gastos]);

  const updateGasto = useCallback(async (dbId: string, data: Partial<GastoCajaChicaDB>) => {
    const { data: row, error } = await dbGastosCajaChica.update(dbId, data);
    if (error || !row) throw new Error(error?.message ?? 'Error al actualizar gasto');
    await load();
  }, [load]);

  const value: FinanzasContextValue = {
    loading,
    transacciones,
    presupuestos,
    cajasChicas,
    gastos,
    addTransaccion,
    updateTransaccion,
    addPresupuesto,
    updatePresupuesto,
    addLineaPresupuesto,
    updateLineaPresupuesto,
    deleteLineaPresupuesto,
    addCajaChica,
    updateCajaChica,
    addGasto,
    updateGasto,
    reload: load,
  };

  return <FinanzasContext.Provider value={value}>{children}</FinanzasContext.Provider>;
}

export function useFinanzas() {
  const ctx = useContext(FinanzasContext);
  if (!ctx) throw new Error('useFinanzas must be used within FinanzasProvider');
  return ctx;
}
