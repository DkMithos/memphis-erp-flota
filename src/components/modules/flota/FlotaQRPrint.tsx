/**
 * FLOTA QR PRINT — Exporta/imprime todos los QR de los vehículos de una flota.
 * Ruta interna (con providers) /flota/flotas/:codigo/qr, renderizada "bare"
 * (sin sidebar) vía isSpecialRoute. Pensado para imprimir a PDF y enviar a
 * imprimir las etiquetas QR de toda la flota de una vez.
 */
import { QrCode, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { PrintPageShell } from '../../layout/PrintPageShell';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useFlotas } from '../../../lib/flota/flotas-store';
import { generateVehicleQRUrl } from '../../../lib/flota/vehicle-public';

interface Props {
  codigo: string;
  onNavigate: (route: string) => void;
}

export function FlotaQRPrint({ codigo, onNavigate }: Props) {
  const { obtenerFlota, loading } = useFlotas();
  const { vehiculos, loading: loadingVeh } = useVehiculos();

  const flota = obtenerFlota(codigo);
  const delaFlota = flota
    ? vehiculos.filter(v => v.flotaId === flota.id && v.estado !== 'inactivo')
    : [];
  const conQR = delaFlota.filter(v => v.publicToken);
  const sinQR = delaFlota.length - conQR.length;

  if (loading || loadingVeh) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!flota) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <QrCode className="size-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-semibold mb-2">Flota no encontrada</h2>
          <Button onClick={() => onNavigate('/flota/flotas')}>Volver a Flotas</Button>
        </div>
      </div>
    );
  }

  return (
    <PrintPageShell
      forcedWhiteBackground
      actions={
        <>
          <PageNav />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {flota.codigo} · {conQR.length} QR
            </span>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimir / Exportar PDF
            </Button>
          </div>
        </>
      }
    >
      {/* Estilos de impresión: cada etiqueta no se parte entre páginas */}
      <style>{`
        @media print {
          .qr-grid { page-break-inside: auto !important; }
          .qr-card { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto p-6">
        {/* Encabezado */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#0A66C2' }}>Memphis Maquinarias</h1>
          <p className="text-lg font-semibold">{flota.nombre}</p>
          <p className="text-sm text-gray-500">
            Códigos QR de la flota {flota.codigo} · {conQR.length} vehículo(s)
          </p>
        </div>

        {sinQR > 0 && (
          <div className="print:hidden mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            {sinQR} vehículo(s) de esta flota no tienen QR generado y no se incluyen.
          </div>
        )}

        {conQR.length === 0 ? (
          <p className="text-center py-12 text-gray-500">Esta flota no tiene vehículos con QR.</p>
        ) : (
          <div className="qr-grid grid grid-cols-2 sm:grid-cols-3 gap-4">
            {conQR.map(v => (
              <div
                key={v.id}
                className="qr-card border-2 border-gray-200 rounded-lg p-4 flex flex-col items-center text-center bg-white"
              >
                <div className="p-2 bg-white">
                  <QRCodeWrapper value={generateVehicleQRUrl(v.publicToken!)} size={150} level="H" />
                </div>
                <p className="text-2xl font-bold mt-3 tracking-wide" style={{ color: '#111827' }}>
                  {v.placa || '—'}
                </p>
                <p className="text-sm text-gray-600 mt-0.5 leading-tight">
                  {v.marca} {v.modelo}
                </p>
                <div className="text-xs text-gray-500 mt-1 space-x-2">
                  {v.numeroPadron && <span>Padrón {v.numeroPadron}</span>}
                  <span className="font-mono">{v.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8 pt-4 border-t text-xs text-gray-400">
          Escanea cada QR para ver la hoja pública del vehículo · Memphis ERP
        </div>
      </div>
    </PrintPageShell>
  );
}
