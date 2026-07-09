/**
 * Flota → Mantenimientos (rediseño 2026-07)
 * Historial de servicios (vehiculo_mantenimientos) con filtros y registro manual.
 * La carga masiva desde Excel llega en el siguiente incremento.
 */
import { useEffect, useMemo, useState } from 'react';
import { Wrench, Search, Plus, X } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PageNav } from '../../shared/PageNav';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../../../auth/AuthProvider';
import { dbVehiculoMantenimientos } from '../../../lib/supabase/helpers';
import { useFlotas, fmtMoneda } from '../../../lib/flota/flotas-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { usePagination } from '../../../lib/shared/usePagination';

interface Props { onNavigate: (route: string) => void; }

interface ServicioRow {
  id: string;
  vehiculoId: string;
  codigoVehiculo: string | null;
  placa: string | null;
  placaInterna: string | null;
  vin: string | null;
  padron: string | null;
  flotaId: string | null;
  kmServicio: number | null;
  kmOdometro: number | null;
  fechaProgramada: string | null;
  fechaEjecucion: string | null;
  estado: string;
  taller: string | null;
  costo: number | null;
  moneda: string;
  ocNumero: string | null;
  factura: string | null;
  observaciones: string | null;
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ejecutado: { label: 'Ejecutado', variant: 'default' },
  programado: { label: 'Programado', variant: 'outline' },
  no_ejecutado: { label: 'No ejecutado', variant: 'destructive' },
  reprogramado: { label: 'Reprogramado', variant: 'secondary' },
};

