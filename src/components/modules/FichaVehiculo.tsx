import { 
  ArrowLeft,
  Truck, 
  Edit,
  FileText,
  QrCode,
  Printer,
  Calendar,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  FileCheck,
  Shield,
  AlertCircle,
  Download,
  Upload,
  Fuel,
  MapPin,
  User,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Separator } from '../ui/separator';

// Data model conforme a SRS - CU-FLOTA-07
const vehiculoData = {
  // Información general
  id: 'VH-001',
  placa: 'ABC-123',
  tipo: 'Ambulancia',
  marca: 'Mercedes Benz',
  modelo: 'Sprinter 415 CDI',
  año: 2020,
  color: 'Blanco',
  vin: 'WDB9066331N123456',
  motor: 'OM651 2.1L Diesel',
  capacidad: '3.5 Toneladas',
  estado: 'operativo', // operativo | mantenimiento | siniestrado | baja
  
  // KPIs del vehículo
  kilometraje: 48500,
  kilometrajePróximoMantenimiento: 50000,
  horasOperacion: 1520,
  consumoPromedio: 11.2, // L/100km
  costoPorKm: 2.65, // USD
  
  // Fechas importantes
  fechaAdquisicion: '2020-03-15',
  ultimoMantenimiento: '2024-10-20',
  proximoMantenimiento: '2024-12-20',
  
  // Asignación actual
  conductor: 'Juan Pérez López',
  cliente: 'Hospital Central',
  departamento: 'Urgencias',
  
  // Alertas activas
  alertas: [
    {
      tipo: 'mantenimiento_vencido',
      severidad: 'alta',
      mensaje: 'Mantenimiento preventivo vencido hace 5 días',
      fecha: '2024-12-24'
    }
  ]
};

// RF-FLOTA-070 - Gestión de documentos
const documentosVehiculo = [
  {
    id: 'DOC-001',
    tipo: 'SOAT',
    numero: 'SOAT-2024-ABC123',
    entidad: 'Seguros La Positiva',
    fechaEmision: '2024-01-15',
    fechaVencimiento: '2025-01-15',
    estado: 'vigente',
    diasRestantes: 17,
    archivo: 'soat_abc123.pdf'
  },
  {
    id: 'DOC-002',
    tipo: 'Revisión Técnica',
    numero: 'RT-2024-00456',
    entidad: 'CITV Surco',
    fechaEmision: '2024-06-10',
    fechaVencimiento: '2025-06-10',
    estado: 'vigente',
    diasRestantes: 163,
    archivo: 'revision_tecnica.pdf'
  },
  {
    id: 'DOC-003',
    tipo: 'Póliza de Seguro',
    numero: 'POL-2024-789',
    entidad: 'Pacífico Seguros',
    fechaEmision: '2024-03-01',
    fechaVencimiento: '2025-03-01',
    estado: 'vigente',
    diasRestantes: 62,
    archivo: 'poliza_seguro.pdf'
  },
  {
    id: 'DOC-004',
    tipo: 'Tarjeta de Propiedad',
    numero: 'TP-ABC123',
    entidad: 'SUNARP',
    fechaEmision: '2020-03-15',
    fechaVencimiento: null,
    estado: 'permanente',
    diasRestantes: null,
    archivo: 'tarjeta_propiedad.pdf'
  }
];

