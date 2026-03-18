/**
 * PROYECTOS — Cronograma (Gantt simplificado)
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from 'sonner';

interface CronogramaProps { onNavigate?: (route: string) => void; }

interface TareaGantt {
  id: string;
  titulo: string;
  proyecto: string;
  proyectoId: string;
  estado: string;
  prioridad: string;
  fechaInicio?: string;
  fechaVencimiento?: string;
  asignado?: string;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendiente: { label: 'Pendiente', color: 'bg-gray-400', icon: Circle },
  en_progreso: { label: 'En progreso', color: 'bg-blue-500', icon: Clock },
  completada: { label: 'Completada', color: 'bg-green-500', icon: CheckCircle2 },
  vencida: { label: 'Vencida', color: 'bg-red-500', icon: AlertCircle },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function ProyectosCronograma({ onNavigate }: CronogramaProps) {
  const { tenantId } = useAuth();
  const [tareas, setTareas] = useState<TareaGantt[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [filtroProyecto, setFiltroProyecto] = useState('todos');
  const [proyectos, setProyectos] = useState<Array<{ id: string; nombre: string }>>([]);

  useEffect(() => {
    if (!tenantId) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const [resTareas, resProyectos] = await Promise.all([
          supabase.from('tareas_proyecto')
            .select('id, titulo, estado, prioridad, fecha_inicio, fecha_vencimiento, asignado_a, proyecto_id, proyectos(nombre)')
            .not('fecha_vencimiento', 'is', null)
            .order('fecha_inicio', { ascending: true }),
          supabase.from('proyectos')
            .select('id, nombre')
            .order('nombre'),
        ]);

        if (resProyectos.data) setProyectos(resProyectos.data as any);
        if (resTareas.data) {
          const hoy = new Date().toISOString().split('T')[0];
          setTareas((resTareas.data as any[]).map(t => ({
            id: t.id,
            titulo: t.titulo,
            proyecto: (t.proyectos as any)?.nombre ?? 'Sin proyecto',
            proyectoId: t.proyecto_id,
            estado: t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < hoy ? 'vencida' : t.estado,
            prioridad: t.prioridad,
            fechaInicio: t.fecha_inicio,
            fechaVencimiento: t.fecha_vencimiento,
            asignado: t.asignado_a,
          })));
        }
      } catch (e: any) {
        toast.error('Error al cargar cronograma');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [tenantId]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthLabel = viewDate.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  const prevMonth = () => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  const nextMonth = () => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });

  const tareasFiltradas = tareas.filter(t =>
    filtroProyecto === 'todos' || t.proyectoId === filtroProyecto
  );

  const getBarStyle = (t: TareaGantt) => {
    if (!t.fechaVencimiento) return null;
    const inicio = t.fechaInicio ? new Date(t.fechaInicio + 'T00:00:00') : new Date(t.fechaVencimiento + 'T00:00:00');
    const fin = new Date(t.fechaVencimiento + 'T00:00:00');
    const mesInicio = new Date(year, month, 1);
    const mesFin = new Date(year, month, daysInMonth);
    if (fin < mesInicio || inicio > mesFin) return null;
    const startDay = Math.max(1, inicio.getDate()) - 1;
    const endDay = Math.min(daysInMonth, fin.getDate());
    const left = (startDay / daysInMonth) * 100;
    const width = ((endDay - startDay) / daysInMonth) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Cronograma</h1>
            <p className="text-sm text-muted-foreground">Vista Gantt de tareas por mes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroProyecto} onValueChange={setFiltroProyecto}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos los proyectos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los proyectos</SelectItem>
              {proyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="size-4" /></Button>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : tareasFiltradas.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarDays className="size-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No hay tareas con fechas en este período</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => onNavigate?.('/proyectos/tareas')}>
                Ver tareas
              </Button>
            </div>
          ) : (
            <div className="min-w-[900px]">
              {/* Header días */}
              <div className="flex border-b border-border bg-muted/30">
                <div className="w-64 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border">Tarea</div>
                <div className="flex-1 flex">
                  {days.map(d => (
                    <div key={d} className={`flex-1 text-center text-xs py-2 border-r border-border/40 last:border-0 ${d === new Date().getDate() && year === new Date().getFullYear() && month === new Date().getMonth() ? 'text-primary font-bold bg-primary/5' : 'text-muted-foreground'}`}>
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              {/* Filas de tareas */}
              {tareasFiltradas.map(t => {
                const barStyle = getBarStyle(t);
                const cfg = ESTADO_CONFIG[t.estado] ?? ESTADO_CONFIG.pendiente;
                return (
                  <div key={t.id} className="flex border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <div className="w-64 shrink-0 px-3 py-2 border-r border-border flex items-center gap-2">
                      <span className={`size-2 rounded-full shrink-0 ${cfg.color}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{t.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.proyecto}</p>
                      </div>
                    </div>
                    <div className="flex-1 relative py-2 px-0">
                      {barStyle ? (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full ${cfg.color} opacity-80 cursor-pointer hover:opacity-100 transition-opacity flex items-center px-2`}
                          style={barStyle}
                          title={`${t.titulo} — ${t.fechaInicio ?? '?'} → ${t.fechaVencimiento}`}
                        >
                          <span className="text-white text-xs font-medium truncate">{t.titulo}</span>
                        </div>
                      ) : (
                        <div className="h-5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-full ${cfg.color}`} />
            <span className="text-xs text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
