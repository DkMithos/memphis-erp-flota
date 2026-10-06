/**
 * Detalle de una capacitación: participantes con firma, emisión de
 * certificados y descarga de PDFs.
 *
 * Firma de asistencia, dos caminos:
 *   · en el ERP (tablet / pantalla táctil que se pasa de mano en mano), con el
 *     mismo pad de "Mi firma";
 *   · desde el celular del participante, con el QR / enlace de asistencia
 *     (`/c/:token`), que se abre y se cierra desde aquí.
 *
 * Emitir = congelar datos + plantilla en `certificados`; el correlativo y el
 * token del QR los pone la base. Revocar deja el certificado visible como
 * revocado en el portal; "reemitir" lo borra y permite emitir uno nuevo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Copy, Download, ExternalLink, FileSignature, Link2, Loader2, Mail, MoreVertical, Pencil, PenLine, Plus,
  Printer, QrCode, RefreshCw, Trash2, Upload, Users, Eye, ShieldX, CheckCircle2, Clock, MapPin, CalendarDays, UserRound, Ban, Play, Lock, Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Checkbox } from '../../ui/checkbox';
import { Progress } from '../../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { PageNav } from '../../shared/PageNav';
import { PadFirma } from '../../shared/PadFirma';
import { Paginador, numeroDeFila } from '../../shared/Paginador';
import { usePagination } from '../../../lib/shared/usePagination';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { useConfirmAction } from '../../shared/ConfirmDialogProvider';
import { supabase } from '../../../lib/supabase/client';
import { dbCapacitaciones, dbCertificados, dbCursos, dbParticipantes, dbPlantillas } from '../../../lib/capacitaciones/db';
import {
  capitalizarNombre, construirDatosCertificado, dniValido, fechaCorta, horasCortas, nombreCompleto, normalizarDni,
  parsearParticipantes, rangoFechas, snapshotPlantilla, sugerirPlantilla,
} from '../../../lib/capacitaciones/datos';
import { useQrDataUrl } from '../../../lib/capacitaciones/qr';
import { urlAsistencia, urlPortalCertificados, urlVerificacion } from '../../../lib/capacitaciones/urls';
import { descargarCertificadosPdf, descargarCertificadosZip, nombreArchivoCertificado } from '../../../lib/capacitaciones/certificado-pdf';
import { imprimirHojaAsistencia } from '../../../lib/capacitaciones/hoja-asistencia';
import { ESTADO_CAPACITACION, type Capacitacion, type Certificado, type Curso, type Participante, type Plantilla } from '../../../lib/capacitaciones/types';
import { CertificadoPreview } from './CertificadoVista';
import { CapacitacionDialog } from './CapacitacionDialog';

interface Props { id: string; onNavigate: (r: string) => void }

const copiar = async (texto: string, msg = 'Copiado') => {
  try { await navigator.clipboard.writeText(texto); toast.success(msg); } catch { toast.error('No se pudo copiar'); }
};

export function CapacitacionDetalle({ id, onNavigate }: Props) {
  const { tenantId, profile } = useAuth();
  const { can } = usePermissions();
  const confirmar = useConfirmAction();
  const [cap, setCap] = useState<Capacitacion | null>(null);
  const [parts, setParts] = useState<Participante[]>([]);
  const [certs, setCerts] = useState<Certificado[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState(false);
  const [tab, setTab] = useState('participantes');

  const puedeEditar = can('proyectos', 'editar');
  const puedeEmitir = can('proyectos', 'aprobar');
  const puedeRevocar = can('proyectos', 'eliminar');
  const quien = profile?.nombre ?? profile?.email ?? null;

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [c, p, ce, pl, cu] = await Promise.all([
        dbCapacitaciones.obtener(id), dbParticipantes.listar(id), dbCertificados.listarPorCapacitacion(id),
        dbPlantillas.listar(tenantId), dbCursos.listar(tenantId),
      ]);
      setCap(c); setParts(p); setCerts(ce); setPlantillas(pl); setCursos(cu);
    } catch (e: any) { toast.error(e.message); } finally { setCargando(false); }
  }, [id, tenantId]);
  useEffect(() => { cargar(); }, [cargar]);

  const recargarParticipantes = async () => { setParts(await dbParticipantes.listar(id)); setCap(await dbCapacitaciones.obtener(id)); };
  const recargarCertificados = async () => { setCerts(await dbCertificados.listarPorCapacitacion(id)); await recargarParticipantes(); };

  const cambiarEstado = async (estado: Capacitacion['estado']) => {
    if (!cap) return;
    const textos: Record<string, string> = {
      en_curso: '¿Marcar la capacitación como en curso?',
      cerrada: 'Cerrar la capacitación también cierra el registro de asistencia por enlace. ¿Continuar?',
      anulada: 'Una capacitación anulada deja de verse en el portal público. ¿Anular?',
      programada: '¿Volver a dejarla como programada?',
    };
    const ok = await confirmar({ title: ESTADO_CAPACITACION[estado].label, description: textos[estado], confirmLabel: 'Sí, continuar', variant: estado === 'anulada' ? 'destructive' : 'default' });
    if (!ok) return;
    try {
      const nueva = await dbCapacitaciones.actualizar(cap.id, { estado, ...(estado === 'cerrada' || estado === 'anulada' ? { asistencia_abierta: false } : {}) } as any);
      setCap(nueva); toast.success(`Capacitación ${ESTADO_CAPACITACION[estado].label.toLowerCase()}`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (cargando) return <div className="p-6 text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Cargando…</div>;
  if (!cap) return <div className="p-6"><PageNav onBack={() => onNavigate('/proyectos/capacitaciones')} /><p className="text-muted-foreground mt-4">Capacitación no encontrada.</p></div>;

  const est = ESTADO_CAPACITACION[cap.estado] ?? ESTADO_CAPACITACION.programada;
  const asistentes = parts.filter(p => p.asistio !== false);
  const firmados = asistentes.filter(p => p.firma_data_url);
  const emitidos = certs.filter(c => c.estado === 'emitido');

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageNav onBack={() => onNavigate('/proyectos/capacitaciones')} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{cap.codigo}</span>
            <Badge className={est.color} variant="outline">{est.label}</Badge>
            {cap.asistencia_abierta && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" variant="outline"><Unlock className="size-3 mr-1" /> Asistencia abierta</Badge>}
          </div>
          <h1 className="text-2xl font-semibold mt-1">{cap.titulo}</h1>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {cap.proyecto && <span className="inline-flex items-center gap-1"><Award className="size-3.5" /> {cap.proyecto.codigo} — {cap.proyecto.nombre}</span>}
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> {rangoFechas(cap.fecha_inicio, cap.fecha_fin)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {horasCortas(cap.horas_total)}</span>
            {(cap.lugar || cap.ciudad) && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {[cap.lugar, cap.ciudad].filter(Boolean).join(', ')}</span>}
            {cap.instructor_nombre && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" /> {cap.instructor_nombre}{cap.instructor_cargo ? ` (${cap.instructor_cargo})` : ''}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeEditar && <Button variant="outline" onClick={() => setEditar(true)}><Pencil className="size-4" /> Editar</Button>}
          {puedeEditar && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><MoreVertical className="size-4" /> Estado</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {cap.estado === 'programada' && <DropdownMenuItem onClick={() => cambiarEstado('en_curso')}><Play className="size-4" /> Iniciar (en curso)</DropdownMenuItem>}
                {cap.estado !== 'cerrada' && cap.estado !== 'anulada' && <DropdownMenuItem onClick={() => cambiarEstado('cerrada')}><Lock className="size-4" /> Cerrar capacitación</DropdownMenuItem>}
                {cap.estado === 'cerrada' && <DropdownMenuItem onClick={() => cambiarEstado('en_curso')}><Unlock className="size-4" /> Reabrir</DropdownMenuItem>}
                {cap.estado === 'anulada' && <DropdownMenuItem onClick={() => cambiarEstado('programada')}><RefreshCw className="size-4" /> Restaurar</DropdownMenuItem>}
                {cap.estado !== 'anulada' && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => cambiarEstado('anulada')}><Ban className="size-4" /> Anular</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Mini label="Participantes" v={asistentes.length} icono={<Users className="size-4" />} />
        <Mini label="Con firma" v={firmados.length} de={asistentes.length} icono={<PenLine className="size-4" />} />
        <Mini label="Certificados" v={emitidos.length} de={asistentes.length} icono={<Award className="size-4" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="participantes">Participantes y firmas</TabsTrigger>
          <TabsTrigger value="certificados">Certificados</TabsTrigger>
          <TabsTrigger value="temario">Temario y datos</TabsTrigger>
        </TabsList>

        <TabsContent value="participantes" className="mt-4">
          <Participantes cap={cap} parts={parts} tenantId={tenantId!} puedeEditar={puedeEditar}
            plantilla={plantillas.find(p => p.id === cap.plantilla_id) ?? sugerirPlantilla(plantillas, cap)}
            onCambioCap={setCap} onRecargar={recargarParticipantes} />
        </TabsContent>

        <TabsContent value="certificados" className="mt-4">
          <Certificados cap={cap} parts={parts} certs={certs} plantillas={plantillas} tenantId={tenantId!}
            puedeEmitir={puedeEmitir} puedeRevocar={puedeRevocar} quien={quien} emailQuien={profile?.email ?? null}
            onRecargar={recargarCertificados} onCambioCap={setCap} />
        </TabsContent>

        <TabsContent value="temario" className="mt-4">
          <Card>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Temario</h3>
                {cap.temario.length ? (
                  <ul className="space-y-1">
                    {cap.temario.map((t, i) => <li key={i} className="flex justify-between border-b border-dashed pb-1"><span>{t.tema}</span><span className="text-muted-foreground">{horasCortas(t.horas)}</span></li>)}
                    <li className="flex justify-between font-medium pt-1"><span>Total</span><span>{horasCortas(cap.horas_total)}</span></li>
                  </ul>
                ) : <p className="text-muted-foreground">Sin temario. Edite la capacitación para agregarlo.</p>}
                {cap.descripcion && <><h3 className="font-semibold mt-4 mb-1">Descripción</h3><p className="text-muted-foreground whitespace-pre-wrap">{cap.descripcion}</p></>}
              </div>
              <dl className="space-y-2">
                <D k="Entidad beneficiaria" v={cap.entidad_beneficiaria || cap.proyecto?.entidad_cliente || '—'} />
                <D k="Plantilla del certificado" v={plantillas.find(p => p.id === cap.plantilla_id)?.nombre ?? `Sugerida: ${sugerirPlantilla(plantillas, cap)?.nombre ?? '—'}`} />
                <D k="Creada por" v={`${cap.creado_por ?? '—'} · ${fechaCorta(cap.creado_en)}`} />
                {cap.observaciones && <D k="Observaciones" v={cap.observaciones} />}
                <div className="pt-2">
                  <a className="text-primary underline inline-flex items-center gap-1" href={urlPortalCertificados()} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Portal público de consulta por DNI</a>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CapacitacionDialog open={editar} onOpenChange={setEditar} inicial={cap} cursos={cursos} plantillas={plantillas} onGuardado={c => setCap(c)} />
    </div>
  );
}

function Mini({ label, v, de, icono }: { label: string; v: number; de?: number; icono: React.ReactNode }) {
  const pct = de ? Math.round(v / de * 100) : null;
  return (
    <Card><CardContent className="p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}{icono}</div>
      <div className="text-xl font-semibold">{v}{de !== undefined && <span className="text-sm text-muted-foreground font-normal">/{de}</span>}</div>
      {pct !== null && <Progress value={pct} className="h-1.5 mt-1" />}
    </CardContent></Card>
  );
}

function D({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTICIPANTES
// ═══════════════════════════════════════════════════════════════════════════
function Participantes({ cap, parts, tenantId, puedeEditar, plantilla, onCambioCap, onRecargar }: {
  cap: Capacitacion; parts: Participante[]; tenantId: string; puedeEditar: boolean; plantilla: Plantilla | null;
  onCambioCap: (c: Capacitacion) => void; onRecargar: () => Promise<void>;
}) {
  const confirmar = useConfirmAction();
  const [alta, setAlta] = useState<Partial<Participante> | null>(null);
  const [importar, setImportar] = useState(false);
  const [firmando, setFirmando] = useState<Participante | null>(null);
  const [verFirma, setVerFirma] = useState<Participante | null>(null);
  const [mostrarQR, setMostrarQR] = useState(false);
  const linkAsistencia = urlAsistencia(cap.asistencia_token);
  const qr = useQrDataUrl(mostrarQR ? linkAsistencia : null);
  // 138 participantes en una sola tabla no se puede trabajar: 20 por página.
  const pagParts = usePagination(parts);
  const cerrada = cap.estado === 'cerrada' || cap.estado === 'anulada';

  const toggleAsistencia = async (abierta: boolean) => {
    try {
      const n = await dbCapacitaciones.actualizar(cap.id, { asistencia_abierta: abierta, ...(abierta && cap.estado === 'programada' ? { estado: 'en_curso' } : {}) } as any);
      onCambioCap(n);
      toast.success(abierta ? 'Registro por enlace ABIERTO' : 'Registro por enlace cerrado');
    } catch (e: any) { toast.error(e.message); }
  };

  const regenerar = async () => {
    const ok = await confirmar({ title: 'Generar un enlace nuevo', description: 'El QR y el enlace actuales dejarán de funcionar. Útil si se compartió por error.', confirmLabel: 'Generar nuevo' });
    if (!ok) return;
    try { const token = await dbCapacitaciones.regenerarTokenAsistencia(cap.id); onCambioCap({ ...cap, asistencia_token: token }); toast.success('Enlace regenerado'); }
    catch (e: any) { toast.error(e.message); }
  };

  const eliminar = async (p: Participante) => {
    if (p.certificado) { toast.error('Tiene certificado emitido: revóquelo primero'); return; }
    const ok = await confirmar({ title: 'Quitar participante', description: `¿Quitar a ${nombreCompleto(p)} de la lista?`, confirmLabel: 'Quitar', variant: 'destructive' });
    if (!ok) return;
    try { await dbParticipantes.eliminar(p.id); await onRecargar(); } catch (e: any) { toast.error(e.message); }
  };

  const quitarFirma = async (p: Participante) => {
    const ok = await confirmar({ title: 'Borrar firma', description: `Se borra la firma de ${nombreCompleto(p)} para que vuelva a firmar.`, confirmLabel: 'Borrar firma', variant: 'destructive' });
    if (!ok) return;
    try { await dbParticipantes.quitarFirma(p.id); await onRecargar(); } catch (e: any) { toast.error(e.message); }
  };

  const toggleAsistio = async (p: Participante, v: boolean) => {
    try { await dbParticipantes.actualizar(p.id, { asistio: v } as any); await onRecargar(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Lista de participantes</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => imprimirHojaAsistencia(cap, parts, plantilla)}><Printer className="size-4" /> Hoja de asistencia</Button>
              {puedeEditar && <Button variant="outline" size="sm" onClick={() => setImportar(true)}><Upload className="size-4" /> Importar lista</Button>}
              {puedeEditar && <Button size="sm" onClick={() => setAlta({ dni: '', nombres: '', apellidos: '', cargo: '', institucion: cap.entidad_beneficiaria ?? '', email: '', telefono: '' })}><Plus className="size-4" /> Agregar</Button>}
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>Cargo / Institución</TableHead>
                  <TableHead className="text-center">Firma</TableHead>
                  <TableHead className="text-center">Asistió</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Sin participantes. Agréguelos a mano, importe la lista o abra el enlace de asistencia para que se registren ellos mismos.</TableCell></TableRow>}
                {pagParts.paged.map((p, i) => (
                  <TableRow key={p.id} className={p.asistio === false ? 'opacity-50' : ''}>
                    <TableCell className="text-muted-foreground">{numeroDeFila(pagParts.page, pagParts.pageSize, i)}</TableCell>
                    <TableCell className="font-mono text-xs">{p.dni}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.apellidos}, {p.nombres}</div>
                      {(p.email || p.telefono) && <div className="text-xs text-muted-foreground">{[p.email, p.telefono].filter(Boolean).join(' · ')}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{[p.cargo, p.institucion].filter(Boolean).join(' · ') || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">
                      {p.firma_data_url ? (
                        <button className="inline-flex flex-col items-center" onClick={() => setVerFirma(p)} title="Ver firma">
                          <img src={p.firma_data_url} alt="Firma" className="h-8 max-w-[90px] object-contain bg-white rounded border px-1" />
                          <span className="text-[10px] text-muted-foreground">{p.firma_origen === 'enlace' ? 'por enlace' : 'en el ERP'}</span>
                        </button>
                      ) : puedeEditar ? (
                        <Button size="sm" variant="outline" onClick={() => setFirmando(p)}><FileSignature className="size-4" /> Firmar</Button>
                      ) : <span className="text-xs text-muted-foreground">Pendiente</span>}
                    </TableCell>
                    <TableCell className="text-center"><Switch checked={p.asistio !== false} onCheckedChange={v => toggleAsistio(p, v)} disabled={!puedeEditar || !!p.certificado} /></TableCell>
                    <TableCell>
                      {p.certificado?.estado === 'emitido' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" variant="outline">{p.certificado.codigo}</Badge>}
                      {p.certificado?.estado === 'revocado' && <Badge variant="destructive">Revocado</Badge>}
                      {!p.certificado && <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {puedeEditar && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAlta({ ...p })}><Pencil className="size-4" /> Editar datos</DropdownMenuItem>
                            {p.firma_data_url && <DropdownMenuItem onClick={() => quitarFirma(p)}><RefreshCw className="size-4" /> Borrar firma (volver a firmar)</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => eliminar(p)}><Trash2 className="size-4" /> Quitar de la lista</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Paginador {...pagParts} nombre="participantes" />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><QrCode className="size-4" /> Registro desde el celular</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Proyecte el QR o comparta el enlace: cada participante llena sus datos y firma en su propio teléfono.</p>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="asis-abierta" className="flex items-center gap-2">{cap.asistencia_abierta ? <Unlock className="size-4 text-emerald-600" /> : <Lock className="size-4" />} Registro abierto</Label>
              <Switch id="asis-abierta" checked={cap.asistencia_abierta} onCheckedChange={toggleAsistencia} disabled={!puedeEditar || cerrada} />
            </div>
            {cerrada && <p className="text-xs text-amber-700">La capacitación está {ESTADO_CAPACITACION[cap.estado].label.toLowerCase()}; reábrala para habilitar el enlace.</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setMostrarQR(v => !v)}><QrCode className="size-4" /> {mostrarQR ? 'Ocultar QR' : 'Mostrar QR'}</Button>
              <Button variant="outline" size="sm" onClick={() => copiar(linkAsistencia, 'Enlace copiado')}><Copy className="size-4" /></Button>
              <Button variant="outline" size="sm" asChild><a href={linkAsistencia} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a></Button>
            </div>
            {mostrarQR && (
              <div className="rounded-md border bg-white p-4 flex flex-col items-center gap-2">
                {qr ? <img src={qr} alt="QR de asistencia" className="w-56 h-56" /> : <Loader2 className="size-6 animate-spin" />}
                <div className="text-xs text-center text-slate-600 break-all">{linkAsistencia}</div>
                <div className="text-sm font-semibold text-slate-800 text-center">{cap.titulo}</div>
                <Button variant="outline" size="sm" onClick={() => imprimirQR(cap, linkAsistencia, qr)}><Printer className="size-4" /> Imprimir cartel con QR</Button>
              </div>
            )}
            {puedeEditar && <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={regenerar}><RefreshCw className="size-4" /> Generar un enlace nuevo</Button>}
          </CardContent>
        </Card>
      </div>

      {/* Alta / edición manual */}
      <Dialog open={!!alta} onOpenChange={o => !o && setAlta(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{alta?.id ? 'Editar participante' : 'Agregar participante'}</DialogTitle></DialogHeader>
          {alta && <FormParticipante inicial={alta} cap={cap} tenantId={tenantId} onListo={async () => { setAlta(null); await onRecargar(); }} />}
        </DialogContent>
      </Dialog>

      {/* Firma en el ERP */}
      <Dialog open={!!firmando} onOpenChange={o => !o && setFirmando(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Firma de {firmando ? nombreCompleto(firmando) : ''}</DialogTitle>
            <DialogDescription>DNI {firmando?.dni}. Pase el equipo al participante para que firme con el dedo o el lápiz.</DialogDescription>
          </DialogHeader>
          {firmando && (
            <PadFirma alto={220} onFirmar={async png => {
              try { await dbParticipantes.firmarEnErp(firmando.id, png); toast.success('Firma registrada'); setFirmando(null); await onRecargar(); }
              catch (e: any) { toast.error(e.message); }
            }} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!verFirma} onOpenChange={o => !o && setVerFirma(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{verFirma ? nombreCompleto(verFirma) : ''}</DialogTitle>
            <DialogDescription>Firmó el {verFirma?.firmado_en ? new Date(verFirma.firmado_en).toLocaleString('es-PE') : '—'} {verFirma?.firma_origen === 'enlace' ? 'desde su celular' : 'en el ERP'}.</DialogDescription></DialogHeader>
          {verFirma?.firma_data_url && <div className="bg-white rounded border p-4 flex justify-center"><img src={verFirma.firma_data_url} alt="Firma" className="max-h-40 object-contain" /></div>}
        </DialogContent>
      </Dialog>

      <ImportarDialog open={importar} onOpenChange={setImportar} cap={cap} tenantId={tenantId} onListo={onRecargar} />
    </div>
  );
}

function imprimirQR(cap: Capacitacion, link: string, qr?: string) {
  if (!qr) return;
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR asistencia ${cap.codigo}</title>
  <style>@page{size:A4 portrait;margin:20mm} body{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#17364c;text-align:center;margin:0}
  h1{font:600 26pt/1.2 Georgia,serif;margin:10mm 0 4mm} h2{font-size:14pt;font-weight:500;color:#526b7b;margin:0 0 12mm}
  img{width:120mm;height:120mm;border:1px solid #b28b45;padding:6mm} p{font-size:12pt;margin-top:10mm} .u{font-family:Consolas,monospace;font-size:10pt;color:#526b7b;word-break:break-all}</style></head>
  <body><h1>Registre su asistencia</h1><h2>${cap.titulo}</h2><img src="${qr}" alt="QR"><p>Escanee el código con la cámara de su celular,<br>complete sus datos y firme en la pantalla.</p><p class="u">${link}</p></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function FormParticipante({ inicial, cap, tenantId, onListo }: { inicial: Partial<Participante>; cap: Capacitacion; tenantId: string; onListo: () => Promise<void> }) {
  const [f, setF] = useState(inicial);
  const [firma, setFirma] = useState<string | null>(null);
  const [firmarAhora, setFirmarAhora] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof Participante, v: string) => setF(prev => ({ ...prev, [k]: v }));

  const guardar = async () => {
    const dni = normalizarDni(f.dni ?? '');
    if (!dniValido(dni)) { toast.error('DNI de 8 dígitos o carné de extranjería'); return; }
    if (!f.nombres?.trim() || !f.apellidos?.trim()) { toast.error('Nombres y apellidos son obligatorios'); return; }
    setGuardando(true);
    try {
      const base = {
        dni, nombres: f.nombres.trim(), apellidos: f.apellidos.trim(),
        cargo: f.cargo?.trim() || null, institucion: f.institucion?.trim() || null,
        email: f.email?.trim().toLowerCase() || null, telefono: f.telefono?.trim() || null,
      };
      if (f.id) {
        await dbParticipantes.actualizar(f.id, base as any);
      } else {
        await dbParticipantes.agregar({
          ...base, tenant_id: tenantId, capacitacion_id: cap.id, asistio: true,
          ...(firma ? { firma_data_url: firma, firmado_en: new Date().toISOString(), firma_origen: 'erp' } : {}),
        } as any);
      }
      toast.success(f.id ? 'Datos actualizados' : 'Participante agregado');
      await onListo();
    } catch (e: any) { toast.error(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>DNI *</Label><Input value={f.dni ?? ''} onChange={e => set('dni', e.target.value)} inputMode="numeric" maxLength={12} /></div>
        <div className="space-y-1"><Label>Cargo</Label><Input value={f.cargo ?? ''} onChange={e => set('cargo', e.target.value)} /></div>
        <div className="space-y-1"><Label>Nombres *</Label><Input value={f.nombres ?? ''} onChange={e => set('nombres', e.target.value)} /></div>
        <div className="space-y-1"><Label>Apellidos *</Label><Input value={f.apellidos ?? ''} onChange={e => set('apellidos', e.target.value)} /></div>
        <div className="space-y-1"><Label>Institución / área</Label><Input value={f.institucion ?? ''} onChange={e => set('institucion', e.target.value)} /></div>
        <div className="space-y-1"><Label>Correo</Label><Input type="email" value={f.email ?? ''} onChange={e => set('email', e.target.value)} /></div>
        <div className="space-y-1"><Label>Teléfono</Label><Input value={f.telefono ?? ''} onChange={e => set('telefono', e.target.value)} /></div>
      </div>
      {!f.id && (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Checkbox id="firmar-ahora" checked={firmarAhora} onCheckedChange={v => setFirmarAhora(!!v)} /><Label htmlFor="firmar-ahora">Firmar ahora en esta pantalla</Label></div>
          {firmarAhora && (firma
            ? <div className="rounded border bg-white p-2 flex items-center justify-between"><img src={firma} alt="Firma" className="h-12 object-contain" /><Button type="button" size="sm" variant="outline" onClick={() => setFirma(null)}>Repetir</Button></div>
            : <PadFirma alto={160} onFirmar={setFirma} />)}
        </div>
      )}
      <DialogFooter>
        <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : f.id ? 'Guardar' : 'Agregar'}</Button>
      </DialogFooter>
    </div>
  );
}

function ImportarDialog({ open, onOpenChange, cap, tenantId, onListo }: { open: boolean; onOpenChange: (o: boolean) => void; cap: Capacitacion; tenantId: string; onListo: () => Promise<void> }) {
  const [texto, setTexto] = useState('');
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filas = useMemo(() => parsearParticipantes(texto), [texto]);
  const validas = filas.filter(f => dniValido(f.dni) && f.nombres && f.apellidos);

  const importar = async () => {
    if (!validas.length) return;
    setImportando(true);
    try {
      const r = await dbParticipantes.agregarVarios(validas.map(f => ({
        tenant_id: tenantId, capacitacion_id: cap.id, dni: f.dni,
        nombres: capitalizarNombre(f.nombres), apellidos: capitalizarNombre(f.apellidos),
        cargo: f.cargo ?? null, institucion: f.institucion ?? cap.entidad_beneficiaria ?? null, email: f.email ?? null, asistio: true,
      })));
      toast.success(`${r.insertados} participante(s) importados${r.omitidos ? `, ${r.omitidos} ya estaban` : ''}`);
      setTexto(''); onOpenChange(false); await onListo();
    } catch (e: any) { toast.error(e.message); } finally { setImportando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar lista de participantes</DialogTitle>
          <DialogDescription>Pegue desde Excel (DNI, nombres, apellidos, cargo, institución, correo) o una persona por línea: <code>45678912 Ana María García Quispe, Conductora</code>. Las firmas se toman después.</DialogDescription>
        </DialogHeader>
        <Textarea rows={8} value={texto} onChange={e => setTexto(e.target.value)} placeholder={'dni\tnombres\tapellidos\tcargo\n45678912\tAna María\tGarcía Quispe\tConductora'} className="font-mono text-xs" />
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Cargar CSV / TXT</Button>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/plain,text/csv" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setTexto(await f.text()); e.target.value = ''; }} />
          <span className="text-sm text-muted-foreground">{validas.length} válidas de {filas.length}{filas.length > validas.length ? ' (las demás sin DNI válido)' : ''}</span>
        </div>
        {validas.length > 0 && (
          <div className="max-h-48 overflow-auto rounded border text-xs">
            <table className="w-full"><tbody>
              {validas.slice(0, 50).map((f, i) => <tr key={i} className="border-b"><td className="p-1 font-mono">{f.dni}</td><td className="p-1">{capitalizarNombre(f.apellidos)}, {capitalizarNombre(f.nombres)}</td><td className="p-1 text-muted-foreground">{f.cargo}</td></tr>)}
            </tbody></table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={!validas.length || importando}>{importando ? 'Importando…' : `Importar ${validas.length}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CERTIFICADOS
// ═══════════════════════════════════════════════════════════════════════════
function Certificados({ cap, parts, certs, plantillas, tenantId, puedeEmitir, puedeRevocar, quien, emailQuien, onRecargar, onCambioCap }: {
  cap: Capacitacion; parts: Participante[]; certs: Certificado[]; plantillas: Plantilla[]; tenantId: string;
  puedeEmitir: boolean; puedeRevocar: boolean; quien: string | null; emailQuien: string | null;
  onRecargar: () => Promise<void>; onCambioCap: (c: Capacitacion) => void;
}) {
  const confirmar = useConfirmAction();
  const sugerida = useMemo(() => sugerirPlantilla(plantillas, cap), [plantillas, cap]);
  const [plantillaId, setPlantillaId] = useState<string | null>(cap.plantilla_id ?? sugerida?.id ?? null);
  const [soloFirmados, setSoloFirmados] = useState(true);
  const [emitiendo, setEmitiendo] = useState(false);
  const [ver, setVer] = useState<Certificado | null>(null);
  const [revocando, setRevocando] = useState<Certificado | null>(null);
  const [motivo, setMotivo] = useState('');
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  useEffect(() => { setPlantillaId(cap.plantilla_id ?? sugerida?.id ?? null); }, [cap.plantilla_id, sugerida?.id]);

  const plantilla = plantillas.find(p => p.id === plantillaId) ?? null;
  const pendientes = parts.filter(p => p.asistio !== false && !p.certificado && (!soloFirmados || p.firma_data_url));
  const previewPart = parts.find(p => p.asistio !== false) ?? null;
  const qrPreview = useQrDataUrl(plantilla?.mostrar_qr ? urlVerificacion('00000000-0000-0000-0000-000000000000') : null);
  const qrVer = useQrDataUrl(ver && ver.plantilla.mostrar_qr !== false ? urlVerificacion(ver.token) : null);

  // Emisión en dos pasos: primero se eligen las personas (todas marcadas, con su
  // nota a la vista para desmarcar las de asistencia parcial o datos dudosos),
  // y recién entonces se emite. Antes era todo o nada.
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [filtroSel, setFiltroSel] = useState('');

  const emitir = () => {
    if (!plantilla) { toast.error('Elija la plantilla del certificado'); return; }
    if (!pendientes.length) return;
    setSeleccion(new Set(pendientes.map(p => p.id)));
    setFiltroSel('');
    setSeleccionando(true);
  };

  const confirmarEmision = async () => {
    if (!plantilla) return;
    const elegidos = pendientes.filter(p => seleccion.has(p.id));
    if (!elegidos.length) { toast.error('No hay nadie seleccionado'); return; }
    setEmitiendo(true);
    try {
      const snap = snapshotPlantilla(plantilla);
      const nuevos = await dbCertificados.emitir(elegidos.map(p => ({
        tenant_id: tenantId, capacitacion_id: cap.id, participante_id: p.id,
        datos: construirDatosCertificado(cap, p, plantilla), plantilla: snap,
        emitido_por: quien, emitido_por_email: emailQuien,
      })));
      if (!cap.plantilla_id) onCambioCap(await dbCapacitaciones.actualizar(cap.id, { plantilla_id: plantilla.id } as any));
      toast.success(`${nuevos.length} certificado(s) emitidos`);
      setSeleccionando(false);
      await onRecargar();
    } catch (e: any) { toast.error(e.message); } finally { setEmitiendo(false); }
  };

  const pendientesFiltrados = useMemo(() => {
    const t = filtroSel.trim().toLowerCase();
    return t ? pendientes.filter(p => [p.dni, p.nombres, p.apellidos, p.institucion ?? '', p.nota ?? ''].some(v => v.toLowerCase().includes(t))) : pendientes;
  }, [pendientes, filtroSel]);
  const alternar = (id: string, v: boolean) => setSeleccion(prev => { const n = new Set(prev); if (v) n.add(id); else n.delete(id); return n; });

  const descargar = async (lista: Certificado[]) => {
    if (!lista.length) return;
    setProgreso({ hechos: 0, total: lista.length });
    try {
      const nombre = lista.length === 1
        ? nombreArchivoCertificado(lista[0].codigo, nombreCompleto(lista[0].datos.participante))
        : `Certificados ${cap.codigo}.pdf`;
      await descargarCertificadosPdf(lista.map(c => ({ plantilla: c.plantilla, datos: c.datos, codigo: c.codigo, token: c.token, marca: c.estado === 'revocado' ? 'REVOCADO' : undefined })), nombre, (h, t) => setProgreso({ hechos: h, total: t }));
    } catch (e: any) { toast.error(e.message); } finally { setProgreso(null); }
  };

  // ZIP con un PDF por persona: lo que necesita Operaciones para repartir o
  // enviar cada certificado por separado.
  const descargarZip = async (lista: Certificado[]) => {
    if (!lista.length) return;
    setProgreso({ hechos: 0, total: lista.length });
    try {
      await descargarCertificadosZip(
        lista.map(c => ({ plantilla: c.plantilla, datos: c.datos, codigo: c.codigo, token: c.token, marca: c.estado === 'revocado' ? 'REVOCADO' : undefined })),
        `Certificados ${cap.codigo} (uno por persona).zip`,
        (h, t) => setProgreso({ hechos: h, total: t }),
      );
      toast.success(`ZIP con ${lista.length} certificado(s) descargado`);
    } catch (e: any) { toast.error(e.message); } finally { setProgreso(null); }
  };

  const revocar = async () => {
    if (!revocando || motivo.trim().length < 4) { toast.error('Indique el motivo'); return; }
    try { await dbCertificados.revocar(revocando.id, motivo.trim(), quien); toast.success('Certificado revocado'); setRevocando(null); setMotivo(''); await onRecargar(); }
    catch (e: any) { toast.error(e.message); }
  };

  const reemitir = async (c: Certificado) => {
    const ok = await confirmar({ title: 'Reemitir certificado', description: 'Se elimina el certificado revocado y el participante vuelve a quedar pendiente para una nueva emisión (con nuevo código).', confirmLabel: 'Continuar' });
    if (!ok) return;
    try { await dbCertificados.eliminarRevocado(c.id); await onRecargar(); } catch (e: any) { toast.error(e.message); }
  };

  const enviarCorreo = async (c: Certificado) => {
    const email = c.participante?.email;
    if (!email) { toast.error('El participante no tiene correo registrado'); return; }
    setEnviando(c.id);
    try {
      const nombre = nombreCompleto(c.datos.participante);
      const link = urlVerificacion(c.token);
      const html = `<p>Estimado(a) ${nombre},</p>
<p>Le compartimos su certificado <b>${c.codigo}</b> por su participación en la capacitación <b>${c.datos.capacitacion.titulo}</b>${c.datos.consorcio ? `, emitido por ${c.datos.consorcio}` : ''}.</p>
<p><a href="${link}">Ver y descargar mi certificado</a></p>
<p>También puede consultar todas sus capacitaciones con su DNI en <a href="${urlPortalCertificados()}">${urlPortalCertificados()}</a>.</p>
<p style="color:#64748b;font-size:12px">Este certificado tiene un código QR de verificación. Cualquier persona puede comprobar su autenticidad escaneándolo.</p>`;
      const { data, error } = await supabase.functions.invoke('correo-enviar', { body: { tenant_id: tenantId, para: email, asunto: `Su certificado ${c.codigo} — ${c.datos.capacitacion.titulo}`, html } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success(`Correo enviado a ${email}`);
    } catch (e: any) { toast.error(`No se pudo enviar: ${e.message}`); } finally { setEnviando(null); }
  };

  const emitidos = certs.filter(c => c.estado === 'emitido');
  const pagCerts = usePagination(certs);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="size-4" /> Emitir certificados</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label>Plantilla</Label>
              <Select value={plantillaId ?? '_none'} onValueChange={v => setPlantillaId(v === '_none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Elegir plantilla" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Elegir —</SelectItem>
                  {plantillas.filter(p => p.activa || p.id === plantillaId).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}{p.id === sugerida?.id ? ' · sugerida' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Checkbox id="solo-firmados" checked={soloFirmados} onCheckedChange={v => setSoloFirmados(!!v)} /><Label htmlFor="solo-firmados">Solo a quienes ya firmaron la asistencia</Label></div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="font-medium">{pendientes.length} por emitir</div>
              <div className="text-xs text-muted-foreground">{emitidos.length} emitidos · {parts.filter(p => p.asistio !== false && !p.firma_data_url).length} sin firma</div>
            </div>
            {puedeEmitir ? (
              <Button className="w-full" onClick={emitir} disabled={emitiendo || !pendientes.length || !plantilla}>
                {emitiendo ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />} Emitir {pendientes.length ? `${pendientes.length} certificado(s)` : ''}
              </Button>
            ) : <p className="text-xs text-muted-foreground">Emitir requiere el permiso de aprobación de Proyectos.</p>}
            {emitidos.length > 0 && (
              <>
                <Button variant="outline" className="w-full" onClick={() => descargar(emitidos)} disabled={!!progreso}>
                  <Download className="size-4" /> Descargar todos en un PDF ({emitidos.length})
                </Button>
                <Button variant="outline" className="w-full" onClick={() => descargarZip(emitidos)} disabled={!!progreso}>
                  <Download className="size-4" /> Descargar ZIP, un PDF por persona ({emitidos.length})
                </Button>
              </>
            )}
            {progreso && (
              <div className="space-y-1">
                <Progress value={progreso.hechos / progreso.total * 100} />
                <div className="text-xs text-muted-foreground text-center">Generando {progreso.hechos} de {progreso.total}…</div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          {plantilla ? (
            <CertificadoPreview plantilla={plantilla} datos={construirDatosCertificado(cap, previewPart ?? ({ nombres: 'Nombre del', apellidos: 'Participante', dni: '00000000' } as any), plantilla)} qrDataUrl={qrPreview} codigo="CERT-AAAA-00000" marca={previewPart ? undefined : 'VISTA PREVIA'} />
          ) : <Card><CardContent className="p-10 text-center text-muted-foreground">Elija una plantilla para ver cómo saldrá el certificado.</CardContent></Card>}
          <p className="text-xs text-muted-foreground">Vista previa con los datos de {previewPart ? nombreCompleto(previewPart) : 'muestra'}. Para cambiar el diseño: Plantillas.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Certificados emitidos ({emitidos.length} vigentes)</CardTitle>
            {emitidos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => descargar(emitidos)} disabled={!!progreso}>
                  <Download className="size-4" /> Todos en un PDF
                </Button>
                <Button size="sm" onClick={() => descargarZip(emitidos)} disabled={!!progreso}>
                  <Download className="size-4" /> ZIP, un PDF por persona
                </Button>
              </div>
            )}
          </div>
          {progreso && (
            <div className="space-y-1 pt-2">
              <Progress value={progreso.hechos / progreso.total * 100} />
              <div className="text-xs text-muted-foreground">Generando {progreso.hechos} de {progreso.total}… no cierre esta pestaña.</div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Participante</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aún no se emitieron certificados.</TableCell></TableRow>}
              {pagCerts.paged.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell>
                    <div className="font-medium">{nombreCompleto(c.datos.participante)}</div>
                    <div className="text-xs text-muted-foreground">DNI {c.datos.participante.dni}{c.participante?.email ? ` · ${c.participante.email}` : ''}</div>
                  </TableCell>
                  <TableCell className="text-sm">{fechaCorta(c.emitido_en)}<div className="text-xs text-muted-foreground">{c.emitido_por ?? ''}</div></TableCell>
                  <TableCell>
                    {c.estado === 'emitido'
                      ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" variant="outline"><CheckCircle2 className="size-3 mr-1" /> Vigente</Badge>
                      : <Badge variant="destructive" title={c.motivo_revocacion ?? ''}><ShieldX className="size-3 mr-1" /> Revocado</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ver" onClick={() => setVer(c)}><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon" title="Descargar PDF" onClick={() => descargar([c])} disabled={!!progreso}><Download className="size-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copiar(urlVerificacion(c.token), 'Enlace de verificación copiado')}><Link2 className="size-4" /> Copiar enlace de verificación</DropdownMenuItem>
                          <DropdownMenuItem asChild><a href={urlVerificacion(c.token)} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Abrir verificación pública</a></DropdownMenuItem>
                          <DropdownMenuItem onClick={() => enviarCorreo(c)} disabled={!c.participante?.email || enviando === c.id}><Mail className="size-4" /> Enviar por correo{c.participante?.email ? '' : ' (sin correo)'}</DropdownMenuItem>
                          {puedeRevocar && c.estado === 'emitido' && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => { setRevocando(c); setMotivo(''); }}><ShieldX className="size-4" /> Revocar</DropdownMenuItem></>}
                          {puedeRevocar && c.estado === 'revocado' && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => reemitir(c)}><RefreshCw className="size-4" /> Reemitir (nuevo código)</DropdownMenuItem></>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Paginador {...pagCerts} nombre="certificados" />
        </CardContent>
      </Card>

      <Dialog open={!!ver} onOpenChange={o => !o && setVer(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{ver?.codigo} — {ver ? nombreCompleto(ver.datos.participante) : ''}</DialogTitle>
            <DialogDescription>Emitido el {ver ? fechaCorta(ver.emitido_en) : ''}{ver?.emitido_por ? ` por ${ver.emitido_por}` : ''}. {ver?.estado === 'revocado' ? `Revocado: ${ver.motivo_revocacion}` : ''}</DialogDescription>
          </DialogHeader>
          {ver && <CertificadoPreview plantilla={ver.plantilla} datos={ver.datos} codigo={ver.codigo} qrDataUrl={qrVer} marca={ver.estado === 'revocado' ? 'REVOCADO' : undefined} />}
          <DialogFooter>
            {ver && <Button variant="outline" onClick={() => copiar(urlVerificacion(ver.token), 'Enlace copiado')}><Copy className="size-4" /> Copiar enlace</Button>}
            {ver && <Button onClick={() => descargar([ver])} disabled={!!progreso}><Download className="size-4" /> Descargar PDF</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={seleccionando} onOpenChange={o => !emitiendo && setSeleccionando(o)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>¿A quiénes se emite el certificado?</DialogTitle>
            <DialogDescription>
              Plantilla "{plantilla?.nombre}". Cada certificado recibe su código correlativo y un QR de verificación; los datos y el
              diseño quedan congelados. Desmarque a quien no corresponda (asistencia parcial, datos por revisar).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="flex-1 min-w-48" placeholder="Buscar por DNI, nombre, IPRESS o nota…" value={filtroSel} onChange={e => setFiltroSel(e.target.value)} />
            {/* Actúan sobre lo filtrado: escribir "PARCIAL" y desmarcar deja fuera solo a esos. */}
            <Button type="button" variant="outline" size="sm" onClick={() => setSeleccion(prev => { const n = new Set(prev); pendientesFiltrados.forEach(p => n.add(p.id)); return n; })}>
              Marcar {filtroSel.trim() ? 'visibles' : 'todos'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSeleccion(prev => { const n = new Set(prev); pendientesFiltrados.forEach(p => n.delete(p.id)); return n; })}>
              Desmarcar {filtroSel.trim() ? 'visibles' : 'todos'}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto rounded-md border divide-y">
            {pendientesFiltrados.map(p => (
              <label key={p.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                <Checkbox className="mt-0.5" checked={seleccion.has(p.id)} onCheckedChange={v => alternar(p.id, !!v)} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{p.apellidos}, {p.nombres} <span className="font-mono text-xs text-muted-foreground ml-1">{p.dni}</span></div>
                  <div className="text-xs text-muted-foreground">{[p.cargo, p.institucion].filter(Boolean).join(' · ')}{!p.firma_data_url ? ' · sin firma digital' : ''}</div>
                  {p.nota && <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{p.nota}</div>}
                </div>
              </label>
            ))}
            {pendientesFiltrados.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nadie coincide con el filtro.</div>}
          </div>
          <DialogFooter className="items-center gap-2">
            <span className="text-sm text-muted-foreground mr-auto">{seleccion.size} de {pendientes.length} seleccionados</span>
            <Button variant="outline" onClick={() => setSeleccionando(false)} disabled={emitiendo}>Cancelar</Button>
            <Button onClick={confirmarEmision} disabled={emitiendo || seleccion.size === 0}>
              {emitiendo ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />} Emitir {seleccion.size} certificado(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revocando} onOpenChange={o => !o && setRevocando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revocar {revocando?.codigo}</DialogTitle>
            <DialogDescription>El certificado seguirá apareciendo en el portal, pero marcado como revocado, y su QR mostrará el motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1"><Label>Motivo *</Label><Textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Error en el nombre del participante…" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevocando(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={revocar}>Revocar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
