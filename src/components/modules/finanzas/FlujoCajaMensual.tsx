/**
 * FLUJO DE CAJA POR MES — la lectura correcta del flujo, calculada en la base
 * (flujo_caja): ingresos − egresos = neto, saldo acumulado desde el saldo inicial
 * que fija Finanzas, y en cada columna lo REAL (ya pagado o cobrado, en el mes
 * en que ocurrió) separado de lo PREVISTO (comprometido o proyectado, en el mes
 * en que vence). Sirve para la empresa, un área o un proyecto.
 */

import { useEffect, useMemo, useState } from 'react';
import { Wallet, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { supabase } from '../../../lib/supabase/client';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { toast } from 'sonner';

interface FilaMes {
  mes: string;
  ingresosReal: number; ingresosPrevisto: number;
  egresosReal: number; egresosPrevisto: number;
  netoReal: number; netoPrevisto: number; neto: number; saldo: number;
  egresosVencidos: number; compromisos: number; pendientes: number;
}

interface Props {
  /** Área (CONTABILIDAD, PROYECTOS…) o null = toda la empresa. */
  area?: string | null;
  /** Proyecto (uuid) = caja del proyecto (arranca en 0). */
  proyectoId?: string | null;
  /** Meses hacia atrás y hacia adelante desde hoy. */
  atras?: number;
  adelante?: number;
  compacto?: boolean;
}

const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const celda = (n: number) => (Math.abs(n) < 0.5 ? '—' : soles(n));
const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (iso: string) => `${MES_ABR[Number(iso.slice(5, 7)) - 1]}-${iso.slice(2, 4)}`;
const isoMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export function FlujoCajaMensual({ area = null, proyectoId = null, atras = 3, adelante = 6, compacto = false }: Props) {
  const { can } = usePermissions();
  const [filas, setFilas] = useState<FilaMes[]>([]);
  const [cargando, setCargando] = useState(true);
  const [desplaz, setDesplaz] = useState(0);
  const [saldoIni, setSaldoIni] = useState<{ monto: number; fecha: string } | null>(null);
  const [editSaldo, setEditSaldo] = useState(false);
  const [saldoForm, setSaldoForm] = useState({ monto: '', fecha: '' });

  const rango = useMemo(() => {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - atras + desplaz, 1);
    const h = new Date(hoy.getFullYear(), hoy.getMonth() + adelante + desplaz, 1);
    return { desde: isoMes(d), hasta: isoMes(h) };
  }, [atras, adelante, desplaz]);

  const cargar = async () => {
    setCargando(true);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const { data, error } = await (supabase as any).rpc('flujo_caja', {
      p_desde: rango.desde, p_hasta: rango.hasta, p_area: area, p_proyecto: proyectoId,
    });
    if (error) { toast.error('No se pudo calcular el flujo: ' + error.message); setCargando(false); return; }
    setFilas(((data ?? []) as Record<string, unknown>[]).map(r => ({
      mes: r.mes as string,
      ingresosReal: Number(r.ingresos_real ?? 0), ingresosPrevisto: Number(r.ingresos_previsto ?? 0),
      egresosReal: Number(r.egresos_real ?? 0), egresosPrevisto: Number(r.egresos_previsto ?? 0),
      netoReal: Number(r.neto_real ?? 0), netoPrevisto: Number(r.neto_previsto ?? 0),
      neto: Number(r.neto ?? 0), saldo: Number(r.saldo ?? 0),
      egresosVencidos: Number(r.egresos_vencidos ?? 0), compromisos: Number(r.compromisos ?? 0), pendientes: Number(r.pendientes ?? 0),
    })));
    setCargando(false);
  };
  useEffect(() => { void cargar(); }, [rango.desde, rango.hasta, area, proyectoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saldo inicial de caja (solo aplica a la vista de empresa).
  useEffect(() => {
    if (area || proyectoId) return;
    supabase.from('parametros_financieros').select('clave, valor').in('clave', ['saldo_caja_inicial', 'saldo_caja_fecha'])
      .then(({ data }) => {
        const m = new Map((data ?? []).map((r: { clave: string; valor: number }) => [r.clave, Number(r.valor)]));
        const f = String(m.get('saldo_caja_fecha') ?? 20260101);
        setSaldoIni({ monto: m.get('saldo_caja_inicial') ?? 0, fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` });
      });
  }, [area, proyectoId]);

  const guardarSaldo = async () => {
    const monto = Number(saldoForm.monto.replace(/,/g, ''));
    if (!Number.isFinite(monto) || !saldoForm.fecha) { toast.error('Monto y fecha, por favor'); return; }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const { error } = await (supabase as any).rpc('fijar_saldo_caja', { p_monto: monto, p_fecha: saldoForm.fecha });
    if (error) { toast.error('No se pudo fijar el saldo: ' + error.message); return; }
    setSaldoIni({ monto, fecha: saldoForm.fecha });
    setEditSaldo(false);
    toast.success('Saldo inicial de caja fijado');
    void cargar();
  };

  const tot = useMemo(() => filas.reduce((s, f) => ({
    ir: s.ir + f.ingresosReal, ip: s.ip + f.ingresosPrevisto, er: s.er + f.egresosReal, ep: s.ep + f.egresosPrevisto,
    venc: s.venc + f.egresosVencidos,
  }), { ir: 0, ip: 0, er: 0, ep: 0, venc: 0 }), [filas]);
  const saldoFinal = filas.length ? filas[filas.length - 1].saldo : 0;
  const mesActual = new Date().toISOString().slice(0, 7);

  const Fila = ({ titulo, valor, clase = '', sangria = false, fuerte = false }: { titulo: string; valor: (f: FilaMes) => number; clase?: string; sangria?: boolean; fuerte?: boolean }) => (
    <tr className={fuerte ? 'font-semibold bg-muted/40 border-t' : ''}>
      <td className={`px-3 py-1.5 sticky left-0 bg-card z-10 whitespace-nowrap ${sangria ? 'pl-7 text-muted-foreground' : ''} ${fuerte ? 'bg-muted/40' : ''}`}>{titulo}</td>
      {filas.map(f => {
        const v = valor(f);
        return (
          <td key={f.mes} className={`text-right px-3 py-1.5 tabular-nums whitespace-nowrap ${clase} ${f.mes === mesActual ? 'bg-primary/5' : ''} ${fuerte && v < -0.5 ? 'text-red-700' : ''}`}>
            {celda(v)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="size-4" /> Flujo de caja por mes</CardTitle>
          {!compacto && (
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos − egresos = neto. <b>Real</b> = ya pagado o cobrado, en el mes en que ocurrió; <b>previsto</b> = comprometido
              (OC, factura, valorización) o proyectado, en el mes en que vence. Soles al TC de cada compromiso.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!area && !proyectoId && saldoIni && (
            editSaldo ? (
              <div className="flex items-center gap-1">
                <Input className="h-8 w-36 text-xs" placeholder="Saldo S/" value={saldoForm.monto} onChange={e => setSaldoForm(s => ({ ...s, monto: e.target.value }))} />
                <Input className="h-8 w-36 text-xs" type="date" value={saldoForm.fecha} onChange={e => setSaldoForm(s => ({ ...s, fecha: e.target.value }))} />
                <Button size="sm" className="h-8" onClick={guardarSaldo}>Fijar</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditSaldo(false)}>Cancelar</Button>
              </div>
            ) : (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:no-underline"
                disabled={!can('finanzas', 'editar')}
                onClick={() => { setSaldoForm({ monto: String(saldoIni.monto), fecha: saldoIni.fecha }); setEditSaldo(true); }}
                title={can('finanzas', 'editar') ? 'Fijar el saldo de caja inicial' : 'Lo fija Finanzas'}
              >
                Saldo inicial {soles(saldoIni.monto)} al {saldoIni.fecha}{saldoIni.monto === 0 ? ' · sin fijar' : ''}
              </button>
            )
          )}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setDesplaz(d => d - 3)}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setDesplaz(0)} disabled={desplaz === 0}>Hoy</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setDesplaz(d => d + 3)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {cargando && filas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Calculando…</p>
        ) : (
          <table className="text-sm border-collapse min-w-full">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left font-medium px-3 py-2 sticky left-0 bg-card z-10 min-w-[190px]"></th>
                {filas.map(f => (
                  <th key={f.mes} className={`text-right font-medium px-3 py-2 whitespace-nowrap ${f.mes === mesActual ? 'text-primary' : ''}`}>
                    {mesLabel(f.mes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <Fila titulo="Ingresos" valor={f => f.ingresosReal + f.ingresosPrevisto} clase="text-blue-700 font-medium" />
              <Fila titulo="real (cobrado)" valor={f => f.ingresosReal} sangria clase="text-blue-700" />
              <Fila titulo="previsto (por cobrar)" valor={f => f.ingresosPrevisto} sangria clase="text-blue-500" />
              <Fila titulo="Egresos" valor={f => f.egresosReal + f.egresosPrevisto} clase="text-red-700 font-medium" />
              <Fila titulo="real (pagado)" valor={f => f.egresosReal} sangria clase="text-red-700" />
              <Fila titulo="previsto (por pagar)" valor={f => f.egresosPrevisto} sangria clase="text-red-500" />
              <Fila titulo="Neto del mes" valor={f => f.neto} fuerte />
              <Fila titulo="Saldo acumulado" valor={f => f.saldo} fuerte />
            </tbody>
          </table>
        )}
      </CardContent>
      {!compacto && filas.length > 0 && (
        <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
          <span>Ingresos {soles(tot.ir + tot.ip)} (real {soles(tot.ir)})</span>
          <span>Egresos {soles(tot.er + tot.ep)} (real {soles(tot.er)})</span>
          <span className={saldoFinal < 0 ? 'text-red-700 font-medium' : 'font-medium'}>Saldo al final del periodo {soles(saldoFinal)}</span>
          {tot.venc > 0 && (
            <span className="text-amber-700 flex items-center gap-1"><AlertTriangle className="size-3" /> vencido sin pagar {soles(tot.venc)}</span>
          )}
        </div>
      )}
    </Card>
  );
}
