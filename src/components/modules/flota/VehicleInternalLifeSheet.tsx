/**
 * VEHICLE INTERNAL LIFE SHEET
 * Vista interna completa con costos, extras, auditoría y timeline
 */

import { Truck, DollarSign, Clock, Calendar, Plus, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { buildVehicleInternalSummary, formatDateTime } from '../../../lib/flota/vehicle-lifecycle';
import { formatCurrency } from '../../../lib/flota/metrics';
import { VehicleClientLifeSheet } from './VehicleClientLifeSheet';

interface VehicleInternalLifeSheetProps {
  vehiculoId: string;
  onNavigate: (route: string) => void;
}

export function VehicleInternalLifeSheet({ vehiculoId, onNavigate }: VehicleInternalLifeSheetProps) {
  const { obtenerVehiculo } = useVehiculos();
  const { ordenes } = useOTStore();

  const vehiculo = obtenerVehiculo(vehiculoId);

  if (!vehiculo) {
    return <VehicleClientLifeSheet vehiculoId={vehiculoId} onNavigate={onNavigate} />;
  }

  const summary = buildVehicleInternalSummary(vehiculo, ordenes);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header con acciones */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Truck className="size-8" />
              Hoja de Vida - {summary.placa}
            </h1>
            <p className="text-muted-foreground">Vista Interna - Acceso Completo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onNavigate('/flota/vehiculos')}>
              <FileText className="size-4 mr-2" />
              Ir a Vehículos
            </Button>
            <Button onClick={() => onNavigate(`/flota/mantenimientos/nueva?vehiculo=${vehiculoId}`)}>
              <Plus className="size-4 mr-2" />
              Nueva OT
            </Button>
          </div>
        </div>

        {/* Info del cliente (reutiliza componente) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Información del Vehículo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Placa</p>
                  <p className="font-semibold text-lg">{summary.placa}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Marca / Modelo</p>
                  <p className="font-semibold">{summary.marca} {summary.modelo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge>{summary.estado}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Kilometraje</p>
                  <p className="font-semibold">{summary.kilometraje?.toLocaleString()} km</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Costos Totales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Costos Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(summary.costosTotales)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Todas las OTs</p>
            </CardContent>
          </Card>
        </div>

        {/* Preventivos */}
        <Card>
          <CardHeader>
            <CardTitle>Plan de Preventivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded">
                <p className="text-2xl font-bold text-blue-600">{summary.preventivos.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded">
                <p className="text-2xl font-bold text-green-600">{summary.preventivos.usados}</p>
                <p className="text-sm text-muted-foreground">Usados</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded">
                <p className="text-2xl font-bold text-yellow-600">{summary.preventivos.restantes}</p>
                <p className="text-sm text-muted-foreground">Restantes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Timeline Completo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.timeline.map((item, index) => (
                <div key={index} className="flex gap-4 border-l-2 border-muted pl-4 pb-4 last:pb-0">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.descripcion}</p>
                        {item.numeroOT && (
                          <Badge variant="outline" className="mt-1">{item.numeroOT}</Badge>
                        )}
                      </div>
                      {item.costo !== undefined && (
                        <p className="font-semibold text-red-600">{formatCurrency(item.costo)}</p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      <Calendar className="size-3 inline mr-1" />
                      {formatDateTime(item.fecha)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Auditoría */}
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle className="text-sm">Auditoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Creado por</p>
                <p className="font-medium">{summary.auditoria.creadoPor}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(summary.auditoria.creadoEn)}</p>
              </div>
              {summary.auditoria.modificadoPor && (
                <div>
                  <p className="text-muted-foreground">Modificado por</p>
                  <p className="font-medium">{summary.auditoria.modificadoPor}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(summary.auditoria.modificadoEn!)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}