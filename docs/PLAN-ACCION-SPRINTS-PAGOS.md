# Plan de acción por sprints: pagos primero, luego datos para Gerencia

> Fecha: 2026-10-07. Prioridad fijada por Kevin: el circuito de pagos (sección 11 de
> [PLAN-DATOS-GERENCIA.md](PLAN-DATOS-GERENCIA.md)) va primero; detrás, el cierre del desfase
> Excel → ERP, la capa analítica, los indicadores, Power BI y el botón de presentaciones.
>
> Sprints de una semana (lunes a viernes). Cada sprint termina con una demo con datos reales y un
> criterio de "hecho" verificable. Feriados que caen dentro: jueves 8 de octubre, lunes 8 y
> martes 9 de diciembre.

---

## Regla de juego durante los sprints 1 a 3: paralelo, no reemplazo

Mientras se construye, **el Excel de pagos sigue siendo el oficial**. Cada lote real de la semana
se arma también en el ERP y se comparan los netos. Solo cuando dos lotes seguidos cuadren al
céntimo (sprint 3), el primer lote de noviembre se arma **solo en el ERP** y el Excel se apaga para
pagos. Así nadie paga mal por un error del sistema nuevo y el equipo aprende con sus propios
datos.

Participantes: Kevin (dueño del plan y decisiones), Miguelángel (arma lotes), Contabilidad
(Carolina / wbendezu: valida y concilia), Shirley (paga y marca pagado), Antonio o quien el GG
designe para las decisiones financieras.

---

## Calendario

| Sprint | Semana | Tema | Resultado al viernes |
|---|---|---|---|
| 0 | 7 al 10 oct (3 días) | Decisiones y datos maestros | Todo lo que el sprint 1 necesita, decidido y cargado |
| 1 | 13 al 17 oct | Lote de pago: armar y validar | El lote del 16/10 armado en el ERP y validado por Contabilidad, en paralelo al Excel |
| 2 | 20 al 24 oct | Tesorería: exportar, pagar, registrar | El lote del 23/10 pagado y registrado en el ERP con vouchers; saldo de cuentas vivo |
| 3 | 27 al 31 oct | Bancos: importar y conciliar | Setiembre y octubre conciliados; acumulado por CC generado por el ERP; histórico ene–ago cargado |
| 4 | 3 al 7 nov | Corte a ERP + desfase del flujo | Primer lote de noviembre solo en el ERP; flujo importado 2×día; reconciliación Excel vs ERP visible |
| 5 | 10 al 14 nov | Capa analítica `dw` | Esquema en estrella, fotos diarias, rol de lectura; Préstamo Socios reproducido desde SQL |
| 6 | 17 al 21 nov | Catálogo de indicadores | Los 13 indicadores como vistas/funciones, probados contra el Excel; `/bi/gerencia` leyendo de `dw` |
| 7 | 24 al 28 nov | Power BI (si hay licencias) o informes en el ERP | 4 informes conectados a `dw`, con actualización programada |
| 8 | 1 al 5 dic | Botón de presentaciones | PPTX + PDF con plantilla Memphis desde `/bi`, guardado en SharePoint |
| 9 | 10 al 12 dic (3 días) | Modo TV y estabilización | Dashboard de Adrián leyendo del ERP o archivado; lista de pendientes cerrada |
| 10+ | desde el 15 dic | "El ERP manda" | Las áreas registran compromisos directo; importadores apagados por área |

---

## Sprint 0 · 7 al 10 de octubre · Decisiones y datos maestros

Sin esto el sprint 1 arranca a ciegas. Son tres días porque el jueves es feriado.

**Decisiones (Kevin, con quien corresponda):**

