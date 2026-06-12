/**
 * ProyectosPanorama — Vista ejecutiva de TODOS los proyectos
 *
 * Panorama General para Gerencia:
 * - KPIs globales (monto total contratado, gasto total, utilidad, margen)
 * - Tabla de proyectos con semáforos de ejecución presupuestal
 * - Filtros por estado, responsable, región
 * - Click en fila → navega al Proyecto360 (vista ultra detallada)
 *
 * Gasto Real = OCs + Caja Chica. NUNCA OTs.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Building2, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  ChevronRight, Search, Filter, Eye, BarChart3, Wallet,
  ArrowUpDown, RefreshCw, Percent,
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
import {
  calcularFinancieroProyecto,
  formatMonto,
  type ProyectoFinanciero,
} from '../../../lib/proyectos/proyecto-financiero';

// ── Config ──────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<Proyecto['estado'], { label: string; color: string }> = {
  planificacion: { label: 'Planificacion', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  en_ejecucion:  { label: 'En Ejecucion',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pausado:       { label: 'Pausado',        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completado:    { label: 'Completado',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelado:     { label: 'Cancelado',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

/** Color semaforo para ejecucion presupuestal */
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

interface ProyectoConFinanzas {
  proyecto: Proyecto;
  financiero: ProyectoFinanciero | null;
  loading: boolean;
}

interface Props {
  onNavigate: (route: string) => void;
}

// ── Componente ──────────────────────────────────────────────────────────────

