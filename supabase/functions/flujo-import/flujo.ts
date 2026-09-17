/**
 * LEER LAS BD DEL FLUJO FINANCIERO (BD CONTA, BD TI y las que vengan).
 *
 * Cada BD es una tabla plana: una fila por compromiso de pago, con una cabecera
 * común (CDC, CONCEPTO, CATEGORIA, PROVEEDOR, MONEDA, TC, MES VENCIMIENTO, montos,
 * estado, postergado…). BD CONTA cuela columnas basura ("Columna1", "Columna2")
 * y BD TI no; por eso se ubican las columnas POR NOMBRE, no por posición.
 *
 * Vive junto a la Edge Function que lo usa, sin nada de Deno dentro, para que las
 * pruebas del repo importen el mismo código que corre en producción.
 */

/** Igual que en la plantilla de presupuesto: decide el decimal por el último
 * separador (1–2 cifras detrás → decimal, 3 → millares). " -   " → null. */
export function numeroPeru(entrada: unknown): number | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null;

  let s = String(entrada)
    .replace(/S\/\.?|US\$|\$|PEN|%| /gi, '')
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

/** Texto de celda: colapsa espacios y recorta. */
export function texto(entrada: unknown): string {
  return String(entrada ?? '').replace(/\s+/g, ' ').trim();
}

/** Quita acentos y baja a minúsculas, para comparar cabeceras. */
function normaliza(s: string): string {
  return texto(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * Mes español "mar-26" / "SET-26" / "ene-27" → fecha del primer día del mes en
 * ISO ("2026-03-01"). Devuelve '' si no reconoce el mes.
 */
export function mesEspanol(entrada: unknown): string {
  const s = normaliza(entrada as string);
  const m = s.match(/^([a-z]{3})[\s\-\/.]*?(\d{2,4})$/);
  if (!m) return '';
  const mes = MESES[m[1]];
  if (!mes) return '';
  let anio = Number(m[2]);
  if (anio < 100) anio += 2000;
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

/** Fecha "19/03/2026" (dd/mm/aaaa) → ISO "2026-03-19". '' si no cuadra. */
export function fechaDMY(entrada: unknown): string {
  const s = texto(entrada);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return '';
  const d = Number(m[1]), mes = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return '';
  return `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 'S/'→PEN · 'US$'/'$'/USD→USD · vacío→'PEN' (la mayoría es soles). */
export function moneda(bruto: unknown): string {
  const s = texto(bruto).toUpperCase();
  if (/US\$|USD|D[OÓ]LAR/.test(s)) return 'USD';
  return 'PEN';
}

/** Normaliza el estado: recorta y sube a mayúsculas. '' si vacío. */
export function estadoPago(bruto: unknown): string {
  return texto(bruto).toUpperCase();
}

export interface LineaFlujo {
  cdc: string;
  concepto: string;
  categoria: string;
  proveedor: string;
  moneda: string;
  tc: number | null;
  mesVencimiento: string;       // ISO o ''
  montoEjecutado: number | null;
  montoPresupuestado: number | null;
  montoPagado: number | null;
  fechaPagado: string;          // ISO o ''
  estadoPago: string;
  mesProgramado: string;        // ISO o ''
  postergado: number | null;
  momento: string;
  observaciones: string;
  fila: number;                 // fila de origen (1-based en la hoja)
}

/** Nombre de columna → índice, buscando en la fila de cabecera por nombre. */
type Mapa = Record<string, number>;
function mapaColumnas(cabecera: unknown[]): Mapa {
  const m: Mapa = {};
  cabecera.forEach((c, i) => {
    const n = normaliza(c as string);
    if (n && !(n in m)) m[n] = i;   // primera aparición gana
  });
  return m;
}

/** Índice de la fila de cabecera: la que trae CDC y CONCEPTO. -1 si no está. */
function filaCabecera(celdas: unknown[][]): number {
  return celdas.findIndex((f) => {
    const set = new Set(f.map((c) => normaliza(c as string)));
    return set.has('cdc') && set.has('concepto');
  });
}

/**
 * Lee los compromisos de una hoja (matriz de texto de usedRange). Se salta las
 * filas sin CDC ni concepto (separadores, totales sueltos).
 */
export function leerCompromisos(celdas: unknown[][]): LineaFlujo[] {
  const iCab = filaCabecera(celdas);
  if (iCab === -1) return [];
  const col = mapaColumnas(celdas[iCab]);

  const val = (fila: unknown[], nombre: string): unknown =>
    nombre in col ? fila[col[nombre]] : undefined;

  const lineas: LineaFlujo[] = [];
  for (let r = iCab + 1; r < celdas.length; r++) {
    const f = celdas[r];
    const cdc = texto(val(f, 'cdc'));
    const concepto = texto(val(f, 'concepto'));
    if (!cdc && !concepto) continue;

    lineas.push({
      cdc,
      concepto,
      categoria: texto(val(f, 'categoria')),
      proveedor: texto(val(f, 'proveedor')),
      moneda: moneda(val(f, 'moneda')),
      tc: numeroPeru(val(f, 'tc')),
      mesVencimiento: mesEspanol(val(f, 'mes vencimiento')),
      montoEjecutado: numeroPeru(val(f, 'monto ejecutado')),
      montoPresupuestado: numeroPeru(val(f, 'monto presupuestado')),
      montoPagado: numeroPeru(val(f, 'monto pagado')),
      fechaPagado: fechaDMY(val(f, 'mes pagado')),
      estadoPago: estadoPago(val(f, 'pagado/pendiente')),
      mesProgramado: mesEspanol(val(f, 'mes programado')),
      postergado: numeroPeru(val(f, 'postergado')),
      momento: texto(val(f, 'momento')),
      observaciones: texto(val(f, 'observaciones')),
      fila: r + 1,
    });
  }
  return lineas;
}

/** Totales rápidos para el resumen del import. */
export function resumen(lineas: LineaFlujo[]) {
  let pagado = 0, presupuestado = 0, pendiente = 0;
  for (const l of lineas) {
    presupuestado += l.montoPresupuestado ?? 0;
    pagado += l.montoPagado ?? 0;
    if (/PENDIENTE/.test(l.estadoPago)) pendiente += (l.montoPresupuestado ?? l.montoEjecutado ?? 0);
  }
  const red = (n: number) => Math.round(n * 100) / 100;
  return { compromisos: lineas.length, presupuestado: red(presupuestado), pagado: red(pagado), pendiente: red(pendiente) };
}
