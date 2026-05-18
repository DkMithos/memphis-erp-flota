/**
 * Memphis ERP — BiomedicoContratos
 * Lista de contratos de servicio de equipos biomédicos.
 * Cubre: garantías OEM, mantenimiento preventivo, correctivo, SLA, integral.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, AlertTriangle, CheckCircle2,
  XCircle, Clock, Filter, ChevronDown, Shield, Zap,
  Edit, Trash2, RefreshCw
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import {
  useContratosBioStore,
  TIPO_CONTRATO_LABELS,
  ESTADO_CONTRATO_LABELS,
  ESTADO_CONTRATO_COLORS,
  type TipoContratoBio,
  type EstadoContratoBio,
  type ContratoBio,
} from '../../../lib/biomedico/contratos-bio-store';

interface BiomedicoContratosProps {
  onNavigate: (route: string) => void;
}

const TIPOS_FILTRO: Array<{ value: TipoContratoBio | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'garantia', label: 'Garantía' },
  { value: 'mantenimiento_preventivo', label: 'Mant. Preventivo' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'sla', label: 'SLA' },
  { value: 'oem', label: 'OEM' },
  { value: 'integral', label: 'Integral' },
];

const ESTADOS_FILTRO: Array<{ value: EstadoContratoBio | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'activo', label: 'Activo' },
  { value: 'en_renovacion', label: 'En Renovación' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'borrador', label: 'Borrador' },
];

function formatFecha(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoneda(valor: number | null, moneda: string): string {
  if (valor === null) return '—';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
  }).format(valor);
}

function AlertaBadge({ contrato }: { contrato: ContratoBio }) {
  if (!contrato.vigente) return null;
  if (contrato.diasParaVencer === null) return null;
  if (contrato.diasParaVencer <= 15) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
        <AlertTriangle className="size-3" />
        Vence en {contrato.diasParaVencer}d
      </span>
    );
  }
  if (contrato.diasParaVencer <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
        <Clock className="size-3" />
        Vence en {contrato.diasParaVencer}d
      </span>
    );
  }
  return null;
}

export function BiomedicoContratos({ onNavigate }: BiomedicoContratosProps) {
  const { contratos, loading, error, actualizarEstado, eliminarContrato, recargar } =
    useContratosBioStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoContratoBio | 'todos'>('todos');
  const [filtroEstado, setFiltroEstado] = useState<EstadoContratoBio | 'todos'>('todos');
  const [confirmDelete, setConfirmDelete] = useState<ContratoBio | null>(null);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activos = contratos.filter(c => c.estado === 'activo');
    const porVencer = contratos.filter(
      c => c.vigente && c.diasParaVencer !== null && c.diasParaVencer <= 30,
    );
    const vencidos = contratos.filter(c => c.estado === 'vencido');
    const valorTotal = activos.reduce((s, c) => s + (c.valorContrato ?? 0), 0);
    return { activos: activos.length, porVencer: porVencer.length, vencidos: vencidos.length, valorTotal };
  }, [contratos]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const contratosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return contratos.filter(c => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      if (q && !c.id.toLowerCase().includes(q) &&
          !c.equipoNombre.toLowerCase().includes(q) &&
          !c.equipoId.toLowerCase().includes(q) &&
          !c.proveedorNombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contratos, busqueda, filtroTipo, filtroEstado]);

  const handleDelete = async (contrato: ContratoBio) => {
    const result = await eliminarContrato(contrato._dbId);
    if (!result.ok) toast.error(`Error: ${result.error}`);
    setConfirmDelete(null);
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <XCircle className="size-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={recargar}>
          <RefreshCw className="size-4" /> Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contratos de Servicio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Garantías, SLA y contratos de mantenimiento de equipos biomédicos
          </p>
        </div>
        <Button onClick={() => onNavigate('/biomedico/contratos/nuevo')} className="gap-2 shrink-0">
          <Plus className="size-4" />
          Nuevo Contrato
        </Button>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Contratos activos',
            value: kpis.activos,
            icon: CheckCircle2,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
          },
          {
            label: 'Por vencer (≤30d)',
            value: kpis.porVencer,
            icon: AlertTriangle,
            color: kpis.porVencer > 0 ? 'text-amber-500' : 'text-muted-foreground',
            bg: kpis.porVencer > 0 ? 'bg-amber-500/10' : 'bg-muted/50',
          },
          {
            label: 'Vencidos',
            value: kpis.vencidos,
            icon: XCircle,
            color: kpis.vencidos > 0 ? 'text-red-500' : 'text-muted-foreground',
            bg: kpis.vencidos > 0 ? 'bg-red-500/10' : 'bg-muted/50',
          },
          {
            label: 'Valor total activos',
            value: formatMoneda(kpis.valorTotal, 'PEN'),
            icon: Shield,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
          },
        ].map(k => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}>
                <k.icon className={`size-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{loading ? '—' : k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por N°, equipo o proveedor..."
                className="pl-9"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <select
                  className="pl-8 pr-8 py-2 text-sm rounded-md border border-input bg-background appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value as TipoContratoBio | 'todos')}
                >
                  {TIPOS_FILTRO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  className="pl-3 pr-8 py-2 text-sm rounded-md border border-input bg-background appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value as EstadoContratoBio | 'todos')}
                >
                  {ESTADOS_FILTRO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {loading ? 'Cargando...' : `${contratosFiltrados.length} contrato(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando contratos...</div>
          ) : contratosFiltrados.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay contratos{busqueda || filtroTipo !== 'todos' || filtroEstado !== 'todos' ? ' que coincidan con los filtros' : ' registrados'}.</p>
              {!busqueda && filtroTipo === 'todos' && filtroEstado === 'todos' && (
                <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => onNavigate('/biomedico/contratos/nuevo')}>
                  <Plus className="size-4" /> Registrar primer contrato
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Contrato</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Equipo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Proveedor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vigencia</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Valor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">SLA</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.map(c => (
                    <tr key={c._dbId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-xs">{c.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.equipoNombre || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.equipoId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {TIPO_CONTRATO_LABELS[c.tipo]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">
                        {c.proveedorNombre || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Desde: </span>{formatFecha(c.fechaInicio)}
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Hasta: </span>{formatFecha(c.fechaFin)}
                        </div>
                        <AlertaBadge contrato={c} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatMoneda(c.valorContrato, c.moneda)}
                      </td>
                      <td className="px-4 py-3">
                        {(c.tipo === 'sla' || c.tipo === 'integral') && c.sla.tiempoRespuestaHrs ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <Zap className="size-3" />
                            {c.sla.tiempoRespuestaHrs}h
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${ESTADO_CONTRATO_COLORS[c.estado]}`}
                        >
                          {ESTADO_CONTRATO_LABELS[c.estado]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.estado === 'vencido' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-amber-500 hover:text-amber-600"
                              title="Marcar en renovación"
                              onClick={() => actualizarEstado(c.id, 'en_renovacion')}
                            >
                              <RefreshCw className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Editar"
                            onClick={() => onNavigate(`/biomedico/contratos/${c.id}/editar`)}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            title="Eliminar"
                            onClick={() => setConfirmDelete(c)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Confirm delete modal ────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <Trash2 className="size-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">¿Eliminar contrato?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Se eliminará <strong>{confirmDelete.id}</strong> — {TIPO_CONTRATO_LABELS[confirmDelete.tipo]} de {confirmDelete.equipoNombre || confirmDelete.equipoId}.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(confirmDelete)}>
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
