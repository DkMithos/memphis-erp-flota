import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, FileText, ShoppingBag } from 'lucide-react';
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
import { useOrdenesStore } from '../../../lib/compras/ordenes-store';
import { usePagination } from '../../../lib/shared/usePagination';
import { 
  ORDEN_ESTADO_CONFIG, 
  ORDEN_TIPO_LABELS,
  ORDEN_MONEDA_LABELS,
  tienePermiso,
  formatearMonto,
  formatearFecha,
  type EstadoOrden,
  type TipoOrden,
  type MonedaOrden
} from '../../../lib/compras/ordenes-config';

interface OrdenesListaProps {
  onNavigate?: (route: string) => void;
}

export function OrdenesLista({ onNavigate }: OrdenesListaProps) {
  const { ordenes, usuarioActual } = useOrdenesStore();
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoOrden | 'todos'>('todos');
  const [filtroMoneda, setFiltroMoneda] = useState<MonedaOrden | 'todos'>('todos');
  const [tabActual, setTabActual] = useState<'activas' | 'completas' | 'anuladas' | 'todas'>('activas');

  // Órdenes filtradas por tab
  const ordenesPorTab = useMemo(() => {
    if (tabActual === 'activas') {
      return ordenes.filter(o => 
        o.estado === 'borrador' || 
        o.estado === 'pendiente_aprobacion' || 
        o.estado === 'aprobada' || 
        o.estado === 'en_ejecucion' || 
        o.estado === 'recepcion_parcial'
      );
    } else if (tabActual === 'completas') {
      return ordenes.filter(o => o.estado === 'recepcion_completa');
    } else if (tabActual === 'anuladas') {
      return ordenes.filter(o => o.estado === 'anulada');
    }
    return ordenes;
  }, [ordenes, tabActual]);

  // Órdenes filtradas
  const ordenesFiltradas = useMemo(() => {
    return ordenesPorTab.filter(o => {
      // Búsqueda por texto
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        o.id.toLowerCase().includes(searchLower) ||
        o.proveedorNombre.toLowerCase().includes(searchLower) ||
        o.cotizacionId.toLowerCase().includes(searchLower);

      // Filtro por estado
      const matchEstado = filtroEstado === 'todos' || o.estado === filtroEstado;

      // Filtro por tipo
      const matchTipo = filtroTipo === 'todos' || o.tipo === filtroTipo;

      // Filtro por moneda
      const matchMoneda = filtroMoneda === 'todos' || o.moneda === filtroMoneda;

      return matchSearch && matchEstado && matchTipo && matchMoneda;
    });
  }, [ordenesPorTab, searchTerm, filtroEstado, filtroTipo, filtroMoneda]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: ordenes.length,
    borradores: ordenes.filter(o => o.estado === 'borrador').length,
    pendientes: ordenes.filter(o => o.estado === 'pendiente_aprobacion').length,
    aprobadas: ordenes.filter(o => o.estado === 'aprobada').length,
    enEjecucion: ordenes.filter(o => o.estado === 'en_ejecucion').length,
    completas: ordenes.filter(o => o.estado === 'recepcion_completa').length,
    anuladas: ordenes.filter(o => o.estado === 'anulada').length,
    // Total en PEN de órdenes aprobadas
    totalAprobadoPEN: ordenes
      .filter(o => (o.estado === 'aprobada' || o.estado === 'en_ejecucion') && o.moneda === 'PEN')
      .reduce((sum, o) => sum + o.total, 0)
  }), [ordenes]);

  const puedeCrear = tienePermiso(usuarioActual.rol, 'crear');

  const { paged: ordenesPaged, page, totalPages, setPage } = usePagination(ordenesFiltradas);
  // Reset page on filter change
  useEffect(() => { setPage(1); }, [tabActual, searchTerm, filtroEstado, filtroTipo, filtroMoneda]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <ShoppingBag className="size-6 text-primary" />
          </div>
          <div>
            <h2>Órdenes de Compra y Servicio</h2>
            <p className="text-muted-foreground mt-1">
              Gestión de OC y OS a proveedores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline">
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
          {puedeCrear && (
            <Button onClick={() => onNavigate?.('/compras/ordenes/nuevo')}>
              <Plus className="size-4 mr-2" />
              Nueva Orden
            </Button>
          )}
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Órdenes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-yellow-600">{stats.pendientes}</div>
            <p className="text-xs text-muted-foreground mt-1">Por aprobar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">En Ejecución</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-600">{stats.aprobadas + stats.enEjecucion}</div>
            <p className="text-xs text-muted-foreground mt-1">Activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total en Proceso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {stats.totalAprobadoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">En soles</p>
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
                  placeholder="Buscar por ID, proveedor o cotización..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtro por Estado */}
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoOrden | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="en_ejecucion">En Ejecución</SelectItem>
                <SelectItem value="recepcion_parcial">Recepción Parcial</SelectItem>
                <SelectItem value="recepcion_completa">Recepción Completa</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Tipo */}
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoOrden | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Tipos</SelectItem>
                <SelectItem value="oc">Orden de Compra (OC)</SelectItem>
                <SelectItem value="os">Orden de Servicio (OS)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resumen de filtros activos */}
          {(searchTerm || filtroEstado !== 'todos' || filtroTipo !== 'todos' || filtroMoneda !== 'todos') && (
            <Alert className="mt-4">
              <AlertDescription>
                Mostrando <strong>{ordenesFiltradas.length}</strong> de <strong>{ordenesPorTab.length}</strong> órdenes
                {searchTerm && ` • Búsqueda: "${searchTerm}"`}
                {filtroEstado !== 'todos' && ` • Estado: ${filtroEstado}`}
                {filtroTipo !== 'todos' && ` • Tipo: ${filtroTipo === 'oc' ? 'OC' : 'OS'}`}
                {filtroMoneda !== 'todos' && ` • Moneda: ${ORDEN_MONEDA_LABELS[filtroMoneda]}`}
                <Button 
                  variant="link" 
                  size="sm" 
                  className="ml-2 h-auto p-0"
                  onClick={() => {
                    setSearchTerm('');
                    setFiltroEstado('todos');
                    setFiltroTipo('todos');
                    setFiltroMoneda('todos');
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
          <Tabs value={tabActual} onValueChange={(v) => setTabActual(v as typeof tabActual)}>
            <div className="border-b px-6 pt-6">
              <TabsList>
                <TabsTrigger value="activas">
                  Activas ({stats.borradores + stats.pendientes + stats.aprobadas + stats.enEjecucion})
                </TabsTrigger>
                <TabsTrigger value="completas">
                  Completas ({stats.completas})
                </TabsTrigger>
                <TabsTrigger value="anuladas">
                  Anuladas ({stats.anuladas})
                </TabsTrigger>
                <TabsTrigger value="todas">
                  Todas ({stats.total})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={tabActual} className="m-0">
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag className="size-16 mx-auto mb-4 opacity-20" />
                  <h3 className="font-medium text-foreground mb-2">No se encontraron órdenes</h3>
                  <p className="text-sm">
                    {searchTerm || filtroEstado !== 'todos' || filtroTipo !== 'todos' || filtroMoneda !== 'todos'
                      ? 'Intenta ajustar los filtros de búsqueda'
                      : 'Las órdenes se generan desde cotizaciones aprobadas'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Cotización</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesPaged.map((orden) => {
                      const estadoConfig = ORDEN_ESTADO_CONFIG[orden.estado];
                      const puedeEditar = tienePermiso(usuarioActual.rol, 'editar');

                      return (
                        <TableRow 
                          key={orden.id} 
                          className="cursor-pointer hover:bg-muted/50" 
                          onClick={() => onNavigate?.(`/compras/ordenes/${orden.id}`)}
                        >
                          <TableCell className="font-mono text-sm font-medium">{orden.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{orden.tipo === 'oc' ? 'OC' : 'OS'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{orden.proveedorNombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {orden.items.length} {orden.items.length === 1 ? 'item' : 'items'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{orden.cotizacionId}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={estadoConfig.className}>
                              <estadoConfig.icon className="size-3 mr-1" />
                              {estadoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatearMonto(orden.total, orden.moneda)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onNavigate?.(`/compras/ordenes/${orden.id}`)}
                              >
                                <Eye className="size-4" />
                              </Button>
                              {puedeEditar && orden.estado === 'borrador' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => onNavigate?.(`/compras/ordenes/${orden.id}/editar`)}
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
