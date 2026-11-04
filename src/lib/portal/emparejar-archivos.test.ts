import { describe, expect, it } from 'vitest';
import { claveComprobante, emparejarFacturas, esCdr, idDesdeXml, nombreBase } from './emparejar-archivos';

const f = (name: string) => ({ name });

describe('nombreBase', () => {
  it('quita extensión, sufijos de copia y mayúsculas', () => {
    expect(nombreBase('20604953236-01-F001-00001089.xml')).toBe('20604953236-01-f001-00001089');
    expect(nombreBase('20604953236-01-F001-00001089 (1).pdf')).toBe('20604953236-01-f001-00001089');
    expect(nombreBase('F001-00000458 - copia.PDF')).toBe('f001-00000458');
    expect(nombreBase('F001-00000458 - copia (2).pdf')).toBe('f001-00000458');
  });
});

describe('claveComprobante', () => {
  it('normaliza serie-número ignorando ceros', () => {
    expect(claveComprobante('F001-00001089')).toBe('F001-1089');
    expect(claveComprobante('20604953236-01-F001-00001089.pdf')).toBe('F001-1089');
    expect(claveComprobante('factura FP30-0003269 noviembre.pdf')).toBe('FP30-3269');
    expect(claveComprobante('E001-9.xml')).toBe('E001-9');
  });
  it('devuelve null si no hay número de comprobante', () => {
    expect(claveComprobante('factura.pdf')).toBeNull();
    expect(claveComprobante(null)).toBeNull();
    expect(claveComprobante('R-20604953236-01.xml')).toBeNull();
  });
});

describe('emparejarFacturas', () => {
  it('mismo nombre (caso que ya funcionaba)', () => {
    const r = emparejarFacturas([{ archivo: f('F001-00000458.xml') }], [f('F001-00000458.pdf')]);
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0].criterio).toBe('nombre');
    expect(r.xmlsSinPdf).toHaveLength(0);
    expect(r.pdfsSinXml).toHaveLength(0);
  });

  it('el PDF descargado dos veces trae " (1)" y aun así empareja por nombre', () => {
    const r = emparejarFacturas(
      [{ archivo: f('20604953236-01-F001-00001089.xml'), id: 'F001-00001089' }],
      [f('20604953236-01-F001-00001089 (1).pdf')],
    );
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0].criterio).toBe('nombre');
  });

  it('nombres distintos pero mismo número de comprobante (el ID del XML manda)', () => {
    const r = emparejarFacturas(
      [{ archivo: f('20604953236-01-F001-00001089.xml'), id: 'F001-00001089' }],
      [f('Factura F001-1089 Memphis.pdf')],
    );
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0].criterio).toBe('numero');
  });

  it('varias facturas a la vez: cada XML con su PDF por número, sin cruzarse', () => {
    const r = emparejarFacturas(
      [
        { archivo: f('a.xml'), id: 'FP30-0003259' },
        { archivo: f('b.xml'), id: 'FP30-0003269' },
      ],
      [f('FP30-0003269.pdf'), f('FP30-0003259.pdf')],
    );
    expect(r.pares).toHaveLength(2);
    expect(r.pares.find(p => p.xml.name === 'a.xml')?.pdf.name).toBe('FP30-0003259.pdf');
    expect(r.pares.find(p => p.xml.name === 'b.xml')?.pdf.name).toBe('FP30-0003269.pdf');
  });

  it('un solo XML y un solo PDF sin nada en común: van juntos', () => {
    const r = emparejarFacturas([{ archivo: f('factura.xml') }], [f('representacion impresa.pdf')]);
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0].criterio).toBe('unico');
  });

  it('dos XML y un PDF sin pistas: no adivina', () => {
    const r = emparejarFacturas([{ archivo: f('a.xml') }, { archivo: f('b.xml') }], [f('c.pdf')]);
    expect(r.pares).toHaveLength(0);
    expect(r.xmlsSinPdf).toHaveLength(2);
    expect(r.pdfsSinXml).toHaveLength(1);
  });

  it('XML solo (el PDF vendrá en la siguiente selección) queda pendiente', () => {
    const r = emparejarFacturas([{ archivo: f('F001-00001089.xml') }], []);
    expect(r.pares).toHaveLength(0);
    expect(r.xmlsSinPdf.map(x => x.name)).toEqual(['F001-00001089.xml']);
  });

  it('no empareja el CDR (R-...xml) con el PDF de la factura por número si el XML real está presente', () => {
    const r = emparejarFacturas(
      [
        { archivo: f('20604953236-01-F001-00001089.xml'), id: 'F001-00001089' },
        { archivo: f('R-20604953236-01-F001-00001089.xml'), id: null },
      ],
      [f('20604953236-01-F001-00001089.pdf')],
    );
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0].xml.name).toBe('20604953236-01-F001-00001089.xml');
    expect(r.xmlsSinPdf.map(x => x.name)).toEqual(['R-20604953236-01-F001-00001089.xml']);
  });
});

describe('idDesdeXml', () => {
  it('lee el cbc:ID del comprobante aunque antes venga la firma', () => {
    const xml = `<?xml version="1.0"?><Invoice xmlns:cbc="x"><ext:UBLExtensions><ds:Signature Id="IdSingEfact"/></ext:UBLExtensions>
      <cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:ID>F001-00001089</cbc:ID><cac:Signature><cbc:ID>IDSignKG</cbc:ID></cac:Signature></Invoice>`;
    expect(idDesdeXml(xml)).toBe('F001-00001089');
  });
  it('devuelve null para un CDR (ApplicationResponse) sin ID de comprobante', () => {
    expect(idDesdeXml('<ApplicationResponse><cbc:ID>20261104-1</cbc:ID></ApplicationResponse>')).toBeNull();
  });
});

describe('esCdr', () => {
  it('reconoce la constancia de SUNAT y no la factura', () => {
    expect(esCdr('<?xml version="1.0"?><ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"><cbc:ID>x</cbc:ID></ApplicationResponse>')).toBe(true);
    expect(esCdr('<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>F001-1</cbc:ID></Invoice>')).toBe(false);
  });
});
