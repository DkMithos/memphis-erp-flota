import { useState, useMemo } from 'react';
import {
  Plus, Search, Filter, TrendingUp, TrendingDown, AlertCircle,
  Check, X, Ban, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';
import { toast } from 'sonner';
import { useFinanzas, type Transaccion } from '@/lib/finanzas/finanzas-store';
import { useAuth } from '@/auth/AuthProvider';

interface Props {
  onNavigate: (route: string) => void;
}

function fmt(n: number, moneda = 'PEN') {
  const sym = moneda === 'USD' ? '$ ' : 'S/ ';
  return `${sym}${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  aprobada: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  rechazada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pagada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  anulada: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

interface FormData {
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  categoria: string;
  subcategoria: string;
  monto: string;
  moneda: 'PEN' | 'USD';
  tipoCambio: string;
  fecha: string;
  descripcion: string;
  referenciaNúmero: string;
  referenciaTipo: string;
  proveedorNombre: string;
  comprobanteUrl: string;
}

const defaultForm: FormData = {
  tipo: 'egreso',
  categoria: '',
  subcategoria: '',
  monto: '',
  moneda: 'PEN',
  tipoCambio: '3.75',
  fecha: new Date().toISOString().split('T')[0],
  descripcion: '',
  referenciaNúmero: '',
  referenciaTipo: '',
  proveedorNombre: '',
  comprobanteUrl: '',
};

export function FinanzasTransacciones({ onNavigate: _onNavigate }: Props) {
  const { transacciones, addTransaccion, updateTransaccion, loading } = useFinanzas();
  const { tenantId, user } = useAuth();

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [trxProyectoId, setTrxProyectoId] = useState<string | null>(null);
  const [trxCentroCostoId, setTrxCentroCostoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  const kpis = useMemo(() => {
    const mes = transacciones.filter(t => {
      const d = new Date(t.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    });
    const ingresos = mes.filter(t => t.tipo === 'ingreso' && t.estado !== 'anulada').reduce((s, t) => s + t.monto, 0);
    const egresos = mes.filter(t => t.tipo === 'egreso' && t.estado !== 'anulada').reduce((s, t) => s + t.monto, 0);
    const pendientes = transacciones.filter(t => t.estado === 'pendiente').length;
    return { ingresos, egresos, pendientes };
  }, [transacciones, mesActual, anioActual]);

  const filtered = useMemo(() => {
    return transacciones.filter(t => {
      if (filterTipo !== 'todos' && t.tipo !== filterTipo) return false;
      if (filterEstado !== 'todos' && t.estado !== filterEstado) return false;
      if (filterCategoria && !t.categoria.toLowerCase().includes(filterCategoria.toLowerCase())) return false;
      if (filterDesde && t.fecha < filterDesde) return false;
      if (filterHasta && t.fecha > filterHasta) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          t.id.toLowerCase().includes(s) ||
          t.descripcion.toLowerCase().includes(s) ||
          t.categoria.toLowerCase().includes(s) ||
          (t.proveedorNombre ?? '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [transacciones, search, filterTipo, filterEstado, filterCategoria, filterDesde, filterHasta]);

  const handleSave = async () => {
    if (!tenantId) return;
    if (!formData.descripcion.trim()) { toast.error('La descripción es obligatoria'); return; }
    if (!formData.categoria.trim()) { toast.error('La categoría es obligatoria'); return; }
    if (!formData.tipo) { toast.error('El tipo de transacción es obligatorio'); return; }
    const monto = parseFloat(formData.monto);
    if (!formData.monto || isNaN(monto) || monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    setSaving(true);
    try {
      const now = new Date();
      const seq = String(transacciones.length + 1).padStart(4, '0');
      const numero = `TRX-${now.getFullYear()}-${seq}`;
      const tc = formData.moneda === 'USD' ? parseFloat(formData.tipoCambio) || 3.75 : 1;

      await addTransaccion({
        tenant_id: tenantId,
        numero,
        tipo: formData.tipo,
        categoria: formData.categoria,
        subcategoria: formData.subcategoria || null,
        estado: 'pendiente',
        monto,
        moneda: formData.moneda,
        tipo_cambio: tc,
        monto_soles: monto * tc,
        fecha: formData.fecha,
        descripcion: formData.descripcion,
        referencia_numero: formData.referenciaNúmero || null,
        referencia_tipo: formData.referenciaTipo || null,
        proveedor_nombre: formData.proveedorNombre || null,
        comprobante_url: formData.comprobanteUrl || null,
        creado_por: user?.email ?? null,
        cuenta_id: null,
        centro_costo_id: null,
        aprobado_por: null,
        aprobado_en: null,
        fecha_pago: null,
        modificado_por: null,
        modificado_en: null,
      });
      toast.success('Transacción registrada');
      setShowForm(false);
      setFormData(defaultForm);
    } catch (e) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAprobar = async (t: Transaccion) => {
    try {
      await updateTransaccion(t._dbId, {
        estado: 'aprobada',
        aprobado_por: user?.email ?? 'Sistema',
        aprobado_en: new Date().toISOString(),
      });
      toast.success('Transacción aprobada');
    } catch { toast.error('Error al aprobar'); }
  };

  const handleRechazar = async (t: Transaccion) => {
    try {
      await updateTransaccion(t._dbId, { estado: 'rechazada' });
      toast.success('Transacción rechazada');
    } catch { toast.error('Error al rechazar'); }
  };

  const handleAnular = async (t: Transaccion) => {
    try {
      await updateTransaccion(t._dbId, { estado: 'anulada' });
      toast.success('Transacción anulada');
    } catch { toast.error('Error al anular'); }
  };

  const setField = (k: keyof FormData, v: string) => setFormData(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Transacciones</h2>
          <p className="text-muted-foreground mt-1">Ingresos, egresos y transferencias financieras</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="size-4" />
          Nueva Transacción
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ingresos del Mes</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">S/ {kpis.ingresos.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Egresos del Mes</CardTitle>
            <TrendingDown className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-500">S/ {kpis.egresos.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendientes Aprobación</CardTitle>
            <AlertCircle className="size-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-600">{kpis.pendientes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, descripción, categoría..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="ingreso">Ingreso</SelectItem>
                <SelectItem value="egreso">Egreso</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="size-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
              <div>
                <Label className="text-xs">Categoría</Label>
                <Input
                  placeholder="Filtrar categoría..."
                  value={filterCategoria}
                  onChange={e => setFilterCategoria(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {transacciones.length === 0 ? 'No hay transacciones. Crea la primera.' : 'Sin resultados con los filtros aplicados.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => (
                    <TableRow key={t._dbId}>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="text-sm">{t.fecha}</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            t.tipo === 'ingreso'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : t.tipo === 'egreso'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {t.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.categoria}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{t.descripcion}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.proveedorNombre ?? '—'}</TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {fmt(t.monto, t.moneda)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${ESTADO_COLORS[t.estado] ?? ''}`}>
                          {t.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {t.estado === 'pendiente' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-green-600 hover:text-green-700"
                                title="Aprobar"
                                onClick={() => handleAprobar(t)}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-500 hover:text-red-600"
                                title="Rechazar"
                                onClick={() => handleRechazar(t)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          )}
                          {(t.estado === 'pendiente' || t.estado === 'aprobada') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              title="Anular"
                              onClick={() => handleAnular(t)}
                            >
                              <Ban className="size-3.5" />
                            </Button>
                          )}
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

      {/* Dialog Nueva Transacción */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Transacción</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => setField('tipo', v as FormData['tipo'])}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={formData.fecha} onChange={e => setField('fecha', e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Categoría *</Label>
              <Input
                placeholder="Ej: Combustible, Mantenimiento, Salarios..."
                value={formData.categoria}
                onChange={e => setField('categoria', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Subcategoría</Label>
              <Input
                placeholder="Opcional"
                value={formData.subcategoria}
                onChange={e => setField('subcategoria', e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.monto}
                  onChange={e => setField('monto', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={formData.moneda} onValueChange={v => setField('moneda', v as 'PEN' | 'USD')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">PEN (Soles)</SelectItem>
                    <SelectItem value="USD">USD (Dólares)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.moneda === 'USD' && (
              <div>
                <Label>Tipo de Cambio</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tipoCambio}
                  onChange={e => setField('tipoCambio', e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label>Descripción *</Label>
              <Textarea
                placeholder="Detalle de la transacción..."
                value={formData.descripcion}
                onChange={e => setField('descripcion', e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº Comprobante</Label>
                <Input
                  placeholder="F001-12345"
                  value={formData.referenciaNúmero}
                  onChange={e => setField('referenciaNúmero', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tipo Comprobante</Label>
                <Select value={formData.referenciaTipo || '_none'} onValueChange={v => setField('referenciaTipo', v === '_none' ? '' : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin tipo</SelectItem>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="boleta">Boleta</SelectItem>
                    <SelectItem value="recibo">Recibo</SelectItem>
                    <SelectItem value="planilla">Planilla</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Proveedor / Beneficiario</Label>
              <Input
                placeholder="Nombre del proveedor o beneficiario"
                value={formData.proveedorNombre}
                onChange={e => setField('proveedorNombre', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>URL Comprobante</Label>
              <Input
                placeholder="https://..."
                value={formData.comprobanteUrl}
                onChange={e => setField('comprobanteUrl', e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proyecto</Label>
                <ProyectoSelector
                  value={trxProyectoId}
                  onChange={setTrxProyectoId}
                  nullable
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Centro de Costo</Label>
                <CentroCostoSelector
                  value={trxCentroCostoId}
                  onChange={setTrxCentroCostoId}
                  nullable
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
