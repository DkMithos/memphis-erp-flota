import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Edit, Package } from 'lucide-react';
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
import type { Articulo, EstadoStock } from '../../../lib/inventario/inventario-store';

interface Props {
  onNavigate: (route: string) => void;
}

type FiltroEstado = 'todos' | EstadoStock;

function EstadoStockBadge({ estado }: { estado: EstadoStock }) {
  if (estado === 'normal') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Normal</Badge>;
  if (estado === 'bajo') return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Bajo</Badge>;
  if (estado === 'critico') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Crítico</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Sobrestock</Badge>;
}

function TipoBadge({ tipo }: { tipo: Articulo['tipo'] }) {
  const map: Record<Articulo['tipo'], string> = {
    repuesto: 'bg-purple-100 text-purple-800',
    suministro: 'bg-blue-100 text-blue-800',
    herramienta: 'bg-yellow-100 text-yellow-800',
    consumible: 'bg-gray-100 text-gray-800',
    equipo: 'bg-teal-100 text-teal-800',
  };
  const labels: Record<Articulo['tipo'], string> = {
    repuesto: 'Repuesto',
    suministro: 'Suministro',
    herramienta: 'Herramienta',
    consumible: 'Consumible',
    equipo: 'Equipo',
  };
  return <Badge className={`${map[tipo]} hover:${map[tipo]}`}>{labels[tipo]}</Badge>;
}

const UNIDADES: Articulo['unidadMedida'][] = ['unidad', 'kg', 'litro', 'metro', 'caja', 'par', 'juego', 'rollo', 'galón'];
const TIPOS: Articulo['tipo'][] = ['repuesto', 'suministro', 'herramienta', 'consumible', 'equipo'];

interface FormState {
  nombre: string;
  descripcion: string;
  categoriaDbId: string;
  unidadMedida: Articulo['unidadMedida'];
  tipo: Articulo['tipo'];
  stockActual: string;
  stockMinimo: string;
  stockMaximo: string;
  precioUnitario: string;
  moneda: string;
  marca: string;
  modelo: string;
  codigoFabricante: string;
  activo: boolean;
}

const FORM_EMPTY: FormState = {
  nombre: '',
  descripcion: '',
  categoriaDbId: '',
  unidadMedida: 'unidad',
  tipo: 'suministro',
  stockActual: '0',
  stockMinimo: '0',
  stockMaximo: '',
  precioUnitario: '',
  moneda: 'PEN',
  marca: '',
  modelo: '',
  codigoFabricante: '',
  activo: true,
};

