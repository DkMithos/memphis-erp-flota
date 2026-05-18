/**
 * Memphis ERP — Plan de Cuentas Store (PCGE Perú)
 * CRUD del catálogo de cuentas contables.
 * Inicialización automática desde PCGE estándar.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { PCGE_ESTANDAR, type PCGECuenta } from './fiscal-peru';

export type TipoCuenta = 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'costo' | 'orden';
export type NaturalezaCuenta = 'deudora' | 'acreedora';

export interface CuentaContable {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  nivel: number;
  cuentaPadreCodigo: string | null;
  esHoja: boolean;
  aceptaMovimientos: boolean;
  activo: boolean;
  esEstandar: boolean;
  saldoInicial: number;
  saldoActual: number;
  creadoEn: string;
}

export interface NuevaCuentaInput {
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  nivel: number;
  cuentaPadreCodigo?: string;
  esHoja?: boolean;
  saldoInicial?: number;
}

export interface CrudResult { ok: boolean; error?: string; }

const TIPO_LABELS: Record<TipoCuenta, string> = {
  activo: 'Activo', pasivo: 'Pasivo', patrimonio: 'Patrimonio',
  ingreso: 'Ingreso', gasto: 'Gasto', costo: 'Costo', orden: 'Cta. de Orden',
};
export { TIPO_LABELS as TIPO_CUENTA_LABELS };

const TIPO_COLORS: Record<TipoCuenta, string> = {
  activo:     'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  pasivo:     'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  patrimonio: 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  ingreso:    'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  gasto:      'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
  costo:      'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  orden:      'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
};
export { TIPO_COLORS as TIPO_CUENTA_COLORS };

interface PlanCuentasContextValue {
  cuentas: CuentaContable[];
  cuentasHoja: CuentaContable[];   // solo las que aceptan movimientos
  loading: boolean;
  error: string | null;
  inicializarPCGE: () => Promise<void>;
  crearCuenta: (input: NuevaCuentaInput) => Promise<CuentaContable>;
  actualizarCuenta: (id: string, input: Partial<NuevaCuentaInput>) => Promise<CrudResult>;
  toggleActivo: (id: string) => Promise<CrudResult>;
  obtenerPorCodigo: (codigo: string) => CuentaContable | undefined;
  buscar: (q: string) => CuentaContable[];
  recargar: () => void;
}

const PlanCuentasCtx = createContext<PlanCuentasContextValue | null>(null);

export function usePlanCuentas(): PlanCuentasContextValue {
  const ctx = useContext(PlanCuentasCtx);
  if (!ctx) throw new Error('usePlanCuentas fuera de PlanCuentasProvider');
  return ctx;
}

function mapFromDB(row: any): CuentaContable {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    codigo: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo as TipoCuenta,
    naturaleza: row.naturaleza as NaturalezaCuenta,
    nivel: row.nivel,
    cuentaPadreCodigo: row.cuenta_padre_codigo ?? null,
    esHoja: row.es_hoja,
    aceptaMovimientos: row.acepta_movimientos,
    activo: row.activo,
    esEstandar: row.es_estandar,
    saldoInicial: Number(row.saldo_inicial ?? 0),
    saldoActual: Number(row.saldo_actual ?? 0),
    creadoEn: row.creado_en,
  };
}

export function PlanCuentasProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('plan_cuentas')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('codigo');
      if (err) throw err;
      setCuentas((data ?? []).map(mapFromDB));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar plan de cuentas');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { cargar(); }, [cargar]);

  const inicializarPCGE = useCallback(async () => {
    if (!tenantId) throw new Error('Sin sesión');
    setLoading(true);
    try {
      const rows = PCGE_ESTANDAR.map((c: PCGECuenta) => ({
        tenant_id: tenantId,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
        nivel: c.nivel,
        cuenta_padre_codigo: c.nivel > 1 ? null : null,  // se puede calcular después
        es_hoja: c.esHoja,
        acepta_movimientos: c.esHoja,
        activo: true,
        es_estandar: true,
        saldo_inicial: 0,
        saldo_actual: 0,
      }));
      // Insertar en lotes de 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error: err } = await supabase
          .from('plan_cuentas')
          .upsert(batch, { onConflict: 'tenant_id,codigo', ignoreDuplicates: true });
        if (err) throw new Error(err.message);
      }
      await cargar();
    } finally {
      setLoading(false);
    }
  }, [tenantId, cargar]);

  const crearCuenta = useCallback(async (input: NuevaCuentaInput): Promise<CuentaContable> => {
    if (!tenantId) throw new Error('Sin sesión');
    const nivel = input.nivel ?? input.codigo.length;
    const { data, error: err } = await supabase
      .from('plan_cuentas')
      .insert({
        tenant_id: tenantId,
        codigo: input.codigo,
        nombre: input.nombre,
        tipo: input.tipo,
        naturaleza: input.naturaleza,
        nivel,
        cuenta_padre_codigo: input.cuentaPadreCodigo ?? null,
        es_hoja: input.esHoja ?? true,
        acepta_movimientos: input.esHoja ?? true,
        activo: true,
        es_estandar: false,
        saldo_inicial: input.saldoInicial ?? 0,
        saldo_actual: input.saldoInicial ?? 0,
      })
      .select().single();
    if (err) throw new Error(err.message);
    const nueva = mapFromDB(data);
    setCuentas(prev => [...prev, nueva].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return nueva;
  }, [tenantId]);

  const actualizarCuenta = useCallback(async (id: string, input: Partial<NuevaCuentaInput>): Promise<CrudResult> => {
    const upd: Record<string, any> = {};
    if (input.nombre !== undefined)  upd.nombre = input.nombre;
    if (input.tipo !== undefined)    upd.tipo = input.tipo;
    if (input.saldoInicial !== undefined) upd.saldo_inicial = input.saldoInicial;
    const { error: err } = await supabase.from('plan_cuentas').update(upd).eq('id', id);
    if (err) return { ok: false, error: err.message };
    setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...upd, nombre: upd.nombre ?? c.nombre } : c));
    return { ok: true };
  }, []);

  const toggleActivo = useCallback(async (id: string): Promise<CrudResult> => {
    const cuenta = cuentas.find(c => c.id === id);
    if (!cuenta) return { ok: false, error: 'Cuenta no encontrada' };
    const { error: err } = await supabase.from('plan_cuentas').update({ activo: !cuenta.activo }).eq('id', id);
    if (err) return { ok: false, error: err.message };
    setCuentas(prev => prev.map(c => c.id === id ? { ...c, activo: !c.activo } : c));
    return { ok: true };
  }, [cuentas]);

  const obtenerPorCodigo = useCallback((codigo: string) => cuentas.find(c => c.codigo === codigo), [cuentas]);

  const buscar = useCallback((q: string): CuentaContable[] => {
    if (!q) return cuentas;
    const lq = q.toLowerCase();
    return cuentas.filter(c =>
      c.codigo.startsWith(q) ||
      c.nombre.toLowerCase().includes(lq)
    );
  }, [cuentas]);

  const cuentasHoja = cuentas.filter(c => c.esHoja && c.aceptaMovimientos && c.activo);

  return (
    <PlanCuentasCtx.Provider value={{ cuentas, cuentasHoja, loading, error, inicializarPCGE, crearCuenta, actualizarCuenta, toggleActivo, obtenerPorCodigo, buscar, recargar: cargar }}>
      {children}
    </PlanCuentasCtx.Provider>
  );
}
