/**
 * Proyecto360 — Vista integral del proyecto
 * Muestra: datos generales, fases con presupuesto, flota, compras, gastos, OTs, biomédico
 */

import { useMemo } from 'react';
import {
  ArrowLeft, FolderKanban, Car, Wrench, ShoppingCart, DollarSign,
  Users, Calendar, MapPin, TrendingUp, FileText, Activity,
  ChevronRight, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Progress } from '../../ui/progress';
import { Separator } from '../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { useProyectos, type Proyecto } from '../../../lib/proyectos/proyectos-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { useRequerimientosStore } from '../../../lib/compras/requerimientos-store';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { useOrdenesStore } from '../../../lib/compras/ordenes-store';
import { calcSaldoPreventivo } from '../../../lib/flota/vehiculos-config';

interface Proyecto360Props {
  proyectoDbId: string;
  onNavigate: (route: string) => void;
}

function fmt(amount: number, moneda = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: moneda, minimumFractionDigits: 2,
  }).format(amount);
}

function pctColor(pct: number): string {
  if (pct >= 90) return '[&>div]:bg-red-500';
  if (pct >= 70) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-green-500';
}

const ESTADO_COLORS: Record<string, string> = {
  planificacion: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  en_ejecucion: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pausado: 'bg-yellow-100 text-yellow-700',
  completado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
};

const MODALIDAD_LABELS: Record<string, string> = {
  oxi: 'OXI',
  ioarr: 'IOARR',
  licitacion: 'Licitación',
  adjudicacion: 'Adj. Directa',
  otro: 'Otro',
};