1. Desde qué lote se arma en el ERP en paralelo: propuesta, el del jueves 16 de octubre.
2. Quién corrige tasas de detracción o retención dentro del lote: propuesta, solo Contabilidad, con motivo.
3. Si se permiten líneas sin factura (adelantos, letras) y con qué tope o aprobación.
4. Saldos de las cuentas BBVA 806 (soles) y 830 (dólares) al 1 de enero de 2026, y de la cuenta de detracciones del Banco de la Nación.
5. Quién registra recepciones y facturas en el ERP y desde qué fecha (la séptima decisión del plan general; no bloquea pagos, pero sí la cadena completa).

**Datos (Miguelángel y Contabilidad, con ayuda de Kevin):**

- Completar en el ERP banco, cuenta, CCI, moneda y tipo de cuenta de los proveedores a los que se paga cada semana. Hoy hay 139 proveedores; la hoja `proveedores` del Excel de pagos es la exportación y sirve de checklist.
- Marcar en cada proveedor si está sujeto a detracción (y con qué código y tasa), si Memphis le retiene el 3 % y, en recibos por honorarios, si tiene suspensión vigente y hasta cuándo.
- Entregar el acumulado de Contabilidad de enero a agosto (`Pagos acumulados 2026 con CC`) en su última versión, para cargarlo en el sprint 3.

**Hecho cuando:** las cinco decisiones están escritas en `CONTEXTO-SESION.md`, los proveedores de los últimos tres lotes tienen cuenta y condición tributaria completas, y los saldos iniciales están confirmados por Contabilidad.

---

## Sprint 1 · 13 al 17 de octubre · Lote de pago: armar y validar

> **Avance 7-oct:** construido y probado en base y navegador (ver CONTEXTO-SESION 2026-10-07). Incluye ya el "Marcar pagada"
> con voucher y la exportación para el banco del sprint 2. Falta: datos maestros del sprint 0 y la prueba en paralelo con el lote real del 16/10.

**Objetivo:** que Miguelángel arme el lote en el ERP y Contabilidad lo valide ahí, sin Excel de ida y vuelta.

**Se construye:**

- Tabla `cuentas_bancarias` de Memphis (BBVA 806 PEN, BBVA 830 USD, Banco de la Nación detracciones) con saldo inicial y fecha; `transacciones.cuenta_id` pasa a apuntar ahí.
- Tablas `lotes_pago` y `lotes_pago_items` con estados `borrador → en_revision → validado → por_pagar → pagado → conciliado`, bitácora de cambios por línea y numeración `LP-2026-NNN`.
- Parámetros SUNAT en `parametros_financieros`: tasas de detracción por código, tope de S/ 700, retención 3 %, honorarios 8 %.
- Cálculo en SQL por línea: detracción (con conversión a soles al TC SUNAT del día si la factura es en dólares), retención, honorarios y neto; alertas (moneda distinta a la cuenta, sin CCI, saldo de factura menor al monto, sin comprobante).
- Pantalla **Cuentas por pagar → Nuevo lote**: selección desde `v_cxp` con filtros (vence hasta, proyecto, proveedor), líneas sin factura aplicadas a una OC o compromiso, totales por moneda.
- Pantalla de revisión para Contabilidad: corrige tasa o condición con motivo, "Validar". Notificaciones a Miguelángel y a Contabilidad en cada cambio de estado.
- Permisos: `finanzas.lotes_armar` (Compras), `finanzas.lotes_validar` (Contabilidad).

**Demo del viernes 17:** el lote real del jueves 16 armado en el ERP por Miguelángel, validado por Contabilidad, y una tabla línea por línea comparando el neto del ERP con el del Excel `-validado`. Toda diferencia explicada.

**Hecho cuando:** el lote queda en estado `validado` sin que ningún archivo haya viajado por correo, y las diferencias con el Excel son cero o están atribuidas a un dato maestro corregido.

---

## Sprint 2 · 20 al 24 de octubre · Tesorería: exportar, pagar, registrar

> **Ajuste 7-oct** (ver [ANALISIS-Carpetas-Contabilidad-Finanzas.md](ANALISIS-Carpetas-Contabilidad-Finanzas.md)): se agrega el `.txt` R13.2 de
> pago masivo de detracciones del Banco de la Nación generado desde el lote, la importación del CSV de constancias de SUNAT y la
> pantalla de detracciones pendientes de depósito. El sprint 3 carga 2024–2026 (no solo 2026) e importa el SIRE de compras mensual.

