/**
 * PRINT PAGE SHELL
 * Wrapper enterprise para páginas de impresión/visualización especial
 * 
 * Features:
 * - Barra de acciones sticky estable (sin huecos blancos al scroll)
 * - Print-safe: oculta acciones en impresión
 * - Responsive y dark mode compatible
 * - Reutilizable para múltiples vistas
 * 
 * NOTA IMPORTANTE sobre layout:
 * Este componente se usa en rutas especiales donde App.tsx NO aplica:
 * - Sidebar (ocultado)
 * - Topbar (ocultado)
 * - Margen/padding del <main> (desactivado)
 * 
 * Por lo tanto, el sticky usa top-0 (se pega al top del viewport directamente).
 * 
 * CHANGELOG v2.1 (Estabilización Final):
 * - Sticky bar con altura fija (no empuja contenido al scrollear)
 * - Contenido sin padding-top extra (sticky overlay sobre contenido)
 * - Print styles mejorados para ocultar completamente la UI del ERP
 * - Sin "jump" visual al hacer scroll
 */

import { ReactNode } from 'react';

interface PrintPageShellProps {
  /**
   * Contenido principal a mostrar/imprimir
   */
  children: ReactNode;
  
  /**
   * Acciones (botones) a mostrar en pantalla (NO en impresión)
   * Se renderizan en la barra superior sticky
   */
  actions?: ReactNode;
  
  /**
   * Si true, el contenido usa fondo blanco forzado (útil para print views)
   * También aplica bg-white a la barra sticky para consistencia visual
   * @default false
   */
  forcedWhiteBackground?: boolean;
  
  /**
   * Si true, centra el contenido verticalmente
   * @default false
   */
  centerContent?: boolean;
}

/**
 * Altura de la barra de acciones sticky (en px)
 * Centralizada para evitar valores mágicos
 */
const ACTIONS_BAR_HEIGHT = 64;

export function PrintPageShell({ 
  children, 
  actions, 
  forcedWhiteBackground = false,
  centerContent = false
}: PrintPageShellProps) {
  // Background consistente: white si forcedWhiteBackground, sino theme background
  const shellBg = forcedWhiteBackground ? 'bg-white' : 'bg-background';
  
  return (
    <>
      {/* Estilos de impresión globales para este componente */}
      <style>{`
        @media print {
          /* Ocultar TODA la UI del ERP en impresión */
          .print-shell-actions,
          header,
          aside,
          .sidebar,
          .topbar {
            display: none !important;
          }
          
          /* Resetear márgenes/padding del contenido para impresión */
          .print-shell-content {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Fondo blanco para impresión */
          body, html {
            background: white !important;
          }
          
          /* Evitar saltos de página dentro de elementos importantes */
          .print-shell-content > * {
            page-break-inside: avoid;
          }
        }
        
        /* En pantalla: asegurar que el sticky no cree huecos */
        @media screen {
          .print-shell-actions {
            /* Sticky para que se mantenga visible al scroll */
            position: sticky;
            top: 0;
            /* Z-index alto para estar sobre el contenido */
            z-index: 20;
          }
        }
      `}</style>

      {/* Container principal */}
      <div className={`min-h-screen ${shellBg}`}>
        {/* Barra de acciones sticky - solo en pantalla */}
        {actions && (
          <div 
            className={`print-shell-actions ${shellBg} border-b border-border shadow-sm`}
            style={{ height: `${ACTIONS_BAR_HEIGHT}px` }}
          >
            <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="h-full flex items-center justify-between gap-4">
                {actions}
              </div>
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <div 
          className={`print-shell-content ${centerContent ? 'flex items-center justify-center min-h-[calc(100vh-64px)]' : ''}`}
        >
          {children}
        </div>
      </div>
    </>
  );
}