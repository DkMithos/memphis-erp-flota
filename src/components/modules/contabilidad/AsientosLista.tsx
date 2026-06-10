/**
 * Memphis ERP — Asientos Contables Lista
 * Libro Diario filtrable por período y estado, con vista de detalle.
 */
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { BookOpen, Plus, Search, Filter, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { usePeriodosStore } from '../../../lib/contabilidad/periodos-store';
import { useAsientosStore, type AsientoContable, type LineaAsiento } from '../../../lib/contabilidad/asientos-store';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

interface Props {
  onNavigate: (route: string) => void;
  detalleNumero?: string;
}

const ESTADO_BADGE: Record<string, string> = {
  borrador:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  validado:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  anulado:   'bg-gray-100 text-gray-500 dark:bg-gray-800',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n);
}

function DetalleAsiento({ asiento, onNavigate, onBack }: { asiento: AsientoContable; onNavigate: (r:string)=>void; onBack: ()=>void }) {
  const { validarAsiento, anularAsiento, cargarLineas } = useAsientosStore();
  const confirmAction = useConfirmAction();
  const [lineas, setLineas] = useState<LineaAsiento[]>(asiento.lineas);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (lineas.length === 0) {
      setCargando(true);
      cargarLineas(asiento._dbId).then(ls => { setLineas(ls); setCargando(false); });
    }
  }, [asiento._dbId]);

  async function handleValidar() {
    const ok = await confirmAction({ title: 'Confirmar validación', description: '¿Validar este asiento? No se podrá deshacer.', confirmLabel: 'Validar' });
    if (!ok) return;
    setProcesando(true);
    const r = await validarAsiento(asiento._dbId);
    if (!r.ok) toast.error(r.error);
    setProcesando(false);
  }

  async function handleAnular() {
    const ok = await confirmAction({ title: 'Confirmar anulación', description: '¿Anular este asiento?', confirmLabel: 'Anular', variant: 'destructive' });
    if (!ok) return;
    setProcesando(true);
    const r = await anularAsiento(asiento._dbId);
    if (!r.ok) toast.error(r.error);
    setProcesando(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="size-3.5" /> Asientos
        </Button>
        <h2 className="font-bold text-lg flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          {asiento.numero}
        </h2>
        <Badge variant="secondary" className={ESTADO_BADGE[asiento.estado]}>{asiento.estado}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{new Date(asiento.fecha).toLocaleDateString('es-PE')}</p></div>
          <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{asiento.tipo}</p></div>
          <div><p className="text-xs text-muted-foreground">Moneda</p><p className="font-medium">{asiento.moneda}</p></div>
          <div><p className="text-xs text-muted-foreground">Balance</p>
            <p className={`font-medium ${asiento.balanceado ? 'text-green-600' : 'text-red-500'}`}>
              {asiento.balanceado ? 'Balanceado' : 'Desbalanceado'}
            </p>
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-muted-foreground">Glosa</p>
            <p className="font-medium">{asiento.glosa}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Líneas del Asiento</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <div className="col-span-2">Código</div>
            <div className="col-span-4">Cuenta</div>
            <div className="col-span-3">Glosa</div>
            <div className="col-span-1 text-right">Debe</div>
            <div className="col-span-2 text-right">Haber</div>
          </div>
          {cargando ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Cargando líneas…</div>
          ) : lineas.map(l => (
            <div key={l.id} className="grid grid-cols-12 gap-1 px-4 py-2 border-b border-border/40 text-sm">
              <div className="col-span-2 font-mono text-xs text-muted-foreground pt-0.5">{l.cuentaCodigo}</div>
              <div className="col-span-4 font-medium truncate">{l.cuentaNombre}</div>
              <div className="col-span-3 text-xs text-muted-foreground truncate">{l.glosa ?? '—'}</div>
              <div className="col-span-1 text-right font-mono text-xs">{l.debe > 0 ? fmt(l.debe) : ''}</div>
              <div className="col-span-2 text-right font-mono text-xs">{l.haber > 0 ? fmt(l.haber) : ''}</div>
            </div>
          ))}
          <div className="grid grid-cols-12 gap-1 px-4 py-2.5 bg-muted/30 font-bold text-sm">
            <div className="col-span-9 text-right text-xs text-muted-foreground pr-2">TOTALES</div>
            <div className="col-span-1 text-right font-mono">{fmt(asiento.totalDebe)}</div>
            <div className="col-span-2 text-right font-mono">{fmt(asiento.totalHaber)}</div>
          </div>
        </CardContent>
      </Card>

      {asiento.estado === 'borrador' && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleAnular} disabled={procesando} className="text-red-500 hover:text-red-600 gap-1.5">
            <XCircle className="size-4" /> Anular
          </Button>
          <Button onClick={handleValidar} disabled={procesando || !asiento.balanceado} className="gap-1.5">
            <CheckCircle2 className="size-4" />{procesando ? 'Procesando…' : 'Validar Asiento'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AsientosLista({ onNavigate, detalleNumero }: Props) {
  const { periodos, periodoActual } = usePeriodosStore();
  const { asientos, loading, obtenerPorNumero } = useAsientosStore();
  const [query, setQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState(periodoActual?.id ?? 'todos');
  const [detalleKey, setDetalleKey] = useState<string | null>(detalleNumero ?? null);

  // Hook ANTES del return condicional (regla de los hooks)
  const filtrados = useMemo(() => {
    return asientos.filter(a => {
      if (filtroEstado !== 'todos' && a.estado !== filtroEstado) return false;
      if (filtroPeriodo !== 'todos' && a.periodoId !== filtroPeriodo) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!a.numero.toLowerCase().includes(q) && !a.glosa.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [asientos, filtroEstado, filtroPeriodo, query]);

  // Detalle view
  const detalleAsiento = detalleKey ? obtenerPorNumero(detalleKey) : null;
  if (detalleAsiento) {
    return <DetalleAsiento asiento={detalleAsiento} onNavigate={onNavigate}
      onBack={() => { setDetalleKey(null); onNavigate('/contabilidad/asientos'); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BookOpen className="size-5 text-primary" />Libro Diario</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{filtrados.length} asiento(s)</p>
        </div>
        <Button size="sm" onClick={() => onNavigate('/contabilidad/asientos/nuevo')} className="gap-1.5">
          <Plus className="size-3.5" /> Nuevo Asiento
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar asiento o glosa…" className="pl-9 text-sm" />
        </div>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="text-sm w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los períodos</SelectItem>
            {periodos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="validado">Validado</SelectItem>
            <SelectItem value="anulado">Anulado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando asientos…</div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <BookOpen className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin asientos{query ? ` para "${query}"` : ''}</p>
              <Button size="sm" onClick={() => onNavigate('/contabilidad/asientos/nuevo')} className="gap-1.5">
                <Plus className="size-3.5" /> Crear primer asiento
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-3">Número</div>
                <div className="col-span-2">Fecha</div>
                <div className="col-span-4">Glosa</div>
                <div className="col-span-1 text-right">Importe</div>
                <div className="col-span-2 text-center">Estado</div>
              </div>
              {filtrados.map(a => (
                <button key={a._dbId} onClick={() => setDetalleKey(a.numero)}
                  className="w-full grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors text-left items-center">
                  <div className="col-span-12 sm:col-span-3">
                    <p className="font-mono text-xs font-semibold text-primary">{a.numero}</p>
                  </div>
                  <div className="col-span-12 sm:col-span-2 text-xs text-muted-foreground">
                    {new Date(a.fecha).toLocaleDateString('es-PE')}
                  </div>
                  <div className="col-span-12 sm:col-span-4 text-sm font-medium truncate">{a.glosa}</div>
                  <div className="col-span-6 sm:col-span-1 text-right text-xs font-mono text-muted-foreground">
                    {fmt(a.totalDebe)}
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex justify-center">
                    <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${ESTADO_BADGE[a.estado]}`}>
                      {a.estado}
                    </Badge>
                  </div>
                </button>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
