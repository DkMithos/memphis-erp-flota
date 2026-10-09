/**
 * VISTA DIRECTORIO — lo que el "Flujo GM Directorio.xlsx" le mostraba al
 * directorio (hojas KPI Mensual, RESUMEN y Flujo 2026), calculado en la base con
 * `flujo_caja` para la empresa y para cada área. Reemplaza al segundo archivo:
 * el Directorio ya no es una copia del Flujo GM, es esta vista del ERP (sprint 4).
 *
 *   Ingresos · Egresos · Flujo neto · Flujo acumulado (saldo) · Liquidez operativa
 *   (ingresos / egresos del mes), real + previsto por mes.
 */
import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Presentation } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { supabase } from '../../../lib/supabase/client';
import { exportToExcelMultiHoja } from '@/lib/shared/export-utils';

interface FilaMes { mes: string; ingresos: number; egresos: number; neto: number; saldo: number; liquidez: number | null; ingresosReal: number; egresosReal: number }
const AREAS: { clave: string | null; label: string }[] = [
  { clave: null, label: 'Empresa' }, { clave: 'PROYECTOS', label: 'Proyectos' }, { clave: 'ADMINISTRACION', label: 'Oficina central' },
  { clave: 'CONTABILIDAD', label: 'Contabilidad' }, { clave: 'TI', label: 'TI' },
];
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesLabel = (iso: string) => `${MES[Number(iso.slice(5, 7)) - 1]}-${iso.slice(2, 4)}`;
const soles = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`;
const isoMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

async function flujo(area: string | null, desde: string, hasta: string): Promise<FilaMes[]> {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase as any).rpc('flujo_caja', { p_desde: desde, p_hasta: hasta, p_area: area, p_proyecto: null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => {
    const ingresos = Number(r.ingresos_real ?? 0) + Number(r.ingresos_previsto ?? 0);
    const egresos = Number(r.egresos_real ?? 0) + Number(r.egresos_previsto ?? 0);
    return { mes: String(r.mes), ingresos, egresos, neto: Number(r.neto ?? 0), saldo: Number(r.saldo ?? 0), liquidez: egresos > 0 ? ingresos / egresos : null,
      ingresosReal: Number(r.ingresos_real ?? 0), egresosReal: Number(r.egresos_real ?? 0) };
  });
}

export function DirectorioKPI() {
  const [filas, setFilas] = useState<FilaMes[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const rango = useMemo(() => {
    const hoy = new Date();
    return { desde: isoMes(new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1)), hasta: isoMes(new Date(hoy.getFullYear(), hoy.getMonth() + 5, 1)) };
  }, []);

  useEffect(() => {
    setCargando(true);
    flujo(null, rango.desde, rango.hasta).then(setFilas).catch(e => toast.error((e as Error).message)).finally(() => setCargando(false));
  }, [rango]);

  const tot = useMemo(() => filas.reduce((s, f) => ({ i: s.i + f.ingresos, e: s.e + f.egresos, n: s.n + f.neto }), { i: 0, e: 0, n: 0 }), [filas]);
  const mesActual = new Date().toISOString().slice(0, 7);

  const exportar = async () => {
    setExportando(true);
    try {
      const hojas = [];
      for (const a of AREAS) {
        const f = a.clave === null ? filas : await flujo(a.clave, rango.desde, rango.hasta);
        hojas.push({
          nombre: a.label,
          data: f.map(x => ({ mes: mesLabel(x.mes), ingresos: Math.round(x.ingresos), egresos: Math.round(x.egresos), neto: Math.round(x.neto), acumulado: Math.round(x.saldo),
            liquidez: x.liquidez == null ? '' : Number(x.liquidez.toFixed(2)), ingresos_real: Math.round(x.ingresosReal), egresos_real: Math.round(x.egresosReal) })),
          headersMap: { mes: 'Mes', ingresos: 'Ingresos', egresos: 'Egresos', neto: 'Flujo neto', acumulado: 'Flujo acumulado', liquidez: 'Liquidez operativa', ingresos_real: 'Ingresos reales', egresos_real: 'Egresos reales' },
        });
      }
      await exportToExcelMultiHoja(`Directorio - flujo ${mesActual}`, hojas);
    } catch (e) { toast.error((e as Error).message); }
    finally { setExportando(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Presentation className="size-4" /> Vista directorio · KPI mensual</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Lo que llevaba el "Flujo GM Directorio": ingresos, egresos, flujo neto, acumulado y liquidez operativa (ingresos ÷ egresos) por mes,
            con lo real y lo previsto. Sale de los compromisos y pagos del ERP; ya no hace falta copiar el archivo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={exportando || cargando}>
          {exportando ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Exportar para el directorio
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {cargando ? <p className="p-4 text-sm text-muted-foreground">Calculando…</p> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Mes</th><th className="text-right px-3 py-2">Ingresos</th><th className="text-right px-3 py-2">Egresos</th>
                <th className="text-right px-3 py-2">Flujo neto</th><th className="text-right px-3 py-2">Acumulado</th><th className="text-right px-3 py-2">Liquidez</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map(f => (
                <tr key={f.mes} className={f.mes.slice(0, 7) === mesActual ? 'bg-primary/5 font-medium' : ''}>
                  <td className="px-3 py-1.5 whitespace-nowrap">{mesLabel(f.mes)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-blue-700 dark:text-blue-400">{soles(f.ingresos)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-red-700 dark:text-red-400">{soles(f.egresos)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${f.neto < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>{soles(f.neto)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${f.saldo < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>{soles(f.saldo)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{f.liquidez == null ? '—' : f.liquidez.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-muted/40 border-t">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{soles(tot.i)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{soles(tot.e)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{soles(tot.n)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{filas.length ? soles(filas[filas.length - 1].saldo) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tot.e > 0 ? (tot.i / tot.e).toFixed(2) : '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
