/**
 * Memphis ERP — Edge Function: presupuesto-import
 *
 * Carga el presupuesto inicial de un proyecto desde su plantilla de Excel en
 * SharePoint (la de Antonio). El equipo sigue costeando en Excel, que es donde
 * saben trabajar, y sube el archivo cuando está cerrado; esto lo trae al ERP.
 *
 * Además de importar, deja NAVEGAR el árbol de proyectos de COMPRAS para elegir
 * la plantilla sin tener que averiguar el drive_id/item_id a mano. Compras entra,
 * busca la carpeta del proyecto, elige el Excel y listo. La navegación se limita
 * a las carpetas raíz dadas de alta con uso='presupuesto' (nadie pide un drive
 * arbitrario pasando ids).
 *
 * Reemplaza el presupuesto del proyecto por completo (borra líneas y vuelve a
 * cargar): la plantilla es la verdad. El parseo vive en `plantilla.ts`, probado
 * contra filas reales.
 *
 * Acciones:
 *   { accion:'carpetas' }                              → raíces disponibles
 *   { accion:'listar', carpeta_id?, item_id? }         → navegar carpetas/archivos
 *   { accion:'importar', proyecto_id, drive_id, item_id, solo_leer? }
 *   (sin accion, con proyecto_id+drive_id+item_id → importar, por compatibilidad)
 *
 * Auth: usuario del tenant con `proyectos.crear` o `proyectos.editar`.
 * Graph: app-only, solo lectura (`Files.Read.All`).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { leerCabecera, leerLineas, totales } from './plantilla.ts'

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
    if (r.status === 403) throw new Error('Microsoft rechazó la lectura (403). Falta Files.Read.All.')
    if (r.status === 404) throw new Error('El archivo o la carpeta ya no existe en SharePoint.')
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
      ? ((await admin.from('roles_permisos').select('permisos!inner(modulo,accion)').in('rol_id', rolIds)).data ?? []) as Record<string, unknown>[]
      : []
    type P = { modulo?: string; accion?: string }
    const puede = permisoFilas.some((r) => {
      const p = r.permisos as P | P[] | null
      const ok = (x: P) => x?.modulo === 'proyectos' && (x?.accion === 'crear' || x?.accion === 'editar')
      return Array.isArray(p) ? p.some(ok) : ok(p ?? {})
    })
    const esAdmin = (await admin.from('roles').select('nombre').in('id', rolIds))
      .data?.some((r: { nombre: string }) => r.nombre === 'Administrador') ?? false
    if (!esAdmin && !puede) return json({ error: 'Hace falta permiso para editar Proyectos' }, 403)

    let cuerpo: {
      accion?: string; proyecto_id?: string; drive_id?: string; item_id?: string
      carpeta_id?: string; solo_leer?: boolean
    }
    try { cuerpo = await req.json() } catch { cuerpo = {} }
    const accion = cuerpo.accion ?? (cuerpo.proyecto_id ? 'importar' : 'listar')

    // ── Navegación de SharePoint (raíces uso='presupuesto') ──
    if (accion === 'carpetas' || accion === 'listar') {
      const { data: carpetas } = await admin
        .from('documentos_carpetas')
        .select('id, nombre, descripcion, drive_id, item_id, ruta, ruta_relativa')
        .eq('tenant_id', tenantId).eq('activo', true).eq('uso', 'presupuesto')
        .order('orden')

      if (accion === 'carpetas') {
        return json({
          ok: true,
          carpetas: (carpetas ?? []).map(({ id, nombre, descripcion, ruta }) => ({ id, nombre, descripcion, ruta })),
        })
      }

      const raiz = (carpetas ?? []).find(c => c.id === cuerpo.carpeta_id) ?? (carpetas ?? [])[0]
      if (!raiz) return json({ error: 'No hay ninguna carpeta de presupuestos configurada' }, 404)

      try {
        const token = await getAppToken()
        // La RAÍZ se direcciona por ruta relativa (el id explorado a mano da 400).
        // Las SUBCARPETAS van por su id, que sale de la propia respuesta de Graph.
        const base = `https://graph.microsoft.com/v1.0/drives/${raiz.drive_id}`
        const destino = cuerpo.item_id
          ? `${base}/items/${cuerpo.item_id}`
          : raiz.ruta_relativa
            ? `${base}/root:/${raiz.ruta_relativa.split('/').map(encodeURIComponent).join('/')}:`
            : `${base}/items/${raiz.item_id}`
        const hijos = await graph(token,
          `${destino}/children?$select=id,name,size,folder,file,lastModifiedDateTime&$top=800`)

        const items = (hijos.value ?? []).map((i: any) => ({
          id: i.id,
          nombre: i.name,
          esCarpeta: Boolean(i.folder),
          elementos: i.folder?.childCount ?? null,
          tamano: i.size ?? null,
          esExcel: /\.(xlsx|xlsm)$/i.test(i.name ?? ''),
          modificado: i.lastModifiedDateTime ?? null,
        }))
        items.sort((a: any, b: any) =>
          Number(b.esCarpeta) - Number(a.esCarpeta) || a.nombre.localeCompare(b.nombre, 'es'))

        return json({
          ok: true,
          carpeta: { id: raiz.id, nombre: raiz.nombre, ruta: raiz.ruta, drive_id: raiz.drive_id },
          en_raiz: !cuerpo.item_id,
          items,
        })
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : String(e) }, 500)
      }
    }

    // ── Importar ──
    if (!cuerpo.proyecto_id || !cuerpo.drive_id || !cuerpo.item_id) {
      return json({ error: 'Faltan datos: proyecto_id, drive_id, item_id' }, 400)
    }

    const { data: proyecto } = await admin
      .from('proyectos').select('id, codigo, nombre, monto_contrato, monto_adenda')
      .eq('id', cuerpo.proyecto_id).eq('tenant_id', tenantId).maybeSingle()
    if (!proyecto) return json({ error: 'Proyecto no encontrado' }, 404)

    try {
      const token = await getAppToken()
      const hojas = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cuerpo.drive_id}/items/${cuerpo.item_id}/workbook/worksheets?$select=name,id`)
      // La plantilla es la primera hoja ("Plantilla Presupuesto").
      const hoja = (hojas.value ?? [])[0]
      if (!hoja) return json({ error: 'El archivo no tiene hojas' }, 422)
      const rango = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cuerpo.drive_id}/items/${cuerpo.item_id}` +
        `/workbook/worksheets/${encodeURIComponent(hoja.id)}/usedRange?$select=text`)
      const celdas: string[][] = rango.text ?? []

      const cab = leerCabecera(celdas)
      const lineas = leerLineas(celdas)
      const t = totales(lineas)
      if (lineas.length === 0) {
        return json({ error: 'No se encontraron partidas en la plantilla' }, 422)
      }

      const tc = cab.tipoCambio ?? 3.4
      const resumen = {
        proyecto: proyecto.codigo,
        cabecera: cab,
        lineas: lineas.length,
        hojas: t.hojas,
        total_presupuestado_sin_igv: t.sinIgv,
        total_presupuestado_con_igv: t.conIgv,
        convenio: Number(proyecto.monto_contrato ?? 0) + Number(proyecto.monto_adenda ?? 0),
      }
      if (cuerpo.solo_leer) return json({ ok: true, solo_leer: true, ...resumen })

      // Reemplazo total: el presupuesto del proyecto es lo que diga la plantilla.
      const { data: cabeza, error: eCab } = await admin.from('proyecto_presupuestos').upsert({
        tenant_id: tenantId,
        proyecto_id: proyecto.id,
        nombre: cab.proyecto || proyecto.nombre,
        cui: cab.cui || null,
        importe_ejecucion: cab.importeEjecucion,
        importe_referencial: cab.importeReferencial,
        tipo_cambio: tc,
        plazo_dias: cab.plazoDias,
        estado: 'vigente',
        creado_por: user.id,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'tenant_id,proyecto_id' }).select('id').single()
      if (eCab || !cabeza) return json({ error: `No se pudo guardar la cabecera: ${eCab?.message}` }, 500)

      // Las partidas se ACTUALIZAN por su código (1.2.3), no se borran: los
      // ítems de requerimientos, cotizaciones y órdenes apuntan a ellas
      // (partida_id) y una versión nueva de la plantilla no puede romper ese
      // enlace. Lo que ya no está en la plantilla queda como no vigente.
      const filas = lineas.map(l => ({
        tenant_id: tenantId,
        presupuesto_id: cabeza.id,
        item: l.item,
        nivel: l.nivel,
        es_hoja: l.esHoja,
        descripcion: l.descripcion || null,
        unidad: l.unidad || null,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        moneda: l.moneda || null,
        precio_unitario_soles: l.precioUnitarioSoles,
        total_sin_igv: l.totalSinIgv,
        igv_tasa: l.igvTasa,
        total_con_igv: l.totalConIgv,
        proveedor_nota: l.proveedorNota || null,
        orden: l.orden,
        vigente: true,
      }))
      // En tandas: son cientos de líneas.
      for (let i = 0; i < filas.length; i += 200) {
        const { error } = await admin.from('proyecto_presupuesto_lineas')
          .upsert(filas.slice(i, i + 200), { onConflict: 'presupuesto_id,item' })
        if (error) return json({ error: `Error al cargar líneas: ${error.message}`, ...resumen }, 500)
      }
      const codigos = lineas.map(l => l.item)
      const { error: eVig } = await admin.from('proyecto_presupuesto_lineas')
        .update({ vigente: false }).eq('presupuesto_id', cabeza.id)
        .not('item', 'in', `(${codigos.map(c => `"${c.replace(/"/g, '')}"`).join(',')})`)
      if (eVig) return json({ error: `Error al marcar partidas retiradas: ${eVig.message}`, ...resumen }, 500)

      return json({ ok: true, ...resumen })
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  },
}
