/**
 * Flota → Programación de mantenimientos (Fase B del flujo QR).
 * El sistema PROPONE el próximo servicio de cada vehículo (odómetro + promedio
 * km/día → fecha proyectada, costo del tarifario) y Operaciones CONFIRMA las
 * citas en lote. Cada cita queda en estado 'programado' con su taller (fijo por
 * flota), fecha, hora y km del plan.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Search, X, RefreshCw, CheckSquare, AlertTriangle, Wrench, CalendarPlus } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { PageNav } from '../../shared/PageNav';
import { SearchableSelect } from '../../shared/SearchableSelect';
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
import { dbProgramacionFlota } from '../../../lib/supabase/helpers';
import { useFlotas, fmtMoneda } from '../../../lib/flota/flotas-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { usePagination } from '../../../lib/shared/usePagination';

interface Props { onNavigate: (route: string) => void; }

interface ProximoServicio {
  vehiculoId: string;
  flotaId: string;
  tallerId: string | null;
  contratoId: string | null;
  codigo: string;
  placa: string | null;
  vin: string | null;
  padron: string | null;
  odometro: number;
  kmDia: number | null;
  proximoKm: number | null;
  kmFaltante: number | null;
  costo: number | null;
  moneda: string;
  fechaProyectada: string | null;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const enDias = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };

export function FlotaProgramacion({ onNavigate: _onNavigate }: Props) {
  const { tenantId, user } = useAuth();
  const { flotas } = useFlotas();
  const { vehiculos } = useVehiculos();

  const [filas, setFilas] = useState<ProximoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFlota, setFiltroFlota] = useState('todas');
  const [ventana, setVentana] = useState('30'); // días; 'vencidos' | 'todos'
  const [sel, setSel] = useState<Set<string>>(new Set());
  // Fechas de proyección editadas por el usuario (override por vehículo)
  const [fechasEditadas, setFechasEditadas] = useState<Map<string, string>>(new Map());

  // Diálogo de generación en lote
  const [dialogOpen, setDialogOpen] = useState(false);
  const [horaCita, setHoraCita] = useState('08:00');
  const [usarProyectada, setUsarProyectada] = useState(true);
  const [fechaFija, setFechaFija] = useState(enDias(7));
  const [generando, setGenerando] = useState(false);

  // Diálogo de programación MANUAL (un vehículo, sin depender de la proyección)
  const [manualOpen, setManualOpen] = useState(false);
  const [manVehiculoId, setManVehiculoId] = useState<string | null>(null); // _dbId
  const [manTarifaId, setManTarifaId] = useState<string | null>(null);
  const [manFecha, setManFecha] = useState(enDias(7));
  const [manHora, setManHora] = useState('08:00');
  const [manGenerando, setManGenerando] = useState(false);

  // Fecha efectiva de una fila: la editada por el usuario o la proyectada
  const fechaDe = useCallback(
    (r: ProximoServicio) => fechasEditadas.get(r.vehiculoId) ?? r.fechaProyectada,
    [fechasEditadas],
  );
  const setFechaFila = (vehiculoId: string, fecha: string) =>
    setFechasEditadas(m => { const n = new Map(m); fecha ? n.set(vehiculoId, fecha) : n.delete(vehiculoId); return n; });

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await dbProgramacionFlota.proximos();
    if (error) {
      console.error('[PROGRAMACION] Error al cargar:', error.message);
      toast.error('No se pudo cargar la proyección de mantenimientos');
    } else {
      setFilas((data ?? []).filter((r: any) => r.proximo_km != null).map((r: any): ProximoServicio => ({
        vehiculoId: r.vehiculo_id, flotaId: r.flota_id, tallerId: r.taller_id, contratoId: r.contrato_id,
        codigo: r.codigo, placa: r.placa, vin: r.vin, padron: r.numero_padron,
        odometro: Number(r.odometro ?? 0), kmDia: r.promedio_km_dia != null ? Number(r.promedio_km_dia) : null,
        proximoKm: r.proximo_km, kmFaltante: r.km_faltante,
        costo: r.proximo_costo != null ? Number(r.proximo_costo) : null,
        moneda: r.moneda ?? 'PEN', fechaProyectada: r.fecha_proyectada,
      })));
    }
    setLoading(false);
    setSel(new Set());
    setFechasEditadas(new Map());
  }, []);

  useEffect(() => { if (tenantId) cargar(); }, [tenantId, cargar]);

  const nombreFlota = (id: string) => flotas.find(f => f.id === id)?.nombre ?? '—';

  const filtradas = useMemo(() => {
    const limite = ventana === 'todos' || ventana === 'vencidos' ? null : enDias(parseInt(ventana, 10));
    return filas.filter(r => {
      if (filtroFlota !== 'todas' && r.flotaId !== filtroFlota) return false;
      if (ventana === 'vencidos') {
        if (!r.fechaProyectada || r.fechaProyectada >= hoy()) return false;
      } else if (limite) {
        // dentro de la ventana: fecha proyectada <= límite (incluye vencidos), o sin fecha
        if (r.fechaProyectada && r.fechaProyectada > limite) return false;
      }
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (![r.placa, r.vin, r.padron, r.codigo].some(x => x && String(x).toLowerCase().includes(q))) return false;
      }
      return true;
    }).sort((a, b) => (a.fechaProyectada ?? '9999').localeCompare(b.fechaProyectada ?? '9999'));
  }, [filas, filtroFlota, ventana, busqueda]);

  const { paged, page, totalPages, setPage } = usePagination(filtradas, 15);

  const seleccionables = filtradas.filter(r => r.tallerId && r.contratoId && r.proximoKm);
  const todosSel = seleccionables.length > 0 && seleccionables.every(r => sel.has(r.vehiculoId));

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => setSel(todosSel ? new Set() : new Set(seleccionables.map(r => r.vehiculoId)));

  const vencidos = filas.filter(r => r.fechaProyectada && r.fechaProyectada < hoy()).length;
  const sinFecha = filas.filter(r => !r.fechaProyectada).length;

  const generar = async () => {
    const elegidos = filas.filter(r => sel.has(r.vehiculoId) && r.tallerId && r.contratoId && r.proximoKm);
    if (elegidos.length === 0) { toast.error('Selecciona al menos un vehículo'); return; }
    setGenerando(true);
    const citas = elegidos.map(r => ({
      tenant_id: tenantId,
      vehiculo_id: r.vehiculoId,
      contrato_id: r.contratoId,
      taller_id: r.tallerId,
      km_servicio: r.proximoKm,
      fecha_programada: usarProyectada ? (fechaDe(r) ?? fechaFija) : fechaFija,
      hora_cita: horaCita,
      costo: r.costo,
      moneda: r.moneda,
      estado: 'programado',
      origen: 'programacion',
      creado_por: user?.id ?? null,
    }));
    const { error } = await dbProgramacionFlota.generarCitas(citas);
    setGenerando(false);
    if (error) {
      console.error('[PROGRAMACION] Error al generar citas:', error.message);
      toast.error('No se pudieron generar las citas');
      return;
    }
    toast.success(`${citas.length} cita(s) de mantenimiento programada(s)`);
    setDialogOpen(false);
    cargar();
  };

  // ── Programación manual (un vehículo) ─────────────────────────────────────
  const vehiculosConFlota = useMemo(
    () => vehiculos.filter(v => v.flotaId && v.estado !== 'inactivo'),
    [vehiculos],
  );
  const manVehiculo = vehiculos.find(v => v._dbId === manVehiculoId);
  const manFlota = flotas.find(f => f.id === manVehiculo?.flotaId);
  const manContrato = manFlota
    ? (manFlota.contratos.find(c => c.estado === 'activo') ?? manFlota.contratos[0])
    : undefined;
  const manTarifas = manContrato?.tarifas ?? [];
  const manTarifa = manTarifas.find(t => t.id === manTarifaId);

  const abrirManual = () => {
    setManVehiculoId(null);
    setManTarifaId(null);
    setManFecha(enDias(7));
    setManHora('08:00');
    setManualOpen(true);
  };

  const generarManual = async () => {
    if (!manVehiculo) { toast.error('Selecciona un vehículo'); return; }
    if (!manFlota?.tallerId) { toast.error('La flota del vehículo no tiene taller asignado'); return; }
    if (!manContrato) { toast.error('La flota del vehículo no tiene contrato configurado'); return; }
    if (!manTarifa) { toast.error('Selecciona el servicio del plan (tarifa)'); return; }
    if (!manFecha) { toast.error('Indica la fecha de la cita'); return; }

    setManGenerando(true);
    const { error } = await dbProgramacionFlota.generarCitas([{
      tenant_id: tenantId,
      vehiculo_id: manVehiculo._dbId,
      contrato_id: manContrato.id,
      taller_id: manFlota.tallerId,
      km_servicio: manTarifa.kmServicio,
      fecha_programada: manFecha,
      hora_cita: manHora,
      costo: manTarifa.costo,
      moneda: manContrato.moneda,
      estado: 'programado',
      origen: 'manual',
      creado_por: user?.id ?? null,
    }]);
    setManGenerando(false);
    if (error) {
      console.error('[PROGRAMACION] Error al programar manual:', error.message);
      toast.error('No se pudo programar la cita');
      return;
    }
    toast.success(`Cita programada para ${manVehiculo.placa || manVehiculo.vin || manVehiculo.id}`);
    setManualOpen(false);
    cargar();
  };

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <CalendarClock className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Programación de mantenimientos</h2>
            <p className="text-muted-foreground mt-1">
              El sistema proyecta el próximo servicio; Operaciones confirma las citas en lote
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className="size-4" /> Actualizar
          </Button>
          <Button variant="outline" onClick={abrirManual}>
            <CalendarPlus className="size-4" /> Programación manual
          </Button>
          <Button onClick={() => setDialogOpen(true)} disabled={sel.size === 0}>
            <CheckSquare className="size-4" /> Programar {sel.size > 0 ? `(${sel.size})` : ''}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Vehículos con próximo servicio</p>
          <p className="text-2xl font-bold">{filas.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3 text-red-600" /> Vencidos (fecha ya pasó)
          </p>
          <p className="text-2xl font-bold text-red-600">{vencidos}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Sin proyección (falta historial de km)</p>
          <p className="text-2xl font-bold">{sinFecha}</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por placa, VIN, padrón…" value={busqueda}
                onChange={e => setBusqueda(e.target.value)} className="pl-10" />
            </div>
            <Select value={filtroFlota} onValueChange={setFiltroFlota}>
              <SelectTrigger><SelectValue placeholder="Flota" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las flotas</SelectItem>
                {flotas.map(f => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ventana} onValueChange={setVentana}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Próximos 7 días</SelectItem>
                <SelectItem value="15">Próximos 15 días</SelectItem>
                <SelectItem value="30">Próximos 30 días</SelectItem>
                <SelectItem value="vencidos">Solo vencidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando <strong>{filtradas.length}</strong> · seleccionables <strong>{seleccionables.length}</strong>
            </p>
            {(busqueda || filtroFlota !== 'todas' || ventana !== '30') && (
              <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroFlota('todas'); setVentana('30'); }}>
                <X className="size-4" /> Limpiar
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
                <TableHead className="w-10">
                  <Checkbox checked={todosSel} onCheckedChange={toggleTodos} aria-label="Seleccionar todos" />
                </TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Flota</TableHead>
                <TableHead className="text-right">Odómetro</TableHead>
                <TableHead className="text-right">Km/día</TableHead>
                <TableHead className="text-right">Próx. servicio</TableHead>
                <TableHead className="text-right">Faltan</TableHead>
                <TableHead>Fecha proyectada</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando proyección…</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin vehículos en esta ventana</TableCell></TableRow>
              ) : paged.map(r => {
                const fEff = fechaDe(r);
                const vencido = fEff && fEff < hoy();
                const puede = !!(r.tallerId && r.contratoId && r.proximoKm);
                return (
                  <TableRow key={r.vehiculoId} className={sel.has(r.vehiculoId) ? 'bg-accent/40' : ''}>
                    <TableCell>
                      <Checkbox checked={sel.has(r.vehiculoId)} disabled={!puede}
                        onCheckedChange={() => toggle(r.vehiculoId)} aria-label={`Seleccionar ${r.placa}`} />
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{r.placa || r.vin || '—'}</p>
                      <p className="text-xs text-muted-foreground">{[r.padron && `Padrón ${r.padron}`, r.codigo].filter(Boolean).join(' · ')}</p>
                    </TableCell>
                    <TableCell className="text-sm">{nombreFlota(r.flotaId)}</TableCell>
                    <TableCell className="text-right">{r.odometro.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.kmDia != null ? r.kmDia.toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{r.proximoKm?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.kmFaltante?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          value={fechaDe(r) ?? ''}
                          onChange={e => setFechaFila(r.vehiculoId, e.target.value)}
                          className={`h-8 w-[9.5rem] ${vencido ? 'border-red-500 text-red-600' : ''}`}
                          aria-label={`Fecha proyectada de ${r.placa ?? r.codigo}`}
                        />
                        {fechasEditadas.has(r.vehiculoId) && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">editada</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{r.costo != null ? fmtMoneda(r.costo, r.moneda) : '—'}</TableCell>
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

      {/* Diálogo: generar citas en lote */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="size-4" /> Programar {sel.size} mantenimiento(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se crearán las citas en estado <strong>programado</strong>, cada una con el taller
              fijo de su flota y el servicio del plan proyectado. El costo sale del tarifario.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox id="proy" checked={usarProyectada} onCheckedChange={v => setUsarProyectada(!!v)} />
              <Label htmlFor="proy" className="cursor-pointer">Usar la fecha de cada vehículo (proyectada o editada)</Label>
            </div>
            {!usarProyectada && (
              <div>
                <Label className="mb-1.5 block">Fecha única para todas</Label>
                <Input type="date" value={fechaFija} onChange={e => setFechaFija(e.target.value)} />
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">Hora de cita</Label>
              <Input type="time" value={horaCita} onChange={e => setHoraCita(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={generar} disabled={generando}>
              {generando ? 'Programando…' : `Programar ${sel.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: programación MANUAL de un vehículo */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="size-4" /> Programación manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Programa una cita para cualquier vehículo con flota, sin depender de la proyección.
              El taller y el costo salen de la flota y su tarifario.
            </p>

            <div>
              <Label className="mb-1.5 block">Vehículo</Label>
              <SearchableSelect
                value={manVehiculoId}
                onChange={id => { setManVehiculoId(id); setManTarifaId(null); }}
                options={vehiculosConFlota.map(v => ({
                  value: v._dbId!,
                  label: `${v.placa || v.vin || v.id} — ${v.id}`,
                  keywords: `${v.vin ?? ''} ${v.numeroPadron ?? ''} ${nombreFlota(v.flotaId ?? '')}`,
                }))}
                placeholder="Seleccionar vehículo"
                searchPlaceholder="Buscar por placa, VIN, padrón…"
                emptyText="Sin vehículos con flota"
              />
            </div>

            {manVehiculo && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Flota:</span> {manFlota?.nombre ?? '—'}</p>
                {!manFlota?.tallerId && (
                  <p className="text-red-600 text-xs">⚠ La flota no tiene taller asignado</p>
                )}
                {!manContrato && (
                  <p className="text-red-600 text-xs">⚠ La flota no tiene contrato configurado</p>
                )}
              </div>
            )}

            {manContrato && manTarifas.length > 0 && (
              <div>
                <Label className="mb-1.5 block">Servicio del plan</Label>
                <Select value={manTarifaId ?? undefined} onValueChange={setManTarifaId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona el servicio (km)" /></SelectTrigger>
                  <SelectContent>
                    {manTarifas.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.orden}. {t.kmServicio.toLocaleString('es-PE')} km — {fmtMoneda(t.costo, manContrato.moneda)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Fecha</Label>
                <Input type="date" value={manFecha} onChange={e => setManFecha(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Hora</Label>
                <Input type="time" value={manHora} onChange={e => setManHora(e.target.value)} />
              </div>
            </div>

            {manTarifa && (
              <p className="text-sm">
                Costo del servicio: <strong>{fmtMoneda(manTarifa.costo, manContrato!.moneda)}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button
              onClick={generarManual}
              disabled={manGenerando || !manVehiculo || !manFlota?.tallerId || !manContrato || !manTarifa}
            >
              {manGenerando ? 'Programando…' : 'Programar cita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
