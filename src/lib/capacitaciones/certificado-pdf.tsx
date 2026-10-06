/**
 * PDF del certificado, generado en el navegador.
 *
 * Se renderiza el diploma a tamaño real fuera de pantalla, se rasteriza con
 * html2canvas (a 2×, para que el texto salga nítido) y se mete en un A4
 * horizontal con jsPDF. Un lote = un PDF con una página por persona.
 *
 * Es el mismo camino en el ERP y en el portal público: el participante toca
 * "Descargar" en su celular y recibe un archivo, sin pelearse con el diálogo
 * de impresión.
 *
 * Las dos librerías se cargan bajo demanda (import dinámico): pesan ~600 KB y
 * solo las necesita quien descarga.
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { CertificadoVista, CERT_ANCHO, CERT_ALTO } from '../../components/modules/capacitaciones/CertificadoVista';
import type { DatosCertificado, PlantillaSnapshot, Plantilla } from './types';
import { qrDataUrl } from './qr';
import { nombreCompleto } from './datos';
import { urlVerificacion } from './urls';

export interface ItemCertificadoPdf {
  plantilla: Plantilla | PlantillaSnapshot;
  datos: DatosCertificado;
  codigo: string;
  token: string;
  marca?: string;
}

async function esperarImagenes(raiz: HTMLElement): Promise<void> {
  const imgs = Array.from(raiz.querySelectorAll('img'));
  await Promise.all(imgs.map(img => (img.complete ? Promise.resolve() : new Promise<void>(res => {
    img.onload = () => res();
    img.onerror = () => res();
  }))));
  // Fondos por CSS (background-image): precargarlos también.
  const fondos = Array.from(raiz.querySelectorAll<HTMLElement>('[style*="background-image"]'))
    .map(el => el.style.backgroundImage.match(/url\("?(.*?)"?\)/)?.[1]).filter(Boolean) as string[];
  await Promise.all(fondos.map(src => new Promise<void>(res => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(); i.onerror = () => res(); i.src = src;
  })));
  if ((document as any).fonts?.ready) { try { await (document as any).fonts.ready; } catch { /* sin fuentes web */ } }
}

/** Rasteriza UN certificado. Devuelve el canvas a 2× (2246 × 1588). */
export async function rasterizarCertificado(item: ItemCertificadoPdf): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${CERT_ANCHO}px;height:${CERT_ALTO}px;pointer-events:none;z-index:-1;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const qr = item.plantilla.mostrar_qr === false ? undefined : await qrDataUrl(urlVerificacion(item.token));
    // Render síncrono + una pausa corta. No se usa requestAnimationFrame: en una
    // pestaña en segundo plano no dispara y la generación se quedaría colgada.
    flushSync(() => {
      root.render(<CertificadoVista plantilla={item.plantilla} datos={item.datos} codigo={item.codigo} qrDataUrl={qr} marca={item.marca} />);
    });
    await new Promise<void>(res => setTimeout(res, 60));
    await esperarImagenes(host);
    const { default: html2canvas } = await import('html2canvas');
    const objetivo = host.firstElementChild as HTMLElement;
    return await html2canvas(objetivo, {
      scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false,
      width: CERT_ANCHO, height: CERT_ALTO, windowWidth: CERT_ANCHO, windowHeight: CERT_ALTO,
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Descarga un PDF (una página por ítem). `onProgreso(i, n)` para la barra.
 * Devuelve el nombre del archivo guardado.
 */
export async function descargarCertificadosPdf(
  items: ItemCertificadoPdf[],
  nombreArchivo: string,
  onProgreso?: (hechos: number, total: number) => void,
): Promise<string> {
  if (!items.length) throw new Error('No hay certificados para generar');
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < items.length; i++) {
    const canvas = await rasterizarCertificado(items[i]);
    const img = canvas.toDataURL('image/jpeg', 0.93);
    if (i > 0) pdf.addPage('a4', 'landscape');
    pdf.addImage(img, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    onProgreso?.(i + 1, items.length);
  }
  const nombre = nombreArchivo.toLowerCase().endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`;
  pdf.save(nombre);
  return nombre;
}

/**
 * Descarga un ZIP con UN PDF por certificado (para repartirlos uno a uno o
 * enviarlos por correo). `onProgreso(i, n)` para la barra. Devuelve el nombre.
 *
 * Se arma en memoria: a ~400 KB por página, 150 certificados son ~60 MB, que
 * el navegador maneja sin problema. Para lotes mucho mayores conviene
 * descargar por partes (filtrar) o usar el PDF único.
 */
export async function descargarCertificadosZip(
  items: ItemCertificadoPdf[],
  nombreZip: string,
  onProgreso?: (hechos: number, total: number) => void,
): Promise<string> {
  if (!items.length) throw new Error('No hay certificados para generar');
  const [{ jsPDF }, { default: JSZip }] = await Promise.all([import('jspdf'), import('jszip')]);
  const zip = new JSZip();
  const usados = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const canvas = await rasterizarCertificado(it);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    let nombre = nombreArchivoCertificado(it.codigo, nombreCompleto(it.datos.participante));
    if (usados.has(nombre)) nombre = nombre.replace(/\.pdf$/, ` (${i + 1}).pdf`);
    usados.add(nombre);
    zip.file(nombre, pdf.output('arraybuffer'));
    onProgreso?.(i + 1, items.length);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const nombre = nombreZip.toLowerCase().endsWith('.zip') ? nombreZip : `${nombreZip}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return nombre;
}

/** Nombre de archivo seguro: "Certificado CERT-2026-00001 - Ana Garcia.pdf" */
export function nombreArchivoCertificado(codigo: string, persona: string): string {
  const limpio = persona.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 50);
  return `Certificado ${codigo}${limpio ? ' - ' + limpio : ''}.pdf`;
}
