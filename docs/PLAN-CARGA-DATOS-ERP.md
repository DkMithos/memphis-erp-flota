# Qué cargar al ERP sin romperlo: mapa de conexiones y orden de carga

> Fecha: 2026-10-12. Pedido de Kevin: "analiza qué es lo que se debe cargar al ERP sin romperlo… tenemos que
> tener toda la información conectada en el ERP para poder empezar a hacer análisis".
>
> Este documento parte de lo ya cargado (SIRE 2024-2026, pagos históricos 2024-2026, bancos 2026, constancias,
> obligaciones, caja chica, fianzas, OC migradas, vehículos) y responde tres cosas: **qué está conectado y qué
> no**, **qué falta cargar y qué puede romper cada carga**, y **en qué orden hacerlo**.

---

## 1. Estado de las conexiones (medido en la base el 12-oct)

El análisis que quiere Gerencia (gasto real por proyecto, flujo por área, deuda por acreedor, margen por
proyecto) depende de que cada registro apunte a su **proyecto**, su **centro de costo (CDC)** y su
**proveedor**. Hoy:

| Entidad | Registros | Con CDC | Con proyecto | Con proveedor | Qué significa |
|---|---:|---:|---:|---:|---|
| Facturas recibidas (`comprobantes_pago`) | 6,458 | 46 | 46 | 2,605 | Las 6,412 del SIRE no tienen CDC ni proyecto: no entran al gasto por proyecto. 3,853 no tienen proveedor (703 RUC que no están en el directorio de 139) |
| Pagos históricos 2024-2026 (`transacciones`) | 3,346 | 3,207 | 726 vía CDC | — | El CDC está, pero solo 10 de los 79 CDC apuntan a un proyecto: el 78 % del gasto pagado no llega al proyecto |
| Flujo desde Excel (`flujo_compromisos` fuente excel) | 2,695 | 2,174 | 724 | 132 | Proveedor casi nunca cruza por nombre |
| Flujo nativo (fuente erp: OC, facturas, obligaciones) | 1,448 | 245 | 217 | 832 | Las facturas del SIRE heredan "sin CDC" |
| Órdenes de compra | 1,397 | 1,395 | — | 1,397 | Bien conectadas (migración OC) |
| Centros de costo | 79 | — | 10 | — | **El eslabón roto principal**: GLORETOPNP, GLORETOSC, GLORETOAMB, GCUSCOBOM, GICAAMB18/27, GAMAZONAMB, GSANMARTIN*, MPSANMIGUEL, MUNSMSERENAZGO… no tienen proyecto |
| Proyectos | 11 | — | — | — | 10 con presupuesto; **0 valorizaciones** en el ERP (las valorizaciones mensuales viven en Excel por proyecto) |
| Movimientos de banco 2026 | 2,088 | — | — | — | **228 sin conciliar (13-oct)**: 123 pagos sin factura (incl. los 102 OPE errados), 91 por clasificar, préstamos, caja chica, planilla |
| Obligaciones financieras | 20 (124 cuotas) | sí | — | 3 | Nuevo (12-oct); 7 acreedores sin ficha de proveedor |
| Caja chica | 47 cajas · 1,158 gastos | sí | vía CDC | — | Sincronizada cada 30 min desde el Excel de Administración (`excel-sync`); **no hay que recargarla** |
| Fianzas | 65 cartas | — | sí | — | Sincronizada cada 15 min (`fianzas-import`) |
| Vehículos | 414 | — | sí | — | Migrados; las unidades nuevas de Perumotor entran por Flota |
| Inventario | 56 artículos, 1,812 unidades con serie (LA SIRENA + INVENTARIO DE EQUIPOS de Logística) | — | — | — | Equipamiento por serie en Inventario › Unidades desde el 15-oct; 4 almacenes |
| Facturas emitidas (ventas) | 936 (12-oct) | — | 221 | 936 (cliente) | Cargadas del SIRE de ventas 2025-2026; falta proyecto en las ventas a financistas OXI |

Conclusión: la mitad de las piezas ya está en el ERP, pero el análisis "por proyecto" se corta en dos puntos:
los CDC sin proyecto y las facturas del SIRE sin CDC. Son correcciones de datos, no módulos nuevos.

