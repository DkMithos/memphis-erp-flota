/**
 * Memphis ERP — Edge Function: flujo-import
 *
 * Trae al ERP las BD del flujo financiero (BD CONTA, BD TI, Flujo Administración,
 * Flujo de proyectos) que viven en SharePoint (sitio FlujoFinanciero). El ERP
 * deja de necesitar las tablas dinámicas del Excel: guarda la base y pinta las
 * vistas.
 *
 * Reemplaza por ÁREA: al reimportar BD CONTA se borra lo de esa área con
 * fuente='excel' y se vuelve a cargar; lo que se cree nativo en el ERP
 * (fuente='erp') no se toca. El parseo vive en `flujo.ts`, probado contra
 * filas reales.
 *
 * Acciones (POST):
 *   { accion:'carpetas' }                                   → raíces (uso='flujo')
 *   { accion:'listar', carpeta_id?, item_id? }              → navegar SharePoint
 *   { accion:'importar', area, drive_id, item_id, solo_leer? }
 *   { accion:'importar_todo', forzar? }                     → las cuatro bases de la
 *       raíz de la carpeta de flujo (una por área, la más reciente). Sin `forzar`
 *       solo se reimporta la que cambió en SharePoint desde la última lectura.
 *
 * Auth: usuario del tenant con `finanzas.crear`, `finanzas.editar` o
 * `finanzas.flujo`; o el cron de Supabase (`x-cron-secret`, job
 * `flujo-import-2xdia`, 06:00 y 15:00 hora Perú) que corre `importar_todo`
 * para cada tenant con carpeta de flujo. Cada lectura queda en
 * `flujo_importaciones` (sprint 4: "hora de última lectura en pantalla").
 * Graph: app-only, solo lectura (`Files.Read.All`).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { leerCompromisos, leerProyectos, normalizarNumeroOC, resumen, type LineaFlujo } from './flujo.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Las bases que se leen solas: una por área, en la raíz de la carpeta de flujo. */
const AREAS_AUTO = ['CONTABILIDAD', 'TI', 'ADMINISTRACION', 'PROYECTOS']

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
const ALIAS_CC: Record<string, string> = { database: 'base de datos' }

/**
 * Área canónica a partir del nombre del archivo:
 *   "BD CONTA 2026.xlsx"        → CONTABILIDAD
 *   "BD TI 2026.xlsx"           → TI
 *   "Flujo Administración.xlsx" → ADMINISTRACION
 *   "Flujo de proyectos.xlsx"   → PROYECTOS
 *   "Flujo GM.xlsx"             → '' (es un consolidado, no una base)
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

type Carpeta = { id: string; nombre: string; descripcion: string | null; drive_id: string; item_id: string; ruta: string | null; ruta_relativa: string | null }
type Item = { id: string; nombre: string; esCarpeta: boolean; elementos: number | null; tamano: number | null; esExcel: boolean; area: string; modificado: string | null }
type Ctx = { admin: SupabaseClient; tenantId: string; userId: string | null; token: () => Promise<string> }

/** Hijos de una carpeta de SharePoint (raíz de flujo o subcarpeta). */
async function listarHijos(ctx: Ctx, raiz: Carpeta, itemId?: string): Promise<Item[]> {
  const token = await ctx.token()
  const base = `https://graph.microsoft.com/v1.0/drives/${raiz.drive_id}`
  const destino = itemId
    ? `${base}/items/${itemId}`
    : raiz.ruta_relativa
      ? `${base}/root:/${raiz.ruta_relativa.split('/').map(encodeURIComponent).join('/')}:`
      : `${base}/items/${raiz.item_id}`
  const hijos = await graph(token, `${destino}/children?$select=id,name,size,folder,file,lastModifiedDateTime&$top=800`)
  const items: Item[] = (hijos.value ?? []).map((i: any) => ({
    id: i.id,
    nombre: i.name,
    esCarpeta: Boolean(i.folder),
    elementos: i.folder?.childCount ?? null,
    tamano: i.size ?? null,
    esExcel: /\.(xlsx|xlsm)$/i.test(i.name ?? ''),
    area: areaDeNombre(i.name ?? ''),
    modificado: i.lastModifiedDateTime ?? null,
  }))
  items.sort((a, b) => Number(b.esCarpeta) - Number(a.esCarpeta) || a.nombre.localeCompare(b.nombre, 'es'))
  return items
}

async function carpetasFlujo(ctx: Ctx): Promise<Carpeta[]> {
  const { data } = await ctx.admin
    .from('documentos_carpetas')
    .select('id, nombre, descripcion, drive_id, item_id, ruta, ruta_relativa')
    .eq('tenant_id', ctx.tenantId).eq('activo', true).eq('uso', 'flujo')
    .order('orden')
  return (data ?? []) as Carpeta[]
}

