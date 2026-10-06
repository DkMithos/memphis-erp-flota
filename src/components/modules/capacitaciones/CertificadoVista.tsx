/**
 * CertificadoVista — el diploma, tal como se imprime.
 *
 * Es una función pura de (plantilla, datos, qr) → DOM, y la usan cuatro sitios:
 * la vista previa del editor de plantillas, el detalle de la capacitación, la
 * página pública del QR y la captura a PDF. Por eso:
 *
 *   · Mide SIEMPRE 1123 × 794 px (A4 horizontal a 96 dpi). Quien lo muestra más
 *     chico lo escala con `CertificadoPreview`; quien lo convierte a PDF lo
 *     captura a tamaño real.
 *   · No usa unidades de contenedor (cqw), ni mix-blend-mode, ni text-wrap:
 *     balance, ni gradientes radiales: son las cosas que html2canvas no pinta
 *     igual que el navegador. Las franjas curvas del diseño original van como
 *     SVG en línea, que sí se rasteriza fiel.
 *   · El diseño base es el del taller de diplomas (repo plantilla-diplomas):
 *     papel marfil, azul profundo, detalle dorado, Georgia para el título.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { DatosCertificado, Plantilla, PlantillaSnapshot } from '../../../lib/capacitaciones/types';
import { fechaLarga, horasCortas, horasTexto, nombreCompleto, rangoFechas } from '../../../lib/capacitaciones/datos';
import { dominioCorto } from '../../../lib/capacitaciones/urls';

export const CERT_ANCHO = 1123;
export const CERT_ALTO = 794;

const SERIF = 'Georgia, "Times New Roman", Times, serif';
const SANS = 'Inter, "Segoe UI", Arial, Helvetica, sans-serif';

export interface CertificadoVistaProps {
  plantilla: Plantilla | PlantillaSnapshot;
  datos: DatosCertificado;
  /** Código impreso bajo el QR (CERT-2026-00012). Vacío en la vista previa. */
  codigo?: string;
  /** Imagen del QR ya generada (data URL). Si falta, se deja el hueco. */
  qrDataUrl?: string;
  /** Marca de agua "VISTA PREVIA" / "REVOCADO". */
  marca?: string;
}

