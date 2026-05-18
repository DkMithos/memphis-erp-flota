import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Package, 
  AlertTriangle,
  FolderKanban,
  DollarSign,
  Users,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const comprasData = [
  { mes: 'Ene', monto: 45000 },
  { mes: 'Feb', monto: 52000 },
  { mes: 'Mar', monto: 48000 },
  { mes: 'Abr', monto: 61000 },
  { mes: 'May', monto: 55000 },
  { mes: 'Jun', monto: 67000 }
];

const presupuestoData = [
  { name: 'Ejecutado', value: 65, color: '#0A66C2' },
  { name: 'Disponible', value: 35, color: '#E5E7EB' }
];

const actividadesRecientes = [
  {
    id: 1,
    tipo: 'OC Aprobada',
    descripcion: 'Orden de Compra #OC-2024-0156',
    usuario: 'María García',
    tiempo: 'Hace 15 min',
    estado: 'success'
  },
  {
    id: 2,
    tipo: 'Requerimiento',
    descripcion: 'Nueva solicitud de materiales médicos',
    usuario: 'Carlos López',
    tiempo: 'Hace 1 hora',
    estado: 'pending'
  },
  {
    id: 3,
    tipo: 'Stock Crítico',
    descripcion: 'Alerta: 5 productos bajo stock mínimo',
    usuario: 'Sistema',
    tiempo: 'Hace 2 horas',
    estado: 'warning'
  },
  {
    id: 4,
    tipo: 'Cotización',
    descripción: 'Cotización enviada - Proveedor ABC SAC',
    usuario: 'Ana Martínez',
    tiempo: 'Hace 3 horas',
    estado: 'info'
  },
  {
    id: 5,
    tipo: 'Proyecto',
    descripcion: 'Actualización: Proyecto Hospital Regional',
    usuario: 'José Torres',
    tiempo: 'Hace 4 horas',
    estado: 'info'
  }
];

const proyectosActivos = [
  {
    id: 1,
    nombre: 'Implementación Hospital Regional',
    progreso: 75,
    presupuesto: 450000,
    gastado: 337500,
    estado: 'En Curso'
  },
  {
    id: 2,
    nombre: 'Modernización Centro Médico',
    progreso: 45,
    presupuesto: 280000,
    gastado: 126000,
    estado: 'En Curso'
  },
  {
    id: 3,
    nombre: 'Equipamiento Laboratorio',
    progreso: 90,
    presupuesto: 180000,
    gastado: 162000,
    estado: 'Cierre'
  }
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Banner de datos demo */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Vista previa:</strong> Este dashboard muestra datos de demostración. Los datos reales se cargarán conforme se registren operaciones en el sistema.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Órdenes Pendientes</CardTitle>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">24</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <TrendingDown className="size-3" />
              <span>12% menos que el mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stock Crítico</CardTitle>
            <AlertTriangle className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">5</div>
            <div className="flex items-center text-xs text-yellow-600 mt-1">
              <TrendingUp className="size-3" />
              <span>Requiere atención inmediata</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proyectos Activos</CardTitle>
            <FolderKanban className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">12</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <TrendingUp className="size-3" />
              <span>3 nuevos este mes</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Presupuesto Mensual</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ 67,000</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>65% ejecutado del total</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Compras */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tendencia de Compras</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={comprasData}>
                <defs>
                  <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A66C2" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0A66C2" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="monto" 
                  stroke="#0A66C2" 
                  fillOpacity={1} 
                  fill="url(#colorMonto)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ejecución Presupuestal */}
        <Card>
          <CardHeader>
            <CardTitle>Ejecución Presupuestal</CardTitle>
            <p className="text-sm text-muted-foreground">Mes actual</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={presupuestoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {presupuestoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ejecutado</span>
                <span className="font-semibold">S/ 43,550</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Disponible</span>
                <span className="font-semibold">S/ 23,450</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold">S/ 67,000</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividades Recientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Actividades Recientes</CardTitle>
            <Button variant="ghost" size="sm">Ver todas</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {actividadesRecientes.map((actividad) => (
                <div key={actividad.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="mt-1">
                    {actividad.estado === 'success' && (
                      <div className="size-2 rounded-full bg-green-500"></div>
                    )}
                    {actividad.estado === 'pending' && (
                      <div className="size-2 rounded-full bg-blue-500"></div>
                    )}
                    {actividad.estado === 'warning' && (
                      <div className="size-2 rounded-full bg-yellow-500"></div>
                    )}
                    {actividad.estado === 'info' && (
                      <div className="size-2 rounded-full bg-gray-400"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{actividad.tipo}</p>
                    <p className="text-sm text-muted-foreground truncate">{actividad.descripcion}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{actividad.usuario}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{actividad.tiempo}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8">
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Proyectos Activos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Proyectos Activos</CardTitle>
            <Button variant="ghost" size="sm">Ver todos</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {proyectosActivos.map((proyecto) => (
                <div key={proyecto.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{proyecto.nombre}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        S/ {proyecto.gastado.toLocaleString()} de S/ {proyecto.presupuesto.toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={proyecto.estado === 'En Curso' ? 'default' : 'secondary'}>
                      {proyecto.estado}
                    </Badge>
                  </div>
                  <Progress value={proyecto.progreso} className="h-2" />
                  <p className="text-xs text-muted-foreground">{proyecto.progreso}% completado</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
