import { useState } from 'react';
import {
  Package,
  Search,
  Filter,
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  Edit,
  Download,
  BarChart3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  unidad: string;
  ubicacion: string;
  valorUnitario: number;
  estado: 'normal' | 'critico' | 'agotado';
}

const productosData: Producto[] = [
  {
    id: '1',
    codigo: 'MED-001',
    nombre: 'Paracetamol 500mg',
    categoria: 'Medicamentos',
    stockActual: 2500,
    stockMinimo: 1000,
    stockMaximo: 5000,
    unidad: 'Tabletas',
    ubicacion: 'A-01',
    valorUnitario: 0.25,
    estado: 'normal'
  },
  {
    id: '2',
    codigo: 'INS-045',
    nombre: 'Jeringas 5ml',
    categoria: 'Insumos',
    stockActual: 150,
    stockMinimo: 500,
    stockMaximo: 2000,
    unidad: 'Unidades',
    ubicacion: 'B-12',
    valorUnitario: 0.80,
    estado: 'critico'
  },
  {
    id: '3',
    codigo: 'EQP-023',
    nombre: 'Guantes de látex M',
    categoria: 'Equipamiento',
    stockActual: 0,
    stockMinimo: 200,
    stockMaximo: 1000,
    unidad: 'Cajas',
    ubicacion: 'C-05',
    valorUnitario: 15.50,
    estado: 'agotado'
  },
  {
    id: '4',
    codigo: 'MED-089',
    nombre: 'Amoxicilina 500mg',
    categoria: 'Medicamentos',
    stockActual: 3200,
    stockMinimo: 800,
    stockMaximo: 4000,
    unidad: 'Cápsulas',
    ubicacion: 'A-05',
    valorUnitario: 0.45,
    estado: 'normal'
  }
];

const kardexData = [
  { fecha: '01/12', entradas: 500, salidas: 300, saldo: 2200 },
  { fecha: '02/12', entradas: 0, salidas: 150, saldo: 2050 },
  { fecha: '03/12', entradas: 1000, salidas: 200, saldo: 2850 },
  { fecha: '04/12', entradas: 0, salidas: 350, saldo: 2500 },
  { fecha: '05/12', entradas: 0, salidas: 0, saldo: 2500 }
];

export function Inventario() {
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProductos = productosData.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'normal':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Normal</Badge>;
      case 'critico':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">Crítico</Badge>;
      case 'agotado':
        return <Badge variant="destructive">Agotado</Badge>;
      default:
        return <Badge>{estado}</Badge>;
    }
  };

  const stockCritico = productosData.filter(p => p.estado === 'critico' || p.estado === 'agotado');
  const valorTotal = productosData.reduce((sum, p) => sum + (p.stockActual * p.valorUnitario), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Gestión de Inventario</h2>
          <p className="text-muted-foreground mt-1">
            Control de stock y movimientos de almacén
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="size-4" />
            Exportar
          </Button>
          <Button>
            <Plus className="size-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Productos</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{productosData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Productos activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stock Crítico</CardTitle>
            <AlertTriangle className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stockCritico.length}</div>
            <p className="text-xs text-yellow-600 mt-1">Requieren reabastecimiento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Inventario</CardTitle>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {valorTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Valor total actual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Movimientos Hoy</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">24</div>
            <p className="text-xs text-muted-foreground mt-1">Entradas y salidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o nombre de producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="medicamentos">Medicamentos</SelectItem>
                <SelectItem value="insumos">Insumos</SelectItem>
                <SelectItem value="equipamiento">Equipamiento</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
                <SelectItem value="agotado">Agotado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="size-4" />
              Más filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>Stock Mín/Máx</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProductos.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell className="font-medium">{producto.codigo}</TableCell>
                  <TableCell>{producto.nombre}</TableCell>
                  <TableCell>{producto.categoria}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{producto.stockActual}</span>
                      <span className="text-muted-foreground text-sm">{producto.unidad}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {producto.stockMinimo} / {producto.stockMaximo}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{producto.ubicacion}</Badge>
                  </TableCell>
                  <TableCell>{getEstadoBadge(producto.estado)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedProducto(producto);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProducto?.nombre}</DialogTitle>
            <DialogDescription>Código: {selectedProducto?.codigo}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="kardex">Kardex</TabsTrigger>
              <TabsTrigger value="movimientos">Historial de Movimientos</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Categoría</Label>
                    <p className="mt-1">{selectedProducto?.categoria}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Unidad de Medida</Label>
                    <p className="mt-1">{selectedProducto?.unidad}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ubicación</Label>
                    <p className="mt-1">{selectedProducto?.ubicacion}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valor Unitario</Label>
                    <p className="mt-1">S/ {selectedProducto?.valorUnitario.toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Stock Actual</Label>
                    <p className="mt-1 text-2xl font-semibold">{selectedProducto?.stockActual}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Stock Mínimo</Label>
                    <p className="mt-1">{selectedProducto?.stockMinimo}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Stock Máximo</Label>
                    <p className="mt-1">{selectedProducto?.stockMaximo}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valor Total</Label>
                    <p className="mt-1">
                      S/ {((selectedProducto?.stockActual || 0) * (selectedProducto?.valorUnitario || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kardex" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Kardex Visual - Últimos 5 días</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={kardexData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="fecha" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip />
                      <Line type="monotone" dataKey="saldo" stroke="#0A66C2" strokeWidth={2} name="Saldo" />
                      <Line type="monotone" dataKey="entradas" stroke="#10B981" strokeWidth={2} name="Entradas" />
                      <Line type="monotone" dataKey="salidas" stroke="#EF4444" strokeWidth={2} name="Salidas" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Entradas</TableHead>
                        <TableHead>Salidas</TableHead>
                        <TableHead>Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kardexData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.fecha}</TableCell>
                          <TableCell className="text-green-600">+{item.entradas}</TableCell>
                          <TableCell className="text-red-600">-{item.salidas}</TableCell>
                          <TableCell className="font-semibold">{item.saldo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="movimientos" className="mt-4">
              <div className="space-y-3">
                {[
                  { tipo: 'Entrada', motivo: 'Compra - OC-2024-0156', cantidad: 1000, fecha: '2024-12-03', usuario: 'Ana García' },
                  { tipo: 'Salida', motivo: 'Consumo - Farmacia', cantidad: 200, fecha: '2024-12-04', usuario: 'Sistema' },
                  { tipo: 'Salida', motivo: 'Consumo - Emergencia', cantidad: 350, fecha: '2024-12-04', usuario: 'Sistema' },
                  { tipo: 'Salida', motivo: 'Consumo - UCI', cantidad: 150, fecha: '2024-12-02', usuario: 'Sistema' },
                  { tipo: 'Entrada', motivo: 'Ajuste de Inventario', cantidad: 500, fecha: '2024-12-01', usuario: 'Carlos López' }
                ].map((mov, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 ${mov.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.tipo === 'Entrada' ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{mov.motivo}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {mov.tipo}: {mov.cantidad} unidades • {mov.fecha}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Usuario: {mov.usuario}</p>
                        </div>
                      </div>
                      <Badge variant={mov.tipo === 'Entrada' ? 'default' : 'secondary'}>
                        {mov.tipo}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
