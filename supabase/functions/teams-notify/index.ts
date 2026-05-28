/**
 * Memphis ERP — Supabase Edge Function: teams-notify
 *
 * FASE 1 (Notificaciones Teams vía Microsoft Graph — app-only).
 *
 * Envía una Adaptive Card a un canal o chat de Teams cuando ocurre un evento
 * del ERP (OT vencida, OC por aprobar, mantenimiento próximo, presupuesto en riesgo).
 *
 * Request (POST):
 *   Authorization: Bearer <supabase_jwt>
 *   body: {
 *     tipo: string,            // 'OC_POR_APROBAR' | 'OT_VENCIDA' | ...
 *     titulo: string,
 *     cuerpo?: string,
 *     accionUrl?: string,      // deep link al ERP
 *     destino: {               // canal o chat destino
 *       teamId?: string, channelId?: string,   // → mensaje a canal
 *       chatId?: string                          // → mensaje a chat
 *     },
 *     datos?: Record<string, unknown>
 *   }
 *
 * Secretos requeridos:
 *   - MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   (app registration de Azure)
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY         (para log + tenant)
 *
 * NOTA: enviar mensajes a canales con permisos de aplicación (ChannelMessage.Send)
 * puede requerir Resource-Specific Consent (RSC) en el equipo destino. Si Graph
 * devuelve 403, registrar el evento y evaluar el fallback de Power Automate.
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

// Token app-only (client credentials) para Microsoft Graph
async function getAppToken(): Promise<string> {
  const tenantId = Deno.env.get('MS_TENANT_ID') ?? ''
  const clientId = Deno.env.get('MS_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('MS_CLIENT_SECRET') ?? ''
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET')
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Token error ${res.status}: ${detail}`)
  }
  const data = await res.json()
  return data.access_token as string
}

// Construye el payload del mensaje de Teams (HTML con enlace de acción)
function buildMessage(titulo: string, cuerpo?: string, accionUrl?: string) {
  const accion = accionUrl
    ? `<br/><a href="${accionUrl}">Ver en Memphis ERP →</a>`
    : ''
  return {
    body: {
      contentType: 'html',
      content: `<strong>${titulo}</strong><br/>${cuerpo ?? ''}${accion}`,
    },
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

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

  const { tipo, titulo, cuerpo, accionUrl, destino, datos } = payload ?? {}
  if (!tipo || !titulo || !destino) {
    return json({ error: 'Missing required fields: tipo, titulo, destino' }, 400)
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

  // Helper de auditoría
  const logNotif = async (estado: string, errorDetalle?: string, destinatario?: string) => {
    if (!tenantId) return
    await admin.from('notificaciones_log').insert({
      tenant_id: tenantId,
      canal: 'teams',
      tipo, titulo, cuerpo: cuerpo ?? null,
      accion_url: accionUrl ?? null,
      destinatario: destinatario ?? null,
      estado, error_detalle: errorDetalle ?? null,
      datos: datos ?? null,
    })
  }

  try {
    const token = await getAppToken()
    const message = buildMessage(titulo, cuerpo, accionUrl)

    // Determinar endpoint: canal vs chat
    let endpoint = ''
    let destinatario = ''
    if (destino.teamId && destino.channelId) {
      endpoint = `https://graph.microsoft.com/v1.0/teams/${destino.teamId}/channels/${destino.channelId}/messages`
      destinatario = `team:${destino.teamId}/channel:${destino.channelId}`
    } else if (destino.chatId) {
      endpoint = `https://graph.microsoft.com/v1.0/chats/${destino.chatId}/messages`
      destinatario = `chat:${destino.chatId}`
    } else {
      return json({ error: 'destino must include teamId+channelId or chatId' }, 400)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      await logNotif('error', `Graph ${res.status}: ${detail}`, destinatario)
      return json({ error: `Graph send failed: ${res.status}`, detail }, 502)
    }

    const sent = await res.json()
    await logNotif('enviado', undefined, destinatario)
    return json({ ok: true, messageId: sent.id ?? null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logNotif('error', msg)
    return json({ error: msg }, 500)
  }
})
