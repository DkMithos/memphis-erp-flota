/**
 * KESA ERP - Flota → Reportes → Documentos
 */

import { useState, useMemo, useEffect } from 'react';
import { usePagination } from '../../../../lib/shared/usePagination';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FilePlus,
  Filter,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle
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
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import {
  buildDocumentosReportRows,
  calcDocumentosReportKPIs,
  type DocumentosReportFilters
} from '../../../../lib/flota/flota-reports';
import { exportToCSV, exportToExcel, formatDateForExport } from '../../../../lib/shared/export-utils';
import { TIPO_DOCUMENTO_LABELS, getEstadoDocumentoBadge } from '../../../../lib/flota/vehiculos-config';
import { toast } from 'sonner';

interface FlotaReporteDocumentosProps {
  onNavigate: (route: string) => void;
}

export function FlotaReporteDocumentos({ onNavigate }: FlotaReporteDocumentosProps) {
  const { vehiculos } = useVehiculos();

  const [filters, setFilters] = useState<DocumentosReportFilters>({});

  // Memoized data
  const rows = useMemo(() => {
    return buildDocumentosReportRows(vehiculos, filters);
  }, [vehiculos, filters]);

  const kpis = useMemo(() => {
    return calcDocumentosReportKPIs(rows);
  }, [rows]);

  const { paged: rowsPaged, page, totalPages, setPage, reset: resetPage } = usePagination(rows, 20);
  useEffect(() => { resetPage(); }, [rows]);

  // Handlers
  const handleFilterChange = (key: keyof DocumentosReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleExportCSV = () => {
    if (rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headersMap = {
      placa: 'Placa',
      clienteProyecto: 'Cliente/Proyecto',
      tipoDoc: 'Tipo Documento',
      nombre: 'Nombre',
      fechaEmision: 'Fecha Emisión',
      fechaVencimiento: 'Fecha Vencimiento',
      estado: 'Estado',
      diasRestantes: 'Días Restantes'
    };

    const dataForExport = rows.map(r => ({
      ...r,
      fechaEmision: formatDateForExport(r.fechaEmision !== 'N/A' ? r.fechaEmision : undefined),
      fechaVencimiento: formatDateForExport(r.fechaVencimiento)
    }));

    exportToCSV(`reporte-documentos-${new Date().toISOString().split('T')[0]}`, dataForExport, headersMap);

    toast.success('CSV exportado', {
      description: `${rows.length} documento(s) exportado(s)`
    });
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headersMap = {
      placa: 'Placa',
      clienteProyecto: 'Cliente/Proyecto',
      tipoDoc: 'Tipo Documento',
      nombre: 'Nombre',
      fechaEmision: 'Fecha Emisión',
      fechaVencimiento: 'Fecha Vencimiento',
      estado: 'Estado',
      diasRestantes: 'Días Restantes'
    };

    const dataForExport = rows.map(r => ({
      ...r,
      fechaEmision: formatDateForExport(r.fechaEmision !== 'N/A' ? r.fechaEmision : undefined),
      fechaVencimiento: formatDateForExport(r.fechaVencimiento)
    }));

    exportToExcel(`reporte-documentos-${new Date().toISOString().split('T')[0]}`, dataForExport, headersMap);

    toast.success('Excel exportado', {
      description: `${rows.length} documento(s) exportado(s)`
    });
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
            <FileText className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Reporte de Documentos</h2>
            <p className="text-muted-foreground mt-1">
              Vista consolidada de documentación vehicular
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
          {/* Cliente/Proyecto, Tipo Doc, Estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clienteProyecto">Cliente/Proyecto</Label>
              <Input
                id="clienteProyecto"
                placeholder="Buscar..."
                value={filters.clienteProyecto || ''}
                onChange={(e) => handleFilterChange('clienteProyecto', e.target.value || undefined)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoDocumento">Tipo Documento</Label>
              <Select
                value={filters.tipoDocumento || 'all'}
                onValueChange={(value) => handleFilterChange('tipoDocumento', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="tipoDocumento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_DOCUMENTO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoDocumento">Estado</Label>
              <Select
                value={filters.estadoDocumento || 'all'}
                onValueChange={(value) => handleFilterChange('estadoDocumento', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="estadoDocumento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="proximo">Próximo a Vencer</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rango vencimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vencimientoFrom">Vencimiento Desde</Label>
              <Input
                id="vencimientoFrom"
                type="date"
                value={filters.vencimientoFrom || ''}
                onChange={(e) => handleFilterChange('vencimientoFrom', e.target.value || undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimientoTo">Vencimiento Hasta</Label>
              <Input
                id="vencimientoTo"
                type="date"
                value={filters.vencimientoTo || ''}
                onChange={(e) => handleFilterChange('vencimientoTo', e.target.value || undefined)}
              />
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
        {renderKPICard(<FileText className="size-8" />, 'Total Documentos', kpis.total)}
        {renderKPICard(<CheckCircle className="size-8" />, 'Vigentes', kpis.vigentes, 'success')}
        {renderKPICard(<Clock className="size-8" />, 'Próximos a Vencer', kpis.proximos, 'warning')}
        {renderKPICard(<XCircle className="size-8" />, 'Vencidos', kpis.vencidos, 'danger')}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detalle de Documentos</CardTitle>
              <CardDescription>
                {rows.length} documento(s) encontrado(s)
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
              <Button variant="outline" className="gap-2 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input" disabled title="Disponible en etapa backend">
                <FilePlus className="size-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="size-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No se encontraron documentos</p>
              <p className="text-sm">Ajusta los filtros para obtener resultados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Cliente/Proyecto</TableHead>
                    <TableHead>Tipo Documento</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Fecha Emisión</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Días Restantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsPaged.map((row, idx) => {
                    const badgeConfig = getEstadoDocumentoBadge(row.estado as 'vigente' | 'proximo' | 'vencido');
                    
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.placa}</TableCell>
                        <TableCell className="max-w-xs truncate" title={row.clienteProyecto}>
                          {row.clienteProyecto}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.tipoDoc}</Badge>
                        </TableCell>
                        <TableCell>{row.nombre}</TableCell>
                        <TableCell className="text-sm">
                          {row.fechaEmision !== 'N/A'
                            ? new Date(row.fechaEmision).toLocaleDateString('es-PE')
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(row.fechaVencimiento).toLocaleDateString('es-PE')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badgeConfig.variant as any} className={badgeConfig.className}>
                            {badgeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={
                            row.diasRestantes < 0
                              ? 'text-red-600 font-semibold'
                              : row.diasRestantes <= 30
                              ? 'text-amber-600 font-semibold'
                              : ''
                          }>
                            {row.diasRestantes}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
