/**
 * Memphis ERP — LoadingScreen
 * Pantalla de carga inicial con logo geométrico de la plataforma.
 * Usa el ícono Memphis (pirámide/M dorada) como identidad visual de marca.
 */
import { MemphisIconSVG, PLATFORM } from '../../lib/config/branding';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      {/* Ícono Memphis animado */}
      <div className="relative flex flex-col items-center gap-4">
        {/* Ring spinner */}
        <div className="relative size-20">
          <div className="absolute inset-0 rounded-full border-4 border-amber-200/30 dark:border-amber-700/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#F8C119] animate-spin" />
          {/* Ícono geométrico centrado */}
          <div className="absolute inset-2 flex items-center justify-center">
            <MemphisIconSVG className="size-10" />
          </div>
        </div>

        {/* Nombre y mensaje */}
        <div className="text-center space-y-1">
          <p className="text-base font-bold tracking-tight text-foreground">
            {PLATFORM.name}
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>

      {/* Dots pulsantes */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="size-1.5 rounded-full bg-[#F8C119]/60 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Spinner inline pequeño para usar dentro de botones o secciones */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin size-4 text-current ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
