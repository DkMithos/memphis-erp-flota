import { useState, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { toast } from 'sonner';
import { useInventarioStore } from '../../../lib/inventario/inventario-store';
import type { Movimiento, NuevoMovimientoInput } from '../../../lib/inventario/inventario-store';

interface Props {
  onNavigate: (route: string) => void;
}

type TipoMovimiento = Movimiento['tipo'];
type MotivoMovimiento = Movimiento['motivo'];

const MOTIVOS_POR_TIPO: Record<TipoMovimiento, MotivoMovimiento[]> = {
  entrada: ['compra', 'devolucion', 'inicial'],
  salida: ['consumo', 'mantenimiento', 'merma'],
  ajuste: ['ajuste_positivo', 'ajuste_negativo'],
  transferencia: ['transferencia_entrada', 'transferencia_salida'],
};

const LABELS_MOTIVO: Record<MotivoMovimiento, string> = {
  compra: 'Compra',
  devolucion: 'Devolución',
  consumo: 'Consumo',
  mantenimiento: 'Mantenimiento',
  ajuste_positivo: 'Ajuste positivo',
  ajuste_negativo: 'Ajuste negativo',
  transferencia_entrada: 'Transferencia entrada',
  transferencia_salida: 'Transferencia salida',
  merma: 'Merma',
  inicial: 'Stock inicial',
};

function TipoBadge({ tipo }: { tipo: TipoMovimiento }) {
  if (tipo === 'entrada') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Entrada</Badge>;
  if (tipo === 'salida') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">Salida</Badge>;
  if (tipo === 'ajuste') return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">Ajuste</Badge>;
  return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100">Transferencia</Badge>;
}

interface FormState {
  articuloDbId: string;
  almacenDbId: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: string;
  precioUnitario: string;
  notas: string;
  referenciaId: string;
}

const FORM_EMPTY: FormState = {
  articuloDbId: '',
  almacenDbId: '',
  tipo: 'entrada',
  motivo: 'compra',
  cantidad: '',
  precioUnitario: '',
  notas: '',
  referenciaId: '',
};

export function InventarioMovimientos({ onNavigate: _onNavigate }: Props) {
  const { movimientos, articulos, almacenes, loading, registrarMovimiento } = useInventarioStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [dialogNuevo, setDialogNuevo] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_EMPTY);
  const [guardando, setGuardando] = useState(false);

  const articuloSeleccionado = useMemo(
    () => articulos.find(a => a._dbId === form.articuloDbId),
    [articulos, form.articuloDbId]
  );

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (fechaDesde && m.fecha < fechaDesde) return false;
      if (fechaHasta && m.fecha > fechaHasta + 'T23:59:59') return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !m.articuloNombre.toLowerCase().includes(q) &&
          !m.articuloId.toLowerCase().includes(q) &&
          !m.id.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [movimientos, filtroTipo, busqueda, fechaDesde, fechaHasta]);

  const handleTipoChange = (tipo: TipoMovimiento) => {
    const motivos = MOTIVOS_POR_TIPO[tipo];
    setForm(prev => ({ ...prev, tipo, motivo: motivos[0] }));
  };

  const handleGuardar = async () => {
    if (!form.articuloDbId) { toast.error('Seleccione un artículo'); return; }
    if (!form.almacenDbId) { toast.error('Seleccione un almacén'); return; }
    const cantidad = parseFloat(form.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if ((form.tipo === 'salida' || form.motivo === 'ajuste_negativo') && articuloSeleccionado) {
      if (cantidad > articuloSeleccionado.stockActual) {
        toast.error(`Stock insuficiente. Disponible: ${articuloSeleccionado.stockActual}`);
        return;
      }
    }

    setGuardando(true);
    try {
      const articulo = articulos.find(a => a._dbId === form.articuloDbId)!;
      const almacen = almacenes.find(a => a._dbId === form.almacenDbId)!;
      const input: NuevoMovimientoInput = {
        articuloId: articulo.id,
        articuloDbId: form.articuloDbId,
        almacenId: almacen.id,
        almacenDbId: form.almacenDbId,
        tipo: form.tipo,
        motivo: form.motivo,
        cantidad,
        precioUnitario: form.precioUnitario ? parseFloat(form.precioUnitario) : undefined,
        notas: form.notas.trim() || undefined,
        referenciaId: form.referenciaId.trim() || undefined,
        referenciaTipo: form.referenciaId.trim() ? 'manual' : undefined,
      };
      await registrarMovimiento(input);
      toast.success('Movimiento registrado');
      setDialogNuevo(false);
      setForm(FORM_EMPTY);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  const f = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando movimientos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Movimientos de Inventario</h2>
          <p className="text-muted-foreground mt-1">{movimientos.length} movimientos registrados</p>
        </div>
        <Button onClick={() => { setForm(FORM_EMPTY); setDialogNuevo(true); }}>
          <Plus className="size-4" />
          Registrar Movimiento
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar artículo o número..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="salida">Salida</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Desde</Label>
              <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="w-[140px]" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Hasta</Label>
              <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="w-[140px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Ant. → Nuevo</TableHead>
                <TableHead>Realizado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    No se encontraron movimientos
                  </TableCell>
                </TableRow>
              )}
              {movimientosFiltrados.map(m => (
                <TableRow key={m._dbId}>
                  <TableCell className="font-medium text-xs">{m.id}</TableCell>
                  <TableCell className="text-xs">{new Date(m.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                  <TableCell className="text-sm">
                    <div>{m.articuloNombre}</div>
                    <div className="text-xs text-muted-foreground">{m.articuloId}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.almacenNombre}</TableCell>
                  <TableCell><TipoBadge tipo={m.tipo} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{LABELS_MOTIVO[m.motivo]}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    <span className={m.tipo === 'entrada' || m.motivo === 'ajuste_positivo' ? 'text-green-600' : 'text-red-600'}>
                      {m.tipo === 'entrada' || m.motivo === 'ajuste_positivo' ? '+' : '-'}{m.cantidad}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="text-muted-foreground">{m.stockAnterior}</span>
                    <span className="mx-1">→</span>
                    <span className="font-semibold">{m.stockNuevo}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {m.realizadoPor ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Nuevo Movimiento */}
      <Dialog open={dialogNuevo} onOpenChange={setDialogNuevo}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>Registre una entrada, salida o ajuste de inventario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Artículo *</Label>
              <Select value={form.articuloDbId || 'ninguno'} onValueChange={v => f('articuloDbId', v === 'ninguno' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar artículo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">— Seleccionar —</SelectItem>
                  {articulos.filter(a => a.activo).map(a => (
                    <SelectItem key={a._dbId} value={a._dbId}>{a.id} — {a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {articuloSeleccionado && (
                <p className="text-xs text-muted-foreground">
                  Stock actual: <span className="font-semibold">{articuloSeleccionado.stockActual} {articuloSeleccionado.unidadMedida}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Almacén *</Label>
              <Select value={form.almacenDbId || 'ninguno'} onValueChange={v => f('almacenDbId', v === 'ninguno' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">— Seleccionar —</SelectItem>
                  {almacenes.filter(a => a.estado === 'activo').map(a => (
                    <SelectItem key={a._dbId} value={a._dbId}>{a.id} — {a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => handleTipoChange(v as TipoMovimiento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="salida">Salida</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <Select value={form.motivo} onValueChange={v => f('motivo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_POR_TIPO[form.tipo].map(m => (
                      <SelectItem key={m} value={m}>{LABELS_MOTIVO[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cantidad *</Label>
                <Input
                  type="number" min="0.001" step="0.001"
                  value={form.cantidad} onChange={e => f('cantidad', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Precio Unitario (opcional)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.precioUnitario} onChange={e => f('precioUnitario', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Referencia (OC, OT, etc.)</Label>
              <Input value={form.referenciaId} onChange={e => f('referenciaId', e.target.value)} placeholder="Ej: OC-2024-0023" />
            </div>

            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2} placeholder="Observaciones adicionales" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogNuevo(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Registrando...' : 'Registrar Movimiento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
