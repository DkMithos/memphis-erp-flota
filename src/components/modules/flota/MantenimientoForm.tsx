/**
 * FORM SIMPLE: NUEVA ORDEN DE TRABAJO
 * Formulario simple (sin wizard) para crear órdenes de trabajo
 * /flota/mantenimientos/nueva?tipo=preventivo|correctivo|predictivo
 */

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save,
  AlertCircle,
  ShieldAlert,
  Calendar,
  DollarSign,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
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
import { Badge } from '../../ui/badge';
import { 
  type TipoOT, 
  type CriticidadOT, 
  calcularSLASugerido,
  determinarEstadoInicial,
  UMBRAL_APROBACION_GERENCIAL,
  OT_TIPO_CONFIG
} from '../../../lib/flota/ot-config';
import { useOTStore, type NuevaOrdenTrabajoInput } from '../../../lib/flota/ot-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { toast } from 'sonner';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';

interface MantenimientoFormProps {
  tipoInicial?: TipoOT;
  vehiculoIdInicial?: string;
  onCancel: () => void;
  onSuccess: (numeroOT: string) => void;
}

export function MantenimientoForm({
  tipoInicial,
  vehiculoIdInicial,
  onCancel,
  onSuccess
}: MantenimientoFormProps) {
  const { crearOrdenTrabajo } = useOTStore();
  const { vehiculos } = useVehiculos();

  // Filter only active vehicles
  const vehiculosActivos = vehiculos.filter(v => v.estado === 'activo' || v.estado === 'en_taller');

  // Form state
  const [tipo, setTipo] = useState<TipoOT>(tipoInicial || 'correctivo');
  const [criticidad, setCriticidad] = useState<CriticidadOT>('media');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string>(vehiculoIdInicial ?? '');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [kilometrajeRegistro, setKilometrajeRegistro] = useState<number>(48500);
  const [tallerId, setTallerId] = useState('TALLER-002');
  const [costoManoObra, setCostoManoObra] = useState<number>(0);
  const [costoRepuestos, setCostoRepuestos] = useState<number>(0);
  const [costoTerceros, setCostoTerceros] = useState<number>(0);
  const [costoOtros, setCostoOtros] = useState<number>(0);
  const [observaciones, setObservaciones] = useState('');
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [centroCostoId, setCentroCostoId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calcular SLA cuando cambian tipo o criticidad
  const [slaEstimado, setSlaEstimado] = useState<number>(4);
  
  useEffect(() => {
    const slaCalculado = calcularSLASugerido(tipo, criticidad);
    setSlaEstimado(slaCalculado);
  }, [tipo, criticidad]);

  // Calcular costo total
  const costoTotal = costoManoObra + costoRepuestos + costoTerceros + costoOtros;
  
  // Determinar si requiere aprobación
  const requiereAprobacion = costoTotal > UMBRAL_APROBACION_GERENCIAL;
  const estadoInicial = determinarEstadoInicial(costoTotal);

  // Obtener info del taller
  const talleres = [
    { id: 'TALLER-001', nombre: 'Mercedes Benz Servicio Oficial', tipo: 'externo' as const },
    { id: 'TALLER-002', nombre: 'Taller Interno - Base Central', tipo: 'interno' as const }
  ];
  
  const tallerSeleccionado = talleres.find(t => t.id === tallerId);

  const selectedVehiculo = vehiculosActivos.find(v => v.id === selectedVehiculoId);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedVehiculoId) {
      newErrors.vehiculo = 'Selecciona un vehículo';
    }

    if (!titulo.trim()) {
      newErrors.titulo = 'El título es obligatorio';
    }

    if (!descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }

    if (!fechaProgramada) {
      newErrors.fechaProgramada = 'La fecha programada es obligatoria';
    }

    if (kilometrajeRegistro <= 0) {
      newErrors.kilometrajeRegistro = 'El kilometraje debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (!tallerSeleccionado) {
      toast.error('Selecciona un taller válido');
      return;
    }

    setIsSubmitting(true);

    try {
      const input: NuevaOrdenTrabajoInput = {
        vehiculoId: selectedVehiculo!.id,
        vehiculoPlaca: selectedVehiculo!.placa,
        tipo,
        criticidad,
        titulo,
        descripcion,
        fechaProgramada,
        slaEstimado,
        kilometrajeRegistro,
        taller: {
          id: tallerSeleccionado.id,
          nombre: tallerSeleccionado.nombre,
          tipo: tallerSeleccionado.tipo
        },
        costos: {
          manoObra: costoManoObra,
          repuestos: costoRepuestos,
          terceros: costoTerceros,
          otros: costoOtros
        },
        observaciones: observaciones || undefined,
        proyectoId: proyectoId ?? null,
        centroCostoId: centroCostoId ?? null,
      };

      const nuevaOT = await crearOrdenTrabajo(input);
      
      toast.success(`Orden de Trabajo ${nuevaOT.numeroOT} creada exitosamente`, {
        description: requiereAprobacion 
          ? 'Estado inicial: En espera de aprobación gerencial'
          : 'Estado inicial: Programada'
      });

      onSuccess(nuevaOT.numeroOT);
    } catch (error) {
      toast.error('Error al crear la orden de trabajo');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <PageNav onBack={onCancel} />
          </div>
          <h2>Nueva Orden de Trabajo</h2>
          <p className="text-muted-foreground mt-1">
            Completa la información para registrar una nueva OT
          </p>
        </div>
        <Badge className={OT_TIPO_CONFIG[tipo].className}>
          {OT_TIPO_CONFIG[tipo].label}
        </Badge>
      </div>

      {/* Alerta de aprobación gerencial */}
      {requiereAprobacion && (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertDescription>
            <strong>Aprobación gerencial requerida:</strong> El costo total estimado (${costoTotal.toLocaleString()}) 
            supera el umbral de ${UMBRAL_APROBACION_GERENCIAL.toLocaleString()}. 
            La OT quedará en estado "En espera de aprobación" hasta su validación.
          </AlertDescription>
        </Alert>
      )}

      {/* Formulario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal - información básica */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de Mantenimiento *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as TipoOT)}>
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventivo">Preventivo</SelectItem>
                      <SelectItem value="correctivo">Correctivo</SelectItem>
                      <SelectItem value="predictivo">Predictivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="criticidad">Criticidad *</Label>
                  <Select value={criticidad} onValueChange={(v) => setCriticidad(v as CriticidadOT)}>
                    <SelectTrigger id="criticidad">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="titulo">Título *</Label>
                <Input 
                  id="titulo"
                  placeholder="Ej: Cambio de aceite y filtros"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
                {errors.titulo && (
                  <p className="text-sm text-destructive mt-1">{errors.titulo}</p>
                )}
              </div>

              <div>
                <Label htmlFor="descripcion">Descripción *</Label>
                <Textarea 
                  id="descripcion"
                  placeholder="Describe el trabajo a realizar"
                  rows={4}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
                {errors.descripcion && (
                  <p className="text-sm text-destructive mt-1">{errors.descripcion}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehiculo">Vehículo *</Label>
                  <Select value={selectedVehiculoId} onValueChange={setSelectedVehiculoId}>
                    <SelectTrigger id="vehiculo" className="w-full [&>span]:truncate [&>span]:block [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left">
                      <SelectValue placeholder="Seleccionar vehículo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehiculosActivos.length === 0 ? (
                        <SelectItem value="_empty" disabled>Sin vehículos disponibles</SelectItem>
                      ) : (
                        vehiculosActivos.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.placa} — {v.marca} {v.modelo}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.vehiculo && (
                    <p className="text-sm text-destructive mt-1">{errors.vehiculo}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="kilometraje">Kilometraje Actual *</Label>
                  <Input 
                    id="kilometraje"
                    type="number"
                    value={kilometrajeRegistro}
                    onChange={(e) => setKilometrajeRegistro(Number(e.target.value))}
                  />
                  {errors.kilometrajeRegistro && (
                    <p className="text-sm text-destructive mt-1">{errors.kilometrajeRegistro}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Programación y Taller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fechaProgramada">Fecha Programada *</Label>
                  <Input
                    id="fechaProgramada"
                    type="datetime-local"
                    value={fechaProgramada}
                    onChange={(e) => setFechaProgramada(e.target.value)}
                  />
                  {errors.fechaProgramada && (
                    <p className="text-sm text-destructive mt-1">{errors.fechaProgramada}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="sla">SLA Estimado (horas)</Label>
                  <Input 
                    id="sla"
                    type="number"
                    value={slaEstimado}
                    onChange={(e) => setSlaEstimado(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculado automáticamente según tipo y criticidad
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="taller">Taller *</Label>
                <Select value={tallerId} onValueChange={setTallerId}>
                  <SelectTrigger id="taller">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {talleres.map(taller => (
                      <SelectItem key={taller.id} value={taller.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4" />
                          <span>{taller.nombre}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {taller.tipo === 'interno' ? 'Interno' : 'Externo'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Imputación dual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Proyecto</Label>
                  <ProyectoSelector
                    value={proyectoId}
                    onChange={setProyectoId}
                    nullable
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Centro de Costo</Label>
                  <CentroCostoSelector
                    value={centroCostoId}
                    onChange={setCentroCostoId}
                    nullable
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Observaciones adicionales (opcional)"
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral - costos y resumen */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5" />
                Costos Estimados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="costoManoObra">Mano de Obra</Label>
                <Input 
                  id="costoManoObra"
                  type="number"
                  placeholder="0.00"
                  value={costoManoObra || ''}
                  onChange={(e) => setCostoManoObra(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="costoRepuestos">Repuestos</Label>
                <Input 
                  id="costoRepuestos"
                  type="number"
                  placeholder="0.00"
                  value={costoRepuestos || ''}
                  onChange={(e) => setCostoRepuestos(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="costoTerceros">Terceros</Label>
                <Input 
                  id="costoTerceros"
                  type="number"
                  placeholder="0.00"
                  value={costoTerceros || ''}
                  onChange={(e) => setCostoTerceros(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="costoOtros">Otros</Label>
                <Input 
                  id="costoOtros"
                  type="number"
                  placeholder="0.00"
                  value={costoOtros || ''}
                  onChange={(e) => setCostoOtros(Number(e.target.value) || 0)}
                />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total Estimado:</span>
                  <span className="text-2xl font-bold">${costoTotal.toLocaleString()}</span>
                </div>
                {requiereAprobacion && (
                  <Alert className="mt-4">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">
                      Requiere aprobación gerencial
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <Badge className={OT_TIPO_CONFIG[tipo].className}>
                  {OT_TIPO_CONFIG[tipo].label}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado inicial:</span>
                <span className="font-medium">
                  {estadoInicial === 'espera_aprobacion' ? 'En espera de aprobación' : 'Programada'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SLA:</span>
                <span className="font-medium">{slaEstimado}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taller:</span>
                <span className="font-medium">{tallerSeleccionado?.nombre.substring(0, 20)}...</span>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="space-y-2">
            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <Save className="size-4" />
              {isSubmitting ? 'Guardando...' : 'Crear Orden de Trabajo'}
            </Button>
            <Button 
              variant="outline" 
              className="w-full !border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input" 
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
