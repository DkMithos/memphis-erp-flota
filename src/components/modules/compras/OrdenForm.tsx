import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, X, Plus, Trash2, AlertTriangle, FileText, ChevronDown, ShoppingBag } from 'lucide-react';
import { PageNav } from '../../shared/PageNav';
import { useCatalogos } from '../../../lib/shared/catalogos-store';
import { SelectCatalogo } from '../../shared/SelectCatalogo';
import { determinarNivelAprobacion, nivelAprobacionColor, ETIQUETA_ETAPA } from '../../../lib/compras/approval-flow';
import { useFlujoAprobacion } from '../../../lib/compras/flujo-aprobacion-store';
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
import { toast } from 'sonner';
import { Checkbox } from '../../ui/checkbox';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { REGIMENES, tasaIgv, llevaIgv, etiquetaRegimen, esPersonaNatural, type RegimenIgv } from '../../../lib/compras/regimen-igv';
import { useOrdenesStore, type NuevaOrdenInput } from '../../../lib/compras/ordenes-store';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { SearchableSelect } from '../../shared/SearchableSelect';
import type { TipoCotizacion } from '../../../lib/compras/cotizaciones-config';
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
  const { getByTipo } = useCatalogos();
  const unidades = getByTipo('unidad_medida');
  const condicionesPago = getByTipo('condicion_pago');
  const { config: flujoConfig } = useFlujoAprobacion();
  const { cotizaciones } = useCotizacionesStore();
  /** Solo se ordena lo aprobado: es la decisión de con qué proveedor se compra. */
  const cotizacionesAprobadas = useMemo(
    () => cotizaciones.filter(c => c.estado === 'aprobada'),
    [cotizaciones],
  );
  const { proveedores } = useProveedorStore();

  const isEditing = Boolean(ordenId);
  const ordenExistente = isEditing ? obtenerOrdenPorId(ordenId!) : undefined;

  /** La cotización dice bienes/servicios; la orden, OC/OS. Es lo mismo dicho de otro modo. */
  const tipoDeCotizacion = (t: TipoCotizacion): TipoOrden => (t === 'servicios' ? 'os' : 'oc');

  const [cotizacionId, setCotizacionId] = useState(
    ordenExistente?.cotizacionId || cotizacionIdParam || ''
  );

  // La cotización de la que sale la orden: la del enlace o la que se elija en el
  // selector. Se sigue el ESTADO y no solo el parámetro, para que al elegirla a
  // mano se arrastren proveedor, items y condiciones igual que por enlace.
  const cotizacionPrefill = cotizacionId
    ? cotizaciones.find(c => c.id === cotizacionId)
    : undefined;

  // Estado del formulario
  const [tipo, setTipo] = useState<TipoOrden>(
    ordenExistente?.tipo || tipoParam ||
    (cotizacionPrefill ? tipoDeCotizacion(cotizacionPrefill.tipo) : 'oc')
  );
  const [proveedorNombre, setProveedorNombre] = useState(
    ordenExistente?.proveedorNombre || cotizacionPrefill?.proveedorNombre || ''
  );

  // Helper to clear a specific error when user changes value
  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };
  const [moneda, setMoneda] = useState<MonedaOrden>(
    ordenExistente?.moneda || cotizacionPrefill?.moneda || 'PEN'
  );
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState(
    ordenExistente?.fechaEntregaEstimada?.split('T')[0] || ''
  );
  const [condiciones, setCondiciones] = useState(
    ordenExistente?.condiciones || cotizacionPrefill?.terminos || ''
  );
  const [lugarEntrega, setLugarEntrega] = useState(ordenExistente?.lugarEntrega || '');
  // Lo que hay que decirle al proveedor y no cabe en la descripción de un item.
  // Sale impreso en el PDF de la orden.
  const [observaciones, setObservaciones] = useState(
    ordenExistente?.observaciones || cotizacionPrefill?.observaciones || ''
  );
  /** Régimen de IGV: se hereda de la cotización y se puede ajustar aquí. */
  const [regimenIgv, setRegimenIgv] = useState<RegimenIgv>(
    ordenExistente?.regimenIgv ?? cotizacionPrefill?.regimenIgv ?? 'gravado'
  );
  const [aplicaRetencionRh, setAplicaRetencionRh] = useState<boolean>(
    ordenExistente?.aplicaRetencionRh ?? false
  );
  /** RUC del proveedor: decide si tiene sentido ofrecer la retención de 4ta. */
  const rucProveedor = useMemo(() => {
    const id = cotizacionPrefill?.proveedorId ?? ordenExistente?.proveedorDbId ?? null;
    return proveedores.find(p => p._dbId === id)?.ruc ?? null;
  }, [proveedores, cotizacionPrefill, ordenExistente]);
  const [items, setItems] = useState<ItemForm[]>(
    ordenExistente?.items || cotizacionPrefill?.items || [
      { descripcion: '', cantidad: 1, unidad: '', precioUnitario: 0 }
    ]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Los stores cargan DESPUÉS del primer render. Estos valores no pueden
  // quedarse solo en el estado inicial: al abrir la pantalla por URL o al
  // refrescar, la cotización todavía no estaba y la orden salía en blanco —
  // había que volver a teclear lo ya cotizado, que es justo lo que esta
  // pantalla existe para evitar. Se aplica una sola vez por origen, así que no
  // pisa lo que el comprador edite después.
  const [prefillAplicado, setPrefillAplicado] = useState<string | null>(null);
  useEffect(() => {
    const clave = ordenExistente
      ? `orden:${ordenExistente.id}`
      : cotizacionPrefill ? `cot:${cotizacionPrefill.id}` : null;
    if (!clave || prefillAplicado === clave) return;

    if (ordenExistente) {
      setTipo(ordenExistente.tipo);
      setCotizacionId(ordenExistente.cotizacionId);
      setProveedorNombre(ordenExistente.proveedorNombre);
      setMoneda(ordenExistente.moneda);
      setFechaEntregaEstimada(ordenExistente.fechaEntregaEstimada?.split('T')[0] || '');
      setCondiciones(ordenExistente.condiciones || '');
      setLugarEntrega(ordenExistente.lugarEntrega || '');
      setObservaciones(ordenExistente.observaciones || '');
      setRegimenIgv(ordenExistente.regimenIgv ?? 'gravado');
      setAplicaRetencionRh(ordenExistente.aplicaRetencionRh ?? false);
      if (ordenExistente.items?.length) setItems(ordenExistente.items);
    } else if (cotizacionPrefill) {
      setTipo(tipoParam || tipoDeCotizacion(cotizacionPrefill.tipo));
      setProveedorNombre(cotizacionPrefill.proveedorNombre);
      setMoneda(cotizacionPrefill.moneda);
      setCondiciones(cotizacionPrefill.terminos || '');
      setRegimenIgv(cotizacionPrefill.regimenIgv ?? 'gravado');
      if (cotizacionPrefill.items?.length) setItems(cotizacionPrefill.items);
    }
    setPrefillAplicado(clave);
  }, [ordenExistente, cotizacionPrefill, tipoParam, prefillAplicado]);

  // Calcular totales en tiempo real
  const totales = useMemo(() => {
    return calcularTotales(items, tasaIgv(regimenIgv));
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
    // Clear item-level errors
    const errorKey = field === 'precioUnitario' ? `item-${index}-precio` : `item-${index}-${field}`;
    clearError(errorKey);
    clearError('items');
  };

  // Submit
  const handleSubmit = async () => {
    if (!validarFormulario()) {
      toast.error('Por favor, corrige los errores del formulario');
      return;
    }

    try {
      if (isEditing && ordenExistente) {
        const res = await actualizarOrden(ordenExistente.id, {
          proveedorNombre: proveedorNombre.trim(),
          moneda,
          fechaEntregaEstimada: fechaEntregaEstimada || undefined,
          condiciones: condiciones.trim() || undefined,
          lugarEntrega: lugarEntrega.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          items: items.map(item => ({
            descripcion: item.descripcion.trim(),
            cantidad: item.cantidad,
            unidad: item.unidad.trim(),
            precioUnitario: item.precioUnitario
          }))
        });
        if (!res.exito) {
          console.error('Error al actualizar orden:', res.errores);
          toast.error(res.errores?.[0] ?? 'No se pudo actualizar la orden');
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
          condiciones: condiciones.trim() || undefined,
          lugarEntrega: lugarEntrega.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          // Los identificadores de base vienen de la cotización de origen. Sin
          // ellos el guardado rechaza la orden con "Se requiere un proveedor
          // válido con ID de BD" — y antes ese error solo iba a la consola, así
          // que "Crear Orden" no hacía nada y no decía por qué.
          proveedorDbId: cotizacionPrefill?.proveedorId ?? undefined,
          cotizacionDbId: cotizacionPrefill?._dbId,
          centroCostoId: cotizacionPrefill?.centroCostoId ?? null,
          regimenIgv,
          aplicaRetencionRh,
          // El requerimiento NO se pasa: `ordenes_compra` no lo guarda y lo que
          // llegaba era el uuid de la cotización, que la pantalla pintaba tal
          // cual. La trazabilidad va por la cotización, que sí está enlazada.
        };

        const res = await crearOrdenDesdeCotizacion(nuevaOrdenInput);
        if (!res.exito || !res.orden) {
          console.error('Error al crear orden:', res.errores);
          toast.error(res.errores?.[0] ?? 'No se pudo crear la orden');
          return;
        }
        onSuccess(res.orden.id);
      }
    } catch (error) {
      console.error('Error al guardar orden:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar la orden');
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
              <ArrowLeft className="size-4" />
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageNav onBack={onCancel} />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <ShoppingBag className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{isEditing ? `Editar Orden ${ordenExistente?.id}` : 'Nueva Orden de Compra/Servicio'}</h2>
            <p className="text-muted-foreground mt-1">
              {isEditing ? 'Modificar datos de la orden' : 'Crear orden desde cotización aprobada'}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onCancel} className="border border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          <X className="size-4" />
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

          {/* Cotización de origen. Se elige del catálogo: antes era un campo de
              texto libre donde había que acordarse del número, y escribir uno
              que no existiera dejaba la orden sin cotización de verdad. */}
          <div>
            <Label htmlFor="cotizacionId">Cotización Origen *</Label>
            {(Boolean(cotizacionIdParam) || isEditing) ? (
              <Input id="cotizacionId" value={cotizacionId} readOnly disabled className="font-mono" />
            ) : (
              <SearchableSelect
                value={cotizacionId || null}
                onChange={(v) => { setCotizacionId(v ?? ''); clearError('cotizacionId'); }}
                options={cotizacionesAprobadas.map(c => ({
                  value: c.id,
                  label: `${c.id} — ${c.proveedorNombre} — ${c.moneda === 'USD' ? '$' : 'S/'} ${c.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
                }))}
                placeholder="Seleccionar cotización aprobada"
                emptyText="No hay cotizaciones aprobadas"
              />
            )}
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
              onChange={(e) => { setProveedorNombre(e.target.value); clearError('proveedorNombre'); }}
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

          {/* Condiciones de pago — catálogo, no texto libre.
              Antes había desplegable Y un cuadro de texto siempre visible: la
              gente escribía en vez de elegir, y así "30 días" acabó con seis
              grafías distintas en 776 órdenes. Ahora el texto solo aparece si
              se elige "Otro". */}
          {/* Régimen de IGV: llega heredado de la cotización, pero la orden es
              el documento que se emite, así que aquí se puede corregir. */}
          <div className="space-y-2">
            <Label htmlFor="regimenIgv">Régimen de IGV *</Label>
            <Select value={regimenIgv} onValueChange={(v) => setRegimenIgv(v as RegimenIgv)}>
              <SelectTrigger id="regimenIgv"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIMENES.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {REGIMENES.find(r => r.id === regimenIgv)?.detalle}
            </p>
          </div>

          {/* Retención de 4ta solo tiene sentido con una persona natural, que es
              quien emite recibo por honorarios. Se marca a mano porque quien
              tiene constancia de suspensión vigente no debe sufrirla. */}
          {esPersonaNatural(rucProveedor) && (
            <div className="space-y-2">
              <Label>Retención de renta (4ta categoría)</Label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={aplicaRetencionRh}
                  onCheckedChange={(v) => setAplicaRetencionRh(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Aplicar retención sobre el recibo por honorarios
                  <span className="block text-xs text-muted-foreground">
                    Desmárcala si el proveedor tiene constancia de suspensión vigente.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label>Condiciones de Pago</Label>
            <SelectCatalogo
              tipo="condicion_pago"
              value={condiciones}
              onChange={(v) => setCondiciones(v ?? '')}
              placeholder="Seleccione condición..."
              permitirOtro
              otroPlaceholder="Escribe la condición acordada"
            />
            {errors.condiciones && (
              <p className="text-sm text-red-600 mt-1">{errors.condiciones}</p>
            )}
          </div>

          {/* Lugar de entrega — mixto: destinos frecuentes del catálogo, y
              "Otro" para la dirección concreta de una obra. */}
          <div className="space-y-2">
            <Label>Lugar de Entrega</Label>
            <SelectCatalogo
              tipo="lugar_entrega"
              value={lugarEntrega}
              onChange={(v) => setLugarEntrega(v ?? '')}
              placeholder="Seleccione lugar..."
              permitirOtro
              otroPlaceholder="Dirección o referencia de entrega"
            />
          </div>

          {/* Observaciones: van impresas en el PDF que recibe el proveedor. */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observaciones">Observaciones / Detalles</Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Instrucciones de entrega, referencias, acuerdos con el proveedor…"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Se imprimen en el PDF de la orden, debajo de las condiciones.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Items de la Orden</CardTitle>
          <Button onClick={agregarItem} size="sm">
            <Plus className="size-4" />
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
                  <Select
                    value={item.unidad}
                    onValueChange={(v) => actualizarItem(idx, 'unidad', v)}
                  >
                    <SelectTrigger id={`item-${idx}-unidad`}>
                      <SelectValue placeholder="Seleccione unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => (
                        <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      {/* Totales + nivel de aprobación */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{moneda === 'PEN' ? 'S/' : '$'} {totales.subtotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>{llevaIgv(regimenIgv) ? 'Impuestos (18% IGV):' : `Sin IGV — ${etiquetaRegimen(regimenIgv)}`}</span>
              <span className="font-medium">{moneda === 'PEN' ? 'S/' : '$'} {totales.impuestos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2">
              <span className="font-semibold">Total:</span>
              <span className="font-semibold">{moneda === 'PEN' ? 'S/' : '$'} {totales.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>
            {totales.total > 0 && (() => {
              const nivel = determinarNivelAprobacion(totales.total, moneda, flujoConfig);
              return (
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${nivelAprobacionColor(nivel.nivel)}`}>
                  <p className="font-semibold">Nivel {nivel.nivel} — {nivel.label}</p>
                  <p className="opacity-80">
                    {nivel.descripcion} · Firman: {(nivel.etapas ?? []).map(e => ETIQUETA_ETAPA[e]).join(' → ')}
                  </p>
                </div>
              );
            })()}
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
          {isEditing ? 'Guardar Cambios' : 'Crear Orden'}
        </Button>
      </div>
    </div>
  );
}
