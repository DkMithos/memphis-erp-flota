# Revisión de carpetas: qué está al día y qué está desfasado (2026-11-05)

> Pedido de Kevin: "revisa la carpeta de contabilidad, los archivos que aún no se han actualizado de proyectos, de
> administración, revisa todas las carpetas porque el personal no está subiendo la información y parece que está
> desfasado". Se recorrieron las siete carpetas de OneDrive/Teams leyendo solo nombre y fecha de modificación de cada
> archivo (87,033 archivos); no se abrió ningún documento salvo las hojas del `BANCOS2026.xlsx` para ver qué meses trae.
> Después se cruzó con lo que el ERP tiene cargado. Fecha de corte: 5 de noviembre de 2026.

## 1. Resumen por área

| Área (carpeta) | Archivos | Tocados en 30 días | Veredicto |
|---|---:|---:|---|
| Contabilidad (01. Contabilidad) | 24,694 | 860 | **Al día en compras**; faltan SIRE Ventas de set/oct, detracciones depositadas desde el 7-oct y no hay XML desde agosto |
| Finanzas (04. Finanzas) | 1,037 | 32 | **Atrasada un mes**: no hay extracto de octubre en dólares, no hay `PAGOS 202610`, el acumulado quedó en el 21-oct |
| Administración | 1,313 | 37 | **Al día** (caja chica, viajes, fianzas, planilla, vacaciones); boletas solo hasta enero |
| Flujo Financiero | 15 | 8 | **Al día** (los cuatro Excel se tocaron entre el 23-oct y hoy y el ERP los lee solo) |
| Proyectos (General - PROYECTOS) | 15,569 | 1,137 | **Al día en carpetas**, pero el ERP está desfasado en valorizaciones (ver 6) |
| Operaciones (Teams - General) | 44,401 | 1 | **Archivo muerto** salvo el control de mantenimiento de Ica; los demás son contratos cerrados 2019-2024 |
| Operaciones Team | 4 | 1 | `RESUMEN PROYECTOS.xlsx` actualizado el 4-nov |

## 2. Contabilidad

Mes a mes en `2026/`:

| Mes | PDF compras | SIRE compras | SIRE ventas | XML | Detracciones depositadas (Excel) |
|---|---:|---|---|---:|---|
| Junio | 493 | sí (28-oct) | sí (8-set) | 1,227 | sí (18-jul) |
| Julio | 785 | sí (3-nov) | sí (4-nov) | 712 | sí (21-ago) |
| Agosto | 351 | sí (2-nov) | sí (27-oct) | 520 | **no** |
| Setiembre | 1,044 | sí (16-oct) | **no** | 201 | sí, solo del 8-set al 6-oct (12-oct) |
| Octubre | 385 (hasta hoy) | **sí, subido hoy 5-nov** | **no** | **0** | **no** |
| Noviembre | 0 | — | — | 0 | — |

- **Lo que está al día**: los PDF de compras de octubre (385, el último de hoy), el SIRE Compras de octubre (subido hoy),
  `CONTROL DEL IGV 2026` (3-nov), `CONTROL DE LA DEUDA 2023-2026` (2-nov), planilla ene-oct y CTS (3-nov), el control de
  detracciones y el CSV de constancias de SUNAT (3-nov), refinanciamientos (25 archivos del 2-nov).
- **Lo que falta**: SIRE Ventas de setiembre y octubre (los PDF de ventas sí están: 202 en setiembre, 0 en octubre); el
  Excel de detracciones depositadas de agosto y de octubre (la última ventana cubre hasta el 6-oct); los XML de
  compras no se suben desde agosto (setiembre trae 201 frente a 1,044 PDF; octubre ninguno). `Libros Contables/` y
  `DJ mensual/` siguen sin uso para 2026 (lo que hay es de 2025).
- **El ERP tiene SIRE hasta setiembre** (410 facturas del periodo 202609). El SIRE Compras de octubre que subieron hoy
  todavía no está cargado: cuando lo confirmes se importa por `/compras/facturas › Importar SIRE` (o lo cargo yo).
  Constancias de detracción en el ERP: última del 25-set (el CSV del 3-nov puede traer más: reimportar).

## 3. Finanzas

