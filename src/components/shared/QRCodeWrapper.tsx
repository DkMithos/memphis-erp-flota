import QRCode from 'react-qr-code';

interface QRCodeWrapperProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  /**
   * Muestra el logo de Memphis al centro del QR. Requiere level="H"
   * (corrección de errores 30%): el logo tapa ~22% del área y el código
   * sigue siendo legible. Para etiquetas impresas se usa siempre con H.
   */
  conLogo?: boolean;
  /** Ruta del logo (por defecto el favicon de Memphis) */
  logoSrc?: string;
}

export function QRCodeWrapper({
  value,
  size = 180,
  level = 'M',
  conLogo = false,
  logoSrc = '/favicon.svg',
}: QRCodeWrapperProps) {
  if (!conLogo) return <QRCode value={value} size={size} level={level} />;

  // El recuadro blanco alrededor del logo evita que se confunda con módulos
  // del QR; el tamaño se mantiene en ~22% para no pasar el margen de error.
  const logoBox = Math.round(size * 0.22);
  const pad = Math.max(2, Math.round(size * 0.015));

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <QRCode value={value} size={size} level={level} />
      <div
        aria-hidden
        className="absolute bg-white rounded-sm flex items-center justify-center"
        style={{
          width: logoBox + pad * 2,
          height: logoBox + pad * 2,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <img
          src={logoSrc}
          alt=""
          style={{ width: logoBox, height: logoBox, objectFit: 'contain' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    </div>
  );
}
