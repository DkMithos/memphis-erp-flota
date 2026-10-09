/**
 * RECONCILIACIÓN EXCEL vs ERP del flujo financiero (sprint 4).
 *
 * Cruza lo que vino de las bases del Excel (fuente = 'excel') con lo que nace en
 * el ERP (OC aprobadas, facturas del portal/SIRE, compromisos manuales) y explica
 * cada fila que no cuadra: OC sin registrar, factura sin conformidad, mes
 * distinto, proyección sin documento… La lógica vive en `flujo_reconciliar`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Scale, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { PageNav } from '../../shared/PageNav';
import { supabase } from '../../../lib/supabase/client';
import { usePagination } from '@/lib/shared/usePagination';
import { usePersistedState } from '@/lib/shared/usePersistedState';
import { exportToExcelMultiHoja } from '@/lib/shared/export-utils';

interface Fila {
  lado: 'ambos' | 'solo_excel' | 'solo_erp';
  excel_id: string | null; erp_id: string | null;
  area: string; mes_excel: string | null; mes_erp: string | null;
  cdc: string | null; concepto: string | null; proveedor: string | null; referencia_doc: string | null;
  moneda: string; monto_excel: number | null; monto_erp: number | null;
  estado_excel: string | null; estado_erp: string | null;
  diferencia: number | null; como: string | null; causa: string;
}

const AREAS = ['CONTABILIDAD', 'TI', 'ADMINISTRACION', 'PROYECTOS'];
const ETIQUETA: Record<string, string> = { CONTABILIDAD: 'Contabilidad', TI: 'TI', ADMINISTRACION: 'Administración', PROYECTOS: 'Proyectos' };
const LADO: Record<Fila['lado'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ambos: { label: 'En ambos', variant: 'secondary' },
  solo_excel: { label: 'Solo Excel', variant: 'destructive' },
  solo_erp: { label: 'Solo ERP', variant: 'outline' },
};
type Filtro = 'todas' | 'diferencias' | 'solo_excel' | 'solo_erp' | 'coinciden';

const fmt = (n: number | null | undefined, moneda = 'PEN') =>
  n == null ? '—' : `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mesCorto = (iso: string | null) => (iso ? iso.slice(0, 7) : '—');
const mesActual = () => new Date().toISOString().slice(0, 7);

export function ReconciliacionFlujo() {
  const [area, setArea] = usePersistedState<string>('reconciliacion.area', 'TODAS');
  const [mes, setMes] = usePersistedState<string>('reconciliacion.mes', mesActual());
  const [filtro, setFiltro] = useState<Filtro>('diferencias');
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const { data, error } = await (supabase as any).rpc('flujo_reconciliar', { p_area: area === 'TODAS' ? null : area, p_mes: mes ? `${mes}-01` : null });
      if (error) throw new Error(error.message);
      setFilas((data ?? []) as Fila[]);
    } catch (e) { toast.error((e as Error).message); setFilas([]); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [area, mes]);

  const esDiferencia = (f: Fila) => f.causa !== 'Coincide';
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter(f => {
      if (filtro === 'diferencias' && !esDiferencia(f)) return false;
      if (filtro === 'coinciden' && esDiferencia(f)) return false;
      if (filtro === 'solo_excel' && f.lado !== 'solo_excel') return false;
      if (filtro === 'solo_erp' && f.lado !== 'solo_erp') return false;
      if (q && ![f.concepto, f.proveedor, f.referencia_doc, f.cdc, f.causa].some(x => (x ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [filas, filtro, busqueda]);
  const pag = usePagination(visibles, 25);
  useEffect(() => { pag.reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtro, busqueda, area, mes]);

  // Totales del mes elegido (en soles y dólares por separado; no se mezclan monedas)
  const tot = useMemo(() => {
    const t = { excelPEN: 0, excelUSD: 0, erpPEN: 0, erpUSD: 0, coinciden: 0, soloExcel: 0, soloErp: 0, distintos: 0 };
    for (const f of filas) {
      const esMesExcel = !mes || f.mes_excel?.slice(0, 7) === mes;
      const esMesErp = !mes || f.mes_erp?.slice(0, 7) === mes;
      if (f.monto_excel != null && esMesExcel) { if (f.moneda === 'USD') t.excelUSD += Number(f.monto_excel); else t.excelPEN += Number(f.monto_excel); }
      if (f.monto_erp != null && esMesErp) { if (f.moneda === 'USD') t.erpUSD += Number(f.monto_erp); else t.erpPEN += Number(f.monto_erp); }
      if (f.lado === 'solo_excel') t.soloExcel++;
      else if (f.lado === 'solo_erp') t.soloErp++;
      else if (esDiferencia(f)) t.distintos++;
      else t.coinciden++;
    }
    return t;
  }, [filas, mes]);

  const exportar = () => exportToExcelMultiHoja(`Reconciliacion Excel vs ERP ${area === 'TODAS' ? 'todas' : ETIQUETA[area] ?? area} ${mes || 'todos'}`, [{
    nombre: 'Reconciliación',
    data: visibles.map(f => ({
      lado: LADO[f.lado].label, area: ETIQUETA[f.area] ?? f.area, mes_excel: mesCorto(f.mes_excel), mes_erp: mesCorto(f.mes_erp), cdc: f.cdc ?? '', concepto: f.concepto ?? '',
      proveedor: f.proveedor ?? '', referencia: f.referencia_doc ?? '', moneda: f.moneda, monto_excel: f.monto_excel ?? '', monto_erp: f.monto_erp ?? '',
      diferencia: f.diferencia ?? '', estado_excel: f.estado_excel ?? '', estado_erp: f.estado_erp ?? '', cruce: f.como ?? '', causa: f.causa,
    })),
    headersMap: {
      lado: 'Dónde está', area: 'Área', mes_excel: 'Mes Excel', mes_erp: 'Mes ERP', cdc: 'CDC', concepto: 'Concepto', proveedor: 'Proveedor', referencia: 'Referencia',
      moneda: 'Moneda', monto_excel: 'Monto Excel', monto_erp: 'Monto ERP', diferencia: 'Diferencia', estado_excel: 'Estado Excel', estado_erp: 'Estado ERP', cruce: 'Cómo cruzó', causa: 'Causa',
    },
  }]);

  const chip = (k: Filtro, label: string, n?: number) => (
    <Button key={k} size="sm" variant={filtro === k ? 'default' : 'outline'} onClick={() => setFiltro(k)}>{label}{n != null ? ` (${n})` : ''}</Button>
  );

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Scale className="size-6" /> Reconciliación Excel vs ERP</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Compara, por área y mes, los compromisos que vienen de las bases del Excel con los que nacen en el ERP (órdenes aprobadas,
            facturas del portal y del SIRE, compromisos manuales). Cada fila que no cuadra trae su causa. El cruce es por OC, por
            referencia (n.º de OC o factura) o por proveedor e importe; el mes no se usa para cruzar, así el desfase aparece como "mes distinto".
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cargar} disabled={cargando}><RefreshCw className={`size-4 ${cargando ? 'animate-spin' : ''}`} /> Recalcular</Button>
          <Button variant="outline" onClick={exportar} disabled={visibles.length === 0}><FileSpreadsheet className="size-4" /> Exportar</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Button variant={area === 'TODAS' ? 'default' : 'outline'} size="sm" onClick={() => setArea('TODAS')}>Todas las áreas</Button>
        {AREAS.map(a => <Button key={a} variant={area === a ? 'default' : 'outline'} size="sm" onClick={() => setArea(a)}>{ETIQUETA[a]}</Button>)}
        <span className="ml-2 text-xs text-muted-foreground">Mes:</span>
        <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={e => setMes(e.target.value)} />
        {mes && <Button size="sm" variant="ghost" onClick={() => setMes('')}>Todos los meses</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Excel ({mes || 'todos'})</p><p className="text-lg font-semibold">{fmt(tot.excelPEN)}</p><p className="text-sm">{fmt(tot.excelUSD, 'USD')}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">ERP ({mes || 'todos'})</p><p className="text-lg font-semibold">{fmt(tot.erpPEN)}</p><p className="text-sm">{fmt(tot.erpUSD, 'USD')}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Coinciden</p><p className="text-2xl font-semibold text-green-600">{tot.coinciden}</p><p className="text-xs text-muted-foreground">{tot.distintos} con monto o mes distinto</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Solo en el Excel</p><p className="text-2xl font-semibold text-red-600">{tot.soloExcel}</p><p className="text-xs text-muted-foreground">sin OC ni factura en el ERP, o proyección</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Solo en el ERP</p><p className="text-2xl font-semibold text-amber-600">{tot.soloErp}</p><p className="text-xs text-muted-foreground">OC o facturas que el Excel no tiene</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {chip('diferencias', 'Diferencias', tot.soloExcel + tot.soloErp + tot.distintos)}
        {chip('solo_excel', 'Solo Excel', tot.soloExcel)}
        {chip('solo_erp', 'Solo ERP', tot.soloErp)}
        {chip('coinciden', 'Coinciden', tot.coinciden)}
        {chip('todas', 'Todas', filas.length)}
        <Input className="h-9 w-64 ml-auto" placeholder="Buscar concepto, proveedor, referencia…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Dónde</th><th className="text-left px-3 py-2">Área</th><th className="text-left px-3 py-2">Mes Excel / ERP</th>
                <th className="text-left px-3 py-2">Concepto</th><th className="text-left px-3 py-2">Proveedor</th><th className="text-left px-3 py-2">Referencia</th>
                <th className="text-right px-3 py-2">Excel</th><th className="text-right px-3 py-2">ERP</th><th className="text-left px-3 py-2">Causa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cargando && filas.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Cruzando…</td></tr>}
              {!cargando && visibles.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nada que mostrar con este filtro.</td></tr>}
              {pag.paged.map((f, i) => (
                <tr key={`${f.excel_id ?? ''}-${f.erp_id ?? ''}-${i}`} className={f.causa === 'Coincide' ? '' : f.lado === 'solo_excel' ? 'bg-red-50/40 dark:bg-red-950/10' : f.lado === 'solo_erp' ? 'bg-amber-50/40 dark:bg-amber-950/10' : 'bg-blue-50/30 dark:bg-blue-950/10'}>
                  <td className="px-3 py-1.5"><Badge variant={LADO[f.lado].variant}>{LADO[f.lado].label}</Badge></td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{ETIQUETA[f.area] ?? f.area}<div className="text-xs text-muted-foreground">{f.cdc}</div></td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">{mesCorto(f.mes_excel)} / {mesCorto(f.mes_erp)}</td>
                  <td className="px-3 py-1.5 max-w-[260px] truncate" title={f.concepto ?? ''}>{f.concepto}</td>
                  <td className="px-3 py-1.5 max-w-[200px] truncate" title={f.proveedor ?? ''}>{f.proveedor}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{f.referencia_doc}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{fmt(f.monto_excel, f.moneda)}<div className="text-xs text-muted-foreground">{f.estado_excel}</div></td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{fmt(f.monto_erp, f.moneda)}<div className="text-xs text-muted-foreground">{f.estado_erp}</div></td>
                  <td className="px-3 py-1.5 text-xs max-w-[320px]">{f.causa}{f.como ? <span className="text-muted-foreground"> · cruzó por {f.como}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {pag.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Mostrando {pag.paged.length} de {visibles.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>
            <span className="text-xs">Página {pag.page} de {pag.totalPages}</span>
            <Button size="sm" variant="outline" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
