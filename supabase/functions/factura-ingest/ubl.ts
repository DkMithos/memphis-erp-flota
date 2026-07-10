// Parseo de factura electrónica peruana (SUNAT CPE, UBL 2.1).
// Extrae los campos que el ERP necesita y el número de OC (OrderReference).
// fast-xml-parser NO expande entidades externas → seguro contra XXE.
import { XMLParser } from 'npm:fast-xml-parser@4';

export interface FacturaUBL {
  tipoComprobante: string;   // 01=factura, 03=boleta, 07=NC, 08=ND
  serie: string;             // F001
  numero: string;            // 00000123
  numeroCompleto: string;    // F001-00000123
  fechaEmision: string | null;
  moneda: string;            // PEN | USD
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  rucReceptor: string | null;
  razonSocialReceptor: string | null;
  ordenCompra: string | null; // cac:OrderReference/cbc:ID → número de OC
  subtotal: number;          // valor de venta (LineExtensionAmount)
  igv: number;               // TaxTotal/TaxAmount
  total: number;             // LegalMonetaryTotal/PayableAmount
}

// Devuelve el texto de un nodo que puede venir como string o como { '#text', '@_...' }.
function txt(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
  if (typeof node === 'object' && '#text' in (node as any)) {
    const v = (node as any)['#text'];
    return v == null ? null : String(v).trim();
  }
  return null;
}

function num(node: unknown): number {
  const t = txt(node);
  const n = t == null ? NaN : Number(t);
  return Number.isFinite(n) ? n : 0;
}

// Un campo UBL puede aparecer como objeto único o arreglo; normaliza a arreglo.
function arr(node: unknown): any[] {
  if (node == null) return [];
  return Array.isArray(node) ? node : [node];
}

/**
 * Parsea un XML UBL 2.1 de factura/boleta/nota. `removeNSPrefix` quita los
 * prefijos cbc:/cac: para navegar por nombres simples.
 */
export function parseUBLInvoice(xml: string): FacturaUBL {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xml);

  // La raíz puede ser Invoice, CreditNote o DebitNote.
  const root = doc.Invoice ?? doc.CreditNote ?? doc.DebitNote;
  if (!root) throw new Error('XML no reconocido como comprobante UBL (falta Invoice/CreditNote/DebitNote)');

  // ID = "F001-00000123"
  const idFull = txt(root.ID) ?? '';
  const [serie, numero] = idFull.includes('-') ? idFull.split('-') : ['', idFull];

  // Tipo de comprobante (cbc:InvoiceTypeCode; en NC/ND es implícito por la raíz)
  const tipoComprobante = txt(root.InvoiceTypeCode)
    ?? (doc.CreditNote ? '07' : doc.DebitNote ? '08' : '01');

  const moneda = txt(root.DocumentCurrencyCode) ?? 'PEN';
  const fechaEmision = txt(root.IssueDate);

  // Emisor / receptor
  const supplier = root.AccountingSupplierParty?.Party;
  const customer = root.AccountingCustomerParty?.Party;
  const partyRuc = (party: any): string | null =>
    txt(party?.PartyIdentification?.ID) ?? null;
  const partyName = (party: any): string | null =>
    txt(party?.PartyLegalEntity?.RegistrationName)
    ?? txt(party?.PartyName?.Name) ?? null;

  const rucEmisor = partyRuc(supplier);
  const rucReceptor = partyRuc(customer);

  // Número de OC: cac:OrderReference/cbc:ID
  const ordenCompra = txt(root.OrderReference?.ID);

  // Montos
  const subtotal = num(root.LegalMonetaryTotal?.LineExtensionAmount);
  const total = num(root.LegalMonetaryTotal?.PayableAmount);
  // IGV: sumar los TaxTotal/TaxAmount (normalmente uno)
  const igv = arr(root.TaxTotal).reduce((acc, t) => acc + num(t?.TaxAmount), 0);

  return {
    tipoComprobante,
    serie: serie ?? '',
    numero: numero ?? '',
    numeroCompleto: idFull,
    fechaEmision,
    moneda,
    rucEmisor,
    razonSocialEmisor: partyName(supplier),
    rucReceptor,
    razonSocialReceptor: partyName(customer),
    ordenCompra: ordenCompra || null,
    subtotal,
    igv,
    total,
  };
}
