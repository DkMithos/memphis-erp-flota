/**
 * Memphis ERP — Edge Function: fianzas-excel
 *
 * Regenera el "STATUS DE FIANZAS ACTUALIZADO 2026.xlsx" de SharePoint con lo
 * que hay hoy en el ERP.
 *
 * Decisión de Kevin (03/09/2026): **el ERP manda**. El Excel es una copia de
 * lectura; por eso la hoja se reescribe entera y lleva un aviso arriba. Si
 * alguien lo edita a mano, el siguiente botón se lleva ese cambio por delante —
 * es el precio de tener una sola fuente de verdad, y fue la opción elegida.
 *
 * Auth: la llama un usuario con `fianzas.exportar`. Se valida su JWT contra la
 * base antes de tocar nada.
 *
 * Graph: app-only con los secretos MS_*. **Requiere `Files.ReadWrite.All`**
 * (Application) con consentimiento de administrador. `excel-sync` solo pedía
 * `Files.Read.All`, que no alcanza para escribir: si falta, Graph responde 403
 * y esta función lo reporta tal cual en vez de fallar en silencio.
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

const HOJA = 'Hoja1'
/** Cabecera de la hoja, en el mismo orden que la lleva Administración. */
const CABECERA = [
  'CONSURSO Y/O CONTRATO', 'NOMBRE DEL PROYECTO', 'EMPRESAS Y/O CONSORCIO', 'ENTIDAD',
  'PROVEEDOR', 'TIPO', 'N° CARTA FIANZA', 'INICIO', 'PLAZO', 'FIN', 'FECHA DE RENOVACION',
  'MONTO CONTRATO', 'PORCENTAJE', 'MONTO AFIANZADO', 'COSTO DE RENOVACION', 'ENCAJE', 'VIGENCIA',
]
const COLUMNAS = CABECERA.length

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

