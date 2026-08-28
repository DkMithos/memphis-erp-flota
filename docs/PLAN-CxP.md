# Plan de acción — Módulo de Cuentas por Pagar (CxP)

> Reemplaza los 5 Excel del flujo financiero (`BD TI 2026`, `BD CONTA 2026`,
> `Flujo Administración`, `Flujo de proyectos` y el consolidado `Flujo GM`).
> Instrucciones que lo gobiernan: **N29** (fuentes y hallazgos), **N30** (OC opcional,
> factura como ancla), **N31** (analizar → plan → ejecutar), **N32** (`invoice_exterior`),
> **N28** (alertas, por detallar).
>
> Estado: **PLAN — pendiente de revisión de Kevin.** Nada implementado todavía.

---

## 1. El problema que resuelve

Cuatro áreas llenan cada una su Excel y alguien los consolida a mano en `Flujo GM` para que
Gerencia decida qué pagar. Del análisis del 24–27/08:

- **Cada área marca la provisión con una convención propia e informal.** TI usa un texto en
  OBSERVACIONES; Administración inventa un CDC llamado `PROVISION`; Proyectos usa un proveedor
  ficticio `ESTIMADO`; Contabilidad no marca nada.
- **~S/54.5M de líneas futuras no están marcadas de ninguna forma** — se ven igual que una
  factura vencida que hay que pagar mañana.
- **La consolidación se desincroniza.** La copia de TI dentro de `Flujo GM` estaba desfasada en
  6 filas (S/34,623), y 5 de ellas eran justo las marcadas "Requiere VB" — lo único que
  necesitaba decisión de Gerencia era lo que no llegaba a Gerencia.
- **700 filas de Administración y 24 de Proyectos están digitadas a mano** solo para proyectar
  gastos recurrentes hacia adelante.

## 2. Volumen a migrar

| Fuente | Área que la llena | Líneas | Pendiente |
|---|---|---|---|
| `Flujo de proyectos.xlsx` › BASE DE DATOS | Operaciones | 1,393 (1,328 egresos + 65 ingresos) | S/49.44M |
| `Flujo Administración.xlsx` › BD ADMIN | Administración | 1,039 | S/31.27M |
| `BD CONTA 2026.xlsx` › BD CONTA | Contabilidad | 150 | S/11.49M |
| `BD TI 2026.xlsx` › BD TI | TI | 49 | S/47.5k |
| **Total** | | **2,631** | **S/92.25M** |

`Flujo GM.xlsx` **no es fuente**: contiene copias de las otras cuatro. No se migra.

## 3. Modelo de datos

### 3.1 Tabla principal — `cxp_compromisos`

Una fila = un compromiso de pago. Reemplaza las cuatro bases.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `tenant_id` | uuid | RLS multi-tenant, igual que el resto |
| `codigo` | text | correlativo propio, `CXP-NNNNNN` |
| `area` | text | `ti` · `contabilidad` · `administracion` · `operaciones` — dueño de la línea |
| `centro_costo_id` | uuid FK | los CDC ya existen en `centros_costo` |
| `proyecto_id` | uuid FK | derivado del CC por trigger, igual que `gastos_caja_chica` |
| `categoria` / `grupo` | text FK | catálogo consolidado: **15 grupos / 62 categorías** ([CxP-CDC-CATEGORIAS.md](CxP-CDC-CATEGORIAS.md) §2) |
| `concepto` | text | |
| `proveedor_id` | uuid FK | |
| `moneda` / `tipo_cambio` | text / numeric | |
| **`sentido`** | enum | **`pagar` / `cobrar`** — ver 6.1. Consultar siempre por las vistas `v_cxp` / `v_cxc` |
| `monto` | numeric | en su moneda, **siempre positivo** |
| `monto_soles` | numeric | calculado, para consolidar |
| `monto_presupuestado` | numeric | para el comparativo presupuesto vs ejecutado |
| **`origen`** | enum | **`real` · `comprometido` · `proyectado`** — ver 3.2 |
| **`estado_aprobacion`** | enum | `requiere_vb` · `aprobado` · `postergado` · `rechazado` |
| `estado_pago` | enum | `pendiente` · `pagado` · `parcial` · `saldo_a_favor` |
| `fecha_vencimiento` | date | |
| `mes_programado` | date | cuándo Gerencia decidió pagarlo |
| `veces_postergado` | int | se incrementa solo al mover `mes_programado` |
| **`momento`** | text FK a catálogo | criterio de holgura — ver 3.3 |
| `metodo_pago` / `dias_credito` | text / int | |
| `orden_compra_id` | uuid FK **nullable** | **N30: la OC es opcional** |
| `comprobante_id` | uuid FK | ancla documental (`comprobantes_pago`) |
| `detraccion_monto` / `retencion_monto` | numeric | vienen de BD ADMIN |
| `fecha_pago` / `monto_pagado` | date / numeric | |
| `observaciones` | text | |
| `recurrencia_id` | uuid FK nullable | si la generó una plantilla |
| `migrado_de` / `migrado_id` | text | idempotencia, igual que el resto de migraciones |

