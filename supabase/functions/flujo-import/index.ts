/**
 * Memphis ERP — Edge Function: flujo-import
 *
 * Trae al ERP las BD del flujo financiero (BD CONTA, BD TI…) que hoy viven en
 * SharePoint (sitio FlujoFinanciero). El ERP deja de necesitar las tablas
 * dinámicas del Excel: guarda la base y pinta las vistas.
 *
 * Reemplaza por ÁREA: al reimportar BD CONTA se borra lo de esa área con
 * fuente='excel' y se vuelve a cargar; lo que en el futuro se cree nativo en el
 * ERP (fuente='erp') no se toca. El parseo vive en `flujo.ts`, probado contra
 * filas reales.
 *
 * Acciones:
 *   { accion:'carpetas' }                                   → raíces (uso='flujo')
 *   { accion:'listar', carpeta_id?, item_id? }              → navegar SharePoint
 *   { accion:'importar', area, drive_id, item_id, solo_leer? }
 *
 * Auth: usuario del tenant con `finanzas.crear` o `finanzas.editar`.
 * Graph: app-only, solo lectura (`Files.Read.All`).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { leerCompromisos, leerProyectos, leerAdministracion, resumen, type LineaFlujo } from './flujo.ts'

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

const norm = (s: unknown): string =>
  String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// Alias de centros de costo con nombre distinto entre la BD y el ERP.
const ALIAS_CC: Record<string, string> = { database: 'base de datos', ofcentral: 'oficina central' }

/**
 * Área canónica a partir del nombre del archivo:
 *   "BD CONTA 2026.xlsx"        → CONTABILIDAD
 *   "BD TI 2026.xlsx"           → TI
 *   "Flujo Administración.xlsx" → ADMINISTRACION
 *   "Flujo de proyectos.xlsx"   → PROYECTOS
 */
