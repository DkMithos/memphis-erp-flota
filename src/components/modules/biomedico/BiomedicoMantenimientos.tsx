/**
 * LISTA DE MANTENIMIENTOS BIOMÉDICOS
 * Vista principal con tabla, filtros y KPIs
 * Production-ready siguiendo patrón enterprise
 */

import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter,
  Download,
  Wrench,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
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
import { useMantenimientosStore } from '../../../lib/biomedico/mantenimientos-store';
import { 
  MANTENIMIENTO_ESTADO_CONFIG,
  MANTENIMIENTO_TIPO_CONFIG,
  MANTENIMIENTO_PRIORIDAD_CONFIG,
  type EstadoMantenimientoBio,
  type TipoMantenimientoBio,
  type PrioridadMantenimientoBio
} from '../../../lib/biomedico/mantenimientos-config';

interface BiomedicoMantenimientosProps {
  onNavigateToNuevo?: () => void;
  onNavigateToDetalle?: (numero: string) => void;
}

export function BiomedicoMantenimientos({ 
  onNavigateToNuevo, 
  onNavigateToDetalle 
}: BiomedicoMantenimientosProps) {
  const { mantenimientos } = useMantenimientosStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoMantenimientoBio | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoMantenimientoBio | 'todos'>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadMantenimientoBio | 'todos'>('todos');

  // Filtrado de mantenimientos
  const mantenimientosFiltrados = useMemo(() => {
    return mantenimientos.filter(mant => {
      const matchSearch = searchTerm === '' || 
        mant.numeroMantenimiento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mant.equipoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mant.equipoCodigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mant.titulo.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchEstado = filtroEstado === 'todos' || mant.estado === filtroEstado;
      const matchTipo = filtroTipo === 'todos' || mant.tipo === filtroTipo;
      const matchPrioridad = filtroPrioridad === 'todos' || mant.prioridad === filtroPrioridad;
      
      return matchSearch && matchEstado && matchTipo && matchPrioridad;
    });
  }, [mantenimientos, searchTerm, filtroEstado, filtroTipo, filtroPrioridad]);

  // KPIs calculados
  const kpis = useMemo(() => {
    const total = mantenimientos.length;
    const programados = mantenimientos.filter(m => m.estado === 'programado').length;
    const enEjecucion = mantenimientos.filter(m => m.estado === 'en_ejecucion').length;
    const completados = mantenimientos.filter(m => m.estado === 'completado').length;
    const tasaCompletados = total > 0 ? (completados / total) * 100 : 0;

    return {
      total,
      programados,
      enEjecucion,
      completados,
      tasaCompletados
    };
  }, [mantenimientos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mantenimientos Biomédicos</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de mantenimientos preventivos, correctivos y calibraciones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            Exportar
          </Button>
          <Button size="sm" onClick={onNavigateToNuevo}>
            <Plus className="size-4" />
            Nuevo Mantenimiento
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mantenimientos</CardTitle>
            <Wrench className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
            <p className="text-xs text-muted-foreground">
              Registrados en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programados</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.programados}</div>
            <p className="text-xs text-muted-foreground">
              Pendientes de ejecución
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Ejecución</CardTitle>
            <AlertCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.enEjecucion}</div>
            <p className="text-xs text-muted-foreground">
              Actualmente en proceso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Completados</CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.tasaCompletados.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {kpis.completados} finalizados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, equipo o título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoMantenimientoBio | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <Filter className="size-4" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="programado">Programado</SelectItem>
                <SelectItem value="en_ejecucion">En Ejecución</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoMantenimientoBio | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="preventivo">Preventivo</SelectItem>
                <SelectItem value="correctivo">Correctivo</SelectItem>
                <SelectItem value="calibracion">Calibración</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroPrioridad} onValueChange={(v) => setFiltroPrioridad(v as PrioridadMantenimientoBio | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las prioridades</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de mantenimientos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Mantenimientos Registrados ({mantenimientosFiltrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Prog.</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mantenimientosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No se encontraron mantenimientos
                  </TableCell>
                </TableRow>
              ) : (
                mantenimientosFiltrados.map((mant) => {
                  const estadoConfig = MANTENIMIENTO_ESTADO_CONFIG[mant.estado];
                  const tipoConfig = MANTENIMIENTO_TIPO_CONFIG[mant.tipo];
                  const prioridadConfig = MANTENIMIENTO_PRIORIDAD_CONFIG[mant.prioridad];
                  const EstadoIcon = estadoConfig.icon;
                  const PrioridadIcon = prioridadConfig.icon;

                  return (
                    <TableRow key={mant.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {mant.numeroMantenimiento}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{mant.equipoNombre}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {mant.equipoCodigo}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={tipoConfig.className}>
                          {tipoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={prioridadConfig.variant} className={prioridadConfig.className}>
                          <PrioridadIcon className="size-3" />
                          {prioridadConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={estadoConfig.variant} className={estadoConfig.className}>
                          <EstadoIcon className="size-3" />
                          {estadoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {mant.fechaProgramada}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{mant.tecnico.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            {mant.tecnico.empresa}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onNavigateToDetalle?.(mant.numeroMantenimiento)}
                        >
                          Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
