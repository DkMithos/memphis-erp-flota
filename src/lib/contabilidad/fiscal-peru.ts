/**
 * Memphis ERP — Motor Fiscal Perú
 * Utilidades para IGV, detracciones, retenciones, PCGE y PLE.
 * Referencia: SUNAT – Resoluciones vigentes a 2026.
 */

// ─── Parámetros fiscales vigentes ────────────────────────────────────────────

export const IGV_TASA = 0.18;           // 16% IGV + 2% IPM
export const RETENCION_TASA = 0.03;     // 3% – R.S. 037-2002/SUNAT
export const UIT_2025 = 5350;           // S/ 5,350 – D.S. 008-2025-EF
export const UIT_2026 = 5550;           // S/ 5,550 – estimado

/** Calcula IGV sobre base imponible */
export function calcIGV(base: number, tasa = IGV_TASA): number {
  return Math.round(base * tasa * 100) / 100;
}

/** Calcula base imponible desde precio con IGV incluido */
export function calcBase(total: number, tasa = IGV_TASA): number {
  return Math.round((total / (1 + tasa)) * 100) / 100;
}

/** Calcula total (base + IGV) */
export function calcTotal(base: number, tasa = IGV_TASA): number {
  return Math.round(base * (1 + tasa) * 100) / 100;
}

// ─── Tipos de afectación IGV (Catálogo 07 SUNAT) ─────────────────────────────

export type TipoAfectacionIGV = '10' | '20' | '30' | '40' | '11' | '13' | '14' | '15' | '16' | '17';

export const TIPO_AFECTACION_IGV_LABELS: Record<string, string> = {
  '10': 'Gravado – Op. Onerosa',
  '11': 'Gravado – Retiro por premio',
  '13': 'Gravado – Retiro en calidad de méritos',
  '14': 'Gravado – Retiro por publicidad',
  '15': 'Gravado – Bonificaciones',
  '16': 'Gravado – Retiro por entrega a trabajadores',
  '17': 'Gravado – IVAP',
  '20': 'Exonerado – Op. Onerosa',
  '30': 'Inafecto – Op. Onerosa',
  '40': 'Exportación de Bienes o Servicios',
};

// ─── Detracciones SPOT (Anexo 2 y 3) ─────────────────────────────────────────

export interface TasaDetraccion {
  codigo: string;
  descripcion: string;
  tasa: number;           // decimal, ej: 0.12
  tipo: 'bien' | 'servicio' | 'construccion';
  montoMinimo?: number;   // S/ mínimo para aplicar detracción
}

