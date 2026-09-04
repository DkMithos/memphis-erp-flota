/**
 * Memphis ERP — Edge Function: fianzas-cargos-import
 *
 * Trae al sistema los cargos que hoy viven en SharePoint, en
 * `Administración / Fianzas / Cargos Fianzas / <ENTIDAD> / …`.
 *
 * Copia cada PDF al bucket privado `cargos-fianzas` y crea su fila en
 * `fianza_cargos`, enlazada a la fianza que corresponde a la carpeta. Así se
 * ven y se descargan desde el ERP, que es lo que pidieron Shirley y Carolina.
 *
 * Es idempotente: `origen_item_id` guarda el id del archivo en el drive, con
 * índice único, así que se puede volver a correr y solo entra lo nuevo.
 *
 * Permisos de Graph: solo lectura (`Files.Read.All`), el mismo que ya usa
 * `excel-sync`. No necesita el `Files.ReadWrite.All` que sí requiere
 * `fianzas-excel` para escribir.
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

const DRIVE = 'b!I_mLU8GLtk6ASRCGKjMULSgD8dZdflBHgO-paUOxse7z8ytHxVkaSaQ0Mj46-Mr4'
const CARPETA_RAIZ = 'Administración/Fianzas/Cargos Fianzas'
const BUCKET = 'cargos-fianzas'
const MAX_BYTES = 20 * 1024 * 1024

/**
 * Carpeta de SharePoint → nombre del proyecto en el ERP.
 * Se escribe a mano porque los nombres no coinciden literal y con 20 carpetas
 * adivinar sale más caro que decidir.
 */
const CARPETA_A_PROYECTO: Record<string, string> = {
  'gore loreto bomberos': 'GORE LORETO BOMBEROS',
  'gore cusco ambulancias': 'GORE CUSCO AMBULANCIAS',
  'gore amazonas ambulancia': 'GORE AMAZONAS AMBULANCIAS',
  'gore amazonas ambulancias': 'GORE AMAZONAS AMBULANCIAS',
  'san miguel': 'MUNI SAN MIGUEL',
  'gore huánuco patrulleros': 'GORE HUANUCO PATRULLEROS',
  'gore huanuco patrulleros': 'GORE HUANUCO PATRULLEROS',
  'muni cusco serenazgo': 'MUNI CUSCO SERENAZGO',
  'gore cusco patrullero': 'GORE CUSCO PATRULLEROS',
  'gore cusco patrulleros': 'GORE CUSCO PATRULLEROS',
  'gore cusco hidroambulancias': 'GORE CUSCO HIDROAMBULANCIAS',
  'gore ica patrulleros': 'GORE ICA PATRULLEROS',
}

async function getAppToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: Deno.env.get('MS_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
    scope: 'https://graph.microsoft.com/.default',
  })
  const r = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get('MS_TENANT_ID')}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params },
  )
  if (!r.ok) throw new Error(`No se pudo obtener el token de Microsoft: ${await r.text()}`)
  return (await r.json()).access_token as string
}

interface Archivo {
  id: string
  name: string
  size: number
  webUrl: string
  mime: string | null
  carpeta: string
}

