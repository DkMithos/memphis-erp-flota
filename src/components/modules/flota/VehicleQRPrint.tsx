/**
 * VEHICLE QR PRINT
 * Layout de impresión optimizado para QR del vehículo
 * Usa PrintPageShell enterprise para layout correcto
 * ACTUALIZADO: USA TOKEN PÚBLICO en lugar de ID
 */

import { QrCode, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { PrintPageShell } from '../../layout/PrintPageShell';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { generateVehicleQRUrl } from '../../../lib/flota/vehicle-public';

interface VehicleQRPrintProps {
  vehiculoId: string;
  onNavigate: (route: string) => void;
}

export function VehicleQRPrint({ vehiculoId, onNavigate }: VehicleQRPrintProps) {
  const { obtenerVehiculo } = useVehiculos();
  const vehiculo = obtenerVehiculo(vehiculoId);

  if (!vehiculo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <QrCode className="size-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-semibold mb-2">Vehículo no encontrado</h2>
          <Button onClick={() => onNavigate('/flota/vehiculos')}>
            Volver a Vehículos
          </Button>
        </div>
      </div>
    );
  }

  // IMPORTANTE: Usar token público, no ID interno
  const publicUrl = vehiculo.publicToken 
    ? generateVehicleQRUrl(vehiculo.publicToken)
    : '#'; // Fallback si no tiene token

  const handlePrint = () => {
    window.print();
  };

  return (
    <PrintPageShell
      forcedWhiteBackground={true}
      actions={
        <>
          <PageNav />
          <Button onClick={handlePrint}>
            <Printer className="size-4" />
            Imprimir
          </Button>
        </>
      }
    >
      {/* Contenido a imprimir */}
      <div className="max-w-2xl mx-auto p-8 text-center">
        {/* Logo/Header */}
        <div className="mb-8">
          <img
            src="/logo-memphis.svg"
            alt="Memphis Maquinarias"
            className="mx-auto mb-3"
            style={{ height: 72, width: 'auto' }}
          />
          <p className="text-xl text-gray-600">
            Sistema de Gestión de Flota
          </p>
        </div>

        {/* QR Code */}
        <div className="mb-8 flex justify-center">
          <div className="bg-white dark:bg-gray-900 p-6 border-4 border-gray-200 rounded-lg inline-block">
            <QRCodeWrapper
              value={publicUrl}
              size={320}
              level="H"
              conLogo
            />
          </div>
        </div>

        {/* Información del vehículo */}
        <div className="mb-8 space-y-4">
          <div>
            {/* Placa en trámite → se identifica por VIN */}
            <p className="text-sm text-gray-500 mb-1">
              {vehiculo.placa ? 'PLACA DEL VEHÍCULO' : 'VIN'}
            </p>
            <p
              className={`font-bold tracking-wide ${vehiculo.placa ? 'text-6xl' : 'text-3xl break-all'}`}
              style={{ color: '#111827' }}
            >
              {vehiculo.placa || vehiculo.vin || vehiculo.id}
            </p>
          </div>

        </div>

      </div>
    </PrintPageShell>
  );
}