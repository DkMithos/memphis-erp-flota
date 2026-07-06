import { useState } from 'react';
import { ArrowLeft, Edit, Ban, CheckCircle, XCircle, AlertTriangle, FileText, Calendar, Package, Eye, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
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
import { Separator } from '../../ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { useRequerimientosStore } from '../../../lib/compras/requerimientos-store';
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { useCentrosCosto } from '../../../lib/centros-costo/centros-costo-store';
import { COTIZACION_ESTADO_CONFIG, formatearMonto as formatearMontoCotizacion } from '../../../lib/compras/cotizaciones-config';
import {
  REQUERIMIENTO_ESTADO_CONFIG,
  REQUERIMIENTO_PRIORIDAD_CONFIG,
  CENTRO_COSTO_LABELS,
  tienePermiso,
  puedeEditarRequerimiento,
  puedeAnularRequerimiento,
  puedeRevisarRequerimiento,
  validarMotivoAnulacion,
  formatearMonto,
  formatearFecha
} from '../../../lib/compras/requerimientos-config';
import { toast } from 'sonner';

interface RequerimientoDetalleProps {
  requerimientoId: string;
  onNavigate?: (route: string) => void;
}

export function RequerimientoDetalle({ requerimientoId, onNavigate }: RequerimientoDetalleProps) {
  const { 
    obtenerRequerimientoPorId, 
    anularRequerimiento, 
    aprobarRequerimiento,
    rechazarRequerimiento,
    usuarioActual 
  } = useRequerimientosStore();
  
  const { obtenerCotizacionesPorRequerimiento } = useCotizacionesStore();
  const { centrosCosto } = useCentrosCosto();
  const requerimiento = obtenerRequerimientoPorId(requerimientoId);
  const cotizacionesAsociadas = obtenerCotizacionesPorRequerimiento(requerimientoId);

  // Centro de costo: el selector nuevo guarda el UUID del CC (en centroCostoId
  // o, por compatibilidad, en el campo legacy centroCosto). Resolver contra el store.
  const centroCostoDisplay = (() => {
    if (!requerimiento) return '—';
    const cc = centrosCosto.find(
      c => c._dbId === requerimiento.centroCostoId || c._dbId === requerimiento.centroCosto,
    );
    if (cc) return `${cc.codigo} — ${cc.nombre}`;
    return CENTRO_COSTO_LABELS[requerimiento.centroCosto] ?? '—';
  })();

  // Formateador de moneda según la moneda del requerimiento
  const fmtMonto = (n: number) =>
    new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: requerimiento?.moneda ?? 'PEN',
      minimumFractionDigits: 2,
    }).format(n);

  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');

  const [showRechazarDialog, setShowRechazarDialog] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [errorRechazo, setErrorRechazo] = useState('');

  if (!requerimiento) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Requerimiento no encontrado. El ID "{requerimientoId}" no existe en el sistema.
          </AlertDescription>
        </Alert>
        <PageNav />
      </div>
    );
  }

  const estadoConfig = REQUERIMIENTO_ESTADO_CONFIG[requerimiento.estado];
  const prioridadConfig = REQUERIMIENTO_PRIORIDAD_CONFIG[requerimiento.prioridad];

  const puedeEditar = tienePermiso(usuarioActual.rol, 'editar') && puedeEditarRequerimiento(requerimiento.estado);
  const puedeAnular = tienePermiso(usuarioActual.rol, 'anular') && puedeAnularRequerimiento(requerimiento.estado);
  const puedeAprobar = tienePermiso(usuarioActual.rol, 'aprobar') && puedeRevisarRequerimiento(requerimiento.estado);
  const puedeRechazar = tienePermiso(usuarioActual.rol, 'rechazar') && puedeRevisarRequerimiento(requerimiento.estado);

  const handleAnular = async () => {
    const validacion = validarMotivoAnulacion(motivoAnulacion);
    if (!validacion.valid) {
      setErrorMotivo(validacion.error!);
      return;
    }

    const res = await anularRequerimiento(requerimientoId, motivoAnulacion);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al anular el requerimiento');
      return;
    }
    toast.success('Requerimiento anulado correctamente');
    setShowAnularDialog(false);
    setMotivoAnulacion('');
  };

  const handleAprobar = async () => {
    const res = await aprobarRequerimiento(requerimientoId, usuarioActual.email);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al aprobar el requerimiento');
      return;
    }
    toast.success('Requerimiento aprobado correctamente');
  };

  const handleRechazar = async () => {
    if (motivoRechazo.trim().length < 10) {
      setErrorRechazo('El motivo debe tener al menos 10 caracteres');
      return;
    }

    const res = await rechazarRequerimiento(requerimientoId, usuarioActual.email, motivoRechazo);
    if (!res.exito) {
      toast.error(res.errores?.[0] ?? 'Error al rechazar el requerimiento');
      return;
    }
    toast.success('Requerimiento rechazado');
    setShowRechazarDialog(false);
    setMotivoRechazo('');
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-semibold">{requerimiento.id}</h2>
              <Badge className={estadoConfig.className}>
                <estadoConfig.icon className="size-3" />
                {estadoConfig.label}
              </Badge>
              <Badge className={prioridadConfig.className}>
                <prioridadConfig.icon className="size-3" />
                {prioridadConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{requerimiento.titulo}</p>
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
            <Button onClick={() => onNavigate?.(`/compras/requerimientos/${requerimientoId}/editar`)}>
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
      {requerimiento.estado === 'anulado' && requerimiento.auditoria.motivoAnulacion && (
        <Alert variant="destructive">
          <Ban className="size-4" />
          <AlertDescription>
            <strong>Requerimiento Anulado</strong>
            <p className="mt-2">{requerimiento.auditoria.motivoAnulacion}</p>
            <div className="text-xs mt-2 opacity-75">
              Anulado por {requerimiento.auditoria.anuladoPor} el{' '}
              {new Date(requerimiento.auditoria.anuladoEn!).toLocaleString('es-PE')}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {requerimiento.estado === 'rechazado' && requerimiento.motivoRechazo && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>Requerimiento Rechazado</strong>
            <p className="mt-2">{requerimiento.motivoRechazo}</p>
            <div className="text-xs mt-2 opacity-75">
              Rechazado por {requerimiento.rechazadoPor} el{' '}
              {new Date(requerimiento.rechazadoEn!).toLocaleString('es-PE')}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {requerimiento.estado === 'aprobado' && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="size-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Requerimiento Aprobado</strong>
            <p className="mt-1 text-sm">
              Aprobado por {requerimiento.aprobadoPor} el{' '}
              {new Date(requerimiento.aprobadoEn!).toLocaleString('es-PE')}
            </p>
            <p className="text-sm mt-1">Listo para generar Orden de Compra</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Título</p>
              <p className="font-medium">{requerimiento.titulo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Centro de Costo</p>
              <Badge variant="outline">{centroCostoDisplay}</Badge>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Descripción</p>
              <p className="text-sm whitespace-pre-wrap">{requerimiento.descripcion}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Solicitante</p>
              <p className="font-medium">{requerimiento.solicitanteNombre}</p>
              <p className="text-sm text-muted-foreground">{requerimiento.solicitanteEmail}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha Requerida</p>
              <p>{requerimiento.fechaRequerida ? formatearFecha(requerimiento.fechaRequerida) : 'No especificada'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Items del Requerimiento ({requerimiento.items.length})
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
                <TableHead>Precio Est.</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Comentarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requerimiento.items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell>{item.cantidad}</TableCell>
                  <TableCell className="capitalize">{item.unidad}</TableCell>
                  <TableCell>{fmtMonto(item.precioEstimado)}</TableCell>
                  <TableCell className="font-medium">{fmtMonto(item.cantidad * item.precioEstimado)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {item.comentario || '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={5} className="text-right">Total Estimado:</TableCell>
                <TableCell className="text-lg text-primary">{fmtMonto(requerimiento.totalEstimado)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cotizaciones Asociadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Cotizaciones Asociadas ({cotizacionesAsociadas.length})
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onNavigate?.(`/compras/cotizaciones/nuevo?req=${requerimientoId}`)}
            >
              <Plus className="size-4" />
              Crear Cotización
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cotizacionesAsociadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <FileText className="size-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No hay cotizaciones asociadas</p>
              <p className="text-sm mt-1">Solicita cotizaciones a proveedores para este requerimiento</p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                onClick={() => onNavigate?.(`/compras/cotizaciones/nuevo?req=${requerimientoId}`)}
              >
                <Plus className="size-4" />
                Crear Primera Cotización
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Validez</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizacionesAsociadas.map((cot) => {
                  const estadoCotConfig = COTIZACION_ESTADO_CONFIG[cot.estado]
                    ?? { label: cot.estado, icon: FileText, className: 'bg-gray-100 text-gray-600' };
                  return (
                    <TableRow key={cot.id}>
                      <TableCell className="font-mono text-sm">{cot.id}</TableCell>
                      <TableCell>{cot.proveedorNombre}</TableCell>
                      <TableCell>
                        <Badge className={estadoCotConfig.className}>
                          <estadoCotConfig.icon className="size-3" />
                          {estadoCotConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatearMontoCotizacion(cot.total, cot.moneda)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cot.validezDias} días</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onNavigate?.(`/compras/cotizaciones/${cot.id}`)}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
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
                  Por {requerimiento.auditoria.creadoPor} el{' '}
                  {new Date(requerimiento.auditoria.creadoEn).toLocaleString('es-PE')}
                </p>
              </div>
            </div>
            {requerimiento.auditoria.modificadoPor && (
              <div className="flex items-start gap-3">
                <Edit className="size-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Última Modificación</p>
                  <p className="text-sm text-muted-foreground">
                    Por {requerimiento.auditoria.modificadoPor} el{' '}
                    {new Date(requerimiento.auditoria.modificadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {requerimiento.aprobadoPor && (
              <div className="flex items-start gap-3">
                <CheckCircle className="size-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Aprobado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {requerimiento.aprobadoPor} el{' '}
                    {new Date(requerimiento.aprobadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {requerimiento.rechazadoPor && (
              <div className="flex items-start gap-3">
                <XCircle className="size-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Rechazado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {requerimiento.rechazadoPor} el{' '}
                    {new Date(requerimiento.rechazadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {requerimiento.auditoria.anuladoPor && (
              <div className="flex items-start gap-3">
                <Ban className="size-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Anulado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {requerimiento.auditoria.anuladoPor} el{' '}
                    {new Date(requerimiento.auditoria.anuladoEn!).toLocaleString('es-PE')}
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
            <AlertDialogTitle>Anular Requerimiento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará el requerimiento "{requerimiento.id}" como anulado.
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
              Anular Requerimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Rechazo */}
      <AlertDialog open={showRechazarDialog} onOpenChange={setShowRechazarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Requerimiento</AlertDialogTitle>
            <AlertDialogDescription>
              El requerimiento será devuelto al solicitante con el motivo del rechazo.
              Podrá ser corregido y reenviado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="motivoRechazo">Motivo del Rechazo (mínimo 10 caracteres) *</Label>
            <Textarea
              id="motivoRechazo"
              value={motivoRechazo}
              onChange={(e) => {
                setMotivoRechazo(e.target.value);
                setErrorRechazo('');
              }}
              placeholder="Indique qué debe corregirse..."
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
              {motivoRechazo.length}/10 caracteres
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
              Rechazar Requerimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}