// CU-FLOTA-07 - Historial completo del vehículo (RNF-FLOTA-030 - Trazabilidad)
const historialVehiculo = [
  {
    id: 'HIST-001',
    fecha: '2024-12-24 14:30',
    tipo: 'alerta',
    categoria: 'mantenimiento',
    evento: 'Alerta de mantenimiento vencido',
    descripcion: 'Sistema generó alerta automática por mantenimiento preventivo vencido',
    usuario: 'Sistema Automático',
    metadata: {
      kilometraje: 48500,
      diasVencidos: 5
    }
  },
  {
    id: 'HIST-002',
    fecha: '2024-12-15 09:15',
    tipo: 'mantenimiento',
    categoria: 'preventivo',
    evento: 'Cambio de aceite y filtros',
    descripcion: 'Mantenimiento preventivo programado - 10,000 km',
    usuario: 'Carlos Mendoza (Mecánico)',
    proveedor: 'Automotriz Central SAC',
    costo: 450.00,
    metadata: {
      kilometraje: 45000,
      items: ['Aceite sintético 5W-30', 'Filtro de aceite', 'Filtro de aire']
    }
  },
  {
    id: 'HIST-003',
    fecha: '2024-11-20 16:45',
    tipo: 'operacion',
    categoria: 'asignacion',
    evento: 'Cambio de conductor',
    descripcion: 'Vehículo reasignado de María Torres a Juan Pérez',
    usuario: 'Ana García (Supervisor)',
    metadata: {
      conductorAnterior: 'María Torres',
      conductorNuevo: 'Juan Pérez',
      kilometraje: 43200
    }
  },
  {
    id: 'HIST-004',
    fecha: '2024-11-05 11:20',
    tipo: 'siniestro',
    categoria: 'leve',
    evento: 'Siniestro menor - Raspón lateral',
    descripcion: 'Contacto leve en estacionamiento, daño superficial sin afectar operatividad',
    usuario: 'María Torres (Conductor)',
    costo: 280.00,
    metadata: {
      kilometraje: 42100,
      ubicacion: 'Hospital Central - Estacionamiento B',
      seguro: 'Cubierto parcialmente'
    }
  },
  {
    id: 'HIST-005',
    fecha: '2024-10-20 10:00',
    tipo: 'mantenimiento',
    categoria: 'preventivo',
    evento: 'Mantenimiento 40,000 km',
    descripcion: 'Mantenimiento preventivo mayor - Revisión completa de sistemas',
    usuario: 'Carlos Mendoza (Mecánico)',
    proveedor: 'Mercedes Benz Servicio Oficial',
    costo: 1850.00,
    metadata: {
      kilometraje: 40000,
      items: ['Aceite', 'Filtros', 'Frenos', 'Suspensión', 'Sistema eléctrico']
    }
  },
  {
    id: 'HIST-006',
    fecha: '2024-09-15 08:30',
    tipo: 'documento',
    categoria: 'renovacion',
    evento: 'Renovación de SOAT',
    descripcion: 'SOAT renovado por 12 meses',
    usuario: 'Ana García (Supervisor)',
    costo: 180.00,
    metadata: {
      numeroPoliza: 'SOAT-2024-ABC123',
      vigenciaHasta: '2025-01-15'
    }
  }
];

// Costos asociados al vehículo
const costosVehiculo = {
  totales: {
    combustible: 12450.00,
    mantenimiento: 8920.00,
    seguros: 2400.00,
    siniestros: 280.00,
    otros: 1250.00
  },
  detalleMensual: [
    { mes: 'Jul', combustible: 1850, mantenimiento: 450, seguros: 200, total: 2500 },
    { mes: 'Ago', combustible: 1920, mantenimiento: 0, seguros: 200, total: 2120 },
    { mes: 'Sep', combustible: 2100, mantenimiento: 1850, seguros: 200, total: 4150 },
    { mes: 'Oct', combustible: 2050, mantenimiento: 450, seguros: 200, total: 2700 },
    { mes: 'Nov', combustible: 1980, mantenimiento: 280, seguros: 200, total: 2460 },
    { mes: 'Dic', combustible: 1650, mantenimiento: 0, seguros: 200, total: 1850 }
  ]
};

