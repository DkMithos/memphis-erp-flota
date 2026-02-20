import { 
  ArrowLeft,
  Truck,
  Wrench,
  Edit,
  Save,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Package,
  DollarSign,
  Calendar,
  User,
  Building2,
  FileText,
  Image,
  Upload,
  Download,
  Eye,
  Trash2,
  Plus,
  Search,
  ShieldAlert,
  XCircle,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  TrendingUp,
  Fuel,
  Shield,
  MessageSquare,
  ClipboardCheck
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// Tipos reutilizados
type EstadoOT = 'programada' | 'en_ejecucion' | 'espera_repuesto' | 'espera_aprobacion' | 'cerrada' | 'anulada';
type TipoOT = 'preventivo' | 'correctivo' | 'predictivo';
type CriticidadOT = 'baja' | 'media' | 'alta' | 'critica';

// Data model completo - Orden de Trabajo con todos los detalles
interface OrdenTrabajoDetalle {
  // Identificación
  id: string;
  numeroOT: string;
  
  // Vehículo
  vehiculo: {
    id: string;
    placa: string;
    tipo: string;
    marca: string;
    modelo: string;
    kilometrajeActual: number;
  };
  
  // Clasificación
  tipo: TipoOT;
  criticidad: CriticidadOT;
  estado: EstadoOT;
  
  // Descripción y diagnóstico
  titulo: string;
  descripcionInicial: string;
  diagnosticoTecnico: string | null;
  causaRaiz: string | null;
  solucionAplicada: string | null;
  
  // Fechas y SLA
  fechaCreacion: string;
  fechaProgramada: string;
  fechaInicio: string | null;
  fechaCierre: string | null;
  slaObjetivo: number; // horas
  slaReal: number | null;
  slaEstado: 'cumple' | 'en_riesgo' | 'vencido';
  
  // Kilometraje
  kilometrajeRegistro: number;
  kilometrajeCierre: number | null;
  
  // Taller - RF-FLOTA-092
  taller: {
    id: string;
    nombre: string;
    tipo: 'interno' | 'externo';
    contacto: string | null;
    telefono: string | null;
  };
  
  // Repuestos - RF-FLOTA-091
  repuestos: Array<{
    id: string;
    codigoInventario: string;
    nombre: string;
    cantidad: number;
    stockDisponible: number;
    estadoStock: 'disponible' | 'reservado' | 'consumido' | 'sin_stock';
    costoUnitario: number;
    costoTotal: number;
    fechaReserva: string | null;
    fechaConsumo: string | null;
  }>;
  
  // Costos - RF-FLOTA-093
  costos: {
    manoObraEstimada: number;
    manoObraReal: number;
    repuestosEstimados: number;
    repuestosReales: number;
    tercerosEstimados: number;
    tercerosReales: number;
    otrosEstimados: number;
    otrosReales: number;
    totalEstimado: number;
    totalReal: number;
    centroCosto: string; // FLOTA-MANTENIMIENTO
  };
  
  // Trabajos realizados (bitácora)
  trabajosRealizados: Array<{
    id: string;
    fecha: string;
    usuario: string;
    descripcion: string;
    tiempoEmpleado: number; // horas
  }>;
  
  // Evidencias
  evidencias: Array<{
    id: string;
    tipo: 'foto_antes' | 'foto_despues' | 'documento' | 'factura' | 'informe';
    nombre: string;
    url: string;
    tamano: number; // bytes
    fechaSubida: string;
    subioPor: string;
  }>;
  
  // Checklist de cierre
  checklistCierre: Array<{
    id: string;
    item: string;
    completado: boolean;
    obligatorio: boolean;
  }>;
  
  // Aprobaciones
  aprobaciones: Array<{
    id: string;
    solicitadoPor: string;
    solicitadoEn: string;
    aprobadoPor: string | null;
    aprobadoEn: string | null;
    estado: 'pendiente' | 'aprobado' | 'rechazado';
    motivo: string;
    comentarios: string | null;
  }>;
  
  // Auditoría y timeline - RNF-FLOTA-030
  auditoria: {
    creadoPor: string;
    creadoEn: string;
    modificadoPor: string | null;
    modificadoEn: string | null;
    cerradoPor: string | null;
    cerradoEn: string | null;
    anuladoPor: string | null;
    anuladoEn: string | null;
    motivoAnulacion: string | null;
  };
  
  timeline: Array<{
    id: string;
    fecha: string;
    tipo: 'creacion' | 'cambio_estado' | 'asignacion' | 'diagnostico' | 'trabajo' | 'repuesto' | 'costo' | 'evidencia' | 'aprobacion' | 'cierre' | 'anulacion';
    usuario: string;
    descripcion: string;
    estadoAnterior?: string;
    estadoNuevo?: string;
    metadata?: Record<string, any>;
  }>;
  
  // Observaciones
  observaciones: string | null;
  notasCierre: string | null;
}

// Data de ejemplo - OT en ejecución
const ordenTrabajoEjemplo: OrdenTrabajoDetalle = {
  id: 'OT-002',
  numeroOT: 'OT-2024-002',
  vehiculo: {
    id: 'VH-001',
    placa: 'ABC-123',
    tipo: 'Ambulancia',
    marca: 'Mercedes Benz',
    modelo: 'Sprinter 415 CDI',
    kilometrajeActual: 48500
  },
  tipo: 'correctivo',
  criticidad: 'critica',
  estado: 'en_ejecucion',
  titulo: 'Reparación de sistema de frenos',
  descripcionInicial: 'Desgaste crítico de pastillas de freno delanteras detectado en inspección rutinaria. Conductor reportó reducción en capacidad de frenado.',
  diagnosticoTecnico: 'Inspección visual confirmó desgaste del 95% en pastillas delanteras. Discos en buen estado. Sistema hidráulico sin fugas. Nivel de líquido de frenos bajo (60% restante).',
  causaRaiz: 'Desgaste natural por uso intensivo. Última revisión de frenos hace 8 meses. Vehículo supera promedio de km/día.',
  solucionAplicada: 'Reemplazo de pastillas de freno delanteras OEM. Rellenado de líquido de frenos DOT 4. Ajuste y calibración de sistema. Prueba de frenado satisfactoria.',
  fechaCreacion: '2024-12-24 14:30',
  fechaProgramada: '2024-12-25 08:00',
  fechaInicio: '2024-12-25 08:15',
  fechaCierre: null,
  slaObjetivo: 4,
  slaReal: null,
  slaEstado: 'cumple',
  kilometrajeRegistro: 48500,
  kilometrajeCierre: null,
  taller: {
    id: 'TALLER-002',
    nombre: 'Taller Interno - Base Central',
    tipo: 'interno',
    contacto: 'Carlos Mendoza',
    telefono: '+51 999 888 777'
  },
  repuestos: [
    {
      id: 'REP-001',
      codigoInventario: 'INV-FR-001',
      nombre: 'Pastillas de freno delanteras OEM Mercedes Benz',
      cantidad: 1,
      stockDisponible: 3,
      estadoStock: 'consumido',
      costoUnitario: 280.00,
      costoTotal: 280.00,
      fechaReserva: '2024-12-25 08:20',
      fechaConsumo: '2024-12-25 09:45'
    },
    {
      id: 'REP-002',
      codigoInventario: 'INV-FR-002',
      nombre: 'Líquido de frenos DOT 4 (1L)',
      cantidad: 2,
      stockDisponible: 15,
      estadoStock: 'consumido',
      costoUnitario: 25.00,
      costoTotal: 50.00,
      fechaReserva: '2024-12-25 08:20',
      fechaConsumo: '2024-12-25 10:30'
    }
  ],
  costos: {
    manoObraEstimada: 150.00,
    manoObraReal: 150.00,
    repuestosEstimados: 330.00,
    repuestosReales: 330.00,
    tercerosEstimados: 0,
    tercerosReales: 0,
    otrosEstimados: 0,
    otrosReales: 0,
    totalEstimado: 480.00,
    totalReal: 480.00,
    centroCosto: 'FLOTA-MANTENIMIENTO-CORRECTIVO'
  },
  trabajosRealizados: [
    {
      id: 'TRAB-001',
      fecha: '2024-12-25 08:15',
      usuario: 'carlos.mendoza@kesa.com',
      descripcion: 'Inicio de diagnóstico. Levantamiento de vehículo en rampa. Inspección visual de sistema de frenos.',
      tiempoEmpleado: 0.5
    },
    {
      id: 'TRAB-002',
      fecha: '2024-12-25 09:00',
      usuario: 'carlos.mendoza@kesa.com',
      descripcion: 'Confirmado desgaste del 95% en pastillas delanteras. Discos OK. Procediendo con reemplazo de pastillas.',
      tiempoEmpleado: 1.0
    },
    {
      id: 'TRAB-003',
      fecha: '2024-12-25 10:30',
      usuario: 'carlos.mendoza@kesa.com',
      descripcion: 'Pastillas instaladas. Líquido de frenos rellenado. Sistema purgado y calibrado. En proceso de pruebas.',
      tiempoEmpleado: 1.5
    }
  ],
  evidencias: [
    {
      id: 'EVID-001',
      tipo: 'foto_antes',
      nombre: 'pastillas_desgastadas_antes.jpg',
      url: '/uploads/ot-002/pastillas_antes.jpg',
      tamano: 2048000,
      fechaSubida: '2024-12-25 09:05',
      subioPor: 'carlos.mendoza@kesa.com'
    },
    {
      id: 'EVID-002',
      tipo: 'foto_despues',
      nombre: 'pastillas_nuevas_instaladas.jpg',
      url: '/uploads/ot-002/pastillas_despues.jpg',
      tamano: 1856000,
      fechaSubida: '2024-12-25 10:35',
      subioPor: 'carlos.mendoza@kesa.com'
    }
  ],
  checklistCierre: [
    { id: 'CHK-001', item: 'Prueba de frenado realizada', completado: false, obligatorio: true },
    { id: 'CHK-002', item: 'Niveles de líquidos verificados', completado: false, obligatorio: true },
    { id: 'CHK-003', item: 'Evidencias fotográficas adjuntas', completado: true, obligatorio: true },
    { id: 'CHK-004', item: 'Repuestos consumidos registrados', completado: true, obligatorio: true },
    { id: 'CHK-005', item: 'Costos reales actualizados', completado: true, obligatorio: true },
    { id: 'CHK-006', item: 'Vehículo limpio y listo para servicio', completado: false, obligatorio: false }
  ],
  aprobaciones: [],
  auditoria: {
    creadoPor: 'juan.perez@kesa.com',
    creadoEn: '2024-12-24 14:30:00',
    modificadoPor: 'carlos.mendoza@kesa.com',
    modificadoEn: '2024-12-25 08:15:00',
    cerradoPor: null,
    cerradoEn: null,
    anuladoPor: null,
    anuladoEn: null,
    motivoAnulacion: null
  },
  timeline: [
    {
      id: 'TL-001',
      fecha: '2024-12-24 14:30',
      tipo: 'creacion',
      usuario: 'juan.perez@kesa.com',
      descripcion: 'OT creada por conductor tras detectar problema en frenos'
    },
    {
      id: 'TL-002',
      fecha: '2024-12-24 14:45',
      tipo: 'cambio_estado',
      usuario: 'ana.garcia@kesa.com',
      descripcion: 'Estado cambiado de Programada a En Ejecución',
      estadoAnterior: 'programada',
      estadoNuevo: 'en_ejecucion'
    },
    {
      id: 'TL-003',
      fecha: '2024-12-25 08:15',
      tipo: 'asignacion',
      usuario: 'ana.garcia@kesa.com',
      descripcion: 'Taller asignado: Taller Interno - Base Central'
    },
    {
      id: 'TL-004',
      fecha: '2024-12-25 09:00',
      tipo: 'diagnostico',
      usuario: 'carlos.mendoza@kesa.com',
      descripcion: 'Diagnóstico técnico completado'
    },
    {
      id: 'TL-005',
      fecha: '2024-12-25 09:45',
      tipo: 'repuesto',
      usuario: 'carlos.mendoza@kesa.com',
      descripcion: 'Repuesto consumido: Pastillas de freno delanteras (1 unidad)',
      metadata: { repuesto: 'INV-FR-001', cantidad: 1 }
    },
    {
      id: 'TL-006',
      fecha: '2024-12-25 10:30',
      tipo: 'repuesto',
      usuario: 'carlos.mendoza@kesa.com',
      descripcion: 'Repuesto consumido: Líquido de frenos DOT 4 (2 unidades)',
      metadata: { repuesto: 'INV-FR-002', cantidad: 2 }
    }
  ],
  observaciones: 'Vehículo fuera de servicio hasta completar reparación. Prioridad crítica por seguridad.',
  notasCierre: null
};

export function DetalleOrdenTrabajo({ otId = 'OT-002' }: { otId?: string }) {
  const [ot] = useState<OrdenTrabajoDetalle>(ordenTrabajoEjemplo);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [dialogCerrarOT, setDialogCerrarOT] = useState(false);
  const [dialogAnularOT, setDialogAnularOT] = useState(false);
  
  // Helpers para badges y estados
  const getEstadoBadge = (estado: EstadoOT) => {
    const config = {
      programada: { variant: 'outline' as const, icon: Clock, text: 'Programada', color: 'text-blue-600' },
      en_ejecucion: { variant: 'default' as const, icon: Wrench, text: 'En Ejecución', color: 'text-primary' },
      espera_repuesto: { variant: 'secondary' as const, icon: Package, text: 'Espera Repuesto', color: 'text-yellow-600' },
      espera_aprobacion: { variant: 'secondary' as const, icon: ShieldAlert, text: 'Espera Aprobación', color: 'text-orange-600' },
      cerrada: { variant: 'outline' as const, icon: CheckCircle, text: 'Cerrada', color: 'text-green-600' },
      anulada: { variant: 'secondary' as const, icon: XCircle, text: 'Anulada', color: 'text-gray-600' }
    };
    
    const { variant, icon: Icon, text, color } = config[estado];
    return (
      <Badge variant={variant} className={`${color} text-base px-3 py-1`}>
        <Icon className="size-4 mr-2" />
        {text}
      </Badge>
    );
  };
  
  const getCriticidadBadge = (criticidad: CriticidadOT) => {
    const config = {
      baja: { variant: 'outline' as const, text: 'Baja' },
      media: { variant: 'secondary' as const, text: 'Media' },
      alta: { variant: 'default' as const, text: 'Alta', className: 'bg-yellow-600' },
      critica: { variant: 'destructive' as const, text: 'Crítica' }
    };
    
    const { variant, text, className } = config[criticidad];
    return <Badge variant={variant} className={className}>{text}</Badge>;
  };
  
  const getSLAIndicador = () => {
    const config = {
      cumple: { color: 'text-green-600', icon: CheckCircle, text: 'Dentro de SLA' },
      en_riesgo: { color: 'text-yellow-600', icon: AlertTriangle, text: 'SLA en riesgo' },
      vencido: { color: 'text-red-600', icon: XCircle, text: 'SLA vencido' }
    };
    
    const { color, icon: Icon, text } = config[ot.slaEstado];
    const horasTranscurridas = ot.fechaInicio 
      ? ((new Date().getTime() - new Date(ot.fechaInicio).getTime()) / (1000 * 60 * 60)).toFixed(1)
      : 0;
    
    return (
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className="size-5" />
        <div>
          <p className="font-medium">{text}</p>
          <p className="text-sm">
            {horasTranscurridas}h / {ot.slaObjetivo}h objetivo
          </p>
        </div>
      </div>
    );
  };
  
  const getStockBadge = (estado: string) => {
    const config = {
      disponible: { variant: 'outline' as const, text: 'Disponible', color: 'text-green-600' },
      reservado: { variant: 'secondary' as const, text: 'Reservado', color: 'text-blue-600' },
      consumido: { variant: 'default' as const, text: 'Consumido', color: 'text-gray-600' },
      sin_stock: { variant: 'destructive' as const, text: 'Sin Stock', color: '' }
    };
    
    const { variant, text, color } = config[estado as keyof typeof config] || config.disponible;
    return <Badge variant={variant} className={color}>{text}</Badge>;
  };
  
  // Validar si se puede cerrar la OT
  const puedeAbrirCerrarOT = () => {
    return ot.checklistCierre.every(item => !item.obligatorio || item.completado);
  };
  
  // Cálculo de progreso del checklist
  const progresoChecklist = () => {
    const completados = ot.checklistCierre.filter(item => item.completado).length;
    return (completados / ot.checklistCierre.length) * 100;
  };
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb y navegación */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-4 mr-2" />
          Volver a Lista de OTs
        </Button>
        <span>/</span>
        <span>Flota</span>
        <span>/</span>
        <span>{ot.vehiculo.placa}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{ot.numeroOT}</span>
      </div>
      
      {/* Header con contexto completo */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Lado izquierdo: Info OT y vehículo */}
            <div className="flex-1 space-y-4">
              <div className="flex items-start gap-4">
                <div className="size-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wrench className="size-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl">{ot.numeroOT}</h2>
                    {getEstadoBadge(ot.estado)}
                    {getCriticidadBadge(ot.criticidad)}
                  </div>
                  <p className="text-lg mt-1">{ot.titulo}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-2">
                      <Truck className="size-4" />
                      <span className="font-medium">{ot.vehiculo.placa}</span>
                      <span>-</span>
                      <span>{ot.vehiculo.marca} {ot.vehiculo.modelo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Fuel className="size-4" />
                      <span>{ot.vehiculo.kilometrajeActual.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4" />
                      <span>{ot.taller.nombre}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* SLA Indicator */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    {getSLAIndicador()}
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Fecha Programada</p>
                      <p className="font-medium">
                        {new Date(ot.fechaProgramada).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={ot.slaEstado === 'cumple' ? 50 : ot.slaEstado === 'en_riesgo' ? 80 : 100} 
                    className="mt-3"
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Lado derecho: Acciones contextuales */}
            <div className="flex flex-col gap-2 min-w-[200px]">
              {/* Acciones según estado */}
              {ot.estado === 'programada' && (
                <>
                  <Button>
                    <PlayCircle className="size-4 mr-2" />
                    Iniciar OT
                  </Button>
                  <Button variant="outline">
                    <Edit className="size-4 mr-2" />
                    Editar
                  </Button>
                  <Button variant="outline">
                    <Calendar className="size-4 mr-2" />
                    Reprogramar
                  </Button>
                  <Button variant="destructive" onClick={() => setDialogAnularOT(true)}>
                    <XCircle className="size-4 mr-2" />
                    Anular OT
                  </Button>
                </>
              )}
              
              {ot.estado === 'en_ejecucion' && (
                <>
                  <Button 
                    onClick={() => setDialogCerrarOT(true)}
                    disabled={!puedeAbrirCerrarOT()}
                  >
                    <CheckCircle className="size-4 mr-2" />
                    Cerrar OT
                  </Button>
                  <Button variant="outline" onClick={() => setModoEdicion(!modoEdicion)}>
                    <Edit className="size-4 mr-2" />
                    {modoEdicion ? 'Cancelar Edición' : 'Editar'}
                  </Button>
                  <Button variant="outline">
                    <PauseCircle className="size-4 mr-2" />
                    Pausar (Espera Repuesto)
                  </Button>
                  <Button variant="destructive" onClick={() => setDialogAnularOT(true)}>
                    <XCircle className="size-4 mr-2" />
                    Anular OT
                  </Button>
                </>
              )}
              
              {ot.estado === 'cerrada' && (
                <>
                  <Button variant="outline">
                    <Download className="size-4 mr-2" />
                    Descargar PDF
                  </Button>
                  <Button variant="outline">
                    <Eye className="size-4 mr-2" />
                    Ver Detalles
                  </Button>
                </>
              )}
              
              {/* Siempre visible */}
              <Separator className="my-2" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Creado:</strong> {new Date(ot.auditoria.creadoEn).toLocaleDateString('es-ES')}</p>
                <p><strong>Por:</strong> {ot.auditoria.creadoPor.split('@')[0]}</p>
                {ot.auditoria.modificadoPor && (
                  <p><strong>Modificado:</strong> {ot.auditoria.modificadoPor.split('@')[0]}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Alert de estado cerrada/anulada */}
      {ot.estado === 'cerrada' && (
        <Alert>
          <CheckCircle className="size-4" />
          <AlertDescription>
            <strong>OT Cerrada:</strong> Este registro es inmutable. No se pueden realizar modificaciones.
            Cerrado por {ot.auditoria.cerradoPor?.split('@')[0]} el {ot.auditoria.cerradoEn && new Date(ot.auditoria.cerradoEn).toLocaleString('es-ES')}.
          </AlertDescription>
        </Alert>
      )}
      
      {ot.estado === 'anulada' && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>OT Anulada:</strong> {ot.auditoria.motivoAnulacion || 'Sin motivo especificado'}.
            Anulado por {ot.auditoria.anuladoPor?.split('@')[0]} el {ot.auditoria.anuladoEn && new Date(ot.auditoria.anuladoEn).toLocaleString('es-ES')}.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Tabs principales */}
      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          <TabsTrigger value="repuestos">
            Repuestos
            {ot.repuestos.length > 0 && (
              <Badge variant="secondary" className="ml-2">{ot.repuestos.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="evidencias">
            Evidencias
            {ot.evidencias.length > 0 && (
              <Badge variant="secondary" className="ml-2">{ot.evidencias.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>
        
        {/* TAB 1: RESUMEN */}
        <TabsContent value="resumen" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información general */}
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Descripción Inicial</p>
                  <p className="mt-1">{ot.descripcionInicial}</p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de Mantenimiento</p>
                    <Badge className={
                      ot.tipo === 'preventivo' ? 'bg-blue-100 text-blue-800' :
                      ot.tipo === 'correctivo' ? 'bg-red-100 text-red-800' :
                      'bg-purple-100 text-purple-800'
                    }>
                      {ot.tipo === 'preventivo' ? 'Preventivo' : ot.tipo === 'correctivo' ? 'Correctivo' : 'Predictivo'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nivel de Criticidad</p>
                    {getCriticidadBadge(ot.criticidad)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Kilometraje Registro</p>
                    <p className="font-medium">{ot.kilometrajeRegistro.toLocaleString()} km</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Centro de Costo</p>
                    <p className="font-medium text-sm">{ot.costos.centroCosto}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Observaciones</p>
                  {modoEdicion ? (
                    <Textarea 
                      defaultValue={ot.observaciones || ''} 
                      placeholder="Agregar observaciones..."
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm">{ot.observaciones || 'Sin observaciones'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Taller asignado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Taller Asignado
                  {modoEdicion && (
                    <Button size="sm" variant="outline">
                      <Edit className="size-4 mr-2" />
                      Cambiar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-lg">{ot.taller.nombre}</p>
                    <Badge variant="outline" className="mt-1">
                      {ot.taller.tipo === 'interno' ? 'Taller Interno' : 'Taller Externo'}
                    </Badge>
                  </div>
                </div>
                
                <Separator />
                
                {ot.taller.contacto && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contacto</p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="size-4 text-muted-foreground" />
                      <p className="font-medium">{ot.taller.contacto}</p>
                    </div>
                    {ot.taller.telefono && (
                      <p className="text-sm text-muted-foreground mt-1">{ot.taller.telefono}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Checklist de cierre */}
          {ot.estado === 'en_ejecucion' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-5" />
                    Checklist de Cierre
                  </div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {ot.checklistCierre.filter(item => item.completado).length} de {ot.checklistCierre.length} completados
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progresoChecklist()} />
                
                <div className="space-y-2">
                  {ot.checklistCierre.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <input 
                        type="checkbox" 
                        checked={item.completado}
                        className="size-5"
                        disabled={!modoEdicion}
                      />
                      <div className="flex-1">
                        <p className={item.completado ? 'line-through text-muted-foreground' : ''}>
                          {item.item}
                        </p>
                        {item.obligatorio && (
                          <Badge variant="outline" className="text-xs mt-1">Obligatorio</Badge>
                        )}
                      </div>
                      {item.completado && (
                        <CheckCircle className="size-5 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>
                
                {!puedeAbrirCerrarOT() && (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Debes completar todos los items obligatorios antes de cerrar la OT.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* TAB 2: DIAGNÓSTICO Y TRABAJOS */}
        <TabsContent value="diagnostico" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico Técnico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Diagnóstico</label>
                {modoEdicion ? (
                  <Textarea 
                    defaultValue={ot.diagnosticoTecnico || ''} 
                    placeholder="Describir diagnóstico técnico detallado..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm bg-muted/50 p-3 rounded">
                    {ot.diagnosticoTecnico || 'Pendiente de diagnóstico'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Causa Raíz</label>
                {modoEdicion ? (
                  <Textarea 
                    defaultValue={ot.causaRaiz || ''} 
                    placeholder="Identificar causa raíz del problema..."
                    rows={3}
                  />
                ) : (
                  <p className="text-sm bg-muted/50 p-3 rounded">
                    {ot.causaRaiz || 'Pendiente de análisis'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Solución Aplicada</label>
                {modoEdicion ? (
                  <Textarea 
                    defaultValue={ot.solucionAplicada || ''} 
                    placeholder="Describir solución aplicada..."
                    rows={3}
                  />
                ) : (
                  <p className="text-sm bg-muted/50 p-3 rounded">
                    {ot.solucionAplicada || 'Pendiente de ejecución'}
                  </p>
                )}
              </div>
              
              {modoEdicion && (
                <Button>
                  <Save className="size-4 mr-2" />
                  Guardar Diagnóstico
                </Button>
              )}
            </CardContent>
          </Card>
          
          {/* Bitácora de trabajos realizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Bitácora de Trabajos Realizados
                {modoEdicion && (
                  <Button size="sm">
                    <Plus className="size-4 mr-2" />
                    Agregar Registro
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ot.trabajosRealizados.map((trabajo) => (
                  <div key={trabajo.id} className="border-l-2 border-primary pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {new Date(trabajo.fecha).toLocaleString('es-ES')}
                        </p>
                        <p className="text-sm mt-1">{trabajo.descripcion}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{trabajo.tiempoEmpleado}h</p>
                        <p className="text-xs">{trabajo.usuario.split('@')[0]}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {ot.trabajosRealizados.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="size-12 mx-auto mb-2 opacity-50" />
                    <p>No hay trabajos registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 3: REPUESTOS (INTEGRACIÓN INVENTARIO) - RF-FLOTA-091 */}
        <TabsContent value="repuestos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Repuestos Utilizados
                {modoEdicion && (
                  <Button>
                    <Plus className="size-4 mr-2" />
                    Agregar Repuesto
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {modoEdicion && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar repuesto en inventario..." 
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Repuesto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Costo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {modoEdicion && <TableHead>Acción</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ot.repuestos.map((repuesto) => (
                    <TableRow key={repuesto.id}>
                      <TableCell className="font-mono text-sm">{repuesto.codigoInventario}</TableCell>
                      <TableCell>{repuesto.nombre}</TableCell>
                      <TableCell>{repuesto.cantidad}</TableCell>
                      <TableCell>
                        <span className={repuesto.stockDisponible < 5 ? 'text-red-600 font-medium' : ''}>
                          {repuesto.stockDisponible} unidades
                        </span>
                      </TableCell>
                      <TableCell>{getStockBadge(repuesto.estadoStock)}</TableCell>
                      <TableCell>${repuesto.costoUnitario.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${repuesto.costoTotal.toFixed(2)}
                      </TableCell>
                      {modoEdicion && (
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Total repuestos: {ot.repuestos.length} items
                </p>
                <p className="text-lg font-semibold">
                  Subtotal: ${ot.repuestos.reduce((sum, r) => sum + r.costoTotal, 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 4: COSTOS (INTEGRACIÓN FINANZAS) - RF-FLOTA-093 */}
        <TabsContent value="costos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Costos Estimados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mano de Obra</span>
                  <span className="font-semibold">${ot.costos.manoObraEstimada.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Repuestos</span>
                  <span className="font-semibold">${ot.costos.repuestosEstimados.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Servicios Terceros</span>
                  <span className="font-semibold">${ot.costos.tercerosEstimados.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Otros</span>
                  <span className="font-semibold">${ot.costos.otrosEstimados.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-lg">
                  <span className="font-medium">Total Estimado</span>
                  <span className="font-bold">${ot.costos.totalEstimado.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Costos Reales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mano de Obra</span>
                  {modoEdicion ? (
                    <Input type="number" defaultValue={ot.costos.manoObraReal} className="w-32 text-right" />
                  ) : (
                    <span className="font-semibold">${ot.costos.manoObraReal.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Repuestos</span>
                  <span className="font-semibold">${ot.costos.repuestosReales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Servicios Terceros</span>
                  {modoEdicion ? (
                    <Input type="number" defaultValue={ot.costos.tercerosReales} className="w-32 text-right" />
                  ) : (
                    <span className="font-semibold">${ot.costos.tercerosReales.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Otros</span>
                  {modoEdicion ? (
                    <Input type="number" defaultValue={ot.costos.otrosReales} className="w-32 text-right" />
                  ) : (
                    <span className="font-semibold">${ot.costos.otrosReales.toFixed(2)}</span>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between items-center text-lg">
                  <span className="font-medium">Total Real</span>
                  <span className="font-bold text-primary">${ot.costos.totalReal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Variación de costos */}
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Variación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Variación Total</p>
                    <p className="text-2xl font-bold">
                      ${(ot.costos.totalReal - ot.costos.totalEstimado).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Porcentaje</p>
                    <p className="text-2xl font-bold text-green-600">
                      {((ot.costos.totalReal - ot.costos.totalEstimado) / ot.costos.totalEstimado * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {ot.costos.totalReal > 1500 && ot.estado !== 'cerrada' && (
                  <Alert>
                    <ShieldAlert className="size-4" />
                    <AlertDescription>
                      <strong>Aprobación Requerida:</strong> El costo total excede el umbral de $1,500 USD. 
                      Esta OT requiere aprobación gerencial antes de continuar.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Centro de Costo</p>
                    {modoEdicion ? (
                      <Select defaultValue={ot.costos.centroCosto}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FLOTA-MANTENIMIENTO-PREVENTIVO">Preventivo</SelectItem>
                          <SelectItem value="FLOTA-MANTENIMIENTO-CORRECTIVO">Correctivo</SelectItem>
                          <SelectItem value="FLOTA-MANTENIMIENTO-PREDICTIVO">Predictivo</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{ot.costos.centroCosto}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 5: EVIDENCIAS Y DOCUMENTOS */}
        <TabsContent value="evidencias" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Evidencias Fotográficas y Documentos
                {modoEdicion && (
                  <Button>
                    <Upload className="size-4 mr-2" />
                    Cargar Archivo
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ot.evidencias.map((evidencia) => (
                  <div key={evidencia.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {evidencia.tipo.includes('foto') ? (
                          <Image className="size-5 text-primary" />
                        ) : (
                          <FileText className="size-5 text-primary" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {evidencia.tipo.replace('_', ' ')}
                        </Badge>
                      </div>
                      {modoEdicion && (
                        <Button variant="ghost" size="sm">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    
                    {evidencia.tipo.includes('foto') ? (
                      <div className="aspect-video bg-muted rounded mb-3 flex items-center justify-center">
                        <Image className="size-12 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted rounded mb-3 flex items-center justify-center">
                        <FileText className="size-12 text-muted-foreground" />
                      </div>
                    )}
                    
                    <p className="text-sm font-medium truncate">{evidencia.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(evidencia.tamano / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(evidencia.fechaSubida).toLocaleDateString('es-ES')}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="size-4 mr-1" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Download className="size-4 mr-1" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                ))}
                
                {ot.evidencias.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Image className="size-16 mx-auto mb-4 opacity-50" />
                    <p>No hay evidencias cargadas</p>
                    {modoEdicion && (
                      <Button className="mt-4" variant="outline">
                        <Upload className="size-4 mr-2" />
                        Cargar Primera Evidencia
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 6: AUDITORÍA Y TIMELINE - RNF-FLOTA-030 */}
        <TabsContent value="auditoria" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Timeline de Auditoría
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Registro inmutable de todos los cambios realizados en la OT
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ot.timeline.map((evento, idx) => (
                  <div key={evento.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="size-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center flex-shrink-0">
                        {evento.tipo === 'creacion' && <Plus className="size-4 text-primary" />}
                        {evento.tipo === 'cambio_estado' && <RotateCcw className="size-4 text-primary" />}
                        {evento.tipo === 'asignacion' && <Building2 className="size-4 text-primary" />}
                        {evento.tipo === 'diagnostico' && <FileText className="size-4 text-primary" />}
                        {evento.tipo === 'trabajo' && <Wrench className="size-4 text-primary" />}
                        {evento.tipo === 'repuesto' && <Package className="size-4 text-primary" />}
                        {evento.tipo === 'costo' && <DollarSign className="size-4 text-primary" />}
                        {evento.tipo === 'evidencia' && <Image className="size-4 text-primary" />}
                        {evento.tipo === 'aprobacion' && <ShieldAlert className="size-4 text-primary" />}
                        {evento.tipo === 'cierre' && <CheckCircle className="size-4 text-primary" />}
                        {evento.tipo === 'anulacion' && <XCircle className="size-4 text-primary" />}
                      </div>
                      {idx < ot.timeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border min-h-[40px]"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{evento.descripcion}</p>
                          {evento.estadoAnterior && evento.estadoNuevo && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{evento.estadoAnterior}</Badge>
                              <span className="text-xs text-muted-foreground">→</span>
                              <Badge variant="default" className="text-xs">{evento.estadoNuevo}</Badge>
                            </div>
                          )}
                          {evento.metadata && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              {Object.entries(evento.metadata).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground">{key}:</span>{' '}
                                  <span className="font-medium">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground min-w-[150px]">
                          <p>{new Date(evento.fecha).toLocaleDateString('es-ES')}</p>
                          <p>{new Date(evento.fecha).toLocaleTimeString('es-ES')}</p>
                          <p className="text-xs mt-1">{evento.usuario.split('@')[0]}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <Separator className="my-6" />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="size-4" />
                  <span>
                    <strong>Trazabilidad garantizada:</strong> Todos los registros son inmutables conforme a RNF-FLOTA-030
                  </span>
                </div>
                <div>
                  Total de eventos: {ot.timeline.length}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog: Cerrar OT */}
      <Dialog open={dialogCerrarOT} onOpenChange={setDialogCerrarOT}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-6 text-green-600" />
              Cerrar Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Una vez cerrada la OT, no se podrán realizar más modificaciones.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <ClipboardCheck className="size-4" />
              <AlertDescription>
                <strong>Checklist completado:</strong> {ot.checklistCierre.filter(item => item.completado).length} de {ot.checklistCierre.length} items
              </AlertDescription>
            </Alert>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Kilometraje al Cierre</label>
              <Input type="number" placeholder="Ej: 48550" />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Notas de Cierre *</label>
              <Textarea 
                placeholder="Describir el estado final del vehículo, trabajos completados y observaciones finales..."
                rows={4}
              />
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Resumen de Costos Finales</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Mano de Obra:</span>
                  <span className="font-medium">${ot.costos.manoObraReal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Repuestos:</span>
                  <span className="font-medium">${ot.costos.repuestosReales.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold">${ot.costos.totalReal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCerrarOT(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setDialogCerrarOT(false)}
              disabled={!puedeAbrirCerrarOT()}
            >
              <CheckCircle className="size-4 mr-2" />
              Confirmar Cierre de OT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog: Anular OT */}
      <Dialog open={dialogAnularOT} onOpenChange={setDialogAnularOT}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-6 text-destructive" />
              Anular Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              La OT no será eliminada, pero quedará marcada como anulada en el sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Esta acción es irreversible y quedará registrada en la auditoría.
              </AlertDescription>
            </Alert>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Motivo de Anulación *</label>
              <Textarea 
                placeholder="Describir el motivo por el cual se anula esta OT..."
                rows={4}
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAnularOT(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => setDialogAnularOT(false)}
            >
              <XCircle className="size-4 mr-2" />
              Confirmar Anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
