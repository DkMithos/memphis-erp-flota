/**
 * Memphis ERP — Comprobantes de Pago Lista
 * Facturas/boletas recibidas y emitidas con filtros y acciones.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Receipt, Plus, Search, Filter, CheckCircle2, XCircle, Clock, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useComprobantesStore, type ComprobantePago } from '../../../lib/contabilidad/comprobantes-store';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

interface Props { onNavigate: (route: string) => void; }

const TIPO_LABELS: Record<string, string> = {
  '01': 'Factura', '03': 'Boleta', '07': 'N. Crédito',
  '08': 'N. Débito', '09': 'G. Remisión', '31': 'Liq. Compra',
};

const ESTADO_BADGE: Record<string, string> = {
  activo:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  anulado:   'bg-gray-100 text-gray-500 dark:bg-gray-800',
  baja_baja: 'bg-red-100 text-red-500',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n);
}

export function ComprobantesLista({ onNavigate }: Props) {
  const { comprobantes, loading, anularComprobante } = useComprobantesStore();
  const confirmAction = useConfirmAction();
  const [query, setQuery]                 = useState('');
  const [filtroDireccion, setFiltroDireccion] = useState('todos');
  const [filtroEstado, setFiltroEstado]   = useState('todos');

  const filtrados = useMemo(() => {
    return comprobantes.filter(c => {
      if (filtroDireccion !== 'todos' && c.direccion !== filtroDireccion) return false;
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!c.numeroCompleto.toLowerCase().includes(q)
          && !(c.razonSocialEmisor ?? '').toLowerCase().includes(q)
          && !(c.razonSocialReceptor ?? '').toLowerCase().includes(q)
          && !(c.rucEmisor ?? '').includes(q)
          && !(c.rucReceptor ?? '').includes(q)) return false;
      }
      return true;
    });
  }, [comprobantes, filtroDireccion, filtroEstado, query]);

  const pendientes = comprobantes.filter(c => !c.contabilizado && c.estado === 'activo').length;

  async function handleAnular(id: string) {
    const ok = await confirmAction({ title: 'Confirmar anulación', description: '¿Anular este comprobante?', confirmLabel: 'Anular', variant: 'destructive' });
    if (!ok) return;
    const r = await anularComprobante(id);
    if (!r.ok) toast.error(r.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Receipt className="size-5 text-primary" />Comprobantes de Pago</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtrados.length} comprobante(s)
            {pendientes > 0 && <span className="ml-2 text-amber-600 font-medium">· {pendientes} pend. contabilizar</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => onNavigate('/contabilidad/comprobantes/nuevo')} className="gap-1.5">
          <Plus className="size-3.5" /> Nuevo Comprobante
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por número, RUC o razón social…" className="pl-9 text-sm" />
        </div>
        <Select value={filtroDireccion} onValueChange={setFiltroDireccion}>
          <SelectTrigger className="text-sm w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="recibido">Recibidos</SelectItem>
            <SelectItem value="emitido">Emitidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="anulado">Anulado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando comprobantes…</div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Receipt className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin comprobantes</p>
              <Button size="sm" onClick={() => onNavigate('/contabilidad/comprobantes/nuevo')} className="gap-1.5">
                <Plus className="size-3.5" /> Registrar comprobante
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-2">Número</div>
                <div className="col-span-1">Tipo</div>
                <div className="col-span-2">Fecha</div>
                <div className="col-span-3">Proveedor / Cliente</div>
                <div className="col-span-1 text-right">IGV</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1 text-center">Estado</div>
                <div className="col-span-1" />
              </div>
              {filtrados.map(c => (
                <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/40 hover:bg-muted/20 transition-colors items-center text-sm">
                  <div className="col-span-6 lg:col-span-2">
                    <p className="font-mono text-xs font-semibold">{c.numeroCompleto}</p>
                    <p className="text-[10px] text-muted-foreground">{c.direccion === 'recibido' ? '← Recibido' : '→ Emitido'}</p>
                  </div>
                  <div className="col-span-6 lg:col-span-1">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {TIPO_LABELS[c.tipo] ?? c.tipo}
                    </Badge>
                  </div>
                  <div className="col-span-6 lg:col-span-2 text-xs text-muted-foreground">
                    {new Date(c.fechaEmision).toLocaleDateString('es-PE')}
                  </div>
                  <div className="col-span-6 lg:col-span-3">
                    <p className="text-xs font-medium truncate">
                      {c.direccion === 'recibido'
                        ? (c.razonSocialEmisor ?? c.rucEmisor ?? '—')
                        : (c.razonSocialReceptor ?? c.rucReceptor ?? '—')}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {c.direccion === 'recibido' ? c.rucEmisor : c.rucReceptor}
                    </p>
                  </div>
                  <div className="col-span-4 lg:col-span-1 text-right font-mono text-xs text-muted-foreground">
                    {fmt(c.igv)}
                  </div>
                  <div className="col-span-4 lg:col-span-1 text-right font-mono text-xs font-semibold">
                    {fmt(c.total)}
                  </div>
                  <div className="col-span-2 lg:col-span-1 flex justify-center">
                    <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${ESTADO_BADGE[c.estado]}`}>
                      {c.estado}
                    </Badge>
                  </div>
                  <div className="col-span-2 lg:col-span-1 flex justify-end">
                    {c.estado === 'activo' && (
                      <Button variant="ghost" size="sm" onClick={() => handleAnular(c.id)}
                        className="h-6 text-[10px] text-red-500 hover:text-red-600 px-2">
                        Anular
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
