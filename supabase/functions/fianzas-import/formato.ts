/**
 * LEER EL EXCEL DE FIANZAS DE SHIRLEY.
 *
 * Este archivo lo escribe una persona, y se nota: los importes vienen en tres
 * formatos distintos según quién tecleó la fila, y a veces con un error de dedo
 * que hay que decidir cómo interpretar. Estas funciones son el único sitio donde
 * se toma esa decisión, y están probadas contra las filas reales del archivo.
 *
 * Vive junto a la Edge Function que lo usa —así se despliega con ella— pero no
 * tiene nada de Deno dentro, para que las pruebas del repo (vitest) importen
 * exactamente el mismo código que corre en producción.
 */

/**
 * Un importe del archivo, en número.
 *
 * Lo que hay que resolver es cuál de los puntos y comas es el decimal, porque en
 * el mismo archivo conviven:
 *
 *   43.900.816,64      formato peruano
 *   2,444,470.39       formato americano
 *   12´285,032.93      con el apóstrofo de millares que se usa a mano
 *   S/ 97.778.82       error de tecleo: el separador decimal quedó como punto
 *   7082152,66         sin separador de millares
 *
 * La regla: manda el ÚLTIMO separador. Si detrás lleva una o dos cifras, es el
 * decimal; si lleva tres, era de millares y el número es entero. Esa regla
 * acierta en todos los casos de arriba, incluido el mal tecleado.
 *
 * Devuelve null cuando no hay nada que leer — no 0, que es un importe real.
 */
