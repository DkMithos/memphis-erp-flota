-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260803135047  name: flota_mantos_qr_fase_b_proyeccion

-- FLOTA · Mantenimientos QR — Fase B: motor de proyección del próximo servicio.
-- Por cada vehículo de flota: odómetro actual, promedio km/día, próximo km del plan
-- (menor tarifa > odómetro y aún no programada/ejecutada), km faltante, fecha proyectada y costo.
CREATE OR REPLACE VIEW v_flota_proximo_servicio
WITH (security_invoker = true) AS
WITH odo AS (
  SELECT v.id AS vehiculo_id, v.tenant_id, v.flota_id, v.codigo, v.placa, v.vin,
    v.numero_padron, v.tipo,
    COALESCE(
      (SELECT l.km FROM vehiculo_km_lecturas l WHERE l.vehiculo_id = v.id
         ORDER BY l.fecha DESC, l.creado_en DESC LIMIT 1),
      v.kilometraje, 0)::numeric AS odometro
  FROM vehiculos v
  WHERE v.flota_id IS NOT NULL AND v.estado = 'activo'
),
prom AS (
  SELECT vehiculo_id,
    CASE WHEN count(*) >= 2 AND max(fecha) > min(fecha)
      THEN round((max(km) - min(km)) / GREATEST(1, (max(fecha) - min(fecha)))::numeric, 2)
      ELSE NULL END AS km_dia
  FROM vehiculo_km_lecturas GROUP BY vehiculo_id
),
prox AS (
  SELECT o.vehiculo_id, o.flota_id,
    t.km_servicio AS proximo_km, t.costo AS proximo_costo, fc.moneda,
    row_number() OVER (PARTITION BY o.vehiculo_id ORDER BY t.km_servicio ASC) AS rn
  FROM odo o
  JOIN flotas f ON f.id = o.flota_id
  JOIN flota_contratos fc ON fc.flota_id = f.id AND fc.estado = 'activo'
  JOIN flota_contrato_tarifas t ON t.contrato_id = fc.id AND t.km_servicio > o.odometro
  -- excluir el servicio si ya hay una cita programada o ejecutada para ese km
  WHERE NOT EXISTS (
    SELECT 1 FROM vehiculo_mantenimientos m
    WHERE m.vehiculo_id = o.vehiculo_id AND m.km_servicio = t.km_servicio
      AND m.estado IN ('programado','registrado_taller','pendiente_aprobacion','confirmado','ejecutado')
  )
)
SELECT
  o.vehiculo_id, o.tenant_id, o.flota_id, f.taller_id,
  o.codigo, o.placa, o.vin, o.numero_padron, o.tipo,
  round(o.odometro)::int AS odometro,
  p.km_dia AS promedio_km_dia,
  px.proximo_km,
  (px.proximo_km - o.odometro)::int AS km_faltante,
  px.proximo_costo,
  px.moneda,
  CASE WHEN p.km_dia IS NOT NULL AND p.km_dia > 0
    THEN (CURRENT_DATE + CEIL((px.proximo_km - o.odometro) / p.km_dia)::int)
    ELSE NULL END AS fecha_proyectada
FROM odo o
JOIN flotas f ON f.id = o.flota_id
LEFT JOIN prom p ON p.vehiculo_id = o.vehiculo_id
LEFT JOIN prox px ON px.vehiculo_id = o.vehiculo_id AND px.rn = 1;
