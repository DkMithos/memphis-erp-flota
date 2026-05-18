/**
 * EQUIPO QR SECTION
 * Sección de código QR para detalle de equipo biomédico
 * Genera QR que apunta a vista pública del equipo usando TOKEN
 */

import { QrCode, Eye, Printer, ShieldAlert, ShieldCheck, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { generateEquipoQRUrl } from '../../../lib/biomedico/equipo-public';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { toast } from 'sonner';

interface EquipoQRSectionProps {
  codigoEquipo: string;
  onNavigate: (route: string) => void;
}

export function EquipoQRSection({ codigoEquipo, onNavigate }: EquipoQRSectionProps) {
  const { obtenerEquipoPorCodigo, togglePublicView } = useEquiposStore();
  const equipo = obtenerEquipoPorCodigo(codigoEquipo);

  if (!equipo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300">
              No se pudo cargar la información del equipo. Código: {codigoEquipo}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si no tiene token (DB no ha sido migrada aún), mostrar mensaje
  if (!equipo.publicToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              El QR público no está disponible. Ejecute la migración de base de datos para habilitar esta funcionalidad.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const publicUrl = generateEquipoQRUrl(equipo.publicToken);
  const printUrl = `/biomedico/equipos/${codigoEquipo}/print-qr`;
  const isPublicViewEnabled = equipo.publicViewEnabled;

  const handleTogglePublicView = async () => {
    const result = await togglePublicView(codigoEquipo);
    if (result.exito) {
      toast.success(isPublicViewEnabled ? 'Vista pública deshabilitada' : 'Vista pública habilitada');
    } else {
      toast.error('Error al cambiar vista pública');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('URL copiada', {
        description: 'La URL pública ha sido copiada al portapapeles'
      });
    } catch {
      toast.error('Error al copiar');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Código QR del Equipo
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
              <Label htmlFor="equipo-public-view-toggle" className="text-sm font-medium cursor-pointer">
                Vista pública habilitada
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPublicViewEnabled
                  ? 'El QR permite acceso público a información del equipo'
                  : 'El QR está deshabilitado y no mostrará información'
                }
              </p>
            </div>
          </div>
          <Switch
            id="equipo-public-view-toggle"
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
                  El código QR no mostrará información del equipo mientras esté deshabilitado.
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
              <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border">
                <QRCodeWrapper
                  value={publicUrl}
                  size={180}
                  level="M"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Escanea para ver la ficha técnica
              </p>
            </div>

            {/* Información y acciones */}
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="font-semibold mb-2">URL Pública</h4>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm break-all">{publicUrl}</code>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Este QR permite acceder a la ficha técnica del equipo <strong>{equipo.nombre}</strong> sin inicio de sesión.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Información expuesta:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Identificación (código, marca, modelo, serie)</li>
                  <li>• Categoría y nivel de riesgo</li>
                  <li>• Estado operativo actual</li>
                  <li>• Ubicación y servicio clínico</li>
                  <li>• Fechas de mantenimiento y calibración</li>
                  <li>• Estado de garantía (sin montos)</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  onClick={() => onNavigate(`/e/${equipo.publicToken}`)}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="size-4" />
                  Ver Vista Pública
                </Button>
                <Button
                  onClick={() => onNavigate(printUrl)}
                  variant="outline"
                  className="flex-1"
                >
                  <Printer className="size-4" />
                  Imprimir QR
                </Button>
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="size-4" />
                  Copiar URL
                </Button>
              </div>
            </div>
          </div>
        )}

        {isPublicViewEnabled && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Tip:</strong> Imprime este QR y pégalo en el equipo para facilitar el acceso a su ficha técnica desde dispositivos móviles.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
