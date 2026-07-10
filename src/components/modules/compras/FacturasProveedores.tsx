/**
 * Compras → Facturas de Proveedores (Fase C del portal).
 * Bandeja interna: facturas recibidas (portal o registro manual), conformidad
 * cruzando con la recepción, observación con motivo, programación de pago y
 * pago. El saldo de facturación por OC sale de v_oc_saldo_facturacion.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Search, X, RefreshCw, CheckCircle2, AlertTriangle, FileDown, CalendarClock, BadgeCheck } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PageNav } from '../../shared/PageNav';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { usePagination } from '../../../lib/shared/usePagination';

interface Props { onNavigate: (route: string) => void; }

interface FacturaRow {
  id: string;
  numeroCompleto: string;
  fechaEmision: string | null;
  proveedorNombre: string;
  proveedorRuc: string | null;
  ordenNumero: string | null;
  ordenId: string | null;
  total: number;
  moneda: string;
  estadoFlujo: string;
  motivoObservacion: string | null;
  xmlPath: string | null;
  pdfPath: string | null;
  subidoPorProveedor: boolean;
  creadoEn: string;
}

interface RecepcionOpcion { id: string; numero: string; fecha: string | null; estado: string; }

const ESTADOS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  recibida: { label: 'Recibida', variant: 'outline' },
  validada: { label: 'Validada', variant: 'secondary' },
  observada: { label: 'Observada', variant: 'destructive' },
  conforme: { label: 'Conforme', variant: 'default' },
  programada_pago: { label: 'Prog. pago', variant: 'default' },
  pagada: { label: 'Pagada', variant: 'default' },
  anulada: { label: 'Anulada', variant: 'destructive' },
};

const fmt = (monto: number, moneda: string) =>
  `${moneda === 'USD' ? 'US$' : 'S/'} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FacturasProveedores({ onNavigate }: Props) {
  const { user } = useAuth();
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('pendientes');

  // Diálogos
  const [conformidadDe, setConformidadDe] = useState<FacturaRow | null>(null);
  const [recepciones, setRecepciones] = useState<RecepcionOpcion[]>([]);
  const [recepcionSel, setRecepcionSel] = useState('');
  const [observarDe, setObservarDe] = useState<FacturaRow | null>(null);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comprobantes_pago')
      .select('id, numero_completo, fecha_emision, total, moneda, estado_flujo, motivo_observacion, xml_path, pdf_path, subido_por_proveedor, creado_en, orden_compra_numero, orden_compra_id, ruc_emisor, razon_social_emisor')
      .eq('direccion', 'recibido')
      .order('creado_en', { ascending: false })
      .limit(1000);
    if (error) {
      console.error('[FACTURAS-PROV] Error al cargar:', error.message);
      toast.error('No se pudieron cargar las facturas');
    } else {
      setFacturas((data ?? []).map((r: any): FacturaRow => ({
        id: r.id,
        numeroCompleto: r.numero_completo,
        fechaEmision: r.fecha_emision,
        proveedorNombre: r.razon_social_emisor ?? '—',
        proveedorRuc: r.ruc_emisor,
        ordenNumero: r.orden_compra_numero,
        ordenId: r.orden_compra_id,
        total: Number(r.total ?? 0),
        moneda: r.moneda ?? 'PEN',
        estadoFlujo: r.estado_flujo ?? 'recibida',
        motivoObservacion: r.motivo_observacion,
        xmlPath: r.xml_path,
        pdfPath: r.pdf_path,
        subidoPorProveedor: r.subido_por_proveedor ?? false,
        creadoEn: r.creado_en,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => facturas.filter(f => {
    if (filtroEstado === 'pendientes' && !['recibida', 'validada'].includes(f.estadoFlujo)) return false;
    if (filtroEstado !== 'todas' && filtroEstado !== 'pendientes' && f.estadoFlujo !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (![f.numeroCompleto, f.proveedorNombre, f.proveedorRuc, f.ordenNumero]
        .some(x => x && String(x).toLowerCase().includes(q))) return false;
    }
    return true;
  }), [facturas, filtroEstado, busqueda]);

  const { paged, page, totalPages, setPage } = usePagination(filtradas);

  const pendientes = facturas.filter(f => ['recibida', 'validada'].includes(f.estadoFlujo));
  const conformes = facturas.filter(f => f.estadoFlujo === 'conforme');
  const observadas = facturas.filter(f => f.estadoFlujo === 'observada');

  const actualizarEstado = async (id: string, cambios: Record<string, unknown>, exito: string) => {
    setTrabajando(true);
    const { error } = await supabase.from('comprobantes_pago').update(cambios).eq('id', id);
    setTrabajando(false);
    if (error) { toast.error(`No se pudo actualizar: ${error.message}`); return false; }
    toast.success(exito);
    cargar();
    return true;
  };

  const abrirConformidad = async (f: FacturaRow) => {
    setConformidadDe(f);
    setRecepcionSel('');
    setRecepciones([]);
    if (f.ordenId) {
      const { data } = await supabase
        .from('recepciones')
        .select('id, numero, fecha_recepcion, estado')
        .eq('orden_id', f.ordenId)
        .order('fecha_recepcion', { ascending: false });
      setRecepciones((data ?? []).map((r: any) => ({ id: r.id, numero: r.numero, fecha: r.fecha_recepcion, estado: r.estado })));
    }
  };

  const darConformidad = async () => {
    if (!conformidadDe) return;
    const ok = await actualizarEstado(conformidadDe.id, {
      estado_flujo: 'conforme',
      recepcion_id: recepcionSel || null,
      conforme_por: user?.id ?? null,
      conforme_en: new Date().toISOString(),
      motivo_observacion: null,
    }, `Factura ${conformidadDe.numeroCompleto} conforme — cuenta contra el saldo de la orden`);
    if (ok) setConformidadDe(null);
  };

  const observar = async () => {
    if (!observarDe) return;
    if (motivo.trim().length < 10) { toast.error('Describe el motivo (mínimo 10 caracteres) — el proveedor lo verá en su portal'); return; }
    const ok = await actualizarEstado(observarDe.id, {
      estado_flujo: 'observada',
      motivo_observacion: motivo.trim(),
    }, `Factura ${observarDe.numeroCompleto} observada — el proveedor verá el motivo`);
    if (ok) { setObservarDe(null); setMotivo(''); }
  };

  const abrirArchivo = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('facturas-proveedores').createSignedUrl(path, 600);
    if (error || !data?.signedUrl) { toast.error('No se pudo abrir el archivo'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

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
            <p className="text-muted-foreground mt-1">
              Bandeja de facturas recibidas por el portal — conformidad, observación y pago
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={cargar} disabled={loading}>
          <RefreshCw className="size-4" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendientes de conformidad</p>
            <p className="text-2xl font-bold">{pendientes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conformes (por pagar)</p>
            <p className="text-2xl font-bold">{conformes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Observadas (esperan al proveedor)</p>
            <p className="text-2xl font-bold">{observadas.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por factura, proveedor, RUC u orden…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-10"
              />
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
              </SelectContent>
            </Select>
          </div>
          {(busqueda || filtroEstado !== 'pendientes') && (
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando <strong>{filtradas.length}</strong> de <strong>{facturas.length}</strong> facturas
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroEstado('pendientes'); }}>
                <X className="size-4" /> Limpiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Archivos</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {filtroEstado === 'pendientes' ? 'No hay facturas pendientes de conformidad' : 'Sin resultados'}
                </TableCell></TableRow>
              ) : paged.map(f => {
                const badge = ESTADOS[f.estadoFlujo] ?? { label: f.estadoFlujo, variant: 'outline' as const };
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <p className="font-mono font-medium">{f.numeroCompleto}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.fechaEmision ?? '—'}{f.subidoPorProveedor ? ' · vía portal' : ' · manual'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium max-w-48 truncate" title={f.proveedorNombre}>{f.proveedorNombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{f.proveedorRuc ?? ''}</p>
                    </TableCell>
                    <TableCell>
                      {f.ordenNumero ? (
                        <button
                          className="font-mono text-sm text-primary hover:underline"
                          onClick={() => onNavigate(`/compras/ordenes/${f.ordenNumero}`)}
                        >
                          {f.ordenNumero}
                        </button>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(f.total, f.moneda)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {f.estadoFlujo === 'observada' && f.motivoObservacion && (
                        <p className="text-xs text-red-600 mt-1 max-w-44">{f.motivoObservacion}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {f.xmlPath && (
                          <Button variant="ghost" size="sm" title="Descargar XML" onClick={() => abrirArchivo(f.xmlPath)}>
                            <FileDown className="size-4" /> XML
                          </Button>
                        )}
                        {f.pdfPath && (
                          <Button variant="ghost" size="sm" title="Ver PDF" onClick={() => abrirArchivo(f.pdfPath)}>
                            <FileDown className="size-4" /> PDF
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {['recibida', 'validada'].includes(f.estadoFlujo) && (
                          <>
                            <Button size="sm" onClick={() => abrirConformidad(f)} disabled={trabajando}>
                              <CheckCircle2 className="size-4" /> Conformidad
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setObservarDe(f); setMotivo(''); }} disabled={trabajando}>
                              <AlertTriangle className="size-4" /> Observar
                            </Button>
                          </>
                        )}
                        {f.estadoFlujo === 'conforme' && (
                          <Button size="sm" variant="outline" disabled={trabajando}
                            onClick={() => actualizarEstado(f.id, { estado_flujo: 'programada_pago' }, `Factura ${f.numeroCompleto} programada de pago`)}>
                            <CalendarClock className="size-4" /> Programar pago
                          </Button>
                        )}
                        {f.estadoFlujo === 'programada_pago' && (
                          <Button size="sm" variant="outline" disabled={trabajando}
                            onClick={() => actualizarEstado(f.id, { estado_flujo: 'pagada' }, `Factura ${f.numeroCompleto} marcada como pagada`)}>
                            <BadgeCheck className="size-4" /> Marcar pagada
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3 border-t">
              <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: conformidad */}
      <Dialog open={!!conformidadDe} onOpenChange={o => !o && setConformidadDe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dar conformidad — {conformidadDe?.numeroCompleto}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La conformidad confirma que lo facturado corresponde a lo recibido. Al confirmarla,
              el monto cuenta contra el saldo de la orden {conformidadDe?.ordenNumero}.
            </p>
            <div>
              <Label className="mb-1.5 block">Recepción asociada (opcional)</Label>
              {recepciones.length === 0 ? (
                <p className="text-sm text-amber-600">
                  Esta orden no tiene recepciones registradas. Puedes dar conformidad directa o
                  registrar primero la recepción en Compras → Recepciones.
                </p>
              ) : (
                <Select value={recepcionSel} onValueChange={setRecepcionSel}>
                  <SelectTrigger><SelectValue placeholder="Selecciona la recepción…" /></SelectTrigger>
                  <SelectContent>
                    {recepciones.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.numero} · {r.fecha ?? 's/f'} · {r.estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConformidadDe(null)}>Cancelar</Button>
            <Button onClick={darConformidad} disabled={trabajando}>
              {trabajando ? 'Guardando…' : 'Confirmar conformidad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: observar */}
      <Dialog open={!!observarDe} onOpenChange={o => !o && setObservarDe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Observar factura — {observarDe?.numeroCompleto}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              El proveedor verá este motivo en su portal, podrá corregir y volver a enviar.
              El monto deja de reservar saldo de la orden.
            </p>
            <div>
              <Label className="mb-1.5 block">Motivo de la observación *</Label>
              <Textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ej.: El monto no coincide con la recepción REC-0012; falta el detalle del ítem 3…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservarDe(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={observar} disabled={trabajando}>
              {trabajando ? 'Guardando…' : 'Observar factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
