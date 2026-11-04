// Portal de proveedores · emparejar el XML de una factura con su PDF.
//
// Antes el portal exigía que los dos archivos se llamaran exactamente igual y que se
// seleccionaran en la misma operación; si el proveedor elegía primero el XML y luego el
// PDF, o el PDF venía con otro nombre ("F001-1089.pdf", "factura (1).pdf"), fallaba con
// "Falta el PDF". Aquí se emparejan con criterios en cascada, del más estricto al más laxo:
//   1. mismo nombre base (sin extensión, sin sufijos de copia " (1)" / " - copia");
//   2. mismo número de comprobante (serie-número) en el nombre del PDF y en el XML
//      (el ID que trae el XML manda; si no se conoce, se busca en el nombre del archivo);
//   3. si queda exactamente un XML y un PDF sin pareja, van juntos.
// Lo que no se empareja se devuelve para que la pantalla lo retenga hasta la siguiente selección.

export interface ArchivoNombrado {
  name: string;
}

export interface XmlCandidato<T extends ArchivoNombrado> {
  archivo: T;
  /** cbc:ID del comprobante leído del XML (p. ej. "F001-00001089"); opcional. */
  id?: string | null;
}

export interface ParFactura<T extends ArchivoNombrado> {
  xml: T;
  pdf: T;
  /** Qué criterio los unió (para mostrarlo o depurar). */
  criterio: 'nombre' | 'numero' | 'unico';
}

export interface ResultadoEmparejar<T extends ArchivoNombrado> {
  pares: ParFactura<T>[];
  xmlsSinPdf: T[];
  pdfsSinXml: T[];
}

const EXT = /\.(xml|pdf)$/i;
// " (1)", " (2)", " - copia", "-copia", " copia" al final del nombre base: copias del navegador o del correo.
const SUFIJO_COPIA = /(\s*\(\d+\)|\s*-\s*copia(\s*\(\d+\))?|\s+copia)+$/i;

/** Nombre base comparable: minúsculas, sin extensión, sin sufijos de copia ni espacios sobrantes. */
export function nombreBase(nombre: string): string {
  return nombre.trim().replace(EXT, '').replace(SUFIJO_COPIA, '').trim().toLowerCase();
}

/**
 * Número de comprobante normalizado a partir de un texto ("F001-00001089" → "F001-1089").
 * Acepta serie de 4 caracteres alfanuméricos (F001, E001, FP30, B001) y número de hasta 8 dígitos,
 * separados por guion; se ignoran ceros a la izquierda del número.
 */
export function claveComprobante(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const m = texto.match(/\b([A-Z][A-Z0-9]{3})-0*(\d{1,8})\b/i);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${String(Number(m[2]))}`;
}

export function esXml(nombre: string): boolean { return /\.xml$/i.test(nombre); }
export function esPdf(nombre: string): boolean { return /\.pdf$/i.test(nombre); }

export function emparejarFacturas<T extends ArchivoNombrado>(
  xmls: XmlCandidato<T>[],
  pdfs: T[],
): ResultadoEmparejar<T> {
  const pares: ParFactura<T>[] = [];
  const pdfsLibres = [...pdfs];
  const xmlsLibres = [...xmls];

  const tomar = (xml: XmlCandidato<T>, pdf: T, criterio: ParFactura<T>['criterio']) => {
    pares.push({ xml: xml.archivo, pdf, criterio });
    pdfsLibres.splice(pdfsLibres.indexOf(pdf), 1);
    xmlsLibres.splice(xmlsLibres.indexOf(xml), 1);
  };

  // 1. Mismo nombre base.
  for (const x of [...xmlsLibres]) {
    const base = nombreBase(x.archivo.name);
    const pdf = pdfsLibres.find(p => nombreBase(p.name) === base);
    if (pdf) tomar(x, pdf, 'nombre');
  }

  // 2. Mismo número de comprobante (el ID del XML manda; si falta, el que diga su nombre).
  for (const x of [...xmlsLibres]) {
    const clave = claveComprobante(x.id) ?? claveComprobante(x.archivo.name);
    if (!clave) continue;
    const pdf = pdfsLibres.find(p => claveComprobante(p.name) === clave);
    if (pdf) tomar(x, pdf, 'numero');
  }

  // 3. Uno y uno: van juntos.
  if (xmlsLibres.length === 1 && pdfsLibres.length === 1) {
    tomar(xmlsLibres[0], pdfsLibres[0], 'unico');
  }

  return {
    pares,
    xmlsSinPdf: xmlsLibres.map(x => x.archivo),
    pdfsSinXml: pdfsLibres,
  };
}

/** La constancia de recepción de SUNAT (CDR, archivo "R-…xml") es un ApplicationResponse, no la factura. */
export function esCdr(xml: string): boolean {
  return /<(?:[a-z0-9]+:)?ApplicationResponse[\s>]/i.test(xml.slice(0, 4000));
}

/** cbc:ID del comprobante desde el texto del XML, sin parsearlo del todo (basta para emparejar). */
export function idDesdeXml(xml: string): string | null {
  // El primer cbc:ID hijo directo de la raíz es el número del comprobante; el de la firma va dentro
  // de UBLExtensions y cac:Signature, así que se busca el primero que tenga forma serie-número.
  const re = /<(?:[a-z0-9]+:)?ID(?:\s[^>]*)?>\s*([A-Z][A-Z0-9]{3}-\d{1,8})\s*<\//gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const clave = claveComprobante(m[1]);
    if (clave) return m[1];
  }
  return null;
}
