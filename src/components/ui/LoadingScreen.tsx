import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      {/* Logo / Brand */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative size-16">
          {/* Outer ring animated */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          {/* Inner icon */}
          <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-7 text-primary"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Simple truck/fleet icon */}
              <path
                d="M1 3h15v13H1V3zM16 8h4l3 3v5h-7V8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-base font-semibold tracking-tight text-foreground">
            Memphis ERP
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="size-1.5 rounded-full bg-primary/40 animate-pulse"
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
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
