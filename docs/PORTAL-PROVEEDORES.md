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

## 10. Decisiones de Kevin (RESUELTAS, 2026-07-09)

1. **Login**: Opción **A** — Supabase Auth con rol proveedor + RLS, login por **RUC + contraseña**.
2. **Alta de credenciales**: **las genera Memphis** → mecanismo definido en §11.
3. **XML o PDF**: **ambos**, con el XML UBL 2.1 como fuente de verdad (§3).
4. **Conformidad**: **sí, obligatoria antes de aceptar** la factura (cruce con recepción, §12).
5. **Facturación parcial**: **permitida** (varias facturas por OC) → reglas claras en §12.
6. **Dominio**: mismo dominio o subdominio → recomendación en §13 (a confirmar).

## 11. Generación de credenciales (Memphis las genera)

Diseño para que Memphis controle el acceso sin manipular contraseñas en texto plano:

- **Identidad de login = RUC.** La cuenta Supabase Auth usa un email-alias determinista
  `{ruc}@proveedores.memphismaquinarias.com` (nunca recibe correo, solo identifica). El
  formulario del portal pide el RUC y arma el alias por detrás → `signInWithPassword`. No
  hace falta ninguna búsqueda previa.
- **Email real del proveedor** se guarda aparte (del directorio) para notificaciones y para
  el enlace de contraseña.
- **Alta (una acción de Memphis por proveedor, o masiva):** en el módulo Proveedores, botón
  **"Habilitar portal"** → una Edge Function `portal-proveedor-alta` crea el usuario Auth
  (`admin.createUser`, email confirmado, `app_metadata`: tipo='proveedor', proveedor_id,
  ruc, tenant_id), genera un **token de un solo uso** y envía al **email real** del proveedor
  un enlace para que **fije su propia contraseña**. Memphis genera el acceso; el proveedor
  define el secreto (Memphis nunca ve la contraseña).
- **Masivo:** "Habilitar portal a todos los proveedores con OC activa" (122 hoy) en un lote.
- **Gestión desde Proveedores:** reenviar invitación, resetear contraseña (mismo mecanismo
  de enlace al email real), y **deshabilitar/revocar** acceso. Todo con log de auditoría.
- **Recuperación de contraseña:** el proveedor pide "olvidé mi contraseña" con su RUC → la
  Edge Function envía el enlace a su email real registrado.

## 12. Facturación parcial y conformidad (reglas para que el proveedor no se confunda)

**Modelo de saldo por OC.** Cada orden lleva:
- `total` (monto de la OC),
- `facturado_aceptado` (suma de facturas ya dadas por conformes, no anuladas),
- `facturado_en_tramite` (facturas subidas y aún no conformadas ni observadas),
- `saldo_por_facturar` = total − aceptado − en_trámite.

**Qué ve el proveedor en cada orden** (tarjeta clara, sin ambigüedad):
`Total | Facturado (aceptado) | En trámite | Saldo disponible`. Solo puede subir facturas
hasta el **saldo disponible**.

**Reglas de carga:**
- Toda factura se amarra a **exactamente una OC**; una OC puede recibir **varias facturas**.
- Al subir, el sistema valida que el monto no exceda el **saldo disponible** (con tolerancia
  mínima por redondeo). Si excede, se **bloquea con mensaje claro** ("esta factura supera el
  saldo por facturar de la OC MM-XXXXXX: disponible S/ X, factura S/ Y").
- Una factura recién subida **reserva** su monto como *en trámite* → el proveedor no puede
  volver a facturar ese mismo saldo por error.
- Estados de la **OC** frente a facturación: `sin facturar` → `parcialmente facturada` →
  `facturada completa` (cuando aceptado = total). Una OC completa se marca y ya no admite carga.

**Conformidad obligatoria (decisión #4):** el flujo de cada factura es
`recibida` → (validaciones automáticas) → `validada`/`observada` → **Memphis da conformidad
cruzando con la recepción** → `conforme` (recién ahí cuenta como *aceptado* contra el saldo)
→ `programada_pago` → `pagada`. Es decir: subir la factura **no** la acepta sola; Memphis la
concilia con la recepción de bienes/servicios antes de aceptarla. Si se observa, el proveedor
ve el motivo y puede corregir y resubir (se libera el *en trámite*).

## 13. Dominio (a confirmar)

**Recomendación: mismo dominio, ruta `/proveedores`** (`erp.memphismaquinarias.com/proveedores`).
Reutiliza el deploy de Vercel, el mismo proyecto Supabase y la misma auth; la app ya resuelve
rutas de cara externa antes del gate de sesión, así que una sección `/proveedores/*` que
renderiza un shell mínimo para usuarios `tipo='proveedor'` es directa. Un **subdominio**
(`proveedores.memphismaquinarias.com`) es más limpio de marca y aísla el bundle, pero exige
DNS/SSL y deploy aparte. Se recomienda arrancar en mismo dominio y, si se quiere, promover a
subdominio después con un redirect. **Salvo que Kevin prefiera el subdominio, se procede con
mismo dominio.**
