# AUDITORÍA — ¿Puede el ERP responder "Proyecto 360" y "qué pagar cada mes"?

> Fecha: **2026-09-23**. Pedido de Gerencia (vía Kevin): al elegir un proyecto, ver el presupuesto que
> tuvo, lo que se va gastando, lo que falta por gastar, lo facturado, lo pagado, lo recepcionado, lo que
> queda en inventario, cómo va contablemente y si es rentable; y además saber **qué se debe pagar cada
> mes**. Objetivo de fondo: *que todos los módulos conversen y no estén individualizados.*
>
> Método: auditoría del **modelo** (columnas y enlaces reales en producción, proyecto `icmuqwgrjgjoebnwunnf`,
> tenant Memphis), de la **data** (cuánto está realmente enlazado) y del **código** (qué calcula y muestra cada
> pantalla, con `archivo:línea`). Nada se modificó.

---

## Veredicto en una línea

El modelo de datos soporta ~80 % de la cadena, pero **la data se corta en "OC aprobada"** (0 recepciones,
0 facturas de proveedor, 0 pagos, 0 asientos, 0 inventario en el ERP: todo eso vive aún en Excel o no se
registra) y hay **cinco correcciones de cálculo** que deben hacerse *antes* de encender los eslabones
siguientes, porque hoy están silenciosas y empezarían a dar cifras erradas apenas entre data.

---

## 1. Tabla resumen

| # | Pregunta | Responde hoy | Modelo (base) | Data real | Qué falta |
|---|---|---|---|---|---|
| 1 | Presupuesto que tuvo | **PARCIAL** | Techo `proyectos.presupuesto` (del Excel RESUMEN) + partidas `proyecto_presupuestos` / `_lineas` (plantilla) | Techo en 7/11; partidas en **1/11** (406 líneas) | Unificar techo vs. partidas (hoy no se hablan); cargar partidas de los 10 restantes; **no existe `partida_id`** en OC/ítems para enlazar gasto a partida |
| 2 | Lo que se va gastando | **PARCIAL** (bug latente) | OC + caja chica + gastos fijos por `proyecto_id` ✔ | 980 OC de proyecto, 366 gastos de caja, 44 fijos | **Bug** de estados de OC (ver §3.1); TC fijo 3.40 en código; tres definiciones distintas de "qué OC cuentan"; los fijos se muestran pero no se restan |
| 3 | Lo que falta por gastar | **PARCIAL** | Techo − gasto en Proyecto 360 ✔ | — | `ProyectoDetalle` usa `proyectos.costo_real`, que **nunca se actualiza** (siempre 0) → su "Disponible" está mal; no hay saldo por partida |
| 4a | Facturado por proveedores | **NO** | `comprobantes_pago` completo: OC, recepción, proyecto, vencimiento, detracción, retención, asiento ✔✔ | **0 facturas** | Adopción (portal / registro); nadie suma por proyecto; el registro manual guarda solo el *número* de OC, no el id |
| 4b | Facturado al cliente (Estado) | **PARCIAL** | `valorizaciones` por proyecto con estados ✔; `registro_ventas` **sin** proyecto | 16 valorizaciones (5 pagadas, 6 pendientes, 5 presentadas) | Enlazar valorización ↔ factura de venta; `proyecto_id` en registro de ventas; Proyecto 360 calcula cobrado/pendiente de cobro pero **no lo muestra** |
| 5 | Pagado | **NO** | `transacciones` solo tiene `centro_costo_id`: **sin `proyecto_id` en producción** (una migración del repo lo declara, no está aplicada), sin `orden_id`, sin `comprobante_id`; factura "pagada" es solo una bandera sin monto ni fecha | **0 pagos** en el ERP; 640+ pagos viven en el flujo Excel (`flujo_compromisos.monto_pagado`, por CDC, sin proyecto) | Enlace pago ↔ factura ↔ OC ↔ proyecto; aplicar/corregir la migración; capturar pagos en el ERP |
| 6 | Recepcionado | **NO** | `recepciones` con `orden_id` y `proyecto_id` ✔ | **0 recepciones** | Adopción; ítems recibidos sin precio ni enlace al ítem de OC; bug `cantidad_pedida = cantidad_recibida`; vista "recepcionado por proyecto" (en valor) |
| 7 | Inventario por proyecto | **NO** | `movimientos_inventario` sin proyecto; ítems de OC/recepción **sin `articulo_id`** | 0 artículos, 0 movimientos; módulo apagado | Catálogo de artículos; `articulo_id` en ítems; recepción → movimiento; dimensión proyecto/almacén |
| 8 | Contable por proyecto | **NO** | `asientos_lineas.centro_costo_id` ✔ (nunca se llena); registros de compras/ventas con `comprobante_id`/`asiento_id` ✔; sin `proyecto_id` | 0 asientos, 0 registros | Contabilizar (idealmente automático desde comprobantes); llenar CDC en líneas; reporte por CDC/proyecto |
| 9 | Rentable / cómo va | **PARCIAL** | Proyecto 360, PresupuestoProyecto, `v_gerencia_por_proyecto`, RPC `proyectos_financiero_resumen` | Contrato 11/11; cobrado 5/11 (número manual del Excel) | **Dos definiciones de margen** distintas; sin flujo de caja del proyecto (cobrado vs. pagado: imposible sin pagos); el SQL de vistas/RPC no está en el repo |
| B | Qué pagar cada mes | **NO** (piezas sueltas) | Ver §2 | Flujo Excel por mes; OC con condición de pago en texto | Vista unificada CxP por mes; OC aprobada → compromiso; vencimiento en OC; pantalla real de cuentas por pagar |

