# Datos para Gerencia: Excel, ERP, SQL, data warehouse, indicadores y presentaciones

> Fecha: 2026-10-07. Pedido de Kevin: el nuevo Gerente General quiere que el equipo trabaje
> más eficiente, sea desde el Excel o desde el ERP; volcar toda la data a SQL, tener un data
> warehouse, indicadores y un botón que genere presentaciones (Power BI) según lo que el usuario
> quiera. Evaluar también el dashboard de Adrián (`Adrian-7268/memphis-dashboard`).
>
> Estado: **ANÁLISIS Y PLAN. Nada de esto está construido.** Las decisiones están en la sección 8.

---

## 1. Resumen en cinco líneas

1. **La data ya está en SQL.** Las cuatro bases del flujo (Proyectos, Administración, Contabilidad,
   TI) viven en la tabla `flujo_compromisos` del ERP desde setiembre, junto con 1,389 órdenes,
   1,138 gastos de caja chica, presupuestos por partida y tipo de cambio diario de SUNAT.
   "Volcar la data a SQL" no es un proyecto nuevo: es terminar uno que está al 80 %.
2. **El problema de eficiencia no es la herramienta, es la doble captura y el desfase.** Hoy cada
   área escribe en su Excel, alguien importa a mano al ERP (última vez: 23 de setiembre), y
   Gerencia mira tablas dinámicas que hay que "actualizar" a mano. Mismo dato, tres copias, tres
   momentos. Ejemplo: para octubre el Excel dice S/ 15.1 M de egresos y el ERP S/ 13.0 M. Ninguno
   está mal: son fotos de días distintos.
3. **"Data warehouse" aquí significa dos cosas concretas y baratas:** una capa analítica en la
   misma base (esquema `dw` con dimensiones, hechos y fotos diarias para tener histórico) y un
   usuario de solo lectura para que Power BI u otra herramienta la consuma directo.
