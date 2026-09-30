/**
 * Memphis ERP — Supabase Edge Function: sunat-proxy
 *
 * Consulta RUC (SUNAT) y DNI (RENIEC) para el ERP sin CORS desde el navegador.
 * No depende de un solo proveedor: prueba en cadena y devuelve la primera
 * respuesta válida, siempre normalizada al mismo formato (snake_case, el que
 * espera `src/lib/sunat/sunat-service.ts`).
 *
 *   1. decolecta.com  — solo si hay token (secreto APIS_NET_PE_TOKEN). Sin token
 *      responde 401 "Apikey Required / Limit Exceeded" y se salta.
 *   2. apis.net.pe v2 — gratis sin token (cuota compartida por IP).
 *   3. apis.net.pe v1 — gratis sin token, formato antiguo.
 *
 * GET /sunat-proxy?tipo=ruc&numero=20100070970
 * GET /sunat-proxy?tipo=dni&numero=12345678
 * Respuesta RUC: { numero_documento, razon_social, nombre_comercial, estado, condicion,
 *                  direccion, departamento, provincia, distrito, ubigeo, fuente }
 * Respuesta DNI: { document_number, first_name, first_last_name, second_last_name, full_name, fuente }
 * Error:         { error, detalle: [{ fuente, status, body }], token_configurado }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

const API_TOKEN = (Deno.env.get('APIS_NET_PE_TOKEN') ?? '').trim()

type Dict = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v)).trim()

/** Normaliza cualquier proveedor al formato del ERP (RUC). */
function normalizarRuc(d: Dict, fuente: string) {
  const numero = s(d.numero_documento ?? d.numeroDocumento ?? d.ruc)
  const razon = s(d.razon_social ?? d.razonSocial ?? d.nombre)
  if (!numero || !razon) return null
  return {
    numero_documento: numero,
    razon_social: razon,
    nombre_comercial: s(d.nombre_comercial ?? d.nombreComercial) || null,
    estado: s(d.estado),
    condicion: s(d.condicion),
    direccion: s(d.direccion) || null,
    departamento: s(d.departamento) || null,
    provincia: s(d.provincia) || null,
    distrito: s(d.distrito) || null,
    ubigeo: s(d.ubigeo) || null,
    tipo_documento: s(d.tipo_documento ?? d.tipoDocumento) || null,
    fuente,
  }
}

/** Normaliza cualquier proveedor al formato del ERP (DNI). */
function normalizarDni(d: Dict, fuente: string) {
  const numero = s(d.document_number ?? d.numeroDocumento ?? d.dni)
  const nombres = s(d.first_name ?? d.nombres)
  const ap = s(d.first_last_name ?? d.apellidoPaterno)
  const am = s(d.second_last_name ?? d.apellidoMaterno)
  const completo = s(d.full_name ?? d.nombreCompleto ?? d.nombre) || `${nombres} ${ap} ${am}`.trim()
  if (!numero || !completo) return null
  return { document_number: numero, first_name: nombres, first_last_name: ap, second_last_name: am, full_name: completo, fuente }
}

interface Fuente { nombre: string; url: string; token?: string }

function fuentes(tipo: 'ruc' | 'dni', numero: string): Fuente[] {
  const lista: Fuente[] = []
  if (API_TOKEN) {
    lista.push({
      nombre: 'decolecta',
      url: tipo === 'ruc'
        ? `https://api.decolecta.com/v1/sunat/ruc?numero=${numero}`
        : `https://api.decolecta.com/v1/reniec/dni?numero=${numero}`,
      token: API_TOKEN,
    })
  }
  lista.push({
    nombre: 'apis.net.pe v2',
    url: tipo === 'ruc'
      ? `https://api.apis.net.pe/v2/sunat/ruc?numero=${numero}`
      : `https://api.apis.net.pe/v2/reniec/dni?numero=${numero}`,
  })
  lista.push({
    nombre: 'apis.net.pe v1',
    url: tipo === 'ruc'
      ? `https://api.apis.net.pe/v1/ruc?numero=${numero}`
      : `https://api.apis.net.pe/v1/dni?numero=${numero}`,
  })
  return lista
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo')
  const numero = url.searchParams.get('numero')?.replace(/\D/g, '') ?? ''

  if ((tipo !== 'ruc' && tipo !== 'dni') || !numero) return json({ error: 'Missing params: tipo (ruc|dni), numero' }, 400)
  if (tipo === 'ruc' && numero.length !== 11) return json({ error: 'RUC must be 11 digits' }, 400)
  if (tipo === 'dni' && numero.length !== 8) return json({ error: 'DNI must be 8 digits' }, 400)

  const detalle: { fuente: string; status: number | string; body: string }[] = []

  for (const f of fuentes(tipo, numero)) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (f.token) headers['Authorization'] = `Bearer ${f.token}`
    try {
      const res = await fetch(f.url, { headers, signal: AbortSignal.timeout(8000) })
      const body = await res.text()
      if (!res.ok) { detalle.push({ fuente: f.nombre, status: res.status, body: body.slice(0, 200) }); continue }
      let data: Dict
      try { data = JSON.parse(body) } catch { detalle.push({ fuente: f.nombre, status: 'json', body: body.slice(0, 200) }); continue }
      const norm = tipo === 'ruc' ? normalizarRuc(data, f.nombre) : normalizarDni(data, f.nombre)
      if (!norm) { detalle.push({ fuente: f.nombre, status: 'vacio', body: body.slice(0, 200) }); continue }
      return json(norm)
    } catch (err) {
      detalle.push({ fuente: f.nombre, status: 'error', body: err instanceof Error ? err.message : String(err) })
    }
  }

  // Ninguna fuente respondió. 404 si todas dicen "no existe" (404/422 "ruc no valido");
  // 502 si fue cuota agotada, token inválido o caída de red.
  const noExiste = detalle.length > 0 && detalle.every(d => d.status === 404 || d.status === 422 || d.status === 'vacio' || (d.status === 401 && d.fuente === 'decolecta'))
  console.error('[sunat-proxy] sin respuesta', tipo, numero, JSON.stringify(detalle))
  return json({
    error: noExiste ? `${tipo.toUpperCase()} no encontrado` : 'Ninguna fuente de consulta respondió (cuota agotada o caída)',
    detalle,
    token_configurado: Boolean(API_TOKEN),
  }, noExiste ? 404 : 502)
})
