/**
 * Memphis ERP — HomeWelcome
 * Página de bienvenida mostrada al iniciar sesión.
 * Punto de entrada al sistema: saludo, accesos rápidos y actividad reciente.
 */
import { useMemo, useState } from 'react';
import {
  Truck, Activity, ShoppingCart, Package, DollarSign,
  FolderKanban, Users, BarChart3, ArrowRight, Stethoscope,
  TrendingUp, Bell, CheckCircle2, Clock, AlertTriangle, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth } from '../../auth/AuthProvider';
import { MemphisIconSVG, PLATFORM } from '../../lib/config/branding';
import { useDarkMode } from '../../hooks/useDarkMode';
import { usePermissions } from '../../lib/rbac/usePermissions';
import { puedeVerRuta } from '../../lib/rbac/rutas';
import { isModuleEnabled } from '../../lib/config/modules-config';
import { useResumenHome } from '../../lib/shared/useResumenHome';
import { useNotifications } from '../../lib/shared/useNotifications';

interface HomeWelcomeProps {
  onNavigate: (route: string) => void;
}

const QUICK_ACCESS = [
  {
    id: 'flota',
    label: 'Flota',
    desc: 'Vehículos y mantenimientos',
    icon: Truck,
    route: '/flota',
    color: 'bg-blue-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'biomedico',
    label: 'Biomédico',
    desc: 'Equipos y servicios',
    icon: Stethoscope,
    route: '/biomedico',
    color: 'bg-purple-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'compras',
    label: 'Compras',
    desc: 'Órdenes y requerimientos',
    icon: ShoppingCart,
    route: '/compras',
    color: 'bg-orange-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'proveedores',
    label: 'Proveedores',
    desc: 'Directorio y evaluaciones',
    icon: Users,
    route: '/proveedores/directorio',
    color: 'bg-emerald-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'inventario',
    label: 'Inventario',
    desc: 'Artículos y almacenes',
    icon: Package,
    route: '/inventario',
    color: 'bg-amber-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    desc: 'Transacciones y presupuestos',
    icon: DollarSign,
    route: '/finanzas',
    color: 'bg-green-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'proyectos',
    label: 'Proyectos',
    desc: 'Gestión de proyectos',
    icon: FolderKanban,
    route: '/proyectos',
    color: 'bg-indigo-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
  {
    id: 'bi',
    label: 'BI & Reportes',
    desc: 'Análisis e indicadores',
    icon: BarChart3,
    route: '/bi',
    color: 'bg-rose-500 text-white group-hover:!bg-black group-hover:!text-white transition-colors',
  },
];


/** "Hace 2 h", "Ayer", "12 ago" — sin librerías extra. */
function tiempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'Recién';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  if (h < 48) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomeWelcome({ onNavigate }: HomeWelcomeProps) {
  const { profile, tenantName } = useAuth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDark = useDarkMode();
  const { can, loading: permisosLoading } = usePermissions();
  const { indicadores } = useResumenHome();
  const { notificaciones, noLeidas } = useNotifications();

  // Solo los accesos que el usuario puede abrir y cuyo módulo está encendido.
  const accesos = useMemo(
    () => QUICK_ACCESS.filter(a => isModuleEnabled(a.id) && puedeVerRuta(a.route, can)),
    [can],
  );

  const firstName = useMemo(() => {
    const nombre = profile?.nombre ?? '';
    return nombre.split(' ')[0] || 'Usuario';
  }, [profile]);

  const today = useMemo(() => {
    return new Date().toLocaleDateString('es-PE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }, []);

  return (
    <div className="space-y-6 pb-8">

      {/* ── Hero de bienvenida ── */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="size-4" />
              <span className="capitalize">{today}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-muted-foreground">
              Bienvenido a <strong>{tenantName ?? PLATFORM.name}</strong>.
              ¿En qué módulo trabajamos hoy?
            </p>
          </div>

        </div>

        {/* Stats rápidos */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ...indicadores.map(i => ({
              label: i.label, value: i.valor, icon: Activity,
              color: 'text-white', bg: 'bg-blue-500', ruta: i.ruta,
            })),
            {
              label: 'Notificaciones sin leer', value: String(noLeidas),
              icon: Bell, color: 'text-white',
              bg: noLeidas > 0 ? 'bg-red-500' : 'bg-slate-400', ruta: '/notificaciones',
            },
          ].slice(0, 4).map((stat) => (
            <button
              key={stat.label}
              onClick={() => stat.ruta && onNavigate(stat.ruta)}
              className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
              style={{ border: '1px solid #64748B' }}
            >
              <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Accesos rápidos ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Accesos Rápidos</h2>
          <Button size="sm" onClick={() => onNavigate('/dashboard')} className="bg-[#f0c000] text-black hover:bg-[#d4a800]">
            Ver dashboard <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {accesos.map((item) => {
            const accentColor = isDark ? '#f0c000' : '#000000';
            const isHovered = hoveredId === item.id;
            const bgColor = isDark
              ? undefined  // dark mode uses Tailwind classes
              : (isHovered ? '#94A3B8' : '#E2E8F0');
            return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.route)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all relative"
              style={{
                borderTopWidth: (isDark && !isHovered) ? '0' : '1px',
                borderTopStyle: 'solid',
                borderTopColor: isHovered ? accentColor : '#64748B',
                borderRightWidth: (isDark && !isHovered) ? '0' : '1px',
                borderRightStyle: 'solid',
                borderRightColor: isHovered ? accentColor : '#64748B',
                borderBottomWidth: (isDark && !isHovered) ? '0' : '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: isHovered ? accentColor : '#64748B',
                borderLeftWidth: '4px',
                borderLeftStyle: 'solid',
                borderLeftColor: accentColor,
                backgroundColor: bgColor,
              }}
            >
              <ChevronRight className="size-4 absolute top-3 right-3" style={{ color: accentColor }} />
              <div className={`size-10 rounded-lg flex items-center justify-center mb-3 ${item.color}`}>
                <item.icon className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground transition-colors">
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground mt-0.5 line-clamp-1 transition-colors">{item.desc}</p>
            </button>
            );
          })}
        </div>
      </div>

      {/* ── Actividad reciente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card shadow-sm" style={{ border: '1px solid #64748B' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notificaciones.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No tienes actividad reciente.
              </p>
            )}
            {notificaciones.slice(0, 5).map((n) => (
              <div key={n.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 shrink-0">
                  {n.tipo === 'success' && <CheckCircle2 className="size-4 text-green-500" />}
                  {(n.tipo === 'warning' || n.tipo === 'error') && <AlertTriangle className="size-4 text-amber-500" />}
                  {n.tipo === 'info' && <Bell className="size-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`leading-snug ${n.leida ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                    {n.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tiempoRelativo(n.creadoEn)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm" style={{ border: '1px solid #64748B' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Tu acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {permisosLoading && (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            )}
            {!permisosLoading && accesos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tu rol todavía no tiene módulos asignados. Escríbele al administrador.
              </p>
            )}
            {!permisosLoading && accesos.map((a) => (
              <button
                key={a.id}
                onClick={() => onNavigate(a.route)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 text-left text-sm hover:text-primary"
              >
                <span className="text-foreground">{a.label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
