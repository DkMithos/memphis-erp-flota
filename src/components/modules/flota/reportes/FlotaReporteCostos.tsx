/**
 * Memphis ERP - Flota → Reportes → Costos por Vehículo
 * Muestra costo acumulado de mantenimiento, depreciación y saldo por cada vehículo
 */

import { useState, useMemo, useEffect } from 'react';
import { usePagination } from '../../../../lib/shared/usePagination';
import {
  DollarSign, Download, ArrowLeft, Filter, TrendingDown, Car,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Progress } from '../../../ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../ui/table';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../../lib/flota/ot-store';
import { useProyectos } from '../../../../lib/proyectos/proyectos-store';
import { calcSaldoPreventivo, calcDepreciacion } from '../../../../lib/flota/vehiculos-config';
import { ProyectoSelector } from '../../../shared/ProyectoSelector';
import { arrayToCSV, downloadCSV } from '../../../../lib/shared/export-utils';

interface FlotaReporteCostosProps {
  onNavigate: (route: string) => void;
}

function fmt(amount: number, moneda = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(amount);
}

function pctColor(pct: number): string {
  if (pct >= 90) return '[&>div]:bg-red-500';
  if (pct >= 70) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-green-500';
}

export function FlotaReporteCostos({ onNavigate }: FlotaReporteCostosProps) {
  const { vehiculos } = useVehiculos();
  const { ordenes } = useOTStore();
  const { proyectos } = useProyectos();

  const [proyectoFiltro, setProyectoFiltro] = useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');

  // Build OTs for calc
  const otsCalc = useMemo(() =>
    ordenes.map(ot => ({
      vehiculoId: ot.vehiculoId,
      tipo: ot.tipo,
      estado: ot.estado,
      costos: ot.costos,
    })),
    [ordenes]
  );

  // Filter vehicles
  const vehiculosFiltrados = useMemo(() => {
    let lista = vehiculos;
    if (proyectoFiltro) lista = lista.filter(v => v.proyectoId === proyectoFiltro);
    if (tipoFiltro !== 'todos') lista = lista.filter(v => v.tipo === tipoFiltro);
    return lista;
  }, [vehiculos, proyectoFiltro, tipoFiltro]);

  // Build rows
  const filas = useMemo(() =>
    vehiculosFiltrados.map(v => {
      const saldo = calcSaldoPreventivo(v.id, otsCalc, v.planPreventivoContratado);
      const dep = calcDepreciacion(v);
      const proyecto = v.proyectoId ? proyectos.find(p => p._dbId === v.proyectoId) : null;

      return {
        placa: v.placa,
        tipo: v.tipo,
        marca: `${v.marca} ${v.modelo}`,
        año: v.año,
        km: v.kilometraje,
        proyecto: proyecto ? proyecto.id : '—',
        tipoFlota: v.tipoFlota || '—',
        // Preventivos
        prevRealizados: saldo.preventivosRealizados,
        prevTotal: saldo.preventivosTotal,
        costoContratado: saldo.costoTotalContratado,
        costoConsumido: saldo.costoConsumido,
        costoRestante: saldo.costoRestante,
        pctConsumo: saldo.porcentajeCosto,
        // Depreciación
        precioAdq: v.precioAdquisicion || 0,
        moneda: v.monedaAdquisicion || 'PEN',
        depAcumulada: dep?.depreciacionAcumulada ?? 0,
        valorLibros: dep?.valorEnLibros ?? 0,
        totalDepreciado: dep?.totalmenteDepreciado ?? false,
        // Para navegación
        vehiculoId: v.id,
      };
    }).sort((a, b) => b.costoConsumido - a.costoConsumido),
    [vehiculosFiltrados, otsCalc, proyectos]
  );

  // Totals
  const totales = useMemo(() => ({
    vehiculos: filas.length,
    costoContratado: filas.reduce((s, f) => s + f.costoContratado, 0),
    costoConsumido: filas.reduce((s, f) => s + f.costoConsumido, 0),
    costoRestante: filas.reduce((s, f) => s + f.costoRestante, 0),
    precioAdqTotal: filas.reduce((s, f) => s + f.precioAdq, 0),
    depAcumuladaTotal: filas.reduce((s, f) => s + f.depAcumulada, 0),
  }), [filas]);

  const pctTotal = totales.costoContratado > 0
    ? Math.round((totales.costoConsumido / totales.costoContratado) * 100) : 0;

  const { paged: filasPaged, page, totalPages, setPage, reset: resetPage } = usePagination(filas, 20);
  useEffect(() => { resetPage(); }, [filas]);

  // Export CSV
  const handleExportCSV = () => {
    const csvData = filas.map(f => ({
      placa: f.placa,
      tipo: f.tipo,
      vehiculo: f.marca,
      año: f.año,
      km: f.km,
      proyecto: f.proyecto,
      tipoFlota: f.tipoFlota,
      prevRealizados: f.prevRealizados,
      prevTotal: f.prevTotal,
      costoContratado: f.costoContratado,
      costoConsumido: f.costoConsumido,
      costoRestante: f.costoRestante,
      pctConsumo: f.pctConsumo,
      precioAdquisicion: f.precioAdq,
      depAcumulada: f.depAcumulada,
      valorLibros: f.valorLibros,
    }));

    const headers = {
      placa: 'Placa',
      tipo: 'Tipo',
      vehiculo: 'Vehículo',
      año: 'Año',
      km: 'Kilometraje',
      proyecto: 'Proyecto',
      tipoFlota: 'Tipo Flota',
      prevRealizados: 'Prev. Realizados',
      prevTotal: 'Prev. Total',
      costoContratado: 'Costo Contratado',
      costoConsumido: 'Costo Consumido',
      costoRestante: 'Saldo Restante',
      pctConsumo: '% Consumo',
      precioAdquisicion: 'Precio Adquisición',
      depAcumulada: 'Dep. Acumulada',
      valorLibros: 'Valor en Libros',
    };

    const csv = arrayToCSV(csvData, headers as any);
    downloadCSV(`reporte-costos-flota-${new Date().toISOString().split('T')[0]}`, csv);
  };

  // Unique tipos
  const tiposUnicos = useMemo(() =>
    [...new Set(vehiculos.map(v => v.tipo))].sort(),
    [vehiculos]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/flota/reportes')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="size-5 text-primary" />
              Reporte de Costos por Vehículo
            </h2>
            <p className="text-sm text-muted-foreground">
              Mantenimiento preventivo contratado vs consumido + depreciación SUNAT
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filas.length === 0}>
          <Download className="size-4 mr-1" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-60">
          <ProyectoSelector value={proyectoFiltro} onChange={setProyectoFiltro} nullable />
        </div>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo vehículo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tiposUnicos.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Car className="size-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold">{totales.vehiculos}</p>
            <p className="text-xs text-muted-foreground">Vehículos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-5 mx-auto text-blue-600 mb-1" />
            <p className="text-lg font-bold">{fmt(totales.costoContratado)}</p>
            <p className="text-xs text-muted-foreground">Contratado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-5 mx-auto text-amber-600 mb-1" />
            <p className="text-lg font-bold">{fmt(totales.costoConsumido)}</p>
            <p className="text-xs text-muted-foreground">Consumido ({pctTotal}%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="size-5 mx-auto text-purple-600 mb-1" />
            <p className="text-lg font-bold">{fmt(totales.depAcumuladaTotal)}</p>
            <p className="text-xs text-muted-foreground">Dep. Acumulada</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {totales.costoContratado > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Consumo total</span>
            <span className="font-medium">{pctTotal}%</span>
          </div>
          <Progress value={pctTotal} className={`h-2 ${pctColor(pctTotal)}`} />
        </div>
      )}

      {/* Table */}
      {filas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Filter className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay vehículos que coincidan con los filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead className="text-center">Prev.</TableHead>
                  <TableHead className="text-right">Contratado</TableHead>
                  <TableHead className="text-right">Consumido</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-right">Adquisición</TableHead>
                  <TableHead className="text-right">Dep. Acum.</TableHead>
                  <TableHead className="text-right">Valor Libros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPaged.map(f => (
                  <TableRow
                    key={f.vehiculoId}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => onNavigate(`/flota/vehiculos/${f.vehiculoId}`)}
                  >
                    <TableCell className="font-semibold">{f.placa}</TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{f.marca}</span>
                        <p className="text-xs text-muted-foreground">{f.tipo} · {f.km.toLocaleString()} km</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {f.prevTotal > 0 ? `${f.prevRealizados}/${f.prevTotal}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {f.costoContratado > 0 ? fmt(f.costoContratado) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {f.costoConsumido > 0 ? fmt(f.costoConsumido) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {f.costoContratado > 0 ? (
                        <span className={f.costoRestante <= 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          {fmt(f.costoRestante)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.costoContratado > 0 ? (
                        <Badge
                          variant={f.pctConsumo >= 90 ? 'destructive' : f.pctConsumo >= 70 ? 'outline' : 'secondary'}
                          className="text-xs"
                        >
                          {f.pctConsumo}%
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {f.precioAdq > 0 ? fmt(f.precioAdq, f.moneda) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {f.depAcumulada > 0 ? fmt(f.depAcumulada, f.moneda) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {f.precioAdq > 0 ? (
                        <span className={f.totalDepreciado ? 'text-red-500' : ''}>
                          {fmt(f.valorLibros, f.moneda)}
                          {f.totalDepreciado && <span className="text-xs ml-1">(dep.)</span>}
                        </span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3}>TOTAL ({filas.length} vehículos)</TableCell>
                  <TableCell className="text-right">{fmt(totales.costoContratado)}</TableCell>
                  <TableCell className="text-right">{fmt(totales.costoConsumido)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(totales.costoRestante)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{pctTotal}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmt(totales.precioAdqTotal)}</TableCell>
                  <TableCell className="text-right">{fmt(totales.depAcumuladaTotal)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-3 border-t">
                <span className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, filas.length)} de {filas.length} vehículos
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
