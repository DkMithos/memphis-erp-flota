# Guía operativa del ERP Memphis por área

> Estado al 13 de octubre de 2026 · https://erp.memphismaquinarias.com · 14 usuarios activos · 11 roles.
> Responde a la pregunta de Gerencia: **¿ya pueden Administración, Compras, Finanzas y Contabilidad trabajar en el ERP?**
> Sí, con el alcance y las reglas que siguen. Cada sección dice qué hace el sistema, qué debe hacer el usuario, qué se puede
> importar y exportar, dónde hay paginación y dónde todavía no, y cómo resolver dudas.

---

## 1. Veredicto corto

| Área | ¿Puede operar hoy? | Con qué | Lo que todavía no está |
|---|---|---|---|
| **Compras** | **Sí** | Requerimientos, cotizaciones, órdenes con aprobación por monto, recepciones, facturas de proveedores (portal y SIRE), directorio de 843 proveedores | Nada bloqueante. 703 proveedores creados desde el SIRE necesitan cuenta bancaria y condición antes de pagarles por lote |
| **Finanzas** | **Sí** | Cuentas por pagar (1,275 pendientes), lotes de pago, detracciones, bancos (extracto BBVA importado y conciliado al 89 %), obligaciones financieras, caja chica, flujo de caja y flujo financiero | El primer lote de pago nace el 6-nov; 228 movimientos del banco esperan cruce manual |
| **Contabilidad** | **Sí** | Comprobantes recibidos y emitidos (7,394), registro de compras y ventas, libro diario con asientos automáticos (1,692), plan de cuentas, periodos | El SIRE de ventas se carga por script, aún no desde pantalla |
| **Administración** | **Sí** | Caja chica (sincronizada desde su Excel cada 30 min), fianzas (sincronizadas 2 veces al día), documentos, capacitaciones y certificados, obligaciones, flujo financiero de Administración | Viáticos y correspondencia no existen todavía (diseñados para el sprint 5); los usuarios siguen trabajando en Excel y el ERP los lee |

Regla general: **el ERP ya es la fuente para compras, pagos, bancos y facturas**. Caja chica, fianzas y el flujo financiero siguen naciendo en Excel y el ERP los sincroniza solo; no hay que cargarlos a mano.

---

## 2. Lo que todos deben saber

**Entrar.** Con el correo corporativo (@memphis.pe) y la contraseña del ERP. La primera vez aparece un tutorial de bienvenida de
pocos pasos. Si una persona no tiene cuenta, la crea el administrador del sistema en Administración › Usuarios y roles (el
botón "Contacta con soporte" de la pantalla de ingreso está deshabilitado a propósito).

**Menú y permisos.** Cada persona ve solo los módulos de su rol. Un usuario con dos roles conserva los permisos de ambos.

| Rol | Usuarios | Módulos que ve |
|---|---:|---|
| Administrador | 2 | Todo (admin, compras, contabilidad, finanzas, proveedores, proyectos, flota, inventario, fianzas, crm, biomédico) |
| Gerencia | 4 | Compras, proyectos, fianzas, flota (aprobaciones y Flujo Gerencia) |
| Contabilidad | 2 | Compras, contabilidad, finanzas, proveedores, documentos |
| Administración | 2 | Compras, finanzas, documentos |
| Compras | 1 | Compras, proveedores, finanzas, documentos |
| Proyectos | 1 | Proyectos, compras, finanzas, proveedores |
| Fianzas / Cargos Fianzas | 3 | Fianzas, documentos |
| Técnico Flota | 2 | Flota, compras |

**Qué hace el sistema solo** (sin que nadie lo pida): numera los documentos con las series del legado (RQ-, MM-, MM-S-, COT-,
REC-, OBL-, TRX-, DSP-), calcula vencimientos, crea el compromiso de pago de cada orden aprobada y de cada factura conforme,
contabiliza las facturas conformes y las ventas, avisa por la campana cuando hay algo que aprobar o vencido, lee los Excel de
caja chica, fianzas y flujo desde SharePoint, y guarda un registro de auditoría de cada cambio (35 mil eventos).

**Buscar y filtrar.** Todas las listas tienen buscador y filtros; los filtros se recuerdan al volver a la pantalla.

