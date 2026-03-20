import QRCode from 'react-qr-code';

interface QRCodeWrapperProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
}

export function QRCodeWrapper({ value, size = 180, level = 'M' }: QRCodeWrapperProps) {
  return <QRCode value={value} size={size} level={level} />;
}