export function ProyectosPanorama({ onNavigate }: Props) {
  const { proyectos, loading: loadingProyectos } = useProyectos();

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroResponsable, setFiltroResponsable] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'nombre' | 'margen' | 'ejecucion' | 'monto'>('nombre');

  // Financieros por proyecto
  const [financieros, setFinancieros] = useState<Record<string, ProyectoFinanciero>>({});
  const [loadingFinanciero, setLoadingFinanciero] = useState(false);

  // Proyectos activos (no cancelados)
  const proyectosRelevantes = useMemo(() =>
    proyectos.filter(p => p.estado !== 'cancelado'),
    [proyectos]
  );

  // Responsables unicos
  const responsables = useMemo(() => {
    const set = new Set<string>();
    proyectosRelevantes.forEach(p => {
      if (p.gerenteProyecto) set.add(p.gerenteProyecto);
    });
    return Array.from(set).sort();
  }, [proyectosRelevantes]);

  // Cargar financieros de todos los proyectos
  useEffect(() => {
    if (proyectosRelevantes.length === 0) return;

    let cancelled = false;
    setLoadingFinanciero(true);

    async function loadAll() {
      const results: Record<string, ProyectoFinanciero> = {};

      // Cargar en batches de 5 para no saturar
      const batches: Proyecto[][] = [];
      for (let i = 0; i < proyectosRelevantes.length; i += 5) {
        batches.push(proyectosRelevantes.slice(i, i + 5));
      }

      for (const batch of batches) {
        if (cancelled) break;
        const promises = batch.map(async (p) => {
          try {
            const fin = await calcularFinancieroProyecto({
              _dbId: p._dbId,
              montoContrato: p.montoContrato,
              presupuesto: p.presupuesto,
              moneda: p.moneda,
            });
            results[p._dbId] = fin;
          } catch (err) {
            console.error(`[PANORAMA] Error financiero ${p.id}:`, err);
          }
        });
        await Promise.all(promises);
      }

      if (!cancelled) {
        setFinancieros(results);
        setLoadingFinanciero(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [proyectosRelevantes]);

  // Filtrar + ordenar
  const proyectosFiltrados = useMemo(() => {
    let list = proyectosRelevantes;

    // Estado
    if (filtroEstado !== 'todos') {
      list = list.filter(p => p.estado === filtroEstado);
    }

    // Responsable
    if (filtroResponsable !== 'todos') {
      list = list.filter(p => p.gerenteProyecto === filtroResponsable);
    }

    // Busqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p =>
        p.id.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (p.entidadCliente ?? '').toLowerCase().includes(q) ||
        (p.region ?? '').toLowerCase().includes(q)
      );
    }

    // Ordenar
    list = [...list].sort((a, b) => {
      const fA = financieros[a._dbId];
      const fB = financieros[b._dbId];
      switch (sortBy) {
        case 'margen':
          return (fA?.margenGanancia ?? 0) - (fB?.margenGanancia ?? 0); // menor margen primero (alerta)
        case 'ejecucion':
          return (fB?.porcentajeEjecutado ?? 0) - (fA?.porcentajeEjecutado ?? 0); // mayor ejecucion primero
        case 'monto':
          return (fB?.montoContratoTotal ?? 0) - (fA?.montoContratoTotal ?? 0); // mayor monto primero
        default:
          return a.nombre.localeCompare(b.nombre);
      }
    });

    return list;
  }, [proyectosRelevantes, filtroEstado, filtroResponsable, busqueda, sortBy, financieros]);

  // KPIs globales
  const kpisGlobales = useMemo(() => {
    let montoTotal = 0;
    let gastoTotal = 0;
    let presupuestoTotal = 0;
    let proyectosEnRiesgo = 0;

    Object.values(financieros).forEach(fin => {
      montoTotal += fin.montoContratoTotal;
      gastoTotal += fin.gastoTotal;
      presupuestoTotal += fin.presupuesto;
      if (fin.porcentajeEjecutado >= 90) proyectosEnRiesgo++;
    });

    const utilidadTotal = montoTotal - gastoTotal;
    const margenPromedio = montoTotal > 0
      ? Math.round((utilidadTotal / montoTotal) * 10000) / 100
      : 0;
    const ejecucionPromedio = presupuestoTotal > 0
      ? Math.round((gastoTotal / presupuestoTotal) * 10000) / 100
      : 0;

    return {
      totalProyectos: proyectosRelevantes.length,
      montoTotal,
      gastoTotal,
      utilidadTotal,
      margenPromedio,
      ejecucionPromedio,
      presupuestoTotal,
      saldoTotal: presupuestoTotal - gastoTotal,
      proyectosEnRiesgo,
    };
  }, [financieros, proyectosRelevantes]);

  if (loadingProyectos) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Cargando proyectos...
      </div>
    );
  }

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
            Vision ejecutiva de todos los proyectos &mdash; KPIs financieros en tiempo real
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="size-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Monto Total Contratado</span>
            </div>
            <p className="text-xl font-bold">{formatMonto(kpisGlobales.montoTotal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpisGlobales.totalProyectos} proyectos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="size-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Gasto Total (OCs + CC)</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatMonto(kpisGlobales.gastoTotal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kpisGlobales.ejecucionPromedio.toFixed(1)}% del presupuesto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="size-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Utilidad Global</span>
            </div>
            <p className={`text-xl font-bold ${kpisGlobales.utilidadTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMonto(kpisGlobales.utilidadTotal)}
            </p>
            <p className={`text-xs mt-0.5 ${semaforoMargen(kpisGlobales.margenPromedio)}`}>
              Margen: {kpisGlobales.margenPromedio.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="size-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Saldo Disponible</span>
            </div>
            <p className={`text-xl font-bold ${kpisGlobales.saldoTotal >= 0 ? '' : 'text-red-600'}`}>
              {formatMonto(kpisGlobales.saldoTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Presupuesto - Gasto</p>
          </CardContent>
        </Card>

        <Card className={kpisGlobales.proyectosEnRiesgo > 0 ? 'border-red-200 dark:border-red-900' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`size-4 ${kpisGlobales.proyectosEnRiesgo > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">En Riesgo</span>
            </div>
            <p className={`text-3xl font-bold ${kpisGlobales.proyectosEnRiesgo > 0 ? 'text-red-600' : ''}`}>
              {kpisGlobales.proyectosEnRiesgo}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Ejecucion &ge; 90%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proyecto, entidad, region..."
                className="pl-9 h-9"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[160px] h-9">
                <Filter className="size-3.5 mr-1" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="planificacion">Planificacion</SelectItem>
                <SelectItem value="en_ejecucion">En Ejecucion</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
              </SelectContent>
            </Select>
            {responsables.length > 0 && (
              <Select value={filtroResponsable} onValueChange={setFiltroResponsable}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los responsables</SelectItem>
                  {responsables.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[160px] h-9">
                <ArrowUpDown className="size-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nombre">Nombre A-Z</SelectItem>
                <SelectItem value="margen">Menor Margen</SelectItem>
                <SelectItem value="ejecucion">Mayor Ejecucion</SelectItem>
                <SelectItem value="monto">Mayor Monto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de proyectos */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Codigo</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead className="text-right w-[130px]">Contrato</TableHead>
                <TableHead className="text-right w-[130px]">Gasto Real</TableHead>
                <TableHead className="text-right w-[100px]">Utilidad</TableHead>
                <TableHead className="text-right w-[80px]">Margen</TableHead>
                <TableHead className="w-[140px]">Ejecucion</TableHead>
                <TableHead className="w-[80px]">Avance</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyectosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    No se encontraron proyectos con los filtros seleccionados
                  </TableCell>
                </TableRow>
              ) : (
                proyectosFiltrados.map(p => {
                  const fin = financieros[p._dbId];
                  const montoContrato = fin?.montoContratoTotal ?? (p.montoContrato ?? 0) + (p.montoAdenda ?? 0);
                  const gastoReal = fin?.gastoTotal ?? 0;
                  const utilidad = fin?.utilidad ?? montoContrato - gastoReal;
                  const margen = fin?.margenGanancia ?? (montoContrato > 0 ? Math.round((utilidad / montoContrato) * 100) : 0);
                  const pctEjecucion = fin?.porcentajeEjecutado ?? 0;
                  const estadoCfg = ESTADO_CONFIG[p.estado];

                  return (
                    <TableRow
                      key={p._dbId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onNavigate(`/proyectos/360/${p._dbId}`)}
                    >
                      <TableCell className="font-mono text-sm font-semibold">{p.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[250px]">{p.nombre}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {p.entidadCliente && <span>{p.entidadCliente}</span>}
                            {p.region && <span>· {p.region}</span>}
                            {p.gerenteProyecto && <span>· {p.gerenteProyecto}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${estadoCfg.color}`}>
                          {estadoCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMonto(montoContrato, p.moneda)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-600">
                        {fin ? formatMonto(gastoReal, p.moneda) : (
                          <span className="text-muted-foreground text-xs">...</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fin ? formatMonto(utilidad, p.moneda) : '...'}
                      </TableCell>
                      <TableCell className={`text-right font-bold text-sm ${semaforoMargen(margen)}`}>
                        {fin ? `${margen.toFixed(1)}%` : '...'}
                      </TableCell>
                      <TableCell>
                        {fin ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className={semaforoEjecucion(pctEjecucion)}>
                                {pctEjecucion.toFixed(1)}%
                              </span>
                            </div>
                            <Progress
                              value={Math.min(pctEjecucion, 100)}
                              className={`h-1.5 ${semaforoProgress(pctEjecucion)}`}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">...</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">{p.porcentajeAvance}%</span>
                          {p.estaRetrasado && (
                            <AlertTriangle className="size-3.5 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-green-500" />
          <span>&lt; 70% ejecutado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-amber-500" />
          <span>70-90% ejecutado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-500" />
          <span>&ge; 90% ejecutado (riesgo)</span>
        </div>
        <span className="ml-auto">Gasto Real = OCs aprobadas + Caja Chica aprobada</span>
      </div>
    </div>
  );
}
