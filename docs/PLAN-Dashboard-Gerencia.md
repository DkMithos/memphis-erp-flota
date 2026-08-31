# Dashboard de Gerencia — reemplazar el Flujo GM

> Fecha: **lunes 31/08/2026**. Pedido de Kevin: *"las métricas, análisis, indicadores que mostraba
> el Flujo GM deben poder verse en un dashboard del ERP, donde gerencia pueda revisarlo a detalle
> […] debemos tomar la mejor decisión para que tengan mayor practicidad al analizar y decidir"*.
>
> Estado: **PLAN — pendiente de decisión de Kevin.** Nada de esto está construido.

---

## 1. Lo primero, porque cambia todo lo demás

**La mitad de los indicadores del Flujo GM no se pueden calcular hoy.** No es un problema de
programación: la data no está en el sistema.

Los números que abren el Flujo GM —**S/92.25M de deuda**, **S/38.85M vencido**, el calendario de
pagos de **S/25.5M para setiembre**— salen todos de *facturas con fecha de vencimiento y estado
de pago*. Esa tabla existe (`comprobantes_pago`) y está **vacía**:

| Tabla que alimentaría el Flujo GM | Filas hoy |
|---|---|
| `comprobantes_pago` (facturas por pagar) | **0** |
| `comprobantes_detalle` | **0** |
| `transacciones` (bancos, liquidez) | **0** |
| `registro_ventas` (ingresos reales) | **0** |
| `presupuestos` / `presupuesto_lineas` | **0** |
| `asientos_contables` | **0** |

Si construyo el dashboard ahora, Gerencia entra y ve **S/0 de deuda y S/0 de liquidez**. Es peor
que no tenerlo: un tablero que muestra cero donde hay S/92M invita a decidir mal.

**Por eso el dashboard no es un trabajo independiente: es la pantalla final del módulo CxP**
(plan en [PLAN-CxP.md](PLAN-CxP.md)). Cargar las facturas es lo que enciende los indicadores.

## 2. Lo que sí se puede calcular hoy

No todo está bloqueado. Con lo que ya está migrado se sostiene la mitad "de compromiso":

| Fuente | Volumen | Sirve para |
|---|---|---|
| `ordenes_compra` | **1,297** OCs, todas con fecha, 1,295 con centro de costo, 944 con proyecto | Comprometido por mes, por proyecto, por centro de costo, por proveedor |
| `gastos_caja_chica` | **978** gastos con fecha, 941 con CC | Salida de caja real por mes y por área |
| `ingresos_caja_chica` | **139** | Reposiciones de caja (no son ingresos de la empresa) |
| `proyectos` | 11, 7 con presupuesto | Presupuesto vs comprometido |
| `centros_costo` | 79, 10 puenteados a proyecto | Corte por área |
| `valorizaciones` | 16 | Avance valorizado |

La serie mensual ya sale limpia. Esto es real, consultado hoy:

| Mes 2026 | OCs | Comprometido (S/, USD a 3.75) | Salida de caja chica |
|---|---|---|---|
| Enero | 53 | 529,727 | 39,535 |
| Febrero | 50 | 3,145,614 | 16,762 |
| Marzo | 69 | 6,572,114 | 32,799 |
| Abril | 48 | 2,465,164 | 23,801 |
| Mayo | 53 | 79,274 | 37,314 |
| Junio | 114 | 7,923,469 | 67,182 |
| Julio | 92 | 2,338,414 | 26,748 |
| Agosto | 73 | 267,168 | 32,832 |

**Dos advertencias que Gerencia tiene que ver escritas en la pantalla, no en un pie de página:**

1. **Comprometido ≠ pagado.** Una OC emitida es un compromiso, no una salida de dinero. Sin las
   facturas no se sabe cuánto de esos S/23M ya se pagó.
2. **El tipo de cambio está fijo en 3.75.** Mientras no haya una tabla de tipo de cambio por
   fecha, cualquier total mixto PEN/USD es aproximado. Conviene mostrar los importes **separados
   por moneda** y el consolidado como referencia, no como cifra oficial.

## 3. Dónde debe vivir — la decisión

Tres opciones reales:

