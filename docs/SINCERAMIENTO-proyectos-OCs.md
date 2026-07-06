# Sinceramiento de datos, cálculos y lógica — Proyectos y OCs

Fecha: 2026-06-30
Fuentes: `OCs_por_proyecto_revision.xlsx` (revisado por operaciones) y `RESUMEN PROYECTOS.xlsx` (hoja STATUS DE PROYECTOS + hojas por proyecto).
Alcance: NO push / NO deploy. Cambios aplicados en DB Supabase (tenant Memphis `e4b16a80-8500-418e-afaa-0e976b7d9b13`) + frontend local.

---

## 1. Correcciones de OCs (cierre del "gasto inflado")

La revisión del Excel concluyó que los **493 "posibles duplicados" de ICA eran legítimos** (no duplicados). El único ajuste real fue en AMAZONAS:

| OC | Antes | Acción | Motivo (Excel) |
|----|-------|--------|----------------|
| MM-000278 | aprobada, USD 1,519,600 | **anulada** | Duplicado oc-excel-2024 (marca X) |
| MM-000279 | aprobada, USD 79,990 | **anulada** | Duplicado oc-excel-2024 (marca X) |
| MM-000289 | AMAZONAS, USD 1,519,600 | **reasignada → CUSCO PNP** (centro `GCUSCOPNP`) | Vehículos reasignados a otro proyecto |
| MM-000766 | ya anulada | — | Confirmada anulada |

Efecto: AMAZONAS bajó de gasto ~S/25M a **S/12.7M** (TC 3.40). Con su contrato S/12.26M queda en **−3.6% de margen** (proyecto realmente ajustado/negativo, no un artefacto). El gasto se reasignó correctamente a CUSCO PNP vía trigger `trg_oc_proyecto`.

---

## 2. Tipo de cambio por orden (lógica de conversión USD→PEN)

**Decisión:** el TC debe ser el del **día de emisión** de la orden (SBS/SUNAT). Mientras no exista esa integración, se usa **TC por orden** (fallback).

- Nueva columna `ordenes_compra.tipo_cambio numeric` (canónica).
- Migrados poblados desde el Excel: **724 USD @ 3.40 + 3 USD @ 3.45**. PEN = NULL.
- La función SQL y el cálculo del frontend convierten USD con `coalesce(tipo_cambio, 3.40)`.
- Antes el ERP usaba un TC global **3.75** → inflaba ~10% el gasto USD. Ahora 3.40 por orden.

### Pendiente (siguiente paso backend)
Integrar **API SBS/SUNAT** para resolver el TC por fecha de emisión y escribirlo en `tipo_cambio` al crear cada OC nueva. Cuando exista, se puede backfillear cada OC por su `fecha_emision`.

---

## 3. Sinceramiento de financieros de proyectos (vs RESUMEN PROYECTOS)

Columnas nuevas en `proyectos`: `fecha_firma_convenio`, `codigo_inversion` (CIU/CUI), `monto_cobrado`, `fase`, `situacion`.

**Códigos recodificados** para reflejar el **año del convenio** (igual a los códigos de operaciones):

| Código nuevo | Proyecto | CIU | Convenio | Inv. Inicial | Valor Modificado | Cobrado | Fase | Situación |
|---|---|---|---|---:|---:|---:|---|---|
| 01CUSMUN24 | MP CUSCO - SERENAZGO | 2619427 | 2024-11-11 | 7,082,152.66 | 7,154,695.91 | 6,009,107.76 | ejecucion | revision_estado |
| 02CUSAMB25 | GORE CUSCO - AMBULANCIAS | 2648922 | 2025-03-17 | 36,153,270.35 | 36,153,270.35 | 0 | ejecucion | revision_estado |
| 03HNCPNP25 | GORE HUÁNUCO - PNP | 2623368 | 2025-06-09 | 6,427,787.00 | 6,877,435.41 | 4,726,500 | ejecucion | revision_estado |
| 04LORBOM25 | GORE LORETO - BOMBEROS | 2652192 | 2025-06-15 | **43,865,818.59** | 43,865,818.59 | 16,543,724.49 | ejecucion | activo |
| 05AMAPNP25 | GORE AMAZONAS - PNP | 2671067 | 2025-07-08 | 11,747,000.00 | 12,263,532.93 | 0 | ejecucion | activo |
| 06CUSPNP25 | GORE CUSCO - PNP | 2596176 | 2025-07-15 | 9,212,261.58 | 12,675,740.38 | 9,563,294.99 | ejecucion | suspension |
| 07CUSHAM26 | GORE CUSCO - HIDROAMBULANCIAS | 2603112 | 2026-01-26 | 2,322,373.33 | 2,322,373.33 | 0 | ejecucion | activo |
| ICAPNP | GORE ICA - PNP | *(pend.)* | *(pend.)* | 23,169,168.00 | 21,878,020.50 | *(pend.)* | post_ejecucion | liquidacion |

