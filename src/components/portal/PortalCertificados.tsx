/**
 * Portal público de certificados (sin sesión, sin providers del ERP).
 *
 *   /cert/:token   → verificación del QR impreso: ¿este certificado existe y
 *                    sigue vigente? Muestra el diploma y permite descargarlo.
 *   /certificados  → la persona escribe su DNI y ve TODAS sus capacitaciones:
 *                    temario, horas, fechas y sus certificados para descargar.
 *   /c/:token      → formulario de asistencia: datos + firma desde el celular.
 *
 * Todo lo sirve la Edge Function `capacitaciones-publico` (ver lib/capacitaciones/publico.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Award, BadgeCheck, CalendarDays, Clock, Download, FileSearch, GraduationCap, Loader2, MapPin,
  PenLine, Search, ShieldAlert, ShieldCheck, ShieldX, User, ChevronDown, ChevronUp, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { PadFirma } from '../shared/PadFirma';
import { publico, ErrorPublico, type FormularioAsistencia } from '../../lib/capacitaciones/publico';
import type { CapacitacionPublica, CertificadoPublico } from '../../lib/capacitaciones/types';
import { CertificadoPreview } from '../modules/capacitaciones/CertificadoVista';
import { useQrDataUrl } from '../../lib/capacitaciones/qr';
import { urlVerificacion, urlPortalCertificados } from '../../lib/capacitaciones/urls';
import { fechaCorta, horasCortas, nombreCompleto, normalizarDni, dniValido, rangoFechas } from '../../lib/capacitaciones/datos';
import { descargarCertificadosPdf, nombreArchivoCertificado } from '../../lib/capacitaciones/certificado-pdf';

interface Props { route: string; onNavigate: (r: string) => void }

export function PortalCertificados({ route, onNavigate }: Props) {
  const limpio = route.split('?')[0];
  const seg = limpio.split('/').filter(Boolean);
  const vista = seg[0]; // 'cert' | 'certificados' | 'c'
  const token = seg[1];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 text-foreground">
      <header className="bg-[#17364c] text-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button className="flex items-center gap-2 font-semibold" onClick={() => onNavigate('/certificados')}>
            <GraduationCap className="size-6 text-[#e2b96a]" />
            <span>Certificados de capacitación</span>
          </button>
          <span className="text-xs text-white/70 hidden sm:inline">Memphis Maquinarias · Verificación pública</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {vista === 'cert' && token && <VerificarCertificado token={token} onNavigate={onNavigate} />}
        {vista === 'c' && token && <FormularioFirma token={token} />}
        {vista === 'certificados' && <PortalPorDni onNavigate={onNavigate} />}
        {vista === 'cert' && !token && <p className="text-sm text-muted-foreground">Enlace incompleto.</p>}
      </main>
      <footer className="max-w-4xl mx-auto px-4 pb-8 text-xs text-muted-foreground">
        ¿Dudas sobre un certificado? Escriba a la empresa ejecutora del proyecto indicando el código impreso bajo el QR.
      </footer>
    </div>
  );
}

// ─── Descarga de un certificado (un solo PDF) ────────────────────────────────
function BotonDescargar({ cert, className }: { cert: CertificadoPublico; className?: string }) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const descargar = async () => {
    setTrabajando(true); setError('');
    try {
      await descargarCertificadosPdf(
        [{ plantilla: cert.plantilla, datos: cert.datos, codigo: cert.codigo, token: cert.token, marca: cert.estado === 'revocado' ? 'REVOCADO' : undefined }],
        nombreArchivoCertificado(cert.codigo, nombreCompleto(cert.datos.participante)),
      );
    } catch (e: any) { setError(e.message || 'No se pudo generar el PDF'); }
    finally { setTrabajando(false); }
  };
  return (
    <div className={className}>
      <Button onClick={descargar} disabled={trabajando} className="w-full sm:w-auto">
        {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {trabajando ? 'Generando PDF…' : 'Descargar certificado (PDF)'}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function VistaCertificado({ cert }: { cert: CertificadoPublico }) {
  const qr = useQrDataUrl(cert.plantilla.mostrar_qr === false ? null : urlVerificacion(cert.token));
  return (
    <CertificadoPreview plantilla={cert.plantilla} datos={cert.datos} codigo={cert.codigo} qrDataUrl={qr}
      marca={cert.estado === 'revocado' ? 'REVOCADO' : undefined} className="mx-auto" />
  );
}

// ─── /cert/:token ────────────────────────────────────────────────────────────
function VerificarCertificado({ token, onNavigate }: { token: string; onNavigate: (r: string) => void }) {
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no' | 'error'>('cargando');
  const [cert, setCert] = useState<CertificadoPublico | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    publico.verificar(token).then(r => {
      if (!vivo) return;
      if (r.encontrado && r.certificado) { setCert(r.certificado); setEstado('ok'); }
      else setEstado('no');
    }).catch((e: ErrorPublico) => { if (vivo) { setMsg(e.message); setEstado('error'); } });
    return () => { vivo = false; };
  }, [token]);

  if (estado === 'cargando') return <Cargando texto="Verificando certificado…" />;
  if (estado === 'error') return <Aviso icono={<ShieldAlert className="size-8 text-amber-600" />} titulo="No se pudo verificar" texto={msg} />;
  if (estado === 'no' || !cert) {
    return <Aviso icono={<ShieldX className="size-8 text-red-600" />} titulo="Certificado no encontrado"
      texto="El código escaneado no corresponde a ningún certificado emitido por el ERP. Si lo recibió en papel, verifique que el QR sea legible o consulte por DNI." />;
  }
  const vigente = cert.estado === 'emitido';
  const d = cert.datos;
  return (
    <div className="space-y-5">
      <Card className={vigente ? 'border-green-300 dark:border-green-800' : 'border-red-300 dark:border-red-800'}>
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
          {vigente ? <ShieldCheck className="size-12 text-green-600 shrink-0" /> : <ShieldX className="size-12 text-red-600 shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold">{vigente ? 'Certificado auténtico y vigente' : 'Certificado revocado'}</div>
            <div className="text-sm text-muted-foreground">
              Código <span className="font-mono font-medium text-foreground">{cert.codigo}</span> · emitido el {fechaCorta(cert.emitido_en)}
              {!vigente && cert.motivo_revocacion ? ` · Motivo: ${cert.motivo_revocacion}` : ''}
            </div>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Dato k="Participante" v={nombreCompleto(d.participante)} />
              <Dato k="Documento" v={d.participante.dni} />
              <Dato k="Capacitación" v={d.capacitacion.titulo} />
              <Dato k="Duración" v={horasCortas(d.capacitacion.horas_total)} />
              <Dato k="Fecha" v={rangoFechas(d.capacitacion.fecha_inicio, d.capacitacion.fecha_fin)} />
              {d.proyecto && <Dato k="Proyecto" v={`${d.proyecto.codigo} — ${d.proyecto.nombre}`} />}
              {d.consorcio && <Dato k="Emisor" v={d.consorcio} />}
            </dl>
          </div>
        </CardContent>
      </Card>

      <VistaCertificado cert={cert} />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <BotonDescargar cert={cert} />
        <Button variant="outline" onClick={() => { recordarDni(d.participante.dni); onNavigate('/certificados'); }}>
          <FileSearch className="size-4" /> Ver todas mis capacitaciones <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// El DNI no viaja en la URL (quedaría en el historial y en los registros del
// servidor): al pasar de la verificación al portal se deja en sessionStorage
// y se consume una sola vez.
const CLAVE_DNI = 'certificados.dni';
function recordarDni(dni: string) { try { sessionStorage.setItem(CLAVE_DNI, dni); } catch { /* modo privado */ } }
function tomarDni(): string { try { const v = sessionStorage.getItem(CLAVE_DNI) ?? ''; sessionStorage.removeItem(CLAVE_DNI); return v; } catch { return ''; } }

