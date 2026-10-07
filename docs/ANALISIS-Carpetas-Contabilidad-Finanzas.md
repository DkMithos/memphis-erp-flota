# Carpetas "01. Contabilidad" y "04. Finanzas": qué hay y qué cambia en el plan

> Fecha: 2026-10-07. Pedido de Kevin: revisar y analizar ambas carpetas de SharePoint (sitio
> MEMPHIS MAQUINARIAS SAC - FINANZAS) antes de seguir con los sprints del plan de pagos
> ([PLAN-ACCION-SPRINTS-PAGOS.md](PLAN-ACCION-SPRINTS-PAGOS.md)).
>
> No se abrió `Contraseñas.xlsx` ni `CLAVE SOL GM.jpeg` (ver sección 6).

---

## 1. Lo que hay, en números

| Carpeta | Archivos | Tamaño | Qué domina |
|---|---:|---:|---|
| 01. Contabilidad | 23,667 | 2.3 GB | 16,369 PDF y 5,936 XML de comprobantes (2024–2026, una carpeta por mes), 266 Excel, 697 ZIP |
| 04. Finanzas | 1,030 | 5.2 GB | 3.7 GB de expedientes de financiamiento, 1.1 GB de videos, 635 PDF de estados de cuenta y vouchers, 135 Excel |

### Contabilidad: cómo está organizada

- **`2024/`, `2025/`, `2026/`**: una carpeta por mes (`9. Set 26`) con `1. Compras (PDF)` (1,044 facturas
  de setiembre nombradas `RUC-tipo-serie-número.pdf` más el **SIRE Compras** del mes en Excel),
  `2. Compras (XML)` (vacía en 2026; los 5,936 XML son de 2024 y 2025), `3. Ventas (PDF)` con el
  **SIRE Ventas**, `Retenciones` (comprobantes de retención en PDF) y el Excel mensual de
  **detracciones depositadas** (consulta de constancias de SUNAT).
- **Raíz de `2026/`**: `CONTROL DE LA DEUDA 2023-2026` (deuda tributaria con intereses, fraccionamientos y
  un pago "con embargo del BBVA"), `CONTROL DEL IGV 2026` (PDT vs SISCONT vs SIRE), `FACTURAS CON
  DETRACCIONES DEPOSITADAS POR UTILIZAR` por mes (el crédito fiscal solo se usa cuando la detracción
  está depositada), planilla, notas de crédito.
- **`AA. Txt detracciones/`**: `CONTROL DETRACCIONES PROVEEDORES 2025-2026` (1,215 facturas, 843
  depositadas, **346 pendientes por S/ 148,596**), el CSV de constancias de SUNAT 2024–2026 (1,587
  filas) y `Macro detracciones.xlsm`, la macro oficial **R13.2 de pago masivo de detracciones del
  Banco de la Nación** (genera el `.txt` de ancho fijo que se sube a SUNAT Operaciones en Línea).
- **`Copia de Listado Proveedores.xlsx`**: 100 RUC con **buen contribuyente / agente de percepción /
  agente de retención / "retención SI APLICA" al 3 %** y 127 cuentas bancarias (13 de detracciones).
- `Caja chica 2025 2026` (25 cajas ADMI0xx, soles y dólares), `CIPRL_cobrados` (25 CIPRL con mes y
  monto), `Control de facturas de compras 2024`, `Detracciones histórico 2022-2024`, `Compras SIRE
  2024-2025`, `EEFF al 31DIC2025`, declaraciones mensuales 2023–2025 en PDF, contratos de mutuo con
  terceros (Wiese, Impacto, Etramed, GM, IP, Susan) y su cálculo de interés.
- `Libros Contables/` y `DJ mensual/` están **vacías**.

### Finanzas: cómo está organizada

- **`CORREO PAGOS/<mes>/`**: los `PAGOS ddmmaaaa.xlsx` de cada semana con sus versiones (v1, v2, "(1)"):
  el circuito que el sprint 1 reemplaza. Incluye `cuentas para pago 26.08.26.xlsx`, una lista
  paralela de cuentas de proveedores con detracción y neto, armada a mano.
