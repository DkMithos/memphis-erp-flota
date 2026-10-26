/**
 * Compras → Facturas de Proveedores.
 * Bandeja interna: facturas recibidas (portal, SIRE o registro manual), conformidad
 * (una o varias a la vez), observación con motivo, programación de pago y pago.
 *
 * Rápida a propósito (pedido de Miguelángel, 26/10/2026): se pide SOLO la página que se
 * ve a la vista `v_facturas_proveedores` (que ya trae el pago resumido), el resumen sale
 * de `facturas_resumen()` y el CDC sugerido se consulta solo para las filas visibles.
 * Tras una acción se actualiza la fila en pantalla; no se vuelve a cargar todo.
 * La vista previa (panel lateral) muestra los datos y el PDF, y permite dar conformidad
 * y pasar a la siguiente sin volver a la lista.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistedState } from '../../../lib/shared/usePersistedState';
import { FileText, Search, X, RefreshCw, CheckCircle2, AlertTriangle, FileDown, CalendarClock, BadgeCheck, Upload, Loader2, Eye, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { PageNav } from '../../shared/PageNav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../ui/sheet';
import { Textarea } from '../../ui/textarea';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { exportToExcel } from '../../../lib/shared/export-utils';
import { leerLibroSire, unirHojasSire, importarSire, type FilaSire } from '../../../lib/compras/sire';

interface Props { onNavigate: (route: string) => void; }

interface FacturaRow {
  id: string;
  numeroCompleto: string;
  tipo: string | null;
  fechaEmision: string | null;
  proveedorNombre: string;
  proveedorRuc: string | null;
  ordenNumero: string | null;
  ordenId: string | null;
  subtotal: number;
  igv: number;
  total: number;
  moneda: string;
  tipoCambio: number | null;
  detraccion: number | null;
  retencion: number | null;
  estadoFlujo: string;
  motivoObservacion: string | null;
  xmlPath: string | null;
  pdfPath: string | null;
  subidoPorProveedor: boolean;
  origen: string | null;
  periodoSire: string | null;
  creadoEn: string;
  fechaVencimiento: string | null;
  conformeEn: string | null;
  pagoEstado: string | null;
  montoPagado: number;
  fechaPagado: string | null;
  mesProgramado: string | null;
  cdcCodigo: string | null;
  cdcSugerido: { ccId: string; codigo: string; proyecto: string | null; confianza: number; pagos: number } | null;
  observaciones: string | null;
}

interface Resumen { total: number; pendientes: number; conformes: number; observadas: number; programadas: number; pagadas: number; historicas: number; por_pagar: Record<string, number>; pagado: Record<string, number> }
interface RecepcionOpcion { id: string; numero: string; fecha: string | null; estado: string; }

const ESTADOS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  recibida: { label: 'Recibida', variant: 'outline' },
  validada: { label: 'Validada', variant: 'secondary' },
  observada: { label: 'Observada', variant: 'destructive' },
  conforme: { label: 'Conforme', variant: 'default' },
  programada_pago: { label: 'Prog. pago', variant: 'default' },
  pagada: { label: 'Pagada', variant: 'default' },
  anulada: { label: 'Anulada', variant: 'destructive' },
  historica: { label: 'Histórica (SIRE)', variant: 'outline' },
};
const PENDIENTES = ['recibida', 'validada'];
const POR_PAGINA = 20;

const fmt = (monto: number, moneda: string) =>
  `${moneda === 'USD' ? 'US$' : 'S/'} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtMonedas = (m: Record<string, number> | undefined) => m && Object.keys(m).length ? Object.entries(m).map(([k, v]) => fmt(Number(v), k)).join(' · ') : '—';

function aFila(r: any): FacturaRow {
  return {
    id: r.id, numeroCompleto: r.numero_completo, tipo: r.tipo ?? null, fechaEmision: r.fecha_emision,
    proveedorNombre: r.razon_social_emisor ?? '—', proveedorRuc: r.ruc_emisor, ordenNumero: r.orden_compra_numero, ordenId: r.orden_compra_id,
    subtotal: Number(r.subtotal ?? 0), igv: Number(r.igv ?? 0), total: Number(r.total ?? 0), moneda: r.moneda ?? 'PEN', tipoCambio: r.tipo_cambio != null ? Number(r.tipo_cambio) : null,
    detraccion: r.tiene_detraccion ? Number(r.detraccion_monto ?? 0) : null, retencion: r.tiene_retencion ? Number(r.retencion_monto ?? 0) : null,
    estadoFlujo: r.estado_flujo ?? 'recibida', motivoObservacion: r.motivo_observacion, xmlPath: r.xml_path, pdfPath: r.pdf_path,
    subidoPorProveedor: r.subido_por_proveedor ?? false, origen: r.origen ?? null, periodoSire: r.periodo_sire ?? null, creadoEn: r.creado_en,
    fechaVencimiento: r.fecha_vencimiento ?? r.vence_compromiso ?? null, conformeEn: r.conforme_en ?? null,
    pagoEstado: r.estado_flujo === 'pagada' ? 'PAGADO' : (r.pago_estado ?? null),
    montoPagado: Number(r.monto_pagado ?? 0) > 0 ? Number(r.monto_pagado) : (r.estado_flujo === 'pagada' ? Number(r.total ?? 0) : 0),
    fechaPagado: r.fecha_pagado ?? null, mesProgramado: r.mes_programado ?? null, cdcCodigo: r.cdc_codigo ?? null, cdcSugerido: null, observaciones: r.observaciones ?? null,
  };
}

/** Arma la consulta a la vista con los filtros de pantalla (los mismos para la página, el total y la exportación). */
function consulta(filtroEstado: string, busqueda: string) {
  let q = supabase.from('v_facturas_proveedores').select('*', { count: 'exact' });
  if (filtroEstado === 'pendientes') q = q.in('estado_flujo', PENDIENTES);
  else if (filtroEstado !== 'todas') q = q.eq('estado_flujo', filtroEstado);
  const t = busqueda.trim().replace(/[%_,()]/g, '');
  if (t) q = q.or(['numero_completo', 'razon_social_emisor', 'ruc_emisor', 'orden_compra_numero'].map(c => `${c}.ilike.%${t}%`).join(','));
  return q.order('fecha_emision', { ascending: false, nullsFirst: false }).order('creado_en', { ascending: false });
}