/** Catálogo SPOT vigente 2025 (selección de los más comunes) */
export const TASAS_DETRACCION: TasaDetraccion[] = [
  { codigo: '001', descripcion: 'Azúcar y melaza de caña', tasa: 0.10, tipo: 'bien' },
  { codigo: '003', descripcion: 'Algodón', tasa: 0.10, tipo: 'bien' },
  { codigo: '004', descripcion: 'Recursos hidrobiológicos', tasa: 0.04, tipo: 'bien' },
  { codigo: '005', descripcion: 'Maíz amarillo duro', tasa: 0.04, tipo: 'bien' },
  { codigo: '006', descripcion: 'Caña de azúcar', tasa: 0.10, tipo: 'bien' },
  { codigo: '007', descripcion: 'Madera', tasa: 0.04, tipo: 'bien' },
  { codigo: '008', descripcion: 'Arena y piedra', tasa: 0.12, tipo: 'bien' },
  { codigo: '009', descripcion: 'Residuos, subproductos, desechos', tasa: 0.15, tipo: 'bien' },
  { codigo: '010', descripcion: 'Bienes gravados del Anexo 2', tasa: 0.10, tipo: 'bien' },
  { codigo: '011', descripcion: 'Aceite de pescado', tasa: 0.10, tipo: 'bien' },
  { codigo: '012', descripcion: 'Harina, polvo de pescado, crustáceos', tasa: 0.09, tipo: 'bien' },
  { codigo: '013', descripcion: 'Embarcaciones pesqueras', tasa: 0.09, tipo: 'bien' },
  { codigo: '014', descripcion: 'Leche', tasa: 0.04, tipo: 'bien' },
  { codigo: '017', descripcion: 'Animales vivos', tasa: 0.04, tipo: 'bien' },
  { codigo: '018', descripcion: 'Carnes y despojos comestibles', tasa: 0.04, tipo: 'bien' },
  { codigo: '019', descripcion: 'Abonos, cueros y pieles', tasa: 0.09, tipo: 'bien' },
  { codigo: '023', descripcion: 'Espárragos', tasa: 0.10, tipo: 'bien' },
  { codigo: '026', descripcion: 'Oro gravado con IGV', tasa: 0.12, tipo: 'bien' },
  { codigo: '036', descripcion: 'Oro y demás minerales metálicos (sin IGV)', tasa: 0.10, tipo: 'bien' },
  { codigo: '037', descripcion: 'Minerales no metálicos', tasa: 0.10, tipo: 'bien' },
  { codigo: '039', descripcion: 'Plomo', tasa: 0.15, tipo: 'bien' },
  { codigo: '040', descripcion: 'Gas natural (Canc. > S/700)', tasa: 0.10, tipo: 'bien' },
  // Servicios (Anexo 3)
  { codigo: '012s', descripcion: 'Intermediación laboral y tercerización', tasa: 0.12, tipo: 'servicio' },
  { codigo: '014s', descripcion: 'Arrendamiento de bienes', tasa: 0.12, tipo: 'servicio' },
  { codigo: '017s', descripcion: 'Mantenimiento y reparación de bienes muebles', tasa: 0.12, tipo: 'servicio' },
  { codigo: '018s', descripcion: 'Movimiento de carga', tasa: 0.12, tipo: 'servicio' },
  { codigo: '019s', descripcion: 'Otros servicios empresariales', tasa: 0.12, tipo: 'servicio' },
  { codigo: '020s', descripcion: 'Comisión mercantil', tasa: 0.12, tipo: 'servicio' },
  { codigo: '021s', descripcion: 'Fabricación de bienes por encargo', tasa: 0.12, tipo: 'servicio' },
  { codigo: '022s', descripcion: 'Servicio de transporte de personas', tasa: 0.12, tipo: 'servicio' },
  { codigo: '023s', descripcion: 'Contratos de construcción', tasa: 0.04, tipo: 'construccion' },
  { codigo: '024s', descripcion: 'Demás servicios gravados con IGV', tasa: 0.12, tipo: 'servicio' },
  { codigo: '037s', descripcion: 'Servicios de exploración minera', tasa: 0.12, tipo: 'servicio' },
  { codigo: '040s', descripcion: 'Otras operaciones del Anexo 3', tasa: 0.10, tipo: 'servicio' },
];

export function getTasaDetraccion(codigo: string): TasaDetraccion | undefined {
  return TASAS_DETRACCION.find(d => d.codigo === codigo);
}

/** Umbral mínimo para aplicar detracción: S/ 700 */
export const UMBRAL_DETRACCION = 700;

export function aplicaDetraccion(total: number): boolean {
  return total >= UMBRAL_DETRACCION;
}

export function calcDetraccion(total: number, tasa: number): number {
  return Math.round(total * tasa * 100) / 100;
}

// ─── Tipos de documento de identidad (Catálogo 06 SUNAT) ─────────────────────

export const TIPOS_DOC_IDENTIDAD: Record<string, string> = {
  '0': 'Doc. Trib. no Dom. sin RUC',
  '1': 'DNI',
  '4': 'Carnet Extranjería',
  '6': 'RUC',
  '7': 'Pasaporte',
  'A': 'Cédula Diplomática de Identidad',
  'B': 'Doc. Ident. País Residencia - No.D',
  'D': 'Documento Oficial de Identidad',
};

// ─── Unidades de medida (UBL 2.1 — Catálogo 03 SUNAT) ─────────────────────────

export const UNIDADES_MEDIDA: Record<string, string> = {
  NIU: 'Unidad (NIU)',
  ZZ:  'Servicio (ZZ)',
  KGM: 'Kilogramo',
  MTR: 'Metro',
  LTR: 'Litro',
  TNE: 'Tonelada métrica',
  MTK: 'Metro cuadrado',
  MTQ: 'Metro cúbico',
  HUR: 'Hora',
  DAY: 'Día',
  MON: 'Mes',
  SET: 'Juego',
  PK:  'Paquete',
  BX:  'Caja',
  BO:  'Botella',
  GLL: 'Galón',
};

// ─── Plan de Cuentas PCGE (estándar Perú) ─────────────────────────────────────

