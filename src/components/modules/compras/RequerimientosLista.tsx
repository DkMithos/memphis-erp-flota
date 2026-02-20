import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Alert, AlertDescription } from '../../ui/alert';
import { useRequerimientosStore } from '../../../lib/compras/requerimientos-store';
import { 
  REQUERIMIENTO_ESTADO_CONFIG, 
  REQUERIMIENTO_PRIORIDAD_CONFIG,
  CENTRO_COSTO_LABELS,
  tienePermiso,
  formatearMonto,
  formatearFecha,
  type EstadoRequerimiento,
  type PrioridadRequerimiento,
  type CentroCosto
} from '../../../lib/compras/requerimientos-config';

interface RequerimientosListaProps {
  onNavigate?: (route: string) => void;
}

export function RequerimientosLista({ onNavigate }: RequerimientosListaProps) {
  const { requerimientos, usuarioActual } = useRequerimientosStore();
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoRequerimiento | 'todos'>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadRequerimiento | 'todos'>('todos');
  const [filtroCentroCosto, setFiltroCentroCosto] = useState<CentroCosto | 'todos'>('todos');
  const [tabActual, setTabActual] = useState<'activos' | 'anulados' | 'todos'>('activos');

  // Requerimientos filtrados por tab
  const requerimientosPorTab = useMemo(() => {
    if (tabActual === 'activos') {
      return requerimientos.filter(r => r.estado !== 'anulado');
    } else if (tabActual === 'anulados') {
      return requerimientos.filter(r => r.estado === 'anulado');
    }
    return requerimientos;
  }, [requerimientos, tabActual]);

  // Requerimientos filtrados
  const requerimientosFiltrados = useMemo(() => {
    return requerimientosPorTab.filter(r => {
      // Búsqueda por texto
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        r.titulo.toLowerCase().includes(searchLower) ||
        r.id.toLowerCase().includes(searchLower) ||
        r.solicitanteNombre.toLowerCase().includes(searchLower) ||
        r.solicitanteEmail.toLowerCase().includes(searchLower);

      // Filtro por estado
      const matchEstado = filtroEstado === 'todos' || r.estado === filtroEstado;

      // Filtro por prioridad
      const matchPrioridad = filtroPrioridad === 'todos' || r.prioridad === filtroPrioridad;

      // Filtro por centro de costo
      const matchCentroCosto = filtroCentroCosto === 'todos' || r.centroCosto === filtroCentroCosto;

      return matchSearch && matchEstado && matchPrioridad && matchCentroCosto;
    });
  }, [requerimientosPorTab, searchTerm, filtroEstado, filtroPrioridad, filtroCentroCosto]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: requerimientos.length,
    borradores: requerimientos.filter(r => r.estado === 'borrador').length,
    enviados: requerimientos.filter(r => r.estado === 'enviado').length,
    aprobados: requerimientos.filter(r => r.estado === 'aprobado').length,
    rechazados: requerimientos.filter(r => r.estado === 'rechazado').length,
    anulados: requerimientos.filter(r => r.estado === 'anulado').length,
    totalEstimado: requerimientos
      .filter(r => r.estado !== 'anulado' && r.estado !== 'rechazado')
      .reduce((sum, r) => sum + r.totalEstimado, 0)
  }), [requerimientos]);

  const puedeCrear = tienePermiso(usuarioActual.rol, 'crear');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <ShoppingCart className="size-6 text-primary" />
          </div>
          <div>
            <h2>Requerimientos de Compra</h2>
            <p className="text-muted-foreground mt-1">
              Gestión de solicitudes de compra y aprobaciones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeCrear && (
            <Button onClick={() => onNavigate?.('/compras/requerimientos/nuevo')}>
              <Plus className="size-4 mr-2" />
              Nuevo Requerimiento
            </Button>
          )}
          <Button variant="outline">
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Requerimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-600">{stats.enviados}</div>
            <p className="text-xs text-muted-foreground mt-1">Por aprobar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Aprobados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{stats.aprobados}</div>
            <p className="text-xs text-muted-foreground mt-1">Listos para OC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatearMonto(stats.totalEstimado)}</div>
            <p className="text-xs text-muted-foreground mt-1">Activos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Búsqueda por texto */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, título o solicitante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtro por Estado */}
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoRequerimiento | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="aprobado">Aprobado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="anulado">Anulado</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Prioridad */}
            <Select value={filtroPrioridad} onValueChange={(v) => setFiltroPrioridad(v as PrioridadRequerimiento | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las Prioridades</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Centro de Costo */}
          <div className="mt-4">
            <Select value={filtroCentroCosto} onValueChange={(v) => setFiltroCentroCosto(v as CentroCosto | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Centro de Costo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Centros</SelectItem>
                {Object.entries(CENTRO_COSTO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resumen de filtros activos */}
          {(searchTerm || filtroEstado !== 'todos' || filtroPrioridad !== 'todos' || filtroCentroCosto !== 'todos') && (
            <Alert className="mt-4">
              <AlertDescription>
                Mostrando <strong>{requerimientosFiltrados.length}</strong> de <strong>{requerimientosPorTab.length}</strong> requerimientos
                {searchTerm && ` • Búsqueda: "${searchTerm}"`}
                {filtroEstado !== 'todos' && ` • Estado: ${filtroEstado}`}
                {filtroPrioridad !== 'todos' && ` • Prioridad: ${filtroPrioridad}`}
                {filtroCentroCosto !== 'todos' && ` • Centro: ${CENTRO_COSTO_LABELS[filtroCentroCosto]}`}
                <Button 
                  variant="link" 
                  size="sm" 
                  className="ml-2 h-auto p-0"
                  onClick={() => {
                    setSearchTerm('');
                    setFiltroEstado('todos');
                    setFiltroPrioridad('todos');
                    setFiltroCentroCosto('todos');
                  }}
                >
                  Limpiar filtros
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabs por Estado */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={tabActual} onValueChange={(v) => setTabActual(v as 'activos' | 'anulados' | 'todos')}>
            <div className="border-b px-6 pt-6">
              <TabsList>
                <TabsTrigger value="activos">
                  Activos ({stats.total - stats.anulados})
                </TabsTrigger>
                <TabsTrigger value="anulados">
                  Anulados ({stats.anulados})
                </TabsTrigger>
                <TabsTrigger value="todos">
                  Todos ({stats.total})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={tabActual} className="m-0">
              {requerimientosFiltrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="size-16 mx-auto mb-4 opacity-20" />
                  <h3 className="font-medium text-foreground mb-2">No se encontraron requerimientos</h3>
                  <p className="text-sm">
                    {searchTerm || filtroEstado !== 'todos' || filtroPrioridad !== 'todos' || filtroCentroCosto !== 'todos'
                      ? 'Intenta ajustar los filtros de búsqueda'
                      : puedeCrear 
                        ? 'Comienza creando el primer requerimiento'
                        : 'No hay requerimientos registrados'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requerimientosFiltrados.map((req) => {
                      const estadoConfig = REQUERIMIENTO_ESTADO_CONFIG[req.estado];
                      const prioridadConfig = REQUERIMIENTO_PRIORIDAD_CONFIG[req.prioridad];
                      const puedeEditar = tienePermiso(usuarioActual.rol, 'editar');

                      return (
                        <TableRow 
                          key={req.id} 
                          className="cursor-pointer hover:bg-muted/50" 
                          onClick={() => onNavigate?.(`/compras/requerimientos/${req.id}`)}
                        >
                          <TableCell className="font-mono text-sm">{req.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.titulo}</p>
                              <p className="text-xs text-muted-foreground">
                                {req.items.length} {req.items.length === 1 ? 'item' : 'items'}
                                {req.fechaRequerida && ` • Req: ${formatearFecha(req.fechaRequerida)}`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{CENTRO_COSTO_LABELS[req.centroCosto]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={prioridadConfig.className}>
                              <prioridadConfig.icon className="size-3 mr-1" />
                              {prioridadConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={estadoConfig.className}>
                              <estadoConfig.icon className="size-3 mr-1" />
                              {estadoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{req.solicitanteNombre}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{req.solicitanteEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatearMonto(req.totalEstimado)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onNavigate?.(`/compras/requerimientos/${req.id}`)}
                              >
                                <Eye className="size-4" />
                              </Button>
                              {puedeEditar && (req.estado === 'borrador' || req.estado === 'rechazado') && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => onNavigate?.(`/compras/requerimientos/${req.id}/editar`)}
                                >
                                  <Edit className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
