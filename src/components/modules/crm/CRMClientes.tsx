/**
 * CRM Clientes — Lista, filtros, KPIs, CRUD completo
 */

import { useState, useMemo } from 'react';
import {
  Plus, Search, Eye, Pencil, Users, Building2, User, Landmark, Heart,
  ChevronRight, CheckCircle2, Target, Award,
} from 'lucide-react';
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
import { useCRMStore, type Cliente } from '../../../lib/crm/crm-store';
import { toast } from 'sonner';

// ── Helpers ─────────────────────────────────────────────────────────────────

function badgeEstado(estado: Cliente['estado']) {
  const map: Record<Cliente['estado'], { label: string; className: string }> = {
    activo:    { label: 'Activo',    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' },
    inactivo:  { label: 'Inactivo',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
    prospecto: { label: 'Prospecto', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
    perdido:   { label: 'Perdido',   className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  };
  const cfg = map[estado] ?? map.activo;
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function badgeTipo(tipo: Cliente['tipo']) {
  const icons: Record<Cliente['tipo'], React.ReactNode> = {
    empresa:         <Building2 className="size-3" />,
    persona_natural: <User className="size-3" />,
    gobierno:        <Landmark className="size-3" />,
    ong:             <Heart className="size-3" />,
  };
  const labels: Record<Cliente['tipo'], string> = {
    empresa: 'Empresa', persona_natural: 'Persona Natural', gobierno: 'Gobierno', ong: 'ONG',
  };
  return (
    <Badge variant="outline" className="text-xs gap-1">
      {icons[tipo]}{labels[tipo]}
    </Badge>
  );
}

function badgeCategoria(cat?: 'A' | 'B' | 'C') {
  if (!cat) return null;
  const colors = { A: 'bg-amber-100 text-amber-700 border-amber-200', B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200', C: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <Badge className={`text-xs font-bold ${colors[cat]}`}>{cat}</Badge>;
}

// ── Form inicial ─────────────────────────────────────────────────────────────

type ClienteForm = Omit<Cliente, '_dbId' | 'id' | 'creadoEn' | 'oportunidadesActivas'>;

const FORM_EMPTY: ClienteForm = {
  razonSocial: '', tipo: 'empresa', estado: 'activo', moneda: 'PEN',
};

interface Props {
  onNavigate?: (route: string) => void;
}

export function CRMClientes({ onNavigate }: Props) {
  const { clientes, oportunidades, actividades, crearCliente, actualizarCliente, loading } = useCRMStore();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'crear' | 'editar'>('crear');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClienteForm>(FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalActivos = clientes.filter(c => c.estado === 'activo').length;
  const totalProspectos = clientes.filter(c => c.estado === 'prospecto').length;
  const catA = clientes.filter(c => c.categoria === 'A').length;
  const catB = clientes.filter(c => c.categoria === 'B').length;

  // ── Filtered ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...clientes];
    if (filtroEstado !== 'todos') list = list.filter(c => c.estado === filtroEstado);
    if (filtroTipo !== 'todos') list = list.filter(c => c.tipo === filtroTipo);
    if (filtroCategoria !== 'todos') list = list.filter(c => c.categoria === filtroCategoria);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(c =>
        c.razonSocial.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.contactoNombre?.toLowerCase().includes(q)) ||
        (c.ruc?.includes(q))
      );
    }
    return list;
  }, [clientes, filtroEstado, filtroTipo, filtroCategoria, busqueda]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openCrear = () => {
    setForm(FORM_EMPTY);
    setDialogMode('crear');
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditar = (c: Cliente) => {
    setForm({
      razonSocial: c.razonSocial, nombreComercial: c.nombreComercial,
      tipo: c.tipo, sector: c.sector, estado: c.estado,
      contactoNombre: c.contactoNombre, contactoCargo: c.contactoCargo,
      contactoTelefono: c.contactoTelefono, contactoEmail: c.contactoEmail,
      departamento: c.departamento, provincia: c.provincia,
      distrito: c.distrito, direccion: c.direccion,
      ruc: c.ruc, creditoLimite: c.creditoLimite, creditoDias: c.creditoDias,
      moneda: c.moneda, categoria: c.categoria, origen: c.origen,
      descripcion: c.descripcion, observaciones: c.observaciones,
      ejecutivoCuenta: c.ejecutivoCuenta,
    });
    setEditingId(c._dbId);
    setDialogMode('editar');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.razonSocial.trim()) { toast.error('La razón social es obligatoria'); return; }
    if (form.tipo === 'empresa' && form.ruc && !/^\d{11}$/.test(form.ruc)) { toast.error('El RUC debe tener 11 dígitos'); return; }
    setSaving(true);
    try {
      if (dialogMode === 'crear') {
        await crearCliente(form);
        toast.success('Cliente creado correctamente');
      } else if (editingId) {
        const { exito } = await actualizarCliente(editingId, form);
        if (exito) toast.success('Cliente actualizado');
        else toast.error('Error al actualizar cliente');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const openDetalle = (c: Cliente) => { setClienteDetalle(c); setDetalleOpen(true); };

  const setField = (key: keyof ClienteForm, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Clientes</h2>
            <p className="text-sm text-muted-foreground mt-1">Directorio y gestión de cuentas de clientes</p>
          </div>
        </div>
        <Button onClick={openCrear}>
          <Plus className="size-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Clientes', value: clientes.length, sub: 'registrados', icon: Users, box: 'bg-blue-500' },
          { label: 'Activos', value: totalActivos, sub: 'en operación', icon: CheckCircle2, box: 'bg-green-500' },
          { label: 'Prospectos', value: totalProspectos, sub: 'por convertir', icon: Target, box: 'bg-amber-500' },
          { label: 'Cat. A / B', value: `${catA} / ${catB}`, sub: 'clientes premium', icon: Award, box: 'bg-purple-500' },
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
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="prospecto">Prospecto</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="empresa">Empresa</SelectItem>
            <SelectItem value="persona_natural">Persona Natural</SelectItem>
            <SelectItem value="gobierno">Gobierno</SelectItem>
            <SelectItem value="ong">ONG</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="A">Categoría A</SelectItem>
            <SelectItem value="B">Categoría B</SelectItem>
            <SelectItem value="C">Categoría C</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando clientes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {clientes.length === 0 ? 'No hay clientes registrados' : 'Sin resultados para los filtros aplicados'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Razón Social</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cat.</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Ejecutivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c._dbId} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{c.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.razonSocial}</p>
                        {c.nombreComercial && <p className="text-xs text-muted-foreground">{c.nombreComercial}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{badgeTipo(c.tipo)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.sector ?? '—'}</TableCell>
                    <TableCell>{badgeEstado(c.estado)}</TableCell>
                    <TableCell>{badgeCategoria(c.categoria) ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {c.contactoNombre ? (
                        <div>
                          <p className="text-sm">{c.contactoNombre}</p>
                          {c.contactoEmail && <p className="text-xs text-muted-foreground">{c.contactoEmail}</p>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{c.ejecutivoCuenta ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetalle(c)} className="hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground">
                          <Eye className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditar(c)} className="hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground">
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
            <DialogTitle>{dialogMode === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Razón Social *</Label>
              <Input value={form.razonSocial ?? ''} onChange={e => setField('razonSocial', e.target.value)} placeholder="Nombre legal completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre Comercial</Label>
              <Input value={form.nombreComercial ?? ''} onChange={e => setField('nombreComercial', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>RUC / DNI</Label>
              <Input value={form.ruc ?? ''} onChange={e => setField('ruc', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setField('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="persona_natural">Persona Natural</SelectItem>
                  <SelectItem value="gobierno">Gobierno</SelectItem>
                  <SelectItem value="ong">ONG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <Select value={form.estado} onValueChange={v => setField('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sector</Label>
              <Input value={form.sector ?? ''} onChange={e => setField('sector', e.target.value)} placeholder="ej: minería, salud, construcción" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.categoria ?? 'ninguna'} onValueChange={v => setField('categoria', v === 'ninguna' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Sin categoría</SelectItem>
                  <SelectItem value="A">A — Premium</SelectItem>
                  <SelectItem value="B">B — Estándar</SelectItem>
                  <SelectItem value="C">C — Básico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="col-span-2" />
            <div className="col-span-2 text-sm font-medium text-muted-foreground">Contacto Principal</div>

            <div className="space-y-1.5">
              <Label>Nombre del Contacto</Label>
              <Input value={form.contactoNombre ?? ''} onChange={e => setField('contactoNombre', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={form.contactoCargo ?? ''} onChange={e => setField('contactoCargo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.contactoTelefono ?? ''} onChange={e => setField('contactoTelefono', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.contactoEmail ?? ''} onChange={e => setField('contactoEmail', e.target.value)} />
            </div>

            <Separator className="col-span-2" />
            <div className="col-span-2 text-sm font-medium text-muted-foreground">Ubicación</div>

            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Input value={form.departamento ?? ''} onChange={e => setField('departamento', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Provincia</Label>
              <Input value={form.provincia ?? ''} onChange={e => setField('provincia', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.direccion ?? ''} onChange={e => setField('direccion', e.target.value)} />
            </div>

            <Separator className="col-span-2" />
            <div className="col-span-2 text-sm font-medium text-muted-foreground">Comercial</div>

            <div className="space-y-1.5">
              <Label>Ejecutivo de Cuenta</Label>
              <Input value={form.ejecutivoCuenta ?? ''} onChange={e => setField('ejecutivoCuenta', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <Input value={form.origen ?? ''} onChange={e => setField('origen', e.target.value)} placeholder="referido, web, evento..." />
            </div>
            <div className="space-y-1.5">
              <Label>Crédito Límite (S/)</Label>
              <Input type="number" value={form.creditoLimite ?? ''} onChange={e => setField('creditoLimite', e.target.value ? +e.target.value : undefined)} />
            </div>
            <div className="space-y-1.5">
              <Label>Días de Crédito</Label>
              <Input type="number" value={form.creditoDias ?? ''} onChange={e => setField('creditoDias', e.target.value ? +e.target.value : undefined)} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion ?? ''} onChange={e => setField('descripcion', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea rows={2} value={form.observaciones ?? ''} onChange={e => setField('observaciones', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando...' : dialogMode === 'crear' ? 'Crear Cliente' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {clienteDetalle && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{clienteDetalle.id}</span>
                    <span>{clienteDetalle.razonSocial}</span>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2">
                  {badgeEstado(clienteDetalle.estado)}
                  {badgeTipo(clienteDetalle.tipo)}
                  {badgeCategoria(clienteDetalle.categoria)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {clienteDetalle.ruc && <div><p className="text-xs text-muted-foreground">RUC</p><p className="font-medium">{clienteDetalle.ruc}</p></div>}
                  {clienteDetalle.sector && <div><p className="text-xs text-muted-foreground">Sector</p><p>{clienteDetalle.sector}</p></div>}
                  {clienteDetalle.ejecutivoCuenta && <div><p className="text-xs text-muted-foreground">Ejecutivo</p><p>{clienteDetalle.ejecutivoCuenta}</p></div>}
                  {clienteDetalle.origen && <div><p className="text-xs text-muted-foreground">Origen</p><p>{clienteDetalle.origen}</p></div>}
                  {clienteDetalle.contactoNombre && <div><p className="text-xs text-muted-foreground">Contacto</p><p>{clienteDetalle.contactoNombre} {clienteDetalle.contactoCargo ? `— ${clienteDetalle.contactoCargo}` : ''}</p></div>}
                  {clienteDetalle.contactoEmail && <div><p className="text-xs text-muted-foreground">Email</p><p>{clienteDetalle.contactoEmail}</p></div>}
                  {clienteDetalle.contactoTelefono && <div><p className="text-xs text-muted-foreground">Teléfono</p><p>{clienteDetalle.contactoTelefono}</p></div>}
                  {clienteDetalle.direccion && <div className="col-span-2"><p className="text-xs text-muted-foreground">Dirección</p><p>{[clienteDetalle.direccion, clienteDetalle.distrito, clienteDetalle.provincia, clienteDetalle.departamento].filter(Boolean).join(', ')}</p></div>}
                  {clienteDetalle.creditoLimite !== undefined && <div><p className="text-xs text-muted-foreground">Crédito Límite</p><p>S/ {clienteDetalle.creditoLimite.toLocaleString()} / {clienteDetalle.creditoDias ?? 30} días</p></div>}
                </div>
                {clienteDetalle.descripcion && (
                  <div><p className="text-xs text-muted-foreground font-medium mb-1">Descripción</p><p className="text-sm">{clienteDetalle.descripcion}</p></div>
                )}

                <Separator />
                <div>
                  <p className="font-medium text-sm mb-2">Oportunidades asociadas ({oportunidades.filter(o => o.clienteDbId === clienteDetalle._dbId).length})</p>
                  {oportunidades.filter(o => o.clienteDbId === clienteDetalle._dbId).slice(0, 5).map(o => (
                    <div key={o._dbId} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                      <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                      <span className="flex-1 px-2 truncate">{o.titulo}</span>
                      <Badge className="text-xs">{o.etapa}</Badge>
                    </div>
                  ))}
                  {oportunidades.filter(o => o.clienteDbId === clienteDetalle._dbId).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin oportunidades</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground"
                    onClick={() => { setDetalleOpen(false); onNavigate?.('/crm/oportunidades'); }}
                  >
                    Ver oportunidades <ChevronRight className="size-3 ml-1" />
                  </Button>
                </div>

                <Separator />
                <div>
                  <p className="font-medium text-sm mb-2">Actividades recientes ({actividades.filter(a => a.clienteDbId === clienteDetalle._dbId).length})</p>
                  {actividades.filter(a => a.clienteDbId === clienteDetalle._dbId).slice(0, 5).map(a => (
                    <div key={a._dbId} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                      <span className="text-xs capitalize text-muted-foreground w-20">{a.tipo}</span>
                      <span className="flex-1 px-2 truncate">{a.titulo}</span>
                      <Badge variant="outline" className="text-xs">{a.estado}</Badge>
                    </div>
                  ))}
                  {actividades.filter(a => a.clienteDbId === clienteDetalle._dbId).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin actividades</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetalleOpen(false)} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cerrar</Button>
                <Button onClick={() => { setDetalleOpen(false); openEditar(clienteDetalle); }}>
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
