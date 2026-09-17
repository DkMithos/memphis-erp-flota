/**
 * FLUJO FINANCIERO — lo que hoy vive en las BD de Excel (BD CONTA, BD TI…), ya
 * dentro del ERP. Reemplaza las tablas dinámicas: se guarda la base y el ERP
 * pinta las vistas — por área, por mes de vencimiento, pagado contra pendiente y
 * lo postergado, que es la columna que avisa de los atascos.
 *
 * De momento REFLEJA el Excel (se importa y se muestra); más adelante puede pasar
 * a MANDAR (crear/editar los compromisos aquí). La columna `fuente` ya distingue
 * lo importado de lo nativo, así que ese salto no rompe lo cargado.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Waves, Wallet, CheckCircle2, Clock, AlertTriangle, Search,
} from 'lucide-react';
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
  concepto: string | null;
  proveedor: string | null;
  moneda: string | null;
  tc: number | null;
  mesVencimiento: string | null;   // 'YYYY-MM-01'
  presupuestado: number;
  pagado: number;
  estado: string | null;
  postergado: number | null;
  observaciones: string | null;
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** 'YYYY-MM-01' → "mar-26". '' cuando no hay. */
const mesLabel = (iso: string | null): string => {
  if (!iso) return '—';
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
  if (e.includes('PENDIENTE')) return { label: 'Pendiente', variant: 'destructive' };
  return { label: estado || '—', variant: 'outline' };
}

