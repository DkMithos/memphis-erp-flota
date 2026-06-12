/**
 * TareaDetalle — Vista de detalle y edición de una tarea de proyecto
 */
import { useState, useMemo } from 'react';
import { ArrowLeft, Pencil, Trash2, Clock, Calendar, User, Flag, FolderKanban, CheckCircle2, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { useProyectos, type Tarea } from '../../../lib/proyectos/proyectos-store';
import { toast } from 'sonner';

// ── Config ────────────────────────────────────────────────────────────────────

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

interface Props {
  tareaDbId: string;
  onNavigate?: (route: string) => void;
  onBack?: () => void;
}

export function TareaDetalle({ tareaDbId, onNavigate, onBack }: Props) {
  const { proyectos, actualizarTarea, eliminarTarea } = useProyectos();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Buscar la tarea en todos los proyectos
  const found = useMemo(() => {
    for (const p of proyectos) {
      const t = p.tareas.find(t => t._dbId === tareaDbId);
      if (t) {
        const fase = p.fases.find(f => f._dbId === t.faseDbId);
        return { tarea: t, proyecto: p, fase };
      }
    }
    return null;
  }, [proyectos, tareaDbId]);

  const [form, setForm] = useState<Partial<Tarea>>({});

  const handleEditOpen = () => {
    if (!found) return;
    setForm({ ...found.tarea });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!found) return;
    setSaving(true);
    await actualizarTarea(found.tarea._dbId, {
      titulo: form.titulo,
      descripcion: form.descripcion ?? null,
      estado: form.estado,
      prioridad: form.prioridad,
      asignado_a: form.asignadoA ?? null,
      fecha_inicio: form.fechaInicio ?? null,
      fecha_vencimiento: form.fechaVencimiento ?? null,
      estimacion_horas: form.estimacionHoras ?? null,
      horas_reales: form.horasReales ?? null,
    });
    setSaving(false);
    setEditOpen(false);
    toast.success('Tarea actualizada');
  };

  const handleDelete = async () => {
    if (!found) return;
    await eliminarTarea(found.tarea._dbId);
    toast.success('Tarea eliminada');
    if (onBack) onBack();
    else onNavigate?.('/proyectos/tareas');
  };

  if (!found) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
        <p className="text-sm">Tarea no encontrada.</p>
        <PageNav />
      </div>
    );
  }

  const { tarea, proyecto, fase } = found;
  const estadoCfg = ESTADO_CONFIG[tarea.estado];
  const prioridadCfg = PRIORIDAD_CONFIG[tarea.prioridad];
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vencida = !!tarea.fechaVencimiento
    && new Date(tarea.fechaVencimiento) < hoy
    && tarea.estado !== 'completada'
    && tarea.estado !== 'cancelada';

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <ListChecks className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{tarea.titulo}</h1>
              {vencida && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Vencida</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <FolderKanban className="size-3.5" />
              <button
                className="hover:underline"
                onClick={() => onNavigate?.(`/proyectos/detalle/${proyecto._dbId}`)}
              >
                {proyecto.nombre}
              </button>
              {fase && <><span>·</span><span>{fase.nombre}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleEditOpen}>
            <Pencil className="size-4" /> Editar
          </Button>
          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setDelOpen(true)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Estado + Prioridad */}
      <div className="flex flex-wrap gap-3">
        <Badge className={`${estadoCfg.color} text-sm px-3 py-1`}>{estadoCfg.label}</Badge>
        <Badge className={`${prioridadCfg.color} text-sm px-3 py-1`}>
          <Flag className="size-3" />{prioridadCfg.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Descripción */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              {tarea.descripcion
                ? <p className="text-sm whitespace-pre-wrap">{tarea.descripcion}</p>
                : <p className="text-sm text-muted-foreground italic">Sin descripción</p>}
            </CardContent>
          </Card>
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              {tarea.asignadoA && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Asignado a</p>
                    <p className="font-medium">{tarea.asignadoA}</p>
                  </div>
                </div>
              )}
              {tarea.fechaInicio && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Inicio</p>
                    <p className="font-medium">{tarea.fechaInicio}</p>
                  </div>
                </div>
              )}
              {tarea.fechaVencimiento && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className={`size-4 shrink-0 ${vencida ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimiento</p>
                    <p className={`font-medium ${vencida ? 'text-red-600' : ''}`}>{tarea.fechaVencimiento}</p>
                  </div>
                </div>
              )}
              {tarea.fechaCompletada && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Completada</p>
                    <p className="font-medium">{tarea.fechaCompletada}</p>
                  </div>
                </div>
              )}
              {(tarea.estimacionHoras != null || tarea.horasReales != null) && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Horas</p>
                    <p className="font-medium">
                      {tarea.horasReales ?? 0}h reales
                      {tarea.estimacionHoras != null && ` / ${tarea.estimacionHoras}h estimadas`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog edición */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo ?? ''} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as Tarea['estado'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTADO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.prioridad} onValueChange={v => setForm(f => ({ ...f, prioridad: v as Tarea['prioridad'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDAD_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Asignado a</Label>
              <Input value={form.asignadoA ?? ''} onChange={e => setForm(f => ({ ...f, asignadoA: e.target.value }))} placeholder="Nombre del responsable" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={form.fechaInicio ?? ''} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
              </div>
              <div>
                <Label>Vencimiento</Label>
                <Input type="date" value={form.fechaVencimiento ?? ''} onChange={e => setForm(f => ({ ...f, fechaVencimiento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Horas estimadas</Label>
                <Input type="number" min="0" value={form.estimacionHoras ?? ''} onChange={e => setForm(f => ({ ...f, estimacionHoras: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Horas reales</Label>
                <Input type="number" min="0" value={form.horasReales ?? ''} onChange={e => setForm(f => ({ ...f, horasReales: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.titulo}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar tarea?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer. La tarea "{tarea.titulo}" será eliminada permanentemente.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