---

## 2. "Qué se debe pagar cada mes" — las tres fuentes que no se juntan

1. **`flujo_compromisos`** (pantalla Flujo Financiero): matriz CDC/categoría/concepto × `mes_vencimiento`
   con pagado y estado. Se alimenta del Excel (`flujo-import`) o a mano. **Es lo más cercano a la respuesta**,
   pero no está conectado con las OC ni con las facturas, mezcla egresos e ingresos por signo (63 filas
   negativas = CIPRL/financiamiento) y **515 filas no tienen CDC** (no se pueden llevar a proyecto/área).
   Con la data de hoy responde así (pendiente, S/):

   | Mes | Administración | Proyectos | Contabilidad | TI | Total |
   |---|---:|---:|---:|---:|---:|
   | 2026-09 | 10 464 418 | −1 336 967 | 3 472 182 | 199 | 12 599 831 |
   | 2026-10 | 368 485 | −23 197 001 | 1 963 318 | 125 | −20 865 073 |
   | 2026-11 | 437 930 | −478 538 | 3 338 831 | — | 3 298 223 |
   | 2026-12 | 438 767 | 4 084 894 | 40 269 | 227 | 4 564 156 |

2. **`v_gerencia_compromiso_mensual`** (Flujo Gerencia): agrupa las OC por mes de **emisión**, no de
   vencimiento. La propia pantalla avisa "No es lo pagado: eso llega con CxP".
3. **`/finanzas/cuentas-pagar`**: abre la misma pantalla de Transacciones (`App.tsx:652`) — lista genérica
   sin vencimientos y con **0 filas**. `FinanzasFlujoCaja` agrupa por `fecha` (historial, no proyección).

Datos que cambian el plan:
- **Una OC aprobada no genera ningún compromiso de pago** (`ordenes-store` no escribe en `transacciones` ni
  en `flujo_compromisos`).
- Las OC **no tienen fecha de vencimiento**, pero **sí condición de pago en texto en ~90 %** de los casos:
  `CRÉDITO 30 DÍAS` 794 · `AL CONTADO` 160 · `SEGÚN LO ACORDADO` 125 · `CRÉDITO 90 DÍAS` 84 ·
  `PAGO POR ADELANTADO` 46 · `CRÉDITO 60 DÍAS` 42 · `CIPRL` 24. → **Se puede derivar el vencimiento**
  (`fecha_emision + días`) sin recapturar nada.
