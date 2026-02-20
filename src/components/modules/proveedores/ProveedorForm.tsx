import { useState, useEffect } from 'react';
import { ArrowLeft, Save, X, AlertCircle } from 'lucide-react';
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
import { Checkbox } from '../../ui/checkbox';
import { useProveedorStore, type NuevoProveedorInput } from '../../../lib/proveedores/proveedores-store';
import {
  validarRUC,
  validarEmail,
  validarTelefono,
  validarRazonSocial,
  validarDireccion,
  PROVEEDOR_CATEGORIA_LABELS,
  type TipoProveedor,
  type CategoriaProveedor
} from '../../../lib/proveedores/proveedores-config';
import { toast } from 'sonner';

interface ProveedorFormProps {
  proveedorId?: string; // Si existe, es edición
  onCancel: () => void;
  onSuccess: (proveedorId: string) => void;
}

export function ProveedorForm({ proveedorId, onCancel, onSuccess }: ProveedorFormProps) {
  const { obtenerProveedorPorId, crearProveedor, actualizarProveedor, obtenerProveedorPorRUC } = useProveedorStore();
  const isEditing = !!proveedorId;
  const proveedorExistente = isEditing ? obtenerProveedorPorId(proveedorId) : undefined;

  // Estado del formulario
  const [formData, setFormData] = useState<Partial<NuevoProveedorInput>>({
    ruc: '',
    razonSocial: '',
    nombreComercial: '',
    tipo: undefined,
    categorias: [],
    email: '',
    telefono: '',
    telefonoAlternativo: '',
    direccion: '',
    ciudad: 'Lima',
    pais: 'Perú',
    contactoPrincipal: undefined,
    observaciones: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showContactoPrincipal, setShowContactoPrincipal] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (isEditing && proveedorExistente) {
      setFormData({
        ruc: proveedorExistente.ruc,
        razonSocial: proveedorExistente.razonSocial,
        nombreComercial: proveedorExistente.nombreComercial || '',
        tipo: proveedorExistente.tipo,
        categorias: proveedorExistente.categorias,
        email: proveedorExistente.email,
        telefono: proveedorExistente.telefono,
        telefonoAlternativo: proveedorExistente.telefonoAlternativo || '',
        direccion: proveedorExistente.direccion,
        ciudad: proveedorExistente.ciudad,
        pais: proveedorExistente.pais,
        contactoPrincipal: proveedorExistente.contactoPrincipal || undefined,
        observaciones: proveedorExistente.observaciones || ''
      });
      setShowContactoPrincipal(!!proveedorExistente.contactoPrincipal);
    }
  }, [isEditing, proveedorExistente]);

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // RUC
    if (!formData.ruc) {
      newErrors.ruc = 'El RUC es obligatorio';
    } else {
      const validRUC = validarRUC(formData.ruc);
      if (!validRUC.valid) newErrors.ruc = validRUC.error!;
    }

    // Verificar RUC duplicado (solo en creación)
    if (!isEditing && formData.ruc) {
      const existente = obtenerProveedorPorRUC(formData.ruc);
      if (existente) {
        newErrors.ruc = 'Ya existe un proveedor con este RUC';
      }
    }

    // Razón Social
    if (!formData.razonSocial) {
      newErrors.razonSocial = 'La razón social es obligatoria';
    } else {
      const validRS = validarRazonSocial(formData.razonSocial);
      if (!validRS.valid) newErrors.razonSocial = validRS.error!;
    }

    // Tipo
    if (!formData.tipo) {
      newErrors.tipo = 'El tipo de proveedor es obligatorio';
    }

    // Categorías
    if (!formData.categorias || formData.categorias.length === 0) {
      newErrors.categorias = 'Debe seleccionar al menos una categoría';
    }

    // Email
    if (!formData.email) {
      newErrors.email = 'El email es obligatorio';
    } else {
      const validEmail = validarEmail(formData.email);
      if (!validEmail.valid) newErrors.email = validEmail.error!;
    }

    // Teléfono
    if (!formData.telefono) {
      newErrors.telefono = 'El teléfono es obligatorio';
    } else {
      const validTel = validarTelefono(formData.telefono);
      if (!validTel.valid) newErrors.telefono = validTel.error!;
    }

    // Teléfono Alternativo (opcional pero debe ser válido si existe)
    if (formData.telefonoAlternativo) {
      const validTelAlt = validarTelefono(formData.telefonoAlternativo);
      if (!validTelAlt.valid) newErrors.telefonoAlternativo = validTelAlt.error!;
    }

    // Dirección
    if (!formData.direccion) {
      newErrors.direccion = 'La dirección es obligatoria';
    } else {
      const validDir = validarDireccion(formData.direccion);
      if (!validDir.valid) newErrors.direccion = validDir.error!;
    }

    // Ciudad
    if (!formData.ciudad?.trim()) {
      newErrors.ciudad = 'La ciudad es obligatoria';
    }

    // País
    if (!formData.pais?.trim()) {
      newErrors.pais = 'El país es obligatorio';
    }

    // Contacto Principal (si está habilitado)
    if (showContactoPrincipal && formData.contactoPrincipal) {
      const cp = formData.contactoPrincipal;
      if (!cp.nombre?.trim()) newErrors['contactoPrincipal.nombre'] = 'El nombre es obligatorio';
      if (!cp.cargo?.trim()) newErrors['contactoPrincipal.cargo'] = 'El cargo es obligatorio';
      if (!cp.email) {
        newErrors['contactoPrincipal.email'] = 'El email es obligatorio';
      } else {
        const validEmail = validarEmail(cp.email);
        if (!validEmail.valid) newErrors['contactoPrincipal.email'] = validEmail.error!;
      }
      if (!cp.telefono) {
        newErrors['contactoPrincipal.telefono'] = 'El teléfono es obligatorio';
      } else {
        const validTel = validarTelefono(cp.telefono);
        if (!validTel.valid) newErrors['contactoPrincipal.telefono'] = validTel.error!;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrige los errores del formulario');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        // Actualizar proveedor
        actualizarProveedor(proveedorId, formData);
        toast.success('Proveedor actualizado correctamente');
        onSuccess(proveedorId);
      } else {
        // Crear proveedor
        const nuevoProveedor = crearProveedor(formData as NuevoProveedorInput);
        toast.success(`Proveedor ${nuevoProveedor.id} creado correctamente`);
        onSuccess(nuevoProveedor.id);
      }
    } catch (error) {
      toast.error('Error al guardar el proveedor');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar cambio de categorías
  const handleCategoriaToggle = (categoria: CategoriaProveedor) => {
    const current = formData.categorias || [];
    const updated = current.includes(categoria)
      ? current.filter(c => c !== categoria)
      : [...current, categoria];
    setFormData({ ...formData, categorias: updated });
    if (errors.categorias) setErrors({ ...errors, categorias: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
          <p className="text-muted-foreground mt-1">
            {isEditing 
              ? `Modificando datos del proveedor ${proveedorExistente?.razonSocial}`
              : 'Complete los datos del nuevo proveedor'}
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          <X className="size-4 mr-2" />
          Cancelar
        </Button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Información Básica */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* RUC */}
                <div className="space-y-2">
                  <Label htmlFor="ruc">RUC *</Label>
                  <Input
                    id="ruc"
                    value={formData.ruc}
                    onChange={(e) => {
                      setFormData({ ...formData, ruc: e.target.value });
                      if (errors.ruc) setErrors({ ...errors, ruc: '' });
                    }}
                    placeholder="20512345678"
                    maxLength={11}
                    disabled={isEditing} // No se puede editar RUC
                  />
                  {errors.ruc && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.ruc}
                    </p>
                  )}
                </div>

                {/* Razón Social */}
                <div className="space-y-2">
                  <Label htmlFor="razonSocial">Razón Social *</Label>
                  <Input
                    id="razonSocial"
                    value={formData.razonSocial}
                    onChange={(e) => {
                      setFormData({ ...formData, razonSocial: e.target.value });
                      if (errors.razonSocial) setErrors({ ...errors, razonSocial: '' });
                    }}
                    placeholder="Empresa SAC"
                  />
                  {errors.razonSocial && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.razonSocial}
                    </p>
                  )}
                </div>

                {/* Nombre Comercial */}
                <div className="space-y-2">
                  <Label htmlFor="nombreComercial">Nombre Comercial</Label>
                  <Input
                    id="nombreComercial"
                    value={formData.nombreComercial}
                    onChange={(e) => setFormData({ ...formData, nombreComercial: e.target.value })}
                    placeholder="Nombre comercial o marca"
                  />
                </div>

                {/* Tipo */}
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Proveedor *</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(v) => {
                      setFormData({ ...formData, tipo: v as TipoProveedor });
                      if (errors.tipo) setErrors({ ...errors, tipo: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bienes">Bienes</SelectItem>
                      <SelectItem value="servicios">Servicios</SelectItem>
                      <SelectItem value="mixto">Mixto</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.tipo && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.tipo}
                    </p>
                  )}
                </div>
              </div>

              {/* Categorías */}
              <div className="space-y-2">
                <Label>Categorías *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border rounded-lg p-4">
                  {Object.entries(PROVEEDOR_CATEGORIA_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${key}`}
                        checked={formData.categorias?.includes(key as CategoriaProveedor)}
                        onCheckedChange={() => handleCategoriaToggle(key as CategoriaProveedor)}
                      />
                      <label
                        htmlFor={`cat-${key}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
                {errors.categorias && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.categorias}
                  </p>
                )}
                {formData.categorias && formData.categorias.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.categorias.map(cat => (
                      <Badge key={cat} variant="secondary">
                        {PROVEEDOR_CATEGORIA_LABELS[cat]}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader>
              <CardTitle>Datos de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    placeholder="contacto@empresa.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Teléfono */}
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono *</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => {
                      setFormData({ ...formData, telefono: e.target.value });
                      if (errors.telefono) setErrors({ ...errors, telefono: '' });
                    }}
                    placeholder="987654321"
                    maxLength={9}
                  />
                  {errors.telefono && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.telefono}
                    </p>
                  )}
                </div>

                {/* Teléfono Alternativo */}
                <div className="space-y-2">
                  <Label htmlFor="telefonoAlternativo">Teléfono Alternativo</Label>
                  <Input
                    id="telefonoAlternativo"
                    value={formData.telefonoAlternativo}
                    onChange={(e) => {
                      setFormData({ ...formData, telefonoAlternativo: e.target.value });
                      if (errors.telefonoAlternativo) setErrors({ ...errors, telefonoAlternativo: '' });
                    }}
                    placeholder="987654322"
                    maxLength={9}
                  />
                  {errors.telefonoAlternativo && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.telefonoAlternativo}
                    </p>
                  )}
                </div>
              </div>

              {/* Dirección */}
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección *</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => {
                    setFormData({ ...formData, direccion: e.target.value });
                    if (errors.direccion) setErrors({ ...errors, direccion: '' });
                  }}
                  placeholder="Av. Principal 123, Distrito"
                />
                {errors.direccion && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.direccion}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ciudad */}
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad *</Label>
                  <Input
                    id="ciudad"
                    value={formData.ciudad}
                    onChange={(e) => {
                      setFormData({ ...formData, ciudad: e.target.value });
                      if (errors.ciudad) setErrors({ ...errors, ciudad: '' });
                    }}
                    placeholder="Lima"
                  />
                  {errors.ciudad && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.ciudad}
                    </p>
                  )}
                </div>

                {/* País */}
                <div className="space-y-2">
                  <Label htmlFor="pais">País *</Label>
                  <Input
                    id="pais"
                    value={formData.pais}
                    onChange={(e) => {
                      setFormData({ ...formData, pais: e.target.value });
                      if (errors.pais) setErrors({ ...errors, pais: '' });
                    }}
                    placeholder="Perú"
                  />
                  {errors.pais && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.pais}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contacto Principal (Opcional) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contacto Principal</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowContactoPrincipal(!showContactoPrincipal);
                    if (!showContactoPrincipal) {
                      setFormData({
                        ...formData,
                        contactoPrincipal: {
                          nombre: '',
                          cargo: '',
                          email: '',
                          telefono: ''
                        }
                      });
                    } else {
                      setFormData({ ...formData, contactoPrincipal: undefined });
                    }
                  }}
                >
                  {showContactoPrincipal ? 'Ocultar' : 'Agregar'}
                </Button>
              </div>
            </CardHeader>
            {showContactoPrincipal && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cp-nombre">Nombre Completo *</Label>
                    <Input
                      id="cp-nombre"
                      value={formData.contactoPrincipal?.nombre || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactoPrincipal: { ...formData.contactoPrincipal!, nombre: e.target.value }
                      })}
                      placeholder="Juan Pérez García"
                    />
                    {errors['contactoPrincipal.nombre'] && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {errors['contactoPrincipal.nombre']}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cp-cargo">Cargo *</Label>
                    <Input
                      id="cp-cargo"
                      value={formData.contactoPrincipal?.cargo || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactoPrincipal: { ...formData.contactoPrincipal!, cargo: e.target.value }
                      })}
                      placeholder="Gerente Comercial"
                    />
                    {errors['contactoPrincipal.cargo'] && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {errors['contactoPrincipal.cargo']}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cp-email">Email *</Label>
                    <Input
                      id="cp-email"
                      type="email"
                      value={formData.contactoPrincipal?.email || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactoPrincipal: { ...formData.contactoPrincipal!, email: e.target.value }
                      })}
                      placeholder="jperez@empresa.com"
                    />
                    {errors['contactoPrincipal.email'] && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {errors['contactoPrincipal.email']}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cp-telefono">Teléfono *</Label>
                    <Input
                      id="cp-telefono"
                      value={formData.contactoPrincipal?.telefono || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactoPrincipal: { ...formData.contactoPrincipal!, telefono: e.target.value }
                      })}
                      placeholder="987654321"
                      maxLength={9}
                    />
                    {errors['contactoPrincipal.telefono'] && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {errors['contactoPrincipal.telefono']}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales sobre el proveedor..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="size-4 mr-2" />
              {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Proveedor')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
