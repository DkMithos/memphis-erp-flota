/** Dirección › Proyectos: el tablero de margen, compromiso por proyecto, áreas y proveedores (reutiliza Flujo Gerencia). */
import { FlujoGerencia } from '../bi/FlujoGerencia';
import { DireccionNav } from './DireccionNav';

export function DireccionProyectos({ onNavigate }: { onNavigate?: (ruta: string) => void }) {
  return (
    <div className="space-y-5">
      <DireccionNav actual="/direccion/proyectos" onNavigate={onNavigate} />
      <FlujoGerencia />
    </div>
  );
}