export interface PCGECuenta {
  codigo: string;
  nombre: string;
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'costo' | 'orden';
  naturaleza: 'deudora' | 'acreedora';
  nivel: 1 | 2 | 3 | 4 | 5;
  esHoja: boolean;
}

/** PCGE estándar — cuentas más usadas en empresas de servicios/comercio Perú */
export const PCGE_ESTANDAR: PCGECuenta[] = [
  // ── ELEMENTO 1: ACTIVO DISPONIBLE Y EXIGIBLE ──────────────────────────────
  { codigo: '1',    nombre: 'Activo Disponible y Exigible',              tipo: 'activo',    naturaleza: 'deudora',   nivel: 1, esHoja: false },
  { codigo: '10',   nombre: 'Efectivo y Equivalentes de Efectivo',        tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '101',  nombre: 'Caja',                                       tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '1011', nombre: 'Caja – Moneda Nacional',                     tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '1012', nombre: 'Caja – Moneda Extranjera',                   tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '104',  nombre: 'Cuentas Corrientes en Inst. Financieras',    tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '1041', nombre: 'Ctas. Corrientes Operativas – MN',           tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '1042', nombre: 'Ctas. Corrientes Operativas – ME',           tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '106',  nombre: 'Depósitos en Inst. Financieras',             tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '1061', nombre: 'Depósitos a Plazo – MN',                     tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '108',  nombre: 'Otros Equivalentes de Efectivo',             tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '11',   nombre: 'Inversiones al Valor Razonable',             tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '111',  nombre: 'Inversiones Mantenidas para Negociación',    tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '12',   nombre: 'Cuentas por Cobrar Comerciales – Terceros',  tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '121',  nombre: 'Facturas, Boletas y otros Comprob. x Cobrar',tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '1212', nombre: 'Emitidas en Cartera',                        tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '1213', nombre: 'En Descuento',                               tipo: 'activo',    naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '123',  nombre: 'Letras por Cobrar',                          tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '13',   nombre: 'Ctas. por Cobrar Comerciales – Relacionadas',tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '131',  nombre: 'Facturas y Otros Comprob. x Cobrar',         tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '14',   nombre: 'Cuentas por Cobrar al Personal',             tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '141',  nombre: 'Préstamos',                                  tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '142',  nombre: 'Anticipos',                                  tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '16',   nombre: 'Cuentas por Cobrar Diversas – Terceros',     tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '161',  nombre: 'Préstamos a Terceros',                       tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '165',  nombre: 'Venta de Activo Inmovilizado',               tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '167',  nombre: 'Tributos por Aplicar',                       tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '168',  nombre: 'Otras Cuentas por Cobrar Diversas',          tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '17',   nombre: 'Cuentas por Cobrar Diversas – Relacionadas', tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '18',   nombre: 'Servicios y Otros Contratados por Anticipado',tipo:'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '181',  nombre: 'Costos Financieros',                         tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '182',  nombre: 'Seguros',                                    tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '189',  nombre: 'Otros Servicios Contratados x Anticipado',   tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '19',   nombre: 'Estimación de Cuentas de Cobranza Dudosa',   tipo: 'activo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '191',  nombre: 'Ctas. x Cobrar Comerciales – Terceros',      tipo: 'activo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },

  // ── ELEMENTO 2: ACTIVO REALIZABLE ─────────────────────────────────────────
  { codigo: '2',    nombre: 'Activo Realizable',                          tipo: 'activo',    naturaleza: 'deudora',   nivel: 1, esHoja: false },
  { codigo: '20',   nombre: 'Mercaderías',                                tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '201',  nombre: 'Mercaderías Manufacturadas',                  tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '24',   nombre: 'Materias Primas',                            tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '25',   nombre: 'Materiales Auxiliares, Suministros y Repuestos',tipo:'activo',  naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '251',  nombre: 'Materiales Auxiliares',                      tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '252',  nombre: 'Suministros',                                tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '253',  nombre: 'Repuestos',                                  tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '28',   nombre: 'Existencias por Recibir',                    tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '29',   nombre: 'Desvalorización de Existencias',             tipo: 'activo',    naturaleza: 'acreedora', nivel: 2, esHoja: true  },

  // ── ELEMENTO 3: ACTIVO INMOVILIZADO ───────────────────────────────────────
  { codigo: '3',    nombre: 'Activo Inmovilizado',                        tipo: 'activo',    naturaleza: 'deudora',   nivel: 1, esHoja: false },
  { codigo: '30',   nombre: 'Inversiones Mobiliarias',                    tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '31',   nombre: 'Inversiones Inmobiliarias',                  tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '32',   nombre: 'Activos Adquiridos en Arrendamiento Financiero', tipo: 'activo',naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '33',   nombre: 'Inmuebles, Maquinaria y Equipo',             tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '331',  nombre: 'Terrenos',                                   tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '332',  nombre: 'Edificaciones',                              tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '333',  nombre: 'Maquinaria y Equipos de Explotación',        tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '334',  nombre: 'Unidades de Transporte',                     tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '335',  nombre: 'Muebles y Enseres',                          tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '336',  nombre: 'Equipos Diversos',                           tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '337',  nombre: 'Herramientas y Unidades de Reemplazo',       tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '338',  nombre: 'Unidades por Recibir',                       tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '34',   nombre: 'Intangibles',                                tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '343',  nombre: 'Programas de Computadora (Software)',        tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '346',  nombre: 'Fórmulas, Diseños y Prototipos',             tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '36',   nombre: 'Desvalorización de Activo Inmovilizado',     tipo: 'activo',    naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '37',   nombre: 'Activo Diferido',                            tipo: 'activo',    naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '371',  nombre: 'Impuesto a la Renta Diferido',               tipo: 'activo',    naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '39',   nombre: 'Depreciación, Amortización y Agotamiento Acumulados', tipo: 'activo', naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '391',  nombre: 'Depreciación Acumulada',                     tipo: 'activo',    naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '3913', nombre: 'Inmuebles, Maquinaria y Equipo – Costo',     tipo: 'activo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '392',  nombre: 'Amortización Acumulada',                     tipo: 'activo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },

  // ── ELEMENTO 4: PASIVO ────────────────────────────────────────────────────
  { codigo: '4',    nombre: 'Pasivo',                                      tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 1, esHoja: false },
  { codigo: '40',   nombre: 'Tributos, Contraprestaciones y Aportes',      tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '401',  nombre: 'Gobierno Central',                            tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '4011', nombre: 'Impuesto General a las Ventas',               tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: false },
  { codigo: '40111',nombre: 'IGV – Cuenta Propia',                         tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 5, esHoja: true  },
  { codigo: '40112',nombre: 'IGV – Cuenta de Terceros',                    tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 5, esHoja: true  },
  { codigo: '4017', nombre: 'Impuesto a la Renta',                         tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: false },
  { codigo: '40171',nombre: 'Renta de Tercera Categoría',                  tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 5, esHoja: true  },
  { codigo: '40172',nombre: 'Renta de Cuarta Categoría',                   tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 5, esHoja: true  },
  { codigo: '40173',nombre: 'Renta de Quinta Categoría',                   tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 5, esHoja: true  },
  { codigo: '4018', nombre: 'Impuesto Selectivo al Consumo',               tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '4019', nombre: 'Otros Impuestos y Contraprestaciones',        tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '403',  nombre: 'Instituciones Públicas',                      tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '4031', nombre: 'ESSALUD',                                     tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '4032', nombre: 'ONP',                                         tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '41',   nombre: 'Remuneraciones y Participaciones por Pagar',  tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '411',  nombre: 'Remuneraciones por Pagar',                    tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '415',  nombre: 'Beneficios Sociales de los Trabajadores',     tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '419',  nombre: 'Otras Remuneraciones y Participaciones',      tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '42',   nombre: 'Cuentas por Pagar Comerciales – Terceros',    tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '421',  nombre: 'Facturas, Boletas y Otros Comprob. x Pagar', tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '4212', nombre: 'Emitidas',                                    tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '4213', nombre: 'En Trámite',                                  tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '423',  nombre: 'Letras por Pagar',                            tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '43',   nombre: 'Cuentas por Pagar Comerciales – Relacionadas',tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '44',   nombre: 'Cuentas por Pagar a los Accionistas',         tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '45',   nombre: 'Obligaciones Financieras',                    tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '451',  nombre: 'Préstamos de Instituciones Financieras',      tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '4511', nombre: 'Préstamos – MN',                              tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '4512', nombre: 'Préstamos – ME',                              tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '452',  nombre: 'Contratos de Arrendamiento Financiero',       tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '46',   nombre: 'Cuentas por Pagar Diversas – Terceros',       tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '461',  nombre: 'Reclamaciones de Terceros',                   tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '469',  nombre: 'Otras Cuentas por Pagar Diversas',            tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '47',   nombre: 'Cuentas por Pagar Diversas – Relacionadas',   tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '48',   nombre: 'Provisiones',                                 tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '481',  nombre: 'Provisión para Litigios',                     tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '489',  nombre: 'Otras Provisiones',                           tipo: 'pasivo',    naturaleza: 'acreedora', nivel: 3, esHoja: true  },

  // ── ELEMENTO 5: PATRIMONIO ────────────────────────────────────────────────
  { codigo: '5',    nombre: 'Patrimonio',                                  tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 1, esHoja: false },
  { codigo: '50',   nombre: 'Capital',                                     tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '501',  nombre: 'Capital Social',                              tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '52',   nombre: 'Capital Adicional',                           tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '55',   nombre: 'Acciones de Inversión',                       tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '56',   nombre: 'Resultados No Realizados',                    tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '57',   nombre: 'Excedente de Revaluación',                    tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '58',   nombre: 'Reservas',                                    tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '581',  nombre: 'Reserva Legal',                               tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '589',  nombre: 'Otras Reservas',                              tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '59',   nombre: 'Resultados Acumulados',                       tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '591',  nombre: 'Utilidades No Distribuidas',                  tipo: 'patrimonio',naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '592',  nombre: 'Pérdidas Acumuladas',                         tipo: 'patrimonio',naturaleza: 'deudora',   nivel: 3, esHoja: true  },

  // ── ELEMENTO 6: GASTOS POR NATURALEZA ─────────────────────────────────────
  { codigo: '6',    nombre: 'Gastos por Naturaleza',                       tipo: 'gasto',     naturaleza: 'deudora',   nivel: 1, esHoja: false },
  { codigo: '60',   nombre: 'Compras',                                     tipo: 'costo',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '601',  nombre: 'Mercaderías',                                 tipo: 'costo',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '603',  nombre: 'Materiales Auxiliares, Suministros y Repuestos', tipo: 'costo', naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '606',  nombre: 'Suministros Diversos',                        tipo: 'costo',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '609',  nombre: 'Costos Vinculados con las Compras',           tipo: 'costo',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '61',   nombre: 'Variación de Existencias',                    tipo: 'costo',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '611',  nombre: 'Mercaderías',                                 tipo: 'costo',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '613',  nombre: 'Materiales Auxiliares, Suministros y Repuestos', tipo: 'costo', naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '62',   nombre: 'Gastos de Personal, Directores y Gerentes',   tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '621',  nombre: 'Remuneraciones',                              tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '622',  nombre: 'Otras Remuneraciones',                        tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '627',  nombre: 'Seguridad y Previsión Social',                tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '6271', nombre: 'ESSALUD',                                     tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '6272', nombre: 'ONP',                                         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '628',  nombre: 'Compensación por Tiempo de Servicios',        tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '629',  nombre: 'Beneficios Sociales de los Trabajadores',     tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '63',   nombre: 'Gastos de Servicios Prestados por Terceros',  tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '631',  nombre: 'Transporte, Correos y Gastos de Viaje',       tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '632',  nombre: 'Asesoría y Consultoría',                      tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '633',  nombre: 'Producción Encargada a Terceros',             tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '634',  nombre: 'Mantenimiento y Reparaciones',                tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '635',  nombre: 'Alquileres',                                  tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '636',  nombre: 'Servicios Básicos',                           tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '6361', nombre: 'Energía Eléctrica',                           tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '6362', nombre: 'Gas',                                         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '6363', nombre: 'Agua',                                        tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '6364', nombre: 'Teléfono',                                    tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '6365', nombre: 'Internet y TV Cable',                         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '637',  nombre: 'Publicidad, Publicaciones, Relaciones Públ.', tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '638',  nombre: 'Servicios de Seguridad y Vigilancia',         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '639',  nombre: 'Otros Servicios Prestados por Terceros',      tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '64',   nombre: 'Gastos por Tributos',                         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '641',  nombre: 'Gobierno Central',                            tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '642',  nombre: 'Gobierno Regional y Local',                   tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '65',   nombre: 'Otros Gastos de Gestión',                     tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '651',  nombre: 'Seguros',                                     tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '652',  nombre: 'Regalías',                                    tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '655',  nombre: 'Costo Neto de Enajenación de Activos',        tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '656',  nombre: 'Suministros',                                 tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '659',  nombre: 'Otros Gastos de Gestión',                     tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '66',   nombre: 'Pérdida por Medición de Activos No Fin.',     tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '67',   nombre: 'Gastos Financieros',                          tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '671',  nombre: 'Gastos en Operaciones de Endeudamiento',      tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '6711', nombre: 'Intereses',                                   tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '6712', nombre: 'Comisiones y Portes',                         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '677',  nombre: 'Pérdida por Diferencia de Cambio',            tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '68',   nombre: 'Valuación y Deterioro de Activos y Provisiones', tipo: 'gasto', naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '681',  nombre: 'Depreciación',                                tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: false },
  { codigo: '6813', nombre: 'Depreciación de Inmuebles, Maq. y Equipo',    tipo: 'gasto',     naturaleza: 'deudora',   nivel: 4, esHoja: true  },
  { codigo: '682',  nombre: 'Amortización de Intangibles',                 tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '69',   nombre: 'Costo de Ventas',                             tipo: 'costo',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '691',  nombre: 'Mercaderías',                                 tipo: 'costo',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '692',  nombre: 'Productos Terminados',                        tipo: 'costo',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },

  // ── ELEMENTO 7: INGRESOS ──────────────────────────────────────────────────
  { codigo: '7',    nombre: 'Ingresos',                                    tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 1, esHoja: false },
  { codigo: '70',   nombre: 'Ventas',                                      tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '701',  nombre: 'Mercaderías',                                 tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '7011', nombre: 'Mercaderías – Terceros',                      tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '704',  nombre: 'Prestación de Servicios',                     tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '7041', nombre: 'Servicios – Terceros',                        tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '705',  nombre: 'Fletes y Otros Ingresos por Gestión',         tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '706',  nombre: 'Alquileres',                                  tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '707',  nombre: 'Comisiones',                                  tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '709',  nombre: 'Devoluciones sobre Ventas',                   tipo: 'ingreso',   naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '71',   nombre: 'Variación de la Producción Almacenada',       tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '75',   nombre: 'Otros Ingresos de Gestión',                   tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '751',  nombre: 'Servicios en Beneficio del Personal',         tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '759',  nombre: 'Otros Ingresos de Gestión',                   tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '76',   nombre: 'Ganancia por Medición de Activos No Fin.',    tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '77',   nombre: 'Ingresos Financieros',                        tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '771',  nombre: 'Ganancia por Instrumentos Financieros',       tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '772',  nombre: 'Rendimientos Ganados',                        tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: false },
  { codigo: '7722', nombre: 'Ctas. Ctes. en Inst. Financieras',            tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 4, esHoja: true  },
  { codigo: '776',  nombre: 'Diferencia de Cambio',                        tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '778',  nombre: 'Otros Ingresos Financieros',                  tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },
  { codigo: '79',   nombre: 'Cargas Imputables a Ctas. de Costos y Gastos',tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 2, esHoja: false },
  { codigo: '791',  nombre: 'Cargas Imputables a Ctas. de Costos',         tipo: 'ingreso',   naturaleza: 'acreedora', nivel: 3, esHoja: true  },

  // ── ELEMENTO 9: CONTABILIDAD ANALÍTICA ────────────────────────────────────
  { codigo: '9',    nombre: 'Contabilidad Analítica de Explotación',       tipo: 'gasto',     naturaleza: 'deudora',   nivel: 1, esHoja: false },
  { codigo: '94',   nombre: 'Gastos Administrativos',                      tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '941',  nombre: 'Gastos de Personal Administrativo',           tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '942',  nombre: 'Gastos de Servicios Administrativos',         tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '943',  nombre: 'Gastos de Gestión Administrativa',            tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '95',   nombre: 'Gastos de Ventas',                            tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: false },
  { codigo: '951',  nombre: 'Gastos de Personal de Ventas',                tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '952',  nombre: 'Gastos de Publicidad y Marketing',            tipo: 'gasto',     naturaleza: 'deudora',   nivel: 3, esHoja: true  },
  { codigo: '96',   nombre: 'Gastos de Producción',                        tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '97',   nombre: 'Gastos Financieros Analíticos',               tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '98',   nombre: 'Gastos por Tributos Analíticos',              tipo: 'gasto',     naturaleza: 'deudora',   nivel: 2, esHoja: true  },

  // ── ELEMENTO 0: CUENTAS DE ORDEN ──────────────────────────────────────────
  { codigo: '0',    nombre: 'Cuentas de Orden',                            tipo: 'orden',     naturaleza: 'deudora',   nivel: 1, esHoja: false },
  { codigo: '01',   nombre: 'Bienes y Valores Entregados en Garantía',     tipo: 'orden',     naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '02',   nombre: 'Bienes y Valores Recibidos en Garantía',      tipo: 'orden',     naturaleza: 'acreedora', nivel: 2, esHoja: true  },
  { codigo: '05',   nombre: 'Bienes Entregados en Custodia',               tipo: 'orden',     naturaleza: 'deudora',   nivel: 2, esHoja: true  },
  { codigo: '06',   nombre: 'Bienes Recibidos en Custodia',                tipo: 'orden',     naturaleza: 'acreedora', nivel: 2, esHoja: true  },
];

// ─── Utilidades de formato PLE ────────────────────────────────────────────────

/** Convierte fecha ISO a formato YYYYMMDD para PLE */
export function formatPLEDate(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8);
}

