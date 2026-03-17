import { useState, useMemo } from 'react';
import { Plus, Wallet, Check, X, AlertCircle } from 'lucide-react';
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
import { useFinanzas, type CajaChica, type GastoCajaChica } from '@/lib/finanzas/finanzas-store';
import { useAuth } from '@/auth/AuthProvider';

interface Props {
  onNavigate: (route: string) => void;
}

function fmt(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const ESTADO_CAJA_COLORS = {
  activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  en_reposicion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  cerrada: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const ESTADO_GASTO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  aprobado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rechazado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface NuevaCajaForm {
  nombre: string;
  responsable: string;
  montoAsignado: string;
}

interface NuevoGastoForm {
  descripcion: string;
  categoria: string;
  monto: string;
  fecha: string;
  beneficiario: string;
  comprobanteNumero: string;
  comprobanteTipo: string;
  notas: string;
}

const defaultGastoForm: NuevoGastoForm = {
  descripcion: '',
  categoria: '',
  monto: '',
  fecha: new Date().toISOString().split('T')[0],
  beneficiario: '',
  comprobanteNumero: '',
  comprobanteTipo: '',
  notas: '',
};

export function FinanzasCajaChica({ onNavigate: _onNavigate }: Props) {
  const { cajasChicas, gastos, addCajaChica, addGasto, updateGasto, loading } = useFinanzas();
  const { tenantId, user } = useAuth();

  const [selectedCajaId, setSelectedCajaId] = useState<string | null>(null);
  const [showNuevaCaja, setShowNuevaCaja] = useState(false);
  const [showNuevoGasto, setShowNuevoGasto] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nuevaCajaForm, setNuevaCajaForm] = useState<NuevaCajaForm>({
    nombre: '',
    responsable: '',
    montoAsignado: '',
  });

  const [gastoForm, setGastoForm] = useState<NuevoGastoForm>(defaultGastoForm);

  const selectedCaja = cajasChicas.find(c => c._dbId === selectedCajaId) ?? null;

  const gastosDeCaja = useMemo(() =>
    gastos.filter(g => g.cajaDbId === selectedCajaId),
    [gastos, selectedCajaId]
  );

  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  const kpisGastos = useMemo(() => {
    const mes = gastosDeCaja.filter(g => {
      const d = new Date(g.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual && g.estado !== 'rechazado';
    });
    const total = mes.reduce((s, g) => s + g.monto, 0);
    const pendientes = gastosDeCaja.filter(g => g.estado === 'pendiente').length;
    return { total, pendientes };
  }, [gastosDeCaja, mesActual, anioActual]);

  const handleCrearCaja = async () => {
    if (!tenantId) return;
    if (!nuevaCajaForm.nombre.trim() || !nuevaCajaForm.responsable.trim() || !nuevaCajaForm.montoAsignado) {
      toast.error('Todos los campos son obligatorios');
      return;
    }
    const monto = parseFloat(nuevaCajaForm.montoAsignado);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }

    setSaving(true);
    try {
      const seq = String(cajasChicas.length + 1).padStart(3, '0');
      await addCajaChica({
        tenant_id: tenantId,
        nombre: nuevaCajaForm.nombre,
        codigo: `CC-${seq}`,
        responsable: nuevaCajaForm.responsable,
        monto_asignado: monto,
        monto_disponible: monto,
        moneda: 'PEN',
        estado: 'activo',
      });
      toast.success('Caja chica creada');
      setShowNuevaCaja(false);
      setNuevaCajaForm({ nombre: '', responsable: '', montoAsignado: '' });
    } catch { toast.error('Error al crear caja'); }
    finally { setSaving(false); }
  };

  const handleCrearGasto = async () => {
    if (!tenantId || !selectedCajaId || !selectedCaja) return;
    if (!gastoForm.descripcion.trim() || !gastoForm.categoria.trim() || !gastoForm.monto || !gastoForm.fecha) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    const monto = parseFloat(gastoForm.monto);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }

    setSaving(true);
    try {
      const now = new Date();
      const seq = String(gastos.filter(g => g.cajaDbId === selectedCajaId).length + 1).padStart(3, '0');
      const numero = `GCC-${now.getFullYear()}-${seq}`;

      await addGasto({
        tenant_id: tenantId,
        caja_id: selectedCajaId,
        numero,
        descripcion: gastoForm.descripcion,
        categoria: gastoForm.categoria,
        monto,
        moneda: 'PEN',
        fecha: gastoForm.fecha,
        beneficiario: gastoForm.beneficiario || null,
        comprobante_numero: gastoForm.comprobanteNumero || null,
        comprobante_tipo: (gastoForm.comprobanteTipo as GastoCajaChica['comprobanteTipo']) || null,
        estado: 'pendiente',
        aprobado_por: null,
        notas: gastoForm.notas || null,
        realizado_por: user?.email ?? null,
      });
      toast.success('Gasto registrado');
      setShowNuevoGasto(false);
      setGastoForm(defaultGastoForm);
    } catch { toast.error('Error al registrar gasto'); }
    finally { setSaving(false); }
  };

  const handleAprobarGasto = async (g: GastoCajaChica) => {
    try {
      await updateGasto(g._dbId, {
        estado: 'aprobado',
        aprobado_por: user?.email ?? 'Sistema',
      });
      toast.success('Gasto aprobado');
    } catch { toast.error('Error al aprobar'); }
  };

  const handleRechazarGasto = async (g: GastoCajaChica) => {
    try {
      await updateGasto(g._dbId, { estado: 'rechazado' });
      toast.success('Gasto rechazado');
    } catch { toast.error('Error al rechazar'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Caja Chica</h2>
          <p className="text-muted-foreground mt-1">Gestión de fondos y gastos de caja chica</p>
        </div>
        <Button onClick={() => setShowNuevaCaja(true)}>
          <Plus className="size-4 mr-2" />
          Nueva Caja Chica
        </Button>
      </div>

      {/* Cards de Cajas */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : cajasChicas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sin cajas chicas. Crea la primera.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cajasChicas.map(c => (
            <Card
              key={c._dbId}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedCajaId === c._dbId ? 'border-primary' : ''}`}
              onClick={() => setSelectedCajaId(c._dbId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Wallet className="size-4 text-primary" />
                      <p className="font-medium text-sm">{c.nombre}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.id} · {c.responsable}</p>
                  </div>
                  <Badge className={`text-xs ${ESTADO_CAJA_COLORS[c.estado]}`}>
                    {c.estado.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Disponible</span>
                    <span className={c.porcentajeUsado > 80 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                      {fmt(c.montoDisponible)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(c.porcentajeUsado, 100)}
                    className={`h-2 ${c.porcentajeUsado > 80 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
                  />
                  <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                    <span>Asignado: {fmt(c.montoAsignado)}</span>
                    <span>{c.porcentajeUsado.toFixed(0)}% usado</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Panel de gastos de la caja seleccionada */}
      {selectedCaja && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">{selectedCaja.nombre} — Gastos</CardTitle>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>Total mes: <strong className="text-foreground">{fmt(kpisGastos.total)}</strong></span>
                {kpisGastos.pendientes > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertCircle className="size-3.5" />
                    {kpisGastos.pendientes} pendiente(s)
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" onClick={() => setShowNuevoGasto(true)}>
              <Plus className="size-4 mr-1" />
              Registrar Gasto
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {gastosDeCaja.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Sin gastos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Beneficiario</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosDeCaja.map(g => (
                      <TableRow key={g._dbId}>
                        <TableCell className="font-mono text-xs">{g.id}</TableCell>
                        <TableCell className="text-sm">{g.fecha}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{g.descripcion}</TableCell>
                        <TableCell className="text-sm">{g.categoria}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.beneficiario ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{fmt(g.monto)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {g.comprobanteNumero ?? '—'}
                          {g.comprobanteTipo && <span className="text-xs ml-1">({g.comprobanteTipo})</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${ESTADO_GASTO_COLORS[g.estado] ?? ''}`}>
                            {g.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {g.estado === 'pendiente' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-green-600 hover:text-green-700"
                                title="Aprobar"
                                onClick={() => handleAprobarGasto(g)}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-500 hover:text-red-600"
                                title="Rechazar"
                                onClick={() => handleRechazarGasto(g)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Nueva Caja */}
      <Dialog open={showNuevaCaja} onOpenChange={setShowNuevaCaja}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Caja Chica</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Caja Chica Administración"
                value={nuevaCajaForm.nombre}
                onChange={e => setNuevaCajaForm(f => ({ ...f, nombre: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Responsable *</Label>
              <Input
                placeholder="Nombre del responsable"
                value={nuevaCajaForm.responsable}
                onChange={e => setNuevaCajaForm(f => ({ ...f, responsable: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Monto Asignado (S/) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={nuevaCajaForm.montoAsignado}
                onChange={e => setNuevaCajaForm(f => ({ ...f, montoAsignado: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevaCaja(false)}>Cancelar</Button>
            <Button onClick={handleCrearCaja} disabled={saving}>{saving ? 'Creando...' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo Gasto */}
      <Dialog open={showNuevoGasto} onOpenChange={setShowNuevoGasto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Gasto — {selectedCaja?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Descripción *</Label>
              <Input
                placeholder="Descripción del gasto..."
                value={gastoForm.descripcion}
                onChange={e => setGastoForm(f => ({ ...f, descripcion: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría *</Label>
                <Input
                  placeholder="Ej: Limpieza, Útiles..."
                  value={gastoForm.categoria}
                  onChange={e => setGastoForm(f => ({ ...f, categoria: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={gastoForm.fecha}
                  onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Monto (S/) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={gastoForm.monto}
                onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Beneficiario</Label>
              <Input
                placeholder="Nombre del beneficiario o proveedor"
                value={gastoForm.beneficiario}
                onChange={e => setGastoForm(f => ({ ...f, beneficiario: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº Comprobante</Label>
                <Input
                  placeholder="Ej: B001-12345"
                  value={gastoForm.comprobanteNumero}
                  onChange={e => setGastoForm(f => ({ ...f, comprobanteNumero: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tipo Comprobante</Label>
                <Select value={gastoForm.comprobanteTipo || '_none'} onValueChange={v => setGastoForm(f => ({ ...f, comprobanteTipo: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin tipo</SelectItem>
                    <SelectItem value="boleta">Boleta</SelectItem>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="recibo">Recibo</SelectItem>
                    <SelectItem value="sin_comprobante">Sin comprobante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={gastoForm.notas}
                onChange={e => setGastoForm(f => ({ ...f, notas: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevoGasto(false)}>Cancelar</Button>
            <Button onClick={handleCrearGasto} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
