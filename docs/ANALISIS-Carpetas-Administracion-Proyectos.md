# Carpetas "Administración" y "Proyectos" (más revisión de skills externos)

> Fecha: 2026-10-12. Pedido de Kevin: revisar, analizar y estudiar la información de los equipos
> Contabilidad, Administración, Proyectos y Flujo Financiero, y evaluar cuatro repositorios de
> "skills" para el desarrollo del ERP.
>
> Contabilidad y Flujo Financiero ya están analizados en
> [ANALISIS-Carpetas-Contabilidad-Finanzas.md](ANALISIS-Carpetas-Contabilidad-Finanzas.md) y
> [ANALISIS-Flujo-Financiero-y-Documentos.md](ANALISIS-Flujo-Financiero-y-Documentos.md); lo de esas
> carpetas que faltaba subir se cargó el 9-oct (SIRE 2024-2026, constancias, bancos). El grupo
> "Finanzas" de Teams es obsoleto y no se usa: no se analiza. Este documento cubre las dos carpetas
> nuevas y cierra con la evaluación de skills.
>
> No se abrieron legajos de trabajadores ni boletas; de las planillas y remuneraciones solo se miró la
> estructura de columnas, no los montos por persona.

---

## 1. Administración (sitio "Administracin54", carpeta "Administración - Administración")

| | |
|---|---|
| Archivos | 1,291 (1,003 PDF · 150 Excel · 101 Word · 23 imágenes · 6 PowerPoint) |
| Dueña | Carolina Okamura (administración y RR. HH.) |
| Qué es | El archivo de RR. HH. y de los gastos de oficina: legajos, planillas, EPS, vida ley, vacaciones, caja chica, viáticos, fianzas y el circuito de pagos de administración |

### 1.1 Cómo está organizada

