/**
 * Memphis ERP — Edge Function PÚBLICA: capacitaciones-publico
 *
 * Es la única puerta sin sesión del módulo de Capacitaciones y Certificados.
 * La usan tres pantallas que viven fuera del login del ERP:
 *
 *   /cert/:token     → verificar un certificado (el QR impreso en el diploma)
 *   /certificados    → portal: la persona escribe su DNI y ve sus capacitaciones,
 *                      el temario y descarga sus certificados
 *   /c/:token        → formulario de asistencia: el participante llena sus datos
 *                      y FIRMA desde su propio celular
 *
 * Acciones (POST JSON):
 *   { accion:'verificar',    token, dni }  → sin dni solo dice si el código existe
 *   { accion:'consultar',    dni }
 *   { accion:'capacitacion', token }                       → datos para el formulario
 *   { accion:'firmar',       token, dni, nombres, apellidos, cargo?, institucion?,
 *                            email?, telefono?, firma }     → registra asistencia + firma
 *
 * Por qué pública: el participante no tiene cuenta en el ERP y cualquiera que
 * reciba un certificado debe poder comprobar que es auténtico. Lo que se
 * expone es lo mismo que está impreso en el papel (nombre, curso, horas,
 * fecha). Lo que NO sale nunca por aquí: la firma del participante, su
 * teléfono/correo ni nada de otras personas.
 *
 * Anti-abuso: toda consulta queda en `certificado_accesos` con la IP, y hay un
 * tope por IP (consultas por DNI y firmas). El DNI se guarda hasheado.
 */
import { withSupabase } from 'npm:@supabase/server'

type Accion = 'verificar' | 'consultar' | 'capacitacion' | 'firmar'

interface Body {
  accion?: Accion
  token?: string
  dni?: string
  nombres?: string
  apellidos?: string
  cargo?: string
  institucion?: string
  email?: string
  telefono?: string
  firma?: string
}

// Topes por IP (ventana deslizante)
const TOPE_CONSULTAS_10MIN = 12
const TOPE_CONSULTAS_DIA = 60
const TOPE_FIRMAS_HORA = 15
const FIRMA_MAX_BYTES = 400 * 1024 // PNG recortado del pad: normalmente 10–40 KB

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DNI_RE = /^[0-9A-Za-z]{6,12}$/

const json = (b: unknown, s = 200) => Response.json(b, { status: s })

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function ipDe(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  return (xff.split(',')[0] || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'desconocida').trim()
}

const limpiar = (s: unknown, max = 160) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const normalizarDni = (s: unknown) => String(s ?? '').replace(/[\s.-]/g, '').toUpperCase()

/** "12345678" → "123****8": lo justo para que la persona se reconozca. */
const mascararDni = (dni: string) =>
  dni.length <= 4 ? dni : dni.slice(0, 3) + '*'.repeat(Math.max(1, dni.length - 4)) + dni.slice(-1)

