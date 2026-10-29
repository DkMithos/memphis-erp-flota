# API Memphis ERP · v1

> Para que otros sistemas lean el ERP (y registren correspondencia) con una clave propia, sin tocar
> PostgREST ni las claves de Supabase. Vive en la Edge Function `api` (`supabase/functions/api/index.ts`);
> las claves se administran en **Administración › API e integraciones** (`/admin/api`).

## URL base

```
https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/api/v1
```

- Documentación interactiva (Scalar, lee el OpenAPI): `…/v1/docs`
- Especificación OpenAPI 3: `…/v1/openapi.json`
- Estado del servicio (sin clave): `…/v1/salud`

## Autenticación

Cada sistema externo recibe una clave `mm_live_…` creada en el ERP (se muestra una sola vez; en la base solo
vive su SHA-256). Se envía en cada llamada:

```
x-api-key: mm_live_…        (o Authorization: Bearer mm_live_…)
```

La clave tiene **alcances** por módulo: `proyectos:leer`, `compras:leer`, `proveedores:leer`, `finanzas:leer`,
`inventario:leer`, `flota:leer`, `viajes:leer`, `fianzas:leer` y `proyectos:escribir` (registrar correspondencia).
Puede vencer en una fecha y se revoca al instante desde el ERP. Tope: **120 llamadas por minuto** por clave
(HTTP 429). Toda llamada queda en `api_accesos` (ruta, estado, duración, IP) y se ve en la pantalla de
administración.

## Formato

- Listas: `{ "data": [...], "paginacion": { "pagina": 1, "por_pagina": 50, "total": 1234 } }`.
  `?pagina=` y `?por_pagina=` (máximo 200). `?orden=columna` o `?orden=-columna` (descendente).
- Uno por id: `GET …/<recurso>/<uuid>` → `{ "data": {...} }`.
- Errores: `{ "error": "mensaje", "codigo": "sin_clave | clave_invalida | sin_alcance | tope | no_existe | validacion" }`.
- Fechas `AAAA-MM-DD`; montos en la moneda de cada fila (`moneda`), con `tipo_cambio` cuando aplica.
- Solo salen columnas de negocio: nunca tokens, rutas de archivos, firmas ni claves.
- **Datos relacionados (`?incluir=`)** en órdenes de compra y facturas: lista separada por coma o `todo`. En el detalle
  por id (`/ordenes-compra/{id}`, `/facturas/{id}`) viene todo por defecto. La respuesta agrega `incluido: [...]`.
  - `/ordenes-compra`: `items` (líneas con descuento por ítem), `proveedor`, `proyecto`, `centro_costo`, `firmas` (etapa,
    quién y cuándo; sin la imagen), `recepciones` (con sus líneas), `facturas` (recibidas contra la OC), `ediciones`
    (solicitudes de edición), `pagos` y `compromisos` (estos dos exigen también `finanzas:leer`).
  - `/facturas`: `detalle` (líneas), `proveedor`, `proyecto`, `centro_costo`, `orden`, `archivos` (`pdf_url` y `xml_url`
    firmadas por 10 minutos), `detracciones`, `pagos` y `compromiso` (los tres últimos exigen `finanzas:leer`).
  - Si la clave no tiene el alcance para una expansión, la fila trae `_omitido` con el motivo en lugar de fallar.
  - Con `incluir` la página se arma con una consulta extra por expansión (no por fila): 200 órdenes con todo tardan
    unos segundos, no minutos. Para volcados completos, paginar con `por_pagina=200`.

## Recursos (GET)

