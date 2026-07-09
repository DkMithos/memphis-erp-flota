import { useState } from 'react';
import { Car, Plus, Search, Eye, MapPin, X, CheckCircle2, PowerOff, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
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
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useFlotas } from '../../../lib/flota/flotas-store';
import { getEstadoBadge, getTipoBadge } from '../../../lib/flota/vehiculos-config';
import { usePagination } from '../../../lib/shared/usePagination';

interface VehiculosListaProps {
  onNavigate: (route: string) => void;
}

export function VehiculosLista({ onNavigate }: VehiculosListaProps) {
  const { vehiculos } = useVehiculos();
  const { flotas } = useFlotas();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroFlota, setFiltroFlota] = useState<string>('todas');

  let vehiculosFiltrados = vehiculos.filter(v => {
    if (filtroTipo !== 'todos' && v.tipo !== filtroTipo) return false;
    if (filtroEstado !== 'todos' && v.estado !== filtroEstado) return false;
    if (filtroFlota === 'administrativos') {
      if (!v.esAdministrativo) return false;
    } else if (filtroFlota !== 'todas' && v.flotaId !== filtroFlota) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (![v.placa, v.placaInterna, v.vin, v.numeroPadron, v.id, v.marca, v.modelo]
        .some(x => x && String(x).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Orden: padrón/placa (numérico natural)
  vehiculosFiltrados = [...vehiculosFiltrados].sort((a, b) =>
    (a.numeroPadron ?? a.placa ?? a.id).localeCompare(b.numeroPadron ?? b.placa ?? b.id, 'es', { numeric: true })
  );

  const { paged: vehiculosPaged, page, totalPages, totalItems: totalFiltrados, setPage } = usePagination(vehiculosFiltrados);

  const totalVehiculos = vehiculos.length;
  const activos = vehiculos.filter(v => v.estado === 'activo').length;
  const inactivos = vehiculos.filter(v => v.estado === 'inactivo').length;
  const sinPlaca = vehiculos.filter(v => v.estado === 'activo' && !v.placa).length;

  const nombreFlota = (flotaId: string | null | undefined) =>
    flotas.find(f => f.id === flotaId)?.nombre ?? null;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo('todos');
    setFiltroEstado('todos');
    setFiltroFlota('todas');
  };

  const hayFiltrosActivos = busqueda !== '' || filtroTipo !== 'todos' || filtroEstado !== 'todos' || filtroFlota !== 'todas';

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
            <h2 className="text-2xl font-semibold">Vehículos</h2>
            <p className="text-muted-foreground mt-1">
              Unidades por flota y vehículos administrativos (VIN primero, placa después)
            </p>
          </div>
        </div>

        <Button onClick={() => onNavigate('/flota/vehiculos/nuevo')}>
          <Plus className="size-4" />
          Nuevo Vehículo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Car className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Vehículos</p>
              <p className="text-2xl font-bold">{totalVehiculos}</p>
              <p className="text-xs text-muted-foreground mt-1">Todas las flotas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold">{activos}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalVehiculos > 0 ? ((activos / totalVehiculos) * 100).toFixed(1) : 0}% del total
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
              <Gauge className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sin placa (VIN)</p>
              <p className="text-2xl font-bold">{sinPlaca}</p>
              <p className="text-xs text-muted-foreground mt-1">Trámite de placa en curso</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
              <PowerOff className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Inactivos</p>
              <p className="text-2xl font-bold">{inactivos}</p>
              <p className="text-xs text-muted-foreground mt-1">Fuera del padrón</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, VIN, padrón, marca o modelo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Select value={filtroFlota} onValueChange={setFiltroFlota}>
                <SelectTrigger>
                  <SelectValue placeholder="Flota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las flotas</SelectItem>
                  {flotas.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                  ))}
                  <SelectItem value="administrativos">Administrativos (Memphis)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de vehículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="camioneta">Camioneta</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="ambulancia">Ambulancia</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando <strong>{totalFiltrados}</strong> de <strong>{totalVehiculos}</strong> vehículos
            </p>
            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                <X className="size-4" />
                Limpiar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de vehículos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vehículos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrón</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Flota</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Kilometraje</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalFiltrados === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {hayFiltrosActivos
                      ? 'No se encontraron vehículos con los filtros aplicados'
                      : 'No hay vehículos registrados. Crea el primero usando el botón "Nuevo Vehículo"'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                vehiculosPaged.map((vehiculo) => {
                  const estadoBadge = getEstadoBadge(vehiculo.estado);
                  const tipoBadge = getTipoBadge(vehiculo.tipo);
                  const flotaNombre = vehiculo.esAdministrativo
                    ? 'Administrativo'
                    : nombreFlota(vehiculo.flotaId);

                  return (
                    <TableRow
                      key={vehiculo.id}
                      className="cursor-pointer hover:!bg-slate-100 dark:hover:!bg-accent/50"
                      onClick={() => onNavigate(`/flota/vehiculos/${vehiculo.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{vehiculo.numeroPadron ?? '—'}</TableCell>
                      <TableCell>
                        <p className="font-semibold">{vehiculo.placa || 'Sin placa'}</p>
                        {vehiculo.placaInterna && (
                          <p className="text-xs text-muted-foreground">{vehiculo.placaInterna}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{vehiculo.vin ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tipoBadge.variant}>{tipoBadge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vehiculo.marca}</p>
                          <p className="text-xs text-muted-foreground">{vehiculo.modelo}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{flotaNombre ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={estadoBadge.variant}>
                          {estadoBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{vehiculo.kilometraje.toLocaleString()} km</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 max-w-48">
                          <MapPin className="size-3 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate" title={vehiculo.ubicacionActual}>{vehiculo.ubicacionActual}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/flota/vehiculos/${vehiculo.id}`);
                          }}
                          title="Ver detalle"
                          className="hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
