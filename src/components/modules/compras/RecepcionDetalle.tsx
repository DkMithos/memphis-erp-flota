import { useState } from 'react';
import { ArrowLeft, Ban, Package, FileText, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
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
import { useRecepcionesStore } from '../../../lib/compras/recepciones-store';
import {
  RECEPCION_ESTADO_CONFIG,
  tienePermisoRecepcion,
  puedeAnularRecepcion,
  formatearFecha,
  validarMotivoAnulacion
} from '../../../lib/compras/recepciones-config';

interface RecepcionDetalleProps {
  recepcionId: string;
  onNavigate: (route: string) => void;
}

export function RecepcionDetalle({ recepcionId, onNavigate }: RecepcionDetalleProps) {
  const { obtenerRecepcionPorId, anularRecepcion, usuarioActual } = useRecepcionesStore();
  
  const recepcion = obtenerRecepcionPorId(recepcionId);

  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');

  if (!recepcion) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No se encontró la recepción con ID: <strong>{recepcionId}</strong>
        </AlertDescription>
      </Alert>
    );
  }

  const estadoConfig = RECEPCION_ESTADO_CONFIG[recepcion.estado];
  const puedeAnular = tienePermisoRecepcion(usuarioActual.rol, 'anular') && puedeAnularRecepcion(recepcion.estado);

  const handleAnular = async () => {
    const validacion = validarMotivoAnulacion(motivoAnulacion);
    if (!validacion.valid) {
      setErrorMotivo(validacion.error!);
      return;
    }
    const res = await anularRecepcion(recepcion.id, motivoAnulacion);
    if (!res.exito) {
      console.error('Error al anular recepción:', res.errores);
      return;
    }
    setShowAnularDialog(false);
    setMotivoAnulacion('');
    setErrorMotivo('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('/compras/recepciones')}>
              <ArrowLeft className="size-4 mr-2" />
              Volver a Recepciones
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h2>{recepcion.id}</h2>
            <Badge className={estadoConfig.className}>
              <estadoConfig.icon className="size-3 mr-1" />
              {estadoConfig.label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Recepción de Orden {recepcion.ordenId}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {puedeAnular && (
            <Button onClick={() => setShowAnularDialog(true)} variant="outline">
              <Ban className="size-4 mr-2" />
              Anular
            </Button>
          )}
          <Button variant="outline" onClick={() => onNavigate(`/compras/ordenes/${recepcion.ordenId}`)}>
            <FileText className="size-4 mr-2" />
            Ver Orden
          </Button>
        </div>
      </div>

      {/* Alerta si fue anulada */}
      {recepcion.estado === 'anulada' && recepcion.auditoria.motivoAnulacion && (
        <Alert>
          <Ban className="size-4" />
          <AlertDescription>
            <strong>Recepción anulada:</strong> {recepcion.auditoria.motivoAnulacion}
            <br />
            <span className="text-xs">
              Por: {recepcion.auditoria.anuladoPor} el {recepcion.auditoria.anuladoEn && formatearFecha(recepcion.auditoria.anuladoEn)}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Información General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Orden Asociada</p>
            <Button 
              variant="link" 
              className="p-0 h-auto" 
              onClick={() => onNavigate(`/compras/ordenes/${recepcion.ordenId}`)}
            >
              {recepcion.ordenId}
            </Button>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="font-medium">{estadoConfig.label}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Conforme</p>
            <p className="font-medium">{recepcion.conforme ? 'Sí' : 'No'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha de Recepción</p>
            <p className="font-medium">{formatearFecha(recepcion.fechaRecepcion)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Items Recibidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Items Recibidos ({recepcion.itemsRecibidos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recepcion.itemsRecibidos.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{item.descripcion}</p>
                    <p className="text-sm text-muted-foreground">
                      Cantidad recibida: <strong>{item.cantidadRecibida} {item.unidad}</strong>
                    </p>
                    {item.observacionItem && (
                      <p className="text-sm text-orange-600 mt-1">
                        Observación: {item.observacionItem}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Observaciones Generales */}
      {recepcion.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{recepcion.observaciones}</p>
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
            <span className="text-muted-foreground">Creado por:</span> {recepcion.auditoria.creadoPor} el {formatearFecha(recepcion.auditoria.creadoEn)}
          </div>
          {recepcion.auditoria.modificadoPor && (
            <div>
              <span className="text-muted-foreground">Modificado por:</span> {recepcion.auditoria.modificadoPor} el {recepcion.auditoria.modificadoEn && formatearFecha(recepcion.auditoria.modificadoEn)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Anular */}
      <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Recepción</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowAnularDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleAnular}>Confirmar Anulación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
