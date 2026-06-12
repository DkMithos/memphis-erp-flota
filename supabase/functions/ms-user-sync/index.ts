/**
 * Memphis ERP — Edge Function: ms-user-sync (FASE 0 SSO Entra ID — App Roles)
 *
 * Tras el login con Microsoft, sincroniza los App Roles asignados al usuario en
 * Entra ID → roles del ERP (usuarios_roles). Modelo de gobierno: la asignación
 * de roles se hace en Azure (Enterprise App → Users and groups) y aquí se refleja.
 *
 * Modo APP-ONLY (client credentials): no depende del token delegado del usuario.
 * Lee los App Roles vía Microsoft Graph con un token de aplicación.
 *
 * Flujo:
 *   1. SPA llama con Authorization: Bearer <supabase_jwt>
 *   2. Se identifica al usuario (email + tenant) desde el JWT
 *   3. Token app-only de Graph (client credentials)
 *   4. Resuelve el Service Principal por Application ID + lee sus appRoles
 *   5. Lee /users/{email}/appRoleAssignments y traduce appRoleId → value
 *   6. Mapea value → rol_id (ms_approle_role_map) y SINCRONIZA usuarios_roles
 *      (agrega los asignados en Azure, quita los roles "gestionados" que ya no tiene)
 *
 * Secretos requeridos:
 *   - MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
 * Permiso Graph (Application) requerido: Directory.Read.All (con admin consent).
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

async function graphGet(token: string, url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Graph ${res.status} (${url}): ${detail}`)
  }
  return res.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const clientId = Deno.env.get('MS_CLIENT_ID') ?? ''
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server not configured' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  // Identificar usuario → email + tenant
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401)
  const userId = userData.user.id

  const { data: profile, error: profErr } = await admin
    .from('profiles').select('email, tenant_id').eq('id', userId).single()
  if (profErr || !profile?.tenant_id || !profile?.email) {
    return json({ error: 'Profile not found or missing email' }, 404)
  }
  const tenantId = profile.tenant_id
  const email = profile.email as string

  try {
    const token = await getAppToken()

    // 1. Resolver el Service Principal por Application ID + leer appRoles (id → value)
    const sp = await graphGet(
      token,
      `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${clientId}')?$select=id,appRoles`,
    )
    const spId: string = sp.id
    const appRoleValueById = new Map<string, string>()
    for (const ar of sp.appRoles ?? []) {
      if (ar.id && ar.value) appRoleValueById.set(ar.id, ar.value)
    }

    // 2. App Roles asignados al usuario (filtrados a nuestro Service Principal)
    const assignsRes = await graphGet(
      token,
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/appRoleAssignments?$select=appRoleId,resourceId&$top=100`,
    )
    const valoresAzure: string[] = (assignsRes.value ?? [])
      .filter((a: any) => a.resourceId === spId)
      .map((a: any) => appRoleValueById.get(a.appRoleId))
      .filter((v: unknown): v is string => typeof v === 'string')

    // 3. Mapear value → rol_id (solo roles mapeados/activos del tenant)
    const { data: maps, error: mapErr } = await admin
      .from('ms_approle_role_map')
      .select('app_role_value, rol_id')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
    if (mapErr) return json({ error: 'Map query failed', detail: mapErr.message }, 500)

    const valueToRol = new Map<string, string>()
    const managedRolIds = new Set<string>()
    for (const m of maps ?? []) {
      valueToRol.set(m.app_role_value, m.rol_id)
      managedRolIds.add(m.rol_id)
    }

    const desiredRolIds = new Set<string>()
    for (const v of valoresAzure) {
      const rid = valueToRol.get(v)
      if (rid) desiredRolIds.add(rid)
    }

    // 4. Roles actuales del usuario
    const { data: currentRows, error: curErr } = await admin
      .from('usuarios_roles')
      .select('rol_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
    if (curErr) return json({ error: 'Current roles query failed', detail: curErr.message }, 500)
    const currentRolIds = new Set<string>((currentRows ?? []).map((r: any) => r.rol_id))

    // 5. Calcular diffs (solo sobre roles GESTIONADOS por el mapeo)
    const toAdd = [...desiredRolIds].filter((id) => !currentRolIds.has(id))
    const toRemove = [...currentRolIds].filter(
      (id) => managedRolIds.has(id) && !desiredRolIds.has(id),
    )

    if (toAdd.length > 0) {
      const rows = toAdd.map((rol_id) => ({ user_id: userId, tenant_id: tenantId, rol_id }))
      const { error } = await admin
        .from('usuarios_roles')
        .upsert(rows, { onConflict: 'user_id,tenant_id,rol_id', ignoreDuplicates: true })
      if (error) return json({ error: 'Role insert failed', detail: error.message }, 500)
    }

    if (toRemove.length > 0) {
      const { error } = await admin
        .from('usuarios_roles')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .in('rol_id', toRemove)
      if (error) return json({ error: 'Role delete failed', detail: error.message }, 500)
    }

    return json({
      ok: true,
      email,
      appRolesAzure: valoresAzure,
      rolesAsignados: desiredRolIds.size,
      agregados: toAdd.length,
      removidos: toRemove.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 502)
  }
})
