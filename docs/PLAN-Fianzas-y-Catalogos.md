# Fianzas, catálogos y firmas — análisis y plan

> Fecha: **miércoles 03/09/2026**. Los tres puntos que pidió Kevin.
> El punto 1 y parte del 2 **ya están hechos y desplegados**; el resto es plan.

---

## 1 · Campos de texto libre que deberían ser desplegables

### Lo que ya quedó corregido

- **Caja chica → "Categoría"**: era texto libre y en realidad guarda el **tipo de documento**.
  Pasa a desplegable sobre el catálogo nuevo `tipo_doc_caja`, sembrado con los **9 valores que
  Administración ya usa** en las 978 filas migradas, y editable desde *Administración → Catálogos*.
  Se dejó fuera `MIGRADO` (19 filas): es un resto de la migración, no un tipo real. Esas filas no
  se tocaron para no perder información; quedan visibles para reclasificarlas.
- **Scroll de los desplegables con búsqueda**: dentro de un diálogo, el `react-remove-scroll` del
  diálogo bloqueaba la rueda sobre el popover porque vive en otro portal. Corregido con `modal`.
  Afectaba al selector de centro de costo y al de proyecto, en todo el sistema.

### Lo que falta, con el daño ya medido

El caso más caro no es caja chica, es **Órdenes de Compra**:

| Campo | Valores distintos hoy | Debería tener |
|---|---|---|
| `ordenes_compra.condiciones_pago` | **108** | 7 (catálogo `condicion_pago`) |
| `ordenes_compra.lugar_entrega` | **125** | un catálogo de almacenes y sedes |
| `requerimiento_items.unidad` | **40** | 13 (catálogo `unidad_medida`) |
| `cotizacion_items.unidad` | **19** | 13 |

Una sola condición de pago —30 días— está escrita de **seis formas distintas** en 776 órdenes:

| Cómo se escribió | Órdenes |
|---|---|
| `30 días` | 601 |
| `CREDITO A 30 DÍAS` | 134 |
| `CREDITO 30 DIAS` | 12 |
| `CRÉDITO 30 DÍAS` | 11 |
| `CREDITO 30 DÍAS` | 10 |
| `30 DÍAS` | 8 |

Y "Contado" convive con "CONTADO" (101 + 48). Cualquier informe que agrupe por condición de pago
hoy da un resultado equivocado, y el problema crece con cada orden nueva.

**Propuesta, en dos partes:**

1. **Cerrar la entrada** — convertir esos cuatro campos en desplegables sobre catálogo. Es el
   mismo patrón que ya se aplicó a caja chica, así que es trabajo mecánico.
2. **Consolidar lo existente** — mapear las 108 variantes a las canónicas. Esto **no se hace a
   ciegas**: se propone una tabla de equivalencias, la revisa Compras, y recién ahí se aplica.
   Las que no encajen (`CIPRL`, `50%`, `PAGO POR ADELANTADO`) se suman al catálogo, no se fuerzan.

**Pendiente de decisión:** el lugar de entrega. ¿Es una lista corta de almacenes y sedes, o
necesita seguir siendo libre porque cada obra tiene su dirección? Si es mixto, lo natural es un
desplegable con opción "otro" que habilite el texto.

---

## 2 · La orden de compra impresa

### Corregido

La plantilla **ya tenía** requerimiento, centro de costo, condición de pago, lugar de entrega y
observaciones: salían en blanco porque el dato nunca llegaba a la plantilla.

- La consulta no traía el centro de costo (solo su UUID) ni la cotización.
- `requerimientoId` estaba fijado a `null` en el mapeo, con un comentario que decía *"derive from
  cotizacion if needed"*. El requerimiento no cuelga de la orden: se llega por la cotización.
- `lugar_entrega` y `observaciones` no se mapeaban.
- La plantilla leía `condiciones.formaPago`, pero `condiciones` es un **texto** en la base.

Verificado contra **MM-001232**: centro de costo SISTEMAS, requerimiento RQ-00238, condición
Contado, lugar Oficina Central. Todo eso ya estaba en la base desde la migración.

Se agregó además el **bloque de firmas**: Elaborado por · Revisado por · Aprobado por · Recibí
conforme, con nombre y fecha de quien conste en la orden y línea para firma manuscrita.

### Firmas registradas — pendiente de decisión

Kevin pidió que **los que aprueban puedan registrar su firma**. Eso es una función nueva, no un
arreglo. Lo que hace falta decidir antes de construir:

1. **Dónde vive la firma.** Propuesta: imagen PNG con fondo transparente en Supabase Storage, en
   un bucket privado, una por usuario, subida desde su propio perfil. Nadie sube la firma de otro.
2. **Qué se imprime.** Propuesta: la firma solo aparece cuando la acción **ocurrió en el sistema**
   (la orden fue aprobada por esa persona, con su fecha). Nunca en una orden en borrador. Una
   firma que se imprime sin la aprobación detrás no vale nada.
3. **Un dato incómodo:** hoy `aprobado_por` está **vacío en las 1,297 órdenes**, porque todas
   vienen migradas de oc-system y ninguna se aprobó dentro del ERP. Las firmas solo aparecerán en
   las órdenes nuevas; en las históricas la línea queda en blanco, para firma manuscrita.
4. **¿Hace falta "Revisado por"?** El flujo actual tiene un solo nivel de aprobación. Si Gerencia
   revisa antes, hay que modelarlo; si no, esa columna sobra.

---

## 3 · Módulo de Fianzas

### Lo que hay hoy

Revisé el SharePoint de Administración. La fuente es
`Administración/Fianzas/STATUS DE FIANZAS ACTUALIZADO 2026.xlsx`: **62 filas, 17 columnas**, que
cubren **9 contratos** con entidades públicas.

