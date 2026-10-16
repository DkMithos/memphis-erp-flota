/**
 * Rendición de viáticos de UN viajero (ERP y app móvil). Cada gasto con fecha,
 * tipo, comprobante y foto (desde el celular abre la cámara). Guarda en borrador,
 * presenta (jefatura → Administración) y muestra el saldo: lo gastado contra el
 * adelanto. Los topes de la política se avisan aquí y los valida la base al presentar.
 */
import { useEffect, useMemo, useState } from 'react';
import { Camera, Plus, Trash2, Loader2, Save, Send, Image as ImageIcon, AlertTriangle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAuth } from '../../../auth/AuthProvider';
import {
  ESTADO_RENDICION, RESULTADO, TIPO_COMPROBANTE, TIPO_GASTO, cargarItemsRendicion, cargarTarifas, guardarRendicion, marcarImpreso, presentarRendicion, soles, subirSustento, tarifaVigente, urlSustento,
  type Pasajero, type Rendicion, type RendicionItem, type Tarifa, type TipoComprobante, type TipoGasto, type Viaje,
} from '../../../lib/viajes/viajes';
import { imprimirFormatoUnico } from '../../../lib/viajes/rendicion-formato';

type Item = RendicionItem & { _k: number; _subiendo?: boolean };
const hoy = () => new Date().toISOString().slice(0, 10);
const nuevoItem = (fecha: string): Item => ({ _k: Date.now() + Math.random(), fecha, tipo_gasto: 'alimentacion', descripcion: '', comprobante_tipo: 'sin_comprobante', comprobante_numero: '', ruc: '', proveedor_nombre: '', moneda: 'PEN', monto: 0, tc: null, sustentado: false, foto_path: null, lugar_origen: '', lugar_destino: '' });

