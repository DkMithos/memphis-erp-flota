/**
 * Memphis ERP — Edge Function: notif-scheduler (FASE 1, capa B)
 *
 * Notificaciones PROGRAMADAS (sin usuario presente). Pensada para correr 1×/día
 * vía pg_cron. Consulta vencimientos y publica un RESUMEN (Adaptive Card) en el
 * canal de Teams (mismo TEAMS_WEBHOOK_URL de teams-notify).
 *
 * Categorías revisadas:
 *   1. Documentos de vehículo por vencer/vencidos (SOAT, rev. técnica, etc.) ≤15 días
 *   2. Órdenes de Trabajo vencidas (fecha_programada pasada y no cerradas/anuladas)
 *   3. Calibraciones biomédicas por vencer/vencidas (no realizadas) ≤30 días
 *   4. Garantías biomédicas por vencer ≤30 días
 *
 * Seguridad: verify_jwt=false. Si CRON_SECRET está seteado, exige el header
 * x-cron-secret. El gateway de Supabase igual requiere el apikey (anon).
 *
 * Secretos: TEAMS_WEBHOOK_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           NOTIF_TENANT_ID (opcional, default Memphis), CRON_SECRET (opcional).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

// Tenant Memphis Maquinarias por defecto (el dueño del canal de Teams)
const DEFAULT_TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
const ERP_BASE = 'https://erp.memphismaquinarias.com'

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (base: Date, days: number) => {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  // Gate opcional por secreto de cron
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) return json({ error: 'forbidden' }, 403)
  }

  const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL') ?? ''
  if (!webhookUrl) return json({ error: 'TEAMS_WEBHOOK_URL not configured' }, 500)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const tenantId = Deno.env.get('NOTIF_TENANT_ID') ?? DEFAULT_TENANT
  const admin = createClient(supabaseUrl, serviceKey)

  const hoy = new Date()
  const hoyStr = isoDate(hoy)
  const en15 = addDays(hoy, 15)
  const en30 = addDays(hoy, 30)

  // ── 1. Documentos de vehículo por vencer/vencidos ──
  const { data: docs } = await admin
    .from('vehiculo_documentos')
    .select('tipo, fecha_vencimiento, vehiculos(placa)')
    .eq('tenant_id', tenantId)
    .not('fecha_vencimiento', 'is', null)
    .lte('fecha_vencimiento', en15)
    .order('fecha_vencimiento', { ascending: true })
    .limit(50)

  // ── 2. OTs vencidas ──
  const { data: ots } = await admin
    .from('ordenes_trabajo')
    .select('numero_ot, vehiculo_placa, fecha_programada, estado')
    .eq('tenant_id', tenantId)
    .not('fecha_programada', 'is', null)
    .lt('fecha_programada', hoyStr)
    .not('estado', 'in', '(cerrada,anulada)')
    .order('fecha_programada', { ascending: true })
    .limit(50)

  // ── 3. Calibraciones biomédicas por vencer/vencidas (no realizadas) ──
  const { data: calibs } = await admin
    .from('calibraciones_biomedicas')
    .select('numero, fecha_vencimiento, equipos_biomedicos(codigo, nombre)')
    .eq('tenant_id', tenantId)
    .is('fecha_realizada', null)
    .not('fecha_vencimiento', 'is', null)
    .lte('fecha_vencimiento', en30)
    .order('fecha_vencimiento', { ascending: true })
    .limit(50)

  // ── 4. Garantías biomédicas por vencer ──
  const { data: garantias } = await admin
    .from('equipos_biomedicos')
    .select('codigo, nombre, garantia_vence')
    .eq('tenant_id', tenantId)
    .not('garantia_vence', 'is', null)
    .lte('garantia_vence', en30)
    .order('garantia_vence', { ascending: true })
    .limit(50)

  const nDocs = docs?.length ?? 0
  const nOts = ots?.length ?? 0
  const nCalibs = calibs?.length ?? 0
  const nGar = garantias?.length ?? 0
  const total = nDocs + nOts + nCalibs + nGar

  // Sin alertas → no publicar (evitar ruido diario)
  if (total === 0) {
    return json({ ok: true, skipped: true, message: 'Sin vencimientos por notificar' })
  }

  // ── Construir Adaptive Card ──
  const venc = (f: string) => (f < hoyStr ? `${f} ⚠️ vencido` : f)
  const body: unknown[] = [
    {
      type: 'TextBlock', text: '📅 Resumen de vencimientos — Memphis ERP',
      weight: 'Bolder', size: 'Large', wrap: true,
    },
    { type: 'TextBlock', text: hoyStr, isSubtle: true, spacing: 'None' },
  ]

  const addSeccion = (titulo: string, items: string[], n: number) => {
    if (n === 0) return
    body.push({ type: 'TextBlock', text: `${titulo} (${n})`, weight: 'Bolder', wrap: true, spacing: 'Medium' })
    items.slice(0, 10).forEach((t) => body.push({ type: 'TextBlock', text: `• ${t}`, wrap: true, spacing: 'None' }))
    if (n > 10) body.push({ type: 'TextBlock', text: `…y ${n - 10} más`, isSubtle: true, spacing: 'None' })
  }

  addSeccion('🚗 Documentos de vehículo por vencer', (docs ?? []).map((d: any) =>
    `${d.tipo} · ${d.vehiculos?.placa ?? 's/placa'} · ${venc(d.fecha_vencimiento)}`), nDocs)

  addSeccion('🔧 Órdenes de trabajo vencidas', (ots ?? []).map((o: any) =>
    `${o.numero_ot} · ${o.vehiculo_placa} · programada ${o.fecha_programada} (${o.estado})`), nOts)

  addSeccion('🧪 Calibraciones por vencer', (calibs ?? []).map((c: any) =>
    `${c.numero} · ${c.equipos_biomedicos?.codigo ?? ''} ${c.equipos_biomedicos?.nombre ?? ''} · ${venc(c.fecha_vencimiento)}`), nCalibs)

  addSeccion('🛡️ Garantías biomédicas por vencer', (garantias ?? []).map((g: any) =>
    `${g.codigo} ${g.nombre} · ${venc(g.garantia_vence)}`), nGar)

  const actions: unknown[] = []
  if (nDocs > 0) actions.push({ type: 'Action.OpenUrl', title: 'Documentos flota', url: `${ERP_BASE}/flota/reportes/documentos` })
  if (nOts > 0) actions.push({ type: 'Action.OpenUrl', title: 'Mantenimientos', url: `${ERP_BASE}/flota/mantenimientos` })
  if (nCalibs > 0) actions.push({ type: 'Action.OpenUrl', title: 'Calibraciones', url: `${ERP_BASE}/biomedico/calibraciones` })

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body,
          actions,
        },
      },
    ],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
      signal: AbortSignal.timeout(10000),
    })
    const ok = res.ok
    const detail = ok ? '' : await res.text().catch(() => '')

    // Auditoría
    await admin.from('notificaciones_log').insert({
      tenant_id: tenantId,
      canal: 'teams',
      tipo: 'RESUMEN_VENCIMIENTOS',
      titulo: 'Resumen de vencimientos',
      cuerpo: `Docs:${nDocs} OTs:${nOts} Calibs:${nCalibs} Garantías:${nGar}`,
      destinatario: 'teams-workflows-webhook',
      estado: ok ? 'enviado' : 'error',
      error_detalle: ok ? null : `Webhook ${res.status}: ${detail}`,
      datos: { nDocs, nOts, nCalibs, nGar },
    })

    if (!ok) return json({ error: `Webhook failed: ${res.status}`, detail }, 502)
    return json({ ok: true, total, nDocs, nOts, nCalibs, nGar })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
