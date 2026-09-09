/**
 * Régimen de IGV de una compra.
 *
 * El ERP aplicaba 18% siempre y no había forma de emitir una orden sin IGV,
 * aunque en el histórico ya hay 58 que no lo llevan: servicios del exterior
 * (Anthropic, Vercel, Google) y recibos por honorarios de personas naturales.
 *
 * El régimen es una propiedad del PROVEEDOR —de dónde factura y bajo qué
 * condición— y la compra lo hereda. Se puede ajustar por orden porque un mismo
 * proveedor puede vender algo gravado y algo exonerado.
 */

export type RegimenIgv = 'gravado' | 'exonerado_amazonia' | 'no_domiciliado' | 'inafecto';

export const REGIMENES: { id: RegimenIgv; label: string; detalle: string; tasa: number }[] = [
  {
    id: 'gravado',
    label: 'Gravado — IGV 18%',
    detalle: 'Compra normal en el país.',
    tasa: 0.18,
  },
  {
    id: 'exonerado_amazonia',
    label: 'Exonerado — Amazonía',
    detalle: 'Proveedor acogido a la Ley 27037. No se le carga IGV.',
    tasa: 0,
  },
  {
    id: 'no_domiciliado',
    label: 'No domiciliado',
    detalle: 'Servicio del exterior. El proveedor no factura IGV peruano.',
    tasa: 0,
  },
  {
    id: 'inafecto',
    label: 'Inafecto',
    detalle: 'Operación fuera del ámbito del IGV (por ejemplo, un recibo por honorarios).',
    tasa: 0,
  },
];

/** La tasa que corresponde al régimen. Lo que no se reconoce se trata como gravado. */
export function tasaIgv(regimen: RegimenIgv | string | null | undefined): number {
  return REGIMENES.find(r => r.id === regimen)?.tasa ?? 0.18;
}

export function etiquetaRegimen(regimen: RegimenIgv | string | null | undefined): string {
  return REGIMENES.find(r => r.id === regimen)?.label ?? 'Gravado — IGV 18%';
}

/** ¿Este régimen lleva IGV? Útil para rotular la línea del total. */
export const llevaIgv = (regimen: RegimenIgv | string | null | undefined): boolean =>
  tasaIgv(regimen) > 0;

/**
 * Un RUC que empieza en 10 o 15 es de persona natural: sus comprobantes suelen
 * ser recibos por honorarios, que no llevan IGV y sí pueden llevar retención de
 * renta. Es una PISTA para proponer el régimen, no una regla tributaria: quien
 * decide es quien emite la orden.
 */
export const esPersonaNatural = (ruc: string | null | undefined): boolean =>
  /^(10|15)\d{9}$/.test(String(ruc ?? '').trim());

/**
 * Régimen que se propone para un proveedor recién elegido.
 * Se respeta el que ya tenga guardado; solo se deduce cuando no hay ninguno.
 */
export function regimenSugerido(prov: {
  regimenIgv?: string | null;
  domiciliado?: boolean | null;
  ruc?: string | null;
}): RegimenIgv {
  // Un régimen distinto de 'gravado' es una decisión que alguien tomó: se respeta.
  if (prov.regimenIgv && prov.regimenIgv !== 'gravado') return prov.regimenIgv as RegimenIgv;

  // 'gravado' es el valor por DEFECTO de la columna, así que no distingue entre
  // "decidimos que es gravado" y "nadie lo ha mirado". Para una persona natural
  // —que suele emitir recibo por honorarios, sin IGV— se propone 'inafecto':
  // es lo correcto en la mayoría de los casos y quien emite la orden lo cambia
  // en un clic si ese proveedor sí factura con IGV.
  if (prov.domiciliado === false) return 'no_domiciliado';
  if (esPersonaNatural(prov.ruc)) return 'inafecto';
  return 'gravado';
}

/**
 * ¿Se propone marcar retención de renta de 4ta categoría?
 *
 * Solo aplica a personas naturales, y NO si tienen una constancia de suspensión
 * VIGENTE: SUNAT la da por un periodo y vence. Por eso se compara con la fecha,
 * en vez de fiarse solo de la casilla — el riesgo real es una suspensión marcada
 * hace tres años que nadie volvió a mirar.
 */
export function retencionRhSugerida(
  prov: { ruc?: string | null; suspensionRetencionRh?: boolean | null; suspensionRetencionHasta?: string | null },
  hoy: Date = new Date(),
): boolean {
  if (!esPersonaNatural(prov.ruc)) return false;
  if (!prov.suspensionRetencionRh) return true;
  if (!prov.suspensionRetencionHasta) return false;      // suspensión sin fecha: se respeta
  return prov.suspensionRetencionHasta < hoy.toISOString().slice(0, 10); // vencida → retiene
}
