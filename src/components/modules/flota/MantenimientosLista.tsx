/**
 * LISTA DE MANTENIMIENTOS - FLOTA
 * Pantalla principal para gestionar órdenes de trabajo
 * /flota/mantenimientos
 */

import { useEffect, useState } from 'react';
import { 
  Wrench,
  Plus,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Eye,
  CheckCircle,
  AlertTriangle,
  Package,
  Calendar,
  Building2,
  ShieldAlert,
  RotateCcw,
  TrendingUp,
  X,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  OT_ESTADO_CONFIG,
  OT_TIPO_CONFIG,
  OT_CRITICIDAD_CONFIG,
  DEBUG_OT,
  type EstadoOT,
  type TipoOT,
  type CriticidadOT
} from '../../../lib/flota/ot-config';
import { useOTStore, type OrdenTrabajo } from '../../../lib/flota/ot-store';
import { usePagination } from '../../../lib/shared/usePagination';

interface MantenimientosListaProps {
  onNavigateToDetalle: (numeroOT: string) => void;
  onNavigateToNueva: (tipo: TipoOT) => void;
}

export function MantenimientosLista({ 
  onNavigateToDetalle,
  onNavigateToNueva
}: MantenimientosListaProps) {
  
  const { ordenes, cargarOTsIniciales } = useOTStore();
  
  const [tabActual, setTabActual] = useState<'activas' | 'cerradas' | 'anuladas' | 'todas'>('activas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroCriticidad, setFiltroCriticidad] = useState<string>('todas');
  
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
  
  // Filtrar órdenes según tab y filtros
  const ordenesFiltradasPorTab = ordenes.filter(ot => {
    if (tabActual === 'activas') return !['cerrada', 'anulada'].includes(ot.estado);
    if (tabActual === 'cerradas') return ot.estado === 'cerrada';
    if (tabActual === 'anuladas') return ot.estado === 'anulada';
    return true;
  });

  const ordenesFiltradas = ordenesFiltradasPorTab.filter(ot => {
    // Búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      const matchSearch = 
        ot.numeroOT.toLowerCase().includes(searchLower) ||
        ot.titulo.toLowerCase().includes(searchLower) ||
        ot.descripcion.toLowerCase().includes(searchLower) ||
        ot.vehiculoPlaca.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;
    }

    // Filtro tipo
    if (filtroTipo !== 'todos' && ot.tipo !== filtroTipo) return false;

    // Filtro criticidad
    if (filtroCriticidad !== 'todas' && ot.criticidad !== filtroCriticidad) return false;

    return true;
  });
  
  const { paged: ordenesPaged, page, totalPages, setPage } = usePagination(ordenesFiltradas);

  const filtrarPorAprobacion = () => {
    setTabActual('activas');
    // Aquí podrías agregar un filtro adicional si lo necesitas
  };
  
  const getEstadoBadge = (estado: EstadoOT) => {
    const config = OT_ESTADO_CONFIG[estado];
    if (!config) {
      return <Badge variant="outline">Desconocido</Badge>;
    }
    
    const { variant, icon: Icon, label, className } = config;
    return (
      <Badge variant={variant} className={className}>
        <Icon className="size-3" />
        {label}
      </Badge>
    );
  };
  
  const getTipoBadge = (tipo: TipoOT) => {
    const config = OT_TIPO_CONFIG[tipo];
    const { label, className } = config;
    return <Badge className={className}>{label}</Badge>;
  };
  
  const getCriticidadBadge = (criticidad: CriticidadOT) => {
    const config = OT_CRITICIDAD_CONFIG[criticidad];
    const { label, variant, className } = config;
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

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo('todos');
    setFiltroCriticidad('todas');
  };
  
  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header con acciones */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
              <Wrench className="size-6 text-black dark:text-primary" />
            </div>
            <div>
              <h2>Órdenes de Trabajo</h2>
              <p className="text-muted-foreground mt-1">
                Gestión completa de mantenimientos preventivos, correctivos y predictivos
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* CTA Nueva OT con dropdown por tipo */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Nueva Orden de Trabajo
                <ChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNavigateToNueva('preventivo')}>
                <RotateCcw className="size-4" />
                Mantenimiento Preventivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigateToNueva('correctivo')}>
                <Wrench className="size-4" />
                Mantenimiento Correctivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigateToNueva('predictivo')}>
                <TrendingUp className="size-4" />
                Mantenimiento Predictivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Exportación */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                <Download className="size-4" />
                Exportar
                <ChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileSpreadsheet className="size-4" />
                Exportar a Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="size-4" />
                Exportar a PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* KPIs Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Wrench className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total OTs</p>
              <p className="text-2xl font-bold">{ordenes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Programadas</p>
              <p className="text-2xl font-bold">{ordenes.filter(ot => ot.estado === 'programada').length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
              <RotateCcw className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">En Ejecución</p>
              <p className="text-2xl font-bold">{ordenes.filter(ot => ot.estado === 'en_ejecucion').length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
              <Package className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Espera Repuesto</p>
              <p className="text-2xl font-bold">{ordenes.filter(ot => ot.estado === 'espera_repuesto').length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Cerradas</p>
              <p className="text-2xl font-bold">{ordenes.filter(ot => ot.estado === 'cerrada').length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Costo Total</p>
              <p className="text-xl font-bold">${ordenes.reduce((total, ot) => total + ot.costos.total, 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Alertas de OTs que requieren aprobación */}
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
              <ShieldAlert className="size-4" />
              Ver OTs en aprobación
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground mb-2 block">Buscar OT</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por número, título, placa..." 
                  className="pl-10"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Tipo</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
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
              <Select value={filtroCriticidad} onValueChange={setFiltroCriticidad}>
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
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                <X className="size-4" />
                Limpiar Filtros
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Mostrando {ordenesFiltradas.length} de {ordenesFiltradasPorTab.length} OTs
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs por estado */}
      <Tabs value={tabActual} onValueChange={(v) => setTabActual(v as any)}>
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
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay órdenes de trabajo activas que coincidan con los filtros
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OT</TableHead>
                      <TableHead>Placa</TableHead>
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
                    {ordenesPaged.map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell className="font-medium">{ot.vehiculoPlaca}</TableCell>
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
                              MO: ${ot.costos.manoObra}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onNavigateToDetalle(ot.numeroOT)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay órdenes de trabajo cerradas que coincidan con los filtros
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OT</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Taller</TableHead>
                      <TableHead>Fecha Cierre</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesPaged.map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell className="font-medium">{ot.vehiculoPlaca}</TableCell>
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onNavigateToDetalle(ot.numeroOT)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="anuladas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Trabajo Anuladas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Registro de OTs canceladas (no eliminadas)
              </p>
            </CardHeader>
            <CardContent>
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay órdenes de trabajo anuladas que coincidan con los filtros
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OT</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo de Anulación</TableHead>
                      <TableHead>Fecha Anulación</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesPaged.map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell className="font-medium">{ot.vehiculoPlaca}</TableCell>
                        <TableCell>
                          <p className="font-medium">{ot.titulo}</p>
                        </TableCell>
                        <TableCell>{getTipoBadge(ot.tipo)}</TableCell>
                        <TableCell>
                          <p className="text-sm">{ot.notasCierre || ot.observaciones}</p>
                        </TableCell>
                        <TableCell>
                          {ot.auditoria.cerradoEn && new Date(ot.auditoria.cerradoEn).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onNavigateToDetalle(ot.numeroOT)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="todas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Todas las Órdenes de Trabajo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historial completo de mantenimientos
              </p>
            </CardHeader>
            <CardContent>
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay órdenes de trabajo que coincidan con los filtros
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OT</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Criticidad</TableHead>
                      <TableHead>Fecha Creación</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesPaged.map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.numeroOT}</TableCell>
                        <TableCell className="font-medium">{ot.vehiculoPlaca}</TableCell>
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onNavigateToDetalle(ot.numeroOT)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3 border rounded-lg bg-card">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages} · {ordenesFiltradas.length} registros
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
