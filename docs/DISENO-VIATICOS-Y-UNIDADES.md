# Diseño: viáticos y pasajes (#9) y equipamiento con número de serie (#11)

> Semana 3 del plan de carga (2026-10-13). Especificación para el sprint 5. **No se cargó nada todavía**: este documento
> fija el modelo, el flujo y qué se conecta con qué, para que la construcción y la carga del histórico sean un trabajo
> acotado. Fuentes: `Administración/Viáticos/CONTROL DE VIAJES 2026.xlsx` (797 reservas, 4 hojas), `Políticas laborales/`
> (política de pasajes y viáticos, formato de reembolso y liquidación) y `Logística/INVENTARIO GENERAL/MEMPHIS_IVENTARIO LA
> SIRENA ULTIMO.xlsx` (555 unidades con serie). Análisis previo en `docs/ANALISIS-Carpetas-Administracion-Proyectos.md`.

---

## 1. Viáticos y pasajes por proyecto

> **HECHO el 2026-10-16** (migración `20261016100000_viajes_viaticos.sql`, pantallas `/viajes`, `/viajes/:id`, `/viajes/tarifas`,
> app móvil `/app` como PWA, tarjeta "Gasto de viajes" en el Proyecto 360, 109 viajes históricos cargados). Flujo fijado por Kevin:
> solicita el personal → aprueba la jefatura → aprueba Carolina; la rendición sigue el mismo circuito. Tarifas = política v01;
> se sugieren y marcan el exceso, no bloquean. Detalle en CONTEXTO-SESION.md (2026-10-16) y docs/APP-MOVIL-VIAJES.md.

### 1.1 Qué resuelve
Hoy el gasto de viaje (pasajes aéreos y terrestres, hospedaje, movilidad, alimentación) se controla en un Excel de
Administración y **no llega al costo del proyecto**: el Proyecto 360 no sabe cuánto costó mandar a Nicolás a Huánuco a
inmatricular motos. El módulo debe dejar cada sol de viaje con proyecto, trabajador y comprobante, y cerrar el ciclo con la
rendición (que hoy pasa por caja chica).

### 1.2 Modelo (tablas nuevas, todas con `tenant_id` y RLS por tenant)

| Tabla | Para qué | Columnas clave |
|---|---|---|
| `viajes` | Un viaje = un motivo, un proyecto y un rango de fechas; agrupa reservas y viajeros | `numero` (VJ-AAAA-NNNN), `proyecto_id`, `centro_costo_id` (hereda del proyecto), `motivo`, `origen`, `destino`, `fecha_salida`, `fecha_retorno`, `estado` (solicitado · aprobado · en_curso · rendido · cerrado · anulado), `solicitado_por`, `aprobado_por`, `aprobado_en`, `presupuesto` (viáticos autorizados según política), `observaciones` |
| `viaje_pasajeros` | Quién viaja y con qué factor de viático (política: cargo, ciudad) | `viaje_id`, `persona_id` (trabajador; hoy las capacitaciones ya tienen personas por DNI: reutilizar esa tabla o `profiles` si es usuario), `dni`, `nombre`, `factor_viatico`, `dias`, `viatico_asignado`, `cuenta_abono` |
| `viaje_reservas` | Cada pasaje o reserva (la hoja PASAJES_RESERVAS) | `viaje_id`, `codigo_reserva`, `tipo` (aereo · terrestre · hospedaje · otro), `proveedor_id` (aerolínea/agencia del directorio), `tramo`, `origen`, `destino`, `fecha_ida`, `fecha_vuelta`, `moneda`, `costo`, `tc`, `costo_soles`, `pasajero_id` (→ `viaje_pasajeros`), `comprobante_id` (factura del SIRE cuando llega), `estado_pago` (pendiente · pagado), `transaccion_id`, `observaciones` |
| `viaje_rendiciones` | La liquidación del viajero: lo gastado contra lo entregado | `viaje_id`, `pasajero_id`, `fecha`, `entregado` (adelanto), `gastado`, `saldo` (a favor / a devolver), `estado` (borrador · presentada · aprobada · observada), `aprobado_por`, `caja_chica_id` (si se liquida por caja), `observaciones` |
| `viaje_rendicion_items` | Cada comprobante de la rendición | `rendicion_id`, `fecha`, `tipo_gasto` (alimentacion · movilidad · hospedaje · otro), `comprobante` (serie-número), `ruc`, `monto`, `sustentado` (boolean: con comprobante válido), `comprobante_id` (si Contabilidad lo enlaza al SIRE) |