### 3.2 `origen` — el campo que hoy no existe

Es lo que permite separar deuda cierta de proyección. Tres valores excluyentes:

- **`real`** — tiene factura (o `invoice_exterior`). Deuda cierta.
- **`comprometido`** — hay OC o aprobación, todavía sin comprobante.
- **`proyectado`** — recurrencia o estimación. Aquí caen las 700 filas de Administración, las 24
  de INCAMOTOR en Proyectos, y **las de TI** (decisión de Kevin del 27/08: lo de TI es
  proyectado, no provisionado).

"Requiere VB" **no** es un origen: es un `estado_aprobacion`. Una línea puede ser
*proyectada + requiere VB* (TI) o *proyectada + aprobada* (los recurrentes de Administración).

Referencia del respaldo documental que tienen hoy los 1,328 egresos de Proyectos:

| Situación | Líneas | Monto |
|---|---|---|
| Con OC y con factura | 147 | S/14.09M |
| Con factura, sin OC | 282 | S/3.96M |
| Con OC, sin factura aún | 217 | S/33.41M |
| Sin ninguno | 685 | S/35.90M |

### 3.3 `momento` — el criterio real de Gerencia

Administración ya tiene este campo y funciona; hay que normalizarlo a catálogo y extenderlo a
las otras tres áreas (Proyectos, que es la que más mueve, **no lo tiene**).

| Momento | Líneas pendientes hoy | Monto |
|---|---|---|
| En el mes de vencimiento | 280 | S/28.04M |
| Cuando haya liquidez | 47 | S/2.69M |
| Puede esperar 2 meses o más | 94 | S/175k |
| Atado a CIPRL (Cusco, Huánuco) | 4 | S/202k |

### 3.4 `cxp_recurrencias`

Plantilla que **genera** las líneas proyectadas en vez de que alguien las digite:
proveedor, concepto, CC, monto, moneda, periodicidad, día de vencimiento, vigencia
(desde/hasta), `momento` y `estado_aprobacion` por defecto.

Reemplaza series como *Honorarios GM* (50 filas de S/38,043), *Caja Chica Oficina* (51 × S/5,000),
*Estudio Ugaz* (53 × S/300) e *INCAMOTOR* (24 × S/39,326 proyectadas hasta jul-2028).

Alimenta además las 62 obligaciones periódicas de la hoja `ADMI PERIOD.` (seguro de vida ley,
SISCONT, ITAN…) con su fecha de renovación.

### 3.5 Complementos

- **`invoice_exterior`** (N32) — nuevo tipo en `comprobantes_pago`: sin validación de CPE, sin
  IGV, sin detracción. Solo visualización, registro y seguimiento contable. Lo adjunta el equipo
  interno; los no domiciliados no usan el portal (N22).
- **Catálogo de categorías** — consolidado el 27/08: 116 originales → 15 grupos / 62 categorías,
  cada original conservado como alias. Ver [CxP-CDC-CATEGORIAS.md](CxP-CDC-CATEGORIAS.md) §2.
- **Equivalencias de CDC** — validadas el 27/08 contra los 76 `centros_costo`: 35 exactas,
  5 por tildes/espacios, 4 con equivalencia propuesta (`GCUZCOAMBU`→`GCUSCOAMBU`,
  `MPCUSCOPNP`→`MPCUSCOSERENAZGO`, `MSS`→`MSS-30`, `DATABASE`→`BASE DE DATOS`) y 4 CDC nuevos
  por aprobar. Ver §1 del mismo doc. **Falta que cada área las confirme.**

## 4. Lo que verá Gerencia

Las cuatro preguntas de Kevin, resueltas en una pantalla, con filtro por `origen` para separar
deuda cierta de proyección:

| Pregunta | Cómo se responde | Hoy |
|---|---|---|
| ¿Cuánto se debe? | suma de `estado_pago = pendiente` | S/92,247,283 |
| ¿Cuánto está vencido? | `fecha_vencimiento < hoy` | S/38,851,353 |
| ¿Cuánto vence este mes? | rango del mes en curso | S/697,173 |
| ¿Cuándo hay que pagar? | calendario por `fecha_vencimiento` | sep-26 concentra **S/25.5M** |
| ¿Cuánto se pagó? | `estado_pago = pagado` | S/46,395,726 |

