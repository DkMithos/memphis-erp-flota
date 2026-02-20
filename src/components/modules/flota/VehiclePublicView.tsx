/**
 * VEHICLE PUBLIC VIEW
 * Controlador de ruta /v/:token
 * Verifica token, publicViewEnabled y renderiza VehiclePublicLifeSheet
 */

import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { VehiclePublicLifeSheet } from './VehiclePublicLifeSheet';

interface VehiclePublicViewProps {
  token: string;
  onNavigate?: (route: string) => void;
}

export function VehiclePublicView({ token, onNavigate }: VehiclePublicViewProps) {
  const { obtenerVehiculoPorToken } = useVehiculos();

  // Buscar vehículo por token
  const vehiculo = obtenerVehiculoPorToken(token);

  // ========================================================================
  // ESTADOS DE ERROR
  // ========================================================================

  // Token no existe
  if (!vehiculo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="size-16 mx-auto mb-4 text-red-500" />
              <h2 className="text-2xl font-semibold mb-2">Vehículo no encontrado</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                El código QR escaneado no corresponde a ningún vehículo registrado en el sistema.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Token: <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{token}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista pública deshabilitada
  if (vehiculo.publicViewEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <Lock className="size-16 mx-auto mb-4 text-amber-500" />
              <h2 className="text-2xl font-semibold mb-2">Vista pública deshabilitada</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                El acceso público a la información de este vehículo ha sido deshabilitado temporalmente.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Placa:</strong> {vehiculo.placa}
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Marca:</strong> {vehiculo.marca} {vehiculo.modelo}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Si necesita acceso a la información del vehículo, contacte al administrador del sistema.
              </p>
              {onNavigate && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => onNavigate('/')}
                >
                  Volver al Inicio
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========================================================================
  // RENDER: VISTA PÚBLICA HABILITADA
  // ========================================================================

  return <VehiclePublicLifeSheet vehiculo={vehiculo} />;
}
