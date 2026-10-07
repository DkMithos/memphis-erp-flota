/**
 * APROBAR UNA ORDEN EN UN PASO.
 *
 * Lo que William (Gerencia) pidió: firmar sin abrir cada orden ni recorrer el
 * detalle. El diálogo muestra lo mínimo para decidir (proveedor, total, qué
 * firmas ya tiene, si alguna partida se sobregira) y un solo botón. La firma
 * la registra `firmarEtapa`, igual que desde el detalle: misma regla, mismo
 * rastro en `orden_aprobaciones`.
 */
import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog';
import { supabase } from '../../../lib/supabase/client';
import { useOrdenesStore, type Orden } from '../../../lib/compras/ordenes-store';
import { useFlujoAprobacion } from '../../../lib/compras/flujo-aprobacion-store';
import { ETIQUETA_ETAPA, type EtapaAprobacion } from '../../../lib/compras/approval-flow';
import { formatearMonto } from '../../../lib/compras/ordenes-config';

const recortar = (t: string, n: number) => (t.length > n ? t.slice(0, n).trimEnd() + '…' : t);

interface Sobregiro { item: string; descripcion: string; exceso: number; sobregira: boolean }

interface Props {
  orden: Orden | null;
  /** Etapa que esta persona firma en esta orden (la que está en turno). */
  etapa: EtapaAprobacion | null;
  /** Etapas ya firmadas, para decir "ya firmaron Compras y Operaciones". */
  firmadas?: string[];
  onClose: () => void;
  onFirmado?: () => void;
}

export function AprobarOrdenDialog({ orden, etapa, firmadas = [], onClose, onFirmado }: Props) {
  const { firmarEtapa } = useOrdenesStore();
  const { config } = useFlujoAprobacion();
  const [sobregiradas, setSobregiradas] = useState<Sobregiro[]>([]);
  const [cargando, setCargando] = useState(false);
  const [firmando, setFirmando] = useState(false);

  useEffect(() => {
    if (!orden?._dbId) { setSobregiradas([]); return; }
    let vivo = true;
    setCargando(true);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (supabase as any).rpc('oc_partidas_sobregiro', { p_oc: orden._dbId })
      .then(({ data }: { data: Record<string, unknown>[] | null }) => {
        if (!vivo) return;
        setSobregiradas((data ?? [])
          .filter(r => Boolean(r.sobregira))
          .map(r => ({ item: String(r.item ?? ''), descripcion: String(r.descripcion ?? ''), exceso: Number(r.exceso ?? 0), sobregira: true })));
      })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [orden?._dbId]);

  if (!orden || !etapa) return null;

  const confirmar = async () => {
    setFirmando(true);
    try {
      const res = await firmarEtapa(orden.id, etapa, config);
      if (!res.exito) { toast.error(res.errores?.[0] ?? 'No se pudo firmar la orden'); return; }
      const faltan = res.errores ?? [];
      if (faltan.length === 0) toast.success(`${orden.id} aprobada: firmas completas`);
      else toast.success(`Firmaste ${orden.id} como ${ETIQUETA_ETAPA[etapa]}`, { description: `Falta la firma de ${faltan.map(e => ETIQUETA_ETAPA[e as EtapaAprobacion] ?? e).join(' y ')}.` });
      if (res.sinRubrica) toast.warning('No tienes rúbrica registrada: la aprobación consta igual, pero en el PDF la línea saldrá en blanco. Súbela en Perfil.', { duration: 8000 });
      onFirmado?.();
      onClose();
    } finally {
      setFirmando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Aprobar {orden.id}</DialogTitle>
          <DialogDescription>Firmas como <b>{ETIQUETA_ETAPA[etapa]}</b>.{firmadas.length > 0 && <> Ya firmaron: {firmadas.map(f => ETIQUETA_ETAPA[f as EtapaAprobacion] ?? f).join(' y ')}.</>}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-y-1">
            <span className="text-muted-foreground">Proveedor</span><span className="font-medium">{orden.proveedorNombre}</span>
            <span className="text-muted-foreground">Total</span><span className="font-semibold">{formatearMonto(orden.total, orden.moneda)}</span>
            <span className="text-muted-foreground">Ítems</span><span>{orden.items.length} · {recortar(orden.items.slice(0, 2).map(i => i.descripcion).join(' · '), 160)}{orden.items.length > 2 ? ' …' : ''}</span>
            {orden.observaciones && (<><span className="text-muted-foreground">Observaciones</span><span className="text-xs">{recortar(orden.observaciones, 280)}</span></>)}
          </div>
          {cargando ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Revisando el presupuesto…</p>
          ) : sobregiradas.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs">
              <p className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1"><AlertTriangle className="size-3.5" /> {sobregiradas.length === 1 ? 'Una partida se sobregira' : `${sobregiradas.length} partidas se sobregiran`} con esta orden</p>
              <ul className="mt-1 space-y-0.5">
                {sobregiradas.slice(0, 4).map(p => <li key={p.item}>{p.item} {p.descripcion}: exceso S/ {p.exceso.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</li>)}
              </ul>
              <p className="mt-1 text-muted-foreground">Puedes aprobar igual; queda a tu criterio.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Dentro del presupuesto de sus partidas.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={firmando}>Cancelar</Button>
          <Button variant={sobregiradas.length > 0 ? 'destructive' : 'default'} onClick={confirmar} disabled={firmando || cargando}>
            {firmando ? <Loader2 className="size-4 animate-spin" /> : sobregiradas.length > 0 ? 'Aprobar igual' : 'Aprobar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
