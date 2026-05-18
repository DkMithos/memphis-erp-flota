/**
 * Memphis ERP — BiomedicoContratoForm
 * Formulario de 2 pasos para crear/editar contratos de servicio biomédico.
 * Paso 1: Equipo + Tipo + Proveedor + Vigencia + Valor
 * Paso 2: Cobertura + SLA (si tipo = sla | integral) + Observaciones
 */
import { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronLeft, CheckCircle2,
  FileText, Shield, Zap, AlertCircle
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  useContratosBioStore,
  TIPO_CONTRATO_LABELS,
  type TipoContratoBio,
  type MonedaContrato,
  type NuevoContratoBioInput,
} from '../../../lib/biomedico/contratos-bio-store';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';

interface BiomedicoContratoFormProps {
  contratoId?: string;   // si se pasa: modo editar
  onCancel: () => void;
  onSuccess: (id: string) => void;
}

type FormState = {
  equipoId: string;
  tipo: TipoContratoBio;
  proveedorNombre: string;
  fechaInicio: string;
  fechaFin: string;
  valorContrato: string;
  moneda: MonedaContrato;
  cobertura: string;
  slaHrs: string;
  slaDisponibilidad: string;
  slaPenalidades: string;
  observaciones: string;
};

const INICIAL: FormState = {
  equipoId: '',
  tipo: 'garantia',
  proveedorNombre: '',
  fechaInicio: '',
  fechaFin: '',
  valorContrato: '',
  moneda: 'PEN',
  cobertura: '',
  slaHrs: '',
  slaDisponibilidad: '',
  slaPenalidades: '',
  observaciones: '',
};

const TIPOS_CONTRATO: Array<{ value: TipoContratoBio; desc: string }> = [
  { value: 'garantia',                desc: 'Cobertura de fallas del fabricante' },
  { value: 'mantenimiento_preventivo', desc: 'Mantenimiento programado periódico' },
  { value: 'correctivo',              desc: 'Reparación de averías bajo contrato' },
  { value: 'sla',                     desc: 'Acuerdo de nivel de servicio con KPIs' },
  { value: 'oem',                     desc: 'Contrato directo con el fabricante OEM' },
  { value: 'integral',                desc: 'Mantenimiento preventivo + correctivo + SLA' },
];

