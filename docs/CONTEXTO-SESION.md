# CONTEXTO DE TRABAJO — Memphis ERP

> **Documento vivo.** Se actualiza al cerrar cada tarea o cuando el contexto de la sesión
> de trabajo se acerca al límite. Última actualización: **2026-07-07**.
> Es el punto de re-entrada para retomar el trabajo sin re-derivar contexto.

---

## 1. Estado general del sistema

- **Producción:** https://erp.memphismaquinarias.com (Vercel, team kesa-erp, auto-deploy desde `main`).
- **DB:** Supabase `icmuqwgrjgjoebnwunnf` (sa-east-1) · tenant Memphis `e4b16a80-8500-418e-afaa-0e976b7d9b13`.
- **Go-live operativo:** 2026-07-06 (commit `ed91231d`). El equipo ya opera en el sistema
  (primer requerimiento propio: `RQ-00210`).
- **Regla de commits:** autor único **Kevin Castillo <kcastillo@memphis.pe>**, sin co-autores
  ni menciones de herramientas.

## 2. Datos migrados (cortes y volúmenes)

| Dominio | Corte | Volumen | Marcador |
|---|---|---|---|
| Órdenes de compra | **27/07/26 (MM-001158)** | **1,223 OCs + items** | `migrado_de='oc-system'` / `'oc-excel-2024'` |
| Requerimientos | 03/07/26 | 209 (+675 items) | `oc-system` |
| Cotizaciones | 03/07/26 | 185 (+687 items) | `oc-system` |
| Caja chica | **02/07/26 — Excel CONGELADO** | 30 cajas · 779 gastos · 113 ingresos · 0 descuadres | `caja-excel-2025` |
| Proveedores | — | 129 (tras consolidar 9 duplicados extranjeros) | `oc-system` |
| Vehículos / OTs | — | 386 / 433 | — |

- Cadena **req→cot→OC** restaurada (564 OCs enlazadas a su cotización; 181 cot→req).
- CAJA 19 SOLES **activa** (única); las otras 29 cerradas. Apertura/cierre ya en la UI.

## 3. Convenciones y lógica de negocio (decididas y vigentes)

- **Numeración continua del legado:** OC → `MM-NNNNNN`, OS → `MM-S-NNNNNN`, REQ → `RQ-NNNNN`
  (`ordenes-config.ts` / `requerimientos-config.ts`). COT usa `COT-NNNN` interno.
- **Tipo de cambio:** por orden (`ordenes_compra.tipo_cambio`; migrados 3.40/3.45).
  Fallback global 3.40. **Pendiente:** API SBS/SUNAT por fecha de emisión + backfill.
- **Gasto real (operativo)** = OCs (aprobada/en_ejecucion/completada/recibida) + caja chica
  aprobada. NUNCA OTs, NUNCA anuladas. Gastos fijos de asesoría (10%+5%+4%+3.5% sobre
  Contrato Total) van en bloque aparte y no descuentan utilidad.
- **Contrato Total = Valor Modificado** = `monto_contrato` + `monto_adenda` (puede ser negativa).
- **Proyectos:** código = cohorte del convenio (`01CUSMUN24`…`07CUSHAM26`, `ICAPNP24`);
  `fase` (idea/actos_previos/ejecucion/post_ejecucion) + `situacion` (activo/suspension/…).
- **Espejo Excel (excel-sync v7, cada 30 min + botón):** además del espejo, **propaga montos**
  (contrato/adenda/cobrado/presupuesto) a `proyectos` casando por **CIU**, SOLO desde hojas `#`.
  Códigos/fases/estados NO se tocan. CORS arreglado (x-client-info).
- **Proveedores no domiciliados:** checkbox en el form; Tax ID libre o `EXT-…` autogenerado;
  sin SUNAT/detracción. Patrón `EXT-`/`SINRUC-` = extranjero legítimo.
- **Módulos resilientes:** todo lookup de config de estado lleva fallback `?? …` — un estado
  desconocido nunca tumba un módulo. Rutas de detalle agnósticas al formato del número.
- **Listas grandes:** `usePagination` + fetch paginado >1000 (PostgREST max-rows) en
  `dbOrdenesCompra.list()` y `dbGastosCajaChica.list()`.

## 4. Datos financieros clave (sincerados)

- Los 7 proyectos en ejecución cuadran con su hoja `#` del RESUMEN (auto-sync por CIU).
- **ICA (ICAPNP24):** convenio 2024-09-03, CUI 2587025, contrato 23,169,168.00,
  adenda −1,291,147.50, **cobrado 21,431,235.50** (V1 con CIPRL). V6 (325,785 + 230,180
  Adenda N°04) pendiente de CIPRL → sumará al cobrado cuando se emita.
- AMAZONAS (05AMAPNP25): margen real **−3.6%** (validado, no es error de datos).
- 2 OCs históricas sin CC (MM-000635 anulada, MM-000787) + 15 con descuadre → lista
  entregada en `Downloads/OCs_para_revision_2026-07-06.xlsx` (pendiente decisión de Kevin).

## 5. Métodos de trabajo (cómo se hacen las cosas)

- **Cargas masivas:** rol temporal `LOGIN BYPASSRLS` + pooler `aws-1-sa-east-1.pooler.supabase.com:5432`
  (usuario `<rol>.<ref>`; aws-0 NO funciona) + Node `pg`, transacción atómica BEGIN/COMMIT,
  UUIDs v5 deterministas (`ns 6ba7b810-…`, claves `oc:`/`req:`/`cot:`/`item:`+_id) → idempotente.
  Scripts en `scripts/migration-oc/` (gitignored). Rol se elimina al terminar.
- **QA con usuario temporal:** se crea `qa.auditoria@memphis.pe` vía SQL (auth.users +
  identities + usuarios_tenant + rol Administrador), se navega en el preview, y se **elimina**
  al terminar. Nunca tocar la cuenta de Kevin.
- **Verificación:** eslint (0 errores en archivos tocados) + `npm run build` + recorrido en
  preview antes de dar algo por hecho. Los errores TS pre-existentes (implicit any, spreads)
  no bloquean (Vite/esbuild).
- **Deploy:** push a `main` → Vercel auto-deploy. Verificar con `npx vercel ls` (CLI autenticado
  local; el MCP de Vercel NO tiene scope del team kesa-erp) y confirmando strings nuevos en el
  bundle de producción.

## 6. PLAN DE ACCIÓN (2026-07-07) — fases y estado

> Skills instalados para ejecutarlo (en `.claude/skills/`): supabase-postgres-best-practices
> (oficial Supabase), vercel-react-best-practices (oficial Vercel), performance + accessibility
> (Addy Osmani), security-review (Sentry), web-quality-audit + code-review-and-quality
> (Addy Osmani, instalados 2026-07-07 para auditorías QA).