/** Franjas curvas en dos esquinas opuestas (la composición del diseño original). */
function Marco({ primario, secundario, acento, uid, invertido }: { primario: string; secundario: string; acento: string; uid: string; invertido?: boolean }) {
  // Caja de cada esquina: 36 % × 44 % del pliego; el centro de las elipses es la
  // esquina interior de la caja. Radios = 75 % de la elipse "farthest-corner".
  const bw = 404, bh = 349;
  const k = Math.SQRT2;
  const elipse = (cx: number, cy: number, f: number) => {
    const rx = bw * k * f, ry = bh * k * f;
    return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
  };
  const anillo = (cx: number, cy: number, f: number, stroke: string, w: number) => (
    <ellipse cx={cx} cy={cy} rx={bw * k * f} ry={bh * k * f} fill="none" stroke={stroke} strokeWidth={w} />
  );
  // Caja (x0,y0,bw,bh) con el centro de las elipses en (cx,cy). El relleno oscuro
  // es la parte de la caja que queda FUERA de la elipse del 75 % (regla evenodd):
  // un triángulo curvo pegado a la esquina, no una franja gruesa.
  const esquina = (x0: number, y0: number, cx: number, cy: number, clip: string) => (
    <g clipPath={`url(#${clip})`}>
      <path fillRule="evenodd" fill={primario} d={`M${x0} ${y0} h${bw} v${bh} h${-bw} Z ${elipse(cx, cy, 0.75)}`} />
      {anillo(cx, cy, 0.73, secundario, bh * k * 0.04)}
      {anillo(cx, cy, 0.695, acento, 2)}
    </g>
  );
  return (
    <svg
      width={CERT_ANCHO} height={CERT_ALTO} viewBox={`0 0 ${CERT_ANCHO} ${CERT_ALTO}`}
      style={{ position: 'absolute', inset: 0, display: 'block' }} aria-hidden="true"
    >
      <defs>
        <clipPath id={`${uid}-tl`}><rect x={0} y={0} width={bw} height={bh} /></clipPath>
        <clipPath id={`${uid}-br`}><rect x={CERT_ANCHO - bw} y={CERT_ALTO - bh} width={bw} height={bh} /></clipPath>
        <clipPath id={`${uid}-tr`}><rect x={CERT_ANCHO - bw} y={0} width={bw} height={bh} /></clipPath>
        <clipPath id={`${uid}-bl`}><rect x={0} y={CERT_ALTO - bh} width={bw} height={bh} /></clipPath>
      </defs>
      {invertido ? (
        <>
          {/* Intercalado: franjas arriba-derecha y abajo-izquierda; la esquina del logo queda en papel */}
          {esquina(CERT_ANCHO - bw, 0, CERT_ANCHO - bw, bh, `${uid}-tr`)}
          {esquina(0, CERT_ALTO - bh, bw, CERT_ALTO - bh, `${uid}-bl`)}
        </>
      ) : (
        <>
          {esquina(0, 0, bw, bh, `${uid}-tl`)}
          {esquina(CERT_ANCHO - bw, CERT_ALTO - bh, CERT_ANCHO - bw, CERT_ALTO - bh, `${uid}-br`)}
        </>
      )}
      {/* marco fino interior */}
      <rect x={26} y={18} width={CERT_ANCHO - 52} height={CERT_ALTO - 36} fill="none" stroke={acento} strokeWidth={1} />
    </svg>
  );
}