Reglas:
- **Todo viaje tiene proyecto o centro de costo.** Sin eso no se aprueba (es la razón del módulo). Los viajes de oficina van
  a `OFCENTRAL`.
- **El costo del viaje al proyecto** = reservas pagadas + rendiciones aprobadas. Entra al Proyecto 360 como una línea más
  de gasto real (vista `v_gasto_viajes_proyecto`, sumada en `proyecto_cadena` junto a OC, facturas y caja chica).
- **Viático según política**: `factor_viatico × días × tarifa de la ciudad` desde una tabla `viaticos_tarifas` (ciudad/categoría,
  monto diario, vigencia) que Administración mantiene; la política escrita en `Políticas laborales/` es la fuente.
- **Rendición**: el saldo a devolver se descuenta por caja chica o planilla; el saldo a favor se paga como línea libre en un
  lote de pago (`lote_pago_agregar_libre`, ya existe). No se duplica con caja chica: si la rendición se liquida por caja, el
  gasto de caja chica referencia la rendición (`caja_chica_gastos.rendicion_id`) y el Proyecto 360 lo cuenta una sola vez.
- **Pasajes pagados con tarjeta/transferencia**: la reserva nace `pendiente`; al conciliar el cargo del banco (Bancos ›
  Registrar, clasificación nueva `viaje`) o al llegar la factura de la aerolínea por el SIRE, pasa a `pagado` con su
  `transaccion_id` / `comprobante_id`.

### 1.3 Flujo y pantallas
1. **Solicitud** (Administración o el jefe de proyecto): motivo, proyecto, fechas, viajeros → viático calculado por política.
2. **Aprobación** (gerencia de operaciones/administración según monto): estado `aprobado`; genera el adelanto de viáticos
   (línea libre en lote de pago o caja chica).
3. **Reservas**: Administración registra cada pasaje/hospedaje con código, proveedor y costo (hoy la hoja PASAJES_RESERVAS).
4. **Rendición**: el viajero (o Administración por él) carga los comprobantes; Administración aprueba u observa.
5. **Cierre**: todo pagado y rendido → `cerrado`; el gasto queda en el proyecto.

Pantallas: `Administración › Viajes` (lista con filtros por proyecto, viajero, estado, mes; paginada), detalle del viaje
(viajeros · reservas · rendición), y una tarjeta "Gasto de viajes" en Proyecto 360. Permisos nuevos: `viajes.ver`,
`viajes.crear`, `viajes.aprobar`, `viajes.rendir`.

### 1.4 Carga del histórico 2026 (al final, no antes)
- `PASAJES_RESERVAS` (797 filas) → `viaje_reservas`; se agrupan en `viajes` por (proyecto, destino, semana de salida) con
  estado `cerrado`; `PASAJES_PASAJEROS` → `viaje_pasajeros` (el "factor" del Excel es `factor_viatico`).
- Proyecto del Excel → `proyectos.codigo` con el mismo mapa de CDC de la semana 1 (GORE-HUANUCO → 03HNCPNP25…).
- Aerolíneas/agencias → `proveedores` (ya existen las del SIRE: LATAM, Sky, JetSMART, agencias).
- Reservas con "pago" en el Excel → `estado_pago = pagado`; el cruce con el extracto 2026 y el SIRE se hace después con las
  mismas reglas de Bancos (importe ± 2 días).
- Lo que no se carga: rendiciones pasadas (viven en PDF); solo el total rendido por viaje si la hoja RESUMEN lo trae.

### 1.5 Esfuerzo y riesgo
4-5 días: migración (5 tablas + vista + permisos), 3 pantallas, carga. Riesgo bajo para el resto del ERP: solo suma al
Proyecto 360 y a los lotes (líneas libres ya existen). Decisiones que necesita Kevin: quién aprueba viajes y hasta qué monto;
si el viajero rinde él mismo en el ERP (necesita usuario) o lo hace Administración; tabla de tarifas de viático vigente.

---

## 2. Equipamiento con número de serie

> **HECHO el 2026-10-15** (migración `20261015140000_inventario_unidades_serializadas.sql`, pantalla `/inventario/unidades`,
> pestaña Equipamiento del vehículo, tarjeta en el Proyecto 360, acta PDF, 546 unidades de LA SIRENA cargadas). Decisiones
> tomadas por defecto: instalado en vehículo = `instalada`, `entregada` solo con acta; series las mantiene quien tenga
> `inventario.crear/editar`. Detalle en CONTEXTO-SESION.md (2026-10-15).

