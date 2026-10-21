/**
 * Administración › API e integraciones: claves de la API Memphis v1 (una por sistema externo),
 * alcances por módulo, uso reciente y cómo conectarse (Power BI, curl, Python). La clave se
 * muestra una sola vez al crearla; en la base solo vive su hash.
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Loader2, Plus, ShieldOff, ExternalLink, Check, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { useConfirmAction } from '../../shared/ConfirmDialogProvider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { MODULOS_API, cargarAccesosRecientes, cargarClaves, crearClave, revocarClave, urlBaseApi, type ApiAcceso, type ApiClave } from '../../../lib/admin/api-claves';

const fechaHora = (s: string | null) => s ? new Date(s).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function ApiIntegraciones() {
  const { can } = usePermissions();
  const confirmar = useConfirmAction();
  const [claves, setClaves] = useState<ApiClave[]>([]);
  const [accesos, setAccesos] = useState<ApiAcceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [nueva, setNueva] = useState(false);
  const [creada, setCreada] = useState<{ nombre: string; clave: string } | null>(null);
  const base = urlBaseApi();

  const cargar = async () => {
    setLoading(true);
    try { const [c, a] = await Promise.all([cargarClaves(), cargarAccesosRecientes(7)]); setClaves(c); setAccesos(a); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void cargar(); }, []);

  const usoPorClave = useMemo(() => {
    const m: Record<string, { llamadas: number; errores: number }> = {};
    for (const a of accesos) { const k = a.clave_id ?? '?'; m[k] = m[k] ?? { llamadas: 0, errores: 0 }; m[k].llamadas++; if (a.estado >= 400) m[k].errores++; }
    return m;
  }, [accesos]);

  const copiar = async (texto: string, msg = 'Copiado') => { try { await navigator.clipboard.writeText(texto); toast.success(msg); } catch { toast.error('No se pudo copiar'); } };
  const revocar = async (c: ApiClave) => {
    const ok = await confirmar({ title: `Revocar "${c.nombre}"`, description: 'El sistema que use esta clave dejará de poder llamar a la API de inmediato. No se puede deshacer; si hace falta, cree una clave nueva.', confirmLabel: 'Revocar', variant: 'destructive' } as never);
    if (!ok) return;
    try { await revocarClave(c.id); toast.success('Clave revocada'); await cargar(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  if (!can('admin', 'gestionar_usuarios')) {
    return <div className="p-6 text-muted-foreground">Necesita el permiso de administración (gestionar usuarios) para administrar la API.</div>;
  }

  const curl = `curl -H "x-api-key: mm_live_SU_CLAVE" "${base}/v1/proyectos?estado=en_ejecucion&por_pagina=50"`;
  const powerBi = `let\n  Origen = Json.Document(Web.Contents("${base}/v1/cuentas-por-pagar", [Query = [estado_pago = "PENDIENTE", por_pagina = "200"], Headers = [#"x-api-key" = "mm_live_SU_CLAVE"]])),\n  Filas = Table.FromRecords(Origen[data])\nin\n  Filas`;

  return (
    <div className="space-y-4">
      <PageNav />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><KeyRound className="size-6" /> API e integraciones</h1>
          <p className="text-sm text-muted-foreground">Una clave por sistema externo (Power BI, dashboard de TI, Microsoft 365, un proveedor), con alcances por módulo. Tope: 120 llamadas por minuto por clave.</p>
        </div>
        <Button onClick={() => setNueva(true)}><Plus className="size-4" /> Nueva clave</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-base">Claves</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Integración</TableHead><TableHead>Clave</TableHead><TableHead>Alcances</TableHead><TableHead>Uso (7 días)</TableHead><TableHead>Último uso</TableHead><TableHead>Estado</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="size-5 animate-spin inline" /></TableCell></TableRow>}
                {!loading && claves.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Todavía no hay claves. Cree una por cada sistema que vaya a leer el ERP.</TableCell></TableRow>}
                {claves.map(c => {
                  const u = usoPorClave[c.id];
                  const vencida = !!c.expira_en && new Date(c.expira_en) < new Date();
                  return (
                    <TableRow key={c.id} className={c.activa ? '' : 'opacity-60'}>
                      <TableCell><div className="font-medium">{c.nombre}</div>{c.descripcion && <div className="text-xs text-muted-foreground">{c.descripcion}</div>}<div className="text-xs text-muted-foreground">creada {fechaHora(c.creado_en)}</div></TableCell>
                      <TableCell className="font-mono text-xs">{c.prefijo}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{c.alcances.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div></TableCell>
                      <TableCell className="text-sm">{u ? <>{u.llamadas} llamadas{u.errores ? <span className="text-red-600"> · {u.errores} errores</span> : null}</> : <span className="text-muted-foreground">sin uso</span>}<div className="text-xs text-muted-foreground">{c.usos} en total</div></TableCell>
                      <TableCell className="text-sm">{fechaHora(c.ultimo_uso_en)}</TableCell>
                      <TableCell>{!c.activa ? <Badge variant="destructive">Revocada</Badge> : vencida ? <Badge variant="destructive">Vencida</Badge> : <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" variant="outline">Activa{c.expira_en ? ` · vence ${fechaHora(c.expira_en)}` : ''}</Badge>}</TableCell>
                      <TableCell>{c.activa && <Button variant="ghost" size="icon" title="Revocar" onClick={() => revocar(c)}><ShieldOff className="size-4 text-destructive" /></Button>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Cómo conectarse</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><Label className="text-xs text-muted-foreground">URL base</Label><div className="flex gap-1"><Input readOnly value={`${base}/v1`} className="font-mono text-xs" /><Button variant="outline" size="icon" onClick={() => copiar(`${base}/v1`, 'URL copiada')}><Copy className="size-4" /></Button></div></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild><a href={`${base}/v1/docs`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Documentación interactiva</a></Button>
              <Button variant="outline" size="sm" asChild><a href={`${base}/v1/openapi.json`} target="_blank" rel="noreferrer">OpenAPI (JSON)</a></Button>
            </div>
            <p>Cabecera <code className="font-mono">x-api-key</code> con la clave en cada llamada. Listas paginadas: <code className="font-mono">?pagina=1&por_pagina=200</code>; filtros por recurso en la documentación.</p>
            <div><Label className="text-xs text-muted-foreground">curl</Label><pre className="bg-muted rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">{curl}</pre></div>
            <div><Label className="text-xs text-muted-foreground">Power BI (Obtener datos › Consulta en blanco › Editor avanzado)</Label><pre className="bg-muted rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">{powerBi}</pre></div>
            <p className="text-xs text-muted-foreground">Recursos: proyectos (+ financiero), órdenes de compra, facturas, proveedores, cuentas por pagar y cobrar, pagos, bancos, caja chica, inventario, flota, viajes, correspondencia, valorizaciones, fianzas, capacitaciones, indicadores/resumen. Escritura: registrar correspondencia.</p>
          </CardContent>
        </Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> Últimas llamadas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Cuándo</TableHead><TableHead>Integración</TableHead><TableHead>Ruta</TableHead><TableHead>Estado</TableHead><TableHead>ms</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
            <TableBody>
              {accesos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin llamadas en los últimos 7 días.</TableCell></TableRow>}
              {accesos.slice(0, 20).map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{fechaHora(a.creado_en)}</TableCell>
                  <TableCell className="text-sm">{claves.find(c => c.id === a.clave_id)?.nombre ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[420px] truncate" title={a.ruta}>{a.metodo} {a.ruta}</TableCell>
                  <TableCell><Badge variant={a.estado >= 400 ? 'destructive' : 'outline'}>{a.estado}</Badge></TableCell>
                  <TableCell className="text-xs">{a.duracion_ms ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.ip ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {nueva && <NuevaClave onCerrar={() => setNueva(false)} onCreada={async (nombre, clave) => { setNueva(false); setCreada({ nombre, clave }); await cargar(); }} />}

      <Dialog open={!!creada} onOpenChange={o => !o && setCreada(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Clave creada: {creada?.nombre}</DialogTitle>
            <DialogDescription>Cópiela ahora y guárdela en el sistema que la va a usar. <b>No se vuelve a mostrar</b>: el ERP solo guarda su huella. Si se pierde, revoque esta y cree otra.</DialogDescription></DialogHeader>
          <div className="flex gap-1"><Input readOnly value={creada?.clave ?? ''} className="font-mono text-xs" /><Button variant="outline" size="icon" onClick={() => creada && copiar(creada.clave, 'Clave copiada')}><Copy className="size-4" /></Button></div>
          <DialogFooter><Button onClick={() => setCreada(null)}><Check className="size-4" /> Ya la guardé</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NuevaClave({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: (nombre: string, clave: string) => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [expira, setExpira] = useState('');
  const [alcances, setAlcances] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const alternar = (a: string, v: boolean) => setAlcances(prev => { const n = new Set(prev); if (v) n.add(a); else n.delete(a); return n; });
  const todosLeer = MODULOS_API.every(m => alcances.has(`${m.clave}:leer`));
  const crear = async () => {
    if (!nombre.trim()) { toast.error('Indique el nombre de la integración'); return; }
    if (!alcances.size) { toast.error('Marque al menos un alcance'); return; }
    setOcupado(true);
    try {
      const r = await crearClave({ nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, alcances: [...alcances].sort(), expira: expira ? new Date(expira + 'T23:59:59').toISOString() : null });
      await onCreada(nombre.trim(), r.clave);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={o => !o && !ocupado && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva clave de la API</DialogTitle><DialogDescription>Una por sistema. Marque solo lo que ese sistema necesita leer.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Integración</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Power BI Gerencia, Dashboard TI, Proveedor X…" /></div>
          <div><Label>Descripción</Label><Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Quién la usa y para qué (opcional)" /></div>
          <div><Label>Vence el</Label><Input type="date" value={expira} onChange={e => setExpira(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">Vacío = no vence. Recomendado para proveedores externos.</p></div>
          <div className="flex items-center justify-between"><Label>Alcances</Label><Button variant="link" size="sm" className="h-auto p-0" onClick={() => MODULOS_API.forEach(m => alternar(`${m.clave}:leer`, !todosLeer))}>{todosLeer ? 'Quitar lectura de todo' : 'Lectura de todo'}</Button></div>
          <div className="rounded-md border divide-y">
            {MODULOS_API.map(m => (
              <div key={m.clave} className="flex items-center gap-3 p-2">
                <div className="flex-1"><div className="text-sm font-medium">{m.nombre}</div><div className="text-xs text-muted-foreground">{m.recursos}</div></div>
                <label className="flex items-center gap-1 text-xs"><Checkbox checked={alcances.has(`${m.clave}:leer`)} onCheckedChange={(v: boolean | 'indeterminate') => alternar(`${m.clave}:leer`, v === true)} /> leer</label>
                {m.escribir && <label className="flex items-center gap-1 text-xs"><Checkbox checked={alcances.has(`${m.clave}:escribir`)} onCheckedChange={(v: boolean | 'indeterminate') => alternar(`${m.clave}:escribir`, v === true)} /> escribir</label>}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onCerrar} disabled={ocupado}>Cancelar</Button><Button onClick={crear} disabled={ocupado}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Crear clave</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
