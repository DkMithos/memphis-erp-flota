# PLAN DE ACCIÓN POST-AUDITORÍA — Memphis ERP Flota

**Fecha:** 2026-05-14
**Basado en:** Auditoría ultra-detallada de 4 agentes (navegación, UX/UI, lógica de negocio, multimoneda/GPS/ERP)

---

## RESUMEN DE HALLAZGOS

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICO   | ~26      |
| ALTO      | ~22      |
| MEDIO     | ~23      |
| BAJO      | ~18      |

---

## FASE 0 — FUNDACIÓN CRÍTICA (Semana 1)

> Bugs que corrompen datos o rompen la experiencia fundamental del ERP

### 0.1 — History API (navegación real del navegador)

**Problema:** `navigateTo()` solo hace `setState()`, el botón atrás del navegador no funciona, no se pueden compartir URLs, recargar pierde la ruta.

**Archivo:** `src/App.tsx` (líneas 242-246)

**Acción:**
- Implementar `window.history.pushState()` en `navigateTo()`
- Agregar listener `popstate` para sincronizar `currentRoute` con la URL real
- Leer `window.location.pathname` en el mount inicial
- Scroll to top en cada navegación

**Esfuerzo:** 2-3 horas
**Impacto:** CRÍTICO — el ERP no funciona como webapp sin esto

---

### 0.2 — Validación de transiciones de estado (todos los módulos)

**Problema:** Cualquier estado puede transicionar a cualquier otro. Se puede cerrar una OT anulada, aprobar un requerimiento rechazado, etc.

**Archivos afectados:**
- `src/lib/flota/ot-store.tsx` (líneas 395-476)
- `src/lib/biomedico/equipos-store.tsx` (línea 487)
- `src/lib/biomedico/mantenimientos-store.tsx` (línea 360)
- `src/lib/compras/requerimientos-store.tsx` (línea 436)
- `src/lib/compras/cotizaciones-store.tsx`
- `src/lib/compras/ordenes-store.tsx`
- `src/lib/compras/recepciones-store.tsx`
- `src/lib/proyectos/proyectos-store.tsx` (línea 258)
- `src/lib/crm/crm-store.tsx`

**Acción:**
- Crear helper compartido `validateTransition(currentState, newState, allowedTransitions)`
- Definir mapa de transiciones válidas por módulo (ya existe `ot-config.ts` como referencia)
- Aplicar validación en cada `actualizarEstado*()` y `cambiarEstado()`

**Esfuerzo:** 4-6 horas
**Impacto:** CRÍTICO — integridad de datos

---

### 0.3 — Corregir agregaciones multi-moneda (KPIs incorrectos)

**Problema:** 12+ dashboards suman PEN + USD directamente → números falsos.

**Archivos afectados:**
- `src/lib/bi/cross-report.ts` (líneas 185-210)
- `src/lib/bi/bi-store.tsx` (líneas 200-214, 260-261)
- `src/components/modules/finanzas/FinanzasDashboard.tsx` (líneas 42, 47)
- `src/components/modules/finanzas/FinanzasReportes.tsx` (líneas 94-104)
- `src/components/modules/finanzas/FinanzasFlujoCaja.tsx` (líneas 113-114)
- `src/components/modules/crm/CRMOportunidades.tsx` (línea 102)
- `src/components/modules/crm/CRMDashboard.tsx` (línea 164)
- `src/components/modules/proveedores/ProveedoresContratos.tsx` (línea 176)
- `src/components/modules/compras/OrdenesLista.tsx` (línea 104)
- `src/components/modules/contabilidad/ContabilidadDashboard.tsx` (línea 23)

**Acción:**
- Crear helper `convertirAMonedaBase(monto, moneda, tipoCambio)` en `src/lib/shared/currency-utils.ts`
- Modificar TODAS las agregaciones para convertir antes de sumar
- Los KPIs deben mostrar "(en PEN)" o la moneda base del tenant
- Agregar `moneda` a stores que les falta: `requerimientos-store`, `recepciones-store`, `ot-store`
- Corregir `flota/metrics.ts` L621-628: cambiar USD → PEN

