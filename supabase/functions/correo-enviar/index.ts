/**
 * Memphis ERP — Edge Function: correo-enviar
 *
 * La única puerta de salida de correos del ERP. Envía por Microsoft Graph con el
 * token de aplicación que ya usa el ERP para SharePoint/Entra (MS_TENANT_ID,
 * MS_CLIENT_ID, MS_CLIENT_SECRET), desde el buzón remitente configurado en
 * `configuracion_tenant` (clave `correo_remitente`). Requiere en Entra el permiso
 * de aplicación Mail.Send con consentimiento de administrador; si falta, Graph
 * contesta 403 y aquí se devuelve el motivo legible (no revienta a quien llama).
 *
 * Es INTERNA: la llaman otras Edge Functions (portal-proveedor-alta, avisos) o
 * pg_cron. Exige `x-cron-secret` (vault cron_secret) o la clave de servicio.
 *
 * Body: { tenant_id, para: string|string[], asunto, html, texto?, cc?, responder_a?,
 *         adjuntos?: [{ nombre, content_type?, base64 }], adjuntos_url?: [{ nombre, url }] }
 * Los adjuntos por URL se descargan aquí (p. ej. la guía del portal publicada en el ERP).
 * Límite Graph para adjuntos simples: ~3 MB en total; si se pasa, se envía sin adjuntos y se avisa.
 * Respuesta: { ok, remitente, id? } | { ok:false, error, detalle? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SECRET = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function getAppToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: Deno.env.get('MS_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
    scope: 'https://graph.microsoft.com/.default',
  })
  const r = await fetch(`https://login.microsoftonline.com/${Deno.env.get('MS_TENANT_ID')}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`No se pudo obtener el token de Microsoft: ${(await r.text()).slice(0, 200)}`)
  return (await r.json()).access_token as string
}

export interface Correo {
  tenant_id: string
  para: string | string[]
  asunto: string
  html: string
  texto?: string
  cc?: string | string[]
  responder_a?: string
  adjuntos?: { nombre: string; content_type?: string; base64: string }[]
  adjuntos_url?: { nombre: string; url: string }[]
}

const MAX_ADJUNTOS_BYTES = 3 * 1024 * 1024

function aBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Resuelve adjuntos (base64 directos + descargados por URL). Nunca lanza: lo que falle se omite y se informa. */
async function resolverAdjuntos(c: Correo): Promise<{ lista: Record<string, unknown>[]; avisos: string[] }> {
  const lista: Record<string, unknown>[] = []
  const avisos: string[] = []
  let total = 0
  for (const a of c.adjuntos ?? []) {
    if (!a?.nombre || !a?.base64) continue
    total += Math.floor(a.base64.length * 3 / 4)
    lista.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.nombre, contentType: a.content_type ?? 'application/octet-stream', contentBytes: a.base64 })
  }
  for (const a of c.adjuntos_url ?? []) {
    if (!a?.nombre || !a?.url) continue
    try {
      const r = await fetch(a.url, { signal: AbortSignal.timeout(10000) })
      if (!r.ok) { avisos.push(`No se pudo descargar ${a.nombre} (HTTP ${r.status})`); continue }
      const bytes = new Uint8Array(await r.arrayBuffer())
      total += bytes.length
      lista.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.nombre, contentType: r.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream', contentBytes: aBase64(bytes) })
    } catch (e) {
      avisos.push(`No se pudo descargar ${a.nombre}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (total > MAX_ADJUNTOS_BYTES) {
    avisos.push(`Adjuntos omitidos: superan el límite de ${Math.round(MAX_ADJUNTOS_BYTES / 1024 / 1024)} MB (${Math.round(total / 1024)} KB)`)
    return { lista: [], avisos }
  }
  return { lista, avisos }
}

/** Envía un correo por Graph. Devuelve el motivo si no se pudo, nunca lanza. */
export async function enviarCorreo(c: Correo): Promise<{ ok: boolean; remitente?: string; error?: string; detalle?: string; adjuntos?: number; avisos?: string[] }> {
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SECRET)
  const { data: cfg } = await admin.from('configuracion_tenant').select('valor')
    .eq('tenant_id', c.tenant_id).eq('clave', 'correo_remitente').maybeSingle()
  const remitente: string = Deno.env.get('MS_MAIL_SENDER') ?? (cfg?.valor as string | undefined) ?? ''
  if (!remitente) return { ok: false, error: 'No hay buzón remitente configurado (configuracion_tenant.correo_remitente)' }

  const lista = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []).filter(x => x.includes('@'))
  const para = lista(c.para)
  if (para.length === 0) return { ok: false, error: 'Sin destinatario válido' }

  let token: string
  try { token = await getAppToken() } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }

  const { lista: attachments, avisos } = await resolverAdjuntos(c)

  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(remitente)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: c.asunto,
        body: { contentType: 'HTML', content: c.html },
        toRecipients: para.map(a => ({ emailAddress: { address: a } })),
        ccRecipients: lista(c.cc).map(a => ({ emailAddress: { address: a } })),
        replyTo: c.responder_a ? [{ emailAddress: { address: c.responder_a } }] : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (r.status === 202) return { ok: true, remitente, adjuntos: attachments.length, avisos: avisos.length ? avisos : undefined }
  const detalle = (await r.text().catch(() => '')).slice(0, 400)
  const error = r.status === 403
    ? `Microsoft no deja enviar desde ${remitente} (403). Falta el permiso de aplicación Mail.Send con consentimiento de administrador en Entra, o el buzón no existe.`
    : r.status === 404 ? `El buzón remitente ${remitente} no existe en Microsoft 365 (404).`
    : `Graph ${r.status} al enviar el correo.`
  return { ok: false, error, detalle }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // Interna: cron secret o clave de servicio. Nunca un usuario final.
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const conSecreto = cronSecret && req.headers.get('x-cron-secret') === cronSecret
  const conServicio = SECRET && auth === SECRET
  if (!conSecreto && !conServicio) return json({ error: 'forbidden' }, 403)

  let body: Correo & { diagnostico?: boolean }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  // { diagnostico: true } → qué permisos de aplicación trae el token de Graph
  // (claim `roles`), para saber si Mail.Send ya está concedido. No expone el token.
  if (body?.diagnostico) {
    try {
      const token = await getAppToken()
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return json({ ok: true, roles: claims.roles ?? [], app_id: claims.appid ?? claims.azp ?? null, expira: claims.exp ?? null })
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502)
    }
  }

  if (!body?.tenant_id || !body.para || !body.asunto || !body.html) return json({ error: 'Faltan tenant_id, para, asunto o html' }, 400)

  const res = await enviarCorreo(body)
  return json(res, res.ok ? 200 : 502)
})
