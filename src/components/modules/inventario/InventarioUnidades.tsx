/**
 * INVENTARIO › UNIDADES (sprint 5, #11): equipamiento con número de serie.
 *
 * Una fila por unidad (bodycam, tablet, arnés…) con su estado y dónde está.
 * Desde aquí Logística registra series pegadas desde el Excel, instala en un
 * vehículo de Flota, entrega al Estado con acta, devuelve al proveedor con guía
 * y saca el acta en PDF. La lógica vive en `inventario_unidades_alta` y
 * `inventario_unidades_mover` (SQL); el kardex por cantidad no cambia salvo que
 * se marque "también mover el kardex".
 */
import { useEffect, useMemo, useState } from 'react';
import { Cpu, Plus, Search, Printer, ArrowRightLeft, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { BotonExportar } from '../../shared/BotonExportar';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { useInventarioStore } from '../../../lib/inventario/inventario-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { usePagination } from '../../../lib/shared/usePagination';
import { usePersistedState } from '../../../lib/shared/usePersistedState';
import {
  ESTADO_UNIDAD, ESTADOS_UNIDAD, altaUnidades, cargarHistorialUnidad, cargarResumenUnidades, cargarUnidades, fechaCorta, fijarSerie,
  moverUnidades, parsearSeries, type EstadoUnidad, type MovimientoUnidad, type ResumenArticulo, type Unidad,
} from '../../../lib/inventario/unidades';
import { imprimirActaUnidades } from '../../../lib/inventario/unidades-acta';

const hoy = () => new Date().toISOString().slice(0, 10);
const n2 = (v: number | null | undefined) => v === null || v === undefined ? '—' : v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InventarioUnidades({ onNavigate }: { onNavigate?: (r: string) => void }) {
  const { articulos, almacenes } = useInventarioStore();
  const { vehiculos } = useVehiculos();
  const { can } = usePermissions();
  const puedeEditar = can('inventario', 'editar');

  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [resumen, setResumen] = useState<ResumenArticulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = usePersistedState('inventario.unidades.busqueda', '');
  const [fArticulo, setFArticulo] = usePersistedState<string>('inventario.unidades.articulo', 'todos');
  const [fEstado, setFEstado] = usePersistedState<string>('inventario.unidades.estado', 'todos');
  const [fProyecto, setFProyecto] = usePersistedState<string | null>('inventario.unidades.proyecto', null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const recargar = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([cargarUnidades(), cargarResumenUnidades()]);
      setUnidades(u); setResumen(r);
    } catch (e) {
      toast.error(`No se pudieron cargar las unidades: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(false); }
  };
  useEffect(() => { void recargar(); }, []);

  const articulosConUnidades = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of unidades) m.set(u.articulo_id, u.articulo);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [unidades]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return unidades.filter(u =>
      (fArticulo === 'todos' || u.articulo_id === fArticulo) &&
      (fEstado === 'todos' || u.estado === fEstado) &&
      (!fProyecto || u.proyecto_id === fProyecto) &&
      (!q || [u.serie, u.articulo, u.marca, u.modelo, u.vehiculo_placa, u.vehiculo_codigo, u.proyecto_codigo, u.factura, u.documento_salida, u.lote]
        .some(v => (v ?? '').toUpperCase().includes(q))));
  }, [unidades, busqueda, fArticulo, fEstado, fProyecto]);
  const pag = usePagination(filtradas, 20);

  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of unidades) c[u.estado] = (c[u.estado] ?? 0) + 1;
    return c;
  }, [unidades]);

  const seleccionadas = useMemo(() => unidades.filter(u => seleccion.has(u.id)), [unidades, seleccion]);
  const togglear = (id: string) => setSeleccion(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglearPagina = () => {
    const ids = pag.paged.map(u => u.id);
    const todasMarcadas = ids.every(id => seleccion.has(id));
    setSeleccion(s => { const n = new Set(s); for (const id of ids) { if (todasMarcadas) n.delete(id); else n.add(id); } return n; });
  };
  const seleccionarFiltradas = () => setSeleccion(new Set(filtradas.map(u => u.id)));

  // ── Alta masiva ─────────────────────────────────────────────────────────
  const [altaOpen, setAltaOpen] = useState(false);
  const [alta, setAlta] = useState({ articuloId: '', series: '', sinSerie: '', almacenId: '', proyectoId: null as string | null, fecha: hoy(), lote: '', documento: '', valorUsd: '', valorSoles: '', tc: '', notas: '', kardex: true });
  const [guardando, setGuardando] = useState(false);
  const seriesAlta = useMemo(() => parsearSeries(alta.series), [alta.series]);
  useEffect(() => { if (!alta.almacenId && almacenes.length) setAlta(a => ({ ...a, almacenId: almacenes.find(x => x.estado === 'activo')?._dbId ?? '' })); }, [almacenes, alta.almacenId]);

  const guardarAlta = async () => {
    if (!alta.articuloId) { toast.error('Elige el artículo'); return; }
    const sinSerie = Number(alta.sinSerie || 0);
    if (seriesAlta.length === 0 && sinSerie <= 0) { toast.error('Pega al menos una serie o indica cuántas unidades entran sin serie'); return; }
    setGuardando(true);
    try {
      const r = await altaUnidades({
        articuloId: alta.articuloId, series: seriesAlta, sinSerie, almacenId: alta.almacenId || null, proyectoId: alta.proyectoId,
        fecha: alta.fecha, lote: alta.lote || undefined, documento: alta.documento || undefined, notas: alta.notas || undefined,
        valorUsd: alta.valorUsd ? Number(alta.valorUsd) : null, valorSoles: alta.valorSoles ? Number(alta.valorSoles) : null, tc: alta.tc ? Number(alta.tc) : null,
        kardex: alta.kardex,
      });
      toast.success(`${r.creadas} unidades registradas${r.repetidas.length ? ` · ${r.repetidas.length} series ya existían y se saltaron` : ''}`);
      setAltaOpen(false);
      setAlta(a => ({ ...a, series: '', sinSerie: '', lote: '', documento: '', notas: '' }));
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setGuardando(false); }
  };

  // ── Cambio de estado ────────────────────────────────────────────────────
  const [moverOpen, setMoverOpen] = useState(false);
  const [mover, setMover] = useState({ estado: 'instalada' as EstadoUnidad, fecha: hoy(), documento: '', proyectoId: null as string | null, vehiculoId: null as string | null, almacenId: '', notas: '', kardex: false });
  const opcionesVehiculo = useMemo(() => vehiculos
    .filter(v => v._dbId)
    .map(v => ({ value: v._dbId as string, label: `${v.placa || v.id} · ${v.marca} ${v.modelo}`, keywords: `${v.id} ${v.placa} ${v.marca} ${v.modelo}` }))
    .sort((a, b) => a.label.localeCompare(b.label)), [vehiculos]);

  const guardarMover = async () => {
    if (seleccionadas.length === 0) { toast.error('Marca al menos una unidad'); return; }
    if (mover.estado === 'instalada' && !mover.vehiculoId) { toast.error('Elige el vehículo donde se instala'); return; }
    if (mover.estado === 'entregada' && !mover.proyectoId && !mover.vehiculoId && seleccionadas.some(u => !u.proyecto_id)) { toast.error('Indica el proyecto al que se entrega (hay unidades sin proyecto)'); return; }
    if ((mover.estado === 'entregada' || mover.estado === 'devuelta') && !mover.documento.trim()) { toast.error('Indica el acta o la guía'); return; }
    setGuardando(true);
    try {
      const r = await moverUnidades({
        ids: seleccionadas.map(u => u.id), estado: mover.estado, fecha: mover.fecha, documento: mover.documento || undefined,
        proyectoId: mover.proyectoId, vehiculoId: mover.vehiculoId, almacenId: mover.almacenId || null, notas: mover.notas || undefined, kardex: mover.kardex,
      });
      toast.success(`${r.actualizadas} unidades → ${ESTADO_UNIDAD[mover.estado].label}`);
      setMoverOpen(false);
      setSeleccion(new Set());
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setGuardando(false); }
  };

  // ── Serie pendiente ─────────────────────────────────────────────────────
  const [serieEdit, setSerieEdit] = useState<{ unidad: Unidad; serie: string } | null>(null);
  const guardarSerie = async () => {
    if (!serieEdit) return;
    setGuardando(true);
    try {
      await fijarSerie(serieEdit.unidad.id, serieEdit.serie);
      toast.success('Serie registrada');
      setSerieEdit(null);
      await recargar();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  // ── Historial ───────────────────────────────────────────────────────────
  const [historial, setHistorial] = useState<{ unidad: Unidad; movs: MovimientoUnidad[] } | null>(null);
  const verHistorial = async (u: Unidad) => {
    try { setHistorial({ unidad: u, movs: await cargarHistorialUnidad(u.id) }); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const acta = () => {
    const lista = seleccionadas.length ? seleccionadas : filtradas;
    if (lista.length === 0) { toast.error('No hay unidades para el acta'); return; }
    const estados = new Set(lista.map(u => u.estado));
    const tipo = estados.size === 1 && estados.has('entregada') ? 'entrega' : estados.size === 1 && estados.has('devuelta') ? 'devolucion' : 'inventario';
    const proyecto = [...new Set(lista.map(u => u.proyecto_codigo).filter(Boolean))].join(', ');
    const doc = [...new Set(lista.map(u => u.documento_salida).filter(Boolean))];
    const dest = tipo === 'devolucion' ? [...new Set(lista.map(u => u.proveedor).filter(Boolean))].join(', ') : undefined;
    if (!imprimirActaUnidades(lista, { tipo, proyecto: proyecto || undefined, documento: doc.length === 1 ? doc[0]! : undefined, destinatario: dest, fecha: hoy() })) {
      toast.error('El navegador bloqueó la ventana del acta');
    }
  };

  const exportacion = useMemo(() => filtradas.map(u => ({
    articulo: u.articulo, marca: u.marca ?? '', modelo: u.modelo ?? '', serie: u.serie ?? 'SIN SERIE', lote: u.lote ?? '', estado: ESTADO_UNIDAD[u.estado]?.label ?? u.estado,
    almacen: u.almacen ?? '', proyecto: u.proyecto_codigo ?? '', vehiculo: u.vehiculo_placa ?? u.vehiculo_codigo ?? '', proveedor: u.proveedor ?? '', factura: u.factura ?? '',
    valor_usd: u.valor_usd ?? '', valor_soles: u.valor_soles ?? '', fecha_ingreso: u.fecha_ingreso, fecha_salida: u.fecha_salida ?? '', documento_salida: u.documento_salida ?? '', observaciones: u.observaciones ?? '',
  })), [filtradas]);

  const necesitaVehiculo = mover.estado === 'instalada';
  const necesitaProyecto = mover.estado === 'entregada';
  const necesitaDocumento = mover.estado === 'entregada' || mover.estado === 'devuelta';

  return (
    <div className="space-y-4">
      <PageNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="size-6" /> Unidades con número de serie</h1>
          <p className="text-sm text-muted-foreground">Bodycams, tablets, radios, arneses: cada unidad con su serie, su estado y dónde está. El kardex por cantidad sigue en Movimientos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonExportar modulo="inventario" nombre="unidades-serie" datos={exportacion} hoja="Unidades"
            headers={{ articulo: 'Artículo', marca: 'Marca', modelo: 'Modelo', serie: 'N.º serie', lote: 'Lote', estado: 'Estado', almacen: 'Almacén', proyecto: 'Proyecto', vehiculo: 'Vehículo', proveedor: 'Proveedor', factura: 'Factura', valor_usd: 'Valor US$', valor_soles: 'Valor S/', fecha_ingreso: 'Ingreso', fecha_salida: 'Salida', documento_salida: 'Documento', observaciones: 'Observaciones' }} />
          <Button variant="outline" onClick={acta}><Printer className="size-4 mr-1" /> Acta {seleccionadas.length ? `(${seleccionadas.length})` : ''}</Button>
          <PermissionGuard modulo="inventario" accion="editar">
            <Button variant="outline" disabled={seleccionadas.length === 0} onClick={() => { setMover(m => ({ ...m, documento: '', notas: '' })); setMoverOpen(true); }}>
              <ArrowRightLeft className="size-4 mr-1" /> Cambiar estado {seleccionadas.length ? `(${seleccionadas.length})` : ''}
            </Button>
          </PermissionGuard>
          <PermissionGuard modulo="inventario" accion="crear">
            <Button onClick={() => setAltaOpen(true)}><Plus className="size-4 mr-1" /> Registrar unidades</Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Conteo por estado */}
      <div className="flex flex-wrap gap-2">
        {ESTADOS_UNIDAD.map(e => (
          <button key={e} type="button" onClick={() => setFEstado(fEstado === e ? 'todos' : e)}
            className={`rounded-md border px-3 py-1.5 text-sm ${fEstado === e ? 'ring-2 ring-primary' : ''}`}>
            <span className={`inline-block rounded px-1.5 py-0.5 text-xs mr-2 ${ESTADO_UNIDAD[e].clase}`}>{ESTADO_UNIDAD[e].label}</span>
            <b>{conteo[e] ?? 0}</b>
          </button>
        ))}
        <div className="rounded-md border px-3 py-1.5 text-sm">Total <b>{unidades.length}</b></div>
      </div>

      {/* Resumen por artículo contra el kardex */}
      {resumen.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por artículo: series registradas contra el kardex</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">En almacén</TableHead>
                  <TableHead className="text-right">Instaladas</TableHead>
                  <TableHead className="text-right">Entregadas</TableHead>
                  <TableHead className="text-right">Devueltas</TableHead>
                  <TableHead className="text-right">Sin serie</TableHead>
                  <TableHead className="text-right">Stock kardex</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.map(r => (
                  <TableRow key={r.articulo_id} className="cursor-pointer" onClick={() => setFArticulo(fArticulo === r.articulo_id ? 'todos' : r.articulo_id)}>
                    <TableCell className="text-sm">{r.articulo}<div className="text-xs text-muted-foreground">{[r.marca, r.modelo].filter(Boolean).join(' · ')}</div></TableCell>
                    <TableCell className="text-right">{r.unidades}</TableCell>
                    <TableCell className="text-right">{r.en_almacen}</TableCell>
                    <TableCell className="text-right">{r.instaladas}</TableCell>
                    <TableCell className="text-right">{r.entregadas}</TableCell>
                    <TableCell className="text-right">{r.devueltas}</TableCell>
                    <TableCell className="text-right">{r.sin_serie}</TableCell>
                    <TableCell className="text-right">{Number(r.stock_kardex).toLocaleString('es-PE')}</TableCell>
                    <TableCell className={`text-right font-medium ${Number(r.diferencia) !== 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>{Number(r.diferencia) === 0 ? 'cuadra' : Number(r.diferencia).toLocaleString('es-PE')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
              <Input placeholder="Serie, artículo, placa, factura, acta o guía…" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-10" />
            </div>
            <Select value={fArticulo} onValueChange={(v: string) => setFArticulo(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Artículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los artículos</SelectItem>
                {articulosConUnidades.map(([id, nombre]) => <SelectItem key={id} value={id}>{nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fEstado} onValueChange={(v: string) => setFEstado(v)}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_UNIDAD.map(e => <SelectItem key={e} value={e}>{ESTADO_UNIDAD[e].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <ProyectoSelector value={fProyecto} onChange={setFProyecto} nullable className="w-[260px]" />
            {(busqueda || fArticulo !== 'todos' || fEstado !== 'todos' || fProyecto) && (
              <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFArticulo('todos'); setFEstado('todos'); setFProyecto(null); }}>Limpiar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {seleccion.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 text-sm border-b bg-muted/40">
              <span><b>{seleccion.size}</b> marcadas</span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={seleccionarFiltradas}>marcar las {filtradas.length} filtradas</Button>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSeleccion(new Set())}>desmarcar todo</Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"><Checkbox checked={pag.paged.length > 0 && pag.paged.every(u => seleccion.has(u.id))} onCheckedChange={togglearPagina} aria-label="Marcar página" /></TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead>N.º de serie</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Factura / OC</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground"><Loader2 className="inline size-4 animate-spin mr-2" />Cargando unidades…</TableCell></TableRow>}
              {!loading && pag.paged.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{unidades.length === 0 ? 'Todavía no hay unidades registradas. Usa "Registrar unidades" y pega las series.' : 'Ninguna unidad coincide con los filtros.'}</TableCell></TableRow>}
              {pag.paged.map(u => (
                <TableRow key={u.id} data-state={seleccion.has(u.id) ? 'selected' : undefined}>
                  <TableCell><Checkbox checked={seleccion.has(u.id)} onCheckedChange={() => togglear(u.id)} aria-label={`Marcar ${u.serie ?? u.id}`} /></TableCell>
                  <TableCell className="text-sm">{u.articulo}<div className="text-xs text-muted-foreground">{[u.marca, u.modelo].filter(Boolean).join(' · ')}{u.lote ? ` · lote ${u.lote}` : ''}</div></TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {u.serie ?? <span className="text-muted-foreground italic">sin serie</span>}
                    {puedeEditar && u.estado !== 'baja' && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1 align-middle" title={u.serie ? 'Corregir serie' : 'Registrar serie'} onClick={() => setSerieEdit({ unidad: u, serie: u.serie ?? '' })}><Pencil className="size-3" /></Button>
                    )}
                  </TableCell>
                  <TableCell><Badge className={`text-xs ${ESTADO_UNIDAD[u.estado]?.clase ?? ''}`}>{ESTADO_UNIDAD[u.estado]?.label ?? u.estado}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {u.vehiculo_placa || u.vehiculo_codigo ? <div>{u.vehiculo_placa ?? u.vehiculo_codigo}</div> : null}
                    {u.proyecto_codigo ? <div className="text-xs text-muted-foreground">{u.proyecto_codigo}</div> : null}
                    {u.estado === 'devuelta' ? <div className="text-xs text-muted-foreground">{u.proveedor}</div> : null}
                    {u.estado === 'en_almacen' ? <div className="text-xs text-muted-foreground">{u.almacen ?? '—'}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{u.factura ?? '—'}{u.orden_compra ? <div className="text-xs text-muted-foreground">{u.orden_compra}</div> : null}</TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">{u.valor_usd !== null ? `US$ ${n2(u.valor_usd)}` : u.valor_soles !== null ? `S/ ${n2(u.valor_soles)}` : '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{fechaCorta(u.fecha_ingreso)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{u.fecha_salida ? fechaCorta(u.fecha_salida) : '—'}{u.documento_salida ? <div className="text-xs text-muted-foreground">{u.documento_salida}</div> : null}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => verHistorial(u)}>Historial</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pag.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground">Mostrando {pag.paged.length} de {pag.totalItems} · página {pag.page} de {pag.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alta masiva */}
      <Dialog open={altaOpen} onOpenChange={(o: boolean) => !guardando && setAltaOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar unidades con serie</DialogTitle>
            <DialogDescription>Pega las series tal como vienen del Excel o de la guía (una por línea). Las que no tengan serie entran como "pendiente de serie" y se completan después.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Artículo</Label>
              <SearchableSelect value={alta.articuloId || null} onChange={(v: string | null) => setAlta(a => ({ ...a, articuloId: v ?? '' }))}
                options={articulos.filter(a => a.activo).map(a => ({ value: a._dbId, label: `${a.nombre}${a.marca ? ` · ${a.marca}` : ''}${a.modelo ? ` ${a.modelo}` : ''}`, keywords: `${a.id} ${a.marca ?? ''} ${a.modelo ?? ''}` }))}
                placeholder="Elige el artículo (créalo antes en Productos si no existe)" />
            </div>
            <div className="md:col-span-2">
              <Label>Series ({seriesAlta.length})</Label>
              <Textarea rows={6} value={alta.series} onChange={e => setAlta(a => ({ ...a, series: e.target.value }))} placeholder={'AZ9627549\nAZ9627550\nAZ9627551'} className="font-mono text-sm" />
            </div>
            <div><Label>Unidades sin serie</Label><Input type="number" min={0} value={alta.sinSerie} onChange={e => setAlta(a => ({ ...a, sinSerie: e.target.value }))} placeholder="0" /></div>
            <div>
              <Label>Almacén</Label>
              <Select value={alta.almacenId} onValueChange={(v: string) => setAlta(a => ({ ...a, almacenId: v }))}>
                <SelectTrigger><SelectValue placeholder="Almacén" /></SelectTrigger>
                <SelectContent>{almacenes.filter(x => x.estado === 'activo').map(x => <SelectItem key={x._dbId} value={x._dbId}>{x.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Proyecto (si entra ya asignado)</Label><ProyectoSelector value={alta.proyectoId} onChange={(v: string | null) => setAlta(a => ({ ...a, proyectoId: v }))} nullable /></div>
            <div><Label>Fecha de ingreso</Label><Input type="date" value={alta.fecha} onChange={e => setAlta(a => ({ ...a, fecha: e.target.value }))} /></div>
            <div><Label>Documento (guía / factura)</Label><Input value={alta.documento} onChange={e => setAlta(a => ({ ...a, documento: e.target.value }))} placeholder="F002-5489 · EG07-123" /></div>
            <div><Label>Lote</Label><Input value={alta.lote} onChange={e => setAlta(a => ({ ...a, lote: e.target.value }))} /></div>
            <div><Label>Valor unitario US$</Label><Input type="number" step="0.001" value={alta.valorUsd} onChange={e => setAlta(a => ({ ...a, valorUsd: e.target.value }))} /></div>
            <div><Label>Valor unitario S/</Label><Input type="number" step="0.01" value={alta.valorSoles} onChange={e => setAlta(a => ({ ...a, valorSoles: e.target.value }))} /></div>
            <div><Label>Tipo de cambio</Label><Input type="number" step="0.0001" value={alta.tc} onChange={e => setAlta(a => ({ ...a, tc: e.target.value }))} placeholder="del día si queda vacío" /></div>
            <div className="md:col-span-2"><Label>Notas</Label><Input value={alta.notas} onChange={e => setAlta(a => ({ ...a, notas: e.target.value }))} /></div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <Checkbox checked={alta.kardex} onCheckedChange={(v: boolean | 'indeterminate') => setAlta(a => ({ ...a, kardex: v === true }))} />
              También registrar la entrada en el kardex por cantidad (desmarcar si la recepción de la OC ya la registró)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAltaOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardarAlta} disabled={guardando}>{guardando ? <Loader2 className="size-4 animate-spin mr-1" /> : null}Registrar {seriesAlta.length + Number(alta.sinSerie || 0) || ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambio de estado */}
      <Dialog open={moverOpen} onOpenChange={(o: boolean) => !guardando && setMoverOpen(o)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cambiar estado de {seleccionadas.length} unidad{seleccionadas.length === 1 ? '' : 'es'}</DialogTitle>
            <DialogDescription>Instalar en un vehículo, entregar al Estado con acta, devolver al proveedor con guía, mandar a reparación, dar de baja o devolver al almacén.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nuevo estado</Label>
              <Select value={mover.estado} onValueChange={(v: string) => setMover(m => ({ ...m, estado: v as EstadoUnidad }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS_UNIDAD.map(e => <SelectItem key={e} value={e}>{ESTADO_UNIDAD[e].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fecha</Label><Input type="date" value={mover.fecha} onChange={e => setMover(m => ({ ...m, fecha: e.target.value }))} /></div>
            {(necesitaVehiculo || mover.estado === 'entregada') && (
              <div className="md:col-span-2">
                <Label>Vehículo {necesitaVehiculo ? '' : '(opcional)'}</Label>
                <SearchableSelect value={mover.vehiculoId} onChange={(v: string | null) => setMover(m => ({ ...m, vehiculoId: v }))} options={opcionesVehiculo} placeholder="Busca por placa o código" nullable nullLabel="Sin vehículo" />
              </div>
            )}
            {(necesitaProyecto || mover.estado === 'instalada') && (
              <div className="md:col-span-2"><Label>Proyecto {mover.estado === 'instalada' ? '(si no, el del vehículo)' : ''}</Label><ProyectoSelector value={mover.proyectoId} onChange={(v: string | null) => setMover(m => ({ ...m, proyectoId: v }))} nullable /></div>
            )}
            {mover.estado === 'en_almacen' && (
              <div className="md:col-span-2">
                <Label>Almacén de retorno</Label>
                <Select value={mover.almacenId || 'mismo'} onValueChange={(v: string) => setMover(m => ({ ...m, almacenId: v === 'mismo' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="mismo">El mismo de la unidad</SelectItem>{almacenes.filter(x => x.estado === 'activo').map(x => <SelectItem key={x._dbId} value={x._dbId}>{x.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2"><Label>{mover.estado === 'entregada' ? 'Acta de entrega' : mover.estado === 'devuelta' ? 'Guía de remisión' : 'Documento'}{necesitaDocumento ? ' *' : ''}</Label><Input value={mover.documento} onChange={e => setMover(m => ({ ...m, documento: e.target.value }))} placeholder={mover.estado === 'devuelta' ? 'EG07-00000067' : 'ACTA N° 012-2026'} /></div>
            <div className="md:col-span-2"><Label>Notas</Label><Input value={mover.notas} onChange={e => setMover(m => ({ ...m, notas: e.target.value }))} /></div>
            {(mover.estado === 'devuelta' || mover.estado === 'baja') && (
              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                <Checkbox checked={mover.kardex} onCheckedChange={(v: boolean | 'indeterminate') => setMover(m => ({ ...m, kardex: v === true }))} />
                También dar salida en el kardex por cantidad (una línea por artículo)
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoverOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardarMover} disabled={guardando}>{guardando ? <Loader2 className="size-4 animate-spin mr-1" /> : null}Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Serie */}
      <Dialog open={!!serieEdit} onOpenChange={(o: boolean) => !o && !guardando && setSerieEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{serieEdit?.unidad.serie ? 'Corregir serie' : 'Registrar serie'}</DialogTitle><DialogDescription>{serieEdit?.unidad.articulo}</DialogDescription></DialogHeader>
          <Input autoFocus className="font-mono" value={serieEdit?.serie ?? ''} onChange={e => setSerieEdit(s => s ? { ...s, serie: e.target.value } : s)} onKeyDown={e => { if (e.key === 'Enter') void guardarSerie(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSerieEdit(null)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardarSerie} disabled={guardando || !serieEdit?.serie.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historial */}
      <Dialog open={!!historial} onOpenChange={(o: boolean) => !o && setHistorial(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial · {historial?.unidad.articulo} · {historial?.unidad.serie ?? 'sin serie'}</DialogTitle>
            <DialogDescription>Dónde estuvo y cuándo. {historial?.unidad.observaciones ?? ''}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Movimiento</TableHead><TableHead>De</TableHead><TableHead>A</TableHead><TableHead>Documento</TableHead></TableRow></TableHeader>
            <TableBody>
              {(historial?.movs ?? []).map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm whitespace-nowrap">{fechaCorta(m.fecha)}</TableCell>
                  <TableCell className="text-sm">{m.tipo}{m.notas ? <div className="text-xs text-muted-foreground">{m.notas}</div> : null}</TableCell>
                  <TableCell className="text-sm">{m.de ?? '—'}</TableCell>
                  <TableCell className="text-sm">{m.a ?? '—'}</TableCell>
                  <TableCell className="text-sm">{m.documento ?? '—'}</TableCell>
                </TableRow>
              ))}
              {historial && historial.movs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sin movimientos</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
