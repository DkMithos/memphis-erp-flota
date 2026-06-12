/**
 * DETALLE DE MANTENIMIENTO BIOMÉDICO
 * Vista completa con información y cambio de estado
 * Production-ready siguiendo patrón enterprise
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  Building2,
  Activity,
  Wrench
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Separator } from '../../ui/separator';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { useMantenimientosStore } from '../../../lib/biomedico/mantenimientos-store';
import { 
  MANTENIMIENTO_ESTADO_CONFIG,
  MANTENIMIENTO_TIPO_CONFIG,
  MANTENIMIENTO_PRIORIDAD_CONFIG,
  type EstadoMantenimientoBio
} from '../../../lib/biomedico/mantenimientos-config';
import { toast } from 'sonner';

interface BiomedicoMantenimientoDetalleProps {
  numeroMantenimiento: string;
  onBack?: () => void;
  onNavigateToEquipo?: (codigoEquipo: string) => void;
}

export function BiomedicoMantenimientoDetalle({ 
  numeroMantenimiento,
  onBack,
  onNavigateToEquipo
}: BiomedicoMantenimientoDetalleProps) {
  const { obtenerMantenimientoPorNumero, actualizarEstadoMantenimiento } = useMantenimientosStore();
  const [nuevoEstado, setNuevoEstado] = useState<EstadoMantenimientoBio | ''>('');

  const mantenimiento = obtenerMantenimientoPorNumero(numeroMantenimiento);

  if (!mantenimiento) {
    return (
      <div className="space-y-6">
        <PageNav onBack={onBack} />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            No se encontró el mantenimiento con número {numeroMantenimiento}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const estadoConfig = MANTENIMIENTO_ESTADO_CONFIG[mantenimiento.estado];
  const tipoConfig = MANTENIMIENTO_TIPO_CONFIG[mantenimiento.tipo];
  const prioridadConfig = MANTENIMIENTO_PRIORIDAD_CONFIG[mantenimiento.prioridad];
  const EstadoIcon = estadoConfig.icon;
  const TipoIcon = Activity;
  const PrioridadIcon = prioridadConfig.icon;

  const handleCambiarEstado = async () => {
    if (!nuevoEstado) {
      toast.error('Selecciona un estado');
      return;
    }

    const resultado = await actualizarEstadoMantenimiento(numeroMantenimiento, nuevoEstado);
    if (resultado.exito) {
      toast.success(`Estado actualizado a "${MANTENIMIENTO_ESTADO_CONFIG[nuevoEstado].label}"`);
    } else {
      toast.error(resultado.errores?.[0] ?? 'Error al actualizar estado');
    }
    setNuevoEstado('');
  };

  return (
    <div className="space-y-6">
      <PageNav onBack={onBack} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Wrench className="size-6 text-black dark:text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{mantenimiento.titulo}</h1>
            <Badge variant={estadoConfig.variant} className={estadoConfig.className}>
              <EstadoIcon className="size-3" />
              {estadoConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {mantenimiento.numeroMantenimiento}
          </p>
        </div>
      </div>

      {/* Badges de clasificación */}
      <div className="flex gap-2">
        <Badge variant="secondary" className={tipoConfig.className}>
          <TipoIcon className="size-3" />
          {tipoConfig.label}
        </Badge>
        <Badge variant={prioridadConfig.variant} className={prioridadConfig.className}>
          <PrioridadIcon className="size-3" />
          Prioridad {prioridadConfig.label}
        </Badge>
      </div>

      {/* Alertas */}
      {mantenimiento.estado === 'en_ejecucion' && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Este mantenimiento está actualmente en ejecución. No olvides registrar las actividades realizadas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información del Equipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Equipo Biomédico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Código</div>
              <div className="font-medium font-mono">{mantenimiento.equipoCodigo}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground">Nombre</div>
              <div className="font-medium">{mantenimiento.equipoNombre}</div>
            </div>
            <Separator />
            <div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onNavigateToEquipo?.(mantenimiento.equipoCodigo)}
              >
                Ver Ficha del Equipo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fechas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              Fechas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Creación</div>
              <div className="font-medium">{mantenimiento.fechaCreacion}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground">Programada</div>
              <div className="font-medium text-primary">{mantenimiento.fechaProgramada}</div>
            </div>
            <Separator />
            {mantenimiento.fechaInicio && (
              <>
                <div>
                  <div className="text-sm text-muted-foreground">Inicio</div>
                  <div className="font-medium">{mantenimiento.fechaInicio}</div>
                </div>
                <Separator />
              </>
            )}
            {mantenimiento.fechaCompletado && (
              <div>
                <div className="text-sm text-muted-foreground">Completado</div>
                <div className="font-medium text-green-600">{mantenimiento.fechaCompletado}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Técnico Responsable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Técnico Responsable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Nombre</div>
              <div className="font-medium">{mantenimiento.tecnico.nombre}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground">Empresa/Departamento</div>
              <div className="font-medium flex items-center gap-2">
                <Building2 className="size-4" />
                {mantenimiento.tecnico.empresa}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cambio de Estado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="size-5" />
              Gestión de Estado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Estado Actual</div>
              <Badge variant={estadoConfig.variant} className={estadoConfig.className}>
                <EstadoIcon className="size-3" />
                {estadoConfig.label}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Cambiar Estado</div>
              <Select value={nuevoEstado} onValueChange={(v) => setNuevoEstado(v as EstadoMantenimientoBio)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nuevo estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MANTENIMIENTO_ESTADO_CONFIG)
                    .filter(([key]) => key !== mantenimiento.estado)
                    .map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={handleCambiarEstado}
              disabled={!nuevoEstado}
            >
              Actualizar Estado
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Descripción */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Descripción del Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{mantenimiento.descripcion}</p>
        </CardContent>
      </Card>

      {/* Actividades Realizadas */}
      {mantenimiento.actividadesRealizadas && (
        <Card>
          <CardHeader>
            <CardTitle>Actividades Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{mantenimiento.actividadesRealizadas}</p>
          </CardContent>
        </Card>
      )}

      {/* Repuestos Utilizados */}
      {mantenimiento.repuestosUtilizados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Repuestos Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {mantenimiento.repuestosUtilizados.map((repuesto, index) => (
                <li key={index} className="text-sm">
                  <span className="font-medium">{repuesto.nombre}</span> - 
                  Cantidad: {repuesto.cantidad}
                  {repuesto.observacion && (
                    <span className="text-muted-foreground"> ({repuesto.observacion})</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Observaciones */}
      {mantenimiento.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{mantenimiento.observaciones}</p>
          </CardContent>
        </Card>
      )}

      {/* Auditoría */}
      <Card>
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Creado por</div>
              <div className="font-medium">{mantenimiento.auditoria.creadoPor}</div>
              <div className="text-xs text-muted-foreground">{mantenimiento.auditoria.creadoEn}</div>
            </div>
            {mantenimiento.auditoria.modificadoPor && (
              <div>
                <div className="text-muted-foreground">Última modificación por</div>
                <div className="font-medium">{mantenimiento.auditoria.modificadoPor}</div>
                <div className="text-xs text-muted-foreground">{mantenimiento.auditoria.modificadoEn}</div>
              </div>
            )}
            {mantenimiento.auditoria.completadoPor && (
              <div>
                <div className="text-muted-foreground">Completado por</div>
                <div className="font-medium">{mantenimiento.auditoria.completadoPor}</div>
                <div className="text-xs text-muted-foreground">{mantenimiento.auditoria.completadoEn}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