| Carpeta | Archivos | Qué hay | ¿Está en el ERP? |
|---|---:|---|---|
| `Trabajadores/` | 642 | Un legajo por persona (contratos, DNI, boletas, ceses, liquidaciones) y `Evolución Roles y Remuneraciones 2024-2026.xlsx`, `Libro plazos y otros.xlsx`, `Check list.xlsx` | **No.** No hay módulo de personal. Son datos sensibles (ver §4) |
| `Fianzas/` | 97 | `STATUS DE FIANZAS ACTUALIZADO 2026.xlsx` (78 cartas: proyecto, entidad, proveedor CESCE, tipo, n.º, inicio, plazo, fin, renovación, monto, %), `Control Cartas Fianzas.xlsx` y los PDF de cada carta | **Sí.** `fianzas`, `fianza_cartas`, `fianza_cargos`; la Edge Function `fianzas-import` lee este mismo Excel dos veces al día |
| `Viáticos/` | 94 | `CONTROL DE VIAJES 2026.xlsx`: hojas PASAJES_RESERVAS (797 filas: código de reserva, tramo, origen, destino, fechas, aerolínea, moneda, costo, TC, pago), PASAJES_PASAJEROS (quién viajó, proyecto, factor), CONTROL_VIAJES, RESUMEN por proyecto y por trabajador; más rendiciones en PDF | **No.** Es el gasto de viajes por proyecto: hoy se imputa a mano a cada CDC |
| `EPS/` · `Seguro de vida ley/` · `AFP/` | 90 · 37 · 4 | Afiliaciones, renovaciones, exclusiones, formatos (xls de trama) | **No** (RR. HH.) |
| `Control personal/` | 53 | `Control de vacaciones - ausencias - descansos.xlsx` (una hoja por trabajador + resumen: ingreso, periodo, días tomados/por tomar), boletas por mes | **No** |
| `Caja Chica/` | 53 | Una caja por archivo `CAJA_NN_SOLES_ADMI0NN-SOLES.xlsx` (29 cajas: saldo inicial, ingresos, gastos, saldo final, detalle con comprobante) y `Modelo caja chica 2025` | **Sí**, el módulo Caja chica (`cajas_chicas`, `gastos_caja_chica`, `ingresos_caja_chica`) existe, pero las 29 cajas de 2025-2026 **no están cargadas** |
| `Gastos oficina/` | 43 | `CUADRO DE PAGOS MM CARO.xlsx` (matriz de gastos de oficina por mes 2025-2026 con leyenda abonado/por determinar/vencido, hoja "Datos para pago" con RUC, banco, cuenta, CCI, detracción de cada proveedor recurrente, hoja CESCE con pólizas por proyecto y vencimiento) y `Libro obligaciones memphis.xlsx` (cheques diferidos y préstamos: Secrex 351 k, HFM 55 k US$, Sandra Wiese 400 k + 200 k US$, Corporación OXI 70 k, con contrato, interés y vencimiento); carpeta `Planillas/` con las planillas mensuales (duplicadas con `Planilla/`) | **Parcial.** La matriz por mes es lo que `Flujo Administración.xlsx` lleva al flujo (fuente `excel`). Las **obligaciones** (préstamos y cheques diferidos) no están en ningún lado: es el pendiente "deuda y mutuos como compromisos" del sprint 4 |
| `Pago bbva/` | 22 | `PAGOS dd.mm.aaaa.xlsx` por semana (ADM, OPE, TI, CONT): proveedor, RUC, banco, cuenta/CCI, proyecto, descripción, OC, factura, soles, dólares, % detracción; `cuentas para pago`; `Pago detracciones` | **Sí.** Es el circuito que reemplazan los **lotes de pago** (sprint 1-3). Octubre 2026 todavía se armó en Excel |
| `Planilla/` | 30 | `PLANILLA REMUNERACIONES <mes>.xlsx` (sale de BUK), `Libro Remuneraciones`, gratificaciones, CTS, bono Cusco | **No.** La planilla vive en BUK; al ERP solo le interesa el **total por mes y por CDC** como compromiso (hoy entra por el flujo de Contabilidad: "PLANILLA") |
| `Políticas laborales/` | 24 | Política de pasajes y viáticos, formato único de reembolso y liquidación (xlsm), formatos PEX de vacaciones y ausencias "en proyecto" | Insumo para el módulo de viáticos si se construye |
| `INFORMACION NICOLAS/` | 74 | Carpeta personal del GG anterior (informes, presentaciones) | Referencia |
| `Bolsa de empleo/` · `Cartas de instrucción/` · `Cheques/` · `ISOS 2026/` · `movistar/` | 9 · 4 · 1 · 7 · 1 | Convocatorias, cartas a bancos, un cheque, documentos ISO 2026, contrato de telefonía | Referencia |
| Raíz | — | `Solicitud de Vacaciones.xlsx`, `Memorandos listado.xlsx` (n.º, trabajador, asunto), `Implementaciones.xlsx` (lista de pendientes de oficina), `cumpleaños.pdf`, `Agenda Contacto provincias.docx` | Referencia |

### 1.2 Lo que aporta al ERP

1. **Viáticos y pasajes por proyecto** es el proceso administrativo más estructurado que todavía no está en el
   sistema: 797 reservas en 2026 con costo, TC, proyecto y trabajador, y una política escrita con formato de
   liquidación. Es un módulo pequeño (reserva → viajero(s) → proyecto → rendición → caja chica o reembolso)
   que alimenta directo el gasto real por proyecto, hoy ausente en `flujo_compromisos`.
2. **Obligaciones financieras** (`Libro obligaciones`): préstamos de socios y terceros y cheques diferidos con
   vencimiento e interés. Es exactamente lo que el sprint 4 dejó pendiente ("deuda tributaria y mutuos como
   compromisos"); el archivo trae las columnas que hacen falta (acreedor, monto, moneda, concepto, interés,
   contrato, vencimiento, observación).
3. **Caja chica**: 29 cajas con el mismo formato. El módulo existe; falta el importador (una caja = un
   archivo, cabecera con n.º de caja y responsable, detalle con fecha, comprobante, concepto, monto).
4. **Gastos de oficina recurrentes** (`Datos para pago`): 60 proveedores recurrentes con cuenta y CCI. Son los
   que faltan en el directorio de proveedores (de las 3,853 facturas del SIRE sin proveedor, buena parte son
   estos: luz, agua, telefonía, alquileres, seguros).
5. **Fianzas** ya están sincronizadas; `STATUS DE FIANZAS` se repite en `0.0 PROYECTOS EN IDEA/…/Plantilla
   carta Fianza/` con otro nombre: conviene que Operaciones use la del ERP y no copias.

---

## 2. Proyectos (sitio "COMPRAS", carpeta "General - PROYECTOS")

