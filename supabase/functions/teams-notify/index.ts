/**
 * Memphis ERP — Supabase Edge Function: teams-notify
 *
 * FASE 1 (Notificaciones Teams vía Power Automate Workflow webhook).
 *
 * Envía una Adaptive Card a Teams posteando a la URL de un flujo de Power
 * Automate ("Publicar en un canal cuando se recibe una solicitud de webhook").
 * Este camino NO requiere permisos de Microsoft Graph ni client secret —
 * evita la restricción de app-only de la API de mensajes de Teams.
 *
 * Request (POST):
 *   Authorization: Bearer <supabase_jwt>
 *   body: {
 *     tipo: string,            // 'OC_POR_APROBAR' | 'OT_VENCIDA' | ...
 *     titulo: string,
 *     cuerpo?: string,
 *     accionUrl?: string,      // deep link al ERP
 *     hechos?: { label: string; value: string }[],  // pares clave/valor opcionales
 *     datos?: Record<string, unknown>
 *   }
 *
 * Secretos requeridos:
 *   - TEAMS_WEBHOOK_URL            (URL del flujo de Power Automate)
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (para auditoría + tenant)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

// Construye la Adaptive Card "pelada" (sin envelope) que el flujo de Power
// Automate inserta directamente en "Tarjeta adaptable" vía triggerBody().
function buildAdaptiveCard(
  titulo: string,
  cuerpo?: string,
  accionUrl?: string,
  hechos?: { label: string; value: string }[],
) {
  const body: unknown[] = [
    { type: 'TextBlock', text: titulo, weight: 'Bolder', size: 'Medium', wrap: true },
  ]
  if (cuerpo) {
    body.push({ type: 'TextBlock', text: cuerpo, wrap: true, isSubtle: true })
  }
  if (hechos && hechos.length > 0) {
    body.push({
      type: 'FactSet',
      facts: hechos.map((h) => ({ title: h.label, value: h.value })),
    })
  }

  const actions = accionUrl
    ? [{ type: 'Action.OpenUrl', title: 'Ver en Memphis ERP', url: accionUrl }]
    : []

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body,
    actions,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL') ?? ''
  if (!webhookUrl) return json({ error: 'TEAMS_WEBHOOK_URL not configured' }, 500)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401)

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { tipo, titulo, cuerpo, accionUrl, hechos, datos } = payload ?? {}
  if (!tipo || !titulo) {
    return json({ error: 'Missing required fields: tipo, titulo' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Identificar usuario + tenant (para auditoría)
  const { data: userData } = await admin.auth.getUser(jwt)
  const userId = userData?.user?.id ?? null
  let tenantId: string | null = null
  if (userId) {
    const { data: profile } = await admin
      .from('profiles').select('tenant_id').eq('id', userId).single()
    tenantId = profile?.tenant_id ?? null
  }

  const logNotif = async (estado: string, errorDetalle?: string) => {
    if (!tenantId) return
    await admin.from('notificaciones_log').insert({
      tenant_id: tenantId,
      canal: 'teams',
      tipo, titulo, cuerpo: cuerpo ?? null,
      accion_url: accionUrl ?? null,
      destinatario: 'power-automate-webhook',
      estado, error_detalle: errorDetalle ?? null,
      datos: datos ?? null,
    })
  }

  try {
    const card = buildAdaptiveCard(titulo, cuerpo, accionUrl, hechos)
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      await logNotif('error', `Webhook ${res.status}: ${detail}`)
      return json({ error: `Webhook failed: ${res.status}`, detail }, 502)
    }

    await logNotif('enviado')
    return json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logNotif('error', msg)
    return json({ error: msg }, 500)
  }
})