export function RendicionEditor({ viaje, pasajero, rendicion, puedeEditar, compacto = false, onCambio }: {
  viaje: Viaje; pasajero: Pasajero; rendicion: Rendicion | null; puedeEditar: boolean; compacto?: boolean; onCambio: () => void;
}) {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [notas, setNotas] = useState(rendicion?.notas ?? '');
  const [justificacion, setJustificacion] = useState(rendicion?.justificacion ?? '');
  const [banco, setBanco] = useState({ banco: rendicion?.banco ?? '', cuenta: rendicion?.cuenta ?? pasajero.cuenta_abono ?? '', cci: rendicion?.cci ?? '', moneda: rendicion?.moneda_reembolso ?? 'PEN' });
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const editable = puedeEditar && (!rendicion || rendicion.estado === 'borrador' || rendicion.estado === 'observada');

  useEffect(() => {
    cargarTarifas().then(setTarifas).catch(() => setTarifas([]));
    if (rendicion) cargarItemsRendicion(rendicion.id).then(is => setItems(is.map(i => ({ ...i, _k: Math.random() })))).catch(() => setItems([]));
    else setItems([]);
    setNotas(rendicion?.notas ?? ''); setJustificacion(rendicion?.justificacion ?? '');
    setBanco({ banco: rendicion?.banco ?? '', cuenta: rendicion?.cuenta ?? pasajero.cuenta_abono ?? '', cci: rendicion?.cci ?? '', moneda: rendicion?.moneda_reembolso ?? 'PEN' });
  }, [rendicion?.id, rendicion?.estado]);

  const gastado = useMemo(() => items.reduce((s, i) => s + Number(i.monto || 0) * (i.moneda === 'USD' ? Number(i.tc || 0) || 0 : 1), 0), [items]);
  const entregado = Number(pasajero.adelanto_entregado ?? 0);
  const saldo = gastado - entregado;
  const topeAlim = tarifaVigente(tarifas, 'alimentacion', viaje.fecha_salida) * pasajero.dias;
  const topeHosp = tarifaVigente(tarifas, 'hospedaje', viaje.fecha_salida);
  const alim = items.filter(i => i.tipo_gasto === 'alimentacion').reduce((s, i) => s + Number(i.monto || 0), 0);
  const hospMax = Math.max(0, ...items.filter(i => i.tipo_gasto === 'hospedaje').map(i => Number(i.monto || 0)));
  const sinSustento = items.filter(i => ['hospedaje', 'movilidad', 'peaje'].includes(i.tipo_gasto) && !i.sustentado).length;
  const excede = (topeAlim > 0 && alim > topeAlim) || (topeHosp > 0 && hospMax > topeHosp) || sinSustento > 0;

  const set = (k: number, parche: Partial<Item>) => setItems(is => is.map(i => (i._k === k ? { ...i, ...parche } : i)));
  const quitar = (k: number) => setItems(is => is.filter(i => i._k !== k));

  const subirFoto = async (k: number, file: File | undefined) => {
    if (!file || !tenantId) return;
    set(k, { _subiendo: true });
    try {
      const path = await subirSustento(tenantId, viaje.id, file);
      set(k, { foto_path: path, _subiendo: false, sustentado: true });
      const url = await urlSustento(path); if (url) setFotos(f => ({ ...f, [path]: url }));
      toast.success('Foto subida');
    } catch (e) { set(k, { _subiendo: false }); toast.error(`No se pudo subir la foto: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const verFoto = async (path: string) => {
    const url = fotos[path] ?? (await urlSustento(path));
    if (url) { setFotos(f => ({ ...f, [path]: url })); window.open(url, '_blank'); }
  };

  const guardar = async (presentar: boolean) => {
    const validos = items.filter(i => Number(i.monto) > 0);
    if (validos.length === 0 && entregado === 0) { toast.error('Agrega al menos un gasto'); return; }
    if (presentar && excede && !justificacion.trim()) { toast.error('Supera los topes de la política o hay gastos sin sustento: escribe la justificación'); return; }
    setGuardando(true);
    try {
      const r = await guardarRendicion({ viaje_id: viaje.id, pasajero_id: pasajero.id, fecha: hoy(), notas: notas || undefined,
        banco: banco.banco || undefined, cuenta: banco.cuenta || undefined, cci: banco.cci || undefined, moneda_reembolso: banco.moneda,
        items: validos.map(({ _k: _a, _subiendo: _b, ...i }) => { void _a; void _b; return i; }) });
      if (presentar) {
        const p = await presentarRendicion(r.id, justificacion || undefined);
        toast.success(`Rendición presentada · ${RESULTADO[p.resultado] ?? p.resultado} ${soles(Math.abs(p.saldo))}`);
      } else toast.success('Rendición guardada en borrador');
      onCambio();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  const grid = compacto ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 md:grid-cols-6 gap-2';
  const imprimir = async () => {
    if (!rendicion) { toast.error('Guarda la rendición antes de imprimir'); return; }
    const its = await cargarItemsRendicion(rendicion.id).catch(() => [] as RendicionItem[]);
    if (!imprimirFormatoUnico(viaje, pasajero, rendicion, its)) { toast.error('El navegador bloqueó la ventana de impresión'); return; }
    marcarImpreso(rendicion.id).then(onCambio).catch(() => undefined);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {rendicion && <Badge className={ESTADO_RENDICION[rendicion.estado].clase}>{rendicion.numero} · {ESTADO_RENDICION[rendicion.estado].label}</Badge>}
        {!rendicion && <Badge variant="secondary">Sin rendición todavía</Badge>}
        {rendicion && <Button type="button" size="sm" variant="outline" onClick={imprimir}><Printer className="size-4 mr-1" /> Imprimir Formato Único</Button>}
        {rendicion?.papel_recibido_en && <Badge className="bg-emerald-100 text-emerald-900">Papel recibido por Administración</Badge>}
        {rendicion?.estado === 'observada' && rendicion.observacion && <span className="text-red-700 dark:text-red-300">Observación: {rendicion.observacion}</span>}
      </div>
      <div className={compacto ? 'grid grid-cols-3 gap-2 text-center' : 'grid grid-cols-3 gap-3 max-w-lg'}>
        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Adelanto recibido</div><div className="font-semibold">{soles(entregado)}</div></div>
        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Gastado</div><div className="font-semibold">{soles(gastado)}</div></div>
        <div className={`rounded-md border p-2 ${saldo > 0.005 ? 'border-emerald-400' : saldo < -0.005 ? 'border-amber-400' : ''}`}>
          <div className="text-xs text-muted-foreground">{saldo > 0.005 ? 'Empresa reembolsa' : saldo < -0.005 ? 'Trabajador devuelve' : 'Cuadra'}</div><div className="font-semibold">{soles(Math.abs(saldo))}</div>
        </div>
      </div>

      <div className="rounded-md border p-2 text-xs text-muted-foreground">
        Administración recibe la rendición <b>en papel</b>: cuando termines, pulsa "Imprimir Formato Único", fírmalo, adjunta todas las facturas y boletas en el orden del detalle y entrégalo a Carolina. La aprobación final se da con el papel recibido.
      </div>
      <div className="space-y-2">
        {items.map(i => (
          <div key={i._k} className="rounded-md border p-2 space-y-2">
            <div className={grid}>
              <div><Label className="text-xs">Fecha</Label><Input type="date" value={i.fecha} disabled={!editable} onChange={e => set(i._k, { fecha: e.target.value })} /></div>
              <div><Label className="text-xs">Tipo</Label>
                <Select value={i.tipo_gasto} onValueChange={(v: string) => set(i._k, { tipo_gasto: v as TipoGasto })} disabled={!editable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TIPO_GASTO) as TipoGasto[]).map(t => <SelectItem key={t} value={t}>{TIPO_GASTO[t]}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">Monto</Label><Input type="number" step="0.01" inputMode="decimal" value={i.monto || ''} disabled={!editable} onChange={e => set(i._k, { monto: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Moneda</Label>
                <Select value={i.moneda} onValueChange={(v: string) => set(i._k, { moneda: v, tc: v === 'USD' ? (i.tc ?? 3.5) : null })} disabled={!editable}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PEN">S/</SelectItem><SelectItem value="USD">US$</SelectItem></SelectContent>
                </Select></div>
              <div><Label className="text-xs">Comprobante</Label>
                <Select value={i.comprobante_tipo} onValueChange={(v: string) => set(i._k, { comprobante_tipo: v as TipoComprobante, sustentado: v !== 'sin_comprobante' || !!i.foto_path })} disabled={!editable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TIPO_COMPROBANTE) as TipoComprobante[]).map(t => <SelectItem key={t} value={t}>{TIPO_COMPROBANTE[t]}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">N.º comprobante</Label><Input value={i.comprobante_numero ?? ''} disabled={!editable} onChange={e => set(i._k, { comprobante_numero: e.target.value })} placeholder="F001-123" /></div>
            </div>
            <div className={compacto ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-2'}>
              <Input value={i.ruc ?? ''} disabled={!editable} onChange={e => set(i._k, { ruc: e.target.value })} placeholder="RUC" inputMode="numeric" />
              <Input value={i.proveedor_nombre ?? ''} disabled={!editable} onChange={e => set(i._k, { proveedor_nombre: e.target.value })} placeholder="Proveedor" />
              <Input value={i.descripcion ?? ''} disabled={!editable} onChange={e => set(i._k, { descripcion: e.target.value })} placeholder="Detalle (almuerzo, taxi aeropuerto…)" />
              <div className="flex gap-1 items-center">
                {i.foto_path && <Button type="button" variant="outline" size="sm" onClick={() => verFoto(i.foto_path!)} title="Ver foto"><ImageIcon className="size-4" /></Button>}
                {editable && (
                  <label className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm cursor-pointer hover:bg-accent">
                    {i._subiendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}{compacto ? '' : ' Foto'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => subirFoto(i._k, e.target.files?.[0])} />
                  </label>
                )}
                {editable && <Button type="button" variant="ghost" size="sm" onClick={() => quitar(i._k)}><Trash2 className="size-4" /></Button>}
              </div>
            </div>
            {(i.tipo_gasto === 'movilidad' || i.tipo_gasto === 'peaje') && (
              <div className="grid grid-cols-2 gap-2">
                <Input value={i.lugar_origen ?? ''} disabled={!editable} onChange={e => set(i._k, { lugar_origen: e.target.value })} placeholder="Lugar de origen (ej. aeropuerto)" />
                <Input value={i.lugar_destino ?? ''} disabled={!editable} onChange={e => set(i._k, { lugar_destino: e.target.value })} placeholder="Lugar de destino (ej. Gobierno Regional)" />
              </div>
            )}
            {i.moneda === 'USD' && <div className="text-xs text-muted-foreground">TC <Input type="number" step="0.0001" className="inline-block w-24 h-7 ml-1" value={i.tc ?? ''} disabled={!editable} onChange={e => set(i._k, { tc: Number(e.target.value) || null })} /> → {soles(Number(i.monto || 0) * Number(i.tc || 0))}</div>}
            {!editable && i.observacion && <div className="text-xs text-red-700">{i.observacion}</div>}
          </div>
        ))}
        {editable && <Button type="button" variant="outline" className={compacto ? 'w-full' : ''} onClick={() => setItems(is => [...is, nuevoItem(hoy())])}><Plus className="size-4 mr-1" /> Agregar gasto</Button>}
        {!editable && items.length === 0 && <div className="text-sm text-muted-foreground">Sin gastos registrados.</div>}
      </div>

      {excede && (
        <div className="text-sm rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 flex gap-2"><AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <div>
            {topeAlim > 0 && alim > topeAlim && <div>Alimentación {soles(alim)} supera el tope de {soles(topeAlim)} ({pasajero.dias} días × S/ {topeAlim / pasajero.dias}).</div>}
            {topeHosp > 0 && hospMax > topeHosp && <div>Hospedaje {soles(hospMax)} por noche supera el tope de {soles(topeHosp)}.</div>}
            {sinSustento > 0 && <div>{sinSustento} gasto(s) de hospedaje/movilidad sin comprobante.</div>}
            {editable && <Textarea className="mt-2" rows={2} value={justificacion} onChange={e => setJustificacion(e.target.value)} placeholder="Justificación (la jefatura la verá al firmar)" />}
            {!editable && justificacion && <div className="mt-1">Justificación: {justificacion}</div>}
          </div>
        </div>
      )}
      {editable && (
        <div className={compacto ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 md:grid-cols-4 gap-2'}>
          <div><Label className="text-xs">Banco a reembolsar</Label><Input value={banco.banco} onChange={e => setBanco(b => ({ ...b, banco: e.target.value }))} placeholder="BCP / BBVA / Interbank" /></div>
          <div><Label className="text-xs">N.º de cuenta</Label><Input value={banco.cuenta} onChange={e => setBanco(b => ({ ...b, cuenta: e.target.value }))} inputMode="numeric" /></div>
          <div><Label className="text-xs">CCI</Label><Input value={banco.cci} onChange={e => setBanco(b => ({ ...b, cci: e.target.value }))} inputMode="numeric" /></div>
          <div><Label className="text-xs">Moneda a reembolsar</Label>
            <Select value={banco.moneda} onValueChange={(v: string) => setBanco(b => ({ ...b, moneda: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PEN">Soles</SelectItem><SelectItem value="USD">Dólares</SelectItem></SelectContent></Select></div>
        </div>
      )}
      {editable && <Textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas de la rendición" />}
      {editable && (
        <div className={compacto ? 'grid grid-cols-2 gap-2' : 'flex gap-2 justify-end'}>
          <Button variant="outline" onClick={() => guardar(false)} disabled={guardando}><Save className="size-4 mr-1" /> Guardar borrador</Button>
          <Button onClick={() => guardar(true)} disabled={guardando}>{guardando ? <Loader2 className="size-4 animate-spin mr-1" /> : <Send className="size-4 mr-1" />} Presentar</Button>
        </div>
      )}
    </div>
  );
}