- Las facturas tienen `fecha_vencimiento`, pero el portal (`factura-ingest`) no la llena.
- `docs/PLAN-CxP.md` ya diseñó `cxp_compromisos`; dice "nada implementado todavía".

---

## 3. Hallazgos transversales (lo que hay que corregir primero)

### 3.1 Bug: estados de OC en el gasto real del proyecto
`src/lib/proyectos/proyecto-financiero.ts:139` filtra las OC por `['aprobada','en_ejecucion','completada','recibida']`,
pero los estados reales son `borrador | enviada | aprobada | recibida_parcial | recibida_total | anulada`
(`supabase/migrations/20260316000000_initial_schema.sql:435`, `ordenes-store.tsx:216-225`).
**Hoy no afecta** (hay 0 OC en `recibida_*`), pero en cuanto Compras empiece a registrar recepciones, cada OC
recibida **desaparecerá del gasto real**, y el saldo, la utilidad y el margen de Proyecto 360 saldrán inflados.
Corregir *antes* de exigir recepciones.

### 3.2 `proyectos.costo_real` nunca se actualiza
Solo se escribe en 0 al crear el proyecto (`ProyectosLista.tsx:166`). Lo usan `ProyectoDetalle.tsx:1024-1028`
("Disponible"), `ProyectosValorizaciones.tsx:48-54` (rotulado **"Valorizado"**, que confunde) y
`v_gerencia_por_proyecto`. Decidir: calcularlo por trigger/vista o dejar de mostrarlo.

### 3.3 Tres verdades para "gasto" y dos para "margen"
- Gasto: `proyecto-financiero.ts:139` (bug) · `PresupuestoProyecto.tsx:117-118` (cuenta borradores y
  enviadas) · las vistas/RPC SQL (definición no versionada).
- Margen: Proyecto 360 = contrato − (OC + caja), **sin** restar fijos · PresupuestoProyecto **resta**
  consultoría 10 %, contraprestación 5 %, CIPRL 4 %. `v_gerencia_por_proyecto` no calcula margen.
→ Una sola función + una sola vista SQL versionada, y una **definición oficial** (decisión Finanzas/Gerencia).

### 3.4 Tipo de cambio fijo 3.40 en código
`proyecto-financiero.ts:236, 254` convierte adendas y caja en USD con 3.40 escrito a mano. Se conecta con la
política de TC (pendiente) y con la tabla de TC automática (FASE 3 del contexto).

### 3.5 Desfase migraciones ↔ producción (riesgo de reconstrucción)
- En el repo pero **no en prod**: `transacciones.proyecto_id`, `presupuesto_lineas.proyecto_id`
  (`20260514010000_dual_imputation.sql`).
- En prod pero **sin SQL en el repo**: `v_gerencia_*`, `v_oc_saldo_facturacion`, `v_bi_movimientos`, RPC
  `proyectos_financiero_resumen` y `proyectos_gasto_por_anio`, tablas `comprobantes_pago`,
  `flujo_compromisos`, `proyecto_presupuestos`, trigger `trg_oc_proyecto`.
→ Hoy la base no se puede reconstruir desde el repo. Versionar todo.

### 3.6 Enlaces débiles
- Caja chica guarda `centro_costo` como **texto** (658 gastos sin proyecto pero con CDC en texto).
- 515 compromisos del flujo sin CDC.
- Riesgo de doble conteo de adendas (`proyecto-financiero.ts:243` suma `monto_adenda` del Excel + filas de
  `adendas_proyecto`).

### 3.7 Lo que SÍ está bien (no confundir con huecos)
- El enlace **OC → proyecto está completo**: las 354 OC sin proyecto son todas de área (Oficina Central,
  etc.); 0 son de proyecto sin enlazar. 1 332 de 1 334 OC tienen centro de costo.
