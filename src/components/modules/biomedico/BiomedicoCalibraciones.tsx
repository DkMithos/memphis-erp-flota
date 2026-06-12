/**
 * CALIBRACIONES BIOMÉDICAS
 * Lista, filtros, creación y gestión de estado
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { PageNav } from '../../shared/PageNav';
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
import { useCalibracionesStore, type Calibracion, type NuevaCalibracionInput } from '../../../lib/biomedico/calibraciones-store';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { toast } from 'sonner';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

// ── Config de badges ──────────────────────────────────────────────────────────

type EstadoCal = Calibracion['estado'];

const ESTADO_CONFIG: Record<EstadoCal, { label: string; className: string }> = {
  programada: { label: 'Programada', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  en_proceso: { label: 'En proceso', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  aprobada: { label: 'Aprobada', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rechazada: { label: 'Rechazada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  vencida: { label: 'Vencida', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400' },
};

const TIPO_LABELS: Record<Calibracion['tipo'], string> = {
  interna: 'Interna',
  externa: 'Externa',
  verificacion: 'Verificación',
};

const RESULTADO_LABELS: Record<NonNullable<Calibracion['resultado']>, string> = {
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  con_observaciones: 'Con observaciones',
};

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 text-white [&_svg]:text-white [&_svg]:size-5 ${className}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
}

export function BiomedicoCalibraciones({ onNavigate }: Props) {
  const { calibraciones, loading, crearCalibracion, actualizarEstado, eliminarCalibracion } = useCalibracionesStore();
  const { equipos } = useEquiposStore();
  const confirmAction = useConfirmAction();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoCal | 'todos'>('todos');

  // Dialog crear
  const [dialogCrear, setDialogCrear] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState<{
    equipoDbId: string;
    equipoId: string;
    tipo: Calibracion['tipo'];
    fechaProgramada: string;
    responsable: string;
    observaciones: string;
  }>({
    equipoDbId: '',
    equipoId: '',
    tipo: 'interna',
    fechaProgramada: '',
    responsable: '',
    observaciones: '',
  });

  // Dialog detalle / acciones
  const [selectedCal, setSelectedCal] = useState<Calibracion | null>(null);
  const [dialogDetalle, setDialogDetalle] = useState(false);

  // Dialog cambio de estado
  const [dialogEstado, setDialogEstado] = useState(false);
  const [nuevoEstadoTarget, setNuevoEstadoTarget] = useState<EstadoCal>('en_proceso');
  const [formEstado, setFormEstado] = useState({
    resultado: '' as NonNullable<Calibracion['resultado']> | '',
    certificadoNumero: '',
    incertidumbre: '',
    observaciones: '',
    fechaRealizada: '',
    fechaVencimiento: '',
  });

  const filtered = useMemo(() => {
    return calibraciones.filter(c => {
      const matchSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.equipoId.toLowerCase().includes(search.toLowerCase()) ||
        c.equipoNombre.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado;
      return matchSearch && matchEstado;
    });
  }, [calibraciones, search, filtroEstado]);

  // KPIs
  const kpis = useMemo(() => ({
    programadas: calibraciones.filter(c => c.estado === 'programada').length,
    enProceso: calibraciones.filter(c => c.estado === 'en_proceso').length,
    aprobadas: calibraciones.filter(c => c.estado === 'aprobada').length,
    vencidas: calibraciones.filter(c => c.estado === 'vencida').length,
  }), [calibraciones]);

  const handleEquipoChange = (dbId: string) => {
    const equipo = equipos.find(e => e._dbId === dbId);
    setFormData(prev => ({
      ...prev,
      equipoDbId: dbId,
      equipoId: equipo?.codigo ?? '',
    }));
  };

  const handleCrear = async () => {
    if (!formData.equipoDbId || !formData.fechaProgramada) {
      toast.error('Equipo y fecha son requeridos');
      return;
    }
    setGuardando(true);
    try {
      const input: NuevaCalibracionInput = {
        equipoId: formData.equipoId,
        equipoDbId: formData.equipoDbId,
        tipo: formData.tipo,
        fechaProgramada: formData.fechaProgramada,
        responsable: formData.responsable || undefined,
        observaciones: formData.observaciones || undefined,
      };
      await crearCalibracion(input);
      toast.success('Calibración creada');
      setDialogCrear(false);
      setFormData({ equipoDbId: '', equipoId: '', tipo: 'interna', fechaProgramada: '', responsable: '', observaciones: '' });
    } catch (err) {
      toast.error('Error al crear la calibración');
    } finally {
      setGuardando(false);
    }
  };

  const openDetalle = (cal: Calibracion) => {
    setSelectedCal(cal);
    setDialogDetalle(true);
  };

  const openCambiarEstado = (cal: Calibracion, target: EstadoCal) => {
    setSelectedCal(cal);
    setNuevoEstadoTarget(target);
    setFormEstado({ resultado: '', certificadoNumero: '', incertidumbre: '', observaciones: '', fechaRealizada: '', fechaVencimiento: '' });
    setDialogEstado(true);
  };

  const handleCambiarEstado = async () => {
    if (!selectedCal) return;
    setGuardando(true);
    try {
      const extras: Partial<Calibracion> = {};
      if (formEstado.fechaRealizada) extras.fechaRealizada = formEstado.fechaRealizada;
      if (formEstado.fechaVencimiento) extras.fechaVencimiento = formEstado.fechaVencimiento;
      if (formEstado.resultado) extras.resultado = formEstado.resultado as NonNullable<Calibracion['resultado']>;
      if (formEstado.certificadoNumero) extras.certificadoNumero = formEstado.certificadoNumero;
      if (formEstado.incertidumbre) extras.incertidumbre = formEstado.incertidumbre;
      if (formEstado.observaciones) extras.observaciones = formEstado.observaciones;

      const result = await actualizarEstado(selectedCal._dbId, nuevoEstadoTarget, extras);
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

  const handleEliminar = async (cal: Calibracion) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: `¿Eliminar la calibración ${cal.id}?`, confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    const result = await eliminarCalibracion(cal._dbId);
    if (result.exito) {
      toast.success('Calibración eliminada');
      setDialogDetalle(false);
    } else {
      toast.error(result.errores?.[0] ?? 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calibraciones</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión de calibraciones y certificaciones de equipos médicos
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogCrear(true)}>
          <Plus className="size-4" />
          Nueva Calibración
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Clock className="size-5" />} label="Programadas" value={kpis.programadas} className="bg-blue-500" />
        <KpiCard icon={<AlertTriangle className="size-5" />} label="En proceso" value={kpis.enProceso} className="bg-amber-500" />
        <KpiCard icon={<CheckCircle className="size-5" />} label="Aprobadas" value={kpis.aprobadas} className="bg-green-500" />
        <KpiCard icon={<XCircle className="size-5" />} label="Vencidas" value={kpis.vencidas} className="bg-red-500" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, equipo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroEstado} onValueChange={v => setFiltroEstado(v as EstadoCal | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(Object.keys(ESTADO_CONFIG) as EstadoCal[]).map(e => (
                  <SelectItem key={e} value={e}>{ESTADO_CONFIG[e].label}</SelectItem>
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
            {filtered.length} calibración{filtered.length !== 1 ? 'es' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No se encontraron calibraciones.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Programada</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(cal => (
                  <TableRow key={cal._dbId} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetalle(cal)}>
                    <TableCell className="font-mono text-sm font-medium">{cal.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{cal.equipoNombre || cal.equipoId}</p>
                        <p className="text-xs text-muted-foreground">{cal.equipoId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{TIPO_LABELS[cal.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ESTADO_CONFIG[cal.estado].className}>
                        {ESTADO_CONFIG[cal.estado].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{cal.fechaProgramada}</TableCell>
                    <TableCell className="text-sm">
                      {cal.resultado ? RESULTADO_LABELS[cal.resultado] : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); openDetalle(cal); }}
                      >
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

      {/* ── Dialog: Nueva Calibración ── */}
      <Dialog open={dialogCrear} onOpenChange={setDialogCrear}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Calibración</DialogTitle>
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
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData(prev => ({ ...prev, tipo: v as Calibracion['tipo'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Interna</SelectItem>
                  <SelectItem value="externa">Externa</SelectItem>
                  <SelectItem value="verificacion">Verificación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha Programada *</Label>
              <Input
                type="date"
                value={formData.fechaProgramada}
                onChange={e => setFormData(prev => ({ ...prev, fechaProgramada: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Input
                placeholder="Nombre del responsable"
                value={formData.responsable}
                onChange={e => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Observaciones adicionales..."
                value={formData.observaciones}
                onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCrear(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleCrear} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Crear Calibración'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Detalle ── */}
      {selectedCal && (
        <Dialog open={dialogDetalle} onOpenChange={setDialogDetalle}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedCal.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Equipo</p>
                  <p className="font-medium">{selectedCal.equipoNombre || selectedCal.equipoId}</p>
                  <p className="text-xs text-muted-foreground">{selectedCal.equipoId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Estado</p>
                  <Badge variant="outline" className={ESTADO_CONFIG[selectedCal.estado].className}>
                    {ESTADO_CONFIG[selectedCal.estado].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Tipo</p>
                  <p>{TIPO_LABELS[selectedCal.tipo]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Fecha Programada</p>
                  <p>{selectedCal.fechaProgramada}</p>
                </div>
                {selectedCal.fechaRealizada && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Fecha Realizada</p>
                    <p>{selectedCal.fechaRealizada}</p>
                  </div>
                )}
                {selectedCal.fechaVencimiento && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Vence</p>
                    <p>{selectedCal.fechaVencimiento}</p>
                  </div>
                )}
                {selectedCal.responsable && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Responsable</p>
                    <p>{selectedCal.responsable}</p>
                  </div>
                )}
                {selectedCal.resultado && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Resultado</p>
                    <p>{RESULTADO_LABELS[selectedCal.resultado]}</p>
                  </div>
                )}
                {selectedCal.certificadoNumero && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">N° Certificado</p>
                    <p>{selectedCal.certificadoNumero}</p>
                  </div>
                )}
                {selectedCal.incertidumbre && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Incertidumbre</p>
                    <p>{selectedCal.incertidumbre}</p>
                  </div>
                )}
              </div>
              {selectedCal.observaciones && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Observaciones</p>
                  <p className="bg-muted rounded p-2">{selectedCal.observaciones}</p>
                </div>
              )}
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {selectedCal.estado === 'programada' && (
                <Button variant="outline" size="sm" onClick={() => openCambiarEstado(selectedCal, 'en_proceso')}>
                  Iniciar
                </Button>
              )}
              {selectedCal.estado === 'en_proceso' && (
                <>
                  <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => openCambiarEstado(selectedCal, 'aprobada')}>
                    Aprobar
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => openCambiarEstado(selectedCal, 'rechazada')}>
                    Rechazar
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleEliminar(selectedCal)}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog: Cambiar Estado ── */}
      {selectedCal && (
        <Dialog open={dialogEstado} onOpenChange={setDialogEstado}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {nuevoEstadoTarget === 'en_proceso' && 'Iniciar calibración'}
                {nuevoEstadoTarget === 'aprobada' && 'Aprobar calibración'}
                {nuevoEstadoTarget === 'rechazada' && 'Rechazar calibración'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Fecha de realización</Label>
                <Input
                  type="date"
                  value={formEstado.fechaRealizada}
                  onChange={e => setFormEstado(prev => ({ ...prev, fechaRealizada: e.target.value }))}
                />
              </div>
              {(nuevoEstadoTarget === 'aprobada' || nuevoEstadoTarget === 'rechazada') && (
                <>
                  <div className="space-y-1">
                    <Label>Resultado *</Label>
                    <Select value={formEstado.resultado} onValueChange={v => setFormEstado(prev => ({ ...prev, resultado: v as NonNullable<Calibracion['resultado']> }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar resultado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aprobada">Aprobada</SelectItem>
                        <SelectItem value="rechazada">Rechazada</SelectItem>
                        <SelectItem value="con_observaciones">Con observaciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>N° Certificado</Label>
                    <Input
                      placeholder="Ej: CERT-2026-001"
                      value={formEstado.certificadoNumero}
                      onChange={e => setFormEstado(prev => ({ ...prev, certificadoNumero: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Incertidumbre</Label>
                    <Input
                      placeholder="Ej: ±0.05%"
                      value={formEstado.incertidumbre}
                      onChange={e => setFormEstado(prev => ({ ...prev, incertidumbre: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha de vencimiento</Label>
                    <Input
                      type="date"
                      value={formEstado.fechaVencimiento}
                      onChange={e => setFormEstado(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea
                  rows={3}
                  value={formEstado.observaciones}
                  onChange={e => setFormEstado(prev => ({ ...prev, observaciones: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogEstado(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
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
