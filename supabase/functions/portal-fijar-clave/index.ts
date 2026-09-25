/**
 * Memphis ERP — Edge Function PÚBLICA: portal-fijar-clave
 *
 * Cierra el hueco del enlace de contraseña. Antes se compartía el link de
 * recovery de GoTrue (…/auth/v1/verify?token=…): un enlace de UN SOLO USO que se
 * consume con el PRIMER GET. Los previsualizadores de WhatsApp/Teams/Outlook (y
 * los escáneres tipo Safe Links) hacen ese GET automáticamente para armar la
 * tarjeta de vista previa, quemando el token antes de que el proveedor haga clic
 * — por eso un enlace recién enviado, sin que nadie lo abriera, aparecía como
 * "usado o vencido".
 *
 * Ahora Memphis comparte un CÓDIGO OPACO propio (…/portal/invitacion?code=…).
 * Esa página es HTML estático: un bot que la baje no consume nada. El código
 * solo se consume aquí, cuando una PERSONA envía su contraseña (POST 'fijar').
 * La contraseña la elige el proveedor y se fija por Admin API; Memphis nunca la
 * ve ni la guarda.
 *
 * Acciones:
 *   { accion:'verificar', code }          → ¿el código sirve? (no lo consume)
 *   { accion:'fijar', code, password }    → fija la contraseña y consume el código
 *
 * Pública (sin sesión: el proveedor aún no la tiene). El control de acceso es la
 * posesión del código opaco de alta entropía, igual que cualquier token de
 * "restablecer contraseña", pero consumido por acción humana, no por un GET.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SECRET = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

    let body: { accion?: string; code?: string; password?: string }
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

    const accion = body.accion ?? 'verificar'
    const code = (body.code ?? '').trim()
    if (!code || code.length < 20) return json({ ok: false, motivo: 'invalida' }, 200)

    const admin = createClient(SUPABASE_URL, SECRET)
    const codeHash = await sha256hex(code)

    // Buscar la invitación por hash. El código en claro nunca se guarda.
    const { data: invit } = await admin
      .from('portal_invitaciones')
      .select('id, proveedor_id, portal_user_id, expira_en, consumida_en')
      .eq('code_hash', codeHash)
      .maybeSingle()

    if (!invit) return json({ ok: false, motivo: 'invalida' }, 200)
    if (invit.consumida_en) return json({ ok: false, motivo: 'usada' }, 200)
    if (new Date(invit.expira_en).getTime() < Date.now()) return json({ ok: false, motivo: 'vencida' }, 200)

    const { data: prov } = await admin
      .from('proveedores').select('razon_social, ruc').eq('id', invit.proveedor_id).maybeSingle()

    // Verificar: solo confirma que el código sirve (para mostrar el nombre y el
    // formulario). NO consume nada — un bot que ejecutara JS tampoco haría daño.
    if (accion === 'verificar') {
      return json({ ok: true, razon_social: prov?.razon_social ?? '', ruc: prov?.ruc ?? '' })
    }

    if (accion === 'fijar') {
      const password = body.password ?? ''
      if (password.length < 8) return json({ ok: false, motivo: 'clave_corta', error: 'La contraseña debe tener al menos 8 caracteres' }, 200)

      // Fijar la contraseña por Admin API (el proveedor la eligió; no se guarda).
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${invit.portal_user_id}`, {
        method: 'PUT',
        headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        console.error('[fijar-clave] admin PUT error:', res.status, t)
        // Política de contraseñas de Auth (mayúscula, minúscula, número, símbolo; no filtradas):
        // se traduce a un mensaje claro para el proveedor en vez de un 500 genérico.
        if (res.status === 422 && /weak_password/.test(t)) {
          const filtrada = /pwned/.test(t)
          return json({
            ok: false, motivo: 'clave_debil',
            error: filtrada
              ? 'Esa contraseña es muy común y aparece en listas filtradas; elija otra. Debe tener mínimo 8 caracteres con mayúscula, minúscula, número y símbolo (por ejemplo: Ferreteria-2026!).'
              : 'La contraseña debe tener mínimo 8 caracteres e incluir al menos una mayúscula, una minúscula, un número y un símbolo (por ejemplo: Ferreteria-2026!).',
          }, 200)
        }
        return json({ ok: false, error: `No se pudo fijar la contraseña (HTTP ${res.status})` }, 500)
      }

      // Consumir la invitación (marca atómica: solo si seguía sin consumir).
      const { data: consumida } = await admin
        .from('portal_invitaciones')
        .update({ consumida_en: new Date().toISOString() })
        .eq('id', invit.id).is('consumida_en', null)
        .select('id').maybeSingle()
      if (!consumida) return json({ ok: false, motivo: 'usada' }, 200)

      return json({ ok: true, ruc: prov?.ruc ?? '' })
    }

    return json({ error: 'Acción no reconocida' }, 400)
  },
}
