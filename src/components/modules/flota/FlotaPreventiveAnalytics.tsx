/**
 * Memphis ERP - Flota → Análisis Preventivo Enterprise
 * Identifica piezas/servicios adicionales en mantenimientos
 * para prevenir fallas recurrentes
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Target,
  AlertTriangle,
  Wrench,
  DollarSign,
  BarChart3,
  Calendar,
  Filter,
  Copy,
  FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { useOTStore } from '../../../lib/flota/ot-store';
import {
  filterOTsWithExtras,
  aggregateExtrasByDescription,
  computePreventiveKPIs,
  buildCampaignRecommendation,
  toCSV,
  extractUniqueTalleres,
  type PreventiveAnalyticsFilters,
  type ExtraAggregated,
  type CampaignRecommendation
} from '../../../lib/flota/preventive-analytics';
import { TipoOT, CriticidadOT, OT_TIPO_CONFIG, OT_CRITICIDAD_CONFIG } from '../../../lib/flota/ot-config';
import { toast } from 'sonner';

interface FlotaPreventiveAnalyticsProps {
  onNavigate: (route: string) => void;
}

export function FlotaPreventiveAnalytics({ onNavigate }: FlotaPreventiveAnalyticsProps) {
  const { ordenes } = useOTStore();

  // Filtros
  const [filters, setFilters] = useState<PreventiveAnalyticsFilters>({
    incluirEliminados: false,
    soloPreventivos: false
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'piezas' | 'servicios'>('piezas');
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ExtraAggregated | null>(null);
  const [campaignNotes, setCampaignNotes] = useState('');

  // Memoized: filtrado y agregación
  const filteredResult = useMemo(() => {
    return filterOTsWithExtras(ordenes, filters);
  }, [ordenes, filters]);

  const kpis = useMemo(() => {
    return computePreventiveKPIs(
      filteredResult.extrasFiltrados,
      filteredResult.otsFiltradas,
      filteredResult.extrasConOT
    );
  }, [filteredResult]);

  const piezasAggregated = useMemo(() => {
    return aggregateExtrasByDescription(filteredResult.extrasConOT, 'pieza');
  }, [filteredResult.extrasConOT]);

  const serviciosAggregated = useMemo(() => {
    return aggregateExtrasByDescription(filteredResult.extrasConOT, 'servicio');
  }, [filteredResult.extrasConOT]);

  const talleresUnicos = useMemo(() => {
    return extractUniqueTalleres(ordenes);
  }, [ordenes]);

  // Handlers
  const handleFilterChange = (key: keyof PreventiveAnalyticsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      incluirEliminados: false,
      soloPreventivos: false
    });
  };

  const handleExportCSV = () => {
    const rows = activeTab === 'piezas' ? piezasAggregated : serviciosAggregated;
    
    if (rows.length === 0) {
      toast.error('No hay datos para exportar', {
        description: 'Ajusta los filtros para obtener resultados'
      });
      return;
    }

    const csv = toCSV(rows, activeTab);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `analisis-preventivo-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV exportado', {
      description: `${rows.length} registro(s) exportado(s) exitosamente`
    });
  };

  const handleGenerateCampaign = (row: ExtraAggregated) => {
    setSelectedRow(row);
    setCampaignNotes('');
    setCampaignDialogOpen(true);
  };

  const handleCopyRecommendation = () => {
    if (!selectedRow) return;

    const recommendation = buildCampaignRecommendation(selectedRow, {
      desde: filters.dateFrom,
      hasta: filters.dateTo
    });

    const text = `
${recommendation.titulo}

${recommendation.descripcion}

DETALLES:
- Frecuencia: ${recommendation.frecuencia} ocurrencia(s)
- Vehículos afectados: ${recommendation.placasTotal}
- Costo total: S/ ${recommendation.costoTotal.toFixed(2)}
- Motivo principal: ${recommendation.motivoTop}
${recommendation.rangoFechas ? `- Rango de fechas: ${recommendation.rangoFechas}` : ''}

VEHÍCULOS (primeros 20):
${recommendation.placas.map(p => `- ${p}`).join('\n')}
${recommendation.placasTotal > 20 ? `... y ${recommendation.placasTotal - 20} más` : ''}

TALLERES:
${recommendation.talleres.map(t => `- ${t}`).join('\n')}

NOTAS:
${campaignNotes || '(sin notas)'}
`.trim();

    navigator.clipboard.writeText(text);
    
    toast.success('Resumen copiado', {
      description: 'La recomendación se copió al portapapeles'
    });
  };

  const renderKPICard = (
    icon: React.ReactNode,
    label: string,
    value: string | number,
    trend?: string,
    variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' = 'default'
  ) => {
    const boxColors = {
      default: 'bg-blue-500',
      success: 'bg-green-500',
      warning: 'bg-amber-500',
      danger: 'bg-red-500',
      info: 'bg-indigo-500',
      purple: 'bg-purple-500'
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
            {trend && (
              <p className="text-xs text-muted-foreground">{trend}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTable = (rows: ExtraAggregated[], tipo: 'pieza' | 'servicio') => {
    if (rows.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="size-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No se encontraron {tipo === 'pieza' ? 'piezas' : 'servicios'}</p>
          <p className="text-sm">Ajusta los filtros para obtener resultados</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tipo === 'pieza' ? 'Pieza' : 'Servicio'}</TableHead>
              {tipo === 'pieza' && <TableHead>Categoría</TableHead>}
              <TableHead className="text-right">Frecuencia</TableHead>
              <TableHead className="text-right">Vehículos</TableHead>
              <TableHead className="text-right">Talleres</TableHead>
              <TableHead className="text-right">Costo Total</TableHead>
              <TableHead className="text-right">Costo Prom.</TableHead>
              <TableHead>Top Motivo</TableHead>
              <TableHead>Última Ocurrencia</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{row.descripcion}</TableCell>
                {tipo === 'pieza' && (
                  <TableCell>
                    {row.categoria ? (
                      <Badge variant="outline">{row.categoria}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Badge variant={row.frecuencia >= 5 ? 'destructive' : row.frecuencia >= 3 ? 'default' : 'secondary'}>
                    {row.frecuencia}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{row.vehiculosImpactados}</TableCell>
                <TableCell className="text-right">{row.talleresImpactados}</TableCell>
                <TableCell className="text-right">S/ {row.costoTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right">S/ {row.costoPromedio.toFixed(2)}</TableCell>
                <TableCell className="max-w-xs truncate" title={row.topMotivo}>
                  {row.topMotivo}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(row.ultimaOcurrencia).toLocaleDateString('es-PE')}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateCampaign(row)}
                    className="gap-2"
                  >
                    <Target className="size-4" />
                    Campaña
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
          <TrendingUp className="size-6 text-black dark:text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Análisis Preventivo Enterprise</h2>
          <p className="text-muted-foreground mt-1">
            Identifica piezas/servicios adicionales detectados en mantenimientos para prevenir fallas recurrentes
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            Filtros Avanzados
          </CardTitle>
          <CardDescription>
            Refina el análisis según tus criterios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fila 1: Fechas */}
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

          {/* Fila 2: Tipo OT, Criticidad, Taller */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoOT">Tipo OT</Label>
              <Select
                value={filters.tipoOT || 'all'}
                onValueChange={(value) => handleFilterChange('tipoOT', value === 'all' ? undefined : value as TipoOT)}
              >
                <SelectTrigger id="tipoOT">
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
                onValueChange={(value) => handleFilterChange('criticidad', value === 'all' ? undefined : value as CriticidadOT)}
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

          {/* Fila 3: Búsqueda placa */}
          <div className="space-y-2">
            <Label htmlFor="vehiculoPlaca">Buscar por Placa</Label>
            <Input
              id="vehiculoPlaca"
              placeholder="Ej: ABC-123"
              value={filters.vehiculoPlaca || ''}
              onChange={(e) => handleFilterChange('vehiculoPlaca', e.target.value || undefined)}
            />
          </div>

          {/* Fila 4: Toggles */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="soloPreventivos"
                checked={filters.soloPreventivos || false}
                onCheckedChange={(checked) => handleFilterChange('soloPreventivos', checked)}
              />
              <Label htmlFor="soloPreventivos" className="cursor-pointer">
                Solo Mantenimientos Preventivos
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="incluirEliminados"
                checked={filters.incluirEliminados || false}
                onCheckedChange={(checked) => handleFilterChange('incluirEliminados', checked)}
              />
              <Label htmlFor="incluirEliminados" className="cursor-pointer">
                Incluir Extras Eliminados
              </Label>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" onClick={handleResetFilters}>
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {renderKPICard(
          <AlertTriangle className="size-8" />,
          'Total Extras',
          kpis.totalExtras || 'N/A'
        )}
        {renderKPICard(
          <Wrench className="size-8" />,
          'Piezas',
          kpis.totalPiezas || 'N/A',
          undefined,
          'info'
        )}
        {renderKPICard(
          <Wrench className="size-8" />,
          'Servicios',
          kpis.totalServicios || 'N/A',
          undefined,
          'purple'
        )}
        {renderKPICard(
          <BarChart3 className="size-8" />,
          'Vehículos Impactados',
          kpis.vehiculosImpactados || 'N/A'
        )}
        {renderKPICard(
          <DollarSign className="size-8" />,
          'Costo Total',
          kpis.costoTotal > 0 ? `S/ ${kpis.costoTotal.toFixed(2)}` : 'N/A',
          undefined,
          'warning'
        )}
        {renderKPICard(
          <TrendingUp className="size-8" />,
          'Índice Recurrencia',
          kpis.indiceRecurrencia > 0 ? kpis.indiceRecurrencia.toFixed(2) : '0.00',
          'extras / OTs',
          kpis.indiceRecurrencia >= 1 ? 'danger' : 'success'
        )}
      </div>

      {/* Tabs y Tablas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rankings de Frecuencia</CardTitle>
              <CardDescription>
                Piezas y servicios más detectados en mantenimientos
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportCSV} variant="outline" className="gap-2 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                <Download className="size-4" />
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled
                title="Disponible en etapa backend/licenciamiento"
              >
                <FileSpreadsheet className="size-4" />
                Exportar PDF/ZIP
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'piezas' | 'servicios')}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="piezas">
                Piezas ({piezasAggregated.length})
              </TabsTrigger>
              <TabsTrigger value="servicios">
                Servicios ({serviciosAggregated.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="piezas" className="space-y-4">
              {renderTable(piezasAggregated, 'pieza')}
            </TabsContent>
            <TabsContent value="servicios" className="space-y-4">
              {renderTable(serviciosAggregated, 'servicio')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog: Generar Campaña */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="size-5" />
              Generar Campaña Preventiva
            </DialogTitle>
            <DialogDescription>
              Recomendación basada en análisis de frecuencia
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (() => {
            const recommendation = buildCampaignRecommendation(selectedRow, {
              desde: filters.dateFrom,
              hasta: filters.dateTo
            });

            return (
              <div className="space-y-4">
                {/* Título */}
                <div>
                  <Label className="text-base font-semibold">{recommendation.titulo}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {recommendation.descripcion}
                  </p>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Frecuencia</p>
                    <p className="font-semibold">{recommendation.frecuencia} ocurrencia(s)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Costo Total</p>
                    <p className="font-semibold">S/ {recommendation.costoTotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vehículos Afectados</p>
                    <p className="font-semibold">{recommendation.placasTotal}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Motivo Principal</p>
                    <p className="font-semibold text-sm">{recommendation.motivoTop}</p>
                  </div>
                </div>

                {recommendation.rangoFechas && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="size-4" />
                    Rango analizado: {recommendation.rangoFechas}
                  </div>
                )}

                {/* Vehículos */}
                <div className="space-y-2">
                  <Label>Vehículos Impactados (primeros 20)</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-3 bg-muted/20">
                    <ul className="space-y-1 text-sm">
                      {recommendation.placas.map((placa, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {placa}
                        </li>
                      ))}
                    </ul>
                    {recommendation.placasTotal > 20 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ... y {recommendation.placasTotal - 20} vehículo(s) más
                      </p>
                    )}
                  </div>
                </div>

                {/* Talleres */}
                <div className="space-y-2">
                  <Label>Talleres Frecuentes</Label>
                  <div className="border rounded-md p-3 bg-muted/20">
                    <ul className="space-y-1 text-sm">
                      {recommendation.talleres.map((taller, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {taller}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <Label htmlFor="campaignNotes">Notas / Observaciones</Label>
                  <Textarea
                    id="campaignNotes"
                    placeholder="Agrega notas sobre esta campaña preventiva..."
                    value={campaignNotes}
                    onChange={(e) => setCampaignNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={handleCopyRecommendation} className="gap-2">
              <Copy className="size-4" />
              Copiar Resumen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}