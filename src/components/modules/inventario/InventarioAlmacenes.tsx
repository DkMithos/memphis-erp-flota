import { useState } from 'react';
import { Plus, Edit, Warehouse } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { Label } from '../../ui/label';
import { toast } from 'sonner';
import { useInventarioStore } from '../../../lib/inventario/inventario-store';
import type { Almacen } from '../../../lib/inventario/inventario-store';

interface Props {
  onNavigate: (route: string) => void;
}

type TipoAlmacen = Almacen['tipo'];

const TIPOS_ALMACEN: { value: TipoAlmacen; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'repuestos', label: 'Repuestos' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'herramientas', label: 'Herramientas' },
  { value: 'consumibles', label: 'Consumibles' },
];

function TipoAlmacenBadge({ tipo }: { tipo: TipoAlmacen }) {
  const map: Record<TipoAlmacen, string> = {
    general: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    repuestos: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    suministros: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    herramientas: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    consumibles: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };
  const label = TIPOS_ALMACEN.find(t => t.value === tipo)?.label ?? tipo;
  return <Badge className={`${map[tipo]} hover:${map[tipo]}`}>{label}</Badge>;
}

interface FormState {
  nombre: string;
  tipo: TipoAlmacen;
  ubicacion: string;
  responsable: string;
  estado: 'activo' | 'inactivo';
}

const FORM_EMPTY: FormState = {
  nombre: '',
  tipo: 'general',
  ubicacion: '',
  responsable: '',
  estado: 'activo',
};

export function InventarioAlmacenes({ onNavigate: _onNavigate }: Props) {
  const { almacenes, loading, crearAlmacen, actualizarAlmacen } = useInventarioStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [almacenSel, setAlmacenSel] = useState<Almacen | null>(null);
  const [form, setForm] = useState<FormState>(FORM_EMPTY);
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    setEditando(false);
    setAlmacenSel(null);
    setForm(FORM_EMPTY);
    setDialogOpen(true);
  };

  const abrirEditar = (a: Almacen) => {
    setEditando(true);
    setAlmacenSel(a);
    setForm({
      nombre: a.nombre,
      tipo: a.tipo,
      ubicacion: a.ubicacion ?? '',
      responsable: a.responsable ?? '',
      estado: a.estado,
    });
    setDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setGuardando(true);
    try {
      const data = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        ubicacion: form.ubicacion.trim() || undefined,
        responsable: form.responsable.trim() || undefined,
        estado: form.estado,
      };
      if (editando && almacenSel) {
        const result = await actualizarAlmacen(almacenSel._dbId, data);
        if (result.exito) { toast.success('Almacén actualizado'); setDialogOpen(false); }
        else toast.error('Error al actualizar');
      } else {
        await crearAlmacen(data);
        toast.success('Almacén creado');
        setDialogOpen(false);
      }
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
        Cargando almacenes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Almacenes</h2>
          <p className="text-muted-foreground mt-1">{almacenes.length} almacén(es) registrado(s)</p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo Almacén
        </Button>
      </div>

      {/* Cards */}
      {almacenes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No hay almacenes registrados. Cree el primero.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {almacenes.map(a => (
            <Card key={a._dbId} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Warehouse className="size-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{a.nombre}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.id}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => abrirEditar(a)}>
                  <Edit className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <TipoAlmacenBadge tipo={a.tipo} />
                  <Badge variant={a.estado === 'activo' ? 'default' : 'secondary'}>
                    {a.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {a.ubicacion && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Ubicación:</span> {a.ubicacion}
                  </p>
                )}
                {a.responsable && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Responsable:</span> {a.responsable}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Almacén' : 'Nuevo Almacén'}</DialogTitle>
            <DialogDescription>
              {editando ? `Editando: ${almacenSel?.id}` : 'Complete los datos del nuevo almacén'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => f('nombre', e.target.value)} placeholder="Nombre del almacén" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => f('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ALMACEN.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ubicación</Label>
              <Input value={form.ubicacion} onChange={e => f('ubicacion', e.target.value)} placeholder="Ej: Piso 2, Sector B" />
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Input value={form.responsable} onChange={e => f('responsable', e.target.value)} placeholder="Nombre del responsable" />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => f('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear Almacén'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
