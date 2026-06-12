import { useState } from 'react';
import { Plus, ChevronRight, Check, Trash2, ClipboardList } from 'lucide-react';
import { PageNav } from '@/components/shared/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useFinanzas, type Presupuesto, type PresupuestoLinea } from '@/lib/finanzas/finanzas-store';
import { useAuth } from '@/auth/AuthProvider';

interface Props {
  onNavigate: (route: string) => void;
}

function fmt(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const ESTADO_COLORS = {
  borrador: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  aprobado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cerrado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

interface NuevoPresupuestoForm {
  nombre: string;
  periodo: string;
  tipo: 'mensual' | 'trimestral' | 'anual';
  descripcion: string;
}

interface NuevaLineaForm {
  categoria: string;
  subcategoria: string;
  montoPresupuestado: string;
}

export function FinanzasPresupuestosModule({ onNavigate: _onNavigate }: Props) {
  const { presupuestos, addPresupuesto, updatePresupuesto, addLineaPresupuesto, updateLineaPresupuesto, deleteLineaPresupuesto, loading } = useFinanzas();
  const { tenantId, user } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [showNuevaLinea, setShowNuevaLinea] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nuevoForm, setNuevoForm] = useState<NuevoPresupuestoForm>({
    nombre: '',
    periodo: String(new Date().getFullYear()),
    tipo: 'anual',
    descripcion: '',
  });

  const [lineaForm, setLineaForm] = useState<NuevaLineaForm>({
    categoria: '',
    subcategoria: '',
    montoPresupuestado: '',
  });

  const [editLinea, setEditLinea] = useState<{ dbId: string; monto: string } | null>(null);

  const selected = presupuestos.find(p => p._dbId === selectedId) ?? null;

  const handleCrearPresupuesto = async () => {
    if (!tenantId) return;
    if (!nuevoForm.nombre.trim() || !nuevoForm.periodo.trim()) {
      toast.error('Nombre y período son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await addPresupuesto({
        tenant_id: tenantId,
        nombre: nuevoForm.nombre,
        periodo: nuevoForm.periodo,
        tipo: nuevoForm.tipo,
        estado: 'borrador',
        moneda: 'PEN',
        descripcion: nuevoForm.descripcion || null,
        creado_por: user?.email ?? null,
      });
      toast.success('Presupuesto creado');
      setShowNuevo(false);
      setNuevoForm({ nombre: '', periodo: String(new Date().getFullYear()), tipo: 'anual', descripcion: '' });
    } catch { toast.error('Error al crear presupuesto'); }
    finally { setSaving(false); }
  };

  const handleAgregarLinea = async () => {
    if (!tenantId || !selectedId) return;
    if (!lineaForm.categoria.trim() || !lineaForm.montoPresupuestado) {
      toast.error('Categoría y monto son obligatorios');
      return;
    }
    const monto = parseFloat(lineaForm.montoPresupuestado);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }
    setSaving(true);
    try {
      await addLineaPresupuesto(selectedId, tenantId, {
        categoria: lineaForm.categoria,
        subcategoria: lineaForm.subcategoria || undefined,
        monto_presupuestado: monto,
      });
      toast.success('Línea agregada');
      setShowNuevaLinea(false);
      setLineaForm({ categoria: '', subcategoria: '', montoPresupuestado: '' });
    } catch { toast.error('Error al agregar línea'); }
    finally { setSaving(false); }
  };

  const handleAprobar = async (p: Presupuesto) => {
    try {
      await updatePresupuesto(p._dbId, { estado: 'aprobado' });
      toast.success('Presupuesto aprobado');
    } catch { toast.error('Error al aprobar'); }
  };

  const handleSaveEditLinea = async (linea: PresupuestoLinea) => {
    if (!editLinea) return;
    const monto = parseFloat(editLinea.monto);
    if (isNaN(monto) || monto < 0) { toast.error('Monto inválido'); return; }
    try {
      await updateLineaPresupuesto(editLinea.dbId, { monto_presupuestado: monto });
      toast.success('Línea actualizada');
      setEditLinea(null);
    } catch { toast.error('Error al actualizar'); }
  };

  const handleDeleteLinea = async (linea: PresupuestoLinea) => {
    if (!selectedId) return;
    try {
      await deleteLineaPresupuesto(linea._dbId, selectedId);
      toast.success('Línea eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <ClipboardList className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Presupuestos</h2>
            <p className="text-muted-foreground mt-1">Gestión de presupuestos y ejecución</p>
          </div>
        </div>
        <Button onClick={() => setShowNuevo(true)}>
          <Plus className="size-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de presupuestos */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : presupuestos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sin presupuestos. Crea el primero.
              </CardContent>
            </Card>
          ) : (
            presupuestos.map(p => (
              <Card
                key={p._dbId}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedId === p._dbId ? 'border-primary' : ''}`}
                onClick={() => setSelectedId(p._dbId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">{p.periodo} · {p.tipo}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Badge className={`text-xs ${ESTADO_COLORS[p.estado]}`}>{p.estado}</Badge>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Ejecución global</span>
                      <span>{p.porcentajeEjecucionGlobal.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(p.porcentajeEjecucionGlobal, 100)} className="h-1.5" />
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Ppto: {fmt(p.totalPresupuestado)}</span>
                      <span className={p.totalEjecutado > p.totalPresupuestado ? 'text-red-500' : 'text-green-600'}>
                        Ejec: {fmt(p.totalEjecutado)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Detalle del presupuesto seleccionado */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Selecciona un presupuesto para ver sus líneas
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{selected.nombre}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{selected.periodo} · {selected.tipo}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {selected.estado === 'borrador' && (
                    <Button size="sm" variant="outline" onClick={() => handleAprobar(selected)}>
                      <Check className="size-4" />
                      Aprobar
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setShowNuevaLinea(true)}>
                    <Plus className="size-4" />
                    Agregar Línea
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {selected.lineas.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Sin líneas. Agrega la primera.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Subcategoría</TableHead>
                          <TableHead className="text-right">Presupuestado</TableHead>
                          <TableHead className="text-right">Ejecutado</TableHead>
                          <TableHead className="text-right">Variación</TableHead>
                          <TableHead>% Ejec.</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.lineas.map(linea => (
                          <TableRow key={linea._dbId}>
                            <TableCell className="text-sm font-medium">{linea.categoria}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{linea.subcategoria ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm">
                              {editLinea?.dbId === linea._dbId ? (
                                <Input
                                  type="number"
                                  className="w-28 text-right text-xs h-7"
                                  value={editLinea.monto}
                                  onChange={e => setEditLinea({ ...editLinea, monto: e.target.value })}
                                  onBlur={() => handleSaveEditLinea(linea)}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:underline"
                                  onClick={() => setEditLinea({ dbId: linea._dbId, monto: String(linea.montoPresupuestado) })}
                                >
                                  {fmt(linea.montoPresupuestado)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmt(linea.montoEjecutado)}</TableCell>
                            <TableCell className={`text-right text-sm ${linea.variacion < 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {fmt(linea.variacion)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[90px]">
                                <Progress
                                  value={Math.min(linea.porcentajeEjecucion, 100)}
                                  className={`h-1.5 flex-1 ${linea.porcentajeEjecucion > 100 ? '[&>div]:bg-red-500' : ''}`}
                                />
                                <span className="text-xs">{linea.porcentajeEjecucion.toFixed(0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteLinea(linea)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Totales */}
                <div className="border-t border-border p-4 flex justify-end gap-8 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Total Presupuestado</p>
                    <p className="font-bold">{fmt(selected.totalPresupuestado)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Ejecutado</p>
                    <p className={`font-bold ${selected.totalEjecutado > selected.totalPresupuestado ? 'text-red-500' : ''}`}>
                      {fmt(selected.totalEjecutado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Variación</p>
                    <p className={`font-bold ${(selected.totalPresupuestado - selected.totalEjecutado) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {fmt(selected.totalPresupuestado - selected.totalEjecutado)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog Nuevo Presupuesto */}
      <Dialog open={showNuevo} onOpenChange={setShowNuevo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Presupuesto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Presupuesto Operativo 2026"
                value={nuevoForm.nombre}
                onChange={e => setNuevoForm(f => ({ ...f, nombre: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Período *</Label>
                <Input
                  placeholder="Ej: 2026 o 2026-Q1"
                  value={nuevoForm.periodo}
                  onChange={e => setNuevoForm(f => ({ ...f, periodo: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={nuevoForm.tipo} onValueChange={v => setNuevoForm(f => ({ ...f, tipo: v as NuevoPresupuestoForm['tipo'] }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción del presupuesto..."
                value={nuevoForm.descripcion}
                onChange={e => setNuevoForm(f => ({ ...f, descripcion: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevo(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleCrearPresupuesto} disabled={saving}>{saving ? 'Creando...' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nueva Línea */}
      <Dialog open={showNuevaLinea} onOpenChange={setShowNuevaLinea}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Línea de Presupuesto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Categoría *</Label>
              <Input
                placeholder="Ej: Personal, Combustible, Servicios..."
                value={lineaForm.categoria}
                onChange={e => setLineaForm(f => ({ ...f, categoria: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Subcategoría</Label>
              <Input
                placeholder="Opcional"
                value={lineaForm.subcategoria}
                onChange={e => setLineaForm(f => ({ ...f, subcategoria: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Monto Presupuestado (S/) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={lineaForm.montoPresupuestado}
                onChange={e => setLineaForm(f => ({ ...f, montoPresupuestado: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevaLinea(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleAgregarLinea} disabled={saving}>{saving ? 'Guardando...' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
