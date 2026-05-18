/**
 * EVALUACIONES DE PROVEEDORES
 * Lista, filtros, KPIs, creación y gestión de evaluaciones
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  TrendingUp,
  Award,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
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
import { useEvaluacionesStore, type Evaluacion, type NuevaEvaluacionInput } from '../../../lib/proveedores/evaluaciones-store';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { toast } from 'sonner';

// ── Badge helpers ──────────────────────────────────────────────────────────────

function badgeEstado(estado: Evaluacion['estado']) {
  const map: Record<Evaluacion['estado'], { label: string; className: string }> = {
    borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    en_revision: { label: 'En revisión', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
    aprobada: { label: 'Aprobada', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' },
    rechazada: { label: 'Rechazada', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  };
  const cfg = map[estado] ?? map.borrador;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function badgeResultado(resultado?: Evaluacion['resultado']) {
  if (!resultado) return <span className="text-muted-foreground text-sm">—</span>;
  const map: Record<NonNullable<Evaluacion['resultado']>, { label: string; className: string }> = {
    excelente: { label: 'Excelente', className: 'bg-emerald-700 text-white border-emerald-700' },
    bueno: { label: 'Bueno', className: 'bg-green-500 text-white border-green-500' },
    regular: { label: 'Regular', className: 'bg-yellow-500 text-white border-yellow-500' },
    deficiente: { label: 'Deficiente', className: 'bg-red-600 text-white border-red-600' },
  };
  const cfg = map[resultado];
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function colorPuntaje(puntaje?: number): string {
  if (puntaje === undefined) return 'text-muted-foreground';
  if (puntaje >= 90) return 'text-emerald-700 font-semibold';
  if (puntaje >= 70) return 'text-green-600 font-semibold';
  if (puntaje >= 50) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

// ── Cálculo de puntaje en tiempo real ────────────────────────────────────────

function calcularPuntajeLocal(
  calidad?: number, entrega?: number, precio?: number,
  servicio?: number, documentacion?: number
): { puntaje?: number; resultado?: Evaluacion['resultado'] } {
  const vals = [calidad, entrega, precio, servicio, documentacion].filter(
    (v): v is number => v !== undefined && v !== null && !isNaN(v)
  );
  if (vals.length === 0) return {};
  const puntaje = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  let resultado: Evaluacion['resultado'];
  if (puntaje >= 90) resultado = 'excelente';
  else if (puntaje >= 70) resultado = 'bueno';
  else if (puntaje >= 50) resultado = 'regular';
  else resultado = 'deficiente';
  return { puntaje, resultado };
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  proveedorDbId: string;
  proveedorId: string;
  periodo: string;
  tipo: NuevaEvaluacionInput['tipo'];
  calidad: string;
  entrega: string;
  precio: string;
  servicio: string;
  documentacion: string;
  evaluador: string;
  comentarios: string;
}

const formVacio: FormState = {
  proveedorDbId: '',
  proveedorId: '',
  periodo: '',
  tipo: 'trimestral',
  calidad: '',
  entrega: '',
  precio: '',
  servicio: '',
  documentacion: '',
  evaluador: '',
  comentarios: '',
};

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
}

export function ProveedoresEvaluaciones({ onNavigate: _onNavigate }: Props) {
  const { evaluaciones, loading, crearEvaluacion, aprobarEvaluacion, actualizarEvaluacion, eliminarEvaluacion } = useEvaluacionesStore();
  const { proveedores } = useProveedorStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  const [dialogNueva, setDialogNueva] = useState(false);
  const [dialogDetalle, setDialogDetalle] = useState<Evaluacion | null>(null);
  const [dialogRechazar, setDialogRechazar] = useState<Evaluacion | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [form, setForm] = useState<FormState>(formVacio);
  const [guardando, setGuardando] = useState(false);

  // ── Filtrado ────────────────────────────────────────────────────────────────

  const filtradas = useMemo(() => {
    return evaluaciones.filter(e => {
      if (filtroEstado !== 'todos' && e.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !e.proveedorNombre.toLowerCase().includes(q) &&
          !e.proveedorId.toLowerCase().includes(q) &&
          !e.id.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [evaluaciones, filtroEstado, filtroTipo, busqueda]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = evaluaciones.length;
    const conPuntaje = evaluaciones.filter(e => e.puntajeTotal !== undefined);
    const promedio = conPuntaje.length > 0
      ? conPuntaje.reduce((acc, e) => acc + (e.puntajeTotal ?? 0), 0) / conPuntaje.length
      : 0;
    const excelenteBueno = evaluaciones.filter(
      e => e.resultado === 'excelente' || e.resultado === 'bueno'
    ).length;
    const pctPositivo = total > 0 ? Math.round((excelenteBueno / total) * 100) : 0;
    return { total, promedio: Math.round(promedio * 10) / 10, pctPositivo };
  }, [evaluaciones]);

  // ── Form helpers ────────────────────────────────────────────────────────────

  const parseNum = (v: string): number | undefined => {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : Math.min(100, Math.max(0, n));
  };

  const puntajePreview = useMemo(() => calcularPuntajeLocal(
    parseNum(form.calidad),
    parseNum(form.entrega),
    parseNum(form.precio),
    parseNum(form.servicio),
    parseNum(form.documentacion)
  ), [form.calidad, form.entrega, form.precio, form.servicio, form.documentacion]);

  // ── Acciones ────────────────────────────────────────────────────────────────

  const handleGuardar = async () => {
    if (!form.proveedorDbId || !form.periodo) {
      toast.error('Proveedor y período son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      await crearEvaluacion({
        proveedorId: form.proveedorId,
        proveedorDbId: form.proveedorDbId,
        periodo: form.periodo,
        tipo: form.tipo,
        calidad: parseNum(form.calidad),
        entrega: parseNum(form.entrega),
        precio: parseNum(form.precio),
        servicio: parseNum(form.servicio),
        documentacion: parseNum(form.documentacion),
        evaluador: form.evaluador || undefined,
        comentarios: form.comentarios || undefined,
      });
      toast.success('Evaluación creada correctamente');
      setDialogNueva(false);
      setForm(formVacio);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Error al crear evaluación');
    } finally {
      setGuardando(false);
    }
  };

  const handleAprobar = async (eva: Evaluacion) => {
    const { exito, errores } = await aprobarEvaluacion(eva._dbId);
    if (exito) toast.success('Evaluación aprobada');
    else toast.error(errores?.[0] ?? 'Error al aprobar');
    setDialogDetalle(null);
  };

  const handleRechazar = async () => {
    if (!dialogRechazar) return;
    const { exito, errores } = await actualizarEvaluacion(dialogRechazar._dbId, {
      estado: 'rechazada',
      comentarios: motivoRechazo || dialogRechazar.comentarios,
    });
    if (exito) toast.success('Evaluación rechazada');
    else toast.error(errores?.[0] ?? 'Error al rechazar');
    setDialogRechazar(null);
    setMotivoRechazo('');
    setDialogDetalle(null);
  };

  const handleEliminar = async (dbId: string) => {
    const { exito, errores } = await eliminarEvaluacion(dbId);
    if (exito) toast.success('Evaluación eliminada');
    else toast.error(errores?.[0] ?? 'Error al eliminar');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evaluaciones de Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calificación periódica de desempeño por criterios
          </p>
        </div>
        <Button onClick={() => setDialogNueva(true)}>
          <Plus className="size-4" />
          Nueva Evaluación
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Star className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total evaluaciones</p>
              <p className="text-2xl font-bold">{kpis.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Puntaje promedio</p>
              <p className={`text-2xl font-bold ${colorPuntaje(kpis.promedio)}`}>
                {kpis.promedio > 0 ? kpis.promedio.toFixed(1) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Award className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Excelente / Bueno</p>
              <p className="text-2xl font-bold text-green-600">{kpis.pctPositivo}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, código..."
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
            <SelectItem value="en_revision">En revisión</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
            <SelectItem value="trimestral">Trimestral</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
            <SelectItem value="puntual">Puntual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando evaluaciones...</div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay evaluaciones que mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Puntaje</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Evaluador</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map(eva => (
                    <TableRow key={eva._dbId}>
                      <TableCell className="font-mono text-xs">{eva.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{eva.proveedorNombre}</div>
                        <div className="text-xs text-muted-foreground">{eva.proveedorId}</div>
                      </TableCell>
                      <TableCell className="text-sm">{eva.periodo}</TableCell>
                      <TableCell>
                        <span className="capitalize text-sm">{eva.tipo}</span>
                      </TableCell>
                      <TableCell>{badgeEstado(eva.estado)}</TableCell>
                      <TableCell>
                        {eva.puntajeTotal !== undefined ? (
                          <span className={colorPuntaje(eva.puntajeTotal)}>
                            {eva.puntajeTotal.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{badgeResultado(eva.resultado)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {eva.evaluador ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => setDialogDetalle(eva)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-red-500 hover:text-red-700"
                            onClick={() => handleEliminar(eva._dbId)}
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

      {/* Dialog nueva evaluación */}
      <Dialog open={dialogNueva} onOpenChange={open => { setDialogNueva(open); if (!open) setForm(formVacio); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Evaluación de Proveedor</DialogTitle>
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
              {/* Período */}
              <div className="space-y-1.5">
                <Label>Período <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="ej: 2026-Q1, 2026-03"
                  value={form.periodo}
                  onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
                />
              </div>
              {/* Tipo */}
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={v => setForm(f => ({ ...f, tipo: v as FormState['tipo'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="puntual">Puntual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Criterios */}
            <div>
              <p className="text-sm font-medium mb-3">Criterios de evaluación (0 – 100)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    { key: 'calidad', label: 'Calidad' },
                    { key: 'entrega', label: 'Entrega' },
                    { key: 'precio', label: 'Precio' },
                    { key: 'servicio', label: 'Servicio' },
                    { key: 'documentacion', label: 'Documentación' },
                  ] as { key: keyof FormState; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      placeholder="0 – 100"
                      value={form[key] as string}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              {/* Preview de puntaje */}
              {puntajePreview.puntaje !== undefined && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Puntaje calculado</p>
                    <p className={`text-xl font-bold ${colorPuntaje(puntajePreview.puntaje)}`}>
                      {puntajePreview.puntaje.toFixed(1)}
                    </p>
                  </div>
                  <div>{badgeResultado(puntajePreview.resultado)}</div>
                </div>
              )}
            </div>

            <Separator />

            {/* Evaluador y comentarios */}
            <div className="space-y-1.5">
              <Label>Evaluador</Label>
              <Input
                placeholder="Nombre del evaluador"
                value={form.evaluador}
                onChange={e => setForm(f => ({ ...f, evaluador: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comentarios</Label>
              <Textarea
                placeholder="Observaciones generales..."
                value={form.comentarios}
                onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNueva(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Crear Evaluación'}
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
              <div className="flex flex-wrap gap-2 items-center">
                {badgeEstado(dialogDetalle.estado)}
                {badgeResultado(dialogDetalle.resultado)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Proveedor</p>
                  <p className="font-medium">{dialogDetalle.proveedorNombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Período / Tipo</p>
                  <p className="font-medium">{dialogDetalle.periodo} — {dialogDetalle.tipo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Evaluador</p>
                  <p className="font-medium">{dialogDetalle.evaluador ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Puntaje Total</p>
                  <p className={`font-bold ${colorPuntaje(dialogDetalle.puntajeTotal)}`}>
                    {dialogDetalle.puntajeTotal?.toFixed(1) ?? '—'}
                  </p>
                </div>
              </div>

              {/* Barras de criterios */}
              {(dialogDetalle.calidad !== undefined ||
                dialogDetalle.entrega !== undefined ||
                dialogDetalle.precio !== undefined ||
                dialogDetalle.servicio !== undefined ||
                dialogDetalle.documentacion !== undefined) && (
                <div className="space-y-3">
                  <Separator />
                  <p className="text-sm font-medium">Criterios</p>
                  {(
                    [
                      { key: 'calidad', label: 'Calidad' },
                      { key: 'entrega', label: 'Entrega' },
                      { key: 'precio', label: 'Precio' },
                      { key: 'servicio', label: 'Servicio' },
                      { key: 'documentacion', label: 'Documentación' },
                    ] as { key: keyof Evaluacion; label: string }[]
                  ).map(({ key, label }) => {
                    const val = dialogDetalle[key] as number | undefined;
                    if (val === undefined) return null;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{val}</span>
                        </div>
                        <Progress value={val} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}

              {dialogDetalle.comentarios && (
                <div>
                  <Separator />
                  <p className="text-xs text-muted-foreground mt-3">Comentarios</p>
                  <p className="text-sm mt-1">{dialogDetalle.comentarios}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-wrap gap-2 mt-4">
              {(dialogDetalle.estado === 'borrador' || dialogDetalle.estado === 'en_revision') && (
                <>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200"
                    onClick={() => { setDialogRechazar(dialogDetalle); }}
                  >
                    <XCircle className="size-4" />
                    Rechazar
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleAprobar(dialogDetalle)}
                  >
                    <CheckCircle className="size-4" />
                    Aprobar
                  </Button>
                </>
              )}
              {dialogDetalle.estado === 'borrador' && (
                <Button
                  variant="outline"
                  onClick={() => actualizarEvaluacion(dialogDetalle._dbId, { estado: 'en_revision' }).then(r => {
                    if (r.exito) { toast.success('Enviada a revisión'); setDialogDetalle(null); }
                    else toast.error(r.errores?.[0] ?? 'Error');
                  })}
                >
                  <Clock className="size-4" />
                  Enviar a revisión
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDialogDetalle(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog rechazar */}
      {dialogRechazar && (
        <Dialog open={!!dialogRechazar} onOpenChange={open => { if (!open) { setDialogRechazar(null); setMotivoRechazo(''); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Rechazar evaluación</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Ingresa el motivo del rechazo (opcional).</p>
              <Textarea
                placeholder="Motivo del rechazo..."
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogRechazar(null); setMotivoRechazo(''); }}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleRechazar}>Confirmar rechazo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
