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
6. `cuentas_por_pagar` — (origen: oc/factura/caja_chica, entidad_id, proveedor_id, proyecto_id?, centro_costo_id, monto, moneda, fecha_emision, fecha_vencimiento, estado: pendiente/pagado/vencido, fecha_pago)

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

## 9. Preguntas abiertas antes de construir

1. **Gastos fijos:** ¿se calculan siempre como % del CIPRL/valor, o el monto puede fijarse manual?
2. **Presupuesto modificado:** ¿quién aprueba una nueva versión? ¿genera flujo de aprobación?
3. **CC sin proyecto:** ¿se reportan aparte (gasto interno/admin) o se ignoran en el financiero de proyectos?
4. **Deuda — fecha de vencimiento:** ¿de dónde sale? (forma de pago de la OC, condición de pago del proveedor, o fecha factura + plazo)
5. **Ingresos/cobros:** ¿se registran manual, vienen de valorizaciones, o ambos?
6. **Caja chica multimoneda:** ¿el reporte consolidado convierte USD→PEN con qué tipo de cambio (fijo del proyecto, SBS diario)?