export function FlotaMantenimientos({ onNavigate: _onNavigate }: Props) {
  const { tenantId, user } = useAuth();
  const { flotas, refetch: refetchConsumo } = useFlotas();
  const { vehiculos } = useVehiculos();

  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFlota, setFiltroFlota] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Registro manual
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    vehiculoDbId: '', kmServicio: '', kmOdometro: '', fechaEjecucion: '',
    costo: '', moneda: 'PEN', taller: '', ocNumero: '', factura: '', observaciones: '',
  });

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await dbVehiculoMantenimientos.listAll();
    if (error) {
      console.error('[FLOTA-MANTOS] Error al cargar:', error.message);
      toast.error('No se pudieron cargar los mantenimientos');
    } else if (data) {
      setServicios(data.map((r: any): ServicioRow => ({
        id: r.id,
        vehiculoId: r.vehiculo_id,
        codigoVehiculo: r.vehiculos?.codigo ?? null,
        placa: r.vehiculos?.placa ?? null,
        placaInterna: r.vehiculos?.placa_interna ?? null,
        vin: r.vehiculos?.vin ?? null,
        padron: r.vehiculos?.numero_padron ?? null,
        flotaId: r.vehiculos?.flota_id ?? null,
        kmServicio: r.km_servicio,
        kmOdometro: r.km_odometro != null ? Number(r.km_odometro) : null,
        fechaProgramada: r.fecha_programada,
        fechaEjecucion: r.fecha_ejecucion,
        estado: r.estado ?? 'ejecutado',
        taller: r.taller,
        costo: r.costo != null ? Number(r.costo) : null,
        moneda: r.moneda ?? 'PEN',
        ocNumero: r.oc_numero,
        factura: r.factura,
        observaciones: r.observaciones,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { if (tenantId) cargar(); }, [tenantId]);

  const filtrados = useMemo(() => servicios.filter(s => {
    if (filtroFlota !== 'todas' && s.flotaId !== filtroFlota) return false;
    if (filtroEstado !== 'todos' && s.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (![s.placa, s.placaInterna, s.vin, s.padron, s.codigoVehiculo, s.ocNumero, s.factura, s.taller]
        .some(x => x && String(x).toLowerCase().includes(q))) return false;
    }
    return true;
  }), [servicios, filtroFlota, filtroEstado, busqueda]);

  const { paged, page, totalPages, setPage } = usePagination(filtrados);

  const totalEjecutados = servicios.filter(s => s.estado === 'ejecutado').length;
  const hayFiltros = busqueda !== '' || filtroFlota !== 'todas' || filtroEstado !== 'todos';

  const opcionesVehiculo = useMemo(() => vehiculos
    .filter(v => v.estado === 'activo' && v._dbId)
    .map(v => ({
      value: v._dbId as string,
      label: [v.numeroPadron, v.placa || v.vin, v.marca].filter(Boolean).join(' · '),
    })), [vehiculos]);

  const registrar = async () => {
    if (!form.vehiculoDbId || !form.fechaEjecucion || !form.kmServicio) {
      toast.error('Vehículo, fecha y km del servicio son obligatorios');
      return;
    }
    setGuardando(true);
    const veh = vehiculos.find(v => v._dbId === form.vehiculoDbId);
    const flotaVeh = flotas.find(f => f.id === veh?.flotaId);
    const contrato = flotaVeh?.contratos.find(c => c.estado === 'activo') ?? flotaVeh?.contratos[0];
    const { error } = await dbVehiculoMantenimientos.create({
      tenant_id: tenantId,
      vehiculo_id: form.vehiculoDbId,
      contrato_id: contrato?.id ?? null,
      km_servicio: Number(form.kmServicio),
      km_odometro: form.kmOdometro ? Number(form.kmOdometro) : null,
      fecha_ejecucion: form.fechaEjecucion,
      estado: 'ejecutado',
      taller: form.taller || null,
      costo: form.costo ? Number(form.costo) : null,
      moneda: form.moneda,
      oc_numero: form.ocNumero || null,
      factura: form.factura || null,
      observaciones: form.observaciones || null,
      origen: 'manual',
      creado_por: user?.id ?? null,
    });
    setGuardando(false);
    if (error) {
      console.error('[FLOTA-MANTOS] Error al registrar:', error.message);
      toast.error('No se pudo registrar el mantenimiento');
      return;
    }
    toast.success('Mantenimiento registrado');
    setDialogOpen(false);
    setForm({ vehiculoDbId: '', kmServicio: '', kmOdometro: '', fechaEjecucion: '', costo: '', moneda: 'PEN', taller: '', ocNumero: '', factura: '', observaciones: '' });
    cargar();
    refetchConsumo();
  };

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Wrench className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Mantenimientos</h2>
            <p className="text-muted-foreground mt-1">
              {totalEjecutados.toLocaleString()} servicios ejecutados · {servicios.length.toLocaleString()} registros
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Registrar mantenimiento
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa, VIN, padrón, OC, factura o taller…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroFlota} onValueChange={setFiltroFlota}>
              <SelectTrigger><SelectValue placeholder="Flota" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las flotas</SelectItem>
                {flotas.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="ejecutado">Ejecutado</SelectItem>
                <SelectItem value="programado">Programado</SelectItem>
                <SelectItem value="no_ejecutado">No ejecutado</SelectItem>
                <SelectItem value="reprogramado">Reprogramado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando <strong>{filtrados.length.toLocaleString()}</strong> de <strong>{servicios.length.toLocaleString()}</strong> servicios
            </p>
            {hayFiltros && (
              <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroFlota('todas'); setFiltroEstado('todos'); }}>
                <X className="size-4" /> Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead className="text-right">Servicio (km)</TableHead>
                <TableHead className="text-right">Odómetro</TableHead>
                <TableHead>Fecha ejecución</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Taller</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>OC / Factura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando mantenimientos…</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {hayFiltros ? 'Sin resultados con los filtros aplicados' : 'No hay mantenimientos registrados'}
                </TableCell></TableRow>
              ) : paged.map(s => {
                const badge = ESTADO_BADGE[s.estado] ?? { label: s.estado, variant: 'outline' as const };
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-semibold">{s.placa || s.vin || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {[s.padron && `Padrón ${s.padron}`, s.placaInterna].filter(Boolean).join(' · ') || s.codigoVehiculo}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">{s.kmServicio?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-right">{s.kmOdometro?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell>{s.fechaEjecucion ?? s.fechaProgramada ?? '—'}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-sm max-w-40 truncate" title={s.taller ?? ''}>{s.taller ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {s.costo != null ? fmtMoneda(s.costo, s.moneda) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.ocNumero && <p className="font-mono">{s.ocNumero}</p>}
                      {s.factura && <p className="text-muted-foreground">{s.factura}</p>}
                      {!s.ocNumero && !s.factura && '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3 border-t">
              <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registro manual */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar mantenimiento</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="mb-1.5 block">Vehículo *</Label>
              <SearchableSelect
                options={opcionesVehiculo}
                value={form.vehiculoDbId || null}
                onChange={v => setForm(f => ({ ...f, vehiculoDbId: v ?? '' }))}
                placeholder="Buscar vehículo…"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Servicio (km del plan) *</Label>
              <Input type="number" value={form.kmServicio} onChange={e => setForm(f => ({ ...f, kmServicio: e.target.value }))} placeholder="5000" />
            </div>
            <div>
              <Label className="mb-1.5 block">Odómetro real (km)</Label>
              <Input type="number" value={form.kmOdometro} onChange={e => setForm(f => ({ ...f, kmOdometro: e.target.value }))} placeholder="5120" />
            </div>
            <div>
              <Label className="mb-1.5 block">Fecha de ejecución *</Label>
              <Input type="date" value={form.fechaEjecucion} onChange={e => setForm(f => ({ ...f, fechaEjecucion: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="mb-1.5 block">Costo</Label>
                <Input type="number" step="0.01" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label className="mb-1.5 block">Moneda</Label>
                <Select value={form.moneda} onValueChange={v => setForm(f => ({ ...f, moneda: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">S/</SelectItem>
                    <SelectItem value="USD">US$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Taller / concesionaria</Label>
              <Input value={form.taller} onChange={e => setForm(f => ({ ...f, taller: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">N° OC</Label>
              <Input value={form.ocNumero} onChange={e => setForm(f => ({ ...f, ocNumero: e.target.value }))} placeholder="MM-000123" />
            </div>
            <div>
              <Label className="mb-1.5 block">Factura</Label>
              <Input value={form.factura} onChange={e => setForm(f => ({ ...f, factura: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Observaciones</Label>
              <Input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={registrar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
