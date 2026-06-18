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

// Actividad reciente estática (se reemplazará con datos reales en Sprint futuro)
const ACTIVIDAD_RECIENTE = [
  { tipo: 'success', texto: 'Mantenimiento completado — VEH-2024-001', tiempo: 'Hace 2h' },
  { tipo: 'warning', texto: 'Stock crítico — Filtro de aceite (3 unidades)', tiempo: 'Hace 4h' },
  { tipo: 'info',    texto: 'Proveedor PROV-0012 en evaluación', tiempo: 'Hace 5h' },
  { tipo: 'success', texto: 'OC-2024-089 recibida completa', tiempo: 'Ayer' },
  { tipo: 'warning', texto: 'SOAT vence en 15 días — VEH-2024-007', tiempo: 'Ayer' },
];

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
            { label: 'Módulos activos', value: '10', icon: Activity, color: 'text-white', bg: 'bg-blue-500', accent: 'border-l-blue-500' },
            { label: 'Alertas pendientes', value: '3', icon: Bell, color: 'text-white', bg: 'bg-red-500', accent: 'border-l-red-500' },
            { label: 'Tareas del día', value: '5', icon: CheckCircle2, color: 'text-white', bg: 'bg-green-500', accent: 'border-l-green-500' },
            { label: 'Tendencia', value: '+12%', icon: TrendingUp, color: 'text-white', bg: 'bg-emerald-500', accent: 'border-l-emerald-500' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3"
              style={{ border: '1px solid #64748B' }}
            >
              <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
              </div>
            </div>
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
          {QUICK_ACCESS.map((item) => {
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
            {ACTIVIDAD_RECIENTE.map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 shrink-0">
                  {item.tipo === 'success' && <CheckCircle2 className="size-4 text-green-500" />}
                  {item.tipo === 'warning' && <AlertTriangle className="size-4 text-amber-500" />}
                  {item.tipo === 'info'    && <Bell className="size-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground leading-snug">{item.texto}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.tiempo}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm" style={{ border: '1px solid #64748B' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Estado del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Base de datos', estado: 'Operativo', ok: true },
              { label: 'Sincronización GPS', estado: 'Activo', ok: true },
              { label: 'API SUNAT', estado: 'Disponible', ok: true },
              { label: 'Notificaciones', estado: 'En configuración', ok: false },
              { label: 'Backup automático', estado: 'Programado', ok: true },
            ].map((s) => (
              <div key={s.label} className="grid grid-cols-[1fr_160px] gap-3 items-center text-sm">
                <span className="text-foreground">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`inline-block size-2 rounded-full shrink-0 ${s.ok ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                  <span className="text-foreground font-medium">{s.estado}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
