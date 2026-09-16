/**
 * Memphis ERP — Edge Function: documentos-sharepoint
 *
 * Deja mirar y descargar carpetas de SharePoint desde el ERP. Hoy la de Shirley
 * (expediente OXI: CIPRL y facturas por proyecto), mañana las que se den de alta
 * en `documentos_carpetas`.
 *
 * LOS ARCHIVOS NO SE COPIAN. Se lista la carpeta en vivo contra Graph y, cuando
 * alguien pulsa descargar, se pide a Microsoft un enlace de un solo uso. Copiar
 * habría sido duplicar 96 MB y montar una sincronización que se queda vieja; así
 * lo que se ve es lo que hay en Teams en ese momento, que es lo que se pidió.
 *
 * Por qué el enlace lo da el servidor y no el navegador: el token de Graph es de
 * aplicación y no puede salir al cliente. La función lo usa, obtiene la URL
 * pre-autenticada que Microsoft devuelve —caduca sola— y entrega solo esa.
 *
 * Auth: usuario del tenant con `documentos.ver` (listar) o `documentos.exportar`
 * (descargar).
 * Graph: app-only, solo lectura (`Files.Read.All`), el mismo permiso que ya usan
 * `excel-sync` y `fianzas-import`.
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

/* eslint-disable @typescript-eslint/no-explicit-any */
async function graph(token: string, url: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) {
    if (r.status === 403) {
      throw new Error('Microsoft rechazó la lectura (403). Falta el permiso Files.Read.All.')
    }
    if (r.status === 404) throw new Error('La carpeta o el archivo ya no existe en SharePoint.')
    throw new Error(`Graph ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}`)
  }
  return r.json()
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Falta la sesión' }, 401)
    const { data: userRes } = await admin.auth.getUser(jwt)
    const user = userRes?.user
    if (!user) return json({ error: 'Sesión no válida' }, 401)

    const { data: ut } = await admin
      .from('usuarios_tenant').select('tenant_id').eq('user_id', user.id).maybeSingle()
    const tenantId = ut?.tenant_id as string | undefined
    if (!tenantId) return json({ error: 'El usuario no pertenece a ninguna empresa' }, 403)

    const { data: roles } = await admin
      .from('usuarios_roles').select('rol_id').eq('user_id', user.id).eq('tenant_id', tenantId)
    const rolIds = (roles ?? []).map((r: { rol_id: string }) => r.rol_id)
    const permisoFilas: Record<string, unknown>[] = rolIds.length
      ? ((await admin.from('roles_permisos')
          .select('permisos!inner(modulo,accion)')
          .in('rol_id', rolIds)).data ?? []) as Record<string, unknown>[]
      : []
    type Permiso = { modulo?: string; accion?: string }
    const tiene = (accion: string) => permisoFilas.some((r) => {
      const p = r.permisos as Permiso | Permiso[] | null
      const ok = (x: Permiso) => x?.modulo === 'documentos' && x?.accion === accion
      return Array.isArray(p) ? p.some(ok) : ok(p ?? {})
    })

    // El Administrador entra por su rol, que no pasa por la tabla de permisos.
    const esAdmin = (await admin.from('roles').select('nombre').in('id', rolIds))
      .data?.some((r: { nombre: string }) => r.nombre === 'Administrador') ?? false

    let cuerpo: { accion?: string; carpeta_id?: string; item_id?: string }
    try { cuerpo = await req.json() } catch { cuerpo = {} }
    const accion = cuerpo.accion ?? 'listar'

    if (!esAdmin && !tiene(accion === 'descargar' ? 'exportar' : 'ver')) {
      return json({ error: 'No tienes permiso sobre Documentos' }, 403)
    }

    // Las carpetas raíz que este tenant tiene dadas de alta. Se resuelve SIEMPRE
    // contra esta lista: así nadie puede pedir un drive arbitrario de la empresa
    // pasando ids a mano.
    const { data: carpetas } = await admin
      .from('documentos_carpetas')
      .select('id, nombre, descripcion, drive_id, item_id, ruta, ruta_relativa')
      .eq('tenant_id', tenantId).eq('activo', true)
      .order('orden')

    if (accion === 'carpetas') {
      return json({
        ok: true,
        carpetas: (carpetas ?? []).map(({ id, nombre, descripcion, ruta }) => ({
          id, nombre, descripcion, ruta,
        })),
      })
    }

    const raiz = (carpetas ?? []).find(c => c.id === cuerpo.carpeta_id) ?? (carpetas ?? [])[0]
    if (!raiz) return json({ error: 'No hay ninguna carpeta configurada' }, 404)

    try {
      const token = await getAppToken()

      if (accion === 'descargar') {
        if (!cuerpo.item_id) return json({ error: 'Falta el archivo' }, 400)
        // SIN `$select`: la URL de descarga es una anotación
        // (@microsoft.graph.downloadUrl) y Graph la deja fuera en cuanto
        // seleccionas campos, aunque la pidas por su nombre. Viene por defecto.
        const item = await graph(token,
          `https://graph.microsoft.com/v1.0/drives/${raiz.drive_id}/items/${cuerpo.item_id}`)
        const enlace = item['@microsoft.graph.downloadUrl']
        if (!enlace) {
          return json({
            error: item.folder ? 'Eso es una carpeta, no un archivo'
                               : 'Microsoft no devolvió enlace de descarga para ese archivo',
          }, 422)
        }
        return json({ ok: true, nombre: item.name, tamano: item.size, enlace })
      }

      /**
       * Listar: la raíz configurada, o la subcarpeta que pidan.
       *
       * La RAÍZ se direcciona por ruta. El id que se saca explorando a mano no
       * le vale a Graph para pedir los hijos —contesta 400 "Invalid request"—
       * mientras que la ruta relativa sí. Las SUBCARPETAS van por id sin
       * problema, porque esos ids salen de la propia respuesta de Graph.
       */
      const base = `https://graph.microsoft.com/v1.0/drives/${raiz.drive_id}`
      const destino = cuerpo.item_id
        ? `${base}/items/${cuerpo.item_id}`
        : raiz.ruta_relativa
          ? `${base}/root:/${raiz.ruta_relativa.split('/').map(encodeURIComponent).join('/')}:`
          : `${base}/items/${raiz.item_id}`
      const hijos = await graph(token,
        `${destino}/children?$select=id,name,size,folder,file,lastModifiedDateTime&$top=500`)

      const items = (hijos.value ?? []).map((i: any) => ({
        id: i.id,
        nombre: i.name,
        esCarpeta: Boolean(i.folder),
        elementos: i.folder?.childCount ?? null,
        tamano: i.size ?? null,
        mime: i.file?.mimeType ?? null,
        modificado: i.lastModifiedDateTime ?? null,
      }))
      // Carpetas primero y en orden alfabético: el nombre de estas empieza por
      // número ("1. GR Cusco…"), así que ordenar por nombre es el orden bueno.
      items.sort((a: any, b: any) =>
        Number(b.esCarpeta) - Number(a.esCarpeta) || a.nombre.localeCompare(b.nombre, 'es'))

      return json({
        ok: true,
        carpeta: { id: raiz.id, nombre: raiz.nombre, ruta: raiz.ruta },
        en_raiz: !cuerpo.item_id,
        items,
      })
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  },
}