---

## 2. Regla para no romper nada

Toda carga sigue el mismo guion (es lo que hicimos con SIRE, bancos, constancias y obligaciones):

1. **Copia de trabajo** del archivo en el scratchpad; nunca se edita el Excel de SharePoint.
2. **Leer por nombre de columna**, no por posición; números en formato peruano; fechas a ISO.
3. **Dry-run con rollback** por el pooler (rol temporal con BYPASSRLS o la función real con el JWT de un
   usuario con permiso): se miran los contadores (nuevas, ya existían, saltadas, enlazadas) antes de confirmar.
4. **Dedupe por clave natural** (RUC + serie + número; cuenta + OPE + fecha + importe; código de caja + fila),
   nunca por posición ni por "borrar todo y volver a cargar" salvo que la tabla sea 100 % de esa fuente
   (`referencia_tipo = 'historico_contabilidad'`, `fuente = 'excel'` por área).
5. **Triggers conocidos** que se disparan al insertar y que hay que decidir a propósito:
   - `comprobantes_pago` → `trg_factura_compromiso` (crea compromiso si `conforme`/`pagada`),
     `trg_comprobante_contabilizar` (asiento si `conforme`+; se apaga con `app.sin_asiento = '1'` para años
     cerrados), `trg_factura_dimension` (hereda CDC/proyecto de la OC).
   - `transacciones` → `set_transaccion_dimension` (hereda CDC/proyecto de factura/OC/compromiso, calcula
     soles), `trg_transaccion_pago` (recalcula el compromiso), `trg_transaccion_asiento`, `trg_auditar`.
   - `flujo_compromisos` → `trg_compromiso_a_cuota` (cierra cuotas de obligaciones).
   - `recepciones` → kardex automático (`trg_recepcion_kardex`).
6. **Claves únicas** que frenan duplicados: `comprobantes_pago (tenant, ruc, tipo, serie, numero)`,
   `movimientos_bancarios (cuenta, numero_doc, fecha, importe)`, `flujo_compromisos (orden_compra_id)` /
   `(comprobante_id)` / `(valorizacion_id)` / `(obligacion_cuota_id)`, `obligaciones_cuotas (obligacion, numero)`,
   `stock_almacen (articulo, almacen, proyecto)`.
7. **pg_safeupdate**: desde PostgREST no hay `DELETE`/`UPDATE` sin `WHERE` (usar `truncate` en temporales).
8. **Bitácora**: cada carga deja origen (`origen_archivo`, `referencia_tipo`, `flujo_importaciones`,
   `creado_por = 'migracion:…'`) para poder deshacerla.
9. **Usuarios y datos de prueba** se borran al terminar; nada queda con "QA" en producción.
10. Se documenta en `docs/CONTEXTO-SESION.md` y, si es un patrón nuevo, en el skill de carga.

---

## 3. Qué falta cargar, qué puede romper y cómo hacerlo seguro

