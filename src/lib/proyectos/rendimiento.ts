/**
 * EL MARGEN DE UN PROYECTO, según las reglas que fijó Antonio (16/09/2026).
 *
 * Es la cuenta que en el Excel vivía en el "Cuadro resumen" —el que está roto,
 * con 31 #¡REF!—. Aquí se reconstruye limpia y probada, con lo que Antonio
 * confirmó:
 *
 *   · La BASE es el importe del convenio (contrato + adenda). Sobre él van las
 *     contraprestaciones del negocio OxI.
 *   · La GANANCIA POR INTEGRACIÓN es un costo no realizado: NO se emplea.
 *   · El TIPO DE CAMBIO es una celda fija, referencia presupuestal — no se
 *     revalúa. Los importes en dólares se pasan a soles con ese TC.
 *   · El cuadro resumen del Excel no es referencia.
 *
 * Las tres contraprestaciones (consultoría OxI, contraprestación privada, venta
 * del CIPRL) son porcentajes del negocio; se pasan como parámetros para no
 * enterrarlos en el código, con los valores por defecto del archivo (10/5/4).
 *
 * IGV: los ingresos y costos se comparan SIN IGV, como en la hoja RENDIMIENTOS
 * (el convenio se divide entre 1,18).
 */

export const IGV = 0.18;

export interface ParametrosMargen {
  /** Consultoría OxI, fracción del convenio. Antonio: 10 %. */
  consultoria: number;
  /** Contraprestación privada, fracción del convenio. 5 %. */
  contraprestacion: number;
  /** Venta del CIPRL, fracción del convenio. 4 %. */
  ventaCiprl: number;
}

export const PARAMETROS_DEFECTO: ParametrosMargen = {
  consultoria: 0.10,
  contraprestacion: 0.05,
  ventaCiprl: 0.04,
};

export interface EntradaMargen {
  /** Importe del convenio con IGV (contrato + adenda), en soles. */
  convenio: number;
  /** Costo del proyecto en soles, ya convertido a soles al TC fijo. */
  costo: number;
  parametros?: ParametrosMargen;
}

export interface ResultadoMargen {
  ingresosSinIgv: number;
  costo: number;
  consultoria: number;
  contraprestacion: number;
  ventaCiprl: number;
  gananciaNeta: number;
  /** Ganancia sobre los ingresos sin IGV, en fracción (0,1875 = 18,75 %). */
  margen: number;
}

/** Redondeo a céntimo, evitando -0. */
const c2 = (n: number) => (Math.round(n * 100) / 100) || 0;

/**
 * El margen. `costo` es lo que se quiera medir: el PRESUPUESTADO (plan) o el
 * COMPROMETIDO en órdenes (real). La cuenta es la misma; cambia el costo.
 */
export function calcularMargen(e: EntradaMargen): ResultadoMargen {
  const p = e.parametros ?? PARAMETROS_DEFECTO;
  const ingresosSinIgv = e.convenio / (1 + IGV);
  const consultoria = e.convenio * p.consultoria;
  const contraprestacion = e.convenio * p.contraprestacion;
  const ventaCiprl = e.convenio * p.ventaCiprl;
  const gananciaNeta = ingresosSinIgv - e.costo - consultoria - contraprestacion - ventaCiprl;
  return {
    ingresosSinIgv: c2(ingresosSinIgv),
    costo: c2(e.costo),
    consultoria: c2(consultoria),
    contraprestacion: c2(contraprestacion),
    ventaCiprl: c2(ventaCiprl),
    gananciaNeta: c2(gananciaNeta),
    margen: ingresosSinIgv > 0 ? gananciaNeta / ingresosSinIgv : 0,
  };
}

/** Convierte un importe a soles con el TC fijo del presupuesto. */
export function aSoles(monto: number, moneda: string, tipoCambio: number): number {
  return /usd|d[oó]lar|\$/i.test(moneda) ? monto * tipoCambio : monto;
}

/** "18,7 %" · "-13,1 %". Una cifra decimal, que es como se lee un margen. */
export function margenLegible(fraccion: number): string {
  return `${(fraccion * 100).toFixed(1).replace('.', ',')} %`;
}
