/**
 * LOTES DE PAGO — la lista.
 *
 * Reemplaza los tres Excel por correo del circuito de pagos: Compras arma el
 * lote, Contabilidad lo valida, Tesorería lo paga. Cada quien ve primero lo
 * que le toca ("esperando mi acción") y abajo las cuentas bancarias con su
 * saldo, que antes nadie tenía a la vista.
 */
import { useEffect, useMemo, useState } from 'react';
import { Banknote, Plus, Loader2, AlertTriangle, Landmark, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog';
import { PageNav } from '../../shared/PageNav';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { usePagination } from '@/lib/shared/usePagination';
import {
  cargarLotes, cargarCuentas, crearLote, fijarSaldoInicial,
  ESTADO_LOTE, dinero, type Lote, type CuentaBancaria, type EstadoLote,
} from '@/lib/finanzas/lotes-pago';

// Las fechas sin hora (YYYY-MM-DD) se muestran en UTC: si no, en Lima salen un día antes.
const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(iso).toLocaleDateString('es-PE', soloFecha ? { timeZone: 'UTC' } : undefined);
};
const FILTROS: { key: EstadoLote | 'todos' | 'vivos'; label: string }[] = [
  { key: 'vivos', label: 'En curso' },
  { key: 'borrador', label: 'Borrador' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'validado', label: 'Validado' },
  { key: 'por_pagar', label: 'Por pagar' },
  { key: 'pagado', label: 'Pagado' },
  { key: 'todos', label: 'Todos' },
];