**Objetivo:** que Shirley reciba el lote validado, lo pague en BBVA y lo deje registrado en el ERP con voucher, y que el saldo de cada cuenta se mueva solo.

**Se construye:**

- Estado `por_pagar` con notificación a Shirley.
- **Exportar para el banco**: Excel en el orden en que ella digita: BBVA mismo banco, luego interbancarias por CCI, soles y dólares separados; hoja aparte con los depósitos de detracción al Banco de la Nación (RUC, código, monto, periodo). Formato de archivo masivo BBVA preparado por si algún día hay banca premium.
- **Marcar pagada** por línea: fecha, cuenta de origen, n.º de operación, voucher (imagen o PDF a Storage). Llama a `registrar_pago_compromiso`, descuenta la factura, inserta la detracción con constancia y la retención con comprobante, mueve el saldo de la cuenta.
- Pago parcial: la línea puede pagar menos que el saldo; la factura queda abierta con el resto.
- Pantalla de cuentas bancarias: saldo actual por cuenta y movimientos del ERP.
- El lote pasa a `pagado` cuando todas sus líneas están marcadas.

**Demo del viernes 24:** el lote del jueves 23 pagado por Shirley y marcado en el ERP; los saldos de las dos cuentas BBVA coinciden con la banca por internet al cierre del día; las detracciones del lote aparecen en su pantalla con constancia.

**Hecho cuando:** ningún pago de la semana existe solo en el Excel, y el saldo del ERP cuadra con el banco.

---

> **Avance 8-oct (sprint 2):** archivo de pago masivo de detracciones BN, importación de constancias SUNAT y pantalla
> `/finanzas/detracciones` construidos y probados. Queda del sprint 2: probarlo con el lote real del 16/10 y el número de la cuenta BN de Memphis.

## Sprint 3 · 27 al 31 de octubre · Bancos: importar y conciliar

**Objetivo:** que Contabilidad deje de reconstruir pagos a mano desde PDFs.

**Se construye:**

- Tabla `movimientos_bancarios` e **importador del "Histórico de Movimientos" de BBVA** (el mismo Excel `BANCOS2026`, una hoja por cuenta y mes): fecha de operación, fecha valor, código, n.º documento, concepto, importe, oficina; duplicados detectados por cuenta + n.º de operación.
- **Conciliación**: cruce automático por n.º de operación; si no hay, por importe y fecha con tolerancia de un día; lo no cruzado se clasifica con un clic (ITF, comisión, cambio de moneda, abono de cliente, caja chica, otro) y recibe centro de costo.
- Vistas `v_pagos_acumulados` (por CC y categoría) y `v_pagos_por_mes` (con y sin cambio de moneda), que reemplazan las hojas `RESUMEN CC` y `RESUMEN MES` del acumulado; exportación a Excel.
- **Carga histórica**: importador de un día para `Pagos acumulados 2026 con CC` (enero a agosto, 1,194 filas), enlazando con facturas y OC por número cuando existan, para tener el año completo.
- Adjuntos: estado de cuenta mensual (PDF) al periodo; vouchers a la transacción.

**Demo del viernes 31:** setiembre y octubre importados y conciliados; el acumulado por CC del ERP comparado con el de Contabilidad para ambos meses; enero a agosto cargados.

**Hecho cuando:** dos lotes seguidos (16 y 23 de octubre) cuadraron al céntimo con el Excel y el acumulado del ERP coincide con el de Contabilidad para setiembre. Esa es la condición para el corte del sprint 4.

