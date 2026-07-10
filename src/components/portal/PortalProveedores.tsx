/**
 * Portal de Proveedores (Fase B) — erp.memphismaquinarias.com/portal
 * Login por RUC + contraseña (alias interno {ruc}@proveedores.memphismaquinarias.com).
 * El proveedor ve SOLO sus órdenes (RLS) y sube sus facturas (XML UBL + PDF opcional).
 * Autocontenido: NO monta stores del ERP; el aislamiento real lo garantiza RLS.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
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
  const [vista, setVista] = useState<'login' | 'clave' | 'dashboard'>('login');

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
    if (session && esProveedor) setVista(enClave ? 'clave' : 'dashboard');
    else setVista(enClave && session ? 'clave' : 'login');
  }, [cargandoSesion, session, esProveedor, enClave]);

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

  const guardarClave = async () => {
    setClaveMsg('');
    if (clave1.length < 8) { setClaveMsg('La contraseña debe tener al menos 8 caracteres'); return; }
    if (clave1 !== clave2) { setClaveMsg('Las contraseñas no coinciden'); return; }
    setGuardandoClave(true);
    const { error } = await supabase.auth.updateUser({ password: clave1 });
    setGuardandoClave(false);
    if (error) { setClaveMsg(`No se pudo guardar: ${error.message}`); return; }
    setClave1(''); setClave2('');
    onNavigate('/portal');
    setVista('dashboard');
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
      setResultados(r => [{ archivo: '—', ok: false, mensaje: 'Seleccione al menos un archivo XML (el PDF es opcional y se empareja por nombre)' }, ...r]);
      setSubiendo(false);
      return;
    }
    const nuevos: ResultadoSubida[] = [];
    for (const f of xmls) {
      const xml = await f.text();
      const pdf = pdfs.get(f.name.toLowerCase().replace(/\.xml$/, ''));
      let pdfBase64: string | undefined;
      if (pdf) {
        const buf = new Uint8Array(await pdf.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
        pdfBase64 = btoa(bin);
      }
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
            <img src="/fdf.svg" alt="Memphis" className="h-9 w-9" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
          {esProveedor && (
            <Button variant="ghost" className="w-full" onClick={() => { onNavigate('/portal'); setVista('dashboard'); }}>
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
                Sube el <strong>XML</strong> de tu factura (obligatorio). El PDF es opcional y se
                empareja por nombre de archivo. Si el XML incluye el número de orden
                (OrderReference), la asignación es automática. Puedes subir varias a la vez.
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
