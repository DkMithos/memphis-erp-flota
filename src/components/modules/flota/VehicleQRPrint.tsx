/**
 * VEHICLE QR PRINT
 * Layout de impresión optimizado para QR del vehículo
 * Usa PrintPageShell enterprise para layout correcto
 * ACTUALIZADO: USA TOKEN PÚBLICO en lugar de ID
 */

import { QrCode, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';
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
          <Button 
            variant="outline" 
            onClick={() => onNavigate(`/flota/vehiculos/${vehiculoId}`)}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
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
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#0A66C2' }}>
            Memphis ERP
          </h1>
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
            />
          </div>
        </div>

        {/* Información del vehículo */}
        <div className="mb-8 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">PLACA DEL VEHÍCULO</p>
            <p className="text-6xl font-bold tracking-wide" style={{ color: '#111827' }}>
              {vehiculo.placa}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mt-6">
            <div>
              <p className="text-sm text-gray-500">Marca</p>
              <p className="font-semibold text-lg">{vehiculo.marca}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Modelo</p>
              <p className="font-semibold text-lg">{vehiculo.modelo}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Año</p>
              <p className="font-semibold text-lg">{vehiculo.año}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo</p>
              <p className="font-semibold text-lg capitalize">{vehiculo.tipo}</p>
            </div>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-6">
          <p className="text-lg font-semibold mb-2" style={{ color: '#0A66C2' }}>
            📱 Escanea para ver la hoja de vida del vehículo
          </p>
          <p className="text-sm text-gray-600">
            Apunta la cámara de tu smartphone al código QR para acceder a la información completa del vehículo.
          </p>
        </div>

        {/* URL (para referencia) */}
        <div className="border-t-2 border-gray-200 pt-6">
          <p className="text-xs text-gray-500 mb-2">URL del vehículo:</p>
          <p className="text-sm font-mono text-gray-700 break-all">
            {publicUrl}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Documento generado el {new Date().toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Memphis ERP - Gestión Empresarial Multi-Tenant
          </p>
        </div>
      </div>
    </PrintPageShell>
  );
}