export function FlujoFinanciero() {
  const [filas, setFilas] = useState<Compromiso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [area, setArea] = useState<string>('TODAS');
  const [busqueda, setBusqueda] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('flujo_compromisos')
      .select('id, area, cdc, concepto, proveedor, moneda, tc, mes_vencimiento, monto_presupuestado, monto_pagado, estado_pago, postergado, observaciones')
      .order('mes_vencimiento', { ascending: true });
    setFilas((data ?? []).map((r: Record<string, unknown>): Compromiso => ({
      id: r.id as string,
      area: (r.area as string) ?? '',
      cdc: (r.cdc as string) ?? null,
      concepto: (r.concepto as string) ?? null,
      proveedor: (r.proveedor as string) ?? null,
      moneda: (r.moneda as string) ?? 'PEN',
      tc: r.tc as number | null,
      mesVencimiento: (r.mes_vencimiento as string) ?? null,
      presupuestado: Number(r.monto_presupuestado ?? 0),
      pagado: Number(r.monto_pagado ?? 0),
      estado: (r.estado_pago as string) ?? null,
      postergado: r.postergado as number | null,
      observaciones: (r.observaciones as string) ?? null,
    })));
    setCargando(false);
  };
  useEffect(() => { void cargar(); }, []);

  const areas = useMemo(
    () => Array.from(new Set(filas.map(f => f.area).filter(Boolean))).sort(),
    [filas],
  );

  const porArea = useMemo(
    () => (area === 'TODAS' ? filas : filas.filter(f => f.area === area)),
    [filas, area],
  );

  const total = useMemo(() => {
    let presupuestado = 0, pagado = 0, pendiente = 0, postergados = 0;
    for (const f of porArea) {
      presupuestado += aSoles(f.presupuestado, f.moneda, f.tc);
      pagado += aSoles(f.pagado, f.moneda, f.tc);
      if ((f.estado ?? '').toUpperCase().includes('PENDIENTE')) pendiente += aSoles(f.presupuestado, f.moneda, f.tc);
      if ((f.postergado ?? 0) > 0) postergados++;
    }
    return { presupuestado, pagado, pendiente, postergados };
  }, [porArea]);

  // Por mes de vencimiento.
  const porMes = useMemo(() => {
    const mapa = new Map<string, { presupuestado: number; pagado: number; pendiente: number; postergados: number }>();
    for (const f of porArea) {
      const k = f.mesVencimiento ?? 'sin-fecha';
      const a = mapa.get(k) ?? { presupuestado: 0, pagado: 0, pendiente: 0, postergados: 0 };
      a.presupuestado += aSoles(f.presupuestado, f.moneda, f.tc);
      a.pagado += aSoles(f.pagado, f.moneda, f.tc);
      if ((f.estado ?? '').toUpperCase().includes('PENDIENTE')) a.pendiente += aSoles(f.presupuestado, f.moneda, f.tc);
      if ((f.postergado ?? 0) > 0) a.postergados++;
      mapa.set(k, a);
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => (a === 'sin-fecha' ? 1 : b === 'sin-fecha' ? -1 : a.localeCompare(b)));
  }, [porArea]);

  const detalle = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return porArea.filter(f => {
      if (soloPendientes && !(f.estado ?? '').toUpperCase().includes('PENDIENTE')) return false;
      if (!t) return true;
      return `${f.cdc ?? ''} ${f.concepto ?? ''} ${f.proveedor ?? ''}`.toLowerCase().includes(t);
    });
  }, [porArea, busqueda, soloPendientes]);

  const maxMes = useMemo(() => Math.max(1, ...porMes.map(([, v]) => v.presupuestado)), [porMes]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Waves className="size-6" /> Flujo financiero
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Compromisos de pago por área y mes, importados de las BD de Excel (BD CONTA, BD TI…).
          </p>
        </div>
        <ImportarFlujoDialog onImportado={cargar} />
      </div>

      {/* Filtro por área */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={area === 'TODAS' ? 'default' : 'outline'} size="sm" onClick={() => setArea('TODAS')}>Todas</Button>
        {areas.map(a => (
          <Button key={a} variant={area === a ? 'default' : 'outline'} size="sm" onClick={() => setArea(a)}>{a}</Button>
        ))}
      </div>

      {filas.length === 0 && !cargando ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay nada cargado. Usa <strong>Importar / actualizar</strong> para traer una BD (BD CONTA, BD TI…) desde SharePoint.
        </CardContent></Card>
      ) : (
        <>
          {/* Cifras */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="size-3.5" /> Presupuestado</p>
              <p className="text-xl font-bold">{soles(total.presupuestado)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="size-3.5 text-green-600" /> Pagado</p>
              <p className="text-xl font-bold">{soles(total.pagado)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="size-3.5 text-amber-500" /> Pendiente</p>
              <p className="text-xl font-bold">{soles(total.pendiente)}</p>
            </CardContent></Card>
            <Card className={total.postergados > 0 ? 'border-amber-400 dark:border-amber-800' : ''}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="size-3.5 text-amber-500" /> Postergados</p>
              <p className="text-xl font-bold">{total.postergados}</p>
              <p className="text-[11px] text-muted-foreground">compromisos corridos de mes</p>
            </CardContent></Card>
          </div>

          {/* Por mes de vencimiento */}
          <Card>
            <CardHeader><CardTitle className="text-base">Por mes de vencimiento</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Mes</th>
                    <th className="text-right font-medium px-4 py-2">Presupuestado</th>
                    <th className="text-right font-medium px-4 py-2">Pagado</th>
                    <th className="text-right font-medium px-4 py-2">Pendiente</th>
                    <th className="text-right font-medium px-4 py-2">Postergados</th>
                    <th className="px-4 py-2 w-40"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {porMes.map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-4 py-1.5 font-medium">{mesLabel(k === 'sin-fecha' ? null : k)}</td>
                      <td className="text-right px-4 tabular-nums">{soles(v.presupuestado)}</td>
                      <td className="text-right px-4 tabular-nums text-green-700">{soles(v.pagado)}</td>
                      <td className="text-right px-4 tabular-nums text-amber-700">{soles(v.pendiente)}</td>
                      <td className="text-right px-4 tabular-nums">{v.postergados || ''}</td>
                      <td className="px-4 py-1.5">
                        <div className="h-2 rounded bg-muted overflow-hidden">
                          <div className="h-full bg-primary/70" style={{ width: `${Math.round((v.presupuestado / maxMes) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {porMes.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Detalle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                Compromisos ({detalle.length})
              </CardTitle>
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
                    <th className="text-right font-medium px-4 py-2">Presupuestado</th>
                    <th className="text-right font-medium px-4 py-2">Pagado</th>
                    <th className="text-left font-medium px-4 py-2">Estado</th>
                    <th className="text-right font-medium px-4 py-2">Posterg.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cargando ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Cargando…</td></tr>
                  ) : detalle.map(f => {
                    const b = badgeEstado(f.estado);
                    const mon = f.moneda === 'USD' ? 'US$ ' : '';
                    return (
                      <tr key={f.id}>
                        <td className="px-4 py-1.5"><Badge variant="outline">{f.area}</Badge></td>
                        <td className="px-4 py-1.5 text-xs">{f.cdc ?? '—'}</td>
                        <td className="px-4 py-1.5 max-w-[280px] truncate" title={f.concepto ?? ''}>
                          {f.concepto ?? '—'}
                          {f.proveedor && f.proveedor !== f.cdc ? <span className="text-xs text-muted-foreground"> · {f.proveedor}</span> : null}
                        </td>
                        <td className="px-4 py-1.5">{mesLabel(f.mesVencimiento)}</td>
                        <td className="text-right px-4 tabular-nums">{mon}{f.presupuestado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
