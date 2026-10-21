/**
 * Proyectos › Correspondencia con el Estado: cartas, oficios, informes y memorándums
 * por proyecto, agrupados en expedientes (hilos), con plazo de respuesta y semáforo.
 * Sirve como pantalla global (/proyectos/correspondencia) y como pestaña del Proyecto 360
 * (`proyectoId` + `compacto`). Reemplaza SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Clock, FileText, Loader2, Mail, MoreVertical, Pencil, Plus, Search, Trash2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Card, CardContent } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { BotonExportar } from '../../shared/BotonExportar';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { useConfirmAction } from '../../shared/ConfirmDialogProvider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { useAuth } from '../../../auth/AuthProvider';
import { usePagination } from '../../../lib/shared/usePagination';
import { usePersistedState } from '../../../lib/shared/usePersistedState';
import {
  ESTADO_CORRESPONDENCIA, SENTIDO_CORRESPONDENCIA, TIPO_CORRESPONDENCIA, cargarCorrespondencia, cargarHilos, eliminarCorrespondencia, fechaCorta,
  guardarCorrespondencia, guardarHilo, textoPlazo, type Correspondencia, type CorrespondenciaInput, type EstadoCorrespondencia, type Hilo, type SentidoCorrespondencia, type TipoCorrespondencia,
} from '../../../lib/proyectos/correspondencia';

const hoy = () => new Date().toISOString().slice(0, 10);
const FILTRO_ESTADO: Record<string, string> = { abiertos: 'Pendientes y registrados', pendiente: 'Pendientes de respuesta', vencidas: 'Vencidas', registrado: 'Registrados', respondido: 'Respondidos', cerrado: 'Cerrados', todos: 'Todos' };
const NUEVO_HILO = '__nuevo__';

interface Props { onNavigate?: (r: string) => void; proyectoId?: string; compacto?: boolean }

export function ProyectosCorrespondencia({ onNavigate, proyectoId, compacto = false }: Props) {
  const { can } = usePermissions();
  const { tenantId, user } = useAuth();
  const confirmar = useConfirmAction();
  const puedeCrear = can('proyectos', 'crear') || can('proyectos', 'editar');
  const puedeEditar = can('proyectos', 'editar');
  const puedeEliminar = can('proyectos', 'eliminar');
  const clave = (k: string) => `correspondencia.${proyectoId ? 'p.' : ''}${k}`;

  const [filas, setFilas] = useState<Correspondencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = usePersistedState(clave('busqueda'), '');
  const [fEstado, setFEstado] = usePersistedState<string>(clave('estado'), 'abiertos');
  const [fTipo, setFTipo] = usePersistedState<string>(clave('tipo'), 'todos');
  const [fProyecto, setFProyecto] = usePersistedState<string | null>('correspondencia.proyecto', null);
  const [edit, setEdit] = useState<CorrespondenciaInput | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const proyectoFiltro = proyectoId ?? fProyecto;

  const cargar = async () => {
    setLoading(true);
    try { setFilas(await cargarCorrespondencia(proyectoId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [proyectoId]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return filas.filter(c => {
      if (proyectoFiltro && c.proyecto_id !== proyectoFiltro) return false;
      if (fTipo !== 'todos' && c.tipo !== fTipo) return false;
      if (fEstado === 'abiertos' && !['pendiente', 'registrado'].includes(c.estado)) return false;
      if (fEstado === 'vencidas' && !c.vencida) return false;
      if (['pendiente', 'registrado', 'respondido', 'cerrado'].includes(fEstado) && c.estado !== fEstado) return false;
      if (t && ![c.numero_doc, c.asunto, c.emisor, c.receptor, c.hilo_titulo, c.etapa, c.proyecto_codigo, c.proyecto_nombre, c.observaciones].some(v => (v ?? '').toLowerCase().includes(t))) return false;
      return true;
    });
  }, [filas, busqueda, fEstado, fTipo, proyectoFiltro]);
  const pag = usePagination(filtradas, compacto ? 10 : 20);
  useEffect(() => { pag.reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [busqueda, fEstado, fTipo, proyectoFiltro]);

  const universo = useMemo(() => filas.filter(c => !proyectoFiltro || c.proyecto_id === proyectoFiltro), [filas, proyectoFiltro]);
  const kpi = useMemo(() => ({
    pendientes: universo.filter(c => c.estado === 'pendiente').length,
    vencidas: universo.filter(c => c.vencida).length,
    porVencer: universo.filter(c => c.estado === 'pendiente' && c.dias_para_vencer != null && c.dias_para_vencer >= 0 && c.dias_para_vencer <= 7).length,
    documentos: universo.filter(c => c.tipo !== 'accion').length,
  }), [universo]);

  const nuevo = () => setEdit({ proyecto_id: proyectoFiltro ?? undefined, tipo: 'carta', sentido: 'recibido', estado: 'registrado', fecha_documento: hoy(), requiere_respuesta: false });
  const cambiarEstado = async (c: Correspondencia, estado: EstadoCorrespondencia) => {
    try { await guardarCorrespondencia({ id: c.id, estado, respondido_en: estado === 'respondido' ? hoy() : c.respondido_en }); toast.success(`${c.numero_doc ?? c.asunto}: ${ESTADO_CORRESPONDENCIA[estado].label}`); await cargar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const eliminar = async (c: Correspondencia) => {
    const ok = await confirmar({ title: 'Eliminar documento', description: `Se elimina "${c.numero_doc ?? c.asunto}" del seguimiento. Las respuestas que apuntaban a él quedan sin enlace.`, confirmLabel: 'Eliminar', variant: 'destructive' } as never);
    if (!ok) return;
    try { await eliminarCorrespondencia(c.id); toast.success('Eliminado'); await cargar(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const exportables = filtradas.map(c => ({
    proyecto: c.proyecto_codigo, expediente: c.hilo_titulo ?? '', etapa: c.etapa ?? '', fecha: c.fecha_documento ?? '', recepcion: c.fecha_recepcion ?? '', numero: c.numero_doc ?? '',
    tipo: TIPO_CORRESPONDENCIA[c.tipo], sentido: SENTIDO_CORRESPONDENCIA[c.sentido], emisor: c.emisor ?? '', receptor: c.receptor ?? '', asunto: c.asunto,
    estado: ESTADO_CORRESPONDENCIA[c.estado].label, fecha_limite: c.fecha_limite ?? '', responde_a: c.responde_a_numero ?? '', observaciones: c.observaciones ?? '',
  }));

  return (
    <div className={compacto ? 'space-y-3' : 'space-y-4'}>
      {!compacto && <PageNav />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compacto && <div><h1 className="text-2xl font-semibold flex items-center gap-2"><Mail className="size-6" /> Correspondencia con el Estado</h1>
          <p className="text-sm text-muted-foreground">Cartas, oficios e informes por proyecto y expediente; quién debe responder y hasta cuándo.</p></div>}
        <div className="flex gap-2 ml-auto">
          <BotonExportar modulo="proyectos" nombre="correspondencia" datos={exportables} headers={{ proyecto: 'Proyecto', expediente: 'Expediente', etapa: 'Etapa', fecha: 'Fecha', recepcion: 'Recepción', numero: 'N° documento', tipo: 'Tipo', sentido: 'Sentido', emisor: 'Emisor', receptor: 'Receptor', asunto: 'Asunto', estado: 'Estado', fecha_limite: 'Fecha límite', responde_a: 'Responde a', observaciones: 'Observaciones' }} size="sm" />
          {puedeCrear && <Button size="sm" onClick={nuevo}><Plus className="size-4" /> Registrar documento</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icono={<Clock className="size-4 text-amber-600" />} valor={kpi.pendientes} texto="pendientes de respuesta" onClick={() => setFEstado('pendiente')} activo={fEstado === 'pendiente'} />
        <Kpi icono={<AlertTriangle className="size-4 text-red-600" />} valor={kpi.vencidas} texto="vencidas" onClick={() => setFEstado('vencidas')} activo={fEstado === 'vencidas'} />
        <Kpi icono={<Clock className="size-4 text-orange-500" />} valor={kpi.porVencer} texto="vencen en 7 días" />
        <Kpi icono={<FileText className="size-4 text-primary" />} valor={kpi.documentos} texto="documentos" onClick={() => setFEstado('todos')} activo={fEstado === 'todos'} />
      </div>

      <Card><CardContent className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" /><Input className="pl-8" placeholder="N°, asunto, emisor, expediente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
        {!proyectoId && <ProyectoSelector value={fProyecto} onChange={setFProyecto} className="w-[260px]" />}
        <Select value={fEstado} onValueChange={setFEstado}><SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(FILTRO_ESTADO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <Select value={fTipo} onValueChange={setFTipo}><SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos los tipos</SelectItem>{Object.entries(TIPO_CORRESPONDENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-[90px]">Fecha</TableHead><TableHead>Documento</TableHead><TableHead>De → Para</TableHead><TableHead>Asunto</TableHead>
            {!proyectoId && <TableHead>Proyecto</TableHead>}<TableHead>Estado</TableHead><TableHead className="w-10" />
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="size-5 animate-spin inline" /></TableCell></TableRow>}
            {!loading && pag.paged.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin documentos con esos filtros.</TableCell></TableRow>}
            {pag.paged.map(c => {
              const plazo = textoPlazo(c);
              return (
                <TableRow key={c.id} className={c.vencida ? 'bg-red-50/60 dark:bg-red-950/20' : ''}>
                  <TableCell className="text-sm align-top">{fechaCorta(c.fecha_documento)}{c.fecha_recepcion && c.fecha_recepcion !== c.fecha_documento ? <div className="text-xs text-muted-foreground" title="Recepción en mesa de partes">rec. {fechaCorta(c.fecha_recepcion)}</div> : null}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      {c.sentido === 'emitido' ? <ArrowUpRight className="size-3.5 text-blue-600 shrink-0" /> : c.sentido === 'recibido' ? <ArrowDownLeft className="size-3.5 text-emerald-600 shrink-0" /> : null}
                      <span className="font-mono text-xs">{c.numero_doc ?? '—'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{TIPO_CORRESPONDENCIA[c.tipo]}{c.responde_a_numero ? ` · responde a ${c.responde_a_numero}` : ''}{c.respuestas > 0 ? ` · ${c.respuestas} respuesta(s)` : ''}</div>
                  </TableCell>
                  <TableCell className="text-sm align-top">{c.emisor ?? '—'}{c.receptor ? <span className="text-muted-foreground"> → {c.receptor}</span> : ''}</TableCell>
                  <TableCell className="align-top max-w-[420px]">
                    <div className="text-sm leading-snug">{c.asunto}</div>
                    {(c.hilo_titulo || c.etapa) && <div className="text-xs text-muted-foreground mt-0.5">{[c.hilo_titulo, c.etapa].filter(Boolean).join(' · ')}</div>}
                    {c.archivo_url && <a className="text-xs underline inline-flex items-center gap-1 mt-0.5" href={c.archivo_url} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> {c.archivo_nombre ?? 'archivo'}</a>}
                  </TableCell>
                  {!proyectoId && <TableCell className="text-xs align-top"><button className="underline-offset-2 hover:underline text-left" onClick={() => onNavigate?.(`/proyectos/360/${c.proyecto_id}`)}>{c.proyecto_codigo}</button></TableCell>}
                  <TableCell className="align-top">
                    <Badge variant="outline" className={ESTADO_CORRESPONDENCIA[c.estado].clase}>{ESTADO_CORRESPONDENCIA[c.estado].label}</Badge>
                    {plazo && <div className={`text-xs mt-1 ${c.vencida ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{plazo}</div>}
                  </TableCell>
                  <TableCell className="align-top">
                    {(puedeEditar || puedeEliminar) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {puedeEditar && <DropdownMenuItem onClick={() => setEdit({ ...c })}><Pencil className="size-4" /> Editar</DropdownMenuItem>}
                          {puedeEditar && c.estado !== 'respondido' && <DropdownMenuItem onClick={() => cambiarEstado(c, 'respondido')}><CheckCircle2 className="size-4" /> Marcar respondido</DropdownMenuItem>}
                          {puedeEditar && c.estado !== 'pendiente' && <DropdownMenuItem onClick={() => cambiarEstado(c, 'pendiente')}><Clock className="size-4" /> Marcar pendiente de respuesta</DropdownMenuItem>}
                          {puedeEditar && c.estado !== 'cerrado' && <DropdownMenuItem onClick={() => cambiarEstado(c, 'cerrado')}>Cerrar</DropdownMenuItem>}
                          {puedeEditar && <DropdownMenuItem onClick={() => setEdit({ proyecto_id: c.proyecto_id, hilo_id: c.hilo_id, etapa: c.etapa, responde_a: c.id, tipo: 'carta', sentido: c.sentido === 'emitido' ? 'recibido' : 'emitido', emisor: c.receptor, receptor: c.emisor, asunto: `Respuesta a ${c.numero_doc ?? c.asunto}`, estado: 'registrado', fecha_documento: hoy(), requiere_respuesta: false })}><Mail className="size-4" /> Registrar respuesta</DropdownMenuItem>}
                          {puedeEliminar && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => eliminar(c)}><Trash2 className="size-4" /> Eliminar</DropdownMenuItem></>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {pag.totalPages > 1 && (
          <div className="flex items-center justify-between p-3 text-sm border-t">
            <span className="text-muted-foreground">Mostrando {pag.paged.length} de {pag.totalItems} · página {pag.page} de {pag.totalPages}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button></div>
          </div>
        )}
      </CardContent></Card>

      {edit && <FormCorrespondencia inicial={edit} todas={filas} tenantId={tenantId ?? ''} userId={user?.id ?? null} proyectoFijo={proyectoId} ocupado={ocupado}
        onCerrar={() => setEdit(null)}
        onGuardar={async (c, nuevoHilo) => {
          setOcupado(true);
          try {
            let hiloId = c.hilo_id ?? null;
            if (nuevoHilo && c.proyecto_id) hiloId = (await guardarHilo({ tenant_id: tenantId ?? undefined, proyecto_id: c.proyecto_id, titulo: nuevoHilo })).id;
            await guardarCorrespondencia({ ...c, hilo_id: hiloId, tenant_id: c.id ? undefined : tenantId ?? undefined, creado_por: c.id ? undefined : user?.id ?? null });
            toast.success(c.id ? 'Documento actualizado' : 'Documento registrado'); setEdit(null); await cargar();
          } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
        }} />}
    </div>
  );
}

function Kpi({ icono, valor, texto, onClick, activo }: { icono: React.ReactNode; valor: number; texto: string; onClick?: () => void; activo?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-lg border p-3 bg-card hover:bg-accent/40 transition ${activo ? 'ring-2 ring-primary/40' : ''} ${onClick ? '' : 'cursor-default'}`}>
      <div className="flex items-center gap-2 text-2xl font-semibold">{icono}{valor}</div>
      <div className="text-xs text-muted-foreground">{texto}</div>
    </button>
  );
}

function FormCorrespondencia({ inicial, todas, tenantId, userId, proyectoFijo, ocupado, onCerrar, onGuardar }: {
  inicial: CorrespondenciaInput; todas: Correspondencia[]; tenantId: string; userId: string | null; proyectoFijo?: string; ocupado: boolean;
  onCerrar: () => void; onGuardar: (c: CorrespondenciaInput, nuevoHilo: string | null) => Promise<void>;
}) {
  void tenantId; void userId;
  const [c, setC] = useState<CorrespondenciaInput>(inicial);
  const [hilos, setHilos] = useState<Hilo[]>([]);
  const [hiloSel, setHiloSel] = useState<string>(inicial.hilo_id ?? '');
  const [nuevoHilo, setNuevoHilo] = useState('');
  const set = <K extends keyof CorrespondenciaInput>(k: K, v: CorrespondenciaInput[K]) => setC(x => ({ ...x, [k]: v }));
  useEffect(() => {
    if (!c.proyecto_id) { setHilos([]); return; }
    cargarHilos(c.proyecto_id).then(setHilos).catch(() => setHilos([]));
  }, [c.proyecto_id]);
  const candidatos = useMemo(() => todas.filter(x => x.proyecto_id === c.proyecto_id && x.id !== c.id && x.numero_doc).slice(0, 400), [todas, c.proyecto_id, c.id]);
  const valido = !!c.proyecto_id && !!(c.asunto ?? '').trim() && (hiloSel !== NUEVO_HILO || nuevoHilo.trim().length > 2);

  return (
    <Dialog open onOpenChange={o => !o && !ocupado && onCerrar()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{c.id ? 'Editar documento' : c.responde_a ? 'Registrar respuesta' : 'Registrar documento'}</DialogTitle>
          <DialogDescription>Carta, oficio, informe o memorándum del expediente. Si requiere respuesta, indique el plazo: el ERP calcula la fecha límite y lo marca vencido.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Proyecto</Label><ProyectoSelector value={c.proyecto_id ?? null} onChange={v => { set('proyecto_id', v ?? undefined); setHiloSel(''); set('hilo_id', null); set('responde_a', null); }} nullable={false} disabled={!!proyectoFijo || !!c.id} /></div>
          <div><Label>Expediente / hito</Label>
            <Select value={hiloSel} onValueChange={v => { setHiloSel(v); set('hilo_id', v === NUEVO_HILO || v === 'ninguno' ? null : v); }}><SelectTrigger><SelectValue placeholder="Sin expediente" /></SelectTrigger>
              <SelectContent><SelectItem value="ninguno">Sin expediente</SelectItem>{hilos.map(h => <SelectItem key={h.id} value={h.id}>{h.titulo}</SelectItem>)}<SelectItem value={NUEVO_HILO}>+ Nuevo expediente…</SelectItem></SelectContent></Select>
            {hiloSel === NUEVO_HILO && <Input className="mt-1" placeholder="Título del expediente (p. ej. VALORIZACIÓN N°03)" value={nuevoHilo} onChange={e => setNuevoHilo(e.target.value)} />}</div>
          <div><Label>Etapa</Label><Input value={c.etapa ?? ''} onChange={e => set('etapa', e.target.value)} placeholder="Sub meta (opcional)" /></div>
          <div><Label>N° de documento</Label><Input value={c.numero_doc ?? ''} onChange={e => set('numero_doc', e.target.value)} placeholder="N°012-2026/MM-OXI-…" /></div>
          <div><Label>Tipo</Label><Select value={c.tipo ?? 'carta'} onValueChange={v => set('tipo', v as TipoCorrespondencia)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TIPO_CORRESPONDENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Sentido</Label><Select value={c.sentido ?? 'recibido'} onValueChange={v => set('sentido', v as SentidoCorrespondencia)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SENTIDO_CORRESPONDENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Estado</Label><Select value={c.estado ?? 'registrado'} onValueChange={v => set('estado', v as EstadoCorrespondencia)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ESTADO_CORRESPONDENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Emisor</Label><Input value={c.emisor ?? ''} onChange={e => set('emisor', e.target.value)} placeholder="EP, EPS, GRSLI, ENTIDAD…" /></div>
          <div><Label>Receptor</Label><Input value={c.receptor ?? ''} onChange={e => set('receptor', e.target.value)} /></div>
          <div className="col-span-2"><Label>Asunto / acción</Label><Textarea rows={2} value={c.asunto ?? ''} onChange={e => set('asunto', e.target.value)} placeholder="Qué pide o informa el documento" /></div>
          <div><Label>Fecha del documento</Label><Input type="date" value={c.fecha_documento ?? ''} onChange={e => set('fecha_documento', e.target.value || null)} /></div>
          <div><Label>Recepción en mesa de partes</Label><Input type="date" value={c.fecha_recepcion ?? ''} onChange={e => set('fecha_recepcion', e.target.value || null)} /></div>
          <div className="col-span-2 flex items-center gap-3 rounded-md border p-2">
            <Switch checked={!!c.requiere_respuesta} onCheckedChange={v => { set('requiere_respuesta', v); if (v && (c.estado === 'registrado' || !c.estado)) set('estado', 'pendiente'); }} />
            <div className="text-sm">Requiere respuesta</div>
            {c.requiere_respuesta && <>
              <Label className="ml-3">Plazo (días)</Label><Input type="number" className="w-20" value={c.plazo_dias ?? ''} onChange={e => set('plazo_dias', e.target.value ? Number(e.target.value) : null)} />
              <Label className="ml-2">Fecha límite</Label><Input type="date" className="w-40" value={c.fecha_limite ?? ''} onChange={e => set('fecha_limite', e.target.value || null)} />
            </>}
          </div>
          <div className="col-span-2"><Label>Responde a</Label>
            <Select value={c.responde_a ?? 'ninguno'} onValueChange={v => set('responde_a', v === 'ninguno' ? null : v)}><SelectTrigger><SelectValue placeholder="No responde a otro documento" /></SelectTrigger>
              <SelectContent><SelectItem value="ninguno">No responde a otro documento</SelectItem>{candidatos.map(x => <SelectItem key={x.id} value={x.id}>{x.numero_doc} · {x.asunto.slice(0, 60)}</SelectItem>)}</SelectContent></Select>
            <p className="text-xs text-muted-foreground mt-1">Al guardar, el documento respondido pasa a "Respondido".</p></div>
          <div><Label>Enlace al archivo</Label><Input value={c.archivo_url ?? ''} onChange={e => set('archivo_url', e.target.value)} placeholder="URL en SharePoint" /></div>
          <div><Label>Nombre del archivo</Label><Input value={c.archivo_nombre ?? ''} onChange={e => set('archivo_nombre', e.target.value)} /></div>
          <div className="col-span-2"><Label>Observaciones</Label><Textarea rows={2} value={c.observaciones ?? ''} onChange={e => set('observaciones', e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onCerrar} disabled={ocupado}>Cancelar</Button>
          <Button disabled={ocupado || !valido} onClick={() => onGuardar(c, hiloSel === NUEVO_HILO ? nuevoHilo.trim() : null)}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : null} Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
