/**
 * Memphis ERP — BiomedicoDashboard
 * Dashboard principal del módulo Biomédico con datos reales.
 * KPIs: equipos por estado, mantenimientos pendientes, calibraciones, incidencias abiertas.
 * Alertas: vencimientos críticos, contratos por vencer.
 * Próximas actividades: mantenimientos y calibraciones programados.
 */
import { useMemo } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, Calendar, CheckCircle2,
  Clock, FileText, Stethoscope, Wrench, XCircle, Plus,
  ArrowRight, Zap, Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { useMantenimientosStore } from '../../../lib/biomedico/mantenimientos-store';
import { useCalibracionesStore } from '../../../lib/biomedico/calibraciones-store';
import { useIncidenciasStore } from '../../../lib/biomedico/incidencias-store';
import { useContratosBioStore } from '../../../lib/biomedico/contratos-bio-store';

interface BiomedicoDashboardProps {
  onNavigate?: (route: string) => void;
}

function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.ceil((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BiomedicoDashboard({ onNavigate }: BiomedicoDashboardProps) {
  const { equipos } = useEquiposStore();
  const { mantenimientos } = useMantenimientosStore();
  const { calibraciones } = useCalibracionesStore();
  const { incidencias } = useIncidenciasStore();
  const { contratos } = useContratosBioStore();

  // ── KPIs de equipos ────────────────────────────────────────────────────────
  const kpiEquipos = useMemo(() => {
    const operativos     = equipos.filter(e => e.estado === 'operativo').length;
    const mantenimiento  = equipos.filter(e => e.estado === 'mantenimiento').length;
    const fueraServicio  = equipos.filter(e => e.estado === 'fuera_servicio').length;
    const calibracion    = equipos.filter(e => e.estado === 'calibracion').length;
    return { total: equipos.length, operativos, mantenimiento, fueraServicio, calibracion };
  }, [equipos]);

  // ── KPIs de mantenimientos ─────────────────────────────────────────────────
  const kpiMant = useMemo(() => {
    const programados   = mantenimientos.filter(m => m.estado === 'programado').length;
    const enEjecucion   = mantenimientos.filter(m => m.estado === 'en_ejecucion').length;
    const completados   = mantenimientos.filter(m => m.estado === 'completado').length;
    // Vencidos: programados con fecha pasada
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const vencidos = mantenimientos.filter(m =>
      m.estado === 'programado' && new Date(m.fechaProgramada) < hoy
    ).length;
    return { programados, enEjecucion, completados, vencidos };
  }, [mantenimientos]);

  // ── KPIs de calibraciones ──────────────────────────────────────────────────
  const kpiCal = useMemo(() => {
    const programadas  = calibraciones.filter(c => c.estado === 'programada').length;
    const vencidas     = calibraciones.filter(c => c.estado === 'vencida').length;
    const proximas30   = calibraciones.filter(c => {
      if (c.estado !== 'programada') return false;
      return diasHasta(c.fechaProgramada) <= 30;
    }).length;
    return { programadas, vencidas, proximas30 };
  }, [calibraciones]);

  // ── KPIs de incidencias ────────────────────────────────────────────────────
  const kpiInc = useMemo(() => {
    const abiertas    = incidencias.filter(i => i.estado === 'abierta').length;
    const criticas    = incidencias.filter(i => i.estado === 'abierta' && i.severidad === 'critica').length;
    const enInvest    = incidencias.filter(i => i.estado === 'en_investigacion').length;
    return { abiertas, criticas, enInvest };
  }, [incidencias]);

  // ── Alertas críticas ───────────────────────────────────────────────────────
  const alertas = useMemo(() => {
    const list: Array<{
      tipo: 'danger' | 'warning' | 'info';
      texto: string;
      route: string;
    }> = [];

    if (kpiEquipos.fueraServicio > 0)
      list.push({ tipo: 'danger', texto: `${kpiEquipos.fueraServicio} equipo(s) fuera de servicio`, route: '/biomedico/equipos' });

    if (kpiInc.criticas > 0)
      list.push({ tipo: 'danger', texto: `${kpiInc.criticas} incidencia(s) crítica(s) abiertas`, route: '/biomedico/incidencias' });

    if (kpiMant.vencidos > 0)
      list.push({ tipo: 'warning', texto: `${kpiMant.vencidos} mantenimiento(s) con fecha vencida`, route: '/biomedico/mantenimientos' });

    if (kpiCal.vencidas > 0)
      list.push({ tipo: 'warning', texto: `${kpiCal.vencidas} calibración(es) vencida(s)`, route: '/biomedico/calibraciones' });

    const contratosPorVencer = contratos.filter(
      c => c.vigente && c.diasParaVencer !== null && c.diasParaVencer <= 30
    );
    if (contratosPorVencer.length > 0)
      list.push({ tipo: 'warning', texto: `${contratosPorVencer.length} contrato(s) vence(n) en 30 días`, route: '/biomedico/contratos' });

    if (kpiCal.proximas30 > 0)
      list.push({ tipo: 'info', texto: `${kpiCal.proximas30} calibración(es) programada(s) en 30 días`, route: '/biomedico/calibraciones' });

    return list;
  }, [kpiEquipos, kpiInc, kpiMant, kpiCal, contratos]);

  // ── Próximas actividades ───────────────────────────────────────────────────
  const proximasActividades = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    const mantProg = mantenimientos
      .filter(m => m.estado === 'programado' && new Date(m.fechaProgramada) >= hoy)
      .sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime())
      .slice(0, 3)
      .map(m => ({
        tipo: 'mantenimiento' as const,
        titulo: m.titulo,
        equipo: m.equipoNombre,
        fecha: m.fechaProgramada,
        dias: diasHasta(m.fechaProgramada),
        ruta: '/biomedico/mantenimientos',
      }));

    const calProg = calibraciones
      .filter(c => c.estado === 'programada' && new Date(c.fechaProgramada) >= hoy)
      .sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime())
      .slice(0, 3)
      .map(c => ({
        tipo: 'calibracion' as const,
        titulo: `Calibración ${c.tipo}`,
        equipo: c.equipoNombre,
        fecha: c.fechaProgramada,
        dias: diasHasta(c.fechaProgramada),
        ruta: '/biomedico/calibraciones',
      }));

    return [...mantProg, ...calProg]
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 6);
  }, [mantenimientos, calibraciones]);

  // ── Contratos activos ──────────────────────────────────────────────────────
  const contratosActivos = useMemo(
    () => contratos.filter(c => c.estado === 'activo').slice(0, 4),
    [contratos],
  );

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="size-6 text-primary" />
            Biomédico — Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión integral de equipos médicos, mantenimientos y contratos de servicio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('/biomedico/equipos')}>
            Ver equipos
          </Button>
          <Button size="sm" className="gap-2" onClick={() => onNavigate?.('/biomedico/mantenimientos/nuevo')}>
            <Plus className="size-4" /> Nuevo mantenimiento
          </Button>
        </div>
      </div>

      {/* ── KPIs principales ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total equipos',
            value: kpiEquipos.total,
            sub: `${kpiEquipos.operativos} operativos`,
            icon: Stethoscope,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            route: '/biomedico/equipos',
          },
          {
            label: 'Mantenimientos',
            value: kpiMant.programados + kpiMant.enEjecucion,
            sub: `${kpiMant.enEjecucion} en ejecución`,
            icon: Wrench,
            color: kpiMant.vencidos > 0 ? 'text-amber-500' : 'text-green-500',
            bg: kpiMant.vencidos > 0 ? 'bg-amber-500/10' : 'bg-green-500/10',
            route: '/biomedico/mantenimientos',
          },
          {
            label: 'Calibraciones',
            value: kpiCal.programadas,
            sub: kpiCal.vencidas > 0 ? `⚠ ${kpiCal.vencidas} vencida(s)` : 'al día',
            icon: Clock,
            color: kpiCal.vencidas > 0 ? 'text-red-500' : 'text-purple-500',
            bg: kpiCal.vencidas > 0 ? 'bg-red-500/10' : 'bg-purple-500/10',
            route: '/biomedico/calibraciones',
          },
          {
            label: 'Incidencias abiertas',
            value: kpiInc.abiertas,
            sub: kpiInc.criticas > 0 ? `🔴 ${kpiInc.criticas} crítica(s)` : 'sin críticas',
            icon: AlertCircle,
            color: kpiInc.criticas > 0 ? 'text-red-500' : kpiInc.abiertas > 0 ? 'text-amber-500' : 'text-muted-foreground',
            bg: kpiInc.criticas > 0 ? 'bg-red-500/10' : kpiInc.abiertas > 0 ? 'bg-amber-500/10' : 'bg-muted/50',
            route: '/biomedico/incidencias',
          },
        ].map(k => (
          <Card
            key={k.label}
            className="cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all border-border/60"
            onClick={() => onNavigate?.(k.route)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className="text-2xl font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                </div>
                <div className={`size-9 rounded-xl flex items-center justify-center ${k.bg}`}>
                  <k.icon className={`size-5 ${k.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Alertas críticas ────────────────────────────────────────────── */}
      {alertas.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Alertas que requieren atención
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                {alertas.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a, i) => (
              <button
                key={i}
                onClick={() => onNavigate?.(a.route)}
                className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                {a.tipo === 'danger' && <XCircle className="size-4 text-red-500 shrink-0" />}
                {a.tipo === 'warning' && <AlertTriangle className="size-4 text-amber-500 shrink-0" />}
                {a.tipo === 'info' && <Activity className="size-4 text-blue-500 shrink-0" />}
                <span className="flex-1">{a.texto}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Dos columnas: Próximas actividades + Contratos activos ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Próximas actividades */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Próximas Actividades
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-auto py-1"
                onClick={() => onNavigate?.('/biomedico/mantenimientos')}>
                Ver todo <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {proximasActividades.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin actividades programadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proximasActividades.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => onNavigate?.(a.ruta)}
                    className="w-full flex items-center gap-3 text-sm px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                  >
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                      a.tipo === 'mantenimiento' ? 'bg-green-500/10' : 'bg-purple-500/10'
                    }`}>
                      {a.tipo === 'mantenimiento'
                        ? <Wrench className="size-4 text-green-500" />
                        : <Clock className="size-4 text-purple-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.equipo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">{formatFecha(a.fecha)}</p>
                      <p className={`text-xs ${
                        a.dias <= 3 ? 'text-red-500 font-medium'
                        : a.dias <= 7 ? 'text-amber-500'
                        : 'text-muted-foreground'
                      }`}>
                        {a.dias === 0 ? 'Hoy' : a.dias === 1 ? 'Mañana' : `en ${a.dias}d`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contratos de servicio */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                Contratos de Servicio
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-auto py-1"
                onClick={() => onNavigate?.('/biomedico/contratos')}>
                Ver todo <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contratosActivos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin contratos activos</p>
                <Button variant="outline" size="sm" className="mt-2 gap-2 text-xs"
                  onClick={() => onNavigate?.('/biomedico/contratos/nuevo')}>
                  <Plus className="size-3" /> Registrar contrato
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {contratosActivos.map(c => (
                  <button
                    key={c._dbId}
                    onClick={() => onNavigate?.('/biomedico/contratos')}
                    className="w-full flex items-center gap-3 text-sm px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="size-8 rounded-lg flex items-center justify-center bg-blue-500/10 shrink-0">
                      {(c.tipo === 'sla' || c.tipo === 'integral')
                        ? <Zap className="size-4 text-blue-500" />
                        : <Shield className="size-4 text-blue-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.equipoNombre || c.equipoId}</p>
                      <p className="text-xs text-muted-foreground">{c.proveedorNombre || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-xs mb-0.5">
                        {c.tipo === 'garantia' ? 'Garantía'
                         : c.tipo === 'sla' ? 'SLA'
                         : c.tipo === 'oem' ? 'OEM'
                         : c.tipo === 'integral' ? 'Integral'
                         : 'MP'}
                      </Badge>
                      {c.diasParaVencer !== null && c.diasParaVencer <= 30 && (
                        <p className="text-xs text-amber-500 font-medium">
                          {c.diasParaVencer}d restantes
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Estado de equipos por categoría ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Estado de la Flota Biomédica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Operativos', value: kpiEquipos.operativos, color: 'bg-green-500', textColor: 'text-green-700 dark:text-green-400' },
              { label: 'En mantenimiento', value: kpiEquipos.mantenimiento, color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400' },
              { label: 'Fuera de servicio', value: kpiEquipos.fueraServicio, color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400' },
              { label: 'En calibración', value: kpiEquipos.calibracion, color: 'bg-purple-500', textColor: 'text-purple-700 dark:text-purple-400' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className={`text-2xl font-bold ${s.textColor}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.color}`}
                    style={{ width: kpiEquipos.total > 0 ? `${(s.value / kpiEquipos.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Acciones rápidas ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Nuevo Equipo',        icon: Stethoscope, route: '/biomedico/equipos/nuevo',             color: 'text-blue-500',   bg: 'bg-blue-500/10' },
          { label: 'Nuevo Mantenimiento', icon: Wrench,      route: '/biomedico/mantenimientos/nuevo',      color: 'text-green-500',  bg: 'bg-green-500/10' },
          { label: 'Nueva Calibración',   icon: Clock,       route: '/biomedico/calibraciones',             color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Nuevo Contrato',      icon: FileText,    route: '/biomedico/contratos/nuevo',           color: 'text-cyan-500',   bg: 'bg-cyan-500/10' },
        ].map(a => (
          <button
            key={a.label}
            onClick={() => onNavigate?.(a.route)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/30 transition-all group"
          >
            <div className={`size-10 rounded-xl flex items-center justify-center ${a.bg}`}>
              <a.icon className={`size-5 ${a.color}`} />
            </div>
            <span className="text-xs font-medium text-center group-hover:text-primary transition-colors">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
