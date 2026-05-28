/**
 * Memphis ERP — Supabase Edge Function: ms-user-sync
 *
 * FASE 0 (SSO Entra ID): tras el login con Microsoft, sincroniza los grupos
 * de Entra ID del usuario → roles del ERP, según la tabla ms_group_role_map.
 *
 * Flujo:
 *   1. La SPA hace login OAuth con Azure → obtiene session.provider_token (MS access token)
 *   2. La SPA llama a esta función con:
 *        - Authorization: Bearer <supabase_jwt>   (identifica al usuario/tenant)
 *        - body: { providerToken: <ms_access_token> }
 *   3. La función lee /me/memberOf en Graph (token delegado del usuario)
 *   4. Mapea grupos → roles vía ms_group_role_map y hace upsert en usuarios_roles
 *
 * Secretos requeridos (ya disponibles en runtime de Supabase):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * NO requiere client secret de Azure: usa el token delegado del usuario.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server not configured' }, 500)

  // 1. Identificar al usuario desde el JWT de Supabase
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401)

  let providerToken = ''
  try {
    const body = await req.json()
    providerToken = body?.providerToken ?? ''
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!providerToken) return json({ error: 'Missing providerToken (Microsoft access token)' }, 400)

  // Cliente admin (service role) — bypasea RLS para escribir roles
  const admin = createClient(supabaseUrl, serviceKey)

  // Validar el JWT y obtener el usuario
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401)
  const userId = userData.user.id

  // Obtener tenant del perfil
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, tenant_id')
    .eq('id', userId)
    .single()
  if (profErr || !profile?.tenant_id) return json({ error: 'Profile not found' }, 404)
  const tenantId = profile.tenant_id

  // 2. Leer grupos del usuario en Microsoft Graph (token delegado)
  let groupIds: string[] = []
  try {
    const graphRes = await fetch(
      'https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName&$top=200',
      {
        headers: { Authorization: `Bearer ${providerToken}` },
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!graphRes.ok) {
      const detail = await graphRes.text().catch(() => '')
      return json({ error: `Graph error: ${graphRes.status}`, detail }, 502)
    }
    const graphData = await graphRes.json()
    groupIds = (graphData.value ?? [])
      .filter((g: any) => g['@odata.type']?.includes('group') || g.id)
      .map((g: any) => g.id)
  } catch (err) {
    return json({ error: 'Graph fetch failed', detail: String(err) }, 502)
  }

  if (groupIds.length === 0) {
    return json({ ok: true, message: 'Usuario sin grupos; no se asignaron roles', rolesAsignados: 0 })
  }

  // 3. Mapear grupos → roles (tenant-scoped)
  const { data: maps, error: mapErr } = await admin
    .from('ms_group_role_map')
    .select('rol_id, ms_group_id')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .in('ms_group_id', groupIds)
  if (mapErr) return json({ error: 'Map query failed', detail: mapErr.message }, 500)

  const rolIds = [...new Set((maps ?? []).map((m: any) => m.rol_id))]
  if (rolIds.length === 0) {
    return json({ ok: true, message: 'Ningún grupo mapea a un rol', rolesAsignados: 0 })
  }

  // 4. Upsert en usuarios_roles
  const rows = rolIds.map((rol_id) => ({
    user_id: userId,
    tenant_id: tenantId,
    rol_id,
  }))
  const { error: upsertErr } = await admin
    .from('usuarios_roles')
    .upsert(rows, { onConflict: 'user_id,tenant_id,rol_id', ignoreDuplicates: true })
  if (upsertErr) return json({ error: 'Role upsert failed', detail: upsertErr.message }, 500)

  return json({ ok: true, rolesAsignados: rolIds.length, gruposDetectados: groupIds.length })
})
