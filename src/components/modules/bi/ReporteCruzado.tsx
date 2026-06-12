/**
 * REPORTE CRUZADO
 * Reportes cruzados por proyecto y centro de costo
 * Filtros: DateRange, Proyecto, Centro de Costo, Módulos
 * KPIs + Tabla + Export CSV
 */

import { useState, useCallback } from 'react';
import {
  Loader2,
  Search,
  Download,
  BarChart3,
  FolderKanban,
  Building2,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';
import { useAuth } from '../../../auth/AuthProvider';
import {
  fetchCrossReportData,
  calcCrossReportKPIs,
  MODULO_LABELS,
  MODULOS_DISPONIBLES,
  type CrossReportRow,
  type CrossReportKPIs,
} from '../../../lib/bi/cross-report';
import { exportToCSV } from '../../../lib/shared/export-utils';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Default date range: last 30 days
function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export function ReporteCruzado() {
  const { tenantId } = useAuth();
  const defaults = getDefaultDates();

  // Filters state
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [proyectoId, setProyectoId] = useState<string>('');
  const [centroCostoId, setCentroCostoId] = useState<string>('');
  const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>([...MODULOS_DISPONIBLES]);

  // Data state
  const [rows, setRows] = useState<CrossReportRow[]>([]);
  const [kpis, setKpis] = useState<CrossReportKPIs | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleToggleModulo = (modulo: string) => {
    setModulosSeleccionados((prev) =>
      prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]
    );
  };

  const handleBuscar = useCallback(async () => {
    if (!tenantId) return;
    if (modulosSeleccionados.length === 0) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await fetchCrossReportData({
        dateFrom,
        dateTo,
        proyectoId: proyectoId || undefined,
        centroCostoId: centroCostoId || undefined,
        modulos: modulosSeleccionados,
        tenantId,
      });
      setRows(data);
      setKpis(calcCrossReportKPIs(data));
    } catch (err) {
      console.error('Error fetching cross report:', err);
      setRows([]);
      setKpis(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateFrom, dateTo, proyectoId, centroCostoId, modulosSeleccionados]);

  const handleExportCSV = () => {
    if (rows.length === 0) return;
    exportToCSV('reporte-cruzado', rows, {
      fecha: 'Fecha',
      modulo: 'Módulo',
      tipo: 'Tipo',
      numero: 'Número',
      descripcion: 'Descripción',
      monto: 'Monto',
      moneda: 'Moneda',
      proyecto: 'Proyecto',
      centroCosto: 'Centro de Costo',
    } as any);
  };

  const topProyectos = kpis
    ? Object.entries(kpis.porProyecto)
        .sort(([, a], [, b]) => b.monto - a.monto)
        .slice(0, 5)
    : [];

  const topCentrosCosto = kpis
    ? Object.entries(kpis.porCentroCosto)
        .sort(([, a], [, b]) => b.monto - a.monto)
        .slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Reporte Cruzado</h2>
            <p className="text-muted-foreground mt-1">
              Análisis cruzado por proyecto y centro de costo
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <Button onClick={handleExportCSV} variant="outline" className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
            <Download className="size-4" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="size-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fechas + Selectores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="cr-date-from">Desde</Label>
              <Input
                id="cr-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cr-date-to">Hasta</Label>
              <Input
                id="cr-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Proyecto</Label>
              <ProyectoSelector
                value={proyectoId}
                onChange={setProyectoId}
              />
            </div>
            <div>
              <Label>Centro de Costo</Label>
              <CentroCostoSelector
                value={centroCostoId}
                onChange={setCentroCostoId}
              />
            </div>
          </div>

          {/* Módulos */}
          <div>
            <Label className="mb-2 block">Módulos</Label>
            <div className="flex flex-wrap items-center gap-4">
              {MODULOS_DISPONIBLES.map((mod) => (
                <div key={mod} className="flex items-center gap-2">
                  <Checkbox
                    id={`mod-${mod}`}
                    checked={modulosSeleccionados.includes(mod)}
                    onCheckedChange={() => handleToggleModulo(mod)}
                  />
                  <Label htmlFor={`mod-${mod}`} className="text-sm cursor-pointer !mb-0">
                    {MODULO_LABELS[mod]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleBuscar}
            disabled={loading || modulosSeleccionados.length === 0}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Buscar
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <FileSpreadsheet className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Registros</p>
                <p className="text-2xl font-bold">{kpis.totalRegistros}</p>
                <p className="text-sm font-medium text-blue-600">{formatCurrency(kpis.totalMonto)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Top Proyectos */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban className="size-5 text-purple-600" />
                <p className="text-sm font-medium">Top Proyectos</p>
              </div>
              <div className="space-y-1.5">
                {topProyectos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  topProyectos.map(([nombre, data]) => (
                    <div key={nombre} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[140px]">{nombre}</span>
                      <span className="font-medium">{formatCurrency(data.monto)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Centros de Costo */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="size-5 text-emerald-600" />
                <p className="text-sm font-medium">Top Centros de Costo</p>
              </div>
              <div className="space-y-1.5">
                {topCentrosCosto.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  topCentrosCosto.map(([nombre, data]) => (
                    <div key={nombre} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[140px]">{nombre}</span>
                      <span className="font-medium">{formatCurrency(data.monto)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Por Módulo badges */}
      {kpis && Object.keys(kpis.porModulo).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(kpis.porModulo).map(([modulo, data]) => (
            <Badge key={modulo} variant="secondary" className="text-sm py-1 px-3">
              {modulo}: {data.count} ({formatCurrency(data.monto)})
            </Badge>
          ))}
        </div>
      )}

      {/* Tabla de resultados */}
      {hasSearched && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Resultados ({rows.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="size-12 mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">
                  No se encontraron registros con los filtros aplicados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Centro Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={`${row.modulo}-${row.numero}-${idx}`}>
                        <TableCell className="whitespace-nowrap">{formatDate(row.fecha)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.modulo}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{row.tipo}</TableCell>
                        <TableCell className="font-mono text-sm">{row.numero}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.descripcion}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {formatCurrency(row.monto)}
                        </TableCell>
                        <TableCell className="text-sm">{row.proyecto ?? '-'}</TableCell>
                        <TableCell className="text-sm">{row.centroCosto ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