| # | Dato | Fuente | Destino | ¿Existe? | Qué puede romper | Cómo cargar seguro | Valor para el análisis |
|---|---|---|---|---|---|---|---|
| 1 | **CDC → proyecto** (69 CDC sin proyecto) | `centros_costo` + lista de proyectos/ideas de Operaciones | `centros_costo.proyecto_id`; crear `proyectos` para los liquidados e ideas (GLORETOPNP, GLORETOSC, GLORETOAMB, GCUSCOBOM, GSANMARTIN*, GICAAMB*, GAMAZONAMB, MPSANMIGUEL, MUNSMSERENAZGO…) | Sí | Nada directo: es un `update`. Pero `set_transaccion_dimension` no re-deriva el proyecto de las transacciones ya cargadas: hay que correr un `update transacciones set proyecto_id` por CDC después | Mapa CDC → proyecto validado por Operaciones (12 líneas), un solo `update`, luego recalcular proyecto en transacciones y compromisos con CDC y sin proyecto | **Alto**: el gasto pagado 2024-2026 y el flujo por proyecto aparecen de inmediato en Proyecto 360 |
| 2 | **Proveedores desde el SIRE** (703 RUC) | `comprobantes_pago` (RUC + razón social) + padrón SUNAT (`sunat-proxy`) | `proveedores` (ficha mínima: RUC, razón social, origen `sire`, estado "por completar") y `comprobantes_pago.proveedor_id` | Sí | El directorio pasa de 139 a ~840 fichas sin cuenta bancaria ni condición tributaria; los lotes de pago alertarán "sin cuenta". No rompe nada: `proveedores.ruc` es único | Insert-only con `on conflict (ruc) do nothing`, marcar `origen = 'sire'`, enriquecer con el padrón SUNAT (condición, estado, dirección) y, para los 60 recurrentes, con "Datos para pago" de Administración | **Alto**: deuda y gasto por proveedor, lotes de pago sin digitar cuentas |
| 3 | **CDC/proyecto de las facturas del SIRE** | El pago histórico enlazado (865) trae CDC; para el resto, el CDC "habitual" del proveedor (mayoría de sus pagos) | `comprobantes_pago.centro_costo_id / proyecto_id` y su compromiso | Sí | `trg_factura_compromiso` actualiza el compromiso al cambiar CDC/proyecto (ok); `trg_comprobante_contabilizar` no re-contabiliza si ya hay asiento (ok). Riesgo: asignar mal un CDC a facturas de proveedores que trabajan para varios proyectos (Peruana de Motores, Autofondo) | Dos pasadas: (a) heredar del pago enlazado (seguro); (b) sugerir por proveedor y dejar que Contabilidad confirme desde la pantalla (columna "CDC sugerido") en vez de imponerlo | **Alto**: sin esto el 99 % de las facturas no pesa en ningún proyecto |
| 4 | **Valorizaciones (ingresos reales por proyecto)** | `Seguimiento de proyectos` (monto ejecutado, cobrado, por cobrar) y los `Valorización N.xlsx` de cada proyecto | `valorizaciones_proyecto` (→ compromisos `cobrar`) | Sí, vacía | `flujo_compromisos_valorizacion_uq`; el trigger crea compromisos de cobro que hoy ya existen como proyección del Excel (duplicidad hasta el corte); `set_transaccion_dimension` enlaza cobros | Cargar del **Seguimiento** (una fila por valorización: proyecto, n.º, periodo, monto, fecha de presentación, estado de cobro), no de los 40 Excel distintos; marcar origen; conciliar con los abonos del banco (ingresos 2026 ya importados) | **Muy alto**: es el lado de ingresos; sin él el flujo acumulado es negativo por construcción |
| 5 | **SIRE de ventas** (facturas emitidas 2024-2026) | `3. Ventas (PDF)/MM-AAAA SIRE VENTAS` | `comprobantes_pago` con `direccion = 'emitido'` | Sí (0 filas) | **Bloqueo**: `trg_factura_compromiso` no mira `direccion` y crearía compromisos de **pagar** para una factura de venta. Hay que ajustar el trigger (emitido → compromiso `cobrar`) antes de cargar una sola fila. `trg_comprobante_contabilizar` sí distingue emitido | Primero la migración del trigger; luego el mismo importador del SIRE con `direccion = 'emitido'` y `app.sin_asiento` para < 2026 | **Alto**: ventas reales por cliente/proyecto, IGV débito, cruce con CIPRL y abonos |
| 6 | **Movimientos de banco que no son pagos** (ITF, comisiones, SUNAT, abonos, cambio de moneda: ~1,450) | `movimientos_bancarios` sin conciliar | `transacciones` (uno por movimiento, CDC OFCENTRAL o BANCOS) | Sí | Crea egresos/ingresos reales: entran al flujo de caja y al acumulado por CDC. Riesgo de duplicar lo que el Excel de Contabilidad ya trajo como HIST (ITF y comisiones de 2026 están en "Pagos acumulados"): verificar antes con `bancos_conciliar_auto` y por importe/fecha | Registro masivo **solo** de movimientos sin ninguna transacción candidata (±2 días, mismo importe), clasificación automática ya existente, CDC por tipo (ITF/comisión → BANCOS, SUNAT → el tributo, abonos → proyecto del cliente) | **Alto** para que "Saldo ERP" = saldo del banco |
| 7 | **Pagos de setiembre-octubre 2026** | `PAGOS dd.mm.aaaa.xlsx` (Administración y Logística) + extracto | `lotes_pago` + `transacciones` | Sí | Ninguno técnico; es el corte del sprint 4: a partir del lote del 6-nov nace en el ERP | No cargar los Excel: conciliar los movimientos del banco de set-oct contra las facturas `conforme` del SIRE (vincular en Bancos) | Medio: cierra el hueco agosto→noviembre |
| 8 | **Obligaciones: acreedores como proveedores** y los 4 préstamos ambiguos (GM, Etramed intereses, embargos) | Contratos de mutuo (PDF) + Contabilidad | `proveedores` + `obligaciones_financieras` | Sí | Nada | Alta manual desde la pantalla cuando Contabilidad confirme montos y fechas | Medio |
| 9 | **Viáticos y pasajes** (797 reservas 2026) | `CONTROL DE VIAJES 2026.xlsx` | Módulo nuevo (`viajes`, `viaje_pasajeros`, rendición → caja chica) | No | Nuevo módulo; 4-5 días; se conecta a proyecto y trabajador | **HECHO 16-oct**: módulo Viajes + app móvil /app, 109 viajes históricos cargados | Medio-alto: gasto de viaje por proyecto |
| 10 | **Correspondencia con el Estado** (5,600 filas) | `SEGUIMIENTO CARTAS FALTANTES` | Módulo nuevo (`cartas`) | No | Nuevo módulo; 5 días | Diseñar y cargar las 7 hojas | Medio: plazos y riesgo documental, no análisis financiero |
| 11 | **Equipamiento con número de serie** (555) | `MEMPHIS_IVENTARIO LA SIRENA` | `inventario_unidades` (nuevo) sobre `articulos` | No | Nuevo; el kardex es por cantidad | **HECHO 15-oct**: 546 unidades cargadas, pantalla Inventario › Unidades | Medio |
| 12 | **Cronogramas de MS Project** | `.mpp` → XML | `fases_proyecto`, `tareas_proyecto` | Sí | Nada | Exportar a XML y cargar | Medio: avance físico vs valorizado |
| 13 | **Planilla, EPS, vida ley, legajos** | BUK y carpetas de Administración | — | — | — | **No se carga**: solo el total mensual como compromiso (ya entra por BD CONTA) | — |