| | Dónde | A favor | En contra |
|---|---|---|---|
| **A** | Módulo nuevo "Gerencia" | Espacio propio, entrada visible | Un módulo más que mantener: permisos, menú, rutas, RLS |
| **B** ✅ | Vista dentro de **BI** (`/bi/gerencia`), con su propia entrada en el menú | BI **ya es** el lugar que cruza módulos; su ruta ya admite a quien ve compras, finanzas, proyectos o flota; cero plomería nueva | Hay que cuidar que no se confunda con el reporte cruzado que ya existe |
| **C** | Dentro de Finanzas | Cerca del dinero | Finanzas es operativo (caja, transacciones); Gerencia no opera, analiza. Y el rol Gerencia no debería depender de ver Finanzas |

**Recomiendo B**: una vista **"Flujo Gerencia"** dentro de BI, con entrada propia en el menú para
que se encuentre de una. Razones concretas:

- **No crea un segundo lugar donde buscar los números.** El riesgo real de un tablero gerencial es
  que Gerencia vea una cifra y Contabilidad vea otra. Colgando de BI, ambos leen la misma fuente.
- **No hay que inventar permisos.** La regla que ya quedó aplicada hoy es "exporta lo que ve": el
  rol Gerencia ve los 10 módulos, así que entra y descarga sin tocar nada.
- **Es reversible.** Si Gerencia pide su propio espacio, mover una vista a un módulo nuevo es
  barato; partir el dato en dos módulos y volver atrás, no.

## 4. Qué se construye, por fases

### Fase 1 · Lo que ya se puede, sin esperar a CxP (2 días)

Cuatro bloques, todos con data real hoy:

1. **Compromiso mensual** — barras de comprometido por mes, separado PEN/USD, con el detalle de
   OCs detrás. Es el equivalente honesto del "KPI Mensual" del Flujo GM.
2. **Por proyecto** — presupuesto vs comprometido vs valorizado, para los 7 proyectos con
   presupuesto. Es el "RESUMEN PROYECTOS".
3. **Por centro de costo / área** — comprometido y salida de caja, que es lo que hoy Carolina
   arma a mano.
4. **Concentración de proveedores** — cuánto del comprometido está en los 10 principales. Esto el
   Flujo GM no lo tenía y es de las preguntas que Gerencia hace siempre.

Cada bloque: cifra grande, serie, **y el botón de descargar el detalle** (ya con `exportar`).

### Fase 2 · Deuda y calendario — **depende de CxP** (2 días una vez cargadas las facturas)

5. **Deuda total, vencida y por vencer** con antigüedad (0-30 / 31-60 / 61-90 / +90).
6. **Calendario de pagos** por semana y por mes: cuánto y cuándo hay que pagar.
7. **Pagado vs pendiente** por proveedor y por proyecto.

Estos son los que Gerencia pidió textualmente el 27/08: *"cuánto se debe, cuánto hay que pagar,
cuánto falta por pagar, cuánto y cuándo"*. **No se pueden hacer antes.**

### Fase 3 · Lo que exige data que aún no existe

8. **Liquidez y flujo neto** — necesita saldos de banco (`transacciones` vacía). Decisión
   pendiente: ¿se cargan los bancos al ERP o se deja fuera?
9. **Ingresos reales / OXI 10%** — necesita `registro_ventas`. Hoy la única fuente es el Excel.

## 5. Lo que necesito de Kevin

1. **¿Confirmas la opción B** (vista "Flujo Gerencia" dentro de BI con entrada propia)?
2. **¿Arranco la Fase 1 ya**, aunque la deuda quede en blanco hasta que entre CxP? Mi
   recomendación es sí: le da a Gerencia el lado de compromiso y proyectos desde el día uno, y
   deja el hueco de deuda **rotulado como "pendiente de carga"** en vez de mostrando S/0.
3. **Tipo de cambio**: ¿fijamos uno mensual en una tabla, o mostramos siempre PEN y USD por
   separado sin consolidar? Sin esto, ningún total mixto es defendible.
4. **Bancos e ingresos** (Fase 3): ¿entran al ERP o se quedan en el Excel de Gerencia?
