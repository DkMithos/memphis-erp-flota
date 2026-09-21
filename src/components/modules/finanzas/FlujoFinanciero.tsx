/**
 * FLUJO FINANCIERO — lo que hoy vive en las BD de Excel (Contabilidad, TI,
 * Administración, Proyectos), ya dentro del ERP. Reemplaza las tablas dinámicas:
 * se guarda la base normalizada (un compromiso por fila) y el ERP pinta el flujo
 * de forma HORIZONTAL, concepto/CDC × meses, que es como se lee un flujo.
 *
 * Un flujo mezcla salidas y entradas: los importes positivos son EGRESOS (lo que
 * hay que pagar) y los negativos, INGRESOS (p. ej. la CIPRL que financia el
 * proyecto). El neto por mes es la posición de caja de ese mes.
 *
 * Además de reflejar el Excel (fuente='excel'), cada área puede crear/editar/
 * borrar sus compromisos aquí (fuente='erp'); eso sobrevive a las reimportaciones
 * y la RLS asegura que cada quien solo toque su área. Carolina y los
 * administradores ven y editan todas.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Waves, ArrowDownCircle, ArrowUpCircle, Scale, CheckCircle2, Search, AlertTriangle,
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from 'sonner';
import { ImportarFlujoDialog } from './ImportarFlujoDialog';
import { CompromisoFlujoDialog, type CompromisoEdit } from './CompromisoFlujoDialog';

interface Compromiso {
  id: string;
  area: string;
  cdc: string | null;
  categoria: string | null;
  concepto: string | null;
  proveedor: string | null;
  moneda: string | null;
  tc: number | null;
  mesVencimiento: string | null;   // 'YYYY-MM-01'
  monto: number;                    // firmado: + egreso, − ingreso
  pagado: number;
  estado: string | null;
  postergado: number | null;
  observaciones: string | null;
  fuente: string;                   // 'excel' | 'erp'
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const celda = (n: number) => (Math.abs(n) < 0.005 ? '' : soles(n));

const ETIQUETA_AREA: Record<string, string> = {
  CONTABILIDAD: 'Contabilidad', TI: 'TI', ADMINISTRACION: 'Administración', PROYECTOS: 'Proyectos',
};
const etiquetaArea = (a: string) => ETIQUETA_AREA[a] ?? a;

const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const mesLabel = (iso: string): string => {
  if (iso === 'sin-fecha') return 'Sin fecha';
  const [a, m] = iso.split('-');
  return `${MES_ABR[Number(m) - 1] ?? '?'}-${a.slice(2)}`;
};

/** Oculta fechas sucias (año 2000/2028…) hasta que se limpien. Sin fecha vale. */
const mesValido = (iso: string | null): boolean => {
  if (!iso) return true;
  const y = Number(iso.slice(0, 4));
  return y >= 2025 && y <= 2027;
};

const aSoles = (monto: number, moneda: string | null, tc: number | null) =>
  moneda === 'USD' ? monto * (tc && tc > 0 ? tc : 3.4) : monto;

function badgeEstado(estado: string | null): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const e = (estado ?? '').toUpperCase();
  if (e.includes('PAGADO')) return { label: 'Pagado', variant: 'default' };
  if (e.includes('SALDO A FAVOR')) return { label: 'Saldo a favor', variant: 'secondary' };
  if (e.includes('VENCIDO')) return { label: 'Vencido', variant: 'destructive' };
  if (e.includes('PENDIENTE')) return { label: 'Pendiente', variant: 'destructive' };
  return { label: estado || '—', variant: 'outline' };
}

type Agrupador = 'cdc' | 'categoria' | 'concepto';
const AGRUPADORES: { key: Agrupador; label: string }[] = [
  { key: 'cdc', label: 'Centro de costo' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'concepto', label: 'Concepto' },
];
const TOPE_FILAS = 60;
const POR_PAGINA = 25;

