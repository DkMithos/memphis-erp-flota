import { useState } from 'react';
import { ArrowLeft, Edit, Ban, CheckCircle, XCircle, AlertTriangle, FileText, Calendar, Package, ExternalLink, ShoppingBag, Plus, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { useRequerimientosStore } from '../../../lib/compras/requerimientos-store';
import { useOrdenesStore } from '../../../lib/compras/ordenes-store';
import {
  COTIZACION_ESTADO_CONFIG,
  COTIZACION_TIPO_LABELS,
  tienePermiso,
  puedeEditarCotizacion,
  puedeAnularCotizacion,
  puedeRevisarCotizacion,
  validarMotivo,
  formatearMonto,
  formatearFecha
} from '../../../lib/compras/cotizaciones-config';
import { ORDEN_ESTADO_CONFIG } from '../../../lib/compras/ordenes-config';
import { toast } from 'sonner';

interface CotizacionDetalleProps {
  cotizacionId: string;
  onNavigate?: (route: string) => void;
}

export function CotizacionDetalle({ cotizacionId, onNavigate }: CotizacionDetalleProps) {
  const { 
    obtenerCotizacionPorId, 
    anularCotizacion, 
    aprobarCotizacion,
    rechazarCotizacion,
    usuarioActual 
  } = useCotizacionesStore();
  
  const { obtenerRequerimientoPorId } = useRequerimientosStore();
  const { obtenerOrdenesPorCotizacion } = useOrdenesStore();
  const cotizacion = obtenerCotizacionPorId(cotizacionId);
  const requerimiento = cotizacion ? obtenerRequerimientoPorId(cotizacion.requerimientoId) : undefined;
  const ordenesAsociadas = cotizacion ? obtenerOrdenesPorCotizacion(cotizacion.id) : [];

  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');

  const [showRechazarDialog, setShowRechazarDialog] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [errorRechazo, setErrorRechazo] = useState('');

  if (!cotizacion) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Cotización no encontrada. El ID "{cotizacionId}" no existe en el sistema.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => onNavigate?.('/compras/cotizaciones')}>
          <ArrowLeft className="size-4" />
          Volver a Cotizaciones
        </Button>
      </div>
    );
  }

  const estadoConfig = COTIZACION_ESTADO_CONFIG[cotizacion.estado];

  const puedeEditar = tienePermiso(usuarioActual.rol, 'editar') && puedeEditarCotizacion(cotizacion.estado);
  const puedeAnular = tienePermiso(usuarioActual.rol, 'anular') && puedeAnularCotizacion(cotizacion.estado);
  const puedeAprobar = tienePermiso(usuarioActual.rol, 'aprobar') && puedeRevisarCotizacion(cotizacion.estado);
  const puedeRechazar = tienePermiso(usuarioActual.rol, 'rechazar') && puedeRevisarCotizacion(cotizacion.estado);

  const handleAnular = async () => {
    const validacion = validarMotivo(motivoAnulacion, 'anulación');
    if (!validacion.valid) {
      setErrorMotivo(validacion.error!);
      return;
    }

    const res = await anularCotizacion(cotizacionId, motivoAnulacion);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al anular la cotización');
      return;
    }
    toast.success('Cotización anulada correctamente');
    setShowAnularDialog(false);
    setMotivoAnulacion('');
  };

  const handleAprobar = async () => {
    const res = await aprobarCotizacion(cotizacionId, usuarioActual.email);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al aprobar la cotización');
      return;
    }
    toast.success('Cotización aprobada correctamente');
  };

  const handleRechazar = async () => {
    const validacion = validarMotivo(motivoRechazo, 'rechazo');
    if (!validacion.valid) {
      setErrorRechazo(validacion.error!);
      return;
    }

    const res = await rechazarCotizacion(cotizacionId, usuarioActual.email, motivoRechazo);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al rechazar la cotización');
      return;
    }
    toast.success('Cotización rechazada');
    setShowRechazarDialog(false);
    setMotivoRechazo('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/compras/cotizaciones')}>
            <ArrowLeft className="size-4" />
            Volver a Cotizaciones
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="size-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl">{cotizacion.id}</h2>
                <Badge className={estadoConfig.className}>
                  <estadoConfig.icon className="size-3" />
                  {estadoConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{cotizacion.proveedorNombre}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {puedeRechazar && (
            <Button variant="destructive" onClick={() => setShowRechazarDialog(true)}>
              <XCircle className="size-4" />
              Rechazar
            </Button>
          )}
          {puedeAprobar && (
            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleAprobar}>
              <CheckCircle className="size-4" />
              Aprobar
            </Button>
          )}
          {puedeEditar && (
            <Button onClick={() => onNavigate?.(`/compras/cotizaciones/${cotizacionId}/editar`)}>
              <Edit className="size-4" />
              Editar
            </Button>
          )}
          {puedeAnular && (
            <Button variant="outline" onClick={() => setShowAnularDialog(true)}>
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Alertas de Estado */}
      {cotizacion.estado === 'anulada' && cotizacion.auditoria.motivoAnulacion && (
        <Alert variant="destructive">
          <Ban className="size-4" />
          <AlertDescription>
            <strong>Cotización Anulada</strong>
            <p className="mt-2">{cotizacion.auditoria.motivoAnulacion}</p>
            <div className="text-xs mt-2 opacity-75">
              Anulada por {cotizacion.auditoria.anuladoPor} el{' '}
              {new Date(cotizacion.auditoria.anuladoEn!).toLocaleString('es-PE')}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {cotizacion.estado === 'rechazada' && cotizacion.motivoRechazo && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>Cotización Rechazada</strong>
            <p className="mt-2">{cotizacion.motivoRechazo}</p>
            <div className="text-xs mt-2 opacity-75">
              Rechazada por {cotizacion.rechazadoPor} el{' '}
              {new Date(cotizacion.rechazadoEn!).toLocaleString('es-PE')}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {cotizacion.estado === 'aprobada' && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="size-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Cotización Aprobada</strong>
            <p className="mt-1 text-sm">
              Aprobada por {cotizacion.aprobadoPor} el{' '}
              {new Date(cotizacion.aprobadoEn!).toLocaleString('es-PE')}
            </p>
            <p className="text-sm mt-1">Lista para generar Orden de Compra</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Requerimiento Asociado */}
      {requerimiento && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Requerimiento Asociado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono">{requerimiento.id}</Badge>
                  <Badge>{requerimiento.estado}</Badge>
                </div>
                <p className="font-medium">{requerimiento.titulo}</p>
                <p className="text-sm text-muted-foreground mt-1">{requerimiento.descripcion}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Solicitante: {requerimiento.solicitanteNombre}</span>
                  <span>Total Estimado: S/ {requerimiento.totalEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate?.(`/compras/requerimientos/${requerimiento.id}`)}
              >
                <ExternalLink className="size-4" />
                Ver Detalle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Órdenes Asociadas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" />
            Órdenes Asociadas ({ordenesAsociadas.length})
          </CardTitle>
          {cotizacion.estado === 'aprobada' && (
            <Button onClick={() => onNavigate?.(`/compras/ordenes/nuevo?cot=${cotizacion.id}&tipo=oc`)} size="sm">
              <Plus className="size-4" />
              Generar Orden
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {ordenesAsociadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="size-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {cotizacion.estado === 'aprobada' 
                  ? 'No hay órdenes generadas. Haz clic en "Generar Orden" para crear una OC o OS.'
                  : 'No hay órdenes asociadas a esta cotización.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ordenesAsociadas.map((orden) => {
                const estadoOrdenConfig = ORDEN_ESTADO_CONFIG[orden.estado];
                return (
                  <div key={orden.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono">{orden.id}</Badge>
                          <Badge variant="outline">{orden.tipo === 'oc' ? 'OC' : 'OS'}</Badge>
                          <Badge className={estadoOrdenConfig.className}>
                            <estadoOrdenConfig.icon className="size-3" />
                            {estadoOrdenConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Total: {formatearMonto(orden.total, orden.moneda)} • {orden.items.length} items
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onNavigate?.(`/compras/ordenes/${orden.id}`)}
                    >
                      <Eye className="size-4" />
                      Ver
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Cotización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Proveedor</p>
              <p className="font-medium">{cotizacion.proveedorNombre}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <Badge variant="outline">{COTIZACION_TIPO_LABELS[cotizacion.tipo]}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Moneda</p>
              <p>{cotizacion.moneda === 'PEN' ? 'Soles (S/)' : 'Dólares ($)'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Validez</p>
              <p>{cotizacion.validezDias} días (hasta {formatearFecha(cotizacion.fechaVencimiento)})</p>
            </div>
            {cotizacion.terminos && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-2">Términos y Condiciones</p>
                <p className="text-sm whitespace-pre-wrap">{cotizacion.terminos}</p>
              </div>
            )}
            {cotizacion.observaciones && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-2">Observaciones</p>
                <p className="text-sm whitespace-pre-wrap">{cotizacion.observaciones}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Items de la Cotización ({cotizacion.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>P. Unitario</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotizacion.items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell>{item.cantidad}</TableCell>
                  <TableCell className="capitalize">{item.unidad}</TableCell>
                  <TableCell>{formatearMonto(item.precioUnitario, cotizacion.moneda)}</TableCell>
                  <TableCell className="font-medium">{formatearMonto(item.subtotal, cotizacion.moneda)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={5} className="text-right font-medium">Subtotal:</TableCell>
                <TableCell className="font-medium">{formatearMonto(cotizacion.subtotal, cotizacion.moneda)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={5} className="text-right font-medium">IGV (18%):</TableCell>
                <TableCell className="font-medium">{formatearMonto(cotizacion.impuestos, cotizacion.moneda)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={5} className="text-right">Total:</TableCell>
                <TableCell className="text-lg text-primary">{formatearMonto(cotizacion.total, cotizacion.moneda)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Auditoría */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Auditoría y Trazabilidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="size-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Creado</p>
                <p className="text-sm text-muted-foreground">
                  Por {cotizacion.auditoria.creadoPor} el{' '}
                  {new Date(cotizacion.auditoria.creadoEn).toLocaleString('es-PE')}
                </p>
              </div>
            </div>
            {cotizacion.auditoria.modificadoPor && (
              <div className="flex items-start gap-3">
                <Edit className="size-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Última Modificación</p>
                  <p className="text-sm text-muted-foreground">
                    Por {cotizacion.auditoria.modificadoPor} el{' '}
                    {new Date(cotizacion.auditoria.modificadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {cotizacion.aprobadoPor && (
              <div className="flex items-start gap-3">
                <CheckCircle className="size-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Aprobado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {cotizacion.aprobadoPor} el{' '}
                    {new Date(cotizacion.aprobadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {cotizacion.rechazadoPor && (
              <div className="flex items-start gap-3">
                <XCircle className="size-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Rechazado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {cotizacion.rechazadoPor} el{' '}
                    {new Date(cotizacion.rechazadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {cotizacion.auditoria.anuladoPor && (
              <div className="flex items-start gap-3">
                <Ban className="size-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Anulado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {cotizacion.auditoria.anuladoPor} el{' '}
                    {new Date(cotizacion.auditoria.anuladoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Anulación */}
      <AlertDialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Cotización</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la cotización "{cotizacion.id}" como anulada.
              No podrá procesarse ni generar una orden de compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="motivo">Motivo de Anulación (mínimo 30 caracteres) *</Label>
            <Textarea
              id="motivo"
              value={motivoAnulacion}
              onChange={(e) => {
                setMotivoAnulacion(e.target.value);
                setErrorMotivo('');
              }}
              placeholder="Explique detalladamente el motivo de la anulación..."
              rows={4}
              className={errorMotivo ? 'border-red-500' : ''}
            />
            {errorMotivo && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errorMotivo}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {motivoAnulacion.length}/30 caracteres
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setMotivoAnulacion('');
              setErrorMotivo('');
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Anular Cotización
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Rechazo */}
      <AlertDialog open={showRechazarDialog} onOpenChange={setShowRechazarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Cotización</AlertDialogTitle>
            <AlertDialogDescription>
              La cotización será marcada como rechazada. Podrá crear una nueva cotización si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="motivoRechazo">Motivo del Rechazo (mínimo 30 caracteres) *</Label>
            <Textarea
              id="motivoRechazo"
              value={motivoRechazo}
              onChange={(e) => {
                setMotivoRechazo(e.target.value);
                setErrorRechazo('');
              }}
              placeholder="Indique el motivo del rechazo..."
              rows={3}
              className={errorRechazo ? 'border-red-500' : ''}
            />
            {errorRechazo && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errorRechazo}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {motivoRechazo.length}/30 caracteres
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setMotivoRechazo('');
              setErrorRechazo('');
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRechazar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Rechazar Cotización
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}