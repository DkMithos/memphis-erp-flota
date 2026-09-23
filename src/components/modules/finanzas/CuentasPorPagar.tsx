/**
 * CUENTAS POR PAGAR — qué se debe pagar cada mes.
 *
 * Responde las preguntas de Gerencia del PLAN-CxP (§4): cuánto se debe, cuánto
 * está vencido, cuánto vence este mes, cuándo hay que pagar (calendario) y
 * cuánto se pagó. Lee la vista `v_cxp` (solo sentido = pagar), que ya trae
 * pendiente, vencido y el TC aplicado; la RLS por área decide qué ve cada uno
 * (Carolina y los administradores ven todo).
 *
 * El filtro por ORIGEN es la clave: `real` (con factura) y `comprometido`
 * (con OC) son deuda cierta; `proyectado` es estimación o recurrencia del
 * Excel. Se muestran separados para no confundir una factura vencida con una
 * provisión.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard, AlertTriangle, CalendarClock, CheckCircle2, Loader2, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { PageNav } from '../../shared/PageNav';
import { supabase } from '../../../lib/supabase/client';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { toast } from 'sonner';

interface Cxp {
  id: string;
  area: string;
  cdc: string | null;
  proyectoId: string | null;
  concepto: string | null;
  categoria: string | null;
  proveedor: string | null;
  moneda: string;
  tcAplicado: number;
  vence: string | null;           // ISO
  mes: string | null;             // 'YYYY-MM'
  pendiente: number;              // en su moneda
  pendienteSoles: number;
  monto: number;
  pagadoMonto: number;
  pagado: boolean;
  vencido: boolean;
  origen: 'real' | 'comprometido' | 'proyectado';
  fuente: string;
  referencia: string | null;
  estado: string | null;
  momento: string | null;
  ordenCompraId: string | null;
  pagoLigadoA: 'ciprl' | 'acordado' | null;   // el vencimiento es un evento, no una fecha
  vencimientoEstimado: boolean;                // fecha estimada del CIPRL, no firme
  desfaseDias: number | null;                  // vencimiento factura − vencimiento OC
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const soles2 = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ETIQUETA_AREA: Record<string, string> = {
  CONTABILIDAD: 'Contabilidad', TI: 'TI', ADMINISTRACION: 'Administración', PROYECTOS: 'Proyectos',
};
const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (m: string) => (m === 'sin-fecha' ? 'Sin fecha' : `${MES_ABR[Number(m.slice(5, 7)) - 1] ?? '?'}-${m.slice(2, 4)}`);
const hoyISO = () => new Date().toISOString().slice(0, 10);
const mesActual = () => hoyISO().slice(0, 7);
const ORIGENES: { key: Cxp['origen']; label: string; ayuda: string }[] = [
  { key: 'real', label: 'Real (con factura)', ayuda: 'Deuda cierta: hay comprobante' },
  { key: 'comprometido', label: 'Comprometido (con OC)', ayuda: 'Hay orden aprobada, sin factura aún' },
  { key: 'proyectado', label: 'Proyectado', ayuda: 'Estimación o recurrencia (Excel)' },
];
const POR_PAGINA = 25;

export function CuentasPorPagar({ onNavigate }: { onNavigate?: (r: string) => void }) {
  const { can } = usePermissions();
  const puedeEditar = can('finanzas', 'editar') || can('finanzas', 'flujo');
  const [filas, setFilas] = useState<Cxp[]>([]);
  const [proyectos, setProyectos] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [area, setArea] = useState('TODAS');
  const [origenes, setOrigenes] = useState<Set<Cxp['origen']>>(new Set(['real', 'comprometido', 'proyectado']));
  const [proyecto, setProyecto] = useState('TODOS');
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [marcando, setMarcando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const TAM = 1000;
    const data: Record<string, unknown>[] = [];
    for (let desde = 0; ; desde += TAM) {
      // v_cxp es nueva y aún no está en los tipos generados de Supabase.
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const { data: pag, error } = await (supabase as any)
        .from('v_cxp')
        .select('id, area, cdc, proyecto_id, concepto, categoria, proveedor, moneda, tc_aplicado, vence, mes, monto_pendiente, monto_presupuestado, monto_pagado, pagado, vencido, origen, fuente, referencia_doc, estado_pago, momento, orden_compra_id, pago_ligado_a, vencimiento_estimado, desfase_dias')
        .eq('pagado', false)
        .order('vence', { ascending: true, nullsFirst: false })
        .range(desde, desde + TAM - 1);
      if (error) { toast.error('No se pudieron cargar las cuentas por pagar: ' + error.message); break; }
      if (!pag || pag.length === 0) break;
      data.push(...pag);
      if (pag.length < TAM) break;
    }
    setFilas(data.map((r): Cxp => {
      const pendiente = Number(r.monto_pendiente ?? 0);
      const tc = Number(r.tc_aplicado ?? 1) || 1;
      return {
        id: r.id as string,
        area: (r.area as string) ?? '',
        cdc: (r.cdc as string) ?? null,
        proyectoId: (r.proyecto_id as string) ?? null,
        concepto: (r.concepto as string) ?? null,
        categoria: (r.categoria as string) ?? null,
        proveedor: (r.proveedor as string) ?? null,
        moneda: (r.moneda as string) ?? 'PEN',
        tcAplicado: tc,
        vence: (r.vence as string) ?? null,
        mes: (r.mes as string) ?? null,
        pendiente,
        pendienteSoles: pendiente * tc,
        monto: Number(r.monto_presupuestado ?? 0),
        pagadoMonto: Number(r.monto_pagado ?? 0),
        pagado: Boolean(r.pagado),
        vencido: Boolean(r.vencido),
        origen: (r.origen as Cxp['origen']) ?? 'proyectado',
        fuente: (r.fuente as string) ?? 'excel',
        referencia: (r.referencia_doc as string) ?? null,
        estado: (r.estado_pago as string) ?? null,
        momento: (r.momento as string) ?? null,
        ordenCompraId: (r.orden_compra_id as string) ?? null,
        pagoLigadoA: r.pago_ligado_a === 'ciprl' || r.pago_ligado_a === 'acordado' ? r.pago_ligado_a : null,
        vencimientoEstimado: Boolean(r.vencimiento_estimado),
        desfaseDias: r.desfase_dias == null ? null : Number(r.desfase_dias),
      };
    }));
    setCargando(false);
  };
  useEffect(() => { void cargar(); }, []);
  useEffect(() => {
    supabase.from('proyectos').select('id, codigo, nombre').order('codigo')
      .then(({ data }) => setProyectos((data ?? []) as { id: string; codigo: string; nombre: string }[]));
  }, []);

  const areas = useMemo(() => Array.from(new Set(filas.map(f => f.area).filter(Boolean))).sort(), [filas]);
  const nombreProyecto = useMemo(() => new Map(proyectos.map(p => [p.id, p.codigo])), [proyectos]);

  const datos = useMemo(() => filas.filter(f => {
    if (!origenes.has(f.origen)) return false;
    if (area !== 'TODAS' && f.area !== area) return false;
    if (proyecto !== 'TODOS' && f.proyectoId !== proyecto) return false;
    if (soloVencidas && !f.vencido) return false;
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      if (!`${f.concepto ?? ''} ${f.proveedor ?? ''} ${f.cdc ?? ''} ${f.referencia ?? ''} ${f.categoria ?? ''}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [filas, origenes, area, proyecto, soloVencidas, busqueda]);

  // Las 5 preguntas de Gerencia.
  const kpi = useMemo(() => {
    const hoy = hoyISO(); const mes = mesActual();
    const en30 = new Date(); en30.setDate(en30.getDate() + 30); const en30ISO = en30.toISOString().slice(0, 10);
    let deuda = 0, vencido = 0, esteMes = 0, prox30 = 0, nVencidas = 0;
    for (const f of datos) {
      deuda += f.pendienteSoles;
      if (f.vencido) { vencido += f.pendienteSoles; nVencidas++; }
      if (f.mes === mes) esteMes += f.pendienteSoles;
      if (f.vence && f.vence >= hoy && f.vence <= en30ISO) prox30 += f.pendienteSoles;
    }
    return { deuda, vencido, esteMes, prox30, nVencidas, n: datos.length };
  }, [datos]);

  // Calendario: mes × área, en soles.
  const calendario = useMemo(() => {
    const meses = new Set<string>(); const porArea = new Map<string, Map<string, number>>(); const totalMes = new Map<string, number>();
    for (const f of datos) {
      const m = f.mes ?? 'sin-fecha'; meses.add(m);
      const fila = porArea.get(f.area) ?? new Map<string, number>();
      fila.set(m, (fila.get(m) ?? 0) + f.pendienteSoles); porArea.set(f.area, fila);
      totalMes.set(m, (totalMes.get(m) ?? 0) + f.pendienteSoles);
    }
    const orden = Array.from(meses).sort((a, b) => (a === 'sin-fecha' ? 1 : b === 'sin-fecha' ? -1 : a.localeCompare(b)));
    return { meses: orden, porArea, totalMes };
  }, [datos]);

  useEffect(() => { setPagina(1); }, [area, origenes, proyecto, soloVencidas, busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(datos.length / POR_PAGINA));
  const paginado = datos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Lo que no tiene fecha porque su vencimiento es un EVENTO (el cobro del
  // CIPRL) o un acuerdo pendiente. Se separa para que nadie lo lea como vencido
  // ni lo pierda de vista.
  const ligadasCiprl = useMemo(() => {
    const porProyecto = new Map<string, { proyectoId: string | null; filas: Cxp[]; total: number }>();
    for (const f of datos) {
      if (f.pagoLigadoA !== 'ciprl') continue;
      if (f.vence && !f.vencimientoEstimado) continue;   // ya tiene fecha firme (cobro registrado)
      const k = f.proyectoId ?? 'sin-proyecto';
      const g = porProyecto.get(k) ?? { proyectoId: f.proyectoId, filas: [], total: 0 };
      g.filas.push(f); g.total += f.pendienteSoles; porProyecto.set(k, g);
    }
    return Array.from(porProyecto.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [datos]);
  const sinFechaAcordado = useMemo(() => datos.filter(f => !f.vence && f.pagoLigadoA !== 'ciprl'), [datos]);

  const [ciprlEdit, setCiprlEdit] = useState<Record<string, string>>({});
  const [fechaEdit, setFechaEdit] = useState<Record<string, string>>({});

  const fijarCiprl = async (proyectoId: string, estimada: string, cobro?: string) => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const { error } = await (supabase as any).rpc('fijar_ciprl_proyecto', {
      p_proyecto: proyectoId, p_estimada: estimada || null, p_cobro: cobro || null,
    });
    if (error) { toast.error('No se pudo fijar la fecha del CIPRL: ' + error.message); return; }
    toast.success(cobro ? 'Cobro del CIPRL registrado: las órdenes ligadas quedan con fecha firme' : 'Fecha estimada del CIPRL aplicada a las órdenes ligadas');
    void cargar();
  };

  const fijarFecha = async (f: Cxp, fecha: string) => {
    if (!fecha) return;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const { error } = f.ordenCompraId
      ? await (supabase as any).rpc('fijar_vencimiento_oc', { p_oc: f.ordenCompraId, p_fecha: fecha, p_estimado: false })
      : await (supabase as any).from('flujo_compromisos').update({ fecha_vencimiento: fecha, mes_vencimiento: `${fecha.slice(0, 7)}-01` }).eq('id', f.id);
    if (error) { toast.error('No se pudo fijar la fecha: ' + error.message); return; }
    toast.success('Fecha de vencimiento fijada');
    void cargar();
  };

  const toggleOrigen = (k: Cxp['origen']) => setOrigenes(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  // El pago ya no es un check: nace una transacción de Finanzas (egreso pagado,
  // enlazada a la factura/OC) y la base cierra el compromiso y la factura.
  const marcarPagado = async (f: Cxp) => {
    if (!window.confirm(`¿Registrar el pago de "${f.concepto ?? ''}" por ${f.moneda === 'USD' ? 'US$' : 'S/'} ${f.pendiente.toLocaleString('es-PE')} con fecha de hoy?`)) return;
    setMarcando(f.id);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const { error } = await (supabase as any).rpc('registrar_pago_compromiso', { p_compromiso: f.id, p_fecha: hoyISO() });
    setMarcando(null);
    if (error) { toast.error('No se pudo registrar el pago: ' + error.message); return; }
    toast.success('Pago registrado en Finanzas (transacción creada)');
    void cargar();
  };

  const chipOrigen = (o: Cxp['origen']) => (
    <Badge variant={o === 'real' ? 'default' : o === 'comprometido' ? 'secondary' : 'outline'} className="text-[10px]">
      {o === 'real' ? 'Real' : o === 'comprometido' ? 'OC' : 'Proy.'}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><CreditCard className="size-6" /> Cuentas por pagar</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Qué se debe pagar y cuándo. <b>Real</b> = hay factura; <b>Comprometido</b> = hay orden de compra aprobada;
            <b> Proyectado</b> = estimación o recurrencia cargada del Excel. Montos en soles al TC de cada compromiso.
          </p>
        </div>
        <Button variant="outline" onClick={() => onNavigate?.('/finanzas/flujo-financiero')}>Ver flujo financiero</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">¿Cuánto se debe?</p>
          <p className="text-xl font-bold">{soles(kpi.deuda)}</p>
          <p className="text-xs text-muted-foreground">{kpi.n} compromisos pendientes</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="size-3.5 text-red-500" /> Vencido</p>
          <p className="text-xl font-bold text-red-600">{soles(kpi.vencido)}</p>
          <p className="text-xs text-muted-foreground">{kpi.nVencidas} vencidos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3.5" /> Vence este mes</p>
          <p className="text-xl font-bold">{soles(kpi.esteMes)}</p>
          <p className="text-xs text-muted-foreground">{mesLabel(mesActual())}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Próximos 30 días</p>
          <p className="text-xl font-bold">{soles(kpi.prox30)}</p>
          <p className="text-xs text-muted-foreground">desde hoy</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <Card><CardContent className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {ORIGENES.map(o => (
            <Button key={o.key} size="sm" variant={origenes.has(o.key) ? 'default' : 'outline'} title={o.ayuda} onClick={() => toggleOrigen(o.key)}>
              {o.label}
            </Button>
          ))}
        </div>
        <select className="h-9 rounded-md border bg-background px-3 text-sm" value={area} onChange={e => setArea(e.target.value)}>
          <option value="TODAS">Todas las áreas</option>
          {areas.map(a => <option key={a} value={a}>{ETIQUETA_AREA[a] ?? a}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-3 text-sm max-w-[260px]" value={proyecto} onChange={e => setProyecto(e.target.value)}>
          <option value="TODOS">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloVencidas} onChange={e => setSoloVencidas(e.target.checked)} /> Solo vencidas
        </label>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar concepto, proveedor, CDC, OC…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      </CardContent></Card>

      {/* Ligadas al cobro del CIPRL: el vencimiento es un evento, no una fecha */}
      {ligadasCiprl.length > 0 && (
        <Card className="border-amber-300/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="size-4 text-amber-600" /> Se pagan cuando la empresa cobre el CIPRL
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              No cuentan como vencidas. Pon la <b>fecha estimada</b> de cobro por proyecto para que entren en la proyección de caja
              (queda marcada como estimada); cuando el CIPRL se cobre, registra la <b>fecha real</b> y las órdenes pasan a vencimiento firme.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Proyecto</th>
                  <th className="text-right font-medium px-3 py-2">Órdenes</th>
                  <th className="text-right font-medium px-3 py-2">Pendiente (S/)</th>
                  <th className="text-left font-medium px-3 py-2">Fecha estimada de cobro</th>
                  {puedeEditar && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {ligadasCiprl.map(([k, g]) => {
                  const estimadaActual = g.filas.find(f => f.vencimientoEstimado && f.vence)?.vence ?? '';
                  const valor = ciprlEdit[k] ?? estimadaActual;
                  return (
                    <tr key={k}>
                      <td className="px-3 py-2 font-medium">{g.proyectoId ? (nombreProyecto.get(g.proyectoId) ?? '—') : 'Sin proyecto'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.filas.length}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{soles(g.total)}</td>
                      <td className="px-3 py-2">
                        {puedeEditar && g.proyectoId ? (
                          <Input type="date" className="h-8 w-[160px]" value={valor} onChange={e => setCiprlEdit(p => ({ ...p, [k]: e.target.value }))} />
                        ) : (estimadaActual || 'sin estimar')}
                        {estimadaActual && <span className="ml-2 text-xs text-amber-600">estimada</span>}
                      </td>
                      {puedeEditar && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {g.proyectoId && (
                            <>
                              <Button size="sm" variant="outline" disabled={!valor} onClick={() => fijarCiprl(g.proyectoId!, valor)}>Aplicar estimada</Button>
                              <Button size="sm" variant="ghost" className="ml-1" disabled={!valor} title="Registrar que el CIPRL ya se cobró en esa fecha"
                                onClick={() => { if (window.confirm(`¿Registrar el cobro real del CIPRL el ${valor}? Las órdenes ligadas pasan a vencimiento firme.`)) fijarCiprl(g.proyectoId!, valor, valor); }}>
                                Cobrado
                              </Button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Sin fecha por acuerdo pendiente */}
      {sinFechaAcordado.length > 0 && (
        <Card className="border-amber-300/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" /> Sin fecha de vencimiento ({sinFechaAcordado.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">"Según lo acordado" u otras sin fecha: no entran al calendario hasta que alguien la fije.</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {sinFechaAcordado.slice(0, 40).map(f => (
                  <tr key={f.id}>
                    <td className="px-3 py-1.5 max-w-[360px] truncate" title={f.concepto ?? ''}>{f.concepto}{f.referencia && <span className="ml-1 text-xs text-muted-foreground">· {f.referencia}</span>}</td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate">{f.proveedor ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{soles2(f.pendienteSoles)}</td>
                    {puedeEditar && (
                      <td className="px-3 py-1.5 whitespace-nowrap text-right">
                        <Input type="date" className="h-8 w-[150px] inline-block" value={fechaEdit[f.id] ?? ''} onChange={e => setFechaEdit(p => ({ ...p, [f.id]: e.target.value }))} />
                        <Button size="sm" variant="outline" className="ml-1" disabled={!fechaEdit[f.id]} onClick={() => fijarFecha(f, fechaEdit[f.id])}>Fijar</Button>
                      </td>
                    )}
                  </tr>
                ))}
                {sinFechaAcordado.length > 40 && (
                  <tr><td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">… y {sinFechaAcordado.length - 40} más (usa la búsqueda del detalle).</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Calendario mes × área */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Calendario de pagos (pendiente en soles)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {cargando ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-3 py-2 sticky left-0 bg-muted/30">Área</th>
                  {calendario.meses.map(m => <th key={m} className="text-right font-medium px-3 py-2 whitespace-nowrap">{mesLabel(m)}</th>)}
                  <th className="text-right font-medium px-3 py-2 border-l">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.from(calendario.porArea.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([a, fila]) => {
                  const tot = Array.from(fila.values()).reduce((s, n) => s + n, 0);
                  return (
                    <tr key={a}>
                      <td className="px-3 py-1.5 sticky left-0 bg-card font-medium">{ETIQUETA_AREA[a] ?? a}</td>
                      {calendario.meses.map(m => {
                        const n = fila.get(m) ?? 0;
                        return <td key={m} className={`text-right px-3 py-1.5 tabular-nums whitespace-nowrap ${n < 0.005 ? 'text-muted-foreground' : ''}`}>{n < 0.005 ? '' : soles(n)}</td>;
                      })}
                      <td className="text-right px-3 py-1.5 tabular-nums font-semibold border-l">{soles(tot)}</td>
                    </tr>
                  );
                })}
                {calendario.porArea.size === 0 && (
                  <tr><td colSpan={calendario.meses.length + 2} className="px-3 py-6 text-center text-muted-foreground">Nada pendiente con estos filtros.</td></tr>
                )}
              </tbody>
              {calendario.porArea.size > 0 && (
                <tfoot className="border-t-2 font-semibold bg-muted/40">
                  <tr>
                    <td className="px-3 py-2 sticky left-0 bg-muted/40">Total del mes</td>
                    {calendario.meses.map(m => <td key={m} className="text-right px-3 py-2 tabular-nums whitespace-nowrap">{soles(calendario.totalMes.get(m) ?? 0)}</td>)}
                    <td className="text-right px-3 py-2 tabular-nums border-l">{soles(kpi.deuda)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Detalle ({datos.length})</CardTitle>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Button size="icon" variant="ghost" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="size-4" /></Button>
            {pagina} / {totalPaginas}
            <Button size="icon" variant="ghost" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/30">
              <tr>
                <th className="text-left font-medium px-3 py-2">Vence</th>
                <th className="text-left font-medium px-3 py-2">Concepto</th>
                <th className="text-left font-medium px-3 py-2">Proveedor</th>
                <th className="text-left font-medium px-3 py-2">Área / CDC</th>
                <th className="text-left font-medium px-3 py-2">Origen</th>
                <th className="text-right font-medium px-3 py-2">Pendiente</th>
                <th className="text-right font-medium px-3 py-2">En soles</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginado.map(f => (
                <tr key={f.id} className={f.vencido ? 'bg-red-50/40 dark:bg-red-950/20' : ''}>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                    {f.vence ?? (f.pagoLigadoA === 'ciprl' ? 'al cobrar CIPRL' : '—')}
                    {f.vencido && <Badge variant="destructive" className="ml-1 text-[10px]">vencido</Badge>}
                    {f.vencimientoEstimado && <Badge variant="outline" className="ml-1 text-[10px] text-amber-600">estimada</Badge>}
                    {f.desfaseDias != null && f.desfaseDias !== 0 && (
                      <Badge variant="outline" className="ml-1 text-[10px]" title="Vencimiento de la factura frente al proyectado por la OC">
                        factura {f.desfaseDias > 0 ? '+' : ''}{f.desfaseDias} d
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 max-w-[320px] truncate" title={f.concepto ?? ''}>
                    {f.concepto}
                    {f.referencia && <span className="ml-1 text-xs text-muted-foreground">· {f.referencia}</span>}
                  </td>
                  <td className="px-3 py-1.5 max-w-[200px] truncate" title={f.proveedor ?? ''}>{f.proveedor ?? '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                    {ETIQUETA_AREA[f.area] ?? f.area}{f.cdc ? ` · ${f.cdc}` : ''}
                    {f.proyectoId && nombreProyecto.get(f.proyectoId) && <span className="ml-1 text-muted-foreground">({nombreProyecto.get(f.proyectoId)})</span>}
                  </td>
                  <td className="px-3 py-1.5">{chipOrigen(f.origen)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{f.moneda === 'USD' ? 'US$ ' : 'S/ '}{f.pendiente.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{soles2(f.pendienteSoles)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {puedeEditar && (
                      <Button size="sm" variant="ghost" disabled={marcando === f.id} onClick={() => marcarPagado(f)}>
                        {marcando === f.id ? <Loader2 className="size-4 animate-spin" /> : 'Marcar pagado'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {paginado.length === 0 && !cargando && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sin compromisos pendientes.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
