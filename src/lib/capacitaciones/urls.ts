/**
 * Enlaces públicos del módulo. Un QR impreso tiene que seguir funcionando
 * dentro de cinco años, así que SIEMPRE apunta al dominio de producción,
 * salvo en desarrollo local (para probar el flujo completo sin desplegar).
 */
const DOMINIO_PRODUCCION = 'https://erp.memphismaquinarias.com';

export function dominioPublico(): string {
  if (typeof window === 'undefined') return DOMINIO_PRODUCCION;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost')) return window.location.origin;
  return DOMINIO_PRODUCCION;
}

/** Página de verificación de UN certificado (va en el QR del diploma). */
export const urlVerificacion = (token: string) => `${dominioPublico()}/cert/${token}`;

/** Formulario de asistencia con firma, desde el celular del participante. */
export const urlAsistencia = (token: string) => `${dominioPublico()}/c/${token}`;

/** Portal: la persona escribe su DNI y ve sus capacitaciones y certificados. */
export const urlPortalCertificados = () => `${dominioPublico()}/certificados`;

/** Nombre corto del dominio para imprimirlo en el certificado. */
export const dominioCorto = () => dominioPublico().replace(/^https?:\/\//, '');
