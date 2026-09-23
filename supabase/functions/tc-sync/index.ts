/**
 * Memphis ERP — Edge Function: tc-sync
 *
 * Trae el tipo de cambio SUNAT (USD→PEN, compra/venta) y lo guarda en la tabla
 * `tipos_cambio` (global, un valor por día). Pensada para correr 1×/día vía
 * pg_cron (07:30 Perú), pero acepta `?date=AAAA-MM-DD` y `?dias=N` para
 * rellenar un rango hacia atrás.
 *
 * Fuentes, en orden:
 *  1. API de decolecta (antes apis.net.pe), la misma del sunat-proxy. Sin token
 *     tiene cuota y a veces contesta "Apikey Required / Limit Exceeded".
 *  2. Respaldo: series del BCRP "TC Sistema bancario SBS" (PD04639PD compra /
 *     PD04640PD venta). SUNAT publica para el día d el cierre SBS del día hábil
 *     anterior, así que SUNAT(d) = SBS(último hábil < d). Con esto se cargó el
 *     histórico 2022-09 → 2026-09 (Finanzas decidió TC SUNAT diario, 23/09/2026).
 *
 * Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIS_NET_PE_TOKEN (opcional),
 *           CRON_SECRET (opcional: si está, exige el header x-cron-secret).
 *
 * Con esto muere el 3.40 fijo: la OC en dólares toma el TC del día al nacer
 * (trigger trg_oc_tipo_cambio) y todo lo demás usa tc_vigente(fecha).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const API = 'https://api.decolecta.com/v1/tipo-cambio/sunat'
const BCRP = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04639PD-PD04640PD/json'
const MES_BCRP: Record<string, string> = {
  Ene: '01', Feb: '02', Mar: '03', Abr: '04', May: '05', Jun: '06',
  Jul: '07', Ago: '08', Set: '09', Sep: '09', Oct: '10', Nov: '11', Dic: '12',
}

/** Fecha de hoy en Perú (UTC-5), AAAA-MM-DD. */
function hoyPeru(): string {
  const d = new Date(Date.now() - 5 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}
function restarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Saca compra/venta de cualquiera de las formas en que la API los devuelve. */
function extraer(raw: any): { compra: number; venta: number; fecha?: string } | null {
  const o = raw?.data ?? raw
  if (!o || typeof o !== 'object') return null
  const num = (...ks: string[]) => {
    for (const k of ks) { const v = Number(o[k]); if (Number.isFinite(v) && v > 0) return v }
    return NaN
  }
  const compra = num('compra', 'precioCompra', 'buy', 'buy_price', 'purchase')
  const venta = num('venta', 'precioVenta', 'sell', 'sell_price', 'sale')
  if (!Number.isFinite(compra) || !Number.isFinite(venta)) return null
  return { compra, venta, fecha: o.fecha ?? o.date ?? undefined }
}

/** SUNAT(fecha) por el BCRP: cierre SBS del último día hábil anterior a la fecha. */
async function desdeBcrp(fecha: string): Promise<{ compra: number; venta: number; sbs: string } | null> {
  const r = await fetch(`${BCRP}/${restarDias(fecha, 12)}/${restarDias(fecha, 1)}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000),
  })
  if (!r.ok) return null
  const d = await r.json()
  let ultimo: { compra: number; venta: number; sbs: string } | null = null
  for (const p of d?.periods ?? []) {
    const [dd, mmm, yy] = String(p.name ?? '').split('.')
    const mm = MES_BCRP[mmm]
    if (!mm) continue
    const compra = Number(p.values?.[0]); const venta = Number(p.values?.[1])
    if (!Number.isFinite(compra) || !Number.isFinite(venta) || compra <= 0) continue // 'n.d.'
    const sbs = `20${yy}-${mm}-${dd.padStart(2, '0')}`
    if (sbs < fecha) ultimo = { compra, venta, sbs }
  }
  return ultimo
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (cronSecret && (req.headers.get('x-cron-secret') ?? '') !== cronSecret) {
    return json({ error: 'forbidden' }, 403)
  }

  const url = new URL(req.url)
  let cuerpo: { date?: string; dias?: number } = {}
  if (req.method === 'POST') { try { cuerpo = await req.json() } catch { cuerpo = {} } }
  const hasta = url.searchParams.get('date') ?? cuerpo.date ?? hoyPeru()
  const dias = Math.min(Math.max(Number(url.searchParams.get('dias') ?? cuerpo.dias ?? 1), 1), 120)

  const token = Deno.env.get('APIS_NET_PE_TOKEN') ?? ''
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const guardados: string[] = []
  const errores: { fecha: string; error: string }[] = []

  for (let i = 0; i < dias; i++) {
    const fecha = restarDias(hasta, i)
    let porQueNoSunat = ''
    try {
      const r = await fetch(`${API}?date=${fecha}`, { headers, signal: AbortSignal.timeout(10000) })
      const texto = await r.text()
      let tc: ReturnType<typeof extraer> = null
      if (!r.ok) porQueNoSunat = `HTTP ${r.status}: ${texto.slice(0, 200)}`
      else {
        try { tc = extraer(JSON.parse(texto)) } catch { porQueNoSunat = `respuesta no JSON: ${texto.slice(0, 120)}` }
        if (!tc && !porQueNoSunat) porQueNoSunat = `sin compra/venta en: ${texto.slice(0, 200)}`
      }
      if (tc) {
        // SUNAT no publica fines de semana/feriados: la API suele devolver el
        // último día hábil. Se guarda bajo la fecha pedida (así tc_vigente la
        // encuentra) con la fuente indicando de qué día es.
        const fuente = tc.fecha && tc.fecha !== fecha ? `sunat (publicado ${tc.fecha})` : 'sunat'
        const { error } = await admin.from('tipos_cambio')
          .upsert({ fecha, compra: tc.compra, venta: tc.venta, fuente }, { onConflict: 'fecha' })
        if (error) { errores.push({ fecha, error: error.message }); continue }
        guardados.push(`${fecha}=${tc.venta}`)
        continue
      }
      // Respaldo BCRP. No pisa un valor que ya vino directo de SUNAT.
      const b = await desdeBcrp(fecha)
      if (!b) { errores.push({ fecha, error: `${porQueNoSunat} · BCRP sin dato` }); continue }
      const { error } = await admin.from('tipos_cambio')
        .upsert({ fecha, compra: b.compra, venta: b.venta, fuente: `sunat (SBS ${b.sbs} via BCRP)` },
                { onConflict: 'fecha', ignoreDuplicates: true })
      if (error) { errores.push({ fecha, error: error.message }); continue }
      guardados.push(`${fecha}=${b.venta} (BCRP)`)
    } catch (e) {
      errores.push({ fecha, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const ok = guardados.length > 0
  return json({ ok, guardados, errores }, ok ? 200 : 502)
})
