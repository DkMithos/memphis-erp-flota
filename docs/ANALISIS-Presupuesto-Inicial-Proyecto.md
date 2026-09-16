# La plantilla presupuestal de Antonio, y qué hacer con ella

> Archivo: `PLANTILLA PRESUPUESTAL - NUEVA.xlsx`
> Ruta: COMPRAS → `General/0.0 PROYECTOS EN IDEA/`
> Analizado el 2026-09-16. El ejemplo cargado es GORE LORETO — BOMBEROS (CUI 2652192).

## Qué es el archivo

Tres hojas que juntas hacen el paso de "esta idea nos interesa" a "esto ganamos si
la ejecutamos".

### 1. `Plantilla Presupuesto` — el costeo, partida por partida

467 filas con una numeración jerárquica de hasta cuatro niveles (`1` → `1.1` →
`1.1.1` → `1.1.1.1`). Cada línea de último nivel lleva:

| Columna | Qué guarda |
|---|---|
| ITEM | `2.1.4.2` — la posición en el árbol |
| DESCRIPCION | el bien o servicio, con especificación técnica completa |
| UNIDAD | Und, Juego… |
| CANTIDAD | |
| PRECIO U. | en la moneda en que lo cotizó el proveedor |
| Tipo Moneda | Soles / US$ |
| PRECIO U. (S/) | convertido al tipo de cambio de cabecera |
| PRECIO T. (S/) | cantidad × precio |
| Impuesto | 18% |
| TOTAL Inc. IGV | |
| PROVEEDOR / NOTAS | con quién se coteja el precio |

La cabecera fija los datos del convenio: CUI, importe de ejecución, elaboración
del documento equivalente, financiamiento de la supervisión, **tipo de cambio** y
plazo en días.

Las nueve partidas de primer nivel del ejemplo:

| # | Partida | Sin IGV (S/) | Con IGV (S/) |
|---|---|---:|---:|
| 1 | Equipo de protección personal | 8 443 267 | 9 963 055 |
| 2 | Kit de rescate vehicular | 1 259 703 | 1 486 449 |
| 3 | Camión cisterna 1500 gal | 1 468 729 | 1 733 100 |
| 4 | Camión cisterna 3000 gal | 1 188 470 | 1 402 395 |
| 5 | Camión bomberos 3 t | 2 382 356 | 2 811 180 |
| 6 | Camión bomberos 6 t | 1 416 843 | 1 671 875 |
| 7 | Camioneta pick-up 4×4 equipada | 2 096 491 | 2 473 718 |
| 8 | Ambulancia rural tipo II (5 u.) | 1 843 606 | 2 175 455 |
| 9 | Gastos administrativos | 5 456 252 | 6 438 377 |

### 2. `Cuadro resumen` — dónde está el margen

Compara, línea a línea, dos precios que no son el mismo:

- **Precio documento equivalente**: lo que la entidad reconoce (lo que entra por
  el CIPRL).
- **Costo del proyecto**: lo que de verdad cuesta comprarlo.

La diferencia es el margen. Encima se restan las contraprestaciones, que son
porcentajes fijos del negocio OxI:

- Servicio de consultoría OxI — **10 %**
- Contraprestación privada — **5 %**
- Venta del CIPRL — **4 %**
- Y se suma la **ganancia por integración**, que es aparte.

### 3. `RENDIMIENTOS` — lo planificado contra lo que salió

Cuatro proyectos en columnas (Huánuco, Amazonas, Muni Cusco, Cusco Ambulancias),
cada uno con dos bloques idénticos: **costo planificado** y **rendimiento
resultante**. La misma estructura: ingresos sin IGV, costos, asesoría OxI,
ganancia neta, ganancia por integración, contraprestación 5 %, total y
porcentaje.

Esta hoja es la que contesta la pregunta que importa. Y lo que dice hoy:

| Proyecto | Margen planificado | Margen resultante |
|---|---:|---:|
| Huánuco | 7,64 % | **13,75 %** |
| **Amazonas** | 18,68 % | **−13,09 %** |
| Muni Cusco | 21,89 % | 31,17 % |
| Cusco Ambulancias | 31,40 % | 49,93 % |

Amazonas se planificó para ganar S/ 1,94 M y va camino de perder S/ 1,36 M.

## El problema del archivo