Corrección clave: **LORETO** contrato 43,840,000 → **43,865,818.59** (valor real).

**Proyectos del pipeline creados** (para poblar los buckets):
- `SMARTMOVS` GORE SAN MARTIN - MOVIL SALUD — fase **idea**
- `LORMOVS` GORE LORETO - MOVIL SALUD — fase **idea**
- `SMARTBOM` GORE SAN MARTIN - BOMBEROS — fase **actos_previos**

### Pendiente ICA
ICA no está en RESUMEN PROYECTOS (no tiene hoja). Faltan **convenio, CIU y monto_cobrado**. Por sus OCs, el gasto arranca en **2024** → la cohorte probable es 2024 (código sugerido `00ICAPNP24` o similar, a confirmar).

---

## 4. Taxonomía: fase (bucket macro) + situación (estado operativo)

Dos niveles, según pedido ("ambos niveles"):

- **fase** (caja/box): `idea` → `actos_previos` → `ejecucion` → `post_ejecucion`.
- **situacion** (salud operativa): `activo`, `suspension`, `revision_estado`, `arbitraje`, `plazo_vencido`, `liquidacion`, `observado`.

`estado` (columna previa) se mantiene coherente (en_ejecucion / liquidacion / planificacion) para compatibilidad.

---

## 5. Cálculos (definiciones sinceradas)

- **Contrato Total** = `monto_contrato` (inversión inicial) + `monto_adenda` (valor del documento equivalente; puede ser **negativo**, p.ej. ICA −1,291,147.50). = Valor Modificado.
- **Gasto Real (operativo)** = Σ OCs (estados aprobada/en_ejecucion/completada/recibida, **excluye anuladas**) + Σ Caja Chica aprobada. **NUNCA OTs.** USD→PEN con TC por orden.
- **Utilidad** = Contrato Total − Gasto Real.
- **Margen** = Utilidad / Contrato Total.
- **Cobrado / Pendiente x Cobrar** = `monto_cobrado` / (Contrato Total − Cobrado).
- **Saldo disponible (presupuestal)** = Presupuesto (techo) − Gasto Real.
- **% Ejecutado** = Gasto Real / Presupuesto.
- **Gastos Fijos de Asesoría** (Consultoría 10% + Contraprestación 5% + Venta CIPRL 4% + IR 3.5% sobre Contrato Total): bloque aparte, **no** descuentan la utilidad operativa.

### Vista por año ("ambos")
- **Cohorte (año de convenio):** agrupa utilidad/contrato/gasto del proyecto por el año de firma del convenio (24/25/26). Función `proyectos_financiero_resumen` expone `anio_convenio`.
- **Calendario (año del gasto):** reparte el gasto real por la fecha de cada OC/caja. Función nueva `proyectos_gasto_por_anio(tenant)`.

---

## 6. Objetos SQL

- `ordenes_compra.tipo_cambio` (columna).
- `proyectos`: `fecha_firma_convenio`, `codigo_inversion`, `monto_cobrado`, `fase`, `situacion` (+ checks de fase/situacion).
- `proyectos_financiero_resumen(uuid)` — reescrita: TC por orden, `anio_convenio`, `monto_cobrado`, `monto_pendiente_cobro`.
- `proyectos_gasto_por_anio(uuid)` — nueva: gasto por año calendario (OCs + caja).

## 7. Frontend

- `proyectos-store.tsx`: mapea `fase`, `situacion`, `fechaFirmaConvenio`, `anioConvenio`, `codigoInversion`, `montoCobrado`.
- `proyecto-financiero.ts`: TC default 3.40 + **TC por orden**; añade `montoCobrado`, `montoPendienteCobro`, `anioConvenio`.
- `ProyectosPanorama.tsx`: 3 vistas — **Por Fase** (buckets + situación), **Por Año** (cohorte convenio + gasto calendario), **Tabla**. KPIs: contratado, gasto, utilidad, cobrado, pendiente x cobrar, en riesgo.
- `Proyecto360.tsx`: pasa cobrado/año al cálculo (TC alineado con la función SQL).

---

## 8. Próximos pasos (acordados, NO iniciados)

1. Integración **TC SBS/SUNAT por fecha** (backend) + backfill por `fecha_emision`.
2. Confirmar **ICA**: convenio, CIU, monto_cobrado, código definitivo.
3. **Migración de requerimientos y cotizaciones** desde oc-system.
4. **Rediseño del módulo de Flota** + sinceramiento de datos de flota.
