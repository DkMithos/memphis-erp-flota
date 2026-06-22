# Diseño — Modelo Proyecto-Céntrico Financiero (v1)

> Fecha: 2026-06-11
> Origen: replanteamiento de Gerencia. "Todo nace con proyectos."
> Fuentes: PROY-FOR-004 Presupuesto CUSCO HIDROAMBULANCIA (analizado), RESUMEN PROYECTOS,
> Modelo caja chica 20251, Flujo de proyectos.

## 1. El nuevo modelo mental

El **proyecto** es la columna vertebral. Todo lo financiero cuelga de él a través del
**centro de costo** (el puente). Un centro de costo es, casi siempre, un proyecto — pero
hay centros de costo internos que NO son proyectos.

```
PROYECTO
├── IDENTIDAD: nombre, CIU, tipo inversión (IOARR/OXI), estado, tipo valorización
│
├── INGRESOS (lo que la entidad nos paga)
│   ├── Inversión inicial (de las bases)
│   ├── Documento equivalente (modificación)
│   ├── = CIPRL / Valor modificado = inicial + equivalente   ← techo de ingreso
│   ├── Monto cobrado (ya cobrado)
│   └── Monto pendiente = CIPRL − cobrado
│
├── PRESUPUESTO (techo de gasto)
│   ├── Presupuesto inicial = items del Excel (precios)
│   ├── Presupuesto modificado 1, 2, 3… (solo items NO amarrados a orden/CC)
│   ├── Presupuesto final
│   └── Variaciones entre versiones (se comparan)
│
└── GASTOS / EGRESOS (con presupuesto como techo)
    ├── OCs amarradas al CC del proyecto
    ├── Caja chica amarrada al CC del proyecto
    └── GASTOS FIJOS comprometidos (aunque NO se ejecuten):
        ├── Servicio de Consultoría 10%
        ├── Contraprestación Privada 5%
        ├── Pago a cuenta impuesto a la renta 3.5%
        └── VENTA CIPRL 4%
        (la barra "cuánto se viene gastando" DEBE incluir estos fijos)
```

**Estructura de un item de presupuesto** (del Excel PROY-FOR-004):
`codigo (01.01.01) | descripcion | unidad | cantidad | precio_unit | precio_total | proveedor | forma_pago`
- Jerárquico: grupo (`01.00.00`) → líneas (`01.01.01`).
- Dos versiones lado a lado: PLANIFICADO vs FINAL.
- Cada item tiene **tipo** (vehículo, uniforme, equipo, servicio, garantía, gasto admin…).
- Cada item puede estar **bloqueado** (amarrado a una orden/caja chica → no modificable) o
  **libre** (modificable → genera presupuesto modificado N).

## 2. Lo que Gerencia quiere ver

| Bloque | Métricas |
|---|---|
| **Financiero proyecto** | Monto del proyecto (CIPRL), presupuestos (inicial/modificados/final), cuánto se gasta, cuánto queda por gastar |
| **Ingresos** | Cobrado, pendiente de cobrar |
| **Items físicos** | Tipos (vehículos, uniformes, etc.), cantidad por tipo |
| **Mantenimientos** | Realizados (total y por unidad), pendientes (total y por unidad), monto total pagado, cuánto se consume (total y por unidad) |
| **Deuda** | Total empresa, por proyecto, por proveedor, por item, vencidas por mes |

## 3. Respuesta a las preguntas de deuda

### ¿Cuánto de deuda tiene la empresa? → considerar:
La **deuda = cuentas por pagar**: todo lo que la empresa debe y aún no ha pagado.
1. **OCs recibidas no pagadas** (bien/servicio entregado, factura emitida, pago pendiente).
2. **Facturas de proveedores pendientes de pago** (con su fecha de vencimiento).
3. **Reembolsos de caja chica pendientes**.
4. **Gastos fijos comprometidos no pagados** (los 4 % del proyecto, si aún no se liquidaron).
NO es deuda: una OC en borrador/sin recepción (compromiso, no obligación firme aún).

### ¿Deuda por proyecto / proveedor / item? → requiere:
Cada OC/factura pendiente debe estar vinculada a:
- **Centro de costo → proyecto** (deuda por proyecto)
- **Proveedor** (deuda por proveedor)
- **Items/líneas** (deuda por item)
- **Fecha de vencimiento** (deudas vencidas por mes — como en "Flujo de proyectos")

→ Implica un **módulo de Cuentas por Pagar**: estado de pago + fecha de vencimiento por
cada OC/factura, con los ejes de imputación (proyecto/proveedor/item).

## 4. Gap analysis — qué tiene el ERP hoy vs qué falta