/** Vista pública de un certificado: snapshot tal cual se imprimió + estado actual. */
function vistaCertificado(c: any) {
  return {
    id: c.id,
    codigo: c.codigo,
    token: c.token,
    estado: c.estado,
    emitido_en: c.emitido_en,
    revocado_en: c.revocado_en,
    motivo_revocacion: c.estado === 'revocado' ? c.motivo_revocacion : undefined,
    datos: c.datos,
    plantilla: c.plantilla,
  }
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

    let body: Body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

    const admin = ctx.supabaseAdmin
    const ip = ipDe(req)
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 300)

    const registrar = async (r: {
      tipo: 'consulta_dni' | 'verificacion' | 'firma' | 'formulario'
      tenant_id?: string | null
      dni?: string
      certificado_id?: string | null
      capacitacion_id?: string | null
      resultado: string
    }) => {
      await admin.from('certificado_accesos').insert({
        tipo: r.tipo,
        tenant_id: r.tenant_id ?? null,
        dni_hash: r.dni ? await sha256hex(r.dni) : null,
        certificado_id: r.certificado_id ?? null,
        capacitacion_id: r.capacitacion_id ?? null,
        ip, user_agent: ua, resultado: r.resultado,
      })
    }

    const contar = async (tipo: string, minutos: number) => {
      const desde = new Date(Date.now() - minutos * 60_000).toISOString()
      const { count } = await admin.from('certificado_accesos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', tipo).eq('ip', ip).gte('creado_en', desde)
      return count ?? 0
    }

    // ── verificar: QR del certificado ─────────────────────────────────────
    // El QR impreso NO abre el certificado por sí solo: cualquiera que lo
    // escanee vería nombre y DNI del titular. Sin DNI solo se confirma que el
    // código existe; los datos salen cuando el DNI coincide con el del titular
    // (lo mismo que ya exige el portal por DNI). Mismo tope por IP que el portal.
    if (body.accion === 'verificar') {
      const token = String(body.token ?? '').trim()
      if (!UUID_RE.test(token)) return json({ error: 'Código de verificación inválido' }, 400)
      const dni = normalizarDni(body.dni)
      const { data: c } = await admin.from('certificados')
        .select('id, tenant_id, codigo, token, estado, emitido_en, revocado_en, motivo_revocacion, datos, plantilla')
        .eq('token', token).maybeSingle()
      if (!c) {
        await registrar({ tipo: 'verificacion', resultado: 'no_existe' })
        return json({ encontrado: false })
      }
      if (!dni) {
        await registrar({ tipo: 'verificacion', tenant_id: c.tenant_id, certificado_id: c.id, resultado: 'existe_sin_dni' })
        return json({ encontrado: true, requiere_dni: true })
      }
      if (await contar('verificacion', 10) >= TOPE_CONSULTAS_10MIN || await contar('verificacion', 24 * 60) >= TOPE_CONSULTAS_DIA) {
        await registrar({ tipo: 'verificacion', tenant_id: c.tenant_id, certificado_id: c.id, dni, resultado: 'tope_ip' })
        return json({ error: 'Demasiadas consultas desde esta conexión. Intente más tarde.' }, 429)
      }
      const dniTitular = normalizarDni(c.datos?.participante?.dni)
      if (!dniTitular || dniTitular !== dni) {
        await registrar({ tipo: 'verificacion', tenant_id: c.tenant_id, certificado_id: c.id, dni, resultado: 'dni_no_coincide' })
        return json({ encontrado: true, requiere_dni: true, dni_valido: false })
      }
      await registrar({ tipo: 'verificacion', tenant_id: c.tenant_id, certificado_id: c.id, dni, resultado: c.estado })
      return json({ encontrado: true, dni_valido: true, certificado: vistaCertificado(c) })
    }

    // ── consultar: portal por DNI ─────────────────────────────────────────
    if (body.accion === 'consultar') {
      const dni = normalizarDni(body.dni)
      if (!DNI_RE.test(dni)) return json({ error: 'Ingrese un DNI o carné válido' }, 400)
      if (await contar('consulta_dni', 10) >= TOPE_CONSULTAS_10MIN || await contar('consulta_dni', 24 * 60) >= TOPE_CONSULTAS_DIA) {
        await registrar({ tipo: 'consulta_dni', dni, resultado: 'tope_ip' })
        return json({ error: 'Demasiadas consultas desde esta conexión. Intente más tarde.' }, 429)
      }

      // Solo asistentes reales de capacitaciones no anuladas.
      const { data: parts } = await admin.from('capacitacion_participantes')
        .select(`id, tenant_id, dni, nombres, apellidos, cargo, institucion, asistio,
                 capacitacion:capacitaciones!inner(id, codigo, titulo, descripcion, temario, horas_total,
                   fecha_inicio, fecha_fin, lugar, ciudad, instructor_nombre, instructor_cargo,
                   entidad_beneficiaria, estado, proyecto:proyectos(codigo, nombre)),
                 certificado:certificados(id, codigo, token, estado, emitido_en, revocado_en, motivo_revocacion, datos, plantilla)`)
        .eq('dni', dni).eq('asistio', true)
        .neq('capacitacion.estado', 'anulada')
        .order('creado_en', { ascending: false })

      const filas = (parts ?? []) as any[]
      await registrar({ tipo: 'consulta_dni', dni, tenant_id: filas[0]?.tenant_id, resultado: filas.length ? `ok:${filas.length}` : 'sin_datos' })
      if (!filas.length) return json({ encontrado: false })

      const persona = filas[0]
      const capacitaciones = filas.map(p => {
        const cap = p.capacitacion
        const cert = Array.isArray(p.certificado) ? p.certificado[0] : p.certificado
        return {
          id: cap.id,
          codigo: cap.codigo,
          titulo: cap.titulo,
          descripcion: cap.descripcion,
          temario: cap.temario ?? [],
          horas_total: Number(cap.horas_total ?? 0),
          fecha_inicio: cap.fecha_inicio,
          fecha_fin: cap.fecha_fin,
          lugar: cap.lugar,
          ciudad: cap.ciudad,
          instructor_nombre: cap.instructor_nombre,
          instructor_cargo: cap.instructor_cargo,
          entidad_beneficiaria: cap.entidad_beneficiaria,
          proyecto: cap.proyecto ? { codigo: cap.proyecto.codigo, nombre: cap.proyecto.nombre } : null,
          cargo: p.cargo,
          institucion: p.institucion,
          certificado: cert ? vistaCertificado(cert) : null,
        }
      })
      return json({
        encontrado: true,
        persona: { nombres: persona.nombres, apellidos: persona.apellidos, dni_mascara: mascararDni(dni) },
        capacitaciones,
      })
    }

    // ── capacitacion: datos para el formulario de asistencia ──────────────
    if (body.accion === 'capacitacion') {
      const token = String(body.token ?? '').trim()
      if (!UUID_RE.test(token)) return json({ error: 'Enlace inválido' }, 400)
      const { data: cap } = await admin.from('capacitaciones')
        .select(`id, tenant_id, codigo, titulo, descripcion, temario, horas_total, fecha_inicio, fecha_fin,
                 lugar, ciudad, instructor_nombre, entidad_beneficiaria, estado, asistencia_abierta,
                 proyecto:proyectos(codigo, nombre),
                 plantilla:certificado_plantillas(consorcio_nombre, logo_url, color_primario, color_acento)`)
        .eq('asistencia_token', token).maybeSingle()
      await registrar({ tipo: 'formulario', tenant_id: cap?.tenant_id, capacitacion_id: cap?.id, resultado: cap ? (cap.asistencia_abierta ? 'abierta' : 'cerrada') : 'no_existe' })
      if (!cap) return json({ encontrado: false })
      const { count } = await admin.from('capacitacion_participantes')
        .select('id', { count: 'exact', head: true }).eq('capacitacion_id', cap.id).not('firmado_en', 'is', null)
      const c: any = cap
      return json({
        encontrado: true,
        abierta: c.asistencia_abierta && c.estado !== 'anulada' && c.estado !== 'cerrada',
        capacitacion: {
          codigo: c.codigo, titulo: c.titulo, descripcion: c.descripcion, temario: c.temario ?? [],
          horas_total: Number(c.horas_total ?? 0), fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin,
          lugar: c.lugar, ciudad: c.ciudad, instructor_nombre: c.instructor_nombre,
          entidad_beneficiaria: c.entidad_beneficiaria,
          proyecto: c.proyecto ? { codigo: c.proyecto.codigo, nombre: c.proyecto.nombre } : null,
          consorcio_nombre: c.plantilla?.consorcio_nombre ?? null,
          logo_url: c.plantilla?.logo_url ?? null,
          color_primario: c.plantilla?.color_primario ?? '#17364c',
          color_acento: c.plantilla?.color_acento ?? '#b28b45',
          firmados: count ?? 0,
        },
      })
    }

    // ── firmar: el participante registra asistencia y firma ───────────────
    if (body.accion === 'firmar') {
      const token = String(body.token ?? '').trim()
      if (!UUID_RE.test(token)) return json({ error: 'Enlace inválido' }, 400)
      const dni = normalizarDni(body.dni)
      const nombres = limpiar(body.nombres, 120)
      const apellidos = limpiar(body.apellidos, 120)
      const firma = String(body.firma ?? '')
      if (!DNI_RE.test(dni)) return json({ error: 'Ingrese un DNI o carné válido' }, 422)
      if (nombres.length < 2 || apellidos.length < 2) return json({ error: 'Ingrese nombres y apellidos' }, 422)
      if (!firma.startsWith('data:image/png;base64,')) return json({ error: 'Falta la firma' }, 422)
      if (firma.length > FIRMA_MAX_BYTES * 1.37) return json({ error: 'La firma es demasiado grande. Vuelva a firmar.' }, 422)
      const email = limpiar(body.email, 160).toLowerCase()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Correo inválido' }, 422)

      if (await contar('firma', 60) >= TOPE_FIRMAS_HORA) {
        await registrar({ tipo: 'firma', dni, resultado: 'tope_ip' })
        return json({ error: 'Demasiados registros desde esta conexión. Pida ayuda al instructor.' }, 429)
      }

      const { data: cap } = await admin.from('capacitaciones')
        .select('id, tenant_id, titulo, estado, asistencia_abierta')
        .eq('asistencia_token', token).maybeSingle()
      if (!cap) return json({ error: 'Enlace inválido' }, 404)
      if (!cap.asistencia_abierta || cap.estado === 'anulada' || cap.estado === 'cerrada') {
        await registrar({ tipo: 'firma', dni, tenant_id: cap.tenant_id, capacitacion_id: cap.id, resultado: 'cerrada' })
        return json({ error: 'El registro de asistencia de esta capacitación está cerrado.' }, 409)
      }

      // ¿Ya está en la lista? (precargado por el ERP o firmado antes)
      const { data: existente } = await admin.from('capacitacion_participantes')
        .select('id, firmado_en').eq('capacitacion_id', cap.id).eq('dni', dni).maybeSingle()

      if (existente?.firmado_en) {
        await registrar({ tipo: 'firma', dni, tenant_id: cap.tenant_id, capacitacion_id: cap.id, resultado: 'duplicado' })
        return json({ error: 'Ya registraste tu asistencia en esta capacitación.', ya_firmado: true }, 409)
      }

      const datos = {
        tenant_id: cap.tenant_id,
        capacitacion_id: cap.id,
        dni, nombres, apellidos,
        cargo: limpiar(body.cargo) || null,
        institucion: limpiar(body.institucion) || null,
        email: email || null,
        telefono: limpiar(body.telefono, 30) || null,
        firma_data_url: firma,
        firmado_en: new Date().toISOString(),
        firma_origen: 'enlace',
        firma_ip: ip,
        firma_user_agent: ua,
        asistio: true,
      }
      const r = existente
        ? await admin.from('capacitacion_participantes').update(datos).eq('id', existente.id).select('id').single()
        : await admin.from('capacitacion_participantes').insert(datos).select('id').single()
      if (r.error) {
        await registrar({ tipo: 'firma', dni, tenant_id: cap.tenant_id, capacitacion_id: cap.id, resultado: 'error:' + r.error.message })
        return json({ error: 'No se pudo guardar el registro. Intente de nuevo.' }, 500)
      }
      await registrar({ tipo: 'firma', dni, tenant_id: cap.tenant_id, capacitacion_id: cap.id, resultado: existente ? 'firmo_precargado' : 'nuevo' })
      return json({ ok: true, nombres, apellidos, capacitacion: cap.titulo })
    }

    return json({ error: 'Acción desconocida' }, 400)
  }),
}