**Esfuerzo:** 8-10 horas
**Impacto:** CRÍTICO — todos los dashboards muestran datos incorrectos

---

### 0.4 — Prevenir stock negativo

**Problema:** Se pueden registrar salidas que dejan stock negativo sin ninguna validación.

**Archivo:** `src/lib/inventario/inventario-store.tsx` (líneas 407-418)

**Acción:**
- Validar `stockActual - cantidadSalida >= 0` antes de insertar movimiento
- Retornar error descriptivo si stock insuficiente
- Hacer atómico el insert movimiento + update stock (usar Supabase RPC o transaction)

**Esfuerzo:** 2 horas
**Impacto:** CRÍTICO — corrupción de inventario

---

### 0.5 — Corregir bugs de stores (datos corrompidos)

| Bug | Archivo | Acción |
|-----|---------|--------|
| OT: `observaciones` = `motivo_anulacion` | `ot-store.tsx:227` | Separar campos en mapper |
| Cotización: `requerimiento_id` recibe código display | `cotizaciones-store.tsx:310` | Validar que sea UUID |
| Recepción: toda recepción con items = "completa" | `recepciones-store.tsx:314-316` | Comparar cantidades vs orden |
| Finanzas: `addGasto()` retorna dato stale | `finanzas-store.tsx:409-415` | Retornar desde el estado actualizado |
| CRM: `actualizarCliente` sobrescribe con null | `crm-store.tsx:294-321` | Filtrar `undefined` correctamente |
| Orden: `rechazarOrden()` → `borrador` | `ordenes-store.tsx:594` | Cambiar a estado `rechazada` |

**Esfuerzo:** 4-5 horas
**Impacto:** CRÍTICO/ALTO — corrupción de datos en 6 módulos

---

## FASE 1 — ESTABILIDAD UX (Semana 2)

> Consistencia visual, notificaciones, formularios

### 1.1 — Unificar imports de Sonner

**Problema:** 14 archivos usan `from 'sonner@2.0.3'` (con versión), resto usa `from 'sonner'`

**Acción:** Replace all `'sonner@2.0.3'` → `'sonner'` en los 14 archivos + `src/components/ui/sonner.tsx`

**Esfuerzo:** 30 minutos

---

### 1.2 — Reemplazar `alert()` y `confirm()` nativos

**Acción:**
- 8 `alert()` → `toast.error()` (Contabilidad, RecepcionForm, BiomedicoContratos)
- 15 `confirm()` → `AlertDialog` de Shadcn/UI (Proyectos, Contabilidad, Biomédico, Admin)

**Esfuerzo:** 3-4 horas

---

### 1.3 — Corregir doble espaciado iconos en botones

**Problema:** `<Button>` ya tiene `gap-2`, pero ~200+ iconos usan `mr-2` adicional.

**Acción:** Remove `mr-2` / `mr-1` de todos los iconos dentro de `<Button>`. El `gap-2` del botón ya provee separación correcta.

**Esfuerzo:** 2-3 horas (find & replace masivo)

---

### 1.4 — Dark mode: agregar variantes `dark:`

**Problema:** 50+ badges/status con colores hardcodeados sin variante dark.

**Acción:**
- Crear mapas de colores centralizados por módulo (ej: `STATUS_COLORS` con `dark:` incluido)
- Aplicar a: Proyectos (8+ archivos), Proveedores (4), Inventario (2), Admin (2)
- Cambiar `bg-white` → `bg-white dark:bg-gray-800` en contenedores QR (7 archivos)

**Esfuerzo:** 4-5 horas

---

### 1.5 — Validación básica en formularios

**Problema:** 15+ formularios sin validación alguna.

**Acción:**
- Agregar `required` a campos obligatorios
- Agregar validación pre-submit con mensajes `toast.error()`
- Priorizar: CRM (clientes, oportunidades), Inventario (artículos, movimientos), Finanzas (transacciones, gastos)

**Esfuerzo:** 6-8 horas

---

### 1.6 — Corregir rutas rotas

