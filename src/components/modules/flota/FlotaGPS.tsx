/**
 * Memphis ERP - Flota → Monitoreo GPS
 * Página de monitoreo en tiempo real con mapa interactivo (react-leaflet).
 */

import React, { useEffect, useState } from 'react';
import { useGPSStore, type UltimaPos, type HistorialPunto } from '../../../lib/flota/gps-store';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  MapPin,
  RefreshCw,
  Wifi,
  WifiOff,
  Gauge,
  Clock,
  Car,
  Navigation,
  AlertCircle,
  List,
  Map,
} from 'lucide-react';
import { toast } from 'sonner';
import { MapaLeaflet, iconVerde, iconAmarillo, iconRojo, type MapaMarcador } from '../../ui/MapaLeaflet';

interface FlotaGPSProps {
  onNavigate: (route: string) => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatMins(mins: number): string {
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `hace ${h}h ${m}min` : `hace ${h}h`;
}

function formatHora(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLastSync(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// ─── badge de estado ──────────────────────────────────────────────────────────

function EstadoBadge({ pos }: { pos: UltimaPos }) {
  if (pos.sinSenal) {
    return <Badge variant="destructive" className="text-xs">Sin señal</Badge>;
  }
  if (pos.estaMoviendo) {
    return <Badge className="text-xs bg-green-600 hover:bg-green-700 text-white">En movimiento</Badge>;
  }
  return <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white">Detenido</Badge>;
}

// ─── Card de vehículo ─────────────────────────────────────────────────────────

interface VehiculoCardProps {
  pos: UltimaPos;
  onClick: () => void;
}

function VehiculoCard({ pos, onClick }: VehiculoCardProps) {
  const borderColor = pos.sinSenal
    ? 'border-red-200 dark:border-red-800'
    : pos.estaMoviendo
    ? 'border-green-200 dark:border-green-800'
    : 'border-yellow-200 dark:border-yellow-800';

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${borderColor}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-base">{pos.vehiculoPlaca}</p>
            <p className="text-xs text-muted-foreground">{pos.vehiculoCodigo}</p>
            {(pos.vehiculoMarca || pos.vehiculoModelo) && (
              <p className="text-xs text-muted-foreground">
                {[pos.vehiculoMarca, pos.vehiculoModelo].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
          <EstadoBadge pos={pos} />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm">
            <Gauge className="size-4 text-muted-foreground" />
            <span>{Math.round(pos.velocidad)} km/h</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            {pos.ignicion ? (
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-green-500" />
                Encendido
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-red-500" />
                Apagado
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" />
          <span>{formatMins(pos.minutosDesdeUltima)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Navigation className="size-3" />
            <span>{pos.latitud.toFixed(5)}, {pos.longitud.toFixed(5)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-primary"
            onClick={(e) => {
              e.stopPropagation();
              window.open(mapsLink(pos.latitud, pos.longitud), '_blank');
            }}
          >
            <MapPin className="size-3" />
            Ver mapa
          </Button>
        </div>

        {pos.evento && (
          <p className="text-xs text-muted-foreground truncate">{pos.evento}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dialog de historial ──────────────────────────────────────────────────────

interface HistorialDialogProps {
  pos: UltimaPos | null;
  open: boolean;
  onClose: () => void;
  cargarHistorial: (vehiculoId: string, desde: string, hasta: string) => Promise<HistorialPunto[]>;
}

function HistorialDialog({ pos, open, onClose, cargarHistorial }: HistorialDialogProps) {
  const [historial, setHistorial] = useState<HistorialPunto[]>([]);
  const [loadingH, setLoadingH] = useState(false);

  useEffect(() => {
    if (!open || !pos) return;

    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(hoy);
    hasta.setHours(23, 59, 59, 999);

    setLoadingH(true);
    cargarHistorial(pos.vehiculoId, desde.toISOString(), hasta.toISOString())
      .then(setHistorial)
      .finally(() => setLoadingH(false));
  }, [open, pos, cargarHistorial]);

  if (!pos) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Historial del día — {pos.vehiculoPlaca} ({pos.vehiculoCodigo})
          </DialogTitle>
        </DialogHeader>

        {loadingH ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando historial...</div>
        ) : historial.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay registros GPS para hoy en este vehículo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">Hora</th>
                  <th className="pb-2 pr-4 font-medium">Velocidad</th>
                  <th className="pb-2 pr-4 font-medium">Evento</th>
                  <th className="pb-2 font-medium">Coordenadas</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((punto, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                      {formatHora(punto.fechaDispositivo)}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {punto.velocidad != null ? `${Math.round(punto.velocidad)} km/h` : '—'}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {punto.evento ?? '—'}
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-primary"
                        onClick={() => window.open(mapsLink(punto.latitud, punto.longitud), '_blank')}
                      >
                        <MapPin className="size-3" />
                        {punto.latitud.toFixed(5)}, {punto.longitud.toFixed(5)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Mapa GPS ─────────────────────────────────────────────────────────────────

function MapaGPS({ posiciones, onVehiculoClick }: {
  posiciones: UltimaPos[];
  onVehiculoClick: (pos: UltimaPos) => void;
}) {
  const marcadores: MapaMarcador[] = posiciones.map(pos => ({
    id: pos.vehiculoId,
    lat: pos.latitud,
    lng: pos.longitud,
    icon: pos.sinSenal ? iconRojo : pos.estaMoviendo ? iconVerde : iconAmarillo,
    popupContent: (
      <div className="min-w-[160px] text-sm">
        <p className="font-semibold">{pos.vehiculoPlaca}</p>
        <p className="text-gray-500 text-xs">{pos.vehiculoCodigo}</p>
        {(pos.vehiculoMarca || pos.vehiculoModelo) && (
          <p className="text-gray-500 text-xs">{[pos.vehiculoMarca, pos.vehiculoModelo].filter(Boolean).join(' ')}</p>
        )}
        <p className="mt-1">{Math.round(pos.velocidad)} km/h · {pos.ignicion ? 'Encendido' : 'Apagado'}</p>
        <p className="text-gray-500 text-xs">{formatMins(pos.minutosDesdeUltima)}</p>
        <button
          className="mt-2 text-blue-600 text-xs underline"
          onClick={() => onVehiculoClick(pos)}
        >
          Ver historial
        </button>
      </div>
    ),
  }));

  if (marcadores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Map className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sin posiciones GPS para mostrar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Mapa en tiempo real</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-full bg-green-500" /> En movimiento</span>
            <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-full bg-yellow-500" /> Detenido</span>
            <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-full bg-red-500" /> Sin señal</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-0">
        <MapaLeaflet marcadores={marcadores} height="520px" className="rounded-b-lg rounded-t-none border-0" />
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function FlotaGPS({ onNavigate: _onNavigate }: FlotaGPSProps) {
  const { ultimasPosiciones, loading, lastSync, cargarPosiciones, cargarHistorial } = useGPSStore();
  const [selectedPos, setSelectedPos] = useState<UltimaPos | null>(null);
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'mapa'>('mapa');

  useEffect(() => {
    cargarPosiciones();
  }, [cargarPosiciones]);

  const handleActualizar = async () => {
    await cargarPosiciones();
    toast.success('Posiciones actualizadas');
  };

  const conSenal = ultimasPosiciones.filter((p) => !p.sinSenal).length;
  const enMovimiento = ultimasPosiciones.filter((p) => p.estaMoviendo && !p.sinSenal).length;
  const detenidosEncendidos = ultimasPosiciones.filter(
    (p) => !p.estaMoviendo && p.ignicion && !p.sinSenal,
  ).length;
  const sinSenal = ultimasPosiciones.filter((p) => p.sinSenal).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Monitoreo GPS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ultimasPosiciones.length} vehículo{ultimasPosiciones.length !== 1 ? 's' : ''} con datos GPS
            {lastSync && (
              <span className="ml-2 text-xs">· Último sync: {formatLastSync(lastSync)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={vistaActiva === 'mapa' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setVistaActiva('mapa')}
            >
              <Map className="size-4" />
              Mapa
            </Button>
            <Button
              variant={vistaActiva === 'lista' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setVistaActiva('lista')}
            >
              <List className="size-4" />
              Lista
            </Button>
          </div>
          <Button onClick={handleActualizar} disabled={loading} className="gap-2">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Wifi className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conSenal}</p>
                <p className="text-xs text-muted-foreground">Con señal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Car className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enMovimiento}</p>
                <p className="text-xs text-muted-foreground">En movimiento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Gauge className="size-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{detenidosEncendidos}</p>
                <p className="text-xs text-muted-foreground">Detenidos encendidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <WifiOff className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sinSenal}</p>
                <p className="text-xs text-muted-foreground">Sin señal (&gt;30 min)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido según vista */}
      {loading && ultimasPosiciones.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando posiciones GPS...
        </div>
      ) : ultimasPosiciones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium">Sin dispositivos GPS registrados</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure los dispositivos en el panel de vehículos para ver el monitoreo.
            </p>
          </CardContent>
        </Card>
      ) : vistaActiva === 'mapa' ? (
        <MapaGPS posiciones={ultimasPosiciones} onVehiculoClick={setSelectedPos} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ultimasPosiciones.map((pos) => (
            <VehiculoCard
              key={pos.vehiculoId}
              pos={pos}
              onClick={() => setSelectedPos(pos)}
            />
          ))}
        </div>
      )}

      {/* Dialog historial */}
      <HistorialDialog
        pos={selectedPos}
        open={selectedPos !== null}
        onClose={() => setSelectedPos(null)}
        cargarHistorial={cargarHistorial}
      />
    </div>
  );
}
