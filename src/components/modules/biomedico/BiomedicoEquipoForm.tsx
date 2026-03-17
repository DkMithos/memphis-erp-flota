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
  AlertCircle
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
import { toast } from 'sonner@2.0.3';
import { 
  useEquiposStore,
  type NuevoEquipoBiomedicoInput
} from '../../../lib/biomedico/equipos-store';
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
  
  // Paso 3
  area: string;
  subarea: string;
  responsable: string;
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
  
  const [pasoActual, setPasoActual] = useState(1);
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
  };

  // Validaciones por paso
  const validarPaso1 = (): boolean => {
    return !!(formData.nombre && formData.marca && formData.modelo && formData.serie);
  };

  const validarPaso2 = (): boolean => {
    return !!(formData.categoria && formData.riesgo);
  };

  const validarPaso3 = (): boolean => {
    return !!(
      formData.area && 
      formData.subarea && 
      formData.responsable &&
      formData.fechaAdquisicion &&
      formData.fechaInstalacion &&
      formData.proveedorGarantia &&
      formData.fechaInicioGarantia &&
      formData.fechaVencimientoGarantia &&
      formData.costoAdquisicion &&
      formData.costoMantenimientoAnual
    );
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
      const input: NuevoEquipoBiomedicoInput = {
        nombre: formData.nombre,
        marca: formData.marca,
        modelo: formData.modelo,
        serie: formData.serie,
        categoria: formData.categoria as CategoriaEquipoBiomedico,
        riesgo: formData.riesgo as RiesgoBiomedico,
        ubicacion: {
          area: formData.area,
          subarea: formData.subarea,
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
          <ArrowLeft className="size-4 mr-2" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="serie">Número de Serie *</Label>
                <Input
                  id="serie"
                  value={formData.serie}
                  onChange={(e) => updateFormData('serie', e.target.value)}
                  placeholder="Ej: SN-VM-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marca">Marca *</Label>
                <Input
                  id="marca"
                  value={formData.marca}
                  onChange={(e) => updateFormData('marca', e.target.value)}
                  placeholder="Ej: Dräger"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelo">Modelo *</Label>
                <Input
                  id="modelo"
                  value={formData.modelo}
                  onChange={(e) => updateFormData('modelo', e.target.value)}
                  placeholder="Ej: Savina 300"
                />
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
              <div>
                <h3 className="font-medium mb-4">Ubicación y Asignación</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area">Área *</Label>
                    <Input
                      id="area"
                      value={formData.area}
                      onChange={(e) => updateFormData('area', e.target.value)}
                      placeholder="Ej: UCI"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subarea">Subárea *</Label>
                    <Input
                      id="subarea"
                      value={formData.subarea}
                      onChange={(e) => updateFormData('subarea', e.target.value)}
                      placeholder="Ej: Cama 3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsable">Responsable *</Label>
                    <Input
                      id="responsable"
                      value={formData.responsable}
                      onChange={(e) => updateFormData('responsable', e.target.value)}
                      placeholder="Ej: Dr. Carlos Mendoza"
                    />
                  </div>
                </div>
              </div>

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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaInstalacion">Fecha de Instalación *</Label>
                    <Input
                      id="fechaInstalacion"
                      type="date"
                      value={formData.fechaInstalacion}
                      onChange={(e) => updateFormData('fechaInstalacion', e.target.value)}
                    />
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaInicioGarantia">Fecha Inicio *</Label>
                    <Input
                      id="fechaInicioGarantia"
                      type="date"
                      value={formData.fechaInicioGarantia}
                      onChange={(e) => updateFormData('fechaInicioGarantia', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaVencimientoGarantia">Fecha Vencimiento *</Label>
                    <Input
                      id="fechaVencimientoGarantia"
                      type="date"
                      value={formData.fechaVencimientoGarantia}
                      onChange={(e) => updateFormData('fechaVencimientoGarantia', e.target.value)}
                    />
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
          <ArrowLeft className="size-4 mr-2" />
          Anterior
        </Button>

        {pasoActual < PASOS.length ? (
          <Button onClick={handleSiguiente}>
            Siguiente
            <ArrowRight className="size-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            <Save className="size-4 mr-2" />
            {modo === 'crear' ? 'Crear Equipo' : 'Guardar Cambios'}
          </Button>
        )}
      </div>
    </div>
  );
}