Cada contrato tiene una **cadena de cartas fianza**: la original (`-000`) y sus renovaciones
(`-001`, `-002`…). Solo una de la cadena está vigente (`VIGENCIA = SI`).

Columnas: concurso/contrato · proyecto · empresa o consorcio · entidad · proveedor (CESCE, AVLA) ·
tipo (fiel cumplimiento) · N° carta fianza · inicio · plazo · fin · fecha de renovación · monto
contrato · porcentaje · monto afianzado · costo de renovación · encaje · vigencia.

Las fechas son fórmulas: `FIN = INICIO + PLAZO − 1` y `RENOVACIÓN = FIN − 5`.

Los cargos viven aparte, en `Fianzas/Cargos Fianzas/<ENTIDAD>/`, en carpetas por entidad
(BOMBEROS MOYOBAMBA, Gore Cusco Ambulancias, Gore Huánuco Patrulleros, Muni Cusco Serenazgo…).

### Lo que el Excel no puede sostener

Al leerlo aparecieron incoherencias que un sistema evita por construcción. **No las corregí**: son
para que Administración las revise.

- **GORE Huánuco `-004`**: inicio 18/03/2026 y fin **15/06/2025**. El fin es anterior al inicio.
- **GORE Huánuco `-002` y `-003`**: misma fecha de inicio, fin y renovación. Una de las dos sobra.
- **GORE Cusco Ambulancias `-004`**: aparece **dos veces** con datos idénticos.
- **GORE Amazonas**: monto afianzado S/20,661.32 sobre un contrato de 12´285,032.93 al 4%.
  El 4% de ese contrato son ~S/491,401, no S/20,661.
- **Montos con tres formatos distintos** en la misma columna: `43.900.816,64`, `12´285,032.93`,
  `7082152,66`, `2,444,470.39`. Cualquier suma automática sobre esa columna es poco fiable.
- **Nombres tecleados**: `GONIERNO REGIONAL DE AMAZONAS` (por GOBIERNO) y `CESE` (por CESCE).
- Una fila con `NO` en la columna de concurso.

Esto es exactamente el argumento del punto 1: donde se escribe libre, se escribe distinto.

### Propuesta

**Dos tablas**, no una:

- `fianzas` — el contrato afianzado: entidad, proyecto, consorcio, concurso, monto de contrato,
  porcentaje. Se enlaza al **proyecto** del ERP, que ya existe para casi todas estas entidades.
- `fianza_cartas` — cada carta de la cadena: número, aseguradora, tipo, inicio, plazo, fin, fecha
  de renovación, monto afianzado, costo de renovación, encaje y estado (`vigente` · `renovada` ·
  `devuelta`). El fin y la renovación se **calculan**, como en el Excel, para que no se puedan
  teclear mal.

**Lo que gana Administración el primer día:**

- **Alertas de renovación.** Es el motivo real de este control: que no se venza una carta. Hoy eso
  depende de que alguien mire el Excel. En el ERP sale en pantalla y, cuando armemos las alertas
  (N28), llega a Teams.
- **Costo de renovación y encaje por proyecto y por año**, que hoy hay que sumar a mano.
- El histórico de la cadena, sin filas duplicadas.

**Cargos:** un adjunto por carta, guardado en Supabase Storage con el mismo criterio de carpetas
que hoy (entidad → carta). Se conserva el enlace a SharePoint para no romper lo existente.

### Accesos

| Quién | Qué |
|---|---|
| Carolina Okamura, Shirley Bujaico | Módulo completo: fianzas, cartas, cargos, exportar |
| Luis Monteza (`lmonteza@memphis.pe`) | **Solo cargos**: ver y subir. No ve montos ni el tablero |
| Administrador (Kevin, Adrian) | Todo, por ser administradores |

Se hace con un módulo `fianzas` y permisos propios; `fianzas.cargos` es el que se le da a Luis sin
darle `fianzas.ver`. Es el mismo patrón que ya se usó con `compras.recepcionar` para que Flota
entre a Recepciones sin ver el resto de Compras.

**`lmonteza@memphis.pe` todavía no tiene cuenta** — hay que crearla.

### El botón de actualizar el Excel

Kevin lo pidió explícito: que al actualizar en el sistema, el Excel también se actualice con un
botón. Es viable — `excel-sync` ya escribe en SharePoint por Microsoft Graph.

**Una advertencia que conviene decidir ahora:** si el ERP escribe el Excel y alguien lo edita a
mano en paralelo, uno de los dos pierde su cambio. Tres opciones:

1. **El ERP manda** (recomendada). El Excel pasa a ser una copia de lectura que el botón
   regenera, avisando en la propia hoja: *"generado desde el ERP, no editar aquí"*.
2. **Ida y vuelta.** Mucho más caro y frágil: hay que detectar qué cambió de cada lado y resolver
   conflictos. No lo recomiendo para 62 filas.
3. **Solo exportar.** El botón baja un `.xlsx` y quien quiera lo sube a SharePoint a mano.

Mi recomendación es la **1**, con la 3 como paso intermedio si se quiere arrancar sin tocar
SharePoint.

### Lo que necesito para construirlo

1. ¿Confirmas las dos tablas y que la fianza se enlace al **proyecto** del ERP?
2. ¿Opción 1 para el Excel (el ERP manda) o la 3 (solo exportar) para empezar?
3. ¿Creo la cuenta de **Luis Monteza** y le doy solo cargos?
4. ¿Administración revisa las 7 incoherencias antes de migrar, o migro tal cual y quedan marcadas
   dentro del ERP para corregirlas ahí?

Mi recomendación para la 4: **migrar tal cual y marcarlas**. Si esperamos la corrección, el módulo
no arranca; y dentro del ERP se corrigen una vez y quedan bien para siempre.
