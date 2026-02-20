import { useEffect, useState } from 'react';
import { 
  ArrowLeft,
  Wrench,
  Plus,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Package,
  DollarSign,
  Calendar,
  User,
  Building2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ShieldAlert,
  FileCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  OT_ESTADO_CONFIG,
  OT_TIPO_CONFIG,
  OT_CRITICIDAD_CONFIG,
  isActiveOT,
  DEBUG_OT,
  type EstadoOT,
  type TipoOT,
  type CriticidadOT
} from '../../lib/flota/ot-config';
import { useOTStore, type OrdenTrabajo } from '../../lib/flota/ot-store';

interface MantenimientosVehiculoProps {
  vehiculoPlaca?: string;
  vehiculoId?: string;
  modoVista?: 'vehiculo' | 'general';
  onNavigateToOT?: (otId: string) => void;
  onNavigateToNuevaOT?: (tipo: string) => void;
}

export function MantenimientosVehiculo({ 
  vehiculoPlaca = 'ABC-123', 
  vehiculoId = 'VH-001',
  modoVista = 'vehiculo',
  onNavigateToOT,
  onNavigateToNuevaOT
}: MantenimientosVehiculoProps) {
  
  const { ordenes, cargarOTsIniciales } = useOTStore();
  
  const [filtroEstado, setFiltroEstado] = useState<EstadoOT | 'todos'>('todos');
  
  useEffect(() => {
    cargarOTsIniciales();
  }, [cargarOTsIniciales]);
  
  useEffect(() => {
    if (DEBUG_OT) {
      console.log('[OT_LIST_RENDER]', {
        totalOTs: ordenes.length,
        firstNumeroOT: ordenes[0]?.numeroOT || 'N/A',
        estados: ordenes.map(ot => ({ numero: ot.numeroOT, estado: ot.estado }))
      });
    }
  }, [ordenes]);
  
  const filtrarPorAprobacion = () => {
    setFiltroEstado('espera_aprobacion');
  };
  
  const getEstadoBadge = (estado: EstadoOT) => {
    const config = OT_ESTADO_CONFIG;
    
    // Fallback para estados desconocidos
    if (!config[estado]) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <AlertTriangle className="size-3 mr-1" />
          Estado desconocido
        </Badge>
      );
    }
    
    const { variant, icon: Icon, label, className } = config[estado];
    return (
      <Badge variant={variant} className={className}>
        <Icon className="size-3 mr-1" />
        {label}
      </Badge>
    );
  };
  
  const getTipoBadge = (tipo: TipoOT) => {
    const config = OT_TIPO_CONFIG;
    const { label, className } = config[tipo];
    return <Badge className={className}>{label}</Badge>;
  };
  
  const getCriticidadBadge = (criticidad: CriticidadOT) => {
    const config = OT_CRITICIDAD_CONFIG;
    const { label, variant, className } = config[criticidad];
    return <Badge variant={variant} className={className}>{label}</Badge>;
  };
  
  const getSLAStatus = (ot: OrdenTrabajo) => {
    if (ot.estado === 'cerrada' && ot.slaReal !== null) {
      const cumplido = ot.slaReal <= ot.slaEstimado;
      return cumplido ? (
        <div className="flex items-center gap-1 text-green-600 text-sm">
          <CheckCircle className="size-3" />
          <span>{ot.slaReal}h / {ot.slaEstimado}h</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <AlertTriangle className="size-3" />
          <span>{ot.slaReal}h / {ot.slaEstimado}h</span>
        </div>
      );
    }
    
    return <span className="text-sm text-muted-foreground">{ot.slaEstimado}h estimado</span>;
  };
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb y navegación */}
      {modoVista === 'vehiculo' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Volver a Ficha del Vehículo
          </Button>
          <span>/</span>
          <span>Flota</span>
          <span>/</span>
          <span>{vehiculoPlaca}</span>
          <span>/</span>
          <span className="text-foreground font-medium">Órdenes de Trabajo</span>
        </div>
      )}
      
      {/* Header con KPIs y acciones */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Wrench className="size-6 text-primary" />
            </div>
            <div>
              <h2>Órdenes de Trabajo - {vehiculoPlaca}</h2>
              <p className="text-muted-foreground mt-1">
                Gestión completa de mantenimientos preventivos y correctivos
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* CU-FLOTA-04 - Registrar mantenimiento correctivo */}
          {/* CU-FLOTA-03 - Generar mantenimiento preventivo */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                Nueva Orden de Trabajo
                <ChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNavigateToNuevaOT?.('preventivo')}>
                <RotateCcw className="size-4 mr-2" />
                Mantenimiento Preventivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigateToNuevaOT?.('correctivo')}>
                <Wrench className="size-4 mr-2" />
                Mantenimiento Correctivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigateToNuevaOT?.('predictivo')}>
                <TrendingUp className="size-4 mr-2" />
                Mantenimiento Predictivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Exportación */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="size-4 mr-2" />
                Exportar
                <ChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileSpreadsheet className="size-4 mr-2" />
                Exportar a Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="size-4 mr-2" />
                Exportar a PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* KPIs Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total OTs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{ordenes.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Programadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-600">
              {ordenes.filter(ot => ot.estado === 'programada').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">En Ejecución</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">
              {ordenes.filter(ot => ot.estado === 'en_ejecucion').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Espera Repuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-yellow-600">
              {ordenes.filter(ot => ot.estado === 'espera_repuesto').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Cerradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {ordenes.filter(ot => ot.estado === 'cerrada').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Costo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              ${ordenes.reduce((total, ot) => total + ot.costos.total, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Alertas de OTs críticas */}
      {ordenes.filter(ot => ot.estado === 'espera_aprobacion').length > 0 && (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>Atención requerida:</strong> {ordenes.filter(ot => ot.estado === 'espera_aprobacion').length} OT(s) en espera de aprobación gerencial.
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={filtrarPorAprobacion}
              className="ml-4"
            >
              <ShieldAlert className="size-4 mr-2" />
              Ver OTs en aprobación
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Filtros avanzados */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground mb-2 block">Buscar OT</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por número, título o descripción..." 
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Estado</label>
              <Select defaultValue="todos">
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="programada">Programada</SelectItem>
                  <SelectItem value="en_ejecucion">En Ejecución</SelectItem>
                  <SelectItem value="espera_repuesto">Espera Repuesto</SelectItem>
                  <SelectItem value="espera_aprobacion">Espera Aprobación</SelectItem>
                  <SelectItem value="cerrada">Cerrada</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Tipo</label>
              <Select defaultValue="todos">
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="preventivo">Preventivo</SelectItem>
                  <SelectItem value="correctivo">Correctivo</SelectItem>
                  <SelectItem value="predictivo">Predictivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Criticidad</label>
              <Select defaultValue="todas">
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Taller</label>
              <Select defaultValue="todos">
                <SelectTrigger>
                  <SelectValue placeholder="Todos los talleres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los talleres</SelectItem>
                  <SelectItem value="interno">Taller Interno</SelectItem>
                  <SelectItem value="externo">Talleres Externos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                <Filter className="size-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button variant="ghost" size="sm">
                Limpiar Filtros
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Mostrando {ordenes.length} de {ordenes.length} OTs
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs por estado */}
      <Tabs defaultValue="activas" className="w-full">
        <TabsList>
          <TabsTrigger value="activas">
            Activas ({ordenes.filter(ot => !['cerrada', 'anulada'].includes(ot.estado)).length})
          </TabsTrigger>
          <TabsTrigger value="cerradas">
            Cerradas ({ordenes.filter(ot => ot.estado === 'cerrada').length})
          </TabsTrigger>
          <TabsTrigger value="anuladas">
            Anuladas ({ordenes.filter(ot => ot.estado === 'anulada').length})
          </TabsTrigger>
          <TabsTrigger value="todas">
            Todas ({ordenes.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="activas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Trabajo Activas</CardTitle>
              <p className="text-sm text-muted-foreground">
                OTs en proceso o pendientes de ejecución
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OT</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Criticidad</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Fecha Prog.</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes
                    .filter(ot => !['cerrada', 'anulada'].includes(ot.estado))
                    .map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ot.titulo}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {ot.descripcion}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getTipoBadge(ot.tipo)}</TableCell>
                        <TableCell>{getEstadoBadge(ot.estado)}</TableCell>
                        <TableCell>{getCriticidadBadge(ot.criticidad)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{ot.taller.nombre}</p>
                              <Badge variant="outline" className="text-xs">
                                {ot.taller.tipo === 'interno' ? 'Interno' : 'Externo'}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="size-3 text-muted-foreground" />
                            {new Date(ot.fechaProgramada).toLocaleDateString('es-ES')}
                          </div>
                        </TableCell>
                        <TableCell>{getSLAStatus(ot)}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-semibold">${ot.costos.total.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              MO: ${ot.costos.manoObra} | Rep: ${ot.costos.repuestos}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => onNavigateToOT?.(ot.numeroOT)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="cerradas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Trabajo Cerradas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historial de mantenimientos completados
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OT</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Fecha Cierre</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Cerrado Por</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes
                    .filter(ot => ot.estado === 'cerrada')
                    .map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ot.titulo}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {ot.descripcion}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getTipoBadge(ot.tipo)}</TableCell>
                        <TableCell>
                          <p className="text-sm">{ot.taller.nombre}</p>
                        </TableCell>
                        <TableCell>
                          {ot.fechaCierre && new Date(ot.fechaCierre).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>{getSLAStatus(ot)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${ot.costos.total.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <User className="size-3 text-muted-foreground" />
                            {ot.auditoria.cerradoPor?.split('@')[0]}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => onNavigateToOT?.(ot.id)}>
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="anuladas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Trabajo Anuladas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Registro de OTs canceladas o rechazadas (no eliminadas)
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OT</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo de Anulación</TableHead>
                    <TableHead>Anulado Por</TableHead>
                    <TableHead>Fecha Anulación</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes
                    .filter(ot => ot.estado === 'anulada')
                    .map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell>
                          <p className="font-medium">{ot.titulo}</p>
                        </TableCell>
                        <TableCell>{getTipoBadge(ot.tipo)}</TableCell>
                        <TableCell>
                          <p className="text-sm">{ot.notasCierre || ot.observaciones}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <User className="size-3 text-muted-foreground" />
                            {ot.auditoria.cerradoPor?.split('@')[0]}
                          </div>
                        </TableCell>
                        <TableCell>
                          {ot.auditoria.cerradoEn && new Date(ot.auditoria.cerradoEn).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => onNavigateToOT?.(ot.numeroOT)}>
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="todas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Todas las Órdenes de Trabajo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historial completo de mantenimientos del vehículo
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OT</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Criticidad</TableHead>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Creado Por</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((ot) => (
                    <TableRow key={ot.id}>
                      <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                      <TableCell>
                        <p className="font-medium">{ot.titulo}</p>
                      </TableCell>
                      <TableCell>{getTipoBadge(ot.tipo)}</TableCell>
                      <TableCell>{getEstadoBadge(ot.estado)}</TableCell>
                      <TableCell>{getCriticidadBadge(ot.criticidad)}</TableCell>
                      <TableCell>
                        {new Date(ot.fechaCreacion).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${ot.costos.total.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <User className="size-3 text-muted-foreground" />
                          {ot.auditoria.creadoPor.split('@')[0]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => onNavigateToOT?.(ot.numeroOT)}>
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Footer con auditoría - RNF-FLOTA-030 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileCheck className="size-4" />
              <span>
                <strong>Política de Auditoría:</strong> Las OTs no se eliminan. Solo se anulan con registro de usuario y motivo.
              </span>
            </div>
            <div>
              <strong>Sesión:</strong> admin@kesa.com | {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}