// ─── /certificados (portal por DNI) ──────────────────────────────────────────
function PortalPorDni({ onNavigate }: { onNavigate: (r: string) => void }) {
  const dniInicial = useMemo(() => tomarDni(), []);
  const [dni, setDni] = useState(dniInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ persona: { nombres: string; apellidos: string; dni_mascara: string }; capacitaciones: CapacitacionPublica[] } | null>(null);
  const [sinDatos, setSinDatos] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const buscar = async (valor = dni) => {
    const limpio = normalizarDni(valor);
    if (!dniValido(limpio)) { setError('Ingrese su DNI (8 dígitos) o carné de extranjería.'); return; }
    setError(''); setCargando(true); setSinDatos(false); setResultado(null);
    try {
      const r = await publico.consultarDni(limpio);
      if (r.encontrado && r.persona) { setResultado({ persona: r.persona, capacitaciones: r.capacitaciones ?? [] }); setAbierta(r.capacitaciones?.[0]?.id ?? null); }
      else setSinDatos(true);
    } catch (e: any) { setError(e.message); }
    finally { setCargando(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (dniInicial) buscar(dniInicial); }, []);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Award className="size-8 text-[#b28b45] shrink-0" />
            <div>
              <h1 className="text-xl font-semibold">Mis capacitaciones y certificados</h1>
              <p className="text-sm text-muted-foreground">Escriba su número de documento para ver las capacitaciones en las que participó, el temario y descargar sus certificados.</p>
            </div>
          </div>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); buscar(); }}>
            <div className="flex-1">
              <Label htmlFor="dni" className="sr-only">DNI</Label>
              <Input id="dni" inputMode="numeric" autoComplete="off" placeholder="DNI o carné de extranjería" value={dni}
                onChange={e => setDni(e.target.value)} className="h-11 text-base" maxLength={12} />
            </div>
            <Button type="submit" className="h-11" disabled={cargando}>
              {cargando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {sinDatos && (
        <Aviso icono={<FileSearch className="size-8 text-slate-500" />} titulo="No encontramos capacitaciones con ese documento"
          texto="Revise el número. Si participó hace poco, puede que el certificado aún no haya sido emitido." />
      )}

      {resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-muted-foreground" />
            <span className="font-medium">{resultado.persona.nombres} {resultado.persona.apellidos}</span>
            <span className="text-muted-foreground">· Doc. {resultado.persona.dni_mascara}</span>
            <Badge variant="secondary" className="ml-auto">{resultado.capacitaciones.length} capacitación{resultado.capacitaciones.length === 1 ? '' : 'es'}</Badge>
          </div>
          {resultado.capacitaciones.map(cap => {
            const cert = cap.certificado;
            const abiertaEsta = abierta === cap.id;
            return (
              <Card key={cap.id}>
                <CardContent className="p-0">
                  <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setAbierta(abiertaEsta ? null : cap.id)}>
                    <GraduationCap className="size-6 text-[#17364c] dark:text-[#e2b96a] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold leading-tight">{cap.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> {rangoFechas(cap.fecha_inicio, cap.fecha_fin)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {horasCortas(cap.horas_total)}</span>
                        {(cap.lugar || cap.ciudad) && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {[cap.lugar, cap.ciudad].filter(Boolean).join(', ')}</span>}
                      </div>
                      <div className="mt-2">
                        {cert?.estado === 'emitido' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><BadgeCheck className="size-3 mr-1" /> Certificado {cert.codigo}</Badge>}
                        {cert?.estado === 'revocado' && <Badge variant="destructive">Certificado revocado</Badge>}
                        {!cert && <Badge variant="secondary">Certificado pendiente de emisión</Badge>}
                      </div>
                    </div>
                    {abiertaEsta ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
                  </button>
                  {abiertaEsta && (
                    <div className="px-4 pb-4 space-y-4 border-t pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium mb-1">Temario</div>
                          {cap.temario.length ? (
                            <ul className="space-y-1">
                              {cap.temario.map((t, i) => (
                                <li key={i} className="flex justify-between gap-3 border-b border-dashed pb-1">
                                  <span>{t.tema}</span><span className="text-muted-foreground whitespace-nowrap">{horasCortas(t.horas)}</span>
                                </li>
                              ))}
                              <li className="flex justify-between gap-3 font-medium pt-1"><span>Total</span><span>{horasCortas(cap.horas_total)}</span></li>
                            </ul>
                          ) : <p className="text-muted-foreground">Sin temario detallado.</p>}
                        </div>
                        <dl className="space-y-1">
                          {cap.proyecto && <Dato k="Proyecto" v={`${cap.proyecto.codigo} — ${cap.proyecto.nombre}`} />}
                          {cap.entidad_beneficiaria && <Dato k="Entidad" v={cap.entidad_beneficiaria} />}
                          {cap.instructor_nombre && <Dato k="Instructor" v={cap.instructor_nombre} />}
                          {cap.cargo && <Dato k="Participó como" v={[cap.cargo, cap.institucion].filter(Boolean).join(' · ')} />}
                          {cert && <Dato k="Emitido el" v={fechaCorta(cert.emitido_en)} />}
                        </dl>
                      </div>
                      {cert && (
                        <>
                          <VistaCertificado cert={cert} />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <BotonDescargar cert={cert} />
                            <Button variant="outline" onClick={() => onNavigate(`/cert/${cert.token}`)}><ShieldCheck className="size-4" /> Ver verificación</Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── /c/:token (formulario de asistencia con firma) ──────────────────────────
function FormularioFirma({ token }: { token: string }) {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'cerrada' | 'no' | 'error' | 'enviando' | 'hecho'>('cargando');
  const [cap, setCap] = useState<FormularioAsistencia | null>(null);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ dni: '', nombres: '', apellidos: '', cargo: '', institucion: '', email: '', telefono: '' });
  const [firma, setFirma] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    publico.capacitacion(token).then(r => {
      if (!vivo) return;
      if (!r.encontrado || !r.capacitacion) { setEstado('no'); return; }
      setCap(r.capacitacion);
      setF(prev => ({ ...prev, institucion: prev.institucion || r.capacitacion?.entidad_beneficiaria || '' }));
      setEstado(r.abierta ? 'listo' : 'cerrada');
    }).catch((e: ErrorPublico) => { if (vivo) { setMsg(e.message); setEstado('error'); } });
    return () => { vivo = false; };
  }, [token]);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!dniValido(normalizarDni(f.dni))) e.dni = 'DNI de 8 dígitos o carné de extranjería';
    if (f.nombres.trim().length < 2) e.nombres = 'Obligatorio';
    if (f.apellidos.trim().length < 2) e.apellidos = 'Obligatorio';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Correo inválido';
    if (!firma) e.firma = 'Falta su firma';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async () => {
    if (!validar() || !firma) return;
    setEstado('enviando'); setMsg('');
    try {
      await publico.firmar({ token, ...f, dni: normalizarDni(f.dni), firma });
      setEstado('hecho');
    } catch (e: any) {
      setMsg(e.message);
      setEstado(e instanceof ErrorPublico && e.extra?.ya_firmado ? 'hecho' : 'listo');
    }
  };

  if (estado === 'cargando') return <Cargando texto="Cargando capacitación…" />;
  if (estado === 'no') return <Aviso icono={<ShieldX className="size-8 text-red-600" />} titulo="Enlace inválido" texto="Este enlace de asistencia no existe. Pida al instructor que le muestre el QR nuevamente." />;
  if (estado === 'error') return <Aviso icono={<ShieldAlert className="size-8 text-amber-600" />} titulo="No se pudo cargar" texto={msg} />;

  const color = cap?.color_primario || '#17364c';
  const cabecera = cap && (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          {cap.logo_url ? <img src={cap.logo_url} alt="" className="h-12 max-w-[140px] object-contain" /> : <GraduationCap className="size-8" style={{ color }} />}
          <div className="flex-1 min-w-0">
            {cap.consorcio_nombre && <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">{cap.consorcio_nombre}</div>}
            <div className="text-lg font-semibold leading-tight">{cap.titulo}</div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              <span>{rangoFechas(cap.fecha_inicio, cap.fecha_fin)}</span>
              {(cap.lugar || cap.ciudad) && <span>{[cap.lugar, cap.ciudad].filter(Boolean).join(', ')}</span>}
              <span>{horasCortas(cap.horas_total)}</span>
            </div>
            {cap.proyecto && <div className="text-xs text-muted-foreground">Proyecto {cap.proyecto.codigo} — {cap.proyecto.nombre}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (estado === 'cerrada') {
    return <div className="space-y-4">{cabecera}<Aviso icono={<ShieldAlert className="size-8 text-amber-600" />} titulo="Registro de asistencia cerrado" texto="El instructor ya cerró el registro de esta capacitación. Si participó y no alcanzó a firmar, avísele para que lo registre." /></div>;
  }

  if (estado === 'hecho') {
    return (
      <div className="space-y-4">
        {cabecera}
        <Card className="border-green-300 dark:border-green-800">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="size-14 text-green-600 mx-auto" />
            <div className="text-xl font-semibold">{msg ? 'Ya estabas registrado' : '¡Asistencia registrada!'}</div>
            <p className="text-sm text-muted-foreground">
              {msg || `Gracias, ${f.nombres.trim()}. Tu firma quedó registrada.`} Cuando se emita tu certificado podrás descargarlo con tu DNI en{' '}
              <a className="underline font-medium" href={urlPortalCertificados()}>{urlPortalCertificados().replace(/^https?:\/\//, '')}</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const campo = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Input id={`f-${k}`} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} className="h-11 text-base" {...props} />
      {errores[k] && <p className="text-xs text-destructive">{errores[k]}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {cabecera}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <PenLine className="size-5" style={{ color }} />
            <h2 className="font-semibold">Registro de asistencia</h2>
            {cap && cap.firmados > 0 && <Badge variant="secondary" className="ml-auto">{cap.firmados} ya firmaron</Badge>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo('dni', 'DNI o carné *', { inputMode: 'numeric', maxLength: 12, autoComplete: 'off' })}
            <div className="hidden sm:block" />
            {campo('nombres', 'Nombres *', { autoComplete: 'given-name' })}
            {campo('apellidos', 'Apellidos *', { autoComplete: 'family-name' })}
            {campo('cargo', 'Cargo')}
            {campo('institucion', 'Institución / área')}
            {campo('email', 'Correo (para avisarle cuando esté su certificado)', { type: 'email', inputMode: 'email', autoComplete: 'email' })}
            {campo('telefono', 'Teléfono', { inputMode: 'tel', autoComplete: 'tel' })}
          </div>
          <div className="space-y-1">
            <Label>Firma *</Label>
            {firma ? (
              <div className="rounded-md border bg-white p-3 flex items-center justify-between gap-3">
                <img src={firma} alt="Su firma" className="h-16 object-contain" />
                <Button type="button" variant="outline" size="sm" onClick={() => setFirma(null)}>Volver a firmar</Button>
              </div>
            ) : (
              <PadFirma alto={200} onFirmar={setFirma} />
            )}
            {errores.firma && <p className="text-xs text-destructive">{errores.firma}</p>}
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <Button className="w-full h-12 text-base" onClick={enviar} disabled={estado === 'enviando'} style={{ background: color }}>
            {estado === 'enviando' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-5" />}
            Registrar mi asistencia
          </Button>
          <p className="text-xs text-muted-foreground">Sus datos se usan solo para emitir el certificado de esta capacitación y quedan bajo custodia de la empresa ejecutora del proyecto.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────
function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground shrink-0">{k}:</dt>
      <dd className="font-medium min-w-0 break-words">{v}</dd>
    </div>
  );
}

function Cargando({ texto }: { texto: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /> {texto}</div>;
}

function Aviso({ icono, titulo, texto }: { icono: React.ReactNode; titulo: string; texto: string }) {
  return (
    <Card>
      <CardContent className="p-6 flex gap-4 items-start">
        <div className="shrink-0">{icono}</div>
        <div>
          <div className="font-semibold text-lg">{titulo}</div>
          <p className="text-sm text-muted-foreground mt-1">{texto}</p>
        </div>
      </CardContent>
    </Card>
  );
}