/** Formatea monto para PLE (2 decimales, sin separador de miles) */
export function formatPLEAmount(amount: number | null | undefined): string {
  if (amount == null) return '0.00';
  return amount.toFixed(2);
}

/** Genera línea PLE 3.1 (Registro de Ventas) */
export function generarLineaPLE31(row: {
  correlativo: number;
  fechaEmision: string;
  tipo: string;
  serie: string;
  numero: string;
  tipoDocCliente: string;
  docCliente: string;
  razonSocialCliente: string;
  baseGravada: number;
  igv: number;
  exonerada: number;
  inafecta: number;
  exportacion: number;
  total: number;
  moneda: string;
  tipoCambio: number;
  estado: string;
}): string {
  return [
    row.correlativo.toString().padStart(8, '0'),
    formatPLEDate(row.fechaEmision),
    row.tipo.padEnd(2),
    row.serie.padEnd(4),
    row.numero.padStart(8, '0'),
    row.tipoDocCliente.padEnd(1),
    (row.docCliente || '').padEnd(20),
    (row.razonSocialCliente || '').padEnd(100),
    formatPLEAmount(row.baseGravada),
    formatPLEAmount(row.igv),
    formatPLEAmount(row.exonerada),
    formatPLEAmount(row.inafecta),
    formatPLEAmount(row.exportacion),
    formatPLEAmount(row.total),
    row.moneda,
    formatPLEAmount(row.tipoCambio),
    row.estado === 'activo' ? '1' : '2',
  ].join('|');
}

