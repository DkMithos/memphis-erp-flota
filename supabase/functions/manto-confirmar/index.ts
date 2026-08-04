// Flota · Fase C — Confirmación de mantenimiento por el TALLER (anti-fraude).
// La ejecuta un taller autenticado (JWT app_metadata.tipo='taller'). Toda la
// validación anti-fraude y el costeo viven en el backend; el taller NUNCA recibe
// el costo (N25). Fotos + km del odómetro son obligatorios.
//
// Reglas (§3 del flujo):
//   1. El vehículo pertenece a una flota (flota_id no nulo) — si no, rechazo duro.
//   2. El taller logueado es el taller fijo de esa flota — si no, rechazo.
//   3. ¿Hay cita 'programado' para HOY? Sí → 'registrado_taller' (camino feliz).
//      No → excepción: se acepta SOLO si el km del odómetro corresponde a un
//      servicio del plan pendiente → 'pendiente_aprobacion' (requiere Memphis).
import { withSupabase } from 'npm:@supabase/server';

interface Body {
  vehiculo_token?: string; // del QR
  placa?: string;          // fallback manual
  manto_id?: string;       // cuando el taller elige de su lista
  km_odometro?: number;
  fotos?: string[];        // base64 (data URL o crudo)
  observaciones?: string;
}

const BUCKET = 'evidencias-mantenimiento';
const TOLERANCIA_KM = 500; // puede llegar hasta 500 km antes del servicio del plan
const ESTADOS_OCUPA = ['programado', 'registrado_taller', 'pendiente_aprobacion', 'confirmado', 'ejecutado'];

