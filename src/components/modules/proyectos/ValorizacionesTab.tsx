/**
 * ValorizacionesTab — Hitos de facturación y conformidad por proyecto
 * Se integra como tab en ProyectoDetalle
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileCheck, DollarSign, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { dbValorizaciones } from '../../../lib/supabase/helpers';
import type { ValorizacionDB } from '../../../lib/supabase/types';
import type { Fase } from '../../../lib/proyectos/proyectos-store';
import { toast } from 'sonner';

// ── Tipos ────────────────────────────────────────────────

interface Valorizacion {
  _dbId: string;
  numero: number;
  descripcion: string;
  monto: number;
  moneda: string;
  estado: ValorizacionDB['estado'];
  faseId?: string;
  fechaPresentacion?: string;
  fechaAprobacion?: string;
  fechaPago?: string;
  observaciones?: string;
  conformidadParcial: boolean;
  porcentajeConformidad?: number;
}

function mapValorizacion(row: ValorizacionDB): Valorizacion {
  return {
    _dbId: row.id,
    numero: row.numero,
    descripcion: row.descripcion,
    monto: row.monto,
    moneda: row.moneda,
    estado: row.estado,
    faseId: row.fase_id ?? undefined,
    fechaPresentacion: row.fecha_presentacion ?? undefined,
    fechaAprobacion: row.fecha_aprobacion ?? undefined,
    fechaPago: row.fecha_pago ?? undefined,
    observaciones: row.observaciones ?? undefined,
    conformidadParcial: row.conformidad_parcial ?? false,
    porcentajeConformidad: row.porcentaje_conformidad ?? undefined,
  };
}

// ── Config ───────────────────────────────────────────────

const ESTADO_CONFIG: Record<ValorizacionDB['estado'], { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', icon: Clock },
  presentada: { label: 'Presentada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: FileCheck },
  aprobada: { label: 'Aprobada', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
  facturada: { label: 'Facturada', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: DollarSign },
  pagada: { label: 'Pagada', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', icon: CheckCircle2 },
};

// ── Props ────────────────────────────────────────────────

interface ValorizacionesTabProps {
  proyectoDbId: string;
  tenantId: string;
  fases: Fase[];
  monedaProyecto?: string;
}

// ── Component ────────────────────────────────────────────

export function ValorizacionesTab({ proyectoDbId, tenantId, fases, monedaProyecto = 'PEN' }: ValorizacionesTabProps) {
  const [valorizaciones, setValorizaciones] = useState<Valorizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVal, setEditingVal] = useState<Valorizacion | null>(null);

  const fetchValorizaciones = useCallback(async () => {
    try {
      const { data, error } = await dbValorizaciones.listByProyecto(proyectoDbId);
      if (error) throw error;
      setValorizaciones((data ?? []).map(mapValorizacion));
    } catch (e) {
      console.error('[ValorizacionesTab] Error cargando:', e);
    } finally {
      setLoading(false);
    }
  }, [proyectoDbId]);

  useEffect(() => { fetchValorizaciones(); }, [fetchValorizaciones]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta valorización?')) return;
    try {
      const { error } = await dbValorizaciones.delete(id);
      if (error) throw error;
      setValorizaciones(prev => prev.filter(v => v._dbId !== id));
      toast.success('Valorización eliminada');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error eliminando');
    }
  };

  // KPIs
  const totalMonto = valorizaciones.reduce((s, v) => s + v.monto, 0);
  const totalAprobado = valorizaciones.filter(v => ['aprobada', 'facturada', 'pagada'].includes(v.estado)).reduce((s, v) => s + v.monto, 0);
  const totalPagado = valorizaciones.filter(v => v.estado === 'pagada').reduce((s, v) => s + v.monto, 0);
  const porcentajeCobrado = totalMonto > 0 ? Math.round((totalPagado / totalMonto) * 100) : 0;

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Cargando valorizaciones...</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Valorizado</p>
            <p className="text-lg font-bold">{monedaProyecto} {totalMonto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Aprobado</p>
            <p className="text-lg font-bold text-green-600">{monedaProyecto} {totalAprobado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="text-lg font-bold text-emerald-600">{monedaProyecto} {totalPagado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">% Cobrado</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold">{porcentajeCobrado}%</p>
              <Progress value={porcentajeCobrado} className="flex-1 h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header + Add */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">Hitos de Facturación</h3>
        <Button size="sm" onClick={() => { setEditingVal(null); setDialogOpen(true); }}>
          <Plus className="size-3.5" /> Nueva Valorización
        </Button>
      </div>

      {/* Lista */}
      {valorizaciones.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <DollarSign className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay valorizaciones registradas</p>
          <p className="text-xs mt-1">Agrega hitos de facturación para seguir la cobranza del proyecto</p>
        </div>
      ) : (
        <div className="space-y-2">
          {valorizaciones.map(v => {
            const cfg = ESTADO_CONFIG[v.estado];
            const Icono = cfg.icon;
            const faseNombre = fases.find(f => f._dbId === v.faseId)?.nombre;
            return (
              <Card key={v._dbId} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                    <Icono className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">Val. N°{v.numero}</span>
                      <Badge className={`${cfg.color} border-0 text-xs px-1.5 h-5`}>{cfg.label}</Badge>
                      {v.conformidadParcial && (
                        <Badge variant="outline" className="text-xs px-1 h-5">
                          <AlertTriangle className="size-2.5 mr-0.5" />
                          Parcial {v.porcentajeConformidad ?? 0}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm truncate">{v.descripcion}</p>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                      {faseNombre && <span>Fase: {faseNombre}</span>}
                      {v.fechaPresentacion && <span>Presentada: {v.fechaPresentacion}</span>}
                      {v.fechaPago && <span>Pagada: {v.fechaPago}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{v.moneda} {v.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingVal(v); setDialogOpen(true); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(v._dbId)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <ValorizacionDialog
          open={dialogOpen}
          valorizacion={editingVal}
          proyectoDbId={proyectoDbId}
          tenantId={tenantId}
          fases={fases}
          moneda={monedaProyecto}
          numeroSiguiente={valorizaciones.length + 1}
          onClose={() => {
            setDialogOpen(false);
            setEditingVal(null);
            fetchValorizaciones();
          }}
        />
      )}
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────

interface ValorizacionDialogProps {
  open: boolean;
  valorizacion: Valorizacion | null;
  proyectoDbId: string;
  tenantId: string;
  fases: Fase[];
  moneda: string;
  numeroSiguiente: number;
  onClose: () => void;
}

function ValorizacionDialog({ open, valorizacion, proyectoDbId, tenantId, fases, moneda, numeroSiguiente, onClose }: ValorizacionDialogProps) {
  const [descripcion, setDescripcion] = useState(valorizacion?.descripcion ?? '');
  const [monto, setMonto] = useState(valorizacion?.monto?.toString() ?? '');
  const [estado, setEstado] = useState<ValorizacionDB['estado']>(valorizacion?.estado ?? 'pendiente');
  const [faseId, setFaseId] = useState(valorizacion?.faseId ?? '');
  const [fechaPresentacion, setFechaPresentacion] = useState(valorizacion?.fechaPresentacion ?? '');
  const [fechaAprobacion, setFechaAprobacion] = useState(valorizacion?.fechaAprobacion ?? '');
  const [fechaPago, setFechaPago] = useState(valorizacion?.fechaPago ?? '');
  const [observaciones, setObservaciones] = useState(valorizacion?.observaciones ?? '');
  const [conformidadParcial, setConformidadParcial] = useState(valorizacion?.conformidadParcial ?? false);
  const [porcentajeConformidad, setPorcentajeConformidad] = useState(valorizacion?.porcentajeConformidad?.toString() ?? '100');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!descripcion.trim()) { toast.error('La descripción es requerida'); return; }
    if (!monto || parseFloat(monto) <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        proyecto_id: proyectoDbId,
        numero: valorizacion?.numero ?? numeroSiguiente,
        descripcion: descripcion.trim(),
        monto: parseFloat(monto),
        moneda: moneda,
        estado,
        fase_id: faseId || null,
        fecha_presentacion: fechaPresentacion || null,
        fecha_aprobacion: fechaAprobacion || null,
        fecha_pago: fechaPago || null,
        observaciones: observaciones.trim() || null,
        conformidad_parcial: conformidadParcial,
        porcentaje_conformidad: conformidadParcial ? parseFloat(porcentajeConformidad) || 0 : null,
      };

      if (valorizacion) {
        const { error } = await dbValorizaciones.update(valorizacion._dbId, payload);
        if (error) throw error;
        toast.success('Valorización actualizada');
      } else {
        const { error } = await dbValorizaciones.insert(payload);
        if (error) throw error;
        toast.success('Valorización creada');
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {valorizacion ? `Editar Valorización N°${valorizacion.numero}` : `Nueva Valorización N°${numeroSiguiente}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Descripción *</Label>
            <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Entrega de equipos fase 1" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto ({moneda}) *</Label>
              <Input type="number" min={0} step={0.01} value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" className="mt-1" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={estado} onValueChange={v => setEstado(v as ValorizacionDB['estado'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {fases.length > 0 && (
            <div>
              <Label>Fase vinculada</Label>
              <Select value={faseId} onValueChange={setFaseId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sin fase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin fase</SelectItem>
                  {fases.map(f => (
                    <SelectItem key={f._dbId} value={f._dbId}>{f.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Presentación</Label>
              <Input type="date" value={fechaPresentacion} onChange={e => setFechaPresentacion(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Aprobación</Label>
              <Input type="date" value={fechaAprobacion} onChange={e => setFechaAprobacion(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Pago</Label>
              <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Conformidad */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="conformidadParcial"
                checked={conformidadParcial}
                onChange={e => setConformidadParcial(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="conformidadParcial" className="cursor-pointer">Conformidad parcial</Label>
            </div>
            {conformidadParcial && (
              <div>
                <Label>Porcentaje de conformidad (%)</Label>
                <Input
                  type="number" min={0} max={100} step={1}
                  value={porcentajeConformidad}
                  onChange={e => setPorcentajeConformidad(e.target.value)}
                  className="mt-1 w-32"
                />
              </div>
            )}
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="mt-1" placeholder="Notas adicionales..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : valorizacion ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
