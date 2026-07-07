/**
 * Memphis ERP — Edge Function: excel-sync (Fase A — coexistencia con Excel)
 *
 * Lee los archivos configurados en `excel_sync_config` (RESUMEN.xlsx del canal
 * OPERACIONES2 por defecto), recorre cada worksheet, extrae los campos del
 * formato ficha-por-proyecto (PROYECTO:, OWNER:, CIU:, etc.) y hace upsert en
 * `proyectos_excel_sync`. El equipo sigue trabajando en el Excel; el ERP refleja.
 *
 * Auth: app-only (MS_* secrets) con Files.Read.All Application.
 * Trigger: manual (curl) o vía pg_cron cada 30 min.
 *
 * Secretos: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
 *           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           CRON_SECRET (opcional).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  // x-client-info / x-supabase-api-version: los envía supabase-js functions.invoke —
  // sin ellos el preflight CORS falla desde el navegador ("Sincronizar ahora").
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
  const r = await fetch(`https://login.microsoftonline.com/${Deno.env.get('MS_TENANT_ID')}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!r.ok) throw new Error(`Token error ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token as string
}

async function graphGet(token: string, url: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`Graph ${r.status} ${url}: ${await r.text().catch(() => '')}`)
  return r.json()
}

// ── Helpers de parseo ───────────────────────────────────────────────────────

// Normaliza una etiqueta para comparar ('PROYECTO:' ≡ 'proyecto')
const norm = (s: any): string =>
  String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ').replace(/[:.]+$/g, '')

// Convierte "S/. 6.86 M" / "S/ 12.83 M" / "12,500,000" → number
function parseMonto(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  const isMillones = /\bM\b/i.test(s)
  // Quitar prefijo de moneda (S/. / S/ / US$ / $) y sufijo de millones
  // En formato peruano: la coma es decimal; el punto puede ser separador de miles
  let clean = s.replace(/^[A-Z\/.$\s]+/i, '').replace(/\s*M\b.*$/i, '').trim()
  clean = clean.replace(/[^\d.,\-]/g, '')
  if (/^-?\d+(?:\.\d{3})+,\d{1,3}$/.test(clean)) {
    // Formato 1.234.567,89 (es-PE con miles)
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d+(?:,\d{3})+\.\d{1,3}$/.test(clean)) {
    // Formato 1,234,567.89 (en-US)
    clean = clean.replace(/,/g, '')
  } else if (clean.includes(',') && !clean.includes('.')) {
    // 6,86 → 6.86 (coma como decimal)
    clean = clean.replace(',', '.')
  } else {
    clean = clean.replace(/,/g, '')
  }
  const n = Number(clean)
  if (Number.isNaN(n)) return null
  return isMillones ? n * 1_000_000 : n
}

// Convierte fechas tipo "27-Jun-25", "1-Apr-26", excel serial number, etc.
function parseFecha(v: any): string | null {
  if (v === null || v === undefined || v === '') return null
  // Si Excel devuelve un serial number
  if (typeof v === 'number' && v > 25000 && v < 60000) {
    // Excel epoch: 1899-12-30
    const ms = (v - 25569) * 86400 * 1000
    const d = new Date(ms)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  // "DD-Mmm-YY"
  const m = s.match(/^(\d{1,2})[-/](\w{3,})[-/](\d{2,4})$/)
  if (m) {
    const months: Record<string, number> = {
      ENE: 0, JAN: 0, FEB: 1, MAR: 2, ABR: 3, APR: 3, MAY: 4, JUN: 5, JUL: 6,
      AGO: 7, AUG: 7, SEP: 8, SET: 8, OCT: 9, NOV: 10, DIC: 11, DEC: 11,
    }
    const d = parseInt(m[1])
    const mo = months[m[2].slice(0, 3).toUpperCase()]
    let y = parseInt(m[3])
    if (y < 100) y += 2000
    if (mo !== undefined && !isNaN(d) && !isNaN(y)) {
      return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  // Intento estándar
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

// Convierte a entero (ITEMS, PLAZO DIAS TOTAL)
function parseInt0(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseInt(String(v).replace(/[^\d-]/g, ''))
  return Number.isNaN(n) ? null : n
}

// Mapeo etiqueta → propiedad del registro
const LABELS: Record<string, string> = {
  'PROYECTO': 'proyecto',
  'OWNER': 'owner',
  'CODIGO INVER (CIU)': 'ciu',
  'CODIGO INVER. (CIU)': 'ciu',
  'CODIGO INVER': 'ciu',
  'CIU': 'ciu',
  'DOC TÉCNICO': 'doc_tecnico',
  'DOC TECNICO': 'doc_tecnico',
  'DOC. TÉCNICO': 'doc_tecnico',
  'TIPO': 'tipo',
  'FASE ACTUAL': 'fase_actual',
  'INVERSIÓN INICIAL': 'inversion_inicial',
  'INVERSION INICIAL': 'inversion_inicial',
  'DOC ACTUAL': 'doc_actual',
  'DOC. ACTUAL': 'doc_actual',
  'VALOR MODIFICADO': 'valor_modificado',
  'ITEMS': 'items',
  'MONTO COBRADO': 'monto_cobrado',
  'ACTA DE INICIO': 'acta_inicio',
  'MONTO PENDIENTE': 'monto_pendiente',
  'PLAZO DIAS TOTAL': 'plazo_dias_total',
  'PRESUPUESTO': 'presupuesto',
  'FECHA DE PLAZO': 'fecha_plazo',
  'TIPO DE VALORIZACIÓN': 'tipo_valorizacion',
  'TIPO DE VALORIZACION': 'tipo_valorizacion',
  'NUEVO PLAZO': 'nuevo_plazo',
  'ESTADO ACTUAL': 'estado_actual',
  'DIAS PENALIDAD': 'dias_penalidad',
}

const NUMERIC = new Set(['inversion_inicial', 'valor_modificado', 'monto_cobrado', 'monto_pendiente', 'presupuesto'])
const INT_FIELDS = new Set(['items', 'plazo_dias_total'])
const DATE_FIELDS = new Set(['acta_inicio', 'fecha_plazo', 'nuevo_plazo'])

function parseSheet(values: any[][]): Record<string, any> | null {
  const out: Record<string, any> = {}
  for (let r = 0; r < values.length; r++) {
    const row = values[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const labelKey = norm(row[c])
      if (!labelKey) continue
      const prop = LABELS[labelKey]
      if (!prop) continue
      // Valor: celda inmediata a la derecha; si está vacía, la siguiente
      const raw = row[c + 1] !== undefined && row[c + 1] !== ''
        ? row[c + 1]
        : (row[c + 2] !== undefined ? row[c + 2] : null)
      if (raw === null || raw === undefined || raw === '') continue
      if (NUMERIC.has(prop)) out[prop] = parseMonto(raw)
      else if (INT_FIELDS.has(prop)) out[prop] = parseInt0(raw)
      else if (DATE_FIELDS.has(prop)) out[prop] = parseFecha(raw)
      else out[prop] = String(raw).trim()
    }
  }
  // Sin 'proyecto' identificado → no es hoja de proyecto
  if (!out.proyecto) return null
  return out
}

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) return json({ error: 'forbidden' }, 403)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(supabaseUrl, serviceKey)

  const out: any = { configs: [] }

  try {
    const { data: configs } = await admin
      .from('excel_sync_config')
      .select('id, tenant_id, nombre, drive_id, item_id, excel_url')
      .eq('activo', true)

    if (!configs || configs.length === 0) {
      return json({ ok: true, message: 'Sin archivos configurados para sincronizar' })
    }

    const token = await getAppToken()

    for (const cfg of configs) {
      const cfgOut: any = { nombre: cfg.nombre, hojas: 0, upserts: 0, proyectos_actualizados: 0, errores: [] }
      try {
        // Listar worksheets
        const wsList = await graphGet(
          token,
          `https://graph.microsoft.com/v1.0/drives/${cfg.drive_id}/items/${cfg.item_id}/workbook/worksheets?$select=name,id`,
        )
        const sheets: { name: string; id: string }[] = wsList.value ?? []
        cfgOut.hojas = sheets.length

        for (const ws of sheets) {
          try {
            const used = await graphGet(
              token,
              `https://graph.microsoft.com/v1.0/drives/${cfg.drive_id}/items/${cfg.item_id}/workbook/worksheets/${encodeURIComponent(ws.id)}/usedRange?$select=text`,
            )
            const values: any[][] = used.text ?? []
            const parsed = parseSheet(values)
            if (!parsed) continue // No es hoja de proyecto (RESUMEN/RACI/etc.)

            const payload: Record<string, any> = {
              tenant_id: cfg.tenant_id,
              hoja: ws.name,
              ...parsed,
              datos_raw: { text: values }, // contenido completo de la hoja para la ficha
              excel_url: cfg.excel_url,
              sincronizado_en: new Date().toISOString(),
            }

            const { error: upErr } = await admin
              .from('proyectos_excel_sync')
              .upsert(payload, { onConflict: 'tenant_id,hoja' })
            if (upErr) cfgOut.errores.push(`${ws.name}: ${upErr.message}`)
            else cfgOut.upserts++

            // ── Propagación a `proyectos` (casando por CIU / codigo_inversion) ──
            // SOLO desde las hojas de detalle oficiales (empiezan con '#') — las hojas
            // sin '#' son de planificación con montos redondeados y NO son fuente.
            // Solo MONTOS: contrato (inversión inicial), adenda (valor modificado −
            // inicial) y monto cobrado. Códigos, fases y estados NO se tocan.
            if (parsed.ciu && ws.name.trim().startsWith('#')) {
              const upd: Record<string, number> = {}
              if (parsed.inversion_inicial != null) upd.monto_contrato = parsed.inversion_inicial
              if (parsed.inversion_inicial != null && parsed.valor_modificado != null) {
                upd.monto_adenda = Math.round((parsed.valor_modificado - parsed.inversion_inicial) * 100) / 100
              }
              if (parsed.monto_cobrado != null) upd.monto_cobrado = parsed.monto_cobrado
              if (parsed.presupuesto != null) upd.presupuesto = parsed.presupuesto
              if (Object.keys(upd).length > 0) {
                const { data: updData, error: pErr } = await admin
                  .from('proyectos')
                  .update(upd)
                  .eq('tenant_id', cfg.tenant_id)
                  .eq('codigo_inversion', String(parsed.ciu).trim())
                  .select('id')
                if (pErr) cfgOut.errores.push(`${ws.name} → proyectos: ${pErr.message}`)
                else if (updData && updData.length > 0) cfgOut.proyectos_actualizados += updData.length
              }
            }
          } catch (eSheet) {
            cfgOut.errores.push(`${ws.name}: ${eSheet instanceof Error ? eSheet.message : String(eSheet)}`)
          }
        }

        await admin.from('excel_sync_config').update({
          ultima_sincronizacion: new Date().toISOString(),
          ultimo_estado: cfgOut.errores.length === 0 ? 'ok' : 'parcial',
          ultimo_error: cfgOut.errores.length ? cfgOut.errores.slice(0, 5).join(' | ') : null,
        }).eq('id', cfg.id)
      } catch (eCfg) {
        const msg = eCfg instanceof Error ? eCfg.message : String(eCfg)
        cfgOut.error = msg
        await admin.from('excel_sync_config').update({
          ultimo_estado: 'error',
          ultimo_error: msg,
          ultima_sincronizacion: new Date().toISOString(),
        }).eq('id', cfg.id)
      }
      out.configs.push(cfgOut)
    }

    return json({ ok: true, ...out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
