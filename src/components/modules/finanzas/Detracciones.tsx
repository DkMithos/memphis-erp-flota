/**
 * DETRACCIONES — pendientes de depósito, archivo para el Banco de la Nación y
 * constancias de SUNAT.
 *
 * Reemplaza tres cosas que Contabilidad hacía a mano: la macro R13.2 que
 * generaba el .txt de pago masivo, el control en Excel de qué facturas tienen
 * la detracción depositada, y el cruce con la consulta de constancias de SUNAT.
 */
import { useEffect, useMemo, useState } from 'react';
import { Landmark, FileDown, Upload, Loader2, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { PageNav } from '../../shared/PageNav';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { usePagination } from '@/lib/shared/usePagination';
import {
  cargarDetracciones, cargarLotesBn, contenidoLoteBn, generarArchivoBn, anularLoteBn, descargarTxt,
  leerConstancias, importarConstancias, soles0, soles2, type Detraccion, type LoteBn, type FilaConstancia,
} from '@/lib/finanzas/detracciones';

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-PE', /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { timeZone: 'UTC' } : undefined) : '—');
type Vista = 'pendientes' | 'depositadas' | 'todas';

export function Detracciones() {
  const { can } = usePermissions();
  const puedeGenerar = can('finanzas', 'lotes_pagar');
  const puedeImportar = can('finanzas', 'lotes_pagar') || can('finanzas', 'lotes_validar') || can('contabilidad', 'editar');

  const [filas, setFilas] = useState<Detraccion[]>([]);
  const [lotes, setLotes] = useState<LoteBn[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>('pendientes');
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [importando, setImportando] = useState<{ archivo: string; filas: FilaConstancia[] } | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const [d, l] = await Promise.all([cargarDetracciones(), cargarLotesBn()]);
      setFilas(d); setLotes(l);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargar(); }, []);

  const pendientes = useMemo(() => filas.filter(f => f.estado === 'pendiente'), [filas]);
  const kpi = useMemo(() => {
    const hoy = new Date(); const en7 = new Date(); en7.setDate(hoy.getDate() + 7); const en7ISO = en7.toISOString().slice(0, 10);
    const sinArchivo = pendientes.filter(p => !p.archivoBn);
    const enArchivo = pendientes.filter(p => p.archivoBn);
    const vencidas = pendientes.filter(p => p.vencida);
    const porVencer = pendientes.filter(p => !p.vencida && p.vence && p.vence <= en7ISO);
    const mes = hoy.toISOString().slice(0, 7);
    const depositadasMes = filas.filter(f => f.estado === 'depositado' && (f.fechaDeposito ?? '').startsWith(mes));
    const suma = (xs: Detraccion[]) => xs.reduce((s, x) => s + x.monto, 0);
    return {
      pendientes: pendientes.length, pendientesSoles: suma(pendientes),
      sinArchivo: sinArchivo.length, sinArchivoSoles: suma(sinArchivo),
      enArchivo: enArchivo.length, enArchivoSoles: suma(enArchivo),
      vencidas: vencidas.length, vencidasSoles: suma(vencidas),
      porVencer: porVencer.length, porVencerSoles: suma(porVencer),
      depositadasMes: depositadasMes.length, depositadasMesSoles: suma(depositadasMes),
    };
  }, [filas, pendientes]);

  const visibles = useMemo(() => filas.filter(f => {
    if (vista === 'pendientes' && f.estado !== 'pendiente') return false;
    if (vista === 'depositadas' && f.estado !== 'depositado') return false;
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      if (!`${f.proveedor ?? ''} ${f.rucProveedor ?? ''} ${f.serie ?? ''}-${f.numero ?? ''} ${f.numeroConstancia ?? ''} ${f.lotePagoNumero ?? ''} ${f.archivoBn ?? ''}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [filas, vista, busqueda]);
  const pag = usePagination(visibles, 25);

  const seleccionables = useMemo(() => visibles.filter(f => f.estado === 'pendiente' && !f.archivoBn), [visibles]);
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalSel = useMemo(() => filas.filter(f => sel.has(f.id)).reduce((s, f) => s + f.monto, 0), [filas, sel]);

  const generar = async () => {
    if (sel.size === 0) return;
    if (!window.confirm(`Generar el archivo de pago masivo del Banco de la Nación con ${sel.size} detracción(es) por ${soles0(totalSel)}? Queda numerado con la siguiente secuencia del año.`)) return;
    setOcupado(true);
    try {
      const r = await generarArchivoBn(Array.from(sel));
      toast.success(`${r.nombre} generado: ${r.cantidad} detracciones, ${soles0(r.total)}. Súbelo en SUNAT Operaciones en Línea → Pago masivo de detracciones.`, { duration: 9000 });
      setSel(new Set()); await cargar();
    } catch (e) { toast.error((e as Error).message, { duration: 9000 }); }
    finally { setOcupado(false); }
  };

  const bajarLote = async (l: LoteBn) => {
    try { const c = await contenidoLoteBn(l.id); descargarTxt(c.nombre, c.contenido); }
    catch (e) { toast.error((e as Error).message); }
  };
  const anular = async (l: LoteBn) => {
    if (!window.confirm(`¿Anular ${l.nombreArchivo}? Sus detracciones vuelven a "pendiente sin archivo". Solo si el archivo no se envió al banco.`)) return;
    try { await anularLoteBn(l.id); toast.success('Archivo anulado'); await cargar(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const elegirArchivo = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      const f = await leerConstancias(archivo);
      if (f.length === 0) { toast.error('El archivo no trae constancias'); return; }
      setImportando({ archivo: archivo.name, filas: f });
    } catch (e) { toast.error((e as Error).message); }
  };
  const confirmarImportacion = async () => {
    if (!importando) return;
    setOcupado(true);
    try {
      const r = await importarConstancias(importando.filas);
      toast.success(`Constancias: ${r.cerradas} pendientes cerradas, ${r.nuevas} depósitos nuevos registrados${r.nuevasSinComprobante ? ` (${r.nuevasSinComprobante} sin factura en el ERP)` : ''}, ${r.yaRegistradas} ya estaban, ${r.saltadas} saltadas.`, { duration: 10000 });
      setImportando(null); await cargar();
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="size-6" /> Detracciones</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Cada pago con detracción deja aquí el depósito pendiente. Se juntan en un archivo para el pago masivo del Banco de la Nación
            (vía SUNAT Operaciones en Línea) y se cierran importando la consulta de constancias de SUNAT. El depósito vence el 5.º día hábil del mes siguiente al pago.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={cargar} title="Actualizar"><RefreshCw className="size-4" /></Button>
          {puedeImportar && (
            <label className="inline-flex">
              <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.txt" onChange={e => { elegirArchivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-accent"><Upload className="size-4" /> Importar constancias SUNAT</span>
            </label>
          )}
          {puedeGenerar && (
            <Button disabled={sel.size === 0 || ocupado} onClick={generar}>
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Generar archivo BN ({sel.size}{sel.size ? ` · ${soles0(totalSel)}` : ''})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi titulo="Pendientes de depósito" n={kpi.pendientes} monto={kpi.pendientesSoles} />
        <Kpi titulo="Sin archivo generado" n={kpi.sinArchivo} monto={kpi.sinArchivoSoles} />
        <Kpi titulo="En archivo, sin constancia" n={kpi.enArchivo} monto={kpi.enArchivoSoles} />
        <Kpi titulo="Vencidas / vencen en 7 días" n={kpi.vencidas + kpi.porVencer} monto={kpi.vencidasSoles + kpi.porVencerSoles} alerta={kpi.vencidas > 0} nota={kpi.vencidas ? `${kpi.vencidas} vencida(s)` : undefined} />
        <Kpi titulo="Depositadas este mes" n={kpi.depositadasMes} monto={kpi.depositadasMesSoles} />
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Detracciones ({visibles.length})</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {(['pendientes', 'depositadas', 'todas'] as Vista[]).map(v => (
              <Button key={v} size="sm" variant={vista === v ? 'default' : 'outline'} onClick={() => setVista(v)}>{v === 'pendientes' ? 'Pendientes' : v === 'depositadas' ? 'Depositadas' : 'Todas'}</Button>
            ))}
            <Input className="h-8 w-[240px]" placeholder="Proveedor, RUC, factura, constancia…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {cargando ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr>
                  {puedeGenerar && (
                    <th className="px-2 py-2">
                      <input type="checkbox" title="Marcar las pendientes sin archivo de esta vista"
                        checked={seleccionables.length > 0 && seleccionables.every(f => sel.has(f.id))}
                        onChange={e => setSel(e.target.checked ? new Set(seleccionables.map(f => f.id)) : new Set())} />
                    </th>
                  )}
                  <th className="text-left font-medium px-3 py-2">Proveedor</th>
                  <th className="text-left font-medium px-3 py-2">Comprobante</th>
                  <th className="text-left font-medium px-3 py-2">Bien / servicio</th>
                  <th className="text-right font-medium px-3 py-2">Depósito S/</th>
                  <th className="text-left font-medium px-3 py-2">Pagado</th>
                  <th className="text-left font-medium px-3 py-2">Vence</th>
                  <th className="text-left font-medium px-3 py-2">Archivo BN</th>
                  <th className="text-left font-medium px-3 py-2">Constancia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pag.paged.map(f => {
                  const faltaCuenta = f.estado === 'pendiente' && !f.cuentaDetraccion;
                  const faltaDoc = f.estado === 'pendiente' && (!f.serie || !f.numero);
                  return (
                    <tr key={f.id} className={f.vencida ? 'bg-red-50/40 dark:bg-red-950/20' : ''}>
                      {puedeGenerar && (
                        <td className="px-2 py-1.5">
                          {f.estado === 'pendiente' && !f.archivoBn && <input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} />}
                        </td>
                      )}
                      <td className="px-3 py-1.5 max-w-[240px]">
                        <div className="truncate font-medium" title={f.proveedor ?? ''}>{f.proveedor ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{f.rucProveedor ?? ''}{f.cuentaDetraccion ? ` · BN ${f.cuentaDetraccion}` : ''}</div>
                        {faltaCuenta && <div className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="size-3" /> Sin cuenta de detracciones del proveedor</div>}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div>{f.serie && f.numero ? `${f.serie}-${f.numero}` : (f.comprobanteNumero ?? <span className="text-amber-700">sin comprobante</span>)}</div>
                        <div className="text-xs text-muted-foreground">{f.periodo ? `periodo ${f.periodo}` : ''}{f.lotePagoNumero ? ` · ${f.lotePagoNumero}` : ''}{f.origen === 'sunat' ? ' · de SUNAT' : ''}</div>
                        {faltaDoc && <div className="text-xs text-amber-700">Falta serie o número</div>}
                      </td>
                      <td className="px-3 py-1.5 text-xs max-w-[200px]"><span className="font-mono">{f.codigo ?? '—'}</span> <span className="text-muted-foreground truncate" title={f.bienServicio ?? ''}>{f.bienServicio ?? ''}</span>{f.tasa != null && <div className="text-muted-foreground">{(f.tasa * 100).toLocaleString('es-PE')} %{f.base != null ? ` de ${f.monedaOrigen === 'USD' ? 'US$' : 'S/'} ${f.base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}</div>}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">{soles2(f.monto)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{fecha(f.fechaPagoProveedor)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                        {f.estado === 'pendiente' ? (<>{fecha(f.vence)}{f.vencida && <Badge variant="destructive" className="ml-1 text-[10px]">vencida</Badge>}</>) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs whitespace-nowrap">{f.archivoBn ? <><div className="font-mono">{f.archivoBn}</div><div className="text-muted-foreground">{fecha(f.archivoGeneradoEn)}</div></> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                        {f.estado === 'depositado' ? (
                          <div className="text-green-700 dark:text-green-300 flex items-center gap-1"><CheckCircle2 className="size-3" /> {f.numeroConstancia ?? 'depositada'}<span className="text-muted-foreground"> · {fecha(f.fechaDeposito)}</span></div>
                        ) : <Badge variant="outline" className="text-[10px]">pendiente</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {pag.paged.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    {vista === 'pendientes' ? 'No hay detracciones pendientes. Nacen al marcar pagada una línea con detracción en un lote de pago.' : 'Nada con estos filtros.'}
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

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Archivos enviados al Banco de la Nación</CardTitle>
          <p className="text-xs text-muted-foreground">Nombre D + RUC + año + secuencia, como lo exige el pago masivo. Se puede volver a descargar; anular solo si no se envió.</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/30">
              <tr><th className="text-left font-medium px-3 py-2">Archivo</th><th className="text-right font-medium px-3 py-2">Detracciones</th><th className="text-right font-medium px-3 py-2">Total S/</th><th className="text-left font-medium px-3 py-2">Generado</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody className="divide-y">
              {lotes.map(l => (
                <tr key={l.id} className={l.anuladoEn ? 'text-muted-foreground line-through' : ''}>
                  <td className="px-3 py-1.5 font-mono">{l.nombreArchivo}{l.anuladoEn && <Badge variant="outline" className="ml-2 text-[10px] no-underline">anulado</Badge>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.cantidad}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{soles2(l.totalSoles)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{new Date(l.generadoEn).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {!l.anuladoEn && <Button size="sm" variant="outline" onClick={() => bajarLote(l)}><FileDown className="size-4" /> Descargar</Button>}
                    {!l.anuladoEn && puedeGenerar && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => anular(l)} title="Anular (si no se envió)"><XCircle className="size-4" /></Button>}
                  </td>
                </tr>
              ))}
              {lotes.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Aún no se generó ningún archivo.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {importando && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setImportando(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importar constancias de SUNAT</DialogTitle>
              <DialogDescription>{importando.archivo}: {importando.filas.length} constancia(s). Las que coincidan con una detracción pendiente (RUC + comprobante, o RUC + monto + periodo) la cierran; las demás se registran como depósitos hechos fuera del ERP.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0"><tr><th className="text-left px-2 py-1">Constancia</th><th className="text-left px-2 py-1">RUC</th><th className="text-left px-2 py-1">Proveedor</th><th className="text-left px-2 py-1">Comprobante</th><th className="text-left px-2 py-1">Periodo</th><th className="text-left px-2 py-1">Fecha</th><th className="text-right px-2 py-1">Monto</th></tr></thead>
                <tbody className="divide-y">
                  {importando.filas.slice(0, 300).map((f, i) => (
                    <tr key={i}><td className="px-2 py-1 font-mono">{f.constancia}</td><td className="px-2 py-1">{f.ruc}</td><td className="px-2 py-1 truncate max-w-[220px]">{f.proveedor}</td><td className="px-2 py-1">{f.serie}-{f.numero}</td><td className="px-2 py-1">{f.periodo}</td><td className="px-2 py-1">{f.fecha}</td><td className="px-2 py-1 text-right tabular-nums">{f.monto}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportando(null)}>Cancelar</Button>
              <Button disabled={ocupado} onClick={confirmarImportacion}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : `Importar ${importando.filas.length}`}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Kpi({ titulo, n, monto, alerta, nota }: { titulo: string; n: number; monto: number; alerta?: boolean; nota?: string }) {
  return (
    <Card className={alerta ? 'border-red-300/70' : ''}><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`text-xl font-bold tabular-nums ${alerta ? 'text-red-600' : ''}`}>{soles0(monto)}</p>
      <p className="text-xs text-muted-foreground">{n} detracción(es){nota ? ` · ${nota}` : ''}</p>
    </CardContent></Card>
  );
}