- `comprobantes_pago` está modelado para el 3-way match completo (OC, recepción, proyecto, vencimiento,
  detracción, retención, asiento): solo falta **usarlo**.
- El trigger `trg_oc_proyecto` deriva proyecto desde el CDC al crear la OC.

---

## 4. Foto real hoy: qué responde el sistema por proyecto (S/, redondeado)

| Proyecto | Estado | Presupuesto | Contrato total | Costo OC | Caja | Fijos | Valorizado | Cobrado | Fianzas |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GORE ICA – PNP | liquidación | 0 | 21 878 021 | 3 128 647 (726 OC) | 102 | 4 922 555 | 0 | 21 431 236 | 1 |
| GORE LORETO – BOMBEROS | ejecución | 33 204 527 | 43 865 819 | 5 768 449 | 6 983 | 9 869 809 | 43 840 000 | 16 543 724 | 1 |
| GORE AMAZONAS – PNP | ejecución | 11 945 011 | 12 263 533 | 3 677 167 | 12 442 | 2 759 295 | 12 260 000 | 0 | 1 |
| MP CUSCO – SERENAZGO | ejecución | 6 235 201 | 7 154 696 | 1 721 286 | 6 334 | 1 609 807 | 7 060 000 | 6 009 108 | 1 |
| GORE CUSCO – AMBULANCIAS | ejecución | 26 917 370 | 36 153 270 | 4 679 924 | 92 365 | 8 134 486 | 36 150 000 | 0 | 1 |
| GORE CUSCO – PNP | ejecución | 12 585 422 | 12 675 740 | 2 759 552 | 10 865 | 2 852 042 | 12 500 000 | 9 563 295 | 1 |
| GORE HUÁNUCO – PNP | ejecución | 6 804 737 | 6 877 435 | 1 654 641 | 9 840 | 1 547 423 | 6 860 000 | 4 726 500 | 1 |
| GORE CUSCO – HIDROAMBULANCIAS | ejecución | 2 043 903 | 2 322 373 | 1 148 000 | 89 | 522 534 | 0 | 0 | 1 |
| GORE SAN MARTÍN – MÓVIL SALUD | planificación | 0 | 61 211 400 | 0 | 0 | 13 772 565 | 0 | 0 | 0 |
| GORE SAN MARTÍN – BOMBEROS | planificación | 0 | 40 185 642 | 0 | 0 | 9 041 770 | 0 | 0 | 0 |
| GORE LORETO – MÓVIL SALUD | planificación | 0 | 284 094 738 | 0 | 0 | 63 921 316 | 0 | 0 | 0 |

Lectura: presupuesto, contrato, gasto comprometido (OC + caja + fijos), valorizado, cobrado y fianzas **ya se
responden** para cada proyecto. **Recepcionado, facturado por proveedores, pagado, inventario y contable: en
cero** — no por falta de modelo, sino porque no se registra en el ERP.

---

## 5. Qué falta para responder TODO — bloques de trabajo

**Bloque 0 — Correcciones (antes de encender nada)**
1. Corregir estados de OC en `proyecto-financiero.ts:139` (`recibida_parcial`, `recibida_total`).
2. Corregir `cantidad_pedida` en `recepciones-store.tsx:303`.
3. Resolver `proyectos.costo_real`: calcular por vista/trigger o retirarlo de las pantallas.
4. Una sola definición de gasto y de margen: una función TS + una vista SQL versionada; decisión oficial.
5. Sacar el TC 3.40 hardcoded → tabla de tipo de cambio (FASE 3).
6. Versionar en el repo las vistas, RPC, tablas y trigger que solo existen en prod; aplicar (corregida) o
   descartar la migración `dual_imputation`.

