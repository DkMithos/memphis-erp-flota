import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, X, Plus, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import { useOrdenesStore, type NuevaOrdenInput } from '../../../lib/compras/ordenes-store';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import {
  ORDEN_TIPO_LABELS,
  ORDEN_MONEDA_LABELS,
  puedeEditarOrden,
  calcularTotales,
  validarCondiciones,
  type TipoOrden,
  type MonedaOrden
} from '../../../lib/compras/ordenes-config';

interface OrdenFormProps {
  ordenId?: string; // Para editar
  cotizacionIdParam?: string; // Para crear desde cotización
  tipoParam?: TipoOrden; // Tipo inicial (oc/os)
  onCancel: () => void;
  onSuccess: (ordenId: string) => void;
}

interface ItemForm {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
}

export function OrdenForm({ ordenId, cotizacionIdParam, tipoParam, onCancel, onSuccess }: OrdenFormProps) {
  const { crearOrdenDesdeCotizacion, actualizarOrden, obtenerOrdenPorId } = useOrdenesStore();
  const { cotizaciones } = useCotizacionesStore();

  const isEditing = Boolean(ordenId);
  const ordenExistente = isEditing ? obtenerOrdenPorId(ordenId!) : undefined;

  // Cargar cotización si viene de parámetro
  const cotizacionPrefill = cotizacionIdParam 
    ? cotizaciones.find(c => c.id === cotizacionIdParam) 
    : undefined;

  // Estado del formulario
  const [tipo, setTipo] = useState<TipoOrden>(
    ordenExistente?.tipo || tipoParam || cotizacionPrefill?.tipo || 'oc'
  );
  const [cotizacionId, setCotizacionId] = useState(
    ordenExistente?.cotizacionId || cotizacionIdParam || ''
  );
  const [proveedorNombre, setProveedorNombre] = useState(
    ordenExistente?.proveedorNombre || cotizacionPrefill?.proveedorNombre || ''
  );
  const [moneda, setMoneda] = useState<MonedaOrden>(
    ordenExistente?.moneda || cotizacionPrefill?.moneda || 'PEN'
  );
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState(
    ordenExistente?.fechaEntregaEstimada?.split('T')[0] || ''
  );
  const [condiciones, setCondiciones] = useState(
    ordenExistente?.condiciones || cotizacionPrefill?.condiciones || ''
  );
  const [items, setItems] = useState<ItemForm[]>(
    ordenExistente?.items || cotizacionPrefill?.items || [
      { descripcion: '', cantidad: 1, unidad: '', precioUnitario: 0 }
    ]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcular totales en tiempo real
  const totales = useMemo(() => {
    return calcularTotales(items);
  }, [items]);

  // Verificar si puede editar
  const puedeEditar = !isEditing || (ordenExistente && puedeEditarOrden(ordenExistente.estado));

  // Validación
  const validarFormulario = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!cotizacionId) {
      newErrors.cotizacionId = 'Debe seleccionar una cotización';
    }

    if (!proveedorNombre.trim()) {
      newErrors.proveedorNombre = 'El nombre del proveedor es obligatorio';
    }

    if (items.length === 0) {
      newErrors.items = 'Debe agregar al menos un item';
    }

    items.forEach((item, idx) => {
      if (!item.descripcion.trim()) {
        newErrors[`item-${idx}-descripcion`] = 'La descripción es obligatoria';
      }
      if (item.cantidad <= 0) {
        newErrors[`item-${idx}-cantidad`] = 'La cantidad debe ser mayor a 0';
      }
      if (!item.unidad.trim()) {
        newErrors[`item-${idx}-unidad`] = 'La unidad es obligatoria';
      }
      if (item.precioUnitario < 0) {
        newErrors[`item-${idx}-precio`] = 'El precio no puede ser negativo';
      }
    });

    if (condiciones.trim()) {
      const validacionCondiciones = validarCondiciones(condiciones);
      if (!validacionCondiciones.valid) {
        newErrors.condiciones = validacionCondiciones.error!;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers de items
  const agregarItem = () => {
    setItems([...items, { descripcion: '', cantidad: 1, unidad: '', precioUnitario: 0 }]);
  };

  const removerItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const actualizarItem = (index: number, field: keyof ItemForm, value: string | number) => {
    const nuevosItems = [...items];
    (nuevosItems[index] as any)[field] = value;
    setItems(nuevosItems);
  };

  // Submit
  const handleSubmit = async () => {
    if (!validarFormulario()) {
      return;
    }

    try {
      if (isEditing && ordenExistente) {
        const res = await actualizarOrden(ordenExistente.id, {
          proveedorNombre: proveedorNombre.trim(),
          moneda,
          fechaEntregaEstimada: fechaEntregaEstimada || undefined,
          condiciones: condiciones.trim() || undefined,
          items: items.map(item => ({
            descripcion: item.descripcion.trim(),
            cantidad: item.cantidad,
            unidad: item.unidad.trim(),
            precioUnitario: item.precioUnitario
          }))
        });
        if (!res.exito) {
          console.error('Error al actualizar orden:', res.errores);
          return;
        }
        onSuccess(ordenExistente.id);
      } else {
        const nuevaOrdenInput: NuevaOrdenInput = {
          tipo,
          cotizacionId,
          proveedorNombre: proveedorNombre.trim(),
          moneda,
          items: items.map(item => ({
            descripcion: item.descripcion.trim(),
            cantidad: item.cantidad,
            unidad: item.unidad.trim(),
            precioUnitario: item.precioUnitario
          })),
          fechaEntregaEstimada: fechaEntregaEstimada || undefined,
          condiciones: condiciones.trim() || undefined
        };

        const res = await crearOrdenDesdeCotizacion(nuevaOrdenInput);
        if (!res.exito || !res.orden) {
          console.error('Error al crear orden:', res.errores);
          return;
        }
        onSuccess(res.orden.id);
      }
    } catch (error) {
      console.error('Error al guardar orden:', error);
    }
  };

  // Si está editando y no puede editar, mostrar mensaje
  if (isEditing && !puedeEditar) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              No puede editar esta orden porque su estado no lo permite. 
              Solo se pueden editar órdenes en estado <strong>Borrador</strong>.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={onCancel}>
              <ArrowLeft className="size-4 mr-2" />
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>{isEditing ? `Editar Orden ${ordenExistente?.id}` : 'Nueva Orden de Compra/Servicio'}</h2>
          <p className="text-muted-foreground mt-1">
            {isEditing ? 'Modificar datos de la orden' : 'Crear orden desde cotización aprobada'}
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          <X className="size-4 mr-2" />
          Cancelar
        </Button>
      </div>

      {/* Info de cotización si viene de parámetro */}
      {cotizacionPrefill && !isEditing && (
        <Alert>
          <FileText className="size-4" />
          <AlertDescription>
            Creando orden desde cotización <strong>{cotizacionPrefill.id}</strong> - 
            Proveedor: <strong>{cotizacionPrefill.proveedorNombre}</strong>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos Generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de Orden */}
          {!isEditing && (
            <div>
              <Label htmlFor="tipo">Tipo de Orden *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoOrden)}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oc">{ORDEN_TIPO_LABELS.oc}</SelectItem>
                  <SelectItem value="os">{ORDEN_TIPO_LABELS.os}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cotización (solo lectura si viene de parámetro) */}
          <div>
            <Label htmlFor="cotizacionId">Cotización Origen *</Label>
            <Input
              id="cotizacionId"
              value={cotizacionId}
              onChange={(e) => setCotizacionId(e.target.value)}
              disabled={Boolean(cotizacionIdParam) || isEditing}
              placeholder="COT-0001"
            />
            {errors.cotizacionId && (
              <p className="text-sm text-red-600 mt-1">{errors.cotizacionId}</p>
            )}
          </div>

          {/* Proveedor */}
          <div>
            <Label htmlFor="proveedorNombre">Proveedor *</Label>
            <Input
              id="proveedorNombre"
              value={proveedorNombre}
              onChange={(e) => setProveedorNombre(e.target.value)}
              placeholder="Nombre del proveedor"
            />
            {errors.proveedorNombre && (
              <p className="text-sm text-red-600 mt-1">{errors.proveedorNombre}</p>
            )}
          </div>

          {/* Moneda */}
          <div>
            <Label htmlFor="moneda">Moneda *</Label>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaOrden)}>
              <SelectTrigger id="moneda">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PEN">{ORDEN_MONEDA_LABELS.PEN}</SelectItem>
                <SelectItem value="USD">{ORDEN_MONEDA_LABELS.USD}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha de Entrega Estimada */}
          <div>
            <Label htmlFor="fechaEntregaEstimada">Fecha de Entrega Estimada</Label>
            <Input
              id="fechaEntregaEstimada"
              type="date"
              value={fechaEntregaEstimada}
              onChange={(e) => setFechaEntregaEstimada(e.target.value)}
            />
          </div>

          {/* Condiciones */}
          <div>
            <Label htmlFor="condiciones">Condiciones de Pago/Entrega</Label>
            <Textarea
              id="condiciones"
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              placeholder="Ej: Pago a 30 días, entrega en almacén central..."
              rows={3}
            />
            {errors.condiciones && (
              <p className="text-sm text-red-600 mt-1">{errors.condiciones}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Items de la Orden</CardTitle>
          <Button onClick={agregarItem} size="sm">
            <Plus className="size-4 mr-2" />
            Agregar Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Item {idx + 1}</h4>
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removerItem(idx)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label htmlFor={`item-${idx}-descripcion`}>Descripción *</Label>
                  <Input
                    id={`item-${idx}-descripcion`}
                    value={item.descripcion}
                    onChange={(e) => actualizarItem(idx, 'descripcion', e.target.value)}
                    placeholder="Descripción del producto/servicio"
                  />
                  {errors[`item-${idx}-descripcion`] && (
                    <p className="text-sm text-red-600 mt-1">{errors[`item-${idx}-descripcion`]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`item-${idx}-cantidad`}>Cantidad *</Label>
                  <Input
                    id={`item-${idx}-cantidad`}
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(idx, 'cantidad', Number(e.target.value))}
                  />
                  {errors[`item-${idx}-cantidad`] && (
                    <p className="text-sm text-red-600 mt-1">{errors[`item-${idx}-cantidad`]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`item-${idx}-unidad`}>Unidad *</Label>
                  <Input
                    id={`item-${idx}-unidad`}
                    value={item.unidad}
                    onChange={(e) => actualizarItem(idx, 'unidad', e.target.value)}
                    placeholder="Ej: unidad, caja, litro"
                  />
                  {errors[`item-${idx}-unidad`] && (
                    <p className="text-sm text-red-600 mt-1">{errors[`item-${idx}-unidad`]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`item-${idx}-precioUnitario`}>Precio Unitario *</Label>
                  <Input
                    id={`item-${idx}-precioUnitario`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.precioUnitario}
                    onChange={(e) => actualizarItem(idx, 'precioUnitario', Number(e.target.value))}
                  />
                  {errors[`item-${idx}-precio`] && (
                    <p className="text-sm text-red-600 mt-1">{errors[`item-${idx}-precio`]}</p>
                  )}
                </div>

                <div>
                  <Label>Subtotal</Label>
                  <div className="h-10 flex items-center px-3 border rounded-md bg-muted">
                    {(item.cantidad * item.precioUnitario).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {errors.items && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{errors.items}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{moneda === 'PEN' ? 'S/' : '$'} {totales.subtotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Impuestos (18% IGV):</span>
              <span className="font-medium">{moneda === 'PEN' ? 'S/' : '$'} {totales.impuestos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2">
              <span className="font-semibold">Total:</span>
              <span className="font-semibold">{moneda === 'PEN' ? 'S/' : '$'} {totales.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="size-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={handleSubmit}>
          <Save className="size-4 mr-2" />
          {isEditing ? 'Guardar Cambios' : 'Crear Orden'}
        </Button>
      </div>
    </div>
  );
}
