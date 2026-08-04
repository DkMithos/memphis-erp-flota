/**
 * FLOTA QR PRINT — Hoja de STICKERS QR para pegar en los vehículos.
 * Ruta interna (con providers), renderizada "bare" (sin sidebar) vía isSpecialRoute:
 *   /flota/flotas/:codigo/qr  → los QR de UNA flota
 *   /flota/qr                 → TODOS los QR, agrupados por flota
 * Cada QR es una etiqueta de tamaño uniforme con borde de corte, lista para
 * imprimir en papel adhesivo, recortar y pegar (puerta lateral derecha en autos,
 * tanque en motos). Escanear el QR abre la hoja pública del vehículo.
 */
import { QrCode, Printer, AlertTriangle, Bike, Car } from 'lucide-react';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { PrintPageShell } from '../../layout/PrintPageShell';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useFlotas } from '../../../lib/flota/flotas-store';
import { generateVehicleQRUrl } from '../../../lib/flota/vehicle-public';
import type { Vehiculo } from '../../../lib/flota/vehiculos-config';

interface Props {
  /** Si viene, imprime solo esa flota; si no, TODAS agrupadas por flota */
  codigo?: string | null;
  onNavigate: (route: string) => void;
}

function Sticker({ v }: { v: Vehiculo }) {
  const esMoto = v.tipo === 'moto' || v.tipo === 'motocicleta';
  return (
    <div className="qr-card w-[46mm] border border-gray-400 rounded-md p-2 flex flex-col items-center text-center bg-white">
      <QRCodeWrapper value={generateVehicleQRUrl(v.publicToken!)} size={122} level="H" />
      <p className="text-lg font-bold leading-none mt-1.5" style={{ color: '#111827' }}>
        {v.placa || v.numeroPadron || v.id}
      </p>
      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mt-0.5">
        {esMoto ? <Bike className="size-3" /> : <Car className="size-3" />}
        {v.numeroPadron ? <span>Padrón {v.numeroPadron}</span> : <span className="font-mono">{v.id}</span>}
      </div>
    </div>
  );
}

export function FlotaQRPrint({ codigo, onNavigate }: Props) {
  const { flotas, obtenerFlota, loading } = useFlotas();
  const { vehiculos, loading: loadingVeh } = useVehiculos();

  const conQRDe = (flotaId: string) =>
    vehiculos.filter(v => v.flotaId === flotaId && v.estado !== 'inactivo' && v.publicToken);

  // Flotas a imprimir: una sola (si viene codigo) o todas las que tengan QR
  const flotaUnica = codigo ? obtenerFlota(codigo) : null;
  const grupos = (codigo ? (flotaUnica ? [flotaUnica] : []) : flotas)
    .map(f => ({ flota: f, veh: conQRDe(f.id) }))
    .filter(g => g.veh.length > 0);

  const totalQR = grupos.reduce((s, g) => s + g.veh.length, 0);
  const totalSinQR = (codigo && flotaUnica ? vehiculos.filter(v => v.flotaId === flotaUnica.id && v.estado !== 'inactivo') : vehiculos.filter(v => v.flotaId && v.estado !== 'inactivo')).length - totalQR;

  if (loading || loadingVeh) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  if (codigo && !flotaUnica) {
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

  const titulo = codigo && flotaUnica ? flotaUnica.nombre : 'Todas las flotas';

  return (
    <PrintPageShell
      forcedWhiteBackground
      actions={
        <>
          <PageNav />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{totalQR} etiqueta(s)</span>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimir / Exportar PDF
            </Button>
          </div>
        </>
      }
    >
      <style>{`
        @media print {
          .qr-grid { page-break-inside: auto !important; }
          .qr-card { page-break-inside: avoid !important; break-inside: avoid !important; }
          .qr-fleet-title { break-after: avoid; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto p-6">
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#0A66C2' }}>Memphis Maquinarias · Etiquetas QR</h1>
          <p className="text-sm text-gray-500">{titulo} · {totalQR} vehículo(s)</p>
        </div>

        {totalSinQR > 0 && (
          <div className="print:hidden mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            {totalSinQR} vehículo(s) sin QR generado no se incluyen.
          </div>
        )}

        {grupos.length === 0 ? (
          <p className="text-center py-12 text-gray-500">No hay vehículos con QR para imprimir.</p>
        ) : (
          grupos.map(g => (
            <div key={g.flota.id} className="mb-6">
              {/* Título de flota solo cuando se imprimen varias */}
              {!codigo && (
                <p className="qr-fleet-title text-sm font-semibold text-gray-700 border-b pb-1 mb-3">
                  {g.flota.codigo} · {g.flota.nombre} <span className="text-gray-400 font-normal">({g.veh.length})</span>
                </p>
              )}
              <div className="qr-grid flex flex-wrap gap-2 justify-start">
                {g.veh.map(v => <Sticker key={v.id} v={v} />)}
              </div>
            </div>
          ))
        )}

        <div className="text-center mt-6 pt-3 border-t text-xs text-gray-400">
          Recorta por el borde y pega el sticker · autos: puerta lateral derecha (interior) · motos: tanque · Memphis ERP
        </div>
      </div>
    </PrintPageShell>
  );
}
