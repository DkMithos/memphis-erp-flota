/**
 * TALLERES — Red de Talleres Autorizados
 * Vista en cards, filtros, KPIs, creación y gestión
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Wrench,
  MapPin,
  Phone,
  Mail,
  Clock,
  Eye,
  Trash2,
  X,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Separator } from '../../ui/separator';
import { useTalleresStore, type TallerFrontend, type NuevoTallerInput } from '../../../lib/proveedores/talleres-store';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { toast } from 'sonner';

// ── Badge helpers ──────────────────────────────────────────────────────────────

function badgeEstado(estado: TallerFrontend['estado']) {
  const map: Record<TallerFrontend['estado'], { label: string; className: string }> = {
    activo: { label: 'Activo', className: 'bg-green-100 text-green-700 border-green-200' },
    inactivo: { label: 'Inactivo', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    suspendido: { label: 'Suspendido', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[estado];
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

const tipoLabels: Record<TallerFrontend['tipo'], string> = {
  mecanico: 'Mecánico',
  electrico: 'Eléctrico',
  carroceria: 'Carrocería',
  neumaticos: 'Neumáticos',
  aire_acondicionado: 'Aire Acond.',
  general: 'General',
  especializado: 'Especializado',
};

function badgeTipo(tipo: TallerFrontend['tipo']) {
  return <Badge variant="secondary" className="text-xs">{tipoLabels[tipo]}</Badge>;
}

// ── Tag input helper ──────────────────────────────────────────────────────────

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>Agregar</Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 bg-muted text-sm px-2 py-0.5 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter(t => t !== tag))}
                className="hover:text-red-500"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  nombre: string;
  tipo: NuevoTallerInput['tipo'];
  proveedorDbId: string;
  proveedorId: string;
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  especialidades: string[];
  marcasAutorizadas: string[];
  horarioAtencion: string;
  tiempoRespuestaHoras: string;
  moneda: string;
  condicionesPago: string;
  observaciones: string;
}

const formVacio: FormState = {
  nombre: '',
  tipo: 'general',
  proveedorDbId: '',
  proveedorId: '',
  contactoNombre: '',
  contactoTelefono: '',
  contactoEmail: '',
  departamento: '',
  provincia: '',
  distrito: '',
  direccion: '',
  especialidades: [],
  marcasAutorizadas: [],
  horarioAtencion: '',
  tiempoRespuestaHoras: '',
  moneda: 'PEN',
  condicionesPago: '',
  observaciones: '',
};

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
}

export function ProveedoresTalleres({ onNavigate: _onNavigate }: Props) {
  const { talleres, loading, crearTaller, cambiarEstado, eliminarTaller } = useTalleresStore();
  const { proveedores } = useProveedorStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroDpto, setFiltroDpto] = useState('');

  const [dialogNuevo, setDialogNuevo] = useState(false);
  const [dialogDetalle, setDialogDetalle] = useState<TallerFrontend | null>(null);
  const [form, setForm] = useState<FormState>(formVacio);
  const [guardando, setGuardando] = useState(false);

  // ── Filtrado ────────────────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    return talleres.filter(t => {
      if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;
      if (filtroEstado !== 'todos' && t.estado !== filtroEstado) return false;
      if (filtroDpto && !t.departamento?.toLowerCase().includes(filtroDpto.toLowerCase())) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !t.nombre.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [talleres, filtroTipo, filtroEstado, filtroDpto, busqueda]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const activos = talleres.filter(t => t.estado === 'activo').length;
    const porTipo = Object.entries(
      talleres.reduce((acc, t) => {
        acc[t.tipo] = (acc[t.tipo] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]);
    return { activos, porTipo };
  }, [talleres]);

  // ── Acciones ────────────────────────────────────────────────────────────────

  const handleGuardar = async () => {
    if (!form.nombre) {
      toast.error('El nombre del taller es obligatorio');
      return;
    }
    setGuardando(true);
    try {
      await crearTaller({
        nombre: form.nombre,
        tipo: form.tipo,
        proveedorId: form.proveedorId || undefined,
        proveedorDbId: form.proveedorDbId || undefined,
        contactoNombre: form.contactoNombre || undefined,
        contactoTelefono: form.contactoTelefono || undefined,
        contactoEmail: form.contactoEmail || undefined,
        departamento: form.departamento || undefined,
        provincia: form.provincia || undefined,
        distrito: form.distrito || undefined,
        direccion: form.direccion || undefined,
        especialidades: form.especialidades,
        marcasAutorizadas: form.marcasAutorizadas,
        horarioAtencion: form.horarioAtencion || undefined,
        tiempoRespuestaHoras: form.tiempoRespuestaHoras ? parseInt(form.tiempoRespuestaHoras, 10) : undefined,
        moneda: form.moneda,
        condicionesPago: form.condicionesPago || undefined,
        observaciones: form.observaciones || undefined,
      });
      toast.success('Taller creado correctamente');
      setDialogNuevo(false);
      setForm(formVacio);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Error al crear taller');
    } finally {
      setGuardando(false);
    }
  };

  const handleCambiarEstado = async (taller: TallerFrontend, estado: TallerFrontend['estado']) => {
    const { exito, errores } = await cambiarEstado(taller._dbId, estado);
    if (exito) toast.success(`Estado actualizado a ${estado}`);
    else toast.error(errores?.[0] ?? 'Error');
    setDialogDetalle(null);
  };

  const handleEliminar = async (dbId: string) => {
    const { exito, errores } = await eliminarTaller(dbId);
    if (exito) toast.success('Taller eliminado');
    else toast.error(errores?.[0] ?? 'Error al eliminar');
    setDialogDetalle(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Red de Talleres</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Talleres autorizados y especializados en la red de servicio
          </p>
        </div>
        <Button onClick={() => setDialogNuevo(true)}>
          <Plus className="size-4 mr-2" />
          Nuevo Taller
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Talleres activos</p>
              <p className="text-2xl font-bold">{kpis.activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1 sm:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Por tipo</p>
            <div className="flex flex-wrap gap-2">
              {kpis.porTipo.slice(0, 6).map(([tipo, cnt]) => (
                <span key={tipo} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                  <span className="font-medium">{tipoLabels[tipo as TallerFrontend['tipo']] ?? tipo}</span>
                  <span className="text-muted-foreground">({cnt})</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código..."
            className="pl-9"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="mecanico">Mecánico</SelectItem>
            <SelectItem value="electrico">Eléctrico</SelectItem>
            <SelectItem value="carroceria">Carrocería</SelectItem>
            <SelectItem value="neumaticos">Neumáticos</SelectItem>
            <SelectItem value="aire_acondicionado">Aire Acond.</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="especializado">Especializado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
            <SelectItem value="suspendido">Suspendido</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Departamento..."
          className="w-full sm:w-44"
          value={filtroDpto}
          onChange={e => setFiltroDpto(e.target.value)}
        />
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Cargando talleres...</div>
      ) : filtrados.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No hay talleres que mostrar.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(taller => (
            <Card key={taller._dbId} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-tight">{taller.nombre}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{taller.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {badgeTipo(taller.tipo)}
                    {badgeEstado(taller.estado)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {(taller.departamento || taller.direccion) && (
                  <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-1">
                      {[taller.distrito, taller.departamento].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {taller.contactoTelefono && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    <span>{taller.contactoTelefono}</span>
                  </div>
                )}
                {taller.contactoEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{taller.contactoEmail}</span>
                  </div>
                )}
                {taller.tiempoRespuestaHoras !== undefined && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    <span>Resp. {taller.tiempoRespuestaHoras}h</span>
                  </div>
                )}

                {/* Especialidades */}
                {taller.especialidades.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {taller.especialidades.slice(0, 3).map(esp => (
                      <span key={esp} className="text-xs bg-muted px-1.5 py-0.5 rounded">{esp}</span>
                    ))}
                    {taller.especialidades.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{taller.especialidades.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Proveedor asociado */}
                {taller.proveedorNombre && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2 mt-2">
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate">{taller.proveedorNombre}</span>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogDetalle(taller)}
                  >
                    <Eye className="size-3.5 mr-1.5" />
                    Ver detalle
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-red-500 hover:text-red-700"
                    onClick={() => handleEliminar(taller._dbId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog nuevo taller */}
      <Dialog open={dialogNuevo} onOpenChange={open => { setDialogNuevo(open); if (!open) setForm(formVacio); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Taller</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Básico */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Nombre <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Nombre del taller"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={v => setForm(f => ({ ...f, tipo: v as FormState['tipo'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mecanico">Mecánico</SelectItem>
                    <SelectItem value="electrico">Eléctrico</SelectItem>
                    <SelectItem value="carroceria">Carrocería</SelectItem>
                    <SelectItem value="neumaticos">Neumáticos</SelectItem>
                    <SelectItem value="aire_acondicionado">Aire Acondicionado</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="especializado">Especializado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Proveedor asociado (opcional) */}
            <div className="space-y-1.5">
              <Label>Proveedor asociado (opcional)</Label>
              <Select
                value={form.proveedorDbId || '_none'}
                onValueChange={v => {
                  if (v === '_none') {
                    setForm(f => ({ ...f, proveedorDbId: '', proveedorId: '' }));
                  } else {
                    const prov = proveedores.find(p => p._dbId === v);
                    setForm(f => ({ ...f, proveedorDbId: v, proveedorId: prov?.id ?? '' }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin proveedor asociado</SelectItem>
                  {proveedores.filter(p => p.estado === 'activo').map(p => (
                    <SelectItem key={p._dbId} value={p._dbId}>
                      {p.razonSocial} — {p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Contacto */}
            <p className="text-sm font-medium">Contacto</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre contacto</Label>
                <Input
                  placeholder="Persona de contacto"
                  value={form.contactoNombre}
                  onChange={e => setForm(f => ({ ...f, contactoNombre: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  placeholder="(01) 000-0000"
                  value={form.contactoTelefono}
                  onChange={e => setForm(f => ({ ...f, contactoTelefono: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="correo@taller.com"
                  value={form.contactoEmail}
                  onChange={e => setForm(f => ({ ...f, contactoEmail: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            {/* Ubicación */}
            <p className="text-sm font-medium">Ubicación</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Input
                  placeholder="Lima"
                  value={form.departamento}
                  onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Provincia</Label>
                <Input
                  placeholder="Lima"
                  value={form.provincia}
                  onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Distrito</Label>
                <Input
                  placeholder="Miraflores"
                  value={form.distrito}
                  onChange={e => setForm(f => ({ ...f, distrito: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input
                placeholder="Av. Ejemplo 123"
                value={form.direccion}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Capacidades */}
            <p className="text-sm font-medium">Capacidades</p>
            <div className="space-y-1.5">
              <Label>Especialidades</Label>
              <TagInput
                tags={form.especialidades}
                onChange={v => setForm(f => ({ ...f, especialidades: v }))}
                placeholder="Ej: Frenos, Transmisión..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marcas autorizadas</Label>
              <TagInput
                tags={form.marcasAutorizadas}
                onChange={v => setForm(f => ({ ...f, marcasAutorizadas: v }))}
                placeholder="Ej: Toyota, Ford..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Horario de atención</Label>
                <Input
                  placeholder="Lun–Vie 8am–6pm"
                  value={form.horarioAtencion}
                  onChange={e => setForm(f => ({ ...f, horarioAtencion: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tiempo respuesta (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="24"
                  value={form.tiempoRespuestaHoras}
                  onChange={e => setForm(f => ({ ...f, tiempoRespuestaHoras: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            {/* Financiero */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select
                  value={form.moneda}
                  onValueChange={v => setForm(f => ({ ...f, moneda: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">PEN (Soles)</SelectItem>
                    <SelectItem value="USD">USD (Dólares)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condiciones de pago</Label>
                <Input
                  placeholder="Ej: Crédito 30 días"
                  value={form.condicionesPago}
                  onChange={e => setForm(f => ({ ...f, condicionesPago: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNuevo(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Crear Taller'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle */}
      {dialogDetalle && (
        <Dialog open={!!dialogDetalle} onOpenChange={open => { if (!open) setDialogDetalle(null); }}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogDetalle.nombre}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {badgeTipo(dialogDetalle.tipo)}
                {badgeEstado(dialogDetalle.estado)}
                <span className="text-xs font-mono text-muted-foreground self-center">{dialogDetalle.id}</span>
              </div>

              {/* Ubicación */}
              {(dialogDetalle.departamento || dialogDetalle.direccion) && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="text-xs text-muted-foreground font-medium">Ubicación</p>
                  {dialogDetalle.direccion && <p>{dialogDetalle.direccion}</p>}
                  <p className="text-muted-foreground">
                    {[dialogDetalle.distrito, dialogDetalle.provincia, dialogDetalle.departamento]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}

              {/* Contacto */}
              {(dialogDetalle.contactoNombre || dialogDetalle.contactoTelefono || dialogDetalle.contactoEmail) && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Contacto</p>
                  {dialogDetalle.contactoNombre && (
                    <p className="text-sm font-medium">{dialogDetalle.contactoNombre}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {dialogDetalle.contactoTelefono && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5" />{dialogDetalle.contactoTelefono}
                      </span>
                    )}
                    {dialogDetalle.contactoEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3.5" />{dialogDetalle.contactoEmail}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Horario / Respuesta */}
              {(dialogDetalle.horarioAtencion || dialogDetalle.tiempoRespuestaHoras !== undefined) && (
                <div className="flex gap-6 text-sm">
                  {dialogDetalle.horarioAtencion && (
                    <div>
                      <p className="text-xs text-muted-foreground">Horario</p>
                      <p>{dialogDetalle.horarioAtencion}</p>
                    </div>
                  )}
                  {dialogDetalle.tiempoRespuestaHoras !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Tiempo respuesta</p>
                      <p>{dialogDetalle.tiempoRespuestaHoras}h</p>
                    </div>
                  )}
                </div>
              )}

              {/* Especialidades */}
              {dialogDetalle.especialidades.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Especialidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dialogDetalle.especialidades.map(e => (
                      <span key={e} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Marcas */}
              {dialogDetalle.marcasAutorizadas.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Marcas autorizadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dialogDetalle.marcasAutorizadas.map(m => (
                      <span key={m} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Proveedor */}
              {dialogDetalle.proveedorNombre && (
                <div>
                  <p className="text-xs text-muted-foreground">Proveedor asociado</p>
                  <p className="text-sm mt-0.5">{dialogDetalle.proveedorNombre} ({dialogDetalle.proveedorId})</p>
                </div>
              )}

              {dialogDetalle.observaciones && (
                <div>
                  <Separator />
                  <p className="text-xs text-muted-foreground mt-3">Observaciones</p>
                  <p className="text-sm mt-1">{dialogDetalle.observaciones}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-wrap gap-2 mt-4">
              {dialogDetalle.estado !== 'activo' && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleCambiarEstado(dialogDetalle, 'activo')}
                >
                  Activar
                </Button>
              )}
              {dialogDetalle.estado === 'activo' && (
                <Button
                  variant="outline"
                  className="text-orange-600 border-orange-200"
                  onClick={() => handleCambiarEstado(dialogDetalle, 'suspendido')}
                >
                  Suspender
                </Button>
              )}
              {dialogDetalle.estado !== 'inactivo' && (
                <Button
                  variant="outline"
                  onClick={() => handleCambiarEstado(dialogDetalle, 'inactivo')}
                >
                  Desactivar
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-red-500"
                onClick={() => handleEliminar(dialogDetalle._dbId)}
              >
                <Trash2 className="size-4 mr-2" />
                Eliminar
              </Button>
              <Button variant="ghost" onClick={() => setDialogDetalle(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