- **Extractos (`BANCOS 2026/EECC <mes>/`)**: la última carpeta es `EECC SETIEMBRE 2026` (15-oct). **No existe la de
  octubre.** En `BANCOS2026.xlsx` (modificado hoy) sí está la hoja `806 202610 PEN` con 207 movimientos del 1 al 30 de
  octubre, pero **no la hoja `830 202610 USD`**. El ERP tiene bancos hasta el 30-set en las dos cuentas: nadie importó
  octubre todavía y Finanzas aún no cierra dólares.
- **`PAGOS 2026MM.xlsx`** (reconstrucción mensual de pagos con centro de costo): existen de enero a setiembre; los de
  febrero a setiembre se retocaron el 4 y 5 de noviembre, pero **no hay `PAGOS 202610`**. `Pagos acumulados 2026 con
  CC` quedó en el 21-oct y `Pagos 2026 acumulado` en el 1-oct.
- **`CORREO PAGOS/`**: la carpeta `Oct 26` tiene las solicitudes del 2, 15, 20 y 22 de octubre (subidas el 2-nov).
  Nada de noviembre. Este circuito lo reemplazan los lotes de pago del ERP, que **siguen en cero**: Finanzas sigue
  pidiendo pagos por Excel y correo.
- Carpetas históricas sin movimiento (normal): `00. Financiamiento` (jun-2025), `02. Contratos Mutuos` (oct-2025),
  `04. Flujos y Presupuestos Proyectos` (ene-2025), `01. Estados Financieros` (abr-2025), `CORREO VENTAS` (jun-2026).

## 4. Administración

Está al día y además sincronizada con el ERP:

- **Caja chica**: `CAJA_32_SOLES` (2-nov) y rendición de la caja 19 dólares (4-nov). En el ERP la caja 33 soles está
  activa con gastos al 4-nov y la 20 dólares al 3-nov: la sincronización automática funciona.
- `CONTROL DE VIAJES 2026` (4-nov), `STATUS DE FIANZAS ACTUALIZADO 2026` (2-nov; el ERP la lee sola, 16 cartas, última
  sincronización hoy), `Control de vacaciones` (2-nov), `Libro Remuneraciones Octubre 2026` (3-nov), `Pago Planilla
  Octubre` (26-oct), `CUADRO DE PAGOS MM CARO` (22-oct), `Pago bbva/Pago Octubre 2026` (26-oct), EPS hasta octubre,
  legajos de trabajadores (28-oct).
- **Lo único viejo**: `Control personal/Boletas/` solo tiene enero 2026 (las boletas salen de BUK, no es grave);
  `Políticas laborales` y `INFORMACION NICOLAS` sin cambios desde mayo (normal); `Gastos oficina/Planillas` mezcla
  planillas 2025 que se volvieron a subir el 2-oct (duplicado de `Planilla/`).

## 5. Flujo Financiero

Los cuatro archivos que alimentan el ERP están vivos: `Flujo de proyectos` (hoy), `Flujo Administración` (4-nov),
`BD CONTA 2026` (2-nov), `Flujo GM` (2-nov), `BD TI 2026` (23-oct). El ERP los importó hoy a las 14:15 sin errores.
Los `BackUp/` y `Repositorio/` son copias antiguas (jul-2026 y antes). Nada que reclamar aquí.

## 6. Proyectos

Las carpetas sí se actualizan; lo que está desfasado es el ERP.

- `07.PROYECTOS - RESUMEN`: `15.Seguimiento de proyectos 02.11.26.xlsx` (3-nov), es decir, el seguimiento semanal
  sigue al día (15 versiones desde julio). `PROYECTOS - TOTALES` quedó en el 29-set.
- `02. PROYECTOS EN EJECUCIÓN` (8 proyectos): todos con archivos de los últimos días. Última valorización en carpeta
  contra la última que tiene el ERP (cargadas una sola vez el 12-oct desde el Excel de ingresos):

