import { useState, useEffect } from 'react';
import { ArrowLeft, Save, X, AlertCircle, Plus, Trash2 } from 'lucide-react';
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
import { useRequerimientosStore, type NuevoRequerimientoInput, type ItemRequerimiento } from '../../../lib/compras/requerimientos-store';
import {
  validarTitulo,
  validarDescripcion,
  validarEmail,
  validarCantidad,
  CENTRO_COSTO_LABELS,
  formatearMonto,
  type PrioridadRequerimiento,
  type CentroCosto
} from '../../../lib/compras/requerimientos-config';
import { toast } from 'sonner';
import { ProyectoSelector } from '../../shared/ProyectoSelector';

interface RequerimientoFormProps {
  requerimientoId?: string; // Si existe, es edición
  onCancel: () => void;
  onSuccess: (requerimientoId: string) => void;
}

export function RequerimientoForm({ requerimientoId, onCancel, onSuccess }: RequerimientoFormProps) {
  const { obtenerRequerimientoPorId, crearRequerimiento, actualizarRequerimiento, cambiarEstado, usuarioActual } = useRequerimientosStore();
  const isEditing = !!requerimientoId;
  const requerimientoExistente = isEditing ? obtenerRequerimientoPorId(requerimientoId) : undefined;

  // Estado del formulario
  const [formData, setFormData] = useState<Partial<NuevoRequerimientoInput>>({
    titulo: '',
    descripcion: '',
    centroCosto: undefined,
    prioridad: 'media',
    solicitanteNombre: usuarioActual.nombre,
    solicitanteEmail: usuarioActual.email,
    fechaRequerida: '',
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (isEditing && requerimientoExistente) {
      setFormData({
        titulo: requerimientoExistente.titulo,
        descripcion: requerimientoExistente.descripcion,
        centroCosto: requerimientoExistente.centroCosto,
        prioridad: requerimientoExistente.prioridad,
        solicitanteNombre: requerimientoExistente.solicitanteNombre,
        solicitanteEmail: requerimientoExistente.solicitanteEmail,
        fechaRequerida: requerimientoExistente.fechaRequerida || '',
        items: requerimientoExistente.items.map(({ id, ...item }) => item)
      });
    }
  }, [isEditing, requerimientoExistente]);

  // Calcular total estimado
  const totalEstimado = (formData.items || []).reduce(
    (sum, item) => sum + (item.cantidad || 0) * (item.precioEstimado || 0), 
    0
  );

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Título
    if (!formData.titulo) {
      newErrors.titulo = 'El título es obligatorio';
    } else {
      const validTitulo = validarTitulo(formData.titulo);
      if (!validTitulo.valid) newErrors.titulo = validTitulo.error!;
    }

    // Descripción
    if (!formData.descripcion) {
      newErrors.descripcion = 'La descripción es obligatoria';
    } else {
      const validDesc = validarDescripcion(formData.descripcion);
      if (!validDesc.valid) newErrors.descripcion = validDesc.error!;
    }

    // Centro de Costo
    if (!formData.centroCosto) {
      newErrors.centroCosto = 'El centro de costo es obligatorio';
    }

    // Prioridad
    if (!formData.prioridad) {
      newErrors.prioridad = 'La prioridad es obligatoria';
    }

    // Solicitante
    if (!formData.solicitanteNombre?.trim()) {
      newErrors.solicitanteNombre = 'El nombre del solicitante es obligatorio';
    }

    if (!formData.solicitanteEmail) {
      newErrors.solicitanteEmail = 'El email del solicitante es obligatorio';
    } else {
      const validEmail = validarEmail(formData.solicitanteEmail);
      if (!validEmail.valid) newErrors.solicitanteEmail = validEmail.error!;
    }

    // Items
    if (!formData.items || formData.items.length === 0) {
      newErrors.items = 'Debe agregar al menos un item';
    } else {
      formData.items.forEach((item, idx) => {
        if (!item.descripcion?.trim()) {
          newErrors[`item-${idx}-descripcion`] = 'La descripción es obligatoria';
        }
        if (!item.cantidad || item.cantidad <= 0) {
          newErrors[`item-${idx}-cantidad`] = 'La cantidad debe ser mayor a 0';
        }
        if (!item.unidad?.trim()) {
          newErrors[`item-${idx}-unidad`] = 'La unidad es obligatoria';
        }
        if (!item.precioEstimado || item.precioEstimado < 0) {
          newErrors[`item-${idx}-precioEstimado`] = 'El precio estimado es obligatorio';
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
        // Actualizar requerimiento
        const resActualizar = await actualizarRequerimiento(requerimientoId, formData);
        if (!resActualizar.exito) {
          toast.error(resActualizar.errores?.[0] ?? 'Error al actualizar el requerimiento');
          return;
        }
        if (enviar) {
          await cambiarEstado(requerimientoId, 'enviado');
          toast.success('Requerimiento actualizado y enviado para aprobación');
        } else {
          toast.success('Requerimiento actualizado correctamente');
        }
        onSuccess(requerimientoId);
      } else {
        // Crear requerimiento
        const resCrear = await crearRequerimiento(formData as NuevoRequerimientoInput);
        if (!resCrear.exito || !resCrear.requerimiento) {
          toast.error(resCrear.errores?.[0] ?? 'Error al crear el requerimiento');
          return;
        }
        const nuevoReq = resCrear.requerimiento;
        if (enviar) {
          await cambiarEstado(nuevoReq.id, 'enviado');
          toast.success(`Requerimiento ${nuevoReq.id} creado y enviado para aprobación`);
        } else {
          toast.success(`Requerimiento ${nuevoReq.id} guardado como borrador`);
        }
        onSuccess(nuevoReq.id);
      }
    } catch (error) {
      toast.error('Error al guardar el requerimiento');
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
      precioEstimado: 0,
      comentario: null
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
    // Limpiar errores de ese item
    const newErrors = { ...errors };
    delete newErrors[`item-${index}-descripcion`];
    delete newErrors[`item-${index}-cantidad`];
    delete newErrors[`item-${index}-unidad`];
    delete newErrors[`item-${index}-precioEstimado`];
    setErrors(newErrors);
  };

  // Actualizar item
  const actualizarItem = (index: number, campo: keyof Omit<ItemRequerimiento, 'id'>, valor: any) => {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>{isEditing ? 'Editar Requerimiento' : 'Nuevo Requerimiento'}</h2>
          <p className="text-muted-foreground mt-1">
            {isEditing 
              ? `Modificando ${requerimientoExistente?.id}`
              : 'Complete los datos del nuevo requerimiento de compra'}
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          <X className="size-4" />
          Cancelar
        </Button>
      </div>

      {/* Formulario */}
      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="space-y-6">
          {/* Información General */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título del Requerimiento *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => {
                    setFormData({ ...formData, titulo: e.target.value });
                    if (errors.titulo) setErrors({ ...errors, titulo: '' });
                  }}
                  placeholder="Ej: Repuestos para ambulancia AMB-001"
                />
                {errors.titulo && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.titulo}
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción Detallada *</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => {
                    setFormData({ ...formData, descripcion: e.target.value });
                    if (errors.descripcion) setErrors({ ...errors, descripcion: '' });
                  }}
                  placeholder="Describa detalladamente lo que necesita..."
                  rows={3}
                />
                {errors.descripcion && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.descripcion}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Centro de Costo */}
                <div className="space-y-2">
                  <Label htmlFor="centroCosto">Centro de Costo *</Label>
                  <Select 
                    value={formData.centroCosto} 
                    onValueChange={(v) => {
                      setFormData({ ...formData, centroCosto: v as CentroCosto });
                      if (errors.centroCosto) setErrors({ ...errors, centroCosto: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione centro" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CENTRO_COSTO_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.centroCosto && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.centroCosto}
                    </p>
                  )}
                </div>

                {/* Prioridad */}
                <div className="space-y-2">
                  <Label htmlFor="prioridad">Prioridad *</Label>
                  <Select 
                    value={formData.prioridad} 
                    onValueChange={(v) => setFormData({ ...formData, prioridad: v as PrioridadRequerimiento })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta (Urgente)</SelectItem>
                      <SelectItem value="media">Media (Normal)</SelectItem>
                      <SelectItem value="baja">Baja (Puede esperar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fecha Requerida */}
                <div className="space-y-2">
                  <Label htmlFor="fechaRequerida">Fecha Requerida</Label>
                  <Input
                    id="fechaRequerida"
                    type="date"
                    value={formData.fechaRequerida}
                    onChange={(e) => setFormData({ ...formData, fechaRequerida: e.target.value })}
                  />
                </div>

                {/* Proyecto (imputación) */}
                <div className="space-y-2">
                  <Label>Proyecto</Label>
                  <ProyectoSelector
                    value={formData.proyectoId ?? null}
                    onChange={(v) => setFormData({ ...formData, proyectoId: v })}
                    nullable
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solicitante */}
          <Card>
            <CardHeader>
              <CardTitle>Datos del Solicitante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="solicitanteNombre">Nombre Completo *</Label>
                  <Input
                    id="solicitanteNombre"
                    value={formData.solicitanteNombre}
                    onChange={(e) => {
                      setFormData({ ...formData, solicitanteNombre: e.target.value });
                      if (errors.solicitanteNombre) setErrors({ ...errors, solicitanteNombre: '' });
                    }}
                    placeholder="Nombre del solicitante"
                  />
                  {errors.solicitanteNombre && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.solicitanteNombre}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solicitanteEmail">Email *</Label>
                  <Input
                    id="solicitanteEmail"
                    type="email"
                    value={formData.solicitanteEmail}
                    onChange={(e) => {
                      setFormData({ ...formData, solicitanteEmail: e.target.value });
                      if (errors.solicitanteEmail) setErrors({ ...errors, solicitanteEmail: '' });
                    }}
                    placeholder="email@kesa.com"
                  />
                  {errors.solicitanteEmail && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.solicitanteEmail}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items del Requerimiento *</CardTitle>
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
                            </SelectContent>
                          </Select>
                          {errors[`item-${idx}-unidad`] && (
                            <p className="text-sm text-red-600">{errors[`item-${idx}-unidad`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Precio Estimado (S/) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precioEstimado}
                            onChange={(e) => actualizarItem(idx, 'precioEstimado', parseFloat(e.target.value) || 0)}
                          />
                          {errors[`item-${idx}-precioEstimado`] && (
                            <p className="text-sm text-red-600">{errors[`item-${idx}-precioEstimado`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Subtotal</Label>
                          <Input
                            value={formatearMonto(item.cantidad * item.precioEstimado)}
                            disabled
                            className="bg-muted"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label>Comentarios</Label>
                          <Textarea
                            value={item.comentario || ''}
                            onChange={(e) => actualizarItem(idx, 'comentario', e.target.value || null)}
                            placeholder="Comentarios adicionales (opcional)"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              {(formData.items || []).length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total Estimado:</span>
                    <span className="text-primary">{formatearMonto(totalEstimado)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              <Save className="size-4" />
              Guardar como Borrador
            </Button>
            <Button 
              type="button" 
              onClick={(e) => handleSubmit(e, true)} 
              disabled={isSubmitting}
            >
              <Save className="size-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar y Enviar'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
