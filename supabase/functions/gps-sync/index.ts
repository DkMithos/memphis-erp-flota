import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEOSATELITAL_BASE = Deno.env.get('GEOSATELITAL_API_URL') ?? 'https://api.geosatelital.com/v1'
const GEOSATELITAL_KEY = Deno.env.get('GEOSATELITAL_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: syncLog } = await supabase
    .from('gps_sync_logs')
    .insert({ estado: 'en_proceso', iniciado_en: new Date().toISOString() })
    .select()
    .single()

  try {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('estado', 'activo')

    let totalProcesados = 0

    for (const tenant of (tenants ?? [])) {
      const { data: dispositivos } = await supabase
        .from('gps_dispositivos')
        .select('id, vehiculo_id, imei')
        .eq('tenant_id', tenant.id)
        .eq('estado', 'activo')

      if (!dispositivos?.length) continue

      const imeis = dispositivos.map((d: any) => d.imei).join(',')
      const resp = await fetch(`${GEOSATELITAL_BASE}/units/positions?imeis=${imeis}`, {
        headers: { 'Authorization': `Bearer ${GEOSATELITAL_KEY}` }
      })
      if (!resp.ok) continue

      const units: any[] = await resp.json()
      const posiciones = units
        .map((unit: any) => {
          const disp = dispositivos.find((d: any) => d.imei === unit.imei)
          if (!disp) return null
          return {
            tenant_id: tenant.id,
            vehiculo_id: disp.vehiculo_id,
            dispositivo_id: disp.id,
            latitud: unit.lat,
            longitud: unit.lng,
            velocidad: unit.speed,
            rumbo: unit.heading,
            altitud: unit.altitude,
            odometro: unit.odometer,
            ignicion: unit.ignition,
            evento: unit.event,
            bateria_voltaje: unit.battery_voltage,
            satelites: unit.satellites,
            precision_gps: unit.gps_accuracy,
            fecha_dispositivo: unit.timestamp,
          }
        })
        .filter(Boolean)

      if (posiciones.length) {
        await supabase.from('gps_posiciones').insert(posiciones)
        totalProcesados += posiciones.length
      }
    }

    await supabase
      .from('gps_sync_logs')
      .update({
        estado: 'exitoso',
        completado_en: new Date().toISOString(),
        registros_procesados: totalProcesados,
      })
      .eq('id', syncLog.id)

    return new Response(
      JSON.stringify({ ok: true, procesados: totalProcesados }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    await supabase
      .from('gps_sync_logs')
      .update({
        estado: 'error',
        completado_en: new Date().toISOString(),
        error_mensaje: String(err),
      })
      .eq('id', syncLog?.id)

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    )
  }
})