export function Proyecto360({ proyectoDbId, onNavigate }: Proyecto360Props) {
  const { proyectos } = useProyectos();
  const { vehiculos } = useVehiculos();
  const { ordenes } = useOTStore();
  const { requerimientos } = useRequerimientosStore();
  const { cotizaciones } = useCotizacionesStore();
  const { ordenes: ordenesCompra } = useOrdenesStore();

  const proyecto = proyectos.find(p => p._dbId === proyectoDbId);

  // Vehículos del proyecto
  const vehiculosProyecto = useMemo(() =>
    vehiculos.filter(v => v.proyectoId === proyectoDbId),
    [vehiculos, proyectoDbId]
  );

  // OTs del proyecto
  const otsProyecto = useMemo(() =>
    ordenes.filter(ot => ot.proyectoId === proyectoDbId),
    [ordenes, proyectoDbId]
  );

  // Requerimientos del proyecto
  const reqsProyecto = useMemo(() =>
    requerimientos.filter(r => (r as any).proyectoId === proyectoDbId),
    [requerimientos, proyectoDbId]
  );

  // Cotizaciones del proyecto
  const cotsProyecto = useMemo(() =>
    cotizaciones.filter(c => (c as any).proyectoId === proyectoDbId),
    [cotizaciones, proyectoDbId]
  );

  // Órdenes de compra del proyecto
  const ocsProyecto = useMemo(() =>
    ordenesCompra.filter(o => (o as any).proyectoId === proyectoDbId),
    [ordenesCompra, proyectoDbId]
  );

  // OTs for calc
  const otsCalc = useMemo(() =>
    ordenes.map(ot => ({
      vehiculoId: ot.vehiculoId,
      tipo: ot.tipo,
      estado: ot.estado,
      costos: ot.costos,
    })),
    [ordenes]
  );

  // KPIs de flota
  const flotaKpis = useMemo(() => {
    let costoContratado = 0;
    let costoConsumido = 0;
    let preventivosRealizados = 0;
    let preventivosTotal = 0;

    vehiculosProyecto.forEach(v => {
      const saldo = calcSaldoPreventivo(v.id, otsCalc, v.planPreventivoContratado);
      costoContratado += saldo.costoTotalContratado;
      costoConsumido += saldo.costoConsumido;
      preventivosRealizados += saldo.preventivosRealizados;
      preventivosTotal += saldo.preventivosTotal;
    });

    return {
      totalVehiculos: vehiculosProyecto.length,
      activos: vehiculosProyecto.filter(v => v.estado === 'activo').length,
      enTaller: vehiculosProyecto.filter(v => v.estado === 'en_taller').length,
      costoContratado,
      costoConsumido,
      costoRestante: Math.max(0, costoContratado - costoConsumido),
      pctConsumo: costoContratado > 0 ? Math.round((costoConsumido / costoContratado) * 100) : 0,
      preventivosRealizados,
      preventivosTotal,
      otsAbiertas: otsProyecto.filter(ot => ot.estado !== 'cerrada' && ot.estado !== 'anulada').length,
      otsCerradas: otsProyecto.filter(ot => ot.estado === 'cerrada').length,
    };
  }, [vehiculosProyecto, otsProyecto, otsCalc]);

  // KPIs de compras
  const comprasKpis = useMemo(() => ({
    requerimientos: reqsProyecto.length,
    cotizaciones: cotsProyecto.length,
    ordenesCompra: ocsProyecto.length,
    montoOCs: ocsProyecto.reduce((s, o) => s + ((o as any).montoTotal ?? 0), 0),
  }), [reqsProyecto, cotsProyecto, ocsProyecto]);

  // Fases con presupuesto
  const fasesConPresupuesto = useMemo(() =>
    (proyecto?.fases ?? []).map(f => ({
      ...f,
      pctPresupuesto: f.presupuesto && f.presupuesto > 0 && f.costoReal !== undefined
        ? Math.round(((f.costoReal ?? 0) / f.presupuesto) * 100) : 0,
    })),
    [proyecto?.fases]
  );

  if (!proyecto) {
    return (
      <div className="space-y-4">
        <PageNav />
        <Card><CardContent className="py-12 text-center text-muted-foreground">Proyecto no encontrado</CardContent></Card>
      </div>
    );
  }

  const montoTotal = (proyecto.montoContrato ?? 0) + (proyecto.montoAdenda ?? 0);
  const pctAvancePresupuesto = proyecto.presupuesto && proyecto.presupuesto > 0
    ? Math.round(((proyecto.costoReal ?? 0) / proyecto.presupuesto) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('/proyectos')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold">{proyecto.id}</h2>
            <Badge className={ESTADO_COLORS[proyecto.estado] ?? ''}>
              {proyecto.estado.replace('_', ' ')}
            </Badge>
            {proyecto.modalidad && (
              <Badge variant="outline" className="text-xs">
                {MODALIDAD_LABELS[proyecto.modalidad] ?? proyecto.modalidad}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5">{proyecto.nombre}</p>
          {proyecto.entidadCliente && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users className="size-3.5" /> {proyecto.entidadCliente}
              {proyecto.region && <> · <MapPin className="size-3.5" /> {proyecto.region}</>}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate(`/proyectos/detalle/${proyecto._dbId}`)}>
          <FileText className="size-4 mr-1" /> Detalle
        </Button>
      </div>

      {/* KPIs Generales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Monto Contrato</p>
            <p className="text-lg font-bold">{fmt(montoTotal, proyecto.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Presupuesto</p>
            <p className="text-lg font-bold">{fmt(proyecto.presupuesto ?? 0, proyecto.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Costo Real</p>
            <p className="text-lg font-bold text-amber-600">{fmt(proyecto.costoReal ?? 0, proyecto.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avance</p>
            <p className="text-2xl font-bold text-blue-600">{proyecto.porcentajeAvance}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Días restantes</p>
            <p className={`text-2xl font-bold ${proyecto.estaRetrasado ? 'text-red-600' : ''}`}>
              {proyecto.diasRestantes !== undefined ? proyecto.diasRestantes : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avance general</span>
          <span className="font-medium">{proyecto.porcentajeAvance}%</span>
        </div>
        <Progress value={proyecto.porcentajeAvance} className="h-2" />
      </div>

      {/* Tabs: Flota, Compras, Fases, Equipo */}
      <Tabs defaultValue="flota" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="flota" className="gap-1.5">
            <Car className="size-4" /> Flota ({flotaKpis.totalVehiculos})
          </TabsTrigger>
          <TabsTrigger value="compras" className="gap-1.5">
            <ShoppingCart className="size-4" /> Compras ({comprasKpis.ordenesCompra})
          </TabsTrigger>
          <TabsTrigger value="fases" className="gap-1.5">
            <Calendar className="size-4" /> Fases ({fasesConPresupuesto.length})
          </TabsTrigger>
          <TabsTrigger value="finanzas" className="gap-1.5">
            <DollarSign className="size-4" /> Finanzas
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Flota ─────────────────────────────────────────────── */}
        <TabsContent value="flota" className="space-y-4">
          {/* Flota KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Car className="size-5 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold">{flotaKpis.totalVehiculos}</p>
                <p className="text-xs text-muted-foreground">{flotaKpis.activos} activos · {flotaKpis.enTaller} en taller</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="size-5 mx-auto text-blue-600 mb-1" />
                <p className="text-lg font-bold">{fmt(flotaKpis.costoContratado)}</p>
                <p className="text-xs text-muted-foreground">Mant. Contratado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="size-5 mx-auto text-amber-600 mb-1" />
                <p className="text-lg font-bold">{fmt(flotaKpis.costoConsumido)}</p>
                <p className="text-xs text-muted-foreground">Consumido ({flotaKpis.pctConsumo}%)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Wrench className="size-5 mx-auto text-green-600 mb-1" />
                <p className="text-lg font-bold">{flotaKpis.preventivosRealizados}/{flotaKpis.preventivosTotal}</p>
                <p className="text-xs text-muted-foreground">Preventivos · {flotaKpis.otsAbiertas} OTs abiertas</p>
              </CardContent>
            </Card>
          </div>

          {flotaKpis.costoContratado > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consumo mantenimiento</span>
                <span className="font-medium">{flotaKpis.pctConsumo}%</span>
              </div>
              <Progress value={flotaKpis.pctConsumo} className={`h-2 ${pctColor(flotaKpis.pctConsumo)}`} />
            </div>
          )}

          {/* Vehicle list */}
          {vehiculosProyecto.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay vehículos asignados a este proyecto</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {vehiculosProyecto.map(v => {
                  const saldo = calcSaldoPreventivo(v.id, otsCalc, v.planPreventivoContratado);
                  return (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30 cursor-pointer group"
                      onClick={() => onNavigate(`/flota/vehiculos/${v.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{v.placa}</span>
                          <Badge variant="outline" className="text-xs">{v.tipo}</Badge>
                          {v.tipoFlota && <Badge variant="secondary" className="text-xs">{v.tipoFlota}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{v.marca} {v.modelo} · {v.kilometraje.toLocaleString()} km</p>
                      </div>
                      <div className="hidden sm:block text-sm text-center min-w-[60px]">
                        <p className="text-xs text-muted-foreground">Prev.</p>
                        <p className="font-medium">{saldo.preventivosRealizados}/{saldo.preventivosTotal}</p>
                      </div>
                      <div className="hidden md:block min-w-[120px]">
                        {saldo.costoTotalContratado > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{fmt(saldo.costoConsumido)}</span>
                              <span>{saldo.porcentajeCosto}%</span>
                            </div>
                            <Progress value={saldo.porcentajeCosto} className={`h-1.5 ${pctColor(saldo.porcentajeCosto)}`} />
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Compras ────────────────────────────────────────────── */}
        <TabsContent value="compras" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="size-5 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold">{comprasKpis.requerimientos}</p>
                <p className="text-xs text-muted-foreground">Requerimientos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="size-5 mx-auto text-purple-600 mb-1" />
                <p className="text-2xl font-bold">{comprasKpis.cotizaciones}</p>
                <p className="text-xs text-muted-foreground">Cotizaciones</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <ShoppingCart className="size-5 mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold">{comprasKpis.ordenesCompra}</p>
                <p className="text-xs text-muted-foreground">Órdenes Compra</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="size-5 mx-auto text-amber-600 mb-1" />
                <p className="text-lg font-bold">{fmt(comprasKpis.montoOCs)}</p>
                <p className="text-xs text-muted-foreground">Monto OCs</p>
              </CardContent>
            </Card>
          </div>

          {reqsProyecto.length === 0 && cotsProyecto.length === 0 && ocsProyecto.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay compras asociadas a este proyecto</CardContent></Card>
          ) : (
            <>
              {ocsProyecto.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Últimas Órdenes de Compra</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {ocsProyecto.slice(0, 10).map((oc: any) => (
                      <div key={oc.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => onNavigate(`/compras/ordenes/${oc.id}`)}>
                        <div className="flex-1">
                          <span className="font-semibold text-sm">{oc.id}</span>
                          <p className="text-xs text-muted-foreground">{(oc as any).proveedorNombre ?? 'Proveedor'}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{oc.estado}</Badge>
                        <span className="text-sm font-medium">{fmt((oc as any).montoTotal ?? 0)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Tab: Fases ──────────────────────────────────────────────── */}
        <TabsContent value="fases" className="space-y-4">
          {fasesConPresupuesto.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay fases definidas. Agregue fases desde el detalle del proyecto.</CardContent></Card>
          ) : (
            fasesConPresupuesto.map((fase, idx) => {
              const FASE_ESTADO: Record<string, string> = {
                pendiente: 'bg-slate-100 text-slate-600',
                en_progreso: 'bg-blue-100 text-blue-700',
                completada: 'bg-green-100 text-green-700',
                cancelada: 'bg-red-100 text-red-700',
              };
              return (
                <Card key={fase._dbId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground">Fase {idx + 1}</span>
                        <span className="font-semibold">{fase.nombre}</span>
                        <Badge className={`text-xs ${FASE_ESTADO[fase.estado] ?? ''}`}>{fase.estado.replace('_', ' ')}</Badge>
                      </div>
                      {fase.fechaInicio && fase.fechaFin && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(fase.fechaInicio).toLocaleDateString('es-PE')} — {new Date(fase.fechaFin).toLocaleDateString('es-PE')}
                        </span>
                      )}
                    </div>

                    {fase.descripcion && <p className="text-sm text-muted-foreground mb-3">{fase.descripcion}</p>}

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Presupuesto</p>
                        <p className="font-semibold text-sm">{fase.presupuesto ? fmt(fase.presupuesto) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Costo Real</p>
                        <p className="font-semibold text-sm text-amber-600">{fase.costoReal ? fmt(fase.costoReal) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avance</p>
                        <p className="font-semibold text-sm">{fase.porcentajeAvance}%</p>
                      </div>
                    </div>

                    <Progress value={fase.porcentajeAvance} className="h-2" />

                    {fase.presupuesto && fase.presupuesto > 0 && fase.pctPresupuesto > 90 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                        <AlertTriangle className="size-3.5" />
                        Costo real al {fase.pctPresupuesto}% del presupuesto
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Tab: Finanzas ───────────────────────────────────────────── */}
        <TabsContent value="finanzas" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Monto Contrato Base</p>
                <p className="text-xl font-bold">{fmt(proyecto.montoContrato ?? 0, proyecto.moneda)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Adendas</p>
                <p className="text-xl font-bold text-blue-600">{fmt(proyecto.montoAdenda ?? 0, proyecto.moneda)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Contrato</p>
                <p className="text-xl font-bold text-green-600">{fmt(montoTotal, proyecto.moneda)}</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Presupuesto</p>
                <p className="text-lg font-bold">{fmt(proyecto.presupuesto ?? 0, proyecto.moneda)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Costo Real</p>
                <p className="text-lg font-bold text-amber-600">{fmt(proyecto.costoReal ?? 0, proyecto.moneda)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Margen</p>
                <p className={`text-lg font-bold ${montoTotal - (proyecto.costoReal ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(montoTotal - (proyecto.costoReal ?? 0), proyecto.moneda)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Ejecución Presup.</p>
                <p className="text-2xl font-bold">{pctAvancePresupuesto}%</p>
              </CardContent>
            </Card>
          </div>

          {proyecto.presupuesto && proyecto.presupuesto > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Presupuesto ejecutado</span>
                <span className="font-medium">{pctAvancePresupuesto}%</span>
              </div>
              <Progress value={pctAvancePresupuesto} className={`h-2 ${pctColor(pctAvancePresupuesto)}`} />
            </div>
          )}

          {/* Desglose por módulo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Desglose de Gastos por Módulo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="size-4 text-blue-600" />
                    <span className="text-sm">Flota — Mantenimiento Preventivo</span>
                  </div>
                  <span className="font-semibold text-sm">{fmt(flotaKpis.costoConsumido)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-purple-600" />
                    <span className="text-sm">Compras (OCs)</span>
                  </div>
                  <span className="font-semibold text-sm">{fmt(comprasKpis.montoOCs)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