| Ruta | Acción |
|------|--------|
| `/proyectos/lista/:dbId` en TareaDetalle | Cambiar a `/proyectos/detalle/:dbId` |
| `/flota/vehiculos/:id/documentos` | Agregar ruta en App.tsx → VehiculoDetalle con tab documentos |
| Query param `?vehiculo=XXX` | Parsear en MantenimientoForm y pre-seleccionar vehículo |
| Búsqueda global → lista | Navegar al detalle de la entidad encontrada |
| `/inventario/almacenes` sin sidebar | Agregar sub-item en ERPSidebar |
| Dashboard fallback sin `onNavigate` | Pasar `navigateTo` como prop |

**Esfuerzo:** 3-4 horas

---

## FASE 2 — PERSISTENCIA Y ATOMICIDAD (Semana 3)

> Datos que se pierden al recargar, operaciones no-atómicas

### 2.1 — Datos frontend que no se persisten en DB

| Dato perdido | Store | Acción |
|-------------|-------|--------|
| Equipos: especificaciones | `equipos-store.tsx:204` | Agregar columna JSONB `especificaciones` a DB |
| Equipos: fecha_instalacion | `equipos-store.tsx:206` | Agregar columna `fecha_instalacion` a DB |
| Equipos: garantía completa | `equipos-store.tsx:211-215` | Agregar `garantia_proveedor`, `garantia_inicio` |
| Proveedores: observaciones | `proveedores-store.tsx:360` | Agregar columna `observaciones` a DB |
| Proveedores: motivo inactivación/rechazo | `proveedores-store.tsx:415,506` | Agregar `motivo_cambio_estado` |
| Compras: motivo rechazo | `cotizaciones/ordenes-store` | Agregar `motivo_rechazo` a ambas tablas |
| Ordenes: estado en_ejecucion | `ordenes-store.tsx:219` | Agregar estado `en_ejecucion` a enum DB |
| Equipos: costos acumulados | `equipos-store.tsx:219-220` | Calcular desde mantenimientos reales |

**Esfuerzo:** SQL migration + store updates = 6-8 horas

---

### 2.2 — Inserción atómica de items hijo

**Problema:** 4 stores insertan items secuencialmente. Si falla uno, los anteriores quedan huérfanos.

**Acción:**
- Crear Supabase RPC `crear_requerimiento_con_items(data JSONB)` que use transacción SQL
- Aplicar mismo patrón a cotizaciones, órdenes, recepciones
- O usar batch insert: `supabase.from('items').insert(todosLosItems)` en una sola llamada

**Esfuerzo:** 4-6 horas

---

### 2.3 — Race condition anti-patrón `setState` para leer dbId

**Problema:** `setOrdenes(prev => { dbId = prev.find(...)._dbId; return prev; })` — hack que causa render innecesario.

**Acción:**
- Usar `useRef` para mantener referencia al estado actual
- O leer directamente del último estado con un getter
- Afecta: Flota OT, Biomédico (2), Compras (4), Proveedores

**Esfuerzo:** 3-4 horas

---

## FASE 3 — GPS GEOSATELITAL (Semana 4)

### 3.1 — Configurar pg_cron para sync automático

**Acción:**
- Habilitar extensión `pg_cron` en Supabase
- Crear cron job cada 2-5 minutos que invoque la Edge Function `gps-sync`
- Agregar autenticación a la Edge Function (validar secret token en header)

**Esfuerzo:** 2-3 horas

---

### 3.2 — Corregir tipo inconsistente `imei` vs `identificador_api`

**Acción:** Unificar en la DB y types: usar `imei` como nombre canónico

**Esfuerzo:** 1 hora

---

### 3.3 — Tracking tiempo real con Supabase Realtime

**Acción:**
- Suscribirse a `gps_posiciones` INSERT con `supabase.channel('gps').on('postgres_changes', ...)`
- Actualizar marcadores del mapa en tiempo real sin polling

**Esfuerzo:** 3-4 horas

---

### 3.4 — Geocercas y alertas (futuro)

**Acción:**
- Crear tabla `gps_geocercas` (id, tenant_id, nombre, tipo, coordenadas JSONB, radio_metros)
- Crear tabla `gps_alertas` (id, tenant_id, vehiculo_id, tipo, mensaje, leida)
- Lógica en Edge Function: check `ST_Within` o distancia manual
- UI: dibujar geocercas en mapa, panel de alertas

