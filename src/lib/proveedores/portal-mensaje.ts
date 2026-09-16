/**
 * EL CORREO QUE SE LE MANDA AL PROVEEDOR CON SUS ACCESOS.
 *
 * Richard tenía que entrar proveedor por proveedor, generar el enlace, copiarlo,
 * abrir el correo y escribir de memoria los pasos. Con 98 proveedores ya dados
 * de alta, eso es un día de trabajo cada vez que hay que reenviar algo.
 *
 * Aquí vive el texto, una sola vez, para que todos los proveedores reciban lo
 * mismo y nadie tenga que redactarlo. El envío lo sigue haciendo una persona
 * desde su propio correo: el ERP no manda correos por su cuenta.
 */

export interface DatosAcceso {
  razonSocial: string;
  ruc: string;
  /** Enlace de un solo uso para que el proveedor fije su contraseña. */
  enlace: string;
  /** Correo real del proveedor. */
  email: string;
}

export const URL_PORTAL = 'https://erp.memphismaquinarias.com/portal';

/** Horas que dura el enlace antes de caducar. Lo fija Supabase, no nosotros. */
export const HORAS_VIGENCIA = 24;

export function asuntoPortal(d: Pick<DatosAcceso, 'razonSocial'>): string {
  return `Acceso al Portal de Proveedores de Memphis Maquinarias — ${d.razonSocial}`;
}

/**
 * El cuerpo del correo. En texto plano a propósito: se pega igual de bien en
 * Outlook, en WhatsApp o en un correo del móvil.
 */
export function cuerpoPortal(d: DatosAcceso): string {
  return [
    `Estimados señores de ${d.razonSocial}:`,
    '',
    'Memphis Maquinarias ha habilitado su acceso al Portal de Proveedores. Desde ahí',
    'podrán subir sus comprobantes y hacer seguimiento a sus órdenes de compra sin',
    'tener que enviarlos por correo.',
    '',
    'PASOS PARA ENTRAR (la primera vez)',
    '',
    `1. Abra este enlace para crear su contraseña. Es de un solo uso y vence en ${HORAS_VIGENCIA} horas:`,
    `   ${d.enlace}`,
    '',
    '2. Escriba la contraseña que desee y confírmela. Memphis no la ve ni la guarda.',
    '',
    `3. A partir de ahí entre siempre por: ${URL_PORTAL}`,
    `   Usuario: ${d.ruc}   (su RUC, sin guiones ni espacios)`,
    '   Contraseña: la que acaba de crear.',
    '',
    'SI EL ENLACE YA VENCIÓ',
    '',
    'Escríbanos y le generamos uno nuevo en el momento. No pierde nada de lo ya',
    'cargado.',
    '',
    'Cualquier consulta, respondan a este correo.',
    '',
    'Atentamente,',
    'Área de Compras — Memphis Maquinarias S.A.C.',
  ].join('\n');
}

/**
 * `mailto:` con destinatario, asunto y cuerpo ya puestos. Al pulsarlo se abre
 * Outlook con el correo escrito; la persona solo revisa y le da a enviar.
 *
 * Los saltos de línea van como %0D%0A —CRLF— porque Outlook ignora el %0A suelto
 * y pega todo el texto en un párrafo.
 */
export function mailtoPortal(d: DatosAcceso): string {
  const cuerpo = cuerpoPortal(d).replace(/\n/g, '\r\n');
  return `mailto:${encodeURIComponent(d.email)}`
    + `?subject=${encodeURIComponent(asuntoPortal(d))}`
    + `&body=${encodeURIComponent(cuerpo)}`;
}

/**
 * El correo de un proveedor, mirando donde toca: primero el que se registró
 * para el portal, y si no, el general de la ficha.
 */
export function correoDelProveedor(p: {
  emailPortal?: string | null;
  email?: string | null;
}): string {
  return (p.emailPortal ?? p.email ?? '').trim();
}

/** ¿Puede este proveedor usar el portal? Mismo criterio que la Edge Function. */
export function puedeUsarPortal(p: {
  domiciliado?: boolean | null;
  ruc?: string | null;
}): boolean {
  return p.domiciliado !== false && /^\d{11}$/.test((p.ruc ?? '').trim());
}
