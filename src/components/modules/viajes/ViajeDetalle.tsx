/**
 * Detalle de un viaje: datos, aprobaciones (jefatura → Administración), viajeros y
 * viáticos, reservas (Administración), adelantos, rendiciones por viajero (editor
 * + revisión + liquidación). El mismo componente sirve al ERP y a la app móvil
 * (`modoApp` quita la navegación de escritorio y apila todo en una columna).
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, X, Loader2, Plane, Plus, Trash2, Wallet, Lock, Undo2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { RendicionEditor } from './RendicionEditor';
import {
  ESTADO_RENDICION, ESTADO_VIAJE, RESULTADO, anularViaje, aprobarRendicion, aprobarViaje, borrarReserva, cargarPasajeros, cargarRendiciones, cargarReservas, cargarViaje, cerrarViaje,
  fechaCorta, guardarReserva, liquidarRendicion, rangoFechas, rechazarViaje, registrarAdelanto, revisarRendicion, soles, type Pasajero, type Rendicion, type Reserva, type Viaje,
} from '../../../lib/viajes/viajes';

const hoy = () => new Date().toISOString().slice(0, 10);

export function ViajeDetalle({ viajeId, onNavigate, modoApp = false, onVolver }: { viajeId: string; onNavigate?: (r: string) => void; modoApp?: boolean; onVolver?: () => void }) {
  const { user, tenantId } = useAuth();
  const { can } = usePermissions();
  const puedeEditar = can('viajes', 'editar');
  const puedeJefatura = can('viajes', 'aprobar');
  const puedeFinal = can('viajes', 'aprobar_final');

  const [viaje, setViaje] = useState<Viaje | null>(null);
  const [pasajeros, setPasajeros] = useState<Pasajero[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [dialogo, setDialogo] = useState<null | { tipo: 'rechazar' | 'anular' | 'observar_rev' | 'observar_apr' | 'liquidar' | 'adelanto' | 'reserva' | 'aprobar_j' | 'aprobar_f'; id?: string; r?: Reserva }>(null);
  const [texto, setTexto] = useState('');
  const [adel, setAdel] = useState({ monto: '', fecha: hoy(), medio: 'transferencia', ref: '' });
  const [liq, setLiq] = useState({ medio: 'transferencia', ref: '', fecha: hoy() });
  const [res, setRes] = useState<Partial<Reserva>>({});

  const cargar = async () => {
    try {
      const [v, p, r, rd] = await Promise.all([cargarViaje(viajeId), cargarPasajeros(viajeId), cargarReservas(viajeId), cargarRendiciones(viajeId)]);
      setViaje(v); setPasajeros(p); setReservas(r); setRendiciones(rd);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [viajeId]);

  const esMio = !!viaje && (viaje.solicitado_por === user?.id || pasajeros.some(p => p.user_id === user?.id));
  const rendDe = (pid: string) => rendiciones.find(r => r.pasajero_id === pid) ?? null;
  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try { await fn(); toast.success(ok); setDialogo(null); setTexto(''); await cargar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  };

  const puedeAprobarAhora = viaje && ((viaje.estado === 'solicitado' && puedeJefatura) || (viaje.estado === 'aprobado_jefatura' && puedeFinal));
  const puedeRechazar = viaje && (viaje.estado === 'solicitado' || viaje.estado === 'aprobado_jefatura') && (puedeJefatura || puedeFinal);
  const puedeAnular = viaje && !['cerrado', 'anulado', 'rechazado'].includes(viaje.estado) && (puedeEditar || (esMio && ['solicitado', 'aprobado_jefatura'].includes(viaje.estado)));

  const totalReservas = useMemo(() => reservas.reduce((s, r) => s + Number(r.costo_soles || 0), 0), [reservas]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Cargando viaje…</div>;
  if (!viaje) return <div className="p-6 text-sm text-muted-foreground">Viaje no encontrado o sin acceso.</div>;
  const E = ESTADO_VIAJE[viaje.estado];

  return (
    <div className={modoApp ? 'space-y-3 pb-24' : 'space-y-4'}>
      {!modoApp && <PageNav onBack={onVolver} />}
      <div className={`flex ${modoApp ? 'flex-col gap-2' : 'flex-wrap items-start justify-between gap-3'}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={modoApp ? 'text-lg font-bold' : 'text-2xl font-bold'}>{viaje.numero}</h1>
            <Badge className={E.clase}>{E.label}</Badge>
            {viaje.tope_excedido && <Badge className="bg-amber-100 text-amber-900"><AlertTriangle className="size-3 mr-1" />Excede tarifa</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{viaje.origen} → {viaje.destino} · {rangoFechas(viaje.fecha_salida, viaje.fecha_retorno)}{viaje.proyecto_codigo ? ` · ${viaje.proyecto_codigo}` : ' · oficina'}</p>
          <p className="text-sm">{viaje.motivo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeAprobarAhora && <Button onClick={() => setDialogo({ tipo: viaje.estado === 'solicitado' ? 'aprobar_j' : 'aprobar_f' })} className="bg-emerald-600 hover:bg-emerald-700"><Check className="size-4 mr-1" /> {viaje.estado === 'solicitado' ? 'Aprobar (jefatura)' : 'Aprobación final'}</Button>}
          {puedeRechazar && <Button variant="outline" onClick={() => setDialogo({ tipo: 'rechazar' })}><X className="size-4 mr-1" /> Rechazar</Button>}
          {puedeEditar && ['aprobado', 'en_curso', 'rendido'].includes(viaje.estado) && <Button variant="outline" onClick={() => accion(() => cerrarViaje(viaje.id), 'Viaje cerrado')}><Lock className="size-4 mr-1" /> Cerrar</Button>}
          {puedeAnular && <Button variant="ghost" onClick={() => setDialogo({ tipo: 'anular' })}><Undo2 className="size-4 mr-1" /> Anular</Button>}
        </div>
      </div>

      {/* Línea de aprobaciones */}
      <Card>
        <CardContent className={`pt-4 grid ${modoApp ? 'grid-cols-1 gap-2' : 'grid-cols-1 md:grid-cols-3 gap-3'} text-sm`}>
          <div><div className="text-xs text-muted-foreground">Solicitó</div>{viaje.solicitante ?? '—'} · {fechaCorta(viaje.solicitado_en)}</div>
          <div><div className="text-xs text-muted-foreground">Jefatura</div>{viaje.aprobado_jefatura_en ? `${viaje.jefatura_nombre ?? '—'} · ${fechaCorta(viaje.aprobado_jefatura_en)}` : 'pendiente'}{viaje.comentario_jefatura ? <div className="text-xs">{viaje.comentario_jefatura}</div> : null}</div>
          <div><div className="text-xs text-muted-foreground">Administración</div>{viaje.aprobado_en ? `${viaje.aprobador_nombre ?? '—'} · ${fechaCorta(viaje.aprobado_en)}` : viaje.estado === 'rechazado' ? `Rechazado: ${viaje.motivo_rechazo}` : 'pendiente'}{viaje.comentario_aprobacion ? <div className="text-xs">{viaje.comentario_aprobacion}</div> : null}</div>
          {viaje.justificacion_tope && <div className={modoApp ? '' : 'md:col-span-3'}><div className="text-xs text-muted-foreground">Justificación del exceso</div>{viaje.justificacion_tope}</div>}
          {viaje.observaciones && <div className={modoApp ? '' : 'md:col-span-3'}><div className="text-xs text-muted-foreground">Observaciones</div>{viaje.observaciones}</div>}
        </CardContent>
      </Card>

      {/* Viajeros y viáticos */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Viajeros y viáticos · solicitado {soles(viaje.presupuesto_viaticos)} · adelantos {soles(viaje.adelantos)}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Viajero</TableHead><TableHead className="text-right">Días</TableHead><TableHead className="text-right">Tarifa</TableHead><TableHead className="text-right">Solicitado</TableHead><TableHead className="text-right">Adelanto</TableHead><TableHead>Rendición</TableHead>{puedeEditar && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {pasajeros.map(p => { const r = rendDe(p.id); return (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.nombre}{p.es_externo ? <Badge variant="secondary" className="ml-1 text-xs">externo</Badge> : null}{p.cuenta_abono ? <div className="text-xs text-muted-foreground">{p.cuenta_abono}</div> : null}</TableCell>
                  <TableCell className="text-right text-sm">{p.dias}</TableCell>
                  <TableCell className="text-right text-sm">{soles(p.tarifa_diaria)}</TableCell>
                  <TableCell className={`text-right text-sm ${Number(p.viatico_solicitado) > Number(p.viatico_calculado) ? 'text-amber-700 font-medium' : ''}`}>{soles(p.viatico_solicitado)}</TableCell>
                  <TableCell className="text-right text-sm">{soles(p.adelanto_entregado)}{p.adelanto_fecha ? <div className="text-xs text-muted-foreground">{fechaCorta(p.adelanto_fecha)} · {p.adelanto_medio}</div> : null}</TableCell>
                  <TableCell className="text-sm">{r ? <Badge className={`text-xs ${ESTADO_RENDICION[r.estado].clase}`}>{ESTADO_RENDICION[r.estado].label}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  {puedeEditar && <TableCell>{['aprobado', 'en_curso'].includes(viaje.estado) && <Button size="sm" variant="outline" onClick={() => { setAdel({ monto: String(Math.max(0, Number(p.viatico_aprobado ?? p.viatico_solicitado) - Number(p.adelanto_entregado))), fecha: hoy(), medio: 'transferencia', ref: '' }); setDialogo({ tipo: 'adelanto', id: p.id }); }}>Adelanto</Button>}</TableCell>}
                </TableRow>); })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reservas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Plane className="size-4" /> Pasajes y reservas · {soles(totalReservas)}</CardTitle>
          {puedeEditar && !['rechazado', 'anulado', 'cerrado'].includes(viaje.estado) && <Button size="sm" variant="outline" onClick={() => { setRes({ tipo: 'aereo', tramo: 'ida', moneda: 'PEN', costo: 0, pago: 'pendiente', estado_pago: 'pendiente', origen: viaje.origen, destino: viaje.destino, fecha_salida: viaje.fecha_salida }); setDialogo({ tipo: 'reserva' }); }}><Plus className="size-4 mr-1" /> Reserva</Button>}
        </CardHeader>
        <CardContent className="p-0">
          {reservas.length === 0 ? <div className="p-4 text-sm text-muted-foreground">{viaje.requiere_pasajes ? 'Administración todavía no registra pasajes.' : 'Este viaje no requiere pasajes.'}</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Tipo · tramo</TableHead><TableHead>Ruta</TableHead><TableHead>Fecha</TableHead><TableHead>Empresa</TableHead><TableHead className="text-right">Costo</TableHead><TableHead>Pago</TableHead>{puedeEditar && <TableHead></TableHead>}</TableRow></TableHeader>
              <TableBody>
                {reservas.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.codigo_reserva ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.tipo} · {r.tramo ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.origen ?? '—'} → {r.destino ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fechaCorta(r.fecha_salida)}{r.hora_salida ? ` ${r.hora_salida.slice(0, 5)}` : ''}</TableCell>
                    <TableCell className="text-sm">{r.empresa ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{r.moneda === 'USD' ? `US$ ${Number(r.costo).toFixed(2)} → ` : ''}{soles(r.costo_soles)}</TableCell>
                    <TableCell className="text-sm"><Badge variant={r.estado_pago === 'pagado' ? 'default' : 'secondary'} className="text-xs">{r.estado_pago === 'pagado' ? `pagado · ${r.pago}` : 'pendiente'}</Badge></TableCell>
                    {puedeEditar && <TableCell className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => { setRes(r); setDialogo({ tipo: 'reserva', r }); }}>Editar</Button><Button size="sm" variant="ghost" onClick={() => accion(() => borrarReserva(r.id), 'Reserva eliminada')}><Trash2 className="size-4" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rendiciones por viajero */}
      {['aprobado', 'en_curso', 'rendido', 'cerrado'].includes(viaje.estado) && pasajeros.map(p => {
        const r = rendDe(p.id);
        const esElViajero = p.user_id === user?.id || viaje.solicitado_por === user?.id;
        if (!r && !esElViajero && !puedeEditar) return null;
        return (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
                <span>Rendición · {p.nombre}</span>
                <span className="flex flex-wrap gap-2">
                  {r && r.estado === 'presentada' && puedeJefatura && <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => accion(() => revisarRendicion(r.id, true), 'Rendición revisada y firmada')}><Check className="size-4 mr-1" /> Firmar (jefatura)</Button>
                    <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: 'observar_rev', id: r.id })}>Observar</Button></>}
                  {r && (r.estado === 'revisada_jefatura' || (r.estado === 'presentada' && puedeJefatura)) && puedeFinal && <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => accion(() => aprobarRendicion(r.id, true), 'Rendición aprobada')}><Check className="size-4 mr-1" /> Aprobar (Administración)</Button>
                    <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: 'observar_apr', id: r.id })}>Observar</Button></>}
                  {r && r.estado === 'aprobada' && puedeEditar && <Button size="sm" onClick={() => { setLiq({ medio: r.resultado === 'trabajador_devuelve' ? 'caja_chica' : 'transferencia', ref: '', fecha: hoy() }); setDialogo({ tipo: 'liquidar', id: r.id }); }}>{r.resultado === 'trabajador_devuelve' ? 'Registrar devolución' : 'Registrar reembolso'} {soles(Math.abs(r.saldo))}</Button>}
                </span>
              </CardTitle>
              {r && ['presentada', 'revisada_jefatura', 'aprobada', 'liquidada'].includes(r.estado) && (
                <p className="text-xs text-muted-foreground">{RESULTADO[r.resultado ?? 'cuadra']} · {soles(Math.abs(r.saldo))}{r.tope_excedido ? ' · excede topes' : ''}{r.liquidada_en ? ` · liquidada ${fechaCorta(r.liquidada_en)} (${r.liquidacion_medio ?? ''} ${r.liquidacion_referencia ?? ''})` : ''}</p>
              )}
            </CardHeader>
            <CardContent>
              <RendicionEditor viaje={viaje} pasajero={p} rendicion={r} puedeEditar={esElViajero || puedeEditar} compacto={modoApp} onCambio={cargar} />
            </CardContent>
          </Card>
        );
      })}

      {/* Diálogos */}
      <Dialog open={!!dialogo && ['rechazar', 'anular', 'observar_rev', 'observar_apr', 'aprobar_j', 'aprobar_f'].includes(dialogo.tipo)} onOpenChange={(o: boolean) => !o && !ocupado && setDialogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogo?.tipo === 'rechazar' ? 'Rechazar viaje' : dialogo?.tipo === 'anular' ? 'Anular viaje' : dialogo?.tipo === 'aprobar_j' ? 'Aprobar como jefatura' : dialogo?.tipo === 'aprobar_f' ? 'Aprobación final (Administración)' : 'Observar rendición'}</DialogTitle>
            <DialogDescription>{dialogo?.tipo?.startsWith('aprobar') ? 'Comentario opcional para quien sigue en el circuito.' : 'Escribe el motivo; la persona lo verá en su viaje.'}</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)} disabled={ocupado}>Cancelar</Button>
            <Button disabled={ocupado} onClick={() => {
              if (!dialogo) return;
              if (dialogo.tipo === 'rechazar') void accion(() => rechazarViaje(viaje.id, texto), 'Viaje rechazado');
              else if (dialogo.tipo === 'anular') void accion(() => anularViaje(viaje.id, texto), 'Viaje anulado');
              else if (dialogo.tipo === 'aprobar_j' || dialogo.tipo === 'aprobar_f') void accion(() => aprobarViaje(viaje.id, texto), 'Viaje aprobado');
              else if (dialogo.tipo === 'observar_rev') void accion(() => revisarRendicion(dialogo.id!, false, texto), 'Rendición observada');
              else void accion(() => aprobarRendicion(dialogo.id!, false, texto), 'Rendición observada');
            }}>{ocupado ? <Loader2 className="size-4 animate-spin mr-1" /> : null}Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'adelanto'} onOpenChange={(o: boolean) => !o && !ocupado && setDialogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Entregar adelanto de viáticos</DialogTitle><DialogDescription>Se suma a lo ya entregado; la rendición lo descuenta.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto S/</Label><Input type="number" step="0.01" value={adel.monto} onChange={e => setAdel(a => ({ ...a, monto: e.target.value }))} /></div>
            <div><Label>Fecha</Label><Input type="date" value={adel.fecha} onChange={e => setAdel(a => ({ ...a, fecha: e.target.value }))} /></div>
            <div><Label>Medio</Label>
              <Select value={adel.medio} onValueChange={(v: string) => setAdel(a => ({ ...a, medio: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="transferencia">Transferencia</SelectItem><SelectItem value="caja_chica">Caja chica</SelectItem><SelectItem value="efectivo">Efectivo</SelectItem></SelectContent></Select></div>
            <div><Label>Referencia</Label><Input value={adel.ref} onChange={e => setAdel(a => ({ ...a, ref: e.target.value }))} placeholder="N.º operación / vale" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogo(null)} disabled={ocupado}>Cancelar</Button>
            <Button disabled={ocupado || !Number(adel.monto)} onClick={() => accion(() => registrarAdelanto(dialogo!.id!, Number(adel.monto), adel.fecha, adel.medio, adel.ref), 'Adelanto registrado')}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'liquidar'} onOpenChange={(o: boolean) => !o && !ocupado && setDialogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Liquidar rendición</DialogTitle><DialogDescription>Registra el reembolso pagado al trabajador o la devolución recibida. Si todos los viajeros quedan liquidados, el viaje se cierra solo.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Medio</Label>
              <Select value={liq.medio} onValueChange={(v: string) => setLiq(l => ({ ...l, medio: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="transferencia">Transferencia</SelectItem><SelectItem value="caja_chica">Caja chica</SelectItem><SelectItem value="efectivo">Efectivo</SelectItem><SelectItem value="planilla">Descuento por planilla</SelectItem><SelectItem value="lote_pago">Lote de pago (línea libre)</SelectItem></SelectContent></Select></div>
            <div><Label>Fecha</Label><Input type="date" value={liq.fecha} onChange={e => setLiq(l => ({ ...l, fecha: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Referencia</Label><Input value={liq.ref} onChange={e => setLiq(l => ({ ...l, ref: e.target.value }))} placeholder="N.º operación / recibo" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogo(null)} disabled={ocupado}>Cancelar</Button>
            <Button disabled={ocupado} onClick={() => accion(() => liquidarRendicion(dialogo!.id!, liq.medio, liq.ref, liq.fecha), 'Rendición liquidada')}>Liquidar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'reserva'} onOpenChange={(o: boolean) => !o && !ocupado && setDialogo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{res.id ? 'Editar reserva' : 'Nueva reserva'}</DialogTitle><DialogDescription>Pasaje, hospedaje u otro gasto directo que paga la empresa. Un código de reserva con ida y vuelta se registra como multitramo o como dos filas.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Código</Label><Input value={res.codigo_reserva ?? ''} onChange={e => setRes(r => ({ ...r, codigo_reserva: e.target.value.toUpperCase() }))} placeholder="IUDEWM" /></div>
            <div><Label>Tipo</Label><Select value={res.tipo ?? 'aereo'} onValueChange={(v: string) => setRes(r => ({ ...r, tipo: v as Reserva['tipo'] }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="aereo">Aéreo</SelectItem><SelectItem value="terrestre">Terrestre</SelectItem><SelectItem value="hospedaje">Hospedaje</SelectItem><SelectItem value="otro">Otro</SelectItem></SelectContent></Select></div>
            <div><Label>Tramo</Label><Select value={res.tramo ?? 'ida'} onValueChange={(v: string) => setRes(r => ({ ...r, tramo: v as Reserva['tramo'] }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ida">Ida</SelectItem><SelectItem value="vuelta">Vuelta</SelectItem><SelectItem value="multitramo">Multitramo</SelectItem></SelectContent></Select></div>
            <div><Label>Viajero</Label><Select value={res.pasajero_id ?? 'todos'} onValueChange={(v: string) => setRes(r => ({ ...r, pasajero_id: v === 'todos' ? null : v }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos / compartida</SelectItem>{pasajeros.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Origen</Label><Input value={res.origen ?? ''} onChange={e => setRes(r => ({ ...r, origen: e.target.value.toUpperCase() }))} /></div>
            <div><Label>Destino</Label><Input value={res.destino ?? ''} onChange={e => setRes(r => ({ ...r, destino: e.target.value.toUpperCase() }))} /></div>
            <div><Label>Fecha salida</Label><Input type="date" value={res.fecha_salida ?? ''} onChange={e => setRes(r => ({ ...r, fecha_salida: e.target.value }))} /></div>
            <div><Label>Hora</Label><Input type="time" value={res.hora_salida ?? ''} onChange={e => setRes(r => ({ ...r, hora_salida: e.target.value || null }))} /></div>
            <div className="col-span-2"><Label>Empresa (aerolínea / hotel / agencia)</Label><Input value={res.empresa ?? ''} onChange={e => setRes(r => ({ ...r, empresa: e.target.value.toUpperCase() }))} placeholder="LATAM AIRLINES" /></div>
            <div><Label>Moneda</Label><Select value={res.moneda ?? 'PEN'} onValueChange={(v: string) => setRes(r => ({ ...r, moneda: v, tc: v === 'USD' ? (r.tc ?? 3.5) : null }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="PEN">S/</SelectItem><SelectItem value="USD">US$</SelectItem></SelectContent></Select></div>
            <div><Label>Costo</Label><Input type="number" step="0.01" value={res.costo ?? ''} onChange={e => setRes(r => ({ ...r, costo: Number(e.target.value) }))} /></div>
            {res.moneda === 'USD' && <div><Label>TC</Label><Input type="number" step="0.0001" value={res.tc ?? ''} onChange={e => setRes(r => ({ ...r, tc: Number(e.target.value) || null }))} /></div>}
            <div><Label>Pago</Label><Select value={res.pago ?? 'pendiente'} onValueChange={(v: string) => setRes(r => ({ ...r, pago: v as Reserva['pago'], estado_pago: v === 'pendiente' ? 'pendiente' : 'pagado', fecha_pago: v === 'pendiente' ? null : (r.fecha_pago ?? hoy()) }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="transferencia">Transferencia</SelectItem><SelectItem value="tarjeta">Tarjeta</SelectItem><SelectItem value="efectivo">Efectivo</SelectItem></SelectContent></Select></div>
            <div><Label>Origen del pago</Label><Input value={res.origen_pago ?? ''} onChange={e => setRes(r => ({ ...r, origen_pago: e.target.value }))} placeholder="Caja chica dólares / BBVA soles" /></div>
            <div className="col-span-2 md:col-span-4"><Label>Observaciones</Label><Input value={res.observaciones ?? ''} onChange={e => setRes(r => ({ ...r, observaciones: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogo(null)} disabled={ocupado}>Cancelar</Button>
            <Button disabled={ocupado} onClick={() => accion(() => guardarReserva({ ...res, viaje_id: viaje.id, tenant_id: tenantId ?? undefined, costo: Number(res.costo ?? 0), tc: res.moneda === 'USD' ? res.tc ?? null : null } as Partial<Reserva> & { viaje_id: string; tenant_id?: string }), 'Reserva guardada')}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
