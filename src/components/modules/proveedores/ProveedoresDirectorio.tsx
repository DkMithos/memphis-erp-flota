import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, XCircle, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import { useProveedorStore } from '../../../lib/proveedores/proveedores-store';
import { useAuth } from '../../../auth/AuthProvider';
import {
  PROVEEDOR_ESTADO_CONFIG,
  PROVEEDOR_CONDICION_CONFIG,
  PROVEEDOR_TIPO_CONFIG,
  PROVEEDOR_CATEGORIA_LABELS,
  tienePermiso,
  type EstadoProveedor,
  type TipoProveedor,
  type CategoriaProveedor,
  type RolUsuario
} from '../../../lib/proveedores/proveedores-config';

interface ProveedoresDirectorioProps {
  onNavigate?: (route: string) => void;
}

export function ProveedoresDirectorio({ onNavigate }: ProveedoresDirectorioProps) {
  const { proveedores } = useProveedorStore();
  const { profile } = useAuth();
  const rolActual = (profile?.rol ?? 'operaciones') as RolUsuario;
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoProveedor | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoProveedor | 'todos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaProveedor | 'todos'>('todos');

  // Proveedores filtrados
  const proveedoresFiltrados = useMemo(() => {
    return proveedores.filter(p => {
      // Búsqueda por texto
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        p.razonSocial.toLowerCase().includes(searchLower) ||
        p.ruc.includes(searchLower) ||
        p.nombreComercial?.toLowerCase().includes(searchLower) ||
        p.email.toLowerCase().includes(searchLower);

      // Filtro por estado
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;

      // Filtro por tipo
      const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;

      // Filtro por categoría
      const matchCategoria = filtroCategoria === 'todos' || p.categorias.includes(filtroCategoria);

      return matchSearch && matchEstado && matchTipo && matchCategoria;
    });
  }, [proveedores, searchTerm, filtroEstado, filtroTipo, filtroCategoria]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: proveedores.length,
    activos: proveedores.filter(p => p.estado === 'activo').length,
    inactivos: proveedores.filter(p => p.estado === 'inactivo').length,
    observados: proveedores.filter(p => p.estado === 'observado').length
  }), [proveedores]);

  const puedeCrear = tienePermiso(rolActual, 'crear');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Building2 className="size-6 text-primary" />
          </div>
          <div>
            <h2>Directorio de Proveedores</h2>
            <p className="text-muted-foreground mt-1">
              Catálogo de proveedores homologados y en evaluación
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeCrear && (
            <Button onClick={() => onNavigate?.('/proveedores/directorio/nuevo')}>
              <Plus className="size-4 mr-2" />
              Nuevo Proveedor
            </Button>
          )}
          <Button variant="outline" onClick={() => {}}>
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{stats.activos}</div>
            <p className="text-xs text-muted-foreground mt-1">Operativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Observados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-yellow-600">{stats.observados}</div>
            <p className="text-xs text-muted-foreground mt-1">En evaluación</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-600">{stats.inactivos}</div>
            <p className="text-xs text-muted-foreground mt-1">Fuera de operación</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Búsqueda por texto */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por RUC, razón social o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtro por Estado */}
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoProveedor | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="observado">Observado</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Tipo */}
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoProveedor | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Tipos</SelectItem>
                <SelectItem value="bienes">Bienes</SelectItem>
                <SelectItem value="servicios">Servicios</SelectItem>
                <SelectItem value="mixto">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Categoría */}
          <div className="mt-4">
            <Select value={filtroCategoria} onValueChange={(v) => setFiltroCategoria(v as CategoriaProveedor | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las Categorías</SelectItem>
                {Object.entries(PROVEEDOR_CATEGORIA_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resumen de filtros activos */}
          {(searchTerm || filtroEstado !== 'todos' || filtroTipo !== 'todos' || filtroCategoria !== 'todos') && (
            <Alert className="mt-4">
              <AlertDescription>
                Mostrando <strong>{proveedoresFiltrados.length}</strong> de <strong>{proveedores.length}</strong> proveedores
                {searchTerm && ` • Búsqueda: "${searchTerm}"`}
                {filtroEstado !== 'todos' && ` • Estado: ${filtroEstado}`}
                {filtroTipo !== 'todos' && ` • Tipo: ${filtroTipo}`}
                {filtroCategoria !== 'todos' && ` • Categoría: ${PROVEEDOR_CATEGORIA_LABELS[filtroCategoria]}`}
                <Button 
                  variant="link" 
                  size="sm" 
                  className="ml-2 h-auto p-0"
                  onClick={() => {
                    setSearchTerm('');
                    setFiltroEstado('todos');
                    setFiltroTipo('todos');
                    setFiltroCategoria('todos');
                  }}
                >
                  Limpiar filtros
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabla de Proveedores */}
      <Card>
        <CardHeader>
          <CardTitle>Proveedores ({proveedoresFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proveedoresFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="size-16 mx-auto mb-4 opacity-20" />
              <h3 className="font-medium text-foreground mb-2">No se encontraron proveedores</h3>
              <p className="text-sm">
                {searchTerm || filtroEstado !== 'todos' || filtroTipo !== 'todos' || filtroCategoria !== 'todos'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : puedeCrear 
                    ? 'Comienza agregando el primer proveedor al sistema'
                    : 'No hay proveedores registrados en el sistema'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RUC</TableHead>
                  <TableHead>Razón Social</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categorías</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proveedoresFiltrados.map((proveedor) => {
                  const estadoConfig = PROVEEDOR_ESTADO_CONFIG[proveedor.estado];
                  const condicionConfig = PROVEEDOR_CONDICION_CONFIG[proveedor.condicion];
                  const tipoConfig = PROVEEDOR_TIPO_CONFIG[proveedor.tipo];
                  const puedeEditar = tienePermiso(rolActual, 'editar');

                  return (
                    <TableRow key={proveedor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.(`/proveedores/directorio/${proveedor.id}`)}>
                      <TableCell className="font-mono text-sm">{proveedor.ruc}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{proveedor.razonSocial}</p>
                          {proveedor.nombreComercial && (
                            <p className="text-xs text-muted-foreground">{proveedor.nombreComercial}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={tipoConfig.className}>{tipoConfig.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {proveedor.categorias.slice(0, 2).map(cat => (
                            <Badge key={cat} variant="outline" className="text-xs">
                              {PROVEEDOR_CATEGORIA_LABELS[cat].split(' ')[0]}
                            </Badge>
                          ))}
                          {proveedor.categorias.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{proveedor.categorias.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={estadoConfig.className}>
                          <estadoConfig.icon className="size-3 mr-1" />
                          {estadoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={condicionConfig.className}>
                          {condicionConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-mono text-xs">{proveedor.telefono}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{proveedor.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onNavigate?.(`/proveedores/directorio/${proveedor.id}`)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {puedeEditar && proveedor.estado !== 'inactivo' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => onNavigate?.(`/proveedores/directorio/${proveedor.id}/editar`)}
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