**Exportar.** Donde hay un botón **Excel** (arriba a la derecha de la lista) se exporta lo que se está viendo con los filtros
aplicados. Hay exportación en: requerimientos, cotizaciones, órdenes, recepciones, facturas de proveedores, comprobantes,
libro diario, transacciones, caja chica, bancos (movimientos y pagos acumulados por centro de costo), obligaciones,
reconciliación Excel vs ERP, fianzas, proyectos, valorizaciones, centros de costo, catálogos, accesos al portal, Flujo
Gerencia, reporte cruzado y KPI del directorio. Donde no hay botón (ver §8) todavía no se exporta desde pantalla.

**Paginación.** Las listas grandes van de 20 en 20 (30 en Bancos). Las que aún no paginan están listadas en §8.

**Notificaciones.** La campana del encabezado muestra órdenes por aprobar, facturas observadas, vencimientos y avisos del
sistema; "Mis pendientes" en el inicio resume lo que le toca a cada uno.

**Dudas.** Ver §10.

---

## 3. Compras y Proveedores

### 3.1 El flujo correcto
```
Requerimiento (RQ) → Cotización (COT) → Orden de compra / servicio (MM- / MM-S-) → Aprobación por monto (hasta 3 niveles)
→ Recepción (REC) → Factura del proveedor (portal o SIRE) → Conformidad → Cuentas por pagar → Lote de pago → Pago → Conciliación bancaria
```
Cada paso enlaza con el anterior: la factura hereda la orden, la orden hereda el centro de costo y el proyecto, y el pago
hereda todo. Si se salta un paso (por ejemplo una compra sin orden), el sistema igual la acepta, pero la factura llega "sin
orden" y Compras debe asignarle centro de costo a mano.

### 3.2 Submódulos

| Pantalla | Qué hace | Quién | Cómo se usa |
|---|---|---|---|
| **Compras › Dashboard** | Resumen de órdenes por estado, montos del mes, pendientes de aprobación | Todos | Solo lectura |
| **Requerimientos** (273) | Pedido interno: qué se necesita, para qué proyecto, urgencia | Cualquier usuario puede crear; Compras atiende | Nuevo → ítems → enviar. Se convierte en cotización o en orden |
| **Cotizaciones** (298) | Comparar propuestas de proveedores, adjuntar PDF | Compras | Desde el requerimiento o suelta; se elige la ganadora y pasa a orden |
| **Órdenes de compra** (1,397) | La orden formal con ítems, IGV, moneda, TC, centro de costo, proyecto, condición de pago | Compras crea; Gerencia aprueba | Al aprobar nace el compromiso en Cuentas por pagar. El flujo de aprobación (1, 2 o 3 firmas según monto) se configura en Administración › Flujo de aprobación. Hay "solicitud de edición" para corregir una orden ya aprobada sin anularla |
| **Recepciones** | Constancia de que llegó lo comprado (parcial o total) | Almacén / quien recibe | Desde la orden; alimenta el saldo por facturar y el inventario |
| **Facturas de proveedores** (6,458 recibidas) | Bandeja de facturas: las que sube el proveedor por el portal, las registradas a mano y las del SIRE | Compras da conformidad; Contabilidad revisa | Estados: recibida → validada → conforme → programada de pago → pagada; observada (con motivo que el proveedor ve); histórica (SIRE de periodos cerrados). **Columna CDC**: muestra el centro de costo o el sugerido por el historial del proveedor con un botón Aplicar; "Aplicar CDC sugerido (N)" lo hace en bloque para las de confianza ≥ 80 % |
| **Proveedores › Directorio** (843) | Ficha: RUC, razón social, tipo, categoría, cuentas bancarias, detracción, retención, condición SUNAT | Compras | Nuevo o edición; consulta de RUC a SUNAT desde la ficha. 703 vienen del SIRE y están marcados "completar cuenta y condición" |
| **Accesos al portal** | Invitar al proveedor a subir sus facturas (XML + PDF obligatorios) | Compras | Invitación por correo; el proveedor fija su clave; sus facturas entran como "recibida" |
| **Evaluaciones · Contratos · Talleres** | Calificación de proveedores, contratos marco, talleres de flota | Compras / Flota | Hoy vacíos (0 evaluaciones, 0 contratos): se usan cuando el área decida |

### 3.3 Carga masiva en Compras
- **SIRE de compras** (mensual): Facturas de proveedores › "Importar SIRE" → se elige el Excel que Contabilidad descarga de
  SUNAT. El sistema une las hojas, deduplica por RUC + serie + número, enlaza con el proveedor por RUC y con el pago si ya
  existe, y marca "histórica" lo anterior al corte. Lo que ya estaba no se repite.
