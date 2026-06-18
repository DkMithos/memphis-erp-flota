/**
 * DETALLE DE EQUIPO BIOMÉDICO
 * Vista completa con información, mantenimientos y acciones
 * Production-ready siguiendo patrón enterprise
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Wrench,
  Calendar,
  Shield,
  DollarSign,
  MapPin,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle,
  Download,
  QrCode,
  Stethoscope
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Separator } from '../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Alert, AlertDescription } from '../../ui/alert';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { useMantenimientosStore } from '../../../lib/biomedico/mantenimientos-store';
import {
  EQUIPO_ESTADO_CONFIG,
  EQUIPO_CATEGORIA_CONFIG,
  EQUIPO_RIESGO_CONFIG
} from '../../../lib/biomedico/equipos-config';
import { MANTENIMIENTO_ESTADO_CONFIG, MANTENIMIENTO_TIPO_CONFIG } from '../../../lib/biomedico/mantenimientos-config';
import { EquipoQRSection } from './EquipoQRSection';

interface BiomedicoEquipoDetalleProps {
  codigoEquipo: string;
  onNavigateToEditar?: () => void;
  onNavigateToMantenimiento?: (numeroMantenimiento: string) => void;
  onNavigateToNuevoMantenimiento?: () => void;
  onNavigate?: (route: string) => void;
  onBack?: () => void;
}

export function BiomedicoEquipoDetalle({
  codigoEquipo,
  onNavigateToEditar,
  onNavigateToMantenimiento,
  onNavigateToNuevoMantenimiento,
  onNavigate,
  onBack
}: BiomedicoEquipoDetalleProps) {
  const { obtenerEquipoPorCodigo } = useEquiposStore();
  const { obtenerMantenimientosPorEquipo } = useMantenimientosStore();
  const [tabActual, setTabActual] = useState('general');

  const equipo = obtenerEquipoPorCodigo(codigoEquipo);
  const mantenimientos = equipo ? obtenerMantenimientosPorEquipo(equipo.id) : [];

  if (!equipo) {
    return (
      <div className="space-y-6">
        <PageNav onBack={onBack} />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            No se encontró el equipo con código {codigoEquipo}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const estadoConfig = EQUIPO_ESTADO_CONFIG[equipo.estado];
  const categoriaConfig = EQUIPO_CATEGORIA_CONFIG[equipo.categoria];
  const riesgoConfig = EQUIPO_RIESGO_CONFIG[equipo.riesgo];
  const EstadoIcon = estadoConfig.icon;
  const CategoriaIcon = categoriaConfig.icon;
  const RiesgoIcon = riesgoConfig.icon;

  // Calcular estadísticas de mantenimientos
  const mantStats = {
    total: mantenimientos.length,
    completados: mantenimientos.filter(m => m.estado === 'completado').length,
    programados: mantenimientos.filter(m => m.estado === 'programado').length,
    enEjecucion: mantenimientos.filter(m => m.estado === 'en_ejecucion').length
  };

  return (
    <div className="space-y-6">
      <PageNav onBack={onBack} />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Stethoscope className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{equipo.nombre}</h1>
              <Badge variant={estadoConfig.variant} className={estadoConfig.className}>
                <EstadoIcon className="size-3" />
                {estadoConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {equipo.codigo} • {equipo.marca} {equipo.modelo}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
            <Download className="size-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={onNavigateToEditar}>
            <Edit className="size-4" />
            Editar
          </Button>
          <Button size="sm" onClick={onNavigateToNuevoMantenimiento}>
            <Wrench className="size-4" />
            Crear Mantenimiento
          </Button>
        </div>
      </div>

      {/* Badges de clasificación */}
      <div className="flex gap-2">
        <Badge variant="secondary" className={categoriaConfig.className}>
          <CategoriaIcon className="size-3" />
          {categoriaConfig.label}
        </Badge>
        <Badge variant={riesgoConfig.variant} className={riesgoConfig.className}>
          <RiesgoIcon className="size-3" />
          Riesgo {riesgoConfig.label}
        </Badge>
      </div>

      {/* Alertas */}
      {equipo.estado === 'fuera_servicio' && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Este equipo está fuera de servicio. Requiere intervención técnica inmediata.
          </AlertDescription>
        </Alert>
      )}

      {equipo.estado === 'mantenimiento' && (
        <Alert>
          <Clock className="size-4" />
          <AlertDescription>
            Equipo en mantenimiento programado. Próximo a estar disponible.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={tabActual} onValueChange={setTabActual}>
        <TabsList>
          <TabsTrigger value="general">
            <FileText className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="mantenimientos">
            <Wrench className="size-4" />
            Mantenimientos ({mantStats.total})
          </TabsTrigger>
          <TabsTrigger value="garantia">
            <Shield className="size-4" />
            Garantía
          </TabsTrigger>
          <TabsTrigger value="qr">
            <QrCode className="size-4" />
            QR
          </TabsTrigger>
        </TabsList>

        {/* Tab: General */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información General */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Código</div>
                  <div className="font-medium font-mono">{equipo.codigo}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Nombre</div>
                  <div className="font-medium">{equipo.nombre}</div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Marca</div>
                    <div className="font-medium">{equipo.marca}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Modelo</div>
                    <div className="font-medium">{equipo.modelo}</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Número de Serie</div>
                  <div className="font-medium font-mono">{equipo.serie}</div>
                </div>
              </CardContent>
            </Card>

            {/* Ubicación */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-5" />
                  Ubicación y Asignación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Área</div>
                  <div className="font-medium">{equipo.ubicacion.area}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Subárea</div>
                  <div className="font-medium">{equipo.ubicacion.subarea}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Responsable</div>
                  <div className="font-medium">{equipo.ubicacion.responsable}</div>
                </div>
              </CardContent>
            </Card>

            {/* Especificaciones Técnicas */}
            <Card>
              <CardHeader>
                <CardTitle>Especificaciones Técnicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {equipo.especificaciones.voltaje && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Voltaje</div>
                      <div className="font-medium">{equipo.especificaciones.voltaje}</div>
                    </div>
                    <Separator />
                  </>
                )}
                {equipo.especificaciones.potencia && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Potencia</div>
                      <div className="font-medium">{equipo.especificaciones.potencia}</div>
                    </div>
                    <Separator />
                  </>
                )}
                {equipo.especificaciones.frecuencia && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Frecuencia</div>
                      <div className="font-medium">{equipo.especificaciones.frecuencia}</div>
                    </div>
                    <Separator />
                  </>
                )}
                {equipo.especificaciones.peso && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Peso</div>
                      <div className="font-medium">{equipo.especificaciones.peso}</div>
                    </div>
                    <Separator />
                  </>
                )}
                {equipo.especificaciones.dimensiones && (
                  <div>
                    <div className="text-sm text-muted-foreground">Dimensiones</div>
                    <div className="font-medium">{equipo.especificaciones.dimensiones}</div>
                  </div>
                )}
                {!equipo.especificaciones.voltaje && !equipo.especificaciones.potencia && 
                 !equipo.especificaciones.frecuencia && !equipo.especificaciones.peso && 
                 !equipo.especificaciones.dimensiones && (
                  <div className="text-sm text-muted-foreground">
                    No hay especificaciones técnicas registradas
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fechas Importantes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="size-5" />
                  Fechas Importantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Adquisición</div>
                  <div className="font-medium">{equipo.fechaAdquisicion}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Instalación</div>
                  <div className="font-medium">{equipo.fechaInstalacion}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Último Mantenimiento</div>
                  <div className="font-medium">
                    {equipo.fechaUltimoMantenimiento || 'Sin registro'}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Próximo Mantenimiento</div>
                  <div className="font-medium text-primary">
                    {equipo.fechaProximoMantenimiento}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Costos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5" />
                Información de Costos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground">Adquisición</div>
                  <div className="text-lg font-bold">
                    ${equipo.costos.adquisicion.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Mant. Preventivo Anual</div>
                  <div className="text-lg font-bold">
                    ${equipo.costos.mantenimientoPreventivoAnual.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Mant. Correctivo</div>
                  <div className="text-lg font-bold">
                    ${equipo.costos.mantenimientoCorrectivo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Calibración</div>
                  <div className="text-lg font-bold">
                    ${equipo.costos.calibracion.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observaciones */}
          {equipo.observaciones && (
            <Card>
              <CardHeader>
                <CardTitle>Observaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{equipo.observaciones}</p>
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
                  <div className="font-medium">{equipo.auditoria.creadoPor}</div>
                  <div className="text-xs text-muted-foreground">{equipo.auditoria.creadoEn}</div>
                </div>
                {equipo.auditoria.modificadoPor && (
                  <div>
                    <div className="text-muted-foreground">Última modificación por</div>
                    <div className="font-medium">{equipo.auditoria.modificadoPor}</div>
                    <div className="text-xs text-muted-foreground">{equipo.auditoria.modificadoEn}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Mantenimientos */}
        <TabsContent value="mantenimientos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                  <Wrench className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total Mantenimientos</p>
                  <p className="text-2xl font-bold">{mantStats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                  <CheckCircle className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Completados</p>
                  <p className="text-2xl font-bold">{mantStats.completados}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Programados</p>
                  <p className="text-2xl font-bold">{mantStats.programados}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                  <AlertCircle className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">En Ejecución</p>
                  <p className="text-2xl font-bold">{mantStats.enEjecucion}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Historial de Mantenimientos</CardTitle>
                <Button size="sm" onClick={onNavigateToNuevoMantenimiento}>
                  <Wrench className="size-4" />
                  Nuevo Mantenimiento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mantenimientos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay mantenimientos registrados para este equipo
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Programada</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mantenimientos.map((mant) => {
                      const estadoMantConfig = MANTENIMIENTO_ESTADO_CONFIG[mant.estado];
                      const tipoMantConfig = MANTENIMIENTO_TIPO_CONFIG[mant.tipo];
                      const EstadoMantIcon = estadoMantConfig.icon;

                      return (
                        <TableRow key={mant.id}>
                          <TableCell className="font-mono text-sm">
                            {mant.numeroMantenimiento}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={tipoMantConfig.className}>
                              {tipoMantConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={estadoMantConfig.variant} className={estadoMantConfig.className}>
                              <EstadoMantIcon className="size-3" />
                              {estadoMantConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{mant.fechaProgramada}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{mant.tecnico.nombre}</span>
                              <span className="text-xs text-muted-foreground">{mant.tecnico.empresa}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => onNavigateToMantenimiento?.(mant.numeroMantenimiento)}
                            >
                              Ver Detalle
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
        </TabsContent>

        {/* Tab: Garantía */}
        <TabsContent value="garantia" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Información de Garantía
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Estado</div>
                <div className="flex items-center gap-2">
                  {equipo.garantia.vigente ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="size-3" />
                      Vigente
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                      <AlertCircle className="size-3" />
                      Vencida
                    </Badge>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Proveedor</div>
                <div className="font-medium">{equipo.garantia.proveedor}</div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Fecha de Inicio</div>
                  <div className="font-medium">{equipo.garantia.fechaInicio}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Fecha de Vencimiento</div>
                  <div className="font-medium">{equipo.garantia.fechaVencimiento}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: QR */}
        <TabsContent value="qr" className="space-y-6">
          {onNavigate ? (
            <EquipoQRSection
              codigoEquipo={codigoEquipo}
              onNavigate={onNavigate}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  La funcionalidad QR no está disponible en este contexto.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
