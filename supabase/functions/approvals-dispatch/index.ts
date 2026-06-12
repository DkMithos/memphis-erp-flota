/**
 * Memphis ERP — Edge Function: approvals-dispatch (Approvals one-way puente)
 *
 * Cuando el ERP envía algo a aprobación, esta función:
 *  1. Determina el NIVEL por monto (config flujo_aprobacion en BD)
 *  2. Identifica a los APROBADORES (usuarios con los roles del nivel)
 *  3. Registra la solicitud en `aprobaciones` (estado pendiente)
 *  4. Publica una tarjeta en Teams con botón "Aprobar en el ERP" (deep link)
 *
 * No requiere Power Automate Premium. Cuando llegue Premium, se agrega el
 * two-way (botones Aprobar/Rechazar en Teams + approvals-callback) reusando esto.
 *
 * Request (POST, Authorization: Bearer <supabase_jwt>):
 *  { modulo, entidadId, numero, titulo, monto, moneda }
 *
 * Secretos: TEAMS_WEBHOOK_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

const ERP_BASE = 'https://erp.memphismaquinarias.com'

const RUTA: Record<string, (numero: string) => string> = {
  requerimiento: (n) => `/compras/requerimientos/${n}`,
  orden_compra: (n) => `/compras/ordenes/${n}`,
  caja_chica: () => `/finanzas/caja-chica`,
}
const MODULO_LABEL: Record<string, string> = {
  requerimiento: 'Requerimiento de compra',
  orden_compra: 'Orden de compra',
  caja_chica: 'Gasto de caja chica',
}

interface Nivel { nivel: number; roles: string[]; montoMin: number; montoMax: number | null; aprobadoresRequeridos: number }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL') ?? ''
  if (!webhookUrl) return json({ error: 'TEAMS_WEBHOOK_URL not configured' }, 500)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401)

  let p: any
  try { p = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const { modulo, entidadId, numero, titulo, monto = 0, moneda = 'PEN' } = p ?? {}
  if (!modulo || !entidadId) return json({ error: 'Missing modulo / entidadId' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  // Usuario + tenant
  const { data: ud } = await admin.auth.getUser(jwt)
  const userId = ud?.user?.id
  if (!userId) return json({ error: 'Invalid session' }, 401)
  const { data: prof } = await admin.from('profiles').select('email, tenant_id').eq('id', userId).single()
  if (!prof?.tenant_id) return json({ error: 'Profile not found' }, 404)
  const tenantId = prof.tenant_id
  const solicitante = prof.email ?? userId

  // Config de niveles
  const { data: flujo } = await admin.from('flujo_aprobacion').select('config').eq('tenant_id', tenantId).single()
  const config = flujo?.config ?? { tipoCambioRef: 3.75, niveles: [] }
  const niveles: Nivel[] = config.niveles ?? []
  const totalPEN = moneda === 'USD' ? Number(monto) * (config.tipoCambioRef ?? 3.75) : Number(monto)
  const nivel = niveles.find((n) => totalPEN >= n.montoMin && (n.montoMax === null || totalPEN < n.montoMax))
    ?? niveles[niveles.length - 1]
  const rolesReq: string[] = nivel?.roles ?? []

  // Aprobadores: usuarios con esos roles
  let aprobadores: string[] = []
  if (rolesReq.length > 0) {
    const { data: rolesRows } = await admin.from('roles').select('id').eq('tenant_id', tenantId).in('nombre', rolesReq)
    const rolIds = (rolesRows ?? []).map((r: any) => r.id)
    if (rolIds.length > 0) {
      const { data: urs } = await admin.from('usuarios_roles').select('user_id').eq('tenant_id', tenantId).in('rol_id', rolIds)
      const userIds = [...new Set((urs ?? []).map((u: any) => u.user_id))]
      if (userIds.length > 0) {
        const { data: profs } = await admin.from('profiles').select('email').in('id', userIds)
        aprobadores = (profs ?? []).map((x: any) => x.email).filter(Boolean)
      }
    }
  }

  // Registrar solicitud
  const { data: aprobIns } = await admin.from('aprobaciones').insert({
    tenant_id: tenantId, modulo, entidad_id: entidadId, numero: numero ?? null, titulo: titulo ?? null,
    monto: Number(monto) || 0, moneda, nivel: nivel?.nivel ?? null, roles_requeridos: rolesReq,
    aprobadores, solicitante, estado: 'pendiente',
  }).select('id').single()

  // Notificación in-app (campanita del ERP)
  await admin.from('notificaciones').insert({
    tenant_id: tenantId,
    tipo: 'warning',
    titulo: `Aprobación requerida: ${numero ?? ''}`,
    mensaje: `${MODULO_LABEL[modulo] ?? modulo} · ${new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(Number(monto) || 0)}`,
    entidad_tipo: modulo,
    entidad_id: numero ?? entidadId,
  })

  // Tarjeta Teams
  const fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(Number(monto) || 0)
  const ruta = (RUTA[modulo] ?? (() => '/'))(numero ?? '')
  const hechos = [
    { title: 'Módulo', value: MODULO_LABEL[modulo] ?? modulo },
    { title: 'Documento', value: numero ?? '—' },
    { title: 'Monto', value: fmt },
    { title: 'Nivel', value: `${nivel?.nivel ?? '?'} (requiere rol: ${rolesReq.join(' o ') || 'n/d'})` },
    { title: 'Solicitante', value: solicitante },
    { title: 'Aprobadores', value: aprobadores.length ? aprobadores.join(', ') : 'Sin usuarios con el rol requerido' },
  ]
  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard', version: '1.4',
        body: [
          { type: 'TextBlock', text: `Aprobacion requerida: ${numero ?? ''}`, weight: 'Bolder', size: 'Large', wrap: true },
          { type: 'TextBlock', text: titulo ?? '', wrap: true, isSubtle: true, spacing: 'None' },
          { type: 'FactSet', facts: hechos },
        ],
        actions: [{ type: 'Action.OpenUrl', title: 'Aprobar en el ERP', url: `${ERP_BASE}${ruta}` }],
      },
    }],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card), signal: AbortSignal.timeout(10000),
    })
    await admin.from('notificaciones_log').insert({
      tenant_id: tenantId, canal: 'teams', tipo: 'APROBACION_SOLICITADA',
      titulo: `Aprobacion requerida: ${numero ?? ''}`, cuerpo: `${MODULO_LABEL[modulo] ?? modulo} ${fmt}`,
      accion_url: `${ERP_BASE}${ruta}`, destinatario: 'teams-workflows-webhook',
      estado: res.ok ? 'enviado' : 'error', error_detalle: res.ok ? null : `Webhook ${res.status}`,
      datos: { aprobacionId: aprobIns?.id, nivel: nivel?.nivel, aprobadores },
    })
    if (!res.ok) return json({ error: `Webhook failed: ${res.status}` }, 502)
    return json({ ok: true, aprobacionId: aprobIns?.id, nivel: nivel?.nivel, aprobadores })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
