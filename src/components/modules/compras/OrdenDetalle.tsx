import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Edit, CheckCircle, XCircle, Ban, Truck, Package, FileText, Calendar, DollarSign, ShieldAlert, ShieldCheck, Users, ShoppingBag } from 'lucide-react';
import { loadFlujoAprobacion, determinarNivelAprobacion, nivelAprobacionColor } from '../../../lib/compras/approval-flow';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useOrdenesStore } from '../../../lib/compras/ordenes-store';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { exportOrdenPDF } from '../../../lib/shared/export-utils';
import { useRecepcionesStore } from '../../../lib/compras/recepciones-store';
import {
  ORDEN_ESTADO_CONFIG,
  ORDEN_TIPO_LABELS,
  tienePermiso,
  puedeEditarOrden,
  puedeAnularOrden,
  puedeRevisarOrden,
  puedeMarcarEnEjecucion,
  puedeRecibirOrden,
  formatearMonto,
  formatearFecha,
  validarMotivo
} from '../../../lib/compras/ordenes-config';

interface OrdenDetalleProps {
  ordenId: string;
  onNavigate: (route: string) => void;
}

export function OrdenDetalle({ ordenId, onNavigate }: OrdenDetalleProps) {
  const { obtenerOrdenPorId, aprobarOrden, rechazarOrden, marcarEnEjecucion, anularOrden, usuarioActual } = useOrdenesStore();
  const { obtenerRecepcionesPorOrden } = useRecepcionesStore();
  
  const orden = obtenerOrdenPorId(ordenId);
  const { proveedores } = useProveedorStore();
  const proveedorOC = useMemo(
    () => proveedores.find(p => p._dbId === (orden as any)?.proveedorDbId),
    [proveedores, orden]
  );
  // Cotización de origen: la orden guarda el UUID; mostrar el número legible
  const { cotizaciones } = useCotizacionesStore();
  const cotizacionOrigen = useMemo(
    () => cotizaciones.find(c => c._dbId === orden?.cotizacionId || c.id === orden?.cotizacionId),
    [cotizaciones, orden]
  );
  const recepciones = obtenerRecepcionesPorOrden(ordenId);

  // Dialogs
  const [showAprobarDialog, setShowAprobarDialog] = useState(false);
  const [showRechazarDialog, setShowRechazarDialog] = useState(false);
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');

  // Flujo de aprobación configurable.
  // IMPORTANTE: estos hooks deben llamarse SIEMPRE en el mismo orden (regla de
  // los hooks), por eso van ANTES del return condicional. Usan defaults seguros
  // cuando la orden no existe (en cuyo caso el componente retorna abajo).
  const flujoConfig = useMemo(() => loadFlujoAprobacion(), []);
  const nivelAprobacion = useMemo(
    () => determinarNivelAprobacion(orden?.total ?? 0, orden?.moneda ?? 'PEN', flujoConfig),
    [orden?.total, orden?.moneda, flujoConfig]
  );

  if (!orden) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No se encontró la orden con ID: <strong>{ordenId}</strong>
        </AlertDescription>
      </Alert>
    );
  }

  const estadoConfig = ORDEN_ESTADO_CONFIG[orden.estado];
  const rolActualPuedeAprobarEsteNivel = nivelAprobacion.roles.includes(usuarioActual.nombre) ||
    nivelAprobacion.roles.some(r => r.toLowerCase() === usuarioActual.rol.toLowerCase().replace(/_/g, ' '));

  const puedeAprobar = tienePermiso(usuarioActual.rol, 'aprobar') && puedeRevisarOrden(orden.estado);
  const puedeRechazar = tienePermiso(usuarioActual.rol, 'rechazar') && puedeRevisarOrden(orden.estado);
  const puedeEditar = tienePermiso(usuarioActual.rol, 'editar') && puedeEditarOrden(orden.estado);
  const puedeAnular = tienePermiso(usuarioActual.rol, 'anular') && puedeAnularOrden(orden.estado);
  const puedeIniciarEjecucion = tienePermiso(usuarioActual.rol, 'marcarEnEjecucion') && puedeMarcarEnEjecucion(orden.estado);
  const puedeCrearRecepcion = (tienePermiso(usuarioActual.rol, 'ver') || usuarioActual.rol === 'operaciones') 
    && puedeRecibirOrden(orden.estado);

  // Handlers
  const handleAprobar = async () => {
    const res = await aprobarOrden(orden.id, usuarioActual.email);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al aprobar la orden');
      return;
    }
    setShowAprobarDialog(false);
    toast.success('Orden aprobada correctamente');
  };

  const handleRechazar = async () => {
    const validacion = validarMotivo(motivoRechazo, 'rechazo');
    if (!validacion.valid) {
      setErrorMotivo(validacion.error!);
      return;
    }
    const res = await rechazarOrden(orden.id, usuarioActual.email, motivoRechazo);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al rechazar la orden');
      return;
    }
    setShowRechazarDialog(false);
    setMotivoRechazo('');
    setErrorMotivo('');
    toast.success('Orden rechazada');
  };

  const handleAnular = async () => {
    const validacion = validarMotivo(motivoAnulacion, 'anulación');
    if (!validacion.valid) {
      setErrorMotivo(validacion.error!);
      return;
    }
    const res = await anularOrden(orden.id, motivoAnulacion);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al anular la orden');
      return;
    }
    setShowAnularDialog(false);
    setMotivoAnulacion('');
    setErrorMotivo('');
    toast.success('Orden anulada correctamente');
  };

  const handleIniciarEjecucion = async () => {
    const res = await marcarEnEjecucion(orden.id);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al iniciar la ejecución');
      return;
    }
    toast.success('Orden marcada en ejecución');
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <ShoppingBag className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-semibold">{orden.id}</h2>
              <Badge className={estadoConfig.className}>
                <estadoConfig.icon className="size-3" />
                {estadoConfig.label}
              </Badge>
              <Badge variant="outline">{orden.tipo === 'oc' ? 'OC' : 'OS'}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {ORDEN_TIPO_LABELS[orden.tipo]} - {orden.proveedorNombre}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => exportOrdenPDF({ ...orden, cotizacionId: cotizacionOrigen?.id ?? orden.cotizacionId }, proveedorOC)}>
            <FileText className="size-4" />
            Exportar PDF
          </Button>
          {puedeEditar && (
            <Button onClick={() => onNavigate(`/compras/ordenes/${orden.id}/editar`)}>
              <Edit className="size-4" />
              Editar
            </Button>
          )}
          {puedeAprobar && (
            <Button onClick={() => setShowAprobarDialog(true)} variant="default">
              <CheckCircle className="size-4" />
              Aprobar
            </Button>
          )}
          {puedeRechazar && (
            <Button onClick={() => setShowRechazarDialog(true)} variant="destructive">
              <XCircle className="size-4" />
              Rechazar
            </Button>
          )}
          {puedeIniciarEjecucion && (
            <Button onClick={handleIniciarEjecucion} variant="outline">
              <Truck className="size-4" />
              Marcar en Ejecución
            </Button>
          )}
          {puedeCrearRecepcion && (
            <Button onClick={() => onNavigate(`/compras/recepciones/nuevo?orden=${orden.id}`)} variant="default">
              <Package className="size-4" />
              Crear Recepción
            </Button>
          )}
          {puedeAnular && (
            <Button onClick={() => setShowAnularDialog(true)} variant="outline">
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Alerta si fue rechazada */}
      {orden.motivoRechazo && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>Orden rechazada:</strong> {orden.motivoRechazo}
            <br />
            <span className="text-xs">Por: {orden.rechazadoPor} el {orden.rechazadoEn && formatearFecha(orden.rechazadoEn)}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta si fue anulada */}
      {orden.estado === 'anulada' && orden.auditoria.motivoAnulacion && (
        <Alert>
          <Ban className="size-4" />
          <AlertDescription>
            <strong>Orden anulada:</strong> {orden.auditoria.motivoAnulacion}
            <br />
            <span className="text-xs">Por: {orden.auditoria.anuladoPor} el {orden.auditoria.anuladoEn && formatearFecha(orden.auditoria.anuladoEn)}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Cotización Origen</p>
              {orden.cotizacionId ? (
                <Button variant="link" className="p-0 h-auto" onClick={() => onNavigate(`/compras/cotizaciones/${cotizacionOrigen?.id ?? orden.cotizacionId}`)}>
                  {cotizacionOrigen?.id ?? orden.cotizacionId}
                </Button>
              ) : (
                <p className="text-sm">—</p>
              )}
            </div>
            {orden.requerimientoId && (
              <div>
                <p className="text-sm text-muted-foreground">Requerimiento</p>
                <Button variant="link" className="p-0 h-auto" onClick={() => onNavigate(`/compras/requerimientos/${orden.requerimientoId}`)}>
                  {orden.requerimientoId}
                </Button>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Proveedor</p>
              <p className="font-medium">{orden.proveedorNombre}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Moneda</p>
              <p className="font-medium">{orden.moneda === 'PEN' ? 'Soles (S/)' : 'Dólares ($)'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Emisión</p>
              <p className="font-medium">{formatearFecha(orden.fechaEmision)}</p>
            </div>
            {orden.fechaEntregaEstimada && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Entrega Estimada</p>
                <p className="font-medium">{formatearFecha(orden.fechaEntregaEstimada)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5" />
              Totales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatearMonto(orden.subtotal, orden.moneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Impuestos (18% IGV)</span>
              <span className="font-medium">{formatearMonto(orden.impuestos, orden.moneda)}</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{formatearMonto(orden.total, orden.moneda)}</span>
            </div>

            {/* Nivel de aprobación requerido */}
            <div className="border-t pt-3 mt-1">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ShieldAlert className="size-3" />
                Nivel de aprobación requerido
              </p>
              <div className={`rounded-lg px-3 py-2 text-xs space-y-1.5 ${nivelAprobacionColor(nivelAprobacion.nivel)}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{nivelAprobacion.label}</span>
                  <Badge variant="outline" className="text-xs py-0 h-5 bg-white dark:bg-gray-900/50">
                    Nivel {nivelAprobacion.nivel}
                  </Badge>
                </div>
                <p className="opacity-80">{nivelAprobacion.descripcion}</p>
                <div className="flex items-center gap-1 pt-0.5">
                  <Users className="size-3 opacity-70" />
                  <span className="opacity-80">
                    {nivelAprobacion.aprobadoresRequeridos} aprobador{nivelAprobacion.aprobadoresRequeridos > 1 ? 'es' : ''} requerido{nivelAprobacion.aprobadoresRequeridos > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {rolActualPuedeAprobarEsteNivel
                    ? <><ShieldCheck className="size-3" /> <span>Tu rol puede aprobar este nivel</span></>
                    : <><ShieldAlert className="size-3" /> <span>Tu rol no está configurado para este nivel</span></>
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items de la Orden ({orden.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orden.items.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{item.descripcion}</p>
                    <p className="text-sm text-muted-foreground">
                      Cantidad: {item.cantidad} {item.unidad} • Precio unitario: {formatearMonto(item.precioUnitario, orden.moneda)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatearMonto(item.subtotal, orden.moneda)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Condiciones */}
      {orden.condiciones && (
        <Card>
          <CardHeader>
            <CardTitle>Condiciones de Pago/Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{orden.condiciones}</p>
          </CardContent>
        </Card>
      )}

      {/* Recepciones Asociadas */}
      {recepciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Recepciones Asociadas ({recepciones.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recepciones.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{rec.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatearFecha(rec.fechaRecepcion)} • {rec.estado}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onNavigate(`/compras/recepciones/${rec.id}`)}>
                    Ver Detalle
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auditoría */}
      <Card>
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Creado por:</span> {orden.auditoria.creadoPor} el {formatearFecha(orden.auditoria.creadoEn)}
          </div>
          {orden.auditoria.modificadoPor && (
            <div>
              <span className="text-muted-foreground">Modificado por:</span> {orden.auditoria.modificadoPor} el {orden.auditoria.modificadoEn && formatearFecha(orden.auditoria.modificadoEn)}
            </div>
          )}
          {orden.aprobadoPor && (
            <div>
              <span className="text-muted-foreground">Aprobado por:</span> {orden.aprobadoPor} el {orden.aprobadoEn && formatearFecha(orden.aprobadoEn)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {/* Aprobar */}
      <Dialog open={showAprobarDialog} onOpenChange={setShowAprobarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Orden</DialogTitle>
            <DialogDescription>
              ¿Está seguro de aprobar la orden <strong>{orden.id}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAprobarDialog(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleAprobar}>Confirmar Aprobación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={showRechazarDialog} onOpenChange={setShowRechazarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Orden</DialogTitle>
            <DialogDescription>
              Indique el motivo del rechazo (mínimo 30 caracteres)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivoRechazo">Motivo de Rechazo *</Label>
            <Textarea
              id="motivoRechazo"
              value={motivoRechazo}
              onChange={(e) => {
                setMotivoRechazo(e.target.value);
                setErrorMotivo('');
              }}
              rows={4}
              placeholder="Explique las razones del rechazo..."
            />
            <p className="text-sm text-muted-foreground">{motivoRechazo.length}/30 caracteres</p>
            {errorMotivo && <p className="text-sm text-red-600">{errorMotivo}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRechazarDialog(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button variant="destructive" onClick={handleRechazar}>Confirmar Rechazo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Orden</DialogTitle>
            <DialogDescription>
              Indique el motivo de anulación (mínimo 30 caracteres)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivoAnulacion">Motivo de Anulación *</Label>
            <Textarea
              id="motivoAnulacion"
              value={motivoAnulacion}
              onChange={(e) => {
                setMotivoAnulacion(e.target.value);
                setErrorMotivo('');
              }}
              rows={4}
              placeholder="Explique las razones de la anulación..."
            />
            <p className="text-sm text-muted-foreground">{motivoAnulacion.length}/30 caracteres</p>
            {errorMotivo && <p className="text-sm text-red-600">{errorMotivo}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnularDialog(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button variant="destructive" onClick={handleAnular}>Confirmar Anulación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
