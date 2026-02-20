/**
 * WIZARD: NUEVA ORDEN DE TRABAJO
 * Flujo completo de creación de OT con validaciones
 * Production-ready con mock store (reemplazar por backend)
 */

import { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Calendar,
  Clock,
  Building2,
  DollarSign,
  FileText,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { 
  type TipoOT, 
  type CriticidadOT, 
  calcularSLASugerido,
  determinarEstadoInicial,
  UMBRAL_APROBACION_GERENCIAL,
  OT_TIPO_CONFIG,
  OT_CRITICIDAD_CONFIG
} from '../../lib/flota/ot-config';
import { useOTStore, type NuevaOrdenTrabajoInput } from '../../lib/flota/ot-store';
import { toast } from 'sonner@2.0.3';

const PASOS = [
  { numero: 1, titulo: 'Información Básica', descripcion: 'Tipo, vehículo y criticidad' },
  { numero: 2, titulo: 'Detalles Técnicos', descripcion: 'Descripción y programación' },
  { numero: 3, titulo: 'Confirmación', descripcion: 'Revisar y crear OT' }
];

interface FormData {
  // Paso 1
  tipo: TipoOT | '';
  vehiculoId: string;
  vehiculoPlaca: string;
  criticidad: CriticidadOT | '';
  tallerId: string;
  tallerNombre: string;
  tallerTipo: 'interno' | 'externo' | '';
  
  // Paso 2
  titulo: string;
  descripcion: string;
  fechaProgramada: string;
  slaEstimado: number;
  kilometrajeRegistro: number;
  costoManoObra: number;
  costoRepuestos: number;
  costoTerceros: number;
  costoOtros: number;
  observaciones: string;
}

interface NuevaOrdenTrabajoProps {
  tipoInicial?: TipoOT | '';
  onCancel?: () => void;
  onSuccess?: (numeroOT: string) => void;
}

export function NuevaOrdenTrabajo({ 
  tipoInicial = '', 
  onCancel, 
  onSuccess 
}: NuevaOrdenTrabajoProps) {
  const { crearOrdenTrabajo } = useOTStore();
  
  const [pasoActual, setPasoActual] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    tipo: tipoInicial,
    vehiculoId: 'VH-001', // Por defecto - en producción viene del contexto
    vehiculoPlaca: 'ABC-123',
    criticidad: '',
    tallerId: '',
    tallerNombre: '',
    tallerTipo: '',
    titulo: '',
    descripcion: '',
    fechaProgramada: '',
    slaEstimado: 4,
    kilometrajeRegistro: 0,
    costoManoObra: 0,
    costoRepuestos: 0,
    costoTerceros: 0,
    costoOtros: 0,
    observaciones: ''
  });

  const [errores, setErrores] = useState<Record<string, string>>({});

  // ============================================================================
  // VALIDACIONES
  // ============================================================================

  const validarPaso1 = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!formData.tipo) {
      nuevosErrores.tipo = 'Debe seleccionar un tipo de mantenimiento';
    }
    if (!formData.vehiculoPlaca) {
      nuevosErrores.vehiculoPlaca = 'Debe seleccionar un vehículo';
    }
    if (!formData.criticidad) {
      nuevosErrores.criticidad = 'Debe seleccionar una criticidad';
    }
    if (!formData.tallerId) {
      nuevosErrores.tallerId = 'Debe seleccionar un taller';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const validarPaso2 = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!formData.titulo.trim()) {
      nuevosErrores.titulo = 'El título es obligatorio';
    }
    if (!formData.descripcion.trim()) {
      nuevosErrores.descripcion = 'La descripción es obligatoria';
    }
    if (!formData.fechaProgramada) {
      nuevosErrores.fechaProgramada = 'Debe seleccionar una fecha programada';
    }
    if (formData.slaEstimado <= 0) {
      nuevosErrores.slaEstimado = 'El SLA debe ser mayor a 0';
    }
    if (formData.kilometrajeRegistro <= 0) {
      nuevosErrores.kilometrajeRegistro = 'El kilometraje debe ser mayor a 0';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // ============================================================================
  // NAVEGACIÓN ENTRE PASOS
  // ============================================================================

  const siguientePaso = () => {
    let valido = true;

    if (pasoActual === 1) {
      valido = validarPaso1();
    } else if (pasoActual === 2) {
      valido = validarPaso2();
    }

    if (valido && pasoActual < PASOS.length) {
      setPasoActual(pasoActual + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const pasoAnterior = () => {
    if (pasoActual > 1) {
      setPasoActual(pasoActual - 1);
      setErrores({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelar = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // ============================================================================
  // CREAR OT
  // ============================================================================

  const confirmarCreacion = () => {
    if (!validarPaso2()) {
      setPasoActual(2);
      return;
    }

    try {
      const input: NuevaOrdenTrabajoInput = {
        vehiculoId: formData.vehiculoId,
        vehiculoPlaca: formData.vehiculoPlaca,
        tipo: formData.tipo as TipoOT,
        criticidad: formData.criticidad as CriticidadOT,
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        fechaProgramada: formData.fechaProgramada,
        slaEstimado: formData.slaEstimado,
        kilometrajeRegistro: formData.kilometrajeRegistro,
        taller: {
          id: formData.tallerId,
          nombre: formData.tallerNombre,
          tipo: formData.tallerTipo as 'interno' | 'externo'
        },
        costos: {
          manoObra: formData.costoManoObra,
          repuestos: formData.costoRepuestos,
          terceros: formData.costoTerceros,
          otros: formData.costoOtros
        },
        observaciones: formData.observaciones || undefined
      };

      const nuevaOT = crearOrdenTrabajo(input);

      toast.success('Orden de Trabajo creada exitosamente', {
        description: `${nuevaOT.numeroOT} - ${nuevaOT.titulo}`
      });

      // Llamar callback de éxito
      if (onSuccess) {
        onSuccess(nuevaOT.numeroOT);
      }
    } catch (error) {
      console.error('Error al crear OT:', error);
      toast.error('Error al crear la Orden de Trabajo', {
        description: 'Por favor, intente nuevamente'
      });
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleTipoChange = (tipo: TipoOT) => {
    setFormData(prev => ({
      ...prev,
      tipo,
      slaEstimado: formData.criticidad 
        ? calcularSLASugerido(tipo, formData.criticidad as CriticidadOT) 
        : prev.slaEstimado
    }));
  };

  const handleCriticidadChange = (criticidad: CriticidadOT) => {
    setFormData(prev => ({
      ...prev,
      criticidad,
      slaEstimado: formData.tipo 
        ? calcularSLASugerido(formData.tipo as TipoOT, criticidad) 
        : prev.slaEstimado
    }));
  };

  const handleTallerChange = (tallerId: string) => {
    // Mock de talleres - en producción vendría de API
    const talleres = {
      'TALLER-001': { nombre: 'Mercedes Benz Servicio Oficial', tipo: 'externo' as const },
      'TALLER-002': { nombre: 'Taller Interno - Base Central', tipo: 'interno' as const },
      'TALLER-003': { nombre: 'Volvo Service Center', tipo: 'externo' as const }
    };

    const taller = talleres[tallerId as keyof typeof talleres];
    if (taller) {
      setFormData(prev => ({
        ...prev,
        tallerId,
        tallerNombre: taller.nombre,
        tallerTipo: taller.tipo
      }));
    }
  };

  const costoTotal = formData.costoManoObra + formData.costoRepuestos + formData.costoTerceros + formData.costoOtros;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={cancelar}>
              <ArrowLeft className="size-4 mr-2" />
              Volver
            </Button>
          </div>
          <h2>Nueva Orden de Trabajo</h2>
          <p className="text-muted-foreground mt-1">
            Complete la información para generar una nueva OT
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {PASOS.map((paso, index) => (
          <div key={paso.numero} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`size-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                pasoActual > paso.numero 
                  ? 'bg-primary border-primary text-primary-foreground'
                  : pasoActual === paso.numero
                  ? 'border-primary text-primary'
                  : 'border-muted text-muted-foreground'
              }`}>
                {pasoActual > paso.numero ? (
                  <Check className="size-5" />
                ) : (
                  <span>{paso.numero}</span>
                )}
              </div>
              <div className="text-center mt-2">
                <p className="text-sm font-medium">{paso.titulo}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">{paso.descripcion}</p>
              </div>
            </div>
            {index < PASOS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-4 ${
                pasoActual > paso.numero ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Contenido por paso */}
      <div className="max-w-3xl mx-auto">
        {pasoActual === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
              <p className="text-sm text-muted-foreground">
                Seleccione el tipo de mantenimiento, vehículo y nivel de criticidad
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de OT */}
              <div className="space-y-2">
                <Label htmlFor="tipo">
                  Tipo de Mantenimiento <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.tipo} onValueChange={handleTipoChange}>
                  <SelectTrigger id="tipo" className={errores.tipo ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccione el tipo de mantenimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OT_TIPO_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errores.tipo && (
                  <p className="text-sm text-destructive">{errores.tipo}</p>
                )}
              </div>

              {/* Vehículo */}
              <div className="space-y-2">
                <Label htmlFor="vehiculo">
                  Vehículo <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="vehiculo"
                  value={formData.vehiculoPlaca}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Vehículo actual: ABC-123 (Mercedes-Benz Actros 2651)
                </p>
              </div>

              {/* Criticidad */}
              <div className="space-y-2">
                <Label htmlFor="criticidad">
                  Criticidad <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.criticidad} onValueChange={handleCriticidadChange}>
                  <SelectTrigger id="criticidad" className={errores.criticidad ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccione el nivel de criticidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OT_CRITICIDAD_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="size-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errores.criticidad && (
                  <p className="text-sm text-destructive">{errores.criticidad}</p>
                )}
              </div>

              {/* Taller */}
              <div className="space-y-2">
                <Label htmlFor="taller">
                  Taller Asignado <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.tallerId} onValueChange={handleTallerChange}>
                  <SelectTrigger id="taller" className={errores.tallerId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccione un taller" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TALLER-001">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4" />
                        Mercedes Benz Servicio Oficial
                        <Badge variant="outline" className="ml-2">Externo</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="TALLER-002">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4" />
                        Taller Interno - Base Central
                        <Badge variant="secondary" className="ml-2">Interno</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="TALLER-003">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4" />
                        Volvo Service Center
                        <Badge variant="outline" className="ml-2">Externo</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errores.tallerId && (
                  <p className="text-sm text-destructive">{errores.tallerId}</p>
                )}
              </div>

              {formData.tipo && formData.criticidad && (
                <Alert>
                  <Clock className="size-4" />
                  <AlertDescription>
                    <strong>SLA Sugerido:</strong> {calcularSLASugerido(formData.tipo as TipoOT, formData.criticidad as CriticidadOT)} horas
                    (basado en tipo y criticidad seleccionados)
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {pasoActual === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Detalles Técnicos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Describa el trabajo a realizar y programe la ejecución
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">
                  Título de la OT <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="titulo"
                  placeholder="Ej: Mantenimiento Preventivo 50,000 km"
                  value={formData.titulo}
                  onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                  className={errores.titulo ? 'border-destructive' : ''}
                />
                {errores.titulo && (
                  <p className="text-sm text-destructive">{errores.titulo}</p>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="descripcion">
                  Descripción del Trabajo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="descripcion"
                  placeholder="Describa detalladamente el trabajo a realizar..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  rows={4}
                  className={errores.descripcion ? 'border-destructive' : ''}
                />
                {errores.descripcion && (
                  <p className="text-sm text-destructive">{errores.descripcion}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fecha Programada */}
                <div className="space-y-2">
                  <Label htmlFor="fechaProgramada">
                    Fecha Programada <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="fechaProgramada"
                      type="datetime-local"
                      value={formData.fechaProgramada}
                      onChange={(e) => setFormData(prev => ({ ...prev, fechaProgramada: e.target.value }))}
                      className={`pl-10 ${errores.fechaProgramada ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errores.fechaProgramada && (
                    <p className="text-sm text-destructive">{errores.fechaProgramada}</p>
                  )}
                </div>

                {/* SLA Estimado */}
                <div className="space-y-2">
                  <Label htmlFor="slaEstimado">
                    SLA Estimado (horas) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="slaEstimado"
                      type="number"
                      min="1"
                      step="0.5"
                      value={formData.slaEstimado}
                      onChange={(e) => setFormData(prev => ({ ...prev, slaEstimado: parseFloat(e.target.value) || 0 }))}
                      className={`pl-10 ${errores.slaEstimado ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errores.slaEstimado && (
                    <p className="text-sm text-destructive">{errores.slaEstimado}</p>
                  )}
                </div>
              </div>

              {/* Kilometraje */}
              <div className="space-y-2">
                <Label htmlFor="kilometraje">
                  Kilometraje Actual <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="kilometraje"
                  type="number"
                  min="0"
                  placeholder="48500"
                  value={formData.kilometrajeRegistro || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, kilometrajeRegistro: parseInt(e.target.value) || 0 }))}
                  className={errores.kilometrajeRegistro ? 'border-destructive' : ''}
                />
                {errores.kilometrajeRegistro && (
                  <p className="text-sm text-destructive">{errores.kilometrajeRegistro}</p>
                )}
              </div>

              {/* Costos Estimados */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <DollarSign className="size-4" />
                  Costos Estimados (Opcional)
                </Label>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="costoManoObra" className="text-xs">Mano de Obra</Label>
                    <Input
                      id="costoManoObra"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.costoManoObra || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costoManoObra: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costoRepuestos" className="text-xs">Repuestos</Label>
                    <Input
                      id="costoRepuestos"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.costoRepuestos || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costoRepuestos: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costoTerceros" className="text-xs">Servicios Terceros</Label>
                    <Input
                      id="costoTerceros"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.costoTerceros || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costoTerceros: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costoOtros" className="text-xs">Otros</Label>
                    <Input
                      id="costoOtros"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.costoOtros || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costoOtros: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total Estimado:</span>
                      <span className="text-xl font-semibold">${costoTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Alerta de aprobación requerida */}
                {costoTotal > UMBRAL_APROBACION_GERENCIAL && (
                  <Alert variant="default" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                    <ShieldAlert className="size-4 text-orange-600" />
                    <AlertDescription className="text-orange-900 dark:text-orange-100">
                      <strong>⚠️ Aprobación Gerencial Requerida:</strong> El costo total 
                      (${costoTotal.toFixed(2)}) supera el umbral de ${UMBRAL_APROBACION_GERENCIAL.toFixed(2)}. 
                      Esta OT se creará con estado <strong>"Espera Aprobación"</strong> y requerirá 
                      autorización de Gerencia antes de proceder.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <Label htmlFor="observaciones" className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Observaciones Iniciales (Opcional)
                </Label>
                <Textarea
                  id="observaciones"
                  placeholder="Información adicional relevante..."
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {pasoActual === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Confirmación</CardTitle>
              <p className="text-sm text-muted-foreground">
                Revise la información antes de crear la Orden de Trabajo
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Una vez creada, la OT quedará registrada como <strong>Programada</strong> y se generará
                  un número de OT único. Se registrará la auditoría de creación.
                </AlertDescription>
              </Alert>

              {/* Resumen */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium">{OT_TIPO_CONFIG[formData.tipo as TipoOT]?.label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Criticidad</p>
                    <p className="font-medium">{OT_CRITICIDAD_CONFIG[formData.criticidad as CriticidadOT]?.label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vehículo</p>
                    <p className="font-medium">{formData.vehiculoPlaca}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Taller</p>
                    <p className="font-medium">{formData.tallerNombre}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Título:</p>
                  <p className="text-sm">{formData.titulo}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Descripción:</p>
                  <p className="text-sm text-muted-foreground">{formData.descripcion}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha Programada</p>
                    <p className="font-medium">
                      {new Date(formData.fechaProgramada).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SLA Estimado</p>
                    <p className="font-medium">{formData.slaEstimado} horas</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kilometraje</p>
                    <p className="font-medium">{formData.kilometrajeRegistro.toLocaleString()} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Costo Estimado</p>
                    <p className="font-medium">${costoTotal.toFixed(2)}</p>
                  </div>
                </div>

                {formData.observaciones && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Observaciones:</p>
                    <p className="text-sm text-muted-foreground">{formData.observaciones}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Botones de navegación */}
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Button
          variant="outline"
          onClick={pasoAnterior}
          disabled={pasoActual === 1}
        >
          <ArrowLeft className="size-4 mr-2" />
          Anterior
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={cancelar}>
            Cancelar
          </Button>
          {pasoActual < PASOS.length ? (
            <Button onClick={siguientePaso}>
              Siguiente
              <ArrowRight className="size-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={confirmarCreacion}>
              <Check className="size-4 mr-2" />
              Crear Orden de Trabajo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}