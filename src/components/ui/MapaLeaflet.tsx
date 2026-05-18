/**
 * MapaLeaflet — componente de mapa reutilizable con react-leaflet v4
 * Fix del icono default de Leaflet para Vite bundler.
 */
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// ── Fix iconos Leaflet + Vite ─────────────────────────────────────────────────
// Leaflet busca los íconos por URL relativa que Vite no resuelve automáticamente.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Íconos de colores ─────────────────────────────────────────────────────────
function makeIcon(color: 'green' | 'yellow' | 'red' | 'blue' | 'orange') {
  const colorMap = {
    green:  '#22c55e',
    yellow: '#eab308',
    red:    '#ef4444',
    blue:   '#3b82f6',
    orange: '#f97316',
  };
  const hex = colorMap[color];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${hex}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

export const iconVerde   = makeIcon('green');
export const iconAmarillo = makeIcon('yellow');
export const iconRojo    = makeIcon('red');
export const iconAzul    = makeIcon('blue');
export const iconNaranja = makeIcon('orange');

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface MapaMarcador {
  id: string;
  lat: number;
  lng: number;
  icon?: L.DivIcon | L.Icon;
  popupContent: React.ReactNode;
}

interface MapaLeafletProps {
  marcadores: MapaMarcador[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  className?: string;
}

// ── Sub-componente para ajustar bounds ────────────────────────────────────────
function FitBounds({ marcadores }: { marcadores: MapaMarcador[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || marcadores.length === 0) return;
    if (marcadores.length === 1) {
      map.setView([marcadores[0].lat, marcadores[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(marcadores.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    fitted.current = true;
  }, [map, marcadores]);

  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export function MapaLeaflet({
  marcadores,
  center = [-9.19, -75.01], // centro de Perú
  zoom = 6,
  height = '400px',
  className = '',
}: MapaLeafletProps) {
  return (
    <div style={{ height }} className={`rounded-lg overflow-hidden border ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {marcadores.length > 0 && <FitBounds marcadores={marcadores} />}
        {marcadores.map(m => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={m.icon ?? iconAzul}
          >
            <Popup>{m.popupContent}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