/** dd/mm/aaaa, como lo escribe Administración. */
function dmy(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const ESTADO_A_VIGENCIA: Record<string, string> = {
  vigente: 'SI', renovada: 'NO', devuelta: 'DEVUELTA',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service)

  // ── Quién llama ────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'Falta la sesión' }, 401)

  const { data: userData, error: errUser } = await admin.auth.getUser(jwt)
  if (errUser || !userData?.user) return json({ error: 'Sesión inválida' }, 401)
  const userId = userData.user.id

  const { data: ut } = await admin
    .from('usuarios_tenant').select('tenant_id').eq('user_id', userId).maybeSingle()
  const tenantId = ut?.tenant_id
  if (!tenantId) return json({ error: 'El usuario no pertenece a ninguna empresa' }, 403)

  // ¿Tiene `fianzas.exportar`? Se resuelve en dos consultas simples a propósito:
  // el embed anidado de PostgREST ya dio problemas antes en `usuarios-alta`.
  const { data: roles } = await admin
    .from('usuarios_roles').select('rol_id').eq('user_id', userId).eq('tenant_id', tenantId)
  const rolIds = (roles ?? []).map((r: { rol_id: string }) => r.rol_id)
  if (rolIds.length === 0) return json({ error: 'El usuario no tiene rol asignado' }, 403)

  const { data: permisoFilas } = await admin
    .from('roles_permisos')
    .select('permisos!inner(modulo,accion)')
    .in('rol_id', rolIds)
  const puede = (permisoFilas ?? []).some((r: { permisos?: { modulo: string; accion: string } }) =>
    r.permisos?.modulo === 'fianzas' && r.permisos?.accion === 'exportar')
  if (!puede) return json({ error: 'No tienes permiso para actualizar el Excel de fianzas' }, 403)

  // ── Dónde se escribe ───────────────────────────────────────────────────
  const { data: cfg } = await admin
    .from('excel_sync_config')
    .select('drive_id,item_id,excel_url')
    .eq('tenant_id', tenantId).eq('nombre', 'fianzas').eq('activo', true)
    .maybeSingle()
  if (!cfg?.drive_id || !cfg?.item_id) {
    return json({ error: 'No está configurado el archivo de fianzas en SharePoint' }, 400)
  }

  // ── Qué se escribe ─────────────────────────────────────────────────────
  const { data: fianzas } = await admin
    .from('fianzas')
    .select('id,concurso,nombre_proyecto,consorcio,entidad,monto_contrato,porcentaje')
    .eq('tenant_id', tenantId).order('nombre_proyecto')
  const { data: cartas } = await admin
    .from('fianza_cartas')
    .select('fianza_id,numero,aseguradora,tipo,inicio,plazo_dias,fin,fecha_renovacion,monto_afianzado,costo_renovacion,encaje,estado')
    .eq('tenant_id', tenantId).order('inicio', { ascending: false })

  const porFianza = new Map<string, Record<string, unknown>[]>()
  for (const c of (cartas ?? [])) {
    const k = c.fianza_id as string
    if (!porFianza.has(k)) porFianza.set(k, [])
    porFianza.get(k)!.push(c)
  }

  const filas: (string | number)[][] = []
  for (const f of (fianzas ?? [])) {
    for (const c of (porFianza.get(f.id as string) ?? [])) {
      filas.push([
        (f.concurso as string) ?? '',
        (f.nombre_proyecto as string) ?? '',
        (f.consorcio as string) ?? '',
        (f.entidad as string) ?? '',
        (c.aseguradora as string) ?? '',
        (c.tipo as string) ?? '',
        (c.numero as string) ?? '',
        dmy(c.inicio as string),
        Number(c.plazo_dias ?? 0),
        dmy(c.fin as string),
        dmy(c.fecha_renovacion as string),
        f.monto_contrato === null ? '' : Number(f.monto_contrato),
        f.porcentaje === null ? '' : `${Math.round(Number(f.porcentaje) * 100)}%`,
        c.monto_afianzado === null ? '' : Number(c.monto_afianzado),
        c.costo_renovacion === null ? '' : Number(c.costo_renovacion),
        c.encaje === null ? '' : Number(c.encaje),
        ESTADO_A_VIGENCIA[c.estado as string] ?? 'NO',
      ])
    }
  }

  const aviso = new Array(COLUMNAS).fill('')
  aviso[0] = `Generado desde el ERP el ${dmy(new Date().toISOString())} — no editar aquí, los cambios se pierden en la próxima actualización.`

  const valores = [aviso, CABECERA, ...filas]

  // ── Escribir ───────────────────────────────────────────────────────────
  let token: string
  try { token = await getAppToken() } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }

  const base = `https://graph.microsoft.com/v1.0/drives/${cfg.drive_id}/items/${cfg.item_id}/workbook`
  const cab = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Se limpia un rango holgado antes de escribir: si el ERP tiene menos filas
  // que la última vez, sin esto quedarían colgando las viejas.
  const limpiar = await fetch(
    `${base}/worksheets('${HOJA}')/range(address='A1:${String.fromCharCode(64 + COLUMNAS)}500')/clear`,
    { method: 'POST', headers: cab, body: JSON.stringify({ applyTo: 'Contents' }) },
  )
  if (!limpiar.ok) {
    const detalle = await limpiar.text()
    const falta = limpiar.status === 403
    return json({
      error: falta
        ? 'Microsoft rechazó la escritura (403). Falta el permiso Files.ReadWrite.All con consentimiento de administrador en la app de Entra.'
        : `No se pudo limpiar la hoja: ${detalle}`,
      status: limpiar.status,
    }, 502)
  }

  const fin = `${String.fromCharCode(64 + COLUMNAS)}${valores.length}`
  const escribir = await fetch(
    `${base}/worksheets('${HOJA}')/range(address='A1:${fin}')`,
    { method: 'PATCH', headers: cab, body: JSON.stringify({ values: valores }) },
  )
  if (!escribir.ok) {
    return json({ error: `No se pudo escribir la hoja: ${await escribir.text()}`, status: escribir.status }, 502)
  }

  await admin.from('excel_sync_config')
    .update({ ultima_sincronizacion: new Date().toISOString(), ultimo_estado: 'ok', ultimo_error: null })
    .eq('tenant_id', tenantId).eq('nombre', 'fianzas')

  return json({
    ok: true,
    fianzas: (fianzas ?? []).length,
    cartas: filas.length,
    excel_url: cfg.excel_url,
  })
})