const hoyISO = () => new Date().toISOString().slice(0, 10);

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });

    // 0. El llamador debe ser un TALLER autenticado
    const { data: userRes } = await ctx.supabase.auth.getUser();
    const meta = userRes?.user?.app_metadata ?? {};
    const tallerId = meta.taller_id as string | undefined;
    if (meta.tipo !== 'taller' || !tallerId) {
      return Response.json({ error: 'Solo un taller autenticado puede registrar mantenimientos' }, { status: 403 });
    }

    let body: Body;
    try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

    const km = Number(body.km_odometro);
    if (!Number.isFinite(km) || km < 0) {
      return Response.json({ error: 'Ingrese el kilometraje del odómetro' }, { status: 422 });
    }
    const fotos = (body.fotos ?? []).filter(Boolean);
    if (fotos.length === 0) {
      return Response.json({ error: 'Adjunte al menos una foto de evidencia' }, { status: 422 });
    }

    const admin = ctx.supabaseAdmin;

    // Datos del taller (tenant para scoping y rutas de fotos)
    const { data: taller } = await admin.from('talleres')
      .select('id, tenant_id, nombre').eq('id', tallerId).maybeSingle();
    if (!taller) return Response.json({ error: 'Taller no encontrado' }, { status: 404 });

    // 1. Resolver vehículo (por manto elegido, por token del QR, o por placa)
    let vehiculo: any = null;
    let citaExistente: any = null;
    if (body.manto_id) {
      const { data: m } = await admin.from('vehiculo_mantenimientos').select('*').eq('id', body.manto_id).maybeSingle();
      citaExistente = m ?? null;
      if (m) {
        const { data: v } = await admin.from('vehiculos')
          .select('id, tenant_id, flota_id, placa, codigo, kilometraje').eq('id', m.vehiculo_id).maybeSingle();
        vehiculo = v;
      }
    } else if (body.vehiculo_token) {
      const { data: v } = await admin.from('vehiculos')
        .select('id, tenant_id, flota_id, placa, codigo, kilometraje').eq('public_token', body.vehiculo_token).maybeSingle();
      vehiculo = v;
    } else if (body.placa) {
      const { data: v } = await admin.from('vehiculos')
        .select('id, tenant_id, flota_id, placa, codigo, kilometraje')
        .eq('tenant_id', taller.tenant_id).ilike('placa', body.placa.trim()).maybeSingle();
      vehiculo = v;
    }
    if (!vehiculo) return Response.json({ error: 'No se encontró el vehículo. Revisa el QR o la placa.' }, { status: 404 });

    // No permitir re-registrar una cita ya atendida
    if (citaExistente && citaExistente.estado !== 'programado') {
      return Response.json({ error: 'Esta cita ya fue registrada anteriormente.' }, { status: 409 });
    }

    // REGLA 1 — vehículo con flota
    if (!vehiculo.flota_id) {
      return Response.json({ error: 'Este vehículo no pertenece a ninguna flota gestionada por Memphis. No se puede registrar.' }, { status: 422 });
    }
    if (vehiculo.tenant_id !== taller.tenant_id) {
      return Response.json({ error: 'Este vehículo corresponde a otra organización.' }, { status: 422 });
    }

    // REGLA 2 — el taller de la flota == taller logueado
    const { data: flota } = await admin.from('flotas')
      .select('id, taller_id, nombre').eq('id', vehiculo.flota_id).maybeSingle();
    if (!flota || flota.taller_id !== tallerId) {
      return Response.json({ error: 'Este vehículo corresponde a otro taller.' }, { status: 422 });
    }

    // Contrato activo + tarifas (costeo y servicios pendientes)
    const { data: contrato } = await admin.from('flota_contratos')
      .select('id, moneda, flota_contrato_tarifas(km_servicio, costo)')
      .eq('flota_id', flota.id).eq('estado', 'activo').maybeSingle();
    const tarifas = ((contrato?.flota_contrato_tarifas ?? []) as any[])
      .slice().sort((a, b) => a.km_servicio - b.km_servicio);

    // Mantos del vehículo (para cita de hoy y servicios ocupados)
    const { data: mantosVeh } = await admin.from('vehiculo_mantenimientos')
      .select('id, km_servicio, estado, fecha_programada, costo').eq('vehiculo_id', vehiculo.id);
    const ocupados = new Set((mantosVeh ?? [])
      .filter((m) => ESTADOS_OCUPA.includes(m.estado)).map((m) => m.km_servicio));

    // REGLA 3 — ¿cita 'programado' para HOY?
    const hoy = hoyISO();
    let cita = (mantosVeh ?? []).find((m) => m.estado === 'programado' && m.fecha_programada === hoy) ?? null;
    if (citaExistente && citaExistente.estado === 'programado') cita = citaExistente;

    // Subir fotos (una sola vez, ruta con tenant al inicio para la policy de storage)
    const stamp = Date.now();
    const rutas: string[] = [];
    for (let i = 0; i < fotos.length; i++) {
      const bytes = decodeBase64(fotos[i]);
      const path = `${taller.tenant_id}/${vehiculo.id}/${stamp}-${i}.jpg`;
      const { error: upErr } = await admin.storage.from(BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (!upErr) rutas.push(path);
    }
    if (rutas.length === 0) {
      return Response.json({ error: 'No se pudieron guardar las fotos. Reintente.' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    let mantoId: string;
    let estadoFinal: string;
    let requiereAprob: boolean;
    let kmServicio: number | null;
    let costo: number | null;

    if (cita) {
      // ── Camino feliz ──
      estadoFinal = 'registrado_taller';
      requiereAprob = false;
      kmServicio = cita.km_servicio;
      costo = cita.costo ?? tarifas.find((t) => t.km_servicio === cita.km_servicio)?.costo ?? null;
      mantoId = cita.id;
      const kmSig = tarifas.find((t) => t.km_servicio > (kmServicio ?? 0))?.km_servicio ?? null;
      const { error: updErr } = await admin.from('vehiculo_mantenimientos').update({
        estado: estadoFinal, km_odometro: km, fecha_ejecucion: hoy,
        confirmado_por_taller: true, confirmado_taller_en: nowIso, requiere_aprobacion: false,
        fotos: rutas, observaciones: body.observaciones ?? null, costo,
        km_proyectado_siguiente: kmSig,
      }).eq('id', mantoId);
      if (updErr) return Response.json({ error: `No se pudo registrar: ${updErr.message}` }, { status: 500 });
    } else {
      // ── Excepción: el km debe corresponder a un servicio pendiente ──
      const pendientes = tarifas.filter((t) => !ocupados.has(t.km_servicio));
      const match = pendientes.find((t) => km >= t.km_servicio - TOLERANCIA_KM);
      if (!match) {
        return Response.json({ error: 'El kilometraje no corresponde a ningún servicio del plan pendiente. No se puede registrar sin cita.' }, { status: 422 });
      }
      estadoFinal = 'pendiente_aprobacion';
      requiereAprob = true;
      kmServicio = match.km_servicio;
      costo = match.costo ?? null;
      const kmSig = tarifas.find((t) => t.km_servicio > (kmServicio ?? 0))?.km_servicio ?? null;
      const { data: nuevo, error: insErr } = await admin.from('vehiculo_mantenimientos').insert({
        tenant_id: taller.tenant_id, vehiculo_id: vehiculo.id, contrato_id: contrato?.id ?? null,
        taller_id: tallerId, km_servicio: kmServicio, fecha_programada: hoy, fecha_ejecucion: hoy,
        estado: estadoFinal, origen: 'taller', costo, moneda: contrato?.moneda ?? 'PEN',
        km_odometro: km, confirmado_por_taller: true, confirmado_taller_en: nowIso,
        requiere_aprobacion: true, fotos: rutas, observaciones: body.observaciones ?? null,
        km_proyectado_siguiente: kmSig,
      }).select('id').single();
      if (insErr) return Response.json({ error: `No se pudo registrar: ${insErr.message}` }, { status: 500 });
      mantoId = nuevo.id;
    }

    // Lectura de km → alimenta la proyección; sube el odómetro del vehículo si aplica
    await admin.from('vehiculo_km_lecturas').insert({
      tenant_id: taller.tenant_id, vehiculo_id: vehiculo.id, fecha: hoy, km, fuente: 'mantenimiento',
    });
    if (km > (vehiculo.kilometraje ?? 0)) {
      await admin.from('vehiculos').update({ kilometraje: Math.round(km) }).eq('id', vehiculo.id);
    }

    // Respuesta SIN costo (N25)
    return Response.json({
      ok: true,
      manto_id: mantoId,
      estado: estadoFinal,
      requiere_aprobacion: requiereAprob,
      vehiculo: vehiculo.placa ?? vehiculo.codigo,
      km_servicio: kmServicio,
      mensaje: requiereAprob
        ? 'Registro recibido. Queda PENDIENTE DE APROBACIÓN de Memphis (no había cita programada para hoy).'
        : 'Mantenimiento registrado. Memphis confirmará y cerrará el servicio.',
    });
  }),
};
