/**
 * ProyectosPanorama — Vista ejecutiva de TODOS los proyectos
 *
 * Panorama General para Gerencia:
 * - KPIs globales (monto total contratado, gasto total, utilidad, margen, cobrado)
 * - 3 vistas: Por Fase (buckets), Por Año (cohorte convenio + calendario), Tabla
 * - Buckets por fase (idea / actos previos / ejecución / post-ejecución) + situación operativa
 * - Click en fila → navega al Proyecto360 (vista ultra detallada)
 *
 * Gasto Real = OCs + Caja Chica. NUNCA OTs. TC por orden (día de emisión).
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Building2, DollarSign, TrendingUp, AlertTriangle,
  ChevronRight, Search, BarChart3, Wallet,
  ArrowUpDown, RefreshCw, Layers, CalendarRange, Table2, HandCoins,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useProyectos, type Proyecto } from '../../../lib/proyectos/proyectos-store';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import {
  formatMonto,
  type ProyectoFinanciero,
} from '../../../lib/proyectos/proyecto-financiero';

// ── Config ──────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  planificacion: { label: 'Planificación', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  en_ejecucion:  { label: 'En Ejecución',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pausado:       { label: 'Pausado',        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completado:    { label: 'Completado',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelado:     { label: 'Cancelado',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  liquidacion:   { label: 'Liquidación',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

/** Buckets macro (fase del ciclo de vida) */
const FASE_CONFIG: Record<string, { label: string; orden: number; color: string; barra: string }> = {
  idea:           { label: 'Idea',           orden: 1, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', barra: 'bg-slate-400' },
  actos_previos:  { label: 'Actos Previos',  orden: 2, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', barra: 'bg-indigo-500' },
  ejecucion:      { label: 'En Ejecución',   orden: 3, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', barra: 'bg-blue-500' },
  post_ejecucion: { label: 'Post-ejecución', orden: 4, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', barra: 'bg-purple-500' },
};
const FASES_ORDEN = Object.keys(FASE_CONFIG).sort((a, b) => FASE_CONFIG[a].orden - FASE_CONFIG[b].orden);

/** Situación operativa (nivel 2 dentro de la fase) */
const SITUACION_CONFIG: Record<string, { label: string; color: string }> = {
  activo:          { label: 'Activo',             color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  suspension:      { label: 'Suspensión',         color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  revision_estado: { label: 'Revisión de Estado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  arbitraje:       { label: 'Arbitraje',          color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  plazo_vencido:   { label: 'Plazo Vencido',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  liquidacion:     { label: 'Liquidación',        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  observado:       { label: 'Observado',          color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

/** Deriva la fase macro de un proyecto (usa fase explícita; si no, mapea desde estado) */
function faseDe(p: Proyecto): string {
  if (p.fase && FASE_CONFIG[p.fase]) return p.fase;
  switch (p.estado as string) {
    case 'liquidacion': return 'post_ejecucion';
    case 'completado': return 'post_ejecucion';
    case 'planificacion': return 'idea';
    default: return 'ejecucion';
  }
}

function semaforoEjecucion(pct: number): string {
  if (pct < 70) return 'text-green-600 dark:text-green-400';
  if (pct < 90) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}
function semaforoProgress(pct: number): string {
  if (pct < 70) return '[&>div]:bg-green-500';
  if (pct < 90) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}
function semaforoMargen(margen: number): string {
  if (margen > 20) return 'text-green-600 dark:text-green-400';
  if (margen > 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ── Tipos internos ──────────────────────────────────────────────────────────

interface GastoAnio { anio: number; gastoOCs: number; gastoCaja: number; gastoTotal: number; }

interface Props {
  onNavigate: (route: string) => void;
}

// ── Componente ──────────────────────────────────────────────────────────────

export function ProyectosPanorama({ onNavigate }: Props) {
  const { proyectos, loading: loadingProyectos } = useProyectos();
  const { tenantId } = useAuth();

  // Vista activa
  const [vista, setVista] = useState<'fase' | 'anio' | 'tabla'>('fase');

  // Filtros (aplican en todas las vistas)
  const [busqueda, setBusqueda] = useState('');
  const [filtroResponsable, setFiltroResponsable] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'nombre' | 'margen' | 'ejecucion' | 'monto'>('monto');

  // Financieros por proyecto (1 sola consulta SQL — evita el N+1 que colgaba)
  const [financieros, setFinancieros] = useState<Record<string, ProyectoFinanciero & { montoCobrado: number; montoPendienteCobro: number; anioConvenio?: number }>>({});
  const [loadingFinanciero, setLoadingFinanciero] = useState(false);

  // Gasto por año calendario (1 consulta SQL)
  const [gastoPorAnio, setGastoPorAnio] = useState<Record<string, GastoAnio[]>>({});

  // No cancelados
  const proyectosRelevantes = useMemo(
    () => proyectos.filter(p => p.estado !== 'cancelado'),
    [proyectos]
  );

  const responsables = useMemo(() => {
    const set = new Set<string>();
    proyectosRelevantes.forEach(p => { if (p.gerenteProyecto) set.add(p.gerenteProyecto); });
    return Array.from(set).sort();
  }, [proyectosRelevantes]);

  // Cargar financieros (resumen) + gasto por año, en 2 RPC
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoadingFinanciero(true);

    (async () => {
      const [resumen, porAnio] = await Promise.all([
        supabase.rpc('proyectos_financiero_resumen', { p_tenant: tenantId }),
        supabase.rpc('proyectos_gasto_por_anio', { p_tenant: tenantId }),
      ]);
      if (cancelled) return;

      if (resumen.error) {
        console.error('[PANORAMA] resumen financiero:', resumen.error.message);
      } else {
        const results: Record<string, any> = {};
        for (const r of (resumen.data ?? []) as any[]) {
          results[r.proyecto_id] = {
            montoContrato: Number(r.monto_contrato ?? 0),
            montoAdendas: Number(r.monto_adenda ?? 0),
            montoContratoTotal: Number(r.monto_contrato_total ?? 0),
            moneda: r.moneda ?? 'PEN',
            gastoOCs: Number(r.gasto_ocs ?? 0),
            gastoCajaChica: Number(r.gasto_caja ?? 0),
            gastoFijos: Number(r.gasto_fijos ?? 0),
            gastoTotal: Number(r.gasto_total ?? 0),
            presupuesto: Number(r.presupuesto ?? 0),
            saldoDisponible: Number(r.saldo_disponible ?? 0),
            porcentajeEjecutado: Number(r.pct_ejecutado ?? 0),
            utilidad: Number(r.utilidad ?? 0),
            margenGanancia: Number(r.margen ?? 0),
            montoCobrado: Number(r.monto_cobrado ?? 0),
            montoPendienteCobro: Number(r.monto_pendiente_cobro ?? 0),
            anioConvenio: r.anio_convenio != null ? Number(r.anio_convenio) : undefined,
            adendas: [], ocs: [], gastosCajaChica: [], gastosFijos: [],
            totalOCs: Number(r.total_ocs ?? 0),
            totalGastosCajaChica: Number(r.total_gastos_caja ?? 0),
          };
        }
        setFinancieros(results);
      }

      if (porAnio.error) {
        console.error('[PANORAMA] gasto por año:', porAnio.error.message);
      } else {
        const byProj: Record<string, GastoAnio[]> = {};
        for (const r of (porAnio.data ?? []) as any[]) {
          (byProj[r.proyecto_id] ??= []).push({
            anio: Number(r.anio),
            gastoOCs: Number(r.gasto_ocs ?? 0),
            gastoCaja: Number(r.gasto_caja ?? 0),
            gastoTotal: Number(r.gasto_total ?? 0),
          });
        }
        setGastoPorAnio(byProj);
      }
      setLoadingFinanciero(false);
    })();

    return () => { cancelled = true; };
  }, [tenantId, proyectos.length]);

  // Filtro de búsqueda/responsable (sin estado: la fase agrupa)
  const proyectosFiltrados = useMemo(() => {
    let list = proyectosRelevantes;
    if (filtroResponsable !== 'todos') list = list.filter(p => p.gerenteProyecto === filtroResponsable);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p =>
        p.id.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (p.entidadCliente ?? '').toLowerCase().includes(q) ||
        (p.region ?? '').toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const fA = financieros[a._dbId];
      const fB = financieros[b._dbId];
      switch (sortBy) {
        case 'margen':    return (fA?.margenGanancia ?? 0) - (fB?.margenGanancia ?? 0);
        case 'ejecucion': return (fB?.porcentajeEjecutado ?? 0) - (fA?.porcentajeEjecutado ?? 0);
        case 'monto':     return (fB?.montoContratoTotal ?? 0) - (fA?.montoContratoTotal ?? 0);
        default:          return a.nombre.localeCompare(b.nombre);
      }
    });
    return list;
  }, [proyectosRelevantes, filtroResponsable, busqueda, sortBy, financieros]);

  // Agrupar por fase (bucket)
  const porFase = useMemo(() => {
    const groups: Record<string, Proyecto[]> = {};
    for (const f of FASES_ORDEN) groups[f] = [];
    for (const p of proyectosFiltrados) {
      const f = faseDe(p);
      (groups[f] ??= []).push(p);
    }
    return groups;
  }, [proyectosFiltrados]);

  // Agregado por año de CONVENIO (cohorte) → utilidad / contrato / gasto
  const cohortePorAnio = useMemo(() => {
    const map: Record<string, { anio: number | null; n: number; contrato: number; gasto: number; utilidad: number }> = {};
    for (const p of proyectosFiltrados) {
      const fin = financieros[p._dbId];
      const anio = fin?.anioConvenio ?? p.anioConvenio ?? null;
      const key = anio == null ? 'sin' : String(anio);
      const g = (map[key] ??= { anio, n: 0, contrato: 0, gasto: 0, utilidad: 0 });
      g.n += 1;
      g.contrato += fin?.montoContratoTotal ?? 0;
      g.gasto += fin?.gastoTotal ?? 0;
      g.utilidad += fin?.utilidad ?? 0;
    }
    return Object.values(map).sort((a, b) => (a.anio ?? 9999) - (b.anio ?? 9999));
  }, [proyectosFiltrados, financieros]);

  // Agregado por año CALENDARIO (gasto real por fecha de OC/caja)
  const gastoCalendario = useMemo(() => {
    const idsVisibles = new Set(proyectosFiltrados.map(p => p._dbId));
    const map: Record<number, number> = {};
    for (const [pid, arr] of Object.entries(gastoPorAnio)) {
      if (!idsVisibles.has(pid)) continue;
      for (const g of arr) map[g.anio] = (map[g.anio] ?? 0) + g.gastoTotal;
    }
    return Object.entries(map)
      .map(([anio, total]) => ({ anio: Number(anio), total }))
      .sort((a, b) => a.anio - b.anio);
  }, [gastoPorAnio, proyectosFiltrados]);

  // KPIs globales
  const kpis = useMemo(() => {
    let montoTotal = 0, gastoTotal = 0, cobradoTotal = 0, enRiesgo = 0;
    proyectosFiltrados.forEach(p => {
      const fin = financieros[p._dbId];
      if (!fin) return;
      montoTotal += fin.montoContratoTotal;
      gastoTotal += fin.gastoTotal;
      cobradoTotal += fin.montoCobrado;
      if (fin.porcentajeEjecutado >= 90) enRiesgo++;
    });
    const utilidadTotal = montoTotal - gastoTotal;
    const margen = montoTotal > 0 ? Math.round((utilidadTotal / montoTotal) * 10000) / 100 : 0;
    return {
      totalProyectos: proyectosFiltrados.length,
      montoTotal, gastoTotal, utilidadTotal, margen,
      cobradoTotal, pendienteCobro: montoTotal - cobradoTotal, enRiesgo,
    };
  }, [financieros, proyectosFiltrados]);

  if (loadingProyectos) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Cargando proyectos...
      </div>
    );
  }

  const maxGastoCal = Math.max(1, ...gastoCalendario.map(g => g.total));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="size-6" />
            Panorama General
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Visión ejecutiva de todos los proyectos &mdash; utilidad, gasto y cobranza en tiempo real
          </p>
        </div>
        {loadingFinanciero && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            Calculando financieros...
          </div>
        )}
      </div>

      {/* KPIs Globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="size-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Contratado</span>
            </div>
            <p className="text-lg font-bold">{formatMonto(kpis.montoTotal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpis.totalProyectos} proyectos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="size-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Gasto (OCs + CC)</span>
            </div>
            <p className="text-lg font-bold text-amber-600">{formatMonto(kpis.gastoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="size-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Utilidad</span>
            </div>
            <p className={`text-lg font-bold ${kpis.utilidadTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMonto(kpis.utilidadTotal)}
            </p>
            <p className={`text-xs mt-0.5 ${semaforoMargen(kpis.margen)}`}>Margen: {kpis.margen.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <HandCoins className="size-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Cobrado</span>
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatMonto(kpis.cobradoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="size-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Pendiente x Cobrar</span>
            </div>
            <p className="text-lg font-bold">{formatMonto(kpis.pendienteCobro)}</p>
          </CardContent>
        </Card>
        <Card className={kpis.enRiesgo > 0 ? 'border-red-200 dark:border-red-900' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`size-4 ${kpis.enRiesgo > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">En Riesgo</span>
            </div>
            <p className={`text-2xl font-bold ${kpis.enRiesgo > 0 ? 'text-red-600' : ''}`}>{kpis.enRiesgo}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ejecución &ge; 90%</p>
          </CardContent>
        </Card>
      </div>

      {/* Switch de vista + filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
              <Button variant={vista === 'fase' ? 'default' : 'ghost'} size="sm" className="h-8 gap-1.5" onClick={() => setVista('fase')}>
                <Layers className="size-3.5" /> Por Fase
              </Button>
              <Button variant={vista === 'anio' ? 'default' : 'ghost'} size="sm" className="h-8 gap-1.5" onClick={() => setVista('anio')}>
                <CalendarRange className="size-3.5" /> Por Año
              </Button>
              <Button variant={vista === 'tabla' ? 'default' : 'ghost'} size="sm" className="h-8 gap-1.5" onClick={() => setVista('tabla')}>
                <Table2 className="size-3.5" /> Tabla
              </Button>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar proyecto, entidad, región..." className="pl-9 h-9"
                value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            {responsables.length > 0 && (
              <Select value={filtroResponsable} onValueChange={setFiltroResponsable}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Responsable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los responsables</SelectItem>
                  {responsables.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[160px] h-9"><ArrowUpDown className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monto">Mayor Monto</SelectItem>
                <SelectItem value="nombre">Nombre A-Z</SelectItem>
                <SelectItem value="margen">Menor Margen</SelectItem>
                <SelectItem value="ejecucion">Mayor Ejecución</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── VISTA: POR FASE (buckets) ──────────────────────────────────── */}
      {vista === 'fase' && (
        <div className="space-y-4">
          {FASES_ORDEN.map(faseKey => {
            const cfg = FASE_CONFIG[faseKey];
            const lista = porFase[faseKey] ?? [];
            const agg = lista.reduce((acc, p) => {
              const fin = financieros[p._dbId];
              acc.contrato += fin?.montoContratoTotal ?? 0;
              acc.gasto += fin?.gastoTotal ?? 0;
              acc.utilidad += fin?.utilidad ?? 0;
              return acc;
            }, { contrato: 0, gasto: 0, utilidad: 0 });
            return (
              <Card key={faseKey}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`inline-block size-2.5 rounded-full ${cfg.barra}`} />
                      {cfg.label}
                      <Badge variant="secondary" className="ml-1">{lista.length}</Badge>
                    </CardTitle>
                    {lista.length > 0 && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Contrato: <b className="text-foreground">{formatMonto(agg.contrato)}</b></span>
                        <span>Gasto: <b className="text-amber-600">{formatMonto(agg.gasto)}</b></span>
                        <span>Utilidad: <b className={agg.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}>{formatMonto(agg.utilidad)}</b></span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {lista.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">Sin proyectos en esta fase</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px]">Código</TableHead>
                          <TableHead>Proyecto</TableHead>
                          <TableHead className="w-[120px]">Situación</TableHead>
                          <TableHead className="text-right w-[120px]">Contrato</TableHead>
                          <TableHead className="text-right w-[120px]">Gasto</TableHead>
                          <TableHead className="text-right w-[110px]">Utilidad</TableHead>
                          <TableHead className="text-right w-[110px]">Saldo x Cobrar</TableHead>
                          <TableHead className="text-right w-[70px]">Margen</TableHead>
                          <TableHead className="w-[36px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lista.map(p => {
                          const fin = financieros[p._dbId];
                          const sit = p.situacion ? SITUACION_CONFIG[p.situacion] : undefined;
                          return (
                            <TableRow key={p._dbId} className="cursor-pointer hover:bg-muted/50"
                              onClick={() => onNavigate(`/proyectos/360/${p._dbId}`)}>
                              <TableCell className="font-mono text-xs font-semibold">{p.id}</TableCell>
                              <TableCell>
                                <p className="font-medium text-sm truncate max-w-[220px]">{p.nombre}</p>
                                <div className="text-xs text-muted-foreground">
                                  {p.entidadCliente}{p.region ? ` · ${p.region}` : ''}{p.anioConvenio ? ` · ${p.anioConvenio}` : ''}
                                </div>
                              </TableCell>
                              <TableCell>
                                {sit ? <Badge className={`text-xs ${sit.color}`}>{sit.label}</Badge>
                                     : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatMonto(fin?.montoContratoTotal ?? 0)}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-amber-600">{fin ? formatMonto(fin.gastoTotal) : '...'}</TableCell>
                              <TableCell className={`text-right font-mono text-sm ${(fin?.utilidad ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fin ? formatMonto(fin.utilidad) : '...'}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">{fin ? formatMonto(fin.montoPendienteCobro) : '...'}</TableCell>
                              <TableCell className={`text-right font-bold text-sm ${semaforoMargen(fin?.margenGanancia ?? 0)}`}>{fin ? `${fin.margenGanancia.toFixed(1)}%` : '...'}</TableCell>
                              <TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── VISTA: POR AÑO (cohorte convenio + calendario) ─────────────── */}
      {vista === 'anio' && (
        <div className="space-y-6">
          {/* Cohorte por año de convenio */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CalendarRange className="size-4" /> Utilidad y contrato por año de convenio (cohorte)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {cohortePorAnio.map(c => (
                <Card key={c.anio ?? 'sin'}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold">{c.anio ?? 'Sin año'}</span>
                      <Badge variant="secondary">{c.n} proy.</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Contrato</span><span className="font-mono">{formatMonto(c.contrato)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gasto</span><span className="font-mono text-amber-600">{formatMonto(c.gasto)}</span></div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="text-muted-foreground">Utilidad</span>
                        <span className={`font-mono font-semibold ${c.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMonto(c.utilidad)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {cohortePorAnio.length === 0 && <p className="text-sm text-muted-foreground">Sin datos</p>}
            </div>
          </div>

          {/* Gasto por año calendario */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Wallet className="size-4" /> Gasto real por año calendario (fecha de OC / caja)
            </h3>
            <Card>
              <CardContent className="p-4 space-y-3">
                {gastoCalendario.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin gasto registrado</p>
                ) : gastoCalendario.map(g => (
                  <div key={g.anio} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-mono font-semibold">{g.anio}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-amber-500/80 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(6, (g.total / maxGastoCal) * 100)}%` }}>
                        <span className="text-xs text-white font-medium whitespace-nowrap">{formatMonto(g.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── VISTA: TABLA (plana, detalle) ──────────────────────────────── */}
      {vista === 'tabla' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Código</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                  <TableHead className="text-right w-[120px]">Contrato</TableHead>
                  <TableHead className="text-right w-[120px]">Gasto Real</TableHead>
                  <TableHead className="text-right w-[110px]">Utilidad</TableHead>
                  <TableHead className="text-right w-[70px]">Margen</TableHead>
                  <TableHead className="w-[130px]">Ejecución</TableHead>
                  <TableHead className="w-[36px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyectosFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No se encontraron proyectos</TableCell></TableRow>
                ) : proyectosFiltrados.map(p => {
                  const fin = financieros[p._dbId];
                  const montoContrato = fin?.montoContratoTotal ?? (p.montoContrato ?? 0) + (p.montoAdenda ?? 0);
                  const gastoReal = fin?.gastoTotal ?? 0;
                  const utilidad = fin?.utilidad ?? montoContrato - gastoReal;
                  const margen = fin?.margenGanancia ?? 0;
                  const pctEjecucion = fin?.porcentajeEjecutado ?? 0;
                  const estadoCfg = ESTADO_CONFIG[p.estado] ?? { label: p.estado, color: 'bg-slate-100 text-slate-700' };
                  return (
                    <TableRow key={p._dbId} className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate(`/proyectos/360/${p._dbId}`)}>
                      <TableCell className="font-mono text-xs font-semibold">{p.id}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm truncate max-w-[250px]">{p.nombre}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {p.entidadCliente && <span>{p.entidadCliente}</span>}
                          {p.region && <span>· {p.region}</span>}
                          {p.gerenteProyecto && <span>· {p.gerenteProyecto}</span>}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={`text-xs ${estadoCfg.color}`}>{estadoCfg.label}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMonto(montoContrato, p.moneda)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-600">{fin ? formatMonto(gastoReal, p.moneda) : <span className="text-muted-foreground text-xs">...</span>}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fin ? formatMonto(utilidad, p.moneda) : '...'}</TableCell>
                      <TableCell className={`text-right font-bold text-sm ${semaforoMargen(margen)}`}>{fin ? `${margen.toFixed(1)}%` : '...'}</TableCell>
                      <TableCell>
                        {fin ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs"><span className={semaforoEjecucion(pctEjecucion)}>{pctEjecucion.toFixed(1)}%</span></div>
                            <Progress value={Math.min(pctEjecucion, 100)} className={`h-1.5 ${semaforoProgress(pctEjecucion)}`} />
                          </div>
                        ) : <span className="text-muted-foreground text-xs">...</span>}
                      </TableCell>
                      <TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1 flex-wrap">
        <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-green-500" /><span>&lt; 70% ejecutado</span></div>
        <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-amber-500" /><span>70-90%</span></div>
        <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-red-500" /><span>&ge; 90% (riesgo)</span></div>
        <span className="ml-auto">Gasto Real = OCs aprobadas + Caja Chica · TC por orden (día de emisión)</span>
      </div>
    </div>
  );
}