- **Órdenes históricas** (oc-system y Excel 2024) ya se migraron (1,397); no hay nada que volver a cargar.
- No hay carga masiva de requerimientos ni cotizaciones por diseño: nacen una a una.

### 3.4 Qué debe hacer Compras esta semana
1. Completar cuenta bancaria, tipo y condición de los 703 proveedores creados desde el SIRE (Excel "Proveedores sin cuenta").
2. Dar conformidad a las facturas "recibidas" y revisar las 248 "conformes" sin pagar antes del lote del 6-nov.
3. Aplicar el CDC sugerido donde corresponda (55 facturas tienen un único centro de costo en todo su historial).

---

## 4. Finanzas

### 4.1 El flujo correcto
```
Cuentas por pagar (compromisos de órdenes, facturas y cuotas de obligaciones) → Lote de pago semanal (crear → agregar → ajustar
detracción/retención → validar → pagar con voucher) → Transacciones → Bancos (extracto BBVA importado → conciliar) → Flujo de caja
```
Lo que no pasa por un lote (ITF, comisiones, SUNAT, abonos, cambio de moneda) se registra **desde el extracto** en Bancos.

### 4.2 Submódulos

| Pantalla | Qué hace | Quién | Cómo se usa |
|---|---|---|---|
| **Finanzas › Dashboard** | Saldos, pendientes, vencidos, próximos pagos | Todos | Solo lectura |
| **Cuentas por pagar** (1,275 pendientes) | Todo lo que se debe: órdenes aprobadas, facturas conformes, cuotas de préstamos y SUNAT, y lo que trae el Excel del flujo hasta que se corte. Filtros por área, proyecto, origen, vencidas; "pago acordado"; postergar | Finanzas | Desde aquí se eligen los compromisos para un lote. Paginada (25 por página) |
| **Lotes de pago** | El circuito semanal de pagos: lote → ítems (compromisos o líneas libres: adelantos, reembolsos) → detracción y retención calculadas → validación → pago con número de operación y voucher → bitácora | Finanzas prepara; Gerencia valida; Tesorería paga | Hoy hay 0 lotes: el primero se arma para el 6 de noviembre. Al marcar "pagado" nace la transacción, la factura pasa a pagada y queda lista para conciliar |
| **Detracciones** (1,458 constancias) | Archivo TXT para el Banco de la Nación (pago masivo) y carga de constancias SUNAT; enlaza cada constancia con su factura | Finanzas | Importar constancias (CSV de SUNAT); generar archivo BN desde el lote |
| **Bancos** (2,088 movimientos 2026, 1,860 conciliados) | Importar el histórico de movimientos de BBVA (hoja por cuenta), conciliar automático por número de operación y por importe (incluye pagos agrupados), y para cada movimiento sin cruce: **Vincular** (con un pago ya registrado), **Registrar** (ITF, comisión, abono, cambio de moneda, con centro de costo) o **Pagar facturas** (uno o varias facturas conformes que pagó ese cargo). Saldo ERP vs saldo del banco por cuenta y "Pagos acumulados por centro de costo" | Finanzas / Contabilidad | Importar el extracto cada mes → "Conciliar" → trabajar la lista "Sin conciliar". Paginada (30) |
| **Obligaciones financieras** (20) | Préstamos, cheques diferidos, letras, deuda tributaria y fraccionamientos SUNAT con su cronograma de cuotas; cada cuota es un compromiso del flujo pagable por lote | Finanzas / Contabilidad | Nueva → cuotas (generar por periodicidad o fijar a mano) → marcar pagadas desde el lote |
| **Caja chica** (47 cajas, 1,163 gastos) | Espejo del Excel de Administración: cajas, gastos, ingresos, apertura y cierre; cada gasto con centro de costo | Administración | **No se carga a mano**: se sincroniza desde SharePoint cada 30 minutos. En el ERP se consulta, exporta y cierra la caja |
| **Flujo de caja** | Ingresos y egresos por mes con saldo inicial (S/ 7,569.94 al 1-ene-2026) | Finanzas / Gerencia | Solo lectura; sale de compromisos y cobros |
| **Flujo financiero** | Las bases del flujo (BD CONTA, BD TI, Flujo Administración, Flujo de proyectos) leídas desde SharePoint 2 veces al día (06:00 y 15:00) o con "Actualizar desde el Excel"; muestra la hora de la última lectura | Finanzas | Mientras cada área no "corte" su Excel, el flujo mezcla Excel + ERP: la **Reconciliación Excel vs ERP** cruza ambos y muestra lo que está en uno y no en otro |
| **Transacciones** (4,676) | Todos los movimientos de dinero: pagos, cobros, registros bancarios, históricos 2024-2026 | Finanzas / Contabilidad | Consulta y exportación. Paginado de 20 en 20 |
| **Presupuestos · Reportes** | Presupuesto por centro de costo y reportes básicos | Finanzas | Poco uso todavía; el análisis fuerte está en BI › Flujo Gerencia |

