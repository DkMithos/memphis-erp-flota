# PORTAL DE PROVEEDORES — Envío de facturas y amarre a la orden

> Solicitud de Kevin (2026-07-09): que los proveedores puedan enviar sus facturas y
> asignarlas a la orden correspondiente, para continuar el flujo. Idea inicial: login con
> RUC + contraseña, ver solo las órdenes de ese RUC, subir facturas (XML o PDF), individual
> o masivo, bajo un formato. **Toda factura amarrada a una orden.**
> Este documento es ANÁLISIS y PLAN — sin cambios de código todavía.

## 1. Qué ya tenemos (no partimos de cero)

- **`comprobantes_pago`** ya modela la factura con TODO el detalle SUNAT: `tipo`, `serie`,
  `numero`, `numero_completo`, `fecha_emision`/`vencimiento`, `ruc_emisor`,
  `razon_social_emisor`, `ruc_receptor`, `razon_social_receptor`, bases (`op_gravada`,
  `op_exonerada`…), `subtotal`, `igv`, `total`, `moneda`, `tipo_cambio`, detracción y
  retención completas, `estado`, `proveedor_id`, **`orden_compra_numero`**, y enganche
  contable (`asiento_id`, `contabilizado`). Hoy tiene **0 filas** (recién se empezaría a usar).
- **`recepciones` / `recepcion_items`**: el paso de conformidad (recepción de bienes/servicios)
  con el que la factura debe cruzar.
- **`ordenes_compra`**: 1,081 OCs activas de **122 proveedores** (128 con RUC). `numero`
  = MM-NNNNNN, con `proveedor_id`, `total`, `moneda`, `estado`, `detraccion`.
- **Infra de rutas públicas** ya probada: `/v/:token` (vista QR de vehículo, sin login) se
  resuelve ANTES del gate de sesión → precedente para páginas de cara externa.
- **Auth Supabase** robusta y ya endurecida (fix de sesión multi-pestaña 2026-07-08).

**Lo que falta:** (a) autenticación/acceso para el proveedor externo; (b) subida y guardado
de archivos XML/PDF; (c) parseo/validación del XML; (d) estado de flujo de la factura;
(e) UI mínima del portal. El modelo de datos de la factura en sí está ~90% listo.

## 2. Decisión de fondo: cómo autentica el proveedor

### Opción A — Supabase Auth con rol "proveedor" + RLS + portal mínimo (RECOMENDADA)
- El proveedor tiene una cuenta Supabase Auth. Login por **RUC + contraseña** (el RUC se
  mapea internamente a un email reservado, ej. `20507115102@proveedores.memphis.pe`).
  `app_metadata`: `tipo='proveedor'`, `proveedor_id`, `ruc`, `tenant_id`.
- **RLS hace el aislamiento**: un proveedor solo hace SELECT de `ordenes_compra` de SU
  `proveedor_id`, y SELECT/INSERT de `comprobantes_pago` amarradas a esas órdenes. Todo
  lo demás: negado por defecto.
- La app detecta `tipo==='proveedor'` al entrar y renderiza un **portal mínimo** (sin el
  sidebar del ERP): "Mis órdenes" + "Subir facturas" + "Estado de mis facturas".
- **Pros**: reutiliza toda la infra de auth (JWT, refresh, AuthProvider, el fix reciente);
  RLS da aislamiento por RUC hermético; nada de auth casera. Backend-first (P3), bajo riesgo (P4).
- **Contras**: mete cuentas de proveedor en `auth.users` (etiquetadas y aisladas por RLS);
  hay que blindar que el portal no exponga otros módulos (lo garantiza RLS, no solo la UI);
  requiere onboarding (generar y enviar credenciales).

### Opción B — Auth propia (tabla `proveedor_usuarios` + Edge Function que emite JWT)
- Tabla con `ruc`, `password_hash`, `proveedor_id`; una Edge Function valida y emite un JWT
  firmado con el secret de Supabase con claim `role='proveedor_portal'`.
- **Pros**: separación total de los usuarios internos; portal desplegable como app aparte.
- **Contras**: reinventamos autenticación (hashing, reset, rate-limit, emisión/rotación de
  JWT) = más superficie de bugs y de seguridad, justo lo que P4 pide evitar. Más trabajo
  para replicar lo que Supabase Auth ya da gratis. **No recomendada.**

### Opción C — Sin contraseña, enlace/token por proveedor (magic link, estilo QR)
- Cada proveedor recibe un enlace firmado único; sin contraseña.
- **Pros**: cero fricción de onboarding.
- **Contras**: Kevin pidió explícitamente RUC + contraseña; los enlaces se reenvían/filtran
  (débil para un flujo financiero). **Buena como complemento**: magic link solo para el
  primer set de contraseña y para recuperación.

**Recomendación:** **Opción A**, con magic-link (C) únicamente para alta/recuperación de
contraseña. Es la vía backend-first de menor riesgo y máxima reutilización.

## 3. XML vs PDF — qué aceptar

**Ambos, pero el XML es la fuente de verdad.** En Perú la factura electrónica es un CPE
en **XML UBL 2.1**; el PDF es solo su representación impresa.

- El **XML** se parsea en el backend (Edge Function) y de él salen automáticamente: serie,
  correlativo, RUC emisor/receptor, fecha, moneda, bases, IGV, detracción/retención, total,
  y — clave — **`cac:OrderReference/cbc:ID`**, que es el número de la orden de compra. Si el
  proveedor coloca la OC (MM-NNNNNN) en su facturador, el **amarre a la orden es automático**.
