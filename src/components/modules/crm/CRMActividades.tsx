/**
 * CRM Actividades — Lista con filtros, KPIs, completar actividades
 */

import { useState, useMemo } from 'react';
import { Plus, Search, CheckCircle2, Clock, XCircle, Phone, Mail, MapPin, Users2, FileText, ArrowRight, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { useCRMStore, type ActividadCRM } from '../../../lib/crm/crm-store';
import { toast } from 'sonner';

// ── Badge / Icon helpers ──────────────────────────────────────────────────────

type TipoActividad = ActividadCRM['tipo'];
type EstadoActividad = ActividadCRM['estado'];

const TIPO_CONFIG: Record<TipoActividad, { label: string; icon: React.ReactNode; color: string }> = {
  llamada:     { label: 'Llamada',     icon: <Phone className="size-3.5" />,        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  reunion:     { label: 'Reunión',     icon: <Users2 className="size-3.5" />,       color: 'bg-purple-100 text-purple-700 border-purple-200' },
  email:       { label: 'Email',       icon: <Mail className="size-3.5" />,         color: 'bg-green-100 text-green-700 border-green-200' },
  visita:      { label: 'Visita',      icon: <MapPin className="size-3.5" />,       color: 'bg-amber-100 text-amber-700 border-amber-200' },
  propuesta:   { label: 'Propuesta',   icon: <FileText className="size-3.5" />,     color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  seguimiento: { label: 'Seguimiento', icon: <ArrowRight className="size-3.5" />,   color: 'bg-slate-100 text-slate-700 border-slate-200' },
  otro:        { label: 'Otro',        icon: <CalendarClock className="size-3.5" />, color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function badgeTipo(tipo: TipoActividad) {
  const cfg = TIPO_CONFIG[tipo];
  return (
    <Badge className={`text-xs gap-1 ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}

function badgeEstado(estado: EstadoActividad) {
  const map: Record<EstadoActividad, { label: string; icon: React.ReactNode; className: string }> = {
    pendiente:  { label: 'Pendiente',  icon: <Clock className="size-3" />,        className: 'bg-amber-100 text-amber-700 border-amber-200' },
    realizada:  { label: 'Realizada',  icon: <CheckCircle2 className="size-3" />, className: 'bg-green-100 text-green-700 border-green-200' },
    cancelada:  { label: 'Cancelada',  icon: <XCircle className="size-3" />,      className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[estado];
  return <Badge className={`text-xs gap-1 ${cfg.className}`}>{cfg.icon}{cfg.label}</Badge>;
}

// ── Form ─────────────────────────────────────────────────────────────────────

type ActividadForm = {
  clienteDbId: string;
  clienteId: string;
  clienteNombre: string;
  oportunidadDbId?: string;
  oportunidadId?: string;
  oportunidadTitulo?: string;
  tipo: TipoActividad;
  estado: EstadoActividad;
  titulo: string;
  descripcion?: string;
  fechaProgramada: string;
  realizadoPor?: string;
};

const FORM_EMPTY: ActividadForm = {
  clienteDbId: '', clienteId: '', clienteNombre: '',
  tipo: 'llamada', estado: 'pendiente', titulo: '', fechaProgramada: '',
};

interface Props {
  onNavigate?: (route: string) => void;
}

export function CRMActividades({ onNavigate: _onNavigate }: Props) {
  const { clientes, oportunidades, actividades, crearActividad, completarActividad, loading } = useCRMStore();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // ── Dialog crear ─────────────────────────────────────────────────────────
  const [crearOpen, setCrearOpen] = useState(false);
  const [form, setForm] = useState<ActividadForm>(FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  // ── Dialog completar ─────────────────────────────────────────────────────
  const [completarOpen, setCompletarOpen] = useState(false);
  const [completandoId, setCompletandoId] = useState<string | null>(null);
  const [resultado, setResultado] = useState('');
  const [proximaAccion, setProximaAccion] = useState('');
  const [completando, setCompletando] = useState(false);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const pendientes = actividades.filter(a => a.estado === 'pendiente').length;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
  const realizadasHoy = actividades.filter(a => {
    if (a.estado !== 'realizada' || !a.fechaRealizada) return false;
    const d = new Date(a.fechaRealizada);
    return d >= hoy && d < manana;
  }).length;
  const total = actividades.length;
  const realizadas = actividades.filter(a => a.estado === 'realizada').length;
  const tasaCompletitud = total > 0 ? Math.round((realizadas / total) * 100) : 0;

  // ── Filtered ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...actividades];
    if (filtroTipo !== 'todos') list = list.filter(a => a.tipo === filtroTipo);
    if (filtroEstado !== 'todos') list = list.filter(a => a.estado === filtroEstado);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(a =>
        a.titulo.toLowerCase().includes(q) ||
        a.clienteNombre.toLowerCase().includes(q) ||
        (a.oportunidadTitulo?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [actividades, filtroTipo, filtroEstado, busqueda]);

  // ── Oportunidades filtradas por cliente ───────────────────────────────────
  const oportunidadesCliente = useMemo(() => {
    if (!form.clienteDbId) return [];
    return oportunidades.filter(o => o.clienteDbId === form.clienteDbId);
  }, [form.clienteDbId, oportunidades]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.titulo.trim()) { toast.error('El título es requerido'); return; }
    if (!form.clienteDbId) { toast.error('Selecciona un cliente'); return; }
    if (!form.fechaProgramada) { toast.error('La fecha programada es requerida'); return; }
    setSaving(true);
    try {
      await crearActividad(form);
      toast.success('Actividad creada');
      setCrearOpen(false);
      setForm(FORM_EMPTY);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const openCompletar = (a: ActividadCRM) => {
    setCompletandoId(a._dbId);
    setResultado('');
    setProximaAccion('');
    setCompletarOpen(true);
  };

  const handleCompletar = async () => {
    if (!completandoId || !resultado.trim()) { toast.error('Ingresa el resultado'); return; }
    setCompletando(true);
    const { exito } = await completarActividad(completandoId, resultado, proximaAccion || undefined);
    if (exito) toast.success('Actividad completada');
    else toast.error('No se pudo completar la actividad');
    setCompletarOpen(false);
    setCompletando(false);
  };

  const setField = (key: keyof ActividadForm, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleClienteSelect = (dbId: string) => {
    const c = clientes.find(c => c._dbId === dbId);
    if (c) setForm(prev => ({
      ...prev,
      clienteDbId: dbId, clienteId: c.id, clienteNombre: c.razonSocial,
      oportunidadDbId: undefined, oportunidadId: undefined, oportunidadTitulo: undefined,
    }));
  };

  const handleOpoSelect = (dbId: string) => {
    if (dbId === 'ninguna') {
      setForm(prev => ({ ...prev, oportunidadDbId: undefined, oportunidadId: undefined, oportunidadTitulo: undefined }));
      return;
    }
    const o = oportunidades.find(o => o._dbId === dbId);
    if (o) setForm(prev => ({ ...prev, oportunidadDbId: dbId, oportunidadId: o.id, oportunidadTitulo: o.titulo }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Actividades</h2>
          <p className="text-sm text-muted-foreground mt-1">Registro de llamadas, reuniones y seguimiento comercial</p>
        </div>
        <Button onClick={() => { setForm(FORM_EMPTY); setCrearOpen(true); }}>
          <Plus className="size-4 mr-2" /> Nueva Actividad
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendientes', value: pendientes, sub: 'por realizar', color: 'text-amber-600' },
          { label: 'Realizadas Hoy', value: realizadasHoy, sub: 'completadas hoy', color: 'text-green-600' },
          { label: 'Total Actividades', value: total, sub: 'historial completo', color: '' },
          { label: 'Tasa Completitud', value: `${tasaCompletitud}%`, sub: 'del total registrado', color: '' },
        ].map(k => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-8" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="llamada">Llamada</SelectItem>
            <SelectItem value="reunion">Reunión</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="visita">Visita</SelectItem>
            <SelectItem value="propuesta">Propuesta</SelectItem>
            <SelectItem value="seguimiento">Seguimiento</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando actividades...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {actividades.length === 0 ? 'No hay actividades registradas' : 'Sin resultados'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Oportunidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Programada</TableHead>
                  <TableHead>Realizado por</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const fecha = new Date(a.fechaProgramada);
                  const esVencida = a.estado === 'pendiente' && fecha < hoy;
                  return (
                    <TableRow key={a._dbId} className={`hover:bg-muted/30 ${esVencida ? 'bg-red-50/30' : ''}`}>
                      <TableCell>{badgeTipo(a.tipo)}</TableCell>
                      <TableCell className="font-medium text-sm max-w-48 truncate">{a.titulo}</TableCell>
                      <TableCell className="text-sm">{a.clienteNombre}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                        {a.oportunidadTitulo ?? '—'}
                      </TableCell>
                      <TableCell>{badgeEstado(a.estado)}</TableCell>
                      <TableCell className={`text-xs ${esVencida ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {esVencida && ' ⚠'}
                      </TableCell>
                      <TableCell className="text-xs">{a.realizadoPor ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {a.estado === 'pendiente' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openCompletar(a)}>
                            <CheckCircle2 className="size-3 mr-1" /> Completar
                          </Button>
                        )}
                        {a.estado === 'realizada' && a.resultado && (
                          <span className="text-xs text-muted-foreground italic truncate max-w-32 block">{a.resultado}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear Actividad */}
      <Dialog open={crearOpen} onOpenChange={setCrearOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Actividad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
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
            {form.clienteDbId && oportunidadesCliente.length > 0 && (
              <div className="space-y-1.5">
                <Label>Oportunidad (opcional)</Label>
                <Select value={form.oportunidadDbId ?? 'ninguna'} onValueChange={handleOpoSelect}>
                  <SelectTrigger><SelectValue placeholder="Sin oportunidad" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin oportunidad</SelectItem>
                    {oportunidadesCliente.map(o => (
                      <SelectItem key={o._dbId} value={o._dbId}>{o.titulo} ({o.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setField('tipo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llamada">Llamada</SelectItem>
                    <SelectItem value="reunion">Reunión</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="visita">Visita</SelectItem>
                    <SelectItem value="propuesta">Propuesta</SelectItem>
                    <SelectItem value="seguimiento">Seguimiento</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado *</Label>
                <Select value={form.estado} onValueChange={v => setField('estado', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="realizada">Realizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setField('titulo', e.target.value)} placeholder="Descripción breve de la actividad" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion ?? ''} onChange={e => setField('descripcion', e.target.value || undefined)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha Programada *</Label>
                <Input
                  type="datetime-local"
                  value={form.fechaProgramada}
                  onChange={e => setField('fechaProgramada', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Realizado por</Label>
                <Input value={form.realizadoPor ?? ''} onChange={e => setField('realizadoPor', e.target.value || undefined)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCrearOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Actividad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Completar Actividad */}
      <Dialog open={completarOpen} onOpenChange={setCompletarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Completar Actividad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Resultado *</Label>
              <Textarea
                rows={3}
                placeholder="Describe el resultado de la actividad..."
                value={resultado}
                onChange={e => setResultado(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Próxima Acción (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="¿Qué se debe hacer a continuación?"
                value={proximaAccion}
                onChange={e => setProximaAccion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletarOpen(false)}>Cancelar</Button>
            <Button onClick={handleCompletar} disabled={completando || !resultado.trim()}>
              {completando ? 'Completando...' : 'Marcar como Realizada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