export function LotesPago({ onNavigate }: { onNavigate?: (r: string) => void }) {
  const { can } = usePermissions();
  const puedeArmar = can('finanzas', 'lotes_armar');
  const puedeValidar = can('finanzas', 'lotes_validar');
  const puedePagar = can('finanzas', 'lotes_pagar');
  const puedeEditarCuentas = can('finanzas', 'editar');

  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['key']>('vivos');
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [creando, setCreando] = useState(false);
  const [saldoEdit, setSaldoEdit] = useState<Record<string, { saldo: string; fecha: string }>>({});

  const cargar = async () => {
    setCargando(true);
    try {
      const [l, c] = await Promise.all([cargarLotes(), cargarCuentas()]);
      setLotes(l); setCuentas(c);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { void cargar(); }, []);

  const datos = useMemo(() => lotes.filter(l => {
    if (filtro === 'todos') return true;
    if (filtro === 'vivos') return !['pagado', 'conciliado', 'anulado'].includes(l.estado);
    return l.estado === filtro;
  }), [lotes, filtro]);
  const pag = usePagination(datos);

  // "Esperando mi acción": lo que le toca a quien está mirando.
  const pendientesMios = useMemo(() => {
    const n = (e: EstadoLote[]) => lotes.filter(l => e.includes(l.estado)).length;
    const r: { label: string; n: number; filtro: EstadoLote }[] = [];
    if (puedeArmar) {
      r.push({ label: 'Borradores por terminar', n: n(['borrador']), filtro: 'borrador' });
      r.push({ label: 'Validados por enviar a tesorería', n: n(['validado']), filtro: 'validado' });
    }
    if (puedeValidar) r.push({ label: 'Por validar (Contabilidad)', n: n(['en_revision']), filtro: 'en_revision' });
    if (puedePagar) r.push({ label: 'Por pagar (Tesorería)', n: n(['por_pagar']), filtro: 'por_pagar' });
    return r;
  }, [lotes, puedeArmar, puedeValidar, puedePagar]);

  const crear = async () => {
    setCreando(true);
    try {
      const id = await crearLote(nuevaFecha || null, nuevasNotas.trim() || null);
      toast.success('Lote creado');
      setNuevoAbierto(false);
      onNavigate?.(`/finanzas/lotes-pago/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreando(false);
    }
  };

  const guardarSaldo = async (c: CuentaBancaria) => {
    const e = saldoEdit[c.id];
    if (!e) return;
    const saldo = Number(e.saldo.replace(/,/g, ''));
    if (!Number.isFinite(saldo) || !e.fecha) { toast.error('Saldo o fecha inválidos'); return; }
    try {
      await fijarSaldoInicial(c.id, saldo, e.fecha);
      toast.success(`Saldo inicial de ${c.nombre} fijado`);
      setSaldoEdit(p => { const n = { ...p }; delete n[c.id]; return n; });
      void cargar();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Banknote className="size-6" /> Lotes de pago</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Compras arma el lote desde Cuentas por pagar, Contabilidad valida detracciones y retenciones,
            Tesorería exporta para el banco y marca cada línea pagada. Un solo lugar, sin archivos por correo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => cargar()} title="Actualizar"><RefreshCw className="size-4" /></Button>
          {puedeArmar && (
            <Button onClick={() => { setNuevaFecha(''); setNuevasNotas(''); setNuevoAbierto(true); }}>
              <Plus className="size-4" /> Nuevo lote
            </Button>
          )}
        </div>
      </div>

      {pendientesMios.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {pendientesMios.map(p => (
            <Card key={p.label} className={`cursor-pointer ${p.n > 0 ? 'border-amber-300/70' : ''}`} onClick={() => setFiltro(p.filtro)}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{p.label}</p>
                <p className={`text-2xl font-bold ${p.n > 0 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{p.n}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Lotes ({datos.length})</CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {FILTROS.map(f => (
              <Button key={f.key} size="sm" variant={filtro === f.key ? 'default' : 'outline'} onClick={() => setFiltro(f.key)}>{f.label}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {cargando ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Lote</th>
                  <th className="text-left font-medium px-3 py-2">Estado</th>
                  <th className="text-left font-medium px-3 py-2">Pago previsto</th>
                  <th className="text-right font-medium px-3 py-2">Líneas</th>
                  <th className="text-right font-medium px-3 py-2">Neto S/</th>
                  <th className="text-right font-medium px-3 py-2">Neto US$</th>
                  <th className="text-right font-medium px-3 py-2">Detracción S/</th>
                  <th className="text-left font-medium px-3 py-2">Creado por</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pag.paged.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => onNavigate?.(`/finanzas/lotes-pago/${l.id}`)}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{l.numero}</td>
                    <td className="px-3 py-2">
                      <Badge className={ESTADO_LOTE[l.estado].clase} variant="outline" title={ESTADO_LOTE[l.estado].ayuda}>{ESTADO_LOTE[l.estado].label}</Badge>
                      {l.lineasConAlertas > 0 && !['pagado', 'conciliado', 'anulado'].includes(l.estado) && (
                        <Badge variant="outline" className="ml-1 text-[10px] text-amber-700" title="Líneas con alertas">
                          <AlertTriangle className="size-3 mr-0.5" />{l.lineasConAlertas}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fecha(l.fechaPrevistaPago)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.lineas}{l.estado === 'por_pagar' && l.lineasPendientes > 0 ? <span className="text-xs text-muted-foreground"> ({l.lineasPendientes} pend.)</span> : null}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{l.netoPen ? dinero(l.netoPen, 'PEN') : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{l.netoUsd ? dinero(l.netoUsd, 'USD') : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{l.detraccionSoles ? dinero(l.detraccionSoles, 'PEN') : ''}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]">{l.creadoPorEmail ?? ''}<br />{fecha(l.creadoEn)}</td>
                    <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost">Abrir</Button></td>
                  </tr>
                ))}
                {pag.paged.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    {filtro === 'vivos' ? 'No hay lotes en curso.' : 'Sin lotes con este filtro.'}
                    {puedeArmar && filtro === 'vivos' && ' Crea uno con "Nuevo lote" o desde Cuentas por pagar.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
          {pag.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 p-2 text-sm text-muted-foreground">
              <Button size="sm" variant="ghost" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>
              {pag.page} / {pag.totalPages}
              <Button size="sm" variant="ghost" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cuentas bancarias: saldo = inicial + movimientos pagados del ERP */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Landmark className="size-4" /> Cuentas bancarias</CardTitle>
          <p className="text-xs text-muted-foreground">
            El saldo sale del saldo inicial más los pagos registrados en el ERP desde esa fecha. Mientras el saldo inicial esté en cero, la cifra no es real:
            {puedeEditarCuentas ? ' fíjalo con el saldo del estado de cuenta a esa fecha.' : ' Finanzas debe fijarlo.'}
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/30">
              <tr>
                <th className="text-left font-medium px-3 py-2">Cuenta</th>
                <th className="text-left font-medium px-3 py-2">Número</th>
                <th className="text-left font-medium px-3 py-2">Tipo</th>
                <th className="text-right font-medium px-3 py-2">Saldo inicial</th>
                <th className="text-left font-medium px-3 py-2">Desde</th>
                <th className="text-right font-medium px-3 py-2">Movimientos</th>
                <th className="text-right font-medium px-3 py-2">Saldo actual</th>
                {puedeEditarCuentas && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {cuentas.map(c => {
                const e = saldoEdit[c.id];
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{c.nombre}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{c.numero ?? '—'}</td>
                    <td className="px-3 py-2 text-xs capitalize">{c.tipo}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {e ? <Input className="h-8 w-[140px] text-right inline-block" value={e.saldo} onChange={ev => setSaldoEdit(p => ({ ...p, [c.id]: { ...e, saldo: ev.target.value } }))} /> : dinero(c.saldoInicial, c.moneda)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e ? <Input type="date" className="h-8 w-[150px] inline-block" value={e.fecha} onChange={ev => setSaldoEdit(p => ({ ...p, [c.id]: { ...e, fecha: ev.target.value } }))} /> : fecha(c.saldoInicialFecha)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.movimientos}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${c.saldoActual < 0 ? 'text-red-600' : ''}`}>{dinero(c.saldoActual, c.moneda)}</td>
                    {puedeEditarCuentas && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {e ? (
                          <>
                            <Button size="sm" onClick={() => guardarSaldo(c)}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setSaldoEdit(p => { const n = { ...p }; delete n[c.id]; return n; })}>Cancelar</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setSaldoEdit(p => ({ ...p, [c.id]: { saldo: String(c.saldoInicial), fecha: c.saldoInicialFecha } }))}>Fijar saldo inicial</Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {cuentas.length === 0 && !cargando && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sin cuentas bancarias configuradas.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo lote de pago</DialogTitle>
            <DialogDescription>Se crea en borrador. Luego agregas las facturas y compromisos desde Cuentas por pagar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm block">Fecha prevista de pago
              <Input type="date" className="mt-1" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} />
            </label>
            <label className="text-sm block">Notas (opcional)
              <Input className="mt-1" placeholder="Ej. Pagos semana 16/10" value={nuevasNotas} onChange={e => setNuevasNotas(e.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoAbierto(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={creando}>{creando ? <Loader2 className="size-4 animate-spin" /> : 'Crear lote'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
