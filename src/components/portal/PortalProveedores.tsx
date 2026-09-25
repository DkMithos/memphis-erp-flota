/**
 * Portal de Proveedores (Fase B) — erp.memphismaquinarias.com/portal
 * Login por RUC + contraseña (alias interno {ruc}@proveedores.memphismaquinarias.com).
 * El proveedor ve SOLO sus órdenes (RLS) y sube sus facturas (XML UBL + PDF opcional).
 * Autocontenido: NO monta stores del ERP; el aislamiento real lo garantiza RLS.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
// Cliente EXCLUSIVO del portal (storageKey propio): la sesión del proveedor
// nunca pisa la sesión del personal del ERP en el mismo navegador.
import { portalSupabase as supabase, errorEnlacePortal } from '../../lib/supabase/portal-client';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { Building2, FileUp, LogOut, KeyRound, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  route: string;
  onNavigate: (route: string) => void;
}

interface OrdenPortal {
  id: string;
  numero: string;
  fecha: string | null;
  estado: string;
  moneda: string;
  total: number;
  aceptado: number;
  enTramite: number;
  saldo: number;
  estadoFacturacion: string;
}

interface FacturaPortal {
  id: string;
  numeroCompleto: string;
  fecha: string | null;
  total: number;
  moneda: string;
  estadoFlujo: string;
  orden: string | null;
  motivoObservacion: string | null;
}

interface ResultadoSubida {
  archivo: string;
  ok: boolean;
  mensaje: string;
  errores?: string[];
  permiteElegirOC?: boolean;
  xml?: string;
  pdfBase64?: string;
}

const DOMINIO_ALIAS = 'proveedores.memphismaquinarias.com';

const ESTADO_FACTURA: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  recibida: { label: 'Recibida', variant: 'outline' },
  validada: { label: 'Validada', variant: 'secondary' },
  observada: { label: 'Observada', variant: 'destructive' },
  conforme: { label: 'Conforme', variant: 'default' },
  programada_pago: { label: 'Programada de pago', variant: 'default' },
  pagada: { label: 'Pagada', variant: 'default' },
  anulada: { label: 'Anulada', variant: 'destructive' },
};

const fmt = (monto: number, moneda: string) =>
  `${moneda === 'USD' ? 'US$' : 'S/'} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PortalProveedores({ route, onNavigate }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [vista, setVista] = useState<'login' | 'clave' | 'clave-vencida' | 'invitacion' | 'dashboard'>('login');

  // Login
  const [ruc, setRuc] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logueando, setLogueando] = useState(false);

  // Cambio de contraseña
  const [clave1, setClave1] = useState('');
  const [clave2, setClave2] = useState('');
  const [claveMsg, setClaveMsg] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);

  // Invitación (enlace opaco /portal/invitacion?code=…): verificación y estado
  const [invitCargando, setInvitCargando] = useState(true);
  const [invitOk, setInvitOk] = useState(false);
  const [invitMotivo, setInvitMotivo] = useState('');      // 'invalida'|'usada'|'vencida'
  const [invitRazon, setInvitRazon] = useState('');
  const [invitRuc, setInvitRuc] = useState('');
  const [invitListo, setInvitListo] = useState(false);     // contraseña ya fijada

  // Datos
  const [razonSocial, setRazonSocial] = useState('');
  const [ordenes, setOrdenes] = useState<OrdenPortal[]>([]);
  const [facturas, setFacturas] = useState<FacturaPortal[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // Subida
  const [subiendo, setSubiendo] = useState(false);
  const [resultados, setResultados] = useState<ResultadoSubida[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const esProveedor = session?.user?.app_metadata?.tipo === 'proveedor';
  const enClave = route.startsWith('/portal/clave');
  const enInvitacion = route.startsWith('/portal/invitacion');
  const codeInvit = new URLSearchParams(route.split('?')[1] ?? '').get('code') ?? '';

  const fnUrl = (fn: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
  const fnHeaders = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  } as const;

  // El error del enlace (usado/vencido) se capturó en la carga del módulo del
  // cliente, antes de que detectSessionInUrl borrara el hash. Ver portal-client.
  const errorEnlace = errorEnlacePortal;

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
    // La invitación (enlace opaco) manda sobre todo: es una página sin sesión
    // donde el proveedor recién crea su contraseña.
    if (enInvitacion) { setVista('invitacion'); return; }
    if (cargandoSesion) return;
    if (session && esProveedor) { setVista(enClave ? 'clave' : 'dashboard'); return; }
    // En /clave sin sesión: o el enlace traía un error (usado/vencido), o
    // alguien entró a mano. En ambos casos NO es un login normal — se explica.
    if (enClave && !session) { setVista('clave-vencida'); return; }
    setVista('login');
  }, [cargandoSesion, session, esProveedor, enClave, enInvitacion]);

  // Verifica el código de invitación al abrir la página. Es un POST: un bot que
  // solo baja el HTML no lo dispara, y aunque lo hiciera, 'verificar' no consume
  // nada — el código se gasta solo al FIJAR la contraseña.
  useEffect(() => {
    if (!enInvitacion) return;
    let vivo = true;
    setInvitCargando(true);
    (async () => {
      if (!codeInvit) { if (vivo) { setInvitOk(false); setInvitMotivo('invalida'); setInvitCargando(false); } return; }
      try {
        const res = await fetch(fnUrl('portal-fijar-clave'), {
          method: 'POST', headers: fnHeaders,
          body: JSON.stringify({ accion: 'verificar', code: codeInvit }),
        });
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        setInvitOk(!!data.ok);
        setInvitMotivo(data.motivo ?? '');
        setInvitRazon(data.razon_social ?? '');
        setInvitRuc(data.ruc ?? '');
      } catch {
        if (vivo) { setInvitOk(false); setInvitMotivo('error'); }
      } finally {
        if (vivo) setInvitCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [enInvitacion, codeInvit]);

  // ── Datos del proveedor (bajo RLS) ──
  const cargarDatos = useCallback(async () => {
    setCargandoDatos(true);
    const [prov, ocs, saldos, facts] = await Promise.all([
      supabase.from('proveedores').select('razon_social').limit(1).maybeSingle(),
      supabase.from('ordenes_compra')
        .select('id, numero, fecha_emision, estado, moneda, total')
        .order('fecha_emision', { ascending: false }).limit(1000),
      supabase.from('v_oc_saldo_facturacion').select('*').limit(1000),
      supabase.from('comprobantes_pago')
        .select('id, numero_completo, fecha_emision, total, moneda, estado_flujo, orden_compra_numero, motivo_observacion')
        .order('creado_en', { ascending: false }).limit(500),
    ]);
    setRazonSocial(prov.data?.razon_social ?? '');
    const saldoPorOc = new Map((saldos.data ?? []).map((s: any) => [s.orden_compra_id, s]));
    setOrdenes((ocs.data ?? []).map((o: any): OrdenPortal => {
      const s = saldoPorOc.get(o.id);
      return {
        id: o.id, numero: o.numero, fecha: o.fecha_emision, estado: o.estado,
        moneda: o.moneda ?? 'PEN', total: Number(o.total ?? 0),
        aceptado: Number(s?.facturado_aceptado ?? 0),
        enTramite: Number(s?.facturado_en_tramite ?? 0),
        saldo: Number(s?.saldo_por_facturar ?? o.total ?? 0),
        estadoFacturacion: s?.estado_facturacion ?? 'sin_facturar',
      };
    }));
    setFacturas((facts.data ?? []).map((f: any): FacturaPortal => ({
      id: f.id, numeroCompleto: f.numero_completo, fecha: f.fecha_emision,
      total: Number(f.total ?? 0), moneda: f.moneda ?? 'PEN',
      estadoFlujo: f.estado_flujo ?? 'recibida', orden: f.orden_compra_numero,
      motivoObservacion: f.motivo_observacion,
    })));
    setCargandoDatos(false);
  }, []);

  useEffect(() => { if (vista === 'dashboard') cargarDatos(); }, [vista, cargarDatos]);

  // ── Acciones ──
  const login = async () => {
    setLoginError('');
    const rucLimpio = ruc.replace(/\D/g, '');
    if (!/^\d{11}$/.test(rucLimpio)) { setLoginError('Ingrese su RUC de 11 dígitos'); return; }
    if (!password) { setLoginError('Ingrese su contraseña'); return; }
    setLogueando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: `${rucLimpio}@${DOMINIO_ALIAS}`,
      password,
    });
    setLogueando(false);
    if (error) {
      setLoginError(/invalid/i.test(error.message)
        ? 'RUC o contraseña incorrectos. Si aún no tiene acceso, solicítelo a Memphis Maquinarias.'
        : `No se pudo iniciar sesión: ${error.message}`);
    }
  };

  // Política de contraseñas del proyecto (Supabase Auth): mínimo 8 caracteres con
  // mayúscula, minúscula, número y símbolo; además rechaza contraseñas filtradas.
  const REGLA_CLAVE = 'Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y un símbolo (por ejemplo: Ferreteria-2026!).';
  const validarClave = (pwd: string): string | null => {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[a-z]/.test(pwd)) return 'La contraseña debe incluir al menos una letra minúscula.';
    if (!/[A-Z]/.test(pwd)) return 'La contraseña debe incluir al menos una letra mayúscula.';
    if (!/[0-9]/.test(pwd)) return 'La contraseña debe incluir al menos un número.';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'La contraseña debe incluir al menos un símbolo (por ejemplo ! @ # $ % - _ .).';
    return null;
  };

  const guardarClave = async () => {
    setClaveMsg('');
    const invalida = validarClave(clave1);
    if (invalida) { setClaveMsg(invalida); return; }
    if (clave1 !== clave2) { setClaveMsg('Las contraseñas no coinciden'); return; }
    setGuardandoClave(true);
    const { error } = await supabase.auth.updateUser({ password: clave1 });
    setGuardandoClave(false);
    if (error) {
      setClaveMsg(/weak|pwned|character/i.test(error.message)
        ? 'Esa contraseña es demasiado común o no cumple las reglas. ' + REGLA_CLAVE
        : `No se pudo guardar: ${error.message}`);
      return;
    }
    setClave1(''); setClave2('');
    onNavigate('/portal');
    setVista('dashboard');
  };

  // Fija la contraseña desde la invitación opaca. Aquí SÍ se consume el código.
  const fijarClaveInvitacion = async () => {
    setClaveMsg('');
    const invalida = validarClave(clave1);
    if (invalida) { setClaveMsg(invalida); return; }
    if (clave1 !== clave2) { setClaveMsg('Las contraseñas no coinciden'); return; }
    setGuardandoClave(true);
    try {
      const res = await fetch(fnUrl('portal-fijar-clave'), {
        method: 'POST', headers: fnHeaders,
        body: JSON.stringify({ accion: 'fijar', code: codeInvit, password: clave1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        if (data.motivo === 'usada' || data.motivo === 'vencida' || data.motivo === 'invalida') {
          setInvitOk(false); setInvitMotivo(data.motivo);
        } else {
          setClaveMsg(data.error ?? 'No se pudo guardar la contraseña. Inténtalo de nuevo.');
        }
        return;
      }
      setClave1(''); setClave2('');
      setInvitListo(true);
    } catch {
      setClaveMsg('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setGuardandoClave(false);
    }
  };

  const salir = async () => {
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* limpiar igual */ }
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* storage bloqueado */ }
    window.location.href = '/portal';
  };

  // ── Subida de facturas ──
  const subirXml = async (archivo: string, xml: string, pdfBase64?: string, ordenCompraId?: string): Promise<ResultadoSubida> => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { archivo, ok: false, mensaje: 'Sesión expirada — vuelva a iniciar sesión' };
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/factura-ingest`, {
      method: 'POST',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ xml, pdf_base64: pdfBase64, orden_compra_id: ordenCompraId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { archivo, ok: true, mensaje: data.mensaje ?? 'Factura recibida' };
    }
    const errores: string[] = data.errores ?? [data.error ?? `Error ${res.status}`];
    const permiteElegirOC = errores.some(e => /no indica número de orden|No se encontró la orden/i.test(e));
    return { archivo, ok: false, mensaje: 'No se pudo registrar', errores, permiteElegirOC, xml, pdfBase64 };
  };

  const procesarArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    const lista = Array.from(files);
    const xmls = lista.filter(f => f.name.toLowerCase().endsWith('.xml'));
    const pdfs = new Map(lista.filter(f => f.name.toLowerCase().endsWith('.pdf'))
      .map(f => [f.name.toLowerCase().replace(/\.pdf$/, ''), f]));
    if (xmls.length === 0) {
      setResultados(r => [{ archivo: '—', ok: false, mensaje: 'Seleccione el XML y el PDF de cada factura (los dos son obligatorios y deben llamarse igual, p. ej. F001-00000458.xml y F001-00000458.pdf)' }, ...r]);
      setSubiendo(false);
      return;
    }
    const nuevos: ResultadoSubida[] = [];
    for (const f of xmls) {
      const xml = await f.text();
      // El PDF (representación impresa) es obligatorio: Compras y Contabilidad
      // lo revisan y es el que se archiva. Se empareja con el XML por nombre.
      const pdf = pdfs.get(f.name.toLowerCase().replace(/\.xml$/, ''));
      if (!pdf) {
        nuevos.push({
          archivo: f.name, ok: false, mensaje: 'Falta el PDF de esta factura',
          errores: [`Sube también ${f.name.replace(/\.xml$/i, '.pdf')} (la representación impresa). Selecciona el XML y el PDF juntos.`],
        });
        continue;
      }
      const buf = new Uint8Array(await pdf.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
      const pdfBase64 = btoa(bin);
      nuevos.push(await subirXml(f.name, xml, pdfBase64));
    }
    setResultados(r => [...nuevos, ...r]);
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = '';
    cargarDatos();
  };

  const reintentarConOC = async (idx: number, ordenCompraId: string) => {
    const r = resultados[idx];
    if (!r?.xml) return;
    setSubiendo(true);
    const nuevo = await subirXml(r.archivo, r.xml, r.pdfBase64, ordenCompraId);
    setResultados(prev => prev.map((x, i) => (i === idx ? nuevo : x)));
    setSubiendo(false);
    cargarDatos();
  };

  // ══════════════════ RENDER ══════════════════

  const marco = (contenido: React.ReactNode) => (
    <div className="min-h-screen bg-slate-100 dark:bg-background">
      <header className="bg-white dark:bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="Memphis" className="h-9 w-9" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="font-semibold leading-tight">Memphis Maquinarias</p>
              <p className="text-xs text-muted-foreground">Portal de Proveedores</p>
            </div>
          </div>
          {vista === 'dashboard' && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{razonSocial || '—'}</p>
                <p className="text-xs text-muted-foreground">RUC {session?.user?.app_metadata?.ruc ?? ''}</p>
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
      <main className="max-w-5xl mx-auto px-4 py-8">{contenido}</main>
    </div>
  );

  // ── Vista: invitación (enlace opaco para crear la contraseña) ──
  // Va primero: no depende de la sesión (el proveedor aún no la tiene) y no debe
  // confundirse con la orientación al personal interno.
  if (vista === 'invitacion') {
    if (invitCargando) {
      return marco(<p className="text-center text-muted-foreground py-16">Validando tu enlace…</p>);
    }
    if (invitListo) {
      return marco(
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="size-10 mx-auto text-green-600" />
            <div>
              <p className="font-medium">¡Contraseña creada!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ya puedes ingresar al portal con tu RUC {invitRuc && <strong>{invitRuc}</strong>} y tu nueva contraseña.
              </p>
            </div>
            <Button className="w-full" onClick={() => { onNavigate('/portal'); setVista('login'); }}>
              Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (!invitOk) {
      const texto = invitMotivo === 'usada'
        ? 'Este enlace ya se usó para crear una contraseña. Si fuiste tú, ingresa con tu RUC y esa contraseña.'
        : invitMotivo === 'vencida'
        ? 'Este enlace venció. Pídele a tu comprador de Memphis que te genere uno nuevo.'
        : 'Este enlace no es válido. Revisa que lo hayas copiado completo, o pídele a tu comprador de Memphis uno nuevo.';
      return marco(
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Enlace no válido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{texto}</p>
            <Button className="w-full" onClick={() => { onNavigate('/portal'); setVista('login'); }}>
              Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      );
    }
    return marco(
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Crea tu contraseña</CardTitle>
          <p className="text-sm text-muted-foreground">
            {invitRazon ? <>Bienvenido, <strong>{invitRazon}</strong>. </> : null}
            Define la contraseña con la que entrarás al portal.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Nueva contraseña</Label>
            <Input type="password" value={clave1} onChange={e => setClave1(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1.5">{REGLA_CLAVE}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Repite la contraseña</Label>
            <Input type="password" value={clave2} onChange={e => setClave2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fijarClaveInvitacion()} />
          </div>
          {claveMsg && <p className="text-sm text-red-600">{claveMsg}</p>}
          <Button className="w-full" onClick={fijarClaveInvitacion} disabled={guardandoClave}>
            {guardandoClave ? 'Guardando…' : 'Crear contraseña'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (cargandoSesion) {
    return marco(<p className="text-center text-muted-foreground py-16">Cargando…</p>);
  }

  // Sesión de personal interno en el portal → orientar sin cerrar su sesión
  if (session && !esProveedor && vista !== 'clave') {
    return marco(
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center space-y-4">
          <Building2 className="size-10 mx-auto text-muted-foreground" />
          <p>Esta sección es el portal para proveedores. Tu cuenta es del personal de Memphis.</p>
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
            <Label className="mb-1.5 block">Nueva contraseña</Label>
            <Input type="password" value={clave1} onChange={e => setClave1(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1.5">{REGLA_CLAVE}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Repite la contraseña</Label>
            <Input type="password" value={clave2} onChange={e => setClave2(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarClave()} />
          </div>
          {claveMsg && <p className="text-sm text-red-600">{claveMsg}</p>}
          <Button className="w-full" onClick={guardarClave} disabled={guardandoClave}>
            {guardandoClave ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
          {esProveedor && (
            <Button variant="ghost" className="w-full" onClick={() => { onNavigate('/portal'); setVista('dashboard'); }}>
              Cancelar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Vista: enlace de contraseña usado o vencido ──
  // El proveedor llegó a /portal/clave pero el enlace ya no vale. Se le dice
  // claramente qué pasó y qué hacer, en vez de mandarlo al login sin más.
  if (vista === 'clave-vencida') {
    const yaUsado = errorEnlace === 'otp_expired' || errorEnlace === 'access_denied';
    return marco(
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Enlace no válido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {yaUsado
              ? 'Este enlace para crear tu contraseña ya se usó o venció. Cada enlace sirve una sola vez.'
              : 'Para crear tu contraseña tienes que entrar desde el enlace que te envió Memphis Maquinarias.'}
          </p>
          <div className="rounded-md border bg-slate-50 dark:bg-muted/30 p-3 text-sm space-y-1.5">
            <p className="font-medium">¿Qué hago ahora?</p>
            <p className="text-muted-foreground">
              Si <strong>ya creaste tu contraseña antes</strong>, ingresa con tu RUC y esa contraseña.
            </p>
            <p className="text-muted-foreground">
              Si <strong>aún no la creaste</strong>, escríbele a tu comprador de Memphis y pídele que te
              genere un enlace nuevo. El anterior deja de servir apenas se usa.
            </p>
          </div>
          <Button className="w-full" onClick={() => { onNavigate('/portal'); setVista('login'); }}>
            Ir a iniciar sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Vista: login ──
  if (vista === 'login') {
    return marco(
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Acceso para proveedores</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consulta tus órdenes de compra y envía tus facturas electrónicas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">RUC</Label>
            <Input inputMode="numeric" maxLength={11} placeholder="20XXXXXXXXX"
              value={ruc} onChange={e => setRuc(e.target.value.replace(/\D/g, ''))} />
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
            ¿Sin acceso o contraseña olvidada? Contacta a tu comprador de Memphis Maquinarias.
          </p>
          <p className="text-xs text-center">
            <a href="/portal/guia-proveedores.pdf" target="_blank" rel="noopener" className="text-primary underline">
              Guía del portal (PDF): cómo crear su contraseña y enviar sus facturas
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Vista: dashboard del proveedor ──
  const ordenesConSaldo = ordenes.filter(o => o.saldo > 0.01);
  return marco(
    <div className="space-y-6">
      <Tabs defaultValue="ordenes">
        <TabsList>
          <TabsTrigger value="ordenes">Mis órdenes ({ordenes.length})</TabsTrigger>
          <TabsTrigger value="subir">Enviar facturas</TabsTrigger>
          <TabsTrigger value="facturas">Mis facturas ({facturas.length})</TabsTrigger>
        </TabsList>

        {/* Órdenes con su saldo */}
        <TabsContent value="ordenes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Órdenes de compra emitidas a tu empresa</CardTitle>
              <Button variant="outline" size="sm" onClick={cargarDatos} disabled={cargandoDatos}>
                <RefreshCw className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Facturado (aceptado)</TableHead>
                    <TableHead className="text-right">En trámite</TableHead>
                    <TableHead className="text-right">Saldo disponible</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargandoDatos ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                  ) : ordenes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tienes órdenes registradas</TableCell></TableRow>
                  ) : ordenes.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono font-medium">{o.numero}</TableCell>
                      <TableCell>{o.fecha ?? '—'}</TableCell>
                      <TableCell className="text-right">{fmt(o.total, o.moneda)}</TableCell>
                      <TableCell className="text-right">{fmt(o.aceptado, o.moneda)}</TableCell>
                      <TableCell className="text-right">{fmt(o.enTramite, o.moneda)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(o.saldo, o.moneda)}</TableCell>
                      <TableCell>
                        <Badge variant={o.estadoFacturacion === 'facturada_completa' ? 'default' : o.estadoFacturacion === 'parcialmente_facturada' ? 'secondary' : 'outline'}>
                          {o.estadoFacturacion === 'facturada_completa' ? 'Facturada' : o.estadoFacturacion === 'parcialmente_facturada' ? 'Parcial' : 'Sin facturar'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subir facturas */}
        <TabsContent value="subir" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enviar facturas electrónicas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Por cada factura sube <strong>dos archivos con el mismo nombre</strong>: el <strong>XML</strong> (factura
                electrónica) y el <strong>PDF</strong> (representación impresa), p. ej. <code>F001-00000458.xml</code> y{' '}
                <code>F001-00000458.pdf</code>. Ambos son obligatorios. Si el XML incluye el número de la orden de compra
                (OrderReference), se asigna sola; si no, podrás elegir la orden. Puedes subir varias facturas a la vez.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".xml,.pdf"
                disabled={subiendo}
                onChange={e => procesarArchivos(e.target.files)}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
              />
              {subiendo && <p className="text-sm text-muted-foreground flex items-center gap-2"><FileUp className="size-4 animate-pulse" /> Procesando archivos…</p>}
            </CardContent>
          </Card>

          {resultados.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Resultados</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {resultados.map((r, i) => (
                  <div key={`${r.archivo}-${i}`} className={`rounded-md border p-3 ${r.ok ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-red-300 bg-red-50 dark:bg-red-950/20'}`}>
                    <div className="flex items-start gap-2">
                      {r.ok ? <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle className="size-4 text-red-600 mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.archivo}</p>
                        <p className="text-sm">{r.mensaje}</p>
                        {r.errores && (
                          <ul className="text-sm text-red-700 dark:text-red-400 list-disc ml-4 mt-1">
                            {r.errores.map((e, j) => <li key={j}>{e}</li>)}
                          </ul>
                        )}
                        {!r.ok && r.permiteElegirOC && r.xml && (
                          <div className="mt-2 flex items-center gap-2">
                            <Select onValueChange={v => reintentarConOC(i, v)} disabled={subiendo}>
                              <SelectTrigger className="w-72 bg-white dark:bg-card">
                                <SelectValue placeholder="Asignar a una de mis órdenes…" />
                              </SelectTrigger>
                              <SelectContent>
                                {ordenesConSaldo.map(o => (
                                  <SelectItem key={o.id} value={o.id}>
                                    {o.numero} · saldo {fmt(o.saldo, o.moneda)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Mis facturas */}
        <TabsContent value="facturas">
          <Card>
            <CardHeader><CardTitle className="text-base">Facturas enviadas y su estado</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturas.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aún no has enviado facturas</TableCell></TableRow>
                  ) : facturas.map(f => {
                    const badge = ESTADO_FACTURA[f.estadoFlujo] ?? { label: f.estadoFlujo, variant: 'outline' as const };
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono font-medium">{f.numeroCompleto}</TableCell>
                        <TableCell>{f.fecha ?? '—'}</TableCell>
                        <TableCell className="font-mono">{f.orden ?? '—'}</TableCell>
                        <TableCell className="text-right">{fmt(f.total, f.moneda)}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {f.estadoFlujo === 'observada' && f.motivoObservacion && (
                            <p className="text-xs text-red-600 mt-1">{f.motivoObservacion}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
