/**
 * QR CODE WRAPPER
 * Intenta usar react-qr-code si está disponible, sino usa SimpleQR como fallback
 */

import { SimpleQR } from './SimpleQR';

interface QRCodeWrapperProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
}

export function QRCodeWrapper({ value, size = 180, level = 'M' }: QRCodeWrapperProps) {
  // Intentar usar react-qr-code si está disponible
  try {
    // @ts-ignore - Dynamic import que puede fallar
    const QRCode = require('react-qr-code').default;
    return <QRCode value={value} size={size} level={level} />;
  } catch (error) {
    // Si falla, usar SimpleQR como fallback
    return <SimpleQR value={value} size={size} level={level} />;
  }
}
