import * as React from 'react';

/**
 * Oculta contenido visualmente pero lo mantiene accesible para lectores de
 * pantalla. Útil para satisfacer requisitos de accesibilidad (p. ej. un
 * DialogTitle/SheetTitle obligatorio) sin alterar el diseño visual.
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  );
}
