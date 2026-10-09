/**
 * DESPACHO A PROYECTO y TRANSFERENCIA ENTRE PROYECTOS (sprint 4, pasos 6 y 14
 * del flujo de Kevin). Los ítems salen del almacén general (sin proyecto) o de
 * otro proyecto y entran al proyecto de destino; cada línea deja dos movimientos
 * del kardex con el mismo n.º DSP-AAAA-NNNN. La lógica y la validación de stock
 * viven en `inventario_despachar`.
 */
import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { PageNav } from '../../shared/PageNav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { supabase } from '../../../lib/supabase/client';
import { useInventarioStore } from '../../../lib/inventario/inventario-store';
import { usePagination } from '@/lib/shared/usePagination';

interface Linea { articuloDbId: string; cantidad: string; notas: string }
interface Despacho {
  numero: string; fecha: string; almacen: string | null; motivo: string; proyecto_destino: string | null; proyecto_origen: string | null;
  lineas: number; unidades: number; valor_soles: number; detalle: string | null; realizado_por: string | null; notas: string | null;
}
const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function InventarioDespacho({ onNavigate }: { onNavigate?: (r: string) => void }) {
  const { articulos, almacenes, loading, recargar } = useInventarioStore();
  const almacenesActivos = useMemo(() => almacenes.filter(a => a.estado === 'activo'), [almacenes]);
  const [almacenDbId, setAlmacenDbId] = useState('');
  const [origen, setOrigen] = useState<string | null>(null);          // null = almacén general (sin proyecto)
  const [destino, setDestino] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([{ articuloDbId: '', cantidad: '', notas: '' }]);
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [stock, setStock] = useState<Record<string, number>>({});    // articulo_id → disponible en (almacén, origen)
  const [despachos, setDespachos] = useState<Despacho[]>([]);

  useEffect(() => { if (!almacenDbId && almacenesActivos.length) setAlmacenDbId(almacenesActivos[0]._dbId); }, [almacenesActivos, almacenDbId]);

  const cargarStock = async () => {
    if (!almacenDbId) return;
    const q = supabase.from('stock_almacen').select('articulo_id, cantidad, proyecto_id').eq('almacen_id', almacenDbId);
    const { data } = origen ? await q.eq('proyecto_id', origen) : await q.is('proyecto_id', null);
    const m: Record<string, number> = {};
    for (const r of (data ?? []) as { articulo_id: string; cantidad: number }[]) m[r.articulo_id] = Number(r.cantidad ?? 0);
    setStock(m);
  };
  const cargarDespachos = async () => {
    const { data } = await supabase.from('v_despachos').select('*').order('fecha', { ascending: false }).limit(300);
    setDespachos((data ?? []) as Despacho[]);
  };
  useEffect(() => { void cargarStock(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [almacenDbId, origen]);
  useEffect(() => { void cargarDespachos(); }, []);

  const conStock = useMemo(() => articulos.filter(a => a.activo && (stock[a._dbId] ?? 0) > 0), [articulos, stock]);
  const pag = usePagination(despachos, 20);

  const setLinea = (i: number, parche: Partial<Linea>) => setLineas(ls => ls.map((l, j) => (j === i ? { ...l, ...parche } : l)));
  const quitarLinea = (i: number) => setLineas(ls => (ls.length === 1 ? [{ articuloDbId: '', cantidad: '', notas: '' }] : ls.filter((_, j) => j !== i)));

  const despachar = async () => {
    if (!almacenDbId) { toast.error('Elige el almacén'); return; }
    if (!destino) { toast.error('Elige el proyecto de destino'); return; }
    if (origen && origen === destino) { toast.error('El proyecto de origen y el de destino son el mismo'); return; }
    const validas = lineas.filter(l => l.articuloDbId && Number(l.cantidad) > 0);
    if (validas.length === 0) { toast.error('Agrega al menos un artículo con cantidad'); return; }
    for (const l of validas) {
      const disp = stock[l.articuloDbId] ?? 0;
      if (Number(l.cantidad) > disp) { toast.error(`${articulos.find(a => a._dbId === l.articuloDbId)?.nombre ?? 'Artículo'}: hay ${disp} y pides ${l.cantidad}`); return; }
    }
    setGuardando(true);
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const { data, error } = await (supabase as any).rpc('inventario_despachar', {
        p_almacen: almacenDbId, p_proyecto_destino: destino, p_proyecto_origen: origen,
        p_lineas: validas.map(l => ({ articulo_id: l.articuloDbId, cantidad: Number(l.cantidad), notas: l.notas || null })),
        p_referencia: referencia || null, p_notas: notas || null,
      });
      if (error) throw new Error(error.message);
      toast.success(`${data?.numero}: ${data?.lineas} línea(s) ${origen ? 'transferidas' : 'despachadas'} al proyecto`);
      setLineas([{ articuloDbId: '', cantidad: '', notas: '' }]); setReferencia(''); setNotas('');
      await Promise.all([cargarStock(), cargarDespachos(), recargar()]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setGuardando(false); }
  };

  return (
    <PermissionGuard modulo="inventario" accion="ver">
      <div className="space-y-6">
        <PageNav onBack={onNavigate ? () => onNavigate('/inventario/movimientos') : undefined} />
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><PackageCheck className="size-6" /> Despacho a proyecto</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
            Saca ítems del almacén general (o de otro proyecto) y los pone a nombre del proyecto que los recibe. Cada despacho deja su
            salida y su entrada en el kardex con el mismo número, y el costo pasa al proyecto al tipo de cambio del día.
          </p>
        </div>

        <PermissionGuard modulo="inventario" accion="crear">
          <Card>
            <CardHeader><CardTitle className="text-base">Nuevo despacho</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Almacén</Label>
                  <Select value={almacenDbId || 'ninguno'} onValueChange={(v: string) => setAlmacenDbId(v === 'ninguno' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Almacén" /></SelectTrigger>
                    <SelectContent>
                      {almacenesActivos.map(a => <SelectItem key={a._dbId} value={a._dbId}>{a.id} · {a.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Sale de</Label>
                  <ProyectoSelector value={origen} onChange={v => { setOrigen(v); setLineas([{ articuloDbId: '', cantidad: '', notas: '' }]); }} nullable />
                  <p className="text-xs text-muted-foreground">"Sin proyecto" = stock del almacén general. Con proyecto = transferencia entre proyectos.</p>
                </div>
                <div className="space-y-1">
                  <Label>Entra a (proyecto de destino)</Label>
                  <ProyectoSelector value={destino} onChange={setDestino} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ítems</Label>
                  <span className="text-xs text-muted-foreground">{conStock.length} artículos con stock en {origen ? 'ese proyecto' : 'el almacén general'}</span>
                </div>
                {lineas.map((l, i) => {
                  const disp = l.articuloDbId ? (stock[l.articuloDbId] ?? 0) : null;
                  return (
                    <div key={i} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_40px] items-center">
                      <Select value={l.articuloDbId || 'ninguno'} onValueChange={(v: string) => setLinea(i, { articuloDbId: v === 'ninguno' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Artículo" /></SelectTrigger>
                        <SelectContent>
                          {conStock.length === 0 && <SelectItem value="ninguno" disabled>Sin stock disponible en el origen</SelectItem>}
                          {conStock.map(a => <SelectItem key={a._dbId} value={a._dbId}>{a.id} · {a.nombre} (hay {stock[a._dbId]} {a.unidadMedida})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div>
                        <Input type="number" min={0} step="any" placeholder="Cantidad" value={l.cantidad} onChange={e => setLinea(i, { cantidad: e.target.value })} />
                        {disp != null && Number(l.cantidad) > disp && <p className="text-xs text-red-600">Solo hay {disp}</p>}
                      </div>
                      <Input placeholder="Nota de la línea (opcional)" value={l.notas} onChange={e => setLinea(i, { notas: e.target.value })} />
                      <Button variant="ghost" size="icon" onClick={() => quitarLinea(i)} title="Quitar"><Trash2 className="size-4" /></Button>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setLineas(ls => [...ls, { articuloDbId: '', cantidad: '', notas: '' }])}><Plus className="size-4" /> Otra línea</Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1"><Label>Referencia (guía, OC, pedido…)</Label><Input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej. guía de remisión 001-123" /></div>
                <div className="space-y-1"><Label>Notas</Label><Textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} /></div>
              </div>
              <div className="flex justify-end">
                <Button onClick={despachar} disabled={guardando || loading}>
                  {guardando ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} {origen ? 'Transferir al proyecto' : 'Despachar al proyecto'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </PermissionGuard>

        <Card>
          <CardHeader><CardTitle className="text-base">Despachos y transferencias ({despachos.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º</TableHead><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>De → a</TableHead>
                  <TableHead>Ítems</TableHead><TableHead className="text-right">Unid.</TableHead><TableHead className="text-right">Valor S/</TableHead><TableHead>Referencia / notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pag.paged.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Todavía no hay despachos.</TableCell></TableRow>}
                {pag.paged.map(d => (
                  <TableRow key={d.numero}>
                    <TableCell className="font-mono text-xs">{d.numero}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fecha(d.fecha)}</TableCell>
                    <TableCell><Badge variant={d.motivo === 'transferencia_proyecto' ? 'secondary' : 'default'}>{d.motivo === 'transferencia_proyecto' ? 'Transferencia' : 'Despacho'}</Badge></TableCell>
                    <TableCell className="text-xs">{d.proyecto_origen ?? 'Almacén general'} → <b>{d.proyecto_destino}</b><div className="text-muted-foreground">{d.almacen}</div></TableCell>
                    <TableCell className="text-xs max-w-[320px]">{d.detalle}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.unidades}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(d.valor_soles ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={d.notas ?? ''}>{d.notas?.replace(/^DSP-\d{4}-\d{4} · /, '')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {pag.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button size="sm" variant="outline" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>
            <span className="text-xs">Página {pag.page} de {pag.totalPages}</span>
            <Button size="sm" variant="outline" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
