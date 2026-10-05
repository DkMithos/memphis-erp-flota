/**
 * Plantillas de certificado: el modelo del diploma por consorcio / proyecto / curso.
 *
 * Dos modos:
 *   · Estándar — el diseño institucional del ERP; se cambian logo, sello,
 *     firmante, colores y textos. Es lo normal: un consorcio nuevo = su logo.
 *   · Fondo completo — el consorcio entrega su propio arte (imagen A4
 *     horizontal) y el ERP solo escribe encima nombre, curso, horas, fecha,
 *     firmante y QR. Los ajustes de posición se ven en vivo.
 *
 * La vista previa es el MISMO componente que imprime el PDF, así que lo que
 * se ve es lo que sale.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutTemplate, Plus, Pencil, Trash2, Star, Upload, X, ArrowLeft, PenLine, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Slider } from '../../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { PageNav } from '../../shared/PageNav';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { useConfirmAction } from '../../shared/ConfirmDialogProvider';
import { dbCursos, dbPlantillas, miFirmaRegistrada } from '../../../lib/capacitaciones/db';
import { datosDeMuestra } from '../../../lib/capacitaciones/datos';
import { useQrDataUrl } from '../../../lib/capacitaciones/qr';
import { urlVerificacion } from '../../../lib/capacitaciones/urls';
import { descargarCertificadosPdf } from '../../../lib/capacitaciones/certificado-pdf';
import type { Curso, LayoutPlantilla, Plantilla } from '../../../lib/capacitaciones/types';
import { CertificadoPreview } from './CertificadoVista';

interface Props { onNavigate: (r: string) => void }

const NUEVA = (tenantId: string): Plantilla => ({
  id: '', tenant_id: tenantId, nombre: '', descripcion: null, modo: 'estandar', es_default: false,
  proyecto_id: null, curso_id: null, consorcio_nombre: '', logo_url: null, sello_url: null, fondo_url: null, firma_url: null,
  color_acento: '#b28b45', color_primario: '#17364c', color_secundario: '#24718a', color_texto: '#17364c',
  titulo: 'Certificado', texto_otorga: 'Se otorga el presente a', texto_reconocimiento: 'Por haber participado en la capacitación en',
  ciudad: 'Lima', firmante_nombre: '', firmante_cargo: '', mostrar_temario: true, mostrar_dni: true, mostrar_qr: true, mostrar_proyecto: true,
  layout: { logo_pos: 'abajo-izq', qr_pos: 'br', mostrar_marco: true }, activa: true,
});

export function PlantillasCertificado({ onNavigate }: Props) {
  const { tenantId, user } = useAuth();
  const { can } = usePermissions();
  const confirmar = useConfirmAction();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [editando, setEditando] = useState<Plantilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const puedeEditar = can('proyectos', 'editar');

  const cargar = async () => {
    if (!tenantId) return;
    setCargando(true);
    try {
      const [p, c] = await Promise.all([dbPlantillas.listar(tenantId), dbCursos.listar(tenantId)]);
      setPlantillas(p); setCursos(c);
    } catch (e: any) { toast.error(e.message); } finally { setCargando(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [tenantId]);

  const eliminar = async (p: Plantilla) => {
    const ok = await confirmar({ title: 'Eliminar plantilla', description: `¿Eliminar "${p.nombre}"? Los certificados ya emitidos no cambian: guardan su propia copia.`, confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    try { await dbPlantillas.eliminar(p.id); toast.success('Plantilla eliminada'); cargar(); } catch (e: any) { toast.error(e.message); }
  };

  if (editando && tenantId) {
    return (
      <EditorPlantilla
        plantilla={editando} cursos={cursos} tenantId={tenantId} userId={user?.id ?? null}
        onCancelar={() => setEditando(null)}
        onGuardada={() => { setEditando(null); cargar(); }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageNav onBack={() => onNavigate('/proyectos/capacitaciones')} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><LayoutTemplate className="size-6 text-primary" /> Plantillas de certificado</h1>
          <p className="text-sm text-muted-foreground">Un modelo por consorcio, proyecto o curso. Al emitir se congela una copia en cada certificado.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate('/proyectos/capacitaciones')}><ArrowLeft className="size-4" /> Capacitaciones</Button>
          {puedeEditar && <Button onClick={() => setEditando(NUEVA(tenantId!))}><Plus className="size-4" /> Nueva plantilla</Button>}
        </div>
      </div>

      {cargando && <p className="text-sm text-muted-foreground">Cargando…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plantillas.map(p => (
          <Card key={p.id} className={!p.activa ? 'opacity-60' : ''}>
            <CardContent className="p-3 space-y-3">
              <MiniPreview plantilla={p} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-1.5">
                    {p.es_default && <Star className="size-4 text-amber-500 fill-amber-500" />}
                    <span className="truncate">{p.nombre}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.modo === 'estandar' ? 'Diseño estándar' : 'Fondo completo'}{p.consorcio_nombre ? ` · ${p.consorcio_nombre}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                    {p.proyecto_id && <Badge variant="outline">Proyecto específico</Badge>}
                    {p.curso_id && <Badge variant="outline">{cursos.find(c => c.id === p.curso_id)?.nombre ?? 'Curso específico'}</Badge>}
                    {!p.proyecto_id && !p.curso_id && <Badge variant="outline">General</Badge>}
                    {!p.activa && <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                </div>
                {puedeEditar && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setEditando({ ...p, layout: p.layout ?? {} })} aria-label="Editar"><Pencil className="size-4" /></Button>
                    {!p.es_default && <Button variant="ghost" size="icon" onClick={() => eliminar(p)} aria-label="Eliminar"><Trash2 className="size-4 text-destructive" /></Button>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MiniPreview({ plantilla }: { plantilla: Plantilla }) {
  const datos = useMemo(() => datosDeMuestra(plantilla), [plantilla]);
  const qr = useQrDataUrl(plantilla.mostrar_qr ? urlVerificacion('00000000-0000-0000-0000-000000000000') : null);
  return <CertificadoPreview plantilla={plantilla} datos={datos} qrDataUrl={qr} codigo="CERT-AAAA-00000" />;
}

// ─── Editor ─────────────────────────────────────────────────────────────────
function EditorPlantilla({ plantilla, cursos, tenantId, userId, onCancelar, onGuardada }: {
  plantilla: Plantilla; cursos: Curso[]; tenantId: string; userId: string | null; onCancelar: () => void; onGuardada: () => void;
}) {
  const [p, setP] = useState<Plantilla>(plantilla);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const datos = useMemo(() => datosDeMuestra(p), [p]);
  const qr = useQrDataUrl(p.mostrar_qr ? urlVerificacion('00000000-0000-0000-0000-000000000000') : null);
  const set = (patch: Partial<Plantilla>) => setP(prev => ({ ...prev, ...patch }));
  const setLayout = (patch: Partial<LayoutPlantilla>) => setP(prev => ({ ...prev, layout: { ...(prev.layout ?? {}), ...patch } }));

  const subir = async (tipo: 'logo' | 'sello' | 'fondo' | 'firma', archivo: File | null) => {
    if (!archivo) return;
    if (archivo.size > 5 * 1024 * 1024) { toast.error('Máximo 5 MB'); return; }
    setSubiendo(tipo);
    try {
      const url = await dbPlantillas.subirRecurso(tenantId, archivo, tipo);
      set({ [`${tipo}_url`]: url } as any);
      toast.success('Imagen subida');
    } catch (e: any) { toast.error(e.message); } finally { setSubiendo(null); }
  };

  const usarMiFirma = async () => {
    if (!userId) return;
    setSubiendo('firma');
    try {
      const f = await miFirmaRegistrada(userId);
      if (!f) { toast.error('No tienes una firma registrada en "Mi firma"'); return; }
      const url = await dbPlantillas.subirFirmaDataUrl(tenantId, f.imagen);
      set({ firma_url: url, firmante_nombre: p.firmante_nombre || f.nombre || '' });
      toast.success('Se usó tu firma registrada');
    } catch (e: any) { toast.error(e.message); } finally { setSubiendo(null); }
  };

  const guardar = async () => {
    if (!p.nombre.trim()) { toast.error('Ponga un nombre a la plantilla'); return; }
    if (p.modo === 'fondo_completo' && !p.fondo_url) { toast.error('Suba la imagen del modelo (fondo completo)'); return; }
    setGuardando(true);
    try {
      const { id, ...resto } = p;
      await dbPlantillas.guardar({ ...resto, id: id || undefined, tenant_id: tenantId, nombre: p.nombre.trim() } as any);
      toast.success('Plantilla guardada');
      onGuardada();
    } catch (e: any) { toast.error(e.message); } finally { setGuardando(false); }
  };

  const probarPdf = async () => {
    setProbando(true);
    try {
      await descargarCertificadosPdf([{ plantilla: p, datos, codigo: 'CERT-AAAA-00000', token: '00000000-0000-0000-0000-000000000000', marca: 'MUESTRA' }], `Muestra - ${p.nombre || 'plantilla'}.pdf`);
    } catch (e: any) { toast.error(e.message); } finally { setProbando(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageNav onBack={onCancelar} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{p.id ? `Plantilla: ${plantilla.nombre}` : 'Nueva plantilla'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={probarPdf} disabled={probando}>{probando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} PDF de muestra</Button>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar plantilla'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-4 items-start">
        <Card className="xl:sticky xl:top-4">
          <CardContent className="p-4">
            <Tabs defaultValue="general">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="imagenes">Imágenes</TabsTrigger>
                <TabsTrigger value="textos">Textos</TabsTrigger>
                <TabsTrigger value="diseno">Diseño</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-3 mt-4">
                <div className="space-y-1">
                  <Label>Nombre de la plantilla *</Label>
                  <Input value={p.nombre} onChange={e => set({ nombre: e.target.value })} placeholder="Consorcio Ejecutor Salud Cusco" />
                </div>
                <div className="space-y-1">
                  <Label>Modo</Label>
                  <Select value={p.modo} onValueChange={v => set({ modo: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estandar">Diseño estándar (cambiar logo y detalles)</SelectItem>
                      <SelectItem value="fondo_completo">Fondo completo (subir el modelo del consorcio)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Nombre del consorcio / emisor</Label>
                  <Input value={p.consorcio_nombre ?? ''} onChange={e => set({ consorcio_nombre: e.target.value })} placeholder="CONSORCIO EJECUTOR SALUD CUSCO" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Firmante</Label>
                    <Input value={p.firmante_nombre ?? ''} onChange={e => set({ firmante_nombre: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Cargo</Label>
                    <Input value={p.firmante_cargo ?? ''} onChange={e => set({ firmante_cargo: e.target.value })} placeholder="Representante Común" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Ciudad por defecto (fecha del diploma)</Label>
                  <Input value={p.ciudad} onChange={e => set({ ciudad: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Se aplica por defecto a</Label>
                  <ProyectoSelector value={p.proyecto_id} onChange={v => set({ proyecto_id: v })} />
                  <Select value={p.curso_id ?? '_none'} onValueChange={v => set({ curso_id: v === '_none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Cualquier curso" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Cualquier curso</SelectItem>
                      {cursos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Al programar una capacitación se sugiere la plantilla más específica (proyecto + curso → proyecto → curso → general).</p>
                </div>
                <div className="flex items-center gap-2"><Switch id="pl-def" checked={p.es_default} onCheckedChange={v => set({ es_default: v })} /><Label htmlFor="pl-def">Plantilla general por defecto</Label></div>
                <div className="flex items-center gap-2"><Switch id="pl-act" checked={p.activa} onCheckedChange={v => set({ activa: v })} /><Label htmlFor="pl-act">Activa</Label></div>
                <div className="space-y-1">
                  <Label>Notas</Label>
                  <Textarea rows={2} value={p.descripcion ?? ''} onChange={e => set({ descripcion: e.target.value })} />
                </div>
              </TabsContent>

              <TabsContent value="imagenes" className="space-y-4 mt-4">
                {p.modo === 'fondo_completo' ? (
                  <Imagen label="Modelo completo del certificado (A4 horizontal, PNG o JPG)" url={p.fondo_url} subiendo={subiendo === 'fondo'}
                    onArchivo={f => subir('fondo', f)} onQuitar={() => set({ fondo_url: null })}
                    ayuda="Exporte su diseño a 297 × 210 mm (p. ej. 3508 × 2480 px). Deje libre la zona central para el texto y una esquina para el QR." />
                ) : (
                  <>
                    <Imagen label="Logo del consorcio" url={p.logo_url} subiendo={subiendo === 'logo'} onArchivo={f => subir('logo', f)} onQuitar={() => set({ logo_url: null })} ayuda="PNG con fondo transparente, idealmente horizontal." />
                    <Imagen label="Sello" url={p.sello_url} subiendo={subiendo === 'sello'} onArchivo={f => subir('sello', f)} onQuitar={() => set({ sello_url: null })} ayuda="Se coloca sobre el extremo izquierdo de la línea de firma." />
                    <Imagen label="Foto de fondo (opcional)" url={p.fondo_url} subiendo={subiendo === 'fondo'} onArchivo={f => subir('fondo', f)} onQuitar={() => set({ fondo_url: null })} ayuda="Sale atenuada en la esquina inferior derecha." />
                  </>
                )}
                <div className="space-y-2">
                  <Imagen label="Rúbrica del firmante" url={p.firma_url} subiendo={subiendo === 'firma'} onArchivo={f => subir('firma', f)} onQuitar={() => set({ firma_url: null })} ayuda="PNG transparente. Sale encima de la línea de firma." />
                  <Button type="button" variant="outline" size="sm" onClick={usarMiFirma} disabled={!userId || subiendo === 'firma'}><PenLine className="size-4" /> Usar mi firma registrada</Button>
                </div>
              </TabsContent>

              <TabsContent value="textos" className="space-y-3 mt-4">
                <div className="space-y-1"><Label>Título</Label><Input value={p.titulo} onChange={e => set({ titulo: e.target.value })} /></div>
                <div className="space-y-1"><Label>Texto antes del nombre</Label><Input value={p.texto_otorga} onChange={e => set({ texto_otorga: e.target.value })} /></div>
                <div className="space-y-1"><Label>Texto de reconocimiento</Label><Textarea rows={2} value={p.texto_reconocimiento} onChange={e => set({ texto_reconocimiento: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Después del texto de reconocimiento va el título de la capacitación, el temario con horas y la duración total.</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Interruptor id="t1" label="Mostrar temario" v={p.mostrar_temario} on={v => set({ mostrar_temario: v })} />
                  <Interruptor id="t2" label="Mostrar DNI" v={p.mostrar_dni} on={v => set({ mostrar_dni: v })} />
                  <Interruptor id="t3" label="Mostrar QR" v={p.mostrar_qr} on={v => set({ mostrar_qr: v })} />
                  <Interruptor id="t4" label="Mostrar proyecto / entidad" v={p.mostrar_proyecto} on={v => set({ mostrar_proyecto: v })} />
                </div>
              </TabsContent>

              <TabsContent value="diseno" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Color label="Color principal" v={p.color_primario} on={v => set({ color_primario: v })} />
                  <Color label="Color secundario" v={p.color_secundario} on={v => set({ color_secundario: v })} />
                  <Color label="Detalle (dorado)" v={p.color_acento} on={v => set({ color_acento: v })} />
                  <Color label="Texto" v={p.color_texto} on={v => set({ color_texto: v })} />
                </div>
                {p.modo === 'estandar' ? (
                  <>
                    <Color label="Color del papel" v={p.layout?.color_fondo ?? '#faf5e8'} on={v => setLayout({ color_fondo: v })} />
                    <div className="space-y-1">
                      <Label>Posición del logo</Label>
                      <Select value={p.layout?.logo_pos ?? 'abajo-izq'} onValueChange={v => setLayout({ logo_pos: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="abajo-izq">Abajo a la izquierda (diseño original)</SelectItem>
                          <SelectItem value="arriba">Arriba, centrado</SelectItem>
                          <SelectItem value="ninguno">No mostrar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(p.layout?.logo_pos ?? 'abajo-izq') === 'abajo-izq' && (
                      <Deslizador label="Tamaño del logo" v={p.layout?.logo_ancho ?? 236} min={120} max={420} on={v => setLayout({ logo_ancho: v })} unidad="px" />
                    )}
                    <Interruptor id="d1" label="Franjas y marco decorativo" v={p.layout?.mostrar_marco !== false} on={v => setLayout({ mostrar_marco: v })} />
                    <Deslizador label="Opacidad de la foto de fondo" v={Math.round((p.layout?.fondo_opacidad ?? 0.22) * 100)} min={5} max={100} on={v => setLayout({ fondo_opacidad: v / 100 })} unidad="%" />
                  </>
                ) : (
                  <>
                    <Deslizador label="Inicio del bloque de texto" v={p.layout?.texto_top ?? 30} min={5} max={70} on={v => setLayout({ texto_top: v })} unidad="% del alto" />
                    <Deslizador label="Alto del bloque de texto" v={p.layout?.texto_alto ?? 56} min={20} max={90} on={v => setLayout({ texto_alto: v })} unidad="% del alto" />
                    <Deslizador label="Margen lateral" v={p.layout?.texto_margen ?? 10} min={2} max={35} on={v => setLayout({ texto_margen: v })} unidad="% del ancho" />
                  </>
                )}
                <div className="space-y-1">
                  <Label>Posición del QR</Label>
                  <Select value={p.layout?.qr_pos ?? 'br'} onValueChange={v => setLayout({ qr_pos: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tr">Arriba a la derecha</SelectItem>
                      <SelectItem value="tl">Arriba a la izquierda</SelectItem>
                      <SelectItem value="br">Abajo a la derecha</SelectItem>
                      <SelectItem value="bl">Abajo a la izquierda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Interruptor id="d2" label="Código y dirección del portal debajo del QR" v={p.layout?.qr_texto !== false} on={v => setLayout({ qr_texto: v })} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <CertificadoPreview plantilla={p} datos={datos} qrDataUrl={qr} codigo="CERT-AAAA-00000" />
          <p className="text-xs text-muted-foreground">Vista previa con datos de muestra. Es exactamente lo que se imprime en el PDF.</p>
        </div>
      </div>
    </div>
  );
}

function Imagen({ label, url, subiendo, onArchivo, onQuitar, ayuda }: { label: string; url: string | null; subiendo: boolean; onArchivo: (f: File | null) => void; onQuitar: () => void; ayuda?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="size-20 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
          {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">Sin imagen</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={subiendo}>
            {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {url ? 'Reemplazar' : 'Subir'}
          </Button>
          {url && <Button type="button" variant="ghost" size="sm" onClick={onQuitar}><X className="size-4" /> Quitar</Button>}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={e => { onArchivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      </div>
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

function Interruptor({ id, label, v, on }: { id: string; label: string; v: boolean; on: (v: boolean) => void }) {
  return <div className="flex items-center gap-2"><Switch id={id} checked={v} onCheckedChange={on} /><Label htmlFor={id} className="text-sm">{label}</Label></div>;
}

function Color({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={v} onChange={e => on(e.target.value)} className="size-9 rounded border p-0.5 bg-transparent cursor-pointer" />
        <Input value={v} onChange={e => on(e.target.value)} className="font-mono text-xs h-9" />
      </div>
    </div>
  );
}

function Deslizador({ label, v, min, max, on, unidad }: { label: string; v: number; min: number; max: number; on: (v: number) => void; unidad?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><Label>{label}</Label><span className="text-muted-foreground">{v} {unidad}</span></div>
      <Slider value={[v]} min={min} max={max} step={1} onValueChange={([x]) => on(x)} />
    </div>
  );
}
