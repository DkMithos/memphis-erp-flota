/**
 * Proyecto360 — Vista ultra detallada de UN proyecto
 *
 * Responde TODAS las preguntas de Gerencia:
 * - Monto contratado, adendas individuales, total contrato
 * - Presupuesto (techo), gasto real (OCs + CC), saldo disponible
 * - Utilidad, margen de ganancia con semáforos
 * - Flota: vehículos agrupados por tipo, mantenimientos, saldo preventivo
 * - Equipos biomédicos del proyecto
 * - Compras: requerimientos, cotizaciones, OCs
 * - Fases, avance, días restantes, riesgos
 * - Equipo responsable
 *
 * Gasto Real = OCs + Caja Chica. NUNCA OTs (evitar duplicar).
 *
 * v2.0.0 — Con paginación, agrupación por tipo de flota, contadores OT reales
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Car, Wrench, ShoppingCart, DollarSign,
  Users, Calendar, MapPin, FileText,
  ChevronRight, ChevronLeft, AlertTriangle, Activity, Wallet,
  RefreshCw, Heart, Receipt, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Progress } from '../../ui/progress';
import { Separator } from '../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { useRequerimientosStore } from '../../../lib/compras/requerimientos-store';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { useOrdenesStore } from '../../../lib/compras/ordenes-store';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { calcSaldoPreventivo } from '../../../lib/flota/vehiculos-config';
import {
  calcularFinancieroProyecto,
  colorEjecucion,
  colorMargen,
  type ProyectoFinanciero,
} from '../../../lib/proyectos/proyecto-financiero';

// ─── Constants ─────────────────────────────────────────────────────────────
const PAGE_SIZE_VEHICLES = 20;
const PAGE_SIZE_OCS = 15;
const PAGE_SIZE_CC = 15;

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

function semaforoText(color: 'green' | 'yellow' | 'red'): string {
  if (color === 'green') return 'text-green-600 dark:text-green-400';
  if (color === 'yellow') return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
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
  licitacion: 'Licitacion',
  adjudicacion: 'Adj. Directa',
  otro: 'Otro',
};

// ─── Pagination component ──────────────────────────────────────────────────
function Pagination({ page, totalPages, onPageChange }: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-xs text-muted-foreground">
        Pagina {page} de {totalPages}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline" size="sm" disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline" size="sm" disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export function Proyecto360({ proyectoDbId, onNavigate }: Proyecto360Props) {
  const { proyectos } = useProyectos();
  const { vehiculos } = useVehiculos();
  const { ordenes } = useOTStore();
  const { requerimientos } = useRequerimientosStore();
  const { cotizaciones } = useCotizacionesStore();
  const { ordenes: ordenesCompra } = useOrdenesStore();
  const { equipos } = useEquiposStore();

  const proyecto = proyectos.find(p => p._dbId === proyectoDbId);

  // ── Pagination state ──
  const [flotaPage, setFlotaPage] = useState(1);
  const [ocsPage, setOcsPage] = useState(1);
  const [ccPage, setCcPage] = useState(1);
  const [flotaTipoFilter, setFlotaTipoFilter] = useState<string | null>(null);

  // ── Financiero real (OCs + Caja Chica desde Supabase) ──
  const [financiero, setFinanciero] = useState<ProyectoFinanciero | null>(null);
  const [loadingFin, setLoadingFin] = useState(true);

  useEffect(() => {
    if (!proyecto) return;
    let cancelled = false;
    setLoadingFin(true);

    calcularFinancieroProyecto({
      _dbId: proyecto._dbId,
      montoContrato: proyecto.montoContrato,
      montoAdenda: proyecto.montoAdenda,
      presupuesto: proyecto.presupuesto,
      moneda: proyecto.moneda,
      montoCobrado: proyecto.montoCobrado,
      anioConvenio: proyecto.anioConvenio,
    }).then(fin => {
      if (!cancelled) {
        setFinanciero(fin);
        setLoadingFin(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingFin(false);
    });

    return () => { cancelled = true; };
  }, [proyecto?._dbId, proyecto?.montoContrato, proyecto?.montoAdenda, proyecto?.presupuesto, proyecto?.moneda]);

  // ── Vehiculos del proyecto ──
  const vehiculosProyecto = useMemo(() =>
    vehiculos.filter(v => v.proyectoId === proyectoDbId),
    [vehiculos, proyectoDbId]
  );

  // ── Equipos biomedicos del proyecto ──
  const equiposProyecto = useMemo(() =>
    equipos.filter(e => e.proyectoId === proyectoDbId),
    [equipos, proyectoDbId]
  );

  // ── OTs del proyecto: match por vehiculoId de los vehículos del proyecto ──
  // IMPORTANTE: Las OTs no siempre tienen proyecto_id seteado, así que
  // buscamos por vehículos que pertenecen al proyecto
  const vehiculoIdsProyecto = useMemo(() =>
    new Set(vehiculosProyecto.map(v => v.id)),
    [vehiculosProyecto]
  );

  const otsProyecto = useMemo(() =>
    ordenes.filter(ot =>
      vehiculoIdsProyecto.has(ot.vehiculoId) || ot.proyectoId === proyectoDbId
    ),
    [ordenes, vehiculoIdsProyecto, proyectoDbId]
  );

  // ── Compras del proyecto (local stores) ──
  const reqsProyecto = useMemo(() =>
    requerimientos.filter(r => (r as any).proyectoId === proyectoDbId),
    [requerimientos, proyectoDbId]
  );
  const cotsProyecto = useMemo(() =>
    cotizaciones.filter(c => (c as any).proyectoId === proyectoDbId),
    [cotizaciones, proyectoDbId]
  );
  const ocsProyecto = useMemo(() =>
    ordenesCompra.filter(o => (o as any).proyectoId === proyectoDbId),
    [ordenesCompra, proyectoDbId]
  );

  // OTs for preventive calc — ALL OTs (not filtered by project)
  const otsCalc = useMemo(() =>
    ordenes.map(ot => ({
      vehiculoId: ot.vehiculoId,
      tipo: ot.tipo,
      estado: ot.estado,
      costos: ot.costos,
    })),
    [ordenes]
  );

  // ── Agrupar vehiculos por tipo de flota ──
  const vehiculosPorTipo = useMemo(() => {
    const grupos: Record<string, typeof vehiculosProyecto> = {};
    vehiculosProyecto.forEach(v => {
      const tipo = v.tipoFlota || v.tipo || 'Sin tipo';
      if (!grupos[tipo]) grupos[tipo] = [];
      grupos[tipo].push(v);
    });
    // Sort by count descending
    return Object.entries(grupos).sort((a, b) => b[1].length - a[1].length);
  }, [vehiculosProyecto]);

  // ── Vehículos filtrados por tipo (con paginación) ──
  const vehiculosFiltrados = useMemo(() => {
    if (flotaTipoFilter) {
      return vehiculosProyecto.filter(v => {
        const tipo = v.tipoFlota || v.tipo || 'Sin tipo';
        return tipo === flotaTipoFilter;
      });
    }
    return vehiculosProyecto;
  }, [vehiculosProyecto, flotaTipoFilter]);

  const flotaTotalPages = Math.max(1, Math.ceil(vehiculosFiltrados.length / PAGE_SIZE_VEHICLES));
  const vehiculosPagina = vehiculosFiltrados.slice(
    (flotaPage - 1) * PAGE_SIZE_VEHICLES,
    flotaPage * PAGE_SIZE_VEHICLES
  );

  // Reset page when filter changes
  useEffect(() => { setFlotaPage(1); }, [flotaTipoFilter]);

  // ── KPIs de flota + mantenimiento ──
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

    // OT counters
    const otsCerradas = otsProyecto.filter(ot => ot.estado === 'cerrada').length;
    const otsAbiertas = otsProyecto.filter(ot =>
      ot.estado !== 'cerrada' && ot.estado !== 'anulada'
    ).length;
    const otsAnuladas = otsProyecto.filter(ot => ot.estado === 'anulada').length;
    const otsCorrectivas = otsProyecto.filter(ot => ot.tipo === 'correctivo').length;
    const otsPreventivas = otsProyecto.filter(ot => ot.tipo === 'preventivo').length;

    // Agrupar por tipo de flota
    const porTipo: Record<string, number> = {};
    vehiculosProyecto.forEach(v => {
      const tipo = v.tipoFlota || v.tipo || 'Sin tipo';
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;
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
      preventivosRestantes: Math.max(0, preventivosTotal - preventivosRealizados),
      otsTotal: otsProyecto.length,
      otsAbiertas,
      otsCerradas,
      otsAnuladas,
      otsCorrectivas,
      otsPreventivas,
      porTipo,
    };
  }, [vehiculosProyecto, otsProyecto, otsCalc]);

  // ── Fases con presupuesto ──
  const fasesConPresupuesto = useMemo(() =>
    (proyecto?.fases ?? []).map(f => ({
      ...f,
      pctPresupuesto: f.presupuesto && f.presupuesto > 0 && f.costoReal !== undefined
        ? Math.round(((f.costoReal ?? 0) / f.presupuesto) * 100) : 0,
    })),
    [proyecto?.fases]
  );

  // ── Not found ──
  if (!proyecto) {
    return (
      <div className="space-y-4">
        <PageNav />
        <Card><CardContent className="py-12 text-center text-muted-foreground">Proyecto no encontrado</CardContent></Card>
      </div>
    );
  }

  // ── Datos financieros (usar financiero real cuando disponible, fallback a proyecto) ──
  const fin = financiero;
  const montoContrato = fin?.montoContrato ?? (proyecto.montoContrato ?? 0);
  const montoAdendas = fin?.montoAdendas ?? (proyecto.montoAdenda ?? 0);
  const montoContratoTotal = fin?.montoContratoTotal ?? (montoContrato + montoAdendas);
  const gastoTotal = fin?.gastoTotal ?? 0;
  const presupuesto = fin?.presupuesto ?? (proyecto.presupuesto ?? montoContratoTotal);
  const saldoDisponible = fin?.saldoDisponible ?? (presupuesto - gastoTotal);
  const pctEjecucion = fin?.porcentajeEjecutado ?? 0;
  const utilidad = fin?.utilidad ?? (montoContratoTotal - gastoTotal);
  const margen = fin?.margenGanancia ?? 0;

  // ── OCs paginadas ──
  const ocsFinList = fin?.ocs ?? [];
  const ocsTotalPages = Math.max(1, Math.ceil(ocsFinList.length / PAGE_SIZE_OCS));
  const ocsPagina = ocsFinList.slice(
    (ocsPage - 1) * PAGE_SIZE_OCS,
    ocsPage * PAGE_SIZE_OCS
  );

  // ── CC paginados ──
  const ccFinList = fin?.gastosCajaChica ?? [];
  const ccTotalPages = Math.max(1, Math.ceil(ccFinList.length / PAGE_SIZE_CC));
  const ccPagina = ccFinList.slice(
    (ccPage - 1) * PAGE_SIZE_CC,
    ccPage * PAGE_SIZE_CC
  );

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
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
            {loadingFin && (
              <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-muted-foreground mt-0.5">{proyecto.nombre}</p>
          {proyecto.entidadCliente && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users className="size-3.5" /> {proyecto.entidadCliente}
              {proyecto.region && <> · <MapPin className="size-3.5" /> {proyecto.region}</>}
            </p>
          )}
          {proyecto.gerenteProyecto && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Responsable: <span className="font-medium">{proyecto.gerenteProyecto}</span>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate(`/proyectos/detalle/${proyecto._dbId}`)}>
          <FileText className="size-4 mr-1" /> Editar
        </Button>
      </div>

      {/* ═══ KPIs Financieros Principales (responde a Gerencia) ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Contrato Total</p>
            <p className="text-lg font-bold">{fmt(montoContratoTotal, proyecto.moneda)}</p>
            {montoAdendas > 0 && (
              <p className="text-xs text-blue-600">+{fin?.adendas?.length ?? 0} adendas</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Presupuesto (Techo)</p>
            <p className="text-lg font-bold">{fmt(presupuesto, proyecto.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Gasto Real</p>
            <p className="text-lg font-bold text-amber-600">{fmt(gastoTotal, proyecto.moneda)}</p>
            <p className="text-xs text-muted-foreground">OCs + Caja Chica</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Saldo Disponible</p>
            <p className={`text-lg font-bold ${saldoDisponible >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(saldoDisponible, proyecto.moneda)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Utilidad</p>
            <p className={`text-lg font-bold ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(utilidad, proyecto.moneda)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Margen</p>
            <p className={`text-2xl font-bold ${semaforoText(colorMargen(margen))}`}>
              {margen.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avance</p>
            <p className="text-2xl font-bold text-blue-600">{proyecto.porcentajeAvance}%</p>
            {proyecto.estaRetrasado && (
              <p className="text-xs text-red-600 flex items-center justify-center gap-1">
                <AlertTriangle className="size-3" /> Retrasado
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Barra de ejecucion presupuestal */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ejecucion presupuestal</span>
          <span className={`font-medium ${semaforoText(colorEjecucion(pctEjecucion))}`}>
            {pctEjecucion.toFixed(1)}%
          </span>
        </div>
        <Progress value={Math.min(pctEjecucion, 100)} className={`h-2.5 ${pctColor(pctEjecucion)}`} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Gastado: {fmt(gastoTotal, proyecto.moneda)}</span>
          <span>Techo: {fmt(presupuesto, proyecto.moneda)}</span>
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <Tabs defaultValue="finanzas" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="finanzas" className="gap-1.5">
            <DollarSign className="size-4" /> Finanzas
          </TabsTrigger>
          <TabsTrigger value="flota" className="gap-1.5">
            <Car className="size-4" /> Flota ({flotaKpis.totalVehiculos})
          </TabsTrigger>
          {equiposProyecto.length > 0 && (
            <TabsTrigger value="biomedico" className="gap-1.5">
              <Heart className="size-4" /> Biomedico ({equiposProyecto.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="compras" className="gap-1.5">
            <ShoppingCart className="size-4" /> Compras
          </TabsTrigger>
          <TabsTrigger value="fases" className="gap-1.5">
            <Calendar className="size-4" /> Fases ({fasesConPresupuesto.length})
          </TabsTrigger>
          <TabsTrigger value="equipo" className="gap-1.5">
            <Users className="size-4" /> Equipo ({proyecto.miembros.length})
          </TabsTrigger>
        </TabsList>

        {/* ══════ Tab: Finanzas ══════ */}
        <TabsContent value="finanzas" className="space-y-4">
          {/* Contrato + Adendas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4" /> Contrato y Adendas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Monto Contrato Base</span>
                <span className="font-bold">{fmt(montoContrato, proyecto.moneda)}</span>
              </div>

              {/* Adendas individuales */}
              {fin && fin.adendas.length > 0 ? (
                <>
                  <Separator />
                  {fin.adendas.map(a => (
                    <div key={a._dbId} className="flex items-center justify-between pl-4">
                      <div>
                        <span className="text-sm font-medium">Adenda N.o {a.numero}</span>
                        {a.descripcion && (
                          <p className="text-xs text-muted-foreground">{a.descripcion}</p>
                        )}
                        {a.fecha && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.fecha).toLocaleDateString('es-PE')}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-blue-600">
                        +{fmt(a.monto, a.moneda)}
                      </span>
                    </div>
                  ))}
                </>
              ) : montoAdendas !== 0 ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Adenda / Equivalente {montoAdendas < 0 ? '(reducción)' : ''}</span>
                    <span className={`font-semibold ${montoAdendas < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {montoAdendas < 0 ? '−' : '+'}{fmt(Math.abs(montoAdendas), proyecto.moneda)}
                    </span>
                  </div>
                </>
              ) : null}

              <Separator />
              <div className="flex items-center justify-between font-bold">
                <span className="text-sm">Total Contrato</span>
                <span className="text-green-600">{fmt(montoContratoTotal, proyecto.moneda)}</span>
              </div>
            </CardContent>
          </Card>

          {/* 2) Desglose de Gastos (operativo: compras + caja chica) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="size-4" /> Desglose de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-purple-600" />
                    <span className="text-sm">Ordenes de Compra</span>
                    <Badge variant="secondary" className="text-xs">{fin?.totalOCs ?? 0}</Badge>
                  </div>
                  <span className="font-semibold">{fmt(fin?.gastoOCs ?? 0, proyecto.moneda)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-orange-600" />
                    <span className="text-sm">Caja Chica</span>
                    <Badge variant="secondary" className="text-xs">{fin?.totalGastosCajaChica ?? 0}</Badge>
                  </div>
                  <span className="font-semibold">{fmt(fin?.gastoCajaChica ?? 0, proyecto.moneda)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm">Total Gastos</span>
                  <span className="text-amber-600">{fmt(gastoTotal, proyecto.moneda)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3) Gastos de Asesoría (fijos: consultoría, contraprestación, venta CIPRL, IR) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="size-4" /> Gastos de Asesoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(fin?.gastosFijos ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin gastos de asesoría calculados.</p>
                ) : (
                  (fin?.gastosFijos ?? []).map((gf) => (
                    <div key={gf.concepto} className="flex items-center justify-between">
                      <span className="text-sm">
                        {gf.descripcion} <span className="text-xs text-muted-foreground">({(gf.porcentaje * 100).toFixed(1)}%)</span>
                      </span>
                      <span className="font-semibold">{fmt(gf.monto, proyecto.moneda)}</span>
                    </div>
                  ))
                )}
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm">Total Asesoría</span>
                  <span className="text-blue-600">{fmt(fin?.gastoFijos ?? 0, proyecto.moneda)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4) Utilidad = Valor Modificado − Gastos (compras + caja) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="size-4" /> Utilidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Valor Modificado (contrato total)</span>
                  <span className="font-semibold text-green-600">{fmt(montoContratoTotal, proyecto.moneda)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">(−) Gastos (compras + caja)</span>
                  <span className="font-semibold text-amber-600">{fmt(gastoTotal, proyecto.moneda)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm">Utilidad</span>
                  <span className={utilidad >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(utilidad, proyecto.moneda)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Margen sobre contrato</span>
                  <span>{margen.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de OCs reales — con paginación */}
          {ocsFinList.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Ordenes de Compra del Proyecto</span>
                  <Badge variant="secondary">{ocsFinList.length} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ocsPagina.map(oc => (
                      <TableRow key={oc.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono font-semibold text-sm">{oc.numero}</TableCell>
                        <TableCell className="text-sm">{oc.proveedorNombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{oc.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(oc.total, oc.moneda)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {oc.fecha ? new Date(oc.fecha).toLocaleDateString('es-PE') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination page={ocsPage} totalPages={ocsTotalPages} onPageChange={setOcsPage} />
              </CardContent>
            </Card>
          )}

          {/* Tabla de Gastos Caja Chica — con paginación */}
          {ccFinList.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Gastos de Caja Chica del Proyecto</span>
                  <Badge variant="secondary">{ccFinList.length} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ccPagina.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono font-semibold text-sm">{g.numero}</TableCell>
                        <TableCell className="text-sm">{g.descripcion}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{g.categoria}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(g.monto, g.moneda)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {g.fecha ? new Date(g.fecha).toLocaleDateString('es-PE') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination page={ccPage} totalPages={ccTotalPages} onPageChange={setCcPage} />
              </CardContent>
            </Card>
          )}

          {/* Nota de metodo */}
          <p className="text-xs text-muted-foreground px-1">
            Gasto Real = OCs aprobadas + Gastos Caja Chica aprobados. Las OTs no se incluyen en el calculo financiero (cada OT genera una OC).
          </p>
        </TabsContent>

        {/* ══════ Tab: Flota ══════ */}
        <TabsContent value="flota" className="space-y-4">
          {/* KPIs principales de flota */}
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
                <p className="text-xs text-muted-foreground">Preventivos realizados</p>
              </CardContent>
            </Card>
          </div>

          {/* Contadores de mantenimiento detallados */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Wrench className="size-4 text-blue-600" />
                  <p className="text-xs font-medium text-muted-foreground">Total OTs</p>
                </div>
                <p className="text-2xl font-bold">{flotaKpis.otsTotal}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle className="size-4 text-green-600" />
                  <p className="text-xs font-medium text-muted-foreground">Cerradas</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{flotaKpis.otsCerradas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Clock className="size-4 text-amber-600" />
                  <p className="text-xs font-medium text-muted-foreground">Abiertas</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{flotaKpis.otsAbiertas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Wrench className="size-4 text-purple-600" />
                  <p className="text-xs font-medium text-muted-foreground">Preventivas</p>
                </div>
                <p className="text-2xl font-bold text-purple-600">{flotaKpis.otsPreventivas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <AlertTriangle className="size-4 text-red-600" />
                  <p className="text-xs font-medium text-muted-foreground">Correctivas</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{flotaKpis.otsCorrectivas}</p>
              </CardContent>
            </Card>
          </div>

          {/* Resumen preventivos */}
          {flotaKpis.preventivosTotal > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Preventivos contratados</p>
                  <p className="text-sm font-bold">
                    {flotaKpis.preventivosRealizados} realizados / {flotaKpis.preventivosTotal} contratados
                    {' '}({flotaKpis.preventivosRestantes} pendientes)
                  </p>
                </div>
                <Progress
                  value={flotaKpis.preventivosTotal > 0 ? (flotaKpis.preventivosRealizados / flotaKpis.preventivosTotal) * 100 : 0}
                  className={`h-2.5 ${pctColor(flotaKpis.preventivosTotal > 0 ? (flotaKpis.preventivosRealizados / flotaKpis.preventivosTotal) * 100 : 0)}`}
                />
              </CardContent>
            </Card>
          )}

          {flotaKpis.costoContratado > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consumo costo mantenimiento</span>
                <span className="font-medium">{flotaKpis.pctConsumo}%</span>
              </div>
              <Progress value={flotaKpis.pctConsumo} className={`h-2 ${pctColor(flotaKpis.pctConsumo)}`} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Consumido: {fmt(flotaKpis.costoConsumido)}</span>
                <span>Restante: {fmt(flotaKpis.costoRestante)}</span>
              </div>
            </div>
          )}

          {/* Filtros por tipo de flota */}
          {vehiculosPorTipo.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={flotaTipoFilter === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFlotaTipoFilter(null)}
              >
                Todos ({vehiculosProyecto.length})
              </Button>
              {vehiculosPorTipo.map(([tipo, vehs]) => (
                <Button
                  key={tipo}
                  variant={flotaTipoFilter === tipo ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFlotaTipoFilter(tipo === flotaTipoFilter ? null : tipo)}
                >
                  {tipo} ({vehs.length})
                </Button>
              ))}
            </div>
          )}

          {vehiculosProyecto.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay vehiculos asignados a este proyecto</CardContent></Card>
          ) : flotaTipoFilter ? (
            /* Vista filtrada por tipo — lista plana con paginación */
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{flotaTipoFilter}</span>
                  <Badge variant="secondary">{vehiculosFiltrados.length} vehiculos</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {vehiculosPagina.map(v => renderVehicleRow(v))}
                <Pagination page={flotaPage} totalPages={flotaTotalPages} onPageChange={setFlotaPage} />
              </CardContent>
            </Card>
          ) : (
            /* Vista agrupada por tipo con paginación global */
            <>
              {vehiculosPorTipo.map(([tipo, vehs]) => (
                <Card key={tipo}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="size-4" />
                        <span>{tipo}</span>
                      </div>
                      <Badge variant="secondary">{vehs.length} vehiculos</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {vehs.slice(0, PAGE_SIZE_VEHICLES).map(v => renderVehicleRow(v))}
                    {vehs.length > PAGE_SIZE_VEHICLES && (
                      <div className="px-4 py-2 border-t">
                        <Button
                          variant="link" size="sm" className="text-xs"
                          onClick={() => {
                            setFlotaTipoFilter(tipo);
                            setFlotaPage(1);
                          }}
                        >
                          Ver todos los {vehs.length} vehiculos de {tipo} →
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* ══════ Tab: Biomedico ══════ */}
        {equiposProyecto.length > 0 && (
          <TabsContent value="biomedico" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Heart className="size-5 mx-auto text-rose-600 mb-1" />
                  <p className="text-2xl font-bold">{equiposProyecto.length}</p>
                  <p className="text-xs text-muted-foreground">Equipos Biomedicos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Activity className="size-5 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold">{equiposProyecto.filter(e => e.estado === 'operativo').length}</p>
                  <p className="text-xs text-muted-foreground">Operativos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Wrench className="size-5 mx-auto text-amber-600 mb-1" />
                  <p className="text-2xl font-bold">
                    {equiposProyecto.filter(e => e.estado === 'en_mantenimiento').length}
                  </p>
                  <p className="text-xs text-muted-foreground">En Mantenimiento</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <AlertTriangle className="size-5 mx-auto text-red-600 mb-1" />
                  <p className="text-2xl font-bold">
                    {equiposProyecto.filter(e => e.estado === 'fuera_servicio' || e.estado === 'dado_de_baja').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Fuera Servicio / Baja</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                {equiposProyecto.map(eq => {
                  const estadoColor: Record<string, string> = {
                    operativo: 'bg-green-100 text-green-700',
                    en_mantenimiento: 'bg-amber-100 text-amber-700',
                    fuera_servicio: 'bg-red-100 text-red-700',
                    dado_de_baja: 'bg-slate-100 text-slate-600',
                  };
                  return (
                    <div
                      key={eq.id}
                      className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30 cursor-pointer group"
                      onClick={() => onNavigate(`/biomedico/equipos/${eq.codigo}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{eq.codigo}</span>
                          <Badge className={`text-xs ${estadoColor[eq.estado] ?? ''}`}>
                            {eq.estado.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{eq.categoria}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {eq.nombre} · {eq.marca} {eq.modelo}
                        </p>
                      </div>
                      <div className="hidden md:block text-xs text-muted-foreground text-right">
                        {eq.fechaProximoMantenimiento && (
                          <p>Prox. mant: {new Date(eq.fechaProximoMantenimiento).toLocaleDateString('es-PE')}</p>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ══════ Tab: Compras ══════ */}
        <TabsContent value="compras" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="size-5 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold">{reqsProyecto.length}</p>
                <p className="text-xs text-muted-foreground">Requerimientos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="size-5 mx-auto text-purple-600 mb-1" />
                <p className="text-2xl font-bold">{cotsProyecto.length}</p>
                <p className="text-xs text-muted-foreground">Cotizaciones</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <ShoppingCart className="size-5 mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold">{ocsProyecto.length}</p>
                <p className="text-xs text-muted-foreground">Ordenes Compra</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Wrench className="size-5 mx-auto text-amber-600 mb-1" />
                <p className="text-2xl font-bold">{otsProyecto.length}</p>
                <p className="text-xs text-muted-foreground">Ordenes Trabajo</p>
              </CardContent>
            </Card>
          </div>

          {ocsProyecto.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ordenes de Compra (local)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ocsProyecto.slice(0, 15).map((oc: any) => (
                  <div key={oc.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => onNavigate(`/compras/ordenes/${oc.id}`)}>
                    <div className="flex-1">
                      <span className="font-semibold text-sm">{oc.id}</span>
                      <p className="text-xs text-muted-foreground">{oc.proveedorNombre ?? 'Proveedor'}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{oc.estado}</Badge>
                    <span className="text-sm font-medium font-mono">{fmt(oc.total ?? 0, oc.moneda)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {reqsProyecto.length === 0 && cotsProyecto.length === 0 && ocsProyecto.length === 0 && otsProyecto.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay compras asociadas a este proyecto</CardContent></Card>
          )}
        </TabsContent>

        {/* ══════ Tab: Fases ══════ */}
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

        {/* ══════ Tab: Equipo ══════ */}
        <TabsContent value="equipo" className="space-y-4">
          {proyecto.miembros.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay miembros asignados. Agregue miembros desde el detalle del proyecto.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">Horas Asignadas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proyecto.miembros.map(m => (
                      <TableRow key={m._dbId}>
                        <TableCell className="font-medium">{m.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{m.rol}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {m.horasAsignadas ? `${m.horasAsignadas}h` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // ── Helper: render a single vehicle row ──
  function renderVehicleRow(v: typeof vehiculosProyecto[number]) {
    const saldo = calcSaldoPreventivo(v.id, otsCalc, v.planPreventivoContratado);
    // OTs de este vehículo específico
    const otsVehiculo = otsProyecto.filter(ot => ot.vehiculoId === v.id);
    const otsCerradasVeh = otsVehiculo.filter(ot => ot.estado === 'cerrada').length;
    const otsAbiertasVeh = otsVehiculo.filter(ot => ot.estado !== 'cerrada' && ot.estado !== 'anulada').length;

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
        {/* OT counters per vehicle */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="text-center min-w-[50px]">
            <p className="text-muted-foreground">OTs</p>
            <p className="font-semibold">{otsCerradasVeh}<span className="text-muted-foreground">/{otsVehiculo.length}</span></p>
          </div>
          <div className="text-center min-w-[50px]">
            <p className="text-muted-foreground">Prev.</p>
            <p className="font-medium">{saldo.preventivosRealizados}/{saldo.preventivosTotal}</p>
          </div>
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
  }
}
