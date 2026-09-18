/**
 * EXPORTAR PROVEEDORES CON TODA SU INFORMACIÓN.
 *
 * El export anterior era un CSV de 9 columnas (código, razón social, RUC, tipo,
 * estado, email, teléfono, distrito, departamento) y dejaba fuera lo que de
 * verdad piden: cuentas bancarias, observaciones, contacto, datos tributarios
 * (detracción/retención), régimen de IGV, dirección… Aquí va todo.
 *
 * Salida: un .xlsx con dos pestañas —
 *   1. "Proveedores": una fila por proveedor con TODOS los campos. La primera
 *      cuenta bancaria va en columnas propias y, además, "Todas las cuentas"
 *      concatena las demás para no perder nada cuando hay varias.
 *   2. "Cuentas bancarias": una fila por cuenta, para quien necesite procesarlas
 *      estructuradas (un proveedor puede tener varias).
 *
 * El armado de las hojas es puro (se prueba sin Excel); la escritura reutiliza
 * `exportToExcelMultiHoja`, que ya trata RUC y número de cuenta como texto (no
 * los convierte a número ni les come los ceros).
 */

import type { Proveedor } from './proveedores-store';
import {
  PROVEEDOR_TIPO_CONFIG, PROVEEDOR_ESTADO_CONFIG, PROVEEDOR_CONDICION_CONFIG,
  PROVEEDOR_CATEGORIA_LABELS,
} from './proveedores-config';
import { exportToExcelMultiHoja } from '../shared/export-utils';

type CuentaBancaria = Proveedor['cuentasBancarias'][number];

const REGIMEN_IGV_LABEL: Record<string, string> = {
  gravado: 'Gravado',
  exonerado: 'Exonerado',
  inafecto: 'Inafecto',
};
const MONEDA_LABEL: Record<string, string> = { PEN: 'Soles', USD: 'Dólares' };
const TIPO_CUENTA_LABEL: Record<string, string> = { corriente: 'Corriente', ahorros: 'Ahorros' };

const siNo = (v: boolean | null | undefined) => (v ? 'Sí' : 'No');
const soloFecha = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : '');
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '' : `${n}%`);

/** Todas las cuentas del proveedor: las múltiples (jsonb) o, si no, la única plana. */
export function cuentasDe(p: Proveedor): CuentaBancaria[] {
  if (p.cuentasBancarias && p.cuentasBancarias.length > 0) return p.cuentasBancarias;
  return p.datosBancarios ? [p.datosBancarios] : [];
}

/** Una cuenta como texto: "BCP · 194... · CCI 002... · Soles · Corriente". */
export function cuentaComoTexto(c: CuentaBancaria): string {
  return [
    c.banco || null,
    c.numeroCuenta || null,
    c.cci ? `CCI ${c.cci}` : null,
    MONEDA_LABEL[c.moneda] ?? c.moneda,
    TIPO_CUENTA_LABEL[c.tipoCuenta] ?? c.tipoCuenta,
  ].filter(Boolean).join(' · ');
}

function labelCategorias(p: Proveedor, categoriasConfig: { key: string; label: string }[]): string {
  const byKey = new Map(categoriasConfig.map(c => [c.key, c.label]));
  return (p.categorias ?? [])
    .map(k => byKey.get(k) ?? PROVEEDOR_CATEGORIA_LABELS[k] ?? k)
    .join(', ');
}

const regimenLabel = (r?: string) =>
  r ? (REGIMEN_IGV_LABEL[r] ?? (r.charAt(0).toUpperCase() + r.slice(1))) : '';

export interface HojaExport {
  nombre: string;
  data: Record<string, string | number>[];
  headersMap: Record<string, string>;
}

/**
 * Construye las dos hojas del export. Puro y testeable: no toca xlsx.
 */