### 4.3 Carga masiva en Finanzas
- **Extracto BBVA** (Bancos › Importar histórico): mensual, una hoja por cuenta (806 soles, 830 dólares); el sistema toma la
  cuenta de la cabecera de la hoja y avisa si el nombre de la hoja dice otra cosa. Lo repetido se ignora.
- **Constancias de detracción** (Detracciones › Importar): CSV de SUNAT.
- **Flujo financiero**: automático desde SharePoint; no se sube nada.
- **Obligaciones**: una a una desde pantalla (las 20 actuales se cargaron del Libro de obligaciones).

### 4.4 Qué debe hacer Finanzas esta semana
1. Trabajar el Excel "Revisión Finanzas y Contabilidad": 228 movimientos sin conciliar (Vincular / Registrar / Pagar facturas),
   76 abonos sin cliente, 11 pagos a SUNAT sin tributo, 9 obligaciones vencidas por confirmar.
2. Preparar el primer lote de pago (6-nov) desde Cuentas por pagar: para eso las facturas deben estar conformes y los
   proveedores con cuenta.
3. Decidir el corte del Excel de flujo por área: cuando un área deje de llenar su Excel, el ERP deja de duplicar.

---

## 5. Contabilidad

### 5.1 El flujo correcto
```
SIRE de compras (mensual) → facturas en el ERP → conformidad (Compras) → asiento automático al conformar → pago → asiento de pago
SIRE de ventas (mensual) → facturas emitidas → asiento de venta y registro de ventas automáticos
Extracto BBVA → Bancos → transacciones → saldo ERP = saldo banco
```
El ERP no reemplaza la contabilidad oficial (Concar/SUNAT): es contabilidad de gestión que nace sola de las operaciones y que
Contabilidad revisa y corrige donde el documento no cuadra.

### 5.2 Submódulos

| Pantalla | Qué hace | Cómo se usa |
|---|---|---|
| **Comprobantes** (7,394: 6,458 recibidos, 936 emitidos) | Facturas, boletas y notas de crédito recibidas y emitidas, con estado, dirección, RUC, totales, asiento | Filtro por dirección/estado/fecha; registro manual de un comprobante; contabilizar o anular contabilización. Paginado de 20 en 20 |
| **Registro de compras** (619) · **Registro de ventas** (643) | Los registros que exige SUNAT, generados desde los comprobantes contabilizados | Consulta y exportación |
| **Libro diario** (1,692 asientos) | Asientos automáticos (compra, venta, pago, cobro, anulación) y manuales | Nuevo asiento manual; anular. Paginado de 20 en 20 |
| **Plan de cuentas · Periodos** | Catálogo PCGE del tenant y apertura/cierre de periodos | Configuración; se toca poco |

### 5.3 Carga masiva en Contabilidad
- **SIRE de compras**: desde Compras › Facturas de proveedores › Importar SIRE (ver §3.3). Ya están cargados 2024-01 a 2026-09.
- **SIRE de ventas**: ya están cargados 2025-01 a 2026-09 (936 comprobantes, con notas de crédito). **La carga mensual
  todavía se hace por script** (`scripts/semana2-ingresos`); el botón en pantalla es una mejora pendiente.
- **Pagos históricos 2024-2026** (Excel "Pagos acumulados"): cargados (3,346). No volver a cargar.
- **Constancias SUNAT**: desde Detracciones.

### 5.4 Qué debe hacer Contabilidad esta semana
1. Del Excel de revisión: las 109 transacciones 2026 que no cruzan con el banco (7 cambios de moneda de enero con signo
   invertido), las 25 facturas 2026 que no cuadran base/IGV/total, las 7 facturas pagadas sin centro de costo.
2. Confirmar los CDC sugeridos en Facturas de proveedores.
3. Dar el RUC/DNI de los acreedores sin ficha (Wiese, Zegarra, Hoefken, Secrex, HFM) para enlazar sus obligaciones.

---

## 6. Administración

