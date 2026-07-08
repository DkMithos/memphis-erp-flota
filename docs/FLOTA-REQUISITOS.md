# REDISEÑO MÓDULO FLOTA — Requisitos de Kevin (2026-07-08)

> Fuente: indicaciones directas de Kevin. Este documento es la especificación
> del rediseño. Complementa INSTRUCCIONES.md (N17) y CONTEXTO-SESION.md (FASE 5).

## 1. Modelo conceptual

- **Toda flota está amarrada a un proyecto.** Un proyecto puede tener 0, 1 o varias
  flotas, de distintos tipos (buses, motos, camionetas, ambulancias, etc.) y con
  distintos tipos de vehículos.
- **Cada tipo de flota maneja su propio contrato de mantenimientos.**
- **Vehículos administrativos**: unidades a nombre de Memphis Maquinarias (dueños,
  socios, gerentes) que NO pertenecen a ningún proyecto. Son la excepción al punto 1.

## 2. Contratos de mantenimiento (por flota)

- Cobertura por **tiempo O kilometraje, lo que ocurra primero** (ej.: 2 años o
  100,000 km).
- **Intervalo de servicio** (ej.: cada 5,000 km) → cantidad total de mantenimientos
  contratados = km contratados / intervalo (100,000/5,000 = 20).
- Memphis ejecuta los mantenimientos en **concesionarias o talleres aprobados**.
- Modalidades de pago reales:
  - **Pago total adelantado** a la firma del contrato (ej.: 200 motos pagadas al 100%).
  - **Pago mensual** según mantenimientos realmente ejecutados en el mes.
- **Regla de análisis (siempre):** se PROVISIONA como si se pagara la totalidad, y se
  compara contra lo real ejecutado. Lo no ejecutado (vehículos que no van al taller o
  no recorren) es **ahorro / rentabilidad** para la empresa.
- Por **vehículo** se debe conocer el consumo de su presupuesto:
  - **En precio:** total provisionado por vehículo − gastado acumulado.
  - **En cantidad:** mantenimientos realizados de N contratados (ej.: 7 de 20).
- Comparativa de ahorro **mensual o por criterio definido** a nivel flota/proyecto.

## 3. Vehículos

- **Registro inicial con VIN** (obligatorio); la **placa llega después** (el trámite
  demora) y se actualiza. Un vehículo sin placa es válido.
- **Carga masiva de vehículos** (imprescindible).
- **Carga masiva de mantenimientos** (imprescindible).
- El equipo de Operaciones lleva el control en **un Excel** (vehículos por tipo de
  flota, proyecto, etc.) → fuente para modelar y migrar. **PENDIENTE: Kevin comparte
  el archivo.**

## 4. Documentación vehicular

- **NO se sube documentación** (archivos) — solo seguimiento de datos.
- **Vehículos administrativos** (sin proyecto): seguimiento completo con vencimientos
  y alertas — multas, papeletas, seguro, SOAT, TIVe, etc.
- **Vehículos de proyecto**: solo saber si cuenta con SOAT y por cuánto tiempo, y si
  cuenta con seguro y por cuánto tiempo. **Sin fechas de vencimiento estrictas ni
  alertas.**

## 5. Lo que se ELIMINA del módulo actual

- Monitoreo **GPS** (módulo completo).
- **Análisis preventivo**.
- **Reportes**: de vehículos, de mantenimientos, de documentos, costos por vehículo.
- **Órdenes de trabajo** (no se gestionan OTs).
- Estados operativos (operativo / en taller / activo / inactivo) — no interesan.
- Top de fallas, top de piezas usadas — no se registra esa información.

## 6. Estado actual de los datos (auditado 2026-07-08)

- `vehiculos`: 386 (todos con proyecto_id; columnas plan_preventivo_*/contrato_* de un
  modelo previo a nivel vehículo).
- `ordenes_trabajo`: 433, **100% enlazadas** a 50 vehículos distintos (el "no enlace"
  que ve Kevin es de visualización, no de datos).
- `vehiculo_documentos`: 200 · `flota_vehiculos`: 1 · `flota_mantenimientos`: 0.
- GPS: 0 dispositivos, 0 logs (nunca se usó en producción).
- **Backup pre-rediseño:** `backups/flota-2026-07-08/` (10 tablas, JSON completo).

## 7. Transversales acordados

- **IA embebida**: asistente que resuelva consultas/preguntas de cualquier usuario del
  sistema (requiere API key de Claude; integración vía Edge Function).
