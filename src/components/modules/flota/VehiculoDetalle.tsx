import { useState } from 'react';
import { ArrowLeft, Car, Edit, FileText, Wrench, MapPin, Calendar, Gauge, Power, PowerOff, AlertCircle, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { getEstadoBadge, getTipoBadge, formatearFecha, validarMotivoInactivacion, calcSaldoPreventivo } from '../../../lib/flota/vehiculos-config';
import { VehicleQRSection } from './VehicleQRSection';
import { ContratoTab } from './vehiculo/ContratoTab';
import { PlanPreventivoTab } from './vehiculo/PlanPreventivoTab';
import { DocumentosTab } from './vehiculo/DocumentosTab';
import { SaldoPreventivoCard } from './SaldoPreventivoCard';
import { toast } from 'sonner';

interface VehiculoDetalleProps {
  vehiculoId: string;
  onBack: () => void;
  onNavigate: (route: string) => void;
  initialTab?: string;
}

export function VehiculoDetalle({ vehiculoId, onBack, onNavigate, initialTab }: VehiculoDetalleProps) {
  const { obtenerVehiculo, inactivarVehiculo, activarVehiculo } = useVehiculos();
  const { ordenes } = useOTStore();
  const vehiculo = obtenerVehiculo(vehiculoId);

  const [dialogInactivarOpen, setDialogInactivarOpen] = useState(false);
  const [dialogActivarOpen, setDialogActivarOpen] = useState(false);
  const [motivoInactivacion, setMotivoInactivacion] = useState('');
  const [erroresMotivo, setErroresMotivo] = useState<string[]>([]);
  const [procesando, setProcesando] = useState(false);

  if (!vehiculo) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Volver a lista
        </Button>
        
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Vehículo no encontrado. El ID <strong>{vehiculoId}</strong> no existe en el sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const estadoBadge = getEstadoBadge(vehiculo.estado);
  const tipoBadge = getTipoBadge(vehiculo.tipo);
  const puedeEditar = vehiculo.estado !== 'inactivo';

  const handleInactivar = async () => {
    // Validar motivo
    const validacion = validarMotivoInactivacion(motivoInactivacion);
    if (!validacion.valido) {
      setErroresMotivo(validacion.errores);
      return;
    }

    setProcesando(true);

    const resultado = await inactivarVehiculo(vehiculo.id, motivoInactivacion);

    if (resultado.exito) {
      toast.success('Vehículo inactivado', {
        description: `${vehiculo.placa} ha sido marcado como inactivo`
      });
      setDialogInactivarOpen(false);
      setMotivoInactivacion('');
      setErroresMotivo([]);
    } else {
      toast.error('Error al inactivar', {
        description: resultado.errores?.join(', ')
      });
    }

    setProcesando(false);
  };

  const handleActivar = async () => {
    setProcesando(true);

    const resultado = await activarVehiculo(vehiculo.id);

    if (resultado.exito) {
      toast.success('Vehículo activado', {
        description: `${vehiculo.placa} ha sido reactivado`
      });
      setDialogActivarOpen(false);
    } else {
      toast.error('Error al activar', {
        description: resultado.errores?.join(', ')
      });
    }

    setProcesando(false);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Volver a lista
        </Button>
        <span>/</span>
        <span>Vehículo {vehiculo.placa}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="size-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <Car className="size-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-semibold">{vehiculo.placa}</h2>
              <Badge variant={estadoBadge.variant}>
                {estadoBadge.label}
              </Badge>
              <Badge variant={tipoBadge.variant}>
                {tipoBadge.label}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {vehiculo.marca} {vehiculo.modelo} • {vehiculo.año}
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-4" />
                {vehiculo.ubicacionActual}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Gauge className="size-4" />
                {vehiculo.kilometraje.toLocaleString()} km
              </div>
              <div className="flex items-center gap-1 text-muted-foreground font-mono">
                ID: {vehiculo.id}
              </div>
              {vehiculo.tipoFlota && (
                <Badge variant="outline" className="text-xs">
                  {vehiculo.tipoFlota.replace(/_/g, ' ')}
                </Badge>
              )}
              {vehiculo.proyectoId && (
                <div className="flex items-center gap-1 text-primary text-xs font-medium">
                  <FolderKanban className="size-3.5" />
                  Asignado a proyecto
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline">
            <FileText className="size-4" />
            Documentos
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onNavigate(`/flota/mantenimientos/nueva?vehiculo=${vehiculoId}`)}
          >
            <Wrench className="size-4" />
            Nueva OT
          </Button>
          {puedeEditar && (
            <Button onClick={() => onNavigate(`/flota/vehiculos/${vehiculoId}/editar`)}>
              <Edit className="size-4" />
              Editar
            </Button>
          )}
          {vehiculo.estado === 'inactivo' ? (
            <Button 
              variant="outline"
              onClick={() => setDialogActivarOpen(true)}
            >
              <Power className="size-4" />
              Activar
            </Button>
          ) : (
            <Button 
              variant="destructive"
              onClick={() => setDialogInactivarOpen(true)}
            >
              <PowerOff className="size-4" />
              Inactivar
            </Button>
          )}
        </div>
      </div>

      {/* Alert si está inactivo */}
      {vehiculo.estado === 'inactivo' && vehiculo.motivoInactivacion && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            <strong>Vehículo inactivo:</strong> {vehiculo.motivoInactivacion}
          </AlertDescription>
        </Alert>
      )}

      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">ID Interno</p>
              <p className="font-medium font-mono">{vehiculo.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Placa</p>
              <p className="font-medium">{vehiculo.placa}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">VIN</p>
              <p className="font-medium font-mono">{vehiculo.vin || 'No especificado'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Tipo</p>
              <p className="font-medium">{tipoBadge.label}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Marca/Modelo</p>
              <p className="font-medium">{vehiculo.marca} {vehiculo.modelo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Año</p>
              <p className="font-medium">{vehiculo.año}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Motor</p>
              <p className="font-medium">{vehiculo.motor || 'No especificado'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Color</p>
              <p className="font-medium">{vehiculo.color}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Combustible</p>
              <p className="font-medium capitalize">{vehiculo.combustible}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Capacidad</p>
              <p className="font-medium">{vehiculo.capacidad || 'No especificada'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Kilometraje Actual</p>
              <p className="font-medium">{vehiculo.kilometraje.toLocaleString()} km</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Ubicación Actual</p>
              <p className="font-medium">{vehiculo.ubicacionActual}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mantenimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Programa de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Último Mantenimiento</p>
              <p className="text-lg font-semibold">
                {vehiculo.ultimoMantenimiento || 'Sin registros'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Próximo Mantenimiento</p>
              <p className="text-lg font-semibold text-yellow-600">
                {vehiculo.proximoMantenimiento || 'No programado'}
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Consulta el historial completo de órdenes de trabajo
            </p>
            <Button 
              variant="outline"
              onClick={() => onNavigate('/flota/mantenimientos')}
            >
              <Wrench className="size-4" />
              Ver Historial OT
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auditoría */}
      <Card>
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Creado por</p>
              <p className="font-medium">{vehiculo.creadoPor}</p>
              <p className="text-xs text-muted-foreground">{formatearFecha(vehiculo.creadoEn)}</p>
            </div>

            {vehiculo.modificadoPor && vehiculo.modificadoEn && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Última modificación</p>
                <p className="font-medium">{vehiculo.modificadoPor}</p>
                <p className="text-xs text-muted-foreground">{formatearFecha(vehiculo.modificadoEn)}</p>
              </div>
            )}

            {vehiculo.estado === 'inactivo' && vehiculo.inactivadoPor && vehiculo.inactivadoEn && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Inactivado por</p>
                <p className="font-medium">{vehiculo.inactivadoPor}</p>
                <p className="text-xs text-muted-foreground">{formatearFecha(vehiculo.inactivadoEn)}</p>
                {vehiculo.motivoInactivacion && (
                  <>
                    <p className="text-sm text-muted-foreground mt-2 mb-1">Motivo de inactivación</p>
                    <p className="text-sm">{vehiculo.motivoInactivacion}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saldo Preventivo Card — siempre visible */}
      {(() => {
        const otsParaCalculo = ordenes.map(ot => ({
          vehiculoId: ot.vehiculoId,
          tipo: ot.tipo,
          estado: ot.estado,
          costos: ot.costos,
        }));
        const saldo = calcSaldoPreventivo(vehiculo.id, otsParaCalculo, vehiculo.planPreventivoContratado);
        return (
          <SaldoPreventivoCard
            saldo={saldo}
            kilometrajeActual={vehiculo.kilometraje}
            intervaloKm={vehiculo.planPreventivoContratado?.intervaloKm}
          />
        );
      })()}

      {/* Tabs */}
      <Tabs defaultValue={initialTab ?? "documentos"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="plan-preventivo">Plan Preventivo</TabsTrigger>
        </TabsList>
        <TabsContent value="documentos" className="space-y-4">
          <DocumentosTab vehiculoId={vehiculoId} vehiculo={vehiculo} />
        </TabsContent>
        <TabsContent value="contrato" className="space-y-4">
          <ContratoTab vehiculoId={vehiculoId} vehiculo={vehiculo} />
        </TabsContent>
        <TabsContent value="plan-preventivo" className="space-y-4">
          <PlanPreventivoTab vehiculoId={vehiculoId} vehiculo={vehiculo} />
        </TabsContent>
      </Tabs>

      {/* Dialog Inactivar */}
      <Dialog open={dialogInactivarOpen} onOpenChange={setDialogInactivarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inactivar Vehículo</DialogTitle>
            <DialogDescription>
              Ingrese el motivo de inactivación del vehículo <strong>{vehiculo.placa}</strong>. 
              Esta acción no eliminará el vehículo, solo lo marcará como inactivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Motivo (mínimo 30 caracteres)
              </label>
              <Textarea
                placeholder="Describa detalladamente el motivo de la inactivación..."
                value={motivoInactivacion}
                onChange={(e) => {
                  setMotivoInactivacion(e.target.value);
                  setErroresMotivo([]);
                }}
                rows={4}
                className={erroresMotivo.length > 0 ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {motivoInactivacion.length} / 30 caracteres mínimos
              </p>
            </div>

            {erroresMotivo.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {erroresMotivo.map((error, i) => (
                    <div key={i}>{error}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogInactivarOpen(false);
                setMotivoInactivacion('');
                setErroresMotivo([]);
              }}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleInactivar}
              disabled={procesando}
            >
              {procesando ? 'Inactivando...' : 'Inactivar Vehículo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Activar */}
      <Dialog open={dialogActivarOpen} onOpenChange={setDialogActivarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar Vehículo</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea reactivar el vehículo <strong>{vehiculo.placa}</strong>?
              El vehículo volverá a estar disponible para operaciones.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogActivarOpen(false)}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleActivar}
              disabled={procesando}
            >
              {procesando ? 'Activando...' : 'Confirmar Activación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Section */}
      <VehicleQRSection vehiculoId={vehiculoId} placa={vehiculo.placa} onNavigate={onNavigate} />
    </div>
  );
}