/**
 * KESA ERP - Flota → Vehículo Detalle → Tab Documentos
 * CRUD completo de documentos del vehículo con alertas de vigencia
 */

import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Edit, Trash2, AlertCircle, CheckCircle2, Clock, Calendar, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Badge } from '../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import { Alert, AlertDescription } from '../../../ui/alert';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import {
  Vehiculo,
  VehiculoDocumento,
  TipoDocumentoVehiculo,
  EstadoDocumento,
  TIPO_DOCUMENTO_LABELS,
  calcEstadoDocumento,
  calcDiasRestantesDocumento,
  getEstadoDocumentoBadge,
  validarDocumento,
} from '../../../../lib/flota/vehiculos-config';
import { toast } from 'sonner@2.0.3';

interface DocumentosTabProps {
  vehiculoId: string;
  vehiculo: Vehiculo;
}

type DocumentoFormData = Omit<VehiculoDocumento, 'id' | 'creadoPor' | 'creadoEn'>;

export function DocumentosTab({ vehiculoId, vehiculo }: DocumentosTabProps) {
  const {
    agregarDocumentoVehiculo,
    actualizarDocumentoVehiculo,
    eliminarDocumentoVehiculo,
    obtenerDocumentosVehiculo,
  } = useVehiculos();

  const documentos = obtenerDocumentosVehiculo(vehiculoId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEliminarOpen, setDialogEliminarOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [documentoEditando, setDocumentoEditando] = useState<VehiculoDocumento | null>(null);

  const [formData, setFormData] = useState<DocumentoFormData>({
    tipo: 'SOAT',
    nombre: '',
    numero: '',
    fechaEmision: '',
    fechaVencimiento: '',
    archivoNombre: '',
    observaciones: '',
  });

  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Estadísticas de documentos
  const stats = useMemo(() => {
    let vigentes = 0;
    let proximos = 0;
    let vencidos = 0;

    documentos.forEach(doc => {
      const estado = calcEstadoDocumento(doc.fechaVencimiento);
      if (estado === 'vigente') vigentes++;
      else if (estado === 'proximo') proximos++;
      else if (estado === 'vencido') vencidos++;
    });

    return { vigentes, proximos, vencidos };
  }, [documentos]);

  const handleNuevoDocumento = () => {
    setModoEdicion(false);
    setDocumentoEditando(null);
    setFormData({
      tipo: 'SOAT',
      nombre: '',
      numero: '',
      fechaEmision: '',
      fechaVencimiento: '',
      archivoNombre: '',
      observaciones: '',
    });
    setErrores([]);
    setDialogOpen(true);
  };

  const handleEditarDocumento = (doc: VehiculoDocumento) => {
    setModoEdicion(true);
    setDocumentoEditando(doc);
    setFormData({
      tipo: doc.tipo,
      nombre: doc.nombre,
      numero: doc.numero || '',
      fechaEmision: doc.fechaEmision || '',
      fechaVencimiento: doc.fechaVencimiento,
      archivoNombre: doc.archivoNombre || '',
      observaciones: doc.observaciones || '',
    });
    setErrores([]);
    setDialogOpen(true);
  };

  const handleEliminarDocumento = (doc: VehiculoDocumento) => {
    setDocumentoEditando(doc);
    setDialogEliminarOpen(true);
  };

  const handleChange = (field: keyof DocumentoFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrores([]);
  };

  const handleGuardar = async () => {
    // Validar
    const validacion = validarDocumento(formData);
    if (!validacion.valido) {
      setErrores(validacion.errores);
      toast.error('Revisa los campos obligatorios', {
        description: validacion.errores[0],
      });
      return;
    }

    setGuardando(true);

    if (modoEdicion && documentoEditando) {
      // Actualizar
      const resultado = await actualizarDocumentoVehiculo(vehiculoId, documentoEditando.id, formData);

      if (resultado.exito) {
        toast.success('Documento actualizado', {
          description: 'Los cambios se guardaron correctamente',
        });
        setDialogOpen(false);
        setErrores([]);
      } else {
        setErrores(resultado.errores || ['Error desconocido']);
        toast.error('Error al actualizar', {
          description: resultado.errores?.join(', '),
        });
      }
    } else {
      // Crear
      const resultado = await agregarDocumentoVehiculo(vehiculoId, formData);

      if (resultado.exito) {
        toast.success('Documento agregado', {
          description: 'El documento se agregó correctamente',
        });
        setDialogOpen(false);
        setErrores([]);
      } else {
        setErrores(resultado.errores || ['Error desconocido']);
        toast.error('Error al agregar', {
          description: resultado.errores?.join(', '),
        });
      }
    }

    setGuardando(false);
  };

  const confirmarEliminar = async () => {
    if (!documentoEditando) return;

    const resultado = await eliminarDocumentoVehiculo(vehiculoId, documentoEditando.id);

    if (resultado.exito) {
      toast.success('Documento eliminado', {
        description: 'El documento se eliminó correctamente',
      });
      setDialogEliminarOpen(false);
      setDocumentoEditando(null);
    } else {
      toast.error('Error al eliminar', {
        description: resultado.errores?.join(', '),
      });
    }
  };

  const renderEstadoBadge = (fechaVencimiento: string) => {
    const estado = calcEstadoDocumento(fechaVencimiento);
    const config = getEstadoDocumentoBadge(estado);
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="size-5 text-[#0A66C2]" />
            Documentos & Vigencias
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestiona SOAT, revisión técnica, seguros y otros documentos del vehículo
          </p>
        </div>

        <Button onClick={handleNuevoDocumento} className="gap-2">
          <Plus className="size-4" />
          Agregar Documento
        </Button>
      </div>

      {/* Estadísticas */}
      {documentos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Vigentes</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.vigentes}
                  </p>
                </div>
                <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Por Vencer (≤30d)</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.proximos}
                  </p>
                </div>
                <Clock className="size-8 text-amber-600 dark:text-amber-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.vencidos}
                  </p>
                </div>
                <AlertCircle className="size-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alertas */}
      {stats.vencidos > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Hay {stats.vencidos} documento(s) vencido(s). Renueva lo antes posible.
          </AlertDescription>
        </Alert>
      )}

      {stats.proximos > 0 && stats.vencidos === 0 && (
        <Alert>
          <Clock className="size-4" />
          <AlertDescription>
            Hay {stats.proximos} documento(s) próximo(s) a vencer en los próximos 30 días.
          </AlertDescription>
        </Alert>
      )}

      {/* Listado */}
      {documentos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="size-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No hay documentos registrados</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comienza agregando documentos importantes como SOAT, revisión técnica o seguros
            </p>
            <Button onClick={handleNuevoDocumento} className="gap-2">
              <Plus className="size-4" />
              Agregar Primer Documento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos Registrados</CardTitle>
            <CardDescription>
              {documentos.length} documento(s) en total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Días Restantes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentos.map((doc) => {
                  const diasRestantes = calcDiasRestantesDocumento(doc.fechaVencimiento);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        {TIPO_DOCUMENTO_LABELS[doc.tipo]}
                      </TableCell>
                      <TableCell>{doc.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.numero || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-muted-foreground" />
                          {new Date(doc.fechaVencimiento).toLocaleDateString('es-PE')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {diasRestantes >= 0 ? (
                          <span className={diasRestantes <= 30 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                            {diasRestantes} día(s)
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {Math.abs(diasRestantes)} día(s) vencido
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderEstadoBadge(doc.fechaVencimiento)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditarDocumento(doc)}
                            className="gap-2"
                          >
                            <Edit className="size-4" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEliminarDocumento(doc)}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modoEdicion ? 'Editar Documento' : 'Agregar Documento'}
            </DialogTitle>
            <DialogDescription>
              {modoEdicion 
                ? 'Modifica los datos del documento' 
                : 'Completa la información del nuevo documento'}
            </DialogDescription>
          </DialogHeader>

          {errores.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errores.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="tipo">
                Tipo de Documento <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => handleChange('tipo', value as TipoDocumentoVehiculo)}
                disabled={guardando}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_DOCUMENTO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre / Descripción <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                placeholder="Ej: SOAT Vigente 2024"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                disabled={guardando}
              />
            </div>

            {/* Número */}
            <div className="space-y-2">
              <Label htmlFor="numero">Número de Documento</Label>
              <Input
                id="numero"
                placeholder="Ej: SOAT-2024-001"
                value={formData.numero}
                onChange={(e) => handleChange('numero', e.target.value)}
                disabled={guardando}
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaEmision">Fecha de Emisión</Label>
                <Input
                  id="fechaEmision"
                  type="date"
                  value={formData.fechaEmision}
                  onChange={(e) => handleChange('fechaEmision', e.target.value)}
                  disabled={guardando}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaVencimiento">
                  Fecha de Vencimiento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fechaVencimiento"
                  type="date"
                  value={formData.fechaVencimiento}
                  onChange={(e) => handleChange('fechaVencimiento', e.target.value)}
                  disabled={guardando}
                />
              </div>
            </div>

            {/* Archivo (placeholder) */}
            <div className="space-y-2">
              <Label htmlFor="archivo">Archivo Adjunto</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="archivo"
                  placeholder="Nombre del archivo"
                  value={formData.archivoNombre}
                  onChange={(e) => handleChange('archivoNombre', e.target.value)}
                  disabled={guardando}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="gap-2 whitespace-nowrap"
                  title="Disponible al activar módulo Documentos (Storage) en licencia"
                >
                  <Upload className="size-4" />
                  Subir (Próximamente)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Disponible al activar módulo Documentos (Storage) en tu licencia
              </p>
            </div>

            {/* Observaciones */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Notas adicionales sobre el documento..."
                value={formData.observaciones}
                onChange={(e) => handleChange('observaciones', e.target.value)}
                disabled={guardando}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : modoEdicion ? 'Actualizar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <AlertDialog open={dialogEliminarOpen} onOpenChange={setDialogEliminarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento{' '}
              <strong>{documentoEditando?.nombre}</strong> será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
