/**
 * Dirección › OKRs: objetivos por periodo con sus resultados clave. Cada resultado tiene meta, valor inicial y valor
 * actual; si se enlaza a una fuente del ERP (deuda vencida, cobrado en el año, cartas vencidas…) el valor se calcula
 * solo y no hay que actualizarlo a mano. Socios y Gerencia ven; quien tiene `direccion.editar` define y actualiza.
 */
import { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { PageNav } from '../../shared/PageNav';
import { useConfirmAction } from '../../shared/ConfirmDialogProvider';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { cargarOKRs, guardarObjetivo, guardarResultado, eliminarObjetivo, eliminarResultado, FUENTES_OKR, type Objetivo, type ResultadoClave } from '@/lib/direccion/direccion';
import { DireccionNav } from './DireccionNav';

const num = (n: number, unidad: string) => `${unidad === 'S/' || unidad === 'US$' ? unidad + ' ' : ''}${Math.round(n).toLocaleString('es-PE')}${unidad === '%' ? ' %' : (unidad !== 'S/' && unidad !== 'US$' ? ' ' + unidad : '')}`;
const colorAvance = (p: number) => (p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-600' : 'text-red-600');

export function DireccionOKRs({ onNavigate }: { onNavigate?: (ruta: string) => void }) {
  const { can } = usePermissions();
  const { tenantId, user } = useAuth();
  const confirmar = useConfirmAction();
  const puedeEditar = can('direccion', 'editar');
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [resultados, setResultados] = useState<ResultadoClave[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<string>('');
  const [editObj, setEditObj] = useState<Partial<Objetivo> | null>(null);
  const [editKr, setEditKr] = useState<Partial<ResultadoClave> | null>(null);

  const cargar = async () => {
    setLoading(true);
    try { const d = await cargarOKRs(); setObjetivos(d.objetivos); setResultados(d.resultados); if (!periodo && d.objetivos[0]) setPeriodo(d.objetivos[0].periodo); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void cargar(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const periodos = useMemo(() => Array.from(new Set(objetivos.map(o => o.periodo))).sort().reverse(), [objetivos]);
  const visibles = useMemo(() => objetivos.filter(o => !periodo || o.periodo === periodo), [objetivos, periodo]);
  const krDe = (id: string) => resultados.filter(r => r.objetivo_id === id);
  const avanceObjetivo = (id: string) => { const k = krDe(id); return k.length ? Math.round(k.reduce((s, r) => s + Number(r.avance_pct), 0) / k.length) : 0; };

  const guardarO = async () => {
    if (!editObj || !tenantId || !editObj.titulo?.trim() || !editObj.periodo?.trim()) { toast.error('Periodo y objetivo son obligatorios'); return; }
    try { await guardarObjetivo(tenantId, editObj as Objetivo, user?.id); setEditObj(null); toast.success('Objetivo guardado'); await cargar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const guardarK = async () => {
    if (!editKr || !tenantId || !editKr.titulo?.trim() || editKr.meta == null || Number.isNaN(Number(editKr.meta))) { toast.error('Resultado y meta son obligatorios'); return; }
    try { await guardarResultado(tenantId, { ...editKr, meta: Number(editKr.meta), valor_inicial: Number(editKr.valor_inicial ?? 0), valor_actual: Number(editKr.valor_actual ?? 0) } as ResultadoClave, user?.id); setEditKr(null); toast.success('Resultado guardado'); await cargar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const borrarO = async (o: Objetivo) => {
    const ok = await confirmar({ title: `Eliminar "${o.titulo}"`, description: 'Se eliminan también sus resultados clave. No se puede deshacer.', confirmLabel: 'Eliminar', variant: 'destructive' } as never);
    if (!ok) return; try { await eliminarObjetivo(o.id); toast.success('Objetivo eliminado'); await cargar(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const borrarK = async (r: ResultadoClave) => {
    const ok = await confirmar({ title: `Eliminar "${r.titulo}"`, description: 'No se puede deshacer.', confirmLabel: 'Eliminar', variant: 'destructive' } as never);
    if (!ok) return; try { await eliminarResultado(r.id); await cargar(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-5">
      <PageNav />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center"><Target className="size-6 text-black dark:text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">OKRs</h1>
            <p className="text-muted-foreground text-sm">Objetivos y resultados clave. Los enlazados al ERP se actualizan solos.</p>
          </div>
        </div>
        {puedeEditar && <Button onClick={() => setEditObj({ periodo: periodo || String(new Date().getFullYear()), estado: 'activo' })}><Plus className="size-4" /> Nuevo objetivo</Button>}
      </div>

      <DireccionNav actual="/direccion/okrs" onNavigate={onNavigate} />

      {periodos.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={!periodo ? 'default' : 'outline'} onClick={() => setPeriodo('')}>Todos</Button>
          {periodos.map(p => <Button key={p} size="sm" variant={periodo === p ? 'default' : 'outline'} onClick={() => setPeriodo(p)}>{p}</Button>)}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && visibles.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Target className="size-8 mx-auto mb-2" />
          Todavía no hay objetivos definidos.{puedeEditar ? ' Cree el primero con "Nuevo objetivo".' : ' Gerencia debe definirlos con Administración.'}
        </CardContent></Card>
      )}

      {visibles.map(o => {
        const krs = krDe(o.id); const av = avanceObjetivo(o.id);
        return (
          <Card key={o.id} className={o.estado !== 'activo' ? 'opacity-70' : ''}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">{o.titulo} <Badge variant="outline" className="text-xs">{o.periodo}</Badge>{o.estado !== 'activo' && <Badge variant="secondary" className="text-xs">{o.estado}</Badge>}</CardTitle>
                  {o.descripcion && <p className="text-sm text-muted-foreground mt-1">{o.descripcion}</p>}
                  {o.responsable && <p className="text-xs text-muted-foreground mt-1">Responsable: {o.responsable}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-semibold tabular-nums ${colorAvance(av)}`}>{av}%</span>
                  {puedeEditar && <>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditObj(o)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" title="Eliminar" onClick={() => void borrarO(o)}><Trash2 className="size-4 text-destructive" /></Button>
                  </>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {krs.map(r => (
                <div key={r.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium flex items-center gap-2">{r.titulo}{r.fuente && <Badge variant="outline" className="text-[10px] gap-1"><Zap className="size-3" /> automático</Badge>}</p>
                    <div className="flex items-center gap-2 text-sm tabular-nums">
                      <span className={colorAvance(Number(r.avance_pct))}>{num(Number(r.valor), r.unidad)}</span>
                      <span className="text-muted-foreground">/ meta {num(Number(r.meta), r.unidad)}</span>
                      <span className={`font-semibold ${colorAvance(Number(r.avance_pct))}`}>{Math.round(Number(r.avance_pct))}%</span>
                      {puedeEditar && <>
                        <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => setEditKr(r)}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7" title="Eliminar" onClick={() => void borrarK(r)}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </>}
                    </div>
                  </div>
                  <Progress value={Number(r.avance_pct)} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">Parte de {num(Number(r.valor_inicial), r.unidad)} · {r.direccion === 'bajar' ? 'hay que bajar' : 'hay que subir'}{r.fuente ? '' : ` · actualizado ${new Date(r.actualizado_en).toLocaleDateString('es-PE')}`}{r.notas ? ` · ${r.notas}` : ''}</p>
                </div>
              ))}
              {puedeEditar && <Button variant="outline" size="sm" onClick={() => setEditKr({ objetivo_id: o.id, unidad: 'S/', direccion: 'subir', valor_inicial: 0, valor_actual: 0 })}><Plus className="size-4" /> Resultado clave</Button>}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!editObj} onOpenChange={(ab: boolean) => !ab && setEditObj(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editObj?.id ? 'Editar objetivo' : 'Nuevo objetivo'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Periodo</Label><Input value={editObj?.periodo ?? ''} placeholder="2026 · 2026-T4 · 2027-S1" onChange={e => setEditObj(o => ({ ...o, periodo: e.target.value }))} /></div>
            <div><Label>Objetivo</Label><Input value={editObj?.titulo ?? ''} placeholder="Reducir la deuda vencida con proveedores" onChange={e => setEditObj(o => ({ ...o, titulo: e.target.value }))} /></div>
            <div><Label>Descripción</Label><Textarea value={editObj?.descripcion ?? ''} onChange={e => setEditObj(o => ({ ...o, descripcion: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Responsable</Label><Input value={editObj?.responsable ?? ''} onChange={e => setEditObj(o => ({ ...o, responsable: e.target.value }))} /></div>
              <div><Label>Estado</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={editObj?.estado ?? 'activo'} onChange={e => setEditObj(o => ({ ...o, estado: e.target.value as Objetivo['estado'] }))}>
                  <option value="activo">Activo</option><option value="cerrado">Cerrado</option><option value="cancelado">Cancelado</option>
                </select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditObj(null)}>Cancelar</Button><Button onClick={() => void guardarO()}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editKr} onOpenChange={(ab: boolean) => !ab && setEditKr(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editKr?.id ? 'Editar resultado clave' : 'Nuevo resultado clave'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Resultado</Label><Input value={editKr?.titulo ?? ''} placeholder="Deuda vencida por debajo de S/ 20 M" onChange={e => setEditKr(k => ({ ...k, titulo: e.target.value }))} /></div>
            <div><Label>Fuente automática (opcional)</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={editKr?.fuente ?? ''} onChange={e => { const f = FUENTES_OKR.find(x => x.id === e.target.value); setEditKr(k => ({ ...k, fuente: e.target.value || null, unidad: f ? f.unidad : (k?.unidad ?? 'S/') })); }}>
                <option value="">Manual (se actualiza a mano)</option>
                {FUENTES_OKR.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Con fuente, el valor actual lo calcula el ERP cada vez que se abre esta pantalla.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unidad</Label><Input value={editKr?.unidad ?? 'S/'} onChange={e => setEditKr(k => ({ ...k, unidad: e.target.value }))} /></div>
              <div><Label>Dirección</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={editKr?.direccion ?? 'subir'} onChange={e => setEditKr(k => ({ ...k, direccion: e.target.value as 'subir' | 'bajar' }))}>
                  <option value="subir">Hay que subir</option><option value="bajar">Hay que bajar</option>
                </select></div>
              <div><Label>Valor inicial</Label><Input type="number" value={editKr?.valor_inicial ?? 0} onChange={e => setEditKr(k => ({ ...k, valor_inicial: Number(e.target.value) }))} /></div>
              <div><Label>Meta</Label><Input type="number" value={editKr?.meta ?? ''} onChange={e => setEditKr(k => ({ ...k, meta: Number(e.target.value) }))} /></div>
              {!editKr?.fuente && <div><Label>Valor actual</Label><Input type="number" value={editKr?.valor_actual ?? 0} onChange={e => setEditKr(k => ({ ...k, valor_actual: Number(e.target.value) }))} /></div>}
            </div>
            <div><Label>Notas</Label><Input value={editKr?.notas ?? ''} onChange={e => setEditKr(k => ({ ...k, notas: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditKr(null)}>Cancelar</Button><Button onClick={() => void guardarK()}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