> **Avance 9-oct (sprint 3):** importador BBVA y conciliación (`/finanzas/bancos`), carga histórica 2024-2026 (3,346 pagos) e
> importador del SIRE de compras (botón "Importar SIRE" en `/compras/facturas`) construidos y probados. Queda del sprint 3: que
> Finanzas fije el saldo inicial de las cuentas 806/830, importe `BANCOS2026` y se compare el acumulado por CC con el de Contabilidad.
> **9-oct (tarde):** `BANCOS2026` importado (agosto y setiembre de soles reubicados: el Excel traía cabecera de la 830), conciliación por
> grupo de operación (1,092 de 1,194 pagos 2026 cruzados), SIRE de compras 2024-2026 cargado (6,412 facturas; 210 de setiembre
> quedan como deuda viva, el resto pagadas o "históricas") y 1,458 constancias de detracción. Falta: saldo inicial 806/830.

---

## Sprint 4 · 3 al 7 de noviembre · Corte a ERP y cierre del desfase del flujo

**Objetivo:** apagar el Excel de pagos y que el flujo financiero del ERP deje de estar dos semanas atrás.

**Se construye:**

- **Corte**: el lote del jueves 6 de noviembre se arma, valida, paga y registra solo en el ERP. El Excel de pagos queda como respaldo de lectura.
- Cron `flujo-import` dos veces al día para las cuatro bases (patrón de `fianzas-import`), hora de última lectura en pantalla, botón "Actualizar desde el Excel".
- Pantalla de **reconciliación Excel vs ERP** por área y mes: filas que no cuadran, con la causa.
- Unificación de `Flujo GM` y `Flujo GM Directorio`: el Directorio pasa a ser una vista del ERP, no un segundo archivo.
- Pantalla de **despacho a proyecto** y transferencia entre proyectos en Inventario (los pasos 6 y 14 del flujo de Kevin), para que las recepciones que empiecen a registrarse alimenten el kardex.

**Demo del viernes 7:** el lote del 6/11 completo en el ERP; el flujo de octubre del ERP y del Excel comparados en la pantalla de reconciliación con cero filas sin explicar.

**Hecho cuando:** Miguelángel, Contabilidad y Shirley confirman que no abrieron el Excel de pagos esa semana.

> **Avance 9-oct (sprint 4, parte 1):** cron `flujo-import-2xdia` (06:00 y 15:00) con bitácora y "última lectura" en pantalla, botón
> "Actualizar desde el Excel", y pantalla `/finanzas/reconciliacion` (Excel vs ERP por área y mes con la causa de cada fila). Queda:
> Flujo GM Directorio como vista del ERP, despacho a proyecto y transferencia entre proyectos, deuda tributaria y mutuos como compromisos.
>
> **Avance 9-oct (sprint 4, parte 2):** despacho a proyecto y transferencia entre proyectos (`/inventario/despacho`, DSP-AAAA-NNNN) y
> "Vista directorio" (KPI mensual + exportación por área) dentro de Flujo Gerencia: el Directorio deja de ser un segundo archivo. Queda:
> corte del lote del 6-nov, deuda tributaria y mutuos como compromisos, comprobante de retención, registro masivo de ITF/comisiones/abonos.

---

## Sprint 5 · 10 al 14 de noviembre · Capa analítica `dw`

- Esquema `dw`: `dim_fecha`, `dim_proyecto`, `dim_centro_costo`, `dim_proveedor`, `dim_area`, `dim_partida`; `hecho_compromiso`, `hecho_orden`, `hecho_caja_chica`, `hecho_presupuesto`, `hecho_valorizacion`, `hecho_pago` (nuevo, sale de los sprints 1 a 3). Vistas materializadas refrescadas tras cada importación.
- `dw.snapshot_flujo`: foto diaria del flujo proyectado, con fecha de foto.
- Rol `analista` de solo lectura sobre `dw`, acceso por el pooler; prueba de conexión desde Power BI Desktop y desde Excel.
- Función `prestamo_socios(desde, hasta, colchón, tea)` que reproduce la hoja nueva del Flujo GM; prueba contra las cifras del 2 de octubre.