### FASE 1 — Optimización pre-producción de la DB · **✅ COMPLETADA (2026-07-07)**
- 1.1 ✅ RLS initplan: **~90 políticas** reescritas con `( SELECT auth_… )` vía DO block
      desde el catálogo (migración `rls_initplan_optimizacion`). Advisor: **21 → 0**.
- 1.2 ✅ Índices FK generados desde el catálogo para ~40 tablas calientes (migración
      `indices_fk_tablas_calientes`). Advisor: 145 → 66 (las 66 restantes = módulos
      fríos/semilla, decisión deliberada). "Unused index" subirá hasta que registren uso.
- 1.3 ✅ Consolidación: eliminada `tenant_cc` (duplicada de `ti_centros` en centros_costo).
      Multi-policy 31 → 11; las 11 restantes son INTENCIONALES (QR público de
      vehiculo_documentos + memberships con 2 semánticas) — NO tocar.
- 1.4 ✅ Verificación triple sin regresión: SQL como authenticated (rol+permisos visibles),
      REST real con token (1.2s la consulta de usePermissions completa), login limpio en
      preview con stores cargando (129 prov / 210 req / 185 cot / 386 veh / 1131 OCs).
- Nota para FASE 2: warn `[usePermissions] timeout — unblocking UI` con varias pestañas —
  revisar timeout/reintento del hook (la API responde en ~1.2s; el timeout parece corto).

### FASE 2 — Auditoría técnica frontend · **✅ COMPLETADA (2026-07-07)**
- 2.1 ✅ Bundle: **index 1,789 KB → 460 KB (−74%)**. 73 componentes de módulos convertidos
      a React.lazy (transformación programática de App.tsx; eager solo home/Dashboard y
      vistas públicas QR que renderizan fuera del Suspense). manualChunks por función en
      vite.config: react-vendor 167K / ui-vendor 217K (radix+lucide+cmdk+sonner) /
      charts 432K / supabase 171K / i18n 48K — vendors cacheables a largo plazo.
- 2.2 ✅ a11y: scan completo de DialogContent/SheetContent/AlertDialogContent — **cero sin
      título**; el warning de Radix visto en consola de Kevin provenía de una extensión
      del navegador. dangerouslySetInnerHTML solo en ui/chart.tsx (estándar shadcn, config
      interna, seguro).
- 2.3 ✅ Security: sanitizado el buscador global (el input entraba crudo a filtros `.or()`
      de PostgREST — inyección de filtro con comas/paréntesis). Timeout de usePermissions
      3s→8s (eliminaba falsos "cuenta pendiente de aprobación" con red lenta).
- Verificación: build OK + login y navegación por 3 módulos lazy en preview
  (órdenes 1131, 30 cajas, panorama) sin errores.
- Aprendizaje operativo: NO verificar con varias pestañas del preview — comparten
  localStorage y las sesiones de usuarios QA recreados se envenenan entre sí; usar un
  solo eval atómico login→navegación.

### AUDITORÍA INTEGRAL #2 · **✅ COMPLETADA (2026-07-07)**

Ejecutada con los skills QA (web-quality-audit, code-review-and-quality) tras FASE 1+2.
Método: batería SQL de integridad + code review focalizado + recorrido UI con usuario QA
temporal (eliminado al cierre) en preview local.

- **Backend (integridad de datos): PERFECTO.** 0 items huérfanos, 0 enlaces req↔cot↔OC
  rotos, 0 cajas descuadradas, 0 números duplicados, 0 usuarios sin rol, 0 gastos sin caja.
- **Seguridad (advisors Supabase): 6 → 1.** Solo queda `pg_net` en schema public
  (WARN menor; mover a schema propio cuando haya ventana).
- ✅ **MOMARENTO consolidado:** PROV-0323 (EXT falso) repuntado a PROV-0197
  (RUC real 20507115102, ahora 10 OCs) y eliminado. Pendiente de RUC solo GEREMIE (PROV-0324).
- 🟡 **Hallazgo para decisión de Kevin — CCs con gasto grande sin proyecto** (308 OCs
  activas): la mayoría son CCs internos legítimos (MDI 85 OCs, OFCENTRAL 28…), PERO:
  - **MSS-30** (118 OCs · S/6.25M) — ¿es el proyecto pipeline SAN MARTIN MOVIL SALUD?
  - **LORETOAMB** (29 OCs · S/10.8M) — proyecto legado LORETO AMBULANCIAS liquidado,
    no registrado en el ERP.
  - MUNSMSERENAZGO (S/487K), PDD (S/1.04M), C-OXI (S/215K), GLORETOHOSP.
  - Decisión: ¿registrar proyectos legados/pipeline y enlazar sus CCs? (permite ver su
    gasto en el 360 y en BI).
- **Code review:** usePagination clamping ✓, lazy/Suspense ✓, sanitización buscador ✓.
- **UI (todo ✓):** login, detalle de req/cot/OC (cotización legible, Exportar PDF),
  caja chica (detalle, paginación, orden desc, Volver, export), Lista de Proyectos,
  Espejo Excel, directorio proveedores paginado, Dashboard de Proveedores, búsqueda
  global con caracteres peligrosos `ICA,)("` sanitizada. Consola sin errores de la app
  (solo refresh-token del usuario QA recreado, artefacto del método).

### FASE 3 — TC SBS/SUNAT por fecha de emisión · pendiente · **SIGUIENTE EJECUTABLE**
- Revisar lo existente ANTES de construir: hay `TipoCambioProvider` en el front y edge
  function `sunat-proxy` desplegada. Elegir fuente (apis SBS/SUNAT), cachear por fecha en
  tabla, setear `tipo_cambio` al crear OC, backfill por `fecha_emision`.

