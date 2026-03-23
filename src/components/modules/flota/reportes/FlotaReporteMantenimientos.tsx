/**
 * KESA ERP - Flota → Reportes → Mantenimientos
 */

import { useState, useMemo } from 'react';
import {
  Wrench,
  Download,
  FileSpreadsheet,
  FilePlus,
  Filter,
  ArrowLeft,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
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
import { useOTStore } from '../../../../lib/flota/ot-store';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import {
  buildOTsReportRows,
  calcOTsReportKPIs,
  type OTsReportFilters
} from '../../../../lib/flota/flota-reports';
import { exportToCSV, exportToExcel, exportToPDF, formatDateForExport } from '../../../../lib/shared/export-utils';
import { OT_TIPO_CONFIG, OT_CRITICIDAD_CONFIG, OT_ESTADO_CONFIG } from '../../../../lib/flota/ot-config';
import { toast } from 'sonner@2.0.3';

interface FlotaReporteMantenimientosProps {
  onNavigate: (route: string) => void;
}

export function FlotaReporteMantenimientos({ onNavigate }: FlotaReporteMantenimientosProps) {
  const { ordenes } = useOTStore();
  const { vehiculos } = useVehiculos();

  const [filters, setFilters] = useState<OTsReportFilters>({});

  // Talleres únicos
  const talleresUnicos = useMemo(() => {
    const talleresSet = new Set<string>();
    ordenes.forEach(ot => talleresSet.add(ot.taller.nombre));
    return Array.from(talleresSet).sort();
  }, [ordenes]);

  // Memoized data
  const rows = useMemo(() => {
    return buildOTsReportRows(ordenes, vehiculos, filters);
  }, [ordenes, vehiculos, filters]);

  const kpis = useMemo(() => {
    return calcOTsReportKPIs(rows);
  }, [rows]);

  // Handlers
  const handleFilterChange = (key: keyof OTsReportFilters, value: any) => {
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
      numeroOT: 'Número OT',
      placa: 'Placa',
      tipo: 'Tipo',
      criticidad: 'Criticidad',
      estado: 'Estado',
      taller: 'Taller',
      fechaProgramada: 'Fecha Programada',
      fechaInicio: 'Fecha Inicio',
      fechaCierre: 'Fecha Cierre',
      slaEstimado: 'SLA Estimado (h)',
      slaReal: 'SLA Real (h)',
      costoTotal: 'Costo Total',
      extrasPiezas: 'Extras Piezas',
      extrasServicios: 'Extras Servicios',
      extrasCosto: 'Extras Costo',
      observaciones: 'Observaciones'
    };

    const dataForExport = rows.map(r => ({
      ...r,
      fechaProgramada: formatDateForExport(r.fechaProgramada),
      fechaInicio: formatDateForExport(r.fechaInicio),
      fechaCierre: formatDateForExport(r.fechaCierre),
      slaReal: r.slaReal?.toFixed(2) || 'N/A',
      costoTotal: r.costoTotal.toFixed(2),
      extrasCosto: r.extrasCosto.toFixed(2)
    }));

    exportToCSV(`reporte-mantenimientos-${new Date().toISOString().split('T')[0]}`, dataForExport, headersMap);

    toast.success('CSV exportado', {
      description: `${rows.length} OT(s) exportada(s)`
    });
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headersMap = {
      numeroOT: 'Número OT',
      placa: 'Placa',
      tipo: 'Tipo',
      criticidad: 'Criticidad',
      estado: 'Estado',
      taller: 'Taller',
      fechaProgramada: 'Fecha Programada',
      fechaInicio: 'Fecha Inicio',
      fechaCierre: 'Fecha Cierre',
      slaEstimado: 'SLA Estimado (h)',
      slaReal: 'SLA Real (h)',
      costoTotal: 'Costo Total',
      extrasPiezas: 'Extras Piezas',
      extrasServicios: 'Extras Servicios',
      extrasCosto: 'Extras Costo',
      observaciones: 'Observaciones'
    };

    const dataForExport = rows.map(r => ({
      ...r,
      fechaProgramada: formatDateForExport(r.fechaProgramada),
      fechaInicio: formatDateForExport(r.fechaInicio),
      fechaCierre: formatDateForExport(r.fechaCierre),
      slaReal: r.slaReal?.toFixed(2) || 'N/A',
      costoTotal: r.costoTotal.toFixed(2),
      extrasCosto: r.extrasCosto.toFixed(2)
    }));

    exportToExcel(`reporte-mantenimientos-${new Date().toISOString().split('T')[0]}`, dataForExport, headersMap);

    toast.success('Excel exportado', {
      description: `${rows.length} OT(s) exportada(s)`
    });
  };

  const handleExportPDF = () => {
    if (rows.length === 0) { toast.error('No hay datos para exportar'); return; }
    const headersMap = {
      numeroOT: 'N° OT', placa: 'Placa', tipo: 'Tipo', criticidad: 'Criticidad',
      estado: 'Estado', taller: 'Taller', fechaProgramada: 'F. Programada',
      costoTotal: 'Costo Total',
    };
    exportToPDF(
      `reporte-mantenimientos-${new Date().toISOString().split('T')[0]}`,
      'Reporte de Mantenimientos — KESA ERP',
      rows, headersMap
    );
  };

  const renderKPICard = (icon: React.ReactNode, label: string, value: string | number) => {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
            <div className="text-[#0A66C2]">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Wrench className="size-7 text-[#0A66C2]" />
            Reporte de Mantenimientos
          </h2>
          <p className="text-muted-foreground mt-1">
            Vista consolidada de órdenes de trabajo
          </p>
        </div>
        <Button variant="outline" onClick={() => onNavigate('/flota')} className="gap-2">
          <ArrowLeft className="size-4" />
          Volver a Flota
        </Button>
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
          {/* Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
              />
            </div>
          </div>

          {/* Estado, Tipo, Criticidad, Taller */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  {Object.entries(OT_ESTADO_CONFIG).map(([key, config]) => (
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
                  {Object.entries(OT_TIPO_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criticidad">Criticidad</Label>
              <Select
                value={filters.criticidad || 'all'}
                onValueChange={(value) => handleFilterChange('criticidad', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="criticidad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(OT_CRITICIDAD_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taller">Taller</Label>
              <Select
                value={filters.taller || 'all'}
                onValueChange={(value) => handleFilterChange('taller', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="taller">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {talleresUnicos.map(taller => (
                    <SelectItem key={taller} value={taller}>
                      {taller}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Placa */}
          <div className="space-y-2">
            <Label htmlFor="placa">Buscar por Placa</Label>
            <Input
              id="placa"
              placeholder="Ej: ABC-123"
              value={filters.placa || ''}
              onChange={(e) => handleFilterChange('placa', e.target.value || undefined)}
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="soloConExtras"
                checked={filters.soloConExtras || false}
                onCheckedChange={(checked) => handleFilterChange('soloConExtras', checked)}
              />
              <Label htmlFor="soloConExtras" className="cursor-pointer">
                Solo con Extras
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="soloCerradas"
                checked={filters.soloCerradas || false}
                onCheckedChange={(checked) => handleFilterChange('soloCerradas', checked)}
              />
              <Label htmlFor="soloCerradas" className="cursor-pointer">
                Solo Cerradas
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" onClick={handleResetFilters}>
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderKPICard(<Wrench className="size-8" />, 'Total OTs', kpis.total)}
        {renderKPICard(<DollarSign className="size-8" />, 'Costo Total', `S/ ${kpis.costoTotal.toFixed(2)}`)}
        {renderKPICard(<AlertCircle className="size-8" />, 'Extras Piezas', kpis.extrasPiezas)}
        {renderKPICard(<AlertCircle className="size-8" />, 'SLA Cumplimiento', `${kpis.slaCumplimiento.toFixed(1)}%`)}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detalle de Mantenimientos</CardTitle>
              <CardDescription>
                {rows.length} OT(s) encontrada(s)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportCSV} variant="outline" className="gap-2">
                <Download className="size-4" />
                CSV
              </Button>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                <FileSpreadsheet className="size-4" />
                Excel (CSV)
              </Button>
              <Button onClick={handleExportPDF} variant="outline" className="gap-2">
                <FilePlus className="size-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="size-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No se encontraron mantenimientos</p>
              <p className="text-sm">Ajusta los filtros para obtener resultados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número OT</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Criticidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Fecha Prog.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-center">Extras</TableHead>
                    <TableHead className="text-center">SLA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.numeroOT}</TableCell>
                      <TableCell>{row.placa}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.criticidad === 'critica' ? 'destructive' : 'secondary'}>
                          {row.criticidad}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.estado === 'cerrada' ? 'default' : 'secondary'}>
                          {row.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.taller}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(row.fechaProgramada).toLocaleDateString('es-PE')}
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {row.costoTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.extrasPiezas > 0 || row.extrasServicios > 0 ? (
                          <span className="text-xs">
                            {row.extrasPiezas}P / {row.extrasServicios}S
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.slaReal !== undefined ? (
                          <Badge variant={row.slaReal <= row.slaEstimado ? 'default' : 'destructive'}>
                            {row.slaReal.toFixed(1)}h
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