export function BiomedicoContratoForm({ contratoId, onCancel, onSuccess }: BiomedicoContratoFormProps) {
  const { crearContrato, actualizarContrato, obtenerContratoPorId, contratos } = useContratosBioStore();
  const { equipos } = useEquiposStore();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INICIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modoEditar = !!contratoId;
  const contrato = contratoId ? obtenerContratoPorId(contratoId) : undefined;

  // Pre-cargar en modo editar
  useEffect(() => {
    if (contrato) {
      setForm({
        equipoId: contrato.equipoId,
        tipo: contrato.tipo,
        proveedorNombre: contrato.proveedorNombre,
        fechaInicio: contrato.fechaInicio,
        fechaFin: contrato.fechaFin,
        valorContrato: contrato.valorContrato != null ? String(contrato.valorContrato) : '',
        moneda: contrato.moneda,
        cobertura: contrato.cobertura ?? '',
        slaHrs: contrato.sla.tiempoRespuestaHrs != null ? String(contrato.sla.tiempoRespuestaHrs) : '',
        slaDisponibilidad: contrato.sla.disponibilidadPct != null ? String(contrato.sla.disponibilidadPct) : '',
        slaPenalidades: contrato.sla.penalidades ?? '',
        observaciones: contrato.observaciones ?? '',
      });
    }
  }, [contrato, contratos]);

  const set = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const tieneSLA = form.tipo === 'sla' || form.tipo === 'integral';
  const steps = ['Datos del Contrato', 'Condiciones y SLA'];

  // ── Validación paso 1 ────────────────────────────────────────────────────
  const paso1Valido = !!(
    form.equipoId &&
    form.tipo &&
    form.proveedorNombre.trim() &&
    form.fechaInicio &&
    form.fechaFin &&
    new Date(form.fechaFin) >= new Date(form.fechaInicio)
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      const input: NuevoContratoBioInput = {
        equipoId: form.equipoId,
        tipo: form.tipo,
        proveedorNombre: form.proveedorNombre.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        valorContrato: form.valorContrato ? Number(form.valorContrato) : undefined,
        moneda: form.moneda,
        cobertura: form.cobertura.trim() || undefined,
        sla: tieneSLA ? {
          tiempoRespuestaHrs: form.slaHrs ? Number(form.slaHrs) : undefined,
          disponibilidadPct:  form.slaDisponibilidad ? Number(form.slaDisponibilidad) : undefined,
          penalidades:        form.slaPenalidades.trim() || undefined,
        } : undefined,
        observaciones: form.observaciones.trim() || undefined,
      };

      if (modoEditar && contratoId) {
        const result = await actualizarContrato(contratoId, input);
        if (!result.ok) throw new Error(result.error);
        onSuccess(contratoId);
      } else {
        const nuevo = await crearContrato(input);
        onSuccess(nuevo.id);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error al guardar el contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {modoEditar ? `Editar Contrato ${contratoId}` : 'Nuevo Contrato de Servicio'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Garantías, SLA y contratos de mantenimiento para equipos biomédicos
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={`size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i < step ? 'bg-primary text-primary-foreground'
                : i === step ? 'bg-primary/15 text-primary border-2 border-primary'
                : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:block ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`h-px flex-1 mx-2 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Paso 0: Datos del Contrato ───────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="size-4 text-primary" /> Datos del Contrato</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* Equipo */}
            <div className="space-y-2">
              <Label htmlFor="equipo">Equipo biomédico *</Label>
              <select
                id="equipo"
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.equipoId}
                onChange={e => set('equipoId', e.target.value)}
              >
                <option value="">Seleccionar equipo...</option>
                {equipos
                  .filter(eq => eq.estado !== 'baja')
                  .map(eq => (
                    <option key={eq.id} value={eq.id}>
                      [{eq.codigo}] {eq.nombre} — {eq.marca} {eq.modelo}
                    </option>
                  ))}
              </select>
            </div>

            {/* Tipo de contrato */}
            <div className="space-y-2">
              <Label>Tipo de contrato *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TIPOS_CONTRATO.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('tipo', t.value)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      form.tipo === t.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium">{TIPO_CONTRATO_LABELS[t.value]}</span>
                      {(t.value === 'sla' || t.value === 'integral') && (
                        <Badge variant="secondary" className="text-xs py-0">SLA</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Proveedor */}
            <div className="space-y-2">
              <Label htmlFor="proveedor">Proveedor / empresa de servicio *</Label>
              <Input
                id="proveedor"
                placeholder="Ej: Siemens Healthineers Perú S.A.C."
                value={form.proveedorNombre}
                onChange={e => set('proveedorNombre', e.target.value)}
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha inicio *</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={form.fechaInicio}
                  onChange={e => set('fechaInicio', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaFin">Fecha fin *</Label>
                <Input
                  id="fechaFin"
                  type="date"
                  value={form.fechaFin}
                  min={form.fechaInicio}
                  onChange={e => set('fechaFin', e.target.value)}
                />
              </div>
            </div>
            {form.fechaFin && form.fechaInicio && new Date(form.fechaFin) < new Date(form.fechaInicio) && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="size-3" /> La fecha fin debe ser posterior a la fecha inicio.
              </p>
            )}

            {/* Valor */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="valor">Valor del contrato</Label>
                <Input
                  id="valor"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.valorContrato}
                  onChange={e => set('valorContrato', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moneda">Moneda</Label>
                <select
                  id="moneda"
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={form.moneda}
                  onChange={e => set('moneda', e.target.value as MonedaContrato)}
                >
                  <option value="PEN">S/ (PEN)</option>
                  <option value="USD">$ (USD)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Paso 1: Cobertura + SLA ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="size-4 text-primary" /> Alcance y Cobertura</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cobertura">Descripción de la cobertura</Label>
                <textarea
                  id="cobertura"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ej: Incluye partes y mano de obra. Excluye daños por mal uso o factores externos."
                  value={form.cobertura}
                  onChange={e => set('cobertura', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observaciones adicionales</Label>
                <textarea
                  id="obs"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Condiciones especiales, exclusiones, notas de negociación..."
                  value={form.observaciones}
                  onChange={e => set('observaciones', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {tieneSLA && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="size-4 text-blue-500" />
                  Parámetros SLA
                  <Badge variant="secondary" className="text-xs ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {TIPO_CONTRATO_LABELS[form.tipo]}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slaHrs">Tiempo de respuesta (horas)</Label>
                    <Input
                      id="slaHrs"
                      type="number"
                      min="1"
                      placeholder="Ej: 4"
                      value={form.slaHrs}
                      onChange={e => set('slaHrs', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Tiempo máximo para primera respuesta</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slaDisp">Disponibilidad garantizada (%)</Label>
                    <Input
                      id="slaDisp"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Ej: 98.5"
                      value={form.slaDisponibilidad}
                      onChange={e => set('slaDisponibilidad', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Uptime garantizado en %</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slaPen">Penalidades por incumplimiento</Label>
                  <textarea
                    id="slaPen"
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ej: 0.5% del valor mensual por cada hora de retraso en la respuesta."
                    value={form.slaPenalidades}
                    onChange={e => set('slaPenalidades', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Navegación ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button
          variant="outline"
          onClick={step === 0 ? onCancel : () => setStep(0)}
        >
          {step === 0 ? 'Cancelar' : (
            <><ChevronLeft className="size-4" /> Anterior</>
          )}
        </Button>

        <div className="text-xs text-muted-foreground">
          Paso {step + 1} de {steps.length}
        </div>

        {step < steps.length - 1 ? (
          <Button
            onClick={() => setStep(1)}
            disabled={!paso1Valido}
          >
            Siguiente <ChevronRight className="size-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={saving || !paso1Valido}
          >
            <CheckCircle2 className="size-4" />
            {saving ? 'Guardando...' : modoEditar ? 'Guardar Cambios' : 'Crear Contrato'}
          </Button>
        )}
      </div>
    </div>
  );
}
