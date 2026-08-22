/**
 * FLOTA QR PRINT — Hoja de STICKERS QR de 10x10 cm para pegar en el parabrisas.
 * Ruta interna (con providers), renderizada "bare" (sin sidebar) vía isSpecialRoute:
 *   /flota/flotas/:codigo/qr  → los QR de UNA flota
 *   /flota/qr                 → TODOS los QR, agrupados por flota
 *
 * Cada etiqueta mide exactamente 100x100 mm con borde de corte; en A4 entran
 * 4 por página (2x2). Al escanear se abre el menú del vehículo (datos / portal).
 */
import { useState } from 'react';
import { QrCode, Printer, AlertTriangle, Layers } from 'lucide-react';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { QRCodeWrapper } from '../../shared/QRCodeWrapper';
import { PrintPageShell } from '../../layout/PrintPageShell';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useFlotas } from '../../../lib/flota/flotas-store';
import { generateVehicleQRUrl } from '../../../lib/flota/vehicle-public';
import type { Vehiculo } from '../../../lib/flota/vehiculos-config';

interface Props {
  /** Si viene, imprime solo esa flota; si no, TODAS agrupadas por flota */
  codigo?: string | null;
  onNavigate: (route: string) => void;
}

/** Etiqueta de 100x100 mm: logo + QR + placa. */
function Sticker({ v }: { v: Vehiculo }) {
  return (
    <div className="qr-card">
      <img src="/logo-memphis.svg" alt="Memphis Maquinarias" className="qr-logo" />
      <div className="qr-code">
        <QRCodeWrapper value={generateVehicleQRUrl(v.publicToken!)} size={230} level="H" conLogo />
      </div>
      {/* Si la placa está en trámite se muestra el VIN (letra más chica: es largo) */}
      {v.placa
        ? <p className="qr-placa">{v.placa}</p>
        : <>
            <p className="qr-etiqueta">VIN</p>
            <p className="qr-vin">{v.vin || v.numeroPadron || v.id}</p>
          </>}
      {v.numeroPadron && <p className="qr-padron">Padrón {v.numeroPadron}</p>}
    </div>
  );
}

export function FlotaQRPrint({ codigo, onNavigate }: Props) {
  const { flotas, obtenerFlota, loading } = useFlotas();
  const { vehiculos, loading: loadingVeh } = useVehiculos();

  const conQRDe = (flotaId: string) =>
    vehiculos.filter(v => v.flotaId === flotaId && v.estado !== 'inactivo' && v.publicToken);

  const flotaUnica = codigo ? obtenerFlota(codigo) : null;

  // Selector de flota en la propia pantalla: si se entró por /flota/flotas/X/qr
  // arranca en esa flota; si se entró por /flota/qr, en "todas".
  const [filtro, setFiltro] = useState<string>(codigo ?? 'todas');

  // Flotas con al menos un QR imprimible (para el selector y para el listado)
  const conteoPorFlota = flotas
    .map(f => ({ flota: f, veh: conQRDe(f.id) }))
    .filter(g => g.veh.length > 0);

  const grupos = filtro === 'todas'
    ? conteoPorFlota
    : conteoPorFlota.filter(g => g.flota.codigo === filtro);

  const totalQR = grupos.reduce((s, g) => s + g.veh.length, 0);
  const flotaSel = filtro === 'todas' ? null : flotas.find(f => f.codigo === filtro);
  const universo = flotaSel
    ? vehiculos.filter(v => v.flotaId === flotaSel.id && v.estado !== 'inactivo')
    : vehiculos.filter(v => v.flotaId && v.estado !== 'inactivo');
  const totalSinQR = universo.length - totalQR;

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

  const titulo = flotaSel ? flotaSel.nombre : 'Todas las flotas';

  return (
    <PrintPageShell
      forcedWhiteBackground
      actions={
        <>
          <PageNav />
          <div className="flex items-center gap-3">
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-[260px] h-9">
                <Layers className="size-4 mr-1 shrink-0" />
                <SelectValue placeholder="Flota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">
                  Todas las flotas ({conteoPorFlota.reduce((n, g) => n + g.veh.length, 0)})
                </SelectItem>
                {conteoPorFlota.map(g => (
                  <SelectItem key={g.flota.id} value={g.flota.codigo}>
                    {g.flota.codigo} — {g.flota.nombre} ({g.veh.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {totalQR} etiqueta(s) de 10×10 cm
            </span>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimir / Exportar PDF
            </Button>
          </div>
        </>
      }
    >
      {/* Etiqueta de 100x100 mm exactos: en A4 entran 4 por página (2x2). */}
      <style>{`
        .qr-card {
          width: 100mm; height: 100mm;
          border: 1px dashed #9ca3af;   /* guía de corte */
          box-sizing: border-box;
          padding: 4mm;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: #fff; color: #111827;
          break-inside: avoid; page-break-inside: avoid;
        }
        .qr-logo { height: 9mm; width: auto; margin-bottom: 2mm; }
        .qr-code { line-height: 0; }
        .qr-placa {
          margin-top: 3mm; font-size: 30pt; font-weight: 800;
          letter-spacing: .02em; line-height: 1;
        }
        .qr-padron { font-size: 9pt; color: #6b7280; margin-top: 1mm; }
        .qr-etiqueta { margin-top: 3mm; font-size: 8pt; color: #6b7280; letter-spacing: .08em; }
        .qr-vin { font-size: 15pt; font-weight: 700; line-height: 1.1; word-break: break-all; }
        .qr-grid { display: flex; flex-wrap: wrap; gap: 0; }

        @media print {
          @page { size: A4; margin: 4mm; }
          .qr-fleet-title { break-after: avoid; }
          /* imprime bordes y fondos tal cual */
          .qr-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="mx-auto p-4" style={{ maxWidth: '215mm' }}>
        <div className="text-center mb-4 print:hidden">
          <img src="/logo-memphis.svg" alt="Memphis Maquinarias" className="mx-auto mb-2" style={{ height: 48 }} />
          <p className="text-sm text-gray-500">
            {titulo} · {totalQR} etiqueta(s) de 10×10 cm — 4 por hoja A4
          </p>
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
            <div key={g.flota.id} className="mb-4">
              {filtro === 'todas' && (
                <p className="qr-fleet-title text-sm font-semibold text-gray-700 border-b pb-1 mb-2">
                  {g.flota.codigo} · {g.flota.nombre}{' '}
                  <span className="text-gray-400 font-normal">({g.veh.length})</span>
                </p>
              )}
              <div className="qr-grid">
                {g.veh.map(v => <Sticker key={v.id} v={v} />)}
              </div>
            </div>
          ))
        )}

        <div className="text-center mt-6 pt-3 border-t text-xs text-gray-400 print:hidden">
          Recorta por la línea punteada y pega el sticker en el parabrisas · Memphis ERP
        </div>
      </div>
    </PrintPageShell>
  );
}
