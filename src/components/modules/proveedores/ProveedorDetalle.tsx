import { useState } from 'react';
import { ArrowLeft, Edit, XCircle, CheckCircle, AlertTriangle, Building2, Mail, Phone, MapPin, Calendar } from 'lucide-react';
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
import { Separator } from '../../ui/separator';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { useAuth } from '../../../auth/AuthProvider';
import {
  PROVEEDOR_ESTADO_CONFIG,
  PROVEEDOR_CONDICION_CONFIG,
  PROVEEDOR_TIPO_CONFIG,
  PROVEEDOR_CATEGORIA_LABELS,
  tienePermiso,
  validarMotivoInactivacion,
  type RolUsuario
} from '../../../lib/proveedores/proveedores-config';
import { toast } from 'sonner';

interface ProveedorDetalleProps {
  proveedorId: string;
  onNavigate?: (route: string) => void;
}

export function ProveedorDetalle({ proveedorId, onNavigate }: ProveedorDetalleProps) {
  const { obtenerProveedorPorId, inactivarProveedor, activarProveedor } = useProveedorStore();
  const { profile } = useAuth();
  const rolActual = (profile?.rol ?? 'operaciones') as RolUsuario;
  const proveedor = obtenerProveedorPorId(proveedorId);

  const [showInactivarDialog, setShowInactivarDialog] = useState(false);
  const [motivoInactivacion, setMotivoInactivacion] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');

  if (!proveedor) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Proveedor no encontrado. El ID "{proveedorId}" no existe en el sistema.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => onNavigate?.('/proveedores/directorio')}>
          <ArrowLeft className="size-4 mr-2" />
          Volver al Directorio
        </Button>
      </div>
    );
  }

  const estadoConfig = PROVEEDOR_ESTADO_CONFIG[proveedor.estado];
  const condicionConfig = PROVEEDOR_CONDICION_CONFIG[proveedor.condicion];
  const tipoConfig = PROVEEDOR_TIPO_CONFIG[proveedor.tipo];

  const puedeEditar = tienePermiso(rolActual, 'editar') && proveedor.estado !== 'inactivo';
  const puedeInactivar = tienePermiso(rolActual, 'inactivar') && proveedor.estado === 'activo';
  const puedeActivar = tienePermiso(rolActual, 'inactivar') && proveedor.estado === 'inactivo';

  const handleInactivar = async () => {
    const validacion = validarMotivoInactivacion(motivoInactivacion);
    if (!validacion.valid) {
      setErrorMotivo(validacion.error!);
      return;
    }

    const resultado = await inactivarProveedor(proveedorId, motivoInactivacion);
    if (resultado.exito) {
      toast.success('Proveedor inactivado correctamente');
      setShowInactivarDialog(false);
      setMotivoInactivacion('');
    } else {
      toast.error(resultado.errores?.[0] ?? 'Error al inactivar proveedor');
    }
  };

  const handleActivar = async () => {
    const resultado = await activarProveedor(proveedorId);
    if (resultado.exito) {
      toast.success('Proveedor activado correctamente');
    } else {
      toast.error(resultado.errores?.[0] ?? 'Error al activar proveedor');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/proveedores/directorio')}>
            <ArrowLeft className="size-4 mr-2" />
            Volver al Directorio
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="size-6 text-primary" />
            </div>
            <div>
              <h2>{proveedor.razonSocial}</h2>
              {proveedor.nombreComercial && (
                <p className="text-muted-foreground">{proveedor.nombreComercial}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge className={estadoConfig.className}>
                  <estadoConfig.icon className="size-3 mr-1" />
                  {estadoConfig.label}
                </Badge>
                <Badge className={condicionConfig.className}>
                  {condicionConfig.label}
                </Badge>
                <Badge className={tipoConfig.className}>{tipoConfig.label}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {puedeActivar && (
            <Button variant="outline" onClick={handleActivar}>
              <CheckCircle className="size-4 mr-2" />
              Activar
            </Button>
          )}
          {puedeEditar && (
            <Button onClick={() => onNavigate?.(`/proveedores/directorio/${proveedorId}/editar`)}>
              <Edit className="size-4 mr-2" />
              Editar
            </Button>
          )}
          {puedeInactivar && (
            <Button variant="destructive" onClick={() => setShowInactivarDialog(true)}>
              <XCircle className="size-4 mr-2" />
              Inactivar
            </Button>
          )}
        </div>
      </div>

      {/* Alerta de Inactivo */}
      {proveedor.estado === 'inactivo' && proveedor.auditoria.motivoInactivacion && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>Proveedor Inactivo</strong>
            <p className="mt-2">{proveedor.auditoria.motivoInactivacion}</p>
            <div className="text-xs mt-2 opacity-75">
              Inactivado por {proveedor.auditoria.inactivadoPor} el{' '}
              {new Date(proveedor.auditoria.inactivadoEn!).toLocaleString('es-PE')}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Información Básica */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">RUC</p>
              <p className="font-mono">{proveedor.ruc}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID del Sistema</p>
              <p className="font-mono">{proveedor.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Razón Social</p>
              <p className="font-medium">{proveedor.razonSocial}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nombre Comercial</p>
              <p>{proveedor.nombreComercial || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo de Proveedor</p>
              <Badge className={tipoConfig.className}>{tipoConfig.label}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Categorías</p>
              <div className="flex flex-wrap gap-2">
                {proveedor.categorias.map(cat => (
                  <Badge key={cat} variant="outline">
                    {PROVEEDOR_CATEGORIA_LABELS[cat]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos de Contacto */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="size-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{proveedor.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="size-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Teléfono Principal</p>
                <p className="font-mono">{proveedor.telefono}</p>
                {proveedor.telefonoAlternativo && (
                  <>
                    <p className="text-sm text-muted-foreground mt-2">Teléfono Alternativo</p>
                    <p className="font-mono">{proveedor.telefonoAlternativo}</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="size-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Dirección</p>
                <p>{proveedor.direccion}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {proveedor.ciudad}, {proveedor.pais}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacto Principal */}
        <Card>
          <CardHeader>
            <CardTitle>Contacto Principal</CardTitle>
          </CardHeader>
          <CardContent>
            {proveedor.contactoPrincipal ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{proveedor.contactoPrincipal.nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cargo</p>
                  <p>{proveedor.contactoPrincipal.cargo}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{proveedor.contactoPrincipal.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-mono">{proveedor.contactoPrincipal.telefono}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6">
                No se ha registrado contacto principal
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Datos Bancarios y Evaluación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos Bancarios</CardTitle>
          </CardHeader>
          <CardContent>
            {proveedor.bancos.length > 0 ? (
              <div className="space-y-4">
                {proveedor.bancos.map((banco, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{banco.banco}</p>
                      <Badge variant="outline">{banco.moneda}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Cuenta {banco.tipoCuenta}</p>
                    <p className="font-mono text-sm">{banco.numeroCuenta}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6">
                No se han registrado cuentas bancarias
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluación y Desempeño</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Calificación General</p>
              <div className="flex items-center gap-3 mt-1">
                <div className="text-2xl font-semibold">{proveedor.calificacion}/100</div>
                <Badge className={condicionConfig.className}>
                  {condicionConfig.label}
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Compras</p>
                <p className="text-lg font-semibold">
                  S/ {proveedor.totalCompras.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Órdenes Emitidas</p>
                <p className="text-lg font-semibold">{proveedor.numeroOrdenes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Observaciones */}
      {proveedor.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{proveedor.observaciones}</p>
          </CardContent>
        </Card>
      )}

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
                  Por {proveedor.auditoria.creadoPor} el{' '}
                  {new Date(proveedor.auditoria.creadoEn).toLocaleString('es-PE')}
                </p>
              </div>
            </div>
            {proveedor.auditoria.modificadoPor && (
              <div className="flex items-start gap-3">
                <Edit className="size-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Última Modificación</p>
                  <p className="text-sm text-muted-foreground">
                    Por {proveedor.auditoria.modificadoPor} el{' '}
                    {new Date(proveedor.auditoria.modificadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
            {proveedor.auditoria.inactivadoPor && (
              <div className="flex items-start gap-3">
                <XCircle className="size-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Inactivado</p>
                  <p className="text-sm text-muted-foreground">
                    Por {proveedor.auditoria.inactivadoPor} el{' '}
                    {new Date(proveedor.auditoria.inactivadoEn!).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Inactivación */}
      <AlertDialog open={showInactivarDialog} onOpenChange={setShowInactivarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inactivar Proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará al proveedor "{proveedor.razonSocial}" como inactivo.
              No podrá ser seleccionado en nuevas órdenes de compra hasta que sea reactivado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="motivo">Motivo de Inactivación (mínimo 30 caracteres) *</Label>
            <Textarea
              id="motivo"
              value={motivoInactivacion}
              onChange={(e) => {
                setMotivoInactivacion(e.target.value);
                setErrorMotivo('');
              }}
              placeholder="Explique detalladamente el motivo de la inactivación..."
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
              {motivoInactivacion.length}/30 caracteres
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setMotivoInactivacion('');
              setErrorMotivo('');
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleInactivar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Inactivar Proveedor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
