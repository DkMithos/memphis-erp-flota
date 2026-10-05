/**
 * Cliente de la Edge Function pública `capacitaciones-publico`.
 * Lo usan las pantallas sin sesión: verificación por QR, portal por DNI y
 * formulario de asistencia. Se llama con fetch directo (sin JWT) porque la
 * función es pública; `functions.invoke` adjuntaría la sesión si la hubiera.
 */
import type { CapacitacionPublica, CertificadoPublico, TemaTemario } from './types';

const URL_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capacitaciones-publico`;

export class ErrorPublico extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(msg: string, status: number, extra?: Record<string, unknown>) {
    super(msg); this.status = status; this.extra = extra;
  }
}

async function llamar<T>(body: Record<string, unknown>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(URL_FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new ErrorPublico('Sin conexión. Revise su internet e intente de nuevo.', 0);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorPublico(data?.error || `Error ${r.status}`, r.status, data);
  return data as T;
}

export interface FormularioAsistencia {
  codigo: string;
  titulo: string;
  descripcion: string | null;
  temario: TemaTemario[];
  horas_total: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  ciudad: string | null;
  instructor_nombre: string | null;
  entidad_beneficiaria: string | null;
  proyecto: { codigo: string; nombre: string } | null;
  consorcio_nombre: string | null;
  logo_url: string | null;
  color_primario: string;
  color_acento: string;
  firmados: number;
}

export const publico = {
  verificar: (token: string) =>
    llamar<{ encontrado: boolean; certificado?: CertificadoPublico }>({ accion: 'verificar', token }),

  consultarDni: (dni: string) =>
    llamar<{ encontrado: boolean; persona?: { nombres: string; apellidos: string; dni_mascara: string }; capacitaciones?: CapacitacionPublica[] }>({ accion: 'consultar', dni }),

  capacitacion: (token: string) =>
    llamar<{ encontrado: boolean; abierta?: boolean; capacitacion?: FormularioAsistencia }>({ accion: 'capacitacion', token }),

  firmar: (datos: { token: string; dni: string; nombres: string; apellidos: string; cargo?: string; institucion?: string; email?: string; telefono?: string; firma: string }) =>
    llamar<{ ok: boolean; nombres: string; apellidos: string; capacitacion: string }>({ accion: 'firmar', ...datos }),
};
