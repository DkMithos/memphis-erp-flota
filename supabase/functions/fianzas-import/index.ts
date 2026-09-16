/**
 * Memphis ERP — Edge Function: fianzas-import
 *
 * Trae al ERP lo que Shirley tiene en "STATUS DE FIANZAS ACTUALIZADO 2026.xlsx".
 *
 * CAMBIO DE SENTIDO (16/09/2026). Hasta hoy mandaba el ERP y `fianzas-excel`
 * reescribía la hoja de SharePoint. Kevin decidió lo contrario: **Shirley
 * trabaja su Excel y el sistema se actualiza**. Por eso esta función existe y
 * por eso `fianzas-excel` quedó desactivada — si las dos corrieran, la última
 * que se pulsara se llevaría por delante el trabajo de la otra.
 *
 * Cómo empareja, y por qué así:
 *
 * - Una CARTA se identifica por `numero + inicio`, no por el número solo.
 *   Shirley reutiliza el número al renovar (15411-2407-2025-000 está dos veces,
 *   con 180 y con 300 días) y el ERP ya las tiene como dos cartas, que es lo
 *   correcto: son dos vigencias del mismo papel.
 * - Una carta que YA existe se actualiza donde está, sin tocar a qué fianza
 *   cuelga. Eso protege los cargos ya enlazados y respeta cómo agrupó la
 *   migración.
 * - Una carta NUEVA busca su fianza por convenio+entidad y, si no, por
 *   proyecto+entidad. Solo si no encuentra ninguna se crea una fianza.
 *
 * Nada se borra. Si una fila desaparece del Excel, su carta se queda en el ERP
 * y se reporta aparte: perder una fianza por un borrado accidental en una hoja
 * de cálculo no es una opción.
 *
 * Auth: usuario del tenant con `fianzas.editar`.
 * Graph: app-only, solo lectura (`Files.Read.All`) — el mismo permiso que ya usa
 * `excel-sync`. No hace falta el `Files.ReadWrite.All` de `fianzas-excel`.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  leerFila, agruparFilas, claveCarta, type FilaFianza,
} from './formato.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** La entrada de `excel_sync_config` que apunta al archivo de Shirley. */
const CONFIG = 'fianzas'

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

async function graph(token: string, url: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) {
    const cuerpo = await r.text().catch(() => '')
    if (r.status === 403) {
      throw new Error(
        'Microsoft rechazó la lectura del archivo (403). La aplicación necesita el permiso ' +
        'Files.Read.All con consentimiento de administrador.',
      )
    }
    throw new Error(`Graph ${r.status}: ${cuerpo.slice(0, 400)}`)
  }
  return r.json()
}

