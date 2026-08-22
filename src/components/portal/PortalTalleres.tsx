/**
 * Portal de Talleres (Fase C) — erp.memphismaquinarias.com/taller
 * Login por CÓDIGO del taller + contraseña (alias {codigo}@talleres.memphismaquinarias.com).
 * El taller ve SOLO sus citas y NUNCA el costo (N25). Registra el mantenimiento
 * leyendo el QR del vehículo (cámara) o por placa; km + fotos obligatorios.
 * Toda la validación anti-fraude vive en el Edge Function manto-confirmar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { tallerSupabase as supabase } from '../../lib/supabase/taller-client';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Wrench, LogOut, KeyRound, CheckCircle2, AlertTriangle, RefreshCw, QrCode, Camera, X } from 'lucide-react';

interface Props {
  route: string;
  onNavigate: (route: string) => void;
}

interface Cita {
  id: string;
  vehiculo_id: string;
  codigo: string;
  placa: string | null;
  vin: string | null;
  numero_padron: string | null;
  flota_nombre: string | null;
  public_token: string | null;
  km_servicio: number | null;
  fecha_programada: string | null;
  hora_cita: string | null;
  estado: string;
  km_odometro: number | null;
  requiere_aprobacion: boolean;
  confirmado_taller_en: string | null;
  observaciones: string | null;
  creado_en: string;
}

const DOMINIO_ALIAS = 'talleres.memphismaquinarias.com';

const ESTADO: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  programado: { label: 'Programada', variant: 'outline' },
  registrado_taller: { label: 'Registrada · espera Memphis', variant: 'secondary' },
  pendiente_aprobacion: { label: 'Pendiente de aprobación', variant: 'destructive' },
  confirmado: { label: 'Confirmada', variant: 'default' },
  observado: { label: 'Observada', variant: 'destructive' },
  ejecutado: { label: 'Ejecutada', variant: 'default' },
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Extrae el token del vehículo de un QR (URL .../v/{token} o token crudo) */
function extraerToken(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(/\/v\/([^/?#]+)/i);
  if (m) return m[1];
  if (/^[0-9a-f-]{36}$/i.test(t)) return t;
  return null;
}

/** Reduce una imagen a JPEG base64 (máx 1280px, calidad 0.7) para no inflar el payload */
async function comprimirImagen(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const max = 1280;
  let { width, height } = img;
  if (width > max || height > max) {
    const r = Math.min(max / width, max / height);
    width = Math.round(width * r);
    height = Math.round(height * r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

export function PortalTalleres({ route, onNavigate }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [vista, setVista] = useState<'login' | 'clave' | 'dashboard'>('login');

  // Login
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logueando, setLogueando] = useState(false);

  // Cambio de contraseña
  const [clave1, setClave1] = useState('');
  const [clave2, setClave2] = useState('');
  const [claveMsg, setClaveMsg] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);

  // Datos
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // Registro
  const [regOpen, setRegOpen] = useState(false);
  const [regCita, setRegCita] = useState<Cita | null>(null);
  const [regToken, setRegToken] = useState<string | null>(null);
  const [regPlaca, setRegPlaca] = useState('');
  const [regKm, setRegKm] = useState('');
  const [regFotos, setRegFotos] = useState<string[]>([]);
  const [regObs, setRegObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [regResultado, setRegResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  // Datos del vehiculo leido por QR (para que el taller confirme cual es)
  const [regVehiculo, setRegVehiculo] = useState<{ placa: string | null; vin: string | null; marca?: string; modelo?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Escáner QR
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const nombreTaller = (session?.user?.user_metadata?.nombre as string) ?? '';
  const codigoTaller = (session?.user?.app_metadata?.codigo as string) ?? '';
  const esTaller = session?.user?.app_metadata?.tipo === 'taller';
  const enClave = route.startsWith('/taller/clave');
  // Token del vehiculo cuando se llega desde el QR (/taller?v=TOKEN): tras el
  // login se abre directamente el registro de ESE vehiculo. El token no es un
  // secreto (va impreso en el QR); quien decide si el taller puede registrar es
  // el Edge Function manto-confirmar, que valida flota y taller.
  // OJO: `route` viene de window.location.pathname (sin query), asi que el
  // token se lee de location.search.
  const tokenQR = (() => {
    if (typeof window === 'undefined') return null;
    try { return new URLSearchParams(window.location.search).get('v'); } catch { return null; }
  })();

  // ── Sesión ──
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setCargandoSesion(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setVista('clave');
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (cargandoSesion) return;
    if (session && esTaller) setVista(enClave ? 'clave' : 'dashboard');
    else setVista(enClave && session ? 'clave' : 'login');
  }, [cargandoSesion, session, esTaller, enClave]);

  // ── Datos (via RPC taller_mis_citas — sin costo) ──
  const cargarDatos = useCallback(async () => {
    setCargandoDatos(true);
    const { data, error } = await supabase.rpc('taller_mis_citas');
    if (!error && data) setCitas(data as Cita[]);
    setCargandoDatos(false);
  }, []);

  useEffect(() => { if (vista === 'dashboard') cargarDatos(); }, [vista, cargarDatos]);

  // ── Acciones de sesión ──
  const login = async () => {
    setLoginError('');
    const cod = codigo.trim().toLowerCase();
    if (!cod) { setLoginError('Ingrese el código de su taller'); return; }
    if (!password) { setLoginError('Ingrese su contraseña'); return; }
    setLogueando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: `${cod}@${DOMINIO_ALIAS}`,
      password,
    });
    setLogueando(false);
    if (error) {
      setLoginError(/invalid/i.test(error.message)
        ? 'Código o contraseña incorrectos. Si aún no tiene acceso, solicítelo a Memphis Maquinarias.'
        : `No se pudo iniciar sesión: ${error.message}`);
    }
  };

  const guardarClave = async () => {
    setClaveMsg('');
    if (clave1.length < 8) { setClaveMsg('La contraseña debe tener al menos 8 caracteres'); return; }
    if (clave1 !== clave2) { setClaveMsg('Las contraseñas no coinciden'); return; }
    setGuardandoClave(true);
    const { error } = await supabase.auth.updateUser({ password: clave1 });
    setGuardandoClave(false);
    if (error) { setClaveMsg(`No se pudo guardar: ${error.message}`); return; }
    setClave1(''); setClave2('');
    onNavigate('/taller');
    setVista('dashboard');
  };

  const salir = async () => {
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* limpiar igual */ }
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') && k.includes('taller'))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* storage bloqueado */ }
    window.location.href = '/taller';
  };

  // ── Escáner QR ──
  const detenerScan = useCallback(() => {
    if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const abrirScan = async () => {
    setScanError('');
    if (!('BarcodeDetector' in window)) {
      setScanError('Tu navegador no soporta el escaneo por cámara. Usa el ingreso por placa.');
      setScanOpen(true);
      return;
    }
    setScanOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-ignore — BarcodeDetector no está en los tipos DOM
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const token = extraerToken(codes[0].rawValue ?? '');
            if (token) { cerrarScanCon(token); return; }
          }
        } catch { /* frame sin código */ }
        scanLoopRef.current = requestAnimationFrame(tick);
      };
      scanLoopRef.current = requestAnimationFrame(tick);
    } catch {
      setScanError('No se pudo abrir la cámara (permiso denegado). Usa el ingreso por placa.');
    }
  };

  const cerrarScanCon = (token: string) => {
    detenerScan();
    setScanOpen(false);
    abrirRegistro({ token });
  };

  useEffect(() => () => detenerScan(), [detenerScan]);

  // ── Registro de mantenimiento ──
  const abrirRegistro = (args: { cita?: Cita; token?: string; placa?: string }) => {
    setRegCita(args.cita ?? null);
    setRegToken(args.token ?? args.cita?.public_token ?? null);
    setRegPlaca(args.placa ?? '');
    setRegKm('');
    setRegFotos([]);
    setRegObs('');
    setRegResultado(null);
    setRegVehiculo(null);
    setRegOpen(true);
    // Si viene por QR (sin cita), traer los datos publicos para mostrarlos
    const tk = args.token ?? args.cita?.public_token ?? null;
    if (tk && !args.cita) {
      void (async () => {
        const { data } = await (supabase.rpc as any)('vehiculo_public_by_token', { p_token: tk });
        if (data && data.publico !== false) {
          setRegVehiculo({ placa: data.placa ?? null, vin: data.vin ?? null, marca: data.marca, modelo: data.modelo });
        }
      })();
    }
  };

  // Llegada desde el QR: una vez autenticado, abrir el registro de ese vehiculo
  const autoAbiertoRef = useRef(false);
  useEffect(() => {
    if (vista !== 'dashboard' || !tokenQR || autoAbiertoRef.current) return;
    autoAbiertoRef.current = true;
    abrirRegistro({ token: tokenQR });
  }, [vista, tokenQR]);

  const agregarFotos = async (files: FileList | null) => {
    if (!files) return;
    const nuevas: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      try { nuevas.push(await comprimirImagen(f)); } catch { /* omite */ }
    }
    setRegFotos(prev => [...prev, ...nuevas]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const enviarRegistro = async () => {
    setRegResultado(null);
    const km = Number(regKm);
    if (!Number.isFinite(km) || km <= 0) { setRegResultado({ ok: false, mensaje: 'Ingresa el kilometraje del odómetro' }); return; }
    if (regFotos.length === 0) { setRegResultado({ ok: false, mensaje: 'Adjunta al menos una foto de evidencia' }); return; }

    setEnviando(true);
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setEnviando(false); setRegResultado({ ok: false, mensaje: 'Sesión expirada — vuelve a iniciar sesión' }); return; }

    const body: Record<string, unknown> = {
      km_odometro: km,
      fotos: regFotos,
      observaciones: regObs.trim() || undefined,
    };
    if (regCita) body.manto_id = regCita.id;
    else if (regToken) body.vehiculo_token = regToken;
    else if (regPlaca.trim()) body.placa = regPlaca.trim();
    else { setEnviando(false); setRegResultado({ ok: false, mensaje: 'Escanea el QR o ingresa la placa del vehículo' }); return; }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manto-confirmar`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setEnviando(false);
      if (res.ok && data.ok) {
        setRegResultado({ ok: true, mensaje: data.mensaje ?? 'Registrado' });
        cargarDatos();
      } else {
        setRegResultado({ ok: false, mensaje: data.error ?? `No se pudo registrar (error ${res.status})` });
      }
    } catch {
      setEnviando(false);
      setRegResultado({ ok: false, mensaje: 'Error de red. Reintenta.' });
    }
  };

  // ══════════════════ RENDER ══════════════════
  const marco = (contenido: React.ReactNode) => (
    <div className="min-h-screen bg-slate-100 dark:bg-background">
      <header className="bg-white dark:bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="Memphis" className="h-9 w-9" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="font-semibold leading-tight">Memphis Maquinarias</p>
              <p className="text-xs text-muted-foreground">Portal de Talleres</p>
            </div>
          </div>
          {vista === 'dashboard' && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{nombreTaller || '—'}</p>
                <p className="text-xs text-muted-foreground">{codigoTaller}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setVista('clave')} title="Cambiar contraseña">
                <KeyRound className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={salir}>
                <LogOut className="size-4" /> Salir
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{contenido}</main>
    </div>
  );

  if (cargandoSesion) {
    return marco(<p className="text-center text-muted-foreground py-16">Cargando…</p>);
  }

  // Sesión de personal interno en el portal de talleres
  if (session && !esTaller && vista !== 'clave') {
    return marco(
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center space-y-4">
          <Wrench className="size-10 mx-auto text-muted-foreground" />
          <p>Esta sección es el portal para talleres. Tu cuenta es del personal de Memphis.</p>
          <Button onClick={() => onNavigate('/')}>Ir al ERP</Button>
        </CardContent>
      </Card>
    );
  }

  // ── Vista: fijar/cambiar contraseña ──
  if (vista === 'clave' && session) {
    return marco(
      <Card className="max-w-md mx-auto">
        <CardHeader><CardTitle className="text-lg">Define tu contraseña</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Nueva contraseña (mínimo 8 caracteres)</Label>
            <Input type="password" value={clave1} onChange={e => setClave1(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Repite la contraseña</Label>
            <Input type="password" value={clave2} onChange={e => setClave2(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarClave()} />
          </div>
          {claveMsg && <p className="text-sm text-red-600">{claveMsg}</p>}
          <Button className="w-full" onClick={guardarClave} disabled={guardandoClave}>
            {guardandoClave ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
          {esTaller && (
            <Button variant="ghost" className="w-full" onClick={() => { onNavigate('/taller'); setVista('dashboard'); }}>
              Cancelar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Vista: login ──
  if (vista === 'login') {
    return marco(
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Acceso para talleres</CardTitle>
          <p className="text-sm text-muted-foreground">
            Registra los mantenimientos de la flota que atiendes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Código del taller</Label>
            <Input placeholder="TALL-001" value={codigo} onChange={e => setCodigo(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Contraseña</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()} />
          </div>
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <Button className="w-full" onClick={login} disabled={logueando}>
            {logueando ? 'Ingresando…' : 'Ingresar'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            ¿Sin acceso o contraseña olvidada? Contacta a Memphis Maquinarias.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Vista: dashboard del taller ──
  const hoy = hoyISO();
  const pendientesHoy = citas.filter(c => c.estado === 'programado' && c.fecha_programada && c.fecha_programada <= hoy);
  const proximas = citas.filter(c => c.estado === 'programado' && c.fecha_programada && c.fecha_programada > hoy);
  const historial = citas.filter(c => c.estado !== 'programado');

  const vehiculoLabel = (c: Cita) => c.placa || c.vin || c.codigo;

  const renderCitaRow = (c: Cita, accion?: React.ReactNode) => {
    const badge = ESTADO[c.estado] ?? { label: c.estado, variant: 'outline' as const };
    return (
      <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{vehiculoLabel(c)}</p>
            <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[c.flota_nombre, c.numero_padron && `Padrón ${c.numero_padron}`,
              c.km_servicio != null && `Servicio ${c.km_servicio.toLocaleString('es-PE')} km`,
              c.fecha_programada].filter(Boolean).join(' · ')}
          </p>
        </div>
        {accion}
      </div>
    );
  };

  return marco(
    <div className="space-y-6">
      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button size="lg" className="h-14 text-base" onClick={abrirScan}>
          <QrCode className="size-5" /> Escanear QR del vehículo
        </Button>
        <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => abrirRegistro({})}>
          <Wrench className="size-5" /> Registrar por placa
        </Button>
      </div>

      {/* Citas de hoy / vencidas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Citas para atender ({pendientesHoy.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={cargarDatos} disabled={cargandoDatos}>
            <RefreshCw className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {cargandoDatos ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Cargando…</p>
          ) : pendientesHoy.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">No tienes citas pendientes para hoy</p>
          ) : pendientesHoy.map(c => renderCitaRow(c,
            <Button size="sm" onClick={() => abrirRegistro({ cita: c })}>Registrar</Button>
          ))}
        </CardContent>
      </Card>

      {/* Próximas */}
      {proximas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Próximas citas ({proximas.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {proximas.slice(0, 20).map(c => renderCitaRow(c))}
          </CardContent>
        </Card>
      )}

      {/* Historial */}
      <Card>
        <CardHeader><CardTitle className="text-base">Mis registros ({historial.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {historial.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Aún no has registrado mantenimientos</p>
          ) : historial.slice(0, 40).map(c => renderCitaRow(c,
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {c.km_odometro != null ? `${c.km_odometro.toLocaleString('es-PE')} km` : ''}
            </span>
          ))}
        </CardContent>
      </Card>

      {/* Escáner QR */}
      <Dialog open={scanOpen} onOpenChange={(o) => { if (!o) { detenerScan(); setScanOpen(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="size-4" /> Escanear QR</DialogTitle></DialogHeader>
          {scanError ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{scanError}</p>
              <Button className="w-full" variant="outline" onClick={() => { setScanOpen(false); abrirRegistro({}); }}>
                Registrar por placa
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-lg" />
              </div>
              <p className="text-xs text-muted-foreground text-center">Apunta al QR del vehículo</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registro */}
      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="size-4" /> Registrar mantenimiento</DialogTitle>
          </DialogHeader>

          {regResultado?.ok ? (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="size-10 mx-auto text-green-600" />
              <p className="text-sm">{regResultado.mensaje}</p>
              <Button className="w-full" onClick={() => setRegOpen(false)}>Listo</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {regCita ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{vehiculoLabel(regCita)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[regCita.flota_nombre, regCita.km_servicio != null && `Servicio ${regCita.km_servicio.toLocaleString('es-PE')} km`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ) : regToken ? (
                <div className="rounded-md border bg-green-50 dark:bg-green-950/20 border-green-300 p-3 text-sm">
                  <p className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <QrCode className="size-4" /> QR leído
                  </p>
                  {regVehiculo && (
                    <div className="mt-2">
                      {/* Placa en trámite → se identifica por VIN */}
                      <p className="text-xs text-muted-foreground">{regVehiculo.placa ? 'Placa' : 'VIN'}</p>
                      <p className="font-semibold break-all">{regVehiculo.placa || regVehiculo.vin || '—'}</p>
                      {(regVehiculo.marca || regVehiculo.modelo) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[regVehiculo.marca, regVehiculo.modelo].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Confirma el kilometraje y las fotos.</p>
                </div>
              ) : (
                <div>
                  <Label className="mb-1.5 block">Placa del vehículo</Label>
                  <Input placeholder="ABC-123" value={regPlaca} onChange={e => setRegPlaca(e.target.value.toUpperCase())} />
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">Kilometraje del odómetro <span className="text-red-500">*</span></Label>
                <Input type="number" inputMode="numeric" placeholder="52000" value={regKm} onChange={e => setRegKm(e.target.value)} />
              </div>

              <div>
                <Label className="mb-1.5 block">Fotos de evidencia <span className="text-red-500">*</span></Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={e => agregarFotos(e.target.files)}
                  className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                />
                {regFotos.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {regFotos.map((f, i) => (
                      <div key={i} className="relative">
                        <img src={f} alt={`evidencia ${i + 1}`} className="size-16 rounded object-cover border" />
                        <button
                          type="button"
                          onClick={() => setRegFotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 text-white p-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">Observaciones (opcional)</Label>
                <Textarea rows={2} value={regObs} onChange={e => setRegObs(e.target.value)} placeholder="Detalle del servicio realizado…" />
              </div>

              {regResultado && !regResultado.ok && (
                <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" /> {regResultado.mensaje}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setRegOpen(false)} disabled={enviando}>Cancelar</Button>
                <Button onClick={enviarRegistro} disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Registrar mantenimiento'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