### 2.1 Qué resuelve
Bodycams, radios, tablets, NVR, arneses, GPS: se compran por lote, se instalan en una unidad concreta (camioneta, moto) o se
entregan al Estado **por número de serie**, y se devuelven al proveedor también por serie (devolución a SUMTEC con guía). El
kardex actual (`movimientos_inventario`, `stock_almacen`) es por cantidad: sabe que hay 40 bodycams, no cuáles. La hoja
`MEMPHIS_IVENTARIO LA SIRENA ULTIMO` (555 unidades) es el único control, y vive en Excel.

### 2.2 Modelo (sobre el inventario existente, sin tocar el kardex)

| Tabla | Para qué | Columnas clave |
|---|---|---|
| `inventario_unidades` | Una fila por número de serie | `articulo_id` (→ `articulos`), `serie` (único por tenant+artículo), `lote`, `estado` (en_almacen · instalada · entregada · devuelta · en_reparacion · baja), `almacen_id`, `proyecto_id`, `vehiculo_id` (si está instalada en una unidad de Flota), `orden_compra_id`, `comprobante_id` (factura de compra), `proveedor_id`, `valor_usd`, `valor_soles`, `fecha_ingreso`, `fecha_salida`, `documento_salida` (guía / acta de entrega), `observaciones` |
| `inventario_unidades_mov` | Historial de cada serie (dónde estuvo y cuándo) | `unidad_id`, `fecha`, `tipo` (ingreso · instalacion · entrega · devolucion · reparacion · baja · traslado), `de` / `a` (almacén, vehículo, proyecto o proveedor), `documento`, `movimiento_inventario_id` (enlace al kardex por cantidad cuando el movimiento también mueve stock), `usuario` |

Reglas:
- **El kardex sigue mandando en cantidades.** Una entrada de 40 bodycams por recepción de OC crea 40 unidades `en_almacen`
  (con serie si la recepción las trae, o "pendiente de serie" para completar después). Un despacho a proyecto
  (`inventario_despachar`, ya existe) mueve las unidades elegidas a `proyecto_id` y estado `entregada`/`instalada`.
- **Instalación en Flota**: `vehiculo_id` + estado `instalada`; la ficha del vehículo muestra su equipamiento por serie (lo que
  hoy Operaciones busca en el Excel cuando el GORE pregunta "qué bodycam tiene la camioneta 12").
- **Devolución al proveedor**: estado `devuelta` con guía; la unidad sale del stock por cantidad con un movimiento `salida`
  motivo `devolucion` (ya existe) enlazado.
- **Serie única** por artículo; si el proveedor repite serie en dos artículos distintos no choca.
- Sin cambios en `stock_almacen`: la vista `v_unidades_por_articulo` compara cantidades (kardex) contra series registradas y
  avisa diferencias.

### 2.3 Pantallas
- `Inventario › Unidades`: lista por artículo/serie/estado/proyecto/vehículo (paginada), alta masiva por pegado (serie por
  línea) sobre una entrada del kardex, cambio de estado con documento.
- Pestaña "Equipamiento" en el detalle del vehículo (Flota) y en el Proyecto 360 (entregado al Estado por serie).
- Acta de entrega/devolución en PDF con las series (lo que hoy se arma a mano para el GORE y para SUMTEC).

### 2.4 Carga del Excel LA SIRENA (555)
- Columnas del Excel: equipo, marca/modelo, serie, ubicación (almacén / vehículo / proyecto / devuelto), factura, valor US$ y
  S/, guía de devolución. Mapa: equipo → `articulos` (crear los que falten: hoy hay 1 artículo), ubicación → estado + proyecto
  o vehículo (por placa, que Flota ya tiene), factura → `comprobantes_pago` por serie-número del SIRE.
- Dry-run con rollback, dedupe por (artículo, serie), marca `origen = 'excel-la-sirena'`.

### 2.5 Esfuerzo y riesgo
3-4 días: migración (2 tablas + vista), 2 pantallas + pestañas, carga. Riesgo bajo: no cambia el kardex ni los costos por
proyecto; añade trazabilidad. Decisiones que necesita Kevin: si el equipamiento instalado en vehículos de los proyectos OXI
se registra como "entregado al Estado" al firmar el acta o al inmatricular; y quién mantiene las series (Logística o
Operaciones).

---

## 3. Orden sugerido para el sprint 5
1. Unidades serializadas (más corto, destraba las actas de entrega y la devolución a SUMTEC).
2. Viáticos (más largo; depende de las decisiones de aprobación y tarifas).
3. Correspondencia con el Estado (#10) queda para el sprint 6: módulo propio, 5,600 filas.
