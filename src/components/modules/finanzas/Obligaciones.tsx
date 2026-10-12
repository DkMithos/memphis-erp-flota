/**
 * OBLIGACIONES FINANCIERAS — préstamos de socios y terceros, cheques diferidos,
 * letras, deuda tributaria y fraccionamientos. Reemplaza al "Libro obligaciones"
 * de Administración y a las hojas de CONTROL DE LA DEUDA de Contabilidad: cada
 * cuota es un compromiso del flujo y se paga por lotes como cualquier línea.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, Plus, Pencil, CalendarPlus, BadgeCheck, Ban, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PageNav } from '../../shared/PageNav';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { usePagination } from '@/lib/shared/usePagination';
import { usePersistedState } from '@/lib/shared/usePersistedState';
import { exportToExcelMultiHoja } from '@/lib/shared/export-utils';
import {
  cargarObligaciones, cargarCuotas, guardarObligacion, generarCuotas, marcarCuotaPagada, cambiarEstadoObligacion,
  TIPO_LABEL, ESTADO_LABEL, type Obligacion, type Cuota, type TipoObligacion, type ObligacionInput,
} from '@/lib/finanzas/obligaciones';

const fmt = (n: number, moneda = 'PEN') => `${moneda === 'USD' ? 'US$' : 'S/'} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const hoy = () => new Date().toISOString().slice(0, 10);
const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { vigente: 'default', vencida: 'destructive', pagada: 'secondary', renegociada: 'outline', anulada: 'outline' };

type FormOblig = { id?: string; tipo: TipoObligacion; acreedor: string; concepto: string; documento: string; moneda: string; capital: string; interes_total: string;
  tasa_interes: string; interes_tipo: string; penalidad: string; fecha_contrato: string; fecha_vencimiento: string; observaciones: string };
const FORM_VACIO: FormOblig = { tipo: 'prestamo', acreedor: '', concepto: '', documento: '', moneda: 'PEN', capital: '', interes_total: '', tasa_interes: '', interes_tipo: '', penalidad: '', fecha_contrato: '', fecha_vencimiento: '', observaciones: '' };

export function Obligaciones() {
  const { can } = usePermissions();
  const puedeEditar = can('finanzas', 'editar') || can('finanzas', 'crear') || can('contabilidad', 'editar');
  const [filas, setFilas] = useState<Obligacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [filtroEstado, setFiltroEstado] = usePersistedState<string>('obligaciones.estado', 'vivas');
  const [filtroTipo, setFiltroTipo] = usePersistedState<string>('obligaciones.tipo', 'todos');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<FormOblig | null>(null);
  const [detalle, setDetalle] = useState<Obligacion | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cuotasForm, setCuotasForm] = useState<{ n: string; primer: string; periodicidad: 'mensual' | 'unica' } | null>(null);
  const [pagoCuota, setPagoCuota] = useState<{ cuota: Cuota; fecha: string; monto: string; nota: string } | null>(null);
  const [estadoForm, setEstadoForm] = useState<{ estado: 'anulada' | 'renegociada' | 'vigente'; nota: string } | null>(null);

  const cargar = async () => {
    setCargando(true);
    try { setFilas(await cargarObligaciones()); } catch (e) { toast.error((e as Error).message); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargar(); }, []);
  const abrirDetalle = async (o: Obligacion) => {
    setDetalle(o);
    try { setCuotas(await cargarCuotas(o.id)); } catch (e) { toast.error((e as Error).message); }
  };
  const refrescarDetalle = async (id: string) => {
    const lista = await cargarObligaciones(); setFilas(lista);
    const o = lista.find(x => x.id === id) ?? null; setDetalle(o);
    if (o) setCuotas(await cargarCuotas(o.id));
  };
  const correr = async (fn: () => Promise<unknown>, ok: string, idDetalle?: string) => {
    setOcupado(true);
    try { await fn(); toast.success(ok); if (idDetalle) await refrescarDetalle(idDetalle); else await cargar(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter(o => {
      if (filtroEstado === 'vivas' && !['vigente', 'vencida'].includes(o.estado)) return false;
      if (filtroEstado !== 'vivas' && filtroEstado !== 'todas' && o.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && o.tipo !== filtroTipo) return false;
      if (q && ![o.numero, o.acreedor, o.concepto, o.documento].some(x => (x ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [filas, filtroEstado, filtroTipo, busqueda]);
  const pag = usePagination(visibles, 20);
  useEffect(() => { pag.reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtroEstado, filtroTipo, busqueda]);

  const kpi = useMemo(() => {
    const vivas = filas.filter(o => ['vigente', 'vencida'].includes(o.estado));
    const en30 = new Date(); en30.setDate(en30.getDate() + 30); const en30ISO = en30.toISOString().slice(0, 10);
    const s = { pen: 0, usd: 0, vencPen: 0, vencUsd: 0, proxPen: 0, proxUsd: 0, n: vivas.length, nVenc: 0 };
    for (const o of vivas) {
      if (o.moneda === 'USD') s.usd += o.saldo; else s.pen += o.saldo;
      if (o.vencido > 0) { s.nVenc++; if (o.moneda === 'USD') s.vencUsd += o.vencido; else s.vencPen += o.vencido; }
    }
    return { ...s, en30ISO };
  }, [filas]);

  const guardar = async () => {
    if (!form) return;
    const p: ObligacionInput = {
      id: form.id, tipo: form.tipo, acreedor: form.acreedor.trim(), concepto: form.concepto.trim() || undefined, documento: form.documento.trim() || undefined,
      moneda: form.moneda, capital: Number(form.capital.replace(/,/g, '')), interes_total: Number(form.interes_total.replace(/,/g, '') || 0),
      tasa_interes: form.tasa_interes ? Number(form.tasa_interes) : null, interes_tipo: form.interes_tipo || null, penalidad: form.penalidad || null,
      fecha_contrato: form.fecha_contrato || null, fecha_vencimiento: form.fecha_vencimiento || null, observaciones: form.observaciones || null,
    };
    if (!p.acreedor) { toast.error('Falta el acreedor'); return; }
    if (!(p.capital > 0)) { toast.error('El capital debe ser mayor a 0'); return; }
    await correr(async () => {
      const id = await guardarObligacion(p);
      setForm(null);
      // una obligación nueva sin cronograma: una cuota única al vencimiento, para que ya esté en el flujo
      if (!form.id && form.fecha_vencimiento) await generarCuotas(id, 1, form.fecha_vencimiento, 'unica');
    }, form.id ? 'Obligación actualizada' : 'Obligación registrada');
  };

  const editar = (o: Obligacion) => setForm({
    id: o.id, tipo: o.tipo, acreedor: o.acreedor, concepto: o.concepto ?? '', documento: o.documento ?? '', moneda: o.moneda, capital: String(o.capital),
    interes_total: String(o.interesTotal || ''), tasa_interes: o.tasaInteres == null ? '' : String(o.tasaInteres), interes_tipo: o.interesTipo ?? '',
    penalidad: o.penalidad ?? '', fecha_contrato: o.fechaContrato ?? '', fecha_vencimiento: o.fechaVencimiento ?? '', observaciones: o.observaciones ?? '',
  });

  const exportar = () => exportToExcelMultiHoja(`Obligaciones financieras ${hoy()}`, [{
    nombre: 'Obligaciones',
    data: visibles.map(o => ({ numero: o.numero, tipo: TIPO_LABEL[o.tipo], acreedor: o.acreedor, concepto: o.concepto ?? '', documento: o.documento ?? '', moneda: o.moneda,
      capital: o.capital, interes: o.interesTotal, total: o.total, pagado: o.pagado, saldo: o.saldo, vencido: o.vencido, contrato: o.fechaContrato ?? '', vencimiento: o.fechaVencimiento ?? '',
      proximo: o.proximoVencimiento ?? '', cuotas: `${o.cuotasPagadas}/${o.cuotas}`, estado: ESTADO_LABEL[o.estado], observaciones: o.observaciones ?? '' })),
    headersMap: { numero: 'N.º', tipo: 'Tipo', acreedor: 'Acreedor', concepto: 'Concepto', documento: 'Documento', moneda: 'Moneda', capital: 'Capital', interes: 'Interés',
      total: 'Total', pagado: 'Pagado', saldo: 'Saldo', vencido: 'Vencido', contrato: 'Contrato', vencimiento: 'Vencimiento', proximo: 'Próxima cuota', cuotas: 'Cuotas', estado: 'Estado', observaciones: 'Observaciones' },
  }]);

  const f = (k: keyof FormOblig, v: string) => setForm(prev => (prev ? { ...prev, [k]: v } : prev));

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="size-6" /> Obligaciones financieras</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Préstamos de socios y terceros, cheques diferidos, letras, deuda tributaria y fraccionamientos de SUNAT. Cada cuota es un
            compromiso del flujo: aparece en Cuentas por pagar y se paga por lotes. Lo pagado antes del ERP se marca a mano como histórico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cargar} disabled={cargando}><RefreshCw className={`size-4 ${cargando ? 'animate-spin' : ''}`} /></Button>
          <Button variant="outline" onClick={exportar} disabled={visibles.length === 0}>Exportar</Button>
          {puedeEditar && <Button onClick={() => setForm({ ...FORM_VACIO })}><Plus className="size-4" /> Nueva obligación</Button>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo vivo</p><p className="text-lg font-semibold">{fmt(kpi.pen)}</p><p className="text-sm">{fmt(kpi.usd, 'USD')}</p><p className="text-xs text-muted-foreground">{kpi.n} obligaciones vigentes o vencidas</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vencido sin pagar</p><p className="text-lg font-semibold text-red-600">{fmt(kpi.vencPen)}</p><p className="text-sm text-red-600">{fmt(kpi.vencUsd, 'USD')}</p><p className="text-xs text-muted-foreground">{kpi.nVenc} con cuotas vencidas</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Préstamos y letras</p><p className="text-2xl font-semibold">{filas.filter(o => ['prestamo', 'letra', 'cheque_diferido'].includes(o.tipo) && ['vigente', 'vencida'].includes(o.estado)).length}</p><p className="text-xs text-muted-foreground">socios, terceros, cheques diferidos</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">SUNAT</p><p className="text-2xl font-semibold">{filas.filter(o => ['deuda_tributaria', 'fraccionamiento'].includes(o.tipo) && ['vigente', 'vencida'].includes(o.estado)).length}</p><p className="text-xs text-muted-foreground">fraccionamientos y deuda en cobranza</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[['vivas', 'Vigentes y vencidas'], ['vencida', 'Vencidas'], ['pagada', 'Pagadas'], ['renegociada', 'Renegociadas'], ['todas', 'Todas']].map(([k, l]) => (
          <Button key={k} size="sm" variant={filtroEstado === k ? 'default' : 'outline'} onClick={() => setFiltroEstado(k)}>{l}</Button>
        ))}
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          {(Object.keys(TIPO_LABEL) as TipoObligacion[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
        <Input className="h-9 w-64 ml-auto" placeholder="Buscar acreedor, concepto, documento…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">N.º</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Acreedor · concepto</th>
                <th className="text-right px-3 py-2">Total</th><th className="text-right px-3 py-2">Saldo</th><th className="text-left px-3 py-2">Vence</th>
                <th className="text-left px-3 py-2">Cuotas</th><th className="text-left px-3 py-2">Estado</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cargando && filas.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!cargando && visibles.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nada que mostrar con este filtro.</td></tr>}
              {pag.paged.map(o => (
                <tr key={o.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => abrirDetalle(o)}>
                  <td className="px-3 py-2 font-mono text-xs">{o.numero}</td>
                  <td className="px-3 py-2 text-xs">{TIPO_LABEL[o.tipo]}</td>
                  <td className="px-3 py-2"><div className="font-medium">{o.acreedor}</div><div className="text-xs text-muted-foreground truncate max-w-[360px]" title={o.concepto ?? ''}>{o.concepto}{o.documento ? ` · ${o.documento}` : ''}</div></td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(o.total, o.moneda)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${o.vencido > 0 ? 'text-red-600 font-medium' : ''}`}>{fmt(o.saldo, o.moneda)}{o.vencido > 0 && <div className="text-xs">vencido {fmt(o.vencido, o.moneda)}</div>}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{fecha(o.proximoVencimiento ?? o.fechaVencimiento)}</td>
                  <td className="px-3 py-2 text-xs">{o.cuotasPagadas}/{o.cuotas}</td>
                  <td className="px-3 py-2"><Badge variant={ESTADO_VARIANT[o.estado]}>{ESTADO_LABEL[o.estado]}</Badge></td>
                  <td className="px-3 py-2 text-right">{puedeEditar && <Button size="sm" variant="ghost" onClick={(e: React.MouseEvent) => { e.stopPropagation(); editar(o); }}><Pencil className="size-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {pag.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>
          <span className="text-xs">Página {pag.page} de {pag.totalPages}</span>
          <Button size="sm" variant="outline" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
        </div>
      )}

      {/* Alta / edición */}
      {form && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setForm(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{form.id ? 'Editar obligación' : 'Nueva obligación'}</DialogTitle>
              <DialogDescription>El capital y el interés pactado definen el total; el cronograma se genera después (o queda una cuota única al vencimiento).</DialogDescription></DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: string) => f('tipo', v)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TIPO_LABEL) as TipoObligacion[]).map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Acreedor</Label><Input value={form.acreedor} onChange={e => f('acreedor', e.target.value)} placeholder="Sandra Wiese, SUNAT, Secrex…" /></div>
              <div className="space-y-1 md:col-span-2"><Label>Concepto</Label><Input value={form.concepto} onChange={e => f('concepto', e.target.value)} placeholder="Pagos varios, encaje de fianza, refinanciamiento renta anual 2024…" /></div>
              <div className="space-y-1"><Label>Documento (contrato, pagaré, cheque, resolución)</Label><Input value={form.documento} onChange={e => f('documento', e.target.value)} /></div>
              <div className="space-y-1"><Label>Moneda</Label>
                <Select value={form.moneda} onValueChange={(v: string) => f('moneda', v)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PEN">Soles (S/)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Capital</Label><Input type="number" step="0.01" value={form.capital} onChange={e => f('capital', e.target.value)} /></div>
              <div className="space-y-1"><Label>Interés pactado (monto total, si se conoce)</Label><Input type="number" step="0.01" value={form.interes_total} onChange={e => f('interes_total', e.target.value)} /></div>
              <div className="space-y-1"><Label>Tasa mensual (%)</Label><Input type="number" step="0.01" value={form.tasa_interes} onChange={e => f('tasa_interes', e.target.value)} placeholder="6" /></div>
              <div className="space-y-1"><Label>Tipo de interés</Label>
                <Select value={form.interes_tipo || 'ninguno'} onValueChange={(v: string) => f('interes_tipo', v === 'ninguno' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ninguno">Sin interés</SelectItem><SelectItem value="compensatorio">Compensatorio</SelectItem><SelectItem value="moratorio">Moratorio (máximo legal)</SelectItem><SelectItem value="compensatorio+moratorio">Compensatorio + moratorio</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Fecha de contrato</Label><Input type="date" value={form.fecha_contrato} onChange={e => f('fecha_contrato', e.target.value)} /></div>
              <div className="space-y-1"><Label>Vencimiento</Label><Input type="date" value={form.fecha_vencimiento} onChange={e => f('fecha_vencimiento', e.target.value)} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Penalidad</Label><Input value={form.penalidad} onChange={e => f('penalidad', e.target.value)} placeholder="15 % del préstamo por incumplimiento" /></div>
              <div className="space-y-1 md:col-span-2"><Label>Observaciones</Label><Textarea rows={2} value={form.observaciones} onChange={e => f('observaciones', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
              <Button onClick={guardar} disabled={ocupado}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : null} Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Detalle con cronograma */}
      {detalle && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) { setDetalle(null); setCuotas([]); } }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{detalle.numero} · {detalle.acreedor} <Badge variant={ESTADO_VARIANT[detalle.estado]}>{ESTADO_LABEL[detalle.estado]}</Badge></DialogTitle>
              <DialogDescription>
                {TIPO_LABEL[detalle.tipo]}{detalle.concepto ? ` · ${detalle.concepto}` : ''}{detalle.documento ? ` · ${detalle.documento}` : ''}. Capital {fmt(detalle.capital, detalle.moneda)}
                {detalle.interesTotal ? ` + interés ${fmt(detalle.interesTotal, detalle.moneda)}` : ''}{detalle.tasaInteres ? ` (${detalle.tasaInteres} % mensual${detalle.interesTipo ? `, ${detalle.interesTipo}` : ''})` : ''}.
                Contrato {fecha(detalle.fechaContrato)} · vence {fecha(detalle.fechaVencimiento)}. Pagado {fmt(detalle.pagado, detalle.moneda)} · saldo <b>{fmt(detalle.saldo, detalle.moneda)}</b>.
                {detalle.penalidad ? ` Penalidad: ${detalle.penalidad}.` : ''}
              </DialogDescription>
            </DialogHeader>
            {detalle.observaciones && <p className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/30">{detalle.observaciones}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {puedeEditar && ['vigente', 'vencida'].includes(detalle.estado) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setCuotasForm({ n: '1', primer: detalle.fechaVencimiento ?? hoy(), periodicidad: 'unica' })}><CalendarPlus className="size-4" /> Generar cronograma</Button>
                  <Button size="sm" variant="outline" onClick={() => setEstadoForm({ estado: 'renegociada', nota: '' })}>Renegociar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEstadoForm({ estado: 'anulada', nota: '' })}><Ban className="size-4" /> Anular</Button>
                </>
              )}
              {puedeEditar && ['renegociada', 'anulada'].includes(detalle.estado) && (
                <Button size="sm" variant="outline" onClick={() => setEstadoForm({ estado: 'vigente', nota: '' })}>Reactivar</Button>
              )}
              {puedeEditar && <Button size="sm" variant="ghost" onClick={() => editar(detalle)}><Pencil className="size-4" /> Editar datos</Button>}
            </div>
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0"><tr>
                  <th className="text-left px-2 py-1">#</th><th className="text-left px-2 py-1">Vence</th><th className="text-right px-2 py-1">Capital</th><th className="text-right px-2 py-1">Interés</th>
                  <th className="text-right px-2 py-1">Total</th><th className="text-right px-2 py-1">Pagado</th><th className="text-left px-2 py-1">Estado</th><th className="text-left px-2 py-1">Flujo</th><th></th>
                </tr></thead>
                <tbody className="divide-y">
                  {cuotas.length === 0 && <tr><td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">Sin cronograma: genera las cuotas para que la deuda entre al flujo.</td></tr>}
                  {cuotas.map(c => (
                    <tr key={c.id} className={c.estado === 'anulada' ? 'text-muted-foreground line-through' : c.vencida ? 'bg-red-50/40 dark:bg-red-950/10' : ''}>
                      <td className="px-2 py-1">{c.numero}</td><td className="px-2 py-1 whitespace-nowrap">{fecha(c.vencimiento)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(c.capital, detalle.moneda)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(c.interes, detalle.moneda)}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium">{fmt(c.total, detalle.moneda)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(c.pagado, detalle.moneda)}{c.fechaPago ? <div className="text-muted-foreground">{fecha(c.fechaPago)}</div> : null}</td>
                      <td className="px-2 py-1">{c.estado === 'pagada' ? 'Pagada' : c.estado === 'anulada' ? 'Anulada' : c.vencida ? 'Vencida' : 'Pendiente'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{c.compromisoId ? (c.compromisoEstado ?? 'en flujo') : '—'}{c.notas ? <div title={c.notas} className="truncate max-w-[200px]">{c.notas}</div> : null}</td>
                      <td className="px-2 py-1 text-right">{puedeEditar && c.estado === 'pendiente' && (
                        <Button size="sm" variant="ghost" title="Pagada fuera del ERP (histórico)" onClick={() => setPagoCuota({ cuota: c, fecha: hoy(), monto: String(c.total), nota: '' })}><BadgeCheck className="size-4" /></Button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Para pagar una cuota desde el ERP: Finanzas › Cuentas por pagar › selecciona la línea "{detalle.numero}/n" y créale un lote de pago. El ✓ de aquí es solo para pagos ya hechos fuera del sistema.</p>
          </DialogContent>
        </Dialog>
      )}

      {cuotasForm && detalle && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setCuotasForm(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Generar cronograma de {detalle.numero}</DialogTitle>
              <DialogDescription>Reparte el saldo (capital + interés pactado) en cuotas iguales. Las cuotas ya pagadas se conservan; las pendientes se reemplazan.</DialogDescription></DialogHeader>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1"><Label>Periodicidad</Label>
                <Select value={cuotasForm.periodicidad} onValueChange={(v: string) => setCuotasForm({ ...cuotasForm, periodicidad: v as 'mensual' | 'unica', n: v === 'unica' ? '1' : cuotasForm.n })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unica">Cuota única</SelectItem><SelectItem value="mensual">Mensual</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>N.º de cuotas</Label><Input type="number" min={1} value={cuotasForm.n} disabled={cuotasForm.periodicidad === 'unica'} onChange={e => setCuotasForm({ ...cuotasForm, n: e.target.value })} /></div>
              <div className="space-y-1"><Label>Primer vencimiento</Label><Input type="date" value={cuotasForm.primer} onChange={e => setCuotasForm({ ...cuotasForm, primer: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCuotasForm(null)}>Cancelar</Button>
              <Button disabled={ocupado} onClick={() => correr(async () => { await generarCuotas(detalle.id, Number(cuotasForm.n), cuotasForm.primer, cuotasForm.periodicidad); setCuotasForm(null); }, 'Cronograma generado', detalle.id)}>Generar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {pagoCuota && detalle && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setPagoCuota(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cuota {pagoCuota.cuota.numero} pagada fuera del ERP</DialogTitle>
              <DialogDescription>Solo para pagos históricos (antes de los lotes de pago). No crea transacción bancaria; cierra la cuota y su compromiso.</DialogDescription></DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Fecha de pago</Label><Input type="date" value={pagoCuota.fecha} onChange={e => setPagoCuota({ ...pagoCuota, fecha: e.target.value })} /></div>
              <div className="space-y-1"><Label>Monto pagado</Label><Input type="number" step="0.01" value={pagoCuota.monto} onChange={e => setPagoCuota({ ...pagoCuota, monto: e.target.value })} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Nota (n.º de operación, voucher…)</Label><Input value={pagoCuota.nota} onChange={e => setPagoCuota({ ...pagoCuota, nota: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPagoCuota(null)}>Cancelar</Button>
              <Button disabled={ocupado} onClick={() => correr(async () => { await marcarCuotaPagada(pagoCuota.cuota.id, pagoCuota.fecha, Number(pagoCuota.monto), pagoCuota.nota); setPagoCuota(null); }, 'Cuota marcada como pagada', detalle.id)}>Marcar pagada</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {estadoForm && detalle && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setEstadoForm(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{estadoForm.estado === 'anulada' ? 'Anular' : estadoForm.estado === 'renegociada' ? 'Renegociar' : 'Reactivar'} {detalle.numero}</DialogTitle>
              <DialogDescription>{estadoForm.estado === 'vigente' ? 'Vuelve a vigente; genera después el nuevo cronograma.' : 'Las cuotas pendientes se anulan y salen del flujo; las pagadas se conservan. Si se renegocia, registra la nueva obligación aparte.'}</DialogDescription></DialogHeader>
            <div className="space-y-1"><Label>Motivo</Label><Textarea rows={2} value={estadoForm.nota} onChange={e => setEstadoForm({ ...estadoForm, nota: e.target.value })} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEstadoForm(null)}>Cancelar</Button>
              <Button variant={estadoForm.estado === 'anulada' ? 'destructive' : 'default'} disabled={ocupado} onClick={() => correr(async () => { await cambiarEstadoObligacion(detalle.id, estadoForm.estado, estadoForm.nota); setEstadoForm(null); }, 'Estado actualizado', detalle.id)}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