**Bloque 1 — Cuentas por pagar por mes** (responde "qué pagar cada mes")
1. Vencimiento en OC: derivado de `condiciones_pago` + campo explícito editable; estado de pago en OC.
2. OC aprobada → compromiso automático (`cxp_compromisos` según PLAN-CxP, o `flujo_compromisos` con
   `orden_id`, para no duplicar con lo que Finanzas ya carga).
3. Portal: llenar `fecha_vencimiento` de la factura.
4. Vista unificada CxP por mes = OC pendientes + facturas + compromisos del flujo (con dedupe), y pantalla
   real en `/finanzas/cuentas-pagar` (hoy es Transacciones).

**Bloque 2 — Cerrar la cadena por proyecto** (recepción → factura → pago → cobro)
1. Recepciones: registrarlas siempre (SLA); precio y enlace al ítem de OC; "recepcionado por proyecto" en valor.
2. Facturas de proveedor: adopción del portal/registro; sumar por proyecto; registro manual con
   `orden_compra_id`.
3. Pagos: `transacciones` con `proyecto_id` + `comprobante_id` + `orden_id`; pago de factura con monto y
   fecha; "pagado por proyecto".
4. Cobros: valorización ↔ factura de venta; `proyecto_id` en `registro_ventas`; cobrado transaccional (no un
   número del Excel).

**Bloque 3 — Presupuesto por partidas**: cargar partidas de los 10 proyectos restantes; `partida_id` en
OC/ítems; saldo por partida; unificar con el techo.

**Bloque 4 — Inventario por proyecto**: catálogo de artículos; `articulo_id` en ítems de OC y recepción;
recepción → movimiento de kardex; dimensión proyecto/almacén; encender el módulo.

**Bloque 5 — Contable por proyecto**: contabilización automática desde comprobantes (asiento con CDC en
líneas); registros de compras/ventas automáticos; reporte por CDC/proyecto.

**Bloque 6 — Proyecto 360 completo**: agregar valorizado, cobrado y pendiente de cobro (ya se calculan),
facturado, pagado, recepcionado, inventario, contable, flujo de caja del proyecto (cobrado vs. pagado) y
compromisos por mes.

---

## 6. Decisiones que esto necesita (se suman a las del documento "as is")

- **Finanzas + Gerencia:** definición oficial de *gasto real* y de *margen* (¿se restan consultoría,
  contraprestación y CIPRL? ¿cuentan OC enviadas?). Sin esto no hay una sola verdad.
- **Finanzas:** política de tipo de cambio (bloquea el TC fijo y la consolidación).
- **Contabilidad:** momento de contabilización (al recibir factura / al pagar) y tolerancias del 3-way match.
- **Compras / Operaciones:** registrar **todas** las recepciones en el ERP (SLA) y portal de facturas
  obligatorio para proveedores. Sin esto, la cadena seguirá cortada en "OC aprobada" aunque se construya todo.
- **Gerencia:** presupuesto por partidas obligatorio al abrir un proyecto; encender Inventario.

---

## 7. Fuentes

- Base: `information_schema`, conteos por tenant, `cron.job`, `pg_views`, `pg_proc`, `pg_trigger` (2026-09-23).
- Código: `src/lib/proyectos/proyecto-financiero.ts`, `Proyecto360.tsx`, `ProyectoDetalle.tsx`,
  `PresupuestoProyecto.tsx`, `ProyectosValorizaciones.tsx`, `FinanzasTransacciones.tsx`, `FinanzasFlujoCaja.tsx`,
  `FlujoFinanciero.tsx`, `FlujoGerencia.tsx`, `src/lib/bi/gerencia-store.ts`, stores de compras/finanzas/
  contabilidad/inventario, Edge Functions `factura-ingest`, `excel-sync`, `presupuesto-import`, `flujo-import`.
- Documentos previos: `docs/PLAN-CxP.md`, `docs/DISENO-Modelo-Proyecto-Financiero.md`, `docs/CONTEXTO-SESION.md`.
