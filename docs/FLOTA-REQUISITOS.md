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

## 8. Preguntas abiertas para Kevin

1. **Excel de Operaciones**: compartir el archivo de control de flota (y el formato en
   que registran mantenimientos) para modelar campos exactos y migrar.
2. **Costo por mantenimiento**: ¿es un precio fijo por servicio (costo_total/N) o varía
   según el tipo de servicio (5k vs 20k suelen costar distinto en concesionaria)?
3. **QR público de vehículos**: ¿se mantiene o también se elimina con el rediseño?
4. **Data actual**: ¿los 386 vehículos y 433 mantenimientos migrados son fieles, o se
   re-migra todo desde el Excel de Operaciones como fuente de verdad?
5. **API key de Claude** (Anthropic) para la IA embebida.
