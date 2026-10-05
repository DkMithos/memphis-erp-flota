/**
 * QR como imagen (data URL). Se usa una imagen y no un SVG en línea porque es
 * lo que html2canvas rasteriza sin sorpresas al generar el PDF.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export async function qrDataUrl(texto: string, px = 320): Promise<string> {
  return QRCode.toDataURL(texto, { margin: 0, width: px, errorCorrectionLevel: 'M', color: { dark: '#17364c', light: '#ffffff' } });
}

export function useQrDataUrl(texto: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let vivo = true;
    if (!texto) { setUrl(undefined); return; }
    qrDataUrl(texto).then(u => { if (vivo) setUrl(u); }).catch(() => { if (vivo) setUrl(undefined); });
    return () => { vivo = false; };
  }, [texto]);
  return url;
}
