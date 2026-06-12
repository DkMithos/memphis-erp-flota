/**
 * VEHICLE CLIENT LIFE SHEET
 * Vista cliente - incluye historial y preventivos
 */

import { Truck, Calendar, Wrench, Download, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { buildVehicleClientSummary, formatDate } from '../../../lib/flota/vehicle-lifecycle';
import { getEstadoBadge } from '../../../lib/flota/vehiculos-config';
import { VehiclePublicLifeSheet } from './VehiclePublicLifeSheet';

interface VehicleClientLifeSheetProps {
  vehiculoId: string;
  onNavigate: (route: string) => void;
}

export function VehicleClientLifeSheet({ vehiculoId, onNavigate }: VehicleClientLifeSheetProps) {
  const { obtenerVehiculo } = useVehiculos();
  const { ordenes } = useOTStore();

  const vehiculo = obtenerVehiculo(vehiculoId);

  if (!vehiculo) {
    return <VehiclePublicLifeSheet vehiculoId={vehiculoId} />;
  }

  const summary = buildVehicleClientSummary(vehiculo, ordenes);
  const { preventivos } = summary;

  // Handler para exportar historial a CSV
  const handleExportCSV = () => {
    const csv = [
      ['OT', 'Tipo', 'Estado', 'Fecha', 'Kilometraje', 'Taller'].join(','),
      ...summary.historialMantenimientos.map(item =>
        [item.numeroOT, item.tipo, item.estado, item.fecha, item.kilometraje, item.taller].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_${summary.placa}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Truck className="size-8" />
              Hoja de Vida - {summary.placa}
            </h1>
            <p className="text-muted-foreground">Vista Cliente - Historial Completo</p>
          </div>
          <Button variant="outline" onClick={handleExportCSV} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
            <Download className="size-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Info básica (reutiliza contenido público) */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Vehículo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Placa</p>
                <p className="text-2xl font-bold">{summary.placa}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marca / Modelo</p>
                <p className="font-semibold">{summary.marca} {summary.modelo}</p>
                <p className="text-sm text-muted-foreground">Año {summary.año}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge variant={getEstadoBadge(summary.estado).variant}>
                  {getEstadoBadge(summary.estado).label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contadores de Preventivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              Plan de Mantenimientos Preventivos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Planificado</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{preventivos.total}</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Realizados</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{preventivos.usados}</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Restantes</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{preventivos.restantes}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Progreso del Plan</p>
                <p className="text-sm text-muted-foreground">{preventivos.porcentajeUso.toFixed(1)}%</p>
              </div>
              <Progress value={preventivos.porcentajeUso} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Historial de Mantenimientos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5" />
              Historial de Mantenimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.historialMantenimientos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OT</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Kilometraje</TableHead>
                    <TableHead>Taller</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.historialMantenimientos.map((item) => (
                    <TableRow key={item.numeroOT}>
                      <TableCell className="font-medium">{item.numeroOT}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.estado === 'cerrada' ? 'default' : 'secondary'}>
                          {item.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.fecha)}</TableCell>
                      <TableCell>{item.kilometraje.toLocaleString()} km</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.taller}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="size-12 mx-auto mb-2 opacity-50" />
                <p>No hay historial de mantenimientos registrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