export function InventarioArticulos({ onNavigate: _onNavigate }: Props) {
  const { articulos, categorias, movimientos, loading, crearArticulo, actualizarArticulo, cargarKardex } = useInventarioStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');

  const [dialogNuevo, setDialogNuevo] = useState(false);
  const [dialogDetalle, setDialogDetalle] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null);
  const [kardex, setKardex] = useState<ReturnType<typeof useInventarioStore>['movimientos']>([]);
  const [loadingKardex, setLoadingKardex] = useState(false);

  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_EMPTY);
  const [guardando, setGuardando] = useState(false);

  const articulosFiltrados = useMemo(() => {
    return articulos.filter(a => {
      if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false;
      if (filtroCategoria !== 'todos' && a.categoriaDbId !== filtroCategoria) return false;
      if (filtroEstado !== 'todos' && a.estadoStock !== filtroEstado) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!a.nombre.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [articulos, filtroTipo, filtroCategoria, filtroEstado, busqueda]);

  const abrirDetalle = async (a: Articulo) => {
    setArticuloSeleccionado(a);
    setDialogDetalle(true);
    setLoadingKardex(true);
    const k = await cargarKardex(a._dbId);
    setKardex(k.slice(0, 10));
    setLoadingKardex(false);
  };

  const abrirEditar = (a: Articulo) => {
    setArticuloSeleccionado(a);
    setForm({
      nombre: a.nombre,
      descripcion: a.descripcion ?? '',
      categoriaDbId: a.categoriaDbId ?? '',
      unidadMedida: a.unidadMedida,
      tipo: a.tipo,
      stockActual: String(a.stockActual),
      stockMinimo: String(a.stockMinimo),
      stockMaximo: a.stockMaximo != null ? String(a.stockMaximo) : '',
      precioUnitario: a.precioUnitario != null ? String(a.precioUnitario) : '',
      moneda: a.moneda,
      marca: a.marca ?? '',
      modelo: a.modelo ?? '',
      codigoFabricante: a.codigoFabricante ?? '',
      activo: a.activo,
    });
    setEditando(true);
    setDialogNuevo(true);
  };

  const abrirNuevo = () => {
    setEditando(false);
    setArticuloSeleccionado(null);
    setForm(FORM_EMPTY);
    setDialogNuevo(true);
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setGuardando(true);
    try {
      const catSeleccionada = categorias.find(c => c._dbId === form.categoriaDbId);
      const data = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        categoriaDbId: form.categoriaDbId || undefined,
        categoriaNombre: catSeleccionada?.nombre,
        unidadMedida: form.unidadMedida,
        tipo: form.tipo,
        stockActual: parseFloat(form.stockActual) || 0,
        stockMinimo: parseFloat(form.stockMinimo) || 0,
        stockMaximo: form.stockMaximo ? parseFloat(form.stockMaximo) : undefined,
        precioUnitario: form.precioUnitario ? parseFloat(form.precioUnitario) : undefined,
        moneda: form.moneda,
        marca: form.marca.trim() || undefined,
        modelo: form.modelo.trim() || undefined,
        codigoFabricante: form.codigoFabricante.trim() || undefined,
        activo: form.activo,
      };

      if (editando && articuloSeleccionado) {
        const result = await actualizarArticulo(articuloSeleccionado._dbId, data);
        if (result.exito) {
          toast.success('Artículo actualizado');
          setDialogNuevo(false);
        } else {
          toast.error('Error al actualizar');
        }
      } else {
        await crearArticulo(data);
        toast.success('Artículo creado');
        setDialogNuevo(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  const f = (field: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando artículos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Artículos</h2>
          <p className="text-muted-foreground mt-1">{articulos.length} artículos en catálogo</p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="size-4 mr-2" />
          Nuevo Artículo
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o nombre..."
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
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {categorias.map(c => <SelectItem key={c._dbId} value={c._dbId}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={v => setFiltroEstado(v as FiltroEstado)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bajo">Bajo mínimo</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
                <SelectItem value="sobrestock">Sobrestock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-right">Stock Mín</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="w-[90px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articulosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    No se encontraron artículos
                  </TableCell>
                </TableRow>
              )}
              {articulosFiltrados.map(a => (
                <TableRow key={a._dbId}>
                  <TableCell className="font-medium text-sm">{a.id}</TableCell>
                  <TableCell className="text-sm">{a.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.categoriaNombre ?? '—'}</TableCell>
                  <TableCell><TipoBadge tipo={a.tipo} /></TableCell>
                  <TableCell className="text-right text-sm font-semibold">{a.stockActual} <span className="font-normal text-muted-foreground">{a.unidadMedida}</span></TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{a.stockMinimo}</TableCell>
                  <TableCell><EstadoStockBadge estado={a.estadoStock} /></TableCell>
                  <TableCell className="text-right text-sm">
                    {a.precioUnitario != null ? `S/ ${a.precioUnitario.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirDetalle(a)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => abrirEditar(a)}>
                        <Edit className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Nuevo / Editar */}
      <Dialog open={dialogNuevo} onOpenChange={setDialogNuevo}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Artículo' : 'Nuevo Artículo'}</DialogTitle>
            <DialogDescription>
              {editando ? `Editando: ${articuloSeleccionado?.id}` : 'Complete los datos del nuevo artículo'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => f('nombre', e.target.value)} placeholder="Nombre del artículo" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => f('descripcion', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => f('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Unidad de Medida *</Label>
              <Select value={form.unidadMedida} onValueChange={v => f('unidadMedida', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={form.categoriaDbId || 'ninguna'} onValueChange={v => f('categoriaDbId', v === 'ninguna' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Sin categoría</SelectItem>
                  {categorias.map(c => <SelectItem key={c._dbId} value={c._dbId}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={form.moneda} onValueChange={v => f('moneda', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">PEN (S/)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Stock Actual</Label>
              <Input type="number" min="0" step="0.001" value={form.stockActual} onChange={e => f('stockActual', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Stock Mínimo</Label>
              <Input type="number" min="0" step="0.001" value={form.stockMinimo} onChange={e => f('stockMinimo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Stock Máximo (opcional)</Label>
              <Input type="number" min="0" step="0.001" value={form.stockMaximo} onChange={e => f('stockMaximo', e.target.value)} placeholder="Sin límite" />
            </div>
            <div className="space-y-1">
              <Label>Precio Unitario (opcional)</Label>
              <Input type="number" min="0" step="0.01" value={form.precioUnitario} onChange={e => f('precioUnitario', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <Input value={form.marca} onChange={e => f('marca', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={e => f('modelo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Código Fabricante</Label>
              <Input value={form.codigoFabricante} onChange={e => f('codigoFabricante', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogNuevo(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear Artículo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle */}
      <Dialog open={dialogDetalle} onOpenChange={setDialogDetalle}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5" />
              {articuloSeleccionado?.nombre}
            </DialogTitle>
            <DialogDescription>Código: {articuloSeleccionado?.id}</DialogDescription>
          </DialogHeader>
          {articuloSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><Label className="text-muted-foreground text-xs">Tipo</Label><p className="mt-0.5"><TipoBadge tipo={articuloSeleccionado.tipo} /></p></div>
                <div><Label className="text-muted-foreground text-xs">Unidad</Label><p className="mt-0.5">{articuloSeleccionado.unidadMedida}</p></div>
                <div><Label className="text-muted-foreground text-xs">Categoría</Label><p className="mt-0.5">{articuloSeleccionado.categoriaNombre ?? '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Stock Actual</Label><p className="mt-0.5 text-xl font-semibold">{articuloSeleccionado.stockActual}</p></div>
                <div><Label className="text-muted-foreground text-xs">Stock Mínimo</Label><p className="mt-0.5">{articuloSeleccionado.stockMinimo}</p></div>
                <div><Label className="text-muted-foreground text-xs">Stock Máximo</Label><p className="mt-0.5">{articuloSeleccionado.stockMaximo ?? '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Precio Unit.</Label><p className="mt-0.5">{articuloSeleccionado.precioUnitario != null ? `S/ ${articuloSeleccionado.precioUnitario.toFixed(2)}` : '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Valor Total</Label><p className="mt-0.5 font-semibold">{articuloSeleccionado.valorTotal != null ? `S/ ${articuloSeleccionado.valorTotal.toFixed(2)}` : '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Estado</Label><p className="mt-0.5"><EstadoStockBadge estado={articuloSeleccionado.estadoStock} /></p></div>
                {articuloSeleccionado.marca && <div><Label className="text-muted-foreground text-xs">Marca</Label><p className="mt-0.5">{articuloSeleccionado.marca}</p></div>}
                {articuloSeleccionado.modelo && <div><Label className="text-muted-foreground text-xs">Modelo</Label><p className="mt-0.5">{articuloSeleccionado.modelo}</p></div>}
                {articuloSeleccionado.codigoFabricante && <div><Label className="text-muted-foreground text-xs">Cód. Fabricante</Label><p className="mt-0.5">{articuloSeleccionado.codigoFabricante}</p></div>}
              </div>

              <div>
                <h4 className="font-medium mb-2 text-sm">Últimos movimientos (kardex)</h4>
                {loadingKardex ? (
                  <p className="text-sm text-muted-foreground">Cargando...</p>
                ) : kardex.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin movimientos registrados</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Stock Ant.</TableHead>
                        <TableHead className="text-right">Stock Nuevo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kardex.map(m => (
                        <TableRow key={m._dbId}>
                          <TableCell className="text-xs font-medium">{m.id}</TableCell>
                          <TableCell className="text-xs">{new Date(m.fecha).toLocaleDateString('es-PE')}</TableCell>
                          <TableCell>
                            <Badge variant={m.tipo === 'entrada' ? 'default' : m.tipo === 'salida' ? 'destructive' : 'secondary'} className="text-xs">
                              {m.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.motivo}</TableCell>
                          <TableCell className="text-right text-xs">{m.tipo === 'salida' ? `-${m.cantidad}` : `+${m.cantidad}`}</TableCell>
                          <TableCell className="text-right text-xs">{m.stockAnterior}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{m.stockNuevo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogDetalle(false)}>Cerrar</Button>
            {articuloSeleccionado && (
              <Button onClick={() => { setDialogDetalle(false); abrirEditar(articuloSeleccionado); }}>
                <Edit className="size-4 mr-2" />Editar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