/** Recorre la carpeta y sus subcarpetas. `carpeta` es la de entidad, la de primer nivel. */
async function listar(token: string, itemId: string, carpetaEntidad: string, salida: Archivo[]) {
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${DRIVE}/items/${itemId}/children` +
    // Sin $select: `@microsoft.graph.downloadUrl` es una propiedad calculada y
    // $select la filtra. Aquí ya no hace falta, el contenido se pide por /content.
    `?$top=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!r.ok) throw new Error(`Graph ${r.status}: ${await r.text()}`)
  const { value } = await r.json()
  for (const it of (value ?? [])) {
    if (it.folder) {
      // La carpeta de entidad es la de primer nivel; las de adentro (SUPERVISION,
      // DOCUMENTO EQUIVALENTE) se conservan solo en el nombre del cargo.
      await listar(token, it.id, carpetaEntidad || it.name, salida)
    } else if (it.file) {
      salida.push({
        id: it.id,
        name: it.name,
        size: it.size ?? 0,
        webUrl: it.webUrl,
        mime: it.file?.mimeType ?? null,
        carpeta: carpetaEntidad || '(raíz)',
      })
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Quién llama ────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'Falta la sesión' }, 401)
  const { data: userData, error: errUser } = await admin.auth.getUser(jwt)
  if (errUser || !userData?.user) return json({ error: 'Sesión inválida' }, 401)

  const { data: ut } = await admin
    .from('usuarios_tenant').select('tenant_id').eq('user_id', userData.user.id).maybeSingle()
  const tenantId = ut?.tenant_id
  if (!tenantId) return json({ error: 'El usuario no pertenece a ninguna empresa' }, 403)

  const { data: roles } = await admin
    .from('usuarios_roles').select('rol_id').eq('user_id', userData.user.id).eq('tenant_id', tenantId)
  const rolIds = (roles ?? []).map((r: { rol_id: string }) => r.rol_id)
  if (rolIds.length === 0) return json({ error: 'El usuario no tiene rol asignado' }, 403)

  const { data: permisoFilas } = await admin
    .from('roles_permisos').select('permisos!inner(modulo,accion)').in('rol_id', rolIds)
  const acciones = new Set(
    (permisoFilas ?? [])
      .filter((r: { permisos?: { modulo: string } }) => r.permisos?.modulo === 'fianzas')
      .map((r: { permisos?: { accion: string } }) => r.permisos?.accion),
  )
  if (!acciones.has('crear') && !acciones.has('cargos')) {
    return json({ error: 'No tienes permiso para importar cargos' }, 403)
  }

  // ── Fianzas destino ────────────────────────────────────────────────────
  const { data: fianzas } = await admin
    .from('fianzas').select('id,nombre_proyecto').eq('tenant_id', tenantId)
  const porProyecto = new Map<string, string>()
  for (const f of (fianzas ?? [])) porProyecto.set(f.nombre_proyecto as string, f.id as string)

  // ── Listar SharePoint ──────────────────────────────────────────────────
  let token: string
  try { token = await getAppToken() } catch (e) { return json({ error: (e as Error).message }, 502) }

  const raiz = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${DRIVE}/root:/${encodeURI(CARPETA_RAIZ)}?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!raiz.ok) {
    return json({ error: `No se encontró la carpeta de cargos: ${await raiz.text()}`, status: raiz.status }, 502)
  }
  const raizId = (await raiz.json()).id as string

  const archivos: Archivo[] = []
  try { await listar(token, raizId, '', archivos) } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }

  // ── Ya importados ──────────────────────────────────────────────────────
  const { data: yaEstan } = await admin
    .from('fianza_cargos').select('origen_item_id').eq('tenant_id', tenantId).not('origen_item_id', 'is', null)
  const importados = new Set((yaEstan ?? []).map((r: { origen_item_id: string }) => r.origen_item_id))

  // ── Copiar ─────────────────────────────────────────────────────────────
  let nuevos = 0, saltados = 0, pesados = 0
  const sinFianza: { carpeta: string; archivo: string }[] = []
  const fallos: { archivo: string; motivo: string }[] = []

  for (const a of archivos) {
    if (importados.has(a.id)) { saltados++; continue }

    const proyecto = CARPETA_A_PROYECTO[a.carpeta.trim().toLowerCase()]
    const fianzaId = proyecto ? porProyecto.get(proyecto) : undefined
    if (!fianzaId) { sinFianza.push({ carpeta: a.carpeta, archivo: a.name }); continue }

    if (a.size > MAX_BYTES) { pesados++; continue }

    try {
      // /content responde 302 al enlace real; fetch sigue la redirección.
      const bin = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${DRIVE}/items/${a.id}/content`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!bin.ok) throw new Error(`descarga ${bin.status}`)
      const bytes = new Uint8Array(await bin.arrayBuffer())

      const limpio = a.name.replace(/[^\w.\- ]+/g, '_')
      const ruta = `${tenantId}/${fianzaId}/sharepoint-${a.id}-${limpio}`

      const { error: errUp } = await admin.storage.from(BUCKET)
        .upload(ruta, bytes, { contentType: a.mime ?? 'application/pdf', upsert: true })
      if (errUp) throw new Error(errUp.message)

      const { error: errIns } = await admin.from('fianza_cargos').insert({
        tenant_id: tenantId,
        fianza_id: fianzaId,
        nombre: a.name,
        storage_path: ruta,
        sharepoint_url: a.webUrl,
        subido_por: 'Importado de SharePoint',
        tamano_bytes: a.size,
        mime: a.mime,
        origen_item_id: a.id,
        carpeta_origen: a.carpeta,
      })
      if (errIns) {
        await admin.storage.from(BUCKET).remove([ruta])
        throw new Error(errIns.message)
      }
      nuevos++
    } catch (e) {
      fallos.push({ archivo: a.name, motivo: (e as Error).message })
    }
  }

  return json({
    ok: true,
    encontrados: archivos.length,
    importados: nuevos,
    ya_estaban: saltados,
    sin_fianza: sinFianza,
    demasiado_grandes: pesados,
    fallos,
  })
})
