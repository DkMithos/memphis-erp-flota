/**
 * VEHICLE QR SECTION
 * Sección de código QR para detalle de vehículo
 * Genera QR que apunta a vista pública del vehículo usando TOKEN (no ID)
 */

import { useEffect } from 'react';
import { QrCode, Eye, Printer, ShieldAlert, ShieldCheck, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { generateVehicleQRUrl } from '../../../lib/flota/vehicle-public';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { toast } from 'sonner';

interface VehicleQRSectionProps {
  vehiculoId: string;
  placa: string;
  onNavigate: (route: string) => void;
}

export function VehicleQRSection({ vehiculoId, placa, onNavigate }: VehicleQRSectionProps) {
  const { obtenerVehiculo, actualizarVehiculo, ensurePublicToken } = useVehiculos();
  const vehiculo = obtenerVehiculo(vehiculoId);

  // Si no hay vehículo, mostrar error (edge case)
  if (!vehiculo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del Vehículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300">
              No se pudo cargar la información del vehículo. ID: {vehiculoId}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ✅ GARANTIZAR TOKEN: Si no existe, generarlo automáticamente (idempotente)
  useEffect(() => {
    if (!vehiculo.publicToken) {
      ensurePublicToken(vehiculoId);
    }
  }, [vehiculoId, vehiculo.publicToken, ensurePublicToken]);

  // Si aún no tiene token (primera renderización), mostrar loading
  if (!vehiculo.publicToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del Vehículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Generando código QR del vehículo...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generar URL pública del vehículo usando TOKEN (NO ID)
  const publicUrl = generateVehicleQRUrl(vehiculo.publicToken);
  const printUrl = `/flota/vehiculos/${vehiculoId}/print-qr`;
  
  // ✅ NORMALIZAR: publicViewEnabled = true si es undefined (para vehículos antiguos)
  const isPublicViewEnabled = vehiculo.publicViewEnabled ?? true;

  const handleTogglePublicView = () => {
    actualizarVehiculo(vehiculoId, {
      publicViewEnabled: !isPublicViewEnabled
    });
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('URL copiada', {
        description: 'La URL pública ha sido copiada al portapapeles'
      });
    } catch (error) {
      toast.error('Error al copiar', {
        description: 'No se pudo copiar la URL al portapapeles'
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del Vehículo
          </CardTitle>
          <Badge variant="outline">Trazabilidad</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Control de habilitación */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {isPublicViewEnabled ? (
              <ShieldCheck className="size-5 text-green-600" />
            ) : (
              <ShieldAlert className="size-5 text-amber-600" />
            )}
            <div>
              <Label htmlFor="public-view-toggle" className="text-sm font-medium cursor-pointer">
                Vista pública habilitada
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPublicViewEnabled 
                  ? 'El QR permite acceso público a información del vehículo'
                  : 'El QR está deshabilitado y no mostrará información'
                }
              </p>
            </div>
          </div>
          <Switch
            id="public-view-toggle"
            checked={isPublicViewEnabled}
            onCheckedChange={handleTogglePublicView}
          />
        </div>

        {!isPublicViewEnabled && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="size-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Vista pública deshabilitada
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  El código QR no mostrará información del vehículo mientras esté deshabilitado. 
                  Los usuarios que escaneen el QR verán un mensaje indicando que el acceso no está disponible.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTogglePublicView}
                  className="mt-2 border-amber-300 dark:border-amber-700"
                >
                  Habilitar Vista Pública
                </Button>
              </div>
            </div>
          </div>
        )}

        {isPublicViewEnabled && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <QRCodeWrapper
                  value={publicUrl}
                  size={180}
                  level="M"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Escanea para ver la hoja de vida
              </p>
            </div>

            {/* Información y acciones */}
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="font-semibold mb-2">URL Pública</h4>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm break-all">
                    {publicUrl}
                  </code>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Este QR permite acceder a la información pública del vehículo <strong>{placa}</strong> sin necesidad de inicio de sesión.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Información expuesta:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Identificación básica (placa, marca, modelo)</li>
                  <li>• Estado operativo actual</li>
                  <li>• Mantenimiento preventivo (totales, usados, restantes)</li>
                  <li>• Documentación con vencimientos</li>
                  <li>• Historial resumido (sin costos)</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  onClick={() => onNavigate(`/v/${vehiculo.publicToken}`)}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="size-4 mr-2" />
                  Ver Vista Pública
                </Button>
                <Button
                  onClick={() => onNavigate(printUrl)}
                  variant="outline"
                  className="flex-1"
                >
                  <Printer className="size-4 mr-2" />
                  Imprimir QR
                </Button>
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="size-4 mr-2" />
                  Copiar URL
                </Button>
              </div>
            </div>
          </div>
        )}

        {isPublicViewEnabled && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>💡 Tip:</strong> Imprime este QR y pégalo en el vehículo para facilitar el acceso a su hoja de vida desde dispositivos móviles.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}