function areaDeNombre(nombre: string): string {
  const n = norm(nombre)
  if (/bd\s+conta|contabilidad/.test(n)) return 'CONTABILIDAD'
  if (/bd\s+ti|\bti\b/.test(n)) return 'TI'
  if (/administraci/.test(n)) return 'ADMINISTRACION'
  if (/proyecto/.test(n)) return 'PROYECTOS'
  const m = n.match(/bd\s+([a-z]+)/)
  return m ? m[1].toUpperCase() : ''
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
      const ok = (x: P) => x?.modulo === 'finanzas' && (x?.accion === 'crear' || x?.accion === 'editar' || x?.accion === 'flujo')
      return Array.isArray(p) ? p.some(ok) : ok(p ?? {})
    })
    const esAdmin = (await admin.from('roles').select('nombre').in('id', rolIds))
      .data?.some((r: { nombre: string }) => r.nombre === 'Administrador') ?? false
    if (!esAdmin && !puede) return json({ error: 'Hace falta permiso para editar Finanzas' }, 403)

    let cuerpo: {
      accion?: string; area?: string; drive_id?: string; item_id?: string
      carpeta_id?: string; solo_leer?: boolean
    }
    try { cuerpo = await req.json() } catch { cuerpo = {} }
    const accion = cuerpo.accion ?? (cuerpo.drive_id ? 'importar' : 'listar')

    // ── Navegación de SharePoint (raíces uso='flujo') ──
    if (accion === 'carpetas' || accion === 'listar') {
      const { data: carpetas } = await admin
        .from('documentos_carpetas')
        .select('id, nombre, descripcion, drive_id, item_id, ruta, ruta_relativa')
        .eq('tenant_id', tenantId).eq('activo', true).eq('uso', 'flujo')
        .order('orden')

      if (accion === 'carpetas') {
        return json({ ok: true, carpetas: (carpetas ?? []).map(({ id, nombre, descripcion, ruta }) => ({ id, nombre, descripcion, ruta })) })
      }

      const raiz = (carpetas ?? []).find(c => c.id === cuerpo.carpeta_id) ?? (carpetas ?? [])[0]
      if (!raiz) return json({ error: 'No hay ninguna carpeta de flujo configurada' }, 404)

      try {
        const token = await getAppToken()
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
          area: areaDeNombre(i.name ?? ''),
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
    if (!cuerpo.drive_id || !cuerpo.item_id) {
      return json({ error: 'Faltan datos: drive_id, item_id' }, 400)
    }

    try {
      const token = await getAppToken()
      // Nombre del archivo (para derivar el área si no vino) y las hojas.
      const meta = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cuerpo.drive_id}/items/${cuerpo.item_id}?$select=name`)
      const area = (cuerpo.area || areaDeNombre(meta.name ?? '') || 'GENERAL').toUpperCase()

      const hojas = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cuerpo.drive_id}/items/${cuerpo.item_id}/workbook/worksheets?$select=name,id`)
      // La hoja base depende del archivo: Contabilidad/TI la nombran "BD ..."; el
      // de Administración y el de Proyectos la nombran "Base de datos".
      const lista = hojas.value ?? []
      const esBD = (h: any) => /^bd\b/i.test(h.name ?? '')
      const esBaseDatos = (h: any) => norm(h.name ?? '').includes('base de datos')
      const hoja = (area === 'CONTABILIDAD' || area === 'TI')
        ? (lista.find(esBD) ?? lista[0])
        : (lista.find(esBaseDatos) ?? lista.find(esBD) ?? lista[0])
      if (!hoja) return json({ error: 'El archivo no tiene hojas' }, 422)
      const rango = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cuerpo.drive_id}/items/${cuerpo.item_id}` +
        `/workbook/worksheets/${encodeURIComponent(hoja.id)}/usedRange?$select=text`)
      const celdas: string[][] = rango.text ?? []

      // Cada archivo tiene su estructura: Administración es una matriz por mes,
      // Proyectos una plana con otra cabecera, Contabilidad/TI la común.
      const lineas = area === 'ADMINISTRACION' ? leerAdministracion(celdas)
        : area === 'PROYECTOS' ? leerProyectos(celdas)
        : leerCompromisos(celdas)
      if (lineas.length === 0) return json({ error: 'No se reconoció la cabecera (CDC / CONCEPTO) ni filas' }, 422)
      const res = resumen(lineas)

      // Mapas de resolución: centro de costo y proveedor por nombre.
      const [{ data: ccs }, { data: provs }] = await Promise.all([
        admin.from('centros_costo').select('id, nombre').eq('tenant_id', tenantId),
        admin.from('proveedores').select('id, razon_social').eq('tenant_id', tenantId),
      ])
      const ccPorNombre = new Map((ccs ?? []).map((c: any) => [norm(c.nombre), c.id as string]))
      const provPorNombre = new Map((provs ?? []).map((p: any) => [norm(p.razon_social), p.id as string]))
      const resolverCC = (cdc: string) => ccPorNombre.get(norm(cdc)) ?? ccPorNombre.get(ALIAS_CC[norm(cdc)] ?? '') ?? null
      const resolverProv = (nombre: string) => provPorNombre.get(norm(nombre)) ?? null

      let ccMatch = 0, provMatch = 0
      const resueltas = lineas.map((l: LineaFlujo) => {
        const centro_costo_id = resolverCC(l.cdc)
        const proveedor_id = resolverProv(l.proveedor)
        if (centro_costo_id) ccMatch++
        if (proveedor_id) provMatch++
        return { l, centro_costo_id, proveedor_id }
      })

      const info = {
        area,
        archivo: meta.name,
        ...res,
        centros_costo_reconocidos: ccMatch,
        proveedores_reconocidos: provMatch,
      }
      if (cuerpo.solo_leer) {
        return json({ ok: true, solo_leer: true, ...info, muestra: lineas.slice(0, 3) })
      }

      // Reemplazo por área (solo lo importado del Excel).
      await admin.from('flujo_compromisos').delete()
        .eq('tenant_id', tenantId).eq('area', area).eq('fuente', 'excel')

      const filas = resueltas.map(({ l, centro_costo_id, proveedor_id }) => ({
        tenant_id: tenantId,
        area,
        cdc: l.cdc || null,
        centro_costo_id,
        concepto: l.concepto || null,
        categoria: l.categoria || null,
        proveedor: l.proveedor || null,
        proveedor_id,
        moneda: l.moneda,
        tc: l.tc,
        mes_vencimiento: l.mesVencimiento || null,
        monto_ejecutado: l.montoEjecutado,
        monto_presupuestado: l.montoPresupuestado,
        monto_pagado: l.montoPagado,
        fecha_pagado: l.fechaPagado || null,
        estado_pago: l.estadoPago || null,
        mes_programado: l.mesProgramado || null,
        postergado: l.postergado,
        momento: l.momento || null,
        observaciones: l.observaciones || null,
        fuente: 'excel',
        origen_archivo: meta.name,
        fila: l.fila,
        creado_por: user.id,
      }))
      for (let i = 0; i < filas.length; i += 200) {
        const { error } = await admin.from('flujo_compromisos').insert(filas.slice(i, i + 200))
        if (error) return json({ error: `Error al cargar: ${error.message}`, ...info }, 500)
      }

      return json({ ok: true, ...info })
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  },
}
