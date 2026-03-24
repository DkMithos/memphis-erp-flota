/**
 * LISTA DE EQUIPOS BIOMÉDICOS
 * Vista principal con tabla, filtros y KPIs
 * Production-ready siguiendo patrón enterprise
 */

import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter,
  Download,
  Activity,
  AlertCircle,
  TrendingUp,
  DollarSign
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
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { exportToPDF } from '../../../lib/shared/export-utils';
import { 
  EQUIPO_ESTADO_CONFIG,
  EQUIPO_CATEGORIA_CONFIG,
  EQUIPO_RIESGO_CONFIG,
  type EstadoEquipoBiomedico,
  type CategoriaEquipoBiomedico,
  type RiesgoBiomedico
} from '../../../lib/biomedico/equipos-config';

interface BiomedicoEquiposProps {
  onNavigateToNuevo?: () => void;
  onNavigateToDetalle?: (codigo: string) => void;
}

export function BiomedicoEquipos({ onNavigateToNuevo, onNavigateToDetalle }: BiomedicoEquiposProps) {
  const { equipos } = useEquiposStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoEquipoBiomedico | 'todos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaEquipoBiomedico | 'todos'>('todos');
  const [filtroRiesgo, setFiltroRiesgo] = useState<RiesgoBiomedico | 'todos'>('todos');

  const handleExportPDF = () => {
    exportToPDF(
      `equipos-biomedicos-${new Date().toISOString().slice(0, 10)}`,
      'Reporte de Equipos Biomédicos',
      equiposFiltrados,
      { codigo: 'Código', nombre: 'Nombre', marca: 'Marca', modelo: 'Modelo', categoria: 'Categoría', riesgo: 'Riesgo', estado: 'Estado' }
    );
  };

  // Filtrado de equipos
  const equiposFiltrados = useMemo(() => {
    return equipos.filter(equipo => {
      const matchSearch = searchTerm === '' || 
        equipo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipo.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipo.modelo.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchEstado = filtroEstado === 'todos' || equipo.estado === filtroEstado;
      const matchCategoria = filtroCategoria === 'todos' || equipo.categoria === filtroCategoria;
      const matchRiesgo = filtroRiesgo === 'todos' || equipo.riesgo === filtroRiesgo;
      
      return matchSearch && matchEstado && matchCategoria && matchRiesgo;
    });
  }, [equipos, searchTerm, filtroEstado, filtroCategoria, filtroRiesgo]);

  // KPIs calculados
  const kpis = useMemo(() => {
    const totalEquipos = equipos.length;
    const operativos = equipos.filter(eq => eq.estado === 'operativo').length;
    const enMantenimiento = equipos.filter(eq => eq.estado === 'mantenimiento' || eq.estado === 'calibracion').length;
    const criticosOperativos = equipos.filter(eq => eq.riesgo === 'critico' && eq.estado === 'operativo').length;
    const valorTotal = equipos.reduce((sum, eq) => sum + eq.costos.adquisicion, 0);
    const disponibilidad = totalEquipos > 0 ? (operativos / totalEquipos) * 100 : 0;

    return {
      totalEquipos,
      operativos,
      enMantenimiento,
      criticosOperativos,
      valorTotal,
      disponibilidad
    };
  }, [equipos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipos Biomédicos</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de inventario biomédico y activos médicos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="size-4 mr-2" />
            PDF
          </Button>
          <Button size="sm" onClick={onNavigateToNuevo}>
            <Plus className="size-4 mr-2" />
            Nuevo Equipo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equipos</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalEquipos}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.operativos} operativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibilidad</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.disponibilidad.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {kpis.enMantenimiento} en mantenimiento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos Operativos</CardTitle>
            <AlertCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.criticosOperativos}</div>
            <p className="text-xs text-muted-foreground">
              Riesgo crítico activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(kpis.valorTotal / 1000).toFixed(0)}K</div>
            <p className="text-xs text-muted-foreground">
              Activos biomédicos
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
                  placeholder="Buscar por nombre, código, marca o modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoEquipoBiomedico | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="operativo">Operativo</SelectItem>
                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                <SelectItem value="calibracion">Calibración</SelectItem>
                <SelectItem value="fuera_servicio">Fuera de Servicio</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroCategoria} onValueChange={(v) => setFiltroCategoria(v as CategoriaEquipoBiomedico | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las categorías</SelectItem>
                <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                <SelectItem value="terapeutico">Terapéutico</SelectItem>
                <SelectItem value="soporte_vital">Soporte Vital</SelectItem>
                <SelectItem value="laboratorio">Laboratorio</SelectItem>
                <SelectItem value="rehabilitacion">Rehabilitación</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroRiesgo} onValueChange={(v) => setFiltroRiesgo(v as RiesgoBiomedico | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Riesgo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los riesgos</SelectItem>
                <SelectItem value="bajo">Bajo</SelectItem>
                <SelectItem value="medio">Medio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de equipos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Equipos Registrados ({equiposFiltrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Riesgo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próx. Mant.</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equiposFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No se encontraron equipos
                  </TableCell>
                </TableRow>
              ) : (
                equiposFiltrados.map((equipo) => {
                  const estadoConfig = EQUIPO_ESTADO_CONFIG[equipo.estado];
                  const categoriaConfig = EQUIPO_CATEGORIA_CONFIG[equipo.categoria];
                  const riesgoConfig = EQUIPO_RIESGO_CONFIG[equipo.riesgo];
                  const Icon = estadoConfig.icon;
                  const CategoriaIcon = categoriaConfig.icon;
                  const RiesgoIcon = riesgoConfig.icon;

                  return (
                    <TableRow key={equipo.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {equipo.codigo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{equipo.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            {equipo.marca} {equipo.modelo}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={categoriaConfig.className}>
                          <CategoriaIcon className="size-3 mr-1" />
                          {categoriaConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{equipo.ubicacion.area}</span>
                          <span className="text-xs text-muted-foreground">
                            {equipo.ubicacion.subarea}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={riesgoConfig.variant} className={riesgoConfig.className}>
                          <RiesgoIcon className="size-3 mr-1" />
                          {riesgoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={estadoConfig.variant} className={estadoConfig.className}>
                          <Icon className="size-3 mr-1" />
                          {estadoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {equipo.fechaProximoMantenimiento}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onNavigateToDetalle?.(equipo.codigo)}
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