### FASE 4 — Bloqueados en Kevin / eventos externos
- Decisiones de `OCs_para_revision_2026-07-06.xlsx` (17 órdenes, columna DECISIÓN).
- RUC real de GEREMIE KEVIN CALLUCO QUISPE (PROV-0324). ~~MOMARENTO~~ ✅ resuelto
  (consolidado en PROV-0197, auditoría #2).
- **Decisión CCs→proyectos legados/pipeline** (MSS-30, LORETOAMB, MUNSMSERENAZGO, PDD,
  C-OXI, GLORETOHOSP — ver hallazgo de auditoría #2).
- ICA V6: sumar 555,965 al cobrado cuando emitan el CIPRL.
- Navegación caza-bugs de Kevin → alimenta la siguiente auditoría.

### FASE 5 — Rediseño módulo Flota · **ACTIVADA (2026-07-08)** — requisitos completos
Spec completa en [FLOTA-REQUISITOS.md](FLOTA-REQUISITOS.md) (N17) + respuestas de Kevin
(§8) + análisis de la carpeta de Operaciones GORE ICA (§9). **Backup pre-rediseño:
backups/flota-2026-07-08.**

**Avance 2026-07-08:**
- ✅ Esquema nuevo aplicado (migración `flota_rediseno_esquema`): flotas, flota_contratos,
  flota_contrato_tarifas, vehiculo_mantenimientos, vehiculo_admin_eventos,
  vehiculo_km_lecturas, columnas nuevas en vehiculos, vista v_vehiculo_consumo, RLS initplan.
- ✅ **Data real de ICA migrada y cuadrada** (§11 del doc de requisitos): 2 flotas,
  2 contratos (Perumotor USD mensual / Promotora PEN adelantado S/1.65M), 50 tarifas,
  250 vehículos enlazados, 1,074 mantenimientos ($194,076.95 + S/135,729.49 exactos vs
  fuente), 577 lecturas km. Typo de VIN corregido, 5 duplicados del Excel deduplicados,
  40 L200 fantasma inactivas.
- ✅ **UI nueva del módulo (2026-07-09)**: sidebar Flota = Dashboard/Flotas/Vehículos/
  Mantenimientos (GPS, análisis preventivo, reportes y OTs FUERA de rutas y bundle;
  componentes legacy quedan en disco sin rutas). Nuevos: flotas-store (flotas+contratos+
  tarifas+v_vehiculo_consumo), FlotaDashboard (cards por flota: cumplimiento, provisión
  vs gastado, saldo), FlotasLista, FlotaDetalleView (contrato+tarifario+consumo por
  vehículo, tabs), FlotaMantenimientos (lista 1,074 desde vehiculo_mantenimientos +
  registro manual con SearchableSelect), VehiculosLista (padrón/placa interna/VIN/flota,
  filtro por flota y administrativos, KPI "sin placa"). dbFlotas/dbVehiculoMantenimientos/
  dbVehiculoConsumo en helpers. Verificado en preview con usuario demo (dashboard cuadre
  exacto: US$238,309.55 saldo camionetas; detalle 43.7% cumplimiento; 386 vehículos).
  Lección: hooks SIEMPRE antes de early-returns (crash de usePagination corregido).
- **Usuario demo para jefatura (2026-07-09)**: consultor@memphis.pe con rol Gerencia
  (12 permisos de vista), provisional — Kevin le asignará rol definitivo en Admin.
  Patrón: igual que usuario QA pero permanente (token cols '', tenant_id en app_metadata).
- ⏳ Pendiente FASE 5: vehículos administrativos (registro + alertas de vencimientos),
  QR público rediseñado (info básica + cumplimiento + último manto fecha/km), rework de
  VehiculoDetalle (consumo + historial nuevo); IA embebida (Kevin consigue API key de Claude).

**Avance 2026-08-03 (5 ajustes de flota pedidos por Kevin, N25) — código listo, SIN commitear aún:**
- **(2)+(4) Cargas Excel por flota** · pestaña **"Cargas (Excel)"** en `FlotaDetalleView`
  (`FlotaCargas.tsx`, SheetJS `xlsx@0.18.5` en chunk lazy 429 KB): plantilla + carga de
  **vehículos** (alta/actualización por VIN, código estable `VEH-{FLOTA}-{últimos6 del VIN}`,
  asigna flota/proyecto) y de **tarifario** (reemplaza tarifas del contrato y recalcula
  cantidad_servicios + costo_total_por_vehiculo). Verificado: alta no destructiva por VIN OK
  (vehículo de prueba creado y eliminado).
- **(3) Programación manual + fecha editable** en `FlotaProgramacion`: input de fecha por fila
  (override con badge "editada", usado al generar); botón/diálogo **"Programación manual"** para
  cualquier vehículo con flota (SearchableSelect de vehículo → servicio del plan/tarifa →
  fecha/hora; taller y costo derivados de la flota, `origen='manual'`). Nuevo `flotas.tallerId`
  en el store. Verificado en preview (250 vehículos listables, deriva flota FL-ICA-MOT correcta).
- **(5) Tab Contrato del vehículo dirigido por flota** (`vehiculo/ContratoTab.tsx`): reemplaza
  el texto libre por un **desplegable de flota** → proyecto/contrato/proveedor/modalidad/moneda/
  tarifario en **solo lectura** (nuevo método acotado `asignarFlota` en vehiculos-store; los
  datos de contrato previos se conservan como "heredados"). Verificado con EX9613 → FL-ICA-MOT
  (Gobierno Regional de Ica, PROMOTORA GENESIS, tarifario de 25 servicios, S/8,245.16).
- **(1) Costo oculto al taller**: directiva registrada para Fase C (portal de talleres) en
  FLOTA-MANTENIMIENTOS-FLUJO.md (decisión #9 reforzada) + INSTRUCCIONES N25 — el precio/tarifario
  nunca se envía al portal del taller; el costeo es solo backend/Memphis. (No hay portal aún.)
- Build limpio (index 458 KB sin crecer; xlsx en su chunk). Kevin eligió "solo terminar";
  **falta commit** de este lote (autor Kevin) y luego deploy.

**Avance 2026-08-04 (Flota Fase C+D — portal de talleres + QR + cierre Memphis) · desplegado backend:**
- **Backend** (migración `flota_mantos_qr_fase_c_backend`): `auth_taller_id()`, `handle_new_user`
  extendido (salta dominio talleres), `taller_mis_citas()` SECURITY DEFINER **sin costo** (N25 —
  el taller no toca la tabla base), `v_vehiculo_consumo` cuenta `confirmado`. Advisor `anon` de la
  función cerrado (revoke). Sin RLS nueva: el taller (sin tenant) queda bloqueado de
  vehiculo_mantenimientos y solo opera vía RPC + Edge Function.
- **Edge Functions** desplegados (v1, verify_jwt on): `manto-confirmar` (anti-fraude 3 reglas,
  km+fotos obligatorios, costeo server-side sin devolver precio, fotos a storage con service role,
  lectura de km, excepción sin cita si el km cuadra ±500 → `pendiente_aprobacion`) y
  `portal-taller-alta` (crea `{codigo}@talleres.memphismaquinarias.com`, enlace de contraseña).
- **Frontend**: portal `/taller` (`PortalTalleres.tsx` + `taller-client.ts` aislado; login por
  código, citas sin costo, escaneo QR por cámara con fallback por placa, registro km+fotos);
  bandeja interna **Flota → Confirmaciones** (`FlotaConfirmaciones.tsx`) para confirmar (→
  `confirmado`) u observar; alta de accesos de taller en Proveedores → Talleres (detalle). Routing
  `/taller` (público) y `/flota/confirmaciones` + ítem de sidebar; redirect de cuentas tipo='taller'.
- Build limpio (PortalTalleres en chunk propio 16.8 KB). `/taller` verificado en preview (login
  renderiza, consola limpia). **Pendiente**: E2E en vivo del ciclo taller→Memphis (requiere
  habilitar una cuenta de taller real — paso operativo, como el encendido del portal de proveedores).

**Avance 2026-08-04 (Flota Fase E — QR público rediseñado) · backend en producción:**
- **Seguridad (hueco cerrado)**: la política anon `"vehiculos: public_token acceso sin auth"`
  aplicaba a todos los roles con `USING (public_view_enabled AND public_token IS NOT NULL)` — sin
  filtrar por token → un anon podía **enumerar todos los vehículos públicos y todas sus columnas**
  (cliente, contrato, documentos). Se **eliminó** esa política. El acceso público ahora es SOLO por
  el RPC `vehiculo_public_by_token(text)` (SECURITY DEFINER, grant anon) que, dado el token exacto,
  devuelve jsonb con datos **no sensibles** + cumplimiento + último manto + documentos (tipo+estado,
  sin números). Verificado: SELECT anon directo a `vehiculos` → 0 filas; RPC por token → OK.
- **Frontend**: `VehiclePublicView` reescrita (consume el RPC; diseño magro: identificación +
  cumplimiento + último mantenimiento + estado de documentos; sin cliente/contrato/números). El
  LifeSheet legacy sale de la ruta pública (index bajó ~10 KB). Verificado en preview: token válido
  renderiza sin datos sensibles, token inválido → "no encontrado", consola limpia.
- **Flujo del QR A-E completo.** Pendiente operativo: encender cuentas de taller reales. Mejora
  futura opcional: historial de mantenimientos en el detalle interno del vehículo.

## 6.g FIX — el PDF de la orden salía sin datos del proveedor (2026-08-27)

**Reporte de Kevin:** al exportar una OC del ERP, la sección PROVEEDOR salía vacía; descargando
la misma orden desde oc-system sí aparecían datos y cuentas bancarias.

**Causa raíz:** `OrdenDetalle` busca el proveedor con
`proveedores.find(p => p._dbId === orden.proveedorDbId)`, pero **`mapFromDB` de
`ordenes-store.tsx` nunca exponía `proveedorDbId`** — la fila de BD trae `proveedor_id`, el mapper
lo descartaba. El resultado era `undefined === undefined` fallido, `proveedorOC` siempre
`undefined`, y el bloque entero en blanco. La plantilla del PDF (`export-utils.ts`) estaba bien:
ya leía `cuentasBancarias ?? cuentas_bancarias` y normalizaba `nombre|banco` y
`cuenta|numeroCuenta`.

**Arreglos:**
1. `Orden` gana `proveedorDbId: string | null` y `mapFromDB` lo llena con `row.proveedor_id`.
2. `OrdenDetalle` busca por UUID y **cae al nombre** si la orden no lo trajera.
3. **Faltaba la columna `contacto`** en `proveedores`: el PDF imprime "Contacto:" y el ERP no
   guardaba ese dato aunque el legado sí. Se agregó la columna y se rellenó con los contactos del
   portal → **113 de 135 proveedores** ya lo tienen. También se mapeó en `proveedores-store`.

**Verificado en preview** con usuario QA temporal (creado y eliminado): se interceptó
`window.open` para capturar el HTML del PDF de MM-000666 y el bloque sale completo —
EMERGENCY PERU S.A.C · RUC 20606600985 · dirección · contacto Maria Del Pilar Derteano ·
teléfono · correo · BCP · cuenta 1947227826041 · CCI 00219400722782604198. Idéntico al legado.

**Nota de dato (no es bug nuestro):** EMERGENCY PERU tiene en el legado el teléfono y correo de
otra empresa (`Mderteano@ventycpap.com`, 985487195, los mismos de VENTYHOME). Viene así desde
Firestore y el PDF legado muestra lo mismo. Si hay que corregirlo, es dato, no código.

---

## 6.h CDC — decisiones aplicadas (2026-08-27)

Ver [CxP-CDC-CATEGORIAS.md](CxP-CDC-CATEGORIAS.md) §4. Resumen:
- **4 CDC creados**: `REFINANCIAMIENTO - IGV MARZO 2024`, `REFINANCIAMIENTO - RENTA 2024`,
  `MARKETING Y DESARROLLO`, `TERRENOS EEUU`.
- **2 duplicados consolidados**: se conservó `OFCENTRAL` (renombrado "Gastos Oficina Central",
  tenía 29 OCs) y `LICENCIAS`; se eliminaron `GASTOS OFICINA CENTRAL` y `LIC-TI`, ambos con
  **0 referencias** verificadas contra las 5 FK a `centros_costo` y los campos de texto.
- **5 equivalencias aprobadas** para el transform de la Fase B (no crean filas):
  `GCUZCOAMBU`→`GCUSCOAMBU`, `MPCUSCOPNP`→`MPCUSCOSERENAZGO`, `MSS`→`MSS-30`,
  `DATABASE`→`BASE DE DATOS`, `GASTOS OFICINA CENTRAL`→`OFCENTRAL`.
- `centros_costo` queda en **79** códigos.

---

## 6.i PREPARACIÓN DEL LANZAMIENTO — jueves 27/08/2026

Auditoría completa en [AUDITORIA-Lanzamiento-2026-08-31.md](AUDITORIA-Lanzamiento-2026-08-31.md).
Lo ejecutado hoy, en orden:

### 1. Producción al día (bloqueante B2) · ✅
Estaba 3 días atrasada. Desplegado el arreglo del PDF de la orden y el mapeo de `contacto`.
`erp.memphismaquinarias.com` responde 200.

### 2. Alta de usuarios (bloqueante B1) · ✅
**El problema:** `GestionUsuarios.tsx` creaba usuarios con `supabase.auth.signUp()` desde el
navegador. Eso reemplaza la sesión del administrador por la del usuario recién creado, obliga a
teclear contraseñas ajenas y depende de un correo de confirmación que no existe (sin SMTP).

**La solución:** Edge Function `usuarios-alta` (v3, `verify_jwt: true`) con la Admin API.
- Exige el permiso `admin.gestionar_usuarios`.
- Valida el dominio contra `tenant_email_domains` (N21 → solo `memphis.pe`).
- Devuelve un **enlace de un solo uso**; la persona fija su propia contraseña. Memphis nunca la ve.
- Acciones: `alta`, `reenviar`, `desactivar`, `reactivar`. Idempotente.
- Al abrir el enlace, `AuthProvider` detecta `PASSWORD_RECOVERY` y App muestra `FijarClave`
  antes de dejar entrar.

**Probado contra el proyecto (9 casos):** alta con rol OK · dominio ajeno 422 · sin sesión 401 ·
sin permiso 403 · idempotente · conserva el cargo · desactivar/reactivar OK · no puede
autodesactivarse. Cuentas QA creadas y eliminadas.

**Trampa encontrada:** la primera versión verificaba el permiso con un embed anidado de PostgREST
(`roles!inner(roles_permisos!inner(permisos!inner(...)))`) y comparaba por string. Devolvía una
forma que no matcheaba y rechazaba a un administrador legítimo. Se reemplazó por dos consultas
simples. Además el tenant ahora cae a `usuarios_tenant` si el JWT no trae el metadato.

### 3. Descuentos rescatados antes del corte (I1) · ✅
`orden_items` y `cotizacion_items` no tenían dónde guardar el descuento por ítem, que en el
legado es un **MONTO** (no un porcentaje — verificado: en MM-000590 la suma de
`cantidad*PU − descuento` da 5714.32, el subtotal que reporta el portal).

- Columna `descuento` en ambas tablas; `precio_total` pasa a ser **neto**.
- Rellenados **118 ítems de orden (S/3,025.53)** y **91 de cotización (S/3,217.64)**.
- Órdenes de oc-system descuadradas: **24 → 3** (diferencias de céntimos). Las 37 del Excel 2024
  no son recuperables: ese origen nunca tuvo detalle por ítem.
- **Bonus:** el transform de cotizaciones trataba el descuento como porcentaje. Se recalcularon
  los totales de las **217 cotizaciones** desde sus ítems. 0 descuadradas, 0 con IGV mal.
- **Caso raro:** en `LORE-PERUMOTOR 01` el precio unitario está en 0 y el importe se digitó en la
  columna de descuento. Aplicarlo daba subtotal negativo, así que se revirtió a 0 y **queda para
  que Operaciones corrija el dato de origen**. No se inventó un precio.

### 4. Correcciones a mi propia auditoría
- **`ms-debug` no era un riesgo**: ya estaba neutralizada desde el 28/05 (devuelve 410,
  `verify_jwt: true`). Lo había marcado como función de depuración viva.
- **El monto de descuentos era S/3,025.53**, no los ~S/30,511 que estimé asumiendo porcentaje.

### Lo que queda para el viernes
| Qué | Quién |
|---|---|
| **`CRON_SECRET`** — `excel-sync` y `notif-scheduler` siguen abiertas | **Kevin** (dashboard) y luego yo reprogramo el cron con el header |
| **Archivo de usuarios y accesos** → cargar el equipo | **Kevin**, luego yo |
| **Permisos por rol** (N19, bloqueante B3) | tras el archivo |
| Corte de oc-system + backup de Firebase | N34 + Fase 7 |
| Decidir qué módulos vacíos se ocultan del menú | Kevin |

---

## 6.f COMPRAS + CAJA CHICA — segundo delta (2026-08-27)

### Caja chica · ✅ CARGADO
Segundo delta desde el Excel de Administración (mtime 26/08 09:45). Comparadas las 39 cajas
contra la base: **36 idénticas**, 3 con novedades.

- **ADMI024-SOLES** — caja nueva (7 movimientos del 25/08): apertura por arrastre S/257.42 +
  depósito S/5,000; egresos S/1,376.05.
- **ADMI016-DOLARES** — 1 egreso nuevo US$392.63 (pasaje Lima–Chachapoyas, CC AM-AMAZONAS).
- **ADMI012-DOLARES** — 2 movimientos del 03/07 (ingreso y egreso de US$24.78 por cambio de pasaje).
- **ADMI023-SOLES** cerrada (su saldo pasó como apertura de ADMI024).

**Estado final: 39 cajas, 969 gastos, 139 ingresos, último movimiento 25/08/2026, 0 duplicados.**
Cuadra exacto contra el Excel (139 ingresos / 969 egresos). Abiertas: ADMI016-DOLARES (USD) y
ADMI024-SOLES (PEN).

**Trampas encontradas (para el próximo delta):**
1. La fila de **totales de cada hoja lleva número de ítem** y un parser ingenuo la cuenta como
   movimiento, duplicando la caja entera. Se salta cuando no hay centro de costo ni descripción
   pero sí ingreso *y* egreso a la vez.
2. **`/DOLAR/i` no matchea "DÓLARES"** (ni "Dólares"): hay que usar `/D[OÓ]LAR/i` o las líneas
   se cargan en PEN. Es el mismo error de la carga anterior — quedó en el generador y volvió a
   aparecer; ya corregido en `gen-delta2.mjs`.
3. Administración puede **borrar y reponer numeración**: el ítem 50 de CAJA 4 SOLES (S/16.70)
   desapareció y volvió al día siguiente. No borrar registros por ausencia — preguntar.

### Compras (oc-system) · ✅ CARGADO
Extracción fresca read-only de Firestore (`4-extract-fresh.cjs`): 781 órdenes, 235
requerimientos, 217 cotizaciones, 143 proveedores.

| Hallazgo | Detalle |
|---|---|
| **64 OCs nuevas** | MM-001159 → MM-001222, del 31/07 al 25/08/2026, 66 ítems. 62 aprobadas, 1 rechazada (MM-001210), 1 pendiente de Gerencia General (MM-001222). US$22,179.33 + S/152,669.03 |
| Concentración | 54 de 64 son de **PERUANA DE MOTORES HG S.A.C**; CCs GOREICAPNP (35) y GICAPATRUL (19) |
| **1 cambio de estado** | **MM-001117**: aprobada en el portal, el ERP sigue en `enviada` |
| Estados correctos | MM-000998 y MM-001027 siguen genuinamente pendientes en el portal → `enviada` es fiel |
| **5 proveedores nuevos** | EFAPP, SGP Training, VENTYHOME, Santa María & Nudelman, y **GEREMIE KEVIN CALLUCO QUISPE con RUC de 12 dígitos (107345501536)** — malformado, resuelve el "RUC pendiente" de N22 pero hay que corregirlo |
| Requerimientos / cotizaciones | 26 req y 32 cot creados desde el 03/07 (no cargados; ver N24) |
| Huecos del legado | 25 números (MM-000465, MM-000485→000507, MM-000604) no existen ni en el portal ni en el ERP |
| Residuo de pruebas | **MM-TESTPT1** sigue en `ordenes_compra`; quitarla antes del go-live |

Sin divergencias de anulación: las 25 `anulada` del ERP que no están en Firestore vienen de la
migración del Excel 2024, y ninguna orden anulada en el ERP figura viva en el portal.

**Carga ejecutada (2026-08-27)** — scripts `8-transform-fase3.py` + `9-load-fase3.mjs`, rol
temporal `mig_f3_tmp` por el pooler (creado y eliminado en la misma sesión), transacción única:

| | Antes | Ahora |
|---|---|---|
| Órdenes | 1,223 | **1,286** (+64 nuevas, −1 de prueba) |
| Ítems de orden | 2,406 | **2,472** |
| Requerimientos | 222 | **236** (+ítems: 704) |
| Cotizaciones | 197 | **217** (+ítems: 723) |
| Proveedores | 131 | **135** |

- **Geremie (PROV-0324)**: RUC corregido `EXT-0324` → **10734501536** y `migrado_id` apuntado al
  doc del portal para que resuelva la cadena.
- **4 proveedores nuevos**: PROV-0327 EFAPP, PROV-0328 SGP Training, PROV-0329 VENTYHOME,
  PROV-0330 Santa María & Nudelman.
- **MM-001117** sincronizada a `aprobada`. Quedan 3 en `enviada` y las 3 son fieles al portal:
  MM-000998 y MM-001027 (Pendiente de Comprador) y MM-001222 (Pendiente de Gerencia General).
- **MM-TESTPT1 eliminada** junto con sus 2 comprobantes ficticios de "PORTAL TEST S.A.C."
  (F001-00000777 y F001-00000779, del 10/07) — eran una sola fixture de las pruebas del portal.
  `comprobantes_pago` queda en 0.
- Integridad: 0 órdenes sin proveedor, 0 sin ítems, 0 números duplicados en órdenes/req/cot.
- Totales de las 64 nuevas: **S/152,669.03 + US$22,179.33**, idénticos a Firestore.

**Colisión de numeración resuelta**: el ERP numera con `último + 1`; antes de la carga el máximo
era MM-001158 y habría generado MM-001159, que ya existía en el portal. Ahora el próximo es
**MM-001223**, libre.

**Trampa encontrada:** el transform descarta en silencio la cotización cuyo proveedor no resuelve
(`WHERE prov_sel IS NOT NULL`). El portal guarda a veces el doc-id de Firestore o un RUC ficticio
(20000000001, 20011911111, 20912345671) en `proveedorId`. Se agregó `ALIAS_PROV` en
`8-transform-fase3.py` con los 7 casos; sin eso faltaban 8 cotizaciones.

**Pendiente menor:** queda `PROV-TEST1` ("PORTAL TEST S.A.C.") en proveedores — mismo residuo de
pruebas, no se borró por no estar autorizado explícitamente.

---

## 6.e CAJA CHICA — delta post-corte cargado (2026-08-22) · GO-LIVE

El equipo empieza HOY a operar compras y caja chica en el sistema. Se cargó el delta que
quedaba en el Excel de Administración ("Modelo caja chica 20251.xlsx") desde el corte del
02/07/2026 hasta el 21/08/2026.

**Antes**: 30 cajas, 779 gastos, último 02/07/2026. **Ahora**: 38 cajas, 962 gastos, 136
ingresos, último 21/08/2026. Sin migrado_id duplicados.

- **8 cajas nuevas**: ADMI013/014/015/016-DOLARES y ADMI020/021/022/023-SOLES.
- **ADMI019-SOLES completada**: tenía 17 gastos (cortada en el 02/07), ahora 47.
- **Quedan ABIERTAS solo las vigentes**: ADMI023-SOLES (saldo S/257.42) y ADMI016-DOLARES
  (saldo US$1,477.32). El resto cerradas.
- Totales acumulados: egresos S/270,030.62 y US$43,094.54.

**Gotchas encontrados (anotar para futuras cargas):**
1. Hay un **trigger que impide registrar movimientos en una caja CERRADA**: al migrar hay que
   crear/abrir la caja como `activo`, cargar los movimientos y recién entonces cerrarla.
2. La detección de moneda por nombre de hoja debe contemplar la **tilde**: "DÓLARES" no
   matchea con `/DOLAR/i` — usar `/D[OÓ]LAR/i`. Con el bug, 4 cajas USD entraban como PEN.
3. Idempotencia por `migrado_id = '{HOJA}#{item}'`; se respetó y no hubo duplicados.
4. **Una fila fue editada en el Excel después del corte**: `CAJA 19 SOLES#5` pasó de S/110.00
   a S/297.50 (PAGO DE CTS DE ADRIAN CASTILLO + COMISION). Como la carga es insert-only, no la
   habría detectado: se comparó monto a monto **las 962** ya migradas y esa fue la ÚNICA
   diferencia; se corrigió a mano. Para próximas cargas conviene repetir ese diff.

## 6.d PROYECTOS — 10 cambios de Operaciones (N27) · EN CURSO (2026-08-07)

**Fuentes**: `OPERACIONES - OPERACIONES TEAM/RESUMEN PROYECTOS.xlsx` (hoja por proyecto:
datos generales, ITEMS+Estatus, Conceptos/Días/Plazos, BASE DOCUMENTARIA, VALORIZACIONES) y
`General - PROYECTOS/.../INVENTARIO RICHARD/vehiculos_data.xlsx` (410 filas, col. PROYECTO).
Para leer los .xlsx con Node: el build ESM de `xlsx` **requiere `XLSX.set_fs(fs)`** o falla con
"Cannot access file".

**Decisiones de Kevin (cerradas):** avance por *cantidad* = **ITEMS del Excel**
(ENTREGADO/RECEPCIONADO ÷ total de ítems); el box de valorización del Panorama **lleva fechas**.

**Hecho (commits `138f06d8`, `d1d13d30`):**
- (1)(2)(3) **Etapas colapsables** en ProyectoDetalle (tab Fases) y Proyecto360: clic en la
  cabecera colapsa/despliega; las etapas sin datos (sin descripción, fechas, avance, montos ni
  tareas) inician colapsadas; **"Ejecución" siempre inicia desplegada**. Lógica compartida en
  `src/lib/proyectos/fases-ui.ts` (`fasesAbiertasInicial`, `faseTieneDatos`, `esFaseEjecucion`).
- (4)(8) **Sync del Excel SOLO manual**: se desactivó el cron `excel-sync-30min`
  (`cron.alter_job(2, active := false)`; reactivable con `active := true`). Textos de
  ProyectosExcelSync actualizados. El botón "Sincronizar ahora" es el único disparador.
- (9, parcial) **Parser extendido** en `supabase/functions/excel-sync/index.ts`: nuevas funciones
  `parseItems` (ITEMS + columna Estatus) y `parseValorizaciones` (N° Valorización / Fecha /
  Importe; guarda también el mes en texto cuando el Excel no trae fecha real). Escribe
  `items_entregados`, `valorizaciones_cantidad`, `valorizaciones_monto`,
  `valorizacion_ultima_fecha` y el detalle en `datos_raw->items_detalle` / `->valorizaciones`.
  Migración `proyectos_excel_items_valorizaciones` **ya aplicada** en producción.

**COMPLETADO (2026-08-07, 2ª tanda) — los 10 puntos de N27 están cerrados:**
- **(9) `excel-sync` desplegado** (v9) y verificado contra el Excel real: 7 hojas oficiales con
  ítems y valorizaciones; montos cuadran (MP CUSCO S/7,547,696.56). **2 bugs corregidos** en el
  parseo: (a) por Graph las fechas llegan como texto **mes-año** ("mar-25") y `new Date()` las
  volvía 25/03/**2001** → ahora se reconoce MES-AÑO (primer día del mes) y el fallback estándar
  solo corre si el texto trae un año de 4 dígitos; (b) el bloque capturaba filas que no son
  valorización ("Liquidación") → ahora solo "Valo N" o filas con importe.
  Nuevo panel **ValorizacionesExcel** (solo lectura) en el tab Valorizaciones del proyecto.
- **(5)** `ProyectosLista` con **dos líneas de avance** (tarjetas y tabla): **Presupuesto**
  (cobrado ÷ contrato+adenda) y **Cantidad** (items entregados ÷ total, del Excel).
- **(6)(7)** `ProyectosPanorama`: filtro **Desde/Hasta** por año de convenio (acota todas las
  vistas) y **box de Valorizaciones** (monto acumulado, cantidad y última fecha).
- **(10) Vehículos por flota y proyecto — CUADRADO en 410.** Estado previo: 386 en DB (todos con
  proyecto) y 136 sin flota; los 24 de Amazonas no existían (386+24=410). Se crearon **6 flotas**
  con la convención `FL-{REGIÓN}-{TIPO}` (FL-CUS-AMB 59, FL-CUS-PNP 46, FL-HNC-PNP 23,
  FL-LOR-BOM 8, FL-AMA-MOT 23, FL-AMA-BUS 1), se asignó flota a los 136 existentes y se dieron de
  alta los 24 de Amazonas (23 motos Hero + 1 bus Mitsubishi Fuso — el Excel lo rotula "Patrullero"
  pero es el bus del proyecto, 32+1 pasajeros). Migraciones
  `flota_n27_flotas_faltantes_y_asignacion` y `flota_n27_alta_vehiculos_amazonas` (idempotentes
  por código/VIN). **Verificado: 410 vehículos, 0 sin flota, 0 sin proyecto, 0 VINs duplicados.**
  Nota: `vehiculos` no tiene columna de observaciones — el "placa en trámite" del Excel queda
  implícito con `placa NULL`.

### FASE 6 — Módulos placeholder · pendiente
Proyectos: Cronograma, Valorizaciones, Riesgos, Documentos. Proveedores: Evaluaciones,
Contratos, Talleres (hoy básicos/placeholder).

### FASE 7 — Backup Firebase + apagado de oc-system · pendiente
Export completo de Firestore antes de apagar el portal legado (coordinar fecha con Kevin).

### FASE 8 — Portal de proveedores para facturas (N20) · análisis entregado 2026-07-09
Spec y opciones en [PORTAL-PROVEEDORES.md](PORTAL-PROVEEDORES.md). El backend de la factura
ya existe casi completo: **`comprobantes_pago`** tiene todos los campos SUNAT + `proveedor_id`
+ `orden_compra_numero` + enganche contable (hoy 0 filas). Recomendación: acceso del
proveedor vía **Supabase Auth con rol proveedor + RLS** (login por RUC), **XML UBL 2.1 como
fuente de verdad** (auto-match a la OC por `cac:OrderReference`), PDF opcional, carga
individual y masiva, bucket privado con RLS, Edge Function de parseo/validación. Plan por
fases A (backend factura) / B (auth+portal) / C (integración con recepciones+contabilidad).
**Decisiones cerradas (2026-07-09, §10-13 del doc):** login A (Supabase Auth rol proveedor +
RLS por RUC); credenciales las genera Memphis (alias determinista por RUC, proveedor fija
contraseña vía enlace a su email real); XML+PDF (XML fuente de verdad); conformidad
obligatoria antes de aceptar; facturación parcial permitida con modelo de saldo por OC
(total/aceptado/en trámite/disponible); dominio recomendado mismo `/proveedores` (a
confirmar). **Listo para construir Fase A** (backend: extender comprobantes_pago con FK a OC
+ estado_flujo + refs XML/PDF, bucket privado + RLS, Edge Function de parseo/validación UBL).

**Fase A ✅ COMPLETADA (2026-07-09):** migración `portal_proveedores_fase_a` (flag
`domiciliado` + 5 no domiciliados marcados / 122 elegibles; `comprobantes_pago` extendida con
FK a OC/recepción, `estado_flujo`, refs XML/PDF, campos de conformidad; índice único
anti-duplicado; vista `v_oc_saldo_facturacion`). Bucket privado `facturas-proveedores`. Edge
Function `factura-ingest` desplegada (`@supabase/server`, parser UBL en `ubl.ts` anti-XXE,
validaciones + auto-match por OrderReference + storage + inserción). Skill nuevo instalado:
`supabase-server`. Verificado: parser 13/13 aserciones; función responde 403 a no-proveedores.
Dominio confirmado: mismo dominio — **el portal vive en `/portal`** (la ruta `/proveedores`
ya era del módulo interno).

**Fase B ✅ COMPLETADA (2026-07-09):** RLS del rol proveedor (auth_proveedor_id() del JWT,
SIN tenant_id → bloqueado de todo lo interno; solo SELECT de su ficha/órdenes/facturas/
archivos), trigger handle_new_user excluye cuentas @proveedores.* (GoTrue aplica app_metadata
DESPUÉS del insert → detección por dominio), Edge Function `portal-proveedor-alta` v3
(staff-only; alias por RUC; enlace de contraseña vía GoTrue Admin REST; alta/reenviar/
revocar), `factura-ingest` v2 (tenant/RUC desde DB + exige portal_habilitado), portal UI en
`/portal` (login RUC, órdenes con saldo, subida multi-XML+PDF con reintento por OC,
mis facturas, cambio de clave; autocontenido en rama pública; proveedor en ERP → redirect).
**E2E 16/16** con proveedor de prueba (RLS 1/1082 órdenes, duplicado/saldo/suplantación
bloqueados, auto-match OrderReference). UI verificada en preview.
**Proveedor de prueba VIVO para demo**: RUC 20999999991 / Portal-Test-2026! / OC MM-TESTPT1
— eliminar tras revisión de Kevin. Hallazgo anotado (preexistente): política pública del QR
permite ENUMERAR vehículos por REST → cerrar con RPC por token en el rediseño del QR.
**Fase C ✅ COMPLETADA (2026-07-09):** bandeja **Compras → Facturas Proveedores**
(`/compras/facturas`): conformidad (con recepción opcional de la OC), observar (motivo
visible al proveedor, libera saldo), programar pago, marcar pagada, descarga XML/PDF por
URL firmada, link a la OC, KPIs y filtros. Tarjeta **"Portal de Proveedores"** en el detalle
del proveedor (habilitar/regenerar enlace/revocar; no domiciliado → no aplica; RUC inválido
→ bloquea). `factura-ingest` v3: notificación interna al recibir factura (campana →
bandeja). Contabilidad: las facturas del portal son comprobantes_pago → flujo contable
existente. Verificado en preview: conformidad a F001-777 → saldo exacto (aceptado 1,180 /
trámite 590 / disponible 3,230, parcial); tarjeta OK en PROV-TEST1; consola limpia.
**ENCENDIDO EJECUTADO (2026-07-12, autorizado por Kevin):** 98 proveedores habilitados
(97 masivo + prueba), cuentas creadas; el acceso real de cada uno se activa cuando el
equipo le envía su enlace de contraseña (Regenerar enlace en la ficha; expiran en 24h).
**25 elegibles pendientes por falta de email** en su ficha (lista en PORTAL-PROVEEDORES.md
§Encendido). PDF de la OC con instrucciones del portal (URL + RUC + OrderReference con el
número de la orden). Pendiente: limpieza del proveedor de prueba PROV-TEST1 tras revisión.

**Fix post-C (2026-07-10) — sesiones pisadas y falsos "pendiente de aprobación":** Kevin
reportó que consultor@memphis.pe caía en "requiere aprobación" y que al navegar volvían los
módulos "en cero". Causa: el portal compartía el MISMO storage de sesión que el ERP → probar
el portal pisaba la sesión del personal (JWT de proveedor sin tenant → RLS vacío). Fixes:
(1) **cliente Supabase separado para el portal** (`portal-client.ts`, storageKey
`memphis-portal-auth`) — las sesiones ERP y portal coexisten; el cliente del ERP no consume
el hash de URL en rutas /portal; (2) **gate "cuenta pendiente" solo con sin-rol CONFIRMADO**
por la consulta (`sinRolConfirmado` en usePermissions; timeout/error de red ya no manda a
pending, con reintento automático); (3) loadProfile no anula un perfil ya cargado ante un
error transitorio (tenantId nunca cae a null a mitad de sesión). Regresión verificada en
preview: consultor login → portal login proveedor (misma pestaña) → volver al ERP =
consultor intacto con 129 proveedores y OCs visibles, consola limpia.
**Regla operativa**: dos usuarios del ERP en el mismo navegador siguen compartiendo sesión
(comportamiento normal de Supabase) — para probar 2 cuentas internas a la vez, usar ventana
de incógnito.

### IA embebida (N18) · **EN PAUSA (2026-07-09)**
La jefatura decide primero el monto de créditos a cargar en console.anthropic.com antes de
generar la API key. Diseño previsto sin cambios (Edge Function con Claude API, respeta RLS).

## 6.c MIGRACIÓN INCREMENTAL oc-system (2026-07-30) — delta post-corte

El equipo siguió usando oc-system tras el go-live. Extracción fresca read-only
(`4-extract-fresh.cjs`) → Firestore tenía 717 OCs vs 626 migradas. Delta: **91 OCs nuevas
MM-001068→MM-001158** (todas julio, 89 aprobadas / 1 pendiente / 1 rechazada→anulada).
Método: transform fase 2 con CORTE=1067 (`5-transform-fase2.py`) + carga atómica por pooler
con rol temporal `mig_f2_tmp` (`6-load-fase2.mjs`), UUIDs v5 → idempotente. Cargados 2
proveedores nuevos (PROV-0325 Juan Meléndez dom.; PROV-0326 OpenAI no dom.). Resultado:
**1,223 OCs** (717 de oc-system), 0 sin proveedor, 0 sin monto, 83 con cotización, sync de
626 estados + backfill de cadena req→cot→OC. Suma de las 91: S/2,248,248.40 (72 son
mantenimientos ICA de Peruana de Motores). Rol temporal eliminado. **Repetible**: correr
4-extract-fresh → 5-transform-fase2 (ajustar CORTE al último MM) → 6-load-fase2.

## 6.b.2 FIX RAÍZ "módulos sin data" (2026-08-04) — antipatrón onAuthStateChange · ✅

Kevin seguía viendo el problema (console: `[auth] getSession timeout` → `setSession
intento 1..4/4 falló: setSession timeout` → `modo degradado`), incluso limpiando caché.
**Causa raíz encontrada**: el callback de `onAuthStateChange` en AuthProvider.tsx era
`async` y hacía `await loadProfile()` (consulta a DB) DENTRO del callback. Supabase
ejecuta ese callback dentro de su maquinaria de auth y `setSession()`/`getSession()` NO
resuelven hasta que el callback termina (`_notifyAllSubscribers` los espera) → se cuelgan
→ timeout → modo degradado con el cliente **anónimo** → RLS devuelve listas vacías → "sin
data". Es un antipatrón documentado por Supabase (no await de llamadas Supabase dentro de
onAuthStateChange). **Fix**: el callback ahora es SÍNCRONO y la carga del perfil se DIFIERE
con `setTimeout(…,0)`, fuera del ciclo de notificación de auth (mismo patrón que ya usan
PortalProveedores/PortalTalleres sin problemas). Así setSession/getSession resuelven rápido,
el cliente queda autenticado y la data carga. Verificado: init de auth limpio (sin `[auth]`
en consola, sin safety timer). El fix previo (6.b) sigue vigente como backstop.

## 6.b FIX CRÍTICO PRODUCCIÓN (2026-07-08) — "módulos sin data" · ✅ desplegado

Síntoma de Kevin en producción: al cambiar de módulo/recargar, dashboards y listas en 0;
a la 3ª recarga aparecía la data. NO era caché HTTP (no hay service worker; sesión en
localStorage, no cookies). Dos causas reales:
1. **Recovery path del AuthProvider**: si `getSession()` tardaba >5s, publicaba la sesión
   React (tenantId) con el cliente Supabase AÚN ANÓNIMO → los stores consultaban sin JWT
   → RLS devolvía `[]` SIN error → módulos vacíos cacheados hasta recargar. Fix: hasta 4
   reintentos de `setSession` ANTES de publicar; modo degradado solo como último recurso.
2. **Carrera multi-pestaña de refresh token** (locks deshabilitados): dos pestañas rotaban
   el mismo token → Supabase revoca por reuso → sesión anónima. Fix: listener de `storage`
   que adopta el token renovado por otra pestaña (no re-habilitar navigator.locks: se
   probó y reintroduce deadlocks — usePermissions timeout, cargas de 15s con 0 filas).
3. Extra: reintento GET central (×3) en client.ts para blips de red; Cache-Control
   explícito en vercel.json (no-cache HTML, immutable /assets).
Verificado en preview (usuario QA, luego eliminado): login limpio, recarga en frío directa
a /proveedores/directorio → 128 al instante, /compras/ordenes con data, consola sin
warnings. Commit `7a228b2e`.

## 7. Último lote entregado (2026-07-07, auditoría integral #2)

Auditoría #2 completada con skills QA (sección AUDITORÍA #2 arriba): integridad backend
perfecta, advisors de seguridad 6→1, MOMARENTO consolidado (PROV-0323→PROV-0197,
RUC 20507115102), UI 100% verde en preview con usuario QA temporal (creado y eliminado).
Hallazgo abierto para Kevin: CCs con gasto grande sin proyecto (MSS-30 S/6.25M,
LORETOAMB S/10.8M, y 4 menores) — decidir si se registran como proyectos legados/pipeline.

Lote previo (mismo día): crashes de Lista de Proyectos / detalle de proveedor / rutas RQ- /
CORS excel-sync; datos ICA cobrado + consolidación de 9 proveedores duplicados + GICAPATRUL;
UX de paginaciones, export Excel de caja, comboboxes con búsqueda, dashboard de Proveedores,
buscador global sanitizado, notificaciones navegables y logo en PDF de orden.
