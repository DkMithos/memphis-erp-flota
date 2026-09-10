import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, AlertCircle, Plus, Trash2, FileText, Paperclip, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
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
import { useCotizacionesStore, type NuevaCotizacionInput, type ItemCotizacion } from '../../../lib/compras/cotizaciones-store';
import { useRequerimientosStore } from '../../../lib/compras/requerimientos-store';
import { puedeCotizarRequerimiento } from '../../../lib/compras/requerimientos-config';
import { heredarDelRequerimiento } from '../../../lib/compras/heredar-requerimiento';
import {
  subirArchivoCotizacion, tamanoLegible, TIPOS_ACEPTADOS, TAMANO_MAXIMO,
} from '../../../lib/compras/cotizacion-archivos';
import { AdjuntosCotizacion } from './AdjuntosCotizacion';
import { useAuth } from '../../../auth/AuthProvider';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';
import { useCentrosCosto } from '../../../lib/centros-costo/centros-costo-store';
import { REGIMENES, tasaIgv, regimenSugerido, llevaIgv, etiquetaRegimen } from '../../../lib/compras/regimen-igv';
import {
  validarProveedorNombre,
  validarDescripcionItem,
  validarCantidad,
  validarPrecioUnitario,
  VALIDEZ_DIAS_OPTIONS,
  COTIZACION_TIPO_LABELS,
  COTIZACION_MONEDA_LABELS,
  formatearMonto,
  calcularTotales,
  type TipoCotizacion,
  type MonedaCotizacion
} from '../../../lib/compras/cotizaciones-config';
import { toast } from 'sonner';

interface CotizacionFormProps {
  cotizacionId?: string; // Si existe, es edición
  requerimientoIdParam?: string; // Desde query string ?req=REQ-0001
  onCancel: () => void;
  onSuccess: (cotizacionId: string) => void;
}

