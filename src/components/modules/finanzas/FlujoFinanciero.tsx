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
 * Cada usuario ve SOLO su área (lo filtra la RLS); Carolina y los administradores
 * ven todas.
 */

import { useEffect, useMemo, useState } from 'react';
import { Waves, ArrowDownCircle, ArrowUpCircle, Scale, CheckCircle2, Search, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { supabase } from '../../../lib/supabase/client';
import { ImportarFlujoDialog } from './ImportarFlujoDialog';

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
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Monto para celdas: vacío si es cero. */
const celda = (n: number) => (Math.abs(n) < 0.005 ? '' : soles(n));

const ETIQUETA_AREA: Record<string, string> = {
  CONTABILIDAD: 'Contabilidad', TI: 'TI', ADMINISTRACION: 'Administración', PROYECTOS: 'Proyectos',
};
const etiquetaArea = (a: string) => ETIQUETA_AREA[a] ?? a;

const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (iso: string): string => {
  if (iso === 'sin-fecha') return 'Sin fecha';
  const [a, m] = iso.split('-');
  return `${MES_ABR[Number(m) - 1] ?? '?'}-${a.slice(2)}`;
};

/** A soles: si es USD, por su TC (o 3.4 si falta). */
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
const TOPE_FILAS = 60;   // la matriz muestra las filas de mayor peso; el resto, en el detalle

export function FlujoFinanciero() {
  const [filas, setFilas] = useState<Compromiso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [area, setArea] = useState<string>('TODAS');
  const [agrupador, setAgrupador] = useState<Agrupador>('cdc');
  const [busqueda, setBusqueda] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('flujo_compromisos')
      .select('id, area, cdc, categoria, concepto, proveedor, moneda, tc, mes_vencimiento, monto_presupuestado, monto_pagado, estado_pago, postergado')
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
    })));
    setCargando(false);
  };
  useEffect(() => { void cargar(); }, []);

  const areas = useMemo(() => Array.from(new Set(filas.map(f => f.area).filter(Boolean))).sort(), [filas]);
  const porArea = useMemo(() => (area === 'TODAS' ? filas : filas.filter(f => f.area === area)), [filas, area]);

  // Cifras: egresos (positivos), ingresos (negativos en valor absoluto), neto, pagado.
  const total = useMemo(() => {
    let egresos = 0, ingresos = 0, pagado = 0, postergados = 0;
    for (const f of porArea) {
      const v = aSoles(f.monto, f.moneda, f.tc);
      if (v >= 0) egresos += v; else ingresos += -v;
      pagado += aSoles(f.pagado, f.moneda, f.tc);
      if ((f.postergado ?? 0) > 0) postergados++;
    }
    return { egresos, ingresos, neto: egresos - ingresos, pagado, postergados };
  }, [porArea]);

  // Meses presentes, ordenados (la última columna es "Sin fecha").
  const meses = useMemo(() => {
    const set = new Set<string>();
    porArea.forEach(f => set.add(f.mesVencimiento ?? 'sin-fecha'));
    return Array.from(set).sort((a, b) => (a === 'sin-fecha' ? 1 : b === 'sin-fecha' ? -1 : a.localeCompare(b)));
  }, [porArea]);

  // Matriz: filas = agrupador, columnas = meses, celda = neto (en soles).
  const matriz = useMemo(() => {
    const clave = (f: Compromiso) =>
      (agrupador === 'cdc' ? f.cdc : agrupador === 'categoria' ? f.categoria : f.concepto) || '—';
    const grupos = new Map<string, { total: number; mes: Map<string, number> }>();
    const totalMes = new Map<string, number>();
    for (const f of porArea) {
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
  }, [porArea, agrupador]);

  const detalle = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return porArea.filter(f => {
      if (soloPendientes && !(f.estado ?? '').toUpperCase().includes('PENDIENTE')) return false;
      if (!t) return true;
      return `${f.cdc ?? ''} ${f.categoria ?? ''} ${f.concepto ?? ''} ${f.proveedor ?? ''}`.toLowerCase().includes(t);
    });
  }, [porArea, busqueda, soloPendientes]);

  const montoColor = (n: number) => (n < -0.005 ? 'text-blue-600' : n > 0.005 ? '' : 'text-muted-foreground');

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
        <ImportarFlujoDialog onImportado={cargar} />
      </div>

      {/* Filtro por área */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={area === 'TODAS' ? 'default' : 'outline'} size="sm" onClick={() => setArea('TODAS')}>Todas</Button>
        {areas.map(a => (
          <Button key={a} variant={area === a ? 'default' : 'outline'} size="sm" onClick={() => setArea(a)}>{etiquetaArea(a)}</Button>
        ))}
      </div>

      {filas.length === 0 && !cargando ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay nada cargado. Usa <strong>Importar / actualizar</strong> para traer una BD desde SharePoint.
        </CardContent></Card>
      ) : (
        <>
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
                  <AlertTriangle className="size-3" /> {total.postergados} compromisos postergados
                </p>
              )}
            </CardContent></Card>
          </div>

          {/* Matriz horizontal: agrupador × meses */}
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
                    {meses.map(m => (
                      <th key={m} className="text-right font-medium px-3 py-2 whitespace-nowrap">{mesLabel(m)}</th>
                    ))}
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
                    <tr><td colSpan={meses.length + 2} className="text-center py-6 text-muted-foreground">Sin datos</td></tr>
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
                Se muestran los {TOPE_FILAS} de mayor peso de {matriz.nGrupos}. Agrupa por centro de costo o usa el buscador de abajo para el resto.
              </p>
            )}
          </Card>

          {/* Detalle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Detalle ({detalle.length})</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant={soloPendientes ? 'default' : 'outline'} size="sm" onClick={() => setSoloPendientes(v => !v)}>
                  Solo pendientes
                </Button>
                <div className="relative w-full max-w-xs">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar concepto, CDC, proveedor…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
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
                    <th className="text-right font-medium px-4 py-2">Posterg.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cargando ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Cargando…</td></tr>
                  ) : detalle.slice(0, 400).map(f => {
                    const b = badgeEstado(f.estado);
                    const mon = f.moneda === 'USD' ? 'US$ ' : '';
                    return (
                      <tr key={f.id}>
                        <td className="px-4 py-1.5"><Badge variant="outline">{etiquetaArea(f.area)}</Badge></td>
                        <td className="px-4 py-1.5 text-xs">{f.cdc ?? '—'}</td>
                        <td className="px-4 py-1.5 max-w-[280px] truncate" title={f.concepto ?? ''}>
                          {f.concepto ?? '—'}
                          {f.proveedor && f.proveedor !== f.cdc ? <span className="text-xs text-muted-foreground"> · {f.proveedor}</span> : null}
                        </td>
                        <td className="px-4 py-1.5">{mesLabel(f.mesVencimiento ?? 'sin-fecha')}</td>
                        <td className={`text-right px-4 tabular-nums ${f.monto < 0 ? 'text-blue-600' : ''}`}>{mon}{f.monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right px-4 tabular-nums">{f.pagado ? `${mon}${f.pagado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                        <td className="px-4 py-1.5"><Badge variant={b.variant}>{b.label}</Badge></td>
                        <td className="text-right px-4 tabular-nums">{f.postergado ? f.postergado : ''}</td>
                      </tr>
                    );
                  })}
                  {!cargando && detalle.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nada coincide con el filtro.</td></tr>
                  )}
                </tbody>
              </table>
              {detalle.length > 400 && (
                <p className="text-xs text-muted-foreground px-4 py-2 border-t">Se muestran 400 de {detalle.length}. Afina con el buscador.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
