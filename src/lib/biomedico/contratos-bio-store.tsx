/**
 * Memphis ERP — Contratos Biomédico Store
 * Contratos de servicio para equipos biomédicos:
 * garantía OEM, mantenimiento preventivo/correctivo, SLA, integral.
 * Número: CB-YYYY-NNN
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoContratoBio =
  | 'garantia'
  | 'mantenimiento_preventivo'
  | 'correctivo'
  | 'sla'
  | 'oem'
  | 'integral';

export type EstadoContratoBio =
  | 'activo'
  | 'vencido'
  | 'cancelado'
  | 'en_renovacion'
  | 'borrador';

export type MonedaContrato = 'PEN' | 'USD';

export interface SLAContrato {
  tiempoRespuestaHrs: number | null;
  disponibilidadPct: number | null;
  penalidades: string | null;
}

export interface ContratoBio {
  id: string;               // CB-YYYY-NNN
  _dbId: string;            // UUID Supabase
  equipoId: string;         // EB-YYYY-NNN
  equipoNombre: string;
  equipoDbId: string;       // UUID FK
  tipo: TipoContratoBio;
  estado: EstadoContratoBio;
  proveedorNombre: string;
  proveedorId: string | null;
  fechaInicio: string;      // ISO date
  fechaFin: string;         // ISO date
  vigente: boolean;         // calculado: hoy <= fechaFin && activo
  diasParaVencer: number | null; // null si ya venció
  valorContrato: number | null;
  moneda: MonedaContrato;
  cobertura: string | null;
  sla: SLAContrato;
  observaciones: string | null;
  creadoPor: string | null;
  creadoEn: string;
  modificadoPor: string | null;
  modificadoEn: string | null;
}

export interface NuevoContratoBioInput {
  equipoId: string;           // EB-YYYY-NNN
  tipo: TipoContratoBio;
  proveedorNombre: string;
  proveedorId?: string;
  fechaInicio: string;
  fechaFin: string;
  valorContrato?: number;
  moneda?: MonedaContrato;
  cobertura?: string;
  sla?: Partial<SLAContrato>;
  observaciones?: string;
}

export interface CrudResult {
  ok: boolean;
  error?: string;
}

// ─── Labels para UI ──────────────────────────────────────────────────────────

export const TIPO_CONTRATO_LABELS: Record<TipoContratoBio, string> = {
  garantia:                'Garantía',
  mantenimiento_preventivo: 'Mant. Preventivo',
  correctivo:              'Correctivo',
  sla:                     'SLA',
  oem:                     'OEM',
  integral:                'Integral',
};

export const ESTADO_CONTRATO_LABELS: Record<EstadoContratoBio, string> = {
  activo:        'Activo',
  vencido:       'Vencido',
  cancelado:     'Cancelado',
  en_renovacion: 'En Renovación',
  borrador:      'Borrador',
};

export const ESTADO_CONTRATO_COLORS: Record<EstadoContratoBio, string> = {
  activo:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  vencido:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelado:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  en_renovacion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  borrador:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface ContratosBioContextValue {
  contratos: ContratoBio[];
  loading: boolean;
  error: string | null;
  crearContrato: (input: NuevoContratoBioInput) => Promise<ContratoBio>;
  actualizarContrato: (id: string, input: Partial<NuevoContratoBioInput>) => Promise<CrudResult>;
  actualizarEstado: (id: string, estado: EstadoContratoBio) => Promise<CrudResult>;
  eliminarContrato: (dbId: string) => Promise<CrudResult>;
  obtenerContratoPorId: (id: string) => ContratoBio | undefined;
  obtenerContratosPorEquipo: (equipoId: string) => ContratoBio[];
  obtenerContratosActivos: () => ContratoBio[];
  obtenerContratosPorVencer: (diasUmbral?: number) => ContratoBio[];
  recargar: () => void;
}

const ContratosBioContext = createContext<ContratosBioContextValue | null>(null);

export function useContratosBioStore(): ContratosBioContextValue {
  const ctx = useContext(ContratosBioContext);
  if (!ctx) throw new Error('useContratosBioStore debe usarse dentro de ContratosBioProvider');
  return ctx;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function generarNumeroContrato(secuencial: number): string {
  const year = new Date().getFullYear();
  return `CB-${year}-${String(secuencial).padStart(3, '0')}`;
}

function calcularEstadoAuto(
  fechaFin: string,
  estadoActual: EstadoContratoBio,
): EstadoContratoBio {
  if (estadoActual === 'cancelado' || estadoActual === 'borrador') return estadoActual;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (new Date(fechaFin) < hoy) return 'vencido';
  return estadoActual;
}

function calcularVigente(fechaFin: string, estado: EstadoContratoBio): boolean {
  if (estado === 'cancelado' || estado === 'vencido') return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(fechaFin) >= hoy;
}

function calcularDiasParaVencer(fechaFin: string): number | null {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  const diff = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function mapFromDB(row: any, equipoCodigo: string, equipoNombre: string): ContratoBio {
  const estadoCalc = calcularEstadoAuto(row.fecha_fin, row.estado as EstadoContratoBio);
  return {
    id: row.numero,
    _dbId: row.id,
    equipoId: equipoCodigo,
    equipoNombre,
    equipoDbId: row.equipo_id ?? '',
    tipo: row.tipo as TipoContratoBio,
    estado: estadoCalc,
    proveedorNombre: row.proveedor_nombre ?? '',
    proveedorId: row.proveedor_id ?? null,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    vigente: calcularVigente(row.fecha_fin, estadoCalc),
    diasParaVencer: calcularDiasParaVencer(row.fecha_fin),
    valorContrato: row.valor_contrato != null ? Number(row.valor_contrato) : null,
    moneda: (row.moneda ?? 'PEN') as MonedaContrato,
    cobertura: row.cobertura ?? null,
    sla: {
      tiempoRespuestaHrs: row.sla_tiempo_respuesta_hrs ?? null,
      disponibilidadPct: row.sla_disponibilidad_pct != null ? Number(row.sla_disponibilidad_pct) : null,
      penalidades: row.sla_penalidades ?? null,
    },
    observaciones: row.observaciones ?? null,
    creadoPor: row.creado_por ?? null,
    creadoEn: row.creado_en,
    modificadoPor: row.modificado_por ?? null,
    modificadoEn: row.modificado_en ?? null,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ContratosBioProvider({ children }: { children: ReactNode }) {
  const { user, tenantId } = useAuth();
  const [contratos, setContratos] = useState<ContratoBio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('contratos_bio')
        .select(`*, equipo:equipo_id (codigo, nombre)`)
        .eq('tenant_id', tenantId)
        .order('creado_en', { ascending: false });

      if (err) throw err;

      setContratos(
        (data ?? []).map((row: any) => {
          const eq = row.equipo as { codigo: string; nombre: string } | null;
          return mapFromDB(row, eq?.codigo ?? '', eq?.nombre ?? '');
        }),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar contratos');
      console.error('[contratos-bio] cargar:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const crearContrato = useCallback(async (input: NuevoContratoBioInput): Promise<ContratoBio> => {
    if (!tenantId || !user?.id) throw new Error('Sin sesión activa');

    // Obtener UUID del equipo
    const { data: eqRow } = await supabase
      .from('equipos_biomedicos')
      .select('id, codigo, nombre')
      .eq('codigo', input.equipoId)
      .eq('tenant_id', tenantId)
      .single();

    if (!eqRow) throw new Error(`Equipo ${input.equipoId} no encontrado`);

    // Secuencial
    const { count } = await supabase
      .from('contratos_bio')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const numero = generarNumeroContrato((count ?? 0) + 1);

    const { data: newRow, error: err } = await supabase
      .from('contratos_bio')
      .insert({
        tenant_id: tenantId,
        numero,
        equipo_id: eqRow.id,
        tipo: input.tipo,
        estado: 'activo',
        proveedor_nombre: input.proveedorNombre,
        proveedor_id: input.proveedorId ?? null,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
        valor_contrato: input.valorContrato ?? null,
        moneda: input.moneda ?? 'PEN',
        cobertura: input.cobertura ?? null,
        sla_tiempo_respuesta_hrs: input.sla?.tiempoRespuestaHrs ?? null,
        sla_disponibilidad_pct: input.sla?.disponibilidadPct ?? null,
        sla_penalidades: input.sla?.penalidades ?? null,
        observaciones: input.observaciones ?? null,
        creado_por: user.id,
        creado_en: new Date().toISOString(),
      })
      .select(`*, equipo:equipo_id (codigo, nombre)`)
      .single();

    if (err) throw new Error(err.message);

    const eq2 = (newRow as any).equipo as { codigo: string; nombre: string } | null;
    const nuevo = mapFromDB(newRow, eq2?.codigo ?? eqRow.codigo, eq2?.nombre ?? eqRow.nombre);
    setContratos(prev => [nuevo, ...prev]);
    return nuevo;
  }, [tenantId, user]);

  const actualizarContrato = useCallback(async (
    id: string,
    input: Partial<NuevoContratoBioInput>,
  ): Promise<CrudResult> => {
    const contrato = contratos.find(c => c.id === id);
    if (!contrato) return { ok: false, error: 'Contrato no encontrado' };

    const upd: Record<string, any> = {
      modificado_por: user?.id ?? null,
      modificado_en: new Date().toISOString(),
    };
    if (input.tipo !== undefined)             upd.tipo = input.tipo;
    if (input.proveedorNombre !== undefined)  upd.proveedor_nombre = input.proveedorNombre;
    if (input.proveedorId !== undefined)      upd.proveedor_id = input.proveedorId;
    if (input.fechaInicio !== undefined)      upd.fecha_inicio = input.fechaInicio;
    if (input.fechaFin !== undefined)         upd.fecha_fin = input.fechaFin;
    if (input.valorContrato !== undefined)    upd.valor_contrato = input.valorContrato;
    if (input.moneda !== undefined)           upd.moneda = input.moneda;
    if (input.cobertura !== undefined)        upd.cobertura = input.cobertura;
    if (input.sla?.tiempoRespuestaHrs !== undefined) upd.sla_tiempo_respuesta_hrs = input.sla.tiempoRespuestaHrs;
    if (input.sla?.disponibilidadPct !== undefined)  upd.sla_disponibilidad_pct = input.sla.disponibilidadPct;
    if (input.sla?.penalidades !== undefined)        upd.sla_penalidades = input.sla.penalidades;
    if (input.observaciones !== undefined)    upd.observaciones = input.observaciones;

    const { error: err } = await supabase
      .from('contratos_bio')
      .update(upd)
      .eq('id', contrato._dbId);

    if (err) return { ok: false, error: err.message };

    setContratos(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const merged: ContratoBio = {
          ...c,
          tipo:            upd.tipo              ?? c.tipo,
          proveedorNombre: upd.proveedor_nombre  ?? c.proveedorNombre,
          proveedorId:     upd.proveedor_id      ?? c.proveedorId,
          fechaInicio:     upd.fecha_inicio      ?? c.fechaInicio,
          fechaFin:        upd.fecha_fin         ?? c.fechaFin,
          valorContrato:   upd.valor_contrato    ?? c.valorContrato,
          moneda:          upd.moneda            ?? c.moneda,
          cobertura:       upd.cobertura         ?? c.cobertura,
          sla: {
            tiempoRespuestaHrs: upd.sla_tiempo_respuesta_hrs ?? c.sla.tiempoRespuestaHrs,
            disponibilidadPct:  upd.sla_disponibilidad_pct  ?? c.sla.disponibilidadPct,
            penalidades:        upd.sla_penalidades          ?? c.sla.penalidades,
          },
          observaciones:   upd.observaciones     ?? c.observaciones,
          modificadoPor:   upd.modificado_por,
          modificadoEn:    upd.modificado_en,
        };
        const nuevaFechaFin = merged.fechaFin;
        merged.vigente = calcularVigente(nuevaFechaFin, merged.estado);
        merged.diasParaVencer = calcularDiasParaVencer(nuevaFechaFin);
        return merged;
      }),
    );
    return { ok: true };
  }, [contratos, user]);

  const actualizarEstado = useCallback(async (
    id: string,
    estado: EstadoContratoBio,
  ): Promise<CrudResult> => {
    const contrato = contratos.find(c => c.id === id);
    if (!contrato) return { ok: false, error: 'Contrato no encontrado' };

    const { error: err } = await supabase
      .from('contratos_bio')
      .update({
        estado,
        modificado_por: user?.id ?? null,
        modificado_en: new Date().toISOString(),
      })
      .eq('id', contrato._dbId);

    if (err) return { ok: false, error: err.message };

    setContratos(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, estado, vigente: calcularVigente(c.fechaFin, estado) }
          : c,
      ),
    );
    return { ok: true };
  }, [contratos, user]);

  const eliminarContrato = useCallback(async (dbId: string): Promise<CrudResult> => {
    const { error: err } = await supabase
      .from('contratos_bio')
      .delete()
      .eq('id', dbId);

    if (err) return { ok: false, error: err.message };
    setContratos(prev => prev.filter(c => c._dbId !== dbId));
    return { ok: true };
  }, []);

  // ── Selectores ────────────────────────────────────────────────────────────

  const obtenerContratoPorId = useCallback(
    (id: string) => contratos.find(c => c.id === id),
    [contratos],
  );

  const obtenerContratosPorEquipo = useCallback(
    (equipoId: string) => contratos.filter(c => c.equipoId === equipoId),
    [contratos],
  );

  const obtenerContratosActivos = useCallback(
    () => contratos.filter(c => c.estado === 'activo'),
    [contratos],
  );

  const obtenerContratosPorVencer = useCallback(
    (diasUmbral = 30) =>
      contratos.filter(
        c => c.vigente && c.diasParaVencer !== null && c.diasParaVencer <= diasUmbral,
      ),
    [contratos],
  );

  return (
    <ContratosBioContext.Provider
      value={{
        contratos,
        loading,
        error,
        crearContrato,
        actualizarContrato,
        actualizarEstado,
        eliminarContrato,
        obtenerContratoPorId,
        obtenerContratosPorEquipo,
        obtenerContratosActivos,
        obtenerContratosPorVencer,
        recargar: cargar,
      }}
    >
      {children}
    </ContratosBioContext.Provider>
  );
}
