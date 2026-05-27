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
  ArrowUpRight,
  Loader2,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../auth/AuthProvider';

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/flota')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Flota Vehicular</CardTitle>
            <Truck className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.vehiculosActivos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              vehículos activos de {kpis.vehiculosTotal} total
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/flota/mantenimientos')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">OTs Pendientes</CardTitle>
            <Activity className="size-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.otsPendientes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              órdenes de trabajo abiertas
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/proyectos')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proyectos Activos</CardTitle>
            <FolderKanban className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.proyectosActivos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              en ejecución o planificación
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/biomedico')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Equipos Biomédicos</CardTitle>
            <Stethoscope className="size-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.equiposBio}</div>
            <p className="text-xs text-muted-foreground mt-1">
              equipos registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/compras')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">OC Pendientes</CardTitle>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.ordenesCompraPendientes}</div>
            <p className="text-xs text-muted-foreground mt-1">órdenes de compra por procesar</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/compras/requerimientos')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Requerimientos</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.requerimientosPendientes}</div>
            <p className="text-xs text-muted-foreground mt-1">pendientes de atención</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate?.('/proveedores')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proveedores</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.proveedoresActivos}</div>
            <p className="text-xs text-muted-foreground mt-1">proveedores activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Alertas</CardTitle>
            <AlertTriangle className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{kpis.otsPendientes > 0 ? kpis.otsPendientes : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">requieren atención</p>
          </CardContent>
        </Card>
      </div>

      {/* Proyectos recientes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Proyectos Recientes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/proyectos/lista')}>
            Ver todos
            <ArrowUpRight className="size-4 ml-1" />
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
