/**
 * DETALLE ORDEN DE TRABAJO - FLOTA
 * Vista detallada de una OT con tabs: Resumen, Diagnóstico, Repuestos, Adicionales, Auditoría
 * /flota/mantenimientos/{OT-YYYY-NNN}
 */

import { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Eye,
  Edit,
  CheckCircle,
  PlayCircle,
  XCircle,
  Calendar,
  Clock,
  User,
  Building2,
  DollarSign,
  FileText,
  AlertCircle,
  Package,
  History,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { Separator } from '../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { 
  OT_ESTADO_CONFIG,
  OT_TIPO_CONFIG,
  OT_CRITICIDAD_CONFIG,
  summarizeExtrasByType,
  getBaseCostTotal,
  getOTGrandTotal,
  type EstadoOT,
  type OTExtraItem
} from '../../../lib/flota/ot-config';
import { useOTStore, type OrdenTrabajo } from '../../../lib/flota/ot-store';
import { toast } from 'sonner@2.0.3';
import { AdicionalesTab } from './AdicionalesTab';

interface MantenimientoDetalleProps {
  numeroOT: string;
  onBack: () => void;
}

export function MantenimientoDetalle({ 
  numeroOT,
  onBack
}: MantenimientoDetalleProps) {
  const { obtenerOTPorNumero, actualizarEstadoOT, anularOT, agregarExtra, eliminarExtra } = useOTStore();
  
  const [ot, setOt] = useState<OrdenTrabajo | undefined>();
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [isAnulando, setIsAnulando] = useState(false);

  useEffect(() => {
    const otEncontrada = obtenerOTPorNumero(numeroOT);
    setOt(otEncontrada);
    
    if (!otEncontrada) {
      toast.error('Orden de Trabajo no encontrada');
    }
  }, [numeroOT, obtenerOTPorNumero]);

  if (!ot) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4 mr-2" />
          Volver
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            No se encontró la Orden de Trabajo {numeroOT}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Variables derivadas para costos (single source of truth)
  const extrasSummary = summarizeExtrasByType(ot.extras || []);
  const baseTotal = getBaseCostTotal(ot.costos);
  const grandTotal = getOTGrandTotal(ot);

  const getEstadoBadge = (estado: EstadoOT) => {
    const config = OT_ESTADO_CONFIG[estado];
    if (!config) return <Badge variant="outline">Desconocido</Badge>;
    
    const { variant, icon: Icon, label, className } = config;
    return (
      <Badge variant={variant} className={className}>
        <Icon className="size-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const handleCambiarEstado = async (nuevoEstado: EstadoOT) => {
    await actualizarEstadoOT(numeroOT, nuevoEstado);
    setOt(obtenerOTPorNumero(numeroOT));
    toast.success(`Estado actualizado a ${OT_ESTADO_CONFIG[nuevoEstado].label}`);
  };

  const handleAnular = async () => {
    if (motivoAnulacion.trim().length < 30) {
      toast.error('El motivo de anulación debe tener al menos 30 caracteres');
      return;
    }

    setIsAnulando(true);
    
    try {
      await anularOT(numeroOT, motivoAnulacion);
      setOt(obtenerOTPorNumero(numeroOT));
      toast.success('Orden de Trabajo anulada exitosamente');
      setShowAnularDialog(false);
      setMotivoAnulacion('');
    } catch (error) {
      toast.error('Error al anular la orden de trabajo');
    } finally {
      setIsAnulando(false);
    }
  };

  const puedeEditarse = !['cerrada', 'anulada'].includes(ot.estado);
  const puedeAnularse = !['cerrada', 'anulada'].includes(ot.estado);

  // Wrappers para refrescar OT después de modificar extras
  const handleAgregarExtra = async (numeroOT: string, extra: OTExtraItem) => {
    await agregarExtra(numeroOT, extra);
    setOt(obtenerOTPorNumero(numeroOT));
  };

  const handleEliminarExtra = async (numeroOT: string, extraId: string, motivo: string) => {
    await eliminarExtra(numeroOT, extraId, motivo);
    setOt(obtenerOTPorNumero(numeroOT));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
            <ArrowLeft className="size-4 mr-2" />
            Volver a lista de OTs
          </Button>
          <div className="flex items-center gap-3">
            <h2>{ot.numeroOT}</h2>
            {getEstadoBadge(ot.estado)}
            <Badge className={OT_TIPO_CONFIG[ot.tipo].className}>
              {OT_TIPO_CONFIG[ot.tipo].label}
            </Badge>
            <Badge variant="outline" className={OT_CRITICIDAD_CONFIG[ot.criticidad].className}>
              {OT_CRITICIDAD_CONFIG[ot.criticidad].label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2">{ot.titulo}</p>
        </div>

        {/* Acciones contextuales */}
        <div className="flex items-center gap-2">
          {ot.estado === 'programada' && (
            <Button onClick={() => handleCambiarEstado('en_ejecucion')}>
              <PlayCircle className="size-4 mr-2" />
              Iniciar Ejecución
            </Button>
          )}
          {ot.estado === 'en_ejecucion' && (
            <Button onClick={() => handleCambiarEstado('cerrada')}>
              <CheckCircle className="size-4 mr-2" />
              Cerrar OT
            </Button>
          )}
          {ot.estado === 'espera_aprobacion' && (
            <Button onClick={() => handleCambiarEstado('programada')}>
              <CheckCircle className="size-4 mr-2" />
              Aprobar OT
            </Button>
          )}
          {puedeAnularse && (
            <Button 
              variant="destructive" 
              onClick={() => setShowAnularDialog(true)}
            >
              <XCircle className="size-4 mr-2" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Alerta de estado especial */}
      {ot.estado === 'espera_aprobacion' && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            <strong>Aprobación pendiente:</strong> Esta OT requiere aprobación gerencial por superar el umbral de costo.
            Costo total: ${ot.costos.total.toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      {ot.estado === 'anulada' && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>OT Anulada:</strong> {ot.notasCierre || 'Sin motivo especificado'}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs de contenido */}
      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">
            <Eye className="size-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="diagnostico">
            <FileText className="size-4 mr-2" />
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="repuestos">
            <Package className="size-4 mr-2" />
            Repuestos ({ot.repuestos.length})
          </TabsTrigger>
          <TabsTrigger value="adicionales">
            <Plus className="size-4 mr-2" />
            Adicionales
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <History className="size-4 mr-2" />
            Auditoría
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Info general */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Vehículo</label>
                      <p className="font-medium">{ot.vehiculoPlaca}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Kilometraje</label>
                      <p className="font-medium">{ot.kilometrajeRegistro.toLocaleString()} km</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-sm text-muted-foreground">Descripción</label>
                    <p className="mt-1">{ot.descripcion}</p>
                  </div>

                  {ot.observaciones && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground">Observaciones</label>
                        <p className="mt-1">{ot.observaciones}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Taller Asignado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-muted rounded-lg flex items-center justify-center">
                      <Building2 className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{ot.taller.nombre}</p>
                      <Badge variant="outline" className="mt-1">
                        {ot.taller.tipo === 'interno' ? 'Taller Interno' : 'Taller Externo'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info lateral */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fechas y SLA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="size-4" />
                      Creación
                    </div>
                    <p className="font-medium">
                      {new Date(ot.fechaCreacion).toLocaleString('es-ES')}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="size-4" />
                      Programada
                    </div>
                    <p className="font-medium">
                      {new Date(ot.fechaProgramada).toLocaleString('es-ES')}
                    </p>
                  </div>

                  {ot.fechaInicio && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <PlayCircle className="size-4" />
                          Inicio
                        </div>
                        <p className="font-medium">
                          {new Date(ot.fechaInicio).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </>
                  )}

                  {ot.fechaCierre && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <CheckCircle className="size-4" />
                          Cierre
                        </div>
                        <p className="font-medium">
                          {new Date(ot.fechaCierre).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="size-4" />
                      SLA
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{ot.slaEstimado}h estimado</p>
                      {ot.slaReal && (
                        <Badge variant={ot.slaReal <= ot.slaEstimado ? 'default' : 'destructive'}>
                          {ot.slaReal}h real
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="size-5" />
                    Costos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mano de Obra</span>
                    <span className="font-medium">${ot.costos.manoObra.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Repuestos</span>
                    <span className="font-medium">${ot.costos.repuestos.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Terceros</span>
                    <span className="font-medium">${ot.costos.terceros.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Otros</span>
                    <span className="font-medium">${ot.costos.otros.toLocaleString()}</span>
                  </div>
                  {extrasSummary.total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Adicionales ({extrasSummary.piezas.count + extrasSummary.servicios.count} items)
                      </span>
                      <span className="font-medium">${extrasSummary.total.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold">${grandTotal.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Diagnóstico */}
        <TabsContent value="diagnostico">
          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico y Notas Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descripción del Problema</label>
                <p className="mt-2 p-4 bg-muted rounded-lg">{ot.descripcion}</p>
              </div>

              {ot.observaciones && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Observaciones Adicionales</label>
                  <p className="mt-2 p-4 bg-muted rounded-lg">{ot.observaciones}</p>
                </div>
              )}

              {ot.notasCierre && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notas de Cierre</label>
                  <p className="mt-2 p-4 bg-muted rounded-lg">{ot.notasCierre}</p>
                </div>
              )}

              {puedeEditarse && (
                <Alert>
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    La funcionalidad de edición de diagnóstico estará disponible en futuras versiones.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Repuestos */}
        <TabsContent value="repuestos">
          <Card>
            <CardHeader>
              <CardTitle>Repuestos Utilizados</CardTitle>
            </CardHeader>
            <CardContent>
              {ot.repuestos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="size-12 mx-auto mb-4 opacity-50" />
                  <p>No se han registrado repuestos para esta OT</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repuesto</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Costo Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ot.repuestos.map((repuesto) => (
                      <TableRow key={repuesto.id}>
                        <TableCell className="font-medium">{repuesto.nombre}</TableCell>
                        <TableCell className="text-center">{repuesto.cantidad}</TableCell>
                        <TableCell className="text-right">${repuesto.costoUnitario.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">${repuesto.costoTotal.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">Total Repuestos:</TableCell>
                      <TableCell className="text-right font-bold">${ot.costos.repuestos.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Adicionales */}
        <TabsContent value="adicionales">
          <AdicionalesTab 
            extras={ot.extras}
            numeroOT={ot.numeroOT}
            estadoOT={ot.estado}
            onAgregarExtra={handleAgregarExtra}
            onEliminarExtra={handleEliminarExtra}
          />
        </TabsContent>

        {/* Tab: Auditoría */}
        <TabsContent value="auditoria">
          <Card>
            <CardHeader>
              <CardTitle>Auditoría de Cambios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <User className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Creado por</p>
                    <p className="text-sm text-muted-foreground">{ot.auditoria.creadoPor}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(ot.auditoria.creadoEn).toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>

                {ot.auditoria.modificadoPor && (
                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <Edit className="size-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Última modificación por</p>
                      <p className="text-sm text-muted-foreground">{ot.auditoria.modificadoPor}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ot.auditoria.modificadoEn && new Date(ot.auditoria.modificadoEn).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                )}

                {ot.auditoria.cerradoPor && (
                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <CheckCircle className="size-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">
                        {ot.estado === 'anulada' ? 'Anulado por' : 'Cerrado por'}
                      </p>
                      <p className="text-sm text-muted-foreground">{ot.auditoria.cerradoPor}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ot.auditoria.cerradoEn && new Date(ot.auditoria.cerradoEn).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Anular OT */}
      <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Orden de Trabajo</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. La OT quedará registrada como anulada en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">
                Motivo de Anulación (mínimo 30 caracteres) *
              </label>
              <Textarea 
                placeholder="Describe el motivo por el cual se anula esta OT..."
                rows={4}
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {motivoAnulacion.length} / 30 caracteres mínimos
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAnularDialog(false)}
              disabled={isAnulando}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleAnular}
              disabled={isAnulando || motivoAnulacion.trim().length < 30}
            >
              {isAnulando ? 'Anulando...' : 'Confirmar Anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}