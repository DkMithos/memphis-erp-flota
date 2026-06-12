/**
 * Memphis ERP - Flota → Reportes → Vehículos
 */

import { useState, useMemo, useEffect } from 'react';
import { usePagination } from '../../../../lib/shared/usePagination';
import {
  Car,
  Download,
  FileSpreadsheet,
  FilePlus,
  Filter,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { PageNav } from '../../../shared/PageNav';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Badge } from '../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import { Switch } from '../../../ui/switch';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import {
  buildVehiculosReportRows,
  calcVehiculosReportKPIs,
  type VehiculosReportFilters
} from '../../../../lib/flota/flota-reports';
import { exportToCSV, exportToExcel, exportToPDF, formatDateForExport } from '../../../../lib/shared/export-utils';
import { TIPO_VEHICULO_LABELS, ESTADO_VEHICULO_CONFIG } from '../../../../lib/flota/vehiculos-config';
import { toast } from 'sonner';

interface FlotaReporteVehiculosProps {
  onNavigate: (route: string) => void;
}

export function FlotaReporteVehiculos({ onNavigate }: FlotaReporteVehiculosProps) {
  const { vehiculos } = useVehiculos();

  const [filters, setFilters] = useState<VehiculosReportFilters>({});

  // Memoized data
  const rows = useMemo(() => {
    return buildVehiculosReportRows(vehiculos, filters);
  }, [vehiculos, filters]);

  const kpis = useMemo(() => {
    return calcVehiculosReportKPIs(rows);
  }, [rows]);

  const { paged: rowsPaged, page, totalPages, setPage, reset: resetPage } = usePagination(rows, 20);
  useEffect(() => { resetPage(); }, [rows]);

  // Handlers
  const handleFilterChange = (key: keyof VehiculosReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleExportCSV = () => {
    if (rows.length === 0) {
      toast.error('No hay datos para exportar', {
        description: 'Ajusta los filtros para obtener resultados'
      });
      return;
    }

    const headersMap = {
      placa: 'Placa',
      marca: 'Marca',
      modelo: 'Modelo',
      año: 'Año',
      tipo: 'Tipo',
      clienteProyecto: 'Cliente/Proyecto',
      contratoTipo: 'Tipo Contrato',
      contratoFechaFin: 'Fin Contrato',
      kilometraje: 'Kilometraje',
      preventivosTotal: 'Preventivos Total',
      preventivosUsados: 'Preventivos Usados',
      preventivosRestantes: 'Preventivos Restantes',
      docsVigentes: 'Docs Vigentes',
      docsProximos: 'Docs Próximos',
      docsVencidos: 'Docs Vencidos',
      estado: 'Estado'
    };

    // Formatear datos para export
    const dataForExport = rows.map(r => ({
      ...r,
      contratoFechaFin: formatDateForExport(r.contratoFechaFin !== 'N/A' ? r.contratoFechaFin : undefined)
    }));

    exportToCSV(`reporte-vehiculos-${new Date().toISOString().split('T')[0]}`, dataForExport, headersMap);

    toast.success('CSV exportado', {
      description: `${rows.length} vehículo(s) exportado(s)`
    });
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headersMap = {
      placa: 'Placa',
      marca: 'Marca',
      modelo: 'Modelo',
      año: 'Año',
      tipo: 'Tipo',
      clienteProyecto: 'Cliente/Proyecto',
      contratoTipo: 'Tipo Contrato',
      contratoFechaFin: 'Fin Contrato',
      kilometraje: 'Kilometraje',
      preventivosTotal: 'Preventivos Total',
      preventivosUsados: 'Preventivos Usados',
      preventivosRestantes: 'Preventivos Restantes',
      docsVigentes: 'Docs Vigentes',
      docsProximos: 'Docs Próximos',
      docsVencidos: 'Docs Vencidos',
      estado: 'Estado'
    };

    const dataForExport = rows.map(r => ({
      ...r,
      contratoFechaFin: formatDateForExport(r.contratoFechaFin !== 'N/A' ? r.contratoFechaFin : undefined)
    }));

    exportToExcel(`reporte-vehiculos-${new Date().toISOString().split('T')[0]}`, dataForExport, headersMap);

    toast.success('Excel exportado', {
      description: `${rows.length} vehículo(s) exportado(s)`
    });
  };

  const handleExportPDF = () => {
    if (rows.length === 0) { toast.error('No hay datos para exportar'); return; }
    const headersMap = {
      placa: 'Placa', marca: 'Marca', modelo: 'Modelo', año: 'Año', tipo: 'Tipo',
      clienteProyecto: 'Cliente/Proyecto', estado: 'Estado', kilometraje: 'Kilometraje',
    };
    exportToPDF(
      `reporte-vehiculos-${new Date().toISOString().split('T')[0]}`,
      'Reporte de Vehículos — Memphis ERP',
      rows, headersMap
    );
  };

  const renderKPICard = (icon: React.ReactNode, label: string, value: string | number, variant: 'default' | 'success' | 'warning' | 'danger' = 'default') => {
    const boxColors = {
      default: 'bg-blue-500',
      success: 'bg-green-500',
      warning: 'bg-amber-500',
      danger: 'bg-red-500'
    };
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`size-10 ${boxColors[variant]} rounded-lg flex items-center justify-center shrink-0 text-white [&_svg]:size-5`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Car className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Reporte de Vehículos</h2>
            <p className="text-muted-foreground mt-1">
              Vista consolidada de la flota vehicular
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="busqueda">Buscar (Placa/Marca/Modelo)</Label>
              <Input
                id="busqueda"
                placeholder="Ej: ABC-123"
                value={filters.busqueda || ''}
                onChange={(e) => handleFilterChange('busqueda', e.target.value || undefined)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={filters.estado || 'all'}
                onValueChange={(value) => handleFilterChange('estado', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(ESTADO_VEHICULO_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={filters.tipo || 'all'}
                onValueChange={(value) => handleFilterChange('tipo', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_VEHICULO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clienteProyecto">Cliente/Proyecto</Label>
            <Input
              id="clienteProyecto"
              placeholder="Buscar por cliente o proyecto"
              value={filters.clienteProyecto || ''}
              onChange={(e) => handleFilterChange('clienteProyecto', e.target.value || undefined)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="soloConDocsVencidos"
                checked={filters.soloConDocsVencidos || false}
                onCheckedChange={(checked) => handleFilterChange('soloConDocsVencidos', checked)}
              />
              <Label htmlFor="soloConDocsVencidos" className="cursor-pointer">
                Solo con Documentos Vencidos
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="soloConPreventivosPoragotarse"
                checked={filters.soloConPreventivosPoragotarse || false}
                onCheckedChange={(checked) => handleFilterChange('soloConPreventivosPoragotarse', checked)}
              />
              <Label htmlFor="soloConPreventivosPoragotarse" className="cursor-pointer">
                Solo con Preventivos por Agotarse (≤1)
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" onClick={handleResetFilters} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderKPICard(<Car className="size-8" />, 'Total Vehículos', kpis.total)}
        {renderKPICard(<AlertTriangle className="size-8" />, 'Con Docs Vencidos', kpis.conDocsVencidos, 'danger')}
        {renderKPICard(<Clock className="size-8" />, 'Con Docs Próximos', kpis.conDocsProximos, 'warning')}
        {renderKPICard(<CheckCircle className="size-8" />, 'Preventivos Críticos', kpis.preventivosRestantesCriticos, 'danger')}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detalle de Vehículos</CardTitle>
              <CardDescription>
                {rows.length} vehículo(s) encontrado(s)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportCSV} variant="outline" className="gap-2 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                <Download className="size-4" />
                CSV
              </Button>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                <FileSpreadsheet className="size-4" />
                Excel (CSV)
              </Button>
              <Button onClick={handleExportPDF} variant="outline" className="gap-2 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                <FilePlus className="size-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="size-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No se encontraron vehículos</p>
              <p className="text-sm">Ajusta los filtros para obtener resultados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente/Proyecto</TableHead>
                    <TableHead className="text-right">KM</TableHead>
                    <TableHead className="text-right">Preventivos</TableHead>
                    <TableHead className="text-center">Documentos</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsPaged.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.placa}</TableCell>
                      <TableCell>
                        {row.marca} {row.modelo}
                      </TableCell>
                      <TableCell>{row.año}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.tipo}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={row.clienteProyecto}>
                        {row.clienteProyecto}
                      </TableCell>
                      <TableCell className="text-right">{row.kilometraje.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.preventivosRestantes <= 1 && row.preventivosTotal > 0 ? 'text-red-600 font-semibold' : ''}>
                          {row.preventivosRestantes}/{row.preventivosTotal}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="text-green-600" title="Vigentes">{row.docsVigentes}✓</span>
                          <span className="text-amber-600" title="Próximos">{row.docsProximos}⚠</span>
                          <span className="text-red-600" title="Vencidos">{row.docsVencidos}✗</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.estado === 'disponible' ? 'default' : 'secondary'}>
                          {row.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, rows.length)} de {rows.length} registros
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Siguiente</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
