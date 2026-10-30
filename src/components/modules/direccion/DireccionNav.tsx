/** Pestañas de Dirección: Resumen · Proyectos (margen y compromiso) · Flujo de caja · OKRs. */
import { Gauge, TrendingUp, Wallet, Target } from 'lucide-react';
import { Button } from '../../ui/button';

const PESTANAS = [
  { href: '/direccion', label: 'Resumen', icon: <Gauge className="size-4" /> },
  { href: '/direccion/proyectos', label: 'Proyectos', icon: <TrendingUp className="size-4" /> },
  { href: '/direccion/flujo', label: 'Flujo de caja', icon: <Wallet className="size-4" /> },
  { href: '/direccion/okrs', label: 'OKRs', icon: <Target className="size-4" /> },
];

export function DireccionNav({ actual, onNavigate }: { actual: string; onNavigate?: (ruta: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b pb-2">
      {PESTANAS.map(p => (
        <Button key={p.href} size="sm" variant={actual === p.href ? 'default' : 'ghost'} onClick={() => onNavigate?.(p.href)}>
          {p.icon} {p.label}
        </Button>
      ))}
    </div>
  );
}