- **`BANCOS 2026/EECC <mes>/`**: los estados de cuenta BBVA de cada mes, en dos versiones (limpio y
  "con sustento", que son los vouchers escaneados detrás).
- **`PAGOS 2026MM.xlsx`** (uno por mes) y `Pagos 2026 acumulado` / `Pagos acumulados 2026 con CC`:
  la reconstrucción manual de Contabilidad de cada movimiento de banco con centro de costo,
  categoría, comprobante y n.º de operación. `PAGOS ACUMULADO 2024 y 2025` tiene 3,905 filas con
  detracción, retención, TC y fecha de detracción. **Esto ya existe desde 2024**: son tres años de
  pagos clasificados a mano.
- `Pagos y Bancos/`: lo mismo para 2024 y 2025, los históricos de movimientos BBVA en `.xls`
  (cuentas 456, 545, 166, 553), `PROYECCION PAGO 2024MM` (el antecesor del Flujo GM, con "saldo en
  bancos" y proyección semanal por centro de costo), cheques girados, activos y depreciación.
- `00. Financiamiento/` (3.7 GB): expedientes para factoring y líneas con Falcon, Euro Capital,
  BBVA, Alfin, Ecredit, fideicomiso. `02. Contratos Mutuos y prestamos/`: mandatos, cesiones y
  mutuos con socios y terceros. `04. Flujos y Presupuestos Proyectos/`: flujos operativos
  proyectados por proyecto (versiones de Guillermo). `07. Constancias de pagos/`: multas y
  retenciones pagadas a SUNAT.

---

## 2. Lo que esto cambia en el entendimiento del circuito

1. **Memphis sí es agente de retención del IGV y lo aplica de forma general.** El comprobante de
   retención de febrero 2026 suma **S/ 184,121 retenidos al 3 %**. La lista de Contabilidad dice a quién
   NO se le retiene (17 RUC: buenos contribuyentes, agentes de retención o de percepción) y a quién sí
   (83). El ERP tenía `sujeto_retencion` en cero para los 139 proveedores: por eso el lote del sprint 1
   salía "sin retención" con alerta. **Ya se cargó** (sección 5).
2. **Las detracciones se pagan en lote por archivo, no una por una.** La macro R13.2 del Banco de
   la Nación existe y se usa. El ERP puede generar ese `.txt` directamente desde el lote (tiene RUC,
   código de bien o servicio, cuenta de detracciones del proveedor, importe, periodo, tipo y número de
   comprobante). Eso elimina la macro y la hoja "cuentas para pago".
3. **SUNAT devuelve las constancias en CSV.** Contabilidad baja cada mes "detracciones depositadas" con
   número de constancia, fecha, monto, RUC y comprobante. Es exactamente lo que cierra el estado
   `pendiente → depositado` de la tabla `detracciones` del ERP, sin digitar.
4. **El SIRE de compras es la fuente masiva de facturas.** El de setiembre trae 315 comprobantes con
   RUC, serie, número, fechas, bases, IGV, total, moneda, TC y la marca de detracción. El ERP tiene 40
   facturas; Compras no registra las demás. Importar el SIRE mensual (y los PDF que ya están nombrados
   `RUC-tipo-serie-número`) llena `comprobantes_pago` sin esperar al portal ni a la digitación.
5. **Hay tres años de pagos clasificados** (2024, 2025 y 2026) con centro de costo, detracción y
   retención. La carga histórica del sprint 3 puede cubrir 2024–2026, no solo enero–agosto 2026.
6. **La deuda tributaria es una cuenta por pagar más**, con intereses diarios, fraccionamientos,
   multas rebajadas y un embargo. Hoy vive en `CONTROL DE LA DEUDA` y no entra en ningún flujo. El
   comité debería verla junto a la deuda con proveedores.
7. **Los préstamos con socios y terceros tienen contrato y cronograma** (mutuos, cesiones, cálculo de
   interés), y la hoja "Préstamo Socios" del Flujo GM es la última versión de esa práctica. Son
   obligaciones de caja con fecha y deberían estar en `flujo_compromisos` como `sentido = pagar`,
   origen `financiamiento`.
8. **El crédito fiscal depende de la detracción depositada.** La hoja mensual "facturas con detracciones
   depositadas por utilizar" existe porque una factura con detracción pendiente no da derecho a IGV ese
   mes. Es un indicador que el ERP puede dar solo: facturas del periodo con detracción sin depositar y el
   IGV que se posterga por eso.

---

## 3. Qué entra a cada sprint (ajuste al plan)

| Sprint | Antes | Ahora se agrega |
|---|---|---|
| 0 (esta semana) | Decisiones y datos maestros | **Hecho hoy**: condición tributaria de 99 RUC (de los 100 de la lista, uno no existe en el ERP) y 12 cuentas nuevas cargadas desde la lista de Contabilidad (sección 5). Falta: saldos iniciales y el número de la cuenta de detracciones de Memphis |
| 2 (20–24 oct) · Tesorería | Exportar para el banco, marcar pagada, cuentas con saldo | **Generar el `.txt` R13.2 de pago masivo de detracciones** desde el lote (reemplaza la macro); importar el CSV de constancias de SUNAT para cerrar las detracciones; pantalla "detracciones pendientes de depósito" con el total (hoy S/ 148,596) y las que vencen (5.º día hábil del mes siguiente) |
| 3 (27–31 oct) · Bancos | Importar histórico BBVA, conciliar, cargar ene–ago 2026 | Carga histórica **2024–2026** desde `PAGOS ACUMULADO 2024 y 2025` + `Pagos acumulados 2026`; **importador del SIRE de compras mensual** (crea o completa `comprobantes_pago` y enlaza con OC por RUC + monto + fecha); los PDF de comprobantes se enlazan por nombre de archivo |
| 4 (3–7 nov) | Corte a ERP, cron del flujo | Comprobante de retención mensual generado desde el ERP (hoy sale de SUNAT con los pagos digitados); registro de la **deuda tributaria** y de los **préstamos/mutuos** como compromisos con fecha e interés |
| 6 · Indicadores | 13 indicadores | Tres más: detracciones pendientes y vencidas, IGV postergado por detracción sin depositar, deuda tributaria con interés acumulado |

Lo que no cambia: el orden de los sprints ni el paralelo con el Excel hasta cuadrar dos lotes.

---

## 4. Formatos que el ERP tiene que leer o escribir (para no reinventarlos)

| Formato | Dirección | Dónde está el ejemplo | Campos clave |
|---|---|---|---|
| Pago masivo de detracciones BN (R13.2, ancho fijo) | ERP → SUNAT | `AA. Txt detracciones/Macro detracciones.xlsm`, hoja `2_Registros_PD` (posiciones 01-01 tipo doc, 02-12 RUC, 13-47 razón social, 48-56 proforma, 57-59 código bien/servicio, 60-70 cuenta BN del proveedor, 71-85 importe, 86-87 tipo operación, 88-93 periodo, 94-95 tipo comprobante, 96-99 serie, 100-107 número) | Cabecera con RUC, lote y secuencia; sumas de control |
| Constancias de detracción (CSV `;`) | SUNAT → ERP | `Detracciones D. 2024-2025-2026.csv` y los Excel mensuales | Nº constancia, periodo, RUC proveedor, fecha de pago, monto, tipo bien, serie y número de comprobante |
| SIRE Compras / Ventas (xlsx) | SUNAT → ERP | `2026/9. Set 26/1. Compras (PDF)/09-2026 SIRE COMPRAS…xlsx` | 77 columnas: periodo, fechas, tipo, serie, número, RUC, razón social, bases, IGV, total, moneda, TC, detracción, estado |
| Histórico de movimientos BBVA (xlsx/xls) | BBVA → ERP | `BANCOS2026.xlsx`, `Pagos y Bancos/13. ESTADOS DE CUENTA BANCARIOS/*.xls` | F. operación, F. valor, código, n.º doc, concepto, importe, oficina |
| Pagos clasificados (xlsx) | Contabilidad → ERP (carga única) | `PAGOS ACUMULADO 2024 y 2025.xlsx` hoja CAJA (3,905 filas), `Pagos acumulados 2026 con CC.xlsx` hoja DATA | CC, categoría, tipo y número de comprobante, razón social, soles, dólares, detracción, retención, TC, n.º operación, fecha de pago |
| Comprobante de retención (xlsx de SUNAT) | SUNAT → ERP | `Retenciones/RETENCIONES FEBRERO2026.xlsx` | Serie, número, proveedor, fecha, total, n.º pago, importe pagado, retención, neto |
| PDF de comprobantes | Carpeta → ERP | `2026/<mes>/1. Compras (PDF)/RUC-tipo-serie-numero.pdf` | El nombre del archivo basta para enlazar con `comprobantes_pago` |

---

## 5. Cargado hoy en el ERP (migración `20261007220000_proveedores_condicion_tributaria_contabilidad`)

- Columnas nuevas en `proveedores`: `buen_contribuyente`, `agente_retencion`, `agente_percepcion`.
- Desde la lista de Contabilidad, por RUC: 82 proveedores con `sujeto_retencion = true`, 17 exentos
  marcados con su causa; los otros 40 de los 139 quedan "sin condición definida" (el lote lo avisa y
  Contabilidad lo corrige o completa el directorio).
- 12 cuentas bancarias que el ERP no tenía (de 127 en la lista; el resto ya estaba), añadidas al arreglo `cuentas_bancarias` con origen
  `contabilidad_2026-10` (no se borró ni reemplazó ninguna). Quedan sin cargar dos cuentas Interbank
  que en la lista solo tienen CCI (MSCA y GAIA) y las "recaudadoras" de Peruana de Motores (códigos
  960 / 9494, no son cuentas).

---

## 6. Observaciones que conviene atender fuera del plan

- **`Contraseñas.xlsx` en la raíz de Contabilidad y `CLAVE SOL GM.jpeg` en `GUILLERMO MACHER/`**: credenciales
  en una carpeta compartida de SharePoint. Deberían moverse a un gestor de contraseñas y borrarse de ahí;
  la Clave SOL da acceso a toda la operación tributaria de la empresa.
- Carpetas vacías o sin uso: `Libros Contables/` (2023–2025 sin archivos), `DJ mensual/`, `Nueva carpeta/`,
  `CORREO PAGOS/Abril, Mayo, Junio, Julio 26` vacías (los PAGOS de esos meses están en otro lado o se
  perdieron).
- `2. Compras (XML)` y `4. Ventas (XML)` de 2026 están vacías: los XML de 2026 no se están guardando, y
  el XML es lo que el ERP lee para calcular detracción y retención sin digitar.
- `Copia de Listado Proveedores.xlsx` tiene RUC repetidos (115 filas, 100 RUC) y un RUC de 12 dígitos
  (`107345501536`, Geremie Calluco), que no cruza con nada.
- `04. Flujos y Presupuestos Proyectos/Guillermo/Socios Cierre 2024.xlsx` y `Facturacion Societaria` son
  insumos de la propuesta de préstamo de socios; conviene que el GG sepa que existen.

---

## 7. Referencias

- Copias de trabajo usadas para el análisis: scratchpad de la sesión (no se modificó ningún archivo de SharePoint).
- Plan general: [PLAN-DATOS-GERENCIA.md](PLAN-DATOS-GERENCIA.md) · Sprints: [PLAN-ACCION-SPRINTS-PAGOS.md](PLAN-ACCION-SPRINTS-PAGOS.md).