/** Genera línea PLE 8.1 (Registro de Compras) */
export function generarLineaPLE81(row: {
  correlativo: number;
  fechaEmision: string;
  fechaVencimiento?: string;
  tipo: string;
  serie: string;
  numero: string;
  tipoDocProveedor: string;
  rucProveedor: string;
  razonSocialProveedor: string;
  baseGravada: number;
  igv: number;
  noGravada: number;
  total: number;
  moneda: string;
  tipoCambio: number;
  constanciaDetraccion?: string;
  estado: string;
}): string {
  return [
    row.correlativo.toString().padStart(8, '0'),
    formatPLEDate(row.fechaEmision),
    row.fechaVencimiento ? formatPLEDate(row.fechaVencimiento) : '',
    row.tipo.padEnd(2),
    (row.serie || '').padEnd(4),
    row.numero.padStart(8, '0'),
    '',                                    // anio_emision_dua
    row.tipoDocProveedor.padEnd(1),
    (row.rucProveedor || '').padEnd(20),
    (row.razonSocialProveedor || '').padEnd(100),
    formatPLEAmount(row.baseGravada),
    formatPLEAmount(row.igv),
    formatPLEAmount(row.noGravada),
    '0.00',                                // ISC
    '0.00',                                // otros tributos
    formatPLEAmount(row.total),
    row.moneda,
    formatPLEAmount(row.tipoCambio),
    row.constanciaDetraccion || '',
    row.estado === 'activo' ? '1' : '2',
  ].join('|');
}

// ─── Nombres de meses en español ─────────────────────────────────────────────

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function nombrePeriodo(anio: number, mes: number): string {
  return `${MESES_ES[mes - 1]} ${anio}`;
}

export function periodoToString(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, '0')}`;
}
