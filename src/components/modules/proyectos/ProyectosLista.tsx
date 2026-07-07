/**
 * ProyectosLista — Cards / tabla + dialog nuevo/editar
 */

import { useState, useMemo } from 'react';
import {
  Plus, Search, LayoutGrid, List, FolderKanban, Calendar,
  DollarSign, Users, AlertTriangle, ChevronRight, Pencil, Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useProyectos, type Proyecto } from '../../../lib/proyectos/proyectos-store';
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from 'sonner';

// ── Config ───────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  planificacion: { label: 'Planificación', color: 'bg-slate-100 text-slate-700' },
  en_ejecucion:  { label: 'En Ejecución',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pausado:       { label: 'Pausado',        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completado:    { label: 'Completado',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelado:     { label: 'Cancelado',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  liquidacion:   { label: 'Liquidación',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};
// Fallback para estados fuera del catálogo — nunca tumbar el módulo
const ESTADO_FALLBACK = { label: '—', color: 'bg-slate-100 text-slate-700' };

const PRIORIDAD_CONFIG: Record<Proyecto['prioridad'], { label: string; color: string }> = {
  baja:    { label: 'Baja',    color: 'bg-slate-100 text-slate-600' },
  media:   { label: 'Media',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const TIPO_LABELS: Record<Proyecto['tipo'], string> = {
  interno:       'Interno',
  cliente:       'Cliente',
  infraestructura: 'Infraestructura',
  mejora:        'Mejora',
  investigacion: 'Investigación',
};

// ── Dialog Form ───────────────────────────────────────────────────────────────

interface FormData {
  nombre: string;
  descripcion: string;
  tipo: Proyecto['tipo'];
  estado: Proyecto['estado'];
  prioridad: Proyecto['prioridad'];
  fechaInicio: string;
  fechaFinEstimada: string;
  presupuesto: string;
  gerenteProyecto: string;
  moneda: string;
  // Fase 2: Proyecto-céntrico
  modalidad: string;
  entidadCliente: string;
  region: string;
  montoContrato: string;
  montoAdenda: string;
}

const MODALIDAD_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Sin modalidad —' },
  { value: 'oxi', label: 'OXI' },
  { value: 'ioarr', label: 'IOARR' },
  { value: 'licitacion', label: 'Licitación Pública' },
  { value: 'adjudicacion', label: 'Adjudicación Directa' },
  { value: 'otro', label: 'Otro' },
];

const DEFAULT_FORM: FormData = {
  nombre: '',
  descripcion: '',
  tipo: 'interno',
  estado: 'planificacion',
  prioridad: 'media',
  fechaInicio: '',
  fechaFinEstimada: '',
  presupuesto: '',
  gerenteProyecto: '',
  moneda: 'PEN',
  modalidad: '',
  entidadCliente: '',
  region: '',
  montoContrato: '',
  montoAdenda: '',
};

interface ProyectoDialogProps {
  open: boolean;
  proyecto?: Proyecto;
  onClose: () => void;
}

function ProyectoDialog({ open, proyecto, onClose }: ProyectoDialogProps) {
  const { tenantId, user } = useAuth();
  const { crearProyecto, actualizarProyecto, crearFase } = useProyectos();
  const [form, setForm] = useState<FormData>(() =>
    proyecto
      ? {
          nombre: proyecto.nombre,
          descripcion: proyecto.descripcion ?? '',
          tipo: proyecto.tipo,
          estado: proyecto.estado,
          prioridad: proyecto.prioridad,
          fechaInicio: proyecto.fechaInicio ?? '',
          fechaFinEstimada: proyecto.fechaFinEstimada ?? '',
          presupuesto: proyecto.presupuesto?.toString() ?? '',
          gerenteProyecto: proyecto.gerenteProyecto ?? '',
          moneda: proyecto.moneda,
          modalidad: proyecto.modalidad ?? '',
          entidadCliente: proyecto.entidadCliente ?? '',
          region: proyecto.region ?? '',
          montoContrato: proyecto.montoContrato?.toString() ?? '',
          montoAdenda: proyecto.montoAdenda?.toString() ?? '',
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!tenantId) return;

    setSaving(true);
    try {
      const year = new Date().getFullYear();
      const codigo = proyecto?.id ?? `PRY-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

      const data = {
        tenant_id: tenantId,
        codigo,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        estado: form.estado,
        prioridad: form.prioridad,
        fecha_inicio: form.fechaInicio || null,
        fecha_fin_estimada: form.fechaFinEstimada || null,
        fecha_fin_real: null,
        presupuesto: form.presupuesto ? parseFloat(form.presupuesto) : null,
        costo_real: 0,
        moneda: form.moneda,
        gerente_proyecto: form.gerenteProyecto.trim() || null,
        cliente_id: null,
        porcentaje_avance: 0,
        creado_por: user?.email ?? null,
        modificado_por: null,
        modificado_en: null,
        // Fase 2: Proyecto-céntrico
        modalidad: form.modalidad || null,
        entidad_cliente: form.entidadCliente.trim() || null,
        region: form.region.trim() || null,
        monto_contrato: form.montoContrato ? parseFloat(form.montoContrato) : null,
        monto_adenda: form.montoAdenda ? parseFloat(form.montoAdenda) : null,
      };

      if (proyecto) {
        await actualizarProyecto(proyecto._dbId, data);
        toast.success('Proyecto actualizado');
      } else {
        const nuevo = await crearProyecto(data);
        // Auto-crear fases OXI/IOARR si aplica
        const mod = form.modalidad;
        if (mod === 'oxi' || mod === 'ioarr') {
          const plantilla = [
            { nombre: 'Priorización', descripcion: 'Evaluación y priorización del proyecto', orden: 1 },
            { nombre: 'Actos Previos', descripcion: 'Estudios previos, expediente técnico, permisos', orden: 2 },
            { nombre: 'Selección', descripcion: 'Proceso de selección y adjudicación', orden: 3 },
            { nombre: 'Ejecución', descripcion: 'Ejecución contractual y supervisión', orden: 4 },
          ];
          for (const f of plantilla) {
            await crearFase({
              tenant_id: tenantId,
              proyecto_id: nuevo._dbId,
              nombre: f.nombre,
              descripcion: f.descripcion,
              orden: f.orden,
              estado: 'pendiente',
              porcentaje_avance: 0,
            });
          }
          toast.success(`Proyecto creado con ${plantilla.length} fases ${mod.toUpperCase()}`);
        } else {
          toast.success('Proyecto creado');
        }
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error guardando proyecto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proyecto ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="md:col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre del proyecto"
              className="mt-1"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción opcional"
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as Proyecto['tipo'] }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as Proyecto['estado'] }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Prioridad</Label>
            <Select value={form.prioridad} onValueChange={v => setForm(f => ({ ...f, prioridad: v as Proyecto['prioridad'] }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORIDAD_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="gerente">Gerente de Proyecto</Label>
            <Input
              id="gerente"
              value={form.gerenteProyecto}
              onChange={e => setForm(f => ({ ...f, gerenteProyecto: e.target.value }))}
              placeholder="Nombre del gerente"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="inicio">Fecha de Inicio</Label>
            <Input
              id="inicio"
              type="date"
              value={form.fechaInicio}
              onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="fin">Fecha Fin Estimada</Label>
            <Input
              id="fin"
              type="date"
              value={form.fechaFinEstimada}
              onChange={e => setForm(f => ({ ...f, fechaFinEstimada: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="presupuesto">Presupuesto</Label>
            <Input
              id="presupuesto"
              type="number"
              min={0}
              step={0.01}
              value={form.presupuesto}
              onChange={e => setForm(f => ({ ...f, presupuesto: e.target.value }))}
              placeholder="0.00"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Moneda</Label>
            <Select value={form.moneda} onValueChange={v => setForm(f => ({ ...f, moneda: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PEN">PEN — Soles</SelectItem>
                <SelectItem value="USD">USD — Dólares</SelectItem>
                <SelectItem value="EUR">EUR — Euros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Sección Contrato / OXI-IOARR ── */}
          <div className="md:col-span-2 border-t pt-3 mt-1">
            <p className="text-sm font-medium text-muted-foreground mb-3">Datos del Contrato (opcional)</p>
          </div>

          <div>
            <Label>Modalidad</Label>
            <Select value={form.modalidad || '_none'} onValueChange={v => setForm(f => ({ ...f, modalidad: v === '_none' ? '' : v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="— Sin modalidad —" />
              </SelectTrigger>
              <SelectContent>
                {MODALIDAD_OPTIONS.map(o => (
                  <SelectItem key={o.value || '_none'} value={o.value || '_none'}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="entidad">Entidad / Cliente</Label>
            <Input
              id="entidad"
              value={form.entidadCliente}
              onChange={e => setForm(f => ({ ...f, entidadCliente: e.target.value }))}
              placeholder="Ej: Gobierno Regional de Cajamarca"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="region">Región</Label>
            <Input
              id="region"
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              placeholder="Ej: Cajamarca"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="montoContrato">Monto Contrato</Label>
            <Input
              id="montoContrato"
              type="number"
              min={0}
              step={0.01}
              value={form.montoContrato}
              onChange={e => setForm(f => ({ ...f, montoContrato: e.target.value }))}
              placeholder="0.00"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="montoAdenda">Monto Adendas</Label>
            <Input
              id="montoAdenda"
              type="number"
              min={0}
              step={0.01}
              value={form.montoAdenda}
              onChange={e => setForm(f => ({ ...f, montoAdenda: e.target.value }))}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : proyecto ? 'Actualizar' : 'Crear Proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
  onVerDetalle?: (dbId: string) => void;
}

export function ProyectosLista({ onNavigate, onVerDetalle }: Props) {
  const { proyectos, loading } = useProyectos();
  const [vista, setVista] = useState<'cards' | 'tabla'>('cards');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Proyecto | undefined>(undefined);

  const filtrados = useMemo(() => {
    return proyectos.filter(p => {
      const matchBusqueda = !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.id.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.gerenteProyecto ?? '').toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
      const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
      const matchPrioridad = filtroPrioridad === 'todos' || p.prioridad === filtroPrioridad;
      return matchBusqueda && matchEstado && matchTipo && matchPrioridad;
    });
  }, [proyectos, busqueda, filtroEstado, filtroTipo, filtroPrioridad]);

  const abrirNuevo = () => { setEditando(undefined); setDialogOpen(true); };
  const abrirEditar = (p: Proyecto) => { setEditando(p); setDialogOpen(true); };
  const cerrarDialog = () => { setDialogOpen(false); setEditando(undefined); };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <FolderKanban className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Proyectos</h2>
            <p className="text-muted-foreground mt-1 text-sm">{proyectos.length} proyecto(s) registrados</p>
          </div>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código..."
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

        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
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

        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={vista === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setVista('cards')}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={vista === 'tabla' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setVista('tabla')}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Loading / Empty */}
      {loading && (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Cargando proyectos...
        </div>
      )}

      {!loading && filtrados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderKanban className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No se encontraron proyectos</p>
          <p className="text-sm mt-1">Ajusta los filtros o crea un nuevo proyecto</p>
          <Button className="mt-4" onClick={abrirNuevo}>
            <Plus className="size-4" />
            Crear Proyecto
          </Button>
        </div>
      )}

      {/* Vista Cards */}
      {!loading && vista === 'cards' && filtrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(p => {
            const estadoCfg = ESTADO_CONFIG[p.estado] ?? ESTADO_FALLBACK;
            const priorCfg = PRIORIDAD_CONFIG[p.prioridad] ?? ESTADO_FALLBACK;
            return (
              <Card
                key={p._dbId}
                className={`hover:shadow-md transition-shadow cursor-pointer ${p.estaRetrasado ? 'border-red-300' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                      <h3 className="font-semibold text-sm mt-0.5 truncate">{p.nombre}</h3>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <Badge className={`${estadoCfg.color} border-0 text-xs`}>{estadoCfg.label}</Badge>
                      <Badge className={`${priorCfg.color} border-0 text-xs`}>{priorCfg.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Progreso */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progreso</span>
                      <span>{p.porcentajeAvance}%</span>
                    </div>
                    <Progress value={p.porcentajeAvance} className="h-1.5" />
                  </div>

                  {/* Detalles */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {p.gerenteProyecto && (
                      <div className="flex items-center gap-1">
                        <Users className="size-3" />
                        <span className="truncate">{p.gerenteProyecto}</span>
                      </div>
                    )}
                    {p.fechaFinEstimada && (
                      <div className={`flex items-center gap-1 ${p.estaRetrasado ? 'text-red-500' : ''}`}>
                        <Calendar className="size-3" />
                        <span>{p.fechaFinEstimada}</span>
                      </div>
                    )}
                    {p.presupuesto && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="size-3" />
                        <span>S/ {p.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    {p.miembros.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="size-3" />
                        <span>{p.miembros.length} miembro(s)</span>
                      </div>
                    )}
                  </div>

                  {p.estaRetrasado && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertTriangle className="size-3" />
                      <span>
                        {p.diasRestantes !== undefined ? `${Math.abs(p.diasRestantes)} días de retraso` : 'Retrasado'}
                      </span>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-7 text-xs"
                      onClick={() => onVerDetalle?.(p._dbId)}
                    >
                      <ChevronRight className="size-3" />
                      Ver detalle
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-blue-600"
                      title="Vista 360°"
                      onClick={e => { e.stopPropagation(); onNavigate?.(`/proyectos/360/${p._dbId}`); }}
                    >
                      <Eye className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={e => { e.stopPropagation(); abrirEditar(p); }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vista Tabla */}
      {!loading && vista === 'tabla' && filtrados.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
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
                {filtrados.map(p => {
                  const estadoCfg = ESTADO_CONFIG[p.estado] ?? ESTADO_FALLBACK;
                  const priorCfg = PRIORIDAD_CONFIG[p.prioridad] ?? ESTADO_FALLBACK;
                  return (
                    <TableRow key={p._dbId} className={p.estaRetrasado ? 'bg-red-50/40' : ''}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
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
                      <TableCell className="text-sm">{TIPO_LABELS[p.tipo]}</TableCell>
                      <TableCell>
                        <Badge className={`${estadoCfg.color} border-0`}>{estadoCfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorCfg.color} border-0`}>{priorCfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={p.porcentajeAvance} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{p.porcentajeAvance}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.presupuesto
                          ? `S/ ${p.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.fechaFinEstimada ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.gerenteProyecto ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onVerDetalle?.(p._dbId)}>
                            <ChevronRight className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600" title="Vista 360°" onClick={() => onNavigate?.(`/proyectos/360/${p._dbId}`)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => abrirEditar(p)}>
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <ProyectoDialog
        open={dialogOpen}
        proyecto={editando}
        onClose={cerrarDialog}
      />
    </div>
  );
}
