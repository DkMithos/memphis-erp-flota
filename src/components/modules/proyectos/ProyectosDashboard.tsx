/**
 * Proyectos Dashboard — KPIs, tabla resumen, alertas
 */

import { useMemo } from 'react';
import {
  FolderKanban, Clock, CheckCircle2, DollarSign, AlertTriangle,
  TrendingUp, ListChecks, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import type { Proyecto } from '../../../lib/proyectos/proyectos-store';

// ── Config ───────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<Proyecto['estado'], { label: string; color: string }> = {
  planificacion: { label: 'Planificación', color: 'bg-slate-100 text-slate-700' },
  en_ejecucion:  { label: 'En Ejecución',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pausado:       { label: 'Pausado',        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completado:    { label: 'Completado',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelado:     { label: 'Cancelado',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const PRIORIDAD_CONFIG: Record<Proyecto['prioridad'], { label: string; color: string }> = {
  baja:    { label: 'Baja',    color: 'bg-slate-100 text-slate-600' },
  media:   { label: 'Media',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

interface Props {
  onNavigate?: (route: string) => void;
}

export function ProyectosDashboard({ onNavigate }: Props) {
  const { proyectos, loading } = useProyectos();

  const hoy = new Date();

  const stats = useMemo(() => {
    const activos = proyectos.filter(p => p.estado === 'en_ejecucion' || p.estado === 'planificacion');
    const completadosAnio = proyectos.filter(p => {
      if (p.estado !== 'completado') return false;
      if (!p.fechaFinReal) return false;
      return new Date(p.fechaFinReal).getFullYear() === hoy.getFullYear();
    });
    const presupuestoTotal = activos.reduce((s, p) => s + (p.presupuesto ?? 0), 0);
    const tareasVencidas = proyectos.reduce((count, p) => {
      return count + p.tareas.filter(t => {
        if (t.estado === 'completada' || t.estado === 'cancelada') return false;
        if (!t.fechaVencimiento) return false;
        return new Date(t.fechaVencimiento) < hoy;
      }).length;
    }, 0);
    const retrasados = proyectos.filter(p => p.estaRetrasado);

    return { activos, completadosAnio, presupuestoTotal, tareasVencidas, retrasados };
  }, [proyectos]);

  if (loading) {
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
          <h2 className="text-2xl font-semibold">Proyectos</h2>
          <p className="text-muted-foreground mt-1 text-sm">Panel de control y seguimiento de proyectos</p>
        </div>
        <Button onClick={() => onNavigate?.('/proyectos/lista')}>
          <FolderKanban className="size-4" />
          Ver todos los proyectos
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proyectos Activos</CardTitle>
            <Clock className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.activos.length}</div>
            <p className="text-xs text-muted-foreground mt-1">En ejecución o planificación</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Completados este año</CardTitle>
            <CheckCircle2 className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.completadosAnio.length}</div>
            <p className="text-xs text-green-600 mt-1">Proyectos finalizados {hoy.getFullYear()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Presupuesto activos</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              S/ {stats.presupuestoTotal.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Suma de presupuestos activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tareas vencidas</CardTitle>
            <AlertTriangle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${stats.tareasVencidas > 0 ? 'text-red-600' : ''}`}>
              {stats.tareasVencidas}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendientes fuera de fecha</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas: proyectos retrasados */}
      {stats.retrasados.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-red-500" />
              <span className="font-medium text-red-700 dark:text-red-400 text-sm">
                {stats.retrasados.length} proyecto(s) con retraso
              </span>
            </div>
            <div className="space-y-2">
              {stats.retrasados.map(p => (
                <div key={p._dbId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.id}</span>
                    <span className="text-muted-foreground">{p.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-red-400" />
                    <span className="text-red-600 text-xs">
                      {p.diasRestantes !== undefined ? `${Math.abs(p.diasRestantes)} días de retraso` : ''}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => onNavigate?.(`/proyectos/detalle/${p._dbId}`)}
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de proyectos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Todos los Proyectos</CardTitle>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('/proyectos/lista')}>
            Gestionar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {proyectos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <FolderKanban className="size-10 mx-auto mb-3 opacity-30" />
              <p>No hay proyectos registrados</p>
              <Button className="mt-4" onClick={() => onNavigate?.('/proyectos/lista')}>
                Crear primer proyecto
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Fin Estimado</TableHead>
                  <TableHead>Gerente</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyectos.map(p => {
                  const estadoCfg = ESTADO_CONFIG[p.estado];
                  const priorCfg = PRIORIDAD_CONFIG[p.prioridad];
                  return (
                    <TableRow key={p._dbId} className={p.estaRetrasado ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                      <TableCell className="font-mono text-xs font-medium">{p.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{p.nombre}</p>
                          {p.estaRetrasado && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Retrasado
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${estadoCfg.color} border-0 hover:${estadoCfg.color}`}>
                          {estadoCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorCfg.color} border-0 hover:${priorCfg.color}`}>
                          {priorCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={p.porcentajeAvance} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {p.porcentajeAvance}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.presupuesto
                          ? `S/ ${p.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.fechaFinEstimada ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.gerenteProyecto ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onNavigate?.(`/proyectos/detalle/${p._dbId}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
