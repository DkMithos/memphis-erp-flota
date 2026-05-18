/**
 * INCIDENCIAS BIOMÉDICAS
 * Lista, filtros, creación y gestión de estado
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { useIncidenciasStore, type Incidencia, type NuevaIncidenciaInput } from '../../../lib/biomedico/incidencias-store';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { toast } from 'sonner';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

// ── Config de badges ──────────────────────────────────────────────────────────

type EstadoInc = Incidencia['estado'];
type SeveridadInc = Incidencia['severidad'];

const ESTADO_CONFIG: Record<EstadoInc, { label: string; className: string }> = {
  abierta: { label: 'Abierta', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  en_investigacion: { label: 'En investigación', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  resuelta: { label: 'Resuelta', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cerrada: { label: 'Cerrada', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400' },
};

const SEVERIDAD_CONFIG: Record<SeveridadInc, { label: string; className: string }> = {
  baja: { label: 'Baja', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  media: { label: 'Media', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const TIPO_LABELS: Record<Incidencia['tipo'], string> = {
  falla: 'Falla',
  error_usuario: 'Error de usuario',
  accidente: 'Accidente',
  deterioro: 'Deterioro',
  otro: 'Otro',
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${className}`}>{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
}

export function BiomedicoIncidencias({ onNavigate }: Props) {
  const { incidencias, loading, crearIncidencia, actualizarEstado, eliminarIncidencia } = useIncidenciasStore();
  const { equipos } = useEquiposStore();
  const confirmAction = useConfirmAction();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoInc | 'todos'>('todos');
  const [filtroSeveridad, setFiltroSeveridad] = useState<SeveridadInc | 'todos'>('todos');

  // Dialog crear
  const [dialogCrear, setDialogCrear] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState<{
    equipoDbId: string;
    equipoId: string;
    tipo: Incidencia['tipo'];
    severidad: Incidencia['severidad'];
    fechaOcurrencia: string;
    descripcion: string;
    reportadoPor: string;
    requiereMantenimiento: boolean;
  }>({
    equipoDbId: '',
    equipoId: '',
    tipo: 'falla',
    severidad: 'media',
    fechaOcurrencia: new Date().toISOString().split('T')[0],
    descripcion: '',
    reportadoPor: '',
    requiereMantenimiento: false,
  });

  // Dialog detalle
  const [selectedInc, setSelectedInc] = useState<Incidencia | null>(null);
  const [dialogDetalle, setDialogDetalle] = useState(false);

  // Dialog cambio de estado
  const [dialogEstado, setDialogEstado] = useState(false);
  const [nuevoEstadoTarget, setNuevoEstadoTarget] = useState<EstadoInc>('en_investigacion');
  const [formEstado, setFormEstado] = useState({
    accionesTomadas: '',
    resueltoPor: '',
    fechaResolucion: '',
  });

  const filtered = useMemo(() => {
    return incidencias.filter(i => {
      const matchSearch =
        !search ||
        i.id.toLowerCase().includes(search.toLowerCase()) ||
        i.equipoId.toLowerCase().includes(search.toLowerCase()) ||
        i.descripcion.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || i.estado === filtroEstado;
      const matchSeveridad = filtroSeveridad === 'todos' || i.severidad === filtroSeveridad;
      return matchSearch && matchEstado && matchSeveridad;
    });
  }, [incidencias, search, filtroEstado, filtroSeveridad]);

  const kpis = useMemo(() => ({
    abiertas: incidencias.filter(i => i.estado === 'abierta').length,
    enInvestigacion: incidencias.filter(i => i.estado === 'en_investigacion').length,
    criticas: incidencias.filter(i => i.severidad === 'critica').length,
    resueltas: incidencias.filter(i => i.estado === 'resuelta' || i.estado === 'cerrada').length,
  }), [incidencias]);

  const handleEquipoChange = (dbId: string) => {
    const equipo = equipos.find(e => e._dbId === dbId);
    setFormData(prev => ({ ...prev, equipoDbId: dbId, equipoId: equipo?.codigo ?? '' }));
  };

  const handleCrear = async () => {
    if (!formData.equipoDbId || !formData.descripcion || !formData.fechaOcurrencia) {
      toast.error('Equipo, descripción y fecha son requeridos');
      return;
    }
    setGuardando(true);
    try {
      const input: NuevaIncidenciaInput = {
        equipoId: formData.equipoId,
        equipoDbId: formData.equipoDbId,
        tipo: formData.tipo,
        severidad: formData.severidad,
        fechaOcurrencia: formData.fechaOcurrencia,
        descripcion: formData.descripcion,
        reportadoPor: formData.reportadoPor || undefined,
        requiereMantenimiento: formData.requiereMantenimiento,
      };
      await crearIncidencia(input);
      toast.success('Incidencia registrada');
      setDialogCrear(false);
      setFormData({
        equipoDbId: '', equipoId: '', tipo: 'falla', severidad: 'media',
        fechaOcurrencia: new Date().toISOString().split('T')[0],
        descripcion: '', reportadoPor: '', requiereMantenimiento: false,
      });
    } catch {
      toast.error('Error al registrar la incidencia');
    } finally {
      setGuardando(false);
    }
  };

  const openDetalle = (inc: Incidencia) => {
    setSelectedInc(inc);
    setDialogDetalle(true);
  };

  const openCambiarEstado = (inc: Incidencia, target: EstadoInc) => {
    setSelectedInc(inc);
    setNuevoEstadoTarget(target);
    setFormEstado({ accionesTomadas: '', resueltoPor: '', fechaResolucion: '' });
    setDialogEstado(true);
  };

  const handleCambiarEstado = async () => {
    if (!selectedInc) return;
    setGuardando(true);
    try {
      const extras: Partial<Incidencia> = {};
      if (formEstado.accionesTomadas) extras.accionesTomadas = formEstado.accionesTomadas;
      if (formEstado.resueltoPor) extras.resueltoPor = formEstado.resueltoPor;
      if (formEstado.fechaResolucion) extras.fechaResolucion = formEstado.fechaResolucion;

      const result = await actualizarEstado(selectedInc._dbId, nuevoEstadoTarget, extras);
      if (result.exito) {
        toast.success(`Estado actualizado a "${ESTADO_CONFIG[nuevoEstadoTarget].label}"`);
        setDialogEstado(false);
        setDialogDetalle(false);
      } else {
        toast.error(result.errores?.[0] ?? 'Error al actualizar');
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (inc: Incidencia) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: `¿Eliminar la incidencia ${inc.id}?`, confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    const result = await eliminarIncidencia(inc._dbId);
    if (result.exito) {
      toast.success('Incidencia eliminada');
      setDialogDetalle(false);
    } else {
      toast.error(result.errores?.[0] ?? 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="size-6 text-primary" />
            Incidencias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reporte y seguimiento de fallas e incidencias técnicas
          </p>
        </div>
        <Button onClick={() => setDialogCrear(true)}>
          <Plus className="size-4" />
          Nueva Incidencia
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<AlertCircle className="size-5 text-blue-600" />} label="Abiertas" value={kpis.abiertas} className="bg-blue-50 dark:bg-blue-950" />
        <KpiCard icon={<AlertTriangle className="size-5 text-yellow-600" />} label="En investigación" value={kpis.enInvestigacion} className="bg-yellow-50 dark:bg-yellow-950" />
        <KpiCard icon={<XCircle className="size-5 text-red-600" />} label="Críticas" value={kpis.criticas} className="bg-red-50 dark:bg-red-950" />
        <KpiCard icon={<CheckCircle className="size-5 text-green-600" />} label="Resueltas" value={kpis.resueltas} className="bg-green-50 dark:bg-green-950" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, equipo, descripción..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroEstado} onValueChange={v => setFiltroEstado(v as EstadoInc | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(Object.keys(ESTADO_CONFIG) as EstadoInc[]).map(e => (
                  <SelectItem key={e} value={e}>{ESTADO_CONFIG[e].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroSeveridad} onValueChange={v => setFiltroSeveridad(v as SeveridadInc | 'todos')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda severidad</SelectItem>
                {(Object.keys(SEVERIDAD_CONFIG) as SeveridadInc[]).map(s => (
                  <SelectItem key={s} value={s}>{SEVERIDAD_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} incidencia{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No se encontraron incidencias.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Ocurrencia</TableHead>
                  <TableHead>Mant.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inc => (
                  <TableRow key={inc._dbId} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetalle(inc)}>
                    <TableCell className="font-mono text-sm font-medium">{inc.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{inc.equipoNombre || inc.equipoId}</p>
                        <p className="text-xs text-muted-foreground">{inc.equipoId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{TIPO_LABELS[inc.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={SEVERIDAD_CONFIG[inc.severidad].className}>
                        {SEVERIDAD_CONFIG[inc.severidad].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ESTADO_CONFIG[inc.estado].className}>
                        {ESTADO_CONFIG[inc.estado].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{inc.fechaOcurrencia}</TableCell>
                    <TableCell>
                      {inc.requiereMantenimiento ? (
                        <span className="text-xs font-medium text-orange-600">Sí</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openDetalle(inc); }}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog: Nueva Incidencia ── */}
      <Dialog open={dialogCrear} onOpenChange={setDialogCrear}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Equipo *</Label>
              <Select value={formData.equipoDbId} onValueChange={handleEquipoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo" />
                </SelectTrigger>
                <SelectContent>
                  {equipos.map(eq => (
                    <SelectItem key={eq._dbId} value={eq._dbId}>
                      {eq.codigo} — {eq.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData(prev => ({ ...prev, tipo: v as Incidencia['tipo'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABELS) as Incidencia['tipo'][]).map(t => (
                      <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Severidad *</Label>
                <Select value={formData.severidad} onValueChange={v => setFormData(prev => ({ ...prev, severidad: v as SeveridadInc }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SEVERIDAD_CONFIG) as SeveridadInc[]).map(s => (
                      <SelectItem key={s} value={s}>{SEVERIDAD_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Fecha de ocurrencia *</Label>
              <Input
                type="date"
                value={formData.fechaOcurrencia}
                onChange={e => setFormData(prev => ({ ...prev, fechaOcurrencia: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción *</Label>
              <Textarea
                placeholder="Describe la incidencia..."
                value={formData.descripcion}
                onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Reportado por</Label>
              <Input
                placeholder="Nombre de quien reporta"
                value={formData.reportadoPor}
                onChange={e => setFormData(prev => ({ ...prev, reportadoPor: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="req-mant"
                checked={formData.requiereMantenimiento}
                onCheckedChange={v => setFormData(prev => ({ ...prev, requiereMantenimiento: v === true }))}
              />
              <Label htmlFor="req-mant" className="cursor-pointer">Requiere mantenimiento</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCrear(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Registrar Incidencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Detalle ── */}
      {selectedInc && (
        <Dialog open={dialogDetalle} onOpenChange={setDialogDetalle}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedInc.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Equipo</p>
                  <p className="font-medium">{selectedInc.equipoNombre || selectedInc.equipoId}</p>
                  <p className="text-xs text-muted-foreground">{selectedInc.equipoId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Estado</p>
                  <Badge variant="outline" className={ESTADO_CONFIG[selectedInc.estado].className}>
                    {ESTADO_CONFIG[selectedInc.estado].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Tipo</p>
                  <p>{TIPO_LABELS[selectedInc.tipo]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Severidad</p>
                  <Badge variant="outline" className={SEVERIDAD_CONFIG[selectedInc.severidad].className}>
                    {SEVERIDAD_CONFIG[selectedInc.severidad].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Fecha Ocurrencia</p>
                  <p>{selectedInc.fechaOcurrencia}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Requiere Mant.</p>
                  <p>{selectedInc.requiereMantenimiento ? 'Sí' : 'No'}</p>
                </div>
                {selectedInc.reportadoPor && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Reportado por</p>
                    <p>{selectedInc.reportadoPor}</p>
                  </div>
                )}
                {selectedInc.resueltoPor && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Resuelto por</p>
                    <p>{selectedInc.resueltoPor}</p>
                  </div>
                )}
                {selectedInc.fechaResolucion && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Fecha Resolución</p>
                    <p>{selectedInc.fechaResolucion}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Descripción</p>
                <p className="bg-muted rounded p-2">{selectedInc.descripcion}</p>
              </div>
              {selectedInc.accionesTomadas && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Acciones tomadas</p>
                  <p className="bg-muted rounded p-2">{selectedInc.accionesTomadas}</p>
                </div>
              )}
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {selectedInc.estado === 'abierta' && (
                <Button variant="outline" size="sm" onClick={() => openCambiarEstado(selectedInc, 'en_investigacion')}>
                  Abrir investigación
                </Button>
              )}
              {selectedInc.estado === 'en_investigacion' && (
                <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => openCambiarEstado(selectedInc, 'resuelta')}>
                  Resolver
                </Button>
              )}
              {selectedInc.estado === 'resuelta' && (
                <Button variant="outline" size="sm" onClick={() => openCambiarEstado(selectedInc, 'cerrada')}>
                  Cerrar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleEliminar(selectedInc)}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog: Cambiar Estado ── */}
      {selectedInc && (
        <Dialog open={dialogEstado} onOpenChange={setDialogEstado}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {nuevoEstadoTarget === 'en_investigacion' && 'Abrir investigación'}
                {nuevoEstadoTarget === 'resuelta' && 'Resolver incidencia'}
                {nuevoEstadoTarget === 'cerrada' && 'Cerrar incidencia'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {(nuevoEstadoTarget === 'resuelta' || nuevoEstadoTarget === 'cerrada') && (
                <>
                  <div className="space-y-1">
                    <Label>Acciones tomadas</Label>
                    <Textarea
                      rows={3}
                      placeholder="Describe las acciones que se tomaron..."
                      value={formEstado.accionesTomadas}
                      onChange={e => setFormEstado(prev => ({ ...prev, accionesTomadas: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Resuelto por</Label>
                    <Input
                      placeholder="Nombre del responsable"
                      value={formEstado.resueltoPor}
                      onChange={e => setFormEstado(prev => ({ ...prev, resueltoPor: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha de resolución</Label>
                    <Input
                      type="date"
                      value={formEstado.fechaResolucion}
                      onChange={e => setFormEstado(prev => ({ ...prev, fechaResolucion: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogEstado(false)}>Cancelar</Button>
              <Button onClick={handleCambiarEstado} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