export function CertificadoVista({ plantilla: p, datos: d, codigo, qrDataUrl, marca }: CertificadoVistaProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const layout = p.layout ?? {};
  const fondoCompleto = p.modo === 'fondo_completo';
  const papel = layout.color_fondo || '#faf5e8';
  const mostrarMarco = !fondoCompleto && layout.mostrar_marco !== false;
  const logoPos = layout.logo_pos ?? 'abajo-izq';
  // Con el logo arriba a la izquierda, las franjas se intercalan (salvo que la
  // plantilla diga otra cosa) para que el logo no caiga sobre el azul.
  const marcoInvertido = (layout.marco_pos ?? (logoPos === 'arriba-izq' ? 'tr-bl' : 'tl-br')) === 'tr-bl';
  const qrPos = p.mostrar_qr === false ? 'none' : (layout.qr_pos ?? 'br');
  const nombre = nombreCompleto(d.participante);
  const temario = d.capacitacion.temario ?? [];
  const totalHoras = Number(d.capacitacion.horas_total) || temario.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const fechaTexto = `${d.emision.ciudad}, ${fechaLarga(d.emision.fecha)}`;
  const firmante = d.firmante?.nombre || p.firmante_nombre || '';
  const cargoFirmante = d.firmante?.cargo || p.firmante_cargo || '';
  const firmaUrl = d.firmante?.firma_url ?? p.firma_url ?? null;
  const consorcio = d.consorcio ?? p.consorcio_nombre ?? '';

  const estiloBase: React.CSSProperties = {
    position: 'relative', width: CERT_ANCHO, height: CERT_ALTO, overflow: 'hidden',
    background: fondoCompleto ? '#ffffff' : papel, color: p.color_texto || '#17364c',
    fontFamily: SANS, boxSizing: 'border-box',
  };

  // ── Bloque de texto común (centrado) ────────────────────────────────────
  // Arriba el QR va pegado al marco (las franjas decorativas ocupan las otras dos
  // esquinas); abajo se aparta de ellas. Con `qr_texto` falso solo queda el código QR.
  const qrArriba = qrPos === 'tr' || qrPos === 'tl';
  const qrDerecha = qrPos === 'br' || qrPos === 'tr';
  // ¿Hay franja decorativa en la esquina del QR? Si no, va pegado al marco.
  const esquinaConFranja = mostrarMarco && (marcoInvertido
    ? ((qrArriba && qrDerecha) || (!qrArriba && !qrDerecha))
    : ((qrArriba && !qrDerecha) || (!qrArriba && qrDerecha)));
  const posQR: React.CSSProperties = fondoCompleto
    ? { [qrDerecha ? 'right' : 'left']: 40, [qrArriba ? 'top' : 'bottom']: 40 }
    : !esquinaConFranja
      ? { [qrDerecha ? 'right' : 'left']: 64, [qrArriba ? 'top' : 'bottom']: 44 }
      : qrArriba
        ? { [qrDerecha ? 'right' : 'left']: qrDerecha ? 215 : 240, top: 120 }
        : { [qrDerecha ? 'right' : 'left']: qrDerecha ? 215 : 240, top: 548 };
  const bloqueQR = qrPos !== 'none' && (
    <div style={{ position: 'absolute', ...posQR, width: 92, textAlign: 'center', fontSize: 9, lineHeight: '11px', color: p.color_texto }}>
      <div style={{ width: 84, height: 84, margin: '0 auto', background: '#fff', padding: 3, boxSizing: 'border-box', border: `1px solid ${p.color_acento}` }}>
        {qrDataUrl ? <img src={qrDataUrl} alt="" width={78} height={78} style={{ display: 'block' }} /> : null}
      </div>
      {layout.qr_texto !== false && (
        <>
          <div style={{ marginTop: 3, fontWeight: 600, letterSpacing: '.02em' }}>{codigo || 'CERT-AAAA-00000'}</div>
          <div style={{ opacity: .75 }}>{dominioCorto()}/certificados</div>
        </>
      )}
    </div>
  );

  const bloqueFirma = (firmante || cargoFirmante) && (
    // Como lo pidió Operaciones (06/10): la línea abarca solo el nombre, la
    // rúbrica queda al ras y un poco más grande, debajo van el cargo y el
    // consorcio, y el sello se pega al inicio de la rúbrica como un sello real.
    <div style={{ position: 'relative', margin: `${firmaUrl ? (fondoCompleto ? 80 : 96) : (fondoCompleto ? 26 : 34)}px auto 0`, width: 340, textAlign: 'center', paddingTop: 6 }}>
      {firmaUrl && (
        <img src={firmaUrl} alt="" crossOrigin="anonymous"
          style={{ position: 'absolute', left: '50%', bottom: 'calc(100% - 34px)', transform: 'translateX(-50%)', height: 110, maxWidth: 300, objectFit: 'contain', objectPosition: 'center bottom' }} />
      )}
      {p.sello_url && !fondoCompleto && (
        <img src={p.sello_url} alt="" crossOrigin="anonymous"
          style={{ position: 'absolute', left: -30, bottom: 'calc(100% - 34px)', width: 100, height: 100, objectFit: 'contain', opacity: .9 }} />
      )}
      <div style={{ display: 'inline-block', borderTop: `1px solid ${fondoCompleto ? p.color_texto : '#637e8b'}`, padding: '7px 10px 0', fontSize: 17, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{firmante}</div>
      <div style={{ fontSize: 13, color: fondoCompleto ? p.color_texto : '#526b7b', marginTop: 2 }}>{cargoFirmante}</div>
      {consorcio && <div style={{ fontSize: 12.5, marginTop: 1, color: fondoCompleto ? p.color_texto : '#526b7b' }}>{consorcio}</div>}
    </div>
  );

  const lineaDni = p.mostrar_dni !== false && d.participante.dni && (
    <div style={{ fontSize: 13, letterSpacing: '.06em', marginTop: 6, opacity: .85 }}>
      {/^\d{8}$/.test(d.participante.dni) ? 'DNI' : 'Documento'} N.° {d.participante.dni}
    </div>
  );

  // Fechas del curso + lugar. Se apaga cuando basta con la línea de emisión
  // ("Cusco, 20 de setiembre de 2026"), para no imprimir dos fechas.
  const lineaFechaCurso = layout.mostrar_fecha_curso !== false && (
    <div style={{ fontSize: 13, marginTop: fondoCompleto ? 4 : 3, opacity: .9 }}>
      {rangoFechas(d.capacitacion.fecha_inicio, d.capacitacion.fecha_fin)}{d.capacitacion.lugar ? ` · ${d.capacitacion.lugar}` : ''}
    </div>
  );

  const lineaProyecto = p.mostrar_proyecto !== false && (d.proyecto || d.capacitacion.entidad_beneficiaria) && (
    <div style={{ fontSize: 12.5, marginTop: 4, opacity: .85 }}>
      {d.capacitacion.entidad_beneficiaria ? `Entidad beneficiaria: ${d.capacitacion.entidad_beneficiaria}` : ''}
      {d.capacitacion.entidad_beneficiaria && d.proyecto ? ' · ' : ''}
      {d.proyecto ? `Proyecto ${d.proyecto.codigo} — ${d.proyecto.nombre}` : ''}
    </div>
  );

  const bloqueTemario = p.mostrar_temario !== false && temario.length > 0 && (
    <div style={{ marginTop: 6 }}>
      {temario.map((t, i) => (
        <div key={i} style={{ fontSize: 16, lineHeight: 1.5 }}>
          {t.tema} — {horasCortas(Number(t.horas) || 0)}
        </div>
      ))}
    </div>
  );

  // ── Modo FONDO COMPLETO: la imagen trae el diseño; aquí solo va el texto ──
  if (fondoCompleto) {
    const top = (layout.texto_top ?? 30) / 100 * CERT_ALTO;
    const alto = (layout.texto_alto ?? 56) / 100 * CERT_ALTO;
    const margen = (layout.texto_margen ?? 10) / 100 * CERT_ANCHO;
    return (
      <div style={estiloBase} data-certificado>
        {p.fondo_url && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${p.fondo_url}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }} />
        )}
        <div style={{
          position: 'absolute', top, left: margen, right: margen, height: alto,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, letterSpacing: '.04em' }}>{p.texto_otorga}</div>
          <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 600, lineHeight: 1.2, marginTop: 8, borderBottom: `1px solid ${p.color_acento}`, paddingBottom: 8, minWidth: '60%' }}>{nombre}</div>
          {lineaDni}
          <div style={{ fontSize: 15, marginTop: 12, maxWidth: '92%' }}>{p.texto_reconocimiento}</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, maxWidth: '92%', lineHeight: 1.3 }}>{d.capacitacion.titulo}</div>
          {bloqueTemario}
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, letterSpacing: '.03em' }}>Duración total: {horasTexto(totalHoras)}</div>
          {lineaFechaCurso}
          {lineaProyecto}
          <div style={{ fontSize: 14, marginTop: 10 }}>{fechaTexto}</div>
          {bloqueFirma}
        </div>
        {bloqueQR}
        {marca && <MarcaAgua texto={marca} />}
      </div>
    );
  }

  // ── Modo ESTÁNDAR ───────────────────────────────────────────────────────
  return (
    <div style={estiloBase} data-certificado>
      {p.fondo_url && (
        <div style={{
          position: 'absolute', inset: 0, backgroundImage: `url("${p.fondo_url}")`, backgroundSize: 'contain',
          backgroundPosition: 'right bottom', backgroundRepeat: 'no-repeat', opacity: layout.fondo_opacidad ?? 0.22,
        }} />
      )}
      {mostrarMarco && <Marco primario={p.color_primario} secundario={p.color_secundario} acento={p.color_acento} uid={uid} invertido={marcoInvertido} />}

      {p.logo_url && logoPos === 'arriba-izq' && (
        <img src={p.logo_url} alt="" crossOrigin="anonymous"
          style={{ position: 'absolute', left: 64, top: 44, width: layout.logo_ancho ?? 180, maxHeight: (layout.logo_ancho ?? 180) * 0.55, objectFit: 'contain', objectPosition: 'left top' }} />
      )}
      {p.logo_url && logoPos === 'abajo-izq' && (
        <img src={p.logo_url} alt="" crossOrigin="anonymous"
          style={{ position: 'absolute', left: 78, bottom: 56, width: layout.logo_ancho ?? 236, maxHeight: (layout.logo_ancho ?? 236) * 0.5, objectFit: 'contain', objectPosition: 'left bottom' }} />
      )}

      <div style={{
        position: 'absolute', inset: 0, padding: '62px 150px 60px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}>
        {p.logo_url && logoPos === 'arriba' && (
          <img src={p.logo_url} alt="" crossOrigin="anonymous" style={{ height: 68, maxWidth: 300, objectFit: 'contain', marginBottom: 10 }} />
        )}
        {consorcio && (
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.16em', lineHeight: 1.4, maxWidth: '90%' }}>{consorcio.toUpperCase()}</div>
        )}
        <div style={{ width: 90, borderTop: `2px solid ${p.color_acento}`, margin: '12px auto 16px' }} />
        <div style={{ fontFamily: SERIF, fontSize: 45, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: '.045em', color: p.color_primario }}>{p.titulo}</div>
        <div style={{ fontSize: 15, letterSpacing: '.04em', marginTop: 16 }}>{p.texto_otorga}</div>
        <div style={{
          fontFamily: SERIF, fontSize: 35, fontWeight: 600, lineHeight: 1.2, marginTop: 10, color: p.color_primario,
          borderBottom: `1px solid ${p.color_acento}`, paddingBottom: 9, width: '90%',
        }}>{nombre}</div>
        {lineaDni}
        <div style={{ fontSize: 15, lineHeight: 1.45, marginTop: 12, maxWidth: '92%' }}>{p.texto_reconocimiento}</div>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, marginTop: 4, maxWidth: '92%' }}>{d.capacitacion.titulo}</div>
        {bloqueTemario}
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.03em', marginTop: 10 }}>Duración total: {horasTexto(totalHoras)}</div>
        {lineaFechaCurso}
        {lineaProyecto}
        <div style={{ fontSize: 14, marginTop: 8 }}>{fechaTexto}</div>
        {bloqueFirma}
      </div>

      {bloqueQR}
      {marca && <MarcaAgua texto={marca} />}
    </div>
  );
}

