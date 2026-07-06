import { useState, useEffect } from 'react';
import { Save, X, AlertCircle, CreditCard, Receipt, Plus, Trash2, CheckCircle, Loader2, ShieldCheck, Building2 } from 'lucide-react';
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
import { Checkbox } from '../../ui/checkbox';
import { Switch } from '../../ui/switch';
import { SunatRucInput } from '../../ui/SunatRucInput';
import { formatearDireccionSunat, consultarRUC, type SunatRucResult } from '../../../lib/sunat/sunat-service';
import { useProveedorStore, type NuevoProveedorInput } from '../../../lib/proveedores/proveedores-store';
import {
  validarRUC,
  validarEmail,
  validarTelefono,
  validarRazonSocial,
  validarDireccion,
  PROVEEDOR_CATEGORIA_LABELS,
  type TipoProveedor,
} from '../../../lib/proveedores/proveedores-config';

// ─── Tipos locales del formulario (extienden NuevoProveedorInput con campos de UI)
type CuentaBancariaForm = {
  banco: string;
  numeroCuenta: string;
  cci: string;
  tipoCuenta: 'corriente' | 'ahorros' | 'detraccion';
  moneda: 'PEN' | 'USD';
  titular?: string;
};

type DatosTributariosForm = {
  sujetoDetraccion: boolean;
  tasaDetraccion?: number;
  codigoBienServicio?: string;
  sujetoRetencion: boolean;
  // Campos de UI — no se persisten en store
  verificadoSunat?: boolean;
  verificacionSunatEn?: string | null;
};

type ProveedorFormState = Omit<Partial<NuevoProveedorInput>, 'datosBancarios' | 'datosTributarios'> & {
  cuentasBancarias: CuentaBancariaForm[];
  datosTributarios?: DatosTributariosForm;
};
import { toast } from 'sonner';

interface ProveedorFormProps {
  proveedorId?: string; // Si existe, es edición
  onCancel: () => void;
  onSuccess: (proveedorId: string) => void;
}