/** Normaliza para comparar nombres escritos a mano. */
const norm = (s: string) => (s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const secret = Deno.env.get('SUPABASE_SECRET_KEY')
      ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const admin = createClient(url, secret)

    // 1. Quién llama: usuario del tenant con permiso de editar fianzas.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Falta la sesión' }, 401)
    const { data: userRes } = await admin.auth.getUser(jwt)
    const user = userRes?.user
    if (!user) return json({ error: 'Sesión no válida' }, 401)

    const { data: ut } = await admin
      .from('usuarios_tenant').select('tenant_id').eq('user_id', user.id).maybeSingle()
    const tenantId = ut?.tenant_id as string | undefined
    if (!tenantId) return json({ error: 'El usuario no pertenece a ninguna empresa' }, 403)

    // ¿Tiene `fianzas.editar`? En dos consultas simples, igual que
    // `fianzas-excel`: el embed anidado de PostgREST ya dio problemas antes.
    const { data: roles } = await admin
      .from('usuarios_roles').select('rol_id').eq('user_id', user.id).eq('tenant_id', tenantId)
    const rolIds = (roles ?? []).map((r: { rol_id: string }) => r.rol_id)
    if (rolIds.length === 0) return json({ error: 'El usuario no tiene rol asignado' }, 403)
    const { data: permisoFilas } = await admin
      .from('roles_permisos').select('permisos!inner(modulo,accion)').in('rol_id', rolIds)
    // PostgREST devuelve el embed como objeto o como lista según la relación;
    // se aceptan las dos formas en vez de apostar por una.
    type Permiso = { modulo?: string; accion?: string }
    const esEditarFianzas = (p: Permiso) => p?.modulo === 'fianzas' && p?.accion === 'editar'
    const puede = (permisoFilas ?? []).some((r: Record<string, unknown>) => {
      const p = r.permisos as Permiso | Permiso[] | null
      return Array.isArray(p) ? p.some(esEditarFianzas) : esEditarFianzas(p ?? {})
    })
    if (!puede) return json({ error: 'Hace falta permiso de edición en Fianzas' }, 403)

    // 2. Dónde está el archivo.
    const { data: cfg } = await admin
      .from('excel_sync_config')
      .select('drive_id, item_id, excel_url')
      .eq('tenant_id', tenantId).eq('nombre', CONFIG).eq('activo', true)
      .maybeSingle()
    if (!cfg) return json({ error: `No hay un archivo configurado con el nombre "${CONFIG}"` }, 404)

    try {
      const token = await getAppToken()

      // 3. La hoja entera, como texto. `usedRange` da lo que hay escrito.
      const hojas = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cfg.drive_id}/items/${cfg.item_id}/workbook/worksheets?$select=name,id`)
      const primera = (hojas.value ?? [])[0]
      if (!primera) return json({ error: 'El archivo no tiene hojas' }, 422)

      const rango = await graph(token,
        `https://graph.microsoft.com/v1.0/drives/${cfg.drive_id}/items/${cfg.item_id}` +
        `/workbook/worksheets/${encodeURIComponent(primera.id)}/usedRange?$select=text`)
      const celdas: string[][] = rango.text ?? []

      // 4. La cabecera no está en la fila 1: la hoja empieza en B5.
      const iCabecera = celdas.findIndex(f => f.some(c => /CARTA FIANZA/i.test(String(c ?? ''))))
      if (iCabecera === -1) {
        return json({ error: 'No se encontró la fila de cabecera (falta "N° CARTA FIANZA")' }, 422)
      }
      const desplazamiento = celdas[iCabecera].findIndex(c => /CONSURSO|CONCURSO|CONTRATO/i.test(String(c ?? '')))
      const desde = desplazamiento >= 0 ? desplazamiento : 0

      const filas: FilaFianza[] = []
      let enBlanco = 0
      for (const cruda of celdas.slice(iCabecera + 1)) {
        const fila = leerFila(cruda.slice(desde))
        if (fila) filas.push(fila)
        else enBlanco++
      }
      if (filas.length === 0) {
        return json({ error: 'La hoja no tiene ninguna fila con número de carta' }, 422)
      }

      /**
       * `solo_leer` hace un ensayo: cuenta lo que pasaría y no escribe nada.
       * Sirve para ver qué va a cambiar antes de dejar que cambie, que con el
       * archivo de otra persona es lo mínimo.
       */
      const soloLeer = Boolean((await req.json().catch(() => ({}))).solo_leer)

      const { fianzas: grupos, repetidas } = agruparFilas(filas)

      // 5. Lo que ya hay en el ERP.
      const { data: fianzasBD } = await admin
        .from('fianzas').select('id, concurso, nombre_proyecto, entidad').eq('tenant_id', tenantId)
      const { data: cartasBD } = await admin
        .from('fianza_cartas').select('id, fianza_id, numero, inicio').eq('tenant_id', tenantId)

      const cartaPorClave = new Map<string, { id: string; fianza_id: string }>()
      for (const c of cartasBD ?? []) {
        cartaPorClave.set(claveCarta(c.numero ?? '', c.inicio ?? null), { id: c.id, fianza_id: c.fianza_id })
      }
      const fianzaPorConvenio = new Map<string, string>()
      const fianzaPorProyecto = new Map<string, string>()
      for (const f of fianzasBD ?? []) {
        if (f.concurso) fianzaPorConvenio.set(`${norm(f.concurso)}|${norm(f.entidad ?? '')}`, f.id)
        fianzaPorProyecto.set(`${norm(f.nombre_proyecto ?? '')}|${norm(f.entidad ?? '')}`, f.id)
      }

      const resumen = {
        solo_leer: soloLeer,
        fianzas_creadas: 0, fianzas_actualizadas: 0,
        cartas_creadas: 0, cartas_actualizadas: 0,
        filas_leidas: filas.length, filas_en_blanco: enBlanco,
        grupos: grupos.length,
        repetidas_en_el_excel: repetidas,
        solo_en_el_erp: [] as string[],
        problemas: [] as string[],
      }

      const vistasEnExcel = new Set<string>()

      for (const g of grupos) {
        const cab = g.datos
        const porConvenio = `${norm(cab.concurso)}|${norm(cab.entidad)}`
        const porProyecto = `${norm(cab.nombreProyecto)}|${norm(cab.entidad)}`

        /**
         * La fianza a la que colgar lo NUEVO.
         *
         * Si alguna carta del grupo ya existe, manda la fianza que esa carta ya
         * tenía. Ojo: un mismo convenio puede estar repartido en DOS fianzas del
         * ERP —el convenio 001-2025-OXI-GRL está como "GORE LORETO BOMBEROS" y
         * como "MAS SEGURIDAD BOMBEROS"— y eso NO se reagrupa: mover cartas de
         * sitio dejaría cargos colgando y una fianza vacía. Cada carta se queda
         * donde está y se refresca la cabecera de cada fianza tocada.
         */
        let fianzaId: string | null = null
        for (const c of g.cartas) {
          const ya = cartaPorClave.get(claveCarta(c.numero, c.inicio))
          if (ya) { fianzaId = ya.fianza_id; break }
        }
        fianzaId ??= fianzaPorConvenio.get(porConvenio)
          ?? fianzaPorProyecto.get(porProyecto)
          ?? null

        const datosFianza = {
          tenant_id: tenantId,
          concurso: cab.concurso || null,
          nombre_proyecto: cab.nombreProyecto || cab.concurso || 'SIN NOMBRE',
          consorcio: cab.consorcio || null,
          entidad: cab.entidad || null,
          monto_contrato: cab.montoContrato,
          porcentaje: cab.porcentaje,
          actualizado_en: new Date().toISOString(),
        }

        if (fianzaId) {
          if (!soloLeer) {
            // Solo lo que el Excel manda de verdad. `nombre_proyecto` NO se
            // toca: en el archivo el mismo proyecto aparece escrito de tres
            // maneras y renombrar la fianza en cada importación sería un baile.
            const { error } = await admin.from('fianzas').update({
              concurso: datosFianza.concurso,
              consorcio: datosFianza.consorcio,
              entidad: datosFianza.entidad,
              monto_contrato: datosFianza.monto_contrato,
              porcentaje: datosFianza.porcentaje,
              actualizado_en: datosFianza.actualizado_en,
            }).eq('id', fianzaId)
            if (error) { resumen.problemas.push(`${cab.nombreProyecto}: ${error.message}`); continue }
          }
          resumen.fianzas_actualizadas++
        } else if (soloLeer) {
          resumen.fianzas_creadas++
        } else {
          const { data: creada, error } = await admin
            .from('fianzas').insert(datosFianza).select('id').single()
          if (error || !creada) {
            resumen.problemas.push(`${cab.nombreProyecto}: ${error?.message ?? 'no se pudo crear'}`)
            continue
          }
          fianzaId = creada.id as string
          resumen.fianzas_creadas++
          fianzaPorConvenio.set(porConvenio, fianzaId)
          fianzaPorProyecto.set(porProyecto, fianzaId)
        }

        for (const c of g.cartas) {
          const clave = claveCarta(c.numero, c.inicio)
          vistasEnExcel.add(clave)
          const ya = cartaPorClave.get(clave)
          if (soloLeer) {
            if (ya) resumen.cartas_actualizadas++
            else resumen.cartas_creadas++
            continue
          }
          const datosCarta = {
            tenant_id: tenantId,
            // Una carta que ya existe NO cambia de fianza.
            fianza_id: ya?.fianza_id ?? fianzaId,
            numero: c.numero,
            aseguradora: c.proveedor || null,
            tipo: c.tipo || null,
            inicio: c.inicio,
            plazo_dias: c.plazoDias,
            // `fin` y `fecha_renovacion` NO se mandan: la base las calcula sola
            // (fin = inicio + plazo - 1, renovación = inicio + plazo - 6). Es la
            // misma fórmula que Shirley tiene en su hoja, solo que aquí no se
            // puede teclear encima — y en el archivo hay filas donde ella la
            // saltó a mano, así que el ERP enseñará su fecha calculada.
            monto_afianzado: c.montoAfianzado,
            costo_renovacion: c.costoRenovacion,
            encaje: c.encaje,
            estado: c.estado,
            // Lo que decía la columna de renovación cuando no era una fecha
            // ("DEVUELTA A CESE", "TERMINA") es información, no basura.
            notas: c.notaRenovacion || null,
            actualizado_en: new Date().toISOString(),
          }
          if (ya) {
            const { error } = await admin.from('fianza_cartas').update(datosCarta).eq('id', ya.id)
            if (error) resumen.problemas.push(`Carta ${c.numero}: ${error.message}`)
            else resumen.cartas_actualizadas++
          } else {
            const { error } = await admin.from('fianza_cartas').insert(datosCarta)
            if (error) resumen.problemas.push(`Carta ${c.numero}: ${error.message}`)
            else resumen.cartas_creadas++
          }
        }
      }

      // Lo que está en el ERP y ya no aparece en el Excel. No se borra: se avisa.
      for (const clave of cartaPorClave.keys()) {
        if (!vistasEnExcel.has(clave)) resumen.solo_en_el_erp.push(clave.split('@')[0])
      }

      if (!soloLeer) {
        await admin.from('excel_sync_config').update({
          ultima_sincronizacion: new Date().toISOString(),
          ultimo_estado: resumen.problemas.length ? 'con_avisos' : 'ok',
          ultimo_error: resumen.problemas.slice(0, 5).join(' | ') || null,
        }).eq('tenant_id', tenantId).eq('nombre', CONFIG)
      }

      return json({ ok: true, archivo: cfg.excel_url, ...resumen })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return json({ error: msg }, 500)
    }
  },
}