| Concepto | ERP hoy | Falta |
|---|---|---|
| Proyecto con ingresos (CIPRL, cobrado, pendiente) | Solo `montoContrato`, `montoAdenda` | Campos de ingreso + valorizaciones cobradas |
| Presupuesto por items jerárquicos | No existe | Tabla items + versiones |
| Presupuesto versionado (inicial→modificado→final) | No | Versiones + comparación |
| Gastos fijos comprometidos (% del proyecto) | No | Cálculo automático + inclusión en gasto |
| Items físicos por proyecto (tipos, cantidad) | Solo "vehículos del proyecto" en Flota | Tabla `proyecto_items` |
| Mantenimientos por unidad (realizados/pendientes/consumido) | Parcial (saldo preventivo) | Métricas por unidad consolidadas |
| Centro de costo como puente universal | Existe pero subutilizado | Reasignar CC en OCs migradas según caja chica |
| Cuentas por pagar / deuda | No existe | Módulo completo |
| Ingresos/Egresos | Caja chica parcial | Modelo de flujo (ingresos vs egresos) |
| `calcularFinancieroProyecto` | Gasto = OCs + CC | Reescribir: + gastos fijos, presupuesto versionado, ingresos |

## 5. Cambios al modelo de datos (propuesta)

**Modificar `proyectos`:** agregar `inversion_inicial`, `documento_equivalente`,
`valor_modificado` (=CIPRL), `monto_cobrado`, `monto_pendiente`, `tipo_valorizacion`,
`ciu`, `tipo_inversion`, `estado_operativo`.

**Nuevas tablas:**
1. `presupuesto_versiones` — (proyecto_id, version: 0=inicial/1,2,3=modificado/final, total, fecha, motivo)
2. `presupuesto_items` — (version_id, codigo, descripcion, unidad, cantidad, precio_unit, precio_total, proveedor_id, forma_pago, tipo_item, bloqueado bool, oc_id?, caja_chica_id?)
3. `gastos_fijos_proyecto` — (proyecto_id, concepto, porcentaje, monto_calculado, ejecutado bool, pagado bool)
4. `proyecto_items_fisicos` — (proyecto_id, tipo: vehiculo/uniforme/equipo…, descripcion, cantidad, entregado, recepcionado)
5. `cobros_proyecto` (ingresos) — (proyecto_id, tipo: valorizacion/CIPRL, monto, fecha, estado)
6. `cuentas_por_pagar` (deuda + proyección de pagos) — (origen: oc/factura/caja_chica,
   proveedor_id, proyecto_id?, centro_costo_id, monto, moneda, forma_pago,
   **estado_ejecucion**: proyectada/ejecutada, **es_proyeccion** bool, fecha_factura?,
   **fecha_vencimiento** (=factura+plazo si ejecutada, =fecha proyectada si no),
   estado_pago: pendiente/pagado/vencido, fecha_pago?)
7. `cobros_proyecto` ya incluye proyección: (proyecto_id, monto_esperado, fecha_esperada,
   monto_cobrado?, fecha_cobro?, estado: proyectado/cobrado)

**Modificar `ordenes_compra` / `gastos_caja_chica`:** asegurar `centro_costo_id` +
estado de pago + fecha vencimiento (para alimentar cuentas_por_pagar).

**`centros_costo`:** confirmar `proyecto_id` nullable (CC interno = sin proyecto).

## 6. Motor de cálculo financiero (reescritura de `calcularFinancieroProyecto`)

```
GASTO TOTAL del proyecto =
    Σ OCs (estado válido) con centro_costo del proyecto
  + Σ caja chica (aprobada) con centro_costo del proyecto
  + Σ gastos fijos comprometidos (% del valor, aunque no ejecutados)

PRESUPUESTO = versión final (o la activa)
SALDO POR GASTAR = presupuesto − gasto total
% EJECUCIÓN = gasto total / presupuesto

INGRESO (CIPRL) = inversión inicial + documento equivalente
COBRADO / PENDIENTE = cobros registrados / (CIPRL − cobrado)
UTILIDAD = CIPRL − gasto total real
```

## 7. Plan de implementación por fases

> Este diseño SUPERSEDE y expande la "Reforma módulo Proyectos (OXI/IOARR)" que ya estaba
> en PENDIENTES. Se integra con: migración oc-system, import caja chica, import presupuesto.

