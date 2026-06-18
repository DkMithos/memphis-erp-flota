/**
 * Memphis ERP — Dashboard Principal
 * Resumen ejecutivo con datos reales desde Supabase
 */
import { useEffect, useState } from 'react';
import {
  Truck,
  ShoppingCart,
  Package,
  AlertTriangle,
  FolderKanban,
  DollarSign,
  Stethoscope,
  ArrowRight,
  Loader2,
  Activity,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { useDarkMode } from '../../hooks/useDarkMode';

interface DashboardProps {
  onNavigate?: (route: string) => void;
}

interface DashboardKPIs {
  vehiculosActivos: number;
  vehiculosTotal: number;
  otsPendientes: number;
  equiposBio: number;
  proyectosActivos: number;
  proveedoresActivos: number;
  ordenesCompraPendientes: number;
  requerimientosPendientes: number;
}

interface ProyectoResumen {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  porcentajeAvance: number;
  presupuesto: number;
  costoReal: number;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDark = useDarkMode();
  const [kpis, setKpis] = useState<DashboardKPIs>({
    vehiculosActivos: 0, vehiculosTotal: 0, otsPendientes: 0,
    equiposBio: 0, proyectosActivos: 0, proveedoresActivos: 0,
    ordenesCompraPendientes: 0, requerimientosPendientes: 0,
  });
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const cargar = async () => {
      setLoading(true);
      try {
        // Parallel queries for all KPIs
        const [
          vehRes, otsRes, eqRes, proyRes, provRes, ocRes, reqRes
        ] = await Promise.all([
          supabase.from('vehiculos').select('estado', { count: 'exact', head: false }),
          supabase.from('ordenes_trabajo').select('id', { count: 'exact', head: true }).in('estado', ['abierta', 'en_progreso', 'pendiente']),
          supabase.from('equipos_biomedicos').select('id', { count: 'exact', head: true }),
          supabase.from('proyectos').select('id, codigo, nombre, estado, porcentaje_avance, presupuesto, costo_real').order('creado_en', { ascending: false }).limit(5),
          supabase.from('proveedores').select('id', { count: 'exact', head: true }).eq('estado', 'activo'),
          supabase.from('ordenes_compra').select('id', { count: 'exact', head: true }).in('estado', ['borrador', 'pendiente', 'aprobada']),
          supabase.from('requerimientos_compra').select('id', { count: 'exact', head: true }).in('estado', ['borrador', 'pendiente', 'aprobado']),
        ]);

        const vehiculos = vehRes.data ?? [];
        const vehiculosActivos = vehiculos.filter((v: any) => v.estado === 'activo').length;

        setKpis({
          vehiculosActivos,
          vehiculosTotal: vehiculos.length,
          otsPendientes: otsRes.count ?? 0,
          equiposBio: eqRes.count ?? 0,
          proyectosActivos: (proyRes.data ?? []).filter((p: any) => p.estado === 'en_ejecucion' || p.estado === 'planificacion').length,
          proveedoresActivos: provRes.count ?? 0,
          ordenesCompraPendientes: ocRes.count ?? 0,
          requerimientosPendientes: reqRes.count ?? 0,
        });

        setProyectos((proyRes.data ?? []).map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          estado: p.estado,
          porcentajeAvance: p.porcentaje_avance ?? 0,
          presupuesto: p.presupuesto ?? 0,
          costoReal: p.costo_real ?? 0,
        })));
      } catch (e) {
        console.error('[Dashboard] Error cargando KPIs:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [tenantId]);

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      en_ejecucion: 'En Ejecución',
      planificacion: 'Planificación',
      completado: 'Completado',
      cancelado: 'Cancelado',
      suspendido: 'Suspendido',
    };
    return map[estado] ?? estado;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard General</h1>
        <p className="text-muted-foreground">Resumen ejecutivo del sistema</p>
      </div>

      {/* Nav Cards — mismo patrón que Accesos Rápidos del Home */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'flota', label: 'Flota Vehicular', icon: Truck, route: '/flota', value: kpis.vehiculosActivos, sub: `vehículos activos de ${kpis.vehiculosTotal} total`, color: 'bg-blue-500 text-white' },
          { id: 'ots', label: 'OTs Pendientes', icon: Activity, route: '/flota/mantenimientos', value: kpis.otsPendientes, sub: 'órdenes de trabajo abiertas', color: 'bg-orange-500 text-white' },
          { id: 'proyectos', label: 'Proyectos Activos', icon: FolderKanban, route: '/proyectos', value: kpis.proyectosActivos, sub: 'en ejecución o planificación', color: 'bg-green-500 text-white' },
          { id: 'biomedico', label: 'Equipos Biomédicos', icon: Stethoscope, route: '/biomedico', value: kpis.equiposBio, sub: 'equipos registrados', color: 'bg-purple-500 text-white' },
          { id: 'oc', label: 'OC Pendientes', icon: ShoppingCart, route: '/compras', value: kpis.ordenesCompraPendientes, sub: 'órdenes de compra por procesar', color: 'bg-cyan-500 text-white' },
          { id: 'req', label: 'Requerimientos', icon: Package, route: '/compras/requerimientos', value: kpis.requerimientosPendientes, sub: 'pendientes de atención', color: 'bg-indigo-500 text-white' },
          { id: 'prov', label: 'Proveedores', icon: Users, route: '/proveedores', value: kpis.proveedoresActivos, sub: 'proveedores activos', color: 'bg-emerald-500 text-white' },
          { id: 'alertas', label: 'Alertas', icon: AlertTriangle, route: '/flota/mantenimientos', value: kpis.otsPendientes > 0 ? kpis.otsPendientes : '—', sub: 'requieren atención', color: 'bg-amber-500 text-white' },
        ].map((card) => {
          const accentColor = isDark ? '#f0c000' : '#000000';
          const isHovered = hoveredId === card.id;
          const bgColor = isDark
            ? undefined
            : (isHovered ? '#94A3B8' : '#E2E8F0');
          return (
            <button
              key={card.id}
              onClick={() => onNavigate?.(card.route)}
              onMouseEnter={() => setHoveredId(card.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all relative"
              style={{
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderTopColor: isHovered ? accentColor : '#64748B',
                borderRightWidth: '1px',
                borderRightStyle: 'solid',
                borderRightColor: isHovered ? accentColor : '#64748B',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: isHovered ? accentColor : '#64748B',
                borderLeftWidth: '4px',
                borderLeftStyle: 'solid',
                borderLeftColor: accentColor,
                backgroundColor: bgColor,
              }}
            >
              <ChevronRight className="size-4 absolute top-3 right-3" style={{ color: accentColor }} />
              <div className={`size-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${card.color} group-hover:!bg-black group-hover:!text-white`}>
                <card.icon className="size-5" />
              </div>
              <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                {card.label}
              </p>
              <p className="text-2xl font-bold leading-none mt-1 text-foreground">
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground mt-1 line-clamp-1 transition-colors">
                {card.sub}
              </p>
            </button>
          );
        })}
      </div>

      {/* Proyectos recientes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Proyectos Recientes</CardTitle>
          <Button size="sm" onClick={() => onNavigate?.('/proyectos/lista')} className="bg-[#f0c000] text-black hover:bg-[#d4a800]">
            Ver todos <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {proyectos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay proyectos registrados aún.
            </p>
          ) : (
            <div className="space-y-5">
              {proyectos.map((p) => (
                <div
                  key={p.id}
                  className="space-y-2 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => onNavigate?.(`/proyectos/detalle/${p.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{p.nombre}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.codigo}
                        {p.presupuesto > 0 && (
                          <> · S/ {p.costoReal.toLocaleString('es-PE', { minimumFractionDigits: 0 })} de S/ {p.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</>
                        )}
                      </p>
                    </div>
                    <Badge variant={p.estado === 'en_ejecucion' ? 'default' : 'secondary'}>
                      {estadoBadge(p.estado)}
                    </Badge>
                  </div>
                  <Progress value={p.porcentajeAvance} className="h-2" />
                  <p className="text-xs text-muted-foreground">{p.porcentajeAvance}% completado</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
