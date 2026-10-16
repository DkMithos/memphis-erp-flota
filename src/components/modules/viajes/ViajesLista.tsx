/**
 * Administración › Viajes: todos los viajes (viajes.ver) con los pendientes de
 * aprobar arriba, filtros persistidos, paginación y solicitud nueva.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plane, Plus, Search, Loader2, Smartphone, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { BotonExportar } from '../../shared/BotonExportar';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { usePagination } from '../../../lib/shared/usePagination';
import { usePersistedState } from '../../../lib/shared/usePersistedState';
import { NuevoViajeForm } from './NuevoViajeForm';
import { ESTADO_VIAJE, cargarRendiciones, cargarViajes, pendientesDe, rangoFechas, soles, type EstadoViaje, type Rendicion, type Viaje } from '../../../lib/viajes/viajes';

const ESTADOS = Object.keys(ESTADO_VIAJE) as EstadoViaje[];

export function ViajesLista({ onNavigate }: { onNavigate?: (r: string) => void }) {
  const { can } = usePermissions();
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = usePersistedState('viajes.busqueda', '');
  const [fEstado, setFEstado] = usePersistedState<string>('viajes.estado', 'abiertos');
  const [fProyecto, setFProyecto] = usePersistedState<string | null>('viajes.proyecto', null);
  const [nuevo, setNuevo] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try { const [v, r] = await Promise.all([cargarViajes(), cargarRendiciones()]); setViajes(v); setRendiciones(r); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void cargar(); }, []);

  const pend = useMemo(() => pendientesDe(viajes, rendiciones, can('viajes', 'aprobar'), can('viajes', 'aprobar_final')), [viajes, rendiciones, can]);
  const porLiquidar = useMemo(() => rendiciones.filter(r => r.estado === 'aprobada'), [rendiciones]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return viajes.filter(v =>
      (fEstado === 'todos' || (fEstado === 'abiertos' ? !['cerrado', 'anulado', 'rechazado'].includes(v.estado) : v.estado === fEstado)) &&
      (!fProyecto || v.proyecto_id === fProyecto) &&
      (!q || [v.numero, v.destino, v.motivo, v.viajeros_nombres, v.proyecto_codigo, v.solicitante].some(x => (x ?? '').toUpperCase().includes(q))));
  }, [viajes, busqueda, fEstado, fProyecto]);
  const pag = usePagination(filtrados, 20);

  const exportacion = useMemo(() => filtrados.map(v => ({
    numero: v.numero, estado: ESTADO_VIAJE[v.estado].corto, proyecto: v.proyecto_codigo ?? '', origen: v.origen, destino: v.destino, salida: v.fecha_salida, retorno: v.fecha_retorno ?? '',
    viajeros: v.viajeros_nombres ?? '', motivo: v.motivo, viaticos_solicitados: v.presupuesto_viaticos, adelantos: v.adelantos, pasajes_soles: v.reservas_soles, rendido: v.rendido, saldo_rendiciones: v.saldo_rendiciones,
    solicitante: v.solicitante ?? '', excede_tarifa: v.tope_excedido ? 'SI' : '',
  })), [filtrados]);

  const ir = (id: string) => onNavigate?.(`/viajes/${id}`);

  return (
    <div className="space-y-4">
      <PageNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plane className="size-6" /> Viajes y viáticos</h1>
          <p className="text-sm text-muted-foreground">Solicitud → jefatura → Administración. Rendición → jefatura → Administración. El personal usa la app móvil (/app).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonExportar modulo="viajes" nombre="viajes" datos={exportacion} hoja="Viajes" headers={{ numero: 'N.º', estado: 'Estado', proyecto: 'Proyecto', origen: 'Origen', destino: 'Destino', salida: 'Salida', retorno: 'Retorno', viajeros: 'Viajeros', motivo: 'Motivo', viaticos_solicitados: 'Viáticos solicitados', adelantos: 'Adelantos', pasajes_soles: 'Pasajes S/', rendido: 'Rendido', saldo_rendiciones: 'Saldo rendiciones', solicitante: 'Solicitante', excede_tarifa: 'Excede tarifa' }} />
          {can('viajes', 'tarifas') && <Button variant="outline" onClick={() => onNavigate?.('/viajes/tarifas')}><Settings2 className="size-4 mr-1" /> Tarifas</Button>}
          <Button variant="outline" onClick={() => onNavigate?.('/app')}><Smartphone className="size-4 mr-1" /> App móvil</Button>
          <Button onClick={() => setNuevo(true)}><Plus className="size-4 mr-1" /> Solicitar viaje</Button>
        </div>
      </div>

      {(pend.viajes.length > 0 || pend.rendiciones.length > 0 || (can('viajes', 'editar') && porLiquidar.length > 0)) && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="font-medium">Pendientes de ti</div>
            {pend.viajes.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"><span>Viaje <b>{v.numero}</b> · {v.destino} · {v.viajeros_nombres} · {soles(v.presupuesto_viaticos)}{v.tope_excedido ? ' · excede tarifa' : ''} · {v.estado === 'solicitado' ? 'espera jefatura' : 'espera Administración'}</span><Button size="sm" onClick={() => ir(v.id)}>Revisar</Button></div>)}
            {pend.rendiciones.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"><span>Rendición <b>{r.numero}</b> · {r.viajero} · {r.viaje_numero} · gastado {soles(r.gastado)}{r.tope_excedido ? ' · excede topes' : ''}</span><Button size="sm" onClick={() => ir(r.viaje_id)}>Revisar</Button></div>)}
            {can('viajes', 'editar') && porLiquidar.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"><span>Liquidar <b>{r.numero}</b> · {r.viajero} · {r.resultado === 'trabajador_devuelve' ? 'devuelve' : 'reembolsar'} {soles(Math.abs(r.saldo))}</span><Button size="sm" variant="outline" onClick={() => ir(r.viaje_id)}>Abrir</Button></div>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px] relative"><Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" /><Input placeholder="Número, destino, viajero, motivo…" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-10" /></div>
            <Select value={fEstado} onValueChange={(v: string) => setFEstado(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="abiertos">Abiertos</SelectItem><SelectItem value="todos">Todos</SelectItem>{ESTADOS.map(e => <SelectItem key={e} value={e}>{ESTADO_VIAJE[e].corto}</SelectItem>)}</SelectContent>
            </Select>
            <ProyectoSelector value={fProyecto} onChange={setFProyecto} nullable className="w-[260px]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>N.º</TableHead><TableHead>Estado</TableHead><TableHead>Destino · fechas</TableHead><TableHead>Viajeros</TableHead><TableHead>Proyecto</TableHead><TableHead className="text-right">Viáticos</TableHead><TableHead className="text-right">Pasajes</TableHead><TableHead className="text-right">Rendido</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground"><Loader2 className="inline size-4 animate-spin mr-2" />Cargando…</TableCell></TableRow>}
              {!loading && pag.paged.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin viajes con esos filtros.</TableCell></TableRow>}
              {pag.paged.map(v => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => ir(v.id)}>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{v.numero}</TableCell>
                  <TableCell><Badge className={`text-xs ${ESTADO_VIAJE[v.estado].clase}`}>{ESTADO_VIAJE[v.estado].corto}</Badge>{v.tope_excedido ? <div className="text-xs text-amber-700">excede tarifa</div> : null}</TableCell>
                  <TableCell className="text-sm">{v.origen} → {v.destino}<div className="text-xs text-muted-foreground">{rangoFechas(v.fecha_salida, v.fecha_retorno)}</div></TableCell>
                  <TableCell className="text-sm">{v.viajeros_nombres}</TableCell>
                  <TableCell className="text-sm">{v.proyecto_codigo ?? <span className="text-muted-foreground">oficina</span>}</TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">{soles(v.presupuesto_viaticos)}{Number(v.adelantos) > 0 ? <div className="text-xs text-muted-foreground">adel. {soles(v.adelantos)}</div> : null}</TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">{soles(v.reservas_soles)}</TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">{soles(v.rendido)}{Number(v.rendiciones_por_revisar) > 0 ? <div className="text-xs text-amber-700">{v.rendiciones_por_revisar} por revisar</div> : null}</TableCell>
                  <TableCell><Button variant="ghost" size="sm">Abrir</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pag.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground">Mostrando {pag.paged.length} de {pag.totalItems} · página {pag.page} de {pag.totalPages}</span>
              <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={nuevo} onOpenChange={(o: boolean) => setNuevo(o)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Solicitar viaje</DialogTitle><DialogDescription>La política pide avisar con dos días de anticipación. Los viáticos se calculan con la tarifa vigente; si necesitas más, justifícalo.</DialogDescription></DialogHeader>
          <NuevoViajeForm onCreado={(id) => { setNuevo(false); void cargar(); ir(id); }} onCancelar={() => setNuevo(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
