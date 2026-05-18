/**
 * FORMULARIO DE EQUIPO BIOMÉDICO (CREAR/EDITAR)
 * Wizard multi-paso con validaciones
 * Production-ready siguiendo patrón enterprise
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  AlertCircle,
  Building2,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { toast } from 'sonner';
import {
  useEquiposStore,
  type NuevoEquipoBiomedicoInput
} from '../../../lib/biomedico/equipos-store';
import { useSedesStore } from '../../../lib/biomedico/sedes-store';
import {
  EQUIPO_CATEGORIA_CONFIG,
  EQUIPO_RIESGO_CONFIG,
  type CategoriaEquipoBiomedico,
  type RiesgoBiomedico
} from '../../../lib/biomedico/equipos-config';

const PASOS = [
  { numero: 1, titulo: 'Información Básica', descripcion: 'Datos de identificación' },
  { numero: 2, titulo: 'Clasificación', descripcion: 'Categoría y riesgo' },
  { numero: 3, titulo: 'Ubicación y Garantía', descripcion: 'Asignación y proveedor' }
];

interface FormData {
  // Paso 1
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;

  // Paso 2
  categoria: CategoriaEquipoBiomedico | '';
  riesgo: RiesgoBiomedico | '';
  voltaje: string;
  potencia: string;
  frecuencia: string;
  dimensiones: string;
  peso: string;

  // Paso 3 — Jerarquía
  clienteId: string;
  sedeId: string;
  areaId: string;
  // Campo libre legacy (rellenar si no hay jerarquía)
  area: string;
  subarea: string;
  responsable: string;
  // Fechas / garantía / costos
  fechaAdquisicion: string;
  fechaInstalacion: string;
  proveedorGarantia: string;
  fechaInicioGarantia: string;
  fechaVencimientoGarantia: string;
  costoAdquisicion: string;
  costoMantenimientoAnual: string;
  observaciones: string;
}

interface BiomedicoEquipoFormProps {
  modo?: 'crear' | 'editar';
  codigoEquipo?: string;
  onCancel?: () => void;
  onSuccess?: (codigo: string) => void;
}

export function BiomedicoEquipoForm({
  modo = 'crear',
  codigoEquipo,
  onCancel,
  onSuccess
}: BiomedicoEquipoFormProps) {
  const { crearEquipo, actualizarEquipo, obtenerEquipoPorCodigo } = useEquiposStore();
  const { clientes, sedesByCliente, areasBySede } = useSedesStore();

  const [pasoActual, setPasoActual] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    marca: '',
    modelo: '',
    serie: '',
    categoria: '',
    riesgo: '',
    voltaje: '',
    potencia: '',
    frecuencia: '',
    dimensiones: '',
    peso: '',
    clienteId: '',
    sedeId: '',
    areaId: '',
    area: '',
    subarea: '',
    responsable: '',
    fechaAdquisicion: '',
    fechaInstalacion: '',
    proveedorGarantia: '',
    fechaInicioGarantia: '',
    fechaVencimientoGarantia: '',
    costoAdquisicion: '',
    costoMantenimientoAnual: '',
    observaciones: ''
  });

  const sedesDisponibles = formData.clienteId ? sedesByCliente(formData.clienteId) : [];
  const areasDisponibles = formData.sedeId ? areasBySede(formData.sedeId) : [];

  // Cargar datos si es modo editar
  useEffect(() => {
    if (modo === 'editar' && codigoEquipo) {
      const equipo = obtenerEquipoPorCodigo(codigoEquipo);
      if (equipo) {
        setFormData({
          nombre: equipo.nombre,
          marca: equipo.marca,
          modelo: equipo.modelo,
          serie: equipo.serie,
          categoria: equipo.categoria,
          riesgo: equipo.riesgo,
          voltaje: equipo.especificaciones.voltaje || '',
          potencia: equipo.especificaciones.potencia || '',
          frecuencia: equipo.especificaciones.frecuencia || '',
          dimensiones: equipo.especificaciones.dimensiones || '',
          peso: equipo.especificaciones.peso || '',
          clienteId: equipo.clienteId ?? '',
          sedeId: equipo.sedeId ?? '',
          areaId: equipo.areaId ?? '',
          area: equipo.ubicacion.area,
          subarea: equipo.ubicacion.subarea,
          responsable: equipo.ubicacion.responsable,
          fechaAdquisicion: equipo.fechaAdquisicion,
          fechaInstalacion: equipo.fechaInstalacion,
          proveedorGarantia: equipo.garantia.proveedor,
          fechaInicioGarantia: equipo.garantia.fechaInicio,
          fechaVencimientoGarantia: equipo.garantia.fechaVencimiento,
          costoAdquisicion: equipo.costos.adquisicion.toString(),
          costoMantenimientoAnual: equipo.costos.mantenimientoPreventivoAnual.toString(),
          observaciones: equipo.observaciones || ''
        });
      }
    }
  }, [modo, codigoEquipo, obtenerEquipoPorCodigo]);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  // Validaciones por paso con errores inline
  const validarPaso1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.nombre.trim()) e.nombre = 'El nombre del equipo es obligatorio';
    if (!formData.marca.trim()) e.marca = 'La marca es obligatoria';
    if (!formData.modelo.trim()) e.modelo = 'El modelo es obligatorio';
    if (!formData.serie.trim()) e.serie = 'El número de serie es obligatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.categoria) e.categoria = 'Debe seleccionar una categoría';
    if (!formData.riesgo) e.riesgo = 'Debe seleccionar el nivel de riesgo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso3 = (): boolean => {
    const e: Record<string, string> = {};
    const tieneJerarquia = !!(formData.clienteId && formData.sedeId && formData.areaId);
    const tieneAreaLibre = !!(formData.area && formData.subarea && formData.responsable);
    if (!tieneJerarquia && !tieneAreaLibre) {
      e.ubicacion = 'Debe completar la ubicación (jerarquía o manual)';
    }
    if (!formData.fechaAdquisicion) e.fechaAdquisicion = 'La fecha de adquisición es obligatoria';
    if (!formData.fechaInstalacion) e.fechaInstalacion = 'La fecha de instalación es obligatoria';
    if (!formData.proveedorGarantia.trim()) e.proveedorGarantia = 'El proveedor de garantía es obligatorio';
    if (!formData.fechaInicioGarantia) e.fechaInicioGarantia = 'La fecha de inicio es obligatoria';
    if (!formData.fechaVencimientoGarantia) e.fechaVencimientoGarantia = 'La fecha de vencimiento es obligatoria';
    if (!formData.costoAdquisicion) e.costoAdquisicion = 'El costo de adquisición es obligatorio';
    if (!formData.costoMantenimientoAnual) e.costoMantenimientoAnual = 'El costo de mantenimiento es obligatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSiguiente = () => {
    if (pasoActual === 1 && !validarPaso1()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }
    if (pasoActual === 2 && !validarPaso2()) {
      toast.error('Por favor selecciona categoría y riesgo');
      return;
    }
    setPasoActual(prev => Math.min(prev + 1, PASOS.length));
  };

  const handleAnterior = () => {
    setPasoActual(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validarPaso3()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      // Si tiene área registrada en la jerarquía, sincronizar campos libres también
      const areaSeleccionada = areasDisponibles.find(a => a.id === formData.areaId);
      const sedeSeleccionada = sedesDisponibles.find(s => s.id === formData.sedeId);

      const input: NuevoEquipoBiomedicoInput = {
        nombre: formData.nombre,
        marca: formData.marca,
        modelo: formData.modelo,
        serie: formData.serie,
        categoria: formData.categoria as CategoriaEquipoBiomedico,
        riesgo: formData.riesgo as RiesgoBiomedico,
        clienteId: formData.clienteId || null,
        sedeId: formData.sedeId || null,
        areaId: formData.areaId || null,
        ubicacion: {
          area: areaSeleccionada?.nombre ?? formData.area,
          subarea: sedeSeleccionada?.nombre ?? formData.subarea,
          responsable: formData.responsable
        },
        especificaciones: {
          voltaje: formData.voltaje || undefined,
          potencia: formData.potencia || undefined,
          frecuencia: formData.frecuencia || undefined,
          dimensiones: formData.dimensiones || undefined,
          peso: formData.peso || undefined
        },
        fechaAdquisicion: formData.fechaAdquisicion,
        fechaInstalacion: formData.fechaInstalacion,
        garantia: {
          proveedor: formData.proveedorGarantia,
          fechaInicio: formData.fechaInicioGarantia,
          fechaVencimiento: formData.fechaVencimientoGarantia
        },
        costos: {
          adquisicion: parseFloat(formData.costoAdquisicion),
          mantenimientoPreventivoAnual: parseFloat(formData.costoMantenimientoAnual)
        },
        observaciones: formData.observaciones || undefined
      };

      if (modo === 'crear') {
        const equipo = await crearEquipo(input);
        toast.success(`Equipo ${equipo.codigo} creado exitosamente`);
        onSuccess?.(equipo.codigo);
      } else if (codigoEquipo) {
        await actualizarEquipo(codigoEquipo, input);
        toast.success(`Equipo ${codigoEquipo} actualizado exitosamente`);
        onSuccess?.(codigoEquipo);
      }
    } catch (error) {
      toast.error('Error al guardar el equipo');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {modo === 'crear' ? 'Nuevo Equipo Biomédico' : 'Editar Equipo'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {modo === 'crear' ? 'Registra un nuevo equipo en el inventario' : `Modificar ${codigoEquipo}`}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {PASOS.map((paso, index) => (
          <div key={paso.numero} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-2">
              <div className={`
                flex items-center justify-center size-10 rounded-full border-2 font-semibold
                ${pasoActual > paso.numero ? 'bg-primary border-primary text-primary-foreground' : ''}
                ${pasoActual === paso.numero ? 'border-primary text-primary' : ''}
                ${pasoActual < paso.numero ? 'border-muted-foreground text-muted-foreground' : ''}
              `}>
                {pasoActual > paso.numero ? <Check className="size-5" /> : paso.numero}
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">{paso.titulo}</div>
                <div className="text-xs text-muted-foreground">{paso.descripcion}</div>
              </div>
            </div>
            {index < PASOS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${pasoActual > paso.numero ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle>Paso {pasoActual}: {PASOS[pasoActual - 1].titulo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paso 1: Información Básica */}
          {pasoActual === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Equipo *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => updateFormData('nombre', e.target.value)}
                  placeholder="Ej: Ventilador Mecánico"
                />
                {errors.nombre && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="size-3" />{errors.nombre}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serie">Número de Serie *</Label>
                <Input
                  id="serie"
                  value={formData.serie}
                  onChange={(e) => updateFormData('serie', e.target.value)}
                  placeholder="Ej: SN-VM-2024-001"
                />
                {errors.serie && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="size-3" />{errors.serie}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="marca">Marca *</Label>
                <Input
                  id="marca"
                  value={formData.marca}
                  onChange={(e) => updateFormData('marca', e.target.value)}
                  placeholder="Ej: Dräger"
                />
                {errors.marca && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="size-3" />{errors.marca}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelo">Modelo *</Label>
                <Input
                  id="modelo"
                  value={formData.modelo}
                  onChange={(e) => updateFormData('modelo', e.target.value)}
                  placeholder="Ej: Savina 300"
                />
                {errors.modelo && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="size-3" />{errors.modelo}</p>}
              </div>
            </div>
          )}

          {/* Paso 2: Clasificación */}
          {pasoActual === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría *</Label>
                  <Select value={formData.categoria} onValueChange={(v) => updateFormData('categoria', v)}>
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EQUIPO_CATEGORIA_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoria && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="size-3" />{errors.categoria}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="riesgo">Nivel de Riesgo *</Label>
                  <Select value={formData.riesgo} onValueChange={(v) => updateFormData('riesgo', v)}>
                    <SelectTrigger id="riesgo">
                      <SelectValue placeholder="Seleccionar riesgo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EQUIPO_RIESGO_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.riesgo && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="size-3" />{errors.riesgo}</p>}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-4">Especificaciones Técnicas (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="voltaje">Voltaje</Label>
                    <Input
                      id="voltaje"
                      value={formData.voltaje}
                      onChange={(e) => updateFormData('voltaje', e.target.value)}
                      placeholder="Ej: 220V"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="potencia">Potencia</Label>
                    <Input
                      id="potencia"
                      value={formData.potencia}
                      onChange={(e) => updateFormData('potencia', e.target.value)}
                      placeholder="Ej: 150W"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frecuencia">Frecuencia</Label>
                    <Input
                      id="frecuencia"
                      value={formData.frecuencia}
                      onChange={(e) => updateFormData('frecuencia', e.target.value)}
                      placeholder="Ej: 50/60Hz"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="peso">Peso</Label>
                    <Input
                      id="peso"
                      value={formData.peso}
                      onChange={(e) => updateFormData('peso', e.target.value)}
                      placeholder="Ej: 25kg"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dimensiones">Dimensiones</Label>
                    <Input
                      id="dimensiones"
                      value={formData.dimensiones}
                      onChange={(e) => updateFormData('dimensiones', e.target.value)}
                      placeholder="Ej: 35x40x120cm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3: Ubicación y Garantía */}
          {pasoActual === 3 && (
            <div className="space-y-6">
              {/* Jerarquía Cliente → Sede → Área */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="size-4 text-primary" />
                  <h3 className="font-medium">Ubicación del Equipo</h3>
                </div>
                {clientes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cliente */}
                    <div className="space-y-2">
                      <Label htmlFor="clienteId">Cliente / Institución</Label>
                      <Select
                        value={formData.clienteId}
                        onValueChange={(v) => {
                          setFormData(prev => ({ ...prev, clienteId: v, sedeId: '', areaId: '' }));
                        }}
                      >
                        <SelectTrigger id="clienteId">
                          <SelectValue placeholder="Seleccionar cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.filter(c => c.estado === 'activo').map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sede */}
                    <div className="space-y-2">
                      <Label htmlFor="sedeId">Sede</Label>
                      <Select
                        value={formData.sedeId}
                        onValueChange={(v) => {
                          setFormData(prev => ({ ...prev, sedeId: v, areaId: '' }));
                        }}
                        disabled={!formData.clienteId}
                      >
                        <SelectTrigger id="sedeId">
                          <SelectValue placeholder={formData.clienteId ? 'Seleccionar sede' : 'Primero selecciona cliente'} />
                        </SelectTrigger>
                        <SelectContent>
                          {sedesDisponibles.filter(s => s.estado === 'activo').map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Área */}
                    <div className="space-y-2">
                      <Label htmlFor="areaId">Área Clínica</Label>
                      <Select
                        value={formData.areaId}
                        onValueChange={(v) => updateFormData('areaId', v)}
                        disabled={!formData.sedeId}
                      >
                        <SelectTrigger id="areaId">
                          <SelectValue placeholder={formData.sedeId ? 'Seleccionar área' : 'Primero selecciona sede'} />
                        </SelectTrigger>
                        <SelectContent>
                          {areasDisponibles.filter(a => a.estado === 'activo').map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nombre}{a.piso ? ` — ${a.piso}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    No hay clientes registrados. Puedes usar ubicación manual abajo.
                  </div>
                )}
              </div>

              {/* Ubicación manual (fallback / complemento) */}
              <div>
                <h3 className="text-sm text-muted-foreground mb-3">
                  {formData.clienteId ? 'Ubicación adicional (opcional)' : 'Ubicación manual *'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area">Área</Label>
                    <Input
                      id="area"
                      value={formData.area}
                      onChange={(e) => updateFormData('area', e.target.value)}
                      placeholder="Ej: UCI"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subarea">Subárea / Piso</Label>
                    <Input
                      id="subarea"
                      value={formData.subarea}
                      onChange={(e) => updateFormData('subarea', e.target.value)}
                      placeholder="Ej: Cama 3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsable">Responsable</Label>
                    <Input
                      id="responsable"
                      value={formData.responsable}
                      onChange={(e) => updateFormData('responsable', e.target.value)}
                      placeholder="Ej: Dr. Carlos Mendoza"
                    />
                  </div>
                </div>
              </div>

              {errors.ubicacion && (
                <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{errors.ubicacion}</AlertDescription></Alert>
              )}

              <div>
                <h3 className="font-medium mb-4">Fechas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fechaAdquisicion">Fecha de Adquisición *</Label>
                    <Input
                      id="fechaAdquisicion"
                      type="date"
                      value={formData.fechaAdquisicion}
                      onChange={(e) => updateFormData('fechaAdquisicion', e.target.value)}
                    />
                    {errors.fechaAdquisicion && <p className="text-sm text-red-600">{errors.fechaAdquisicion}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaInstalacion">Fecha de Instalación *</Label>
                    <Input
                      id="fechaInstalacion"
                      type="date"
                      value={formData.fechaInstalacion}
                      onChange={(e) => updateFormData('fechaInstalacion', e.target.value)}
                    />
                    {errors.fechaInstalacion && <p className="text-sm text-red-600">{errors.fechaInstalacion}</p>}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-4">Garantía</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="proveedorGarantia">Proveedor de Garantía *</Label>
                    <Input
                      id="proveedorGarantia"
                      value={formData.proveedorGarantia}
                      onChange={(e) => updateFormData('proveedorGarantia', e.target.value)}
                      placeholder="Ej: Dräger Medical Perú"
                    />
                    {errors.proveedorGarantia && <p className="text-sm text-red-600">{errors.proveedorGarantia}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaInicioGarantia">Fecha Inicio *</Label>
                    <Input
                      id="fechaInicioGarantia"
                      type="date"
                      value={formData.fechaInicioGarantia}
                      onChange={(e) => updateFormData('fechaInicioGarantia', e.target.value)}
                    />
                    {errors.fechaInicioGarantia && <p className="text-sm text-red-600">{errors.fechaInicioGarantia}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaVencimientoGarantia">Fecha Vencimiento *</Label>
                    <Input
                      id="fechaVencimientoGarantia"
                      type="date"
                      value={formData.fechaVencimientoGarantia}
                      onChange={(e) => updateFormData('fechaVencimientoGarantia', e.target.value)}
                    />
                    {errors.fechaVencimientoGarantia && <p className="text-sm text-red-600">{errors.fechaVencimientoGarantia}</p>}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-4">Costos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="costoAdquisicion">Costo de Adquisición (USD) *</Label>
                    <Input
                      id="costoAdquisicion"
                      type="number"
                      step="0.01"
                      value={formData.costoAdquisicion}
                      onChange={(e) => updateFormData('costoAdquisicion', e.target.value)}
                      placeholder="0.00"
                    />
                    {errors.costoAdquisicion && <p className="text-sm text-red-600">{errors.costoAdquisicion}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costoMantenimientoAnual">Costo Mant. Preventivo Anual (USD) *</Label>
                    <Input
                      id="costoMantenimientoAnual"
                      type="number"
                      step="0.01"
                      value={formData.costoMantenimientoAnual}
                      onChange={(e) => updateFormData('costoMantenimientoAnual', e.target.value)}
                      placeholder="0.00"
                    />
                    {errors.costoMantenimientoAnual && <p className="text-sm text-red-600">{errors.costoMantenimientoAnual}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => updateFormData('observaciones', e.target.value)}
                  placeholder="Notas adicionales sobre el equipo..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Advertencia */}
          {pasoActual === 3 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Revisa cuidadosamente toda la información antes de guardar. Los datos de auditoría se registrarán automáticamente.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Botones de navegación */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleAnterior}
          disabled={pasoActual === 1}
        >
          <ArrowLeft className="size-4" />
          Anterior
        </Button>

        {pasoActual < PASOS.length ? (
          <Button onClick={handleSiguiente}>
            Siguiente
            <ArrowRight className="size-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            <Save className="size-4" />
            {modo === 'crear' ? 'Crear Equipo' : 'Guardar Cambios'}
          </Button>
        )}
      </div>
    </div>
  );
}
