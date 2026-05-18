/**
 * SIMPLE QR - Fallback component cuando react-qr-code no está disponible
 * Muestra un placeholder visual + URL copiable
 */

import { QrCode, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';

interface SimpleQRProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
}

export function SimpleQR({ value, size = 180 }: SimpleQRProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <div 
      className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4"
      style={{ width: size, height: size }}
    >
      <QrCode className="size-12 text-gray-400 mb-3" />
      <p className="text-xs text-gray-500 text-center mb-3">
        QR Code
        <br />
        (Librería no disponible)
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="text-xs h-7"
      >
        {copied ? (
          <>
            <CheckCircle2 className="size-3" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="size-3" />
            Copiar URL
          </>
        )}
      </Button>
    </div>
  );
}
