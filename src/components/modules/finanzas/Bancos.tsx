/**
 * BANCOS — importar el Histórico de Movimientos de BBVA, conciliar contra los
 * pagos del ERP y registrar lo que el ERP no tenía (ITF, comisiones, cambio de
 * moneda, abonos) con su centro de costo. Reemplaza el cruce manual de
 * Contabilidad entre los PDF del banco y el acumulado de pagos.
 */
import { useEffect, useMemo, useState } from 'react';
import { Landmark, Upload, Loader2, Link2, Unlink, RefreshCw, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { PageNav } from '../../shared/PageNav';
import { supabase } from '../../../lib/supabase/client';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { usePagination } from '@/lib/shared/usePagination';
import { exportToExcelMultiHoja } from '@/lib/shared/export-utils';
import { leerLibroBbva, type HojaBbva } from '@/lib/finanzas/bancos-bbva';
import {
  cargarResumen, cargarMovimientos, importarHoja, conciliarAuto, candidatas, vincular, desvincular, registrar, clasificar, cargarAcumulado,
  CLASIFICACION, dinero, type ResumenCuenta, type Movimiento, type Clasificacion, type TransaccionCandidata, type AcumuladoFila,
} from '@/lib/finanzas/bancos';

/* eslint-disable @typescript-eslint/no-explicit-any */
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-PE', /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { timeZone: 'UTC' } : undefined) : '—');
const mesActual = () => new Date().toISOString().slice(0, 7);
type Filtro = 'sin_conciliar' | 'conciliados' | 'todos';

export function Bancos() {
  const { can } = usePermissions();
  const puedeOperar = can('finanzas', 'lotes_pagar') || can('finanzas', 'lotes_validar') || can('contabilidad', 'editar') || can('finanzas', 'editar');

  const [cuentas, setCuentas] = useState<ResumenCuenta[]>([]);
  const [cuentaId, setCuentaId] = useState<string>('');
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [mes, setMes] = useState<string>('');
  const [filtro, setFiltro] = useState<Filtro>('sin_conciliar');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [centros, setCentros] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [proyectos, setProyectos] = useState<{ id: string; codigo: string }[]>([]);
  const [importando, setImportando] = useState<{ archivo: string; hojas: HojaBbva[] } | null>(null);
  const [vinculando, setVinculando] = useState<Movimiento | null>(null);
  const [registrando, setRegistrando] = useState<Movimiento | null>(null);
  const [acumulado, setAcumulado] = useState<AcumuladoFila[]>([]);
  const [acumDesde, setAcumDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 7); });
  const [acumHasta, setAcumHasta] = useState(mesActual());

  const cargarCuentas = async () => {
    try { const r = await cargarResumen(); setCuentas(r); if (!cuentaId && r.length) setCuentaId(r[0].cuentaId); }
    catch (e) { toast.error((e as Error).message); }
  };
  const cargarMovs = async () => {
    if (!cuentaId) return;
    setCargando(true);
    try { setMovs(await cargarMovimientos(cuentaId, mes || undefined)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setCargando(false); }
  };
  const recargar = async () => { await cargarCuentas(); await cargarMovs(); };
  useEffect(() => { void cargarCuentas(); }, []);
  useEffect(() => { void cargarMovs(); }, [cuentaId, mes]);
  useEffect(() => {
    supabase.from('centros_costo').select('id, codigo, nombre').eq('activo', true).order('codigo').then(({ data }) => setCentros((data ?? []) as any));
    supabase.from('proyectos').select('id, codigo').order('codigo').then(({ data }) => setProyectos((data ?? []) as any));
  }, []);
  useEffect(() => { cargarAcumulado(acumDesde, acumHasta).then(setAcumulado).catch(() => undefined); }, [acumDesde, acumHasta, movs.length]);

  const cuenta = cuentas.find(c => c.cuentaId === cuentaId) ?? null;
  const visibles = useMemo(() => movs.filter(m => {
    if (filtro === 'sin_conciliar' && m.transaccionId) return false;
    if (filtro === 'conciliados' && !m.transaccionId) return false;
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      if (!`${m.concepto ?? ''} ${m.numeroDoc ?? ''} ${m.proveedorNombre ?? ''} ${m.transaccionNumero ?? ''} ${m.importe}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [movs, filtro, busqueda]);
  const pag = usePagination(visibles, 30);
  const meses = useMemo(() => Array.from(new Set(movs.map(m => m.mes))).sort().reverse(), [movs]);

  const elegirArchivo = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      const hojas = await leerLibroBbva(archivo);
      const utiles = hojas.filter(h => h.movimientos.length > 0);
      if (utiles.length === 0) { toast.error('El archivo no tiene hojas con movimientos de BBVA'); return; }
      setImportando({ archivo: archivo.name, hojas: utiles });
    } catch (e) { toast.error((e as Error).message); }
  };
  const cuentaPorNumero = (n: string | null) => cuentas.find(c => c.nombre && n && cuentasNumero[c.cuentaId] && cuentasNumero[c.cuentaId] === n);
  const [cuentasNumero, setCuentasNumero] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('cuentas_bancarias').select('id, numero').then(({ data }) => setCuentasNumero(Object.fromEntries(((data ?? []) as any[]).map(c => [c.id, String(c.numero ?? '').replace(/\D/g, '')]))));
  }, []);

  const confirmarImportacion = async () => {
    if (!importando) return;
    setOcupado(true);
    const resumen: string[] = [];
    try {
      for (const h of importando.hojas) {
        const c = cuentaPorNumero(h.numeroCuenta);
        if (!c) { resumen.push(`${h.hoja}: sin cuenta en el ERP para ${h.numeroCuenta ?? '?'}`); continue; }
        const r = await importarHoja(c.cuentaId, h, importando.archivo);
        resumen.push(`${h.hoja} → ${c.nombre}: ${r.nuevos} nuevos, ${r.duplicados} repetidos, conciliados ${r.porOperacion + r.porImporte}`);
      }
      toast.success(resumen.join(' · '), { duration: 12000 });
      setImportando(null); await recargar();
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  const correr = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try { await fn(); toast.success(ok); await recargar(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  const exportarAcumulado = () => exportToExcelMultiHoja(`Pagos acumulados ${acumDesde} a ${acumHasta}`, [{
    nombre: 'Acumulado',
    data: acumulado.map(a => ({ mes: a.mes, tipo: a.tipo, cc: a.centroCosto, proyecto: a.proyecto, categoria: a.categoria, moneda: a.moneda, n: a.movimientos, monto: a.monto, soles: a.montoSoles })),
    headersMap: { mes: 'Mes', tipo: 'Tipo', cc: 'Centro de costo', proyecto: 'Proyecto', categoria: 'Categoría', moneda: 'Moneda', n: 'Movimientos', monto: 'Monto', soles: 'En soles' },
  }]).catch(e => toast.error((e as Error).message));

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="size-6" /> Bancos</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Importa el Histórico de Movimientos de BBVA (el mismo Excel de BANCOS2026). El ERP cruza cada movimiento con los pagos registrados
            por número de operación o por importe y fecha; lo que no cruza (ITF, comisiones, cambio de moneda, abonos) se registra con su centro de costo.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={recargar} title="Actualizar"><RefreshCw className="size-4" /></Button>
          {puedeOperar && cuentaId && <Button variant="outline" disabled={ocupado} onClick={() => correr(async () => { const r = await conciliarAuto(cuentaId); toast.message(`Conciliados ${r.porOperacion} por operación y ${r.porImporte} por importe`); }, 'Conciliación automática ejecutada')}><Link2 className="size-4" /> Conciliar automático</Button>}
          {puedeOperar && (
            <label className="inline-flex">
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => { elegirArchivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm cursor-pointer hover:bg-primary/90"><Upload className="size-4" /> Importar histórico BBVA</span>
            </label>
          )}
        </div>
      </div>

      {/* Cuentas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cuentas.map(c => {
          const dif = c.saldoBanco == null ? null : c.saldoBanco - c.saldoErp;
          return (
            <Card key={c.cuentaId} className={`cursor-pointer ${c.cuentaId === cuentaId ? 'ring-2 ring-primary' : ''}`} onClick={() => setCuentaId(c.cuentaId)}>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{c.nombre}</p>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Saldo ERP</span><span className="font-semibold tabular-nums">{dinero(c.saldoErp, c.moneda)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Banco {c.saldoBancoFecha ? `al ${fecha(c.saldoBancoFecha)}` : ''}</span>
                  <span className="font-semibold tabular-nums">{c.saldoBanco == null ? '—' : dinero(c.saldoBanco, c.moneda)}</span>
                </div>
                {dif != null && Math.abs(dif) > 0.01 && <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="size-3" /> Diferencia {dinero(dif, c.moneda)}</p>}
                <p className="text-xs text-muted-foreground">{c.movimientos} movimientos{c.desde ? ` (${fecha(c.desde)} a ${fecha(c.hasta)})` : ''} · <b className={c.sinConciliar ? 'text-amber-700' : ''}>{c.sinConciliar} sin conciliar</b>{c.transaccionesSinBanco ? ` · ${c.transaccionesSinBanco} pagos del ERP sin extracto` : ''}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Movimientos */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{cuenta?.nombre ?? 'Cuenta'} · movimientos ({visibles.length})</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {(['sin_conciliar', 'conciliados', 'todos'] as Filtro[]).map(f => (
              <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} onClick={() => setFiltro(f)}>{f === 'sin_conciliar' ? 'Sin conciliar' : f === 'conciliados' ? 'Conciliados' : 'Todos'}</Button>
            ))}
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={mes} onChange={e => setMes(e.target.value)}>
              <option value="">Todos los meses</option>
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input className="h-8 w-[220px]" placeholder="Concepto, operación, importe…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {cargando ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Fecha</th>
                  <th className="text-left font-medium px-3 py-2">Operación</th>
                  <th className="text-left font-medium px-3 py-2">Concepto</th>
                  <th className="text-right font-medium px-3 py-2">Importe</th>
                  <th className="text-left font-medium px-3 py-2">Clasificación</th>
                  <th className="text-left font-medium px-3 py-2">En el ERP</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pag.paged.map(m => (
                  <tr key={m.id} className={m.transaccionId ? '' : 'bg-amber-50/30 dark:bg-amber-950/10'}>
                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{fecha(m.fechaOperacion)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{m.numeroDoc ?? '—'}<div className="text-muted-foreground">{m.codigo ?? ''}</div></td>
                    <td className="px-3 py-1.5 max-w-[320px]"><div className="truncate" title={m.concepto ?? ''}>{m.concepto ?? '—'}</div>{m.notas && <div className="text-xs text-muted-foreground">{m.notas}</div>}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap font-medium ${m.importe < 0 ? '' : 'text-green-700 dark:text-green-300'}`}>{dinero(m.importe, m.cuentaMoneda)}</td>
                    <td className="px-3 py-1.5">
                      {puedeOperar && !m.transaccionId ? (
                        <select className="h-7 rounded-md border bg-background px-1 text-xs" value={m.clasificacion} onChange={e => correr(() => clasificar(m.id, e.target.value as Clasificacion, m.centroCostoId, m.proyectoId), 'Clasificado')}>
                          {(Object.keys(CLASIFICACION) as Clasificacion[]).map(k => <option key={k} value={k}>{CLASIFICACION[k].label}</option>)}
                        </select>
                      ) : <Badge variant="outline" className="text-[10px]">{CLASIFICACION[m.clasificacion]?.label ?? m.clasificacion}</Badge>}
                      {m.centroCostoCodigo && <div className="text-xs text-muted-foreground">{m.centroCostoCodigo}{m.proyectoCodigo ? ` · ${m.proyectoCodigo}` : ''}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {m.transaccionId ? (
                        <div className="text-green-700 dark:text-green-300"><CheckCircle2 className="size-3 inline" /> {m.transaccionNumero}<div className="text-muted-foreground truncate max-w-[220px]">{m.proveedorNombre ?? m.transaccionCategoria ?? ''} · {m.conciliadoPor === 'auto:operacion' ? 'por operación' : m.conciliadoPor === 'auto:importe' ? 'por importe' : 'manual'}</div></div>
                      ) : <span className="text-amber-700">Sin conciliar</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {puedeOperar && !m.transaccionId && (
                        <>
                          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setVinculando(m)} title="Cruzar con un pago ya registrado en el ERP"><Link2 className="size-4" /> Vincular</Button>
                          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setRegistrando(m)} title="Crear la transacción en el ERP (ITF, comisión, abono…)">Registrar</Button>
                        </>
                      )}
                      {puedeOperar && m.transaccionId && m.conciliadoPor && (
                        <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => { if (window.confirm('¿Desvincular este movimiento de su transacción?')) correr(() => desvincular(m.id), 'Desvinculado'); }}><Unlink className="size-4" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
                {pag.paged.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{movs.length === 0 ? 'Sin movimientos importados para esta cuenta. Usa "Importar histórico BBVA".' : 'Nada con estos filtros.'}</td></tr>}
              </tbody>
            </table>
          )}
          {pag.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 p-2 text-sm text-muted-foreground">
              <Button size="sm" variant="ghost" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>{pag.page} / {pag.totalPages}<Button size="sm" variant="ghost" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acumulado por centro de costo */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Pagos acumulados por centro de costo</CardTitle>
            <p className="text-xs text-muted-foreground">Lo que Contabilidad armaba a mano en "Pagos acumulados con CC": sale de las transacciones pagadas del ERP.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="month" className="h-8 w-[150px]" value={acumDesde} onChange={e => setAcumDesde(e.target.value)} />
            <span className="text-xs text-muted-foreground">a</span>
            <Input type="month" className="h-8 w-[150px]" value={acumHasta} onChange={e => setAcumHasta(e.target.value)} />
            <Button size="sm" variant="outline" onClick={exportarAcumulado}><FileSpreadsheet className="size-4" /> Excel</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <AcumuladoTabla filas={acumulado} />
        </CardContent>
      </Card>

      {importando && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setImportando(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importar {importando.archivo}</DialogTitle>
              <DialogDescription>Una fila por hoja. La cuenta se toma de la cabecera "Cuenta Actual" de cada hoja, no del nombre. Lo repetido se ignora.</DialogDescription>
            </DialogHeader>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30"><tr><th className="text-left px-2 py-1">Hoja</th><th className="text-left px-2 py-1">Cuenta</th><th className="text-left px-2 py-1">Periodo</th><th className="text-right px-2 py-1">Movs.</th><th className="text-right px-2 py-1">Saldo inicial → final</th><th className="text-left px-2 py-1">Avisos</th></tr></thead>
              <tbody className="divide-y">
                {importando.hojas.map(h => { const c = cuentaPorNumero(h.numeroCuenta); return (
                  <tr key={h.hoja}>
                    <td className="px-2 py-1 font-mono text-xs">{h.hoja}</td>
                    <td className="px-2 py-1">{c ? c.nombre : <span className="text-red-600">No está en el ERP: {h.numeroCuenta}</span>}<div className="text-xs text-muted-foreground">{h.moneda}</div></td>
                    <td className="px-2 py-1 text-xs">{h.periodo ?? '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.movimientos.length}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-xs whitespace-nowrap">{h.saldoInicial?.saldo.toLocaleString('es-PE') ?? '—'} → {h.saldos.length ? h.saldos[h.saldos.length - 1].saldo.toLocaleString('es-PE') : '—'}</td>
                    <td className="px-2 py-1 text-xs text-amber-700">{h.avisos.join(' ')}</td>
                  </tr>); })}
              </tbody>
            </table>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportando(null)}>Cancelar</Button>
              <Button disabled={ocupado} onClick={confirmarImportacion}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : 'Importar y conciliar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {vinculando && <VincularDialog mov={vinculando} onClose={() => setVinculando(null)} onHecho={recargar} />}
      {registrando && <RegistrarDialog mov={registrando} centros={centros} proyectos={proyectos} onClose={() => setRegistrando(null)} onHecho={recargar} />}
    </div>
  );
}

function AcumuladoTabla({ filas }: { filas: AcumuladoFila[] }) {
  const meses = useMemo(() => Array.from(new Set(filas.map(f => f.mes))).sort(), [filas]);
  const porCc = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    // Los cambios de moneda salen de una cuenta y entran en otra: no son gasto de ningún centro de costo.
    for (const f of filas.filter(x => x.tipo === 'egreso' && !/CAMBIO DE MONEDA/i.test(x.categoria))) {
      const fila = m.get(f.centroCosto) ?? new Map<string, number>();
      fila.set(f.mes, (fila.get(f.mes) ?? 0) + f.montoSoles); m.set(f.centroCosto, fila);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filas]);
  if (filas.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">Sin pagos registrados en el ERP en ese rango.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground border-b bg-muted/30">
        <tr><th className="text-left font-medium px-3 py-2">Centro de costo</th>{meses.map(m => <th key={m} className="text-right font-medium px-3 py-2">{m}</th>)}<th className="text-right font-medium px-3 py-2 border-l">Total S/</th></tr>
      </thead>
      <tbody className="divide-y">
        {porCc.map(([cc, fila]) => { const tot = Array.from(fila.values()).reduce((s, n) => s + n, 0); return (
          <tr key={cc}><td className="px-3 py-1.5 font-medium">{cc}</td>{meses.map(m => <td key={m} className="px-3 py-1.5 text-right tabular-nums">{fila.get(m) ? `S/ ${Math.round(fila.get(m)!).toLocaleString('es-PE')}` : ''}</td>)}<td className="px-3 py-1.5 text-right tabular-nums font-semibold border-l">S/ {Math.round(tot).toLocaleString('es-PE')}</td></tr>); })}
      </tbody>
    </table>
  );
}

function VincularDialog({ mov, onClose, onHecho }: { mov: Movimiento; onClose: () => void; onHecho: () => Promise<void> }) {
  const [lista, setLista] = useState<TransaccionCandidata[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { candidatas(mov.cuentaId, mov.importe, mov.fechaOperacion).then(setLista).catch(e => toast.error((e as Error).message)).finally(() => setCargando(false)); }, [mov]);
  const elegir = async (t: TransaccionCandidata) => {
    setOcupado(true);
    try { await vincular(mov.id, t.id); toast.success(`Vinculado con ${t.numero}`); await onHecho(); onClose(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Vincular movimiento</DialogTitle><DialogDescription>{fecha(mov.fechaOperacion)} · {mov.concepto} · {dinero(mov.importe, mov.cuentaMoneda)} · op. {mov.numeroDoc ?? '—'}. Transacciones del ERP sin extracto, ±15 días, las de importe más cercano primero.</DialogDescription></DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
          {cargando ? <div className="p-6 text-center"><Loader2 className="size-5 animate-spin inline" /></div> : (
            <table className="w-full text-sm"><tbody className="divide-y">
              {lista.map(t => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.numero}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fecha(t.fecha)}</td>
                  <td className="px-2 py-1.5 max-w-[260px] truncate">{t.proveedor ?? t.descripcion ?? t.categoria}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{t.referencia ?? ''}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${Math.abs(t.monto - Math.abs(mov.importe)) < 0.01 ? 'font-semibold text-green-700' : ''}`}>{dinero(t.monto, t.moneda)}</td>
                  <td className="px-2 py-1.5 text-right"><Button size="sm" disabled={ocupado} onClick={() => elegir(t)}>Vincular</Button></td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td className="px-3 py-6 text-center text-muted-foreground">No hay transacciones candidatas. Si es un ITF, comisión o abono, usa "Registrar".</td></tr>}
            </tbody></table>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarDialog({ mov, centros, proyectos, onClose, onHecho }: { mov: Movimiento; centros: { id: string; codigo: string; nombre: string }[]; proyectos: { id: string; codigo: string }[]; onClose: () => void; onHecho: () => Promise<void> }) {
  const [clas, setClas] = useState<Clasificacion>(mov.clasificacion === 'por_clasificar' ? (mov.importe < 0 ? 'otro' : 'abono') : mov.clasificacion);
  const [categoria, setCategoria] = useState(CLASIFICACION[clas]?.categoria ?? '');
  const [cc, setCc] = useState(mov.centroCostoId ?? '');
  const [proy, setProy] = useState(mov.proyectoId ?? '');
  const [desc, setDesc] = useState(mov.concepto ?? '');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setCategoria(CLASIFICACION[clas]?.categoria ?? ''); }, [clas]);
  const guardar = async () => {
    setOcupado(true);
    try { await registrar({ movId: mov.id, clasificacion: clas, categoria, centroCostoId: cc || null, proyectoId: proy || null, descripcion: desc }); toast.success('Transacción registrada'); await onHecho(); onClose(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar en el ERP</DialogTitle><DialogDescription>{fecha(mov.fechaOperacion)} · {dinero(mov.importe, mov.cuentaMoneda)} · op. {mov.numeroDoc ?? '—'}. Nace una transacción {mov.importe < 0 ? 'de egreso' : 'de ingreso'} ya conciliada con este movimiento.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2">Clasificación
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={clas} onChange={e => setClas(e.target.value as Clasificacion)}>
              {(Object.keys(CLASIFICACION) as Clasificacion[]).filter(k => k !== 'por_clasificar').map(k => <option key={k} value={k}>{CLASIFICACION[k].label}</option>)}
            </select>
          </label>
          <label className="text-sm col-span-2">Categoría<Input className="mt-1" value={categoria} onChange={e => setCategoria(e.target.value)} /></label>
          <label className="text-sm">Centro de costo
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={cc} onChange={e => setCc(e.target.value)}>
              <option value="">(sin centro de costo)</option>
              {centros.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}
            </select>
          </label>
          <label className="text-sm">Proyecto
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={proy} onChange={e => setProy(e.target.value)}>
              <option value="">(ninguno)</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}
            </select>
          </label>
          <label className="text-sm col-span-2">Descripción<Input className="mt-1" value={desc} onChange={e => setDesc(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={ocupado} onClick={guardar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
