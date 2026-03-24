import { useState } from 'react';
import { Car, Plus, Search, Filter, Eye, Wrench, FileText, MapPin, Download, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
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
import { EstadoVehiculo, TipoVehiculo, getEstadoBadge, getTipoBadge, calcularDiasProximoMantenimiento } from '../../../lib/flota/vehiculos-config';
import { usePagination } from '../../../lib/shared/usePagination';

interface VehiculosListaProps {
  onNavigate: (route: string) => void;
}

export function VehiculosLista({ onNavigate }: VehiculosListaProps) {
  const { vehiculos, buscarVehiculos } = useVehiculos();
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // Filtrar vehículos
  let vehiculosFiltrados = buscarVehiculos(busqueda);

  if (filtroTipo !== 'todos') {
    vehiculosFiltrados = vehiculosFiltrados.filter(v => v.tipo === filtroTipo);
  }

  if (filtroEstado !== 'todos') {
    vehiculosFiltrados = vehiculosFiltrados.filter(v => v.estado === filtroEstado);
  }

  // Ordenar por ID descendente (más recientes primero)
  vehiculosFiltrados = [...vehiculosFiltrados].sort((a, b) => {
    const numA = parseInt(a.id.replace('VH-', ''));
    const numB = parseInt(b.id.replace('VH-', ''));
    return numB - numA;
  });

  const { paged: vehiculosPaged, page, totalPages, totalItems: totalFiltrados, setPage } = usePagination(vehiculosFiltrados);

  // KPIs reales desde el store
  const totalVehiculos = vehiculos.length;
  const activos = vehiculos.filter(v => v.estado === 'activo').length;
  const enTaller = vehiculos.filter(v => v.estado === 'en_taller').length;
  const inactivos = vehiculos.filter(v => v.estado === 'inactivo').length;
  const kmPromedio = vehiculos.length > 0
    ? Math.round(vehiculos.reduce((sum, v) => sum + v.kilometraje, 0) / vehiculos.length)
    : 0;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo('todos');
    setFiltroEstado('todos');
  };

  const hayFiltrosActivos = busqueda !== '' || filtroTipo !== 'todos' || filtroEstado !== 'todos';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2">
            <Car className="size-6" />
            Gestión de Vehículos
          </h2>
          <p className="text-muted-foreground mt-1">
            Administración completa de la flota vehicular
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => onNavigate('/flota/vehiculos/nuevo')}>
            <Plus className="size-4 mr-2" />
            Nuevo Vehículo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Vehículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totalVehiculos}</div>
            <p className="text-xs text-muted-foreground mt-1">Flota completa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-green-600">{activos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalVehiculos > 0 ? ((activos / totalVehiculos) * 100).toFixed(1) : 0}% disponibilidad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">En Taller</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-yellow-600">{enTaller}</div>
            <p className="text-xs text-muted-foreground mt-1">Mantenimiento en curso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-600">{inactivos}</div>
            <p className="text-xs text-muted-foreground mt-1">Fuera de servicio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">KM Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kmPromedio.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Kilometraje promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, VIN, marca o modelo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de vehículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="ambulancia">Ambulancia</SelectItem>
                  <SelectItem value="camioneta">Camioneta</SelectItem>
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
                  <SelectItem value="en_taller">En Taller</SelectItem>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
              >
                <X className="size-4 mr-2" />
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
                <TableHead>ID</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Kilometraje</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Próx. Mant.</TableHead>
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
                  const diasProxMant = calcularDiasProximoMantenimiento(vehiculo.proximoMantenimiento);
                  
                  return (
                    <TableRow 
                      key={vehiculo.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => onNavigate(`/flota/vehiculos/${vehiculo.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{vehiculo.id}</TableCell>
                      <TableCell className="font-semibold">{vehiculo.placa}</TableCell>
                      <TableCell>
                        <Badge variant={tipoBadge.variant}>{tipoBadge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vehiculo.marca}</p>
                          <p className="text-xs text-muted-foreground">{vehiculo.modelo}</p>
                        </div>
                      </TableCell>
                      <TableCell>{vehiculo.año}</TableCell>
                      <TableCell>
                        <Badge variant={estadoBadge.variant}>
                          {estadoBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{vehiculo.kilometraje.toLocaleString()} km</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3 text-muted-foreground" />
                          <span className="text-sm">{vehiculo.ubicacionActual}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehiculo.proximoMantenimiento ? (
                          <div>
                            <p className="text-sm">{vehiculo.proximoMantenimiento}</p>
                            {diasProxMant !== null && (
                              <p className={`text-xs ${
                                diasProxMant < 0 ? 'text-red-600' :
                                diasProxMant <= 7 ? 'text-yellow-600' :
                                'text-muted-foreground'
                              }`}>
                                {diasProxMant < 0 
                                  ? `${Math.abs(diasProxMant)}d vencido` 
                                  : diasProxMant === 0 
                                  ? 'Hoy' 
                                  : `${diasProxMant}d restantes`
                                }
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No programado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(`/flota/vehiculos/${vehiculo.id}`);
                            }}
                            title="Ver detalle"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(`/flota/mantenimientos/nueva?vehiculo=${vehiculo.id}`);
                            }}
                            title="Nueva OT"
                          >
                            <Wrench className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(`/flota/vehiculos/${vehiculo.id}/documentos`);
                            }}
                            title="Documentos"
                          >
                            <FileText className="size-4" />
                          </Button>
                        </div>
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
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
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
