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

/**
 * Número en formato peruano: la COMA es el decimal y el PUNTO el millar.
 *   "184.121,00" → 184121 · "43152,256" → 43152.256 (¡3 decimales!) ·
 *   "12.691,84" → 12691.84 · "5242620" → 5242620 · " -   " → null.
 * Si trae los dos separadores, el ÚLTIMO manda (así también aguanta formato
 * gringo "1,048,524.276"). " -   " y celdas sin dígitos → null.
 */
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

  const tienePunto = s.includes('.');
  const tieneComa = s.includes(',');
  let limpio: string;
  if (tienePunto && tieneComa) {
    // El separador que aparezca de último es el decimal; el otro, de millares.
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const mil = dec === '.' ? ',' : '.';
    limpio = s.split(mil).join('').replace(dec, '.');
  } else if (tieneComa) {
    // Solo comas: decimal peruano. Varias comas (raro, millares gringos) → se quitan.
    limpio = s.split(',').length > 2 ? s.split(',').join('') : s.replace(',', '.');
  } else {
    // Solo puntos: millares peruanos, salvo un único punto con 1–2 cifras (decimal).
    const p = s.split('.');
    limpio = (p.length === 2 && p[1].length <= 2) ? s : p.join('');
  }
  const n = Number(limpio);
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
 * Mes español abreviado o completo → primer día del mes en ISO.
 *   "mar-26", "SET-26", "ene-27", "Octubre-25", "Setiembre-25" → "AAAA-MM-01".
 * Basta con las 3 primeras letras del mes ("octubre"→"oct"). '' si no cuadra.
 */
export function mesEspanol(entrada: unknown): string {
  const s = normaliza(entrada as string);
  const m = s.match(/^([a-z]{3,})[\s\-\/.]*?(\d{2,4})$/);
  if (!m) return '';
  const mes = MESES[m[1].slice(0, 3)];
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

/** Una fecha (ISO o dd/mm/aaaa) → primer día de SU mes. '' si no cuadra. */
export function mesDeFecha(entrada: unknown): string {
  const s = texto(entrada);
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : fechaDMY(s);
  return iso ? `${iso.slice(0, 7)}-01` : '';
}

/** '$'/'US$'/'USD'/'Dólar'→USD · 'S/'/'Soles'/vacío→PEN (la mayoría es soles). */
export function moneda(bruto: unknown): string {
  const s = texto(bruto).toUpperCase();
  if (/\$|USD|D[OÓ]LAR/.test(s)) return 'USD';
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

/** Una LineaFlujo con todo en blanco salvo lo que se pase. */
function nueva(fila: number, p: Partial<LineaFlujo>): LineaFlujo {
  return {
    cdc: '', concepto: '', categoria: '', proveedor: '', moneda: 'PEN', tc: null,
    mesVencimiento: '', montoEjecutado: null, montoPresupuestado: null, montoPagado: null,
    fechaPagado: '', estadoPago: '', mesProgramado: '', postergado: null, momento: '',
    observaciones: '', fila, ...p,
  };
}

/**
 * "Flujo de proyectos" — hoja plana "BASE DE DATOS" con cabecera propia:
 * CÓDIGO · CDC · CATEGORIA · CONCEPTO · PROVEEDOR · MONEDA · TC · FECHA DE
 * VENCIMIENTO · MES DE VENCIMIENTO · TOTAL SOLES · PAGADO · MONTO PAGADO ·
 * POSTERGADO … El monto del flujo es TOTAL SOLES; el mes sale de la fecha de
 * vencimiento (o del texto del mes, que viene con nombre completo).
 */
export function leerProyectos(celdas: unknown[][]): LineaFlujo[] {
  const iCab = filaCabecera(celdas);
  if (iCab === -1) return [];
  const col = mapaColumnas(celdas[iCab]);
  const val = (f: unknown[], n: string): unknown => (n in col ? f[col[n]] : undefined);

  const lineas: LineaFlujo[] = [];
  for (let r = iCab + 1; r < celdas.length; r++) {
    const f = celdas[r];
    const cdc = texto(val(f, 'cdc'));
    const concepto = texto(val(f, 'concepto'));
    if (!cdc && !concepto) continue;
    if (!cdc && /^total/i.test(concepto)) continue;   // fila de totales suelta

    lineas.push(nueva(r + 1, {
      cdc, concepto,
      categoria: texto(val(f, 'categoria')),
      proveedor: texto(val(f, 'proveedor')),
      moneda: moneda(val(f, 'moneda')),
      tc: numeroPeru(val(f, 'tc')),
      mesVencimiento: mesDeFecha(val(f, 'fecha de vencimiento')) || mesEspanol(val(f, 'mes de vencimiento')),
      montoPresupuestado: numeroPeru(val(f, 'total soles')),
      montoPagado: numeroPeru(val(f, 'monto pagado')),
      fechaPagado: fechaDMY(val(f, 'fecha de pago')),
      estadoPago: estadoPago(val(f, 'pagado')),
      mesProgramado: mesDeFecha(val(f, 'mes de programacion')) || mesEspanol(val(f, 'mes de programacion')),
      postergado: numeroPeru(val(f, 'postergado')),
    }));
  }
  return lineas;
}

/**
 * "Flujo Administración" — MATRIZ por meses. La hoja "Base de datos" trae
 * CDC · CONCEPTO · CATEGORIA · Deuda Vencida · <mes1> · <mes2> … y una fila por
 * concepto con el monto programado de cada mes. Se DESDOBLA: cada celda con
 * monto (concepto × mes) es un compromiso de ese mes; "Deuda Vencida" es un
 * compromiso ya vencido (sin mes).
 */
export function leerAdministracion(celdas: unknown[][]): LineaFlujo[] {
  const iCab = filaCabecera(celdas);
  if (iCab === -1) return [];
  const cab = celdas[iCab];
  const col = mapaColumnas(cab);
  const iCdc = col['cdc'];
  const iConc = col['concepto'];
  const iCat = 'categoria' in col ? col['categoria'] : -1;
  const iDeuda = 'deuda vencida' in col ? col['deuda vencida'] : -1;

  // Columnas cuyo encabezado es un mes ("Ago-25", "May-27").
  const meses: { i: number; mes: string }[] = [];
  cab.forEach((c, i) => { const m = mesEspanol(c as string); if (m) meses.push({ i, mes: m }); });
  if (meses.length === 0) return [];

  const lineas: LineaFlujo[] = [];
  for (let r = iCab + 1; r < celdas.length; r++) {
    const f = celdas[r];
    const concepto = texto(f[iConc]);
    if (!concepto) continue;                       // filas de sección o en blanco
    const cdc = texto(f[iCdc]);
    const categoria = iCat >= 0 ? texto(f[iCat]) : '';

    if (iDeuda >= 0) {
      const d = numeroPeru(f[iDeuda]);
      if (d && d !== 0) {
        lineas.push(nueva(r + 1, { cdc, concepto, categoria, montoPresupuestado: d, estadoPago: 'VENCIDO', observaciones: 'Deuda vencida' }));
      }
    }
    for (const { i, mes } of meses) {
      const monto = numeroPeru(f[i]);
      if (monto === null || monto === 0) continue;
      lineas.push(nueva(r + 1, { cdc, concepto, categoria, mesVencimiento: mes, montoPresupuestado: monto }));
    }
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