---

## 4. Orden propuesto (tres semanas, en paralelo con el corte del sprint 4)

| Semana | Carga | Días | Resultado medible |
|---|---|---|---|
| 1 (13-17 oct) | #1 CDC → proyecto · #2 proveedores desde el SIRE · #3a CDC heredado del pago — **hecho el 12-oct** | 3 | Gasto pagado 2024-2026 por proyecto en Proyecto 360; 0 facturas del SIRE sin proveedor |
| 1 | #5 ajustar el trigger de emitidos (bloqueo) — **hecho el 12-oct** (migración `20261012150000`) | 0.5 | Listo para ventas |
| 2 (20-24 oct) | #4 valorizaciones desde el Seguimiento — **hecho el 12-oct** (13 reales desde RESUMEN PROYECTOS; el Seguimiento solo trae totales) · #5 SIRE de ventas 2025-2026 — **hecho el 12-oct** (936 emitidos; no existe SIRE de ventas 2024) | 3 | Ingresos reales por proyecto; flujo acumulado con los dos lados |
| 2 | #6 registro masivo de ITF/comisiones/SUNAT/abonos — **hecho el 13-oct** (1,330 de 1,558; los 228 restantes son pagos sin factura, préstamos y "por clasificar": uno a uno en Bancos) | 1.5 | Saldo ERP = saldo BBVA al día |
| 3 (27-31 oct) | #3b CDC sugerido · #8 acreedores · #7 conciliar set-oct — **hecho el 13-oct** (vista + botón "Aplicar CDC sugerido"; "Pagar facturas" desde Bancos; 5 acreedores enlazados, SUNAT creado) | 2 | CxP limpia para el lote del 6-nov |
| 3 | Diseño de #9 viáticos y #11 unidades (sin cargar todavía) — **hecho el 13-oct** (`docs/DISENO-VIATICOS-Y-UNIDADES.md`) | 2 | Especificación lista para el sprint 5 |

