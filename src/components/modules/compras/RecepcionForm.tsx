import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Save, X, AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Alert, AlertDescription } from '../../ui/alert';
import { useRecepcionesStore, type NuevaRecepcionInput } from '../../../lib/compras/recepciones-store';
import { useOrdenesStore } from '../../../lib/compras/ordenes-store';
import { validarCantidadRecibida, validarObservaciones, type EstadoRecepcion } from '../../../lib/compras/recepciones-config';
import { formatearMonto } from '../../../lib/compras/ordenes-config';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';

interface RecepcionFormProps {
  ordenIdParam?: string;
  onCancel: () => void;
  onSuccess: (recepcionId: string) => void;
}

interface ItemRecibidoForm {
  descripcion: string;
  cantidadOrdenada: number;
  cantidadRecibida: number;
  unidad: string;
  observacionItem: string;
}

export function RecepcionForm({ ordenIdParam, onCancel, onSuccess }: RecepcionFormProps) {
  const { crearRecepcion } = useRecepcionesStore();
  const { obtenerOrdenPorId, aplicarEstadoRecepcion } = useOrdenesStore();

  const orden = ordenIdParam ? obtenerOrdenPorId(ordenIdParam) : undefined;

  const [estado, setEstado] = useState<EstadoRecepcion>('conforme');
  const [observaciones, setObservaciones] = useState('');
  const [itemsRecibidos, setItemsRecibidos] = useState<ItemRecibidoForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [centroCostoId, setCentroCostoId] = useState<string | null>(null);

  // Cargar items de la orden
  useEffect(() => {
    if (orden) {
      setItemsRecibidos(
        orden.items.map(item => ({
          descripcion: item.descripcion,
          cantidadOrdenada: item.cantidad,
          cantidadRecibida: item.cantidad, // Por defecto, recibe todo
          unidad: item.unidad,
          observacionItem: ''
        }))
      );
    }
  }, [orden]);

  // Validar recepción completa o parcial
  const esRecepcionCompleta = useMemo(() => {
    return itemsRecibidos.every(item => item.cantidadRecibida >= item.cantidadOrdenada);
  }, [itemsRecibidos]);

  // Validación
  const validarFormulario = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!ordenIdParam) {
      newErrors.orden = 'Debe seleccionar una orden';
    }

    if (estado === 'observada' && !observaciones.trim()) {
      const validacion = validarObservaciones(observaciones, true);
      if (!validacion.valid) {
        newErrors.observaciones = validacion.error!;
      }
    }

    if (itemsRecibidos.length === 0) {
      newErrors.items = 'Debe tener al menos un item para recepcionar';
    } else {
      const hayAlMenosUno = itemsRecibidos.some(item => item.cantidadRecibida > 0);
      if (!hayAlMenosUno) {
        newErrors.items = 'Al menos un item debe tener cantidad recibida mayor a 0';
      }

      itemsRecibidos.forEach((item, idx) => {
        const validacion = validarCantidadRecibida(item.cantidadRecibida, item.cantidadOrdenada);
        if (!validacion.valid) {
          newErrors[`item-${idx}`] = validacion.error!;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Actualizar item
  const actualizarItem = (index: number, field: keyof ItemRecibidoForm, value: string | number) => {
    const nuevos = [...itemsRecibidos];
    (nuevos[index] as any)[field] = value;
    setItemsRecibidos(nuevos);
    // Clear errors for this item
    if (errors[`item-${index}`]) {
      setErrors(prev => { const n = { ...prev }; delete n[`item-${index}`]; delete n['items']; return n; });
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!validarFormulario()) {
      toast.error('Por favor, corrige los errores del formulario');
      return;
    }

    if (!orden) {
      toast.error('No se encontró la orden');
      return;
    }

    try {
      const input: NuevaRecepcionInput = {
        ordenId: orden.id,
        itemsRecibidos: itemsRecibidos.map(item => ({
          descripcion: item.descripcion,
          cantidadRecibida: item.cantidadRecibida,
          unidad: item.unidad,
          observacionItem: item.observacionItem.trim() || null
        })),
        estado,
        observaciones: observaciones.trim() || undefined,
        proyectoId: proyectoId ?? undefined,
        centroCostoId: centroCostoId ?? undefined,
      };

      // Callback para actualizar el estado de la orden
      const onOrdenUpdated = async (ordenId: string, esCompleta: boolean) => {
        await aplicarEstadoRecepcion(ordenId, esCompleta);
      };

      const res = await crearRecepcion(input, onOrdenUpdated);
      if (!res.exito || !res.recepcion) {
        console.error('Error al crear recepción:', res.errores);
        return;
      }
      onSuccess(res.recepcion.id);
    } catch (error) {
      console.error('Error al crear recepción:', error);
    }
  };

  if (!orden) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No se encontró la orden con ID: <strong>{ordenIdParam}</strong>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <PageNav onBack={onCancel} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Package className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Nueva Recepción</h2>
            <p className="text-muted-foreground mt-1">
              Registrar recepción para orden {orden.id}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onCancel} className="border border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          <X className="size-4" />
          Cancelar
        </Button>
      </div>

      {/* Info de la orden */}
      <Alert>
        <AlertDescription>
          <strong>Orden:</strong> {orden.id} | <strong>Proveedor:</strong> {orden.proveedorNombre} | 
          <strong> Total:</strong> {formatearMonto(orden.total, orden.moneda)}
        </AlertDescription>
      </Alert>

      {/* Estado de recepción */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de la Recepción</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={estado} onValueChange={(v) => setEstado(v as EstadoRecepcion)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="conforme" id="conforme" />
              <Label htmlFor="conforme">Conforme - Recepción sin observaciones</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="observada" id="observada" />
              <Label htmlFor="observada">Observada - Recepción con observaciones</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items Recibidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.items && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{errors.items}</AlertDescription>
            </Alert>
          )}
          {itemsRecibidos.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{item.descripcion}</p>
                  <p className="text-sm text-muted-foreground">
                    Ordenado: {item.cantidadOrdenada} {item.unidad}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`item-${idx}-cantidadRecibida`}>Cantidad Recibida *</Label>
                  <Input
                    id={`item-${idx}-cantidadRecibida`}
                    type="number"
                    min="0"
                    max={item.cantidadOrdenada}
                    value={item.cantidadRecibida}
                    onChange={(e) => actualizarItem(idx, 'cantidadRecibida', Number(e.target.value))}
                  />
                  {errors[`item-${idx}`] && (
                    <p className="text-sm text-red-600 mt-1">{errors[`item-${idx}`]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`item-${idx}-observacionItem`}>Observación del Item</Label>
                  <Input
                    id={`item-${idx}-observacionItem`}
                    value={item.observacionItem}
                    onChange={(e) => actualizarItem(idx, 'observacionItem', e.target.value)}
                    placeholder="Ej: Empaque dañado"
                  />
                </div>
              </div>
            </div>
          ))}

          {!esRecepcionCompleta && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Esta será una <strong>recepción parcial</strong>. 
                No todos los items fueron recibidos en su totalidad.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Observaciones generales */}
      <Card>
        <CardHeader>
          <CardTitle>Observaciones Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observaciones}
            onChange={(e) => { setObservaciones(e.target.value); if (errors.observaciones) setErrors(prev => ({ ...prev, observaciones: '' })); }}
            rows={4}
            placeholder="Observaciones sobre la recepción..."
          />
          {errors.observaciones && (
            <p className="text-sm text-red-600 mt-1">{errors.observaciones}</p>
          )}
        </CardContent>
      </Card>

      {/* Imputación: Proyecto y Centro de Costo */}
      <Card>
        <CardHeader>
          <CardTitle>Imputación (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Proyecto</Label>
              <ProyectoSelector value={proyectoId} onChange={setProyectoId} nullable className="mt-1" />
            </div>
            <div>
              <Label>Centro de Costo</Label>
              <CentroCostoSelector value={centroCostoId} onChange={setCentroCostoId} nullable className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          <ArrowLeft className="size-4" />
          Cancelar
        </Button>
        <Button onClick={handleSubmit}>
          <Save className="size-4" />
          Crear Recepción
        </Button>
      </div>
    </div>
  );
}