export function ProveedorForm({ proveedorId, onCancel, onSuccess }: ProveedorFormProps) {
  const { obtenerProveedorPorId, crearProveedor, actualizarProveedor, obtenerProveedorPorRUC } = useProveedorStore();
  // Categorías derivadas del config centralizado (no del store — el store no las expone)
  const categorias = Object.entries(PROVEEDOR_CATEGORIA_LABELS).map(([key, label]) => ({ key, label }));
  const isEditing = !!proveedorId;
  const proveedorExistente = isEditing ? obtenerProveedorPorId(proveedorId) : undefined;

  // Estado del formulario — usa ProveedorFormState (superset de NuevoProveedorInput)
  const [formData, setFormData] = useState<ProveedorFormState>({
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
    cuentasBancarias: [],
    datosTributarios: { sujetoDetraccion: false, tasaDetraccion: undefined, codigoBienServicio: undefined, sujetoRetencion: false, verificadoSunat: false },
    observaciones: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showContactoPrincipal, setShowContactoPrincipal] = useState(false);
  const [verifyingSunat, setVerifyingSunat] = useState(false);
  // Proveedor extranjero sin RUC peruano (Tax ID libre; no aplica SUNAT)
  const [noDomiciliado, setNoDomiciliado] = useState(false);

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
        // Mapear datosBancarios (objeto único del store) → cuentasBancarias[] (UI multi-cuenta)
        cuentasBancarias: proveedorExistente.datosBancarios
          ? [{
              banco: proveedorExistente.datosBancarios.banco,
              numeroCuenta: proveedorExistente.datosBancarios.numeroCuenta,
              cci: proveedorExistente.datosBancarios.cci ?? '',
              tipoCuenta: proveedorExistente.datosBancarios.tipoCuenta,
              moneda: proveedorExistente.datosBancarios.moneda,
              titular: '',
            }]
          : [],
        datosTributarios: {
          sujetoDetraccion: proveedorExistente.datosTributarios?.sujetoDetraccion ?? false,
          tasaDetraccion: proveedorExistente.datosTributarios?.tasaDetraccion ?? undefined,
          codigoBienServicio: proveedorExistente.datosTributarios?.codigoBienServicio ?? undefined,
          sujetoRetencion: proveedorExistente.datosTributarios?.sujetoRetencion ?? false,
          verificadoSunat: false,
        },
        observaciones: proveedorExistente.observaciones || ''
      });
      setShowContactoPrincipal(!!proveedorExistente.contactoPrincipal);
      // Un proveedor existente sin RUC peruano de 11 dígitos es no domiciliado
      setNoDomiciliado(!/^\d{11}$/.test(proveedorExistente.ruc ?? ''));
    }
  }, [isEditing, proveedorExistente]);

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // RUC — para NO DOMICILIADOS (extranjeros) no aplica el RUC peruano:
    // se acepta un Tax ID libre (opcional; si falta se genera EXT-xxxx al guardar).
    if (noDomiciliado) {
      if (formData.ruc && /^\d{11}$/.test(formData.ruc)) {
        newErrors.ruc = 'Un RUC de 11 dígitos corresponde a un proveedor domiciliado — desmarca la casilla';
      }
    } else if (!formData.ruc) {
      newErrors.ruc = 'El RUC es obligatorio';
    } else {
      const validRUC = validarRUC(formData.ruc);
      if (!validRUC.valid) newErrors.ruc = validRUC.error!;
    }

    // Verificar RUC/Tax ID duplicado (solo en creación)
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, corrige los errores del formulario');
      return;
    }

    setIsSubmitting(true);

    try {
      // Mapear cuentasBancarias[0] → datosBancarios (el store persiste 1 cuenta)
      const primeraCuenta = formData.cuentasBancarias?.[0];
      const datosBancarios: NuevoProveedorInput['datosBancarios'] = primeraCuenta?.banco
        ? {
            banco: primeraCuenta.banco,
            numeroCuenta: primeraCuenta.numeroCuenta,
            cci: primeraCuenta.cci || undefined,
            // 'detraccion' es tipo de UI — persiste como 'corriente' en DB
            tipoCuenta: primeraCuenta.tipoCuenta === 'detraccion' ? 'corriente' : primeraCuenta.tipoCuenta,
            moneda: primeraCuenta.moneda,
          }
        : undefined;

      // Limpiar campos de UI (verificadoSunat, etc.) antes de pasar al store
      const datosTributarios: NuevoProveedorInput['datosTributarios'] = formData.datosTributarios
        ? {
            sujetoDetraccion: formData.datosTributarios.sujetoDetraccion,
            tasaDetraccion: formData.datosTributarios.tasaDetraccion,
            codigoBienServicio: formData.datosTributarios.codigoBienServicio,
            sujetoRetencion: formData.datosTributarios.sujetoRetencion,
          }
        : undefined;

      // No domiciliado sin Tax ID → identificador sintético único (patrón EXT- de la migración)
      const rucFinal = noDomiciliado && !formData.ruc?.trim()
        ? `EXT-${Date.now().toString(36).toUpperCase()}`
        : formData.ruc!;

      const input: NuevoProveedorInput = {
        ruc: rucFinal,
        razonSocial: formData.razonSocial!,
        nombreComercial: formData.nombreComercial,
        tipo: formData.tipo!,
        categorias: formData.categorias!,
        email: formData.email!,
        telefono: formData.telefono!,
        telefonoAlternativo: formData.telefonoAlternativo,
        direccion: formData.direccion!,
        ciudad: formData.ciudad!,
        pais: formData.pais!,
        contactoPrincipal: showContactoPrincipal ? formData.contactoPrincipal : undefined,
        datosBancarios,
        datosTributarios,
        observaciones: formData.observaciones,
      };

      if (isEditing) {
        const result = await actualizarProveedor(proveedorId, input);
        if (result.exito) {
          toast.success('Proveedor actualizado correctamente');
          onSuccess(proveedorId);
        } else {
          toast.error(result.errores?.[0] ?? 'Error al actualizar');
        }
      } else {
        const nuevo = await crearProveedor(input);
        toast.success(`Proveedor ${nuevo.id} creado correctamente`);
        onSuccess(nuevo.id);
      }
    } catch (error) {
      toast.error('Error al guardar el proveedor');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Autocompletar desde SUNAT
  const handleSunatData = (data: SunatRucResult) => {
    const dir = formatearDireccionSunat(data);
    setFormData(prev => ({
      ...prev,
      razonSocial: data.razonSocial || prev.razonSocial,
      nombreComercial: data.nombreComercial || prev.nombreComercial,
      // SUNAT retorna 'persona_natural'|'empresa' — mapear a TipoProveedor válido
      tipo: prev.tipo ?? (data.tipo === 'persona_natural' ? 'servicios' : 'bienes'),
      ...(dir ? { direccion: dir } : {}),
      ...(data.departamento ? { ciudad: data.departamento } : {}),
    }));
    // Limpiar errores de los campos rellenados automáticamente
    setErrors(prev => ({ ...prev, razonSocial: '', ruc: '' }));
    toast.success('Datos cargados desde SUNAT', { description: data.razonSocial });
  };

  // Verificar datos tributarios en SUNAT
  const handleVerificarSunat = async () => {
    if (!formData.ruc || formData.ruc.length !== 11) {
      toast.error('Ingresa el RUC primero');
      return;
    }
    setVerifyingSunat(true);
    try {
      const data = await consultarRUC(formData.ruc);
      if (!data) {
        toast.error('RUC no encontrado en SUNAT');
        return;
      }
      const ahora = new Date().toISOString();
      // Determine detracción from condicion/estado data
      const esActivo = data.estado?.toUpperCase().includes('ACTIVO');
      const esHabido = data.condicion?.toUpperCase().includes('HABIDO');
      setFormData(prev => ({
        ...prev,
        datosTributarios: {
          ...prev.datosTributarios!,
          verificadoSunat: true,
          verificacionSunatEn: ahora,
          // Only set sujetoDetraccion if SUNAT indicates it (API may include it)
          ...(data.estado && { _sunatEstado: data.estado }),
          ...(data.condicion && { _sunatCondicion: data.condicion }),
        }
      }));
      toast.success('Verificado en SUNAT', {
        description: `${data.razonSocial} — ${data.estado} / ${data.condicion}`,
      });
    } finally {
      setVerifyingSunat(false);
    }
  };

  // Manejar cambio de categorías
  const handleCategoriaToggle = (categoriaKey: string) => {
    const current = formData.categorias || [];
    const updated = current.includes(categoriaKey)
      ? current.filter(c => c !== categoriaKey)
      : [...current, categoriaKey];
    setFormData({ ...formData, categorias: updated });
    if (errors.categorias) setErrors({ ...errors, categorias: '' });
  };

  return (
    <div className="space-y-6">
      <PageNav onBack={onCancel} />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="size-6 shrink-0" style={{ color: '#000000' }} />
          <div>
            <h2 className="text-2xl font-semibold">{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
            <p className="text-muted-foreground mt-1">
              {isEditing
                ? `Modificando datos del proveedor ${proveedorExistente?.razonSocial}`
                : 'Complete los datos del nuevo proveedor'}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onCancel} className="border border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          <X className="size-4" />
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
                {/* RUC con búsqueda SUNAT / Tax ID para no domiciliados */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ruc">{noDomiciliado ? 'Identificación fiscal (Tax ID)' : 'RUC *'}</Label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={noDomiciliado}
                        onCheckedChange={(v: boolean) => {
                          setNoDomiciliado(!!v);
                          if (errors.ruc) setErrors({ ...errors, ruc: '' });
                        }}
                        disabled={isEditing}
                      />
                      Proveedor no domiciliado (extranjero)
                    </label>
                  </div>
                  {isEditing ? (
                    <Input value={formData.ruc} disabled className="bg-muted" />
                  ) : noDomiciliado ? (
                    <>
                      <Input
                        id="ruc"
                        value={formData.ruc ?? ''}
                        onChange={(e) => {
                          setFormData({ ...formData, ruc: e.target.value });
                          if (errors.ruc) setErrors({ ...errors, ruc: '' });
                        }}
                        placeholder="Tax ID / VAT / EIN del proveedor extranjero (opcional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sin RUC peruano: no aplica verificación SUNAT ni detracción/retención.
                        Si se deja vacío, se genera un identificador interno (EXT-…).
                      </p>
                      {errors.ruc && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {errors.ruc}
                        </p>
                      )}
                    </>
                  ) : (
                    <SunatRucInput
                      value={formData.ruc ?? ''}
                      onChange={(v) => {
                        setFormData({ ...formData, ruc: v });
                        if (errors.ruc) setErrors({ ...errors, ruc: '' });
                      }}
                      onSunatData={handleSunatData}
                      error={errors.ruc}
                    />
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

              {/* Categorías — dinámicas desde DB */}
              <div className="space-y-2">
                <Label>Categorías *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border rounded-lg p-4">
                  {categorias.map(cat => (
                    <div key={cat.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${cat.key}`}
                        checked={formData.categorias?.includes(cat.key)}
                        onCheckedChange={() => handleCategoriaToggle(cat.key)}
                      />
                      <label
                        htmlFor={`cat-${cat.key}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {cat.label}
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
                    {formData.categorias.map(key => {
                      const cat = categorias.find(c => c.key === key);
                      return <Badge key={key} variant="secondary">{cat?.label ?? key}</Badge>;
                    })}
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
                  className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black"
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

          {/* Datos Bancarios — múltiples cuentas */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="size-5" />
                  Cuentas Bancarias
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    cuentasBancarias: [
                      ...(prev.cuentasBancarias ?? []),
                      { banco: '', tipoCuenta: 'corriente', moneda: 'PEN', numeroCuenta: '', cci: '', titular: '' }
                    ]
                  }))}
                >
                  <Plus className="size-4" />
                  Agregar cuenta
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(!formData.cuentasBancarias || formData.cuentasBancarias.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  Sin cuentas bancarias registradas. Haga clic en "Agregar cuenta" para añadir una.
                </p>
              )}
              {formData.cuentasBancarias?.map((cuenta, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-muted-foreground">Cuenta #{idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        cuentasBancarias: prev.cuentasBancarias?.filter((_, i) => i !== idx)
                      }))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Banco</Label>
                      <Select
                        value={cuenta.banco}
                        onValueChange={(v) => setFormData(prev => ({
                          ...prev,
                          cuentasBancarias: prev.cuentasBancarias?.map((c, i) => i === idx ? { ...c, banco: v } : c)
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione banco" />
                        </SelectTrigger>
                        <SelectContent>
                          {['BCP', 'BBVA', 'Scotiabank', 'Interbank', 'BanBif', 'Banco Pichincha', 'Mibanco', 'Banco de la Nación', 'Otro'].map(b => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de Cuenta</Label>
                      <Select
                        value={cuenta.tipoCuenta}
                        onValueChange={(v) => setFormData(prev => ({
                          ...prev,
                          cuentasBancarias: prev.cuentasBancarias?.map((c, i) => i === idx ? { ...c, tipoCuenta: v as 'corriente' | 'ahorros' | 'detraccion' } : c)
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corriente">Cuenta Corriente</SelectItem>
                          <SelectItem value="ahorros">Cuenta de Ahorros</SelectItem>
                          <SelectItem value="detraccion">Cuenta de Detracción</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Moneda</Label>
                      <Select
                        value={cuenta.moneda}
                        onValueChange={(v) => setFormData(prev => ({
                          ...prev,
                          cuentasBancarias: prev.cuentasBancarias?.map((c, i) => i === idx ? { ...c, moneda: v as 'PEN' | 'USD' } : c)
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PEN">Soles (PEN)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Número de Cuenta</Label>
                      <Input
                        value={cuenta.numeroCuenta}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cuentasBancarias: prev.cuentasBancarias?.map((c, i) => i === idx ? { ...c, numeroCuenta: e.target.value } : c)
                        }))}
                        placeholder="000-123456789-0-00"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">CCI (Código Interbancario)</Label>
                      <Input
                        value={cuenta.cci}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cuentasBancarias: prev.cuentasBancarias?.map((c, i) => i === idx ? { ...c, cci: e.target.value } : c)
                        }))}
                        placeholder="00219300012345678900"
                        maxLength={20}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Titular (opcional)</Label>
                      <Input
                        value={cuenta.titular ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cuentasBancarias: prev.cuentasBancarias?.map((c, i) => i === idx ? { ...c, titular: e.target.value } : c)
                        }))}
                        placeholder="Razón social del titular"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Datos Tributarios */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-5" />
                  Datos Tributarios
                </CardTitle>
                <div className="flex items-center gap-2">
                  {formData.datosTributarios?.verificadoSunat && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 gap-1">
                      <CheckCircle className="size-3" />
                      Verificado SUNAT
                      {formData.datosTributarios.verificacionSunatEn && (
                        <span className="text-green-500 ml-1">
                          · {new Date(formData.datosTributarios.verificacionSunatEn).toLocaleDateString('es-PE')}
                        </span>
                      )}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVerificarSunat}
                    disabled={verifyingSunat || !formData.ruc || formData.ruc.length !== 11}
                  >
                    {verifyingSunat ? (
                      <><Loader2 className="size-4 animate-spin" />Verificando...</>
                    ) : (
                      <><ShieldCheck className="size-4" />Verificar en SUNAT</>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Detracción */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Sujeto a Detracción</p>
                    <p className="text-xs text-muted-foreground">El proveedor está sujeto al Sistema de Pago de Obligaciones Tributarias (SPOT)</p>
                  </div>
                  <Switch
                    checked={!!formData.datosTributarios?.sujetoDetraccion}
                    onCheckedChange={(v) => setFormData(prev => ({
                      ...prev,
                      datosTributarios: { sujetoRetencion: false, ...prev.datosTributarios, sujetoDetraccion: v }
                    }))}
                  />
                </div>

                {formData.datosTributarios?.sujetoDetraccion && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 border-l-2 border-primary/20 pl-4">
                    <div className="space-y-2">
                      <Label>Tasa de Detracción (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.datosTributarios?.tasaDetraccion ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datosTributarios: { sujetoDetraccion: true, sujetoRetencion: false, ...prev.datosTributarios, tasaDetraccion: parseFloat(e.target.value) || undefined }
                        }))}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código Bien/Servicio SUNAT</Label>
                      <Input
                        value={formData.datosTributarios?.codigoBienServicio ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          datosTributarios: { sujetoDetraccion: true, sujetoRetencion: false, ...prev.datosTributarios, codigoBienServicio: e.target.value }
                        }))}
                        placeholder="Ej: 037 - Demás servicios"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                {/* Retención */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Sujeto a Retención</p>
                    <p className="text-xs text-muted-foreground">El proveedor está sujeto al Régimen de Retenciones del IGV (3%)</p>
                  </div>
                  <Switch
                    checked={!!formData.datosTributarios?.sujetoRetencion}
                    onCheckedChange={(v) => setFormData(prev => ({
                      ...prev,
                      datosTributarios: { sujetoDetraccion: false, ...prev.datosTributarios, sujetoRetencion: v }
                    }))}
                  />
                </div>
                {formData.datosTributarios?.sujetoRetencion && (
                  <p className="text-xs text-muted-foreground mt-2 pl-4 border-l-2 border-primary/20">
                    Tasa aplicable: <strong>3%</strong> — Se retendrá automáticamente en las órdenes de compra/servicio.
                  </p>
                )}
              </div>
            </CardContent>
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
            <Button type="button" variant="outline" onClick={onCancel} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
              <X className="size-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="size-4" />
              {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Proveedor')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