| | |
|---|---|
| Archivos | 20,435 (13,155 PDF · 2,226 Word · 2,252 fotos · 944 Excel · 806 ZIP · 317 XML · 98 videos · 69 PPT) |
| Dueños | Operaciones (Miguelángel, Lisbet, Gabriela, Úrsula) y Logística (Richard, Ana) |
| Qué es | El expediente completo de cada proyecto con el Estado: proceso, ejecución, cartas, valorizaciones, inmatriculación, fotos, cronogramas, presupuestos; más logística y las ideas en evaluación |

### 2.1 Cómo está organizada

| Carpeta | Archivos | Qué hay |
|---|---:|---|
| `02. PROYECTOS EN EJECUCIÓN/` | 9,014 | 8 proyectos: MUNI CUSCO 20 camionetas + 1 bus (1,420), GORE CUSCO 59 ambulancias (4,252), GORE HUÁNUCO patrulleros (1,309), GORE CUSCO patrulleros (2,365), GORE AMAZONAS mix (1,183), GORE LORETO bomberos (1,631), GORE CUSCO hidroambulancias (331), BOMBEROS SAN MARTÍN (215). Más `SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx` |
| `03. PROYECTOS - LIQUIDACIÓN/` | 3,788 | GORE LORETO PNP SC (1,685), GORE LORETO ambulancias (509), GORE ICA 50 camionetas + 200 motos (2,048) |
| `0.0 PROYECTOS EN IDEA/` | 1,200 | Loreto (hospitales, ambulancias), San Martín, Cusco, Ica, Huánuco, Ayacucho, COER Áncash, renting; `Evaluacion_Proyectos_IDEA.xlsx` y `Proyección Proyectos en Idea`; `00.PROVEEDORES Y ESPECIFICACIONES/` |
| `07.PROYECTOS - RESUMEN/` | 71 | `Seguimiento de proyectos dd.mm.26.xlsx` (12 versiones, una por semana, 17-jul a 05-oct), `PROYECTOS - TOTALES.xlsx`, 16 cronogramas en MS Project (`.mpp`), `Inventario de Camionetas_PERUMOTOR`, `Evaluación OXI`, `FLUJO DE PRESUPUESTO/` (control de facturas, CxP, informes) |
| `09. LOGISTICA/` | 46 | Órdenes de compra (28), `PAGOS ddmmaaaa.xlsx` semanales (17), `proveedores-2026-09-18.xlsx` (exportado del ERP) |
| `06. CARPETAS VARIAS/` | 687 | `ÓRDENES DE COMPRA GENERADAS.xlsx` y `OC 2024.xlsx` (el control de OC anterior al ERP), `Logistica/INVENTARIO GENERAL/MEMPHIS_IVENTARIO LA SIRENA ULTIMO.xlsx` (555 unidades con marca, modelo, **número de serie**, ubicación, factura, valor), rendiciones (Richard, MAPI) |
| `05. ARCHIVOS VARIOS/` · `04. PROYECTOS - OTROS/` | 591 · 386 | Material suelto y proyectos menores |
| `01. PROYECTOS EN PROCESO DE SELECCIÓN/` | 14 | Ambulancias Ayacucho, hospitales San Martín |
| `08. VEHICULOS EN PERUMOTOR/` · `10. VIDEOS/` · `Grabaciones/` | 3 · 10 · 0 | — |

**Estructura típica de un proyecto en ejecución** (19 subcarpetas, con variantes por proyecto): documentos del
proceso, documentos de la ejecución, cartas emitidas, cartas recibidas, actas de entrega, costos, carta fianza,
fichas técnicas, documento equivalente, valorizaciones (una carpeta por valorización con informe, carátula y
Excel), control de equipamiento, inmatriculación, fotos, base de datos de vehículos, cotizaciones, presupuesto,
presentación, cartas de garantía, OC, SOAT, facturas.

### 2.2 Los archivos que gobiernan el área