export function montoPeruano(entrada: unknown): number | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null;

  // Fuera símbolo de moneda, espacios (incluido el fino), y el apóstrofo de
  // millares que se teclea a mano.
  let s = String(entrada)
    .replace(/S\/\.?|US\$|\$|PEN| /gi, '')
    .replace(/[\s´'`’]/g, '')
    .trim();
  if (!s) return null;

  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/^[-(]|\)$/g, '');
  if (!/\d/.test(s)) return null;

  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');
  const corte = Math.max(ultimoPunto, ultimaComa);

  let entero: string;
  let decimales = '';
  if (corte === -1) {
    entero = s;
  } else {
    const cola = s.slice(corte + 1);
    if (/^\d{1,2}$/.test(cola)) {
      entero = s.slice(0, corte);
      decimales = cola;
    } else {
      // Tres cifras detrás: era separador de millares, el número es entero.
      entero = s;
    }
  }

  entero = entero.replace(/[.,]/g, '');
  if (!/^\d+$/.test(entero)) return null;

  const n = Number(decimales ? `${entero}.${decimales}` : entero);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/**
 * Una fecha del archivo, en ISO.
 *
 * Shirley escribe dd/mm/aaaa, pero la columna FECHA DE RENOVACIÓN a veces lleva
 * texto en vez de fecha ("DEVUELTA A CESE", "TERMINA"). Eso no es un error del
 * archivo: es información, y se recoge aparte. Aquí devuelve null y ya.
 */
export function fechaDMY(entrada: unknown): string | null {
  if (!entrada) return null;
  const s = String(entrada).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const dd = Number(d), mm = Number(mes);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
  return `${a}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * El porcentaje afianzado, COMO FRACCIÓN: "4%" → 0,04.
 *
 * Así lo guarda el ERP (`fianzas.porcentaje` es numeric(6,4)) y así lo espera la
 * pantalla, que multiplica por cien para enseñarlo. Guardar 4 hacía que el
 * tablero pusiera "400%".
 *
 * Según el formato de la celda, Excel devuelve unas veces "4%" y otras "0,04".
 * Se distingue por el valor: de uno para arriba está en puntos porcentuales y se
 * divide; por debajo de uno ya es una fracción y se deja. GORE ICA tiene una
 * carta al 1 %, y esa es justo la frontera: 1 se lee como 1 %, no como el 100 %.
 */
export function porcentaje(entrada: unknown): number | null {
  if (entrada === null || entrada === undefined || entrada === '') return null;
  const s = String(entrada).replace('%', '').trim();
  const n = montoPeruano(s);
  if (n === null) return null;
  return n >= 1 ? Math.round(n) / 100 : n;
}

export type EstadoCarta = 'vigente' | 'renovada' | 'devuelta';

/**
 * La columna VIGENCIA dice SI, NO o DEVUELTA.
 *
 * "NO" no significa vencida: significa que esa carta ya fue reemplazada por la
 * renovación siguiente. Por eso se traduce a `renovada`, que es el estado que
 * usa el ERP y lo que de verdad pasó.
 */
export function estadoDeVigencia(entrada: unknown): EstadoCarta {
  const s = String(entrada ?? '').trim().toUpperCase();
  if (s.startsWith('DEVUEL')) return 'devuelta';
  if (s === 'SI' || s === 'SÍ') return 'vigente';
  return 'renovada';
}

/** Texto de celda limpio: sin espacios de sobra ni saltos. */
export function texto(entrada: unknown): string {
  return String(entrada ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Clave con la que se agrupan las cartas en una fianza.
 *
 * Una fianza es un contrato o convenio; sus cartas son las renovaciones
 * sucesivas. **Se agrupa por el número de convenio**, que es el identificador
 * de verdad. Por el nombre del proyecto no se puede: en el mismo archivo el
 * mismo convenio aparece como "GOREAMAZONAS AMBULANCIAS", "GORE AMAZONAS
 * AMBULANCIAS" y "GORE AMBULANCIAS", y no hay normalización que una las tres
 * sin unir también cosas distintas.
 *
 * Solo cuando el convenio viene vacío —pasa con BOMBEROS SAN MARTIN, que aún
 * no tiene número— se cae al nombre del proyecto.
 */
export function claveFianza(concurso: string, proyecto: string): string {
  const n = (s: string) => s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const c = n(concurso);
  return c ? `C:${c}` : `P:${n(proyecto)}`;
}

export interface FilaFianza {
  concurso: string;
  nombreProyecto: string;
  consorcio: string;
  entidad: string;
  proveedor: string;
  tipo: string;
  numero: string;
  inicio: string | null;
  plazoDias: number | null;
  fin: string | null;
  fechaRenovacion: string | null;
  /** Lo que decía FECHA DE RENOVACIÓN cuando no era una fecha. */
  notaRenovacion: string;
  montoContrato: number | null;
  porcentaje: number | null;
  montoAfianzado: number | null;
  costoRenovacion: number | null;
  encaje: number | null;
  estado: EstadoCarta;
}

/** Las 17 columnas, en el orden en que las lleva Administración. */
export const CABECERA = [
  'CONSURSO Y/O CONTRATO', 'NOMBRE DEL PROYECTO', 'EMPRESAS Y/O CONSORCIO', 'ENTIDAD',
  'PROVEEDOR', 'TIPO', 'N° CARTA FIANZA', 'INICIO', 'PLAZO', 'FIN', 'FECHA DE RENOVACION',
  'MONTO CONTRATO', 'PORCENTAJE', 'MONTO AFIANZADO', 'COSTO DE RENOVACION', 'ENCAJE', 'VIGENCIA',
];

/**
 * Convierte una fila de celdas en una carta, o devuelve null si la fila no
 * aporta nada. El archivo lleva filas en blanco entre grupos y, al final, un
 * bloque que repite las cartas vigentes a modo de resumen; sin número de carta
 * no hay nada que guardar.
 */
export function leerFila(celdas: unknown[]): FilaFianza | null {
  const c = (i: number) => texto(celdas[i]);
  const numero = c(6);
  if (!numero) return null;

  const renovacionCruda = c(10);
  return {
    concurso: c(0),
    nombreProyecto: c(1),
    consorcio: c(2),
    entidad: c(3),
    proveedor: c(4),
    tipo: c(5) || 'FIEL CUMPLIMIENTO',
    numero,
    inicio: fechaDMY(celdas[7]),
    plazoDias: montoPeruano(celdas[8]),
    fin: fechaDMY(celdas[9]),
    fechaRenovacion: fechaDMY(celdas[10]),
    notaRenovacion: fechaDMY(celdas[10]) ? '' : renovacionCruda,
    montoContrato: montoPeruano(celdas[11]),
    porcentaje: porcentaje(celdas[12]),
    montoAfianzado: montoPeruano(celdas[13]),
    costoRenovacion: montoPeruano(celdas[14]),
    encaje: montoPeruano(celdas[15]),
    estado: estadoDeVigencia(celdas[16]),
  };
}

/**
 * La identidad de una carta: su número MÁS su fecha de inicio.
 *
 * El número solo no basta. Shirley reutiliza el mismo número en la renovación
 * —`15411-2407-2025-000` está dos veces, con 180 y con 300 días— y el ERP ya
 * tiene esas dos cartas guardadas por separado, que es lo correcto: son dos
 * vigencias distintas del mismo papel.
 */
export function claveCarta(numero: string, inicio: string | null): string {
  return `${numero.trim().toUpperCase()}@${inicio ?? 'sin-fecha'}`;
}

/**
 * Agrupa las filas leídas en fianzas con sus cartas, quitando repetidas.
 *
 * El archivo repite al final las cartas vigentes como resumen. Si esas filas
 * entraran dos veces habría cartas duplicadas, así que gana la ÚLTIMA aparición
 * de cada carta: el bloque resumen está abajo y es el que Shirley mantiene al
 * día.
 */
export function agruparFilas(filas: FilaFianza[]): {
  fianzas: { clave: string; datos: FilaFianza; cartas: FilaFianza[] }[];
  repetidas: string[];
} {
  const porNumero = new Map<string, FilaFianza>();
  const repetidas: string[] = [];
  for (const f of filas) {
    const k = claveCarta(f.numero, f.inicio);
    if (porNumero.has(k)) repetidas.push(f.numero);
    porNumero.set(k, f);
  }

  const grupos = new Map<string, { clave: string; datos: FilaFianza; cartas: FilaFianza[] }>();
  for (const f of porNumero.values()) {
    const clave = claveFianza(f.concurso, f.nombreProyecto);
    let g = grupos.get(clave);
    if (!g) {
      g = { clave, datos: f, cartas: [] };
      grupos.set(clave, g);
    }
    g.cartas.push(f);
  }

  // Dentro de cada fianza, las cartas de la más reciente hacia atrás.
  for (const g of grupos.values()) {
    g.cartas.sort((a, b) => (b.inicio ?? '').localeCompare(a.inicio ?? ''));
    // Los datos de cabecera se toman de la carta más reciente, que es la que
    // lleva el monto de contrato actualizado.
    g.datos = g.cartas[0];
  }

  return { fianzas: [...grupos.values()], repetidas: [...new Set(repetidas)] };
}
