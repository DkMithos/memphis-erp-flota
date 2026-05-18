import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  FileText,
  CreditCard,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const presupuestoPorCentro = [
  { 
    centro: 'Emergencia', 
    presupuesto: 150000, 
    ejecutado: 97500, 
    comprometido: 22500, 
    disponible: 30000,
    porcentaje: 65
  },
  { 
    centro: 'Cirugía', 
    presupuesto: 200000, 
    ejecutado: 140000, 
    comprometido: 30000, 
    disponible: 30000,
    porcentaje: 70
  },
  { 
    centro: 'Laboratorio', 
    presupuesto: 100000, 
    ejecutado: 45000, 
    comprometido: 15000, 
    disponible: 40000,
    porcentaje: 45
  },
  { 
    centro: 'Farmacia', 
    presupuesto: 180000, 
    ejecutado: 126000, 
    comprometido: 27000, 
    disponible: 27000,
    porcentaje: 70
  }
];

const ejecucionMensual = [
  { mes: 'Ene', presupuesto: 100000, ejecutado: 85000, comprometido: 10000 },
  { mes: 'Feb', presupuesto: 100000, ejecutado: 92000, comprometido: 5000 },
  { mes: 'Mar', presupuesto: 100000, ejecutado: 88000, comprometido: 8000 },
  { mes: 'Abr', presupuesto: 100000, ejecutado: 95000, comprometido: 3000 },
  { mes: 'May', presupuesto: 100000, ejecutado: 87000, comprometido: 9000 },
  { mes: 'Jun', presupuesto: 100000, ejecutado: 90000, comprometido: 7000 }
];

const distribucionGastos = [
  { name: 'Personal', value: 450000, color: '#0A66C2' },
  { name: 'Suministros', value: 280000, color: '#10B981' },
  { name: 'Servicios', value: 180000, color: '#F59E0B' },
  { name: 'Equipamiento', value: 120000, color: '#8B5CF6' },
  { name: 'Otros', value: 70000, color: '#EC4899' }
];

const movimientosRecientes = [
  {
    id: 1,
    tipo: 'Devengado',
    descripcion: 'OC-2024-0156 - Medifarma S.A.',
    monto: 45000,
    centro: 'Farmacia',
    fecha: '2024-12-04',
    estado: 'aprobado'
  },
  {
    id: 2,
    tipo: 'Compromiso',
    descripcion: 'OC-2024-0155 - Tecnología Médica',
    monto: 32500,
    centro: 'Cirugía',
    fecha: '2024-12-03',
    estado: 'pendiente'
  },
  {
    id: 3,
    tipo: 'Pago',
    descripcion: 'Factura F001-12345',
    monto: 18900,
    centro: 'Laboratorio',
    fecha: '2024-12-02',
    estado: 'pagado'
  }
];

export function Finanzas() {
  const totalPresupuesto = presupuestoPorCentro.reduce((sum, c) => sum + c.presupuesto, 0);
  const totalEjecutado = presupuestoPorCentro.reduce((sum, c) => sum + c.ejecutado, 0);
  const totalComprometido = presupuestoPorCentro.reduce((sum, c) => sum + c.comprometido, 0);
  const totalDisponible = presupuestoPorCentro.reduce((sum, c) => sum + c.disponible, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Gestión Financiera</h2>
          <p className="text-muted-foreground mt-1">
            Presupuesto, ejecución y análisis financiero
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="2024">
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">Año 2024</SelectItem>
              <SelectItem value="2023">Año 2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="size-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Presupuesto Total</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {totalPresupuesto.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Año fiscal 2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ejecutado</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {totalEjecutado.toLocaleString()}</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <span>{((totalEjecutado / totalPresupuesto) * 100).toFixed(1)}% del presupuesto</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Comprometido</CardTitle>
            <FileText className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {totalComprometido.toLocaleString()}</div>
            <div className="flex items-center text-xs text-yellow-600 mt-1">
              <span>{((totalComprometido / totalPresupuesto) * 100).toFixed(1)}% del presupuesto</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Disponible</CardTitle>
            <CreditCard className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {totalDisponible.toLocaleString()}</div>
            <div className="flex items-center text-xs text-blue-600 mt-1">
              <span>{((totalDisponible / totalPresupuesto) * 100).toFixed(1)}% del presupuesto</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="centros" className="w-full">
        <TabsList>
          <TabsTrigger value="centros">Centros de Costo</TabsTrigger>
          <TabsTrigger value="ejecucion">Ejecución Mensual</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        {/* Centros de Costo */}
        <TabsContent value="centros" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tabla de Centros */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Presupuesto por Centro de Costo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {presupuestoPorCentro.map((centro, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{centro.centro}</h4>
                          <p className="text-sm text-muted-foreground">
                            S/ {centro.ejecutado.toLocaleString()} de S/ {centro.presupuesto.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{centro.porcentaje}%</p>
                          <p className="text-xs text-muted-foreground">ejecutado</p>
                        </div>
                      </div>
                      <Progress value={centro.porcentaje} className="h-2" />
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Ejecutado:</span>
                          <p className="font-medium">S/ {centro.ejecutado.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Comprometido:</span>
                          <p className="font-medium">S/ {centro.comprometido.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Disponible:</span>
                          <p className="font-medium text-green-600">S/ {centro.disponible.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Distribución de Gastos */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={distribucionGastos}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {distribucionGastos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `S/ ${value.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-4">
                  {distribucionGastos.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">S/ {item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Ejecución Mensual */}
        <TabsContent value="ejecucion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ejecución Presupuestal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={ejecucionMensual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="presupuesto" fill="#E5E7EB" name="Presupuesto" />
                  <Bar dataKey="ejecutado" fill="#0A66C2" name="Ejecutado" />
                  <Bar dataKey="comprometido" fill="#F59E0B" name="Comprometido" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle Mensual</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Ejecutado</TableHead>
                    <TableHead>Comprometido</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead>% Ejecución</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ejecucionMensual.map((mes, index) => {
                    const disponible = mes.presupuesto - mes.ejecutado - mes.comprometido;
                    const porcentaje = (mes.ejecutado / mes.presupuesto) * 100;
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{mes.mes}</TableCell>
                        <TableCell>S/ {mes.presupuesto.toLocaleString()}</TableCell>
                        <TableCell>S/ {mes.ejecutado.toLocaleString()}</TableCell>
                        <TableCell>S/ {mes.comprometido.toLocaleString()}</TableCell>
                        <TableCell>S/ {disponible.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={porcentaje} className="h-2 w-20" />
                            <span className="text-sm">{porcentaje.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movimientos */}
        <TabsContent value="movimientos" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Movimientos Recientes</CardTitle>
              <Select defaultValue="todos">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="compromiso">Compromisos</SelectItem>
                  <SelectItem value="devengado">Devengados</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Centro de Costo</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientosRecientes.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        <Badge variant="outline">{mov.tipo}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{mov.descripcion}</TableCell>
                      <TableCell>{mov.centro}</TableCell>
                      <TableCell>S/ {mov.monto.toLocaleString()}</TableCell>
                      <TableCell>{mov.fecha}</TableCell>
                      <TableCell>
                        {mov.estado === 'aprobado' && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Aprobado</Badge>
                        )}
                        {mov.estado === 'pendiente' && (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">Pendiente</Badge>
                        )}
                        {mov.estado === 'pagado' && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">Pagado</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
