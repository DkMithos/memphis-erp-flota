/**
 * Memphis ERP - Flota → Vehículo Detalle → Tab Contrato
 * Gestión de vínculo contractual del vehículo
 */

import { useState, useEffect } from 'react';
import { Building2, FileText, Calendar, Save, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Alert, AlertDescription } from '../../../ui/alert';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import {
  Vehiculo,
  VehiculoVinculoContrato,
  TipoContratoFlota,
  TIPO_CONTRATO_LABELS,
  validarVinculoContrato,
} from '../../../../lib/flota/vehiculos-config';
import { toast } from 'sonner';

interface ContratoTabProps {
  vehiculoId: string;
  vehiculo: Vehiculo;
}

export function ContratoTab({ vehiculoId, vehiculo }: ContratoTabProps) {
  const { actualizarVinculoContrato } = useVehiculos();

  // Estado del formulario
  const [formData, setFormData] = useState<VehiculoVinculoContrato>({
    clienteNombre: '',
    proyectoNombre: '',
    contratoNombre: '',
    tipoContrato: 'solo_mantenimiento',
    fechaInicio: '',
    fechaFin: '',
  });

  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [modificado, setModificado] = useState(false);

  // Cargar datos del vehículo al montar
  useEffect(() => {
    if (vehiculo.vinculoContrato) {
      setFormData(vehiculo.vinculoContrato);
    }
  }, [vehiculo.vinculoContrato]);

  // Detectar cambios
  useEffect(() => {
    if (!vehiculo.vinculoContrato) {
      setModificado(
        formData.clienteNombre !== '' ||
        formData.proyectoNombre !== '' ||
        formData.contratoNombre !== ''
      );
    } else {
      const cambios = JSON.stringify(formData) !== JSON.stringify(vehiculo.vinculoContrato);
      setModificado(cambios);
    }
  }, [formData, vehiculo.vinculoContrato]);

  const handleChange = (field: keyof VehiculoVinculoContrato, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrores([]);
  };

  const handleGuardar = async () => {
    // Validar
    const validacion = validarVinculoContrato(formData);
    if (!validacion.valido) {
      setErrores(validacion.errores);
      toast.error('Revisa los campos obligatorios', {
        description: validacion.errores[0],
      });
      return;
    }

    setGuardando(true);

    const resultado = await actualizarVinculoContrato(vehiculoId, formData);

    if (resultado.exito) {
      toast.success('Contrato actualizado', {
        description: 'Los datos del contrato se guardaron correctamente',
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
    if (vehiculo.vinculoContrato) {
      setFormData(vehiculo.vinculoContrato);
    } else {
      setFormData({
        clienteNombre: '',
        proyectoNombre: '',
        contratoNombre: '',
        tipoContrato: 'solo_mantenimiento',
        fechaInicio: '',
        fechaFin: '',
      });
    }
    setErrores([]);
    setModificado(false);
  };

  const tieneContrato = !!vehiculo.vinculoContrato;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-[#0A66C2]" />
            Contrato & Proyecto
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestiona el vínculo contractual del vehículo con clientes y proyectos
          </p>
        </div>

        {tieneContrato && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            Contrato registrado
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

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del Contrato</CardTitle>
          <CardDescription>
            Datos del cliente, proyecto y tipo de contrato asociado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="cliente">
              Cliente / Entidad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cliente"
              placeholder="Ej: Acme Corporation"
              value={formData.clienteNombre}
              onChange={(e) => handleChange('clienteNombre', e.target.value)}
              disabled={guardando}
            />
          </div>

          {/* Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="proyecto">
              Proyecto / Servicio <span className="text-destructive">*</span>
            </Label>
            <Input
              id="proyecto"
              placeholder="Ej: Flota Corporativa 2024"
              value={formData.proyectoNombre}
              onChange={(e) => handleChange('proyectoNombre', e.target.value)}
              disabled={guardando}
            />
          </div>

          {/* Contrato */}
          <div className="space-y-2">
            <Label htmlFor="contrato">
              Código / ID Contrato <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contrato"
              placeholder="Ej: CTR-2024-001"
              value={formData.contratoNombre}
              onChange={(e) => handleChange('contratoNombre', e.target.value)}
              disabled={guardando}
            />
          </div>

          {/* Tipo de Contrato */}
          <div className="space-y-2">
            <Label htmlFor="tipoContrato">
              Tipo de Contrato <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.tipoContrato}
              onValueChange={(value) => handleChange('tipoContrato', value as TipoContratoFlota)}
              disabled={guardando}
            >
              <SelectTrigger id="tipoContrato">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_CONTRATO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">
                Fecha Inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                value={formData.fechaInicio}
                onChange={(e) => handleChange('fechaInicio', e.target.value)}
                disabled={guardando}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaFin">
                Fecha Fin <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fechaFin"
                type="date"
                value={formData.fechaFin}
                onChange={(e) => handleChange('fechaFin', e.target.value)}
                disabled={guardando}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