| Archivo | Qué contiene | Equivalente en el ERP |
|---|---|---|
| `Seguimiento de proyectos dd.mm.26.xlsx` (semanal) | Una fila por proyecto: entidad, actividad/estado, monto de inversión, monto ejecutado, cobrado, por cobrar, carta fianza, observaciones, responsables; hoja con cronograma de pagos | `proyectos` (33 columnas, incl. montos y estado) + `valorizaciones_proyecto` + `fianza_cartas`. **Falta** una vista "informe semanal" que lo genere; hoy se copia el Excel cada semana (12 versiones) |
| `PROYECTOS - TOTALES.xlsx` | Status de todos los proyectos (ejecución, liquidación, idea) con unidades (camionetas, motos, buses, camiones), financista, ejecutor, monto, fianza; hoja `Adquisición de unidades` por marca y fechas de compra/entrega; hoja `PERUMOTOR` | `proyectos` + `vehiculos` (55 columnas). La adquisición de unidades por proyecto y proveedor es lo que `flota_vehiculos`/`vehiculos` deben reflejar; hoy se lleva aparte |
| `SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx` | Por proyecto (7 hojas de 800+ filas): meta, emisor, acción requerida, receptor, fecha de ingreso y recepción, n.º de carta/oficio, tipo (carta, memorándum, informe legal, oficio, proveído) | `documentos_proyecto` (9 columnas) guarda archivos, **no el hilo de correspondencia** (quién pide qué a quién, plazo, respuesta). Es el control más laborioso de Operaciones |
| Valorizaciones (`Valorización_N.xlsx` por mes y proyecto) | Partidas, valorización, cronograma valorizado, avance de obra, resumen, adendas | `valorizaciones_proyecto` (24 columnas) y `adendas_proyecto`. Las valorizaciones mensuales siguen naciendo en Excel |
| Cronogramas `.mpp` (16) y `Cronograma <proyecto>.xlsx` | MS Project por proyecto y uno combinado; versiones de Miguelángel | `fases_proyecto` y `tareas_proyecto` existen, pero el cronograma real vive en Project |
| `Evaluacion_Proyectos_IDEA.xlsx` · `Proyección Proyectos en Idea` | Portafolio de ideas con ROI, rentabilidad mínima 25 %, reserva de riesgo 5 %, clasificación excelente/buena/aceptable/baja, días de lanzamiento, probabilidad de éxito; un PROY-FOR-004 por idea | `proyecto_presupuestos` (+ `presupuesto-import` para PROY-FOR-004). La **evaluación go/no-go** es lo que la iniciativa de licitaciones (memoria `project_licitaciones`) proponía; aquí ya está el criterio escrito |
| `MEMPHIS_IVENTARIO LA SIRENA ULTIMO.xlsx` | 555 unidades de equipamiento con número de serie (bodycams, arneses, tablets, NVR…), ubicación, factura, valor en US$ y S/; devolución a SUMTEC con guía | El inventario del ERP es **por cantidad** (`articulos`, `stock_almacen`); no tiene unidad serializada. El despacho a proyecto (sprint 4) mueve cantidades; para equipos con serie falta la tabla de unidades |
| `PAGOS ddmmaaaa.xlsx` (Logística) y `ÓRDENES DE COMPRA GENERADAS.xlsx` | El circuito de pagos de Operaciones y el control de OC anterior al ERP | Reemplazados por **lotes de pago** y **órdenes de compra** del ERP; en octubre todavía se usaron |
| `Inventario de Camionetas_PERUMOTOR` | Unidades compradas a Perumotor por proyecto, marca y fechas | `vehiculos` |

### 2.3 Lo que aporta al ERP

1. **Informe semanal de proyectos como vista del ERP.** Las 12 copias del `Seguimiento` son el mismo cuadro
   con una fecha distinta. El Proyecto 360 ya tiene los montos; falta el cuadro resumido (una fila por
   proyecto con cobrado/por cobrar/fianza/observaciones de la semana) y un campo "observaciones de la semana"
   con historial. Es una pantalla, no un módulo.
2. **Correspondencia (cartas y oficios).** 5,600 filas de seguimiento en 7 hojas. Es un módulo en sí: carta
   (emisor, receptor, n.º, tipo, fecha, plazo de respuesta, archivo) → respuesta → estado. Hoy el riesgo de
   una carta sin responder a tiempo (ampliaciones de plazo, penalidades) se controla a ojo.
3. **Equipamiento con número de serie.** Bodycams, radios, tablets y NVR se entregan por serie al Estado y se
   devuelven por serie al proveedor. El inventario por cantidad no alcanza para eso: hace falta `unidades`
   (artículo, serie, estado, ubicación, proyecto, factura) sobre el kardex actual.