| Pantalla | Qué hace | Cómo se usa |
|---|---|---|
| **Caja chica** | Ver §4.2: espejo del Excel, cada 30 minutos | El Excel sigue siendo donde se registra; el ERP consulta, exporta, abre y cierra cajas |
| **Fianzas › Tablero** (65 cartas) y **Cargos** | Cartas fianza por proyecto con vencimientos y renovaciones; cargos bancarios de fianzas | Sincronizado 2 veces al día desde "STATUS DE FIANZAS"; los cargos se importan desde pantalla |
| **Documentos** | Carpetas de SharePoint enlazadas al ERP (lectura) | Navegar y abrir; no se suben archivos al ERP |
| **Proyectos › Capacitaciones y certificados** (138 certificados) | Asistencia con firma, certificados con QR, portal público por DNI, plantillas por consorcio | Crear capacitación → participantes → firmar → emitir; exportación masiva |
| **Obligaciones financieras** | Ver §4.2 | Registro y seguimiento de préstamos y deudas |
| **Flujo financiero › Administración** | Su Excel de flujo leído 2 veces al día | Seguir llenando el Excel hasta el corte |
| **Administración › Usuarios y roles · Catálogos · Flujo de aprobación · Centros de costo** | Alta de usuarios, permisos, catálogos (tipos, categorías), niveles de aprobación por monto, centros de costo y su proyecto | Solo el administrador del sistema |

**Lo que Administración todavía hace en Excel y el ERP no cubre:** viáticos y pasajes (797 reservas al año) y correspondencia
con el Estado. Están diseñados (`docs/DISENO-VIATICOS-Y-UNIDADES.md`) para el sprint 5; hasta entonces no hay nada que cargar.

---

## 7. Proyectos, Inventario, Flota y BI (lo que toca a las áreas administrativas)

- **Proyectos › Lista y Proyecto 360** (37 proyectos): presupuesto, órdenes, recepciones, facturas, pagos, valorizaciones
  (13 reales), cobrado, inventario y resultado contable por proyecto. Todo lo que las áreas registren con proyecto cae aquí.
- **Proyectos › Presupuesto**: importa el PROY-FOR-004 (Excel) por proyecto.
- **Proyectos › Espejo Excel**: lectura del RESUMEN de Operaciones (manual, botón "Sincronizar ahora").
- **Inventario › Despacho a proyecto**: salida de almacén a un proyecto o entre proyectos, con kardex. El inventario está vacío
  en la práctica (1 artículo); el equipamiento por serie está diseñado para el sprint 5.
- **Flota**: en rediseño; las áreas administrativas no cargan nada ahí.
- **BI › Flujo Gerencia y Reporte cruzado**: KPI mensual por área con liquidez, exportable; es el reporte para Gerencia.

---

## 8. Paginación y límites de datos: lo que está y lo que falta

Regla de la casa: toda lista con bastante data se pagina (20 por página) desde el primer día. Estado real:

| Pantalla | Filas hoy | Paginada | Carga completa | Acción |
|---|---:|:---:|:---:|---|
| Facturas de proveedores | 6,458 | Sí | Sí (por bloques de 1,000) | — |
| Órdenes, requerimientos, cotizaciones, recepciones | 1,397 / 273 / 298 / 1 | Sí | Sí | — |
| Proveedores › Directorio | 843 | Sí | Sí | — |
| Cuentas por pagar | 1,275 | Sí (25) | Sí | — |
| Bancos | 2,088 | Sí (30) | Sí (por mes) | — |
| Detracciones, Obligaciones, Caja chica, Lotes, Fianzas, Capacitaciones, Reconciliación | — | Sí | Sí | — |
| Contabilidad › Comprobantes | 7,394 | Sí | Sí (por bloques de 1,000) | Corregido el 13-oct |
| Contabilidad › Libro diario | 1,692 | Sí | Sí (por bloques de 1,000) | Corregido el 13-oct |
| Finanzas › Transacciones | 4,676 | Sí | Sí (por bloques de 1,000) | Corregido el 13-oct |
| Contabilidad › Registro de compras / ventas | 619 / 643 | No | Sí | Paginar (crece cada mes) |
| Proyectos › Lista · CRM › Clientes · Inventario › Movimientos | 37 / 22 / 1 | No | Sí | Paginar cuando crezcan |
| Dashboards, Proyecto 360, detalles, Flujo Gerencia | resúmenes | No aplica | Sí | — |

Las tres pantallas que mostraban solo una parte de los datos (Comprobantes, Libro diario, Transacciones) se corrigieron el 13-oct: cargan todo por bloques y paginan de 20 en 20.