| Proyecto | Última valorización en carpeta | En el ERP | Atraso |
|---|---|---|---|
| GORE Huánuco patrulleros | N.º 17 (3-nov) | N.º 13 | 4 |
| GORE Loreto bomberos | N.º 13 (4-nov) | N.º 3 | 10 |
| GORE Amazonas mix | N.º 9, octubre (2-nov) | N.º 6 | 3 |
| GORE Cusco ambulancias 59 | N.º 8 (7-oct) | N.º 7 | 1 |
| GORE Cusco patrulleros | N.º 6 (16-oct) | N.º 4 | 2 |
| Muni Cusco 20 camionetas + bus | N.º 7 (ago) | N.º 7 | 0 |
| GORE Cusco ambulancias acuáticas | N.º 5 (8-set) | ninguna | 5 |
| Bomberos San Martín | sin valorizaciones aún | — | — |

  Son 25 valorizaciones presentadas o cobradas que el ERP no conoce. Esto es lo que más distorsiona Dirección (cobrado,
  por cobrar y el flujo de caja de proyectos): Operaciones trabaja en las carpetas y nadie registra en `/proyectos`.
- `03. PROYECTOS - LIQUIDACIÓN`: sin cambios desde el 29-set (Ica), 23-set (Loreto PNP) y 10-ago (Loreto ambulancias).
  Si siguen en liquidación, hace cinco semanas que nadie sube nada.
- `09. LOGISTICA/4. Pagos`: `PAGOS 29102026.xlsx` y `PAGOS 21102026` (29 y 30-oct) y constancias del 20-oct. Operaciones
  también sigue pidiendo pagos por Excel en vez de lotes del ERP.
- `0.0 PROYECTOS EN IDEA`: Piura hospitales (hoy), Huaral (4-nov), Loreto y San Martín (3-nov): activo.

## 7. Operaciones (Teams - General)

44,401 archivos, 1 tocado en 30 días: `CONTROL DE MANTENIMIENTO CAMIONETAS ICA.xlsx` (4-nov). `MSS SERVICIO JOY`,
`KIA`, `COLORADO`, `MUNICIPALIDAD DE INDEPENDENCIA` e `INMUEBLES PANAMERICANA` son contratos cerrados (último
movimiento entre 2024 y julio-2026). El control de motos de Ica (`Cumplimiento mantenimientos preventivo Motos`) quedó
en el 30-jul y `Control de Mantenimientos Motos - Camioneta` en el 31-jul: **tres meses sin actualizar** si el
contrato de postventa de Ica sigue vivo. Los mantenimientos de flota deberían ir al módulo Flota del ERP, no al Excel.

## 8. Qué pedir y a quién

| Prioridad | Qué | Responsable | Dónde termina |
|---|---|---|---|
| 1 | Extracto BBVA de octubre (soles y **dólares**) a `BANCOS 2026/EECC OCTUBRE 2026` y la hoja `830 202610 USD` en `BANCOS2026.xlsx`; luego importar octubre en `/finanzas/bancos` | Finanzas | Bancos y facturas pagadas del ERP (hoy 247 facturas conformes figuran vencidas sin pago) |
| 1 | Registrar en `/proyectos` las 25 valorizaciones que faltan (ver tabla del punto 6) o decidir que el ERP las lea del Excel de seguimiento | Operaciones (Miguelángel) | Dirección: cobrado y por cobrar |
| 2 | SIRE Ventas de setiembre y octubre; detracciones depositadas de agosto y del 7-oct en adelante; XML de compras de set/oct | Contabilidad | Importar SIRE y constancias en el ERP |
| 2 | Importar al ERP el SIRE Compras de octubre que subieron hoy | Contabilidad o yo | `/compras/facturas` |
| 2 | `PAGOS 202610.xlsx` y acumulado al cierre de octubre (o dejar de hacerlos y usar lotes de pago) | Finanzas / Contabilidad | Lotes de pago del ERP (hoy 0) |
| 3 | Controles de mantenimiento de Ica (motos y camionetas) desde agosto | Operaciones (postventa) | Módulo Flota |
| 3 | Confirmar si los tres proyectos en liquidación siguen abiertos (sin archivos desde set) | Operaciones | Estado del proyecto en el ERP |

Lo que **no** hay que reclamar: Administración, Flujo Financiero y las carpetas de proyectos en ejecución e idea están
al día; Contabilidad sube las compras y los controles con normalidad.

## 9. Cómo se hizo

Inventario con `scan.py` (os.walk sobre las siete carpetas, solo `stat`), resumen con `analyze.py`/`detalle.py`
(scratchpad de la sesión). Cruce con el ERP: `comprobantes_pago.periodo_sire`, `movimientos_bancarios.fecha_operacion`,
`detracciones.fecha_deposito`, `flujo_importaciones`, `gastos_caja_chica`, `fianzas.actualizado_en`, `valorizaciones`.