**Esfuerzo:** 2-3 días

---

## FASE 4 — MULTI-MONEDA COMPLETA (Semana 5)

### 4.1 — Tabla histórico tipo de cambio

```sql
CREATE TABLE tipos_cambio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  moneda_origen TEXT NOT NULL,  -- 'USD', 'EUR'
  moneda_destino TEXT NOT NULL, -- 'PEN'
  tasa DECIMAL(10,4) NOT NULL,
  fecha DATE NOT NULL,
  fuente TEXT DEFAULT 'manual', -- 'manual' | 'bcrp' | 'sunat'
  UNIQUE(tenant_id, moneda_origen, moneda_destino, fecha)
);
```

### 4.2 — Agregar moneda a stores faltantes

- `requerimientos-store.tsx` — agregar `moneda: 'PEN' | 'USD'` a items
- `recepciones-store.tsx` — heredar moneda de la orden
- `ot-store.tsx` — agregar `moneda` a costos

### 4.3 — Habilitar EUR

- Cambiar `activo: false` → `true` en catálogo
- Actualizar todos los tipos `'PEN' | 'USD'` → `'PEN' | 'USD' | 'EUR'`
- Agregar EUR a `tipo-cambio-store.tsx`

### 4.4 — API BCRP (opcional, mejora)

- Edge Function que consulte tipo de cambio diario del BCRP
- Guardar en tabla `tipos_cambio` automáticamente via pg_cron

**Esfuerzo total Fase 4:** 2-3 días

---

## FASE 5 — INTEGRACIÓN ERP EXTERNO (Semanas 6-8)

### 5.1 — Infraestructura de sincronización

SQL migration para agregar columnas sync a todas las tablas involucradas:
```sql
ALTER TABLE proveedores ADD COLUMN external_id TEXT UNIQUE;
ALTER TABLE proveedores ADD COLUMN sync_status TEXT DEFAULT 'pending';
ALTER TABLE proveedores ADD COLUMN last_synced_at TIMESTAMPTZ;
ALTER TABLE proveedores ADD COLUMN sync_source TEXT;
ALTER TABLE proveedores ADD COLUMN sync_hash TEXT;
-- Repetir para: ordenes_compra, cotizaciones, requerimientos_compra,
-- recepciones, articulos_inventario, transacciones, comprobantes_pago
```

### 5.2 — API REST via Edge Functions

Endpoints necesarios:
- `GET/POST /api/v1/proveedores`
- `GET/POST /api/v1/ordenes-compra`
- `GET/POST /api/v1/recepciones`
- `GET/POST /api/v1/articulos`
- `GET/POST /api/v1/comprobantes`
- `GET /api/v1/sync/status`
- `POST /api/v1/sync/trigger`

### 5.3 — Webhooks (notificación push)

- Database webhooks con `pg_net` para notificar al ERP externo de cambios
- Endpoint receptor de webhooks del ERP externo → Edge Function

### 5.4 — Información necesaria del ERP externo

> **VER SECCIÓN 8 DE ESTE DOCUMENTO**

**Esfuerzo total Fase 5:** 2-3 semanas

---

## FASE 6 — CLEANUP Y MEJORAS (Semana 9+)

### 6.1 — Eliminar componentes legacy muertos

- `src/components/modules/FichaVehiculo.tsx`
- `src/components/modules/DetalleOrdenTrabajo.tsx`
- `src/components/modules/MantenimientosVehiculo.tsx`
- `src/components/modules/NuevaOrdenTrabajo.tsx`
- `src/components/modules/Flota.tsx`

### 6.2 — Implementar breadcrumbs

- El componente `ui/breadcrumb.tsx` ya existe
- Integrarlo en el layout principal basado en `currentRoute`

### 6.3 — Sistema de notificaciones persistentes

- Tabla `notificaciones` en Supabase
- Bell icon en topbar con badge de conteo
- Supabase Realtime para push
- Tipos: vencimiento documentos, stock mínimo, OT pendiente, GPS sin señal

### 6.4 — Saldo de caja chica

- Validar saldo suficiente antes de registrar gasto
- Descuento automático del `montoDisponible`

