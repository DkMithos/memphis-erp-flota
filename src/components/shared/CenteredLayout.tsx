import React, { useState, useEffect } from 'react';
import { LAYOUT_CONFIG } from '../../../vehiculo-service';
import { cn } from '@/lib/utils';

interface CenteredLayoutProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: '7xl' | '5xl' | 'full';
}

/**
 * Wrapper de alto nivel que asegura que el contenido esté centrado 
 * y respete los márgenes del Design System de Memphis ERP.
 */
export const CenteredLayout: React.FC<CenteredLayoutProps> = ({ 
  children, 
  className,
  maxWidth = '7xl'
}) => {
  const [showGuides, setShowGuides] = useState(false);
  const isDev = import.meta.env.DEV;

  // Shortcut: Alt + G para activar guías de centrado en QA
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'g') setShowGuides(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const widthClass = maxWidth === 'full' ? 'max-w-full' : `max-w-${maxWidth}`;
  
  return (
    <div className={cn(
      widthClass, 
      "relative mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 transition-all",
      showGuides && "ring-1 ring-cyan-500 bg-cyan-50/10",
      className
    )}>
      {showGuides && isDev && (
        <>
          <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-500/50 pointer-events-none" title="Eje Central" />
          <div className="absolute top-0 left-0 bg-cyan-500 text-white text-[10px] px-1 rounded-br">
            QA GUIDE: {maxWidth} Centered
          </div>
        </>
      )}
      {children}
    </div>
  );
};