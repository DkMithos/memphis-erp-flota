/**
 * MEMPHIS VIAJES — app móvil (ruta /app, instalable como PWA; la misma SPA con
 * una cáscara para celular, sin el shell de escritorio).
 *
 * Pensada para el personal en viaje: mis viajes, solicitar uno, rendir con la
 * foto del comprobante, y para jefatura/Administración aprobar desde el celular.
 * Toda la información cae en las mismas tablas del ERP: no hay sincronización
 * aparte. Pantallas: /app (inicio) · /app/nuevo · /app/viaje/:id · /app/aprobar · /app/perfil.
 */
import { useEffect, useMemo, useState } from 'react';
import { Home, Plus, ClipboardCheck, User, Plane, Loader2, ChevronRight, LogOut, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { NuevoViajeForm } from '../modules/viajes/NuevoViajeForm';
import { ViajeDetalle } from '../modules/viajes/ViajeDetalle';
import { ESTADO_VIAJE, cargarRendiciones, cargarViajes, fechaCorta, pendientesDe, rangoFechas, soles, type Rendicion, type Viaje } from '../../lib/viajes/viajes';

type Pantalla = 'inicio' | 'nuevo' | 'viaje' | 'aprobar' | 'perfil';

function usarInstalacion() {
  const [evento, setEvento] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvento(e as Event & { prompt: () => Promise<void> }); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return { instalable: !!evento, instalar: async () => { await evento?.prompt(); setEvento(null); } };
}

export function AppMovil({ ruta, onNavigate }: { ruta: string; onNavigate: (r: string) => void }) {
  const { user, profile, signOut } = useAuth();
  const { can } = usePermissions();
  const puedeJefatura = can('viajes', 'aprobar');
  const puedeFinal = can('viajes', 'aprobar_final');
  const aprobador = puedeJefatura || puedeFinal;
  const { instalable, instalar } = usarInstalacion();

  const seg = ruta.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  const pantalla: Pantalla = seg[0] === 'nuevo' ? 'nuevo' : seg[0] === 'viaje' && seg[1] ? 'viaje' : seg[0] === 'aprobar' ? 'aprobar' : seg[0] === 'perfil' ? 'perfil' : 'inicio';
  const viajeId = pantalla === 'viaje' ? seg[1] : null;

  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([]);
  const [loading, setLoading] = useState(true);
  const cargar = async () => {
    setLoading(true);
    try { const [v, r] = await Promise.all([cargarViajes(), aprobador ? cargarRendiciones() : Promise.resolve([] as Rendicion[])]); setViajes(v); setRendiciones(r); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pantalla, aprobador]);

  const mios = useMemo(() => viajes.filter(v => v.solicitado_por === user?.id || (v.viajeros_nombres ?? '').length > 0 && !can('viajes', 'ver') || v.solicitado_por === user?.id), [viajes, user, can]);
  const pend = useMemo(() => pendientesDe(viajes, rendiciones, puedeJefatura, puedeFinal), [viajes, rendiciones, puedeJefatura, puedeFinal]);
  const nPend = pend.viajes.length + pend.rendiciones.length;
  const ir = (r: string) => onNavigate(r);

  const TarjetaViaje = ({ v }: { v: Viaje }) => (
    <button type="button" onClick={() => ir(`/app/viaje/${v.id}`)} className="w-full text-left rounded-xl border bg-card p-3 active:bg-accent">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{v.destino}</div>
        <Badge className={`text-xs ${ESTADO_VIAJE[v.estado].clase}`}>{ESTADO_VIAJE[v.estado].corto}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">{v.numero} · {rangoFechas(v.fecha_salida, v.fecha_retorno)}{v.proyecto_codigo ? ` · ${v.proyecto_codigo}` : ''}</div>
      <div className="text-sm mt-1 line-clamp-1">{v.motivo}</div>
      <div className="text-xs mt-1 flex justify-between"><span>{v.viajeros_nombres}</span><span>viáticos {soles(v.presupuesto_viaticos)}{Number(v.adelantos) > 0 ? ` · adel. ${soles(v.adelantos)}` : ''}</span></div>
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-lg mx-auto">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 border-b bg-[#1A1A1A] text-white">
        <button type="button" onClick={() => ir('/app')} className="flex items-center gap-2 font-semibold"><Plane className="size-5 text-[#D4A017]" /> Memphis Viajes</button>
        <div className="flex items-center gap-1">
          {instalable && <Button size="sm" variant="ghost" className="text-white" onClick={instalar} title="Instalar en el celular"><Download className="size-4" /></Button>}
          <Button size="sm" variant="ghost" className="text-white" onClick={cargar} title="Actualizar"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-3 pb-24">
        {pantalla === 'inicio' && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Hola, {profile?.nombre ?? user?.email}</div>
            <Button className="w-full h-12 text-base" onClick={() => ir('/app/nuevo')}><Plus className="size-5 mr-2" /> Solicitar viaje</Button>
            {aprobador && nPend > 0 && (
              <button type="button" onClick={() => ir('/app/aprobar')} className="w-full flex items-center justify-between rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-left">
                <span className="text-sm"><b>{nPend}</b> pendiente{nPend === 1 ? '' : 's'} de tu aprobación</span><ChevronRight className="size-4" />
              </button>
            )}
            <div className="text-sm font-medium pt-2">Mis viajes</div>
            {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Cargando…</div>}
            {!loading && mios.length === 0 && <div className="text-sm text-muted-foreground rounded-xl border p-4 text-center">Todavía no tienes viajes. Toca "Solicitar viaje".</div>}
            {mios.filter(v => !['cerrado', 'anulado', 'rechazado'].includes(v.estado)).map(v => <TarjetaViaje key={v.id} v={v} />)}
            {mios.some(v => ['cerrado', 'anulado', 'rechazado'].includes(v.estado)) && <details className="pt-2"><summary className="text-sm text-muted-foreground cursor-pointer">Viajes cerrados</summary><div className="space-y-2 pt-2">{mios.filter(v => ['cerrado', 'anulado', 'rechazado'].includes(v.estado)).slice(0, 20).map(v => <TarjetaViaje key={v.id} v={v} />)}</div></details>}
          </div>
        )}

        {pantalla === 'nuevo' && (
          <div className="space-y-3">
            <h1 className="text-lg font-bold">Solicitar viaje</h1>
            <p className="text-xs text-muted-foreground">Avisa con dos días de anticipación. Tu jefatura aprueba y luego Administración; te llega la aprobación aquí.</p>
            <NuevoViajeForm compacto onCreado={(id) => ir(`/app/viaje/${id}`)} onCancelar={() => ir('/app')} />
          </div>
        )}

        {pantalla === 'viaje' && viajeId && <ViajeDetalle viajeId={viajeId} modoApp onNavigate={onNavigate} />}

        {pantalla === 'aprobar' && (
          <div className="space-y-3">
            <h1 className="text-lg font-bold">Por aprobar</h1>
            {!aprobador && <div className="text-sm text-muted-foreground">Tu usuario no aprueba viajes.</div>}
            {aprobador && nPend === 0 && !loading && <div className="text-sm text-muted-foreground rounded-xl border p-4 text-center">Nada pendiente. 👍</div>}
            {pend.viajes.map(v => (
              <button key={v.id} type="button" onClick={() => ir(`/app/viaje/${v.id}`)} className="w-full text-left rounded-xl border p-3 active:bg-accent">
                <div className="flex justify-between"><b>Viaje {v.numero}</b><span className="text-xs">{v.estado === 'solicitado' ? 'jefatura' : 'Administración'}</span></div>
                <div className="text-sm">{v.destino} · {fechaCorta(v.fecha_salida)} · {v.viajeros_nombres}</div>
                <div className="text-xs text-muted-foreground">{v.motivo} · viáticos {soles(v.presupuesto_viaticos)}{v.tope_excedido ? ' · EXCEDE TARIFA' : ''}</div>
              </button>
            ))}
            {pend.rendiciones.map(r => (
              <button key={r.id} type="button" onClick={() => ir(`/app/viaje/${r.viaje_id}`)} className="w-full text-left rounded-xl border p-3 active:bg-accent">
                <div className="flex justify-between"><b>Rendición {r.numero}</b><span className="text-xs">{r.estado === 'presentada' ? 'jefatura' : 'Administración'}</span></div>
                <div className="text-sm">{r.viajero} · {r.viaje_numero} · {r.destino}</div>
                <div className="text-xs text-muted-foreground">gastado {soles(r.gastado)} · adelanto {soles(r.entregado)}{r.tope_excedido ? ' · EXCEDE TOPES' : ''}{Number(r.items_sin_sustento) > 0 ? ` · ${r.items_sin_sustento} sin sustento` : ''}</div>
              </button>
            ))}
          </div>
        )}

        {pantalla === 'perfil' && (
          <div className="space-y-3">
            <h1 className="text-lg font-bold">Mi cuenta</h1>
            <div className="rounded-xl border p-3 text-sm"><div className="font-medium">{profile?.nombre ?? '—'}</div><div className="text-muted-foreground">{user?.email}</div>
              <div className="text-xs text-muted-foreground mt-1">{puedeFinal ? 'Aprobación final (Administración)' : puedeJefatura ? 'Aprueba como jefatura' : 'Personal'}</div></div>
            {instalable && <Button className="w-full" variant="outline" onClick={instalar}><Download className="size-4 mr-2" /> Instalar la app en este celular</Button>}
            {!instalable && <div className="text-xs text-muted-foreground">Para instalarla: en Android, menú del navegador → "Agregar a pantalla de inicio"; en iPhone, Compartir → "Agregar a inicio".</div>}
            {can('viajes', 'ver') && <Button className="w-full" variant="outline" onClick={() => ir('/viajes')}>Ir al ERP de escritorio</Button>}
            <Button className="w-full" variant="destructive" onClick={() => signOut()}><LogOut className="size-4 mr-2" /> Cerrar sesión</Button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 border-t bg-background max-w-lg mx-auto grid grid-cols-4 text-xs">
        {([['inicio', 'Inicio', Home, '/app'], ['nuevo', 'Solicitar', Plus, '/app/nuevo'], ['aprobar', 'Aprobar', ClipboardCheck, '/app/aprobar'], ['perfil', 'Cuenta', User, '/app/perfil']] as const).map(([k, label, Icon, r]) => (
          <button key={k} type="button" onClick={() => ir(r)} className={`flex flex-col items-center justify-center gap-0.5 py-2 relative ${pantalla === k ? 'text-[#D4A017]' : 'text-muted-foreground'}`}>
            <Icon className="size-5" />{label}
            {k === 'aprobar' && nPend > 0 && <span className="absolute top-1 right-6 rounded-full bg-red-600 text-white text-[10px] px-1.5">{nPend}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
