import { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Calendar,
  DollarSign,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface Proyecto {
  id: string;
  nombre: string;
  codigo: string;
  estado: 'planificacion' | 'en_curso' | 'en_pausa' | 'completado';
  progreso: number;
  presupuesto: number;
  gastado: number;
  fechaInicio: string;
  fechaFin: string;
  responsable: string;
  equipo: number;
}

const proyectosData: Proyecto[] = [
  {
    id: '1',
    nombre: 'Implementación Hospital Regional',
    codigo: 'PROY-2024-001',
    estado: 'en_curso',
    progreso: 75,
    presupuesto: 450000,
    gastado: 337500,
    fechaInicio: '2024-01-15',
    fechaFin: '2024-12-31',
    responsable: 'Dr. Carlos Méndez',
    equipo: 12
  },
  {
    id: '2',
    nombre: 'Modernización Centro Médico',
    codigo: 'PROY-2024-002',
    estado: 'en_curso',
    progreso: 45,
    presupuesto: 280000,
    gastado: 126000,
    fechaInicio: '2024-03-01',
    fechaFin: '2025-02-28',
    responsable: 'Ing. Ana Torres',
    equipo: 8
  },
  {
    id: '3',
    nombre: 'Equipamiento Laboratorio Especializado',
    codigo: 'PROY-2024-003',
    estado: 'completado',
    progreso: 100,
    presupuesto: 180000,
    gastado: 175000,
    fechaInicio: '2024-01-10',
    fechaFin: '2024-06-30',
    responsable: 'Lic. María García',
    equipo: 5
  },
  {
    id: '4',
    nombre: 'Sistema de Gestión Integral',
    codigo: 'PROY-2024-004',
    estado: 'planificacion',
    progreso: 15,
    presupuesto: 320000,
    gastado: 48000,
    fechaInicio: '2024-11-01',
    fechaFin: '2025-10-31',
    responsable: 'Ing. José Ramírez',
    equipo: 10
  }
];

const timelineEvents = [
  { fecha: '2024-01-15', evento: 'Inicio del proyecto', tipo: 'inicio' },
  { fecha: '2024-03-20', evento: 'Fase 1 completada', tipo: 'hito' },
  { fecha: '2024-06-15', evento: 'Revisión de medio término', tipo: 'revision' },
  { fecha: '2024-09-10', evento: 'Fase 2 completada', tipo: 'hito' },
  { fecha: '2024-11-25', evento: 'Checkpoint actual', tipo: 'actual' },
  { fecha: '2024-12-31', evento: 'Cierre planificado', tipo: 'fin' }
];

export function Proyectos() {
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto>(proyectosData[0]);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'planificacion':
        return <Badge variant="secondary">Planificación</Badge>;
      case 'en_curso':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">En Curso</Badge>;
      case 'en_pausa':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">En Pausa</Badge>;
      case 'completado':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Completado</Badge>;
      default:
        return <Badge>{estado}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Gestión de Proyectos</h2>
          <p className="text-muted-foreground mt-1">
            Administra y monitorea tus proyectos
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Proyectos</CardTitle>
            <FolderKanban className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{proyectosData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Activos y planificados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">En Curso</CardTitle>
            <Clock className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {proyectosData.filter(p => p.estado === 'en_curso').length}
            </div>
            <p className="text-xs text-blue-600 mt-1">Proyectos activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Presupuesto Total</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              S/ {proyectosData.reduce((sum, p) => sum + p.presupuesto, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Todos los proyectos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Completados</CardTitle>
            <CheckCircle2 className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {proyectosData.filter(p => p.estado === 'completado').length}
            </div>
            <p className="text-xs text-green-600 mt-1">Este año</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Proyectos */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Proyectos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {proyectosData.map((proyecto) => (
                <div
                  key={proyecto.id}
                  className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                    selectedProyecto.id === proyecto.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedProyecto(proyecto)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{proyecto.nombre}</h4>
                      <p className="text-xs text-muted-foreground">{proyecto.codigo}</p>
                    </div>
                    {getEstadoBadge(proyecto.estado)}
                  </div>
                  <Progress value={proyecto.progreso} className="h-1.5 mb-2" />
                  <p className="text-xs text-muted-foreground">{proyecto.progreso}% completado</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detalle del Proyecto */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedProyecto.nombre}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{selectedProyecto.codigo}</p>
              </div>
              {getEstadoBadge(selectedProyecto.estado)}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Vista General</TabsTrigger>
                <TabsTrigger value="timeline">Cronograma</TabsTrigger>
                <TabsTrigger value="costos">Costos</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-4">
                {/* Progreso */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-muted-foreground">Progreso General</Label>
                    <span className="text-sm font-medium">{selectedProyecto.progreso}%</span>
                  </div>
                  <Progress value={selectedProyecto.progreso} className="h-3" />
                </div>

                {/* Información del Proyecto */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Responsable</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Users className="size-4 text-muted-foreground" />
                      <p>{selectedProyecto.responsable}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Miembros del Equipo</Label>
                    <p className="mt-1">{selectedProyecto.equipo} personas</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Fecha de Inicio</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="size-4 text-muted-foreground" />
                      <p>{selectedProyecto.fechaInicio}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Fecha de Fin</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="size-4 text-muted-foreground" />
                      <p>{selectedProyecto.fechaFin}</p>
                    </div>
                  </div>
                </div>

                {/* Presupuesto */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Presupuesto y Gastos</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Presupuesto Total</span>
                      <span className="font-semibold">S/ {selectedProyecto.presupuesto.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Gastado</span>
                      <span className="font-semibold text-blue-600">
                        S/ {selectedProyecto.gastado.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Disponible</span>
                      <span className="font-semibold text-green-600">
                        S/ {(selectedProyecto.presupuesto - selectedProyecto.gastado).toLocaleString()}
                      </span>
                    </div>
                    <Progress 
                      value={(selectedProyecto.gastado / selectedProyecto.presupuesto) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <div className="space-y-1 relative before:absolute before:left-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-border">
                  {timelineEvents.map((event, index) => (
                    <div key={index} className="flex gap-4 relative">
                      <div className="relative z-10">
                        <div className={`size-5 rounded-full border-2 bg-background flex items-center justify-center ${
                          event.tipo === 'actual' 
                            ? 'border-primary bg-primary' 
                            : event.tipo === 'hito'
                            ? 'border-green-500'
                            : 'border-border'
                        }`}>
                          {event.tipo === 'actual' && <div className="size-2 rounded-full bg-white dark:bg-gray-900"></div>}
                          {event.tipo === 'hito' && <CheckCircle2 className="size-3 text-green-500" />}
                        </div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{event.evento}</p>
                            <p className="text-xs text-muted-foreground mt-1">{event.fecha}</p>
                          </div>
                          {event.tipo === 'hito' && (
                            <Badge variant="outline" className="text-xs">Hito</Badge>
                          )}
                          {event.tipo === 'actual' && (
                            <Badge className="text-xs">Actual</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="costos" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Presupuestado</TableHead>
                      <TableHead>Gastado</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { categoria: 'Equipamiento', presupuestado: 180000, gastado: 135000 },
                      { categoria: 'Infraestructura', presupuestado: 150000, gastado: 112500 },
                      { categoria: 'Personal', presupuestado: 80000, gastado: 60000 },
                      { categoria: 'Capacitación', presupuestado: 40000, gastado: 30000 }
                    ].map((item, index) => {
                      const disponible = item.presupuestado - item.gastado;
                      const porcentaje = (item.gastado / item.presupuestado) * 100;
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.categoria}</TableCell>
                          <TableCell>S/ {item.presupuestado.toLocaleString()}</TableCell>
                          <TableCell>S/ {item.gastado.toLocaleString()}</TableCell>
                          <TableCell className="text-green-600">S/ {disponible.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={porcentaje} className="h-2 w-16" />
                              <span className="text-sm">{porcentaje.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="documentos" className="mt-4">
                <div className="space-y-2">
                  {[
                    'Plan de Proyecto - v3.2.pdf',
                    'Cronograma Actualizado.xlsx',
                    'Acta de Reunión - Noviembre.docx',
                    'Presupuesto Detallado.xlsx',
                    'Informe de Avance Mensual.pdf'
                  ].map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc}</p>
                          <p className="text-xs text-muted-foreground">Actualizado hace {index + 1} día(s)</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">Ver</Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
