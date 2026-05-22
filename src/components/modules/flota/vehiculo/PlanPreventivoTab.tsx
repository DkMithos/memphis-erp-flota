/**
 * Memphis ERP - Flota → Vehículo Detalle → Tab Plan Preventivo
 * Gestión de plan preventivo contratado y seguimiento de uso
 */

import { useState, useEffect } from 'react';
import { Calendar, Gauge, Save, RotateCcw, CheckCircle2, AlertCircle, TrendingUp, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Switch } from '../../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Progress } from '../../../ui/progress';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import {
  Vehiculo,
  PlanPreventivoContratado,
  TipoPlanPreventivo,
  TIPO_PLAN_PREVENTIVO_LABELS,
  validarPlanPreventivo,
  calcPreventivosUsadosRestantes,
} from '../../../../lib/flota/vehiculos-config';
import { toast } from 'sonner';

interface PlanPreventivoTabProps {
  vehiculoId: string;
  vehiculo: Vehiculo;
}

export function PlanPreventivoTab({ vehiculoId, vehiculo }: PlanPreventivoTabProps) {
  const { actualizarPlanPreventivo } = useVehiculos();

  // Estado del formulario
  const [formData, setFormData] = useState<PlanPreventivoContratado>({
    habilitado: false,
    tipoPlan: 'por_km',
    totalPreventivosContratados: 0,
    intervaloKm: undefined,
    intervaloMeses: undefined,
    costoTotal: 0,
    costoPorServicio: 0,
  });

  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [modificado, setModificado] = useState(false);

  // Cargar datos del vehículo al montar
  useEffect(() => {
    if (vehiculo.planPreventivoContratado) {
      setFormData({ ...vehiculo.planPreventivoContratado });
    } else if (vehiculo.planPreventivo) {
      // Mapear del legacy al nuevo formato
      setFormData({
        habilitado: true,
        tipoPlan: vehiculo.planPreventivo.frecuenciaKm && vehiculo.planPreventivo.frecuenciaDias
          ? 'mixto'
          : vehiculo.planPreventivo.frecuenciaKm
            ? 'por_km'
            : 'por_meses',
        totalPreventivosContratados: vehiculo.planPreventivo.totalPreventivosContratados || 0,
        intervaloKm: vehiculo.planPreventivo.frecuenciaKm,
        intervaloMeses: vehiculo.planPreventivo.frecuenciaDias ? Math.floor(vehiculo.planPreventivo.frecuenciaDias / 30) : undefined,
        costoTotal: 0,
        costoPorServicio: 0,
      });
    }
  }, [vehiculo.planPreventivoContratado, vehiculo.planPreventivo]);

  // Detectar cambios
  useEffect(() => {
    const original = vehiculo.planPreventivo 
      ? {
          habilitado: true,
          tipoPlan: vehiculo.planPreventivo.frecuenciaKm && vehiculo.planPreventivo.frecuenciaDias 
            ? 'mixto' 
            : vehiculo.planPreventivo.frecuenciaKm 
              ? 'por_km' 
              : 'por_meses',
          totalPreventivosContratados: vehiculo.planPreventivo.totalPreventivosContratados || 0,
          intervaloKm: vehiculo.planPreventivo.frecuenciaKm,
          intervaloMeses: vehiculo.planPreventivo.frecuenciaDias ? Math.floor(vehiculo.planPreventivo.frecuenciaDias / 30) : undefined,
        }
      : {
          habilitado: false,
          tipoPlan: 'por_km',
          totalPreventivosContratados: 0,
        };

    const cambios = JSON.stringify(formData) !== JSON.stringify(original);
    setModificado(cambios);
  }, [formData, vehiculo.planPreventivo]);

  const handleChange = (field: keyof PlanPreventivoContratado, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrores([]);
  };

  const handleGuardar = async () => {
    // Validar
    const validacion = validarPlanPreventivo(formData);
    if (!validacion.valido) {
      setErrores(validacion.errores);
      toast.error('Revisa los campos obligatorios', {
        description: validacion.errores[0],
      });
      return;
    }

    setGuardando(true);

    const resultado = await actualizarPlanPreventivo(vehiculoId, formData);

    if (resultado.exito) {
      toast.success('Plan preventivo actualizado', {
        description: 'La configuración se guardó correctamente',
      });
      setErrores([]);
      setModificado(false);
    } else {
      setErrores(resultado.errores || ['Error desconocido']);
      toast.error('Error al guardar', {
        description: resultado.errores?.join(', '),
      });
    }

    setGuardando(false);
  };

  const handleRestablecer = () => {
    if (vehiculo.planPreventivoContratado) {
      setFormData({ ...vehiculo.planPreventivoContratado });
    } else {
      setFormData({
        habilitado: false,
        tipoPlan: 'por_km',
        totalPreventivosContratados: 0,
        intervaloKm: undefined,
        intervaloMeses: undefined,
        costoTotal: 0,
        costoPorServicio: 0,
      });
    }
    setErrores([]);
    setModificado(false);
  };

  // Calcular progreso (necesitamos OTs - por ahora mock)
  const estadoUso = calcPreventivosUsadosRestantes(vehiculoId, [], formData);
  const tienePlan = !!vehiculo.planPreventivo;

  const mostrarIntervaloKm = formData.tipoPlan === 'por_km' || formData.tipoPlan === 'mixto';
  const mostrarIntervaloMeses = formData.tipoPlan === 'por_meses' || formData.tipoPlan === 'mixto';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="size-5 text-[#0A66C2]" />
            Plan Preventivo Contratado
          </h3>
          <p className="text-sm text-muted-foreground">
            Configura y monitorea el plan de mantenimientos preventivos programados
          </p>
        </div>

        {tienePlan && formData.habilitado && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            Plan activo
          </div>
        )}
      </div>

      {/* Errores globales */}
      {errores.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errores.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Plan deshabilitado warning */}
      {!formData.habilitado && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            El plan preventivo está deshabilitado. Actívalo para comenzar el seguimiento.
          </AlertDescription>
        </Alert>
      )}

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración del Plan</CardTitle>
          <CardDescription>
            Define el tipo de plan y los intervalos de mantenimiento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Habilitado */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="habilitado">Plan Habilitado</Label>
              <p className="text-sm text-muted-foreground">
                Activa o desactiva el seguimiento de preventivos
              </p>
            </div>
            <Switch
              id="habilitado"
              checked={formData.habilitado}
              onCheckedChange={(checked) => handleChange('habilitado', checked)}
              disabled={guardando}
            />
          </div>

          <div className={formData.habilitado ? '' : 'opacity-50 pointer-events-none'}>
            {/* Tipo de Plan */}
            <div className="space-y-2">
              <Label htmlFor="tipoPlan">
                Tipo de Plan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.tipoPlan}
                onValueChange={(value) => handleChange('tipoPlan', value as TipoPlanPreventivo)}
                disabled={guardando || !formData.habilitado}
              >
                <SelectTrigger id="tipoPlan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_PLAN_PREVENTIVO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Total Preventivos */}
            <div className="space-y-2">
              <Label htmlFor="total">
                Total Preventivos Contratados <span className="text-destructive">*</span>
              </Label>
              <Input
                id="total"
                type="number"
                min="0"
                placeholder="Ej: 12"
                value={formData.totalPreventivosContratados}
                onChange={(e) => handleChange('totalPreventivosContratados', parseInt(e.target.value) || 0)}
                disabled={guardando || !formData.habilitado}
              />
            </div>

            {/* Intervalo Km */}
            {mostrarIntervaloKm && (
              <div className="space-y-2">
                <Label htmlFor="intervaloKm">
                  Intervalo por Kilometraje (km) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="intervaloKm"
                  type="number"
                  min="1"
                  placeholder="Ej: 10000"
                  value={formData.intervaloKm || ''}
                  onChange={(e) => handleChange('intervaloKm', parseInt(e.target.value) || undefined)}
                  disabled={guardando || !formData.habilitado}
                />
              </div>
            )}

            {/* Intervalo Meses */}
            {mostrarIntervaloMeses && (
              <div className="space-y-2">
                <Label htmlFor="intervaloMeses">
                  Intervalo por Tiempo (meses) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="intervaloMeses"
                  type="number"
                  min="1"
                  placeholder="Ej: 3"
                  value={formData.intervaloMeses || ''}
                  onChange={(e) => handleChange('intervaloMeses', parseInt(e.target.value) || undefined)}
                  disabled={guardando || !formData.habilitado}
                />
              </div>
            )}

            {/* Separador costos */}
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-3">Costos del contrato (modelo prepago)</p>
            </div>

            {/* Costo Total Contratado */}
            <div className="space-y-2">
              <Label htmlFor="costoTotal">
                Costo Total Contratado (S/) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="costoTotal"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 45000.00"
                value={formData.costoTotal || ''}
                onChange={(e) => handleChange('costoTotal', parseFloat(e.target.value) || 0)}
                disabled={guardando || !formData.habilitado}
              />
              <p className="text-xs text-muted-foreground">
                Monto total que la concesionaria cobra por todos los mantenimientos preventivos
              </p>
            </div>

            {/* Costo Por Servicio */}
            <div className="space-y-2">
              <Label htmlFor="costoPorServicio">
                Costo por cada Preventivo (S/)
              </Label>
              <Input
                id="costoPorServicio"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 2250.00"
                value={formData.costoPorServicio || ''}
                onChange={(e) => handleChange('costoPorServicio', parseFloat(e.target.value) || 0)}
                disabled={guardando || !formData.habilitado}
              />
              <p className="text-xs text-muted-foreground">
                {formData.totalPreventivosContratados > 0 && formData.costoTotal > 0
                  ? `Referencia: ${new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(formData.costoTotal / formData.totalPreventivosContratados)} por preventivo (total ÷ cantidad)`
                  : 'Costo unitario por cada servicio preventivo'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de Uso */}
      {formData.habilitado && formData.totalPreventivosContratados > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4" />
              Resumen de Uso
            </CardTitle>
            <CardDescription>
              Estado actual del plan preventivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Contratados</p>
                <p className="text-2xl font-bold">{estadoUso.total}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Usados</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {estadoUso.usados}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Restantes</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {estadoUso.restantes}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progreso de Uso</span>
                <span className="font-medium">{estadoUso.porcentajeUsado}%</span>
              </div>
              <Progress value={estadoUso.porcentajeUsado} className="h-2" />
            </div>

            {estadoUso.porcentajeUsado >= 80 && estadoUso.restantes > 0 && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Se ha utilizado el {estadoUso.porcentajeUsado}% del plan. Considera renovar pronto.
                </AlertDescription>
              </Alert>
            )}

            {estadoUso.restantes === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Plan agotado. No quedan preventivos disponibles.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGuardar}
          disabled={guardando || !modificado}
          className="gap-2"
        >
          <Save className="size-4" />
          {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </Button>

        <Button
          variant="outline"
          onClick={handleRestablecer}
          disabled={guardando || !modificado}
          className="gap-2"
        >
          <RotateCcw className="size-4" />
          Restablecer
        </Button>

        {modificado && (
          <span className="text-sm text-muted-foreground">
            Hay cambios sin guardar
          </span>
        )}
      </div>
    </div>
  );
}
