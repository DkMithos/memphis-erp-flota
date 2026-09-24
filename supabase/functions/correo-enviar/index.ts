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
 * Body: { tenant_id, para: string|string[], asunto, html, texto?, cc?, responder_a? }
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
}

/** Envía un correo por Graph. Devuelve el motivo si no se pudo, nunca lanza. */
export async function enviarCorreo(c: Correo): Promise<{ ok: boolean; remitente?: string; error?: string; detalle?: string }> {
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
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (r.status === 202) return { ok: true, remitente }
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

  let body: Correo
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  if (!body?.tenant_id || !body.para || !body.asunto || !body.html) return json({ error: 'Faltan tenant_id, para, asunto o html' }, 400)

  const res = await enviarCorreo(body)
  return json(res, res.ok ? 200 : 502)
})