4. **Power BI para analizar; el ERP para generar la presentación.** Power BI gana en filtros,
   drill-down, histórico y "Exportar a PowerPoint". El dashboard de Adrián gana en estética de
   marca y modo TV, pero lee celdas fijas de un Excel, no tiene histórico ni filtros y hoy está
   fuera del ERP. Lo que el GG describe ("un botón que arme la presentación con lo que el usuario
   quiera") se resuelve mejor con un generador de PPTX dentro del ERP, alimentado por las mismas
   vistas que Power BI.
5. **Plan: 6 fases, unas 9 a 10 semanas de desarrollo**, con la primera (cerrar el desfase
   Excel → ERP) lista en una semana y sin cambiar la forma de trabajar de nadie.

---

## 2. Inventario: qué hay hoy

### 2.1 Carpeta "Flujo Financiero" (SharePoint FlujoFinanciero)

| Archivo | Tamaño | Qué es | Actualizado |
|---|---:|---|---|
| `BD CONTA 2026.xlsx` | 40 KB | Base plana: 170 compromisos de Contabilidad | 05-oct |
| `BD TI 2026.xlsx` | 25 KB | Base plana: 56 compromisos de TI | 01-oct |
| `Flujo Administración.xlsx` | 650 KB | Base `BD ADMIN` (1,074 filas) + 19 hojas de pivots y cálculos | 07-oct |
| `Flujo de proyectos.xlsx` | 2.1 MB | Base `BASE DE DATOS` (1,450 filas, 1,407 fórmulas con vínculos externos) + 31 hojas: PAGOS CIPRL, intereses, OXI, flujo mensual, ideas, ejercicios | 07-oct |
| `Flujo GM.xlsx` | 2.2 MB | El consolidado de Gerencia: copia de las 4 bases (`bd_conta`, `bd_TI`, `bdadmin`, `BASE_PROY`) → tabla `CONSOLIDADO` (2,693 filas) → 9 pivots → hojas `Flujo de ejecución`, `RESUMEN PROYECTOS`, `KPI Mensual`, `RESUMEN V2` y **`Préstamo Socios`** | 07-oct |
| `Flujo GM Directorio.xlsx` | 2.2 MB | **Copia exacta de Flujo GM** (mismas 37 hojas). Solo difieren 22 celdas de `Préstamo Socios`: colchón 8 % → 10 %, monto S/ 4.4 M → S/ 4.5 M | 07-oct |

**Lo nuevo es la hoja `Préstamo Socios`** (fecha de corte 2 de octubre): propuesta de préstamo
de socios calculada sobre el flujo proyectado oct-26 a ene-27. Es el mejor ejemplo de lo que
Gerencia necesita y de lo que el Excel hace mal:

| Concepto (S/) | Oct-26 | Nov-26 | Dic-26 | Ene-27 |
|---|---:|---:|---:|---:|
| Ingresos (CIPRL + bancos) | 11,223,862 | 6,946,626 | 4,112,120 | 21,514,709 |
| Egresos | 15,111,690 | 5,335,849 | 5,889,485 | 8,734,041 |
| Caja acumulada sin préstamo | −3,887,828 | −2,277,051 | **−4,054,416** | 8,726,252 |

Resultado: pedir S/ 4.5 M en dos tramos, devolver en enero con el CIPRL de Loreto (S/ 21.4 M),
interés S/ 203,593 a TEA 20 %. Escenario de estrés: si Loreto se atrasa, faltan S/ 5.3 M más.

Está bien pensado, pero: (a) vive en dos archivos con dos versiones del mismo número;
(b) depende de `SUMIFS` sobre `CONSOLIDADO`, que a su vez son copias pegadas de las cuatro bases;
(c) el tipo de cambio es 3.40 fijo; (d) no hay histórico: cuando alguien actualiza, la propuesta
anterior desaparece. Todo eso es exactamente lo que una vista SQL con parámetros resuelve.

Otras observaciones del inventario:

- Las tablas dinámicas usan `GETPIVOTDATA` (47 en `Flujo 2026`, 100 en `Flujo de Ideas`, 45 en
  `RESUMEN V2`). Si cambia el nombre de un centro de costo o un mes, la celda da `#REF!`.
- `Flujo de proyectos` tiene `BASE DE DATOS` y `BASE DE DATOS - Copia` (4,262 filas); la hoja
  `resumen de pago` ya muestra `#VALUE!`. Hay 29 vínculos externos en `AURA`, 24 en `cisternas`.
- `Flujo Administración` tiene la hoja `BD ADMIN` con 16,383 columnas de ancho (formato arrastrado).
- `BackUp` y `Repositorio` guardan 7 versiones más de los mismos flujos (agosto, julio, 2025).

### 2.2 Los siete presupuestos PROY-FOR-004 (Downloads)

| Archivo | Proyecto en el ERP | Hojas | Observación |
|---|---|---:|---|
| CUSCO HIDROAMBULANCIA | 07CUSHAM26 | 1 | Formato limpio: costo 2,322,373.33, TC 3.6, 116 días. **Es la plantilla a seguir.** |
| Muni Cusco | 01CUSMUN24 | 4 | Cobro CIPRL 7,058,611, TC 3.7 |
| CUSCO AMBULANCIA | 02CUSAMB25 | 4 | `Presu.` con 611 columnas |
| CUSCO FINAL | 06CUSPNP25 | 18 | **16 versiones del mismo presupuesto** (33.5 %, 35 %, 37.2 %, 38 %, ganancia 0 %…). Solo `L 200 FINAL` visible |
| Huanuco | 03HNCPNP25 | 4 | Cuadro resumen con dos copias ocultas |
| AMAZONAS | 05AMAPNP25 | 8 | Tres presupuestos de mantenimiento (16.12, 15.6) |
| BOMBEROS LORETO | 04LORBOM25 | 5 | Tiene hoja `Control ERP` (349 filas): alguien ya cruza a mano contra el ERP |

Seis de los siete comparten la misma hoja oculta `Hoja1` ("CAMIONETA … 23 × 205,500") que es
un resto de un archivo origen. El ERP ya tiene un lector de este formato (`presupuesto-import`,
parser `profor004.ts`) y 1,290 partidas cargadas; lo que falta es decidir **qué versión manda**
en LORETO, AMAZONAS, CUSCO PNP e HIDRO, donde el Excel y el ERP difieren (pendiente desde el
23 de setiembre).

### 2.3 El dashboard de Adrián (`memphis-dashboard`)

Un solo commit (26-jun-2026), React 19 + Vite + Tailwind, unas 3,000 líneas, sin TypeScript ni
pruebas, desplegado probablemente en Vercel. Es un **modo TV**: intro animada de 3 s, vista
general, una diapositiva por proyecto cada 22 s, lienzo fijo 1920×1080 escalado, versión móvil.

| Aspecto | Cómo está |
|---|---|
| Fuente | **Un Excel en SharePoint OPERACIONES2** (el RESUMEN de proyectos), leído con la API de libro de MS Graph cada 5 minutos, desde el navegador, con sesión MSAL del usuario |
| Mapeo | Por **coordenadas fijas** (C1–C10, E1–E10, hitos en filas 45–74). Insertar una fila muestra datos equivocados sin error |
| Cálculos | En el navegador: pendiente = inversión − cobrado; utilidad = inversión − presupuesto; avance = hitos llenos / 25 (todos pesan igual); semáforo por días al plazo |
| Fijo en código | Correos de owners, nombres de los 25 hitos, colores, 170 MB de fotos por proyecto (154 MB son PNG sin usar) |
| Errores vistos | "Monto ejecutado" y "% gasto" dicen "En proceso" a mano; utilidad y semáforo ocultos en escritorio; posible desfase de un día en fechas (UTC vs Lima); `Presupuesto Total` suma contratos, no presupuestos |
| Histórico / filtros / drill-down | No tiene |

Veredicto: el 70 % de la interfaz (layout, carrusel, móvil, intro) es reutilizable si el objeto
`project` viniera de una vista del ERP en vez del parser de Excel. Como herramienta de análisis
no compite con Power BI; como pantalla de recepción o sala de directorio es mejor que Power BI
(marca, animación, fotos, sin licencia por pantalla).

Ojo: el ERP ya lee ese mismo RESUMEN.xlsx cada 30 minutos (`excel-sync` → `proyectos_excel_sync`).
El dashboard y el ERP leen el mismo archivo por dos caminos distintos.

### 2.4 Lo que el ERP ya tiene (Supabase, proyecto `icmuqwgrjgjoebnwunnf`)

| Capa | Hoy |
|---|---|
| Base | 121 tablas, 19 vistas, 89 funciones, 73 MB, RLS por tenant |
| Flujo financiero | `flujo_compromisos`: 2,658 filas importadas del Excel (Proyectos 1,399, Administración 1,053, Contabilidad 154, TI 52) + 241 nacidas en el ERP (OC aprobadas, facturas, valorizaciones). Vistas `v_flujo_mensual`, `v_cxp`, `v_cxc`, `v_cxp_por_mes`, función `flujo_caja(desde, hasta, área, proyecto)` |
| Compras | 1,389 OC con centro de costo, proyecto, partida y TC del día |
| Presupuestos | 1,290 partidas PROY-FOR-004, `v_partida_ejecucion`, alerta de sobregiro al aprobar OC |
| Proyectos | 11 proyectos, `proyecto_financiero()` como única definición de margen, `proyecto_cadena()` |
| Tipo de cambio | 1,498 días de SUNAT (`tc-sync` diario) |
| Tablero | `/bi/gerencia` (compromiso mensual, por proyecto, por CDC, concentración de proveedores) |
| Automatización | 4 crons: `excel-sync` cada 30 min (RESUMEN.xlsx), `fianzas-import` 2×día, `tc-sync`, notificaciones |
| **Sin cron** | **`flujo-import` es manual.** Última corrida: 23-sep para las 4 bases |
| Vacío | Recepciones (1), asientos (35), saldo de caja inicial = 0, presupuestos de área = 0 |

---

## 3. Diagnóstico: dónde se pierde la eficiencia

| # | Síntoma | Causa | Costo |
|---|---|---|---|
| 1 | El ERP y el Excel dicen cifras distintas (oct-26: 15.1 M vs 13.0 M) | Importación manual, última el 23-sep | Nadie confía en el ERP para el flujo; se sigue mirando el Excel |
| 2 | Gerencia "actualiza" pivots a mano y mantiene dos archivos (GM y GM Directorio) | El consolidado se arma copiando las bases dentro de Flujo GM | Horas al mes y riesgo de presentar la versión equivocada (ya pasó: 4.4 M vs 4.5 M) |
| 3 | Cada área captura en su Excel y Finanzas vuelve a capturar lo mismo en pivots | No hay una sola fuente | Doble digitación, errores de fórmula (`#VALUE!`, `#REF!`) |
| 4 | No hay histórico | Excel guarda el estado, no la serie | No se puede responder "¿cómo cambió la proyección de caja desde agosto?" |
| 5 | Tipo de cambio 3.40 fijo en el Excel, SUNAT diario en el ERP | Dos políticas | El consolidado en soles difiere en millones |
| 6 | 16 versiones de presupuesto en CUSCO FINAL | No hay control de versiones | Operaciones y Finanzas discuten sobre archivos, no sobre números |
| 7 | El dashboard de TV se rompe si alguien inserta una fila | Lee celdas fijas | Mantenimiento permanente |
| 8 | Las presentaciones a Directorio se arman a mano | No existe generador | Días de trabajo por sesión de directorio |

La conclusión importante para el GG: **cambiar de Excel a ERP sin resolver 1 y 2 no mejora
nada**; y resolver 1 y 2 se puede hacer sin obligar a nadie a dejar el Excel todavía.

---

## 4. Las cuatro cosas que pidió el GG, una por una

### 4.1 "Volcar toda la data a SQL"

Ya está volcada al 80 %. Lo que falta:

- **Automatizar `flujo-import`** igual que fianzas (cron 2×día, puerta de secreto, botón visible
  "Actualizar desde el Excel" con hora de última lectura). Una semana, sin cambiar nada del Excel.
- **Reconciliación visible:** una pantalla que muestre, por área y mes, Excel vs ERP y las filas
  que no cuadran. Es lo que hoy hace a mano la hoja `Control ERP` de LORETO.
- **Lo que sigue fuera y hay que decidir si entra:** saldos bancarios (hoy `saldo_caja_inicial` =
  0), presupuestos de área, facturas en el ERP (40 cargadas, Compras aún no registra).

### 4.2 "Tener un data warehouse"

Con 73 MB de datos no hace falta otro servidor. Lo que sí hace falta, y es lo que un warehouse
da, son tres cosas:

1. **Modelo en estrella en un esquema `dw`:** dimensiones `dim_fecha`, `dim_proyecto`,
   `dim_centro_costo`, `dim_proveedor`, `dim_area`, `dim_partida`; hechos `hecho_compromiso`
   (pagar/cobrar, previsto/real, en moneda origen y en soles al TC de la fecha), `hecho_orden`,
   `hecho_caja_chica`, `hecho_presupuesto`, `hecho_valorizacion`. Vistas materializadas,
   refrescadas por cron tras cada importación.
2. **Fotos diarias (`dw.snapshot_flujo`):** cada noche se guarda el flujo proyectado completo
   con fecha de foto. Eso da el histórico que el Excel no tiene: "la caja proyectada para
   diciembre era −2.1 M el 1 de setiembre y −4.0 M el 2 de octubre".
3. **Acceso de solo lectura para herramientas externas:** un rol `analista` con permiso solo
   sobre `dw`, conexión directa por el pooler de Supabase (Power BI la soporta de fábrica con el
   conector PostgreSQL). Nunca se expone `public`.

Si en uno o dos años el volumen o el número de fuentes crece (contabilidad externa, bancos,
SEACE), se puede mover `dw` a Fabric/Synapse sin tocar el ERP. Hoy sería gastar por adelantado.

### 4.3 "Tener indicadores"

Los indicadores deben definirse **una sola vez, en SQL**, y de ahí leerlos el ERP, Power BI y
el generador de presentaciones. Catálogo propuesto (los primeros ocho ya tienen fuente hoy):

| Indicador | Definición | Fuente hoy |
|---|---|---|
| Flujo neto mensual | ingresos − egresos (real y previsto) | `v_flujo_mensual` |
| Caja acumulada | saldo inicial + Σ flujo neto | `flujo_caja()` (falta saldo inicial) |
| Liquidez operativa | ingresos / egresos del mes (el `KPI Mensual` del Flujo GM) | derivable |
| Necesidad máxima de caja y mes | mínimo de la caja acumulada proyectada | derivable (= `Préstamo Socios`) |
| Préstamo óptimo | necesidad × (1 + colchón) redondeado, interés a TEA, devolución en el mes del CIPRL | función nueva con parámetros |
| Ejecución vs presupuesto por partida y proyecto | ejecutado / presupuestado, sobregiros | `v_partida_ejecucion` |
| Margen por proyecto (esperado, real, diferencia) | regla de Antonio en `proyecto_financiero()` | existe |
| Vencido y por vencer (0-30/31-60/61-90/+90) | compromisos pagar no pagados vs hoy | `v_cxp` |
| Concentración de proveedores | top 10 / total comprometido | `v_gerencia_por_proveedor` |
| Cobros CIPRL: programado vs real, días de atraso | valorizaciones y `flujo_compromisos` sentido cobrar | parcial (faltan los cobros del Excel sin valorización) |
| Intereses por mora (hojas `INTERESES`) | por proyecto y proveedor | solo Excel |
| Participación por centro de costo | hoja `Participación` | derivable |
| Costos OXI (consultoría 10 %, contraprestación 5 %, venta CIPRL 4 %) | `gastos_fijos_proyecto` | existe |

### 4.4 "Un botón que genere presentaciones según lo que el usuario quiera"

Tres caminos reales:

| | Cómo | A favor | En contra |
|---|---|---|---|
| A. Power BI "Exportar a PowerPoint" | El usuario filtra en Power BI y exporta | Nativo, cero desarrollo, puede incrustar visuales vivos | Diseño de Power BI, no de Memphis; cada usuario que exporta necesita licencia Pro; no arma narrativa ("resumen, luego proyecto X, luego caja") |
| B. **Generador en el ERP** ✅ | Botón "Generar presentación": elige audiencia (Directorio, Gerencia, Operaciones), proyectos, periodo y secciones; una Edge Function arma el PPTX con plantilla Memphis (pptxgenjs) y el PDF, y lo guarda en SharePoint | Sale con la marca y el orden que Directorio espera; sin licencia; usa las mismas vistas `dw`, así que la cifra es la del ERP | Dos semanas de desarrollo; los gráficos son imágenes, no interactivos |
| C. Dashboard de Adrián como "presentación viva" | Proyectar la app en la sala | Ya existe, bonito | No es exportable, no filtra, lee Excel |

Recomendación: **B para las sesiones formales y A para lo ad hoc.** No son excluyentes.

---

## 5. Power BI frente al dashboard de Adrián

| Criterio | Power BI | Dashboard de Adrián | Módulo BI del ERP (hoy) |
|---|---|---|---|
| Análisis (filtros, drill-down, cruces) | Excelente | No tiene | Básico |
| Histórico y tendencias | Sí, con `dw` | No | No |
| Fuente de datos | Postgres directo | Excel por celdas fijas | Postgres (vistas) |
| Diseño de marca / modo TV | Aceptable (rotación de páginas, pantalla completa) | Excelente | Normal |
| Seguridad por rol | RLS propio, hay que duplicar reglas | Cualquiera del tenant con acceso al archivo | RBAC del ERP |
| Móvil | App Power BI | Hecho a medida | Responsive |
| Exportar a PowerPoint / PDF | Nativo | No | CSV/Excel |
| Costo | Pro ≈ US$ 14 por usuario y mes (confirmar en la lista de licencias M365; el roadmap M365 ya lo marcaba como P1 pendiente de licencia) | Hosting gratis | Incluido |
| Mantenimiento | Modelo semántico + informes | Frágil (celdas fijas, 170 MB de fotos) | Código del ERP |

**Recomendación:**

1. **Power BI para Gerencia y Directorio como herramienta de análisis**, conectado al esquema `dw`
   (no al Excel). Cuatro informes: Caja y financiamiento, Proyecto 360, Compras y proveedores,
   Presupuesto vs ejecución. Licencias Pro solo para quienes editan o exportan (3 a 5 personas);
   el resto ve embebido en el ERP (`/bi`, roadmap M365 `powerbi-embed`) o por la app.
2. **El dashboard de Adrián se conserva solo como modo TV**, reconectado a una vista
   `dw.v_tv_proyectos` del ERP (dos o tres días: quitar MSAL y el parser, leer Supabase con
   clave anónima y RLS de lectura, mover fotos a Storage). Si Gerencia no usa el modo TV, se
   archiva: no vale la pena mantener dos tableros.
3. **El módulo BI del ERP sigue siendo la pantalla operativa diaria** (lo que ya está en
   `/bi/gerencia`) y gana el botón de presentaciones.

---

## 6. Plan de implementación

| Fase | Qué | Entregable | Esfuerzo | Depende de |
|---|---|---|---|---|
| **0. Cerrar el desfase** | Cron `flujo-import` 2×día para las 4 bases; hora de última lectura en pantalla; pantalla de reconciliación Excel vs ERP; unificar Flujo GM y Flujo GM Directorio (el Directorio pasa a ser una vista/presentación, no un archivo) | ERP = Excel con 12 h de desfase como máximo | 1 semana | Nada |
| **1. Capa analítica `dw`** | Esquema `dw`, dimensiones, hechos, vistas materializadas, foto diaria, rol de solo lectura, TC por fecha en todos los hechos | Histórico desde el día que se active; conexión lista para Power BI | 2 semanas | Fase 0 |
| **2. Catálogo de indicadores** | Los 13 de la tabla 4.3 como vistas/funciones en `dw`; `prestamo_socios(desde, hasta, colchón, tea)` reproduce la hoja nueva con parámetros; pruebas contra el Excel del 2-oct | Una sola definición por indicador, documentada | 1 a 2 semanas | Fase 1 |
| **3. Power BI** | Modelo semántico sobre `dw`; 4 informes; RLS por rol; actualización programada 8×día; embebido en `/bi` | Gerencia analiza sin pedir Excel | 2 semanas + licencias | Fases 1 y 2, licencias |
| **4. Botón de presentaciones** | En `/bi`: audiencia, proyectos, periodo, secciones → PPTX + PDF con plantilla Memphis (pptxgenjs en Edge Function), guardado en SharePoint, historial de presentaciones generadas | Presentación de directorio en 2 minutos | 2 semanas | Fase 2 |
| **5. Modo TV** | Dashboard de Adrián leyendo `dw.v_tv_proyectos`; o Power BI en pantalla completa si se descarta | Pantalla de sala/recepción sin Excel | 3 días | Fase 1 |
| **6. "El ERP manda"** | Las áreas registran compromisos directo en el ERP (`fuente = erp`); el Excel pasa a ser exportación; se apagan los importadores | Fin de la doble captura | 2 semanas + capacitación | Decisión del GG; fases 0 a 2 en uso |

Orden sugerido: 0 → 1 → 2 → (3 y 4 en paralelo) → 5 → 6. Total aproximado: **9 a 10 semanas de
desarrollo**, con valor visible desde la semana 1.

Lo que NO recomiendo: empezar por Power BI sobre los Excel. Reproduciría en otra herramienta el
mismo problema de fotos desfasadas y celdas frágiles, y habría que rehacerlo al pasar a `dw`.

---

## 7. Riesgos

- **Adopción, no tecnología.** Si en la fase 6 se obliga a dejar el Excel antes de que cada área
  vea sus números correctos en el ERP, vuelven al Excel. Por eso 0 a 2 van primero.
- **Decisiones financieras abiertas** que hoy hacen que el ERP muestre ceros: saldo de caja
  inicial, versión de presupuesto que manda en 4 proyectos, cobros del Excel sin valorización,
  facturas que Compras no registra. Sin ellas, el `dw` hereda los huecos.
- **Licencias Power BI**: confirmar qué hay en el tenant antes de la fase 3.
- **Dos verdades durante la transición**: mientras exista el Excel, la pantalla de
  reconciliación es obligatoria, y la cifra oficial es la del ERP a la hora de última lectura.

---

## 8. Decisiones que necesita tomar el Gerente General

1. ¿El ERP **refleja** el Excel (fases 0 a 5) o **manda** (fase 6) y desde cuándo?
2. ¿Power BI sí o no, y para cuántos usuarios con licencia Pro?
3. ¿Se conserva el dashboard de Adrián como modo TV o se archiva?
4. ¿Entran al ERP los saldos bancarios? (sin eso no hay caja acumulada real ni liquidez)
5. ¿Qué versión de presupuesto manda en LORETO, AMAZONAS, CUSCO PNP e HIDRO?
6. ¿Quién es el dueño de cada indicador (quién responde si la cifra está mal)?

---

## 9. Referencias en el repo

- `docs/ANALISIS-Flujo-Financiero-y-Documentos.md` (16-sep): las dos capas del flujo, "refleja o manda".
- `docs/PLAN-Dashboard-Gerencia.md` (31-ago) y `docs/PLAN-CxP.md`: el tablero actual y la cadena CxP.
- `docs/ROADMAP-Ecosistema-Microsoft365.md`: Power BI Embedded ya figuraba como P1 pendiente de licencia.
- Código: `supabase/functions/flujo-import`, `excel-sync`, `fianzas-import` (patrón de cron a copiar),
  `src/components/modules/bi/FlujoGerencia.tsx`, `src/lib/bi/gerencia-store.ts`.
- Dashboard de Adrián: `github.com/Adrian-7268/memphis-dashboard` (commit `ab9cf62`, 26-jun-2026).

---

## 10. El "flujo correcto" de Kevin, paso a paso contra el ERP (2026-10-07)

Kevin describió la cadena que el sistema debería cubrir. Esta tabla dice, para cada paso, qué
hay hoy en el ERP (verificado en la base), qué falta y dónde se corta la data. La regla de
lectura: **el modelo está casi completo; la data se corta en "OC aprobada"** porque de ahí en
adelante las áreas siguen registrando en Excel.

| # | Paso | En el ERP hoy | Data real | Qué falta |
|---|---|---|---|---|
| 1 | Nace el proyecto | `proyectos` con fase (idea → actos previos → ejecución → post), CUI, convenio, contrato, adendas | 11 proyectos | Nada |
| 2 | Se crea el presupuesto con todos los ítems | `presupuestos` + partidas (importador PROY-FOR-004), `v_partidas_proyecto` | 1,290 partidas en 10 presupuestos | Decidir la versión que manda en 4 proyectos; cargar presupuestos de área (0) |
| 3 | Empieza el proyecto | Estado `en_ejecucion`, acta, plazo, fases desde RESUMEN.xlsx (`excel-sync`) | 7 en ejecución | Nada |
| 4 | Requerimientos, cotizaciones y órdenes de los ítems | Cadena REQ → COT → OC con `partida_id` que viaja, aprobación por etapas, alerta de sobregiro por partida | 1,389 OC | Nada estructural. Que Compras siempre elija la partida |
| 5 | Recepciones | `recepciones` + `recepcion_items` valorados (`orden_item_id`, `valor_recibido`), conforme = entrada al kardex automática | **1 recepción** | Que Compras/Almacén registre las recepciones. Sin esto, 6 a 9 quedan vacíos |
| 6 | Salidas de los ítems a los proyectos | `movimientos_inventario` (tipo salida, `proyecto_id`, `referencia_tipo`), `registrar_movimiento_inventario()`, `v_stock_proyecto` | **0 salidas**, 1 artículo, 1 almacén | Pantalla de "despacho a proyecto" (ver 10.1) |
| 7 | Se reciben las facturas | `comprobantes_pago` (XML SUNAT, detracción y retención calculadas, enlace a OC y recepción, estado de flujo), portal de proveedores, factura → compromiso CxP → asiento | 40 facturas (portal) | Que Contabilidad registre o reciba por el portal todas las facturas |
| 8 | Pago parcial o total de facturas | `registrar_pago_compromiso(compromiso, fecha, monto, cuenta, referencia)` crea la `transaccion`, descuenta el compromiso y cierra factura/valorización cuando llega a cero | **0 transacciones** | Pantalla de pagos con monto parcial y cuenta bancaria; cuentas bancarias con saldo inicial (ver 10.2) |
| 9 | Pago de detracciones y retenciones | Tablas `detracciones` (código, tasa, base, monto, fecha de depósito, constancia) y `retenciones_percepciones`, calculadas al leer el XML | **0 filas** | Flujo de pago en dos partes (ver 10.3) |
| 10 | Apertura y cierre de cajas chicas | `cajas_chicas` con estado, regla "caja cerrada no admite gastos" (trigger), gastos con CDC y proyecto | 46 cajas, 1,138 gastos, 0 abiertas hoy | Nada |
| 11 | Flujos con la información previa | `flujo_compromisos` (pagar/cobrar, real/comprometido/proyectado), `v_flujo_mensual`, `flujo_caja()`, `v_cxp`, `v_cxc` | 2,658 del Excel + 241 nativas | Cron de importación (fase 0) y, al final, que nazcan en el ERP (fase 6) |
| 12 | Provisión y proyección de meses y proyectos siguientes | `origen = proyectado` en compromisos; proyectos en idea con contrato estimado; `BASE_IDEAS` del Excel (864 filas) aún no se importa | Parcial | Importar ideas; función `prestamo_socios()`; escenarios guardados con fecha (fotos diarias, fase 1) |
| 13 | Informe al comité: deudas, pagado, por pagar, ganancia obtenida, esperada, proyectada | `proyecto_financiero()` (margen esperado y real), `v_cxp` (deuda y vencido), `/bi/gerencia` | Con huecos por 5, 7 y 8 | Catálogo de indicadores (fase 2) y botón de presentación (fase 4) |
| 14 | Kardex | Kardex automático por artículo × almacén × proyecto, costo en soles al TC del día, reversión al anular | 1 entrada | Depende de 5 y 6 |
| 15 | El sistema responde las preguntas del comité | `proyecto_cadena()` arma presupuesto → gasto → saldo → facturado → pagado → recepcionado → inventario → contable → rentabilidad | Responde hasta "OC aprobada" | Todo lo anterior |

Conclusión: de los 15 pasos, 12 ya tienen modelo y función en la base. Los tres que faltan de
verdad son pantallas (6, 8, 9), y el resto es **disciplina de registro** en recepciones y
facturas. Sin recepciones no hay kardex; sin facturas no hay deuda real; sin pagos no hay caja.

### 10.1 Cómo se debería registrar la salida de ítems a los proyectos

Hoy la compra ya nace amarrada a un proyecto (la OC tiene `proyecto_id` por su centro de costo) y
la recepción conforme entra al almacén general con ese proyecto. Lo que falta es el movimiento
contrario y los casos reales:

- **Compra directa para un proyecto** (el caso normal: 23 camionetas para Huánuco): recepción
  conforme → entrada al kardex **ya con `proyecto_id`** → salida automática "despacho a proyecto"
  en el mismo acto, o un botón "Despachar" en la recepción. El stock del proyecto sube y baja el
  mismo día; el kardex deja constancia de que pasó por almacén.
- **Compra a stock, luego se asigna** (uniformes, repuestos, equipo de rescate): recepción sin
  proyecto → entrada al almacén general → pantalla **"Despacho a proyecto"**: artículo, cantidad,
  proyecto destino, partida del presupuesto que consume, guía de remisión, quién recibe. Eso crea
  la salida en `movimientos_inventario` (tipo `salida`, motivo `despacho_proyecto`,
  `proyecto_id`, `referencia_tipo = 'guia'`) y descuenta la partida.
- **Transferencia entre proyectos** (un ítem comprado para Loreto que termina en Amazonas): salida
  de un proyecto + entrada al otro en una sola operación, con motivo `transferencia`, para que el
  gasto real de cada proyecto se corrija solo y quede trazado. Hoy eso se arregla "reasignando la
  OC", que borra la historia.
- **Valorización en soles al TC de la fecha de salida**, no de la compra, para que el costo
  cargado al proyecto sea el que Contabilidad acepta.

La base ya soporta todo esto (`registrar_movimiento_inventario` acepta tipo, motivo, proyecto y
referencia). Lo que se construye es la pantalla de despacho y la regla "entrada con proyecto =
despacho automático". Dos a tres días.

### 10.2 Cómo se debería registrar el pago parcial o total de una factura

El modelo correcto ya está en la base: **la factura es la deuda, el pago es una transacción
contra esa deuda, y pueden ser varias.** `registrar_pago_compromiso` recibe el monto (si no se
manda, paga el saldo completo) y crea una transacción de egreso enlazada a la factura, la OC y el
proyecto; el compromiso se cierra solo cuando el pagado llega al total.

Lo que falta es la pantalla y dos decisiones:

1. **Pantalla "Registrar pago"** desde la factura o desde Cuentas por pagar: fecha, monto (por
   defecto el saldo), cuenta bancaria de salida, número de operación, moneda y TC del día si la
   factura está en dólares, adjunto del voucher. Varios pagos a la misma factura se listan debajo
   con su saldo restante. Un pago en exceso no se permite.
2. **Cuentas bancarias con saldo inicial** (`cuentas` existe, `saldo_caja_inicial` sigue en 0).
   Sin esto, el ERP sabe cuánto pagó pero no cuánto queda en el banco, y la "liquidez" del comité
   sale en cero.
3. **Regla de qué se considera pagado**: a efectos del flujo, la factura se paga en la fecha de la
   transferencia, no en la fecha de la factura ni en el mes programado. Es lo que hoy la columna
   `MES PAGADO` del Excel intenta, a mano.

### 10.3 Cómo se debería registrar el pago de detracciones y retenciones

Son dos pagos distintos de la misma factura, y el Excel los trae como columnas (`DETRACCIÓN`,
`RETENCIÓN`) que luego nadie suma. El registro correcto:

- **Detracción (SPOT)**: al leer el XML el ERP ya calcula si aplica, la tasa y el monto. El pago
  se parte en dos: **al proveedor** le llega el neto (total − detracción) y **al Banco de la
  Nación** va el depósito de detracción, con su constancia. Son dos transacciones enlazadas a la
  misma factura; la tabla `detracciones` guarda fecha de depósito y número de constancia. La
  factura se considera pagada cuando ambas están hechas, y el flujo de caja muestra la detracción
  en la fecha en que se deposita (normalmente dentro del mes siguiente), no en la del pago al
  proveedor.
- **Retención (agente de retención, 3 %)**: Memphis paga al proveedor el total − retención y emite
  el comprobante de retención; lo retenido se paga a SUNAT con el PDT del mes. En
  `retenciones_percepciones` queda el comprobante y la fecha; en el flujo aparece como un egreso
  mensual a SUNAT, no como parte del pago al proveedor. El centro de costo `RETENCION 3%` ya
  existe en el ERP para eso.
- **Percepciones** (cuando Memphis es el que las sufre al comprar combustible, etc.) van en la
  misma tabla con `tipo = percepcion` y son crédito contra el IGV, no un gasto.

Para el comité esto importa porque **la deuda con el proveedor y la deuda con SUNAT no son la
misma deuda**, vencen en fechas distintas y hoy se mezclan en una sola columna del Excel.

### 10.4 Qué agrega esto al plan

Tres pantallas que entran en la fase 0 o 1, porque sin ellas el `dw` no tiene nada real que
mostrar después de "OC aprobada":

| Pantalla | Dónde | Esfuerzo |
|---|---|---|
| Despacho a proyecto y transferencia entre proyectos | Inventario | 2 a 3 días |
| Registrar pago (parcial, cuenta, voucher) + cuentas bancarias con saldo | Finanzas / Cuentas por pagar | 3 días |
| Pago de detracción y comprobante de retención, con calendario mensual a SUNAT | Finanzas | 2 días |

Y una decisión más para el GG (la séptima): **quién registra recepciones y facturas en el ERP y
desde qué fecha.** Es la única pieza que ningún desarrollo reemplaza.
