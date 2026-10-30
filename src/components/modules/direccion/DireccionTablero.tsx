/**
 * Dirección › Resumen: el tablero de los socios y Gerencia.
 *
 * Responde, con fecha de corte y rango de fechas elegidos por quien mira: cuánto se debe (hoy y a la fecha de corte),
 * cuánto vence en el rango (lo que deberemos pagar), cuánto se pagó y cobró en el rango, qué hay por cobrar, cuánto se
 * compró y facturó, y cuánto hay en bancos y cajas. Cada cifra tiene su descarga (Excel) con las filas detrás.
 * También muestra lo que le toca firmar a quien mira. Nada se edita aquí: para operar están los módulos.
 */
import { useEffect, useMemo, useState } from 'react';
import { Gauge, Download, FileSignature, RefreshCw, AlertTriangle, Landmark, Wallet, TrendingDown, TrendingUp, Receipt, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { PageNav } from '../../shared/PageNav';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { usePersistedState } from '@/lib/shared/usePersistedState';
import { exportToExcel } from '@/lib/shared/export-utils';
import {
  cargarResumen, cargarDetalle, cargarPorFirmar, rangoDe, hoyISO, soles, dolares, fechaCorta, mesLabel, encabezados,
  PRESETS, ETIQUETA_DETALLE, type Preset, type Resumen, type PorFirmar, type TipoDetalle,
} from '@/lib/direccion/direccion';
import { DireccionNav } from './DireccionNav';

interface Props { onNavigate?: (ruta: string) => void }

function Cifra({ titulo, pen, usd, nota, tono = 'primary', extra }: { titulo: string; pen: number; usd: number; nota?: string; tono?: 'primary' | 'rojo' | 'verde' | 'ambar' | 'gris'; extra?: React.ReactNode }) {
  const borde = { primary: 'border-l-primary', rojo: 'border-l-red-500', verde: 'border-l-emerald-500', ambar: 'border-l-amber-500', gris: 'border-l-slate-400' }[tono];
  return (
    <Card className={`border-l-4 ${borde}`}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{titulo}</p>
        <p className="text-xl font-semibold mt-2 tabular-nums">{soles(pen)}</p>
        <p className="text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{dolares(usd)}</p>
        {nota && <p className="text-xs text-muted-foreground mt-1">{nota}</p>}
        {extra}
      </CardContent>
    </Card>
  );
}

export function DireccionTablero({ onNavigate }: Props) {
  const { can } = usePermissions();
  const [preset, setPreset] = usePersistedState<Preset>('direccion:preset', 'anio');
  const [rango, setRango] = usePersistedState<{ desde: string; hasta: string }>('direccion:rango', rangoDe('anio'));
  const [corte, setCorte] = usePersistedState<string>('direccion:corte', hoyISO());
  const [moneda, setMoneda] = usePersistedState<'PEN' | 'USD'>('direccion:moneda', 'PEN');
  const [r, setR] = useState<Resumen | null>(null);
  const [firmar, setFirmar] = useState<PorFirmar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<TipoDetalle | null>(null);
  const puedeExportar = can('direccion', 'exportar') || can('finanzas', 'exportar');

  const elegirPreset = (p: Preset) => { setPreset(p); if (p !== 'personalizado') setRango(rangoDe(p)); };

  const cargar = async () => {
    setLoading(true); setError(null);
    try {
      const [res, pf] = await Promise.all([cargarResumen(rango.desde, rango.hasta, corte), cargarPorFirmar().catch(() => null)]);
      setR(res); setFirmar(pf);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void cargar(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rango.desde, rango.hasta, corte]);

  const descargar = async (tipo: TipoDetalle) => {
    if (!puedeExportar) { toast.error('Su rol no puede descargar reportes'); return; }
    setDescargando(tipo);
    try {
      const filas = await cargarDetalle(tipo, rango.desde, rango.hasta, corte);
      if (!filas.length) { toast.error('No hay filas para ese reporte en el rango elegido'); return; }
      await exportToExcel(`direccion-${tipo}-${rango.desde}-a-${rango.hasta}`, filas, encabezados(filas) as Record<string, string>, ETIQUETA_DETALLE[tipo].slice(0, 30));
      toast.success(`${filas.length} fila(s) descargadas`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setDescargando(null); }
  };

  const serie = useMemo(() => (r?.serie ?? []).map(s => ({
    mes: mesLabel(s.mes),
    Pagado: moneda === 'PEN' ? s.pagado_pen : s.pagado_usd,
    'Por pagar': moneda === 'PEN' ? s.por_pagar_pen : s.por_pagar_usd,
    Cobrado: moneda === 'PEN' ? s.cobrado_pen : s.cobrado_usd,
  })), [r, moneda]);
  const fmtEje = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)} k` : String(n));
  const fmtMon = (n: number) => (moneda === 'PEN' ? soles(n) : dolares(n));
  const totalFirmar = (firmar?.ordenes.length ?? 0) + (firmar?.viajes.length ?? 0) + (firmar?.rendiciones.length ?? 0);

  const BotonDescarga = ({ tipo }: { tipo: TipoDetalle }) => (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={descargando === tipo} onClick={() => void descargar(tipo)} title={`Descargar ${ETIQUETA_DETALLE[tipo].toLowerCase()} en Excel`}>
      <Download className="size-3.5" /> {descargando === tipo ? 'Preparando…' : 'Excel'}
    </Button>
  );

  return (
    <div className="space-y-5">
      <PageNav />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center"><Gauge className="size-6 text-black dark:text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">Dirección</h1>
            <p className="text-muted-foreground text-sm">Cuánto se debe, cuánto vence, cuánto se pagó y cobró. Elija el corte y el rango; cada cifra se descarga.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</Button>
      </div>

      <DireccionNav actual="/direccion" onNavigate={onNavigate} />

      {/* Corte y rango */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Rango (lo que vence, se pagó y se cobró)</p>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map(p => <Button key={p.id} size="sm" variant={preset === p.id ? 'default' : 'outline'} onClick={() => elegirPreset(p.id)}>{p.label}</Button>)}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div><p className="text-xs text-muted-foreground mb-1">Desde</p><Input type="date" className="h-9 w-[150px]" value={rango.desde} onChange={e => { setPreset('personalizado'); setRango(x => ({ ...x, desde: e.target.value })); }} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">Hasta</p><Input type="date" className="h-9 w-[150px]" value={rango.hasta} onChange={e => { setPreset('personalizado'); setRango(x => ({ ...x, hasta: e.target.value })); }} /></div>
          </div>
          <div><p className="text-xs text-muted-foreground mb-1">Deuda a la fecha de corte</p><Input type="date" className="h-9 w-[150px]" value={corte} onChange={e => setCorte(e.target.value || hoyISO())} /></div>
          {r?.tc_referencia && <p className="text-xs text-muted-foreground ml-auto">TC de referencia {r.tc_referencia.toFixed(3)} · las cifras en soles y dólares no se suman</p>}
        </CardContent>
      </Card>

      {error && <Card className="border-l-4 border-l-red-500"><CardContent className="p-4 text-sm text-red-700">{error}</CardContent></Card>}
      {loading && !r && <p className="text-sm text-muted-foreground">Calculando…</p>}

      {r && (
        <>
          {/* Lo que le toca firmar */}
          {totalFirmar > 0 && (
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="size-4" /> Le toca firmar ({totalFirmar})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Detalle</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Etapa</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {firmar!.ordenes.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium text-sm">OC {o.numero}</TableCell>
                        <TableCell className="text-sm">{o.proveedor ?? '—'}{o.proyecto ? ` · ${o.proyecto}` : ''} · {fechaCorta(o.fecha)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{o.moneda === 'USD' ? dolares(o.total) : soles(o.total)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{o.etapa}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onNavigate?.(`/compras/ordenes/${o.numero}`)}>Revisar y firmar</Button></TableCell>
                      </TableRow>
                    ))}
                    {firmar!.viajes.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-sm">Viaje {v.numero}</TableCell>
                        <TableCell className="text-sm">{v.solicitante ?? '—'} · {v.destino} · sale {fechaCorta(v.fecha_salida)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{soles(v.presupuesto)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{v.estado === 'solicitado' ? 'jefatura' : 'Administración'}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onNavigate?.(`/viajes/${v.id}`)}>Revisar</Button></TableCell>
                      </TableRow>
                    ))}
                    {firmar!.rendiciones.map(x => (
                      <TableRow key={x.id}>
                        <TableCell className="font-medium text-sm">Rendición {x.numero}</TableCell>
                        <TableCell className="text-sm">{x.estado === 'presentada' ? 'por revisar' : 'revisada por jefatura'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{soles(x.gastado)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{x.estado === 'presentada' ? 'jefatura' : 'Administración'}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onNavigate?.(`/viajes/${x.viaje_id}`)}>Revisar</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Deuda */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cuánto se debe</h2>
              <div className="flex gap-1"><BotonDescarga tipo="deuda" /><BotonDescarga tipo="por_pagar" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Cifra titulo="Deuda registrada hoy" pen={r.deuda.hoy.pen} usd={r.deuda.hoy.usd} nota={`${r.deuda.hoy.compromisos} compromisos: facturas, órdenes aprobadas y obligaciones`} />
              <Cifra titulo="Vencido hoy" pen={r.deuda.vencida_hoy.pen} usd={r.deuda.vencida_hoy.usd} nota={`${r.deuda.vencida_hoy.compromisos} ya pasaron su fecha`} tono="rojo" />
              <Cifra titulo={`Deuda al ${fechaCorta(r.corte)}`} pen={r.deuda.al_corte.pen} usd={r.deuda.al_corte.usd} nota="lo que vencía hasta esa fecha y no estaba pagado" tono="gris" />
              <Cifra titulo="Por pagar en el rango" pen={r.deuda.por_pagar_rango.pen} usd={r.deuda.por_pagar_rango.usd}
                nota={`${r.deuda.por_pagar_rango.compromisos} vencen entre ${fechaCorta(r.desde)} y ${fechaCorta(r.hasta)}`} tono="ambar"
                extra={(r.deuda.por_pagar_rango.sin_fecha_pen ?? 0) + (r.deuda.por_pagar_rango.sin_fecha_usd ?? 0) > 0
                  ? <p className="text-xs text-amber-700 mt-1 flex items-center gap-1"><AlertTriangle className="size-3" /> Sin fecha: {soles(r.deuda.por_pagar_rango.sin_fecha_pen)} · {dolares(r.deuda.por_pagar_rango.sin_fecha_usd)}</p> : undefined} />
            </div>
            {r.proyectado && r.proyectado.compromisos > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Aparte, el Excel de flujo proyecta {soles(r.proyectado.pen)} y {dolares(r.proyectado.usd)} más ({r.proyectado.compromisos} líneas estimadas, {soles(r.proyectado.rango_pen)} · {dolares(r.proyectado.rango_usd)} dentro del rango). Es previsión de las áreas, no deuda registrada; no se suma arriba.
              </p>
            )}
          </div>

          {/* Movimiento del rango */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">En el rango: {fechaCorta(r.desde)} a {fechaCorta(r.hasta)}</h2>
              <div className="flex gap-1"><BotonDescarga tipo="pagos" /><BotonDescarga tipo="cobros" /><BotonDescarga tipo="por_cobrar" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Cifra titulo="Pagado" pen={r.tesoreria.pagado_rango.pen} usd={r.tesoreria.pagado_rango.usd} nota={`${r.tesoreria.pagado_rango.pagos} pagos · ≈ ${soles(r.tesoreria.pagado_rango.soles_equiv)} al TC de cada pago`} tono="primary" />
              <Cifra titulo="Cobrado" pen={r.tesoreria.cobrado_rango.pen} usd={r.tesoreria.cobrado_rango.usd} nota={`${r.tesoreria.cobrado_rango.cobros} cobros`} tono="verde" />
              <Cifra titulo="Por cobrar en el rango" pen={r.cobrar.por_cobrar_rango.pen} usd={r.cobrar.por_cobrar_rango.usd} nota={`${r.cobrar.por_cobrar_rango.compromisos} valorizaciones/facturas · total por cobrar ${soles(r.cobrar.por_cobrar_total.pen)}`} tono="verde" />
              <Card className="border-l-4 border-l-slate-400">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wide">Compras y facturas</p><div className="flex gap-1"><BotonDescarga tipo="ordenes" /><BotonDescarga tipo="facturas" /></div></div>
                  <p className="text-sm flex items-center gap-2"><ShoppingBag className="size-4 text-muted-foreground" /> {r.compras.ordenes_rango.cantidad} órdenes · {soles(r.compras.ordenes_rango.pen)} · {dolares(r.compras.ordenes_rango.usd)}</p>
                  <p className="text-sm flex items-center gap-2"><Receipt className="size-4 text-muted-foreground" /> {r.facturas.facturas_rango.cantidad} facturas · {soles(r.facturas.facturas_rango.pen)} · {dolares(r.facturas.facturas_rango.usd)}</p>
                  {(r.facturas.facturas_rango.por_conformar ?? 0) > 0 && <p className="text-xs text-amber-700">{r.facturas.facturas_rango.por_conformar} facturas sin conformar</p>}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gráfico mensual */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Por mes: pagado, por pagar y cobrado</CardTitle>
                <div className="flex gap-1">{(['PEN', 'USD'] as const).map(m => <Button key={m} size="sm" variant={moneda === m ? 'default' : 'outline'} onClick={() => setMoneda(m)}>{m === 'PEN' ? 'Soles' : 'Dólares'}</Button>)}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtEje} tick={{ fontSize: 12 }} width={60} />
                    <Tooltip formatter={(v: number) => fmtMon(v)} />
                    <Legend />
                    <Bar dataKey="Pagado" fill="#0A66C2" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Por pagar" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Cobrado" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bancos y cajas al corte */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Landmark className="size-4" /> Bancos al {fechaCorta(r.corte)}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Extracto hasta</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.bancos.map(b => (
                      <TableRow key={b.cuenta}>
                        <TableCell className="text-sm">{b.cuenta}{!b.saldo_inicial_fijado && <span className="block text-xs text-amber-700">sin saldo inicial fijado</span>}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{b.moneda === 'USD' ? dolares(b.saldo_corte) : soles(b.saldo_corte)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fechaCorta(b.extracto_hasta)}</TableCell>
                      </TableRow>
                    ))}
                    {r.cajas.map(c => (
                      <TableRow key={c.caja}>
                        <TableCell className="text-sm flex items-center gap-2"><Wallet className="size-3.5 text-muted-foreground" /> {c.caja}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{c.moneda === 'USD' ? dolares(c.disponible) : soles(c.disponible)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">caja chica</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground p-3">El saldo de banco sale del saldo inicial más el extracto importado; si el extracto no llega a la fecha de corte, el saldo es el del último extracto.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="size-4" /> A quién se le debe más (hoy)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead className="text-right">S/</TableHead><TableHead className="text-right">US$</TableHead><TableHead>Vence</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.top_proveedores_deuda.map(p => (
                      <TableRow key={p.proveedor}>
                        <TableCell className="text-sm">{p.proveedor} <span className="text-xs text-muted-foreground">({p.compromisos})</span></TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{p.pen ? soles(p.pen) : '—'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{p.usd ? dolares(p.usd) : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fechaCorta(p.vence_primero)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> Dónde se pagó más en el rango (por proyecto)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Proyecto</TableHead><TableHead className="text-right">S/</TableHead><TableHead className="text-right">US$</TableHead><TableHead className="text-right">≈ S/</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.top_proyectos_pagado.map(p => (
                      <TableRow key={p.proyecto}>
                        <TableCell className="text-sm">{p.proyecto}{p.nombre && <span className="block text-xs text-muted-foreground truncate max-w-[260px]">{p.nombre}</span>}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{p.pen ? soles(p.pen) : '—'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{p.usd ? dolares(p.usd) : '—'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{soles(p.soles)}</TableCell>
                      </TableRow>
                    ))}
                    {r.top_proyectos_pagado.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sin pagos en el rango.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> A quién se le pagó más en el rango</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead className="text-right">S/</TableHead><TableHead className="text-right">US$</TableHead><TableHead className="text-right">Pagos</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.top_proveedores_pagado.map(p => (
                      <TableRow key={p.proveedor}>
                        <TableCell className="text-sm">{p.proveedor}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{p.pen ? soles(p.pen) : '—'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{p.usd ? dolares(p.usd) : '—'}</TableCell>
                        <TableCell className="text-right text-sm">{p.pagos}</TableCell>
                      </TableRow>
                    ))}
                    {r.top_proveedores_pagado.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sin pagos en el rango.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">Generado {new Date(r.generado_en).toLocaleString('es-PE')}. Deuda = compromisos de pago registrados (facturas, órdenes aprobadas, obligaciones) menos lo pagado. Lo pagado y cobrado sale de tesorería y del extracto bancario conciliado.</p>
        </>
      )}
    </div>
  );
}
