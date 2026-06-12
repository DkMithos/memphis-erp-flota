/**
 * CRM Dashboard — KPIs, Pipeline Kanban, Actividades pendientes
 */

import { useMemo, useState, type CSSProperties } from 'react';
import { useDarkMode } from '../../../hooks/useDarkMode';
import {
  Users, Target, DollarSign, CalendarClock,
  Phone, Mail, MapPin, Users2, FileText, ArrowRight, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useCRMStore, type Oportunidad } from '../../../lib/crm/crm-store';
import { convertirAMonedaBase, formatMontoBase } from '../../../lib/shared/currency-utils';
import { toast } from 'sonner';

// ── Etapa config ────────────────────────────────────────────────────────────

const ETAPAS: { key: Oportunidad['etapa']; label: string; color: string }[] = [
  { key: 'prospecto',       label: 'Prospecto',     color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { key: 'calificado',      label: 'Calificado',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
  { key: 'propuesta',       label: 'Propuesta',     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200' },
  { key: 'negociacion',     label: 'Negociación',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'cerrado_ganado',  label: 'Ganado',        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' },
  { key: 'cerrado_perdido', label: 'Perdido',       color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
];

const ACTIVE_ETAPAS: Oportunidad['etapa'][] = ['prospecto', 'calificado', 'propuesta', 'negociacion'];

const TIPO_ACTIVIDAD_ICON: Record<string, React.ReactNode> = {
  llamada:    <Phone className="size-3.5" />,
  reunion:    <Users2 className="size-3.5" />,
  email:      <Mail className="size-3.5" />,
  visita:     <MapPin className="size-3.5" />,
  propuesta:  <FileText className="size-3.5" />,
  seguimiento:<ArrowRight className="size-3.5" />,
  otro:       <CalendarClock className="size-3.5" />,
};

interface Props {
  onNavigate?: (route: string) => void;
}

export function CRMDashboard({ onNavigate }: Props) {
  const { clientes, oportunidades, actividades, actualizarOportunidad } = useCRMStore();

  // ── Cards tipo "Acceso Rápido" (patrón Home) ──
  const isDark = useDarkMode();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const quickCardStyle = (isHovered: boolean): CSSProperties => {
    const accentColor = isDark ? '#f0c000' : '#000000';
    return {
      borderTopWidth: (isDark && !isHovered) ? 0 : 1,
      borderTopStyle: 'solid',
      borderTopColor: isHovered ? accentColor : '#64748B',
      borderRightWidth: (isDark && !isHovered) ? 0 : 1,
      borderRightStyle: 'solid',
      borderRightColor: isHovered ? accentColor : '#64748B',
      borderBottomWidth: (isDark && !isHovered) ? 0 : 1,
      borderBottomStyle: 'solid',
      borderBottomColor: isHovered ? accentColor : '#64748B',
      borderLeftWidth: 4,
      borderLeftStyle: 'solid',
      borderLeftColor: accentColor,
      backgroundColor: isDark ? undefined : (isHovered ? '#94A3B8' : '#E2E8F0'),
    };
  };

  // ── KPIs ────────────────────────────────────────────────────────────────
  const clientesActivos = clientes.filter(c => c.estado === 'activo').length;
  const oportunidadesAbiertas = oportunidades.filter(o => ACTIVE_ETAPAS.includes(o.etapa));
  const valorPipelineTotal = oportunidadesAbiertas.reduce((s, o) => s + convertirAMonedaBase(o.valorPonderado ?? 0, o.moneda), 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
  const actividadesPendientesHoy = actividades.filter(a => {
    if (a.estado !== 'pendiente') return false;
    const fp = new Date(a.fechaProgramada);
    return fp >= hoy && fp < manana;
  });

  // ── Pipeline por etapas (solo activas) ──────────────────────────────────
  const pipelineByEtapa = useMemo(() => {
    const map = new Map<Oportunidad['etapa'], Oportunidad[]>();
    ACTIVE_ETAPAS.forEach(e => map.set(e, []));
    oportunidadesAbiertas.forEach(o => {
      const list = map.get(o.etapa);
      if (list) list.push(o);
    });
    return map;
  }, [oportunidadesAbiertas]);

  const handleMoverEtapa = async (oportunidad: Oportunidad) => {
    const idx = ACTIVE_ETAPAS.indexOf(oportunidad.etapa);
    if (idx === -1 || idx >= ACTIVE_ETAPAS.length - 1) return;
    const nuevaEtapa = ACTIVE_ETAPAS[idx + 1];
    const { exito } = await actualizarOportunidad(oportunidad._dbId, {
      etapa: nuevaEtapa,
      probabilidad: nuevaEtapa === 'calificado' ? 25
        : nuevaEtapa === 'propuesta' ? 50
        : nuevaEtapa === 'negociacion' ? 75
        : oportunidad.probabilidad,
    });
    if (exito) toast.success(`"${oportunidad.titulo}" movida a ${ETAPAS.find(e => e.key === nuevaEtapa)?.label}`);
    else toast.error('No se pudo mover la oportunidad');
  };

  // ── Próximas actividades pendientes ──────────────────────────────────────
  const proximasActividades = actividades
    .filter(a => a.estado === 'pendiente')
    .sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">CRM — Gestión de Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">Pipeline de ventas y relaciones con clientes</p>
        </div>
        <Button onClick={() => onNavigate?.('/crm/clientes')}>
          <Users className="size-4" /> Ver Clientes
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Users className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Clientes Activos</p>
              <p className="text-2xl font-bold">{clientesActivos}</p>
              <p className="text-xs text-muted-foreground mt-1">{clientes.filter(c => c.estado === 'prospecto').length} prospectos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <Target className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Oportunidades Abiertas</p>
              <p className="text-2xl font-bold">{oportunidadesAbiertas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">En pipeline activo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Valor Pipeline</p>
              <p className="text-2xl font-bold">{formatMontoBase(valorPipelineTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Valor ponderado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
              <CalendarClock className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Actividades Hoy</p>
              <p className="text-2xl font-bold">{actividadesPendientesHoy.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Pendientes para hoy</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Kanban */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline de Oportunidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {ACTIVE_ETAPAS.map(etapa => {
              const cfg = ETAPAS.find(e => e.key === etapa)!;
              const opsList = pipelineByEtapa.get(etapa) ?? [];
              const valorEtapa = opsList.reduce((s, o) => s + convertirAMonedaBase(o.montoEstimado ?? 0, o.moneda), 0);
              return (
                <div key={etapa} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground">{opsList.length}</span>
                  </div>
                  {valorEtapa > 0 && (
                    <p className="text-xs text-muted-foreground mb-1">{formatMontoBase(valorEtapa)}</p>
                  )}
                  <div className="flex flex-col gap-2 min-h-[80px]">
                    {opsList.length === 0 && (
                      <div className="border-2 border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground">
                        Sin oportunidades
                      </div>
                    )}
                    {opsList.map(o => (
                      <div key={o._dbId} className="border rounded-lg p-3 bg-card shadow-sm space-y-1.5">
                        <p className="text-xs font-medium leading-tight">{o.titulo}</p>
                        <p className="text-xs text-muted-foreground">{o.clienteNombre}</p>
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          {o.montoEstimado && (
                            <span className="text-xs font-semibold">S/ {o.montoEstimado.toLocaleString()}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{o.probabilidad}%</span>
                        </div>
                        {etapa !== 'negociacion' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-6 text-xs mt-1 px-1 hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground"
                            onClick={() => handleMoverEtapa(o)}
                          >
                            Mover a siguiente <ArrowRight className="size-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Próximas actividades */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Actividades Pendientes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/crm/actividades')} className="hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground">
            Ver todas
          </Button>
        </CardHeader>
        <CardContent>
          {proximasActividades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay actividades pendientes</p>
          ) : (
            <div className="space-y-2">
              {proximasActividades.map(a => {
                const fecha = new Date(a.fechaProgramada);
                const esHoy = fecha >= hoy && fecha < manana;
                return (
                  <div key={a._dbId} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex-shrink-0 text-muted-foreground">
                      {TIPO_ACTIVIDAD_ICON[a.tipo] ?? <CalendarClock className="size-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground">{a.clienteNombre}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge
                        className={`text-xs ${esHoy ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                      >
                        {esHoy ? 'Hoy' : fecha.toLocaleDateString('es-PE', { month: 'short', day: 'numeric' })}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Gestionar Clientes', icon: Users, route: '/crm/clientes', desc: `${clientes.length} registros`, box: 'bg-blue-500' },
          { label: 'Ver Oportunidades', icon: Target, route: '/crm/oportunidades', desc: `${oportunidades.length} en total`, box: 'bg-indigo-500' },
          { label: 'Ver Actividades', icon: CheckCircle2, route: '/crm/actividades', desc: `${actividades.filter(a => a.estado === 'pendiente').length} pendientes`, box: 'bg-green-500' },
        ].map(item => {
          const isHovered = hoveredCard === item.route;
          const accentColor = isDark ? '#f0c000' : '#000000';
          return (
            <button
              key={item.route}
              onClick={() => onNavigate?.(item.route)}
              onMouseEnter={() => setHoveredCard(item.route)}
              onMouseLeave={() => setHoveredCard(null)}
              className="group text-left rounded-xl dark:bg-card p-4 hover:shadow-md dark:hover:bg-accent/30 transition-all relative"
              style={quickCardStyle(isHovered)}
            >
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${item.box} text-white group-hover:!bg-black group-hover:!text-white transition-colors`}>
                  <item.icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{item.desc}</p>
                </div>
                <ChevronRight className="size-4 shrink-0" style={{ color: accentColor }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
