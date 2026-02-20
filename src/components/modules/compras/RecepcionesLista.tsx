import { useState, useMemo } from 'react';
import { Package, Search, Filter, Download, Eye } from 'lucide-react';
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
import { useRecepcionesStore } from '../../../lib/compras/recepciones-store';
import { RECEPCION_ESTADO_CONFIG, formatearFecha, type EstadoRecepcion } from '../../../lib/compras/recepciones-config';

interface RecepcionesListaProps {
  onNavigate?: (route: string) => void;
}

export function RecepcionesLista({ onNavigate }: RecepcionesListaProps) {
  const { recepciones } = useRecepcionesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoRecepcion | 'todos'>('todos');

  const recepcionesFiltradas = useMemo(() => {
    return recepciones.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        r.id.toLowerCase().includes(searchLower) ||
        r.ordenId.toLowerCase().includes(searchLower);

      const matchEstado = filtroEstado === 'todos' || r.estado === filtroEstado;

      return matchSearch && matchEstado;
    });
  }, [recepciones, searchTerm, filtroEstado]);

  const stats = useMemo(() => ({
    total: recepciones.length,
    pendientes: recepciones.filter(r => r.estado === 'pendiente').length,
    conformes: recepciones.filter(r => r.estado === 'conforme').length,
    observadas: recepciones.filter(r => r.estado === 'observada').length
  }), [recepciones]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Package className="size-6 text-primary" />
          </div>
          <div>
            <h2>Recepciones y Conformidad</h2>
            <p className="text-muted-foreground mt-1">
              Registro de recepciones de productos y servicios
            </p>
          </div>
        </div>

        <Button variant="outline">
          <Download className="size-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Recepciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-yellow-600">{stats.pendientes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Conformes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{stats.conformes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Observadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-orange-600">{stats.observadas}</div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID o ID de orden..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoRecepcion | 'todos')}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="conforme">Conforme</SelectItem>
                <SelectItem value="observada">Observada</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {recepcionesFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="size-16 mx-auto mb-4 opacity-20" />
              <h3 className="font-medium text-foreground mb-2">No se encontraron recepciones</h3>
              <p className="text-sm">
                {searchTerm || filtroEstado !== 'todos'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Las recepciones se crean desde el detalle de las órdenes'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Recepción</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Items Recibidos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recepcionesFiltradas.map((recepcion) => {
                  const estadoConfig = RECEPCION_ESTADO_CONFIG[recepcion.estado];
                  
                  return (
                    <TableRow 
                      key={recepcion.id} 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => onNavigate?.(`/compras/recepciones/${recepcion.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{recepcion.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{recepcion.ordenId}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={estadoConfig.className}>
                          <estadoConfig.icon className="size-3 mr-1" />
                          {estadoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatearFecha(recepcion.fechaRecepcion)}</TableCell>
                      <TableCell>{recepcion.itemsRecibidos.length} items</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate?.(`/compras/recepciones/${recepcion.id}`);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
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
