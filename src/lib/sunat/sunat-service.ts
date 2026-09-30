/**
 * Memphis ERP — Servicio de consulta SUNAT
 * Llama al Edge Function sunat-proxy, que consulta en cadena decolecta.com (si hay
 * token APIS_NET_PE_TOKEN) → apis.net.pe v2 → apis.net.pe v1, y devuelve siempre el
 * mismo formato snake_case. Aquí se distingue "no existe" (null) de "el servicio
 * no respondió" (SunatServicioError), para no decirle al usuario que un RUC no
 * existe cuando en realidad se cayó la consulta.
 */

/** El servicio de consulta no respondió (cuota agotada, token inválido, caída). */
export class SunatServicioError extends Error {
  constructor(message = 'El servicio de consulta SUNAT no está disponible en este momento. Intente de nuevo en unos minutos o registre los datos a mano.') {
    super(message);
    this.name = 'SunatServicioError';
  }
}

export interface SunatRucResult {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  estado: string;          // ACTIVO | BAJA DE OFICIO | SUSPENDIDO | ...
  condicion: string;       // HABIDO | NO HABIDO
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  ubigeo?: string;
  tipo?: string;           // empresa | persona_natural
  actividadEconomica?: string;
}

export interface SunatDniResult {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
}

// Supabase Edge Function proxy URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/sunat-proxy`;

async function callProxy(params: Record<string, string>): Promise<Record<string, string> | null> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${PROXY_URL}?${qs}`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404 || res.status === 422) return null; // no existe
  if (!res.ok) throw new SunatServicioError();                // cuota/token/caída
  const data = await res.json();
  if (data?.error) return null;
  return data;
}

/**
 * Consulta datos de un RUC en SUNAT (via Edge Function → decolecta.com).
 * Retorna null si el RUC no existe o hay error.
 */
export async function consultarRUC(ruc: string): Promise<SunatRucResult | null> {
  const rucLimpio = ruc.replace(/\D/g, '').trim();
  if (rucLimpio.length !== 11) return null;

  try {
    const data = await callProxy({ tipo: 'ruc', numero: rucLimpio });
    if (!data) return null;

    // decolecta.com uses snake_case fields
    const rucVal = data.numero_documento ?? data.ruc ?? '';
    if (!rucVal) return null;

    return {
      ruc: rucVal,
      razonSocial: data.razon_social ?? data.razonSocial ?? '',
      nombreComercial: data.nombre_comercial ?? data.nombreComercial ?? undefined,
      estado: data.estado ?? '',
      condicion: data.condicion ?? '',
      direccion: data.direccion ?? undefined,
      departamento: data.departamento ?? undefined,
      provincia: data.provincia ?? undefined,
      distrito: data.distrito ?? undefined,
      ubigeo: data.ubigeo ?? undefined,
      tipo: rucLimpio.startsWith('20') ? 'empresa' : 'persona_natural',
      actividadEconomica: data.actividad_economica ?? data.actividadEconomica ?? undefined,
    };
  } catch (e) {
    if (e instanceof SunatServicioError) throw e;
    // Timeout o red caída: también es "servicio no disponible", no "RUC inexistente"
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError' || e.name === 'TypeError')) throw new SunatServicioError();
    return null;
  }
}

/**
 * Consulta datos de un DNI en RENIEC (via Edge Function → decolecta.com).
 */
export async function consultarDNI(dni: string): Promise<SunatDniResult | null> {
  const dniLimpio = dni.replace(/\D/g, '').trim();
  if (dniLimpio.length !== 8) return null;

  try {
    const data = await callProxy({ tipo: 'dni', numero: dniLimpio });
    if (!data) return null;

    // decolecta.com DNI fields
    const dniVal = data.document_number ?? data.dni ?? '';
    if (!dniVal) return null;

    const nombres = data.first_name ?? data.nombres ?? '';
    const apellidoPaterno = data.first_last_name ?? data.apellidoPaterno ?? '';
    const apellidoMaterno = data.second_last_name ?? data.apellidoMaterno ?? '';

    return {
      dni: dniVal,
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      nombreCompleto: data.full_name ?? `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim(),
    };
  } catch (e) {
    if (e instanceof SunatServicioError) throw e;
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError' || e.name === 'TypeError')) throw new SunatServicioError();
    return null;
  }
}

/**
 * Formatea una dirección SUNAT en una sola línea.
 */
export function formatearDireccionSunat(result: SunatRucResult): string {
  const parts = [result.direccion, result.distrito, result.provincia, result.departamento]
    .filter(Boolean);
  return parts.join(', ');
}