export function FlujoFinanciero() {
  const { tenantId, user } = useAuth();
  const [filas, setFilas] = useState<Compromiso[]>([]);
  const [centros, setCentros] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [area, setArea] = useState<string>('TODAS');
  const [agrupador, setAgrupador] = useState<Agrupador>('cdc');
  const [anio, setAnio] = useState<string>('todos');
  const [mesFiltro, setMesFiltro] = useState<string>('todos');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<CompromisoEdit | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('flujo_compromisos')
      .select('id, area, cdc, categoria, concepto, proveedor, moneda, tc, mes_vencimiento, monto_presupuestado, monto_pagado, estado_pago, postergado, observaciones, fuente')
      .order('mes_vencimiento', { ascending: true });
    setFilas((data ?? []).map((r: Record<string, unknown>): Compromiso => ({
      id: r.id as string,
      area: (r.area as string) ?? '',
      cdc: (r.cdc as string) ?? null,
      categoria: (r.categoria as string) ?? null,
      concepto: (r.concepto as string) ?? null,
      proveedor: (r.proveedor as string) ?? null,
      moneda: (r.moneda as string) ?? 'PEN',
      tc: r.tc as number | null,
      mesVencimiento: (r.mes_vencimiento as string) ?? null,
      monto: Number(r.monto_presupuestado ?? 0),
      pagado: Number(r.monto_pagado ?? 0),
      estado: (r.estado_pago as string) ?? null,
      postergado: r.postergado as number | null,
      observaciones: (r.observaciones as string) ?? null,
      fuente: (r.fuente as string) ?? 'excel',
    })));
    setCargando(false);
  };
  useEffect(() => { void cargar(); }, []);
  useEffect(() => {
    if (!tenantId) return;
    supabase.from('centros_costo').select('id, codigo, nombre').eq('tenant_id', tenantId).order('codigo')
      .then(({ data }) => setCentros((data ?? []) as { id: string; codigo: string; nombre: string }[]));
  }, [tenantId]);

  const areas = useMemo(() => Array.from(new Set(filas.map(f => f.area).filter(Boolean))).sort(), [filas]);
  const anios = useMemo(() => Array.from(new Set(
    filas.filter(f => f.mesVencimiento && mesValido(f.mesVencimiento)).map(f => f.mesVencimiento!.slice(0, 4)),
  )).sort(), [filas]);

  // Base: área + fechas válidas + año + mes + estado. Alimenta cifras, matriz y detalle.
  const datos = useMemo(() => filas.filter(f => {
    if (!mesValido(f.mesVencimiento)) return false;
    if (area !== 'TODAS' && f.area !== area) return false;
    if (anio !== 'todos' && (f.mesVencimiento?.slice(0, 4) ?? '') !== anio) return false;
    if (mesFiltro !== 'todos' && (f.mesVencimiento?.slice(5, 7) ?? '') !== mesFiltro) return false;
    if (estadoFiltro !== 'todos' && !(f.estado ?? '').toUpperCase().includes(estadoFiltro)) return false;
    return true;
  }), [filas, area, anio, mesFiltro, estadoFiltro]);

  const total = useMemo(() => {
    let egresos = 0, ingresos = 0, pagado = 0, postergados = 0;
    for (const f of datos) {
      const v = aSoles(f.monto, f.moneda, f.tc);
      if (v >= 0) egresos += v; else ingresos += -v;
      pagado += aSoles(f.pagado, f.moneda, f.tc);
      if ((f.postergado ?? 0) > 0) postergados++;
    }
    return { egresos, ingresos, neto: egresos - ingresos, pagado, postergados };
  }, [datos]);

  const meses = useMemo(() => {
    const set = new Set<string>();
    datos.forEach(f => set.add(f.mesVencimiento ?? 'sin-fecha'));
    return Array.from(set).sort((a, b) => (a === 'sin-fecha' ? 1 : b === 'sin-fecha' ? -1 : a.localeCompare(b)));
  }, [datos]);

  const matriz = useMemo(() => {
    const clave = (f: Compromiso) =>
      (agrupador === 'cdc' ? f.cdc : agrupador === 'categoria' ? f.categoria : f.concepto) || '—';
    const grupos = new Map<string, { total: number; mes: Map<string, number> }>();
    const totalMes = new Map<string, number>();
    for (const f of datos) {
      const g = clave(f);
      const k = f.mesVencimiento ?? 'sin-fecha';
      const v = aSoles(f.monto, f.moneda, f.tc);
      const gg = grupos.get(g) ?? { total: 0, mes: new Map() };
      gg.total += v; gg.mes.set(k, (gg.mes.get(k) ?? 0) + v);
      grupos.set(g, gg);
      totalMes.set(k, (totalMes.get(k) ?? 0) + v);
    }
    const orden = Array.from(grupos.entries()).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
    return { orden, totalMes, nGrupos: grupos.size };
  }, [datos, agrupador]);

  const detalle = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return datos;
    return datos.filter(f => `${f.cdc ?? ''} ${f.categoria ?? ''} ${f.concepto ?? ''} ${f.proveedor ?? ''}`.toLowerCase().includes(t));
  }, [datos, busqueda]);

  useEffect(() => { setPagina(1); }, [area, anio, mesFiltro, estadoFiltro, busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(detalle.length / POR_PAGINA));
  const paginado = detalle.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const montoColor = (n: number) => (n < -0.005 ? 'text-blue-600' : n > 0.005 ? '' : 'text-muted-foreground');

  const aEdicion = (f: Compromiso): CompromisoEdit => ({
    id: f.id, area: f.area, cdc: f.cdc, categoria: f.categoria, concepto: f.concepto,
    proveedor: f.proveedor, moneda: f.moneda, tc: f.tc, mesVencimiento: f.mesVencimiento,
    monto: f.monto, pagado: f.pagado, estado: f.estado, postergado: f.postergado, observaciones: f.observaciones,
  });

  const borrar = async (f: Compromiso) => {
    if (!window.confirm(`¿Borrar el compromiso "${f.concepto ?? ''}"?`)) return;
    const { error } = await supabase.from('flujo_compromisos').delete().eq('id', f.id);
    if (error) { toast.error('No se pudo borrar: ' + error.message); return; }
    toast.success('Compromiso borrado');
    void cargar();
  };

  const areasEscribibles = area === 'TODAS' ? areas : [area];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Waves className="size-6" /> Flujo financiero
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Compromisos por área y mes. Positivo = egreso (a pagar); negativo (azul) = ingreso, como la CIPRL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditando(null); setDialogOpen(true); }} disabled={areas.length === 0}>
            <Plus className="size-4" /> Nuevo compromiso
          </Button>
          <ImportarFlujoDialog onImportado={cargar} />
        </div>
      </div>

      {/* Área */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={area === 'TODAS' ? 'default' : 'outline'} size="sm" onClick={() => setArea('TODAS')}>Todas</Button>
        {areas.map(a => (
          <Button key={a} variant={area === a ? 'default' : 'outline'} size="sm" onClick={() => setArea(a)}>{etiquetaArea(a)}</Button>
        ))}
      </div>

      {filas.length === 0 && !cargando ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay nada cargado. Usa <strong>Importar / actualizar</strong> o <strong>Nuevo compromiso</strong>.
        </CardContent></Card>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-xs text-muted-foreground">Filtrar:</span>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={anio} onChange={e => setAnio(e.target.value)}>
              <option value="todos">Todos los años</option>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>
              <option value="todos">Todos los meses</option>
              {MES_NOM.map((n, i) => <option key={n} value={String(i + 1).padStart(2, '0')}>{n}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADO">Pagado</option>
              <option value="VENCIDO">Vencido</option>
              <option value="SALDO A FAVOR">Saldo a favor</option>
            </select>
            {(anio !== 'todos' || mesFiltro !== 'todos' || estadoFiltro !== 'todos') && (
              <Button variant="ghost" size="sm" onClick={() => { setAnio('todos'); setMesFiltro('todos'); setEstadoFiltro('todos'); }}>
                Limpiar
              </Button>
            )}
          </div>

          {/* Cifras */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpCircle className="size-3.5 text-red-500" /> Egresos programados</p>
              <p className="text-xl font-bold">{soles(total.egresos)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownCircle className="size-3.5 text-blue-600" /> Ingresos programados</p>
              <p className="text-xl font-bold">{soles(total.ingresos)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="size-3.5" /> Neto (egresos − ingresos)</p>
              <p className={`text-xl font-bold ${total.neto < 0 ? 'text-blue-600' : ''}`}>{soles(total.neto)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="size-3.5 text-green-600" /> Pagado</p>
              <p className="text-xl font-bold">{soles(total.pagado)}</p>
              {total.postergados > 0 && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="size-3" /> {total.postergados} postergados
                </p>
              )}
            </CardContent></Card>
          </div>

          {/* Matriz horizontal */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Flujo por mes</CardTitle>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Agrupar por:</span>
                {AGRUPADORES.map(a => (
                  <Button key={a.key} variant={agrupador === a.key ? 'default' : 'outline'} size="sm" onClick={() => setAgrupador(a.key)}>
                    {a.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium px-3 py-2 sticky left-0 bg-card z-10 min-w-[220px]">
                      {AGRUPADORES.find(a => a.key === agrupador)?.label}
                    </th>
                    {meses.map(m => <th key={m} className="text-right font-medium px-3 py-2 whitespace-nowrap">{mesLabel(m)}</th>)}
                    <th className="text-right font-medium px-3 py-2 whitespace-nowrap border-l">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matriz.orden.slice(0, TOPE_FILAS).map(([g, v]) => (
                    <tr key={g} className="hover:bg-accent/20">
                      <td className="px-3 py-1.5 sticky left-0 bg-card z-10 max-w-[280px] truncate" title={g}>{g}</td>
                      {meses.map(m => {
                        const n = v.mes.get(m) ?? 0;
                        return <td key={m} className={`text-right px-3 py-1.5 tabular-nums whitespace-nowrap ${montoColor(n)}`}>{celda(n)}</td>;
                      })}
                      <td className={`text-right px-3 py-1.5 tabular-nums whitespace-nowrap font-semibold border-l ${montoColor(v.total)}`}>{celda(v.total)}</td>
                    </tr>
                  ))}
                  {matriz.orden.length === 0 && (
                    <tr><td colSpan={meses.length + 2} className="text-center py-6 text-muted-foreground">Sin datos con estos filtros</td></tr>
                  )}
                </tbody>
                {matriz.orden.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold bg-muted/40">
                      <td className="px-3 py-2 sticky left-0 bg-muted/40 z-10">Neto del mes</td>
                      {meses.map(m => {
                        const n = matriz.totalMes.get(m) ?? 0;
                        return <td key={m} className={`text-right px-3 py-2 tabular-nums whitespace-nowrap ${montoColor(n)}`}>{celda(n)}</td>;
                      })}
                      <td className={`text-right px-3 py-2 tabular-nums whitespace-nowrap border-l ${montoColor(total.neto)}`}>{soles(total.neto)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
            {matriz.nGrupos > TOPE_FILAS && (
              <p className="text-xs text-muted-foreground px-4 py-2 border-t">
                Se muestran los {TOPE_FILAS} de mayor peso de {matriz.nGrupos}. Agrupa por centro de costo o usa el buscador.
              </p>
            )}
          </Card>

          {/* Detalle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Detalle ({detalle.length})</CardTitle>
              <div className="relative w-full max-w-xs">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar concepto, CDC, proveedor…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Área</th>
                    <th className="text-left font-medium px-4 py-2">CDC</th>
                    <th className="text-left font-medium px-4 py-2">Concepto</th>
                    <th className="text-left font-medium px-4 py-2">Vence</th>
                    <th className="text-right font-medium px-4 py-2">Monto</th>
                    <th className="text-right font-medium px-4 py-2">Pagado</th>
                    <th className="text-left font-medium px-4 py-2">Estado</th>
                    <th className="text-right font-medium px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cargando ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Cargando…</td></tr>
                  ) : paginado.map(f => {
                    const b = badgeEstado(f.estado);
                    const mon = f.moneda === 'USD' ? 'US$ ' : '';
                    const esManual = f.fuente === 'erp';
                    return (
                      <tr key={f.id}>
                        <td className="px-4 py-1.5"><Badge variant="outline">{etiquetaArea(f.area)}</Badge></td>
                        <td className="px-4 py-1.5 text-xs">{f.cdc ?? '—'}</td>
                        <td className="px-4 py-1.5 max-w-[260px] truncate" title={f.concepto ?? ''}>
                          {f.concepto ?? '—'}
                          {f.proveedor && f.proveedor !== f.cdc ? <span className="text-xs text-muted-foreground"> · {f.proveedor}</span> : null}
                          {esManual && <Badge variant="secondary" className="ml-2 text-[10px]">Manual</Badge>}
                        </td>
                        <td className="px-4 py-1.5">{mesLabel(f.mesVencimiento ?? 'sin-fecha')}</td>
                        <td className={`text-right px-4 tabular-nums ${f.monto < 0 ? 'text-blue-600' : ''}`}>{mon}{f.monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right px-4 tabular-nums">{f.pagado ? `${mon}${f.pagado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                        <td className="px-4 py-1.5"><Badge variant={b.variant}>{b.label}</Badge></td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {esManual ? (
                            <>
                              <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => { setEditando(aEdicion(f)); setDialogOpen(true); }}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-7 text-red-600" title="Borrar" onClick={() => borrar(f)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground pr-1" title="Viene del Excel; edítalo en el Excel o vuelve a importar">Excel</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!cargando && detalle.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nada coincide con el filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t text-sm">
                <span className="text-muted-foreground text-xs">
                  {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, detalle.length)} de {detalle.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs">Página {pagina} de {totalPaginas}</span>
                  <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <CompromisoFlujoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inicial={editando}
        areas={areasEscribibles.length ? areasEscribibles : areas}
        etiquetaArea={etiquetaArea}
        tenantId={tenantId}
        userId={user?.id ?? null}
        centros={centros}
        onGuardado={cargar}
      />
    </div>
  );
}
