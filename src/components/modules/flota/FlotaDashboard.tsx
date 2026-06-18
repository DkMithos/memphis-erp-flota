import { 
  Truck, 
  AlertCircle, 
  Wrench,
  Download,
  TrendingDown,
  Fuel,
  Clock,
  RefreshCw,
  ChevronRight,
  Package,
  Target,
  Award,
  AlertTriangle,
  CheckCircle2,
  PowerOff,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { AlertasPreventivo } from './AlertasPreventivo';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { calcularDiasProximoMantenimiento } from '../../../lib/flota/vehiculos-config';
import {
  buildFlotaDashboardMetrics,
  extractTalleresFromOTs,
  formatCurrency,
  formatPercentage,
  formatNumber
} from '../../../lib/flota/metrics';
import { useState, useMemo, type CSSProperties } from 'react';
import { useDarkMode } from '../../../hooks/useDarkMode';

interface FlotaDashboardProps {
  onNavigate: (route: string) => void;
}

export function FlotaDashboard({ onNavigate }: FlotaDashboardProps) {
  const { vehiculos } = useVehiculos();
  const { ordenes } = useOTStore();

  // ── Cards tipo "Acceso Rápido" (patrón Home) ──
  const isDark = useDarkMode();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Estilo del wrapper: fondo gris + borde izq de acento; en hover oscurece y los bordes toman el acento.
  // El modo oscuro usa bg-card (Tailwind) y borde izquierdo amarillo.
  const quickCardStyle = (isHovered: boolean): CSSProperties => {
    const accentColor = isDark ? '#f0c000' : '#000000';
    return {
      borderTopWidth: (isDark && !isHovered) ? 0 : 1,
      borderTopStyle: 'solid',
      borderTopColor: isHovered ? accentColor : '#64748B',
      borderRightWidth: (isDark && !isHovered) ? 0 : 1,
      borderRightStyle: 'solid',
      borderRightColor: isHovered ? accentColor : '#64748B',
      borderBottomWidth: (isDark && !isHovered) ? 0 : 1,
      borderBottomStyle: 'solid',
      borderBottomColor: isHovered ? accentColor : '#64748B',
      borderLeftWidth: 4,
      borderLeftStyle: 'solid',
      borderLeftColor: accentColor,
      backgroundColor: isDark ? undefined : (isHovered ? '#94A3B8' : '#E2E8F0'),
    };
  };

  // ============================================================================
  // FILTROS
  // ============================================================================
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [tipoOTFilter, setTipoOTFilter] = useState<string>('todos');
  const [tallerFilter, setTallerFilter] = useState<string>('todos');
  
  // Extraer talleres únicos para filtro
  const talleresDisponibles = useMemo(() => extractTalleresFromOTs(ordenes), [ordenes]);
  
  // ============================================================================
  // MÉTRICAS CALCULADAS
  // ============================================================================
  const metrics = useMemo(() => {
    return buildFlotaDashboardMetrics({
      vehiculos,
      ots: ordenes,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      tipoOT: (tipoOTFilter !== 'todos' ? tipoOTFilter : undefined) as any,
      tallerNombre: tallerFilter !== 'todos' ? tallerFilter : undefined
    });
  }, [vehiculos, ordenes, dateFrom, dateTo, tipoOTFilter, tallerFilter]);
  
  // ============================================================================
  // KPIs BÁSICOS (UI Legacy - mantener para compatibilidad)
  // ============================================================================
  const totalVehiculos = vehiculos.length;
  const activos = vehiculos.filter(v => v.estado === 'activo').length;
  const enTaller = vehiculos.filter(v => v.estado === 'en_taller').length;
  const inactivos = vehiculos.filter(v => v.estado === 'inactivo').length;
  
  // KM Promedio
  const kmPromedio = totalVehiculos > 0
    ? Math.round(vehiculos.reduce((sum, v) => sum + v.kilometraje, 0) / totalVehiculos)
    : 0;
  
  // OTs - Usar el nuevo schema de estados
  const totalOTs = ordenes.length;
  const otEnEjecucion = ordenes.filter(ot => ot.estado === 'en_ejecucion').length;
  const otEsperaAprobacion = ordenes.filter(ot => ot.estado === 'espera_aprobacion').length;
  const otCerradas = ordenes.filter(ot => ot.estado === 'cerrada').length;
  
  // Vehículos críticos (mantenimiento próximo o vencido)
  const vehiculosCriticos = vehiculos
    .filter(v => v.estado !== 'inactivo' && v.proximoMantenimiento)
    .map(v => {
      const dias = calcularDiasProximoMantenimiento(v.proximoMantenimiento);
      return {
        ...v,
        diasRestantes: dias
      };
    })
    .filter(v => v.diasRestantes !== null && v.diasRestantes <= 7)
    .sort((a, b) => (a.diasRestantes || 0) - (b.diasRestantes || 0))
    .slice(0, 5);
  
  // Distribución por estado
  const distribucionEstado = [
    { estado: 'Activo', cantidad: activos, color: '#10b981' },
    { estado: 'En Taller', cantidad: enTaller, color: '#f59e0b' },
    { estado: 'Inactivo', cantidad: inactivos, color: '#ef4444' }
  ];
  
  // Tendencia de OTs últimos 6 meses (simulada - en producción vendría del store)
  const tendenciaOTs = [
    { mes: 'Jul', preventivos: 4, correctivos: 2, predictivos: 1 },
    { mes: 'Ago', preventivos: 5, correctivos: 1, predictivos: 2 },
    { mes: 'Sep', preventivos: 6, correctivos: 3, predictivos: 1 },
    { mes: 'Oct', preventivos: 5, correctivos: 2, predictivos: 2 },
    { mes: 'Nov', preventivos: 7, correctivos: 1, predictivos: 1 },
    { mes: 'Dic', preventivos: ordenes.filter(ot => ot.tipo === 'preventivo').length, 
               correctivos: ordenes.filter(ot => ot.tipo === 'correctivo').length,
               predictivos: ordenes.filter(ot => ot.tipo === 'predictivo').length }
  ];
  
  // Timestamp de última actualización
  const ultimaActualizacion = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Handler para limpiar filtros
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTipoOTFilter('todos');
    setTallerFilter('todos');
  };
  
  const hasActiveFilters = dateFrom || dateTo || tipoOTFilter !== 'todos' || tallerFilter !== 'todos';
  
  return (
    <div className="space-y-6">
      {/* Header con título y acciones principales */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2>Dashboard Enterprise - Flota</h2>
          <p className="text-muted-foreground mt-1">
            Monitoreo en tiempo real de vehículos y mantenimientos con métricas avanzadas
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
            <Download className="size-4" />
            Exportar
          </Button>
          
          <Button onClick={() => onNavigate('/flota/vehiculos/nuevo')}>
            <Truck className="size-4" />
            Nuevo Vehículo
          </Button>
        </div>
      </div>
      
      {/* Timestamp */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-4 py-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Sistema operativo 24/7</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="size-3" />
          <span>Última actualización: {ultimaActualizacion}</span>
        </div>
      </div>
      
      {/* FILTROS AVANZADOS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5" />
              Filtros de Dashboard
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Limpiar Filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tipoOT">Tipo de OT</Label>
              <Select value={tipoOTFilter} onValueChange={setTipoOTFilter}>
                <SelectTrigger id="tipoOT">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="preventivo">Preventivo</SelectItem>
                  <SelectItem value="correctivo">Correctivo</SelectItem>
                  <SelectItem value="predictivo">Predictivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="taller">Taller</Label>
              <Select value={tallerFilter} onValueChange={setTallerFilter}>
                <SelectTrigger id="taller">
                  <SelectValue placeholder="Todos los talleres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los talleres</SelectItem>
                  {talleresDisponibles.map((taller) => (
                    <SelectItem key={taller.nombre} value={taller.nombre}>
                      {taller.nombre} ({taller.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Dashboard - Fila 1: Vehículos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Truck className="size-5" />
            Vehículos
          </h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onNavigate('/flota/vehiculos')}
          >
            Ver Todos
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {(() => {
            const isHovered = hoveredCard === 'total-veh';
            const accentColor = isDark ? '#f0c000' : '#000000';
            return (
              <button
                onClick={() => onNavigate('/flota/vehiculos')}
                onMouseEnter={() => setHoveredCard('total-veh')}
                onMouseLeave={() => setHoveredCard(null)}
                className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all relative"
                style={quickCardStyle(isHovered)}
              >
                <ChevronRight className="size-4 absolute top-3 right-3" style={{ color: accentColor }} />
                <div className="size-10 rounded-lg flex items-center justify-center mb-3 bg-blue-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors">
                  <Truck className="size-5" />
                </div>
                <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Total Vehículos</p>
                <p className="text-2xl font-bold leading-none mt-1 transition-colors">{totalVehiculos}</p>
                <p className="text-xs text-muted-foreground group-hover:text-foreground mt-1 transition-colors">Flota completa</p>
              </button>
            );
          })()}

          {(() => {
            const isHovered = hoveredCard === 'activos';
            const accentColor = isDark ? '#f0c000' : '#000000';
            return (
              <button
                onClick={() => onNavigate('/flota/vehiculos')}
                onMouseEnter={() => setHoveredCard('activos')}
                onMouseLeave={() => setHoveredCard(null)}
                className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all relative"
                style={quickCardStyle(isHovered)}
              >
                <ChevronRight className="size-4 absolute top-3 right-3" style={{ color: accentColor }} />
                <div className="size-10 rounded-lg flex items-center justify-center mb-3 bg-green-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors">
                  <CheckCircle2 className="size-5" />
                </div>
                <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Activos</p>
                <p className="text-2xl font-bold leading-none mt-1 transition-colors">{activos}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={parseFloat(formatPercentage(metrics.kpis.disponibilidadPct))} className="flex-1" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{formatPercentage(metrics.kpis.disponibilidadPct)}%</span>
                </div>
                <p className="text-xs text-muted-foreground group-hover:text-foreground mt-1 transition-colors">Disponibilidad</p>
              </button>
            );
          })()}
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                <Wrench className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">En Taller</p>
                <p className="text-2xl font-bold">{enTaller}</p>
                <p className="text-xs text-muted-foreground mt-1">Mantenimiento en curso</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-10 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
                <PowerOff className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Inactivos</p>
                <p className="text-2xl font-bold">{inactivos}</p>
                <p className="text-xs text-muted-foreground mt-1">Fuera de servicio</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                <Gauge className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">KM Promedio</p>
                <p className="text-2xl font-bold">{kmPromedio.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Kilometraje promedio</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* KPI Dashboard - Fila 2: Mantenimientos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Wrench className="size-5" />
            Órdenes de Trabajo
          </h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onNavigate('/flota/mantenimientos')}
          >
            Ver Todas
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const isHovered = hoveredCard === 'total-ots';
            const accentColor = isDark ? '#f0c000' : '#000000';
            return (
              <button
                onClick={() => onNavigate('/flota/mantenimientos')}
                onMouseEnter={() => setHoveredCard('total-ots')}
                onMouseLeave={() => setHoveredCard(null)}
                className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all relative"
                style={quickCardStyle(isHovered)}
              >
                <ChevronRight className="size-4 absolute top-3 right-3" style={{ color: accentColor }} />
                <div className="size-10 rounded-lg flex items-center justify-center mb-3 bg-blue-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors">
                  <Wrench className="size-5" />
                </div>
                <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Total OTs</p>
                <p className="text-2xl font-bold leading-none mt-1 transition-colors">{totalOTs}</p>
                <p className="text-xs text-muted-foreground group-hover:text-foreground mt-1 transition-colors">Todas las órdenes</p>
              </button>
            );
          })()}
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <RefreshCw className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">En Ejecución</p>
                <p className="text-2xl font-bold">{otEnEjecucion}</p>
                <p className="text-xs text-muted-foreground mt-1">En proceso</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={otEsperaAprobacion > 0 ? "cursor-pointer hover:shadow-sm transition-shadow" : ""}
            onClick={() => otEsperaAprobacion > 0 && onNavigate('/flota/mantenimientos')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${otEsperaAprobacion > 0 ? 'bg-amber-500' : 'bg-slate-400'}`}>
                <Clock className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Espera Aprobación</p>
                <p className="text-2xl font-bold">{otEsperaAprobacion}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {otEsperaAprobacion > 0 ? 'Requieren revisión' : 'Pendientes'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Cerradas</p>
                <p className="text-2xl font-bold">{otCerradas}</p>
                <p className="text-xs text-muted-foreground mt-1">Finalizadas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Alertas de vehículos críticos */}
      {vehiculosCriticos.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            <strong>Atención requerida:</strong> {vehiculosCriticos.length} vehículo(s) con mantenimiento próximo o vencido.
            Revise la tabla a continuación para más detalles.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Alertas de mantenimiento preventivo */}
      <AlertasPreventivo onNavigate={onNavigate} limit={8} />

      {/* Tabla de vehículos críticos */}
      {vehiculosCriticos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="size-5" />
                Vehículos que Requieren Atención
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate('/flota/vehiculos')}
              >
                Ver Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marca/Modelo</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Próximo Mant.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehiculosCriticos.map((vehiculo) => {
                  const dias = vehiculo.diasRestantes || 0;
                  const esVencido = dias < 0;
                  const esUrgente = dias >= 0 && dias <= 3;
                  
                  return (
                    <TableRow 
                      key={vehiculo.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => onNavigate(`/flota/vehiculos/${vehiculo.id}`)}
                    >
                      <TableCell className="font-medium">{vehiculo.placa}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {vehiculo.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vehiculo.marca}</p>
                          <p className="text-xs text-muted-foreground">{vehiculo.modelo}</p>
                        </div>
                      </TableCell>
                      <TableCell>{vehiculo.kilometraje.toLocaleString()} km</TableCell>
                      <TableCell>
                        <span className={esVencido ? 'text-red-600 font-medium' : esUrgente ? 'text-yellow-600' : ''}>
                          {vehiculo.proximoMantenimiento}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {esVencido 
                            ? `${Math.abs(dias)}d vencido` 
                            : dias === 0 
                            ? 'Hoy' 
                            : `${dias}d restantes`
                          }
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={esVencido ? 'destructive' : esUrgente ? 'secondary' : 'default'}>
                          {esVencido ? 'Vencido' : esUrgente ? 'Urgente' : 'Próximo'}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onNavigate(`/flota/mantenimientos/nueva?vehiculo=${vehiculo.id}&tipo=preventivo`)}
                        >
                          <Wrench className="size-4" />
                          Nueva OT
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Gráficos analíticos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia de OTs */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Mantenimientos</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tendenciaOTs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="preventivos" stroke="#10b981" name="Preventivos" strokeWidth={2} />
                <Line type="monotone" dataKey="correctivos" stroke="#ef4444" name="Correctivos" strokeWidth={2} />
                <Line type="monotone" dataKey="predictivos" stroke="#3b82f6" name="Predictivos" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Distribución por estado */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Flota por Estado</CardTitle>
            <p className="text-sm text-muted-foreground">Estado actual de todos los vehículos</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={distribucionEstado}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ estado, cantidad }) => `${estado}: ${cantidad}`}
                    outerRadius={80}
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
              
              <div className="flex flex-col justify-center gap-3">
                {distribucionEstado.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-4 rounded" style={{ backgroundColor: item.color }}></div>
                      <span className="font-medium">{item.estado}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.cantidad}</p>
                      <p className="text-sm text-muted-foreground">
                        {totalVehiculos > 0 ? ((item.cantidad / totalVehiculos) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* RANKING DE TALLERES */}
      {metrics.rankingTalleres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5" />
              Ranking de Talleres por Performance
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ordenado por SLA%, MTTR y costo promedio
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">OTs</TableHead>
                  <TableHead className="text-right">SLA %</TableHead>
                  <TableHead className="text-right">MTTR (h)</TableHead>
                  <TableHead className="text-right">Costo Total</TableHead>
                  <TableHead className="text-right">Costo Prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.rankingTalleres.map((taller, index) => (
                  <TableRow key={taller.nombre}>
                    <TableCell className="font-medium">
                      {index === 0 && <span className="text-yellow-600">🥇</span>}
                      {index === 1 && <span className="text-gray-400">🥈</span>}
                      {index === 2 && <span className="text-orange-600">🥉</span>}
                      {index > 2 && <span>{index + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{taller.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={taller.tipo === 'interno' ? 'default' : 'secondary'}>
                        {taller.tipo === 'interno' ? 'Interno' : 'Externo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{taller.otsCount}</TableCell>
                    <TableCell className="text-right">
                      <span className={taller.slaPct >= 80 ? 'text-green-600 font-medium' : taller.slaPct >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                        {formatPercentage(taller.slaPct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {taller.mttrHoras !== null ? formatNumber(taller.mttrHoras, 1) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(taller.costoTotal)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(taller.costoPromedio)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* TOP FALLAS Y TOP PIEZAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Fallas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Top 10 Fallas Más Frecuentes
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Basado en extras registrados en OTs
            </p>
          </CardHeader>
          <CardContent>
            {metrics.topFallas.length > 0 ? (
              <div className="space-y-4">
                {metrics.topFallas.map((falla, index) => (
                  <div key={falla.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="size-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600 dark:text-red-300 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{falla.key}</p>
                        <p className="text-sm text-muted-foreground">
                          {falla.count} ocurrencia{falla.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">{formatCurrency(falla.costoTotal)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(falla.costoTotal / falla.count)}/ocurr.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="size-12 mx-auto mb-2 opacity-50" />
                <p>No hay datos de fallas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Top Piezas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Top 10 Piezas Más Usadas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Piezas más solicitadas en mantenimientos
            </p>
          </CardHeader>
          <CardContent>
            {metrics.topPiezas.length > 0 ? (
              <div className="space-y-4">
                {metrics.topPiezas.map((pieza, index) => (
                  <div key={pieza.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{pieza.key}</p>
                        <p className="text-sm text-muted-foreground">
                          {pieza.cantidadTotal} unidad{pieza.cantidadTotal !== 1 ? 'es' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{formatCurrency(pieza.costoTotal)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(pieza.costoTotal / pieza.cantidadTotal)}/und.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="size-12 mx-auto mb-2 opacity-50" />
                <p>No hay datos de piezas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(() => {
          const isHovered = hoveredCard === 'act-veh';
          const accentColor = isDark ? '#f0c000' : '#000000';
          return (
            <button
              onClick={() => onNavigate('/flota/vehiculos')}
              onMouseEnter={() => setHoveredCard('act-veh')}
              onMouseLeave={() => setHoveredCard(null)}
              className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all"
              style={quickCardStyle(isHovered)}
            >
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg flex items-center justify-center shrink-0 bg-blue-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors">
                  <Truck className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground transition-colors">Gestionar Vehículos</h4>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Ver, crear y editar vehículos</p>
                </div>
                <ChevronRight className="size-5 shrink-0" style={{ color: accentColor }} />
              </div>
            </button>
          );
        })()}

        {(() => {
          const isHovered = hoveredCard === 'act-ots';
          const accentColor = isDark ? '#f0c000' : '#000000';
          return (
            <button
              onClick={() => onNavigate('/flota/mantenimientos')}
              onMouseEnter={() => setHoveredCard('act-ots')}
              onMouseLeave={() => setHoveredCard(null)}
              className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all"
              style={quickCardStyle(isHovered)}
            >
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg flex items-center justify-center shrink-0 bg-orange-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors">
                  <Wrench className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground transition-colors">Órdenes de Trabajo</h4>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Ver y gestionar OTs</p>
                </div>
                <ChevronRight className="size-5 shrink-0" style={{ color: accentColor }} />
              </div>
            </button>
          );
        })()}

        {(() => {
          const isHovered = hoveredCard === 'act-nueva';
          const accentColor = isDark ? '#f0c000' : '#000000';
          return (
            <button
              onClick={() => onNavigate('/flota/mantenimientos/nueva')}
              onMouseEnter={() => setHoveredCard('act-nueva')}
              onMouseLeave={() => setHoveredCard(null)}
              className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all"
              style={quickCardStyle(isHovered)}
            >
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg flex items-center justify-center shrink-0 bg-green-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors">
                  <Package className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground transition-colors">Nueva OT</h4>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Crear orden de trabajo</p>
                </div>
                <ChevronRight className="size-5 shrink-0" style={{ color: accentColor }} />
              </div>
            </button>
          );
        })()}
      </div>
    </div>
  );
}