export function CotizacionForm({ cotizacionId, requerimientoIdParam, onCancel, onSuccess }: CotizacionFormProps) {
  const { obtenerCotizacionPorId, crearCotizacion, actualizarCotizacion, cambiarEstado, usuarioActual } = useCotizacionesStore();
  const { obtenerRequerimientoPorId, requerimientos } = useRequerimientosStore();
  const { proveedores } = useProveedorStore();
  const { centrosCosto } = useCentrosCosto();

  /** Lo que se puede cotizar: enviado o aprobado. Ver `puedeCotizarRequerimiento`. */
  const requerimientosCotizables = useMemo(
    () => requerimientos.filter(r => puedeCotizarRequerimiento(r.estado)),
    [requerimientos],
  );
  
  const isEditing = !!cotizacionId;
  const cotizacionExistente = isEditing ? obtenerCotizacionPorId(cotizacionId) : undefined;
  const requerimientoAsociado = obtenerRequerimientoPorId(
    requerimientoIdParam || cotizacionExistente?.requerimientoId || ''
  );

  // Estado del formulario
  const [formData, setFormData] = useState<Partial<NuevaCotizacionInput>>({
    requerimientoId: requerimientoIdParam || '',
    proveedorNombre: '',
    tipo: 'bienes',
    moneda: 'PEN',
    validezDias: 15,
    items: [],
    terminos: '',
    observaciones: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Al dar de alta todavía no hay cotización a la que colgar el archivo, así
  // que se guardan aquí y se suben en cuanto exista. En edición no hace falta:
  // la cotización ya tiene id y se usa el panel de siempre.
  const { tenantId, user } = useAuth();
  const [porSubir, setPorSubir] = useState<File[]>([]);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const elegirArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files ?? []);
    const grandes = nuevos.filter(f => f.size > TAMANO_MAXIMO);
    if (grandes.length > 0) {
      toast.error(`${grandes.map(f => f.name).join(', ')}: el máximo son 10 MB`);
    }
    setPorSubir(prev => [...prev, ...nuevos.filter(f => f.size <= TAMANO_MAXIMO)]);
    if (inputArchivo.current) inputArchivo.current.value = '';
  };

  // Al llegar desde el requerimiento (?req=RQ-...) hay que heredar sus items.
  // Va en un efecto y no en el estado inicial porque el store carga DESPUÉS del
  // primer render: leerlo una sola vez al montar dejaba la cotización vacía y
  // obligaba a teclear todo otra vez. Se hereda una vez por requerimiento, para
  // no pisar lo que el comprador ya haya editado.
  const [heredadoDe, setHeredadoDe] = useState<string | null>(null);
  useEffect(() => {
    if (isEditing || !requerimientoIdParam) return;
    if (heredadoDe === requerimientoIdParam) return;

    const req = obtenerRequerimientoPorId(requerimientoIdParam);
    if (!req) return; // todavía no cargó: se reintenta cuando llegue

    const cc = centrosCosto.find(c => c.codigo === req.centroCosto);
    setFormData(prev => ({
      ...prev,
      requerimientoId: req.id,
      requerimientoDbId: req._dbId,
      centroCostoId: cc?._dbId ?? prev.centroCostoId ?? null,
      ...heredarDelRequerimiento(req),
    }));
    setHeredadoDe(requerimientoIdParam);
  }, [isEditing, requerimientoIdParam, heredadoDe, obtenerRequerimientoPorId, centrosCosto]);

  // Cargar datos si es edición
  useEffect(() => {
    if (isEditing && cotizacionExistente) {
      // Faltaban proveedorId, centroCostoId y régimen: los selectores salían
      // vacíos y la validación bloqueaba el guardado con "el centro de costo es
      // obligatorio", aunque la cotización lo tuviera. Editar era imposible sin
      // volver a elegirlo todo.
      setFormData({
        requerimientoId: cotizacionExistente.requerimientoId,
        requerimientoDbId: (cotizacionExistente as any).requerimientoDbId ?? undefined,
        proveedorId: cotizacionExistente.proveedorId ?? null,
        proveedorNombre: cotizacionExistente.proveedorNombre,
        centroCostoId: cotizacionExistente.centroCostoId ?? null,
        regimenIgv: cotizacionExistente.regimenIgv ?? 'gravado',
        tipo: cotizacionExistente.tipo,
        moneda: cotizacionExistente.moneda,
        validezDias: cotizacionExistente.validezDias,
        items: cotizacionExistente.items.map(({ id, subtotal, ...item }) => item),
        terminos: cotizacionExistente.terminos || '',
        observaciones: cotizacionExistente.observaciones || ''
      });
    }
  }, [isEditing, cotizacionExistente]);

  // Calcular totales
  const totales = useMemo(() => {
    const items = (formData.items || []).map(item => ({
      cantidad: item.cantidad || 0,
      precioUnitario: item.precioUnitario || 0
    }));
    return calcularTotales(items, tasaIgv(formData.regimenIgv));
  }, [formData.items]);

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Requerimiento
    if (!formData.requerimientoId) {
      newErrors.requerimientoId = 'Debe seleccionar un requerimiento';
    }

    // Proveedor
    if (!formData.centroCostoId) {
      newErrors.centroCostoId = 'El centro de costo es obligatorio: sin él la compra no llega a ningún proyecto';
    }
    if (!formData.proveedorNombre) {
      newErrors.proveedorNombre = 'El nombre del proveedor es obligatorio';
    } else {
      const validProveedor = validarProveedorNombre(formData.proveedorNombre);
      if (!validProveedor.valid) newErrors.proveedorNombre = validProveedor.error!;
    }

    // Items
    if (!formData.items || formData.items.length === 0) {
      newErrors.items = 'Debe agregar al menos un item';
    } else {
      formData.items.forEach((item, idx) => {
        if (!item.descripcion?.trim()) {
          newErrors[`item-${idx}-descripcion`] = 'La descripción es obligatoria';
        } else {
          const validDesc = validarDescripcionItem(item.descripcion);
          if (!validDesc.valid) newErrors[`item-${idx}-descripcion`] = validDesc.error!;
        }
        
        if (!item.cantidad || item.cantidad <= 0) {
          newErrors[`item-${idx}-cantidad`] = 'La cantidad debe ser mayor a 0';
        }
        
        if (!item.unidad?.trim()) {
          newErrors[`item-${idx}-unidad`] = 'La unidad es obligatoria';
        }
        
        if (item.precioUnitario === undefined || item.precioUnitario < 0) {
          newErrors[`item-${idx}-precioUnitario`] = 'El precio unitario es obligatorio';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar submit
  const handleSubmit = async (e: React.FormEvent, enviar: boolean = false) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, corrige los errores del formulario');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        // Actualizar cotización
        const resActualizar = await actualizarCotizacion(cotizacionId, formData);
        if (!resActualizar.exito) {
          toast.error(resActualizar.errores?.[0] ?? 'Error al actualizar la cotización');
          return;
        }
        if (enviar) {
          // Hay que MIRAR el resultado. Sin esto, una transición no permitida
          // se rechazaba en silencio y la pantalla anunciaba un envío que no
          // había ocurrido: la cotización se quedaba como estaba.
          const resEnviar = await cambiarEstado(cotizacionId, 'enviada');
          if (!resEnviar.exito) {
            toast.error(
              `Se guardaron los cambios, pero la cotización sigue en "${cotizacionExistente?.estado ?? 'su estado anterior'}": `
              + (resEnviar.errores?.[0] ?? 'no se pudo pasar a revisión'),
            );
            onSuccess(cotizacionId);
            return;
          }
          toast.success('Cotización actualizada y enviada a revisión');
        } else {
          toast.success('Cotización actualizada correctamente');
        }
        onSuccess(cotizacionId);
      } else {
        // Crear cotización
        const resCrear = await crearCotizacion(formData as NuevaCotizacionInput, enviar ? 'enviada' : 'borrador');
        if (!resCrear.exito || !resCrear.cotizacion) {
          toast.error(resCrear.errores?.[0] ?? 'Error al crear la cotización');
          return;
        }
        const nuevaCot = resCrear.cotizacion;
        toast.success(enviar
          ? `Cotización ${nuevaCot.id} creada y enviada a revisión`
          : `Cotización ${nuevaCot.id} guardada como borrador`);

        // Los adjuntos van después: hasta aquí no había cotización a la que
        // colgarlos. Si alguno falla se dice cuál — la cotización ya está
        // creada y el documento se puede adjuntar desde su pantalla.
        const dbId = (nuevaCot as any)._dbId as string | undefined;
        if (porSubir.length > 0 && dbId && tenantId) {
          const fallidos: string[] = [];
          for (const f of porSubir) {
            const err = await subirArchivoCotizacion(dbId, tenantId, user?.id ?? null, f);
            if (err) fallidos.push(f.name);
          }
          if (fallidos.length === 0) {
            toast.success(porSubir.length === 1
              ? 'Documento adjuntado'
              : `${porSubir.length} documentos adjuntados`);
          } else {
            toast.error(
              `No se pudo adjuntar ${fallidos.join(', ')}. ` +
              `La cotización sí quedó guardada: adjúntalo desde su pantalla.`,
            );
          }
        }

        onSuccess(nuevaCot.id);
      }
    } catch (error) {
      toast.error('Error al guardar la cotización');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Agregar item
  const agregarItem = () => {
    const nuevoItem = {
      descripcion: '',
      cantidad: 1,
      unidad: 'unidad',
      precioUnitario: 0
    };
    setFormData({
      ...formData,
      items: [...(formData.items || []), nuevoItem]
    });
  };

  // Eliminar item
  const eliminarItem = (index: number) => {
    const items = [...(formData.items || [])];
    items.splice(index, 1);
    setFormData({ ...formData, items });
  };

  // Actualizar item
  const actualizarItem = (index: number, campo: keyof Omit<ItemCotizacion, 'id' | 'subtotal'>, valor: any) => {
    const items = [...(formData.items || [])];
    items[index] = { ...items[index], [campo]: valor };
    setFormData({ ...formData, items });
    // Limpiar error del campo
    if (errors[`item-${index}-${campo}`]) {
      const newErrors = { ...errors };
      delete newErrors[`item-${index}-${campo}`];
      setErrors(newErrors);
    }
  };

  return (
    <div className="space-y-6">
      <PageNav onBack={onCancel} />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{isEditing ? 'Editar Cotización' : 'Nueva Cotización'}</h2>
            <p className="text-muted-foreground mt-1">
              {isEditing
                ? `Modificando ${cotizacionExistente?.id}`
                : 'Complete los datos de la nueva cotización'}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onCancel} className="border border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          <X className="size-4" />
          Cancelar
        </Button>
      </div>

      {/* Requerimiento Asociado */}
      {requerimientoAsociado && (
        <Alert>
          <FileText className="size-4" />
          <AlertDescription>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Requerimiento: {requerimientoAsociado.id}</p>
                <p className="text-sm mt-1">{requerimientoAsociado.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Solicitante: {requerimientoAsociado.solicitanteNombre} • 
                  Total Estimado: S/ {requerimientoAsociado.totalEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Badge variant="outline">{requerimientoAsociado.estado}</Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Formulario */}
      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="space-y-6">
          {/* Información General */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requerimiento: se elige de los aprobados. Antes era texto libre
                  con el ejemplo "REQ-0001" —un formato que ya no se usa— y nada
                  comprobaba que el requerimiento existiera. */}
              <div className="space-y-2">
                <Label htmlFor="requerimientoId">Requerimiento Asociado *</Label>
                {(!!requerimientoIdParam || isEditing) ? (
                  <Input id="requerimientoId" value={formData.requerimientoId} readOnly disabled className="font-mono" />
                ) : (
                  <SearchableSelect
                    value={formData.requerimientoId || null}
                    onChange={(v) => {
                      const req = requerimientosCotizables.find(r => r.id === v);
                      // La cotización hereda el centro de costo del
                      // requerimiento: es la misma compra, no otra.
                      const cc = centrosCosto.find(c => c.codigo === req?.centroCosto);
                      const heredado = req ? heredarDelRequerimiento(req) : null;
                      setFormData({
                        ...formData,
                        requerimientoId: v ?? '',
                        requerimientoDbId: req?._dbId,
                        centroCostoId: cc?._dbId ?? formData.centroCostoId ?? null,
                        // Cambiar de requerimiento cambia lo que se cotiza.
                        ...(heredado ?? {}),
                        observaciones: heredado?.observaciones || formData.observaciones,
                      });
                      if (errors.requerimientoId) setErrors({ ...errors, requerimientoId: '' });
                    }}
                    options={requerimientosCotizables.map(r => ({
                      value: r.id,
                      label: `${r.id} — ${r.titulo}`,
                    }))}
                    placeholder="Seleccionar requerimiento"
                    emptyText="No hay requerimientos por cotizar"
                  />
                )}
                {errors.requerimientoId && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.requerimientoId}
                  </p>
                )}
              </div>

              {/* Proveedor: del catálogo. El formulario pedía el nombre a mano
                  pero el guardado exige el proveedor de la base, así que la
                  cotización SIEMPRE fallaba con "Se requiere un proveedor
                  válido con ID de BD". */}
              <div className="space-y-2">
                <Label htmlFor="proveedorNombre">Proveedor *</Label>
                <SearchableSelect
                  value={formData.proveedorId ?? null}
                  onChange={(v) => {
                    const prov = proveedores.find(p => p._dbId === v);
                    setFormData({
                      ...formData,
                      proveedorId: v,
                      proveedorNombre: prov?.razonSocial ?? '',
                      // El régimen lo pone el proveedor; se puede ajustar debajo.
                      regimenIgv: prov ? regimenSugerido({
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        regimenIgv: (prov as any).regimenIgv,
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        domiciliado: (prov as any).domiciliado,
                        ruc: prov.ruc,
                      }) : 'gravado',
                    });
                    if (errors.proveedorNombre) setErrors({ ...errors, proveedorNombre: '' });
                  }}
                  options={proveedores
                    .filter(p => p.estado === 'activo')
                    .map(p => ({ value: p._dbId, label: `${p.razonSocial} — ${p.ruc}` }))}
                  placeholder="Seleccionar proveedor"
                  emptyText="No hay proveedores activos"
                />
                {errors.proveedorNombre && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.proveedorNombre}
                  </p>
                )}
              </div>

              {/* Régimen de IGV: lo propone el proveedor y se puede ajustar,
                  porque un mismo proveedor puede vender algo gravado y algo no. */}
              <div className="space-y-2">
                <Label htmlFor="regimenIgv">Régimen de IGV *</Label>
                <Select
                  value={formData.regimenIgv ?? 'gravado'}
                  onValueChange={(v) => setFormData({ ...formData, regimenIgv: v as typeof formData.regimenIgv })}
                >
                  <SelectTrigger id="regimenIgv"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIMENES.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {REGIMENES.find(r => r.id === (formData.regimenIgv ?? 'gravado'))?.detalle}
                </p>
              </div>

              {/* Centro de costo: sin él la compra no llega a ningún proyecto. */}
              <div className="space-y-2">
                <Label htmlFor="centroCosto">Centro de Costo *</Label>
                <CentroCostoSelector
                  value={formData.centroCostoId ?? null}
                  onChange={(v) => {
                    setFormData({ ...formData, centroCostoId: v });
                    if (errors.centroCostoId) setErrors({ ...errors, centroCostoId: '' });
                  }}
                  nullable={false}
                />
                {errors.centroCostoId && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.centroCostoId}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tipo */}
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(v) => setFormData({ ...formData, tipo: v as TipoCotizacion })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COTIZACION_TIPO_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Moneda */}
                <div className="space-y-2">
                  <Label htmlFor="moneda">Moneda *</Label>
                  <Select 
                    value={formData.moneda} 
                    onValueChange={(v) => setFormData({ ...formData, moneda: v as MonedaCotizacion })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COTIZACION_MONEDA_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Validez */}
                <div className="space-y-2">
                  <Label htmlFor="validezDias">Validez *</Label>
                  <Select 
                    value={String(formData.validezDias)} 
                    onValueChange={(v) => setFormData({ ...formData, validezDias: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VALIDEZ_DIAS_OPTIONS.map(dias => (
                        <SelectItem key={dias} value={String(dias)}>{dias} días</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items de la Cotización *</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
                  <Plus className="size-4" />
                  Agregar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.items && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{errors.items}</AlertDescription>
                </Alert>
              )}

              {(formData.items || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>No hay items agregados</p>
                  <p className="text-sm mt-1">Click en "Agregar Item" para empezar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(formData.items || []).map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Item {idx + 1}</h4>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => eliminarItem(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2 space-y-2">
                          <Label>Descripción *</Label>
                          <Input
                            value={item.descripcion}
                            onChange={(e) => actualizarItem(idx, 'descripcion', e.target.value)}
                            placeholder="Descripción del item"
                          />
                          {errors[`item-${idx}-descripcion`] && (
                            <p className="text-sm text-red-600">{errors[`item-${idx}-descripcion`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Cantidad *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          />
                          {errors[`item-${idx}-cantidad`] && (
                            <p className="text-sm text-red-600">{errors[`item-${idx}-cantidad`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Unidad *</Label>
                          <Select
                            value={item.unidad}
                            onValueChange={(v) => actualizarItem(idx, 'unidad', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unidad">Unidad</SelectItem>
                              <SelectItem value="juego">Juego</SelectItem>
                              <SelectItem value="caja">Caja</SelectItem>
                              <SelectItem value="paquete">Paquete</SelectItem>
                              <SelectItem value="litro">Litro</SelectItem>
                              <SelectItem value="kilo">Kilogramo</SelectItem>
                              <SelectItem value="metro">Metro</SelectItem>
                              <SelectItem value="licencia">Licencia</SelectItem>
                              <SelectItem value="servicio">Servicio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Precio Unitario ({formData.moneda === 'PEN' ? 'S/' : '$'}) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precioUnitario}
                            onChange={(e) => actualizarItem(idx, 'precioUnitario', parseFloat(e.target.value) || 0)}
                          />
                          {errors[`item-${idx}-precioUnitario`] && (
                            <p className="text-sm text-red-600">{errors[`item-${idx}-precioUnitario`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Subtotal</Label>
                          <Input
                            value={formatearMonto((item.cantidad || 0) * (item.precioUnitario || 0), formData.moneda as MonedaCotizacion)}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totales */}
              {(formData.items || []).length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatearMonto(totales.subtotal, formData.moneda as MonedaCotizacion)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {llevaIgv(formData.regimenIgv) ? 'IGV (18%):' : `Sin IGV — ${etiquetaRegimen(formData.regimenIgv)}`}
                    </span>
                    <span className="font-medium">{formatearMonto(totales.impuestos, formData.moneda as MonedaCotizacion)}</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-semibold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-primary">{formatearMonto(totales.total, formData.moneda as MonedaCotizacion)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documento del proveedor */}
          {isEditing ? (
            <AdjuntosCotizacion cotizacionDbId={(cotizacionExistente as any)?._dbId ?? undefined} />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="size-5" />
                  Documento de la Cotización {porSubir.length > 0 && `(${porSubir.length})`}
                </CardTitle>
                <>
                  <input
                    ref={inputArchivo}
                    type="file"
                    multiple
                    accept={TIPOS_ACEPTADOS}
                    className="hidden"
                    onChange={elegirArchivos}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => inputArchivo.current?.click()}>
                    <Upload className="size-4" />
                    Adjuntar
                  </Button>
                </>
              </CardHeader>
              <CardContent>
                {porSubir.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Adjunta el PDF que envió el proveedor. También vale una foto o el Excel.
                    Se guardará junto con la cotización.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {porSubir.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 py-2">
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" title={f.name}>{f.name}</p>
                          <p className="text-xs text-muted-foreground">{tamanoLegible(f.size)}</p>
                        </div>
                        <Button
                          type="button" variant="ghost" size="icon" title="Quitar"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setPorSubir(prev => prev.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Términos y Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Términos y Condiciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terminos">Términos y Condiciones</Label>
                <Textarea
                  id="terminos"
                  value={formData.terminos}
                  onChange={(e) => setFormData({ ...formData, terminos: e.target.value })}
                  placeholder="Forma de pago, garantías, plazos de entrega..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Notas adicionales..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
              <X className="size-4" />
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={isSubmitting} className="border border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
              <Save className="size-4" />
              Guardar como Borrador
            </Button>
            <Button 
              type="button" 
              onClick={(e) => handleSubmit(e, true)} 
              disabled={isSubmitting}
            >
              <Save className="size-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar y Enviar a revisión'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