4. **Cronogramas desde MS Project.** Project exporta XML; `fases_proyecto`/`tareas_proyecto` pueden poblarse
   desde ahí en vez de digitar. Ganancia: el avance físico (valorizaciones) y el cronograma en la misma pantalla.
5. **Evaluación de ideas.** Los parámetros (rentabilidad mínima, reserva de riesgo, umbrales de ROI) están
   escritos en `Evaluacion_Proyectos_IDEA`; el ERP puede calcular la clasificación a partir del
   PROY-FOR-004 importado y dejar de depender de ese Excel.
6. **Pagos y OC de Logística ya tienen reemplazo** en el ERP; lo que falta es el corte (sprint 4).

---

## 3. Qué entra al plan (propuesta de orden)

| Prioridad | Pieza | Área | Tamaño | Por qué ahora |
|---|---|---|---|---|
| 1 | Obligaciones financieras (préstamos, cheques diferidos, deuda tributaria) como compromisos | Administración / Contabilidad | 2 días | Ya era pendiente del sprint 4; el `Libro obligaciones` trae la estructura |
| 2 | Importador de caja chica (29 archivos) | Administración | 1-2 días | El módulo existe, solo falta la carga; cierra el gasto real de oficina |
| 3 | Informe semanal de proyectos (vista + observaciones con historial) | Proyectos | 2 días | Elimina 12 copias del Excel; usa datos que ya están |
| 4 | Viáticos y pasajes por proyecto | Administración | 4-5 días | 797 reservas al año; hoy el gasto de viaje no llega al costo del proyecto |
| 5 | Correspondencia de proyectos | Proyectos | 5 días | Control de plazos con el Estado; hoy es el Excel más grande de Operaciones |
| 6 | Unidades serializadas en inventario | Inventario / Proyectos | 3-4 días | Equipamiento entregado y devuelto por serie |
| 7 | Cronogramas desde MS Project (XML) y evaluación de ideas desde PROY-FOR-004 | Proyectos | 3 días | Dependen de que Operaciones adopte fases/tareas y el presupuesto importado |
| — | Personal, planilla, EPS, vida ley | RR. HH. | — | **No** en el ERP: BUK es el sistema de planilla; solo entra el total mensual como compromiso |

Encaja después del sprint 4 (corte a ERP) y antes o en paralelo con la capa analítica (sprint 5): sin
viáticos ni obligaciones, el flujo real del ERP seguirá incompleto frente al Excel.

---

## 4. Observaciones que conviene atender fuera del plan

- **Legajos y remuneraciones en carpetas compartidas.** `Trabajadores/` (642 archivos con DNI, contratos,
  boletas, liquidaciones) y `Evolución Roles y Remuneraciones 2024-2026.xlsx` están en el sitio de
  Administración. Conviene revisar quién tiene acceso al sitio: no debería ser el mismo grupo que ve viáticos
  o caja chica.
- **Cuentas bancarias de proveedores** en `CUADRO DE PAGOS MM CARO.xlsx › Datos para pago` y en cada
  `PAGOS dd.mm.aaaa.xlsx`: una vez que el directorio del ERP las tenga, esas hojas sobran.
- **Duplicados y versiones:** planillas repetidas en `Planilla/` y `Gastos oficina/Planillas/`;
  `STATUS DE FIANZAS` en dos sitios; 12 copias semanales del `Seguimiento`; archivos "(1)", "(2)", "- Copia".
  Cada copia es una fuente de verdad distinta.
- `09. LOGISTICA/1. COTIZACIONES/` está vacía y `Grabaciones/` también.
- Los `.mpp` solo los abre MS Project; Operaciones trabaja sobre versiones personales ("-MIGUELANGEL").

---

## 5. Evaluación de los cuatro repositorios de skills

Contexto: en este proyecto **ya están instalados** los skills de proceso de "superpowers" (brainstorming,
writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion,
requesting/receiving-code-review, using-git-worktrees, dispatching-parallel-agents) y skills propios en
`.claude/skills/` (accessibility, code-review-and-quality, security-review, senior-architect, senior-backend,
performance, frontend-design, supabase-postgres-best-practices, supabase-server, vercel-react-best-practices,
docx/xlsx/pdf/pptx). La pregunta es qué agregan los cuatro enlaces.

