/**
 * ProyectosTareasGlobal — Vista global de todas las tareas de todos los proyectos
 */

import { useState, useMemo } from 'react';
import { Search, AlertTriangle, ListChecks } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useProyectos, type Tarea } from '../../../lib/proyectos/proyectos-store';

// ── Config ───────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<Tarea['estado'], { label: string; color: string }> = {
  pendiente:   { label: 'Pendiente',   color: 'bg-slate-100 text-slate-700' },
  en_progreso: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  completada:  { label: 'Completada',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  bloqueada:   { label: 'Bloqueada',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelada:   { label: 'Cancelada',   color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400' },
};

const PRIORIDAD_CONFIG: Record<Tarea['prioridad'], { label: string; color: string }> = {
  baja:    { label: 'Baja',    color: 'bg-slate-100 text-slate-600' },
  media:   { label: 'Media',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

// ── Tarea enriquecida ─────────────────────────────────────────────────────────

interface TareaConProyecto extends Tarea {
  proyectoNombre: string;
  proyectoCodigo: string;
  faseNombre?: string;
  vencida: boolean;
}

interface Props {
  onNavigate?: (route: string) => void;
}

export function ProyectosTareasGlobal({ onNavigate }: Props) {
  const { proyectos, loading } = useProyectos();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todos');
  const [filtroAsignado, setFiltroAsignado] = useState('');

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const tareasEnriquecidas = useMemo((): TareaConProyecto[] => {
    const result: TareaConProyecto[] = [];
    for (const p of proyectos) {
      for (const t of p.tareas) {
        const fase = p.fases.find(f => f._dbId === t.faseDbId);
        const vencida = !!t.fechaVencimiento
          && new Date(t.fechaVencimiento) < hoy
          && t.estado !== 'completada'
          && t.estado !== 'cancelada';
        result.push({
          ...t,
          proyectoNombre: p.nombre,
          proyectoCodigo: p.id,
          faseNombre: fase?.nombre,
          vencida,
        });
      }
    }
    return result.sort((a, b) => {
      // Vencidas primero, luego por fecha vencimiento
      if (a.vencida && !b.vencida) return -1;
      if (!a.vencida && b.vencida) return 1;
      if (a.fechaVencimiento && b.fechaVencimiento) {
        return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
      }
      return 0;
    });
  }, [proyectos]);

  // Lista única de asignados para el filtro
  const asignados = useMemo(() => {
    const set = new Set<string>();
    tareasEnriquecidas.forEach(t => { if (t.asignadoA) set.add(t.asignadoA); });
    return Array.from(set).sort();
  }, [tareasEnriquecidas]);

  const filtradas = useMemo(() => {
    return tareasEnriquecidas.filter(t => {
      const matchBusqueda = !busqueda ||
        t.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.proyectoNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (t.asignadoA ?? '').toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || t.estado === filtroEstado;
      const matchPrioridad = filtroPrioridad === 'todos' || t.prioridad === filtroPrioridad;
      const matchAsignado = !filtroAsignado || t.asignadoA === filtroAsignado;
      return matchBusqueda && matchEstado && matchPrioridad && matchAsignado;
    });
  }, [tareasEnriquecidas, busqueda, filtroEstado, filtroPrioridad, filtroAsignado]);

  const tareasVencidas = filtradas.filter(t => t.vencida).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Cargando tareas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tareas</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {filtradas.length} tarea(s) de todos los proyectos
            {tareasVencidas > 0 && (
              <span className="ml-2 text-red-500 flex items-center gap-1 inline-flex">
                <AlertTriangle className="size-3.5" /> {tareasVencidas} vencida(s)
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => onNavigate?.('/proyectos/lista')}>
          Ver Proyectos
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarea, proyecto, asignado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {Object.entries(PRIORIDAD_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {asignados.length > 0 && (
          <Select value={filtroAsignado || '_todos'} onValueChange={v => setFiltroAsignado(v === '_todos' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Asignado a" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todos</SelectItem>
              {asignados.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabla */}
      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ListChecks className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No se encontraron tareas</p>
          <p className="text-sm mt-1">Ajusta los filtros o crea tareas en los proyectos</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map(t => {
                  const estadoCfg = ESTADO_CONFIG[t.estado];
                  const priorCfg = PRIORIDAD_CONFIG[t.prioridad];
                  return (
                    <TableRow key={t._dbId} className={t.vencida ? 'bg-red-50/40 dark:bg-red-950/10' : ''}>
                      <TableCell>
                        <button
                          className="text-left hover:underline"
                          onClick={() => onNavigate?.(`/proyectos/tareas/${t._dbId}`)}
                        >
                          <p className="font-medium text-sm text-primary">{t.titulo}</p>
                          {t.descripcion && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.descripcion}</p>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{t.proyectoNombre}</p>
                          <p className="text-xs font-mono text-muted-foreground">{t.proyectoCodigo}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.faseNombre ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={`${estadoCfg.color} border-0 text-xs`}>{estadoCfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorCfg.color} border-0 text-xs`}>{priorCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.asignadoA ?? '—'}</TableCell>
                      <TableCell>
                        {t.fechaVencimiento ? (
                          <span className={`text-sm flex items-center gap-1 ${t.vencida ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            {t.vencida && <AlertTriangle className="size-3.5 shrink-0" />}
                            {t.fechaVencimiento}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
