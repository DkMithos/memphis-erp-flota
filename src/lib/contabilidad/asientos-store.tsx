/**
 * Memphis ERP — Asientos Contables Store
 * Libro Diario: cabeceras + líneas (debe/haber).
 * Número: AST-YYYY-NNNNNN
 * Validación: total_debe === total_haber antes de validar.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

export type TipoAsiento = 'manual' | 'automatico' | 'apertura' | 'cierre' | 'ajuste' | 'diferencia_cambio';
export type EstadoAsiento = 'borrador' | 'validado' | 'anulado';

export interface LineaAsiento {
  id: string;
  asientoId: string;
  numeroLinea: number;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  centroCostoId: string | null;
  debe: number;
  haber: number;
  glosa: string | null;
  rucTercero: string | null;
  nombreTercero: string | null;
}

export interface AsientoContable {
  id: string;
  _dbId: string;
  numero: string;           // AST-YYYY-NNNNNN
  periodoId: string;
  fecha: string;
  glosa: string;
  tipo: TipoAsiento;
  estado: EstadoAsiento;
  moneda: string;
  tipoCambio: number;
  totalDebe: number;
  totalHaber: number;
  balanceado: boolean;      // computed: totalDebe === totalHaber
  docTipo: string | null;
  docSerie: string | null;
  docNumero: string | null;
  rucTercero: string | null;
  nombreTercero: string | null;
  origenModulo: string | null;
  origenReferencia: string | null;
  creadoPor: string | null;
  creadoEn: string;
  modificadoPor: string | null;
  modificadoEn: string | null;
  lineas: LineaAsiento[];
}

export interface LineaAsientoInput {
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  centroCostoId?: string;
  debe: number;
  haber: number;
  glosa?: string;
  rucTercero?: string;
  nombreTercero?: string;
}

export interface NuevoAsientoInput {
  periodoId: string;
  fecha: string;
  glosa: string;
  tipo?: TipoAsiento;
  moneda?: string;
  tipoCambio?: number;
  docTipo?: string;
  docSerie?: string;
  docNumero?: string;
  rucTercero?: string;
  nombreTercero?: string;
  origenModulo?: string;
  origenReferencia?: string;
  lineas: LineaAsientoInput[];
}

export interface CrudResult { ok: boolean; error?: string; }

interface AsientosContextValue {
  asientos: AsientoContable[];
  loading: boolean;
  error: string | null;
  crearAsiento: (input: NuevoAsientoInput) => Promise<AsientoContable>;
  validarAsiento: (id: string) => Promise<CrudResult>;
  anularAsiento: (id: string, motivo?: string) => Promise<CrudResult>;
  obtenerPorNumero: (numero: string) => AsientoContable | undefined;
  obtenerPorPeriodo: (periodoId: string) => AsientoContable[];
  cargarLineas: (asientoId: string) => Promise<LineaAsiento[]>;
  recargar: () => void;
}

const AsientosCtx = createContext<AsientosContextValue | null>(null);

export function useAsientosStore(): AsientosContextValue {
  const ctx = useContext(AsientosCtx);
  if (!ctx) throw new Error('useAsientosStore fuera de AsientosProvider');
  return ctx;
}

function mapLineaFromDB(row: any): LineaAsiento {
  return {
    id: row.id,
    asientoId: row.asiento_id,
    numeroLinea: row.numero_linea,
    cuentaId: row.cuenta_id,
    cuentaCodigo: row.cuenta_codigo,
    cuentaNombre: row.cuenta_nombre,
    centroCostoId: row.centro_costo_id ?? null,
    debe: Number(row.debe ?? 0),
    haber: Number(row.haber ?? 0),
    glosa: row.glosa ?? null,
    rucTercero: row.ruc_tercero ?? null,
    nombreTercero: row.nombre_tercero ?? null,
  };
}

function mapFromDB(row: any, lineas: LineaAsiento[] = []): AsientoContable {
  const totalDebe = Number(row.total_debe ?? 0);
  const totalHaber = Number(row.total_haber ?? 0);
  return {
    id: row.numero,
    _dbId: row.id,
    numero: row.numero,
    periodoId: row.periodo_id,
    fecha: row.fecha,
    glosa: row.glosa,
    tipo: row.tipo as TipoAsiento,
    estado: row.estado as EstadoAsiento,
    moneda: row.moneda ?? 'PEN',
    tipoCambio: Number(row.tipo_cambio ?? 1),
    totalDebe,
    totalHaber,
    balanceado: Math.abs(totalDebe - totalHaber) < 0.01,
    docTipo: row.doc_tipo ?? null,
    docSerie: row.doc_serie ?? null,
    docNumero: row.doc_numero ?? null,
    rucTercero: row.ruc_tercero ?? null,
    nombreTercero: row.nombre_tercero ?? null,
    origenModulo: row.origen_modulo ?? null,
    origenReferencia: row.origen_referencia ?? null,
    creadoPor: row.creado_por ?? null,
    creadoEn: row.creado_en,
    modificadoPor: row.modificado_por ?? null,
    modificadoEn: row.modificado_en ?? null,
    lineas,
  };
}

export function AsientosProvider({ children }: { children: ReactNode }) {
  const { user, tenantId } = useAuth();
  const [asientos, setAsientos] = useState<AsientoContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('asientos_contables')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false })
        .limit(500);
      if (err) throw err;
      setAsientos((data ?? []).map(r => mapFromDB(r)));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar asientos');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { cargar(); }, [cargar]);

  const crearAsiento = useCallback(async (input: NuevoAsientoInput): Promise<AsientoContable> => {
    if (!tenantId || !user?.id) throw new Error('Sin sesión activa');

    // Validar balance
    const totalDebe  = input.lineas.reduce((s, l) => s + (l.debe  || 0), 0);
    const totalHaber = input.lineas.reduce((s, l) => s + (l.haber || 0), 0);
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      throw new Error(`Asiento desbalanceado: Debe=${totalDebe.toFixed(2)} / Haber=${totalHaber.toFixed(2)}`);
    }
    if (input.lineas.length < 2) {
      throw new Error('Un asiento debe tener al menos 2 líneas');
    }

    // Número secuencial
    const { count } = await supabase
      .from('asientos_contables')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    const year = new Date(input.fecha).getFullYear();
    const numero = `AST-${year}-${String((count ?? 0) + 1).padStart(6, '0')}`;

    // Insertar cabecera
    const { data: cab, error: e1 } = await supabase
      .from('asientos_contables')
      .insert({
        tenant_id: tenantId,
        numero,
        periodo_id: input.periodoId,
        fecha: input.fecha,
        glosa: input.glosa,
        tipo: input.tipo ?? 'manual',
        estado: 'borrador',
        moneda: input.moneda ?? 'PEN',
        tipo_cambio: input.tipoCambio ?? 1,
        total_debe: totalDebe,
        total_haber: totalHaber,
        doc_tipo: input.docTipo ?? null,
        doc_serie: input.docSerie ?? null,
        doc_numero: input.docNumero ?? null,
        ruc_tercero: input.rucTercero ?? null,
        nombre_tercero: input.nombreTercero ?? null,
        origen_modulo: input.origenModulo ?? null,
        origen_referencia: input.origenReferencia ?? null,
        creado_por: user.id,
        creado_en: new Date().toISOString(),
      })
      .select().single();
    if (e1) throw new Error(e1.message);

    // Insertar líneas
    const lineasDB = input.lineas.map((l, i) => ({
      tenant_id: tenantId,
      asiento_id: cab.id,
      numero_linea: i + 1,
      cuenta_id: l.cuentaId,
      cuenta_codigo: l.cuentaCodigo,
      cuenta_nombre: l.cuentaNombre,
      centro_costo_id: l.centroCostoId ?? null,
      debe: l.debe,
      haber: l.haber,
      glosa: l.glosa ?? null,
      ruc_tercero: l.rucTercero ?? null,
      nombre_tercero: l.nombreTercero ?? null,
    }));
    const { data: lineasData, error: e2 } = await supabase
      .from('asientos_lineas')
      .insert(lineasDB)
      .select();
    if (e2) throw new Error(e2.message);

    const lineas = (lineasData ?? []).map(mapLineaFromDB);
    const nuevo = mapFromDB(cab, lineas);
    setAsientos(prev => [nuevo, ...prev]);
    return nuevo;
  }, [tenantId, user]);

  const validarAsiento = useCallback(async (id: string): Promise<CrudResult> => {
    const asiento = asientos.find(a => a._dbId === id || a.numero === id);
    if (!asiento) return { ok: false, error: 'Asiento no encontrado' };
    if (!asiento.balanceado) return { ok: false, error: 'El asiento no está balanceado' };
    const { error: err } = await supabase
      .from('asientos_contables')
      .update({ estado: 'validado', modificado_por: user?.id, modificado_en: new Date().toISOString() })
      .eq('id', asiento._dbId);
    if (err) return { ok: false, error: err.message };
    setAsientos(prev => prev.map(a => a._dbId === asiento._dbId ? { ...a, estado: 'validado' as EstadoAsiento } : a));
    return { ok: true };
  }, [asientos, user]);

  const anularAsiento = useCallback(async (id: string): Promise<CrudResult> => {
    const asiento = asientos.find(a => a._dbId === id || a.numero === id);
    if (!asiento) return { ok: false, error: 'Asiento no encontrado' };
    const { error: err } = await supabase
      .from('asientos_contables')
      .update({ estado: 'anulado', modificado_por: user?.id, modificado_en: new Date().toISOString() })
      .eq('id', asiento._dbId);
    if (err) return { ok: false, error: err.message };
    setAsientos(prev => prev.map(a => a._dbId === asiento._dbId ? { ...a, estado: 'anulado' as EstadoAsiento } : a));
    return { ok: true };
  }, [asientos, user]);

  const cargarLineas = useCallback(async (asientoId: string): Promise<LineaAsiento[]> => {
    const { data, error: err } = await supabase
      .from('asientos_lineas')
      .select('*')
      .eq('asiento_id', asientoId)
      .order('numero_linea');
    if (err) return [];
    return (data ?? []).map(mapLineaFromDB);
  }, []);

  const obtenerPorNumero = useCallback((numero: string) =>
    asientos.find(a => a.numero === numero), [asientos]);

  const obtenerPorPeriodo = useCallback((periodoId: string) =>
    asientos.filter(a => a.periodoId === periodoId), [asientos]);

  return (
    <AsientosCtx.Provider value={{ asientos, loading, error, crearAsiento, validarAsiento, anularAsiento, obtenerPorNumero, obtenerPorPeriodo, cargarLineas, recargar: cargar }}>
      {children}
    </AsientosCtx.Provider>
  );
}