/** Deja constancia de la lectura (ok, error u omitida) para la pantalla y el cron. */
async function anotar(ctx: Ctx, fila: Record<string, unknown>) {
  await ctx.admin.from('flujo_importaciones').insert({ tenant_id: ctx.tenantId, por: ctx.userId, ...fila })
}

/**
 * Importa un archivo: lee la hoja base por Graph, resuelve CC / proveedor / OC
 * y reemplaza lo de esa área con fuente='excel'. Devuelve el resumen; con
 * `soloLeer` no escribe nada.
 */
async function importarArchivo(ctx: Ctx, p: { area?: string; driveId: string; itemId: string; soloLeer?: boolean; modo: string; modificado?: string | null }) {
  const token = await ctx.token()
  const meta = await graph(token,
    `https://graph.microsoft.com/v1.0/drives/${p.driveId}/items/${p.itemId}?$select=name,lastModifiedDateTime`)
  const area = (p.area || areaDeNombre(meta.name ?? '') || 'GENERAL').toUpperCase()
  const modificado = p.modificado ?? meta.lastModifiedDateTime ?? null

  try {
    const hojas = await graph(token,
      `https://graph.microsoft.com/v1.0/drives/${p.driveId}/items/${p.itemId}/workbook/worksheets?$select=name,id`)
    // La hoja base: Contabilidad, TI y Administración usan la tabla plana
    // "BD ..." (con pagado/pendiente); Proyectos usa "Base de datos".
    const lista = hojas.value ?? []
    const esBD = (h: any) => /^bd\b/i.test(h.name ?? '')
    const esBaseDatos = (h: any) => norm(h.name ?? '').includes('base de datos')
    const hoja = area === 'PROYECTOS'
      ? (lista.find(esBaseDatos) ?? lista.find(esBD) ?? lista[0])
      : (lista.find(esBD) ?? lista.find(esBaseDatos) ?? lista[0])
    if (!hoja) throw new Error('El archivo no tiene hojas')
    // `valuesOnly=true` recorta el rango a las celdas con datos: hay hojas
    // (p. ej. BD ADMIN) con columnas fantasma hasta la XFD que, con el
    // usedRange normal, revientan el límite de celdas de Graph.
    const rango = await graph(token,
      `https://graph.microsoft.com/v1.0/drives/${p.driveId}/items/${p.itemId}` +
      `/workbook/worksheets/${encodeURIComponent(hoja.id)}/usedRange(valuesOnly=true)?$select=text`)
    const celdas: string[][] = rango.text ?? []

    // Proyectos tiene cabecera propia; Contabilidad, TI y Administración usan
    // la tabla plana común (BD …) con la columna PAGADO/PENDIENTE.
    const lineas = area === 'PROYECTOS' ? leerProyectos(celdas) : leerCompromisos(celdas)
    if (lineas.length === 0) throw new Error('No se reconoció la cabecera (CDC / CONCEPTO) ni filas')
    const res = resumen(lineas)

    // Mapas de resolución: centro de costo y proveedor por nombre.
    const [{ data: ccs }, { data: provs }] = await Promise.all([
      ctx.admin.from('centros_costo').select('id, nombre, codigo').eq('tenant_id', ctx.tenantId),
      ctx.admin.from('proveedores').select('id, razon_social').eq('tenant_id', ctx.tenantId),
    ])
    // El CDC del flujo es el CÓDIGO del centro de costo (GHUANUCOPNP, OFCENTRAL…);
    // se acepta también por nombre por si alguno viniera así.
    const ccPorClave = new Map<string, string>()
    for (const c of (ccs ?? []) as any[]) {
      if (c.codigo) ccPorClave.set(norm(c.codigo), c.id as string)
      if (c.nombre && !ccPorClave.has(norm(c.nombre))) ccPorClave.set(norm(c.nombre), c.id as string)
    }
    const provPorNombre = new Map((provs ?? []).map((x: any) => [norm(x.razon_social), x.id as string]))
    const resolverCC = (cdc: string) => ccPorClave.get(norm(cdc)) ?? ccPorClave.get(ALIAS_CC[norm(cdc)] ?? '') ?? null
    const resolverProv = (nombre: string) => provPorNombre.get(norm(nombre)) ?? null

    // Órdenes de compra por número, para enlazar la fila del Excel con su OC
    // (así el compromiso que genera la OC aprobada no se duplica con el del
    // Excel). Supabase corta en 1000 filas: se pagina.
    const ocPorNumero = new Map<string, string>()
    for (let desde = 0; ; desde += 1000) {
      const { data: ocs } = await ctx.admin.from('ordenes_compra').select('id, numero')
        .eq('tenant_id', ctx.tenantId).range(desde, desde + 999)
      for (const o of (ocs ?? []) as any[]) {
        const n = normalizarNumeroOC(o.numero)
        if (n && !ocPorNumero.has(n)) ocPorNumero.set(n, o.id as string)
      }
      if (!ocs || ocs.length < 1000) break
    }
    const resolverOC = (ref: string) => ocPorNumero.get(normalizarNumeroOC(ref)) ?? null

    let ccMatch = 0, provMatch = 0, ocMatch = 0
    const resueltas = lineas.map((l: LineaFlujo) => {
      const centro_costo_id = resolverCC(l.cdc)
      const proveedor_id = resolverProv(l.proveedor)
      const orden_compra_id = resolverOC(l.referencia)
      if (centro_costo_id) ccMatch++
      if (proveedor_id) provMatch++
      if (orden_compra_id) ocMatch++
      return { l, centro_costo_id, proveedor_id, orden_compra_id }
    })

    const info = {
      area,
      archivo: meta.name as string,
      archivo_modificado: modificado,
      hoja: hoja.name,
      cabecera: (celdas[0] ?? []).slice(0, 40),
      ...res,
      centros_costo_reconocidos: ccMatch,
      proveedores_reconocidos: provMatch,
      ordenes_reconocidas: ocMatch,
    }
    if (p.soloLeer) return { ok: true, solo_leer: true, ...info, muestra: lineas.slice(0, 3) }

    // Reemplazo por área (solo lo importado del Excel).
    await ctx.admin.from('flujo_compromisos').delete()
      .eq('tenant_id', ctx.tenantId).eq('area', area).eq('fuente', 'excel')

    // El Excel codifica el ingreso con signo negativo; el ERP lo guarda como
    // sentido='cobrar' con monto positivo (nunca por signo). El origen separa
    // deuda cierta (pagado/factura) de comprometido (OC) y proyección.
    const abs = (n: number | null) => (n === null ? null : Math.abs(n))
    const filas = resueltas.map(({ l, centro_costo_id, proveedor_id, orden_compra_id }) => {
      const esIngreso = (l.montoPresupuestado ?? l.montoEjecutado ?? 0) < 0
      const pagado = /PAGADO/.test(l.estadoPago)
      return {
        tenant_id: ctx.tenantId,
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
        fecha_vencimiento: l.fechaVencimiento || l.mesVencimiento || null,
        monto_ejecutado: abs(l.montoEjecutado),
        monto_presupuestado: abs(l.montoPresupuestado),
        monto_pagado: abs(l.montoPagado),
        fecha_pagado: l.fechaPagado || null,
        estado_pago: l.estadoPago || null,
        mes_programado: l.mesProgramado || null,
        postergado: l.postergado,
        momento: l.momento || null,
        observaciones: l.observaciones || null,
        sentido: esIngreso ? 'cobrar' : 'pagar',
        origen: pagado ? 'real' : orden_compra_id ? 'comprometido' : 'proyectado',
        orden_compra_id,
        referencia_doc: l.referencia || null,
        fuente: 'excel',
        origen_archivo: meta.name,
        fila: l.fila,
        creado_por: ctx.userId,
      }
    })
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await ctx.admin.from('flujo_compromisos').insert(filas.slice(i, i + 200))
      if (error) throw new Error(`Error al cargar: ${error.message}`)
    }

    await anotar(ctx, {
      area, archivo: meta.name, item_id: p.itemId, archivo_modificado: modificado, modo: p.modo, estado: 'ok',
      compromisos: res.compromisos, detalle: { hoja: hoja.name, ...res, centros_costo_reconocidos: ccMatch, proveedores_reconocidos: provMatch, ordenes_reconocidas: ocMatch },
    })
    return { ok: true, ...info }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!p.soloLeer) {
      await anotar(ctx, { area, archivo: meta.name, item_id: p.itemId, archivo_modificado: modificado, modo: p.modo, estado: 'error', error: msg.slice(0, 500) })
    }
    throw e
  }
}