---

## CRONOGRAMA RESUMEN

| Fase | Semana | Contenido | Esfuerzo |
|------|--------|-----------|----------|
| 0 | 1 | Fundación crítica (history, transiciones, multimoneda KPIs, stock, bugs stores) | ~20-25h |
| 1 | 2 | Estabilidad UX (sonner, alert/confirm, iconos, dark mode, validación, rutas) | ~20-25h |
| 2 | 3 | Persistencia y atomicidad (datos perdidos, transactions, race conditions) | ~15-18h |
| 3 | 4 | GPS Geosatelital (cron, realtime, geocercas) | ~15-20h |
| 4 | 5 | Multi-moneda completa (histórico TC, EUR, BCRP) | ~15-20h |
| 5 | 6-8 | Integración ERP externo (API, webhooks, sync) | ~60-80h |
| 6 | 9+ | Cleanup y mejoras (legacy, breadcrumbs, notificaciones) | ~15-20h |

---

## 7. GPS GEOSATELITAL — SOLICITUD DE CREDENCIALES

### Datos que consumiremos de la API

Memphis ERP necesita consumir el siguiente endpoint de la API de Geosatelital:

**Endpoint principal:**
```
GET /v1/units/positions?imeis={lista_de_imeis}
```

**Datos que leemos de la respuesta (por cada unidad):**

| Campo API | Uso en Memphis | Tipo |
|-----------|---------------|------|
| `imei` | Identificador del dispositivo GPS vinculado al vehículo | string |
| `lat` | Latitud — posición en mapa | number |
| `lng` | Longitud — posición en mapa | number |
| `speed` | Velocidad actual (km/h) — alertas de exceso | number |
| `heading` | Rumbo/dirección (grados 0-360) | number |
| `altitude` | Altitud (metros sobre nivel del mar) | number |
| `odometer` | Odómetro del vehículo (km) — tracking de kilometraje para mantenimientos | number |
| `ignition` | Estado de ignición (encendido/apagado) — detectar vehículo en uso | boolean |
| `event` | Tipo de evento GPS (parada, movimiento, alarma, etc.) | string |
| `battery_voltage` | Voltaje de batería del dispositivo — alertas de batería baja | number |
| `satellites` | Cantidad de satélites conectados — calidad de señal | number |
| `gps_accuracy` | Precisión GPS en metros — confiabilidad de posición | number |
| `timestamp` | Fecha/hora del dispositivo — última lectura conocida | ISO 8601 |

**Frecuencia de consulta:** Cada 2-5 minutos (via cron automático)

**Volumen estimado:** 10-50 vehículos por tenant, multi-tenant (varios clientes)

### Endpoints adicionales que nos interesaría consumir (si están disponibles)

| Endpoint | Uso |
|----------|-----|
| `GET /v1/units` | Listar todas las unidades/dispositivos disponibles |
| `GET /v1/units/{imei}/history?from=X&to=Y` | Historial de recorrido para reportes |
| `GET /v1/units/{imei}/trips` | Viajes completados (inicio-fin) |
| `GET /v1/units/{imei}/stops` | Paradas realizadas |
| `GET /v1/geofences` | Geocercas configuradas en Geosatelital |
| `POST /v1/geofences` | Crear geocercas desde Memphis |
| `GET /v1/units/{imei}/fuel` | Nivel de combustible (si el sensor existe) |
| `GET /v1/alerts` | Alertas activas (exceso velocidad, geocerca, etc.) |
| Webhooks / Callbacks | Recibir notificaciones push de eventos en tiempo real |

### Credenciales que necesitamos de Geosatelital

| Credencial | Descripción |
|------------|-------------|
| **API Base URL** | URL base del servicio (ej: `https://api.geosatelital.com/v1`) |
| **API Key / Bearer Token** | Token de autenticación para el header `Authorization: Bearer {token}` |
| **Documentación de API** | Swagger/OpenAPI o PDF con todos los endpoints disponibles |
| **Lista de IMEIs** | Los identificadores IMEI de los dispositivos GPS instalados en los vehículos de Memphis Maquinarias |
| **Rate limits** | Límites de consultas por minuto/hora para no exceder cuota |
| **Sandbox/Testing** | ¿Hay ambiente de pruebas con datos simulados? |
| **Contacto técnico** | Persona de soporte de Geosatelital para consultas de integración |
| **Formato de respuesta** | ¿JSON siempre? ¿Hay paginación? ¿Compresión? |
| **Webhooks** | ¿Soportan callbacks HTTP para eventos en tiempo real? ¿Qué eventos? |
| **SLA** | Disponibilidad del servicio, tiempos de respuesta esperados |