---

## 9. Qué se importa, qué se exporta, qué se reporta

| Necesidad | Dónde | Formato |
|---|---|---|
| Subir SIRE de compras | Compras › Facturas › Importar SIRE | Excel SUNAT |
| Subir extracto bancario | Finanzas › Bancos › Importar histórico | Excel BBVA (una hoja por cuenta) |
| Subir constancias de detracción | Finanzas › Detracciones | CSV SUNAT |
| Subir cargos de fianzas | Fianzas › Cargos | Excel |
| Subir presupuesto de proyecto | Proyectos › Presupuesto | Excel PROY-FOR-004 |
| Subir hojas de asistencia / plantillas | Capacitaciones | Imagen / PDF |
| Flujo financiero, caja chica, fianzas | Automático desde SharePoint | — |
| SIRE de ventas | Por script (pendiente botón) | Excel SUNAT |
| Exportar cualquier lista con botón Excel | Ver §2 | Excel con los filtros aplicados |
| Reporte de gerencia | BI › Flujo Gerencia (KPI mensual, liquidez, por área) y Reporte cruzado | Pantalla + Excel |
| Reporte por proyecto | Proyectos › Proyecto 360 | Pantalla |
| Pagos acumulados por centro de costo | Finanzas › Bancos (bloque inferior) | Pantalla + Excel |
| Reportes PDF | Certificados y acta/orden impresa | PDF (los reportes financieros en PDF no existen todavía) |

---

## 10. Dónde preguntar y cómo reportar un problema

Hoy el ERP **no tiene un módulo de consultas o tickets**. El circuito que funciona:
1. **Duda de uso** ("¿dónde registro esto?", "¿por qué no veo tal factura?"): escribir en el canal de Teams del ERP (o al
   administrador del sistema) con la pantalla y, si aplica, el número del documento (MM-000123, F001-456).
2. **Error** (algo que no carga, un número que no cuadra): captura de pantalla + pasos para repetirlo + usuario con el que
   pasó. Si es un dato (una factura que no está, un pago que figura dos veces), decir cuál y de qué periodo.
3. **Cambios de permisos o usuarios nuevos**: al administrador del sistema (Administración › Usuarios y roles).
4. **Decisiones de negocio** (qué proyecto financia una empresa, si una obligación vencida se pagó): se responden en los Excel
   de revisión que se entregan a cada área y se cargan de vuelta al ERP.

Recomendación: crear el canal de Teams "Soporte ERP" con los jefes de área y el administrador, y fijar ahí esta guía. Con
eso ninguna duda se pierde en un chat privado y queda registro de qué se pidió y qué se cambió.

Documentación viva: `docs/CONTEXTO-SESION.md` (qué cambió y cuándo), `docs/PLAN-CARGA-DATOS-ERP.md` (qué datos entraron y qué
falta) y esta guía.

---

## 11. Lo que todavía no deben esperar del ERP

- Lotes de pago reales: el primero es el del 6-nov. Hasta entonces los pagos de set-oct se registran desde Bancos.
- Cuentas por cobrar por factura emitida: las 936 facturas de venta están cargadas, pero el cobro se sigue por valorización y
  CIPRL, no factura por factura.
- Viáticos, correspondencia con el Estado, equipamiento por serie: diseñados, no construidos.
- Flota: en rediseño.
- Reportes financieros en PDF y la pantalla para importar el SIRE de ventas.

---

## 12. Lista de arranque por área (primera semana)

**Compras**: completar proveedores del SIRE → dar conformidad a lo recibido → aplicar CDC sugerido → importar el SIRE de
octubre cuando Contabilidad lo descargue.

**Finanzas**: trabajar los 228 movimientos sin conciliar → confirmar obligaciones vencidas → armar el lote del 6-nov →
importar el extracto de octubre a inicios de noviembre.

**Contabilidad**: corregir las 7 transacciones de enero con signo invertido → revisar las 25 facturas con error → confirmar
CDC sugeridos → entregar RUC/DNI de los acreedores → descargar el SIRE de octubre.

**Administración**: seguir en sus Excel de caja chica, fianzas y flujo (el ERP los lee) → cerrar cajas desde el ERP →
confirmar en el Excel de revisión los 26 proyectos nuevos junto con Operaciones.

**Administrador del sistema**: crear los usuarios que falten, abrir el canal de soporte, paginar Registro de compras/ventas cuando crezcan.
