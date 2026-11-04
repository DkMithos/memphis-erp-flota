/**
 * Diálogo único para registrar pagos: una o muchas facturas/compromisos, con fecha, cuenta, referencia (OPE) y el
 * comprobante adjunto. Lo usan Facturas de proveedores y Cuentas por pagar. Cada ítem genera su transacción en Finanzas;
 * el mismo comprobante queda enlazado a todas (una transferencia que pagó varias facturas).
 */
import { useEffect, useMemo, useState } from 'react';
import { Paperclip, Banknote, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { useAuth } from '../../../auth/AuthProvider';
import { cargarCuentasBreve, registrarPagos, subirComprobantePago, validarComprobante, type CuentaBreve, type ItemPago, type ResultadoPagos } from '@/lib/finanzas/pagos';

const fmt = (n: number, m: string) => `${m === 'USD' ? 'US$' : 'S/'} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hoy = () => new Date().toISOString().slice(0, 10);

export function RegistrarPagoDialog({ items, abierto, onCerrar, onHecho }: { items: ItemPago[]; abierto: boolean; onCerrar: () => void; onHecho: (r: ResultadoPagos) => void }) {
  const { tenantId } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaBreve[]>([]);
  const [fecha, setFecha] = useState(hoy());
  const [cuentaId, setCuentaId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { if (abierto) { setFecha(hoy()); setReferencia(''); setArchivo(null); cargarCuentasBreve().then(setCuentas).catch(() => setCuentas([])); } }, [abierto]);

  const totales = useMemo(() => {
    const t: Record<string, number> = {};
    for (const i of items) t[i.moneda] = (t[i.moneda] ?? 0) + i.monto;
    return Object.entries(t);
  }, [items]);
  const monedas = useMemo(() => new Set(items.map(i => i.moneda)), [items]);
  const cuentasUtiles = useMemo(() => cuentas.filter(c => monedas.size !== 1 || c.moneda === [...monedas][0] || !c.moneda), [cuentas, monedas]);

  const elegirArchivo = (f: File | null) => {
    if (!f) { setArchivo(null); return; }
    const err = validarComprobante(f); if (err) { toast.error(err); return; }
    setArchivo(f);
  };

  const confirmar = async () => {
    if (!tenantId || items.length === 0) return;
    if (!fecha) { toast.error('Indique la fecha de pago'); return; }
    setGuardando(true);
    try {
      const path = archivo ? await subirComprobantePago(tenantId, archivo) : null;
      const r = await registrarPagos({ items, fecha, cuentaId: cuentaId || null, referencia: referencia.trim() || null, voucherPath: path });
      if (r.pagados > 0) toast.success(`${r.pagados} pago(s) registrado(s)${path ? ' con comprobante' : ''}`);
      if (r.omitidos.length) toast.warning(`${r.omitidos.length} no se registraron: ${r.omitidos.map(o => o.motivo).join('; ')}`, { duration: 9000 });
      onHecho(r);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  return (
    <Dialog open={abierto} onOpenChange={(o: boolean) => !o && !guardando && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Banknote className="size-5" /> Registrar pago{items.length > 1 ? `s (${items.length})` : ''}</DialogTitle>
          <DialogDescription>Cada factura o compromiso queda pagado en Finanzas con esta fecha y este comprobante. Si una transferencia pagó varias, selecciónelas juntas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-44 overflow-y-auto rounded-md border text-sm divide-y">
            {items.map((i, idx) => (
              <div key={`${i.compromisoId ?? i.comprobanteId ?? idx}`} className="px-2 py-1.5 flex justify-between gap-2">
                <span className="truncate"><span className="font-mono">{i.etiqueta}</span>{i.detalle && <span className="text-muted-foreground"> · {i.detalle}</span>}</span>
                <span className="tabular-nums whitespace-nowrap">{fmt(i.monto, i.moneda)}</span>
              </div>
            ))}
          </div>
          <p className="text-sm font-medium text-right">Total: {totales.map(([m, n]) => fmt(n, m)).join(' · ')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha de pago</Label><Input type="date" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)} className="mt-1" /></div>
            <div><Label>Cuenta desde la que se pagó</Label>
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
                <option value="">Sin especificar</option>
                {cuentasUtiles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Referencia (número de operación, OPE, cheque)</Label><Input className="mt-1" placeholder="Ej. 00123456" value={referencia} onChange={e => setReferencia(e.target.value)} /></div>
          <div>
            <Label>Comprobante (PDF o imagen, hasta 10 MB)</Label>
            <div className="mt-1 flex items-center gap-2">
              <label className="inline-flex">
                <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => { elegirArchivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-accent"><Paperclip className="size-4" /> {archivo ? 'Cambiar archivo' : 'Adjuntar comprobante'}</span>
              </label>
              {archivo && <span className="text-sm truncate max-w-[220px]" title={archivo.name}>{archivo.name}</span>}
              {archivo && <Button variant="ghost" size="icon" className="size-7" title="Quitar" onClick={() => setArchivo(null)}><X className="size-4" /></Button>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Opcional, pero es lo que después permite auditar el pago sin ir al banco.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={guardando || items.length === 0}>{guardando ? 'Registrando…' : items.length > 1 ? `Registrar ${items.length} pagos` : 'Registrar pago'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