export function construirHojasProveedores(
  proveedores: Proveedor[],
  categoriasConfig: { key: string; label: string }[] = [],
): HojaExport[] {
  const filasProveedores = proveedores.map(p => {
    const cuentas = cuentasDe(p);
    const primera = cuentas[0];
    const resto = cuentas.slice(1);
    return {
      codigo: p.id,
      ruc: p.ruc,
      razonSocial: p.razonSocial,
      nombreComercial: p.nombreComercial ?? '',
      tipo: PROVEEDOR_TIPO_CONFIG[p.tipo]?.label ?? p.tipo,
      categorias: labelCategorias(p, categoriasConfig),
      estado: PROVEEDOR_ESTADO_CONFIG[p.estado]?.label ?? p.estado,
      condicion: PROVEEDOR_CONDICION_CONFIG[p.condicion]?.label ?? p.condicion,
      calificacion: p.calificacion ?? 0,
      regimenIgv: regimenLabel(p.regimenIgv),
      domiciliado: siNo(p.domiciliado),
      contacto: p.contactoPrincipal?.nombre ?? p.contacto ?? '',
      contactoCargo: p.contactoPrincipal?.cargo ?? '',
      contactoEmail: p.contactoPrincipal?.email ?? '',
      contactoTelefono: p.contactoPrincipal?.telefono ?? '',
      email: p.email ?? '',
      telefono: p.telefono ?? '',
      telefonoAlt: p.telefonoAlternativo ?? '',
      pais: p.pais ?? '',
      departamento: p.ciudad ?? '',
      direccion: p.direccion ?? '',
      nCuentas: cuentas.length,
      banco: primera?.banco ?? '',
      cuenta: primera?.numeroCuenta ?? '',
      cci: primera?.cci ?? '',
      monedaCuenta: primera ? (MONEDA_LABEL[primera.moneda] ?? primera.moneda) : '',
      tipoCuenta: primera ? (TIPO_CUENTA_LABEL[primera.tipoCuenta] ?? primera.tipoCuenta) : '',
      todasLasCuentas: resto.length > 0 ? cuentas.map(cuentaComoTexto).join(' | ') : '',
      sujetoDetraccion: siNo(p.datosTributarios?.sujetoDetraccion),
      tasaDetraccion: pct(p.datosTributarios?.tasaDetraccion),
      codigoBienServicio: p.datosTributarios?.codigoBienServicio ?? '',
      sujetoRetencion: siNo(p.datosTributarios?.sujetoRetencion),
      suspensionRetencionRh: siNo(p.suspensionRetencionRh),
      suspensionRetencionHasta: soloFecha(p.suspensionRetencionHasta),
      observaciones: p.observaciones ?? '',
      creadoEn: soloFecha(p.auditoria?.creadoEn),
      modificadoEn: soloFecha(p.auditoria?.modificadoEn),
    };
  });

  const filasCuentas = proveedores.flatMap(p =>
    cuentasDe(p).map(c => ({
      codigo: p.id,
      ruc: p.ruc,
      razonSocial: p.razonSocial,
      banco: c.banco ?? '',
      cuenta: c.numeroCuenta ?? '',
      cci: c.cci ?? '',
      moneda: MONEDA_LABEL[c.moneda] ?? c.moneda ?? '',
      tipoCuenta: TIPO_CUENTA_LABEL[c.tipoCuenta] ?? c.tipoCuenta ?? '',
    })),
  );

  return [
    {
      nombre: 'Proveedores',
      data: filasProveedores,
      headersMap: {
        codigo: 'Código', ruc: 'RUC', razonSocial: 'Razón Social', nombreComercial: 'Nombre Comercial',
        tipo: 'Tipo', categorias: 'Categorías', estado: 'Estado', condicion: 'Condición',
        calificacion: 'Calificación', regimenIgv: 'Régimen IGV', domiciliado: 'Domiciliado',
        contacto: 'Contacto', contactoCargo: 'Cargo del contacto', contactoEmail: 'Email del contacto',
        contactoTelefono: 'Teléfono del contacto', email: 'Email', telefono: 'Teléfono',
        telefonoAlt: 'Teléfono alternativo', pais: 'País', departamento: 'Departamento', direccion: 'Dirección',
        nCuentas: 'N° de cuentas', banco: 'Banco', cuenta: 'Número de cuenta', cci: 'CCI',
        monedaCuenta: 'Moneda de la cuenta', tipoCuenta: 'Tipo de cuenta', todasLasCuentas: 'Todas las cuentas',
        sujetoDetraccion: 'Sujeto a detracción', tasaDetraccion: 'Tasa de detracción',
        codigoBienServicio: 'Código bien/servicio', sujetoRetencion: 'Sujeto a retención',
        suspensionRetencionRh: 'Suspensión retención 4ta', suspensionRetencionHasta: 'Suspensión hasta',
        observaciones: 'Observaciones', creadoEn: 'Creado el', modificadoEn: 'Modificado el',
      },
    },
    {
      nombre: 'Cuentas bancarias',
      data: filasCuentas,
      headersMap: {
        codigo: 'Código', ruc: 'RUC', razonSocial: 'Razón Social', banco: 'Banco',
        cuenta: 'Número de cuenta', cci: 'CCI', moneda: 'Moneda', tipoCuenta: 'Tipo de cuenta',
      },
    },
  ];
}

/** Descarga el .xlsx completo de proveedores (todas sus columnas + cuentas). */
export async function exportarProveedoresCompleto(
  proveedores: Proveedor[],
  categoriasConfig: { key: string; label: string }[] = [],
  filename = `proveedores-${new Date().toISOString().slice(0, 10)}`,
): Promise<void> {
  const hojas = construirHojasProveedores(proveedores, categoriasConfig);
  await exportToExcelMultiHoja(filename, hojas);
}
