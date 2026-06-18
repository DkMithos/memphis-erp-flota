/**
 * CRM Oportunidades — Lista con filtros, KPIs, etapas coloreadas, CRUD
 */

import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, ArrowRight, TrendingUp, DollarSign, Target, Trophy } from 'lucide-react';
import { PageNav } from '../../shared/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Separator } from '../../ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { useCRMStore, type Oportunidad } from '../../../lib/crm/crm-store';
import { convertirAMonedaBase, formatMontoBase } from '../../../lib/shared/currency-utils';
import { toast } from 'sonner';

// ── Badge helpers ────────────────────────────────────────────────────────────

type Etapa = Oportunidad['etapa'];
type Prioridad = Oportunidad['prioridad'];

function badgeEtapa(etapa: Etapa) {
  const map: Record<Etapa, { label: string; className: string }> = {
    prospecto:       { label: 'Prospecto',    className: 'bg-slate-100 text-slate-700 border-slate-200' },
    calificado:      { label: 'Calificado',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
    propuesta:       { label: 'Propuesta',    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200' },
    negociacion:     { label: 'Negociación',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
    cerrado_ganado:  { label: 'Ganado',       className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' },
    cerrado_perdido: { label: 'Perdido',      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  };
  const cfg = map[etapa] ?? map.prospecto;
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function badgePrioridad(p: Prioridad) {
  const map: Record<Prioridad, { label: string; className: string }> = {
    baja:    { label: 'Baja',    className: 'bg-slate-100 text-slate-600 border-slate-200' },
    media:   { label: 'Media',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
    alta:    { label: 'Alta',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' },
    urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  };
  const cfg = map[p] ?? map.media;
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

// ── Form ─────────────────────────────────────────────────────────────────────

type OpoForm = {
  clienteDbId: string;
  clienteId: string;
  clienteNombre: string;
  titulo: string;
  descripcion?: string;
  etapa: Etapa;
  probabilidad: number;
  montoEstimado?: number;
  moneda: string;
  fechaCierreEstimada?: string;
  motivoCierre?: string;
  prioridad: Prioridad;
  ejecutivo?: string;
};

const FORM_EMPTY: OpoForm = {
  clienteDbId: '', clienteId: '', clienteNombre: '',
  titulo: '', etapa: 'prospecto', probabilidad: 10, moneda: 'PEN', prioridad: 'media',
};

interface Props {
  onNavigate?: (route: string) => void;
}

export function CRMOportunidades({ onNavigate }: Props) {
  const { clientes, oportunidades, actividades, crearOportunidad, actualizarOportunidad, loading } = useCRMStore();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todos');

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'crear' | 'editar'>('crear');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OpoForm>(FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [opoDetalle, setOpoDetalle] = useState<Oportunidad | null>(null);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const abiertas = oportunidades.filter(o => !o.etapa.startsWith('cerrado'));
  const valorPipeline = abiertas.reduce((s, o) => s + convertirAMonedaBase(o.montoEstimado ?? 0, o.moneda), 0);
  const promProb = abiertas.length > 0 ? Math.round(abiertas.reduce((s, o) => s + o.probabilidad, 0) / abiertas.length) : 0;
  const now = new Date();
  const ganadasEsteMes = oportunidades.filter(o => {
    if (o.etapa !== 'cerrado_ganado' || !o.fechaCierreReal) return false;
    const d = new Date(o.fechaCierreReal);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // ── Filtered ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...oportunidades];
    if (filtroEtapa !== 'todos') list = list.filter(o => o.etapa === filtroEtapa);
    if (filtroPrioridad !== 'todos') list = list.filter(o => o.prioridad === filtroPrioridad);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(o =>
        o.titulo.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.clienteNombre.toLowerCase().includes(q)
      );
    }
    return list;
  }, [oportunidades, filtroEtapa, filtroPrioridad, busqueda]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openCrear = () => {
    setForm(FORM_EMPTY);
    setDialogMode('crear');
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditar = (o: Oportunidad) => {
    setForm({
      clienteDbId: o.clienteDbId, clienteId: o.clienteId, clienteNombre: o.clienteNombre,
      titulo: o.titulo, descripcion: o.descripcion,
      etapa: o.etapa, probabilidad: o.probabilidad,
      montoEstimado: o.montoEstimado, moneda: o.moneda,
      fechaCierreEstimada: o.fechaCierreEstimada,
      motivoCierre: o.motivoCierre, prioridad: o.prioridad, ejecutivo: o.ejecutivo,
    });
    setEditingId(o._dbId);
    setDialogMode('editar');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) { toast.error('El título es requerido'); return; }
    if (!form.clienteDbId) { toast.error('Selecciona un cliente'); return; }
    setSaving(true);
    try {
      if (dialogMode === 'crear') {
        await crearOportunidad(form);
        toast.success('Oportunidad creada');
      } else if (editingId) {
        const { exito } = await actualizarOportunidad(editingId, form);
        if (exito) toast.success('Oportunidad actualizada');
        else toast.error('Error al actualizar');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEtapa = async (o: Oportunidad, nuevaEtapa: Etapa) => {
    const { exito } = await actualizarOportunidad(o._dbId, { etapa: nuevaEtapa });
    if (exito) {
      toast.success(`Etapa actualizada a "${nuevaEtapa}"`);
      if (detalleOpen && opoDetalle?._dbId === o._dbId) {
        setOpoDetalle(prev => prev ? { ...prev, etapa: nuevaEtapa } : prev);
      }
    } else toast.error('No se pudo actualizar la etapa');
  };

  const setField = (key: keyof OpoForm, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleClienteSelect = (dbId: string) => {
    const c = clientes.find(c => c._dbId === dbId);
    if (c) setForm(prev => ({ ...prev, clienteDbId: dbId, clienteId: c.id, clienteNombre: c.razonSocial }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Target className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Oportunidades</h2>
            <p className="text-sm text-muted-foreground mt-1">Pipeline de ventas y seguimiento de oportunidades</p>
          </div>
        </div>
        <Button onClick={openCrear}>
          <Plus className="size-4" /> Nueva Oportunidad
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Oportunidades Abiertas', value: abiertas.length, icon: Target, sub: 'en pipeline', box: 'bg-blue-500' },
          { label: 'Valor Pipeline', value: formatMontoBase(valorPipeline), icon: DollarSign, sub: 'monto en PEN', box: 'bg-emerald-600' },
          { label: 'Probabilidad Promedio', value: `${promProb}%`, icon: TrendingUp, sub: 'promedio abiertas', box: 'bg-indigo-500' },
          { label: 'Ganadas este Mes', value: ganadasEsteMes, icon: Trophy, sub: new Date().toLocaleString('es-PE', { month: 'long' }), box: 'bg-green-500' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${k.box}`}>
                <k.icon className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-8" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las etapas</SelectItem>
            <SelectItem value="prospecto">Prospecto</SelectItem>
            <SelectItem value="calificado">Calificado</SelectItem>
            <SelectItem value="propuesta">Propuesta</SelectItem>
            <SelectItem value="negociacion">Negociación</SelectItem>
            <SelectItem value="cerrado_ganado">Ganado</SelectItem>
            <SelectItem value="cerrado_perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando oportunidades...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {oportunidades.length === 0 ? 'No hay oportunidades registradas' : 'Sin resultados'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Prob.</TableHead>
                  <TableHead className="text-right">Monto Est.</TableHead>
                  <TableHead className="text-right">Val. Pond.</TableHead>
                  <TableHead>Cierre Est.</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Ejecutivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(o => (
                  <TableRow key={o._dbId} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{o.id}</TableCell>
                    <TableCell className="font-medium text-sm max-w-48 truncate">{o.titulo}</TableCell>
                    <TableCell className="text-sm">{o.clienteNombre}</TableCell>
                    <TableCell>{badgeEtapa(o.etapa)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{o.probabilidad}%</TableCell>
                    <TableCell className="text-right text-sm">
                      {o.montoEstimado ? `S/ ${o.montoEstimado.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-green-600">
                      {o.valorPonderado ? `S/ ${o.valorPonderado.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.fechaCierreEstimada
                        ? new Date(o.fechaCierreEstimada).toLocaleDateString('es-PE')
                        : '—'}
                    </TableCell>
                    <TableCell>{badgePrioridad(o.prioridad)}</TableCell>
                    <TableCell className="text-xs">{o.ejecutivo ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setOpoDetalle(o); setDetalleOpen(true); }}>
                          <Eye className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditar(o)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'crear' ? 'Nueva Oportunidad' : 'Editar Oportunidad'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={form.clienteDbId || 'ninguno'} onValueChange={v => v !== 'ninguno' ? handleClienteSelect(v) : undefined}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c._dbId} value={c._dbId}>{c.razonSocial} ({c.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setField('titulo', e.target.value)} placeholder="Nombre de la oportunidad" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion ?? ''} onChange={e => setField('descripcion', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa *</Label>
              <Select value={form.etapa} onValueChange={v => setField('etapa', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="calificado">Calificado</SelectItem>
                  <SelectItem value="propuesta">Propuesta</SelectItem>
                  <SelectItem value="negociacion">Negociación</SelectItem>
                  <SelectItem value="cerrado_ganado">Cerrado Ganado</SelectItem>
                  <SelectItem value="cerrado_perdido">Cerrado Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Probabilidad (%) *</Label>
              <Input type="number" min={0} max={100} value={form.probabilidad} onChange={e => setField('probabilidad', +e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Monto Estimado</Label>
              <Input type="number" value={form.montoEstimado ?? ''} onChange={e => setField('montoEstimado', e.target.value ? +e.target.value : undefined)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={form.moneda} onValueChange={v => setField('moneda', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">PEN — Soles</SelectItem>
                  <SelectItem value="USD">USD — Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha Cierre Estimada</Label>
              <Input type="date" value={form.fechaCierreEstimada ?? ''} onChange={e => setField('fechaCierreEstimada', e.target.value || undefined)} />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad *</Label>
              <Select value={form.prioridad} onValueChange={v => setField('prioridad', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ejecutivo</Label>
              <Input value={form.ejecutivo ?? ''} onChange={e => setField('ejecutivo', e.target.value || undefined)} />
            </div>
            {(form.etapa === 'cerrado_ganado' || form.etapa === 'cerrado_perdido') && (
              <div className="col-span-2 space-y-1.5">
                <Label>Motivo de Cierre</Label>
                <Textarea rows={2} value={form.motivoCierre ?? ''} onChange={e => setField('motivoCierre', e.target.value || undefined)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando...' : dialogMode === 'crear' ? 'Crear Oportunidad' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {opoDetalle && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">{opoDetalle.id}</span>
                    <span>{opoDetalle.titulo}</span>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2">
                  {badgeEtapa(opoDetalle.etapa)}
                  {badgePrioridad(opoDetalle.prioridad)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{opoDetalle.clienteNombre}</p></div>
                  <div><p className="text-xs text-muted-foreground">Probabilidad</p><p className="font-medium">{opoDetalle.probabilidad}%</p></div>
                  {opoDetalle.montoEstimado && <div><p className="text-xs text-muted-foreground">Monto Estimado</p><p>S/ {opoDetalle.montoEstimado.toLocaleString()}</p></div>}
                  {opoDetalle.valorPonderado && <div><p className="text-xs text-muted-foreground">Valor Ponderado</p><p className="font-semibold text-green-600">S/ {opoDetalle.valorPonderado.toLocaleString()}</p></div>}
                  {opoDetalle.fechaCierreEstimada && <div><p className="text-xs text-muted-foreground">Cierre Estimado</p><p>{new Date(opoDetalle.fechaCierreEstimada).toLocaleDateString('es-PE')}</p></div>}
                  {opoDetalle.ejecutivo && <div><p className="text-xs text-muted-foreground">Ejecutivo</p><p>{opoDetalle.ejecutivo}</p></div>}
                </div>
                {opoDetalle.descripcion && <div><p className="text-xs text-muted-foreground font-medium mb-1">Descripción</p><p className="text-sm">{opoDetalle.descripcion}</p></div>}
                {opoDetalle.motivoCierre && <div><p className="text-xs text-muted-foreground font-medium mb-1">Motivo de Cierre</p><p className="text-sm">{opoDetalle.motivoCierre}</p></div>}

                <Separator />
                <div>
                  <p className="font-medium text-sm mb-2">Cambiar Etapa</p>
                  <div className="flex flex-wrap gap-2">
                    {(['prospecto', 'calificado', 'propuesta', 'negociacion', 'cerrado_ganado', 'cerrado_perdido'] as Etapa[]).map(e => (
                      <Button
                        key={e}
                        variant={opoDetalle.etapa === e ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleCambiarEtapa(opoDetalle, e)}
                        className="text-xs h-7"
                      >
                        {e === 'cerrado_ganado' ? 'Ganado' : e === 'cerrado_perdido' ? 'Perdido' : e.charAt(0).toUpperCase() + e.slice(1)}
                        {opoDetalle.etapa === e && <ArrowRight className="size-3 ml-1" />}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />
                <div>
                  <p className="font-medium text-sm mb-2">Actividades asociadas</p>
                  {actividades.filter(a => a.oportunidadDbId === opoDetalle._dbId).slice(0, 5).map(a => (
                    <div key={a._dbId} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                      <span className="text-xs capitalize text-muted-foreground w-20">{a.tipo}</span>
                      <span className="flex-1 px-2 truncate">{a.titulo}</span>
                      <Badge variant="outline" className="text-xs">{a.estado}</Badge>
                    </div>
                  ))}
                  {actividades.filter(a => a.oportunidadDbId === opoDetalle._dbId).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin actividades asociadas</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetalleOpen(false)}>Cerrar</Button>
                <Button onClick={() => { setDetalleOpen(false); openEditar(opoDetalle); }}>
                  <Pencil className="size-3.5" /> Editar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