/**
 * Las cuatro bases de la raíz de la carpeta de flujo, una por área (la más
 * reciente si hay varias). Sin `forzar`, se omite la que no cambió en
 * SharePoint desde la última lectura buena.
 */
async function importarTodo(ctx: Ctx, forzar: boolean, modo: string) {
  const carpetas = await carpetasFlujo(ctx)
  const raiz = carpetas[0]
  if (!raiz) return { ok: false, error: 'No hay ninguna carpeta de flujo configurada', resultados: [] }
  const items = (await listarHijos(ctx, raiz)).filter(i => i.esExcel && AREAS_AUTO.includes(i.area))
  const porArea = new Map<string, Item>()
  for (const it of items) {
    const prev = porArea.get(it.area)
    if (!prev || String(it.modificado ?? '') > String(prev.modificado ?? '')) porArea.set(it.area, it)
  }
  const { data: ultimas } = await ctx.admin.from('flujo_importaciones')
    .select('area, item_id, archivo_modificado').eq('tenant_id', ctx.tenantId).eq('estado', 'ok')
    .order('importado_en', { ascending: false }).limit(50)
  const ultimaPorArea = new Map<string, { item_id: string; archivo_modificado: string | null }>()
  for (const u of (ultimas ?? []) as any[]) if (!ultimaPorArea.has(u.area)) ultimaPorArea.set(u.area, u)

  const resultados: Record<string, unknown>[] = []
  for (const area of AREAS_AUTO) {
    const it = porArea.get(area)
    if (!it) { resultados.push({ area, estado: 'sin_archivo', error: 'No hay un Excel de esta área en la raíz de la carpeta de flujo' }); continue }
    const u = ultimaPorArea.get(area)
    if (!forzar && u && u.item_id === it.id && u.archivo_modificado && it.modificado && new Date(u.archivo_modificado).getTime() >= new Date(it.modificado).getTime()) {
      await anotar(ctx, { area, archivo: it.nombre, item_id: it.id, archivo_modificado: it.modificado, modo, estado: 'omitido', detalle: { motivo: 'sin cambios en SharePoint' } })
      resultados.push({ area, archivo: it.nombre, estado: 'omitido', modificado: it.modificado })
      continue
    }
    try {
      const r = await importarArchivo(ctx, { area, driveId: raiz.drive_id, itemId: it.id, modo, modificado: it.modificado })
      resultados.push({ area, archivo: it.nombre, estado: 'ok', compromisos: (r as any).compromisos, modificado: it.modificado })
    } catch (e) {
      resultados.push({ area, archivo: it.nombre, estado: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }
  return { ok: resultados.every(r => r.estado !== 'error'), resultados }
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    let tokenCache: string | null = null
    const token = async () => (tokenCache ??= await getAppToken())

    // ── Cron de Supabase: todas las bases de cada tenant con carpeta de flujo ──
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
    const esCron = Boolean(cronSecret) && (req.headers.get('x-cron-secret') ?? '') === cronSecret
    if (esCron) {
      const { data: carpetas } = await admin.from('documentos_carpetas').select('tenant_id').eq('activo', true).eq('uso', 'flujo')
      const tenants = Array.from(new Set(((carpetas ?? []) as any[]).map(c => c.tenant_id as string)))
      const salida: Record<string, unknown>[] = []
      for (const tenantId of tenants) {
        try {
          const r = await importarTodo({ admin, tenantId, userId: null, token }, false, 'cron')
          salida.push({ tenant_id: tenantId, ...r })
        } catch (e) {
          salida.push({ tenant_id: tenantId, ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
      return json({ ok: salida.every(s => s.ok !== false), tenants: salida })
    }

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

    const ctx: Ctx = { admin, tenantId, userId: user.id, token }

    let cuerpo: {
      accion?: string; area?: string; drive_id?: string; item_id?: string
      carpeta_id?: string; solo_leer?: boolean; forzar?: boolean
    }
    try { cuerpo = await req.json() } catch { cuerpo = {} }
    const accion = cuerpo.accion ?? (cuerpo.drive_id ? 'importar' : 'listar')

    try {
      // ── Las cuatro bases de un golpe (botón "Actualizar desde el Excel") ──
      if (accion === 'importar_todo') {
        return json(await importarTodo(ctx, cuerpo.forzar ?? true, 'manual'))
      }

      // ── Navegación de SharePoint (raíces uso='flujo') ──
      if (accion === 'carpetas' || accion === 'listar') {
        const carpetas = await carpetasFlujo(ctx)
        if (accion === 'carpetas') {
          return json({ ok: true, carpetas: carpetas.map(({ id, nombre, descripcion, ruta }) => ({ id, nombre, descripcion, ruta })) })
        }
        const raiz = carpetas.find(c => c.id === cuerpo.carpeta_id) ?? carpetas[0]
        if (!raiz) return json({ error: 'No hay ninguna carpeta de flujo configurada' }, 404)
        const items = await listarHijos(ctx, raiz, cuerpo.item_id)
        return json({
          ok: true,
          carpeta: { id: raiz.id, nombre: raiz.nombre, ruta: raiz.ruta, drive_id: raiz.drive_id },
          en_raiz: !cuerpo.item_id,
          items,
        })
      }

      // ── Importar un archivo elegido ──
      if (!cuerpo.drive_id || !cuerpo.item_id) return json({ error: 'Faltan datos: drive_id, item_id' }, 400)
      const r = await importarArchivo(ctx, { area: cuerpo.area, driveId: cuerpo.drive_id, itemId: cuerpo.item_id, soloLeer: cuerpo.solo_leer, modo: 'manual' })
      return json(r)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const estado = /no se reconoci|no tiene hojas/i.test(msg) ? 422 : 500
      return json({ error: msg }, estado)
    }
  },
}
