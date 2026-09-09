/**
 * PadFirma — firmar con el dedo, el lápiz o el mouse.
 *
 * Se usa `pointer events`, que unifica los tres: la pantalla táctil de oficina,
 * un lápiz digital y el mouse entran por el mismo camino, sin código aparte.
 *
 * Dos detalles que se notan al usarlo:
 *   · el lienzo se dibuja a la resolución REAL de la pantalla (devicePixelRatio),
 *     porque si no la firma sale pixelada en pantallas densas;
 *   · el trazo se suaviza con curvas entre puntos. A mano alzada, unir los
 *     puntos con rectas produce una firma con esquinas que no parece una firma.
 *
 * Al guardar se recorta el espacio en blanco sobrante y se devuelve un PNG con
 * fondo transparente, para que se apoye limpio sobre el documento.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Eraser, Check } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  /** Se llama con el PNG (data URI) ya recortado. */
  onFirmar: (dataUri: string) => void;
  /** Alto del área de dibujo en píxeles CSS. */
  alto?: number;
}

/** Recorta el vacío alrededor del trazo y deja un margen pequeño. */
function recortar(lienzo: HTMLCanvasElement): string | null {
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  const { width, height } = lienzo;
  const datos = ctx.getImageData(0, 0, width, height).data;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Canal alfa: cualquier píxel pintado cuenta.
      if (datos[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;   // lienzo vacío: no hay firma

  const margen = 8;
  minX = Math.max(0, minX - margen); minY = Math.max(0, minY - margen);
  maxX = Math.min(width - 1, maxX + margen); maxY = Math.min(height - 1, maxY + margen);

  const recorte = document.createElement('canvas');
  recorte.width = maxX - minX + 1;
  recorte.height = maxY - minY + 1;
  recorte.getContext('2d')?.drawImage(
    lienzo, minX, minY, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height,
  );
  return recorte.toDataURL('image/png');
}

export function PadFirma({ onFirmar, alto = 180 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  /** Ajusta el lienzo a su tamaño real en pantalla. */
  const dimensionar = useCallback(() => {
    const lienzo = ref.current;
    if (!lienzo) return;
    const caja = lienzo.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Redimensionar BORRA el contenido: solo se hace si cambió de tamaño.
    const w = Math.round(caja.width * dpr), h = Math.round(alto * dpr);
    if (lienzo.width === w && lienzo.height === h) return;
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [alto]);

  useEffect(() => {
    dimensionar();
    window.addEventListener('resize', dimensionar);
    return () => window.removeEventListener('resize', dimensionar);
  }, [dimensionar]);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    ultimo.current = punto(e);
    setTieneTrazo(true);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const ctx = ref.current?.getContext('2d');
    const p = punto(e);
    const prev = ultimo.current;
    if (!ctx || !prev) return;
    // Curva entre el punto anterior y el actual: el trazo sale redondeado.
    const medio = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.quadraticCurveTo(prev.x, prev.y, medio.x, medio.y);
    ctx.stroke();
    ultimo.current = p;
  };

  const terminar = () => { dibujando.current = false; ultimo.current = null; };

  const limpiar = () => {
    const lienzo = ref.current;
    const ctx = lienzo?.getContext('2d');
    if (!lienzo || !ctx) return;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    setTieneTrazo(false);
  };

  const usar = () => {
    const lienzo = ref.current;
    if (!lienzo) return;
    const png = recortar(lienzo);
    if (!png) return;    // no hay nada dibujado
    onFirmar(png);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border bg-white">
        <canvas
          ref={ref}
          style={{ height: alto, touchAction: 'none' }}
          className="w-full cursor-crosshair"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
        />
        {/* Línea guía: se firma encima, como en un papel. */}
        <div className="pointer-events-none absolute left-6 right-6" style={{ bottom: alto * 0.22 }}>
          <div className="border-b border-dashed border-slate-300" />
        </div>
        {!tieneTrazo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Firma aquí con el dedo, el lápiz o el mouse
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={limpiar} disabled={!tieneTrazo}>
          <Eraser className="size-4" />
          Borrar y repetir
        </Button>
        <Button type="button" size="sm" onClick={usar} disabled={!tieneTrazo}>
          <Check className="size-4" />
          Usar esta firma
        </Button>
      </div>
    </div>
  );
}