| Repositorio | Qué es | ¿Sirve para el ERP? | Veredicto |
|---|---|---|---|
| **anthropics/claude-cookbooks** (MIT, ~53 k estrellas) | No son skills: son cuadernos y recetas de uso de la API de Claude (RAG, clasificación, tool use, agentes, Agent SDK, Managed Agents, evaluación, costos, un notebook de consultas SQL) | Para el día a día del ERP (React + Supabase) no cambia nada. Sí es la referencia correcta para la iniciativa **asistente IA embebido** (memoria `project_ia_embebida`, en pausa): patrones de tool use sobre la base, RAG sobre documentos de proyecto, evaluación de respuestas | **Referencia, no instalar.** Volver a él cuando se retome la IA embebida |
| **anthropics/financial-services** (Apache 2.0) | Plugins de banca de inversión, research, private equity y fund admin: DCF, LBO, comps, pitch decks, KYC, conciliación de GL, cierre mensual; 12 conectores a datos de mercado (FactSet, S&P, Morningstar…) que requieren suscripción | El 90 % no aplica (no somos un fondo ni un banco). Dos skills de Excel sí son reutilizables para el trabajo con los archivos de Contabilidad: `audit-xls` (rastreo de fórmulas, detección de valores pegados a mano, cuadre de balances) y `clean-data-xls` (normalizar tablas). Los agentes "GL Reconciler" y "Month-End Closer" son ideas de proceso parecidas a nuestra conciliación bancaria, pero están atados al mundo de fund admin | **Instalar solo `financial-analysis` para usar `audit-xls` y `clean-data-xls`** cuando se analicen libros de Contabilidad (p. ej. el `CUADRO DE PAGOS` o los acumulados). El resto no |
| **k-dense-ai/scientific-agent-skills** (MIT, ~48 k estrellas, 177 skills) | Bioinformática, química, imagen médica, física, materiales, neurociencia; herramientas de datos (Polars, Dask); la propia guía de contribución excluye skills de software general. Los skills de xlsx/docx/pdf se retiraron en la 2.72 | Nada del dominio del ERP (compras, finanzas, flota, proyectos públicos). Lo único tangencial: un skill de datos del Tesoro de EE. UU. y acceso a bases como FRED | **No instalar** |
| **aitmpl.com › using-superpowers** (copia en `davila7/claude-code-templates` del plugin "superpowers" de obra) | El skill "maestro" que obliga a buscar y usar un skill antes de responder cualquier cosa, con prioridad de los skills de proceso (brainstorming, TDD, debugging) sobre los de implementación | **Ya está instalado aquí** (es el que aparece como `using-superpowers`). Lo útil de ese paquete para el ERP son `verification-before-completion` (probar antes de decir "listo"), `systematic-debugging` y `requesting-code-review`. Lo rígido: exige brainstorming y TDD formal hasta para cambios de una línea, y añade pasos que Kevin no pidió | **Mantener, pero no en modo estricto.** Conviene usarlo para debugging y verificación, y saltar brainstorming/TDD en correcciones pequeñas y en cargas de datos (donde la prueba es la consulta SQL, no un test unitario) |

Lo que sí recomiendo sumar, si se quiere más "skill" para este ERP, no viene de esos cuatro enlaces:

1. Un **skill propio del proyecto** con las reglas que hoy viven en la memoria y en `CONTEXTO-SESION.md`
   (commits como Kevin, migraciones guardadas en `supabase/migrations`, QA con usuario temporal que se borra,
   paginación siempre, raíz primero, pg_safeupdate, pooler para cargas masivas). Eso es lo que `skill-creator`
   de Anthropic sirve para armar, y evita repetir las mismas correcciones en cada sesión.
2. Un skill de **carga de Excel de Contabilidad/Operaciones** (columnas por nombre, formato peruano de
   números, dedupe, dry-run con rollback, bitácora), que ya se repitió cuatro veces (histórico de pagos,
   BBVA, SIRE, constancias) y cada vez se reescribe.

---

## 6. Referencias

- Copias de trabajo en el scratchpad de la sesión; no se modificó ningún archivo de SharePoint.
- Plan general: [PLAN-DATOS-GERENCIA.md](PLAN-DATOS-GERENCIA.md) · Sprints: [PLAN-ACCION-SPRINTS-PAGOS.md](PLAN-ACCION-SPRINTS-PAGOS.md).
