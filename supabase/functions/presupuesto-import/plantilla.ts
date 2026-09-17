/**
 * LEER LA PLANTILLA PRESUPUESTAL DE ANTONIO.
 *
 * El presupuesto de un proyecto OXI es un árbol de partidas: EQUIPO DE
 * PROTECCIÓN (1) → Uniforme (1.1) → Chaquetón (1.1.1) … con su cantidad, precio
 * y proveedor. El Excel numera los niveles con una mezcla de comas y puntos
 * ("1", "1,1", "1.1.1", "2.1.4.2") porque la coma es el decimal en formato
 * peruano; aquí se normaliza para que el nivel salga del número de segmentos.
 *
 * Vive junto a la Edge Function que lo usa, sin nada de Deno dentro, para que
 * las pruebas del repo importen exactamente el mismo código que corre en
 * producción.
 */

/**
 * Un número de la plantilla. Mismo problema que en fianzas: hay que decidir cuál
 * separador es el decimal. Manda el último; una o dos cifras detrás → decimal,
 * tres → millares. Devuelve null cuando no hay número (celda vacía, texto).
 */
export function numeroPeru(entrada: unknown): number | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null;

  let s = String(entrada)
    .replace(/S\/\.?|US\$|\$|PEN|%| /gi, '')
    .replace(/[\s´'`’]/g, '')
    .trim();
  if (!s) return null;

  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/^[-(]|\)$/g, '');
  if (!/\d/.test(s)) return null;

  const corte = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let entero = s, dec = '';
  if (corte !== -1) {
    const cola = s.slice(corte + 1);
    if (/^\d{1,2}$/.test(cola)) { entero = s.slice(0, corte); dec = cola; }
  }
  entero = entero.replace(/[.,]/g, '');
  if (!/^\d+$/.test(entero)) return null;
  const n = Number(dec ? `${entero}.${dec}` : entero);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Texto de celda limpio. */
export function texto(entrada: unknown): string {
  return String(entrada ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * El item, en forma canónica con puntos: "1,1" → "1.1", "2.1.4.2" → "2.1.4.2".
 * Vacío si no parece un item (una fila de texto suelto).
 */
export function itemCanonico(bruto: unknown): string {
  const s = texto(bruto).replace(/,/g, '.');
  return /^\d+(\.\d+)*$/.test(s) ? s : '';
}

/** El nivel de un item = cuántos segmentos tiene. "2.1.4.2" → 4. */
export function nivelDeItem(itemCanon: string): number {
  return itemCanon ? itemCanon.split('.').length : 0;
}

/** "18%" → 0.18 · "" → null. */
export function tasaIgv(entrada: unknown): number | null {
  const n = numeroPeru(entrada);
  if (n === null) return null;
  // "18%" llega como 18; "0,18" como 0,18.
  return n > 1 ? Math.round(n) / 100 : n;
}

export interface CabeceraPlantilla {
  proyecto: string;
  cui: string;
  importeEjecucion: number | null;
  importeReferencial: number | null;
  tipoCambio: number | null;
  plazoDias: number | null;
}

export interface LineaPlantilla {
  item: string;            // canónico con puntos
  nivel: number;
  esHoja: boolean;         // línea con precio (gasto real)
  descripcion: string;
  unidad: string;
  cantidad: number | null;
  precioUnitario: number | null;
  moneda: string;          // 'PEN' | 'USD'
  precioUnitarioSoles: number | null;
  totalSinIgv: number | null;
  igvTasa: number | null;
  totalConIgv: number | null;
  proveedorNota: string;
  orden: number;
}

/** 'Soles'/'S/' → PEN · 'US$'/'$' → USD · vacío → ''. */
function moneda(bruto: unknown): string {
  const s = texto(bruto).toUpperCase();
  if (/US\$|USD|D[OÓ]LAR/.test(s)) return 'USD';
  if (/SOL|S\/|PEN/.test(s)) return 'PEN';
  return '';
}

/**
 * Lee la cabecera: PROYECTO, CUI, importes, tipo de cambio y plazo. Se busca por
 * ETIQUETA, no por número de fila fijo, porque de un proyecto a otro las filas
 * se corren. `celdas` es la hoja entera (matriz de texto).
 */
export function leerCabecera(celdas: unknown[][]): CabeceraPlantilla {
  const cab: CabeceraPlantilla = {
    proyecto: '', cui: '', importeEjecucion: null, importeReferencial: null,
    tipoCambio: null, plazoDias: null,
  };
  const encuentra = (fila: unknown[], etiqueta: RegExp): number => {
    for (let i = 0; i < fila.length; i++) {
      if (etiqueta.test(texto(fila[i]))) return i;
    }
    return -1;
  };

  /**
   * Valor de TEXTO de una etiqueta: lo pegado tras ella en la misma celda
   * ("CUI: 2652192" → "2652192", "PROYECTO:ADQUISICIÓN…" → "ADQUISICIÓN…") o,
   * si no hay resto, la siguiente celda con contenido.
   */
  const valorTexto = (fila: unknown[], etiqueta: RegExp): string => {
    const i = encuentra(fila, etiqueta);
    if (i === -1) return '';
    const c = texto(fila[i]);
    const m = c.match(etiqueta)!;
    const resto = c.slice((m.index ?? 0) + m[0].length).replace(/^[:\s]+/, '').trim();
    if (resto) return resto;
    for (let j = i + 1; j < fila.length; j++) if (texto(fila[j])) return texto(fila[j]);
    return '';
  };

  /**
   * Valor NUMÉRICO de una etiqueta. Ojo: "Importe Referencial Total de
   * INVERSION" lleva texto tras la etiqueta que NO es el número. Por eso se
   * busca, de la etiqueta en adelante, la primera celda que parsea como número.
   */
  // Quita las letras antes de parsear: "300 días" → 300, sin ablandar el
  // parser de importes (que no debe tragarse texto en las líneas de partida).
  const soloNumero = (v: unknown): number | null => {
    // Primero el parser normal (sabe de "S/"); si no, quitando el texto que
    // acompaña a un número ("300 días").
    const directo = numeroPeru(v);
    if (directo !== null) return directo;
    return numeroPeru(String(v ?? '').replace(/[a-záéíóúñ/]+/gi, ' '));
  };
  const valorNumero = (fila: unknown[], etiqueta: RegExp): number | null => {
    const i = encuentra(fila, etiqueta);
    if (i === -1) return null;
    const c = texto(fila[i]);
    const m = c.match(etiqueta)!;
    const nResto = soloNumero(c.slice((m.index ?? 0) + m[0].length));
    if (nResto !== null) return nResto;
    for (let j = i + 1; j < fila.length; j++) {
      const n = soloNumero(fila[j]);
      if (n !== null) return n;
    }
    return null;
  };

  for (const fila of celdas) {
    if (!cab.proyecto) { const v = valorTexto(fila, /PROYECTO/i); if (v) cab.proyecto = v; }
    if (!cab.cui) { const v = valorTexto(fila, /\bCUI\b/i); if (v) cab.cui = v.split(/\s/)[0]; }
    if (cab.importeEjecucion === null) cab.importeEjecucion = valorNumero(fila, /Ejecuci[oó]n del Proyecto/i);
    if (cab.importeReferencial === null) cab.importeReferencial = valorNumero(fila, /Importe Referencial/i);
    if (cab.tipoCambio === null) cab.tipoCambio = valorNumero(fila, /Tasa de Cambio/i);
    if (cab.plazoDias === null) cab.plazoDias = valorNumero(fila, /Plazo de Ejecuci[oó]n/i);
  }
  return cab;
}

/**
 * Lee las líneas de partida, desde la fila de cabecera de la tabla (la que dice
 * "ITEM ... CARTA"/"DESCRIPCION") hacia abajo.
 *
 * `esHoja` (línea de gasto real) se decide por tener UNIDAD y un total: así se
 * excluyen tanto las partidas de nivel 1 —que traen totales AGREGADOS y sumarían
 * doble— como las cabeceras de grupo, que solo llevan nombre.
 */
export function leerLineas(celdas: unknown[][]): LineaPlantilla[] {
  const iTabla = celdas.findIndex(f =>
    texto(f[0]).toUpperCase() === 'ITEM' && /DESCRIPCI/i.test(texto(f[1])));
  if (iTabla === -1) return [];

  const lineas: LineaPlantilla[] = [];
  let orden = 0;
  for (const f of celdas.slice(iTabla + 1)) {
    const item = itemCanonico(f[0]);
    const desc = texto(f[1]);
    if (!item && !desc) continue;              // fila en blanco de separación
    if (!item) continue;                       // texto suelto sin numeración

    const unidad = texto(f[2]);
    const totalSinIgv = numeroPeru(f[7]);
    const esHoja = unidad !== '' && totalSinIgv !== null;

    lineas.push({
      item,
      nivel: nivelDeItem(item),
      esHoja,
      descripcion: desc,
      unidad,
      cantidad: numeroPeru(f[3]),
      precioUnitario: numeroPeru(f[4]),
      moneda: moneda(f[5]),
      precioUnitarioSoles: numeroPeru(f[6]),
      totalSinIgv,
      igvTasa: esHoja ? (tasaIgv(f[8]) ?? 0.18) : tasaIgv(f[8]),
      totalConIgv: numeroPeru(f[9]),
      proveedorNota: texto(f[10]),
      orden: orden++,
    });
  }
  return lineas;
}

/**
 * Total del presupuesto = suma de las HOJAS (nunca de las cabeceras, que
 * duplicarían). Devuelve sin IGV y con IGV.
 */
export function totales(lineas: LineaPlantilla[]): { sinIgv: number; conIgv: number; hojas: number } {
  let sinIgv = 0, conIgv = 0, hojas = 0;
  for (const l of lineas) {
    if (!l.esHoja) continue;
    hojas++;
    sinIgv += l.totalSinIgv ?? 0;
    conIgv += l.totalConIgv ?? (l.totalSinIgv ?? 0) * (1 + (l.igvTasa ?? 0));
  }
  return {
    sinIgv: Math.round(sinIgv * 100) / 100,
    conIgv: Math.round(conIgv * 100) / 100,
    hojas,
  };
}