**Demo:** la propuesta de préstamo de socios calculada por el ERP con los mismos parámetros que el Excel y las diferencias explicadas; una foto diaria ya acumulando historia.

---

## Sprint 6 · 17 al 21 de noviembre · Catálogo de indicadores

- Los 13 indicadores de la sección 4.3 del plan general como vistas o funciones en `dw`, con dueño y definición escrita en una tabla `dw.indicadores`.
- `/bi/gerencia` pasa a leer de `dw` (deuda, vencido, calendario de pagos y liquidez dejan de decir "sin datos" porque los sprints 1 a 3 ya los llenaron).
- Pruebas automáticas: cada indicador contra el valor del Excel de referencia del mes.

**Demo:** el tablero de Gerencia con los indicadores encendidos y la cifra oficial igual en el ERP, en SQL y en la exportación.

---

## Sprint 7 · 24 al 28 de noviembre · Power BI (o informes en el ERP)

Depende de la decisión de licencias. Si hay Power BI Pro para 3 a 5 personas:

- Modelo semántico sobre `dw`; informes Caja y financiamiento, Proyecto 360, Compras y proveedores, Presupuesto vs ejecución; RLS por rol; actualización programada 8 veces al día; embebido en `/bi` (`powerbi-embed`).

Si no hay licencias: los mismos cuatro informes como pantallas del módulo BI con exportación, y Power BI queda para cuando se compre.

---

## Sprint 8 · 1 al 5 de diciembre · Botón de presentaciones

- En `/bi`: audiencia (Directorio, Gerencia, Operaciones), proyectos, periodo, secciones → Edge Function con pptxgenjs → PPTX y PDF con plantilla Memphis, guardados en SharePoint, con historial de presentaciones generadas.
- Primera plantilla: la sesión de directorio (resumen de caja, préstamo de socios, proyecto por proyecto, deuda y vencido).

**Demo:** la presentación del directorio de diciembre generada en dos minutos desde el ERP.

---

## Sprint 9 · 10 al 12 de diciembre · Modo TV y estabilización

- Dashboard de Adrián reconectado a `dw.v_tv_proyectos` (sin MSAL, sin parser de celdas, fotos en Storage) o archivado, según la decisión del GG.
- Cierre de pendientes de los sprints anteriores, limpieza de datos de prueba, documentación de operación para cada rol.

---

## Sprint 10 en adelante · "El ERP manda"

Área por área, en el orden en que cada una ya vea sus números correctos: Contabilidad y TI
primero (bases pequeñas), luego Administración, al final Proyectos. Cada área registra sus
compromisos directo en el ERP; su importador se apaga; su Excel pasa a ser exportación.

---

## Riesgos y cómo se controlan

| Riesgo | Control |
|---|---|
| Un pago sale mal por el sistema nuevo | Paralelo con el Excel hasta cuadrar dos lotes seguidos; el corte es una decisión explícita en el sprint 4 |
| Proveedores sin cuenta o sin condición tributaria | Checklist del sprint 0 sobre los proveedores de los últimos tres lotes; alerta en el lote si falta un dato |
| Contabilidad no valida a tiempo | Notificación por usuario y vista "lotes esperando mi validación"; el tiempo de validación se mide desde el sprint 1 |
| Decisiones financieras que no llegan (saldos iniciales, tasas) | Sprint 0 las lista; si una no llega, el sprint sigue con un valor provisional marcado como tal |
| Licencias Power BI | El sprint 7 tiene plan B dentro del ERP |
| Kevin absorbido por soporte durante los sprints | Cada sprint tiene un solo objetivo; lo que no entra se anota, no se mete a mitad de semana |

---

## Seguimiento

- Cada viernes: demo de 30 minutos con los datos reales de la semana y actualización de este documento con lo hecho, lo que no entró y la fecha.
- Cada sprint se registra en `CONTEXTO-SESION.md`.
- El GG recibe al cierre de los sprints 3, 4, 6 y 8 un resumen de una página en PDF.
