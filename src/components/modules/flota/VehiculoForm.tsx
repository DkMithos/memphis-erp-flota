import { useState, useEffect } from 'react';
import { ArrowLeft, Car, Save, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { Vehiculo, TipoVehiculo } from '../../../lib/flota/vehiculos-config';
import { toast } from 'sonner';

interface VehiculoFormProps {
  modo: 'crear' | 'editar';
  vehiculoId?: string;
  onCancel: () => void;
  onSuccess: (vehiculoId: string) => void;
}

export function VehiculoForm({ modo, vehiculoId, onCancel, onSuccess }: VehiculoFormProps) {
  const { obtenerVehiculo, crearVehiculo, actualizarVehiculo } = useVehiculos();

  const [placa, setPlaca] = useState('');
  const [vin, setVin] = useState('');
  const [tipo, setTipo] = useState<TipoVehiculo | ''>('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [año, setAño] = useState('');
  const [color, setColor] = useState('');
  const [motor, setMotor] = useState('');
  const [combustible, setCombustible] = useState<'gasolina' | 'diesel' | 'gnv' | 'electrico' | 'hibrido' | ''>('');
  const [capacidad, setCapacidad] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [ubicacionActual, setUbicacionActual] = useState('');
  const [ultimoMantenimiento, setUltimoMantenimiento] = useState('');
  const [proximoMantenimiento, setProximoMantenimiento] = useState('');

  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (modo === 'editar' && vehiculoId) {
      const vehiculo = obtenerVehiculo(vehiculoId);
      
      if (!vehiculo) {
        toast.error('Vehículo no encontrado');
        onCancel();
        return;
      }

      // Pre-llenar formulario
      setPlaca(vehiculo.placa);
      setVin(vehiculo.vin || '');
      setTipo(vehiculo.tipo);
      setMarca(vehiculo.marca);
      setModelo(vehiculo.modelo);
      setAño(vehiculo.año.toString());
      setColor(vehiculo.color);
      setMotor(vehiculo.motor || '');
      setCombustible(vehiculo.combustible);
      setCapacidad(vehiculo.capacidad || '');
      setKilometraje(vehiculo.kilometraje.toString());
      setUbicacionActual(vehiculo.ubicacionActual);
      setUltimoMantenimiento(vehiculo.ultimoMantenimiento || '');
      setProximoMantenimiento(vehiculo.proximoMantenimiento || '');
    }
  }, [modo, vehiculoId, obtenerVehiculo, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrores([]);
    setGuardando(true);

    // Preparar datos
    const data: any = {
      placa,
      vin: vin.trim() || undefined,
      tipo: tipo as TipoVehiculo,
      marca,
      modelo,
      año: parseInt(año),
      color,
      motor: motor.trim() || undefined,
      combustible,
      capacidad: capacidad.trim() || undefined,
      kilometraje: parseInt(kilometraje),
      ubicacionActual,
      ultimoMantenimiento: ultimoMantenimiento || undefined,
      proximoMantenimiento: proximoMantenimiento || undefined
    };

    if (modo === 'crear') {
      const resultado = crearVehiculo(data);

      if (resultado.exito) {
        toast.success('Vehículo creado', {
          description: `${placa} ha sido registrado exitosamente`
        });
        onSuccess(resultado.vehiculoId!);
      } else {
        setErrores(resultado.errores || []);
        toast.error('Error al crear vehículo', {
          description: 'Revise los errores en el formulario'
        });
      }
    } else {
      const resultado = actualizarVehiculo(vehiculoId!, data);

      if (resultado.exito) {
        toast.success('Vehículo actualizado', {
          description: `${placa} ha sido actualizado exitosamente`
        });
        onSuccess(vehiculoId!);
      } else {
        setErrores(resultado.errores || []);
        toast.error('Error al actualizar vehículo', {
          description: 'Revise los errores en el formulario'
        });
      }
    }

    setGuardando(false);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Cancelar
        </Button>
        <span>/</span>
        <span>{modo === 'crear' ? 'Nuevo Vehículo' : `Editar ${placa}`}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-lg bg-primary/10 flex items-center justify-center">
          <Car className="size-8 text-primary" />
        </div>
        <div>
          <h2>{modo === 'crear' ? 'Registrar Nuevo Vehículo' : 'Editar Vehículo'}</h2>
          <p className="text-muted-foreground mt-1">
            {modo === 'crear' 
              ? 'Complete los datos del vehículo a registrar en la flota'
              : 'Actualice la información del vehículo'
            }
          </p>
        </div>
      </div>

      {/* Errores */}
      {errores.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errores.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificación */}
        <Card>
          <CardHeader>
            <CardTitle>Identificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="placa">
                  Placa <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="placa"
                  placeholder="ABC-123"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  required
                  disabled={modo === 'editar'} // No editable en modo editar
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {modo === 'editar' ? 'La placa no se puede modificar' : 'Formato: ABC-123 o AB-1234'}
                </p>
              </div>

              <div>
                <Label htmlFor="vin">VIN (opcional)</Label>
                <Input
                  id="vin"
                  placeholder="WDB9066791N123456"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  maxLength={17}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  17 caracteres alfanuméricos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información del Vehículo */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Vehículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tipo">
                  Tipo <span className="text-red-500">*</span>
                </Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoVehiculo)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambulancia">Ambulancia</SelectItem>
                    <SelectItem value="camioneta">Camioneta</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="marca">
                  Marca <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="marca"
                  placeholder="Toyota"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="modelo">
                  Modelo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="modelo"
                  placeholder="Hilux 4x4"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="año">
                  Año <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="año"
                  type="number"
                  placeholder="2023"
                  value={año}
                  onChange={(e) => setAño(e.target.value)}
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>

              <div>
                <Label htmlFor="color">
                  Color <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="color"
                  placeholder="Blanco"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="motor">Motor (opcional)</Label>
                <Input
                  id="motor"
                  placeholder="OM651"
                  value={motor}
                  onChange={(e) => setMotor(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="combustible">
                  Combustible <span className="text-red-500">*</span>
                </Label>
                <Select value={combustible} onValueChange={(v) => setCombustible(v as any)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="gnv">GNV</SelectItem>
                    <SelectItem value="electrico">Eléctrico</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="capacidad">Capacidad (opcional)</Label>
              <Input
                id="capacidad"
                placeholder="3.5 ton, 8 pasajeros, etc."
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Operación */}
        <Card>
          <CardHeader>
            <CardTitle>Operación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kilometraje">
                  Kilometraje Actual (km) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="kilometraje"
                  type="number"
                  placeholder="50000"
                  value={kilometraje}
                  onChange={(e) => setKilometraje(e.target.value)}
                  min="0"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ubicacionActual">
                  Ubicación Actual <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ubicacionActual"
                  placeholder="Base Central"
                  value={ubicacionActual}
                  onChange={(e) => setUbicacionActual(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Programa de Mantenimiento */}
        <Card>
          <CardHeader>
            <CardTitle>Programa de Mantenimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ultimoMantenimiento">Último Mantenimiento (opcional)</Label>
                <Input
                  id="ultimoMantenimiento"
                  type="date"
                  value={ultimoMantenimiento}
                  onChange={(e) => setUltimoMantenimiento(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="proximoMantenimiento">Próximo Mantenimiento (opcional)</Label>
                <Input
                  id="proximoMantenimiento"
                  type="date"
                  value={proximoMantenimiento}
                  onChange={(e) => setProximoMantenimiento(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            <Save className="size-4 mr-2" />
            {guardando 
              ? 'Guardando...' 
              : modo === 'crear' 
                ? 'Crear Vehículo' 
                : 'Guardar Cambios'
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
