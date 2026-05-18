/**
 * FORMULARIO DE MANTENIMIENTO BIOMÉDICO
 * Creación de nuevo mantenimiento para un equipo
 * Production-ready siguiendo patrón enterprise
 */

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { toast } from 'sonner';
import {
  useMantenimientosStore,
  type NuevoMantenimientoBiomedicoInput
} from '../../../lib/biomedico/mantenimientos-store';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import {
  MANTENIMIENTO_TIPO_CONFIG,
  MANTENIMIENTO_PRIORIDAD_CONFIG,
  type TipoMantenimientoBio,
  type PrioridadMantenimientoBio
} from '../../../lib/biomedico/mantenimientos-config';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';

interface FormData {
  equipoId: string;
  tipo: TipoMantenimientoBio | '';
  prioridad: PrioridadMantenimientoBio | '';
  titulo: string;
  descripcion: string;
  fechaProgramada: string;
  tecnicoNombre: string;
  tecnicoEmpresa: string;
  observaciones: string;
  proyectoId: string | null;
  centroCostoId: string | null;
}

interface BiomedicoMantenimientoFormProps {
  equipoIdInicial?: string; // Puede ser ID o código
  onCancel?: () => void;
  onSuccess?: (numero: string) => void;
}

export function BiomedicoMantenimientoForm({ 
  equipoIdInicial,
  onCancel, 
  onSuccess 
}: BiomedicoMantenimientoFormProps) {
  const { crearMantenimiento } = useMantenimientosStore();
  const { equipos, obtenerEquipoPorId, obtenerEquipoPorCodigo } = useEquiposStore();
  
  const [formData, setFormData] = useState<FormData>({
    equipoId: equipoIdInicial || '',
    tipo: '',
    prioridad: '',
    titulo: '',
    descripcion: '',
    fechaProgramada: '',
    tecnicoNombre: '',
    tecnicoEmpresa: '',
    observaciones: '',
    proyectoId: null,
    centroCostoId: null
  });

  // Inicializar equipoId desde el código si viene en equipoIdInicial
  useEffect(() => {
    if (equipoIdInicial) {
      // Intentar buscar por código primero
      const equipoPorCodigo = obtenerEquipoPorCodigo(equipoIdInicial);
      if (equipoPorCodigo) {
        setFormData(prev => ({ ...prev, equipoId: equipoPorCodigo.id }));
      } else {
        // Si no se encuentra por código, usar el ID directamente
        const equipoPorId = obtenerEquipoPorId(equipoIdInicial);
        if (equipoPorId) {
          setFormData(prev => ({ ...prev, equipoId: equipoPorId.id }));
        }
      }
    }
  }, [equipoIdInicial, obtenerEquipoPorCodigo, obtenerEquipoPorId]);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const equipoSeleccionado = formData.equipoId ? obtenerEquipoPorId(formData.equipoId) : null;

  // Validación del formulario
  const validarFormulario = (): boolean => {
    return !!(
      formData.equipoId &&
      formData.tipo &&
      formData.prioridad &&
      formData.titulo &&
      formData.descripcion &&
      formData.fechaProgramada &&
      formData.tecnicoNombre &&
      formData.tecnicoEmpresa
    );
  };

  const handleSubmit = async () => {
    if (!validarFormulario()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (!equipoSeleccionado) {
      toast.error('Equipo no encontrado');
      return;
    }

    try {
      const input: NuevoMantenimientoBiomedicoInput = {
        equipoId: equipoSeleccionado.id,
        equipoDbId: equipoSeleccionado._dbId,
        equipoCodigo: equipoSeleccionado.codigo,
        equipoNombre: equipoSeleccionado.nombre,
        tipo: formData.tipo as TipoMantenimientoBio,
        prioridad: formData.prioridad as PrioridadMantenimientoBio,
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        fechaProgramada: formData.fechaProgramada,
        tecnico: {
          id: `TEC-${Date.now()}`,
          nombre: formData.tecnicoNombre,
          empresa: formData.tecnicoEmpresa
        },
        observaciones: formData.observaciones || undefined,
        proyectoId: formData.proyectoId,
        centroCostoId: formData.centroCostoId
      };

      const mantenimiento = await crearMantenimiento(input);
      toast.success(`Mantenimiento ${mantenimiento.numeroMantenimiento} creado exitosamente`);
      onSuccess?.(mantenimiento.numeroMantenimiento);
    } catch (error) {
      toast.error('Error al crear el mantenimiento');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo Mantenimiento Biomédico</h1>
          <p className="text-sm text-muted-foreground">
            Registra un nuevo mantenimiento para un equipo biomédico
          </p>
        </div>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Mantenimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selección de Equipo */}
          <div className="space-y-2">
            <Label htmlFor="equipo">Equipo Biomédico *</Label>
            <Select 
              value={formData.equipoId} 
              onValueChange={(v) => updateFormData('equipoId', v)}
              disabled={!!equipoIdInicial}
            >
              <SelectTrigger id="equipo">
                <SelectValue placeholder="Seleccionar equipo" />
              </SelectTrigger>
              <SelectContent>
                {equipos.filter(eq => eq.estado !== 'baja').map((equipo) => (
                  <SelectItem key={equipo.id} value={equipo.id}>
                    {equipo.codigo} - {equipo.nombre} ({equipo.ubicacion.area})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {equipoSeleccionado && (
              <div className="text-sm text-muted-foreground">
                {equipoSeleccionado.marca} {equipoSeleccionado.modelo} • Serie: {equipoSeleccionado.serie}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipo de Mantenimiento */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Mantenimiento *</Label>
              <Select value={formData.tipo} onValueChange={(v) => updateFormData('tipo', v)}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MANTENIMIENTO_TIPO_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridad */}
            <div className="space-y-2">
              <Label htmlFor="prioridad">Prioridad *</Label>
              <Select value={formData.prioridad} onValueChange={(v) => updateFormData('prioridad', v)}>
                <SelectTrigger id="prioridad">
                  <SelectValue placeholder="Seleccionar prioridad" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MANTENIMIENTO_PRIORIDAD_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => updateFormData('titulo', e.target.value)}
              placeholder="Ej: Mantenimiento Preventivo Trimestral"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => updateFormData('descripcion', e.target.value)}
              placeholder="Describe las actividades a realizar..."
              rows={4}
            />
          </div>

          {/* Fecha Programada */}
          <div className="space-y-2">
            <Label htmlFor="fechaProgramada">Fecha Programada *</Label>
            <Input
              id="fechaProgramada"
              type="datetime-local"
              value={formData.fechaProgramada}
              onChange={(e) => updateFormData('fechaProgramada', e.target.value)}
            />
          </div>

          {/* Técnico Responsable */}
          <div>
            <h3 className="font-medium mb-4">Técnico Responsable</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tecnicoNombre">Nombre del Técnico *</Label>
                <Input
                  id="tecnicoNombre"
                  value={formData.tecnicoNombre}
                  onChange={(e) => updateFormData('tecnicoNombre', e.target.value)}
                  placeholder="Ej: Ing. Roberto Vega"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tecnicoEmpresa">Empresa/Departamento *</Label>
                <Input
                  id="tecnicoEmpresa"
                  value={formData.tecnicoEmpresa}
                  onChange={(e) => updateFormData('tecnicoEmpresa', e.target.value)}
                  placeholder="Ej: Interno o Nombre del Proveedor"
                />
              </div>
            </div>
          </div>

          {/* Imputación — Proyecto y Centro de Costo */}
          <div>
            <h3 className="font-medium mb-4">Imputación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proyecto</Label>
                <ProyectoSelector
                  value={formData.proyectoId}
                  onChange={(v) => setFormData(prev => ({ ...prev, proyectoId: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Centro de Costo</Label>
                <CentroCostoSelector
                  value={formData.centroCostoId}
                  onChange={(v) => setFormData(prev => ({ ...prev, centroCostoId: v }))}
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones}
              onChange={(e) => updateFormData('observaciones', e.target.value)}
              placeholder="Notas adicionales sobre el mantenimiento..."
              rows={3}
            />
          </div>

          {/* Advertencia */}
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>
              El mantenimiento se creará en estado "Programado". Los datos de auditoría se registrarán automáticamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit}>
          <Save className="size-4" />
          Crear Mantenimiento
        </Button>
      </div>
    </div>
  );
}