export function FichaVehiculo() {
  const { estado, alertas } = vehiculoData;
  
  // Calcular estado de documentos
  const documentosVencidos = documentosVehiculo.filter(d => d.diasRestantes !== null && d.diasRestantes < 0).length;
  const documentosPorVencer = documentosVehiculo.filter(d => d.diasRestantes !== null && d.diasRestantes > 0 && d.diasRestantes <= 30).length;
  
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'operativo':
        return <Badge className="bg-green-600"><CheckCircle className="size-3 mr-1" />Operativo</Badge>;
      case 'mantenimiento':
        return <Badge className="bg-yellow-600"><Wrench className="size-3 mr-1" />En Mantenimiento</Badge>;
      case 'siniestrado':
        return <Badge className="bg-red-600"><AlertTriangle className="size-3 mr-1" />Siniestrado</Badge>;
      case 'baja':
        return <Badge variant="secondary">Dado de Baja</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };
  
  const getDocumentoEstadoBadge = (estado: string, diasRestantes: number | null) => {
    if (estado === 'permanente') {
      return <Badge variant="outline">Permanente</Badge>;
    }
    if (diasRestantes === null) {
      return <Badge variant="outline">N/A</Badge>;
    }
    if (diasRestantes < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (diasRestantes <= 30) {
      return <Badge className="bg-yellow-600">Por vencer</Badge>;
    }
    return <Badge className="bg-green-600">Vigente</Badge>;
  };
  
  const getEventoIcon = (tipo: string) => {
    switch (tipo) {
      case 'mantenimiento':
        return <Wrench className="size-4 text-blue-600" />;
      case 'siniestro':
        return <AlertTriangle className="size-4 text-red-600" />;
      case 'documento':
        return <FileCheck className="size-4 text-green-600" />;
      case 'operacion':
        return <User className="size-4 text-purple-600" />;
      case 'alerta':
        return <AlertCircle className="size-4 text-yellow-600" />;
      default:
        return <Clock className="size-4 text-gray-600" />;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb y navegación */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-4 mr-2" />
          Volver al Dashboard
        </Button>
        <span>/</span>
        <span>Flota</span>
        <span>/</span>
        <span className="text-foreground font-medium">{vehiculoData.placa}</span>
      </div>
      
      {/* Header con acciones principales */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="size-16 bg-primary/10 rounded-lg flex items-center justify-center">
            <Truck className="size-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl">Vehículo {vehiculoData.placa}</h2>
              {getEstadoBadge(estado)}
            </div>
            <p className="text-muted-foreground mt-1">
              {vehiculoData.marca} {vehiculoData.modelo} ({vehiculoData.año})
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>VIN: {vehiculoData.vin}</span>
              <span>•</span>
              <span>ID: {vehiculoData.id}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* CU-FLOTA-01 - Editar vehículo */}
          <Button variant="outline">
            <Edit className="size-4 mr-2" />
            Editar
          </Button>
          
          {/* CU-FLOTA-03 - Programar mantenimiento */}
          <Button variant="outline">
            <Calendar className="size-4 mr-2" />
            Programar Mantenimiento
          </Button>
          
          {/* QR Code - RF-FLOTA-070 */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <QrCode className="size-4 mr-2" />
                Ver QR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Código QR - {vehiculoData.placa}</DialogTitle>
                <DialogDescription>
                  Escanee este código para acceder al historial público del vehículo (solo lectura)
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-6">
                {/* Placeholder QR - En producción usar librería qrcode.react */}
                <div className="size-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center">
                    <QrCode className="size-16 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      QR Code: VH-001
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  <p>URL pública: https://memphis-erp.com/public/vehicle/{vehiculoData.id}</p>
                  <p className="mt-2">Acceso de solo lectura sin autenticación</p>
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="size-4 mr-2" />
                  Descargar QR
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline">
            <Printer className="size-4 mr-2" />
            Imprimir Ficha
          </Button>
        </div>
      </div>
      
      {/* Alertas activas - RF-FLOTA-071 */}
      {alertas.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            <strong>Alertas activas ({alertas.length}):</strong>
            <ul className="mt-2 space-y-1">
              {alertas.map((alerta, idx) => (
                <li key={idx}>• {alerta.mensaje}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Alertas de documentos */}
      {(documentosVencidos > 0 || documentosPorVencer > 0) && (
        <Alert>
          <FileCheck className="size-4" />
          <AlertDescription>
            <strong>Estado de documentos:</strong>
            {documentosVencidos > 0 && (
              <span className="text-red-600 ml-2">{documentosVencidos} vencido(s)</span>
            )}
            {documentosPorVencer > 0 && (
              <span className="text-yellow-600 ml-2">{documentosPorVencer} por vencer en 30 días</span>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {/* KPIs rápidos del vehículo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Kilometraje Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{vehiculoData.kilometraje.toLocaleString()} km</div>
            <Progress 
              value={(vehiculoData.kilometraje / vehiculoData.kilometrajePróximoMantenimiento) * 100} 
              className="mt-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Próximo mant. en {vehiculoData.kilometrajePróximoMantenimiento.toLocaleString()} km
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Consumo Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{vehiculoData.consumoPromedio} L</div>
            <p className="text-sm text-muted-foreground mt-2">Por cada 100 km</p>
            <p className="text-xs text-muted-foreground mt-1">
              Eficiencia operativa
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Costo por KM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${vehiculoData.costoPorKm}</div>
            <p className="text-sm text-muted-foreground mt-2">USD promedio</p>
            <p className="text-xs text-muted-foreground mt-1">
              Incluye todos los costos
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Horas de Operación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{vehiculoData.horasOperacion.toLocaleString()} hrs</div>
            <p className="text-sm text-muted-foreground mt-2">Total acumulado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Desde adquisición
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs principales - Navegación por secciones */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos
            {(documentosVencidos + documentosPorVencer) > 0 && (
              <Badge variant="destructive" className="ml-2 size-5 p-0 flex items-center justify-center">
                {documentosVencidos + documentosPorVencer}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="mantenimientos">Mantenimientos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="telemetria">GPS/Telemetría</TabsTrigger>
        </TabsList>
        
        {/* TAB 1: INFORMACIÓN GENERAL */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información técnica */}
            <Card>
              <CardHeader>
                <CardTitle>Información Técnica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de Vehículo</p>
                    <p className="font-medium">{vehiculoData.tipo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Año</p>
                    <p className="font-medium">{vehiculoData.año}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Marca</p>
                    <p className="font-medium">{vehiculoData.marca}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Modelo</p>
                    <p className="font-medium">{vehiculoData.modelo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Color</p>
                    <p className="font-medium">{vehiculoData.color}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Motor</p>
                    <p className="font-medium">{vehiculoData.motor}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">VIN</p>
                    <p className="font-medium text-xs">{vehiculoData.vin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capacidad</p>
                    <p className="font-medium">{vehiculoData.capacidad}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Estado Operativo</p>
                  {getEstadoBadge(estado)}
                </div>
              </CardContent>
            </Card>
            
            {/* Asignación actual */}
            <Card>
              <CardHeader>
                <CardTitle>Asignación Actual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Conductor Asignado</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="size-4 text-muted-foreground" />
                    <p className="font-medium">{vehiculoData.conductor}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{vehiculoData.cliente}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Departamento</p>
                  <p className="font-medium">{vehiculoData.departamento}</p>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Adquisición</p>
                  <p className="font-medium">{vehiculoData.fechaAdquisicion}</p>
                </div>
                
                <Button variant="outline" className="w-full">
                  <User className="size-4 mr-2" />
                  Cambiar Asignación
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Información de mantenimiento */}
          <Card>
            <CardHeader>
              <CardTitle>Información de Mantenimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Último Mantenimiento</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <p className="font-medium">{vehiculoData.ultimoMantenimiento}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Hace 40 días</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Próximo Mantenimiento</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-yellow-600" />
                    <p className="font-medium text-yellow-600">{vehiculoData.proximoMantenimiento}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">En 9 días (Vencido)</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Estado del Sistema</p>
                  <Badge variant="destructive">
                    <AlertCircle className="size-3 mr-1" />
                    Mantenimiento Vencido
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Programar urgente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 2: DOCUMENTOS - RF-FLOTA-070 */}
        <TabsContent value="documentos" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documentos del Vehículo</CardTitle>
                <Button>
                  <Upload className="size-4 mr-2" />
                  Cargar Documento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Documento</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Fecha Emisión</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Días Restantes</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentosVehiculo.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileCheck className="size-4 text-muted-foreground" />
                          {doc.tipo}
                        </div>
                      </TableCell>
                      <TableCell>{doc.numero}</TableCell>
                      <TableCell>{doc.entidad}</TableCell>
                      <TableCell>{doc.fechaEmision}</TableCell>
                      <TableCell>
                        {doc.fechaVencimiento || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {getDocumentoEstadoBadge(doc.estado, doc.diasRestantes)}
                      </TableCell>
                      <TableCell>
                        {doc.diasRestantes !== null ? (
                          <span className={doc.diasRestantes < 30 ? 'text-red-600 font-medium' : ''}>
                            {doc.diasRestantes < 0 
                              ? `Vencido hace ${Math.abs(doc.diasRestantes)} días`
                              : `${doc.diasRestantes} días`
                            }
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 3: HISTORIAL - CU-FLOTA-07, RNF-FLOTA-030 */}
        <TabsContent value="historial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial Completo del Vehículo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Timeline cronológico con trazabilidad total. Los registros históricos son inmutables.
              </p>
            </CardHeader>
            <CardContent>
              {/* Timeline */}
              <div className="space-y-4">
                {historialVehiculo.map((evento, idx) => (
                  <div key={evento.id} className="flex gap-4">
                    {/* Línea temporal */}
                    <div className="flex flex-col items-center">
                      <div className="size-8 rounded-full bg-background border-2 flex items-center justify-center">
                        {getEventoIcon(evento.tipo)}
                      </div>
                      {idx < historialVehiculo.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border min-h-[60px]"></div>
                      )}
                    </div>
                    
                    {/* Contenido del evento */}
                    <div className="flex-1 pb-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{evento.evento}</h4>
                            <Badge variant="outline" className="text-xs">
                              {evento.categoria}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {evento.descripcion}
                          </p>
                          
                          {/* Metadata adicional */}
                          {evento.metadata && (
                            <div className="mt-2 p-3 bg-muted/50 rounded text-xs space-y-1">
                              {Object.entries(evento.metadata).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground">{key}:</span>{' '}
                                  <span className="font-medium">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Costo si aplica */}
                          {'costo' in evento && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <DollarSign className="size-4 text-green-600" />
                              <span className="font-medium">${evento.costo?.toFixed(2)} USD</span>
                            </div>
                          )}
                          
                          {/* Proveedor si aplica */}
                          {'proveedor' in evento && (
                            <div className="mt-1 text-sm text-muted-foreground">
                              Proveedor: {evento.proveedor}
                            </div>
                          )}
                          
                          {/* Auditoría - RNF-FLOTA-030 */}
                          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="size-3" />
                              <span>{evento.usuario}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="size-3" />
                              <span>{evento.fecha}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Footer de auditoría */}
              <Separator className="my-6" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="size-4" />
                  <span>
                    <strong>Trazabilidad garantizada:</strong> Todos los registros son inmutables y auditables
                  </span>
                </div>
                <div>
                  Total de eventos: {historialVehiculo.length}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 4: MANTENIMIENTOS - CU-FLOTA-03 */}
        <TabsContent value="mantenimientos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Mantenimientos Realizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {historialVehiculo.filter(h => h.tipo === 'mantenimiento').length}
                </div>
                <p className="text-sm text-muted-foreground mt-2">Desde adquisición</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Preventivos vs Correctivos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">2 / 0</div>
                <p className="text-sm text-green-600 mt-2">Excelente ratio</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Costo Total Mantenimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">$8,920</div>
                <p className="text-sm text-muted-foreground mt-2">Acumulado</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Próximos Mantenimientos Programados</CardTitle>
                <Button>
                  <Calendar className="size-4 mr-2" />
                  Programar Nuevo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <strong>Mantenimiento Vencido:</strong> El mantenimiento preventivo de 50,000 km está vencido hace 5 días.
                  Se recomienda programar de inmediato.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Mantenimiento Preventivo 50,000 km</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cambio de aceite, filtros y revisión general
                      </p>
                    </div>
                    <Badge variant="destructive">Vencido</Badge>
                  </div>
                  <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
                    <span>Fecha programada: 2024-12-20</span>
                    <span>Km objetivo: 50,000 km</span>
                    <span>Estado: Vencido hace 5 días</span>
                  </div>
                  <Button variant="outline" className="mt-3" size="sm">
                    <Wrench className="size-4 mr-2" />
                    Ejecutar Mantenimiento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 5: COSTOS */}
        <TabsContent value="costos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  <Fuel className="size-4 inline mr-1" />
                  Combustible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  ${costosVehiculo.totales.combustible.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  <Wrench className="size-4 inline mr-1" />
                  Mantenimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  ${costosVehiculo.totales.mantenimiento.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  <Shield className="size-4 inline mr-1" />
                  Seguros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  ${costosVehiculo.totales.seguros.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  <AlertTriangle className="size-4 inline mr-1" />
                  Siniestros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  ${costosVehiculo.totales.siniestros.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Costo Total del Vehículo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold mb-2">
                ${Object.values(costosVehiculo.totales).reduce((a, b) => a + b, 0).toLocaleString()} USD
              </div>
              <p className="text-sm text-muted-foreground">
                Inversión total desde adquisición ({vehiculoData.fechaAdquisicion})
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 6: GPS/TELEMETRÍA - Preparado para integración futura */}
        <TabsContent value="telemetria" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GPS y Telemetría</CardTitle>
              <p className="text-sm text-muted-foreground">
                Integración con sistema de rastreo GPS (En desarrollo)
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <MapPin className="size-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Módulo en Desarrollo</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Esta sección permitirá visualizar la ubicación en tiempo real del vehículo,
                  rutas recorridas, velocidad promedio y alertas de geocercas.
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Preparado para integración con proveedores: Wialon, Fleet Complete, Geotab
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Footer con auditoría - RNF-FLOTA-030 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="size-4" />
              <span>
                <strong>Auditoría:</strong> Última modificación por admin@memphis.com.pe el {new Date().toLocaleString('es-ES')}
              </span>
            </div>
            <div>
              ID Vehículo: {vehiculoData.id} | VIN: {vehiculoData.vin}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
