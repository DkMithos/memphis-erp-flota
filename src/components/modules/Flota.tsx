import { 
  Truck, 
  AlertCircle, 
  Calendar, 
  Wrench, 
  FileText, 
  Download,
  TrendingUp,
  TrendingDown,
  Fuel,
  DollarSign,
  Clock,
  RefreshCw,
  Filter,
  FileSpreadsheet,
  ChevronDown,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Data models conforme a SRS
const flotaData = {
  // KPIs principales - RF-FLOTA-080
  kpis: {
    totalVehiculos: 24,
    disponibilidad: 87.5, // Porcentaje
    costoPorKm: 2.45, // USD
    consumoPromedio: 12.8, // L/100km
    mantenimientosCriticos: 3,
    utilizacion: 76.2, // Porcentaje
    edadPromedio: 3.2, // años
    vehiculosOperativos: 21,
    costosOperativosMes: 45680.00 // USD
  },
  
  // Vehículos con estado crítico o alertas
  vehiculosCriticos: [
    {
      id: 'VH-001',
      placa: 'ABC-123',
      tipo: 'Ambulancia',
      marca: 'Mercedes Benz Sprinter',
      estado: 'mantenimiento_vencido',
      diasVencido: 5,
      kilometraje: 48500,
      ultimoMantenimiento: '2024-10-20',
      proximoMantenimiento: '2024-12-20',
      prioridad: 'alta'
    },
    {
      id: 'VH-002',
      placa: 'DEF-456',
      tipo: 'Camioneta',
      marca: 'Toyota Hilux',
      estado: 'alerta_kilometraje',
      diasVencido: 0,
      kilometraje: 95800,
      ultimoMantenimiento: '2024-11-15',
      proximoMantenimiento: '2025-01-15',
      prioridad: 'media'
    },
    {
      id: 'VH-003',
      placa: 'GHI-789',
      tipo: 'Van',
      marca: 'Hyundai H-1',
      estado: 'mantenimiento_proximo',
      diasVencido: -3, // Faltan 3 días
      kilometraje: 32000,
      ultimoMantenimiento: '2024-11-25',
      proximoMantenimiento: '2025-01-02',
      prioridad: 'media'
    }
  ],
  
  // Costos por vehículo para gráfico
  costosPorVehiculo: [
    { vehiculo: 'ABC-123', costo: 2850, tipo: 'Ambulancia' },
    { vehiculo: 'DEF-456', costo: 1920, tipo: 'Camioneta' },
    { vehiculo: 'GHI-789', costo: 1450, tipo: 'Van' },
    { vehiculo: 'JKL-012', costo: 2100, tipo: 'Ambulancia' },
    { vehiculo: 'MNO-345', costo: 1680, tipo: 'Camioneta' },
    { vehiculo: 'PQR-678', costo: 1820, tipo: 'Van' }
  ],
  
  // Tendencia de mantenimientos últimos 6 meses
  tendenciaMantenimientos: [
    { mes: 'Jul', preventivos: 4, correctivos: 2, total: 6 },
    { mes: 'Ago', preventivos: 5, correctivos: 1, total: 6 },
    { mes: 'Sep', preventivos: 6, correctivos: 3, total: 9 },
    { mes: 'Oct', preventivos: 5, correctivos: 2, total: 7 },
    { mes: 'Nov', preventivos: 7, correctivos: 1, total: 8 },
    { mes: 'Dic', preventivos: 4, correctivos: 0, total: 4 }
  ],
  
  // Distribución por estado
  distribucionEstado: [
    { estado: 'Operativo', cantidad: 21, color: '#10b981' },
    { estado: 'Mantenimiento', cantidad: 2, color: '#f59e0b' },
    { estado: 'Fuera de Servicio', cantidad: 1, color: '#ef4444' }
  ]
};

export function Flota() {
  const { kpis, vehiculosCriticos, costosPorVehiculo, tendenciaMantenimientos, distribucionEstado } = flotaData;
  
  // RNF-FLOTA-001 - Timestamp de última actualización
  const ultimaActualizacion = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return (
    <div className="space-y-6">
      {/* Header con título y acciones principales */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2>Dashboard Operativo - Flota</h2>
          <p className="text-muted-foreground mt-1">
            Monitoreo en tiempo real y análisis de costos operativos
          </p>
        </div>
        
        {/* RF-FLOTA-081 - Exportación de reportes */}
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="size-4 mr-2" />
                Exportar Dashboard
                <ChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileSpreadsheet className="size-4 mr-2" />
                Exportar a Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="size-4 mr-2" />
                Exportar a PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button>
            <Truck className="size-4 mr-2" />
            Nuevo Vehículo
          </Button>
        </div>
      </div>
      
      {/* Barra de filtros - RF-FLOTA-081 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Cliente/Tenant</label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  <SelectItem value="client1">Hospital Central</SelectItem>
                  <SelectItem value="client2">Clínica del Norte</SelectItem>
                  <SelectItem value="client3">Centro Médico Sur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Flota</label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar flota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las flotas</SelectItem>
                  <SelectItem value="ambulances">Ambulancias</SelectItem>
                  <SelectItem value="trucks">Camionetas</SelectItem>
                  <SelectItem value="vans">Vans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Fecha Inicio</label>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="size-4 mr-2" />
                01/12/2024
              </Button>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Fecha Fin</label>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="size-4 mr-2" />
                29/12/2024
              </Button>
            </div>
            
            <div className="flex items-end">
              <Button variant="secondary" className="w-full">
                <Filter className="size-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </div>
          
          {/* RNF-FLOTA-001 - Indicador de disponibilidad 24/7 */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Sistema operativo 24/7</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-3" />
              <span>Última actualización: {ultimaActualizacion}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* KPI Dashboard - RF-FLOTA-080 - Fila 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
              Total Vehículos
              <Truck className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.totalVehiculos}</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={kpis.disponibilidad} className="flex-1" />
              <span className="text-sm text-muted-foreground">{kpis.disponibilidad}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Disponibilidad operativa</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
              Costo por KM
              <DollarSign className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">${kpis.costoPorKm}</div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingDown className="size-4 text-green-600" />
              <span className="text-sm text-green-600">-8.2% vs mes anterior</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Costo operativo promedio</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
              Consumo Promedio
              <Fuel className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.consumoPromedio}</div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="size-4 text-red-600" />
              <span className="text-sm text-red-600">+3.5% vs mes anterior</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Litros por 100 km</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
              Mantenimientos Críticos
              <AlertCircle className="size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-600">{kpis.mantenimientosCriticos}</div>
            <div className="flex items-center gap-1 mt-2">
              <Clock className="size-4 text-yellow-600" />
              <span className="text-sm text-yellow-600">Requieren atención inmediata</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Vencidos o próximos a vencer</p>
          </CardContent>
        </Card>
      </div>
      
      {/* KPI Dashboard - RF-FLOTA-080 - Fila 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Utilización de Flota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.utilizacion}%</div>
            <Progress value={kpis.utilizacion} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Tasa de uso promedio</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Edad Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.edadPromedio} años</div>
            <p className="text-sm text-muted-foreground mt-2">Antigüedad de la flota</p>
            <p className="text-xs text-muted-foreground mt-1">Óptimo: &lt; 5 años</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Vehículos Operativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-green-600">
              {kpis.vehiculosOperativos}/{kpis.totalVehiculos}
            </div>
            <Progress value={(kpis.vehiculosOperativos / kpis.totalVehiculos) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Disponibles para servicio</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Costos Operativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">${kpis.costosOperativosMes.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground mt-2">Total mes actual</p>
            <p className="text-xs text-muted-foreground mt-1">Incluye combustible y mantenimiento</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Alertas de vehículos críticos */}
      {kpis.mantenimientosCriticos > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            <strong>Atención requerida:</strong> {kpis.mantenimientosCriticos} vehículos necesitan mantenimiento urgente.
            Revise la tabla de vehículos críticos para más detalles.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Tabla de vehículos críticos - RF-FLOTA-080, RNF-FLOTA-030 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-5" />
            Vehículos que Requieren Atención
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Tipo/Marca</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Kilometraje</TableHead>
                <TableHead>Último Mant.</TableHead>
                <TableHead>Próximo Mant.</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehiculosCriticos.map((vehiculo) => (
                <TableRow key={vehiculo.id}>
                  <TableCell className="font-medium">{vehiculo.placa}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{vehiculo.tipo}</p>
                      <p className="text-xs text-muted-foreground">{vehiculo.marca}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      vehiculo.estado === 'mantenimiento_vencido' ? 'destructive' :
                      vehiculo.estado === 'alerta_kilometraje' ? 'secondary' :
                      'default'
                    }>
                      {vehiculo.estado === 'mantenimiento_vencido' ? 'Vencido' :
                       vehiculo.estado === 'alerta_kilometraje' ? 'Alto Km' :
                       'Próximo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      vehiculo.prioridad === 'alta' ? 'destructive' :
                      vehiculo.prioridad === 'media' ? 'secondary' :
                      'default'
                    }>
                      {vehiculo.prioridad === 'alta' ? 'Alta' : 'Media'}
                    </Badge>
                  </TableCell>
                  <TableCell>{vehiculo.kilometraje.toLocaleString()} km</TableCell>
                  <TableCell>{vehiculo.ultimoMantenimiento}</TableCell>
                  <TableCell>
                    <span className={vehiculo.diasVencido > 0 ? 'text-red-600' : ''}>
                      {vehiculo.proximoMantenimiento}
                      {vehiculo.diasVencido > 0 && ` (${vehiculo.diasVencido}d vencido)`}
                      {vehiculo.diasVencido < 0 && ` (${Math.abs(vehiculo.diasVencido)}d restantes)`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      Programar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Gráficos analíticos - RF-FLOTA-080 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Costos por vehículo */}
        <Card>
          <CardHeader>
            <CardTitle>Costos Operativos por Vehículo</CardTitle>
            <p className="text-sm text-muted-foreground">Comparativa del mes actual (USD)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costosPorVehiculo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vehiculo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="costo" fill="#0A66C2" name="Costo (USD)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Tendencia de mantenimientos */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Mantenimientos</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tendenciaMantenimientos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="preventivos" stroke="#10b981" name="Preventivos" strokeWidth={2} />
                <Line type="monotone" dataKey="correctivos" stroke="#ef4444" name="Correctivos" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Distribución por estado */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Flota por Estado</CardTitle>
          <p className="text-sm text-muted-foreground">Estado actual de todos los vehículos</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribucionEstado}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ estado, cantidad }) => `${estado}: ${cantidad}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="cantidad"
                >
                  {distribucionEstado.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="flex flex-col justify-center gap-4">
              {distribucionEstado.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-4 rounded" style={{ backgroundColor: item.color }}></div>
                    <span className="font-medium">{item.estado}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{item.cantidad} vehículos</p>
                    <p className="text-sm text-muted-foreground">
                      {((item.cantidad / kpis.totalVehiculos) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Footer con información de auditoría - RNF-FLOTA-030 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              <strong>Trazabilidad:</strong> Todos los cambios son registrados en el log de auditoría del sistema
            </div>
            <div>
              <strong>Usuario:</strong> admin@kesa.com | <strong>Sesión:</strong> {new Date().toISOString().split('T')[0]}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}