| Ruta | Alcance | Fuente | Filtros |
|---|---|---|---|
| `/proyectos` · `/proyectos/{id}` | proyectos | `proyectos` | `estado`, `region`, `q` |
| `/proyectos/{id}/financiero` | proyectos | `proyecto_financiero()` + `proyecto_cadena()` | — |
| `/valorizaciones` | proyectos | `valorizaciones` | `proyecto_id`, `estado` |
| `/correspondencia` · `/correspondencia/{id}` | proyectos | `v_correspondencia` | `proyecto_id`, `estado`, `tipo`, `vencida`, `desde`, `hasta` |
| `/capacitaciones` · `/certificados` | proyectos | `capacitaciones`, `certificados` | `proyecto_id` / `capacitacion_id`, `estado` |
| `/ordenes-compra` · `/ordenes-compra/{id}` | compras | `ordenes_compra` (todas las columnas) + `incluir` | `estado`, `proyecto_id`, `proveedor_id`, `numero`, `desde`, `hasta` |
| `/cotizaciones` | compras | `cotizaciones` | `estado`, `proveedor_id`, `proyecto_id`, `requerimiento_id`, `desde`, `hasta` |
| `/facturas` · `/facturas/{id}` | compras | `comprobantes_pago` (todas las columnas) + `incluir` | `direccion`, `estado_flujo`, `proyecto_id`, `ruc`, `proveedor_id`, `orden_compra_id`, `numero`, `desde`, `hasta` |
| `/proveedores` · `/proveedores/{id}` | proveedores | `proveedores` | `estado`, `ruc`, `q` |
| `/cuentas-por-pagar` | finanzas | `v_cxp` | `estado_pago`, `vencido`, `proyecto_id`, `proveedor_id`, `area`, `desde`, `hasta` |
| `/cuentas-por-cobrar` | finanzas | `v_cxc` | `estado_pago`, `proyecto_id`, `desde`, `hasta` |
| `/pagos` | finanzas | `transacciones` | `tipo`, `estado`, `proyecto_id`, `cuenta_bancaria_id`, `q`, `desde`, `hasta` |
| `/bancos/cuentas` · `/bancos/movimientos` | finanzas | `cuentas_bancarias`, `movimientos_bancarios` | `activa` / `cuenta_bancaria_id`, `clasificacion`, `conciliado`, `desde`, `hasta` |
| `/caja-chica/cajas` · `/caja-chica/gastos` | finanzas | `cajas_chicas`, `gastos_caja_chica` | `estado` / `caja_id`, `proyecto_id`, `categoria`, `desde`, `hasta` |
| `/indicadores/resumen` | finanzas | calculado | — (proyectos por estado, OC del mes, CxP pendiente y vencida, pagos y cobros del mes, cajas, cartas pendientes) |
| `/inventario/articulos` · `/inventario/unidades` | inventario | `articulos`, `v_inventario_unidades` | `activo`, `q` / `estado`, `proyecto_id`, `articulo_id`, `serie` |
| `/flota/vehiculos` · `/flota/vehiculos/{id}` | flota | `vehiculos` | `estado`, `proyecto_id`, `placa` |
| `/viajes` · `/viajes/{id}` | viajes | `v_viajes` | `estado`, `proyecto_id`, `desde`, `hasta` |
| `/fianzas` | fianzas | `fianzas` | `proyecto_id` |
| `/yo` | — | la clave | quién soy y mis alcances |

Las columnas exactas de cada recurso están en el OpenAPI (descripción de cada ruta).

Descuentos de proveedor (desde el 26/10/2026): en `/ordenes-compra` y `/cotizaciones` viajan `descuento_global_tipo`
(`porcentaje` o `monto`), `descuento_global_valor` y `descuento_global` (monto ya calculado). La regla es
`subtotal = bruto − descuentos por ítem − descuento global`; `igv` y `total` se calculan sobre ese subtotal. Los descuentos
por ítem (`descuento_tipo`, `descuento_valor`, `descuento`) vienen en cada línea con `incluir=items`.

Ejemplos de "todo": `GET /ordenes-compra?desde=2026-01-01&incluir=todo&por_pagina=200` (órdenes del año con ítems,
firmas, recepciones, facturas y pagos) · `GET /facturas/{id}` (la factura con detalle, orden, detracciones, pagos y enlaces
al PDF/XML).

## Escritura

`POST /correspondencia` (alcance `proyectos:escribir`): `{ proyecto_id, asunto, numero_doc?, tipo?, sentido?, emisor?,
receptor?, fecha_documento?, fecha_recepcion?, requiere_respuesta?, plazo_dias?, fecha_limite?, responde_a?, archivo_url?,
observaciones? }` → `201 { data: { id, numero_doc, estado, fecha_limite } }`. Queda con `origen_datos = api:<integración>`.

## Ejemplos

```bash
curl -H "x-api-key: mm_live_…" "https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/api/v1/cuentas-por-pagar?estado_pago=PENDIENTE&vencido=true&por_pagina=200"
```

Power BI (Obtener datos › Consulta en blanco › Editor avanzado):

```m
let
  Origen = Json.Document(Web.Contents("https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/api/v1/pagos",
    [Query = [desde = "2026-01-01", por_pagina = "200"], Headers = [#"x-api-key" = "mm_live_…"]])),
  Filas = Table.FromRecords(Origen[data])
in
  Filas
```

Para más de 200 filas en Power BI, iterar `pagina` con `List.Generate` hasta `paginacion.total`.

Python:

```python
import requests
r = requests.get("https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/api/v1/proyectos",
                 headers={"x-api-key": "mm_live_…"}, params={"estado": "en_ejecucion"})
print(r.json()["data"])
```

## Cómo está hecho

- Edge Function `api` con Hono; `withSupabase({ auth: 'none' })` porque la credencial es la clave propia (se verifica
  en la función), y todas las consultas van con el cliente admin **filtrando por el `tenant_id` de la clave**.
  Desplegada con `verify_jwt = false`.
- Tablas `api_claves` (hash, alcances, vencimiento, uso) y `api_accesos` (bitácora); funciones `api_clave_crear` (genera y
  devuelve la clave una vez; exige `admin.gestionar_usuarios`), `api_clave_revocar`, `api_clave_tocar` (uso).
- Catálogo de recursos en `RECURSOS` dentro de la función: tabla o vista, columnas permitidas, orden y filtros. Agregar un
  recurso = agregar una entrada; el OpenAPI y la documentación se generan solos.
- Lo que no entra en v1: webhooks (avisar a otro sistema cuando algo cambia), escritura de OC/facturas, OAuth. Se agregan
  cuando haya un consumidor concreto.