Más: presupuestado vs ejecutado por proyecto y categoría (hoy en las hojas `RESUMEN PROYECTOS`),
KPI mensual de caja (hoja `KPI Mensual`: ingresos, egresos, flujo neto, acumulado, liquidez), y
la obligación OXI 10% por proyecto (hoja `Hoja3`: S/8.68M comprometidos, S/2.59M pagados).

## 5. Fases

| Fase | Qué | Depende de |
|---|---|---|
| **A** | Esquema: `cxp_compromisos`, `cxp_recurrencias`, catálogos, RLS, índices, trigger CC→proyecto | — |
| **B** | Migración de las 2,631 líneas con clasificación de `origen` | catálogo de categorías + equivalencias de CDC **validados por las áreas** |
| **C** | Pantalla por área (cargar, editar, marcar) + bandeja de aprobación "Requiere VB" | A |
| **D** | Tablero de Gerencia: los 5 indicadores + calendario + filtro por `origen` | B |
| **E** | Motor de recurrencias (genera las proyectadas y jubila las 700 filas manuales) | A, B |
| **F** | `invoice_exterior` + enlace factura↔compromiso | A |
| **G** | Alertas (N28) sobre vencimientos y aprobaciones pendientes | D, y que Kevin defina el alcance |
| **H** | Presupuesto vs ejecutado y KPI mensual | B |

Fase B es la que tiene el riesgo real: si las categorías y los CDC no están validados, la
migración clasifica mal desde el arranque y arrastra el error a todo lo demás.

## 6. Decisiones pendientes de Kevin

1. ~~**Equivalencias de CDC**~~ → **hecho (26/08)**: [CxP-CDC-CATEGORIAS.md](CxP-CDC-CATEGORIAS.md) §1.
   Quedan 4 CDC nuevos por aprobar y 2 duplicados internos del ERP por resolver.
2. ~~**Catálogo de categorías**~~ → **hecho (26/08)**: 116 originales → **15 grupos / 62
   categorías**, 0 sin clasificar, cada original conservado como alias. Ver §2 del mismo doc.
3. **Quién aprueba qué** — el `estado_aprobacion` necesita saber quién puede dar VB y sobre qué
   monto. **Kevin: vendrá en el archivo de usuarios y accesos** que está armando.
4. ~~**Ingresos**~~ → **decidido (26/08)**: NO van en `cxp_compromisos`. CIPRL y cobranzas a
   `valorizaciones_proyecto`; arrendamientos y cobros recurrentes a cuentas por cobrar usando
   **la misma tabla con un campo `sentido` (`pagar`/`cobrar`) + vistas `v_cxp` / `v_cxc`**;
   saldos bancarios fuera de ambas. Montos siempre en positivo. Ver §3 del mismo doc.
5. **Alcance de las alertas** (N28) — **se mantiene pendiente por decisión de Kevin**.

### 6.1 Efecto en el modelo

La decisión 4 agrega a `cxp_compromisos` un campo **`sentido`** (`pagar` / `cobrar`) y elimina la
convención de signo negativo del Excel: **todos los montos se guardan en positivo**. Las consultas
no tocan la tabla base, sino las vistas `v_cxp` y `v_cxc`, para que el filtro no se pueda olvidar.

## 7. Trampas conocidas de las fuentes

Encontradas durante el análisis; van al transform de la Fase B:

- **Ingresos en negativo** en la base de Proyectos (convención de flujo). Normalizar el signo.
- **`/DOLAR/i` no matchea "DÓLARES" ni "Dólares"** por el acento — usar `/D[OÓ]LAR/i`. Este error
  ya se coló dos veces en las cargas de caja chica.
- **Fechas basura**: vencimientos en `1899-12-30` (celdas vacías) y programaciones hasta `2031`.
- **Celdas OC con varios códigos**: `"MM-000338, MM-000339, MM-000340, MM-000341"`,
  `"MM-000568 - MM-000812"`, padding inconsistente (`MM-00290` vs `MM-000290`) y valores
  `"ANULADA"`.
- **Filas de totales con número de ítem** — mismo patrón que rompió el parser de caja chica.
- **Proveedores ficticios** usados como marcador: `ESTIMADO` (56 filas) y el CDC `PROVISION`.
  Ojo: **`PROVISIONES TECNOLOGICAS Y SERVICIOS S.A.C.` sí es un proveedor real** (PROV-0131,
  RUC 20604953236) — no confundirlo con un marcador.