**Avance (12-oct, semana 1 ejecutada por adelantado).** Scripts en `scripts/semana1-conexiones/` (dry-run con rollback y luego commit). Resultado: 37 proyectos (26 nuevos desde los CDC; MSS-30 y MDI con nombre inferido, confirmar con Operaciones), 41 de 79 CDC con proyecto (los 38 restantes son de administración/tributos y no deben tenerlo), 1,899 pagos históricos por S/ 60.4 M ya caen en su proyecto, 0 facturas sin proveedor (703 fichas mínimas `migrado_de = 'sire'`, sin cuenta bancaria), 858 facturas del SIRE con CDC heredado del pago, 1,103 de 1,448 compromisos nativos con CDC, cero asientos nuevos. Detalle en `docs/CONTEXTO-SESION.md` (2026-10-12, semana 1).

**Avance (12-oct, semana 2 · #4).** `scripts/semana2-ingresos/`: 16 valorizaciones de ejemplo borradas, 13 reales cargadas (S/ 77.8 M pagadas + 12.1 M presentadas), dedupe valorización vs CIPRL del Excel al ±8 % (migración `20261012170000`), `flujo-import` v10 resincroniza valorizaciones y mapea GCUZCOAMBU/MPCUSCOPNP/MSS; `proyectos.monto_cobrado` desde el Seguimiento 05.10.26. Detalle en `docs/CONTEXTO-SESION.md` (2026-10-12, semana 2 parte 1).

**Avance (12-oct, semana 2 · #5).** 936 comprobantes emitidos 2025-01→2026-09 (734 facturas, 202 NC; 464 vivas 2026 contabilizadas), 22 clientes creados en el CRM, 221 facturas con proyecto; las ventas a las financistas OXI (Amazonas Corporation, E.I.G.R., Fondo Investa, Alihcom…) esperan que Operaciones diga qué proyecto financia cada una. Detalle en `docs/CONTEXTO-SESION.md` (2026-10-12, semana 2 parte 2).

**Avance (13-oct, semana 2 · #6).** 1,330 movimientos registrados con `bancos_registrar_movimiento` (ITF 652, comisiones 497, cambio de moneda 86, abonos 76, SUNAT 19). El saldo ERP aún no cuadra con el banco: faltan 228 movimientos que requieren a Finanzas (102 OPE errados, compras grandes de vehículos, préstamos) y 7 cambios de moneda de enero que el Excel registró con el signo contrario. Detalle en `docs/CONTEXTO-SESION.md` (2026-10-13).

**Avance (13-oct, semana 3).** Dos Excel de revisión entregados (Finanzas/Contabilidad y Operaciones/Compras; se regeneran con `scripts/semana3-cierre/0-informes-revision.mjs`). CDC sugerido en Facturas de proveedores (98 de 248 conformes con sugerencia; Contabilidad confirma), "Pagar facturas" desde Bancos para los pagos de set-oct hechos fuera del ERP, acreedores de obligaciones enlazados a proveedores (faltan 5 sin RUC/DNI). Con esto termina el plan de tres semanas: lo que queda es trabajo de las áreas sobre los Excel de revisión.

Después de eso el análisis que pide Gerencia (gasto y margen por proyecto, flujo real vs previsto, deuda por
acreedor, proveedores concentrados) se puede construir sobre tablas conectadas, y la capa `dw` del sprint 5
deja de ser una promesa.

---

## 5. Lo que NO conviene cargar (o no todavía)

- Los `PAGOS ddmmaaaa.xlsx` de setiembre-octubre como transacciones: duplicarían el extracto ya importado;
  se concilian desde Bancos.
- Las hojas "COMPRAS A DECLARAR" y "BIENES Y DET" por separado: son recortes del mismo SIRE (ya se unen).
- `Pagos 2026 acumulado.xlsx` (29 KB): es un resumen de enero; la fuente completa es "con CC".
- Las 12 copias del `Seguimiento de proyectos`: solo la última; el historial semanal lo dará el ERP.
- Las órdenes de embargo de SUNAT (S/ 639,171 a terceros): son retenciones ordenadas, no una deuda por pagar;
  se anotan en la obligación tributaria como observación hasta que Contabilidad las concilie.
- Remuneraciones, legajos y datos de salud: fuera del ERP.
