import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, XCircle, Building2, CheckCircle, Clock, Settings2, AlertCircle, UserX, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
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
import { usePagination } from '../../../lib/shared/usePagination';
import { exportToCSV } from '../../../lib/shared/export-utils';
import {
  PROVEEDOR_ESTADO_CONFIG,
  PROVEEDOR_CONDICION_CONFIG,
  PROVEEDOR_TIPO_CONFIG,
  PROVEEDOR_CATEGORIA_LABELS,
  tienePermiso,
  type EstadoProveedor,
  type TipoProveedor,
  type RolUsuario
} from '../../../lib/proveedores/proveedores-config';
import { toast } from 'sonner';

interface ProveedoresDirectorioProps {
  onNavigate?: (route: string) => void;
}

export function ProveedoresDirectorio({ onNavigate }: ProveedoresDirectorioProps) {
  const { proveedores, aprobarProveedor, rechazarProveedor } = useProveedorStore();
  const categorias = Object.entries(PROVEEDOR_CATEGORIA_LABELS).map(([key, label]) => ({ key, label }));
  const { profile, user } = useAuth();
  const jwtRole = user?.app_metadata?.role as string | undefined;
  const rolActual = (profile?.rol ?? jwtRole ?? 'operaciones') as RolUsuario;

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoProveedor | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoProveedor | 'todos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Proveedores filtrados
  const proveedoresFiltrados = useMemo(() => {
    return proveedores.filter(p => {
      // Búsqueda por texto
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        p.razonSocial.toLowerCase().includes(searchLower) ||
        p.ruc.includes(searchLower) ||
        p.nombreComercial?.toLowerCase().includes(searchLower) ||
        (p.email ?? '').toLowerCase().includes(searchLower);

      // Filtro por estado
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;

      // Filtro por tipo
      const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;

      // Filtro por categoría
      const matchCategoria = filtroCategoria === 'todos' || p.categorias.includes(filtroCategoria);

      return matchSearch && matchEstado && matchTipo && matchCategoria;
    });
  }, [proveedores, searchTerm, filtroEstado, filtroTipo, filtroCategoria]);

  const {
    paged: proveedoresPaged, page: provPage, totalPages: provTotalPages, setPage: setProvPage,
  } = usePagination(proveedoresFiltrados);

  // Estadísticas
  const stats = useMemo(() => ({
    total: proveedores.length,
    activos: proveedores.filter(p => p.estado === 'activo').length,
    inactivos: proveedores.filter(p => p.estado === 'inactivo').length,
    observados: proveedores.filter(p => p.estado === 'observado').length,
    enEvaluacion: proveedores.filter(p => p.estado === 'en_evaluacion').length,
  }), [proveedores]);

  const puedeAprobar = tienePermiso(rolActual, 'aprobar');

  const puedeCrear = tienePermiso(rolActual, 'crear');

  const handleExportar = () => {
    exportToCSV(`proveedores-${new Date().toISOString().slice(0, 10)}`, proveedoresFiltrados, {
      id: 'Código',
      razonSocial: 'Razón Social',
      ruc: 'RUC',
      tipo: 'Tipo',
      estado: 'Estado',
      email: 'Email',
      telefono: 'Teléfono',
      distrito: 'Distrito',
      departamento: 'Departamento',
    } as any);
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Building2 className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2>Directorio de Proveedores</h2>
            <p className="text-muted-foreground mt-1">
              Catálogo de proveedores homologados y en evaluación
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeAprobar && (
            <Button variant="outline" size="sm" onClick={() => onNavigate?.('/proveedores/categorias')} className="hover:!bg-black hover:!text-white hover:!border-black">
              <Settings2 className="size-4" />
              Categorías
            </Button>
          )}
          {puedeCrear && (
            <Button onClick={() => onNavigate?.('/proveedores/directorio/nuevo')}>
              <Plus className="size-4" />
              Nuevo Proveedor
            </Button>
          )}
          <Button variant="outline" onClick={handleExportar} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
            <Download className="size-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats KPI — mismo patrón que los KPIs del Home */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Proveedores', value: stats.total, sub: 'Registrados', icon: Building2, bg: 'bg-blue-500' },
          { label: 'Activos', value: stats.activos, sub: 'Operativos', icon: CheckCircle, bg: 'bg-green-500' },
          { label: 'Observados', value: stats.observados, sub: 'En evaluación', icon: AlertCircle, bg: 'bg-amber-500' },
          { label: 'Inactivos', value: stats.inactivos, sub: 'Fuera de operación', icon: UserX, bg: 'bg-slate-500' },
          { label: 'En Evaluación', value: stats.enEvaluacion, sub: 'Pendiente aprobación', icon: Clock, bg: 'bg-indigo-500' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3"
            style={{ border: '1px solid #64748B' }}
          >
            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>
              <stat.icon className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
            </div>
          </div>
        ))}
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
                <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
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
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las Categorías</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
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
                {filtroCategoria !== 'todos' && ` • Categoría: ${categorias.find(c => c.key === filtroCategoria)?.label ?? filtroCategoria}`}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3 gap-1.5 !bg-transparent !text-black !border-black hover:!bg-[#f0c000] hover:!text-black hover:!border-black"
                  onClick={() => {
                    setSearchTerm('');
                    setFiltroEstado('todos');
                    setFiltroTipo('todos');
                    setFiltroCategoria('todos');
                  }}
                >
                  <X className="size-3.5" />
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
                {proveedoresPaged.map((proveedor) => {
                  // Fallbacks defensivos: un valor inesperado NO debe tumbar el módulo
                  const estadoConfig = PROVEEDOR_ESTADO_CONFIG[proveedor.estado] ?? PROVEEDOR_ESTADO_CONFIG.observado;
                  const condicionConfig = PROVEEDOR_CONDICION_CONFIG[proveedor.condicion] ?? PROVEEDOR_CONDICION_CONFIG.sin_evaluar;
                  const tipoConfig = PROVEEDOR_TIPO_CONFIG[proveedor.tipo] ?? PROVEEDOR_TIPO_CONFIG.bienes;
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
                              {(categorias.find(c => c.key === cat)?.label ?? cat).split(' ')[0]}
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
                          <estadoConfig.icon className="size-3" />
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
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate?.(`/proveedores/directorio/${proveedor.id}`)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {puedeEditar && proveedor.estado !== 'inactivo' && proveedor.estado !== 'en_evaluacion' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNavigate?.(`/proveedores/directorio/${proveedor.id}/editar`)}
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}
                          {puedeAprobar && proveedor.estado === 'en_evaluacion' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Aprobar proveedor"
                                onClick={async () => {
                                  const r = await aprobarProveedor(proveedor.id);
                                  if (r.exito) toast.success(`${proveedor.razonSocial} aprobado`);
                                  else toast.error(r.errores?.[0] ?? 'Error al aprobar');
                                }}
                              >
                                <CheckCircle className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="Rechazar proveedor"
                                onClick={async () => {
                                  const r = await rechazarProveedor(proveedor.id, 'Rechazado por revisor');
                                  if (r.exito) toast.warning(`${proveedor.razonSocial} marcado como observado`);
                                  else toast.error(r.errores?.[0] ?? 'Error al rechazar');
                                }}
                              >
                                <XCircle className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {provTotalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Página {provPage} de {provTotalPages} · {proveedoresFiltrados.length} proveedor(es)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={provPage === 1} onClick={() => setProvPage(provPage - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={provPage === provTotalPages} onClick={() => setProvPage(provPage + 1)}>
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
