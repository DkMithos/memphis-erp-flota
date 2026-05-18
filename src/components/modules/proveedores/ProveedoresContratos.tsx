/**
 * CONTRATOS DE PROVEEDORES
 * Lista, filtros, KPIs, alertas de vencimiento, creación y gestión
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Handshake,
  AlertTriangle,
  DollarSign,
  CalendarDays,
  Eye,
  Trash2,
  RefreshCw,
  XCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
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
import { useContratosStore, type Contrato, type NuevoContratoInput } from '../../../lib/proveedores/contratos-store';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { convertirAMonedaBase, formatMontoBase } from '../../../lib/shared/currency-utils';
import { toast } from 'sonner';

// ── Badge helpers ──────────────────────────────────────────────────────────────

function badgeEstado(estado: Contrato['estado'], diasRestantes?: number) {
  // Override: activo pero ya venció
  if (estado === 'activo' && diasRestantes !== undefined && diasRestantes < 0) {
    return <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">Vencido</Badge>;
  }
  const map: Record<Contrato['estado'], { label: string; className: string }> = {
    borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    activo: { label: 'Activo', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' },
    vencido: { label: 'Vencido', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
    rescindido: { label: 'Rescindido', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200' },
    renovacion: { label: 'En renovación', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
  };
  const cfg = map[estado] ?? map.borrador;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function badgeTipo(tipo: Contrato['tipo']) {
  const label: Record<Contrato['tipo'], string> = {
    servicio: 'Servicio',
    suministro: 'Suministro',
    mantenimiento: 'Mantenimiento',
    consultoria: 'Consultoría',
    otro: 'Otro',
  };
  return <Badge variant="secondary" className="text-xs">{label[tipo]}</Badge>;
}

function diasRestantesCell(dias?: number) {
  if (dias === undefined) return <span className="text-muted-foreground text-sm">—</span>;
  if (dias < 0) return <span className="text-red-600 font-semibold text-sm">{Math.abs(dias)}d vencido</span>;
  if (dias <= 30) return <span className="text-yellow-600 font-semibold text-sm">{dias}d restantes</span>;
  return <span className="text-muted-foreground text-sm">{dias}d restantes</span>;
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  proveedorDbId: string;
  proveedorId: string;
  tipo: NuevoContratoInput['tipo'];
  descripcion: string;
  montoTotal: string;
  moneda: string;
  fechaInicio: string;
  fechaFin: string;
  fechaFirma: string;
  condicionesPago: string;
  penalidades: string;
  urlDocumento: string;
  observaciones: string;
}

const formVacio: FormState = {
  proveedorDbId: '',
  proveedorId: '',
  tipo: 'servicio',
  descripcion: '',
  montoTotal: '',
  moneda: 'PEN',
  fechaInicio: '',
  fechaFin: '',
  fechaFirma: '',
  condicionesPago: '',
  penalidades: '',
  urlDocumento: '',
  observaciones: '',
};

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
}

export function ProveedoresContratos({ onNavigate: _onNavigate }: Props) {
  const { contratos, loading, crearContrato, cambiarEstado, eliminarContrato } = useContratosStore();
  const { proveedores } = useProveedorStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  const [dialogNuevo, setDialogNuevo] = useState(false);
  const [dialogDetalle, setDialogDetalle] = useState<Contrato | null>(null);
  const [dialogRenovar, setDialogRenovar] = useState<Contrato | null>(null);
  const [nuevaFechaFin, setNuevaFechaFin] = useState('');
  const [form, setForm] = useState<FormState>(formVacio);
  const [guardando, setGuardando] = useState(false);

  // ── Alertas: contratos que vencen pronto ────────────────────────────────────

  const alertasPorVencer = useMemo(() => {
    return contratos.filter(
      c => c.estado === 'activo' && c.diasRestantes !== undefined && c.diasRestantes >= 0 && c.diasRestantes <= 30
    );
  }, [contratos]);

  // ── Filtrado ────────────────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    return contratos.filter(c => {
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !c.proveedorNombre.toLowerCase().includes(q) &&
          !c.proveedorId.toLowerCase().includes(q) &&
          !c.id.toLowerCase().includes(q) &&
          !c.descripcion.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [contratos, filtroEstado, filtroTipo, busqueda]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const activos = contratos.filter(c => c.estado === 'activo' && !c.estaVencido);
    const montoActivos = activos.reduce((acc, c) => acc + convertirAMonedaBase(c.montoTotal ?? 0, c.moneda), 0);
    const porVencer = alertasPorVencer.length;
    return { activos: activos.length, porVencer, montoActivos };
  }, [contratos, alertasPorVencer]);

  const formatMonto = (monto: number, moneda: string) =>
    `${moneda} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

  // ── Acciones ────────────────────────────────────────────────────────────────

  const handleGuardar = async () => {
    if (!form.proveedorDbId || !form.descripcion || !form.fechaInicio || !form.fechaFin) {
      toast.error('Proveedor, descripción y fechas son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      await crearContrato({
        proveedorId: form.proveedorId,
        proveedorDbId: form.proveedorDbId,
        tipo: form.tipo,
        descripcion: form.descripcion,
        montoTotal: form.montoTotal ? parseFloat(form.montoTotal) : undefined,
        moneda: form.moneda,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        fechaFirma: form.fechaFirma || undefined,
        condicionesPago: form.condicionesPago || undefined,
        penalidades: form.penalidades || undefined,
        urlDocumento: form.urlDocumento || undefined,
        observaciones: form.observaciones || undefined,
      });
      toast.success('Contrato creado correctamente');
      setDialogNuevo(false);
      setForm(formVacio);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Error al crear contrato');
    } finally {
      setGuardando(false);
    }
  };

  const handleCambiarEstado = async (contrato: Contrato, estado: Contrato['estado']) => {
    const { exito, errores } = await cambiarEstado(contrato._dbId, estado);
    if (exito) toast.success(`Contrato marcado como ${estado}`);
    else toast.error(errores?.[0] ?? 'Error al actualizar');
    setDialogDetalle(null);
  };

  const handleRenovar = async () => {
    if (!dialogRenovar || !nuevaFechaFin) {
      toast.error('Ingresa la nueva fecha de fin');
      return;
    }
    const { exito, errores } = await cambiarEstado(dialogRenovar._dbId, 'activo', { fechaFin: nuevaFechaFin });
    if (exito) toast.success('Contrato renovado');
    else toast.error(errores?.[0] ?? 'Error al renovar');
    setDialogRenovar(null);
    setNuevaFechaFin('');
    setDialogDetalle(null);
  };

  const handleEliminar = async (dbId: string) => {
    const { exito, errores } = await eliminarContrato(dbId);
    if (exito) toast.success('Contrato eliminado');
    else toast.error(errores?.[0] ?? 'Error al eliminar');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos de Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de contratos activos, vencimientos y renovaciones
          </p>
        </div>
        <Button onClick={() => setDialogNuevo(true)}>
          <Plus className="size-4" />
          Nuevo Contrato
        </Button>
      </div>

      {/* Alerta: contratos por vencer */}
      {alertasPorVencer.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">
              {alertasPorVencer.length} contrato{alertasPorVencer.length > 1 ? 's' : ''} vence{alertasPorVencer.length > 1 ? 'n' : ''} en los próximos 30 días:
            </span>{' '}
            {alertasPorVencer.map(c => c.id).join(', ')}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Handshake className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contratos activos</p>
              <p className="text-2xl font-bold">{kpis.activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CalendarDays className="size-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Por vencer (&lt;30 días)</p>
              <p className="text-2xl font-bold text-yellow-600">{kpis.porVencer}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monto en contratos activos</p>
              <p className="text-lg font-bold">
                {kpis.montoActivos > 0
                  ? formatMontoBase(kpis.montoActivos)
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, número, descripción..."
            className="pl-9"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="rescindido">Rescindido</SelectItem>
            <SelectItem value="renovacion">En renovación</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="servicio">Servicio</SelectItem>
            <SelectItem value="suministro">Suministro</SelectItem>
            <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
            <SelectItem value="consultoria">Consultoría</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando contratos...</div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay contratos que mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha inicio</TableHead>
                    <TableHead>Fecha fin</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(c => (
                    <TableRow key={c._dbId}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{c.proveedorNombre}</div>
                        <div className="text-xs text-muted-foreground">{c.proveedorId}</div>
                      </TableCell>
                      <TableCell>{badgeTipo(c.tipo)}</TableCell>
                      <TableCell>{badgeEstado(c.estado, c.diasRestantes)}</TableCell>
                      <TableCell className="text-sm">
                        {c.montoTotal ? formatMonto(c.montoTotal, c.moneda) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.fechaInicio}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.fechaFin}</TableCell>
                      <TableCell>{diasRestantesCell(c.diasRestantes)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => setDialogDetalle(c)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-red-500 hover:text-red-700"
                            onClick={() => handleEliminar(c._dbId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog nuevo contrato */}
      <Dialog open={dialogNuevo} onOpenChange={open => { setDialogNuevo(open); if (!open) setForm(formVacio); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Contrato de Proveedor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Proveedor */}
            <div className="space-y-1.5">
              <Label>Proveedor <span className="text-red-500">*</span></Label>
              <Select
                value={form.proveedorDbId}
                onValueChange={v => {
                  const prov = proveedores.find(p => p._dbId === v);
                  setForm(f => ({ ...f, proveedorDbId: v, proveedorId: prov?.id ?? '' }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.filter(p => p.estado === 'activo').map(p => (
                    <SelectItem key={p._dbId} value={p._dbId}>
                      {p.razonSocial} — {p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo <span className="text-red-500">*</span></Label>
                <Select
                  value={form.tipo}
                  onValueChange={v => setForm(f => ({ ...f, tipo: v as FormState['tipo'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servicio">Servicio</SelectItem>
                    <SelectItem value="suministro">Suministro</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                    <SelectItem value="consultoria">Consultoría</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            <div className="space-y-1.5">
              <Label>Descripción <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Descripción del contrato..."
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Monto Total</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.montoTotal}
                onChange={e => setForm(f => ({ ...f, montoTotal: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha Inicio <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.fechaInicio}
                  onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha Fin <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.fechaFin}
                  onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha Firma</Label>
                <Input
                  type="date"
                  value={form.fechaFirma}
                  onChange={e => setForm(f => ({ ...f, fechaFirma: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Condiciones de Pago</Label>
              <Textarea
                placeholder="Ej: 30 días neto, crédito 60 días..."
                value={form.condicionesPago}
                onChange={e => setForm(f => ({ ...f, condicionesPago: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Penalidades</Label>
              <Textarea
                placeholder="Cláusulas de penalidades por incumplimiento..."
                value={form.penalidades}
                onChange={e => setForm(f => ({ ...f, penalidades: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>URL Documento</Label>
              <Input
                placeholder="https://..."
                value={form.urlDocumento}
                onChange={e => setForm(f => ({ ...f, urlDocumento: e.target.value }))}
              />
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
              {guardando ? 'Guardando...' : 'Crear Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle */}
      {dialogDetalle && (
        <Dialog open={!!dialogDetalle} onOpenChange={open => { if (!open) setDialogDetalle(null); }}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogDetalle.id}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {badgeEstado(dialogDetalle.estado, dialogDetalle.diasRestantes)}
                {badgeTipo(dialogDetalle.tipo)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Proveedor</p>
                  <p className="font-medium">{dialogDetalle.proveedorNombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Total</p>
                  <p className="font-medium">
                    {dialogDetalle.montoTotal
                      ? formatMonto(dialogDetalle.montoTotal, dialogDetalle.moneda)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha Inicio</p>
                  <p className="font-medium">{dialogDetalle.fechaInicio}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha Fin</p>
                  <p className="font-medium">{dialogDetalle.fechaFin}</p>
                </div>
                {dialogDetalle.fechaFirma && (
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha Firma</p>
                    <p className="font-medium">{dialogDetalle.fechaFirma}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Vencimiento</p>
                  {diasRestantesCell(dialogDetalle.diasRestantes)}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Descripción</p>
                <p className="text-sm mt-1">{dialogDetalle.descripcion}</p>
              </div>

              {dialogDetalle.condicionesPago && (
                <div>
                  <p className="text-xs text-muted-foreground">Condiciones de Pago</p>
                  <p className="text-sm mt-1">{dialogDetalle.condicionesPago}</p>
                </div>
              )}

              {dialogDetalle.penalidades && (
                <div>
                  <p className="text-xs text-muted-foreground">Penalidades</p>
                  <p className="text-sm mt-1">{dialogDetalle.penalidades}</p>
                </div>
              )}

              {dialogDetalle.urlDocumento && (
                <div>
                  <p className="text-xs text-muted-foreground">Documento</p>
                  <a
                    href={dialogDetalle.urlDocumento}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    Ver documento <ExternalLink className="size-3" />
                  </a>
                </div>
              )}

              {dialogDetalle.observaciones && (
                <div>
                  <p className="text-xs text-muted-foreground">Observaciones</p>
                  <p className="text-sm mt-1">{dialogDetalle.observaciones}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-wrap gap-2 mt-4">
              {dialogDetalle.estado === 'borrador' && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleCambiarEstado(dialogDetalle, 'activo')}
                >
                  <CheckCircle className="size-4" />
                  Activar
                </Button>
              )}
              {dialogDetalle.estado === 'activo' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleCambiarEstado(dialogDetalle, 'vencido')}
                  >
                    Marcar vencido
                  </Button>
                  <Button
                    variant="outline"
                    className="text-orange-600 border-orange-200"
                    onClick={() => handleCambiarEstado(dialogDetalle, 'rescindido')}
                  >
                    <XCircle className="size-4" />
                    Rescindir
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setDialogRenovar(dialogDetalle); }}
                  >
                    <RefreshCw className="size-4" />
                    Renovar
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setDialogDetalle(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog renovar */}
      {dialogRenovar && (
        <Dialog open={!!dialogRenovar} onOpenChange={open => { if (!open) { setDialogRenovar(null); setNuevaFechaFin(''); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Renovar Contrato</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Ingresa la nueva fecha de vencimiento para <span className="font-medium">{dialogRenovar.id}</span>.
              </p>
              <div className="space-y-1.5">
                <Label>Nueva Fecha Fin</Label>
                <Input
                  type="date"
                  value={nuevaFechaFin}
                  onChange={e => setNuevaFechaFin(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogRenovar(null); setNuevaFechaFin(''); }}>
                Cancelar
              </Button>
              <Button onClick={handleRenovar}>Confirmar Renovación</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
