/**
 * Memphis ERP — Supabase Edge Function: sunat-proxy
 * Proxies requests to apis.net.pe (SUNAT/RENIEC) to avoid browser CORS restrictions.
 * Requires APIS_NET_PE_TOKEN env variable (free token from https://apis.net.pe).
 *
 * GET /sunat-proxy?tipo=ruc&numero=20100070970
 * GET /sunat-proxy?tipo=dni&numero=12345678
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const BASE_URL = 'https://api.apis.net.pe/v2'
const API_TOKEN = Deno.env.get('APIS_NET_PE_TOKEN') ?? ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo')
  const numero = url.searchParams.get('numero')?.replace(/\D/g, '') ?? ''

  if (!tipo || !numero) {
    return new Response(JSON.stringify({ error: 'Missing params: tipo, numero' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (tipo === 'ruc' && numero.length !== 11) {
    return new Response(JSON.stringify({ error: 'RUC must be 11 digits' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  if (tipo === 'dni' && numero.length !== 8) {
    return new Response(JSON.stringify({ error: 'DNI must be 8 digits' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const endpoint = tipo === 'ruc'
    ? `${BASE_URL}/sunat/ruc?numero=${numero}`
    : `${BASE_URL}/reniec/dni?numero=${numero}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`

  try {
    const res = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return new Response(JSON.stringify({ error: `API error: ${res.status}`, detail: body }), {
        status: res.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