| Fase | Entregable | Depende de |
|---|---|---|
| **F1 — Modelo de datos** | Migración SQL: campos en proyectos + 6 tablas nuevas | — |
| **F2 — Importador de presupuesto** | Parser del formato PROY-FOR-004 → presupuesto_items v0 | F1 |
| **F3 — Importador caja chica** | Excel (hoja por caja, PEN/USD separado) → gastos + cuentas_por_pagar; cajas abiertas (12 USD/18 PEN) quedan editables | F1 |
| **F4 — Migración oc-system + reasignación CC** | OCs hasta 1031; CC reasignado según caja chica | F1, F3 |
| **F5 — Motor financiero** | Reescribir calcularFinancieroProyecto (gastos fijos + presupuesto versionado + ingresos) | F1-F4 |
| **F6 — Cuentas por pagar / Deuda** | Módulo deuda: total, por proyecto/proveedor/item, vencidas por mes | F4 |
| **F7 — UI Proyecto360 v3** | Tabs: Ingresos · Presupuesto (versiones) · Gastos · Deuda · Items físicos · Mantenimientos por unidad | F5, F6 |
| **F8 — Dashboard Gerencia** | KPIs exactos que pidió Gerencia (cartera + deuda + cobranza) | F7 |
| **F9 — Comparador de presupuestos** | Vista de variaciones inicial→modificado→final | F2 |

## 8. Alcance de migración (confirmado por Kevin)

- **Órdenes:** hasta la **1031** (última 19/06/2026).
- **Cajas:** hasta **11 en USD** y **17 en soles**. Las **12 (USD) y 18 (PEN) están abiertas**
  → se migran como **cajas abiertas** (siguen recibiendo info; luego se cierran y continúan el flujo).
- **CC:** usar los centros de costo de caja chica; reasignar los de las OCs según caja chica.
  Todo CC ≈ proyecto, pero hay CC sin proyecto (internos).

## 9. Decisiones de Gerencia (2026-06-11) — INSIGHT: modelo de proyecciones

> **El modelo financiero es de PROYECCIONES (flujo de caja proyectado), no solo de
> montos ejecutados.** Tanto la deuda como los ingresos se registran como proyecciones,
> y se confirman/realizan con la ejecución. Esto coincide con el archivo "Flujo de
> proyectos" (deudas vencidas por mes = pagos proyectados por mes).

1. **Gastos fijos:** el sistema los **calcula automáticamente según la fórmula del Excel**
   (no monto manual). ⚠️ La fórmula de Contraprestación Privada es multi-paso (filas 48-57
   del PROY-FOR-004): base − CIPRL(4%) → ×0.1875 → resta → ×5% → ×5% → resta. En F2 hay que
   extraer las **fórmulas exactas** (cargar el Excel sin `data_only` para ver celdas con `=`),
   no solo los valores. VENTA CIPRL = valor×4% (directo).

2. **Fecha de vencimiento de deuda → DOS estados:**
   - **Ejecutada** (orden ejecutada + bien/servicio recepcionado): la fecha es la de la
     **factura** + el plazo de la forma de pago (contado / adelanto / crédito 30 / 120 días…).
   - **No ejecutada:** la fecha es la **proyección de pago** (se contempla una proyección de
     pagos por semestre: mensual, anual, etc.).
   → `cuentas_por_pagar` necesita: `estado_ejecucion` (proyectada/ejecutada),
     `fecha_factura?`, `forma_pago`, `fecha_vencimiento` (calculada o proyectada),
     `es_proyeccion bool`. La deuda total mezcla ejecutado + proyectado.

3. **CC internos (sin proyecto): AMBOS** → reporte interno propio (gasto admin/empresa) +
   sumados a la **deuda total de la empresa**, pero fuera del financiero de proyectos.

4. **Ingresos/cobros: manual, como PROYECCIONES** de lo que va a ingresar y se espera cobrar.
   → `cobros_proyecto` registra proyecciones (monto esperado, fecha esperada) y luego el
     cobro real confirmado. Permite ver esperado vs cobrado vs pendiente.

### Implicación de diseño: añadir capa de FLUJO DE CAJA PROYECTADO
- **Egresos proyectados** (pagos futuros por mes/semestre, ejecutados y no ejecutados)
- **Ingresos proyectados** (cobros esperados por fecha)
- Vista de flujo: por proyecto y consolidado empresa, por mes → responde "¿cuánto debemos y
  cuándo?" y "¿cuánto vamos a cobrar y cuándo?" (lo que Gerencia pide en "Flujo de proyectos").

### Pendiente de confirmar (menor)
- Presupuesto modificado: ¿genera flujo de aprobación al crear una nueva versión?
- Caja chica multimoneda: ¿tipo de cambio del consolidado? (fijo del proyecto vs SBS diario)
  — el Excel PROY-FOR-004 usa tasa fija 3.6 por proyecto.