export function FacturasProveedores({ onNavigate }: Props) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const puedeGestionar = can('compras', 'editar');
  const puedeExportar = can('compras', 'exportar');
  const puedeImportarSire = can('compras', 'editar') || can('contabilidad', 'editar') || can('finanzas', 'lotes_validar');

  const [filas, setFilas] = useState<FacturaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [busqueda, setBusqueda] = usePersistedState('facturas.busqueda', '');
  const [busquedaLista, setBusquedaLista] = useState(busqueda);
  const [filtroEstado, setFiltroEstado] = usePersistedState('facturas.filtroEstado', 'pendientes');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [trabajando, setTrabajando] = useState(false);

  // Diálogos
  const [conformidadDe, setConformidadDe] = useState<FacturaRow[] | null>(null);
  const [recepciones, setRecepciones] = useState<RecepcionOpcion[]>([]);
  const [recepcionSel, setRecepcionSel] = useState('');
  const [observarDe, setObservarDe] = useState<FacturaRow | null>(null);
  const [motivo, setMotivo] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  // La búsqueda espera 350 ms a que termine de escribir antes de ir a la base.
  useEffect(() => { const t = setTimeout(() => setBusquedaLista(busqueda), 350); return () => clearTimeout(t); }, [busqueda]);
  useEffect(() => { setPagina(1); setSeleccion(new Set()); }, [busquedaLista, filtroEstado]);

  const cargarResumen = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('facturas_resumen');
    if (!error && data) setResumen(data as Resumen);
  }, []);

  const peticion = useRef(0);
  const cargarPagina = useCallback(async () => {
    const n = ++peticion.current;
    setLoading(true);
    const desde = (pagina - 1) * POR_PAGINA;
    const { data, error, count } = await consulta(filtroEstado, busquedaLista).range(desde, desde + POR_PAGINA - 1);
    if (n !== peticion.current) return; // llegó una petición más nueva
    if (error) { toast.error('No se pudieron cargar las facturas: ' + error.message); setLoading(false); return; }
    const rows = (data ?? []).map(aFila);
    // CDC sugerido solo para las filas visibles sin centro de costo (la vista es cara: ~0.5 s por llamada).
    const sinCdc = rows.filter(r => !r.cdcCodigo).map(r => r.id);
    if (sinCdc.length) {
      const { data: sg } = await (supabase.from('v_facturas_cdc_sugerido') as any)
        .select('comprobante_id, centro_costo_id, cdc_codigo, proyecto_codigo, pagos, confianza').in('comprobante_id', sinCdc) as { data: any[] | null };
      const m = new Map<string, FacturaRow['cdcSugerido']>();
      (sg ?? []).forEach(x => m.set(x.comprobante_id, { ccId: x.centro_costo_id, codigo: x.cdc_codigo, proyecto: x.proyecto_codigo ?? null, confianza: Number(x.confianza ?? 0), pagos: Number(x.pagos ?? 0) }));
      rows.forEach(r => { r.cdcSugerido = m.get(r.id) ?? null; });
    }
    if (n !== peticion.current) return;
    setFilas(rows); setTotal(count ?? 0); setLoading(false);
  }, [pagina, filtroEstado, busquedaLista]);

  useEffect(() => { void cargarPagina(); }, [cargarPagina]);
  useEffect(() => { void cargarResumen(); }, [cargarResumen]);
  const recargar = async () => { await Promise.all([cargarPagina(), cargarResumen()]); };

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pendientesPagina = useMemo(() => filas.filter(f => PENDIENTES.includes(f.estadoFlujo)), [filas]);
  const seleccionadas = useMemo(() => filas.filter(f => seleccion.has(f.id) && PENDIENTES.includes(f.estadoFlujo)), [filas, seleccion]);

  /** Cambia una factura y la refleja en pantalla sin recargar la lista; el resumen se refresca aparte (es barato). */
  const actualizarEstado = async (id: string, cambios: Record<string, unknown>, exito: string) => {
    setTrabajando(true);
    const { error } = await supabase.from('comprobantes_pago').update(cambios as never).eq('id', id);
    setTrabajando(false);
    if (error) { toast.error(`No se pudo actualizar: ${error.message}`); return false; }
    toast.success(exito);
    aplicarLocal([id], f => ({ ...f, estadoFlujo: (cambios.estado_flujo as string) ?? f.estadoFlujo, motivoObservacion: 'motivo_observacion' in cambios ? (cambios.motivo_observacion as string | null) : f.motivoObservacion, conformeEn: (cambios.conforme_en as string) ?? f.conformeEn }));
    void cargarResumen();
    return true;
  };
  const aplicarLocal = (ids: string[], fn: (f: FacturaRow) => FacturaRow) => {
    setFilas(prev => prev.map(f => ids.includes(f.id) ? fn(f) : f));
    setSeleccion(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n; });
  };

  const abrirConformidad = async (fs: FacturaRow[]) => {
    setConformidadDe(fs); setRecepcionSel(''); setRecepciones([]);
    if (fs.length === 1 && fs[0].ordenId) {
      const { data } = await supabase.from('recepciones').select('id, numero, fecha_recepcion, estado').eq('orden_id', fs[0].ordenId).order('fecha_recepcion', { ascending: false });
      setRecepciones((data ?? []).map((r: any) => ({ id: r.id, numero: r.numero, fecha: r.fecha_recepcion, estado: r.estado })));
    }
  };
  /** Conformidad de una o varias en UNA llamada (facturas_conformar). */
  const conformar = async (fs: FacturaRow[], recepcion?: string | null): Promise<boolean> => {
    if (!fs.length) return false;
    setTrabajando(true);
    const { data, error } = await (supabase as any).rpc('facturas_conformar', { p_ids: fs.map(f => f.id), p_recepcion: recepcion || null });
    setTrabajando(false);
    if (error) { toast.error(error.message); return false; }
    const n = Number(data ?? 0);
    toast.success(n === 1 ? `Factura ${fs[0].numeroCompleto} conforme — cuenta contra el saldo de la orden` : `${n} facturas conformes`);
    aplicarLocal(fs.map(f => f.id), f => ({ ...f, estadoFlujo: 'conforme', conformeEn: new Date().toISOString(), motivoObservacion: null }));
    void cargarResumen();
    return true;
  };
  const darConformidad = async () => {
    if (!conformidadDe) return;
    if (await conformar(conformidadDe, recepcionSel)) setConformidadDe(null);
  };
  const observar = async () => {
    if (!observarDe) return;
    if (motivo.trim().length < 10) { toast.error('Describe el motivo (mínimo 10 caracteres) — el proveedor lo verá en su portal'); return; }
    const ok = await actualizarEstado(observarDe.id, { estado_flujo: 'observada', motivo_observacion: motivo.trim() }, `Factura ${observarDe.numeroCompleto} observada — el proveedor verá el motivo`);
    if (ok) { setObservarDe(null); setMotivo(''); }
  };
  const aplicarCdc = async (ids: string[], ccId?: string) => {
    if (ids.length === 0) return;
    setTrabajando(true);
    const { data, error } = await (supabase as any).rpc('factura_aplicar_cdc', { p_ids: ids, p_centro_costo: ccId ?? null });
    setTrabajando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Centro de costo asignado a ${data ?? ids.length} factura(s)`);
    await cargarPagina();
  };
  const sugeribles = useMemo(() => filas.filter(f => !f.cdcCodigo && f.cdcSugerido && f.cdcSugerido.confianza >= 0.8), [filas]);

  const urlFirmada = async (path: string | null) => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from('facturas-proveedores').createSignedUrl(path, 600);
    return error ? null : data?.signedUrl ?? null;
  };
  const abrirArchivo = async (path: string | null) => {
    const u = await urlFirmada(path);
    if (!u) { toast.error('No se pudo abrir el archivo'); return; }
    window.open(u, '_blank', 'noopener');
  };

  /** Exporta TODO lo filtrado (no solo la página): se trae por bloques de 1,000 al momento de exportar. */
  const exportar = async () => {
    if (!puedeExportar) return;
    setExportando(true);
    try {
      const todas: FacturaRow[] = [];
      for (let d = 0; d < 20000; d += 1000) {
        const { data, error } = await consulta(filtroEstado, busquedaLista).range(d, d + 999);
        if (error) throw new Error(error.message);
        todas.push(...(data ?? []).map(aFila));
        if ((data ?? []).length < 1000) break;
      }
      if (!todas.length) { toast.error('No hay nada que exportar con estos filtros'); return; }
      await exportToExcel(`facturas-proveedores-${new Date().toISOString().slice(0, 10)}`, todas.map(f => ({
        comprobante: f.numeroCompleto, fechaEmision: f.fechaEmision ?? '', ruc: f.proveedorRuc ?? '', proveedor: f.proveedorNombre, orden: f.ordenNumero ?? '', cdc: f.cdcCodigo ?? '',
        moneda: f.moneda, total: f.total, estado: ESTADOS[f.estadoFlujo]?.label ?? f.estadoFlujo, conformeEn: f.conformeEn ? f.conformeEn.slice(0, 10) : '', vence: f.fechaVencimiento ?? '',
        mesProgramado: f.mesProgramado ? f.mesProgramado.slice(0, 7) : '', pagada: f.montoPagado >= f.total - 0.01 && f.total > 0 ? 'Sí' : (f.montoPagado > 0 ? 'Parcial' : 'No'),
        montoPagado: Number(f.montoPagado.toFixed(2)), saldo: Number(Math.max(0, f.total - f.montoPagado).toFixed(2)), fechaPago: f.fechaPagado ?? '', observacion: f.motivoObservacion ?? '', origen: f.origen ?? '',
      })), {
        comprobante: 'Comprobante', fechaEmision: 'Fecha de emisión', ruc: 'RUC', proveedor: 'Proveedor', orden: 'Orden de compra', cdc: 'Centro de costo', moneda: 'Moneda', total: 'Total',
        estado: 'Estado del flujo', conformeEn: 'Conformidad', vence: 'Vencimiento', mesProgramado: 'Mes programado', pagada: 'Pagada', montoPagado: 'Monto pagado', saldo: 'Saldo por pagar',
        fechaPago: 'Fecha de pago', observacion: 'Motivo de observación', origen: 'Origen',
      }, 'Facturas');
      toast.success(`${todas.length} fila(s) exportadas`);
    } catch (e) { toast.error('No se pudo exportar: ' + (e instanceof Error ? e.message : 'error')); }
    finally { setExportando(false); }
  };

  // SIRE de compras
  const [sire, setSire] = useState<{ archivo: string; filas: FilaSire[]; avisos: string[] } | null>(null);
  const [importandoSire, setImportandoSire] = useState(false);
  const elegirSire = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      const union = unirHojasSire(await leerLibroSire(archivo));
      if (union.filas.length === 0) { toast.error(union.avisos.join(' ')); return; }
      setSire({ archivo: `${archivo.name} · ${union.hoja}`, filas: union.filas, avisos: union.avisos });
    } catch (e) { toast.error((e as Error).message); }
  };
  const confirmarSire = async () => {
    if (!sire) return;
    setImportandoSire(true);
    try {
      const r = await importarSire(sire.filas, sire.archivo);
      toast.success(`SIRE: ${r.nuevas} facturas nuevas, ${r.yaExistian} ya estaban, ${r.enlazadas} enlazadas a pagos históricos, ${r.notasCredito} notas de crédito omitidas, ${r.sinProveedor} sin proveedor en el directorio, ${r.saltadas} saltadas.`, { duration: 12000 });
      setSire(null); await recargar();
    } catch (e) { toast.error((e as Error).message); }
    finally { setImportandoSire(false); }
  };

  const todasSeleccionadas = pendientesPagina.length > 0 && pendientesPagina.every(f => seleccion.has(f.id));
  const alternarTodas = (v: boolean) => setSeleccion(v ? new Set(pendientesPagina.map(f => f.id)) : new Set());
  const alternar = (id: string, v: boolean) => setSeleccion(prev => { const n = new Set(prev); if (v) n.add(id); else n.delete(id); return n; });

  const previewIdx = previewId ? filas.findIndex(f => f.id === previewId) : -1;
  const preview = previewIdx >= 0 ? filas[previewIdx] : null;

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <FileText className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Facturas de Proveedores</h2>
            <p className="text-muted-foreground mt-1">Bandeja de facturas recibidas — vista previa, conformidad (una o varias), observación y pago</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {puedeImportarSire && (
            <label className="inline-flex">
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => { elegirSire(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-accent"><Upload className="size-4" /> Importar SIRE</span>
            </label>
          )}
          {puedeGestionar && sugeribles.length > 0 && (
            <Button variant="outline" disabled={trabajando} title="Asigna a cada factura visible el centro de costo habitual de su proveedor cuando el historial lo respalda en un 80 % o más"
              onClick={() => { if (window.confirm(`¿Asignar el CDC sugerido a ${sugeribles.length} factura(s) de esta página con confianza ≥ 80 %?`)) aplicarCdc(sugeribles.map(f => f.id)); }}>
              <BadgeCheck className="size-4" /> Aplicar CDC sugerido ({sugeribles.length})
            </Button>
          )}
          <Button variant="outline" onClick={exportar} disabled={!puedeExportar || exportando || total === 0} title={!puedeExportar ? 'No tienes permiso para exportar este módulo' : `Exporta las ${total} facturas filtradas`}>
            <Download className="size-4" /> {exportando ? 'Exportando…' : `Exportar (${total})`}
          </Button>
          <Button variant="outline" onClick={recargar} disabled={loading}><RefreshCw className="size-4" /> Actualizar</Button>
        </div>
      </div>

      {/* KPIs: salen de facturas_resumen(), una sola llamada */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi texto="Pendientes de conformidad" valor={resumen?.pendientes} onClick={() => setFiltroEstado('pendientes')} activo={filtroEstado === 'pendientes'} />
        <Kpi texto="Conformes (por pagar)" valor={resumen?.conformes} onClick={() => setFiltroEstado('conforme')} activo={filtroEstado === 'conforme'} />
        <Kpi texto="Observadas (esperan al proveedor)" valor={resumen?.observadas} onClick={() => setFiltroEstado('observada')} activo={filtroEstado === 'observada'} />
        <Kpi texto="Saldo por pagar (conformes y programadas)" valor={fmtMonedas(resumen?.por_pagar)} chico />
        <Kpi texto="Pagado" valor={fmtMonedas(resumen?.pagado)} chico />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por factura, proveedor, RUC u orden…" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-10" />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendientes">Pendientes de conformidad</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="observada">Observadas</SelectItem>
                <SelectItem value="conforme">Conformes</SelectItem>
                <SelectItem value="programada_pago">Programadas de pago</SelectItem>
                <SelectItem value="pagada">Pagadas</SelectItem>
                <SelectItem value="historica">Históricas del SIRE (sin pago identificado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              <strong>{total}</strong> factura(s) con estos filtros{resumen ? ` · ${resumen.total} recibidas en total` : ''}
            </p>
            <div className="flex items-center gap-2">
              {puedeGestionar && seleccionadas.length > 0 && (
                <Button size="sm" disabled={trabajando} onClick={() => abrirConformidad(seleccionadas)}>
                  <CheckCircle2 className="size-4" /> Dar conformidad a {seleccionadas.length} seleccionada(s)
                </Button>
              )}
              {(busqueda || filtroEstado !== 'pendientes') && (
                <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroEstado('pendientes'); }}><X className="size-4" /> Limpiar</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla: solo la página visible */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                {puedeGestionar && <TableHead className="w-8"><Checkbox checked={todasSeleccionadas} disabled={pendientesPagina.length === 0} onCheckedChange={(v: boolean | 'indeterminate') => alternarTodas(v === true)} title="Seleccionar las pendientes de esta página" /></TableHead>}
                <TableHead>Factura</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>CDC</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && filas.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /> Cargando…</TableCell></TableRow>
              ) : filas.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {filtroEstado === 'pendientes' ? 'No hay facturas pendientes de conformidad' : 'Sin resultados'}
                </TableCell></TableRow>
              ) : filas.map(f => {
                const badge = ESTADOS[f.estadoFlujo] ?? { label: f.estadoFlujo, variant: 'outline' as const };
                const pendiente = PENDIENTES.includes(f.estadoFlujo);
                return (
                  <TableRow key={f.id} className={loading ? 'opacity-60' : ''}>
                    {puedeGestionar && <TableCell>{pendiente && <Checkbox checked={seleccion.has(f.id)} onCheckedChange={(v: boolean | 'indeterminate') => alternar(f.id, v === true)} />}</TableCell>}
                    <TableCell>
                      <button className="font-mono font-medium text-left hover:underline" onClick={() => setPreviewId(f.id)} title="Vista previa">{f.numeroCompleto}</button>
                      <p className="text-xs text-muted-foreground">{f.fechaEmision ?? '—'}{f.subidoPorProveedor ? ' · vía portal' : f.origen === 'sire' ? ' · SIRE' : ' · manual'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium max-w-48 truncate" title={f.proveedorNombre}>{f.proveedorNombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{f.proveedorRuc ?? ''}</p>
                    </TableCell>
                    <TableCell>
                      {f.ordenNumero ? <button className="font-mono text-sm text-primary hover:underline" onClick={() => onNavigate(`/compras/ordenes/${f.ordenNumero}`)}>{f.ordenNumero}</button> : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {f.cdcCodigo ? <Badge variant="outline" className="font-mono">{f.cdcCodigo}</Badge>
                        : f.cdcSugerido ? (
                          <div className="space-y-1">
                            <p className="text-muted-foreground" title={`${f.cdcSugerido.pagos} pago(s)/factura(s) del proveedor con este CDC`}>Sugerido: <span className="font-mono text-foreground">{f.cdcSugerido.codigo}</span> · {Math.round(f.cdcSugerido.confianza * 100)} %{f.cdcSugerido.proyecto ? ` · ${f.cdcSugerido.proyecto}` : ''}</p>
                            {puedeGestionar && ['recibida', 'validada', 'conforme', 'programada_pago'].includes(f.estadoFlujo) && (
                              <Button size="sm" variant="ghost" className="h-6 px-2" disabled={trabajando} onClick={() => aplicarCdc([f.id])}>Aplicar</Button>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(f.total, f.moneda)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {f.estadoFlujo === 'observada' && f.motivoObservacion && <p className="text-xs text-red-600 mt-1 max-w-44">{f.motivoObservacion}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{f.fechaVencimiento ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {f.montoPagado > 0 ? (
                        <>
                          <p className="font-medium text-green-700">{f.montoPagado >= f.total - 0.01 ? 'Pagada' : 'Parcial'} · {fmt(f.montoPagado, f.moneda)}</p>
                          {f.fechaPagado && <p className="text-xs text-muted-foreground">{f.fechaPagado}</p>}
                        </>
                      ) : ['conforme', 'programada_pago'].includes(f.estadoFlujo) ? (
                        <p className="text-muted-foreground">Por pagar{f.mesProgramado ? ` · ${f.mesProgramado.slice(0, 7)}` : ''}</p>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" title="Vista previa (datos y PDF)" onClick={() => setPreviewId(f.id)}><Eye className="size-4" /></Button>
                        {f.pdfPath && <Button variant="ghost" size="sm" title="Abrir PDF en otra pestaña" onClick={() => abrirArchivo(f.pdfPath)}><FileDown className="size-4" /> PDF</Button>}
                        {puedeGestionar && pendiente && (
                          <>
                            <Button size="sm" onClick={() => abrirConformidad([f])} disabled={trabajando}><CheckCircle2 className="size-4" /> Conformidad</Button>
                            <Button size="sm" variant="outline" onClick={() => { setObservarDe(f); setMotivo(''); }} disabled={trabajando}><AlertTriangle className="size-4" /> Observar</Button>
                          </>
                        )}
                        {puedeGestionar && f.estadoFlujo === 'conforme' && (
                          <Button size="sm" variant="outline" disabled={trabajando} onClick={() => actualizarEstado(f.id, { estado_flujo: 'programada_pago' }, `Factura ${f.numeroCompleto} programada de pago`)}>
                            <CalendarClock className="size-4" /> Programar pago
                          </Button>
                        )}
                        {puedeGestionar && f.estadoFlujo === 'programada_pago' && (
                          <Button size="sm" variant="outline" disabled={trabajando} onClick={() => actualizarEstado(f.id, { estado_flujo: 'pagada' }, `Factura ${f.numeroCompleto} marcada como pagada`)}>
                            <BadgeCheck className="size-4" /> Marcar pagada
                          </Button>
                        )}
                        {puedeGestionar && f.estadoFlujo === 'historica' && (
                          <>
                            <Button size="sm" variant="outline" disabled={trabajando} onClick={() => actualizarEstado(f.id, { estado_flujo: 'pagada' }, `Factura ${f.numeroCompleto} marcada como pagada fuera del ERP`)}><BadgeCheck className="size-4" /> Ya se pagó</Button>
                            <Button size="sm" variant="outline" disabled={trabajando} onClick={() => actualizarEstado(f.id, { estado_flujo: 'conforme', conforme_en: new Date().toISOString() }, `Factura ${f.numeroCompleto} pasa a Cuentas por pagar`)}><AlertTriangle className="size-4" /> Sigue pendiente</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-2 py-3 border-t">
              <span className="text-sm text-muted-foreground">Mostrando {filas.length} de {total} · página {pagina} de {totalPaginas}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagina === 1 || loading} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={pagina >= totalPaginas || loading} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vista previa: datos + PDF, con conformidad y "siguiente" sin salir */}
      <Sheet open={!!preview} onOpenChange={o => !o && setPreviewId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[min(96vw,1100px)] overflow-y-auto">
          {preview && (
            <PreviewFactura f={preview} puedeGestionar={puedeGestionar} trabajando={trabajando} urlFirmada={urlFirmada}
              anterior={previewIdx > 0 ? () => setPreviewId(filas[previewIdx - 1].id) : undefined}
              siguiente={previewIdx < filas.length - 1 ? () => setPreviewId(filas[previewIdx + 1].id) : undefined}
              onConformar={async () => { if (await conformar([preview])) { const sig = filas.slice(previewIdx + 1).find(x => PENDIENTES.includes(x.estadoFlujo)); if (sig) setPreviewId(sig.id); } }}
              onConformarConRecepcion={() => abrirConformidad([preview])}
              onObservar={() => { setObservarDe(preview); setMotivo(''); }}
              onAbrirOrden={preview.ordenNumero ? () => onNavigate(`/compras/ordenes/${preview.ordenNumero}`) : undefined} />
          )}
        </SheetContent>
      </Sheet>

      {/* Diálogo: conformidad (una o varias) */}
      <Dialog open={!!conformidadDe} onOpenChange={o => !o && setConformidadDe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{conformidadDe && conformidadDe.length > 1 ? `Dar conformidad a ${conformidadDe.length} facturas` : `Dar conformidad — ${conformidadDe?.[0]?.numeroCompleto ?? ''}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La conformidad confirma que lo facturado corresponde a lo recibido. Al confirmarla, el monto cuenta contra el saldo de la orden
              {conformidadDe && conformidadDe.length === 1 && conformidadDe[0].ordenNumero ? ` ${conformidadDe[0].ordenNumero}` : ''} y la factura pasa a Cuentas por pagar.
            </p>
            {conformidadDe && conformidadDe.length > 1 ? (
              <div className="max-h-56 overflow-y-auto rounded-md border text-sm divide-y">
                {conformidadDe.map(f => <div key={f.id} className="px-2 py-1 flex justify-between gap-2"><span className="font-mono">{f.numeroCompleto}</span><span className="truncate text-muted-foreground">{f.proveedorNombre}</span><span className="tabular-nums">{fmt(f.total, f.moneda)}</span></div>)}
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block">Recepción asociada (opcional)</Label>
                {recepciones.length === 0 ? (
                  <p className="text-sm text-amber-600">{conformidadDe?.[0]?.ordenId ? 'Esta orden no tiene recepciones registradas. Puedes dar conformidad directa o registrar primero la recepción en Compras → Recepciones.' : 'La factura no está enlazada a una orden: conformidad directa.'}</p>
                ) : (
                  <Select value={recepcionSel} onValueChange={setRecepcionSel}>
                    <SelectTrigger><SelectValue placeholder="Selecciona la recepción…" /></SelectTrigger>
                    <SelectContent>{recepciones.map(r => <SelectItem key={r.id} value={r.id}>{r.numero} · {r.fecha ?? 's/f'} · {r.estado}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConformidadDe(null)}>Cancelar</Button>
            <Button onClick={darConformidad} disabled={trabajando}>{trabajando ? 'Guardando…' : conformidadDe && conformidadDe.length > 1 ? `Confirmar ${conformidadDe.length}` : 'Confirmar conformidad'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: observar */}
      <Dialog open={!!observarDe} onOpenChange={o => !o && setObservarDe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Observar factura — {observarDe?.numeroCompleto}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">El proveedor verá este motivo en su portal, podrá corregir y volver a enviar. El monto deja de reservar saldo de la orden.</p>
            <div>
              <Label className="mb-1.5 block">Motivo de la observación *</Label>
              <Textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: El monto no coincide con la recepción REC-0012; falta el detalle del ítem 3…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservarDe(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={observar} disabled={trabajando}>{trabajando ? 'Guardando…' : 'Observar factura'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sire && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setSire(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importar SIRE de compras</DialogTitle>
              <DialogDescription>
                {sire.archivo}: {sire.filas.length} filas ({sire.filas.filter(f => f.tipo === '01' || f.tipo === '03').length} facturas/boletas, {sire.filas.filter(f => f.tipo === '07' || f.tipo === '08').length} notas de crédito/débito que se omiten).
                Las que ya existen (misma serie y número) no se duplican. Las nuevas entran como "conforme"; si un pago histórico las menciona, quedan pagadas.
                {sire.avisos.length > 0 && <span className="text-amber-700"> {sire.avisos.join(' ')}</span>}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0"><tr><th className="text-left px-2 py-1">Fecha</th><th className="text-left px-2 py-1">Tipo</th><th className="text-left px-2 py-1">Comprobante</th><th className="text-left px-2 py-1">RUC</th><th className="text-left px-2 py-1">Proveedor</th><th className="text-right px-2 py-1">Total</th><th className="text-left px-2 py-1">Det.</th></tr></thead>
                <tbody className="divide-y">
                  {sire.filas.slice(0, 400).map((f, i) => (
                    <tr key={i} className={f.tipo === '07' || f.tipo === '08' ? 'text-muted-foreground line-through' : ''}>
                      <td className="px-2 py-1 whitespace-nowrap">{f.fecha_emision}</td><td className="px-2 py-1">{f.tipo}</td><td className="px-2 py-1 font-mono">{f.serie}-{f.numero}</td><td className="px-2 py-1">{f.ruc}</td><td className="px-2 py-1 truncate max-w-[240px]">{f.razon_social}</td><td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{f.moneda} {f.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td><td className="px-2 py-1">{f.detraccion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSire(null)}>Cancelar</Button>
              <Button disabled={importandoSire} onClick={confirmarSire}>{importandoSire ? <Loader2 className="size-4 animate-spin" /> : `Importar ${sire.filas.filter(f => f.tipo !== '07' && f.tipo !== '08').length}`}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Kpi({ texto, valor, onClick, activo, chico }: { texto: string; valor: number | string | undefined; onClick?: () => void; activo?: boolean; chico?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-lg border bg-card p-4 transition ${onClick ? 'hover:bg-accent/40' : 'cursor-default'} ${activo ? 'ring-2 ring-primary/40' : ''}`}>
      <p className="text-xs text-muted-foreground">{texto}</p>
      <p className={chico ? 'text-lg font-bold' : 'text-2xl font-bold'}>{valor === undefined ? <Loader2 className="size-4 animate-spin inline" /> : valor}</p>
    </button>
  );
}

/** Panel lateral: datos de la factura a la izquierda y el PDF a la derecha; conformidad y siguiente sin volver a la lista. */
function PreviewFactura({ f, puedeGestionar, trabajando, urlFirmada, anterior, siguiente, onConformar, onConformarConRecepcion, onObservar, onAbrirOrden }: {
  f: FacturaRow; puedeGestionar: boolean; trabajando: boolean; urlFirmada: (p: string | null) => Promise<string | null>;
  anterior?: () => void; siguiente?: () => void; onConformar: () => Promise<void>; onConformarConRecepcion: () => void; onObservar: () => void; onAbrirOrden?: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(false);
  useEffect(() => {
    let vivo = true; setPdfUrl(null);
    if (!f.pdfPath) return;
    setCargandoPdf(true);
    urlFirmada(f.pdfPath).then(u => { if (vivo) { setPdfUrl(u); setCargandoPdf(false); } });
    return () => { vivo = false; };
  }, [f.id, f.pdfPath, urlFirmada]);
  const badge = ESTADOS[f.estadoFlujo] ?? { label: f.estadoFlujo, variant: 'outline' as const };
  const pendiente = PENDIENTES.includes(f.estadoFlujo);
  const Dato = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p><p className={`text-sm ${mono ? 'font-mono' : ''}`}>{v ?? '—'}</p></div>;
  return (
    <div className="space-y-4">
      <SheetHeader>
        <div className="flex items-center justify-between gap-2 pr-8">
          <SheetTitle className="font-mono">{f.numeroCompleto}</SheetTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={!anterior} onClick={anterior} title="Anterior"><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="sm" disabled={!siguiente} onClick={siguiente} title="Siguiente"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <SheetDescription className="flex items-center gap-2 flex-wrap">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span>{f.proveedorNombre}{f.proveedorRuc ? ` · RUC ${f.proveedorRuc}` : ''}</span>
          {f.subidoPorProveedor ? <span>· vía portal</span> : f.origen === 'sire' ? <span>· SIRE {f.periodoSire ?? ''}</span> : null}
        </SheetDescription>
      </SheetHeader>

      {puedeGestionar && (
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
          {pendiente ? (
            <>
              <Button size="sm" disabled={trabajando} onClick={onConformar}><CheckCircle2 className="size-4" /> Dar conformidad y pasar a la siguiente</Button>
              <Button size="sm" variant="outline" disabled={trabajando} onClick={onConformarConRecepcion}>Conformidad con recepción…</Button>
              <Button size="sm" variant="outline" disabled={trabajando} onClick={onObservar}><AlertTriangle className="size-4" /> Observar</Button>
            </>
          ) : <span className="text-sm text-muted-foreground self-center">Esta factura ya no está pendiente de conformidad.</span>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Dato k="Emisión" v={f.fechaEmision} />
            <Dato k="Vencimiento" v={f.fechaVencimiento} />
            <Dato k="Tipo" v={f.tipo === '01' ? 'Factura' : f.tipo === '03' ? 'Boleta' : f.tipo} />
            <Dato k="Moneda" v={f.moneda + (f.tipoCambio && f.moneda !== 'PEN' ? ` · TC ${f.tipoCambio}` : '')} />
            <Dato k="Subtotal" v={fmt(f.subtotal, f.moneda)} />
            <Dato k="IGV" v={fmt(f.igv, f.moneda)} />
            <div className="col-span-2 rounded-md bg-muted/40 p-2"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p><p className="text-xl font-semibold tabular-nums">{fmt(f.total, f.moneda)}</p></div>
            {f.detraccion != null && <Dato k="Detracción" v={fmt(f.detraccion, f.moneda)} />}
            {f.retencion != null && <Dato k="Retención" v={fmt(f.retencion, f.moneda)} />}
            <Dato k="Orden de compra" v={f.ordenNumero ? <button className="text-primary hover:underline font-mono" onClick={onAbrirOrden}>{f.ordenNumero}</button> : '—'} />
            <Dato k="Centro de costo" v={f.cdcCodigo ?? (f.cdcSugerido ? `sugerido ${f.cdcSugerido.codigo} (${Math.round(f.cdcSugerido.confianza * 100)} %)` : '—')} mono />
            <Dato k="Conformidad" v={f.conformeEn ? f.conformeEn.slice(0, 16).replace('T', ' ') : '—'} />
            <Dato k="Pago" v={f.montoPagado > 0 ? `${fmt(f.montoPagado, f.moneda)}${f.fechaPagado ? ` · ${f.fechaPagado}` : ''}` : f.pagoEstado ?? '—'} />
          </div>
          {f.motivoObservacion && <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-2 text-sm"><b>Observación:</b> {f.motivoObservacion}</div>}
          {f.observaciones && <div className="text-sm text-muted-foreground">{f.observaciones}</div>}
          <div className="flex gap-2 flex-wrap">
            {f.pdfPath && pdfUrl && <Button size="sm" variant="outline" asChild><a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> PDF en otra pestaña</a></Button>}
            {f.xmlPath && <Button size="sm" variant="outline" onClick={async () => { const u = await urlFirmada(f.xmlPath); if (u) window.open(u, '_blank', 'noopener'); }}><FileDown className="size-4" /> XML</Button>}
          </div>
        </div>
        <div className="min-h-[60vh] rounded-md border bg-muted/20 flex items-center justify-center">
          {f.pdfPath ? (
            cargandoPdf || !pdfUrl ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <iframe title={`PDF ${f.numeroCompleto}`} src={`${pdfUrl}#toolbar=1&view=FitH`} className="w-full h-[78vh] rounded-md" />
          ) : (
            <div className="text-center text-sm text-muted-foreground p-6">
              <FileText className="size-8 mx-auto mb-2 opacity-50" />
              Esta factura no tiene PDF adjunto{f.origen === 'sire' ? ' (viene del SIRE de SUNAT: solo los datos declarados)' : ''}.<br />Los datos de la izquierda son los que se dan por conformes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
