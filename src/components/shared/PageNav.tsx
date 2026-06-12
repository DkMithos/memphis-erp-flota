/**
 * PageNav — Navegación superior unificada (Home + Volver)
 * Patrón consistente para todas las secciones del sistema:
 *   [🏠 Home] [← Volver]
 *
 * Home: navega a /home (Inicio)
 * Volver: usa window.history.back() para respetar el origen real
 *
 * Permite override de ambos handlers si se necesita (formularios con onCancel custom, etc.)
 */
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

interface PageNavProps {
  onHome?: () => void;
  onBack?: () => void;
  className?: string;
}

export function PageNav({ onHome, onBack, className = '' }: PageNavProps) {
  const handleHome = onHome ?? (() => {
    window.history.pushState({}, '', '/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const handleBack = onBack ?? (() => window.history.back());

  return (
    <div className={`flex items-center gap-1 -ml-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleHome}
        aria-label="Inicio"
        className="hover:!bg-black hover:!text-white"
      >
        <Home className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="hover:!bg-black hover:!text-white"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Button>
    </div>
  );
}
