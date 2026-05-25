/**
 * ProyectoDetalle — Tabs: Tareas (Kanban), Fases, Equipo, Resumen
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft, FolderKanban, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Users, AlertTriangle, CheckCircle2, Clock, MoreVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { ValorizacionesTab } from './ValorizacionesTab';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useProyectos, type Proyecto, type Tarea, type Fase, type MiembroProyecto } from '../../../lib/proyectos/proyectos-store';
import { useAuth } from '../../../auth/AuthProvider';
import { dbProyectos } from '../../../lib/supabase/helpers';
import { toast } from 'sonner';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

// ── Config ───────────────────────────────────────────────────────────────────

const ESTADO_PROYECTO_CONFIG: Record<Proyecto['estado'], { label: string; color: string }> = {
  planificacion: { label: 'Planificación', color: 'bg-slate-100 text-slate-700' },
  en_ejecucion:  { label: 'En Ejecución',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pausado:       { label: 'Pausado',        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completado:    { label: 'Completado',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelado:     { label: 'Cancelado',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const PRIORIDAD_CONFIG: Record<Tarea['prioridad'], { label: string; color: string }> = {
  baja:    { label: 'Baja',    color: 'bg-slate-100 text-slate-600' },
  media:   { label: 'Media',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const KANBAN_COLS: { key: Tarea['estado']; label: string; color: string }[] = [
  { key: 'pendiente',   label: 'Pendiente',   color: 'bg-slate-50 border-slate-200' },
  { key: 'en_progreso', label: 'En Progreso', color: 'bg-blue-50 border-blue-200' },
  { key: 'bloqueada',   label: 'Bloqueada',   color: 'bg-red-50 border-red-200' },
  { key: 'completada',  label: 'Completada',  color: 'bg-green-50 border-green-200' },
];

// ── Tarea Dialog ──────────────────────────────────────────────────────────────

interface TareaDialogProps {
  open: boolean;
  tarea?: Tarea;
  proyectoDbId: string;
  tenantId: string;
  fases: Fase[];
  estadoInicial?: Tarea['estado'];
  onClose: () => void;
}

function TareaDialog({ open, tarea, proyectoDbId, tenantId, fases, estadoInicial, onClose }: TareaDialogProps) {
  const { user } = useAuth();
  const { crearTarea, actualizarTarea } = useProyectos();
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '');
  const [estado, setEstado] = useState<Tarea['estado']>(tarea?.estado ?? estadoInicial ?? 'pendiente');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>(tarea?.prioridad ?? 'media');
  const [asignadoA, setAsignadoA] = useState(tarea?.asignadoA ?? '');
  const [faseDbId, setFaseDbId] = useState(tarea?.faseDbId ?? '');
  const [fechaVencimiento, setFechaVencimiento] = useState(tarea?.fechaVencimiento ?? '');
  const [estimacionHoras, setEstimacionHoras] = useState(tarea?.estimacionHoras?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [tituloError, setTituloError] = useState('');

  const handleSave = async () => {
    if (!titulo.trim()) { setTituloError('El título es requerido'); toast.error('El título es requerido'); return; }
    setSaving(true);
    try {
      const data = {
        tenant_id: tenantId,
        proyecto_id: proyectoDbId,
        fase_id: faseDbId || null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        estado,
        prioridad,
        asignado_a: asignadoA.trim() || null,
        fecha_inicio: null,
        fecha_vencimiento: fechaVencimiento || null,
        fecha_completada: estado === 'completada' ? new Date().toISOString().split('T')[0] : null,
        estimacion_horas: estimacionHoras ? parseFloat(estimacionHoras) : null,
        horas_reales: tarea?.horasReales ?? null,
        orden: tarea?.orden ?? 1,
        creado_por: user?.email ?? null,
      };
      if (tarea) {
        await actualizarTarea(tarea._dbId, data);
        toast.success('Tarea actualizada');
      } else {
        await crearTarea(data);
        toast.success('Tarea creada');
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error guardando tarea');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarea ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => { setTitulo(e.target.value); if (tituloError) setTituloError(''); }} placeholder="Título de la tarea" className="mt-1" />
            {tituloError && <p className="text-sm text-red-600 mt-1">{tituloError}</p>}
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={estado} onValueChange={v => setEstado(v as Tarea['estado'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KANBAN_COLS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={v => setPrioridad(v as Tarea['prioridad'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDAD_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Asignado a</Label>
              <Input value={asignadoA} onChange={e => setAsignadoA(e.target.value)} placeholder="Nombre" className="mt-1" />
            </div>
            <div>
              <Label>Fase</Label>
              <Select value={faseDbId || '_none'} onValueChange={v => setFaseDbId(v === '_none' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sin fase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin fase</SelectItem>
                  {fases.map(f => <SelectItem key={f._dbId} value={f._dbId}>{f.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vencimiento</Label>
              <Input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Est. horas</Label>
              <Input type="number" min={0} step={0.5} value={estimacionHoras} onChange={e => setEstimacionHoras(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : tarea ? 'Actualizar' : 'Crear'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Fase Dialog ───────────────────────────────────────────────────────────────

interface FaseDialogProps {
  open: boolean;
  fase?: Fase;
  proyectoDbId: string;
  tenantId: string;
  ordenSiguiente: number;
  onClose: () => void;
}

function FaseDialog({ open, fase, proyectoDbId, tenantId, ordenSiguiente, onClose }: FaseDialogProps) {
  const { crearFase, actualizarFase } = useProyectos();
  const [nombre, setNombre] = useState(fase?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(fase?.descripcion ?? '');
  const [estadoFase, setEstadoFase] = useState<Fase['estado']>(fase?.estado ?? 'pendiente');
  const [fechaInicio, setFechaInicio] = useState(fase?.fechaInicio ?? '');
  const [fechaFin, setFechaFin] = useState(fase?.fechaFin ?? '');
  const [presupuesto, setPresupuesto] = useState(fase?.presupuesto?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [nombreError, setNombreError] = useState('');

  const handleSave = async () => {
    if (!nombre.trim()) { setNombreError('El nombre es requerido'); toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        tenant_id: tenantId,
        proyecto_id: proyectoDbId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: fase?.orden ?? ordenSiguiente,
        estado: estadoFase,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        porcentaje_avance: fase?.porcentajeAvance ?? 0,
        presupuesto: presupuesto ? parseFloat(presupuesto) : null,
      };
      if (fase) {
        await actualizarFase(fase._dbId, data);
        toast.success('Fase actualizada');
      } else {
        await crearFase(data);
        toast.success('Fase creada');
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error guardando fase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{fase ? 'Editar Fase' : 'Nueva Fase'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={e => { setNombre(e.target.value); if (nombreError) setNombreError(''); }} className="mt-1" />
            {nombreError && <p className="text-sm text-red-600 mt-1">{nombreError}</p>}
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={estadoFase} onValueChange={v => setEstadoFase(v as Fase['estado'])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_progreso">En Progreso</SelectItem>
                <SelectItem value="completada">Completada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha Inicio</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Fecha Fin</Label>
              <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Presupuesto (S/)</Label>
            <Input type="number" min={0} step={0.01} value={presupuesto} onChange={e => setPresupuesto(e.target.value)} placeholder="0.00" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : fase ? 'Actualizar' : 'Crear'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Miembro Dialog ────────────────────────────────────────────────────────────

interface MiembroDialogProps {
  open: boolean;
  proyectoDbId: string;
  tenantId: string;
  onClose: () => void;
}

function MiembroDialog({ open, proyectoDbId, tenantId, onClose }: MiembroDialogProps) {
  const { crearMiembro } = useProyectos();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('');
  const [horasAsignadas, setHorasAsignadas] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim() || !rol.trim()) { toast.error('Nombre y rol son requeridos'); return; }
    setSaving(true);
    try {
      await crearMiembro({
        tenant_id: tenantId,
        proyecto_id: proyectoDbId,
        user_id: null,
        nombre: nombre.trim(),
        rol: rol.trim(),
        horas_asignadas: horasAsignadas ? parseFloat(horasAsignadas) : null,
      });
      toast.success('Miembro agregado');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error agregando miembro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar Miembro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Rol *</Label>
            <Input value={rol} onChange={e => setRol(e.target.value)} placeholder="Ej: Gerente, Analista..." className="mt-1" />
          </div>
          <div>
            <Label>Horas Asignadas</Label>
            <Input type="number" min={0} value={horasAsignadas} onChange={e => setHorasAsignadas(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Agregar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  proyectoDbId: string;
  onBack?: () => void;
}

export function ProyectoDetalle({ proyectoDbId, onBack }: Props) {
  const { proyectos, actualizarEstado, actualizarFase, eliminarFase, eliminarTarea, eliminarMiembro } = useProyectos();
  const { tenantId } = useAuth();
  const confirmAction = useConfirmAction();

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(true);

  // Load full project details from DB (with fases, tareas, miembros)
  useEffect(() => {
    let mounted = true;
    async function loadDetails() {
      setLoadingDetalle(true);
      try {
        const { data, error } = await dbProyectos.getWithDetails(proyectoDbId);
        if (error || !data) throw error ?? new Error('Not found');
        if (!mounted) return;
        // map inline to reuse logic from store mappers
        const fases = ((data as any).fases ?? []).sort((a: any, b: any) => a.orden - b.orden);
        const tareas = (data as any).tareas ?? [];
        const miembros = (data as any).miembros ?? [];

        const storeItem = proyectos.find(p => p._dbId === proyectoDbId);

        const hoy = new Date();
        let diasRestantes: number | undefined;
        let estaRetrasado = false;
        if (data.fecha_fin_estimada) {
          const fin = new Date(data.fecha_fin_estimada);
          const diff = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          diasRestantes = diff;
          estaRetrasado = diff < 0 && data.estado !== 'completado' && data.estado !== 'cancelado';
        }

        const mappedFases: Fase[] = fases.map((f: any) => ({
          _dbId: f.id, proyectoDbId: f.proyecto_id,
          nombre: f.nombre, descripcion: f.descripcion ?? undefined, orden: f.orden,
          estado: f.estado, fechaInicio: f.fecha_inicio ?? undefined, fechaFin: f.fecha_fin ?? undefined,
          porcentajeAvance: f.porcentaje_avance,
        }));
        const mappedTareas: Tarea[] = tareas.map((t: any) => ({
          _dbId: t.id, proyectoDbId: t.proyecto_id, faseDbId: t.fase_id ?? undefined,
          titulo: t.titulo, descripcion: t.descripcion ?? undefined,
          estado: t.estado, prioridad: t.prioridad, asignadoA: t.asignado_a ?? undefined,
          fechaInicio: t.fecha_inicio ?? undefined, fechaVencimiento: t.fecha_vencimiento ?? undefined,
          fechaCompletada: t.fecha_completada ?? undefined, estimacionHoras: t.estimacion_horas ?? undefined,
          horasReales: t.horas_reales ?? undefined, orden: t.orden,
        }));
        const mappedMiembros: MiembroProyecto[] = miembros.map((m: any) => ({
          _dbId: m.id, proyectoDbId: m.proyecto_id, userId: m.user_id ?? undefined,
          nombre: m.nombre, rol: m.rol, horasAsignadas: m.horas_asignadas ?? undefined,
        }));

        const full: Proyecto = {
          _dbId: data.id, id: data.codigo, nombre: data.nombre,
          descripcion: data.descripcion ?? undefined, tipo: data.tipo, estado: data.estado,
          prioridad: data.prioridad, fechaInicio: data.fecha_inicio ?? undefined,
          fechaFinEstimada: data.fecha_fin_estimada ?? undefined, fechaFinReal: data.fecha_fin_real ?? undefined,
          presupuesto: data.presupuesto ?? undefined, costoReal: data.costo_real ?? undefined,
          moneda: data.moneda, gerenteProyecto: data.gerente_proyecto ?? undefined,
          porcentajeAvance: data.porcentaje_avance, creadoEn: data.creado_en,
          fases: mappedFases, tareas: mappedTareas, miembros: mappedMiembros,
          tareasTotal: mappedTareas.length,
          tareasCompletadas: mappedTareas.filter(t => t.estado === 'completada').length,
          diasRestantes, estaRetrasado,
        };
        setProyecto(full);
      } catch {
        // fallback to store version if DB load fails
        const storeItem = proyectos.find(p => p._dbId === proyectoDbId);
        if (storeItem) setProyecto(storeItem);
      } finally {
        if (mounted) setLoadingDetalle(false);
      }
    }
    loadDetails();
    return () => { mounted = false; };
  }, [proyectoDbId]);

  // Re-sync from store after mutations
  useEffect(() => {
    const updated = proyectos.find(p => p._dbId === proyectoDbId);
    if (updated && proyecto) {
      // Keep fases/tareas/miembros from the loaded detail, but update top-level fields
      setProyecto(prev => prev ? { ...updated, fases: prev.fases, tareas: prev.tareas, miembros: prev.miembros } : prev);
    }
  }, [proyectos]);

  const [tareaDialog, setTareaDialog] = useState<{ open: boolean; tarea?: Tarea; estadoInicial?: Tarea['estado'] }>({ open: false });
  const [faseDialog, setFaseDialog] = useState<{ open: boolean; fase?: Fase }>({ open: false });
  const [miembroDialog, setMiembroDialog] = useState(false);

  const handleEliminarTarea = async (dbId: string) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: '¿Eliminar esta tarea?', confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    try {
      await eliminarTarea(dbId);
      setProyecto(prev => prev ? {
        ...prev,
        tareas: prev.tareas.filter(t => t._dbId !== dbId),
        tareasTotal: prev.tareas.filter(t => t._dbId !== dbId).length,
        tareasCompletadas: prev.tareas.filter(t => t._dbId !== dbId && t.estado === 'completada').length,
      } : prev);
      toast.success('Tarea eliminada');
    } catch (e: unknown) { toast.error('Error eliminando tarea'); }
  };

  const handleEliminarFase = async (dbId: string) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: '¿Eliminar esta fase?', confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    try {
      await eliminarFase(dbId);
      setProyecto(prev => prev ? { ...prev, fases: prev.fases.filter(f => f._dbId !== dbId) } : prev);
      toast.success('Fase eliminada');
    } catch (e: unknown) { toast.error('Error eliminando fase'); }
  };

  const handleMoverFase = async (fase: Fase, dir: 'up' | 'down') => {
    if (!proyecto) return;
    const idx = proyecto.fases.findIndex(f => f._dbId === fase._dbId);
    const newOrden = dir === 'up' ? fase.orden - 1 : fase.orden + 1;
    if (newOrden < 1 || newOrden > proyecto.fases.length) return;
    try {
      await actualizarFase(fase._dbId, { orden: newOrden });
      const swapFase = proyecto.fases.find(f => f.orden === newOrden && f._dbId !== fase._dbId);
      if (swapFase) await actualizarFase(swapFase._dbId, { orden: fase.orden });
      // Refresh local
      setProyecto(prev => {
        if (!prev) return prev;
        const fases = prev.fases.map(f => {
          if (f._dbId === fase._dbId) return { ...f, orden: newOrden };
          if (swapFase && f._dbId === swapFase._dbId) return { ...f, orden: fase.orden };
          return f;
        }).sort((a, b) => a.orden - b.orden);
        return { ...prev, fases };
      });
    } catch (e: unknown) { toast.error('Error reordenando fase'); }
  };

  const handleEliminarMiembro = async (dbId: string) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: '¿Eliminar este miembro?', confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    try {
      await eliminarMiembro(dbId);
      setProyecto(prev => prev ? { ...prev, miembros: prev.miembros.filter(m => m._dbId !== dbId) } : prev);
      toast.success('Miembro eliminado');
    } catch (e: unknown) { toast.error('Error eliminando miembro'); }
  };

  if (loadingDetalle) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Cargando proyecto...
      </div>
    );
  }

  if (!proyecto) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FolderKanban className="size-12 mx-auto mb-3 opacity-30" />
        <p>Proyecto no encontrado</p>
        <Button className="mt-4" onClick={onBack}>Volver</Button>
      </div>
    );
  }

  const estadoCfg = ESTADO_PROYECTO_CONFIG[proyecto.estado];
  const hoy = new Date();
  const tareasVencidas = proyecto.tareas.filter(t => {
    if (t.estado === 'completada' || t.estado === 'cancelada') return false;
    if (!t.fechaVencimiento) return false;
    return new Date(t.fechaVencimiento) < hoy;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 mt-1">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="font-mono text-sm text-muted-foreground">{proyecto.id}</p>
            <Badge className={`${estadoCfg.color} border-0`}>{estadoCfg.label}</Badge>
            {proyecto.estaRetrasado && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 flex items-center gap-1">
                <AlertTriangle className="size-3" /> Retrasado
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-semibold mt-1">{proyecto.nombre}</h2>
          {proyecto.descripcion && (
            <p className="text-muted-foreground text-sm mt-1">{proyecto.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-6 mt-3 text-sm text-muted-foreground">
            {proyecto.gerenteProyecto && (
              <div className="flex items-center gap-1">
                <Users className="size-3.5" />
                <span>{proyecto.gerenteProyecto}</span>
              </div>
            )}
            {proyecto.fechaInicio && <span>Inicio: {proyecto.fechaInicio}</span>}
            {proyecto.fechaFinEstimada && (
              <span className={proyecto.estaRetrasado ? 'text-red-500' : ''}>
                Fin est.: {proyecto.fechaFinEstimada}
              </span>
            )}
            {proyecto.presupuesto && (
              <span>
                Presupuesto: S/ {proyecto.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                {proyecto.costoReal ? ` / Costo: S/ ${proyecto.costoReal.toLocaleString('es-PE', { minimumFractionDigits: 0 })}` : ''}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Progress value={proyecto.porcentajeAvance} className="h-2" />
            </div>
            <span className="text-sm font-medium">{proyecto.porcentajeAvance}%</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Select value={proyecto.estado} onValueChange={async v => {
            if (!tenantId) return;
            try {
              await actualizarEstado(proyecto._dbId, v as Proyecto['estado']);
              setProyecto(prev => prev ? { ...prev, estado: v as Proyecto['estado'] } : prev);
              toast.success('Estado actualizado');
            } catch { toast.error('Error actualizando estado'); }
          }}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ESTADO_PROYECTO_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tareas">
        <TabsList>
          <TabsTrigger value="tareas">
            Tareas
            {tareasVencidas > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5">{tareasVencidas}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fases">Fases</TabsTrigger>
          <TabsTrigger value="valorizaciones">Valorizaciones</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>

        {/* ── TAB TAREAS (Kanban) ── */}
        <TabsContent value="tareas" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setTareaDialog({ open: true, estadoInicial: 'pendiente' })}>
              <Plus className="size-3.5" /> Nueva Tarea
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KANBAN_COLS.map(col => {
              const tareasCol = proyecto.tareas.filter(t => t.estado === col.key);
              return (
                <div key={col.key} className={`rounded-lg border-2 ${col.color} p-3 min-h-[200px]`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">{col.label}</h4>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">{tareasCol.length}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setTareaDialog({ open: true, estadoInicial: col.key })}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {tareasCol.map(t => {
                      const priorCfg = PRIORIDAD_CONFIG[t.prioridad];
                      const vencida = t.fechaVencimiento && new Date(t.fechaVencimiento) < hoy && t.estado !== 'completada';
                      return (
                        <div key={t._dbId} className="bg-background rounded border p-2.5 shadow-sm group">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <p className="text-sm font-medium leading-tight">{t.titulo}</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="size-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setTareaDialog({ open: true, tarea: t })}>
                                  <Pencil className="size-3" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleEliminarTarea(t._dbId)}
                                >
                                  <Trash2 className="size-3" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge className={`${priorCfg.color} border-0 text-xs px-1 h-4`}>{priorCfg.label}</Badge>
                            {t.asignadoA && (
                              <span className="text-xs text-muted-foreground">{t.asignadoA}</span>
                            )}
                          </div>
                          {t.fechaVencimiento && (
                            <p className={`text-xs mt-1 ${vencida ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                              {vencida && <AlertTriangle className="inline size-2.5 mr-0.5" />}
                              {t.fechaVencimiento}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {tareasCol.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sin tareas</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── TAB FASES ── */}
        <TabsContent value="fases" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setFaseDialog({ open: true })}>
              <Plus className="size-3.5" /> Nueva Fase
            </Button>
          </div>
          {proyecto.fases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay fases definidas. Agrega fases para organizar el trabajo del proyecto.
            </div>
          ) : (
            <div className="space-y-3">
              {proyecto.fases.map(f => (
                <Card key={f._dbId}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            Fase {f.orden}
                          </span>
                          <h4 className="font-medium">{f.nombre}</h4>
                          <Badge className={
                            f.estado === 'completada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0' :
                            f.estado === 'en_progreso' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0' :
                            f.estado === 'cancelada' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0' :
                            'bg-slate-100 text-slate-700 border-0'
                          }>
                            {f.estado === 'completada' ? 'Completada' :
                             f.estado === 'en_progreso' ? 'En Progreso' :
                             f.estado === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                          </Badge>
                        </div>
                        {f.descripcion && <p className="text-sm text-muted-foreground mt-1">{f.descripcion}</p>}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {f.fechaInicio && <span>Inicio: {f.fechaInicio}</span>}
                          {f.fechaFin && <span>Fin: {f.fechaFin}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={f.porcentajeAvance} className="h-1.5 flex-1 max-w-[200px]" />
                          <span className="text-xs text-muted-foreground">{f.porcentajeAvance}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => handleMoverFase(f, 'up')}
                          disabled={f.orden === 1}
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => handleMoverFase(f, 'down')}
                          disabled={f.orden === proyecto.fases.length}
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setFaseDialog({ open: true, fase: f })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                          onClick={() => handleEliminarFase(f._dbId)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB VALORIZACIONES ── */}
        <TabsContent value="valorizaciones" className="mt-4">
          {tenantId && (
            <ValorizacionesTab
              proyectoDbId={proyecto._dbId}
              tenantId={tenantId}
              fases={proyecto.fases}
              monedaProyecto={proyecto.moneda}
            />
          )}
        </TabsContent>

        {/* ── TAB EQUIPO ── */}
        <TabsContent value="equipo" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setMiembroDialog(true)}>
              <Plus className="size-3.5" /> Agregar Miembro
            </Button>
          </div>
          {proyecto.miembros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay miembros en el equipo. Agrega personas al proyecto.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {proyecto.miembros.map(m => (
                <Card key={m._dbId}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{m.nombre}</p>
                          <p className="text-xs text-muted-foreground">{m.rol}</p>
                          {m.horasAsignadas && (
                            <p className="text-xs text-muted-foreground">{m.horasAsignadas}h asignadas</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                        onClick={() => handleEliminarMiembro(m._dbId)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB RESUMEN ── */}
        <TabsContent value="resumen" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">% Avance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{proyecto.porcentajeAvance}%</div>
                <Progress value={proyecto.porcentajeAvance} className="h-2 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Tareas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{proyecto.tareasCompletadas} / {proyecto.tareasTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Completadas / Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Días restantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${proyecto.estaRetrasado ? 'text-red-600' : ''}`}>
                  {proyecto.diasRestantes !== undefined
                    ? proyecto.estaRetrasado
                      ? `-${Math.abs(proyecto.diasRestantes)}`
                      : proyecto.diasRestantes
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {proyecto.estaRetrasado ? 'Días de retraso' : 'Días hasta fin estimado'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Tareas vencidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${tareasVencidas > 0 ? 'text-red-600' : ''}`}>
                  {tareasVencidas}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pendientes fuera de fecha</p>
              </CardContent>
            </Card>
          </div>

          {/* Tareas por estado */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Tareas por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {KANBAN_COLS.map(col => {
                  const count = proyecto.tareas.filter(t => t.estado === col.key).length;
                  const pct = proyecto.tareasTotal > 0 ? (count / proyecto.tareasTotal) * 100 : 0;
                  return (
                    <div key={col.key} className="flex items-center gap-3">
                      <span className="text-sm w-28 shrink-0">{col.label}</span>
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Presupuesto */}
          {proyecto.presupuesto && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Presupuesto vs Ejecutado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Presupuesto</span>
                    <span className="font-medium">
                      S/ {proyecto.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ejecutado</span>
                    <span className="font-medium text-blue-600">
                      S/ {(proyecto.costoReal ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Disponible</span>
                    <span className="font-medium text-green-600">
                      S/ {(proyecto.presupuesto - (proyecto.costoReal ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <Progress
                    value={proyecto.presupuesto > 0 ? ((proyecto.costoReal ?? 0) / proyecto.presupuesto) * 100 : 0}
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {tareaDialog.open && tenantId && (
        <TareaDialog
          open={tareaDialog.open}
          tarea={tareaDialog.tarea}
          proyectoDbId={proyecto._dbId}
          tenantId={tenantId}
          fases={proyecto.fases}
          estadoInicial={tareaDialog.estadoInicial}
          onClose={() => {
            setTareaDialog({ open: false });
            // refresh local tareas from store
            const updated = proyectos.find(p => p._dbId === proyectoDbId);
            if (updated) setProyecto(prev => prev ? { ...prev, tareas: updated.tareas, tareasTotal: updated.tareasTotal, tareasCompletadas: updated.tareasCompletadas } : prev);
          }}
        />
      )}

      {faseDialog.open && tenantId && (
        <FaseDialog
          open={faseDialog.open}
          fase={faseDialog.fase}
          proyectoDbId={proyecto._dbId}
          tenantId={tenantId}
          ordenSiguiente={proyecto.fases.length + 1}
          onClose={() => {
            setFaseDialog({ open: false });
            const updated = proyectos.find(p => p._dbId === proyectoDbId);
            if (updated) setProyecto(prev => prev ? { ...prev, fases: updated.fases } : prev);
          }}
        />
      )}

      {miembroDialog && tenantId && (
        <MiembroDialog
          open={miembroDialog}
          proyectoDbId={proyecto._dbId}
          tenantId={tenantId}
          onClose={() => {
            setMiembroDialog(false);
            const updated = proyectos.find(p => p._dbId === proyectoDbId);
            if (updated) setProyecto(prev => prev ? { ...prev, miembros: updated.miembros } : prev);
          }}
        />
      )}
    </div>
  );
}
