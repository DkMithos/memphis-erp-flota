/**
 * BIDashboard — Centro de Control BI & Reportería Global
 * Módulo F11
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw,
  Loader2,
  TrendingUp,
  Truck,
  ShoppingCart,
  Package,
  DollarSign,
  FolderKanban,
  Users,
  Target,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Download,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Badge } from '../../ui/badge';
import { cn } from '../../ui/utils';
import { useBI } from '../../../lib/bi/bi-store';

// ============================================================================
// TIPOS
// ============================================================================

interface BIDashboardProps {
  onNavigate?: (route: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatMoney(value: number): string {
  return `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-PE');
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

interface KPICardProps {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
}

function KPICard({ label, value, subLabel, icon, bgColor }: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn('size-10 rounded-lg flex items-center justify-center shrink-0 text-white [&_svg]:text-white [&_svg]:size-5', bgColor)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {subLabel && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{subLabel}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ModuloCardProps {
  titulo: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  kpis: { label: string; value: string }[];
  ruta: string;
  onNavigate?: (route: string) => void;
}

function ModuloCard({ titulo, icon, kpis, ruta, onNavigate }: ModuloCardProps) {
  return (
    <Card className="!border-2 overflow-hidden bg-card border-[#f0c000] dark:bg-black dark:border-[#f0c000]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-black dark:text-foreground flex items-center gap-2 [&_svg]:text-black dark:[&_svg]:text-[#f0c000]">
          {icon}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 pb-3">
        <div className="space-y-1 mb-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex justify-between text-base">
              <span className="text-gray-600 dark:text-muted-foreground">{kpi.label}</span>
              <span className="font-semibold">{kpi.value}</span>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-sm !border-slate-400 dark:!border-input hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input"
          onClick={() => onNavigate?.(ruta)}
        >
          Ver módulo
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function BIDashboard({ onNavigate }: BIDashboardProps) {
  const { metricas, tendencias, loading, lastUpdate, recargar } = useBI();

  // ── Exportar CSV ──────────────────────────────────────────────────────────
  const exportarMetricas = () => {
    if (!metricas) return;
    const rows = Object.entries(metricas).map(([k, v]) => `${k},${v}`);
    const csv = ['metrica,valor', ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bi_metricas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ── Alertas ───────────────────────────────────────────────────────────────
  interface Alerta {
    nivel: 'rojo' | 'amarillo' | 'verde';
    mensaje: string;
  }

  const alertas: Alerta[] = [];

  if ((metricas?.articulosBajoMinimo ?? 0) > 0) {
    alertas.push({
      nivel: 'rojo',
      mensaje: `${metricas!.articulosBajoMinimo} artículo${metricas!.articulosBajoMinimo !== 1 ? 's' : ''} con stock crítico`,
    });
  }
  if ((metricas?.tareasVencidas ?? 0) > 0) {
    alertas.push({
      nivel: 'rojo',
      mensaje: `${metricas!.tareasVencidas} tarea${metricas!.tareasVencidas !== 1 ? 's' : ''} vencida${metricas!.tareasVencidas !== 1 ? 's' : ''}`,
    });
  }
  if ((metricas?.contratosVencimientoProximo ?? 0) > 0) {
    alertas.push({
      nivel: 'amarillo',
      mensaje: `${metricas!.contratosVencimientoProximo} contrato${metricas!.contratosVencimientoProximo !== 1 ? 's' : ''} vence${metricas!.contratosVencimientoProximo === 1 ? '' : 'n'} en menos de 30 días`,
    });
  }
  if ((metricas?.otAbiertas ?? 0) > 5) {
    alertas.push({
      nivel: 'amarillo',
      mensaje: `${metricas!.otAbiertas} OTs abiertas en Flota`,
    });
  }
  if ((metricas?.oportunidadesAbiertas ?? 0) > 0) {
    alertas.push({
      nivel: 'verde',
      mensaje: `Pipeline CRM: ${formatMoney(metricas?.valorPipelineCRM ?? 0)} en negociación (${metricas?.oportunidadesAbiertas} oportunidades)`,
    });
  }

  // ── Tooltip personalizado para recharts ──────────────────────────────────
  interface TooltipPayloadItem {
    color: string;
    name: string;
    value: number;
  }

  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatMoney(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageNav />

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centro de Control — BI &amp; Reportería</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vista consolidada de todos los módulos del ERP
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Actualizado: {lastUpdate}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportarMetricas}
            disabled={!metricas}
            className="gap-1.5 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={recargar}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Actualizar
          </Button>
        </div>
      </div>

      {/* SECCIÓN 1: KPIs EJECUTIVOS */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          KPIs Ejecutivos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Balance del Mes"
            value={formatMoney(metricas?.balanceMes ?? 0)}
            subLabel={`Ing: ${formatMoney(metricas?.ingresosMes ?? 0)} · Egr: ${formatMoney(metricas?.egresosMes ?? 0)}`}
            icon={<DollarSign className="size-4 text-emerald-600" />}
            accentColor="border-l-emerald-500"
            bgColor="bg-emerald-600"
          />
          <KPICard
            label="Pipeline CRM"
            value={formatMoney(metricas?.valorPipelineCRM ?? 0)}
            subLabel={`${metricas?.oportunidadesAbiertas ?? 0} oportunidades abiertas`}
            icon={<Target className="size-4 text-blue-600" />}
            accentColor="border-l-blue-500"
            bgColor="bg-blue-500"
          />
          <KPICard
            label="OTs Abiertas"
            value={formatNumber(metricas?.otAbiertas ?? 0)}
            subLabel="Flota — en proceso"
            icon={<Wrench className="size-4 text-orange-600" />}
            accentColor="border-l-orange-500"
            bgColor="bg-orange-500"
          />
          <KPICard
            label="Stock Crítico"
            value={formatNumber(metricas?.articulosBajoMinimo ?? 0)}
            subLabel={`Inv. total: ${formatMoney(metricas?.valorTotalInventario ?? 0)}`}
            icon={<Package className="size-4 text-red-600" />}
            accentColor="border-l-red-500"
            bgColor="bg-red-500"
          />
          <KPICard
            label="Proyectos en Ejecución"
            value={formatNumber(metricas?.proyectosEnEjecucion ?? 0)}
            subLabel="Estado: en_ejecucion"
            icon={<FolderKanban className="size-4 text-violet-600" />}
            accentColor="border-l-violet-500"
            bgColor="bg-violet-500"
          />
          <KPICard
            label="Contratos por Vencer"
            value={formatNumber(metricas?.contratosVencimientoProximo ?? 0)}
            subLabel="Próximos 30 días"
            icon={<FileText className="size-4 text-yellow-600" />}
            accentColor="border-l-yellow-500"
            bgColor="bg-amber-500"
          />
          <KPICard
            label="Proveedores Activos"
            value={formatNumber(metricas?.proveedoresActivos ?? 0)}
            subLabel={`OC activas: ${metricas?.ordenesCompraActivas ?? 0}`}
            icon={<Users className="size-4 text-cyan-600" />}
            accentColor="border-l-cyan-500"
            bgColor="bg-cyan-500"
          />
          <KPICard
            label="Tareas Vencidas"
            value={formatNumber(metricas?.tareasVencidas ?? 0)}
            subLabel="Proyectos — sin completar"
            icon={<Clock className="size-4 text-rose-600" />}
            accentColor="border-l-rose-500"
            bgColor="bg-rose-500"
          />
        </div>
      </div>

      {/* SECCIÓN 2: TENDENCIA FINANCIERA */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Tendencia Financiera — Últimos 6 meses
        </h2>
        <Card>
          <CardContent className="pt-4 pb-2">
            {tendencias.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tendencias} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `S/ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="egresos"
                    name="Egresos"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Cargando datos financieros...
                  </span>
                ) : (
                  'Sin datos de transacciones disponibles'
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN 3: RESUMEN POR MÓDULO */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Resumen por Módulo
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ModuloCard
            titulo="Flota"
            color="border-[#f0c000]"
            bgColor="bg-black"
            icon={<Truck className="size-4 text-[#f0c000]" />}
            kpis={[
              { label: 'Vehículos activos', value: formatNumber(metricas?.vehiculosActivos ?? 0) },
              { label: 'OTs abiertas', value: formatNumber(metricas?.otAbiertas ?? 0) },
            ]}
            ruta="/flota"
            onNavigate={onNavigate}
          />
          <ModuloCard
            titulo="Compras"
            color="border-[#f0c000]"
            bgColor="bg-black"
            icon={<ShoppingCart className="size-4 text-[#f0c000]" />}
            kpis={[
              { label: 'OC activas', value: formatNumber(metricas?.ordenesCompraActivas ?? 0) },
              { label: 'Proveedores', value: formatNumber(metricas?.proveedoresActivos ?? 0) },
            ]}
            ruta="/compras"
            onNavigate={onNavigate}
          />
          <ModuloCard
            titulo="Inventario"
            color="border-[#f0c000]"
            bgColor="bg-black"
            icon={<Package className="size-4 text-[#f0c000]" />}
            kpis={[
              { label: 'Stock crítico', value: formatNumber(metricas?.articulosBajoMinimo ?? 0) },
              { label: 'Valor total', value: formatMoney(metricas?.valorTotalInventario ?? 0) },
            ]}
            ruta="/inventario"
            onNavigate={onNavigate}
          />
          <ModuloCard
            titulo="CRM"
            color="border-[#f0c000]"
            bgColor="bg-black"
            icon={<Target className="size-4 text-[#f0c000]" />}
            kpis={[
              { label: 'Clientes activos', value: formatNumber(metricas?.clientesActivos ?? 0) },
              { label: 'Pipeline', value: formatMoney(metricas?.valorPipelineCRM ?? 0) },
            ]}
            ruta="/crm"
            onNavigate={onNavigate}
          />
          <ModuloCard
            titulo="Proyectos"
            color="border-[#f0c000]"
            bgColor="bg-black"
            icon={<FolderKanban className="size-4 text-[#f0c000]" />}
            kpis={[
              { label: 'En ejecución', value: formatNumber(metricas?.proyectosEnEjecucion ?? 0) },
              { label: 'Tareas vencidas', value: formatNumber(metricas?.tareasVencidas ?? 0) },
            ]}
            ruta="/proyectos"
            onNavigate={onNavigate}
          />
          <ModuloCard
            titulo="Finanzas"
            color="border-[#f0c000]"
            bgColor="bg-black"
            icon={<DollarSign className="size-4 text-[#f0c000]" />}
            kpis={[
              { label: 'Ingresos mes', value: formatMoney(metricas?.ingresosMes ?? 0) },
              { label: 'Balance mes', value: formatMoney(metricas?.balanceMes ?? 0) },
            ]}
            ruta="/finanzas"
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* SECCIÓN 4: ALERTAS CONSOLIDADAS */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Alertas Consolidadas
        </h2>
        <Card>
          <CardContent className="pt-4 pb-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="size-4 animate-spin" />
                Analizando alertas...
              </div>
            ) : alertas.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-2">
                <CheckCircle className="size-4" />
                Sin alertas activas. Todos los módulos operan con normalidad.
              </div>
            ) : (
              <ul className="space-y-2">
                {alertas.map((alerta, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    {alerta.nivel === 'rojo' && (
                      <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    {alerta.nivel === 'amarillo' && (
                      <AlertTriangle className="size-4 text-yellow-500 mt-0.5 shrink-0" />
                    )}
                    {alerta.nivel === 'verde' && (
                      <TrendingUp className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    )}
                    <span
                      className={cn('text-sm', {
                        'text-red-700 dark:text-red-400': alerta.nivel === 'rojo',
                        'text-yellow-700 dark:text-yellow-400': alerta.nivel === 'amarillo',
                        'text-emerald-700 dark:text-emerald-400': alerta.nivel === 'verde',
                      })}
                    >
                      {alerta.mensaje}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('ml-auto shrink-0 text-xs', {
                        'border-red-300 text-red-600': alerta.nivel === 'rojo',
                        'border-yellow-300 text-yellow-600': alerta.nivel === 'amarillo',
                        'border-emerald-300 text-emerald-600': alerta.nivel === 'verde',
                      })}
                    >
                      {alerta.nivel === 'rojo' ? 'Crítico' : alerta.nivel === 'amarillo' ? 'Atención' : 'Info'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