**El `Cuadro resumen` está roto: 31 celdas dicen `#¡REF!`.** Buena parte del
cuadro que compara precio-documento contra costo no calcula nada. Las fórmulas
apuntan a un libro o a unas hojas que ya no están (`=+#REF!`). Es decir: la
herramienta con la que se decide si un proyecto conviene hoy no suma.

Y el resto es frágil por construcción: el tipo de cambio es una celda que hay que
acordarse de tocar, los porcentajes de contraprestación están escritos dentro de
las fórmulas, y el `RENDIMIENTO RESULTANTE` se actualiza a mano cada vez que
alguien quiere saber cómo va un proyecto.

## Lo que el ERP ya tiene

Más de lo que parece:

- **Los importes de convenio ya están cargados y coinciden.** El "Importe del
  Proyecto" de la hoja RENDIMIENTOS es, exactamente, `monto_contrato +
  monto_adenda` del ERP:

  | Proyecto | RENDIMIENTOS | ERP (contrato + adenda) |
  |---|---:|---:|
  | Amazonas | 12 263 532,93 | 12 263 532,93 ✅ |
  | Cusco Ambulancias | 36 153 270,35 | 36 153 270,35 ✅ |

- **El costo real por proyecto ya es calculable.** Tras la revisión de
  Operaciones del 2026-09-16, las órdenes del ERP cuadran al céntimo con su
  archivo. El costo por proyecto sale solo de `ordenes_compra`.

- **Existen las tablas** `presupuestos` y `presupuesto_lineas`, y
  `centros_costo.proyecto_id` es el puente que ya conecta gasto con proyecto.

- **`proyectos.costo_real` se escribe a mano, y por eso miente.** Amazonas tiene
  S/ 11 960 000 tecleado (un número redondo) cuando sus órdenes suman
  S/ 8 139 958,89. Nadie va a mantener ese campo al día a mano.

## Qué se puede hacer con esto

### Lo que aporta de verdad: el presupuesto vivo

No se trata de copiar el Excel a una pantalla. Se trata de que la columna
`RENDIMIENTO RESULTANTE` —la que hoy se rehace a mano— se calcule sola.

1. **Cargar la plantilla.** Un importador que lea este mismo formato y llene
   `presupuesto_lineas` con el árbol de partidas. El equipo sigue costeando en
   Excel, que es donde saben trabajar, y sube el archivo cuando está cerrado.

2. **Guardar los parámetros del negocio donde se puedan ver**: tipo de cambio,
   consultoría 10 %, contraprestación 5 %, venta CIPRL 4 %, ganancia por
   integración. Hoy viven dentro de fórmulas; deberían ser campos del proyecto,
   editables y con histórico.

3. **Calcular el resultante contra lo real.** Por cada partida: cuánto se
   presupuestó y cuánto se lleva comprometido en órdenes. Eso ya existe, solo hay
   que cruzarlo. El margen deja de ser un número que alguien recalcula cuando se
   acuerda y pasa a ser una pantalla que se mira.

4. **Avisar cuando una partida se pasa.** Amazonas no se torció de un día para
   otro: se fue torciendo compra a compra. Con el presupuesto cargado, la orden
   que rompe la partida se ve al generarla, no seis meses después.

### Lo que hay que decidir antes (preguntas para Antonio)

- **La cuenta del margen.** ¿El 10 % de consultoría se calcula sobre el importe
  del convenio o sobre la ejecución? En la hoja aparece de las dos maneras según
  la columna, y con los `#¡REF!` no se puede deducir cuál es la buena.
- **La ganancia por integración**: ¿es un monto fijo por unidad negociado aparte,
  o un porcentaje? En el cuadro figura como importe suelto (S/ 460 000 para 23
  camionetas).
- **El tipo de cambio**: ¿se congela el del día del convenio, o se revalúa? Hoy
  es una celda fija en 3,70 y 3,40 según el archivo, y eso mueve el margen de
  todo lo comprado en dólares.

### Lo que NO conviene hacer

Reproducir el `Cuadro resumen` tal cual. Está roto, y copiarlo a código
significaría copiar también la lógica que nadie puede leer hoy porque las
referencias se perdieron. Mejor reconstruir la cuenta con Antonio partiendo de lo
que sí se entiende: precio-documento contra costo, menos las tres
contraprestaciones, más integración.

## Pendiente de Kevin

Esto es análisis, no implementación. Antes de construir hace falta que Antonio
conteste las tres preguntas de arriba — sobre todo la primera, porque de ella
depende el número que la gerencia mira para decidir si un proyecto entra.
