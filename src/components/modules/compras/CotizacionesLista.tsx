import { useState, useMemo } from 'react';
import { usePagination } from '../../../lib/shared/usePagination';
import { exportToExcel, exportToPDF } from '../../../lib/shared/export-utils';
import { Plus, Search, Filter, Download, Eye, Edit, FileText, Clock, CheckCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
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
import { useCotizacionesStore } from '../../../lib/compras/cotizaciones-store';
import { 
  COTIZACION_ESTADO_CONFIG, 
  COTIZACION_TIPO_LABELS,
  COTIZACION_MONEDA_LABELS,
  tienePermiso,
  formatearMonto,
  formatearFecha,
  type EstadoCotizacion,
  type TipoCotizacion,
  type MonedaCotizacion
} from '../../../lib/compras/cotizaciones-config';

interface CotizacionesListaProps {
  onNavigate?: (route: string) => void;
}

export function CotizacionesLista({ onNavigate }: CotizacionesListaProps) {
  const { cotizaciones, usuarioActual } = useCotizacionesStore();
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoCotizacion | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoCotizacion | 'todos'>('todos');
  const [filtroMoneda, setFiltroMoneda] = useState<MonedaCotizacion | 'todos'>('todos');
  const [tabActual, setTabActual] = useState<'activas' | 'aprobadas' | 'rechazadas' | 'anuladas' | 'todas'>('activas');

  // Cotizaciones filtradas por tab
  const cotizacionesPorTab = useMemo(() => {
    if (tabActual === 'activas') {
      return cotizaciones.filter(c => c.estado === 'borrador' || c.estado === 'enviada' || c.estado === 'recibida');
    } else if (tabActual === 'aprobadas') {
      return cotizaciones.filter(c => c.estado === 'aprobada');
    } else if (tabActual === 'rechazadas') {
      return cotizaciones.filter(c => c.estado === 'rechazada');
    } else if (tabActual === 'anuladas') {
      return cotizaciones.filter(c => c.estado === 'anulada');
    }
    return cotizaciones;
  }, [cotizaciones, tabActual]);

  // Cotizaciones filtradas
  const cotizacionesFiltradas = useMemo(() => {
    return cotizacionesPorTab.filter(c => {
      // Búsqueda por texto
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        c.id.toLowerCase().includes(searchLower) ||
        c.proveedorNombre.toLowerCase().includes(searchLower) ||
        c.requerimientoId.toLowerCase().includes(searchLower);

      // Filtro por estado
      const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado;

      // Filtro por tipo
      const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;

      // Filtro por moneda
      const matchMoneda = filtroMoneda === 'todos' || c.moneda === filtroMoneda;

      return matchSearch && matchEstado && matchTipo && matchMoneda;
    });
  }, [cotizacionesPorTab, searchTerm, filtroEstado, filtroTipo, filtroMoneda]);

  const { paged: cotizacionesPaged, page, totalPages, totalItems: totalFiltrados, setPage } = usePagination(cotizacionesFiltradas);

  // Export (respeta filtros activos)
  const cotExportHeaders = { numero: 'N° Cotización', proveedor: 'Proveedor', requerimiento: 'N° Req', tipo: 'Tipo', estado: 'Estado', moneda: 'Moneda', total: 'Total', fecha: 'Vencimiento' };
  const cotExport = useMemo(() => cotizacionesFiltradas.map((c: any) => ({
    numero: c.id,
    proveedor: c.proveedorNombre,
    requerimiento: c.requerimientoId,
    tipo: c.tipo === 'oc' ? 'OC' : c.tipo === 'os' ? 'OS' : (c.tipo ?? ''),
    estado: c.estado,
    moneda: c.moneda,
    total: Number(c.total ?? 0).toFixed(2),
    fecha: c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString('es-PE') : '',
  })), [cotizacionesFiltradas]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: cotizaciones.length,
    borradores: cotizaciones.filter(c => c.estado === 'borrador').length,
    enviadas: cotizaciones.filter(c => c.estado === 'enviada').length,
    recibidas: cotizaciones.filter(c => c.estado === 'recibida').length,
    aprobadas: cotizaciones.filter(c => c.estado === 'aprobada').length,
    rechazadas: cotizaciones.filter(c => c.estado === 'rechazada').length,
    anuladas: cotizaciones.filter(c => c.estado === 'anulada').length,
    // Total en PEN de cotizaciones aprobadas
    totalAprobadoPEN: cotizaciones
      .filter(c => c.estado === 'aprobada' && c.moneda === 'PEN')
      .reduce((sum, c) => sum + c.total, 0)
  }), [cotizaciones]);

  const puedeCrear = tienePermiso(usuarioActual.rol, 'crear');

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <FileText className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2>Cotizaciones</h2>
            <p className="text-muted-foreground mt-1">
              Gestión de cotizaciones de proveedores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeCrear && (
            <Button onClick={() => onNavigate?.('/compras/cotizaciones/nuevo')}>
              <Plus className="size-4" />
              Nueva Cotización
            </Button>
          )}
          <Button variant="outline" disabled={cotExport.length === 0}
            onClick={() => exportToExcel(`cotizaciones-${new Date().toISOString().slice(0,10)}`, cotExport, cotExportHeaders)}>
            <Download className="size-4" />
            Excel
          </Button>
          <Button variant="outline" disabled={cotExport.length === 0}
            onClick={() => exportToPDF(`cotizaciones-${new Date().toISOString().slice(0,10)}`, 'Cotizaciones', cotExport, cotExportHeaders)}>
            <FileText className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-slate-500 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Cotizaciones</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Clock className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold">{stats.enviadas + stats.recibidas}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aprobadas</p>
              <p className="text-2xl font-bold">{stats.aprobadas}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Aprobado</p>
              <p className="text-2xl font-bold">S/ {stats.totalAprobadoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
            </div>
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
                <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, proveedor o requerimiento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtro por Estado */}
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoCotizacion | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Tipo */}
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoCotizacion | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Tipos</SelectItem>
                <SelectItem value="bienes">Bienes</SelectItem>
                <SelectItem value="servicios">Servicios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Moneda */}
          <div className="mt-4">
            <Select value={filtroMoneda} onValueChange={(v) => setFiltroMoneda(v as MonedaCotizacion | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las Monedas</SelectItem>
                <SelectItem value="PEN">Soles (S/)</SelectItem>
                <SelectItem value="USD">Dólares ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resumen de filtros activos */}
          {(searchTerm || filtroEstado !== 'todos' || filtroTipo !== 'todos' || filtroMoneda !== 'todos') && (
            <Alert className="mt-4">
              <AlertDescription>
                Mostrando <strong>{totalFiltrados}</strong> de <strong>{cotizacionesPorTab.length}</strong> cotizaciones
                {searchTerm && ` • Búsqueda: "${searchTerm}"`}
                {filtroEstado !== 'todos' && ` • Estado: ${filtroEstado}`}
                {filtroTipo !== 'todos' && ` • Tipo: ${COTIZACION_TIPO_LABELS[filtroTipo]}`}
                {filtroMoneda !== 'todos' && ` • Moneda: ${COTIZACION_MONEDA_LABELS[filtroMoneda]}`}
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
                  Activas ({stats.borradores + stats.enviadas + stats.recibidas})
                </TabsTrigger>
                <TabsTrigger value="aprobadas">
                  Aprobadas ({stats.aprobadas})
                </TabsTrigger>
                <TabsTrigger value="rechazadas">
                  Rechazadas ({stats.rechazadas})
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
              {cotizacionesPaged.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="size-16 mx-auto mb-4 opacity-20" />
                  <h3 className="font-medium text-foreground mb-2">No se encontraron cotizaciones</h3>
                  <p className="text-sm">
                    {searchTerm || filtroEstado !== 'todos' || filtroTipo !== 'todos' || filtroMoneda !== 'todos'
                      ? 'Intenta ajustar los filtros de búsqueda'
                      : puedeCrear 
                        ? 'Comienza creando la primera cotización'
                        : 'No hay cotizaciones registradas'}
                  </p>
                </div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Requerimiento</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Validez</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotizacionesPaged.map((cot) => {
                      // Defensivo: un estado fuera del catálogo nunca debe tumbar el módulo
                      const estadoConfig = COTIZACION_ESTADO_CONFIG[cot.estado]
                        ?? { label: cot.estado, icon: FileText, className: 'bg-gray-100 text-gray-600' };
                      const puedeEditar = tienePermiso(usuarioActual.rol, 'editar');

                      return (
                        <TableRow 
                          key={cot.id} 
                          className="cursor-pointer hover:bg-muted/50" 
                          onClick={() => onNavigate?.(`/compras/cotizaciones/${cot.id}`)}
                        >
                          <TableCell className="font-mono text-sm">{cot.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{cot.requerimientoId}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cot.proveedorNombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {cot.items.length} {cot.items.length === 1 ? 'item' : 'items'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{COTIZACION_TIPO_LABELS[cot.tipo]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={estadoConfig.className}>
                              <estadoConfig.icon className="size-3" />
                              {estadoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{cot.validezDias} días</p>
                              <p className="text-xs text-muted-foreground">
                                Hasta {formatearFecha(cot.fechaVencimiento)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatearMonto(cot.total, cot.moneda)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onNavigate?.(`/compras/cotizaciones/${cot.id}`)}
                              >
                                <Eye className="size-4" />
                              </Button>
                              {puedeEditar && (cot.estado === 'borrador' || cot.estado === 'rechazada') && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => onNavigate?.(`/compras/cotizaciones/${cot.id}/editar`)}
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
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-3 border-t">
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
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
