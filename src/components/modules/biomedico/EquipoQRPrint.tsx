/**
 * EQUIPO QR PRINT
 * Layout de impresión optimizado para QR del equipo biomédico
 * Usa PrintPageShell enterprise para layout correcto
 */

import { QrCode, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { PrintPageShell } from '../../layout/PrintPageShell';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { generateEquipoQRUrl } from '../../../lib/biomedico/equipo-public';

interface EquipoQRPrintProps {
  codigoEquipo: string;
  onNavigate: (route: string) => void;
}

export function EquipoQRPrint({ codigoEquipo, onNavigate }: EquipoQRPrintProps) {
  const { obtenerEquipoPorCodigo } = useEquiposStore();
  const equipo = obtenerEquipoPorCodigo(codigoEquipo);

  if (!equipo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <QrCode className="size-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-semibold mb-2">Equipo no encontrado</h2>
          <Button onClick={() => onNavigate('/biomedico/equipos')}>
            Volver a Equipos
          </Button>
        </div>
      </div>
    );
  }

  const publicUrl = equipo.publicToken
    ? generateEquipoQRUrl(equipo.publicToken)
    : '#';

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
            onClick={() => onNavigate(`/biomedico/equipos/${codigoEquipo}`)}
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
      <div className="max-w-2xl mx-auto p-8 text-center">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#0A66C2' }}>
            Memphis ERP
          </h1>
          <p className="text-xl text-gray-600">
            Gestión de Equipos Biomédicos
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

        {/* Información del equipo */}
        <div className="mb-8 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">CÓDIGO DEL EQUIPO</p>
            <p className="text-5xl font-bold tracking-wide" style={{ color: '#111827' }}>
              {equipo.codigo}
            </p>
          </div>

          <div className="mt-2">
            <p className="text-2xl font-semibold text-gray-700">{equipo.nombre}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mt-6">
            <div>
              <p className="text-sm text-gray-500">Marca</p>
              <p className="font-semibold text-lg">{equipo.marca}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Modelo</p>
              <p className="font-semibold text-lg">{equipo.modelo}</p>
            </div>
            {equipo.serie && (
              <div>
                <p className="text-sm text-gray-500">Serie</p>
                <p className="font-semibold text-lg">{equipo.serie}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Categoría</p>
              <p className="font-semibold text-lg capitalize">{equipo.categoria.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-6">
          <p className="text-lg font-semibold mb-2" style={{ color: '#0A66C2' }}>
            Escanea para ver la ficha técnica del equipo
          </p>
          <p className="text-sm text-gray-600">
            Apunta la cámara de tu smartphone al código QR para acceder a la información completa del equipo.
          </p>
        </div>

        {/* URL */}
        <div className="border-t-2 border-gray-200 pt-6">
          <p className="text-xs text-gray-500 mb-2">URL del equipo:</p>
          <p className="text-sm font-mono text-gray-700 break-all">{publicUrl}</p>
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
            Memphis ERP — Gestión Empresarial Multi-Tenant
          </p>
        </div>
      </div>
    </PrintPageShell>
  );
}