function MarcaAgua({ texto }: { texto: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        transform: 'rotate(-24deg)', fontSize: 110, fontWeight: 800, letterSpacing: '.08em', color: 'rgba(180, 30, 30, .16)',
        border: '6px solid rgba(180, 30, 30, .16)', padding: '10px 40px', borderRadius: 16, fontFamily: SANS,
      }}>{texto}</div>
    </div>
  );
}

/**
 * CertificadoPreview — el diploma escalado al ancho disponible, sin perder la
 * proporción A4. El contenido interno sigue midiendo 1123 × 794.
 */
export function CertificadoPreview(props: CertificadoVistaProps & { className?: string; maxAncho?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);
  const { className, maxAncho, ...resto } = props;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = Math.min(el.clientWidth || CERT_ANCHO, maxAncho ?? CERT_ANCHO);
      setEscala(Math.max(0.1, w / CERT_ANCHO));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxAncho]);

  return (
    <div ref={ref} className={className} style={{ width: '100%', maxWidth: maxAncho }}>
      <div style={{ width: CERT_ANCHO * escala, height: CERT_ALTO * escala, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.18)', borderRadius: 2 }}>
        <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: CERT_ANCHO, height: CERT_ALTO }}>
          <CertificadoVista {...resto} />
        </div>
      </div>
    </div>
  );
}