### Preguntas para Geosatelital

1. ¿La API soporta consulta masiva de posiciones por múltiples IMEIs en una sola llamada?
2. ¿Hay límite de IMEIs por request?
3. ¿El token es por cuenta/empresa o por dispositivo?
4. ¿El token tiene expiración? ¿Hay refresh token?
5. ¿Soportan webhooks/callbacks para recibir eventos en tiempo real (push) en vez de polling?
6. ¿Tienen endpoint de historial de recorrido con filtro por rango de fechas?
7. ¿El odómetro viene del dispositivo GPS o del ECU del vehículo?
8. ¿Tienen endpoint de consumo de combustible si el vehículo tiene sensor de fuel?
9. ¿Hay API para gestionar geocercas (crear, editar, eliminar)?
10. ¿Tienen ambiente sandbox para desarrollo/pruebas?

---

## 8. INTEGRACIÓN ERP EXTERNO — INFORMACIÓN REQUERIDA

Para diseñar e implementar la integración, necesito que me proporciones:

### Sobre el ERP externo

| Pregunta | Por qué la necesito |
|----------|-------------------|
| **¿Qué ERP es?** (SAP, Oracle, Odoo, Concar, Siscont, Starsoft, otro) | Determina patrones de integración conocidos |
| **¿Es cloud o on-premise?** | Define si puedo hacer llamadas HTTP directas o necesito VPN/middleware |
| **¿Tiene API REST?** ¿Documentación disponible? | Sin API, la integración sería via archivos (CSV/Excel) |
| **¿Qué formato de datos usa?** (JSON, XML, SOAP, flat files) | Define el parser/serializer |
| **¿Qué autenticación requiere?** (API Key, OAuth, certificado, usuario/clave) | Para configurar las Edge Functions |
| **¿Qué entidades maneja?** | Para definir el mapping de campos |

### Sobre la sincronización

| Pregunta | Por qué la necesito |
|----------|-------------------|
| **¿Qué frecuencia de sync?** (tiempo real, cada 5 min, cada hora, diario, manual) | Determina la arquitectura (webhooks vs cron vs manual) |
| **¿Quién es "master" por entidad?** | Resolución de conflictos: ej. proveedores → ERP externo es master, OCs → Memphis es master |
| **¿Qué dirección de sync por entidad?** | Unidireccional vs bidireccional por tabla |
| **¿Hay usuarios compartidos?** | Si el mismo usuario opera ambos sistemas |
| **¿Hay datos históricos a migrar?** | Migración inicial antes de activar sync continuo |

### Datos específicos del mapping

| Entidad Memphis | ¿Existe en ERP externo? | ¿Cómo se llama? | ¿Qué campos comparten? |
|----------------|------------------------|-----------------|----------------------|
| Proveedores | ¿? | ¿? | RUC, razón social, dirección, contacto... |
| Órdenes de Compra | ¿? | ¿? | Número, proveedor, items, montos, moneda... |
| Facturas/Comprobantes | ¿? | ¿? | Serie-número, fecha, IGV, total... |
| Artículos/Productos | ¿? | ¿? | Código, descripción, unidad, precio... |
| Plan de Cuentas | ¿? | ¿? | Código cuenta, nombre, tipo... |
| Recepciones/Guías | ¿? | ¿? | Número guía, items recibidos... |

---

## NOTAS FINALES

- **No se hace commit ni deploy** hasta completar al menos Fase 0 + Fase 1
- Cada fase genera su propio `npm run build` de verificación
- Las fases son secuenciales excepto GPS (Fase 3) que puede hacerse en paralelo con Fase 2
- La integración ERP (Fase 5) depende de recibir la información de la sección 8
