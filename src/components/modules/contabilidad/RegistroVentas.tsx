/**
 * Memphis ERP — Registro de Ventas (PLE 3.1)
 * Lista de comprobantes emitidos por período con exportación PLE SUNAT.
 */
import { useState, useMemo } from 'react';
import { FileText, Download, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { usePeriodosStore } from '../../../lib/contabilidad/periodos-store';
import { useComprobantesStore } from '../../../lib/contabilidad/comprobantes-store';
import { generarLineaPLE31, periodoToString } from '../../../lib/contabilidad/fiscal-peru';

interface Props { onNavigate: (route: string) => void; }

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n);
}

export function RegistroVentas({ onNavigate }: Props) {
  const { periodos, periodoActual } = usePeriodosStore();
  const { comprobantes } = useComprobantesStore();
  const [periodo, setPeriodo] = useState(
    periodoActual ? periodoToString(periodoActual.anio, periodoActual.mes) : ''
  );

  const ventasPeriodo = useMemo(() => {
    if (!periodo) return [];
    return comprobantes.filter(c => {
      if (c.direccion !== 'emitido' || c.estado === 'anulado') return false;
      const p = periodoToString(
        new Date(c.fechaEmision).getFullYear(),
        new Date(c.fechaEmision).getMonth() + 1,
      );
      return p === periodo;
    });
  }, [comprobantes, periodo]);

  const totales = useMemo(() => ({
    baseGravada: ventasPeriodo.reduce((s,c) => s + c.opGravada, 0),
    igv: ventasPeriodo.reduce((s,c) => s + c.igv, 0),
    total: ventasPeriodo.reduce((s,c) => s + c.total, 0),
  }), [ventasPeriodo]);

  function exportarPLE() {
    const lineas = ventasPeriodo.map((c, i) => generarLineaPLE31({
      periodo,
      correlativo: String(i + 1),
      fechaEmision: c.fechaEmision,
      tipoComprobante: c.tipo,
      serie: c.serie,
      numero: c.numero,
      tipoDocIdentidadCliente: '6',
      docIdentidadCliente: c.rucReceptor ?? '',
      razonSocialCliente: c.razonSocialReceptor ?? '',
      baseImponibleGravada: c.opGravada,
      igv: c.igv,
      baseImponibleExonerada: c.opExonerada,
      baseImponibleInafecta: c.opInafecta,
      exportacion: c.opExportacion,
      importeTotal: c.total,
      moneda: c.moneda,
      tipoCambio: c.tipoCambio,
      estado: c.contabilizado ? '1' : '0',
    }));
    const blob = new Blob([lineas.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LE${periodo}00030100001100_RA.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />Registro de Ventas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">PLE 3.1 — SUNAT</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="text-sm w-44"><SelectValue placeholder="Seleccionar período" /></SelectTrigger>
            <SelectContent>
              {periodos.map(p => (
                <SelectItem key={p.id} value={periodoToString(p.anio, p.mes)}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportarPLE} disabled={ventasPeriodo.length === 0} className="gap-1.5 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
            <Download className="size-3.5" /> Exportar PLE
          </Button>
        </div>
      </div>

      {/* Resumen IGV */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Base Imponible', value: totales.baseGravada, color: 'text-blue-600' },
          { label: 'IGV Débito Fiscal', value: totales.igv, color: 'text-green-600' },
          { label: 'Total Ventas', value: totales.total, color: 'text-foreground' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>S/ {fmt(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {!periodo ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Selecciona un período para ver el registro.</div>
          ) : ventasPeriodo.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <FileText className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin comprobantes de venta en este período.</p>
              <Button size="sm" variant="outline" onClick={() => onNavigate('/contabilidad/comprobantes/nuevo')}>
                Registrar comprobante
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-12 gap-1 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-1">#</div>
                <div className="col-span-2">Fecha</div>
                <div className="col-span-2">Comprobante</div>
                <div className="col-span-3">Cliente</div>
                <div className="col-span-1 text-right">Base Grav.</div>
                <div className="col-span-1 text-right">IGV</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {ventasPeriodo.map((c, i) => (
                <div key={c.id} className="grid grid-cols-12 gap-1 px-4 py-2.5 border-b border-border/40 hover:bg-muted/20 text-sm items-center">
                  <div className="col-span-2 md:col-span-1 text-xs text-muted-foreground">{i+1}</div>
                  <div className="col-span-4 md:col-span-2 text-xs">{new Date(c.fechaEmision).toLocaleDateString('es-PE')}</div>
                  <div className="col-span-6 md:col-span-2 font-mono text-xs">{c.numeroCompleto}</div>
                  <div className="col-span-12 md:col-span-3 truncate text-xs">
                    <span className="font-medium">{c.razonSocialReceptor ?? '—'}</span>
                    {c.rucReceptor && <span className="text-muted-foreground ml-1 font-mono text-[10px]">{c.rucReceptor}</span>}
                  </div>
                  <div className="col-span-4 md:col-span-1 text-right font-mono text-xs">{fmt(c.opGravada)}</div>
                  <div className="col-span-4 md:col-span-1 text-right font-mono text-xs text-green-600">{fmt(c.igv)}</div>
                  <div className="col-span-4 md:col-span-2 text-right font-mono text-xs font-semibold">{fmt(c.total)}</div>
                </div>
              ))}
              <div className="grid grid-cols-12 gap-1 px-4 py-3 bg-muted/30 font-bold text-sm">
                <div className="col-span-8 text-right text-xs text-muted-foreground pr-2">TOTALES</div>
                <div className="col-span-1 text-right font-mono text-xs">{fmt(totales.baseGravada)}</div>
                <div className="col-span-1 text-right font-mono text-xs text-green-600">{fmt(totales.igv)}</div>
                <div className="col-span-2 text-right font-mono text-xs">{fmt(totales.total)}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
