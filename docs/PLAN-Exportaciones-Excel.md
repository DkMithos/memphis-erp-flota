# Exportaciones a Excel — auditoría y plan

> Fecha: **lunes 31/08/2026**. Pedido de Kevin: *"todos los usuarios descargan info en Excel y
> las trabajan a su manera, por lo que cada uno debe poder extraer todo lo que requiera"*.
>
> El **motor ya está corregido y desplegado**. El despliegue por pantalla es el plan de abajo.

---

## 1. Qué encontré

### 1.1 El botón decía "Excel" pero bajaba un CSV

`exportToExcel()` generaba **CSV con separador de coma y extensión `.csv`**. En un Excel
configurado en español —separador de listas `;` y decimal `,`, que es lo estándar en Perú— ese
archivo se abre **con todo apelmazado en una sola columna**, y los importes llegan como texto,
así que no se pueden sumar sin limpiarlos a mano primero.

Eso explica por qué cada usuario "los trabaja a su manera": el archivo no llega usable.

### 1.2 Solo 12 de 44 pantallas exportan

| Módulo | Exportan | No exportan |
|---|---|---|
| **Contabilidad** | **0** | Asientos · Comprobantes · Plan de cuentas · Períodos · Registro de compras · Registro de ventas |
| **Proyectos** | **0** | Lista · Tareas · Valorizaciones · Riesgos · Panorama · Documentos |
| **Flota** (listas) | 0 | Vehículos · Mantenimientos · Flotas · Programación |
| Flota (reportes) | 3 | — |
| **Compras** | 3 | Recepciones · Facturas de proveedores |
| **Finanzas** | 2 | Transacciones · Presupuestos · Flujo de caja |
| **Proveedores** | 1 | Contratos · Evaluaciones · Talleres |
| Inventario | 0 | Artículos · Almacenes · Movimientos |
| CRM | 0 | Clientes · Oportunidades · Actividades |
| Biomédico | 1 | Calibraciones · Incidencias · Documentos · Mantenimientos |
| BI | 1 | Dashboard |
| Admin | 0 | Auditoría · Centros de costo |

Los huecos caen justo donde trabaja el equipo que entró hoy:

- **Walter (Contabilidad)** — su módulo entero no exporta nada.
- **Miguelangel (Proyectos)** — su módulo entero no exporta nada.
- **José (Flota)** — las listas no exportan; solo hay tres reportes.
- **Richard (Compras)** — le faltan Recepciones y Facturas.
- **Carolina y Shirley (Finanzas)** — les faltan Transacciones, Presupuestos y Flujo de caja.

### 1.3 Lo que sí exporta, exporta poco

La exportación de órdenes, por ejemplo, saca **7 columnas**: número, tipo, proveedor, estado,
moneda, total y fecha. No lleva centro de costo, proyecto, subtotal, IGV, condiciones de pago,
RUC del proveedor, cotización de origen **ni los ítems**. Para "trabajarla a su manera" hace
falta el detalle, no un resumen.

### 1.4 El permiso `exportar` existe pero no se usa

El RBAC define `<módulo>.exportar` para los 9 módulos, y ningún botón lo comprueba. Hoy da
igual porque quien ve el módulo puede exportarlo, pero es una decisión que conviene tomar a
propósito y no por omisión.

---

## 2. Lo que ya quedó arreglado (31/08)

**`exportToExcel()` ahora genera un `.xlsx` real**, no un CSV disfrazado. Con eso:

- **Desaparece el problema del separador**: un `.xlsx` no negocia comas ni puntos y comas.
- **Los importes llegan como número** y se pueden sumar directo.
- **Las fechas llegan como fecha**, no como texto.
- **Los códigos siguen siendo texto**: RUC, CCI, número de cuenta y cualquier valor con ceros a
  la izquierda. Sin esta regla, un RUC `20604953236` se convertía en número y podía acabar en
  notación científica.
- Cada columna sale con **ancho ajustado a su contenido** y con **autofiltro** en la cabecera.
- SheetJS se carga de forma diferida, así que el bundle principal no crece.

Las **12 pantallas que ya exportaban mejoran solas**, sin tocarlas.

También se agregó `exportToExcelMultiHoja()`, para lo que hoy obliga a bajar dos archivos y
cruzarlos a mano: una orden con sus ítems, una caja con sus gastos e ingresos, un proyecto con
sus valorizaciones.

Cubierto por pruebas (`export-utils.test.ts`, 6 casos) sobre la regla número-vs-código, que es
donde se pierde información sin que nadie lo note.

---

## 3. Plan para el resto

### Fase 1 · Lo que usa el equipo que ya entró (1–2 días)

| Pantalla | Para quién | Qué debe salir |
|---|---|---|
| Contabilidad · Comprobantes | Walter | comprobante, serie, tipo, emisor + RUC, fechas, moneda, subtotal, IGV, total, detracción, retención, estado, OC asociada |
| Contabilidad · Registro de compras y ventas | Walter | el formato que ya usa para SUNAT |
| Contabilidad · Asientos | Walter | asiento con sus líneas (dos pestañas) |
| Proyectos · Lista | Miguelangel | proyecto, CIU, cliente, estado, fechas, presupuesto, avance, valorizado |
| Proyectos · Valorizaciones | Miguelangel | valorización, proyecto, periodo, monto, estado, CIPRL |
| Flota · Vehículos | José | placa, VIN, flota, proyecto, marca, modelo, año, estado, contrato |
| Flota · Mantenimientos | José | vehículo, tipo, fecha, km, taller, costo, estado |
| Compras · Recepciones | Richard | recepción, OC, proveedor, fechas, ítems recibidos |
| Compras · Facturas | Richard | comprobante, proveedor, OC, montos, estado del flujo |
| Finanzas · Transacciones y Flujo de caja | Carolina, Shirley | movimiento, fecha, CC, proyecto, moneda, monto, saldo |

### Fase 2 · Enriquecer lo que ya exporta (1 día)

Ampliar las 12 exportaciones actuales a todas las columnas útiles, y usar multi-hoja donde hay
cabecera + detalle (órdenes, cotizaciones, requerimientos, cajas chicas).

### Fase 3 · El resto (medio día)

Proveedores (contratos, evaluaciones, talleres), Admin (centros de costo, auditoría) y los
módulos hoy ocultos, cuando se enciendan.

### Fase 4 · Decisión pendiente

¿Se aplica el permiso `exportar`? Hoy cualquiera que vea el módulo puede exportarlo. Si se
aplica, hay que revisar rol por rol quién debe poder sacar la data.

---

## 4. Lo que necesito de Kevin

1. **¿Confirmas el orden de fases?** La 1 es la que desbloquea al equipo que ya está trabajando.
2. **¿Aplicamos el permiso `exportar`** o cualquiera que vea el módulo puede exportar?
3. **¿Hay algún formato de archivo que ya usen** y convenga replicar tal cual (por ejemplo, el
   registro de compras de Walter para SUNAT, o el modelo de caja chica de Carolina)? Si el
   Excel que sale calza con el que ya trabajan, se ahorran el paso de reordenar columnas.