- El **PDF** se guarda como representación legible (recomendado, opcional).
- **PDF-only** debería permitirse solo como excepción: sin XML no hay validación automática
  y el proveedor tendría que elegir la OC y teclear los montos a mano (decisión de Kevin).

### Validaciones automáticas al subir (todas server-side)
1. RUC emisor del XML == RUC del proveedor logueado (si no, rechaza — no puede facturar por otro).
2. RUC receptor == RUC de Memphis (tenant).
3. Serie+correlativo único (no duplicar factura ya cargada).
4. La OC referenciada existe, es de ese proveedor y está en estado que admite factura.
5. Monto de la factura vs total/saldo de la OC (con tolerancia; alerta si excede).
6. Parser XML con entidades externas deshabilitadas (anti-XXE).
7. (Fase 2, opcional) validar el CPE contra SUNAT (consulta de comprobante / estado del CDR).

## 4. Amarre factura ↔ orden (requisito central)

- **Toda factura obligatoriamente referencia una OC.** Si el XML trae el OrderReference, se
  auto-asigna; si no, el proveedor elige la OC de SU lista antes de confirmar el envío.
- Una OC puede recibir **una o varias facturas** (facturación parcial) — a definir con Kevin
  si se permite y con qué control de saldo.
- Reforzar el vínculo hoy textual (`orden_compra_numero`) con una **FK real** a `ordenes_compra`.

## 5. Estados del flujo de la factura

`recibida` (subida por el proveedor) → `validada` (pasa validaciones) / `observada` (falla
algo → se notifica al proveedor con el motivo) → `conforme` (Memphis da conformidad, cruza
con la recepción) → `programada_pago` → `pagada`. Engancha con `recepciones` y con
contabilidad (`comprobantes_pago.asiento_id` / `contabilizado`).

## 6. Carga individual y masiva

- **Individual**: sube un XML (+ PDF opcional), se parsea, se muestra el match con la OC y
  el proveedor confirma.
- **Masiva**: arrastra varios XML (o un ZIP); cada uno se parsea y auto-asigna por su
  OrderReference; los que no matcheen quedan "por asignar" para elección manual.
- **Formato/plantilla**: para quien no pueda dar el OrderReference, una plantilla simple
  (CSV/Excel) mapeando factura→OC, o el flujo manual de selección.

## 7. Almacenamiento

- Bucket **privado** en Supabase Storage (`facturas-proveedores`) con RLS: el proveedor solo
  escribe/lee sus archivos; Memphis lee todo su tenant. Se guardan XML original + PDF.
- Validar tipo y tamaño de archivo; registrar auditoría de cada subida.

## 8. Seguridad (feature de cara externa — P4)

- Proveedores = externos no confiables → RLS default-deny; sus políticas solo exponen SUS
  OCs y SUS facturas. Nunca datos de otros módulos ni de otros proveedores.
- Rate-limit de subidas; validación de MIME/tamaño; parser XML sin entidades externas (XXE).
- El portal mínimo NO monta stores del ERP; el guardián real es RLS, no la UI.
- Log de auditoría de accesos y subidas.

## 9. Plan de acción por fases

**Fase A — Backend de facturas (sin UI de proveedor)**
- Extender `comprobantes_pago`: FK real a `ordenes_compra`, `estado_flujo`, refs a XML/PDF
  en Storage, `subido_por_proveedor` (bool) + metadatos.
- Bucket `facturas-proveedores` + RLS.
- Edge Function `factura-ingest`: parseo UBL 2.1, validaciones 1–6, auto-match por OrderReference.
- UI interna (Memphis): bandeja de facturas recibidas, dar conformidad/observar, cruce con recepción.

**Fase B — Acceso y portal del proveedor**
- Rol `proveedor` en Supabase Auth; onboarding de credenciales (alta + magic link de contraseña).
- RLS de `ordenes_compra` y `comprobantes_pago` para el rol proveedor (aislamiento por RUC).
- Portal mínimo: login por RUC, "Mis órdenes", subir factura (individual + masiva), estado de mis facturas.

**Fase C — Integración y cierre del flujo**
- Enganche con `recepciones`/conformidad y con contabilidad (asiento).
- Notificaciones (al proveedor cuando se observa/aprueba; al comprador cuando llega factura).
- (Opcional) validación del CPE contra SUNAT.

## 10. Decisiones abiertas para Kevin

1. **Login**: ¿RUC + contraseña (recomendado) o usuario/email por persona? (un proveedor
   puede tener varias personas que facturan).
2. **Alta de credenciales**: ¿las genera Memphis y las envía, o auto-registro del proveedor
   con verificación?
3. **XML obligatorio** (recomendado, habilita validación automática) **o permitir PDF solo**
   cuando el proveedor no tenga el XML a la mano.
4. **Conformidad**: ¿la factura debe cruzar con una recepción antes de aceptarse, o basta con
   amarrarla a la OC?
5. **Facturación parcial**: ¿se permiten varias facturas por OC / facturas parciales? ¿qué
   tolerancia de monto factura vs OC?
6. **Dominio**: ¿portal en el mismo dominio (`erp.memphismaquinarias.com/proveedores`) o en un
   subdominio propio?