- **Roles**: después del rediseño se define quién ve y hace qué.
- **Agentes de desarrollo**: definidos en `.claude/agents/` (tooling local, gitignored).

## 8. Respuestas de Kevin (2026-07-08)

1. **Fuente de datos**: carpeta OneDrive `Operaciones Teams - General/GOBIERNO REGIONAL
   ICA OPERACIONES POSTVENTA/` — control de mantenimientos, contratos, planes con
   precios, kilometrajes, placas.
2. **Costo por mantenimiento VARÍA según el km** — el plan con precios está en la
   carpeta (Perumotor camionetas / Promotora motos). → tabla `flota_contrato_tarifas`.
3. **QR público SE MANTIENE pero cambia**: ya NO muestra documentación; solo información
   básica del vehículo + cumplimiento de mantenimientos + último mantenimiento
   (fecha y kilometraje).
4. **La data actual del ERP NO es real** — la fuente de verdad son los archivos de la
   carpeta (se re-migra desde ahí).
5. **API key de Claude: sí** — Kevin la conseguirá (pendiente de entrega).

## 9. Análisis de la carpeta de Operaciones (2026-07-08)

Proyecto **GORE ICA (ICAPNP24)** — 2 flotas:

| | Camionetas | Motos |
|---|---|---|
| Unidades | 50 Mitsubishi L200 2025 | 200 (175 con servicios registrados) |
| Concesionaria/taller | Perumotor (+ talleres por provincia) | Promotora Genesis (STA: Importaciones…, Arife) |
| Plan | cada 5,000 km hasta 120,000 (1,000 km gratis) | 1º a 500 km, luego cada 2,500 hasta 60,000 |
| Moneda | USD (TC provisión 3.7) | PEN |
| Costo/servicio | $222.66–$559.04 según km | S/150–S/466.84 según km |
| Total por vehículo | $8,647.74 (con IGV) | S/8,245.06 (25 servicios) |
| Modalidad de pago | mensual (según ejecutados) | **adelantado: S/1,649,011.20 PAGADO** |
| Provisión mensual | S/21,426.86 | según plan mensual (hoja PLAN PROMOTORA) |
| Histórico ejecutado | 222 servicios / 48 unidades (con OC MM- y factura) | 528 servicios / 175 unidades |
| Identificación | PLACA INTERNA (KN-), PLACA RODAJE (EPI-), SERIE=VIN | Padrón interno + VIN (muchas sin placa) |

Archivos clave: `Control de Mantenimientos Motos - Camioneta.xlsx` (BD MOTOS, PLAN
PROMOTORA, historicomnto, EJECUTADO), `50 CAMIONETAS PLACAS.xlsx`, `CAMIONETA
MANTENIMIENTO PREVENTIVO/CONTROL DE MANTENIMIENTO CAMIONETAS ICA.xlsx` (PRINCIPAL:
programación por promedio km/día), `PLAN DE MANTENIMIENTOS/Contrato Perumotor ANEXO 1
… con costos.xlsx` (tarifario), `MOTOS …/km acumulado flota GORE ICA.xlsx`.

## 10. Modelo de datos aplicado (migración `flota_rediseno_esquema`, 2026-07-08)

- `flotas` (proyecto_id NOT NULL, tipo, código único por tenant)
- `flota_contratos` (proveedor, moneda+TC, duración/km límite, cantidad_servicios,
  costo_total_por_vehiculo, modalidad adelantado|mensual, monto_pagado)
- `flota_contrato_tarifas` (orden, km_servicio, mes_estimado, costo) ← plan con precios
- `vehiculos` + columnas: flota_id, placa_interna, es_administrativo, tiene_soat/
  soat_vigencia, tiene_seguro/seguro_vigencia (flota_id NULL + es_administrativo=true
  → vehículo administrativo)
- `vehiculo_mantenimientos` (km_servicio, km_odometro, fechas, estado, taller, costo,
  oc_numero, factura, origen) ← reemplaza OTs para flota
- `vehiculo_admin_eventos` (soat|seguro|tive|revision_tecnica|multa|papeleta, fechas,
  vencimiento, alerta_dias) ← SOLO administrativos
- `vehiculo_km_lecturas` (bitácora odómetro → promedio km/día → proyección de cita)
- Vista `v_vehiculo_consumo`: servicios contratados vs ejecutados, provisión vs gastado,
  saldo — la base del "cuánto va ahorrando".
- RLS initplan en todas; índices FK; todo verificado con advisors (sin hallazgos nuevos).
