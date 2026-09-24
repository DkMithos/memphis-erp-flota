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

## 6.j MIGRACIÓN FINAL — lunes 31/08/2026, día del lanzamiento

Revisión completa de caja chica y órdenes al día de hoy, pedida por Kevin antes de desplegar.

### Caja chica · ✅ al día
Fuente: Excel de Administración (mtime 28/08 15:42). **Se comparó por huella digital de cada
hoja, no solo por totales**, porque un cambio de texto que conserva el importe no aparece en los
agregados.

**Estado final: 978 egresos y 139 ingresos — idéntico al Excel.** 0 duplicados. Último
movimiento 28/08.

Se cargaron 9 egresos nuevos (4 en ADMI016-DOLARES, 5 en ADMI024-SOLES) y 2 correcciones de
texto que hizo Administración.

**Tres trampas que costó encontrar y que hay que recordar:**
1. **La fila #21 de CAJA 1 DÓLARES fue renumerada a #27** en el Excel, con el mismo contenido e
   importe (S/331.82, reserva EENMOM). Cargarla habría **duplicado** el gasto. Se omitió.
2. **El migrado_id no puede compararse crudo**: el nombre de varias hojas lleva un espacio final
   (`"CAJA 8 DÓLARES "`) que el loader original recorta.
3. **La migración normaliza los centros de costo** (`GOREC-AMB` → `GCUSCOAMBU`), así que el CC
   del Excel nunca coincide con el de la base. Compararlo produce 32 falsos positivos.
   La reconciliación debe hacerse **sin** el centro de costo y con el ítem, no el migrado_id completo.

**Pendiente para Administración:** los ítems 13, 14 y 15 de CAJA 16 DÓLARES (US$384.50, US$176.93
y US$187.55) vienen en el Excel **solo con importe y fecha**, sin centro de costo, proveedor ni
descripción. Se cargaron para no perder el dinero, marcados como
`(pendiente de detalle en el Excel de Administración)`.

También: en CAJA 1 SOLES#92 el Excel **borró** la descripción que tenía ("GASTO"). La base la
conserva; no se sobrescribió con vacío.

### Compras · ✅ al día
Extracción fresca de Firestore: **792 órdenes vivas**, 238 requerimientos, 221 cotizaciones.

| | Antes | Ahora |
|---|---|---|
| Órdenes | 1,286 | **1,297** |
| Ítems de orden | 2,472 | **2,485** |
| Requerimientos | 236 | **239** |
| Cotizaciones | 217 | **221** |

- **11 OCs nuevas** MM-001223 → MM-001233 (26–27/08): S/37,151.74 + US$241.30.
- **MM-001222** pasó de `enviada` a `aprobada` (Gerencia la aprobó).
- El descuento por ítem de la nueva MM-001226 (S/30.81) también se rescató.
- **Las 792 del portal están en el ERP.** Los 25 huecos de numeración (MM-000465,
  MM-000485→000507, MM-000604) tampoco existen en el portal.
- Integridad: 0 sin proveedor, 0 sin ítems, 0 números duplicados.
- Quedan 3 en `enviada` y las 3 son fieles al portal: MM-000998 y MM-001027 (pendientes de
  comprador) y MM-001233 (pendiente de Gerencia General).
- Descuadres: 3 por céntimos + 37 del Excel 2024, que nunca tuvo detalle por ítem.

**Próximo número que emitirá el ERP: MM-001234**, sin colisión con el portal.

### Otros cierres de hoy
- **`CRON_SECRET`**: Kevin lo creó. Guardado en Vault y los dos cron reprogramados para enviarlo.
  Verificado: sin header o con header incorrecto → **403**. La corrida real de hoy 13:00 UTC
  devolvió **200**, confirmando el circuito completo.
- **Roles gestionados solo desde el ERP** (decisión de Kevin): se desactivaron las 8 filas de
  `ms_approle_role_map`. El login con Microsoft sigue autenticando, pero Entra ya no puede
  agregar ni retirar roles. Para devolverle el gobierno a Entra basta con `activo = true`.

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

---

## §6.k · RBAC en los botones, permiso `exportar` y modelo de caja (31/08/2026)

**Qué pidió Kevin (5 puntos):** verificar el permiso RBAC de los 9 módulos y qué botones lo
comprueban ("no puede haber decisiones tomadas por omisión"); confirmar el orden de fases de
exportación; agregar el permiso `exportar`; la caja chica con el modelo de Carolina; y llevar
las métricas del Flujo GM a un dashboard para Gerencia.

### Lo que apareció al revisar (punto 1)

La UI tenía **un solo** `can()` real en todo el sistema (`GestionUsuarios.tsx`, alta de usuarios).
`<PermissionGuard>` no se usaba en ninguna parte. En su lugar convivían **cinco tablas de
permisos escritas a mano** (órdenes, cotizaciones, requerimientos, recepciones, proveedores), y
las cinco terminaban en la misma línea:

```ts
const permisos = PERMISOS_POR_ROL[rol] ?? PERMISOS_POR_ROL.admin_sistemas;
```

El rol venía de `profiles.rol`, que vale `sin_rol` para 8 de los 9 usuarios. `sin_rol` no está en
ninguna de las tablas, así que **el fallback se disparaba siempre**: cualquiera que abriera
Compras o Proveedores recibía permisos totales, aprobar y anular incluidos. Walter (Contabilidad,
solo lectura por diseño) podía aprobar y anular órdenes de compra.

De ~81 pantallas con botones de acción, solo 28 llamadas en 9 archivos consultaban algo.

**Corregido:** las 5 tablas y sus `tienePermiso` eliminadas; las 28 llamadas migradas a
`can(modulo, accion)`; registrar recepción exige `compras.recepcionar` (no `compras.ver`); y el
fallback de rol en los stores deja de afirmar `admin_sistemas`.

### Permiso `exportar` (punto 3)

Existía para 8 módulos pero **casi sin asignar**: el rol Compras no podía exportar compras, y
Técnico Flota no podía exportar flota. Gatear los botones sin arreglar eso habría dejado al
equipo sin descargas el día del lanzamiento.

Regla adoptada, explícita: **"exporta lo que ve"**. Se creó `admin.exportar` (único módulo que
no lo tenía) y se concedió `<modulo>.exportar` a cada rol por cada `<modulo>.ver` que ya tenía.
Los 9 roles quedan con `ver == exportar`. El permiso se conserva como interruptor propio para
poder quitar la descarga a un rol sin quitarle la lectura.

La guarda va en el **manejador**, no solo en el botón: `if (!puedeExportar) return;`.

### Modelo de caja chica (punto 4)

El export "modelo Carolina" generaba **HTML renombrado a `.xls`**. Excel lo abre avisando que el
formato no coincide con la extensión, y los importes llegaban como texto `"S/ 1,234.56"` — el
mismo problema que se acababa de corregir en el resto. Rehecho como `.xlsx` real con SheetJS,
conservando el diseño (cabecera Memphis, recuadro de saldos, 9 columnas, totales, firma) pero con
importes numéricos, fechas reales y códigos como texto. 3 pruebas nuevas sobre el libro generado.

### Dashboard de Gerencia (punto 5) — plan, no ejecutado

→ [PLAN-Dashboard-Gerencia.md](PLAN-Dashboard-Gerencia.md).

**El hallazgo que manda:** la mitad de los indicadores del Flujo GM sale de facturas, y las tablas
que las guardarían están **vacías** — `comprobantes_pago` 0, `comprobantes_detalle` 0,
`transacciones` 0, `registro_ventas` 0, `presupuestos` 0, `asientos_contables` 0. Construirlo hoy
mostraría **S/0 de deuda donde hay S/92M**. El dashboard es, en la práctica, la pantalla final del
módulo CxP.

Sí se puede la mitad de compromiso: 1,297 OCs con fecha y centro de costo, 978 gastos de caja,
7 proyectos con presupuesto. Propuesta: vista **"Flujo Gerencia" dentro de BI** (no un módulo
nuevo, para no partir el dato en dos sitios), Fase 1 ya y Fase 2 atada a CxP.

**Pendiente de decisión de Kevin:** opción B confirmada o no; arrancar Fase 1 con el hueco de
deuda rotulado; tipo de cambio (hoy 3.75 fijo, ningún total mixto es defendible sin tabla por
fecha); y si bancos e ingresos entran al ERP.

### Verificación

Build limpio · 43/43 tests · 0 errores de tipos nuevos (995 antes y 995 después; las diferencias
del diff eran desplazamientos de línea, confirmado ignorando línea y columna).

---

## 08/09/2026 — Recorrido del sistema con un perfil por rol

Once cuentas QA temporales, una por rol, creadas y borradas en la misma sesión (nunca se tecleó
una contraseña en el formulario: sesión por API y volcada a `localStorage`). Cada perfil vio su
menú y trató de abrir 17 rutas, incluidas varias que no le tocan.

**Bien:** Fianzas y Cargos de Fianzas están limpios — Lisbet llega a `/fianzas/cargos` con
`fianzas.cargos` y sin ver un solo monto, y el tablero de fianzas le queda cerrado. Compras,
Proveedores y las exportaciones comprueban sus verbos. Administrador ve todo, sin errores de
consola.

**Corregido y desplegado** (`af965dc4`): Flujo Gerencia estaba abierto a siete roles; el Dashboard
general no pedía permiso alguno y mostraba presupuesto y costo real de proyectos a cualquiera con
sesión; y dar conformidad de mercadería solo pedía ver compras. Los accesos rápidos del inicio no
incluían Fianzas, así que Shirley, Carolina y Lisbet leían "tu rol todavía no tiene módulos
asignados". Las reglas decididas a mano quedaron fijadas en `src/lib/rbac/rutas.test.ts`.

**Lo que quedó abierto y está en PENDIENTES:** fuera de Compras, Proveedores y Fianzas, los verbos
`crear`/`editar`/`eliminar`/`aprobar` no se comprueban en pantalla, y RLS es solo por tenant, así
que el botón que se ve escribe. Gerencia —que es rol de consulta— puede crear y borrar en seis
módulos. No se tocó el día del lanzamiento: son ~20 pantallas y conviene hacerlo con Kevin mirando.

### Verificación

67/67 tests (8 nuevos de rutas) · 994 errores de tipos antes y después, ninguno en lo tocado ·
las tres correcciones se volvieron a probar en vivo con perfiles de Cargos Fianzas, Contabilidad
y Gerencia.

---

## 08/09/2026 — BI y Reporte Cruzado, listos para Gerencia

**El Reporte Cruzado no devolvía nada.** Sus cuatro consultas pedían columnas que no existen
(`ordenes_trabajo.proyecto_id`, `gastos_caja_chica.centro_costo_id`,
`requerimientos_compra.fecha_solicitud`); PostgREST respondía error y el código lo tragaba
devolviendo lista vacía. Y dejaba fuera las órdenes de compra, que son el gasto real.

**El panel de BI pedía quince métricas a seis tablas vacías** — transacciones, oportunidades,
clientes, artículos, contratos, tareas — y mostraba "Balance del mes S/ 0" y "Pipeline S/ 0" como
si fueran cifras.

### Lo que hay ahora

- **`v_bi_movimientos`**: órdenes de compra + gastos e ingresos de caja chica normalizados,
  **2,414 movimientos** (S/ 20.5M y $ 22.3M de egreso). Excluye anuladas y rechazadas.
- El **centro de costo se resuelve contra el catálogo** para que el mismo centro no se parta en
  dos: las órdenes traen `centro_costo_id`, que ya arregla los alias del legado; el texto de caja
  chica se casa por código o por nombre, y lo que no casa se marca `en_catalogo = false`.
- **Reporte Cruzado**: cruza por proyecto, centro de costo, mes, proveedor u origen. Soles y
  dólares **siempre separados**. Se paginó la consulta — PostgREST corta en 1,000 filas y el
  reporte y su Excel se quedaban ahí sin avisar.
- **Panel BI**: una tarjeta por módulo con datos reales, cada una sujeta al permiso de ese módulo,
  gráfico de compromiso mensual y un bloque explícito de "lo que todavía no se puede reportar".
- Las cinco vistas `v_gerencia_*` corrían como su dueño (saltándose RLS) y estaban concedidas a
  `anon`. Pasan a `security_invoker` y se les quita `anon`.
- Se retiró `BIProvider`: nadie consumía `useBI` y disparaba 18 consultas en cada carga.

### Verificación

78/78 tests (11 nuevos) · build limpio · sin errores de tipos en lo tocado · recorrido en vivo con
perfiles de **Gerencia** (ve las seis tarjetas, las tres series del gráfico, 2,414 movimientos) y
**Compras** (solo compras y proveedores, sin la serie de caja chica, sin Flujo Gerencia) ·
0 errores de consola.

### Lo que salió a la luz

- **616 movimientos** traen un centro de costo escrito a mano que no está en el catálogo; el grueso
  es "OFICINA CENTRAL" (519), que existe como `OFCENTRAL` / "Gastos Oficina Central". Es un mapeo
  de Administración, no código.
- **1,006 egresos sin proyecto** — coherente con las 353 OCs que espera Operaciones.

---

## 08/09/2026 (tarde) — Actualización de datos desde los archivos de Operaciones

Cinco frentes, todos contra el archivo vivo del equipo y comparando por contenido, nunca por
posición de fila.

### Mantenimientos — +232 (662 en total)

Fuente: `CONTROL DE MANTENIMIENTO CAMIONETAS ICA.xlsx`, hoja `mantenimientos historico`
(actualizado hoy 13:49). El ERP estaba al 22/05; ahora llega al **02/09/2026**.

- **229 mantenimientos nuevos** cargados, S/ 86,562.92.
- **3 OTs tenían el año 2006** en vez de 2026 (error de lectura de la carga original). Son las
  mismas que el Excel trae en enero de 2026 —misma placa, mismo km, mismo costo—, así que se les
  **corrigió la fecha** en lugar de insertar un gemelo.
- Cuadre exacto: Excel 661 registros / S/ 236,347.11 · ERP 662 / S/ 236,881.28. La diferencia es
  **OT-ICA-0140** (EPH-999, 10/09/2025, km 30,000, S/ 534.17), que el Excel ya no tiene: esa
  camioneta figura con **dos mantenimientos de 30,000 km** y sin el de 25,000. No se borró nada;
  queda para que Operaciones diga cuál es.

### Vehículos — 50 actualizados

Kilometraje, último y próximo mantenimiento de las 50 camionetas del GORE ICA, desde la hoja
`PRINCIPAL`. Los 50 subieron km (ninguno retrocedió); antes **ninguno** tenía fecha de próximo
mantenimiento y ahora los 50 la tienen. Promedio 70,088 km.

### Compras — +3 órdenes (1,316)

MM-001250, MM-001251 y MM-001252, las tres de hoy, a PERUANA DE MOTORES HG por mantenimientos ICA,
con sus ítems y las 6 aprobaciones reales del historial del legado.

- **Un proveedor nuevo quedó fuera a propósito**: "GEREMIE KEVIN CALLUCO QUISPE" con RUC
  `107345501536`, de **12 dígitos**. Un RUC tiene 11. No lo referencia ninguna orden.
- **Corregido un fallo del script de delta**: `MAPA_ESTADO` tenía claves en snake_case
  (`pendiente_comprador`) pero Firestore guarda "Aprobada", "Rechazado", "Aprobado por Gerencia".
  Nunca casaba, así que el delta informaba "0 cambios de estado" pasara lo que pasara — una orden
  anulada en el legado habría seguido figurando como aprobada aquí. Con el mapa arreglado, hoy
  siguen siendo 0 de verdad.

### Proyectos — presupuestos y situación

Espejo del Excel resincronizado (la vista `/proyectos/excel-sync` estaba al 07/08). La copia de
SharePoint y la de OneDrive coinciden.

- **Presupuesto** afinado en tres: HUÁNUCO 6,800,000 → 6,804,736.57 · LORETO 33,200,000 →
  33,204,526.79 · AMAZONAS 11,660,046.03 → 11,945,011.03.
- **Situación** sincerada: SERENAZGO → `revision_suspension`, AMBULANCIAS → `suspension`,
  HUÁNUCO → `revision_td`. Las dos primeras situaciones no existían en el CHECK y se agregaron:
  antes caían en `revision_estado`, que no dice lo mismo.

### CRPL — ningún cobro nuevo, y por qué parece que sí

**El `MONTO COBRADO` de las siete fichas coincide exactamente con lo que ya tenía el ERP.** Lo que
sí cambió son las **valorizaciones**: hoy suman S/ 89.99 M aprobadas frente a S/ 58.27 M cobrados.

La hoja `STATUS DE PROYECTOS` muestra AMAZONAS y CUSCO-HIDROAMBULANCIAS como **cobrados al 100 %**,
pero **es un error de fórmula**: en esas dos filas las cuatro columnas (inicial, modificado,
cobrado y saldo) devuelven el mismo número, la inversión inicial. Se nota en el total: saldo
S/ 83.95 M cuando modificado − cobrado da S/ 69.89 M; la diferencia, S/ 14.07 M, es exactamente
11.75 + 2.32. Las fichas de esos dos proyectos dicen cobrado S/ 0.

**Pendiente de confirmar con Operaciones:** o la fórmula del STATUS está mal, o el cobro ocurrió y
las fichas no se actualizaron. El ERP se quedó con lo que dicen las fichas.

### Verificación

Rol temporal `delta_0908` creado y eliminado. 0 fechas imposibles. Totales: 1,316 órdenes ·
2,504 ítems · 662 mantenimientos · 414 vehículos (50 con km fresco) · 11 proyectos.

---

## 08/09/2026 (noche) — Caja chica: cajas abiertas, moneda y duplicados

### Carolina tenía razón: dos cajas abiertas, no cuatro

El Excel lo confirma sin ambigüedad: **CAJA 24 SOLES** cerró con S/ 95.78 y esa cifra es la que
abre la 25; **CAJA 16 DÓLARES** cerró con $ 0.75 y esa abre la 17. Las dos quedaron marcadas como
cerradas. Abiertas: **CAJA 25 SOLES** y **CAJA 17 DÓLARES**.

### La causa de fondo: la descripción se usaba como identidad

La carga de caja chica comparaba por caja + fecha + monto + **descripción**. Cuando Administración
corrige un texto en el Excel, la fila deja de parecerse a la que ya está cargada y entra otra vez.
Eso produjo cuatro duplicados:

| Caja | Duplicado | Gemelo real |
|---|---|---|
| CAJA 16 DÓLARES | tres "(pendiente de detalle en el Excel de Administración)" | los mismos gastos ya con su descripción, beneficiario y comprobante |
| CAJA 24 SOLES | "devolucion miguelangel" S/ 480 | "LEGALIZACION DE FIRMAS — NOTARIA ARELLANO PEREZ", mismo día e importe |

Se borraron los cuatro (marcadores sin información, no datos) y se corrigió el criterio en
`17-cargar-caja-0809.mjs`: ahora basta con que coincida la descripción **o** el número de ítem
dentro de la caja.

### Saldos recalculados

`monto_asignado` y `monto_disponible` estaban congelados en el valor de la carga inicial. Se
recalcularon desde los movimientos, que es justo lo que muestra la cabecera del Excel: "Ingresos"
como asignado y "Saldo Final" como disponible. **Las 41 cajas cuadran al céntimo con el Excel.**

### Nada faltaba por cargar

Los cuatro movimientos que el delta marcaba como ausentes ya estaban, con descripción genérica
("GASTO", "INGRESO") porque la celda del Excel está en blanco. Sí faltaba **uno**: el ingreso de
apertura de CAJA 25 SOLES (S/ 95.78), que el Excel deja sin fecha; se cargó con la del último
movimiento de la 24 (04/09).

### El símbolo de moneda

`fmt()` tenía `'PEN'` por defecto y tres llamadas no pasaban la moneda: la tabla de gastos dentro
de una caja, el "Total mes" y la etiqueta "Monto (S/)" del diálogo de registrar gasto. Una caja en
dólares mostraba sus importes con S/. El parámetro pasó a ser obligatorio para que el compilador
no deje repetir el olvido. Verificado en pantalla: CAJA 17 DÓLARES muestra $ en cabecera, tabla y
diálogo; CAJA 23 SOLES sigue mostrando S/.

### Para Administración

- La hoja **CAJA 25 SOLES** dice `N° DE CAJA: ADMI024-SOLES` (copiado de la anterior) y su primera
  fila menciona "CAJA CHICA ANTERIOR 23" cuando viene de la 24.
- Siguen las tres fechas ya reportadas: CAJA 8 SOLES ítem 47 con `1900-01-26` y CAJA 17 SOLES
  ítem 43 con `2026-15-06` (mes 15). El ERP las tiene con la fecha corregida.

---

## 08/09/2026 — Caja chica: apertura encadenada y saldo automático

Kevin confirmó lo que se veía en el Excel: **Administración nunca abre una caja de cero**, cada una
nace con el saldo de la que se cierra. Implementado.

### Backend (`fn_abrir_caja_chica`)

Una sola transacción hace las cuatro escrituras: crea la caja, mete el arrastre como primer
movimiento (`SALDO A FAVOR DE CAJA CHICA ANTERIOR (…)`), suma el depósito adicional y cierra la de
origen — **en ese orden**, de modo que si algo falla la caja anterior sigue abierta. Rechaza abrir
desde una caja cerrada, cruzar monedas y crear una caja en cero. Numera sola siguiendo el
correlativo de Administración: `CAJA 26 SOLES` / `ADMI026-SOLES`.

### Backend (`fn_recalcular_caja` + disparadores)

El saldo se escribía **una sola vez, al crear la caja**, y nunca más. Por eso las 41 estaban
desfasadas. Ahora lo mantiene la base en cada alta, baja o corrección de gasto o ingreso, venga de
la pantalla o de una carga masiva:

- `asignado` = suma de ingresos (incluido el arrastre) — la fila "Ingresos" del Excel
- `disponible` = asignado − gastos, **sin contar los rechazados** — la fila "Saldo Final"

### Pantalla

- "Nueva Caja Chica" pregunta **de qué caja viene** y **cuánto se deposita**, y muestra la suma
  antes de confirmar. El nombre es opcional: si se deja vacío, se numera solo.
- Botón **"Registrar Ingreso"** para las reposiciones de una caja abierta. Antes solo se podían
  cargar por SQL, que es la razón por la que faltaba el ingreso de apertura de la CAJA 25.
- Corregido un bug latente: la exportación global leía `concepto` en `ingresos_caja_chica`, columna
  que no existe, así que **los ingresos nunca salían** en el Excel de todas las cajas.

### Verificación

Probado de punta a punta contra la base real y deshecho después: apertura de CAJA 26 SOLES con
arrastre S/ 95.78 + depósito S/ 4,000 = S/ 4,095.78 y cierre de la 25; reposición de S/ 1,060 →
S/ 5,155.78; gasto de S/ 250 → S/ 4,905.78. El saldo siguió cada paso solo. Las tres guardas de
`fn_abrir_caja_chica` probadas una a una. Estado final intacto: 41 cajas, 2 abiertas, 1,006 gastos,
145 ingresos.

### Sin paso de aprobación (decisión de Kevin, 08/09)

Carolina registra y aprueba ella misma, así que el gasto **nace aprobado**, firmado con el correo
de quien lo registró. Fuera los botones de aprobar/rechazar, el contador de pendientes y las
columnas Estado y Acciones, que dirían siempre lo mismo.

`estado` sigue existiendo en la base y el recálculo del saldo mantiene la regla de **no contar los
rechazados**: si alguna vez hay uno por carga o corrección manual, se sigue respetando.

Verificado: gasto de $ 33.33 en CAJA 17 DÓLARES → guardado como `aprobado`, `aprobado_por` con el
correo del usuario, moneda USD, y el disponible bajó de $ 1,808.69 a $ 1,775.36 solo. Borrado
después; estado final intacto (1,006 gastos, 145 ingresos, 41 cajas, 2 abiertas).

---

## 09/09/2026 — El "error" de Flota y la prueba completa del flujo compra→pago

### 1. El dashboard de Flota no estaba roto: era el despliegue

Carga bien en desarrollo **y** con el build de producción. El ERP se parte en ~90 archivos que se
piden bajo demanda y llevan un hash en el nombre; al publicar una versión nueva los de la anterior
desaparecen, así que a quien tenía el sistema abierto le fallaba la carga del siguiente módulo que
abriera. Flota fue el que le tocó a Kevin.

`lib/shared/lazy-modulo.tsx` recarga **una** vez cuando el fallo es "no encontré el archivo", que es
lo que trae el index.html nuevo. Marcado en sessionStorage para que un módulo realmente roto no
entre en bucle, y sin confundir un error DENTRO del módulo con un fallo de descarga.

### 2. Prueba integral: requerimiento → … → flujo de caja

Se recorrió la cadena entera creando datos reales y se borró todo al terminar. **La cadena llega de
punta a punta**, pero antes de esta sesión se rompía en cinco sitios distintos. Catorce fallos
encontrados y corregidos:

**Requerimientos** — "Guardar y Enviar" dejaba el requerimiento en BORRADOR anunciando que lo había
enviado (carrera entre crear y cambiar de estado, con el resultado sin comprobar); el centro de
costo se guardaba como UUID mientras los 242 migrados usan el CÓDIGO; aprobar no hacía nada porque
se mandaba el CORREO a una columna uuid.

**Cotizaciones** — **no se podía crear ninguna**: el formulario pedía el proveedor a mano y el
guardado exige el del catálogo. Tampoco se podía aprobar: la tabla no tenía las columnas de
aprobación que el código escribe desde siempre.

**Órdenes** — "Crear Orden" **fallaba en silencio** (faltaban los ids de proveedor y cotización, y
el error solo iba a la consola); las condiciones de pago exigían 10 caracteres cuando las opciones
del propio catálogo son "30 días"; faltaba el botón para enviar a aprobación, así que una orden
nueva se quedaba en borrador para siempre; y el nivel de aprobación comparaba el NOMBRE de la
persona contra los roles, negándole el permiso a un Administrador que sí está en el nivel 1.

**Recepciones** — mismo fallo mudo; y como el formulario no enviaba la cantidad pedida, **ninguna
recepción podía marcarse completa**: toda orden quedaba en "recibida parcial" aunque llegara todo.

**Fechas** — todo Compras mostraba **un día menos** del real (`new Date('2026-09-09')` es medianoche
UTC y Lima va cinco horas atrás). Nuevo helper `lib/shared/fecha.ts`.

### 3. Dónde se corta el flujo hoy (no es un fallo, es que falta)

| Eslabón | Estado |
|---|---|
| Requerimiento → Cotización → Orden → Recepción | funciona (tras los arreglos) |
| Factura | **solo entra por el portal del proveedor** (XML UBL). No hay forma de cargarla desde el ERP |
| Detracción / Retención | las columnas existen, **nadie las calcula ni hay dónde indicarlas** |
| Pago | "Marcar pagada" solo cambia un estado: no mueve caja, no genera asiento ni cuenta por pagar |
| Presupuesto | se crea, pero **no se cruza** con las órdenes ni con el gasto real |
| Transacción | hay que teclearla **a mano**; nada de la cadena la genera |
| Cuentas por Pagar | **no existe**: la ruta `/finanzas/cuentas-pagar` muestra la pantalla de Transacciones |
| Flujo de Caja | funciona, pero lee **solo** `transacciones` — sin transacciones a mano, sale S/ 0.00 |

Con la transacción registrada a mano, el flujo de caja mostró correctamente el egreso de S/ 991.20.

### Limpieza

Toda la cadena de prueba borrada (RQ-00245, COT-0041, MM-001253, REC-0001, F001-00099001,
TRX-2026-0001 y el presupuesto). La clave temporal de la cuenta de portal del proveedor se
sustituyó por una irrecuperable. **Queda un archivo huérfano**: el XML de prueba en el bucket
`facturas-proveedores`, que no se puede borrar por SQL y no tenemos la clave de servicio a mano.

---

## 09/09/2026 (tarde) — Todo amarrado a centro de costo

**Regla adoptada:** ningún gasto nace sin centro de costo. El **proyecto no se pide aparte**: se
deriva del centro de costo con los disparadores que ya existían (`centros_costo.proyecto_id` es el
puente). Así se elige una sola vez y no puede haber contradicción entre ambos.

### Caja chica

La pantalla tenía los selectores de Proyecto y Centro de Costo **desde siempre, pero no se
guardaban**. Cada gasto registrado desde el ERP nacía sin imputar. Ahora se guardan y el centro de
costo es obligatorio.

### Cadena de compras

El requerimiento ya capturaba el centro de costo (244 de 244) y **la cotización y la orden lo
tiraban**. Ahora viaja entero:

| Eslabón | De dónde saca la dimensión |
|---|---|
| Requerimiento | Se elige (obligatorio, ya existía) |
| Cotización | **Hereda** del requerimiento · editable · obligatorio · deriva proyecto |
| Orden | **Hereda** de la cotización |
| Recepción | **Hereda** de la orden (antes empezaba en blanco) |
| Factura | **Hereda** de la orden por disparador — antes no tenía dimensión ninguna |

Verificado de punta a punta: GAMAZONPNP viajó del requerimiento a la factura y el proyecto
05AMAPNP25 se dedujo solo en los cuatro eslabones.

### Carolina ya está en producción

Durante la sesión, `cokamura@memphis.pe` registró en **CAJA 25 SOLES** un ingreso de S/ 10,000 y dos
gastos por el nombramiento del nuevo gerente general (S/ 530.00 y S/ 92.40). El saldo se recalculó
solo: 10,095.78 − 622.40 = 9,473.38. **Los dos gastos quedaron sin centro de costo** porque son
anteriores al arreglo de hoy — hay que imputarlos a mano.

### Pendiente detectado

El número de gasto se genera contando los gastos de la caja en memoria (`length + 1`), así que dos
personas registrando a la vez pueden obtener el mismo número. Hoy no ha pasado, pero conviene
resolverlo antes de que sean varios usando caja chica.

---

## 09/09/2026 (noche) — Caja chica: corregir movimientos y origen de la caja

Pedido de Carolina, que ya está usando el módulo en producción.

### Corregir movimientos

Cada gasto y cada ingreso tienen un botón de lápiz que abre el mismo formulario ya relleno. Al
guardar se **actualiza**, no se duplica, y el saldo lo recalcula solo el disparador. Solo se corrige
en **cajas abiertas**: si el error está en una cerrada hay que reabrirla, mismo criterio con el que
la base impide registrar movimientos en una caja cerrada.

Para poder corregir los ingresos había que verlos: no se mostraban en el detalle de la caja y ahora
se listan aparte de los gastos.

### De dónde viene la caja

Panel **"Cómo se abrió esta caja"**: el saldo que trajo y de cuál, los depósitos posteriores uno a
uno, el total con el que cuenta, lo gastado y el saldo actual. Si la caja ya se cerró, dice a qué
caja pasó su saldo. En CAJA 25 SOLES se lee así:

```
Saldo que trajo de CAJA 24 SOLES        S/     95.78
CAJA CHICA APERTURA            07/09    S/ 10,000.00
DEVOLUCIÓN ANTONIO REYES       08/09    S/    120.00
Total con el que cuenta                 S/ 10,215.78
Gastado                                 S/  8,951.67
Saldo actual                            S/  1,264.11
```

### Datos corregidos de paso

- El arrastre de apertura de CAJA 25 lo cargué a mano el 08/09, antes de que existiera
  `fn_abrir_caja_chica`, y quedó como reposición genérica. Se le puso su tipo (`saldo_anterior`) y
  su origen (`CAJA 24 SOLES`) reales para que la caja sepa de dónde viene.
- `GCC-2026-015` quedó imputado a `OFCENTRAL`, que era el centro de costo que le faltaba.
- El store leía `centro_costo_id` en `gastos_caja_chica`, columna que no existe (la real es
  `centro_costo`, con el código), así que la imputación se leía siempre vacía.

### Nota de la sesión

Al probar la corrección se duplicó un gasto de Carolina (GCC-2026-016): el cambio de código que
evitaba el duplicado no había llegado a guardarse porque el script que lo aplicaba abortó por un
error posterior. Se borró el duplicado y la caja volvió a sus 15 gastos y S/ 1,264.11 exactos.
**Lección: verificar que el cambio está en el archivo antes de probarlo contra datos reales.**

---

## 09/09/2026 — Régimen de IGV y circuito de firmas

### Régimen de IGV por proveedor

El ERP cobraba **18% siempre**, aunque en el histórico ya hay **58 órdenes sin IGV**
(S/ 229,793.61). Cuatro regímenes: gravado, exonerado Amazonía, no domiciliado, inafecto. Se define
en el proveedor, la compra lo hereda y se ajusta por orden. **Se guarda con la compra**: una orden
de hace un año no cambia porque el proveedor cambie de régimen hoy.

54 de las 58 quedaron clasificadas solas. **Faltan 4 por criterio humano**: MM-000035 y MM-000101
(Master Tires — el total SÍ incluye el 18% pero la columna igv dice cero, parece defecto de
migración) y MM-000053 / MM-000054 (Boullosa Motors — total = subtotal, sin IGV).

Retención de 4ta: se marca en el proveedor **con la vigencia de la constancia de suspensión**,
porque vence. Vencida, el sistema vuelve a proponer la retención.

### Circuito de firmas

**comprador → operaciones → gerencia.** Bajo S/ 10,000 firman las dos primeras; a partir de ahí
entra Gerencia. La orden pasa a aprobada **solo con todas las firmas requeridas**.

| Etapa | Rol | Quién |
|---|---|---|
| comprador | Compras | Richard — firma **al generar** la orden |
| operaciones | Proyectos | Miguelangel |
| gerencia | Gerencia | Guillermo, William, Miguel |

- A Compras se le **quitó** `aprobar`: genera y firma, pero no aprueba.
- A Proyectos se le **dieron** `ver` y `aprobar` sobre compras, que no tenía.
- La configuración del flujo vivía en **localStorage** — cada navegador la suya. Ahora está en la
  tabla `flujo_aprobacion`.

Verificado con tres cuentas sobre una orden de S/ 23,600: comprador firmó al crear, operaciones la
dejó **pendiente** avisando que faltaba Gerencia, y solo con la tercera pasó a Aprobada. El PDF
salió con las tres columnas.

### Fallo de fondo corregido

El disparador de auditoría **hacía fallar cualquier cambio de permisos de un rol**:
`roles_permisos` no tiene `tenant_id`, la función caía en un id inexistente y la clave foránea
revertía el INSERT entero. Era imposible dar o quitar un permiso por ningún camino. La auditoría no
debe impedir la operación que audita.

### Pendiente operativo

**Nadie ha subido su firma**: `firmas_usuario` está vacía. Hasta que Richard, Miguelangel, Guillermo
y William suban la suya en Perfil → Mi Firma, el PDF imprime la línea en blanco con el nombre
debajo, para firma manuscrita.

---

## 2026-09-09 — Firma dibujada en el sistema y numeración de caja chica

### La firma se dibuja, ya no hay que escanearla

`src/components/shared/PadFirma.tsx`. En Perfil → Mi Firma aparece **"Firmar aquí"** antes que
"Subir imagen": se abre un lienzo y se firma con el mouse o con el dedo en la pantalla táctil de
oficina. Está hecho con Pointer Events, así que mouse, dedo y lápiz entran por el mismo camino y no
hay que mantener dos implementaciones.

Tres cosas que no se ven pero importan:

- El lienzo se dimensiona por `devicePixelRatio`; sin eso la firma sale pixelada en pantallas
  buenas y peor todavía al ampliarla en el PDF.
- El trazo se suaviza con curvas cuadráticas entre puntos: a mano alzada, unir puntos con rectas
  deja una firma temblorosa que no se parece a la de la persona.
- Antes de guardar se **recorta el vacío** alrededor del trazo. Si no, la firma llega al PDF como
  una imagen enorme casi transparente y se ve minúscula dentro de su recuadro.

Se conserva **subir imagen** para quien ya tenga su firma escaneada. Sigue sin poder subirse un
**PDF**: no hay ninguna librería de PDF entre las dependencias y meter pdf.js completo solo para
extraer una firma no se justifica ahora que se puede dibujar. Si alguien la tiene únicamente en
PDF, se resuelve en un minuto con una captura de pantalla — o se agrega, si hace falta de verdad.

Probado de punta a punta con una cuenta temporal: se dibujó, se guardó, y la fila quedó en
`firmas_usuario` como PNG. La cuenta se eliminó después; la tabla vuelve a estar vacía.

### Dos personas registrando en la misma caja se pisaban el número

CAJA 25 SOLES tenía **dos GCC-2026-004 y ningún 003**. El frontend leía el último número y sumaba
uno; con dos personas registrando a la vez, ambas leían el mismo. Ya había pasado en producción.

El correlativo se movió a la base: `fn_siguiente_correlativo_caja` bloquea la fila de la caja
(`FOR UPDATE`) mientras calcula, y los disparadores `BEFORE INSERT` de gastos e ingresos lo asignan.
Los disparadores **respetan el número cuando viene dado**, para que las cargas desde Excel conserven
el del archivo. El gasto duplicado ("COMPRA DE LAPTOP PARA NUEVO GERENTE GENERAL") se renumeró a
GCC-2026-003.

Migración: `caja_chica_numeracion_en_la_base`.

### Sin tocar, por indicación de Kevin

Las 4 órdenes sin clasificar IGV (MM-000035, MM-000101 de Master Tires; MM-000053, MM-000054 de
Boullosa Motors), las 15 con el total descuadrado, y el cuadro "Control ERP" — los ve con
Operaciones.

### Quedan dos números repetidos del Excel

CAJA 12 DÓLARES nº 3 y CAJA 19 SOLES nº 15, ambos en cajas **cerradas**. Vienen del archivo
original, no del sistema. Se dejan como están: renumerar un movimiento de una caja cerrada cambia
un documento ya cuadrado y firmado.

---

## 2026-09-09 (tarde) — Richard no debe ver Finanzas

Kevin capacitó a Richard y vio que llegaba a las transacciones y a la caja chica. Había dos causas
distintas, y la segunda no se arreglaba con roles.

### Richard tenía dos roles

`rnavarro@memphis.pe` tenía **Compras** y **Administración**. El segundo es el rol de Carolina y trae
`finanzas` completo — de ahí la caja chica. Además traía `compras.aprobar`, **el permiso que le
quitamos a Compras la semana pasada** al montar el circuito de firmas: el segundo rol se lo devolvía
por la puerta de atrás. Se le quitó Administración.

También se quitó **Inventario** del rol Compras (lo tenía en `ver` y `exportar`). Richard queda con
`compras` y `proveedores`, nada más, que es lo pedido.

Lección: al restringir un rol hay que mirar si la persona tiene otro. Los permisos se **suman**.

### El Reporte Cruzado enseñaba la caja de todos modos

Quitar el rol esconde el menú y bloquea `/finanzas/*`, pero el Reporte Cruzado de BI cruza órdenes
**con caja chica** y ofrecía las tres fuentes sin mirar permisos. Con solo `compras.ver` se llegaba
a `/bi` y se listaban los gastos e ingresos de las cajas, importe por importe.

Ahora cada origen exige su módulo (`fuentesPermitidas()` en `src/lib/bi/cruzado.ts`, con pruebas).
Un rol de Compras solo ve "Órdenes de compra"; el subtítulo, la tarjeta de "Ingresos de caja" y el
texto del enlace en el panel de BI se adaptan, para no anunciar lo que no se va a ver.

El panel de BI ya estaba bien: la tarjeta de caja y la serie del gráfico ya pedían `finanzas.ver`.

Verificado con una cuenta temporal con el rol exacto de Richard: menú sin Finanzas ni Inventario,
`/finanzas/caja-chica` y `/finanzas/transacciones` bloqueadas por URL directa, y el reporte devolvió
571 movimientos, todos órdenes de compra, sin una sola línea de caja. Cuenta eliminada después.

### Lo que esto NO resuelve

**La RLS es solo por tenant.** Las políticas de `cajas_chicas`, `gastos_caja_chica` y `transacciones`
dicen únicamente `tenant_id = auth_tenant_id()`: el filtro por módulo vive entero en la interfaz.
Quien sepa usar la API con su propio token puede leer esas tablas aunque el ERP no se las muestre.
Para Richard no es un problema real, pero el día que haya un rol al que de verdad haya que ocultarle
cifras, esto se arregla con una función `auth_puede(modulo, accion)` usada dentro de las políticas.
Es un cambio que toca el acceso de todos a la vez — decisión de Kevin, no se hizo de oficio.

---

## 2026-09-09 (tarde II) — El requerimiento no llegaba a la cotización

Richard creó RQ-00245 y no le aparecía para cotizar; al entrar por "Crear Primera Cotización" el
formulario salía en blanco. Eran **tres fallos distintos** que se veían como uno.

### 1. Los dos caminos no se ponían de acuerdo

El selector de la cotización solo listaba requerimientos en estado `aprobado` — **17 de 245**. La
pantalla del requerimiento, en cambio, ofrecía "Crear Primera Cotización" en cualquier estado. El
mismo requerimiento existía por un camino y no por el otro.

Ahora los dos usan `puedeCotizarRequerimiento()`: se cotiza desde **enviado**. El motivo es de
negocio, no de código — los precios son justamente lo que hace falta para decidir si se aprueba, así
que exigir la aprobación antes de cotizar deja el trámite mordiéndose la cola. Sigue sin cotizarse un
borrador, un rechazado o un anulado. **Si Operaciones prefiere que solo se cotice lo aprobado, es
cambiar una línea.**

### 2. Los items no se copiaban nunca

No es que se rompiera: `items: []` estaba escrito en el estado inicial y nadie lo llenaba jamás. La
cotización nacía vacía siempre, viniera de donde viniera.

`heredarDelRequerimiento()` (`src/lib/compras/heredar-requerimiento.ts`, con pruebas) trae items,
cantidades, unidades, precio estimado como precio de partida, moneda y centro de costo. Los
**comentarios** de cada item van a `observaciones`, no a la descripción: esa línea acaba en el PDF
que ve el proveedor, y un "urge para el lunes" no tiene por qué viajar ahí.

### 3. El prefill se perdía si el store cargaba tarde

Todo el arrastre se leía en el **primer render**, y los stores cargan después. Al abrir la pantalla
por URL o al refrescar, la cotización y la orden salían en blanco. Es el mismo fallo que apareció
hoy con los permisos del Reporte Cruzado: **un valor que depende de datos asíncronos no puede vivir
solo en `useState(inicial)`**. Ahora se aplica en un efecto, una vez por origen, así que no pisa lo
que el comprador edite después.

De regalo, dos cosas que estaban rotas y el compilador ya venía avisando:

- La ruta se guardaba con `window.location.pathname` **sin la query**, así que al recargar se perdían
  `?req=` y `?cot=`.
- La orden leía `cotizacion.condiciones`, campo que no existe: es `terminos`. Las condiciones
  negociadas nunca se heredaban.

Verificado con el requerimiento real de Richard y una cuenta con su mismo rol: por el botón y por el
selector la cotización llega con el item, 2 unidades a S/ 78,660, subtotal S/ 157,320 — igual que el
estimado del requerimiento. La orden creada desde esa cotización hereda proveedor, item y totales
incluso abriéndola por URL. La cotización de prueba (COT-0041) y la cuenta temporal se eliminaron.

---

## 2026-09-10 — El menú enseñaba todos los módulos antes de saber cuáles tocan

Kevin lo vio con todos los usuarios que no tienen acceso completo: al entrar aparecía el menú
entero, luego se quedaba con lo correcto, y **de rato en rato volvía a aparecer entero por menos de
un segundo**. Dos causas distintas, una por síntoma.

### 1. El sidebar mostraba todo mientras cargaba

Estaba escrito así a propósito, con este comentario: *"Mientras cargan los permisos no se oculta
nada, para no hacer parpadear el menú en cada refresco."* El razonamiento está al revés — enseñar
todo y quitarlo **es** el parpadeo, y además le anuncia a cada persona módulos que no puede abrir.

Ahora mientras no se sabe se pinta un **esqueleto** (barras grises). Ni miente ni parece roto.

### 2. 39 componentes, 39 consultas, 39 "cargando"

`usePermissions()` era un hook con estado propio y lo llaman **39 componentes**. Cada uno lanzaba su
consulta a `usuarios_roles` y arrancaba en `loading: true`. Peor: el efecto dependía del objeto
`profile`, que AuthProvider **vuelve a crear en cada refresco de token**. Un objeto nuevo con los
mismos datos bastaba para mandarlos a todos a "cargando" a la vez — el parpadeo intermitente que
Kevin veía ya trabajando.

El resultado pasa a un **estado compartido fuera de React** (`useSyncExternalStore`), con la clave
armada **por valor**: usuario + tenant + rol del perfil. La API del hook no cambió, así que los 39
llamadores siguen igual.

La regla que deja esto, y que ya había mordido dos veces ayer (permisos del Reporte Cruzado, prefill
de cotizaciones): **lo que depende de una carga asíncrona no puede identificarse por la identidad
del objeto ni resolverse en el primer render.**

### Medido, no supuesto

En la pantalla de órdenes con un rol de Compras:

| | Antes | Ahora |
|---|---|---|
| Consultas de permisos por carga | 5 | 1 |
| Módulos ajenos vistos (187 muestras cada 50 ms durante el login) | todos | 0 |
| Módulos ajenos al recargar ya dentro | sí | 0 |

También se recorrieron seis pantallas dentro de la sesión: **cero** consultas nuevas y cero
apariciones de módulos ajenos.

---

## 2026-09-10 (II) — Barrido: dónde más se le mencionan módulos ajenos al usuario

Tras arreglar el parpadeo del menú, Kevin pidió revisar si había más casos del mismo tipo. Los hay:
**tres**, y salían todos de la misma causa — cada pantalla contestaba por su cuenta a "qué módulos
tiene este usuario", y no coincidían.

### 1. El tutorial de bienvenida (el que Kevin reportó)

Estaba escrito a mano: *"Flota, Biomédico, Compras, Inventario, Finanzas y más"*, con una rejilla
fija de seis módulos. A quien solo tiene Compras eso no le describe su sistema, le describe uno
ajeno y le manda a buscar menús que no va a encontrar.

Ahora se arma con sus módulos: *"Tu acceso incluye los módulos de Compras, Proveedores y BI &
Reportería"*, la rejilla lista esos, y el paso del menú dice "los módulos a los que tienes acceso"
en vez de "todos los módulos del sistema". No se abre hasta saber cuáles son — si no, diría "sin
asignar".

### 2. El buscador de la barra superior

Consultaba **siete tablas para todo el mundo**: órdenes de trabajo, vehículos, proyectos, clientes,
artículos, proveedores y órdenes de compra. A un rol de Compras le devolvía placas de vehículos,
nombres de clientes y códigos de artículos — y enlaces que al pulsarlos contestaban "no tienes
acceso". El dato ya se había enseñado en el propio resultado.

Cada fuente declara ahora a qué pantalla lleva (`busqueda-global.ts`) y solo se consulta si el
usuario puede abrirla. No se filtra el resultado: no se llega a pedir. Verificado en vivo — con el
rol de Compras se consultan **dos** tablas, no siete.

### 3. Las notificaciones

`notificaciones` no tiene destinatario: es por tenant y la ve todo el mundo. A Compras le llegaba
*"Aprobación requerida: GCC-2026-001"* (un gasto de caja chica) y el *"Resumen de vencimientos"* de
flota y biomédico. Se filtran por el módulo del aviso (`RUTA_DE_ENTIDAD`). Un tipo de aviso
desconocido **se muestra**: lo que no se puede clasificar suele ser general, y callarlo es peor.

Y de paso una consecuencia operativa que nadie había notado: **"marcar todas leídas" marcaba por
tenant**. Quien no ve caja chica le borraba a Carolina avisos que ella todavía no había leído. Ahora
marca solo los que el usuario ve.

### Lo que queda para no repetirlo

`src/lib/rbac/modulos-visibles.ts` — **una sola respuesta** a "qué módulos ve este usuario"
(el tenant lo tiene encendido **y** el usuario tiene permiso). Lo usan el tutorial y, con el mismo
criterio, el menú, el buscador y las notificaciones.

### Revisado y correcto

Home (`useResumenHome`), Dashboard, los formularios de requerimiento y proveedor: ya consultaban
permisos antes de mostrar o de pedir. No se tocaron.

---

## 2026-09-10 (III) — Revisión de accesos de Carolina y Miguelangel

### Lo que ve cada uno

| | Roles | Módulos en el menú |
|---|---|---|
| Carolina (cokamura) | Administración + Fianzas | Compras, Fianzas, Finanzas, BI |
| Miguelangel (mcastaneda) | Proyectos + Técnico Flota | Compras, **Finanzas**, Proyectos, Flota, BI |

Carolina cuadra con su trabajo. **Miguelangel tiene Finanzas** (`ver`, `exportar`): transacciones,
presupuestos, cuentas por pagar, **caja chica** (41 cajas, S/ 321,633 asignado), flujo de caja y
reportes — y puede exportarlo todo. No lo necesita: el financiero por proyecto vive en el módulo
Proyectos y no pide `finanzas.ver`. **Pendiente de decisión de Kevin.**

### El hallazgo de fondo: `ver` valía por `crear`

Miguelangel tiene la caja chica en **lectura** y aun así podía **abrir cajas, registrar gastos e
ingresos y cerrar una caja**. Los botones solo comprobaban que la caja no estuviera cerrada. Los
permisos `crear` / `editar` / `eliminar` estaban configurados en los roles y **la interfaz no los
consultaba en ninguna parte**.

No es exclusivo de Finanzas: el barrido encontró ~30 pantallas que muestran botones de alta y edición
sin comprobar nada. Hoy pasa desapercibido porque casi todos los roles llevan `ver` y `crear` juntos.
Los que NO, y por tanto están expuestos:

| Rol | Persona | Módulos en solo lectura por diseño |
|---|---|---|
| Proyectos | Miguelangel | finanzas |
| Contabilidad | Walter | compras, finanzas, proveedores |
| Gerencia | Guillermo, William, Miguel Z., consultor | biomédico, contabilidad, CRM, fianzas, inventario, proveedores, proyectos |

**Se cerró Finanzas** (es dinero y está en uso): caja chica, transacciones y presupuestos. Exportar
se mantiene — es lectura y la tienen. El resto de módulos queda pendiente de decisión.

### Otros dos puntos para Kevin

- Carolina tiene `compras.aprobar`. **No** puede firmar órdenes (verificado: "Tu rol no firma en
  este circuito"), pero sí **aprueba requerimientos y cotizaciones** y puede **Rechazar** una orden
  que está esperando las tres firmas. Ella no está en el circuito comprador → operaciones → gerencia.
- El rol Fianzas incluye `eliminar` (Carolina y Sandra pueden borrar cartas fianza).

### Decisiones de Kevin y lo que se hizo (10/09)

1. **Miguelangel pierde Finanzas.** Se quitó del rol Proyectos. Sigue viendo el financiero por
   proyecto dentro de Proyectos, que es lo que necesita.
2. **Carolina se queda como está**: mantiene `compras.aprobar` (requerimientos, cotizaciones y el
   rechazo de órdenes). No firma en el circuito y eso no cambia.
3. **Se cierra `crear` / `editar` / `eliminar` en todo el sistema.**

#### Cómo quedó el control de acciones

Dos capas, porque una sola no basta:

- **La ruta.** Cualquier pantalla que termina en `/nuevo` exige `crear` del módulo, no `ver`. Vive en
  `rutas.ts`, así que cubre también las rutas que nadie se acuerde de proteger. Recepciones conserva
  su excepción: la da quien recepciona, aunque no tenga el resto de Compras.
- **Los botones.** Envueltos en `PermissionGuard` —que existía en el repositorio **sin usar**— los de
  alta, edición y borrado de contabilidad, CRM, inventario, biomédico, proyectos y flota. Compras,
  Proveedores y Fianzas ya estaban bien: son los módulos revisados hace poco.

Verificado con los roles reales, no con supuestos:

| Rol de prueba | Resultado |
|---|---|
| Gerencia (6 módulos en lectura) | Cero botones de escritura en los seis; `/crm/clientes/nuevo`, `/contabilidad/asientos/nuevo`, `/flota/vehiculos/nuevo` y `/proveedores/directorio/nuevo` responden "no tienes acceso" |
| Compras + Técnico Flota + Proyectos | Todos los botones y todos los formularios de alta siguen accesibles |
| Administración + Fianzas (Carolina) | Los cuatro botones de caja chica intactos |

35 archivos, 146 pruebas en verde, build limpio, y el mismo número de errores de tipos que antes.

---

## 2026-09-10 (IV) — Accesos de Walter y adjunto de la cotización

### Walter está bien

| Módulo | Lo que puede |
|---|---|
| Contabilidad | crear, editar, exportar, ver (su módulo) |
| Compras, Finanzas, Proveedores | **solo lectura** |

Verificado en vivo con su rol: en Compras, Proveedores, Caja Chica y Transacciones no le queda un
botón de escritura; en Contabilidad crea asientos y comprobantes. `/admin/usuarios`, `/bi/gerencia`,
`/flota`, `/proyectos` y las rutas `/nuevo` de los módulos ajenos le responden "no tienes acceso".

Que vea compras, proveedores y caja chica en lectura **es correcto para un contador**: son los
documentos que tiene que asentar. No hay nada fuera de sitio.

### El documento de la cotización

Faltaba, sencillamente: el ERP guardaba los importes de la cotización pero no el papel del proveedor,
que seguía viviendo en un correo o un WhatsApp.

En el detalle de la cotización, **encima de los items** (es la fuente de lo que va debajo), aparece
"Documento de la Cotización": adjuntar, abrir, descargar y quitar. Admite varios archivos — el
proveedor suele mandar la propuesta y aparte la ficha técnica. Acepta PDF, foto, Excel y Word, hasta
10 MB.

Cuatro decisiones que no se ven:

- **Nunca se guarda una URL.** El bucket es privado y se pide una firmada de cinco minutos al abrir.
  Una URL guardada en la base sería un enlace público y permanente a un documento de la empresa.
- **Si falla el registro en la base, se borra el archivo del bucket.** Es justo lo que no se hizo en
  facturas-proveedores, donde quedó el XML huérfano `F001-00099001.xml`.
- **El nombre se limpia para la ruta** (tildes, `°`, paréntesis) pero se guarda y se muestra el
  original: "Cotización N° 18 (final).pdf" se ve así y se almacena como
  `...-Cotizacion-N-18-final-.pdf`.
- **Adjuntar y quitar piden permiso de Compras; ver y descargar bastan con `ver`.** Walter ve el
  documento y se lo lleva, no lo cambia.

Migración `cotizacion_archivos`: tabla, bucket y políticas de Storage por permiso, apoyadas en
`auth_tiene_permiso()` — la función que ya existía para los cargos de fianzas.

Probado de punta a punta: subida (con nombre acentuado), URL firmada que devuelve el PDF, lectura
con el rol de Walter sin botones de escritura, y borrado que deja la tabla **y** el bucket en cero.

**Queda por decidir:** hoy se adjunta desde el detalle, después de crear la cotización. Si Compras
prefiere adjuntarlo dentro del formulario de alta, es un añadido pequeño.

---

## 2026-09-10 (V) — Adjunto en el alta y sincronización de RESUMEN PROYECTOS

### Adjuntar también al crear la cotización

Compras recibe el PDF y crea la cotización **a partir de él**, así que pedir "guarda primero y
adjunta después" sobraba un paso. Los archivos elegidos se guardan en el formulario y se suben en
cuanto la cotización existe.

Si la cotización se guarda y un adjunto falla, se dice **cuál** y se recuerda que la cotización sí
quedó: se adjunta desde su pantalla. Nunca se pierde el trabajo por culpa de un archivo. En edición
se muestra el panel de siempre, que ya trabaja contra una cotización existente.

Probado: dos PDFs adjuntados en el alta, ambos guardados con la cotización; prueba borrada después.

### RESUMEN PROYECTOS.xlsx (OPERACIONES2)

Fuente: `sites/OPERACIONES2/Documentos compartidos/OPERACIONES TEAM/RESUMEN PROYECTOS.xlsx`.

**Las cifras del ERP ya estaban al día** — inversión, valor modificado, cobrado, presupuesto y
situación coincidían al céntimo en los 7 proyectos en ejecución. Lo que faltaba era lo demás.

#### Una trampa del archivo, y por qué no se cayó en ella

La hoja **STATUS DE PROYECTOS** daba a AMAZONAS S/ 11.7 M cobrados y a HIDROAMBULANCIAS S/ 2.3 M.
Es falso: son **valores cacheados de fórmulas sin recalcular**. Sus hojas dicen `MONTO COBRADO = 0`
en ambos casos. Se notó porque el saldo no cuadraba con `modificado − cobrado` justo en esas dos
filas, y solo en esas. **Nunca se toma un número de la hoja resumen: se toma de la hoja del
proyecto**, que es donde Operaciones escribe.

#### Qué se actualizó

- **Items entregados**: estaban en **0 para los 7 proyectos**. Ahora salen del estatus real:
  7/6, 2/1, 6/4, 9/2, 7/6, 6/5, 2/0. El criterio es `estatus = CULMINADA`, el mismo que usa el
  propio Excel para calcular ITEMS PENDIENTES — y con él la resta cuadra en las siete hojas. La
  columna "E" de entregado está desfasada (LORETO tiene 8 marcadas y solo 2 culminadas).
- **Número de items**: SERENAZGO 6→7, LORETO 12→9. El bloque es siempre el rango 3:11, según las
  propias fórmulas de la hoja.
- **Comentarios de Operaciones**: los 6 bullets de cada proyecto (entregas, recepción,
  inmatriculaciones, valorizaciones, CIPRL, otros), más suspensiones con fechas y días, guardados en
  `datos_raw`.
- **Responsables**: estaban vacíos en 5 de 7, y **AMAZONAS decía "Miguel Angel" cuando es Gabriela**.
  Ahora: Lisbet, Nicolás, Miguelangel, Nicolás, Gabriela, Lisbet, Gabriela.
- **Proyectos en cartera**, que figuraban en cero: SAN MARTÍN MÓVIL SALUD S/ 61,211,400;
  LORETO MÓVIL SALUD S/ 284,094,738; SAN MARTÍN BOMBEROS S/ 40,185,642.20.
- **Se borraron 8 filas duplicadas** de un sync del 08/06 con cifras redondeadas de una versión
  anterior de la hoja, más una fila "MASTER" que no es un proyecto. Compartían CIU con las buenas y
  la lista de proyectos indexa por CIU: **cuál se leía dependía del orden de las filas**.

Validación: la extracción reproduce exactamente los importes de valorizaciones del sync anterior
(7,547,696.56 / 35,888,370.21 / 6,941,500 / 16,543,724.49 / 12,187,282.93 / 10,884,569 / 0), y las
siete filas cuadran contra `proyectos` en inversión, modificado, cobrado, presupuesto y responsable.

**No se tocó** `modalidad`: el ERP dice OxI para todos y el Excel dice IOARR salvo AMAZONAS, pero son
taxonomías distintas (IOARR es tipo de inversión, OxI es la modalidad de financiamiento). El tipo del
Excel queda en `proyectos_excel_sync.tipo`.

---

## 2026-09-10 (VI) — Tipo de inversión a la vista y el alta de proveedor

### Tipo de inversión (IOARR / OxI)

Sale del Excel de Operaciones (`proyectos_excel_sync.tipo`) y se muestra como etiqueta junto al
código en cada tarjeta de proyecto, y como columna en el Excel que exporta la lista. En producción:
6 IOARR y 1 OxI (Amazonas), igual que el archivo.

No se tocó `modalidad`: son taxonomías distintas — IOARR es el tipo de inversión bajo Invierte.pe,
OxI es cómo se financia.

### Richard no podía guardar

El error de la consola **no era de órdenes**: era del alta de proveedor. Estaba dando de alta a
Kaycol para poder emitir la orden.

`Could not find the 'observaciones' column of 'proveedores'` — el formulario enviaba esa columna y
no existía. PostgREST respondía 400 y no se guardaba nada.

Al mirarlo aparecieron **otras dos pérdidas silenciosas en la misma pantalla**, peores que el fallo
visible porque nadie las nota:

- **El "Contacto Principal" no se guardaba.** Es obligatorio en el formulario —Richard escribió Omar
  Vasquez, gerente general, con su correo y teléfono— y no iba a ninguna parte. El código lo decía:
  *"Contacto principal — no almacenado en DB todavía"*. Ahora usa la columna `contacto`, que ya traía
  el nombre de 114 proveedores migrados, más tres columnas nuevas para cargo, email y teléfono.
- **De varias cuentas bancarias solo se guardaba la primera**, aunque la pantalla deje agregar más.
  Ahora van todas a `cuentas_bancarias`, con las mismas claves que trajo la migración.

Y en sentido contrario: **al editar solo se leían las columnas planas** `banco`/`cuenta_bancaria`,
que tienen **6 proveedores de 136**. A los otros 114 les salía la sección de cuentas vacía aunque las
tuvieran en el jsonb — y si guardaban, se quedaban sin ellas.

Verificado con el rol de Richard: se creó un proveedor con contacto completo y dos cuentas, las dos
quedaron en la base; al editar Master Tires (migrado) aparecen sus dos cuentas y el contacto de la
notaría PROV-0101 sale con su nombre. Proveedor de prueba eliminado — siguen 136.

Migración: `proveedores_observaciones_y_contacto`.

---

## 2026-09-10 (VII) — El circuito de la cotización, de rechazada a orden

### ¿Se envía algo al proveedor? No

Ninguna función de correo está conectada a cotizaciones. El estado se llamaba "Enviada" y el mensaje
decía "enviada al proveedor" por el **diseño original**: mandar una solicitud de cotización. En
Memphis pasa al revés — el proveedor manda su cotización y Compras la registra.

El estado pasa a llamarse **"En revisión"** y el botón **"Guardar y Enviar a revisión"**, que es lo
que de verdad ocurre: queda a la espera de que Gerencia la apruebe o la rechace. Solo el texto
mentía; el comportamiento no cambia.

### Por qué la cotización de Richard no avanzaba

Cinco cosas, encadenadas:

1. **`rechazada` era un callejón sin salida.** La máquina de estados no permitía volver a
   presentarla. Richard la corrigió, le dio a enviar… y el cambio **se rechazaba en silencio**
   porque nadie miraba el resultado de `cambiarEstado`. La pantalla anunciaba el envío y la
   cotización se quedaba en "rechazada". No era un problema de refresco: el estado nunca cambió.
   Ahora `rechazada → enviada` está permitido, y si una transición falla se dice **en qué estado
   quedó**.
2. **Editar era imposible.** El formulario no cargaba `proveedorId` ni `centroCostoId`, así que los
   selectores salían vacíos y la validación bloqueaba el guardado pidiendo *"el centro de costo es
   obligatorio"* — uno que la cotización ya tenía.
3. **Al guardar no se enviaban** proveedor, centro de costo ni régimen de IGV. Se guardaban los
   importes y lo demás se quedaba como estaba, sin avisar.
4. **El IGV se recalculaba siempre al 18%** al editar, ignorando el régimen: una cotización
   exonerada de Amazonía salía con IGV.
5. La lista tampoco reflejaba los campos que sí se guardaban, porque el parche en memoria solo
   tocaba moneda, validez, condiciones, observaciones e items.

### El paso a la orden

- **"Generar Orden"** estaba solo al fondo, dentro de "Órdenes Asociadas". Ahora está también en la
  cabecera, junto a Aprobar/Rechazar/Editar. Sigue apareciendo solo con la cotización **aprobada**,
  que es lo correcto.
- **La cotización de origen en la orden era un campo de TEXTO LIBRE** con el marcador "COT-0001":
  había que acordarse del número, y escribir uno inexistente dejaba la orden sin cotización real.
  Pasa a ser un selector de cotizaciones aprobadas, y al elegir una se arrastran proveedor, items y
  condiciones — antes eso solo pasaba entrando desde la cotización.

### Verificado de punta a punta

Cotización creada → rechazada con motivo → corregida (precio 78,660 → 75,000) → **de vuelta a
revisión sin refrescar** → aprobada → "Generar Orden" en la cabecera → orden con la cotización
elegida del selector, proveedor e items heredados y total S/ 177,000. Cotización de prueba y cuenta
QA eliminadas.

### Un dato que salió de paso

`cotizaciones` **no tiene columna `tipo`**: bienes/servicios no se guarda, se asume 'bienes' al leer.
La distinción OC/OS de la cotización no viaja a la base. No se tocó — es una decisión de Operaciones
si hace falta.

---

## 2026-09-10 (VIII) — Bienes/servicios, exportaciones… y los catálogos que solo veía Kevin

### Bienes o servicios en la cotización

El formulario ya lo preguntaba, pero `cotizaciones` no tenía columna `tipo`: al leer se asumía
'bienes' para todo. De ahí sale además si la orden es **OC u OS**, así que la elección se perdía
justo antes de servir para algo. Ya se guarda; verificado de punta a punta: una cotización de
servicios propone **Orden de Servicio (OS)**.

Las 226 migradas se quedan en 'bienes', que es lo que el ERP venía asumiendo — nada cambia de lo que
ya se veía. Se corregirán al editarlas.

Migración: `cotizaciones_tipo_bienes_servicios`.

### Exportar centros de costo y catálogos

- **Centros de costo** (79): llevan el **proyecto** al que cuelgan y si son de proyecto o de área.
  Eso es lo que Operaciones va a revisar, y la pantalla ni siquiera lo mostraba. De paso el listado
  deja ver dos pares que apuntan al mismo proyecto: `GLOREBOMBE`/`GLORETOBOM` a LORETO - BOMBEROS, y
  `GICAPATRUL`/`GOREICAPNP` a ICA - PNP.
- **Catálogos** (133): se exportan **todos de golpe**, con el nombre del catálogo como primera
  columna. De uno en uno saldrían veinte archivos y no habría cómo revisarlos.

### Lo gordo que apareció haciendo la exportación

La exportación de catálogos daba **104 filas cuando la empresa tiene 133**. La causa:

**`catalogos` era la ÚNICA tabla del sistema cuyas políticas resolvían el tenant con la tabla
`memberships`**, en vez de `auth_tenant_id()` como las otras. Y en `memberships` **solo está Kevin**.

Para Richard, Carolina, Walter y el resto la consulta devolvía **cero filas**, y el store lo
interpretaba como "la tabla está vacía" y caía a los **valores por defecto del código**. Es decir:

- Los bancos, condiciones de pago, unidades y lugares de entrega que la empresa configuró eran
  **invisibles para todos menos Kevin**.
- Lo que ellos agregaban desde su pantalla **desaparecía al recargar**.

No se notaba porque los valores por defecto son razonables: parecía correcto, solo que no era lo que
la empresa había configurado. Las políticas ahora usan `auth_tenant_id()`, como el resto.

Migración: `catalogos_rls_como_el_resto`.

---

## 2026-09-10 (IX) — "No me deja registrar el gasto" (CAJA 25 SOLES)

### Carolina tenía razón: es el monto

CAJA 25 SOLES tiene **S/ 892.56** disponibles y ella quería registrar **S/ 1,000**. La regla existe y
vive en el frontend (`addGasto`, `finanzas-store`): no se registra un gasto mayor al saldo.

Lo reproduje con su rol exacto: sale **"Error al registrar gasto"** y nada más.

### Por qué no se entendía

El error que lanza el store dice exactamente lo que pasa —*"Saldo insuficiente en caja CAJA 25
SOLES. Disponible: 892.56, Gasto: 1000.00"*— pero el manejador lo tiraba a la basura:

```js
} catch { toast.error('Error al registrar gasto'); }
```

Un `catch` sin variable. Ni siquiera llegaba a la consola, por eso Kevin tampoco encontró nada al
mirar. El registro de **ingresos**, en esta misma pantalla, ya lo hacía bien: pasa el mensaje como
`description` del aviso. El de gastos era el único que se lo comía.

### Qué se cambió (la regla no se tocó)

- El motivo se muestra, con cifras.
- El **saldo se ve antes de teclear**, debajo del campo de monto: *"Disponible en la caja:
  S/ 892.56"*. Al pasarse cambia a rojo y dice la salida: *"Supera el saldo de la caja (S/ 892.56).
  Registra primero un ingreso."*

### Lo que hay que decidir

La regla **solo está en el frontend**. En la base no hay nada que lo impida: ni restricción ni
disparador. De hecho **ya hay cajas en negativo** —el total de SOLES marca S/ -7,235.13— porque las
cargas masivas desde Excel no pasan por esa validación.

Así que hoy: por pantalla no se puede pasar del saldo, por carga sí. Si la regla es de verdad, debe
estar en la base; si la caja puede quedar en descubierto mientras llega la reposición, sobra en el
frontend. Pendiente de Kevin.

---

## 2026-09-10 (X) — La caja puede quedar en descubierto, pero a propósito

Carolina confirma que **sí debe poder registrar el gasto aunque no haya saldo**: el dinero se gasta
antes de que llegue la reposición, y si no se puede anotar, el gasto se queda fuera del sistema —
que es peor que una caja en negativo.

**La regla no se quitó.** Deja de ser un muro y pasa a ser un aviso que hay que aceptar a propósito:

1. Al teclear un monto mayor al saldo, el formulario avisa bajo el campo: *"Supera el saldo
   (S/ 892.56): la caja quedará en descubierto. Se pedirá confirmación."*
2. Al registrar se pregunta con las cifras — disponible, gasto y **con cuánto queda la caja**.
   Cancelar no registra nada.
3. Al confirmar, el aviso de éxito dice en cuánto quedó y que está **pendiente de reposición**.
4. En el listado, una caja en descubierto se marca como tal, en vez de pintarse como "gastada al
   80%" — que es otra cosa.

El permiso viaja **explícito** hasta el store (`addGasto(..., { permitirDescubierto })`). Así el
descubierto es siempre una decisión de quien registra, y no el efecto de haber borrado una
validación: si mañana alguien llama a `addGasto` sin la opción, la regla sigue en pie.

Verificado con el rol de Administración sobre el caso real (S/ 1,000 en CAJA 25 SOLES con S/ 892.56):
cancelar no registró nada; confirmar dejó la caja en **S/ -107.44** y el listado la marcó "en
descubierto". Gasto de prueba eliminado — la caja vuelve a 22 gastos y S/ 892.56.

### Sigue pendiente

Las cajas que ya estaban en negativo por las cargas desde Excel (el total de SOLES marca
**S/ -7,235.13**) no se han revisado. Ahora que el descubierto es legítimo, conviene mirar cuáles
esperan reposición de verdad y cuáles son un error de carga.

---

## 2026-09-10 (XI) — Observaciones en la orden

Richard no tenía dónde escribir las instrucciones para el proveedor al generar la orden.

Lo llamativo: **todo lo demás ya existía**. La columna `observaciones` está en `ordenes_compra`,
**730 de las 1,316 órdenes migradas de oc-system la traen**, y el PDF ya la imprimía bajo
CONDICIONES. Lo único que faltaba era el campo para escribirla — y al crear la orden el código
mandaba `observaciones: null` fijo.

Resultado: las órdenes viejas tenían observaciones que nadie podía ver en pantalla, y las nuevas
nacían sin poder tenerlas.

- Campo **"Observaciones / Detalles"** en el formulario, junto a las condiciones, con la nota de que
  sale impreso en el PDF.
- Se guarda al crear y al editar. Si la cotización trae observaciones, se heredan como punto de
  partida — es lo que el proveedor ya había puesto por escrito.
- El **detalle de la orden** las muestra en su propia tarjeta: hasta ahora las 730 migradas solo se
  veían imprimiendo el PDF.

Probado de punta a punta con el rol de Compras: escritas al generar la orden, guardadas con sus
saltos de línea, visibles en el detalle y presentes en el PDF junto a las tres firmas.

**Cuidado tomado:** la cotización COT-0041 que estaba aprobada es la **real de Richard** (VENTYHOME,
S/ 157,320.01, creada hoy 16:41). No se tocó — la prueba se hizo con una cotización propia
(`QA-OBS-TEST`), y tanto ella como la orden generada se eliminaron después.

---

## 2026-09-10 (XII) — William entra con alcance acotado

Kevin entró con el usuario de William y vio de más. Lo que debe tener: **Compras, Fianzas, Proyectos
y Flota**, sin Administración; **solo aprueba órdenes** bajo el flujo de montos actual; y **solo se
le avisa cuando se requiere su aprobación**.

### Por qué un rol nuevo y no recortar Gerencia

El rol **"Gerencia" lo comparten cuatro personas**: Guillermo, Miguel Zegarra, el consultor y
William. Recortarlo se lo habría recortado a todos — Guillermo se habría quedado sin Finanzas,
Contabilidad y el resto.

William pasa a **"Gerencia Operativa"**: ver y exportar en sus cuatro módulos, y `aprobar` solo en
Compras. Cuando asuma el alcance completo de Guillermo se le devuelve el rol Gerencia, y este queda
para el siguiente que entre con el mismo recorte.

**Detalle que había que atender:** el circuito de firmas resuelve quién firma **por nombre de rol**
(`flujo_aprobacion.rolesPorEtapa`). Con un rol nuevo, William no habría podido firmar nada. Se añadió
"Gerencia Operativa" a la etapa `gerencia`, junto a "Gerencia".

### Las notificaciones

`roles.solo_notifica_aprobaciones`, una marca del **puesto**, no de la persona: quien entre con ese
rol hereda la misma tranquilidad.

A quien tenga **solo** roles con esa marca le llegan únicamente las solicitudes de aprobación, y solo
de los módulos donde de verdad **aprueba** — ver Flota no basta para recibir avisos de OTs. Es "solo"
y no "alguno" a propósito: si además tiene un rol normal, ese manda y recibe lo suyo.

### Verificado con su rol

| | |
|---|---|
| Menú | Inicio, Dashboard, Compras, Fianzas, Proyectos, Flota, BI |
| Por URL | `/admin`, `/admin/usuarios`, `/finanzas/caja-chica`, `/contabilidad/asientos` y `/proveedores/directorio` → **bloqueados** |
| Campanita | Solo *"Aprobacion requerida: MM-001253"*. Sin resumen de vencimientos, sin caja chica |
| Firma | En MM-001240 le sale **"Te toca firmar como Gerencia"** |

No se firmó nada en la prueba: MM-001240 sigue en `enviada` y sin firmas.

### Dos cosas para Kevin

- **BI & Reportería** le aparece porque cruza módulos que él sí ve; no le enseña nada nuevo (la caja
  chica no le sale, no tiene Finanzas). Si lo quieres fuera, es una línea.
- El aviso de aprobación se crea **uno por orden para todo el tenant**, no uno por aprobador. Así que
  a William le llegará también el de una orden por debajo de S/ 10,000, que solo firman comprador y
  operaciones. Dirigir los avisos a personas es un cambio mayor: queda anotado, no colado.

### Corrección (mismo día): el recorte es del PUESTO, no de William

Kevin aclara que lo pedido va al **rol Gerencia**, no a una persona. Así que el alcance acotado se
aplica al rol y afecta a los cuatro: **Guillermo, Miguel Zegarra, el consultor y William**.

El rol aparte "Gerencia Operativa" se **eliminó** — sobraba. William volvió a Gerencia y el circuito
de firmas vuelve a nombrar solo a `"Gerencia"`.

**No hizo falta tocar código**: el mecanismo (`roles.solo_notifica_aprobaciones` y el filtro de la
campanita) ya estaba hecho; solo cambió a qué rol se aplica. Se ajustaron los comentarios y el
nombre de la prueba, que hablaban de William.

#### Qué pierde Gerencia

De `admin, biomédico, compras, contabilidad, CRM, fianzas, finanzas, flota, inventario, proveedores,
proyectos` pasa a **compras, fianzas, proyectos y flota**. Y deja de aprobar en **finanzas** y en
**flota**: solo firma órdenes.

#### La consecuencia que hay que mirar

**El tablero "Flujo Gerencia" (`/bi/gerencia`) exige `admin.ver`, así que deja de estar a su
alcance.** Era su pantalla —margen por proyecto, rentabilidad y caja de toda la empresa— y ahora les
responde "no tienes acceso".

Es **coherente** con quitarles Finanzas (ese tablero enseña justo la caja que ya no deben ver), pero
es una pérdida real y no la pidió nadie explícitamente. Devolverles `admin: ver` bastaría para
recuperarlo; queda a decisión de Kevin.

#### Verificado con el rol Gerencia

Menú: Compras, Fianzas, Proyectos, Flota (+ Inicio, Dashboard, BI). Bloqueados por URL: `/admin`,
`/bi/gerencia`, `/finanzas/caja-chica`, `/proveedores/directorio`. En la campanita, solo
*"Aprobacion requerida: MM-001253"*. En MM-001240: **"Te toca firmar como Gerencia"**. No se firmó
nada — la orden sigue `enviada` y sin firmas.

---

## 2026-09-10 (XIII) — El proveedor recién creado no aparecía al cotizar

Richard dio de alta **KAYCOL S.A.C.** (PROV-0332) y al ir a cotizar no le salía.

### Un callejón sin salida, no un filtro estricto

Todo proveedor creado desde el ERP nace **`en_evaluacion`**, y el selector de la cotización solo
listaba los `activo`. Hasta ahí sería un control razonable. El problema es que **no había forma de
salir de ese estado**:

- Lo único que mueve `en_evaluacion → activo` es `aprobarProveedor`, detrás del permiso
  **`proveedores.aprobar`** — que existe en la tabla pero **ningún rol lo tiene**.
- El botón "Activar" del detalle no sirve: solo aparece si el proveedor está `inactivo`.
- El directorio además **ocultaba el botón Editar** a los proveedores en evaluación, así que tampoco
  se podía corregir lo recién registrado.

Los 136 proveedores usables lo son porque **llegaron `activo` en la migración de oc-system**. El
único creado dentro del ERP se quedó atascado — por eso nadie lo había notado hasta ahora, con
Compras usando el módulo de verdad.

### Qué se cambió

- El selector de la cotización ofrece **activo + en evaluación**, marcando estos últimos con
  `· en evaluación`. Se siguen excluyendo `inactivo`, `observado` y `bloqueado`: esas sí son
  exclusiones deliberadas.
- El directorio permite **editar** un proveedor en evaluación.
- **KAYCOL S.A.C. quedó activo** para que Richard continúe hoy.

De paso se confirmó que el arreglo de ayer funcionó con su proveedor real: KAYCOL conserva el
contacto (Omar Vasquez) y su cuenta bancaria con CCI.

### Pendiente de decisión

El estado `en_evaluacion` ya no bloquea, pero sigue sin haber **quién apruebe proveedores**:
`proveedores.aprobar` no está en ningún rol. Si Memphis quiere de verdad evaluar proveedores antes
de comprarles, hay que decidir a qué puesto le toca. Si no, conviene que nazcan `activo` y retirar
el estado, en vez de dejar una etiqueta que nadie mueve.

---

## La caja que cierra en rojo también deja herencia (2026-09-11)

Carolina cerró CAJA 25 SOLES con **S/ -125.49** y quiso abrir la siguiente arrastrando esa deuda,
igual que cuando queda saldo a favor. No pudo: la caja anterior no aparecía en la lista.

### Qué lo impedía (dos cosas, y el signo no era ninguna)

El arrastre ya tomaba `monto_disponible` **con su signo**, así que un negativo viajaba bien. Lo que
fallaba era el camino hasta ahí:

1. `fn_abrir_caja_chica` exigía que la caja de origen estuviera **abierta** (`La caja % ya está
   cerrada`), y la interfaz filtraba las cerradas. Carolina cerró primero, como se debe hacer, y con
   eso la caja desapareció de las opciones.
2. El guardián `if arrastre + adicional <= 0 then raise 'La caja nueva quedaría en cero'` rechazaba
   abrir arrastrando solo deuda.

Y el movimiento se llamaba siempre "SALDO A FAVOR DE CAJA CHICA ANTERIOR", que con un negativo es
justo lo contrario de lo que pasó.

### Qué se cambió

Migración `caja_chica_arrastra_tambien_la_deuda`:

- Se acepta una caja de origen **cerrada**, siempre que su saldo no se haya cedido ya (se comprueba
  con un `ingresos_caja_chica` de tipo `saldo_anterior` que la nombre como origen). Los nombres de
  caja son únicos: 41 de 41.
- Solo se rechaza cuando **no hay nada que mover**: `arrastre = 0 y depósito = 0`.
- El movimiento se llama por lo que es: `DEUDA DE CAJA CHICA ANTERIOR (…)` o `SALDO A FAVOR…`.
- La caja de origen se cierra solo si aún estaba abierta.

En la interfaz (`FinanzasCajaChica.tsx`): la lista de origen ofrece las abiertas y **la última
cerrada con saldo pendiente de arrastrar** —no las 23 del histórico migrado, que invitaban a
arrastrar por error una deuda de hace meses—; la etiqueta distingue "deuda" de "saldo"; el resumen
enseña la deuda en rojo y avisa "La caja nueva nace en descubierto" cuando la deuda supera al
depósito.

### Comprobado

Abriendo desde CAJA 25 SOLES con S/ 5,000 de depósito: la caja nueva nació con **S/ 4,874.51**, su
primer movimiento fue `DEUDA DE CAJA CHICA ANTERIOR (CAJA 25 SOLES)` por **-125.49**, CAJA 25 quedó
intacta y ya no se ofrece por segunda vez. La caja de prueba se borró.

### Pendiente

Hay cajas antiguas que cerraron en rojo y nunca se arrastraron (CAJA 14: S/ -3,974.63; CAJA 15:
S/ -3,259.77; CAJA 21: S/ -2,004.32; el total SOLES es S/ -8,253.18). Vienen de la carga del Excel y
habría que revisar cuáles esperan reposición y cuáles son errores de carga. Mientras no se revisen,
la lista de origen solo ofrece la última, así que no estorban.

---

## Lote de once puntos (2026-09-16)

Kevin trajo once anotaciones de una vez. Ocho quedaron cerradas, dos necesitan
una decisión suya y una está bloqueada porque no encuentro la carpeta.

### 1. Revisión de órdenes de Operaciones — HECHO

Operaciones repasó las 1.097 órdenes migradas (`OCs_por_proyecto_revision.xlsx`,
sitio TI) y anotó orden por orden. Se llevaron sus 52 decisiones al ERP: 16
anulaciones, 7 duplicados de migración y 10 reasignaciones de proyecto.

Los duplicados **no se borraron**, se anularon con el motivo escrito. El efecto
sobre las cifras es el mismo y queda rastro. Borrarlos de verdad es decisión de
Kevin.

**Después del cambio, los ocho proyectos cuadran al céntimo con su archivo.** Lo
único que difiere es, en cada proyecto, exactamente el importe de las órdenes
emitidas después del 19/06/2026 — la fecha de corte del archivo.

Aviso: el conector de SharePoint truncó la lectura en la fila 1.055 de 1.097. Las
42 que faltan son todas "(SIN PROYECTO)" y suman S/ 319 mil en órdenes pequeñas,
así que no afectan a ningún proyecto. Si se quieren revisar, hace falta el
archivo en CSV.

### 2. Requerimientos sin aprobación — HECHO

Pedir algo no es comprarlo. La pantalla queda abierta a cualquiera con cuenta;
quien no tiene `compras.ver` solo ve y abre **los suyos**. Fuera Aprobar y
Rechazar. La generación de cotizaciones sigue pidiendo `compras.crear`.

De paso se arregló un fallo vivo: el mapa de transiciones hablaba de estados
inexistentes y no incluía `enviado`, así que editar un borrador y darle a
"Guardar y Enviar" fallaba y lo dejaba en borrador.

### 3. Mantenimientos de flota: los tarifarios — HECHO

Un **tarifario** es una cotización que se aprueba una vez y de la que salen
tantas órdenes como haga falta, con fecha opcional de vigencia. Se marca en el
formulario de cotización y sale agrupado y rotulado en el selector de la orden.

De paso, las cotizaciones normales que ya tienen orden desaparecen del selector:
antes se ofrecían siempre, que es una invitación a duplicar.

Técnico Flota (José Ramírez, Miguelangel) recibió `compras.ver/crear/editar`. **El
RBAC no distingue "orden de mantenimiento" de "orden cualquiera"**: con esos
permisos pueden generar cualquiera. El gasto sigue controlado por el flujo de
montos.

### 4. Módulo de documentación de Shirley — BLOQUEADO

No se localiza la carpeta: el enlace es un token de compartir que el conector no
resuelve, y buscándola por nombre en COMPRAS no aparece. Hace falta la ruta.
Ver [ANALISIS-Flujo-Financiero-y-Documentos.md](ANALISIS-Flujo-Financiero-y-Documentos.md).

### 5. Dashboard de compras y recuadros — HECHO

`/compras` no era un tablero: montaba, redirigía a Requerimientos y enseñaba un
spinner; por eso "se rompía". Ahora cuenta dónde está parado cada trámite.

Los cuatro recuadros de Órdenes se calculaban siempre sobre las 1.321: filtrar
por proyecto no movía un número. Ahora cuentan lo filtrado y dicen debajo sobre
cuántas miden.

### 6. Firmas en las órdenes — HECHO

La firma se copia al aprobar. Quien aprobaba **antes** de registrar su rúbrica
dejaba la aprobación sin imagen y no había forma de arreglarlo. Es lo que les
pasó a Richard y Miguelangel. Se rellenaron las 11 aprobaciones en blanco (solo
las vacías): 1808 de 1808 con firma. Además la rúbrica ahora se ve en pantalla,
no solo en el PDF, y firmar sin rúbrica registrada avisa en el momento.

### 7. Accesos de proveedores en lote — HECHO

Nueva pantalla Proveedores → Accesos al Portal. Se marcan varios, se generan
todos los enlaces y cada uno sale con su correo redactado; "Abrir en correo" abre
Outlook con todo puesto. El envío lo sigue haciendo una persona.

Y se encontró que **el repo tenía rota la Edge Function `portal-proveedor-alta`**
(usaba `linkRes`, variable inexistente). Producción tenía la buena; el siguiente
deploy desde el repo habría tumbado el alta de proveedores.

### 8. El ICA duplicado — HECHO, y eran tres cosas

1. El selector de proyecto escondía los que están **en liquidación**, que es justo
   cuando aterrizan los últimos costos. GORE ICA es el único: no aparecía.
2. El formulario pedía "Proyecto" y **la tabla no tenía dónde guardarlo**. Todo lo
   que Compras elegía ahí se tiraba en silencio. Se añadieron las columnas y se
   rellenaron (252 de 259 con centro de costo, 188 con proyecto).
3. `GOREICAPNP` y `GICAPATRUL` apuntaban al mismo proyecto. Fusionados; sobrevive
   GOREICAPNP renombrado a "GORE ICA - PNP (Patrulleros)".

### 9. La plantilla presupuestal de Antonio — ANALIZADO

Ver [ANALISIS-Presupuesto-Inicial-Proyecto.md](ANALISIS-Presupuesto-Inicial-Proyecto.md).
Lo esencial: el `Cuadro resumen` del archivo **está roto** (31 `#¡REF!`), y el ERP
ya tiene los importes de convenio exactos y el costo real calculable. Hacen falta
tres respuestas de Antonio antes de construir.

### 10. Flujo financiero — ANALIZADO, falta una decisión

Los cinco archivos son dos capas: dos `BD *.xlsx` planas con cabecera idéntica
(importables con un solo lector) y tres `Flujo *.xlsx` que son tablas dinámicas
montadas encima (no hay que importarlas). El canal de sincronización con
SharePoint ya existe y funciona. Falta que Kevin decida si el ERP **refleja** el
Excel o **manda** sobre él.

### 11. Co-autoría en los commits — HECHO

Quitada del commit de caja chica y anotado en memoria que la regla manda aunque
el entorno pida lo contrario.

### Nota: la caja chica en rojo ya está en uso

Carolina abrió CAJA 26 SOLES el 11/09 arrastrando los S/ -125,49 de la CAJA 25 y
lleva gastado. El arreglo funcionó en producción.

### Pendientes que siguen abiertos

- Quién aprueba proveedores: `proveedores.aprobar` no lo tiene ningún rol.
- Las notificaciones se crean una por documento para todo el tenant, no por
  aprobador.
- La RLS es solo por tenant, no por módulo: el gate de módulos es la interfaz.
- Cajas en negativo del histórico migrado (S/ -8.253,18 en soles).
- Las 4 órdenes con IGV sin clasificar y las 15 con totales descuadrados.

### Fianzas: ahora manda el Excel de Shirley (2026-09-16, tarde)

Kevin dio la vuelta a la decisión del 03/09. Antes mandaba el ERP y
`fianzas-excel` reescribía la hoja de SharePoint; ahora **Shirley trabaja su
Excel y el sistema se actualiza** desde él.

- Nueva Edge Function `fianzas-import` (Graph app-only, solo lectura). Botón
  "Traer del Excel de Administración" en Fianzas → Exportar. Si entran cartas
  nuevas, encadena la importación de cargos.
- `fianzas-excel` **queda desactivada y devuelve 409**. No es limpieza: las dos
  direcciones no pueden convivir, y esa función reescribe el rango entero — una
  llamada suelta después de que Shirley editara le borraría el trabajo. La
  implementación que escribía sigue en el commit f4f75019.
- Resultado real: 11 fianzas, 60 cartas (5 nuevas), 63 cargos intactos, cero
  problemas, e idempotente (la segunda pasada no crea nada).

Lo que costó acertar, por si vuelve a tocarse:

- **Los importes vienen en tres formatos** en el mismo archivo: peruano
  (43.900.816,64), americano (2,444,470.39) y con apóstrofo (12´285,032.93), más
  un error de tecleo real ("S/ 97.778.82"). La regla que acierta en todos: manda
  el último separador; una o dos cifras detrás = decimal, tres = millares.
- **El número de carta NO es único.** Shirley lo reutiliza al renovar
  (15411-2407-2025-000 está dos veces). La identidad es número + fecha de inicio.
- **`fin` y `fecha_renovacion` son columnas calculadas** (inicio + plazo − 1 y
  − 6). No se pueden escribir. Coinciden con las fórmulas de Shirley, salvo en
  las filas donde ella las puso a mano: ahí el ERP enseñará su fecha calculada.
- **El porcentaje se guarda como fracción** (0,04), porque la pantalla multiplica
  por cien. Guardar 4 hacía que el tablero pusiera "400%".
- **Un mismo convenio puede estar en dos fianzas del ERP** (001-2025-OXI-GRL
  está como "GORE LORETO BOMBEROS" y como "MAS SEGURIDAD BOMBEROS"). No se
  reagrupa: mover cartas dejaría cargos colgando.
- Nada se borra nunca. Lo que esté en el ERP y ya no figure en el Excel se avisa
  y se queda.

Pendiente menor detectado: hay roles duplicados de OTRO tenant en la tabla
`roles` (Fianzas, Cargos Fianzas). Asignar uno de esos deja al usuario sin
permisos, porque la RLS no los deja leer. Conviene retirarlos o filtrarlos en la
pantalla de administración.

### Módulo Documentos: mirar y descargar carpetas de SharePoint (2026-09-16)

Shirley pidió exactamente eso y nada más: ver los archivos del expediente OXI y
poder bajárselos, sin enlazarlos con proyectos ni con órdenes.

**Los archivos NO se copian al ERP.** La carpeta se lista en vivo contra Graph y,
al descargar, Microsoft entrega un enlace de un solo uso que caduca solo.
Copiarlos habría sido duplicar 96 MB y montar una sincronización que se queda
vieja; así lo que se ve es lo que hay en Teams en ese momento. Una carpeta que
alguien reordene en Teams se ve reordenada aquí sin tocar nada.

- Módulo nuevo `documentos` (permisos `ver` y `exportar`), dado a Administración,
  Fianzas, Compras y Contabilidad.
- Tabla `documentos_carpetas`: qué carpetas se pueden mirar. La función resuelve
  SIEMPRE contra esa lista, así nadie llega a un drive arbitrario pasando ids.
- Edge Function `documentos-sharepoint` (listar / descargar / carpetas).
- Pantalla con migas de pan, buscador y descarga directa.

Dos cosas que costaron y conviene no repetir:

1. **La raíz se direcciona por RUTA, no por id.** El id que se saca explorando a
   mano (`014MUEHV…`) no le vale a Graph para pedir los hijos: contesta 400
   "Invalid request". La ruta relativa sí. Las subcarpetas van por id sin
   problema, porque esos ids salen de la propia respuesta de Graph.
2. **La URL de descarga no se puede pedir con `$select`.** Es una anotación
   (`@microsoft.graph.downloadUrl`) y Graph la deja fuera en cuanto seleccionas
   campos, aunque la pidas por su nombre. Viene por defecto si no filtras.

Comprobado bajando `Cuadro_Patrimonio_Memphis.xlsx`: 17 723 bytes, xlsx válido.

Ese archivo, por cierto, merece mirada de gerencia: dice que de S/ 20 219 445 de
patrimonio auditado hay S/ 3 293 689 comprometidos y **S/ 16 925 756 libres**. Es
el techo real para aceptar nuevos proyectos OXI.

### Respuestas de Antonio sobre el presupuesto (2026-09-16)

- El cuadro resumen **no es referencia** (coherente: está roto, 31 `#¡REF!`).
- El 10 % de consultoría va **sobre el importe del convenio**, mientras se
  termina de definir.
- La **ganancia por integración es un costo no realizado: no se emplea**.
- El tipo de cambio es una **celda fija con protección**, referencia presupuestal.

Con eso el cálculo queda cerrado y el presupuesto inicial se puede construir.

## 2026-09-17 - Limpieza de riesgo cero + arranque del presupuesto de proyecto

### Limpieza
- Borrado PROV-TEST1 ("PORTAL TEST S.A.C.") y su cuenta de portal. Cero referencias en las 11 tablas con proveedor_id.
- Los dos roles de otro tenant (Fianzas, Cargos Fianzas del tenant a0000000) NO se tocaron: dbRoles.list ya filtra por tenant, asi que no aparecen en la administracion de Memphis. Borrar datos de otro tenant seria lo contrario de "riesgo cero".

### Presupuesto inicial de proyecto - PRIMER INCREMENTO
Antonio cerro las dudas (base = importe del convenio; sin ganancia por integracion; TC fijo; el cuadro resumen del Excel no es referencia). Arrancado:
- Esquema proyecto_presupuestos + proyecto_presupuesto_lineas (arbol de partidas). NO se tocan presupuestos/presupuesto_lineas de Finanzas (presupuesto operativo por categorias, otra cosa).
- Parser supabase/functions/presupuesto-import/plantilla.ts, probado contra filas reales (15 pruebas). Peculiar: nivel 2 con coma ("1,1"=1.1) y profundos con punto; importes formato peruano; las partidas de nivel 1 traen totales AGREGADOS -> solo se suman las HOJAS.
- Edge Function presupuesto-import: lee la plantilla de SharePoint y reemplaza el presupuesto. Auth proyectos.crear/editar. Tiene solo_leer.
- Calculo del margen src/lib/proyectos/rendimiento.ts (10 pruebas): ingresos = convenio sin IGV; menos costo; menos consultoria 10%, contraprestacion 5%, venta CIPRL 4% (sobre el convenio); sin integracion. Es el "Cuadro resumen" roto, reconstruido limpio.
- Pantalla Proyectos > Presupuesto: convenio, presupuestado, comprometido en ordenes (al TC fijo), % comprometido, desglose del margen "con el plan" vs "con lo comprometido", y arbol de partidas colapsable con rollups.

CARGADO: GORE LORETO - BOMBEROS (04LORBOM25) desde PLANTILLA PRESUPUESTAL - NUEVA.xlsx. 406 lineas, 305 hojas, presupuestado S/ 25.553.222,63 sin IGV. Las 9 partidas y el UTF-8 cuadran exactos.

OJO con la lectura del margen: a media ejecucion, lo comprometido < lo presupuestado y el margen "con lo comprometido" sale inflado. Por eso la pantalla muestra "% del presupuesto comprometido" (LORETO 62,2%) y la alarma roja salta cuando lo comprometido SUPERA lo presupuestado (el caso Amazonas).

### Pendiente del presupuesto (siguiente incremento)
- Selector de archivo (reusar el navegador de Documentos) para importar sin pasar drive/item a mano.
- Confirmar con Antonio si PLANTILLA PRESUPUESTAL - NUEVA.xlsx es el presupuesto oficial de LORETO o solo el ejemplo, y donde estan los archivos por proyecto.
- Comprometido POR PARTIDA (hoy es por proyecto): las ordenes no traen partida.


## Enlace del portal: causa raíz del "usado o vencido" y arreglo (2026-09-17)

**Problema (Kevin):** se genera un enlace de contraseña, se comparte al proveedor SIN abrirlo, y al proveedor le sale "Enlace no válido - ya se usó o venció".

**Causa raíz (reproducida de punta a punta):** el enlace era un link `recovery` de GoTrue
(`/auth/v1/verify?token=…`), de UN SOLO USO, que se consume con el PRIMER GET.
- GET #1 (bot de previsualización de WhatsApp/Teams/Outlook Safe Links) → 303 con `#access_token=…`: consume el token.
- GET #2 (el humano) → 303 con `#error=access_denied&error_code=otp_expired` (idéntico a la captura del compañero).
Es decir: el previsualizador del mensajero quema el enlace antes de que la persona haga clic.

**Arreglo:** enlace OPACO de Memphis, inerte ante GET.
- Nueva tabla `portal_invitaciones` (code_hash sha256, expira_en 72h, consumida_en). Solo se guarda el hash.
- `portal-proveedor-alta` (v5): en vez del link de GoTrue, genera `…/portal/invitacion?code=<opaco>` e invalida invitaciones previas no usadas.
- Nueva Edge Function pública `portal-fijar-clave`: `verificar` (no consume) y `fijar` (fija la clave por Admin API y consume). El proveedor elige su clave; Memphis nunca la ve.
- Frontend `PortalProveedores`: vista `invitacion` que valida el código (POST, no lo dispara un bot) y muestra el formulario de contraseña.

**Verificado:** verificar dos veces NO consume; fijar consume; el proveedor entra con RUC + su nueva clave. Build de Vite OK. Cuentas y proveedor de QA eliminados por completo.

**Nota:** los enlaces GoTrue ya enviados (antiguos) siguen cayendo en la pantalla "Enlace no válido"; para esos, regenerar con "reenviar" (ya sale el enlace nuevo opaco). El arreglo del frontend entra al desplegar en Vercel; las Edge Functions ya están en producción.

## Selector de archivo para importar presupuesto (2026-09-17)

Antes había que pasar drive_id/item_id a mano. Ahora Compras: 1) elige el proyecto, 2) navega el árbol de SharePoint de COMPRAS (el mismo de Teams) y 3) pincha la plantilla .xlsx. Todo dentro del ERP.

- `documentos_carpetas.uso` ('documentos' | 'presupuesto') separa la carpeta de Shirley de la raíz de presupuestos. Registrada la raíz "Proyectos (COMPRAS)" → ruta_relativa 'General', mismo drive de COMPRAS.
- `documentos-sharepoint` (v4): filtra uso='documentos' (Shirley sigue viendo solo lo suyo).
- `presupuesto-import` (v2): acciones `carpetas` y `listar` (navegación, gobernada por permiso de Proyectos, devuelve drive_id + esExcel) además de `importar`.
- Frontend: `ImportarPresupuestoDialog` (selector proyecto + navegador SharePoint) y botón "Importar presupuesto" en la pantalla de Presupuesto.

Probado end-to-end contra las funciones: carpetas → General (13 carpetas) → "0.0 PROYECTOS EN IDEA" muestra las .xlsx marcadas como Excel. La plantilla vive en COMPRAS/General/0.0 PROYECTOS EN IDEA/PLANTILLA PRESUPUESTAL - NUEVA.xlsx. Build de Vite OK. Cuentas QA eliminadas.

Pendiente: confirmar con Antonio dónde queda el presupuesto OFICIAL de cada proyecto (hoy la plantilla ejemplo está en "PROYECTOS EN IDEA"); comprometido POR PARTIDA (las órdenes aún no se etiquetan por partida).

## Flujo financiero nativo — primer incremento (2026-09-17)

Objetivo de Kevin: dejar de usar el Excel y ver el flujo dentro del ERP. Esta primera capa REFLEJA (importa las BD y las muestra); la columna `fuente` deja el salto a MANDAR (crear/editar nativo) sin romper lo cargado.

- Tabla `flujo_compromisos` (un compromiso por fila: CDC/centro de costo, concepto, proveedor, montos, mes vencimiento, estado, postergado, fuente, área).
- Parser `flujo-import/flujo.ts` (ubica columnas POR NOMBRE — BD CONTA trae "Columna2" basura, BD TI no; meses español "mar-26"/"SET-26", importes peruanos, fechas dd/mm/yyyy, estados). 15 pruebas contra filas reales.
- Edge Function `flujo-import`: navega el sitio FlujoFinanciero (carpeta uso='flujo'), importa por área (reemplaza lo de fuente='excel'), resuelve centro de costo y proveedor por nombre. Permiso finanzas.crear/editar.
- Pantalla `/finanzas/flujo-financiero`: cifras (presupuestado/pagado/pendiente/postergados), tabla por mes de vencimiento y detalle filtrable, con botón Importar/actualizar (selector de SharePoint).

Cargado real: BD CONTA (154 compromisos, 133/154 con centro de costo) y BD TI (52, 52/52). Presupuestado CONTA S/10,505,710.61 · TI S/53,498.58. Ubicación: sitio FlujoFinanciero/Flujo Financiero/Flujo Financiero/BD CONTA 2026.xlsx y BD TI 2026.xlsx.

Pendiente: paso a MANDAR (crear/editar compromisos en el ERP, por área) cuando cada área vea su data; cruzar con órdenes/caja reales; las capas "Flujo *.xlsx" (tablas dinámicas) ya no se importan — las pinta el ERP.

## Excel de caja chica: nuevo modelo de exportación (2026-09-17, urgente de Kevin)

Cambios pedidos: 1) primer ítem = saldo de la caja anterior, 2) luego el depósito de apertura, 3) el resto por orden de REGISTRO (no por fecha de pago), 4) ítems numerados 1..N, 5) colores y formato del modelo de Administración (`Modelo caja chica 20251.xlsx`).

- `src/lib/finanzas/caja-modelo.ts` (puro, 9 pruebas): clasifica saldo anterior / apertura (por tipo o por leyenda: las cajas viejas guardaron el arrastre como `apertura` "SALDO A FAVOR DE CAJA CHICA ANTERIOR"), ordena por `creado_en` y desempata por el correlativo del número (GCC-2026-007 → 7), numera y calcula el recuadro.
- Reglas del recuadro: saldo inicial = arrastre positivo o 0 · ingresos = suma de la columna ingreso − saldo inicial (no se cuenta dos veces) · gastos = suma de egresos · saldo final = inicial + ingresos − gastos. Una DEUDA arrastrada sigue siendo ingreso negativo en el ítem 1 (como en el ERP): saldo inicial 0 y el cierre cuadra con `monto_disponible` (CAJA 26: −59.11).
- `exportCajaModeloExcel` ahora usa **exceljs** (SheetJS gratuito no escribe estilos). `construirLibroCajaModelo` arma el libro (7 pruebas, incluye escribir y releer). Chunk `exceljs` aparte en Vite: solo se carga al exportar.
- Hoja con el nombre de la caja; totales y saldos como fórmula con resultado cacheado.

Verificado con la CAJA 26 real: 34 ítems, orden 1 deuda / 2 apertura / 3.. GCC-001…032, cierre −59.11.


## Export de proveedores: ahora con TODA la información (2026-09-18)

El botón "Exportar" del directorio bajaba un CSV de 9 columnas (código, razón social, RUC, tipo, estado, email, teléfono, distrito, departamento) y se dejaba fuera casi todo. Les pedían el resto: cuentas bancarias, observaciones, contacto, datos tributarios, etc.

- `src/lib/proveedores/export-proveedores.ts` (puro + `exportarProveedoresCompleto`): arma un .xlsx con dos hojas.
  - **Proveedores** (37 columnas): código, RUC, razón social, nombre comercial, tipo, categorías, estado, condición, calificación, régimen IGV, domiciliado, contacto (nombre/cargo/email/teléfono), email/teléfono/alt, país/departamento/dirección, primera cuenta (banco/cuenta/CCI/moneda/tipo) + "Todas las cuentas" concatenadas, detracción (sí/tasa/código), retención, suspensión de 4ta y hasta, observaciones, creado/modificado.
  - **Cuentas bancarias** (una fila por cuenta): código, RUC, razón social, banco, número, CCI, moneda, tipo. Para procesar las múltiples cuentas estructuradas.
- Respeta los filtros/búsqueda del directorio (exporta lo filtrado).
- Reutiliza `exportToExcelMultiHoja`: RUC/cuenta/CCI van como TEXTO (no se convierten a número ni pierden ceros).
- 8 pruebas (precedencia jsonb sobre cuenta plana, concatenación, Sí/No, categoría desconocida, hoja de cuentas). Verificado con 10 proveedores reales (cuentas múltiples, DETRACCIONES BN, CCIs con espacios/guiones): 21 cuentas, monedas resueltas, cuentas vacías filtradas. Total real: 136 proveedores.
- `ProveedoresDirectorio.handleExportar` ahora llama al export completo (antes `exportToCSV` de 9 columnas).


## Flujo financiero: acceso por área + Conta→Contabilidad (2026-09-21)

Kevin: "cada usuario debe ver lo suyo, excepto Carolina que ve todo"; renombrar Conta→Contabilidad; faltan Administración y Proyectos.

**Hecho en esta tanda (acceso + nombre):**
- Renombrado el área `CONTA`→`CONTABILIDAD` (datos + etiquetas de pantalla + derivación del importador).
- **Permiso propio** `finanzas.flujo`: la ruta `/finanzas/flujo-financiero` ya no exige `finanzas.ver`, así Proyectos (Miguelangel) entra solo al flujo sin abrirle todo Finanzas. Otorgado a los roles Contabilidad, Administración y Proyectos (excepción en rutas.ts; el filtro real por área lo hace la RLS). 3 pruebas nuevas.
- **RLS por área** en `flujo_compromisos`: funciones `flujo_ve_todo_actual()` y `flujo_puede_ver(area)` (SECURITY DEFINER). Cada rol ve su área (Contabilidad↔Walter, Administración↔Shirley, Proyectos↔Miguelangel); **ven todo** los Administradores y quien esté en `flujo_ve_todo` (Carolina). TI = solo ve-todo (no hay rol TI). Verificado: Carolina/Kevin ven las 4; Miguelangel solo Proyectos; Shirley solo Administración; Walter solo Contabilidad; Gerencia nada.
- `areaDeNombre` del importador ahora canoniza: BD CONTA→CONTABILIDAD, BD TI→TI, Flujo Administración→ADMINISTRACION, Flujo de proyectos→PROYECTOS.

**Pendiente (siguiente tanda): importar Administración y Proyectos + vista horizontal.**
Los archivos tienen otra estructura: "Flujo Administración" es una MATRIZ por meses (concepto × Ago-25…May-27, sin pagado); "Flujo de proyectos" es plano con otra cabecera (CÓDIGO/CDC/CATEGORIA/CONCEPTO/PROVEEDOR/CANTIDAD/MONEDA/PU/TOTAL/TC/FECHA VENCIMIENTO/TOTAL SOLES).
Recomendación (aprobada en criterio por Kevin: "los flujos son horizontales por mes"): normalizar al MISMO store `flujo_compromisos` (desdoblando la matriz de Admin: cada mes con monto → un compromiso) y AÑADIR a la pantalla la vista HORIZONTAL concepto × meses. Así todo queda conectado (cruza con órdenes/caja/proveedores) y se lee como un flujo.


## Flujo financiero: Administración y Proyectos + vista horizontal (2026-09-21)

Se importan las 4 áreas y la pantalla se reorganiza como un flujo horizontal (concepto/CDC × meses).

- **Lectores nuevos** en `flujo-import/flujo.ts`:
  - `leerAdministracion`: la hoja "Base de datos" es una MATRIZ por meses; se DESDOBLA (cada celda concepto×mes con monto = un compromiso). "Deuda Vencida" = compromiso vencido sin mes.
  - `leerProyectos`: hoja "BASE DE DATOS" con cabecera propia (TOTAL SOLES como monto, mes de la FECHA DE VENCIMIENTO, PAGADO como estado, meses con nombre completo).
  - El índice elige hoja (BD… vs "Base de datos") y lector según el área.
- **Bug clave arreglado**: `numeroPeru` no leía importes con 3 decimales ("1048524,276" salía como mil millones). Ahora: coma = decimal, punto = millar; si hay ambos, manda el último. `mesEspanol` acepta nombre completo ("Octubre-25"); nuevo `mesDeFecha`.
- **Un flujo mezcla signos**: positivo = egreso (a pagar), negativo = ingreso (CIPRL/financiamiento). Proyectos: egresos S/ 88.6M, ingresos S/ 123.6M.
- **Pantalla nueva**: cifras Egresos/Ingresos/Neto/Pagado; **matriz horizontal** agrupable por Centro de costo / Categoría / Concepto × meses, con neto por mes (fila "Neto del mes") y negativos en azul; detalle filtrable debajo.
- Cargado real: CONTABILIDAD 154, TI 52, ADMINISTRACION 383, PROYECTOS 1399 (1988 compromisos, 4 áreas). 23 pruebas del parser (incl. 3 decimales, matriz de Admin, Proyectos).

Nota: OFCENTRAL de Administración no cruza con un centro de costo del ERP (no existe "Oficina Central" con ese nombre); el CDC queda como texto. Algunas fechas de Proyectos vienen sucias (año 2000/2028) y generan columnas extra en la matriz.


## Flujo financiero: CRUD nativo, filtros, paginación, OFCENTRAL (2026-09-21)

Pedidos de Kevin: emparejar OFCENTRAL→Oficina Central; esconder fechas sucias; paginación; poder crear/editar/borrar; filtros de año/mes/estado.

- **OFCENTRAL** ahora cruza: el centro de costo existe con código OFCENTRAL pero nombre "Gastos Oficina Central". El importador ahora resuelve el CDC contra el **CÓDIGO** del centro de costo (no solo el nombre). Reimportadas las 4 áreas: Contabilidad 154/154, Administración 372/383 (antes 0), TI 52/52, Proyectos 885.
- **CRUD nativo** (fuente='erp', sobrevive a reimportaciones): botón "Nuevo compromiso" + diálogo `CompromisoFlujoDialog` (área, CDC con datalist de centros, concepto, categoría, proveedor, tipo egreso/ingreso, monto firmado, moneda/TC, mes, estado, pagado, postergado, observaciones). Editar/borrar por fila para filas manuales; las de Excel son de solo lectura (badge "Excel").
- **RLS de escritura por área** (`flujo_comp_wr` → `flujo_puede_ver(area)`): verificado que un usuario de Contabilidad crea en su área y queda BLOQUEADO (403) en Proyectos. La importación sigue por service role.
- **Filtros**: año, mes, estado (con "Limpiar"). **Fechas sucias ocultas**: se muestran solo años 2025–2027 (los 2000/2028 basura del Excel de Proyectos quedan fuera por ahora). **Paginación** del detalle (25 por página).
- `finanzas.flujo` también habilita importar (para que el dueño del área refresque).

Pendiente/nota: OFCENTRAL 11 filas de Admin sin CDC no cruzan (no traen centro). Las fechas sucias siguen en la BD; solo se ocultan en pantalla.


## Flujo financiero: Administración lee la BD plana con pagado/pendiente (2026-09-21)

Kevin: "en Administración sí veo una columna de pagado/pendiente; revisa todas las hojas de ambos archivos".

- **Hallazgo**: el archivo de Administración tiene una hoja **"BD ADMIN"** plana con la misma cabecera común que Contabilidad/TI (CDC, CONCEPTO, MES VENCIMIENTO, MONTO PAGADO, **PAGADO/PENDIENTE**, MES PAGADO…). Antes se leía la hoja matricial "Base de datos" con `leerAdministracion` y se perdía el estado, la fecha de pago y el detalle por compromiso.
- **Cambio**: Administración ahora usa `leerCompromisos` sobre **BD ADMIN** igual que las demás áreas; solo Proyectos conserva su cabecera propia (`leerProyectos`). `leerAdministracion` queda como utilidad sin uso en el dispatch.
- **usedRange(valuesOnly=true)**: BD ADMIN arrastra columnas fantasma hasta la XFD que reventaban el límite de celdas de Graph con el `usedRange` normal (`RangeExceedsLimit`). `valuesOnly` recorta al bloque real de datos.
- **fechaISO / mesFlexible** en `flujo.ts`: MES VENCIMIENTO y MES PAGADO pueden venir como fecha (`2025-08-01`) o como texto de mes (`ago-25`); se aceptan ambos y la fecha de pago se guarda completa.
- **Reimportadas las 4 áreas** (edge `flujo-import` v7): ADMINISTRACION 1053 (640 pagadas / 412 pendientes, 31 meses, 638 con fecha de pago, CC 1052/1053), PROYECTOS 1399, CONTABILIDAD 154, TI 52. Commit `d32f6141`. 26 pruebas del parser.

Nota: los proveedores de Administración no cruzan con el directorio (`proveedores_reconocidos=0`) porque los nombres del Excel no coinciden con `razon_social`; el nombre queda como texto. La fecha de pago de Proyectos casi siempre viene vacía en el Excel (solo 69 filas).


## PENDIENTES CONSOLIDADOS PARA GERENCIA (2026-09-23)

Gerencia pidió el diagrama "as is" del ERP para evaluar mejoras (entregado como HTML/PDF sin login en
`Downloads/ERP-Memphis-Mapa-AsIs-y-Propuesta.*`; artifact privado https://claude.ai/artifact/LmVk5r3cZsqDv4qdf4JFxi).
Luego pidió que, al elegir un proyecto, el ERP responda toda la cadena (presupuesto → gasto → saldo → facturado →
pagado → recepcionado → inventario → contable → rentabilidad) y "qué se debe pagar cada mes". **Meta: que todos los
módulos conversen.** Auditoría completa en `docs/AUDITORIA-Proyecto360-CxP.md`. Esta sección es la lista maestra.

### A. Propuesta del "as is" — 8 iniciativas (estado: pendiente de decisión/priorización de Gerencia)
1. **Flujo Financiero nativo** (dejar el Excel) — bajo. Falta: paridad con el Excel, export, mapear proveedores; **Finanzas** fija corte.
2. **Consolidar PEN/USD** — bajo/medio. Falta: tabla de TC + job diario SUNAT/SBS (hoy TC manual y por navegador); **Finanzas/Conta** política de TC.
3. **Compras → Inventario (kardex automático)** — alto. Falta: catálogo de artículos, `articulo_id` en ítems, trigger recepción→movimiento, valorización; **Gerencia** enciende, **Finanzas/Conta** qué se inventaría.
4. **Contratos y fianzas con alertas** — medio. Falta: contrato de proyecto como entidad, vigencias, reglas en `notif-scheduler`, bandeja; **Legal** define umbrales/custodia.
5. **CRM + radar SEACE → Proyectos** — alto. Falta: integración SEACE/OCDS, scoring, oportunidad ganada → proyecto, clientes-entidades; **Comercial/Gerencia**.
6. **Conciliación OC ↔ recepción ↔ factura ↔ pago** — medio/alto. Falta: pago↔comprobante, match con tolerancias, bandeja de diferencias, detracciones/retenciones, registro de compras automático; **Conta/Finanzas**.
7. **Adopción única + IA embebida** — bajo/medio. Falta: exports que reemplacen Excel paralelos, capacitación; IA en pausa por créditos; **Gerencia**.
8. **Notificaciones en tiempo real y móvil (PWA)** — medio. Falta: tabla+bandeja con Realtime, manifest/service worker, vistas de campo; **Gerencia/Operaciones**.

**Cuellos de botella transversales:** (a) datos maestros limpios (proveedores, artículos, clientes-entidades); (b) las decisiones por área
(Gerencia, Legal, Comercial, Finanzas, Contabilidad, todas — detalladas en el as is); (c) capacidad de desarrollo (un solo frente).

### B. Proyecto 360 + cuentas por pagar por mes — qué falta (auditoría 2026-09-23)
**Veredicto:** el modelo soporta ~80 % de la cadena; la data se corta en "OC aprobada" (0 recepciones, 0 facturas de proveedor, 0 pagos,
0 asientos, 0 inventario en el ERP). El enlace OC→proyecto está completo (las 354 OC sin proyecto son de área).

**Bloque 0 — correcciones ANTES de encender nada:**
- Bug `proyecto-financiero.ts:139`: filtra estados de OC inexistentes (`recibida`); los reales son `recibida_parcial/total`. Hoy 0 impacto
  (no hay OC recibidas); al recepcionar, las OC recibidas saldrían del gasto real.
- `recepciones-store.tsx:303` graba `cantidad_pedida = cantidad_recibida`.
- `proyectos.costo_real` nunca se actualiza (siempre 0) y lo usan ProyectoDetalle y ProyectosValorizaciones ("Valorizado").
- Tres definiciones de "gasto" y dos de "margen" → una función TS + una vista SQL versionada + definición oficial.
- TC 3.40 hardcoded en `proyecto-financiero.ts:236,254`.
- Desfase migraciones↔prod: `transacciones.proyecto_id` y `presupuesto_lineas.proyecto_id` están en el repo pero NO en prod; y `v_gerencia_*`,
  `v_oc_saldo_facturacion`, `v_bi_movimientos`, RPC `proyectos_financiero_resumen`/`proyectos_gasto_por_anio`, tablas `comprobantes_pago`,
  `flujo_compromisos`, `proyecto_presupuestos` y trigger `trg_oc_proyecto` existen en prod sin SQL en el repo.

**Bloque 1 — CxP por mes:** vencimiento en OC derivado de `condiciones_pago` (~90 % lo trae en texto: "CRÉDITO 30 DÍAS" 794, "90" 84, "60" 42,
contado 160) + campo editable + estado de pago; OC aprobada → compromiso automático (`cxp_compromisos` de PLAN-CxP o `flujo_compromisos`
con `orden_id`); portal llena `fecha_vencimiento` de factura; vista unificada CxP por mes y pantalla real en `/finanzas/cuentas-pagar`
(hoy abre Transacciones, 0 filas).
**Bloque 2 — cerrar la cadena por proyecto:** recepciones siempre + precio/enlace a ítem de OC; facturas por proyecto (+ `orden_compra_id`
en registro manual); pagos con `proyecto_id`/`comprobante_id`/`orden_id` y monto/fecha; cobros: valorización ↔ factura de venta,
`proyecto_id` en `registro_ventas`, cobrado transaccional.
**Bloque 3 — presupuesto por partidas:** partidas cargadas solo en 1/11 proyectos (406 líneas); `partida_id` en OC/ítems; saldo por partida.
**Bloque 4 — inventario por proyecto:** catálogo, `articulo_id`, recepción → kardex, dimensión proyecto/almacén.
**Bloque 5 — contable por proyecto:** contabilización automática desde comprobantes con CDC en líneas; registros automáticos; reporte por CDC/proyecto.
**Bloque 6 — Proyecto 360 completo:** mostrar valorizado/cobrado/pendiente de cobro (ya se calculan), facturado, pagado, recepcionado,
inventario, contable, flujo de caja del proyecto, compromisos por mes.

**Decisiones nuevas que esto exige:** definición oficial de gasto real y margen (Finanzas+Gerencia); política de TC (Finanzas); momento de
contabilización y tolerancias 3-way (Contabilidad); registrar TODAS las recepciones y portal de facturas obligatorio (Compras/Operaciones);
presupuesto por partidas al abrir proyecto y encender Inventario (Gerencia).

### C. Otros pendientes vigentes (ya listados antes, se mantienen)
- Autonomía: programar `flujo-import`, `fianzas-import`, `gps-sync` y reactivar `excel-sync` (cron existe: solo `notif-scheduler` corre a diario);
  TC automático (FASE 3); reportes ejecutivos "push" por Teams/correo (requiere KPIs definidos por Gerencia).
- Flujo financiero: 515 compromisos sin CDC; proveedores de Administración no cruzan con el directorio; fechas sucias de Proyectos ocultas, no limpiadas.


## Bloque 0 ejecutado + análisis de los 6 puntos de Kevin (2026-09-23)

**Respuestas verificadas a los 6 puntos:**
1-2. Condiciones de pago: TODAS las OC la tienen (1 312/1 316 migradas, 18/18 nativas) y el catálogo `condicion_pago` está
   estandarizado (contado, adelantado, credito_7…150, ciprl, segun_acordado). Lo que falta: convertirla en días/fecha de
   vencimiento y un estado de pago; la OC guarda la etiqueta y, si nace de cotización, arrastra texto libre de "términos".
3. Proyectos se actualizan por `excel-sync` (RESUMEN.xlsx → `proyectos_excel_sync` + `proyectos`); última corrida 2026-09-10 16:00;
   el cron cada 30 min está desactivado y nunca corrió; ICAPNP24 nunca se actualizó (no está en el Excel). La base registra
   `sincronizado_en`/`ultima_sincronizacion` pero la UI no muestra "Datos al…".
4. Presupuesto como origen: `proyecto_presupuesto_lineas` ya son partidas jerárquicas (solo 1/11 proyectos cargado, 406 líneas);
   no existe `partida_id` en req/cot/OC items. Diseño: cada línea de gasto → partida (proyecto) o línea de presupuesto de área (CDC).
5. Kardex automático: sí; requiere catálogo de artículos + `articulo_id` en ítems + almacén en recepción + trigger.
6. Flujo Excel: los 63 negativos son categoría INGRESOS (CIPRL, cobros de valorización). Codificar tipo por signo NO es correcto.
   Formato correcto: saldo inicial + INGRESOS (operativos/financieros) − EGRESOS (operativos/financieros/impuestos) = flujo neto → saldo
   final; dimensiones mes · moneda · tipo · clase · área/proyecto · estado (proyectado/comprometido/pagado). CxP alimenta egresos, CxC ingresos.

**Hallazgos nuevos:** 933/1 334 OC (70 %) en USD con TC 3.40/3.45 fijo (defaults de migración); las OC nativas no guardaban TC.
93 migraciones (jun→sep) existían solo en Supabase, no en el repo.

**Bloque 0 HECHO (migración `bloque0_tipo_cambio_definicion_unica_costo_real`):**
- Estados reales de OC (`aprobada|recibida_parcial|recibida_total`) en TS (`ESTADOS_OC_GASTO`) y en SQL (`proyectos_financiero_resumen`,
  `proyectos_gasto_por_anio`); PresupuestoProyecto usa la misma regla (antes contaba borradores/enviadas).
- `cantidad_pedida` en recepciones ya respeta lo pedido de la OC (crear y actualizar).
- `proyectos.costo_real` mantenido por triggers (`trg_oc_costo_real`, `trg_caja_costo_real`) + relleno inicial; rótulo "Valorizado" → "Costo real".
- UNA definición: `proyecto_financiero(uuid)` en la base (utilidad operativa + ganancia neta regla Antonio con `parametros_financieros`);
  `proyecto-financiero.ts` es su espejo y expone `neto`; Proyecto 360 muestra margen operativo y neto.
- Tipo de cambio: tabla `tipos_cambio` + `tc_vigente(fecha)` + `fijar_tipo_cambio()` (finanzas.editar) + trigger `trg_oc_tipo_cambio`
  (la OC USD guarda el TC del día); `tipo-cambio-store` lee de la base (antes localStorage por navegador); fuera el 3.40 del código y del SQL.
  **Semilla = 3.40 a propósito** (no mover cifras sin política de TC). PENDIENTE Finanzas: política y job diario SUNAT/SBS (Bloque 1).
- 94 migraciones exportadas al repo desde `supabase_migrations.schema_migrations` (pooler + rol temporal, eliminado). `transacciones.proyecto_id`
  y `presupuesto_lineas.proyecto_id` creadas.
- Con la nueva función: margen neto AMAZONAS −0.9 %, HUÁNUCO −11.1 % (señal para Gerencia; con TC real sería peor).

**Bloques re-secuenciados (arrancar Bloque 1):** 1 CxP por mes (vencimiento desde catálogo, estado de pago, OC→compromiso, vista unificada,
TC diario, "Datos al…" + cron proyectos) · 2 Presupuesto como origen (partidas, `partida_id`, líneas de área) · 3 Cadena por proyecto
(recepción/factura/pago/cobro) · 4 Kardex automático · 5 Contable por proyecto · 6 Flujo financiero correcto + Proyecto 360 completo.


## Bloque 1 ejecutado — Cuentas por pagar por mes (2026-09-23)

Sigue el diseño de `docs/PLAN-CxP.md` (decisiones 26–27/08) sin crear otra tabla: **`flujo_compromisos` evolucionó al modelo CxP**.

**Modelo (migraciones `bloque1_*`):**
- `sentido` pagar/cobrar con **montos siempre positivos** (63 ingresos del Excel pasaron de negativo a `cobrar`; 0 negativos quedan).
  `origen` real/comprometido/proyectado. `orden_compra_id`, `comprobante_id`, `proyecto_id` (derivado del CDC por trigger),
  `fecha_vencimiento`, `referencia_doc`. Índices únicos: una fila ERP por OC; una por factura sin OC.
- `centros_costo.area` (dueño del CDC), rellenada por mayoría desde el flujo (32 CDC sin área → caen a ADMINISTRACION).
- OC: `dias_credito` y `fecha_vencimiento_pago` derivados de `condiciones_pago` (`dias_credito_de()` + trigger): **1 167 de 1 334 OC
  con vencimiento**; sin fecha: SEGÚN LO ACORDADO 125, CIPRL 24, basura ("SUBTOTAL", "MENSUAL", tarjeta) → requieren fecha a mano.
- **OC aprobada/recibida → compromiso** (`sync_compromiso_de_oc`, trigger `trg_oc_compromiso`), solo desde `cxp_desde` (parámetro
  `parametros_financieros`, hoy 2026-07-01 = go-live): las OC anteriores se pagaron en el sistema anterior y el ERP no lo sabe —
  generarlas inflaba S/ 67 M "vencidos". Si el Excel ya trae la OC, el Excel manda (no duplica). Bug corregido: la variable record
  se llamaba igual que el alias y rompía el trigger de OC.
- **Factura → compromiso** (`trg_factura_compromiso`): con OC enlaza y pasa a `real`; sin OC (N30) crea el suyo anclado en la factura.
- Vistas `v_cxp` / `v_cxc` / `v_cxp_por_mes` (security invoker: RLS por área).

**Importador (`flujo-import` v8):** captura la referencia de OC (la hoja de Proyectos tiene columnas OC y FACTURA; CÓDIGO no es la OC)
y la fecha de vencimiento; normaliza el signo a `sentido`; enlaza por número (`normalizarNumeroOC`: "MM-290" → "MM-000290").
Reimportadas las 4 áreas: **Proyectos 1 399 (329 enlazadas a OC)**, Administración 1 053, Contabilidad 154, TI 52. 30 pruebas del parser.

**Tipo de cambio automático:** Edge `tc-sync` (API decolecta/apis.net.pe, token existente) + cron `tc-sync-diario` 07:30 Perú (`dias:3`).
Probado: SUNAT venta **3.362** (19–23 sep) ya en `tipos_cambio`; `tc_vigente` = 3.362 (la semilla 3.40 de hoy fue reemplazada).

**Pantallas:** nueva **`/finanzas/cuentas-pagar`** (`CuentasPorPagar.tsx`): KPIs ¿cuánto se debe? / vencido / vence este mes / próximos
30 días, filtro por origen (real/OC/proyectado), área, proyecto, solo vencidas, búsqueda; calendario mes × área; detalle paginado;
"Marcar pagado" (finanzas.editar o finanzas.flujo). Flujo financiero y su diálogo ya trabajan con `sentido` (sin signos) y con el TC
de la base. Proyecto 360 muestra **"Datos del Excel de Operaciones al …"** (de `excel_sync_config`; sync sigue manual por decisión).

**Decisiones que quedan para Finanzas/Gerencia:** `cxp_desde` (hoy go-live); política de TC (ya hay dato real diario); fechas de
vencimiento a mano para CIPRL / según lo acordado; reactivar o no el cron de proyectos; normalizar `momento` a catálogo (35 variantes).


## Bloque 1b — Vencimientos: la factura manda; CIPRL es un evento (2026-09-23)

Kevin: "¿todos los pagos deben ir ligados al vencimiento de la factura?" y "CIPRL/según lo acordado: ¿el equipo puede poner la fecha
cuando la sepa? En CIPRL se paga al proveedor cuando la empresa cobra el CIPRL del proyecto (se enteran 1 día antes)".

**Regla implementada (migración `bloque1b_vencimiento_editable_ciprl_y_factura`):** manual > factura > CIPRL del proyecto > emisión + días.
- OC: `pago_ligado_a` (ciprl | acordado, derivado de la condición), `fecha_vencimiento_pago` **editable** (`vencimiento_manual`; campo en
  OrdenForm con ayuda según condición; visible en OrdenDetalle) y `vencimiento_estimado` cuando hereda la fecha del CIPRL.
- Proyecto: `fecha_ciprl_estimada` / `fecha_ciprl_cobro` → bajan a las OC ligadas sin fecha manual (trigger). RPCs `fijar_ciprl_proyecto`
  y `fijar_vencimiento_oc` (finanzas.editar / finanzas.flujo / compras.editar).
- Factura: `factura-ingest` v5 lee `cbc:DueDate` o la última cuota `PaymentTerms/PaymentDueDate`; si no viene, trigger = emisión + días de
  crédito de la OC. Al enlazarse manda su fecha y se guarda `desfase_dias` (factura − OC) para control.
- `v_cxp`: lo ligado a CIPRL sin fecha o con fecha estimada **no** cuenta como vencido.
- Cuentas por pagar: bloque "Se pagan cuando la empresa cobre el CIPRL" (por proyecto, con fecha estimada → "Aplicar" y "Cobrado"),
  bloque "Sin fecha de vencimiento" con edición en línea, badges estimada / desfase de factura.

Datos: 24 OC CIPRL (2 vivas post go-live: AMAZONAS, LORETO Bomberos), 126 "según lo acordado". Vencido sigue en S/ 29.6 M.


## Bloque 2 ejecutado — El presupuesto como origen (2026-09-23)

Principio de Kevin: "todo nace del presupuesto; requerimientos, cotizaciones, compras… deben hacer match con el presupuesto inicial;
hay cosas no amarradas a un proyecto".

**Migración `bloque2_partidas_en_la_cadena_de_compras`:**
- Partidas **estables**: índice único `(presupuesto_id, item)` + `vigente`. `presupuesto-import` v3 hace **upsert por código** (1.2.3) en
  vez de borrar y reinsertar; lo que desaparece de la plantilla queda `vigente=false` (así los ítems enlazados no pierden su partida).
- `partida_id` (partida del proyecto) y `presupuesto_linea_id` (línea de presupuesto de ÁREA por CDC, para lo no-proyecto) en
  `requerimiento_items`, `cotizacion_items` y `orden_items`.
- Vistas `v_partidas_proyecto` (hojas vigentes, para selectores) y `v_partida_ejecucion` (por partida hoja: presupuestado, solicitado
  en requerimientos, comprometido en OC aprobadas/recibidas, saldo, % y `sobregirada`; en soles sin IGV como la plantilla).

**Cadena:** el requerimiento fija la partida por ítem (selector en RequerimientoForm cuando el proyecto elegido —o el del CDC— tiene
partidas) → `heredarDelRequerimiento` la lleva a la cotización → la OC la hereda de la cotización (OrdenForm ya no la pierde al mapear
ítems). Stores de las tres entidades leen/escriben `partida_id`.

**Pantallas:** PresupuestoProyecto muestra por partida (y agregado por prefijo) Presupuestado · Comprometido con partida · Saldo, en rojo
las sobregiradas, y cuánto de lo comprometido total lleva partida. Proyecto 360 gana el bloque "Presupuesto por partidas" (top comprometidas,
sobregiradas, enlace a partidas).

**Estado de datos:** partidas cargadas solo en **1 de 11** proyectos (305 hojas); 0 ítems de OC con partida todavía (el control empieza
con los requerimientos nuevos). Pendiente Operaciones: subir la plantilla de Antonio de los otros 10 proyectos (ImportarPresupuestoDialog).
Pendiente (2b): UI para líneas de presupuesto de área; "crear proyecto desde el presupuesto"; alerta al aprobar una OC que sobregira su partida.


## Bloque 2 · datos — Presupuestos PRO-FOR-004 migrados y TC SUNAT diario (2026-09-23)

Kevin compartió `OneDrive - MEMPHIS MAQUINARIAS S.A.C\General - PROYECTOS` ("cada proyecto tiene carpeta y archivos con 'presupuesto';
revisa celda por celda, tienen fórmulas extrañas, no todos son iguales") y confirmó: **Finanzas usará el TC de SUNAT diario**.

**Formato encontrado: PRO-FOR-004** (plantilla de Antonio, abril 2025) en 10 proyectos. Cabecera (PROYECTO, CUI, Costo de Ejecución,
Tasa de Cambio en C8, Plazo), bloque PLANIFICADO (E..H: precio U., precio T., proveedor, forma de pago) y bloque FINAL (I..L, negociado).
Lo "extraño" de las fórmulas, ya resuelto en el parser (`parse_profor004.py`, scratchpad; leído con openpyxl valores + fórmulas):
- **La moneda va escondida en la fórmula**: `=37990*$C$8` es dólares × celda del TC; el valor visible ya está en soles. Se detecta por
  referencia a la celda del TC → `moneda='USD'`, `precio_unitario` en US$ (valor / TC) y `precio_unitario_soles`.
- **Los precios traen IGV** (`=ROUND(720*1.18,2)`): validado porque Σ PLANIFICADO = `proyectos.presupuesto` **exacto** en MUNI CUSCO,
  CUSCO AMBULANCIAS y HUÁNUCO. Se guarda `total_con_igv` = valor del Excel y `total_sin_igv` = /1.18.
- Ítems "01.02.03" → canónico "1.2.3"; "01.02.00" es grupo. **Códigos duplicados** (SMARTBOM 72, LORMOVS 20, LORETO 13): hojas
  duplicadas se renombran `1.2.3#2`, grupos duplicados se omiten. SMARTBOM tenía una celda "TC" con 70 (basura): se ignora si ≥ 10.
- ICAPNP24 no tiene presupuesto: su Excel es un **control de pagos**, no un presupuesto. Sin partidas.

**Migraciones:** `bloque2_partidas_bloque_final_profor004` (columnas del bloque FINAL, `forma_pago`, `fila_excel`; en cabecera
`tipo_cambio_final`, `archivo_origen`, `formato`) y `bloque2_ejecucion_partidas_con_igv_y_respaldo_tc` (`v_partida_ejecucion` compara
**con IGV en los dos lados** —el presupuesto no dice el IGV por línea, la OC sí conoce su régimen— y expone `presupuestado_sin_igv`;
`ordenes_compra.tipo_cambio_migracion` como respaldo).

**Carga (node pg + rol temporal, ya borrado):** 10 presupuestos, **1,290 partidas hoja** (upsert por código; LORETO: 130 nuevas, 275
actualizadas, 131 viejas quedan `vigente=false`). Comparación Σ PLANIFICADO (con IGV) vs `proyectos.presupuesto`:

| Proyecto | Hojas | Σ PRO-FOR-004 | ERP (Excel Operaciones) | Diferencia |
|---|---|---|---|---|
| 01CUSMUN24 | 77 | 6,235,201 | 6,235,201 | 0 |
| 02CUSAMB25 | 143 | 26,917,370 | 26,917,370 | 0 |
| 03HNCPNP25 | 50 | 6,804,737 | 6,804,737 | 0 |
| 04LORBOM25 | 297 | 32,476,227 | 33,204,527 | −728,300 (archivo más nuevo) |
| 05AMAPNP25 | 86 | 10,261,205 | 11,945,011 | −1,683,806 (versión distinta) |
| 06CUSPNP25 | 45 | 11,406,421 | 12,585,422 | −1,179,001 (hoja "Presu. BASE") |
| 07CUSHAM26 | 18 | 2,062,473 | 2,043,903 | +18,570 |
| LORMOVS / SMARTBOM / SMARTMOVS | 82 / 397 / 95 | 73.5 M / 27.1 M / 34.6 M | sin presupuesto en ERP (en idea) | — |

`proyectos.presupuesto` **no se tocó**: sigue viniendo del Excel de Operaciones. Las 4 diferencias son para que Operaciones diga cuál
versión manda (o suba la vigente por ImportarPresupuestoDialog, que aún lee solo la plantilla-v1; soporte PRO-FOR-004 pendiente).

**TC SUNAT diario, histórico completo:** la API decolecta sin token se agotó ("Apikey Required / Limit Exceeded"), así que el histórico
viene de las series del BCRP "TC Sistema bancario SBS" (PD04639PD compra / PD04640PD venta). Regla verificada: **SUNAT(d) = cierre SBS del
día hábil anterior** (SBS 18-sep 3.362 = SUNAT 19-sep 3.362; 14/15-mar-2025 3.67/3.663 coinciden). `tipos_cambio` tiene ahora **1,484 días
seguidos** (2022-09-01 → hoy, sin huecos; 91 directos de SUNAT, el resto `sunat (SBS <fecha> via BCRP)`). `tc-sync` v2 usa el BCRP como
respaldo cuando decolecta falla (probado: 2022-09-01 = 3.847), sin pisar valores directos de SUNAT.

**914 OC migradas en USD re-expresadas** (911 traían 3.40 y 3 traían 3.45 por defecto) al TC SUNAT de su fecha de emisión (3.345–3.883),
con el TC anterior guardado en `tipo_cambio_migracion`. Efecto: el gasto USD pasa de S/ 89.4 M a S/ 96.0 M (+7.3 %); `costo_real` se
recalculó solo (triggers) y 138 compromisos del flujo se alinearon al nuevo TC. PresupuestoProyecto ahora compara con IGV en los dos lados
y valora cada OC al TC con que nació (la misma regla que `proyecto_financiero()`).

**El importador ya entiende el PRO-FOR-004 (`presupuesto-import` v5):** `profor004.ts` (parser sin Deno, 21 pruebas en
`presupuesto-profor004.test.ts`), detección automática del formato (PRECIO T. + Proveedor en la fila ITEM), búsqueda de la hoja con la
tabla (no siempre es la primera), lectura de `values` + `formulas` con `usedRange(valuesOnly=true)`, reintento ante 502/503/504 de Graph,
y guarda `formato`, `archivo_origen · hoja`, `tipo_cambio_final` y el bloque FINAL. Probado de punta a punta con usuario QA temporal
(borrado) sobre los archivos reales de SharePoint: Muni Cusco 77 hojas / 6,235,200.80, Huánuco 50 / 6,804,736.57, CUSCO FINAL 45 /
11,406,420.67 en la hoja "Presu. BASE" — idénticos al parser de Python. La raíz `uso='presupuesto'` (COMPRAS/General) **es** la carpeta
"General - PROYECTOS" de OneDrive (mismo drive), así que Operaciones ya navega a sus archivos desde ImportarPresupuestoDialog.
En "0.0 PROYECTOS EN IDEA" hay PRO-FOR-004 sin proyecto en el ERP: Ayacucho, COER Loreto, Bomberos Cusco (2 versiones), renting.


## Bloque 2b ejecutado — Alerta de sobregiro, presupuesto de área y proyecto desde el presupuesto (2026-09-23)

- **Alerta al aprobar** (`oc_partidas_sobregiro(uuid)`, migración `bloque2b_alerta_sobregiro_partida_al_aprobar`): al abrir el diálogo de
  aprobación, OrdenDetalle lista las partidas de la OC que se pasarían del presupuesto (presupuestado · ya comprometido por otras OC ·
  esta orden · exceso; con IGV, USD al TC de cada orden). No bloquea: el botón pasa a "Aprobar igual" en rojo. Si todo cabe, lo dice.
- **Presupuesto de ÁREA**: `presupuestoLineaId` viaja requerimiento → cotización → OC (stores, heredar, OrdenForm; columna
  `presupuesto_linea_id` ya existía). RequerimientoForm muestra el selector de líneas de `presupuesto_lineas` del CDC cuando el
  requerimiento NO es de proyecto y el CDC tiene líneas. **Hoy Finanzas no tiene ningún presupuesto de área cargado (0 filas)**: el
  selector no aparece hasta que carguen uno en Finanzas → Presupuestos. Decisión pendiente de Finanzas.
- **Crear proyecto desde el presupuesto** (`presupuesto-import` v6, `proyecto_nuevo: {codigo, nombre}`, exige `proyectos.crear`):
  el proyecto nace en idea (tipo cliente, OxI, planificación) con el CUI y el total con IGV del Excel como `presupuesto`; un proyecto
  existente SIN presupuesto en el ERP también lo toma del Excel (uno que ya lo tiene lo conserva: esa cifra la manda Operaciones).
  En ImportarPresupuestoDialog: pestaña "Existente / Proyecto nuevo".


## Bloque 3 ejecutado — La cadena por proyecto: recepción valorada, pago enlazado, valorización = CxC (2026-09-23)

Migraciones `bloque3_cadena_por_proyecto`, `bloque3_cadena_ajustes_pago_y_proyectado`, `bloque3_flujo_no_pierde_proyecto_sin_cdc`.

- **Recepción valorada**: `recepcion_items.orden_item_id` (RecepcionForm lo manda; si falta, la base casa por descripción dentro de la OC),
  `precio_unitario` (de la OC) y `valor_recibido` = cantidad × precio (trigger). Vista `v_oc_recepcion` (pedido, recibido, % por OC).
- **El pago es una transacción**: `transacciones.comprobante_id / orden_compra_id / compromiso_id / valorizacion_id`. Al insertar hereda
  proyecto/CDC del documento, encuentra el compromiso (factura → OC → valorización) y calcula `monto_soles` al TC SUNAT.
  `recalc_pago_compromiso()`: lo pagado del compromiso = Σ transacciones pagadas (convierte moneda), estado PAGADO / PARCIAL / PENDIENTE,
  y cierra la factura (`estado_flujo='pagada'`) o la valorización (`pagada` + fecha). Anular o borrar la transacción lo revierte.
  Lo que trae el Excel o "marcar pagado" antiguo NO se toca mientras no tenga transacciones.
  RPC `registrar_pago_compromiso(compromiso, fecha, monto?, cuenta?, referencia?)` (finanzas.editar | finanzas.flujo): crea la
  transacción TRX-AAAA-NNNN y el disparador hace el resto. **Cuentas por pagar → "Pagado" ahora registra el pago en Finanzas**.
- **La valorización es una cuenta por cobrar**: `flujo_compromisos.valorizacion_id`; presentada/aprobada → compromiso `cobrar`
  (comprometido; vence aprobación + `dias_cobro_valorizacion` (30) o presentación + 45), facturada/pagada → real; pagada → PAGADO.
  Las 16 valorizaciones existentes entraron a la CxC (5 pagadas S/ 27.3 M, 5 presentadas S/ 32.4 M; 6 pendientes no cuentan).
  Fix de paso: `set_flujo_proyecto_from_cc` borraba el proyecto de un compromiso sin CDC; ahora el CDC solo lo añade.
- **`proyecto_cadena(uuid)`** (y bloque "La cadena del proyecto" en Proyecto 360): presupuesto → comprometido (OC aprobadas) →
  recepcionado → facturado (+ en trámite) → pagado / por pagar / vencido (del modelo CxP, sin lo proyectado), y valorizado → cobrado →
  por cobrar (+ `cobrado_registrado` del Excel de Operaciones para contraste). Soles con IGV, dólares al TC de cada documento.
- QA en base (todo limpiado): pago parcial S/ 1,681 sobre US$ 1,000 → PARCIAL 500; + US$ 500 → PAGADO; anulada → PARCIAL; borrada →
  PENDIENTE. Valorización aprobada → CxC vence aprob+30; cobro por transacción → valorización pagada y CxC PAGADO.

**Lo que muestra hoy la cadena (datos reales):** recepcionado = 0 y facturado = 0 en todos los proyectos (nadie registra recepciones ni
suben facturas: es la decisión Compras/Operaciones pendiente); LORETO Bomberos: pagado S/ 34.2 M según el Excel (128 filas PAGADO) con
comprometido en ERP S/ 15.2 M — el Excel de Proyectos trae pagos que no están como OC en el ERP (migración parcial del sistema anterior
o pagos sin OC); cobrado por valorizaciones 16.54 M ≈ Excel 16.54 M. MUNI CUSCO: valorizado 7.06 M, cobrado 6.01 M (Excel 6.01 M).


## Bloque 4 ejecutado — Kardex automático desde la recepción (2026-09-23)

Migraciones `bloque4_kardex_automatico_desde_recepcion` y `bloque4_rpc_movimiento_manual_y_fix_permiso_pago`. Principio de Kevin:
"el kardex debe ser automático". El módulo Inventario estaba vacío (0 artículos, 0 almacenes, 0 movimientos).

- **La recepción conforme ES la entrada**: trigger en `recepcion_items` → `kardex_entrada_recepcion_item()`. El artículo sale del ítem
  de la OC (`orden_items.articulo_id`), del ítem de recepción, o **nace solo** (`articulo_para_item`: busca por nombre; si no existe crea
  `ART-NNNN`, tipo suministro, unidad tal cual de la OC — se quitó el check de unidades —, `origen='oc'`). El almacén es el de la
  recepción o el general (`almacen_por_defecto` crea "Almacén general" ALM-001 si no hay). El movimiento lleva proyecto, OC, recepción,
  ítem, precio de la OC, moneda, TC y `costo_total_soles`.
- **Una sola puerta**: `kardex_registrar()` numera (MOV-AAAA-NNNN), calcula stock anterior/nuevo, actualiza `articulos.stock_actual` y
  `stock_almacen` **por artículo × almacén × proyecto** (índice único con proyecto). El store de Inventario ya no numera ni suma en el
  cliente: llama al RPC `registrar_movimiento_inventario` (inventario.crear|editar, valida stock) y relee.
- **Reversión**: anular la recepción (`estado='rechazado'`) o borrar un ítem genera la salida por devolución y marca la entrada
  `revertido`; reactivarla vuelve a generar la entrada. Editar una recepción (el store borra y reinserta ítems) queda cubierto.
- **Salidas** (consumo, entrega al proyecto/cliente): a mano en Inventario → Movimientos, ahora con selector de proyecto.
- **`v_stock_proyecto`** (cantidad neta valorada al costo promedio de sus entradas, soles sin IGV) y `proyecto_cadena()` gana
  `inventario`, `inventario_items`, `inventario_entradas`, `inventario_salidas`; Proyecto 360 muestra "En inventario (kardex)".
- **Fix Bloque 3**: `registrar_pago_compromiso` usaba `tiene_permiso()` (no existe); el helper real es `auth_tiene_permiso()`.
- QA en base (limpiado): recepción de la OC MM-000878 (USD, TC 3.436) → 2 entradas, 2 artículos creados, almacén general creado,
  `v_stock_proyecto` 4 und / S/ 29,205, cadena recepcionado S/ 34,462 con IGV e inventario S/ 29,205 sin IGV; salida de 1 → 3 und;
  anulación → 2 reversos. Queda creado el almacén **ALM-001 "Almacén general"** (útil como defecto).

**Pendiente de decisión (Compras/Operaciones):** registrar TODAS las recepciones en el ERP; sin eso el kardex y "recepcionado" siguen en
cero aunque el mecanismo ya funcione. Los artículos nacidos de la OC quedan como "suministro / sin categoría": Inventario los puede
reclasificar después.


## Bloque 5 ejecutado — Contable por proyecto (2026-09-23)

Migraciones `bloque5_contable_por_proyecto` y `bloque5_fix_tc_transaccion_usd`. La contabilidad estaba **vacía** (0 cuentas, 0
periodos, 0 asientos, 0 registros; el store escribía el registro de compras con correlativo por conteo y nadie generaba asientos).
Ojo: el plan real es la tabla `plan_cuentas` (PCGE, tipos activo/pasivo/patrimonio/ingreso/gasto/costo/orden); `cuentas_contables` es
legado (solo la referencia `transacciones.cuenta_id`).

- **PCGE sembrado en la base**: `pcge_sembrar(tenant)` (212 cuentas, misma lista que `fiscal-peru.ts`, con `cuenta_padre_codigo`).
- **Configuración por empresa** `contabilidad_config` (`cta_cfg(tenant, clave)` con defaults): `contabilizar_al` = conforme |
  recibida | manual; cuentas 603 (bienes con recepción) / 639 (servicios) / 40111 IGV / 4212 proveedores / 1212 clientes / 7041 ventas /
  1041-1042 bancos. **Decisión pendiente de Contabilidad:** confirmar cuentas y momento (hoy: recibida → al quedar conforme; emitida → al nacer).
- **Periodo automático** `periodo_contable_para(tenant, fecha)`: abre el mes si no existe; si está cerrado, no deja contabilizar ahí.
- **`asiento_crear(...)`**: cabecera AST-AAAA-NNNNNN validada + líneas balanceadas (jsonb), cuenta por código, **CDC en cada línea**.
- **Factura → asiento + registro** (`contabilizar_comprobante`, trigger en `comprobantes_pago`): recibida → Debe 603/639 base (CDC del
  comprobante o del proyecto) + Debe 40111 IGV, Haber 4212 total; emitida → Debe 1212, Haber 7041 + 40111; nota de crédito (07) invierte;
  dólares al TC del comprobante o SUNAT del día; centavos de redondeo van a la base. Inserta la fila de `registro_compras`/`registro_ventas`
  (correlativo máx+1 por periodo) o le pone el `asiento_id` si ya existía. Anular la factura anula asiento y registro.
  RPC `contabilizar_comprobante_rpc` (contabilidad.crear|editar) y botón **Contabilizar** en Comprobantes para lo pendiente.
- **Pago/cobro → asiento de tesorería** (trigger en `transacciones`): egreso pagado con factura contabilizada → Debe 4212 / Haber 1041
  (1042 en USD) en soles; ingreso → Debe banco / Haber 1212. Anular la transacción anula el asiento. Sin factura contabilizada no se
  genera (no hay 42/12 que cancelar; el cobro de una valorización sin factura emitida queda solo en CxC).
  Fix de paso: `transacciones.tipo_cambio` tiene DEFAULT 1 → una transacción USD quedaba con `monto_soles = monto`; ahora TC ≤ 1 en USD
  = tomar SUNAT del día.
- **Vistas** `v_contable_cdc` (por CDC y mes: gasto 6x, ingreso 7x, IGV neto, saldos 42/12) y `v_contable_proyecto`; `proyecto_cadena()`
  gana `contable_gasto`, `contable_ingreso`, `contable_resultado`, `asientos`; Proyecto 360 muestra la fila "Contablemente".
- QA en base (limpiado): factura USD 1,000+IGV conforme sobre OC real → AST-2026-000001 (639 3,362.00 / 40111 605.16 / 4212 3,967.16, las
  tres líneas con CDC, TC 3.362), registro de compras 202609 corr 1; pago → AST-000002 (4212/1042); venta emitida S/ 295,000 →
  1212/7041/40111 con CDC + registro de ventas; `v_contable_proyecto` gasto 3,362 / ingreso 250,000; anulación → asientos y registro
  anulados. Queda abierto el periodo **Septiembre 2026** y el plan de 212 cuentas.

**Lo que muestra hoy:** 0 asientos en todos los proyectos porque no hay facturas en el ERP (misma decisión de adopción de Compras /
portal de proveedores). El mecanismo ya no depende de nadie.


## Bloque 6 ejecutado — Flujo de caja correcto + Proyecto 360 completo (2026-09-23)

Migraciones `bloque6_flujo_de_caja_correcto` y `bloque6_cxc_valorizacion_sin_duplicar_excel`. Respuesta al punto 6 de Kevin ("el Excel
mezcla montos con signo; ¿cómo debe ser un flujo correcto?"):

- **La regla:** ingresos (cobros) − egresos (pagos) = neto del mes; saldo acumulado desde un **saldo inicial de caja** que fija
  Finanzas (`saldo_caja_inicial` + `saldo_caja_fecha` en `parametros_financieros`, RPC `fijar_saldo_caja`; hoy 0 → **Finanzas debe
  fijarlo**). Ningún monto lleva signo: el sentido pagar/cobrar decide la columna.
- **Real vs previsto:** `v_flujo_mensual` ubica cada compromiso en su mes — lo pagado/cobrado en el mes en que ocurrió (`fecha_pagado`,
  o vencimiento si el Excel no trae fecha: 989 de 1,808 pagados no la traen), lo pendiente (comprometido por OC/factura/valorización o
  proyectado) en el mes en que vence; marca vencidos (sin contar CIPRL con fecha estimada). Excluye 3 filas con fecha basura (año 2000).
- **`flujo_caja(desde, hasta, area?, proyecto?)`**: por mes ingresos real/previsto, egresos real/previsto, neto, saldo acumulado (arrastra
  lo ocurrido desde el saldo inicial aunque no esté en el rango), egresos vencidos, conteos. Empresa = arranca del saldo de caja; área o
  proyecto = arranca en 0 (caja del proyecto: cobrado − pagado).
- **UI:** `FlujoCajaMensual` (tabla meses × Ingresos [real/previsto] / Egresos [real/previsto] / Neto / Saldo, navegación por trimestres,
  edición del saldo inicial con finanzas.editar) arriba del Flujo financiero, filtrable por área; en **Proyecto 360 → Finanzas** la caja
  del proyecto (−6/+6 meses). En FlujoFinanciero se corrigió el signo: neto = ingresos − egresos; en la matriz lo que entra suma (azul)
  y lo que sale resta (rojo). Antes decía "neto = egresos − ingresos".
- **Fix de duplicado:** las valorizaciones pagadas entraban al flujo como cobro real del ERP **además** del cobro que ya trae el Excel
  (LORETO: 16.54 M dos veces). Ahora, mientras el Excel sea la fuente de cobros reales, una valorización pagada no crea CxC si el Excel
  ya tiene ese cobro (mismo proyecto, monto ±1 %, sola o agrupada con las demás pagadas del proyecto: Huánuco 2.5 M + 2.23 M = una fila
  de 4,726,500); y el cobro se fecha con la valorización, no con "hoy" (migración `bloque6_cxc_valorizacion_duplicado_agrupado`).
  Quedan como cobro real del ERP solo las 2 de MUNI CUSCO (4.0 M + 2.01 M), que el Excel no trae como filas de cobro.

## Portal de proveedores: correo automático del enlace + acceso de prueba de Kevin (2026-09-24)

Estado real del portal antes de esto: 98 proveedores con cuenta, **8 entraron alguna vez, 0 facturas subidas**, 4 invitaciones en
2,5 meses. El cuello: el enlace de contraseña lo tenía que mandar alguien a mano.

- **`correo-enviar`** (Edge Function interna, x-cron-secret o clave de servicio): puerta única de correo del ERP por **Microsoft Graph**
  (`/users/{remitente}/sendMail`, token de aplicación MS_*). Remitente en `configuracion_tenant` (tabla nueva, clave `correo_remitente`,
  hoy `kcastillo@memphis.pe`; RPC `fijar_configuracion` con admin.editar).
- **`portal-proveedor-alta` v6** llama a `correo-enviar` tras generar el enlace y devuelve `correo_enviado` / `correo_error`; si el correo
  no sale, el enlace sigue saliendo en pantalla para mandarlo a mano. La tarjeta "Portal de Proveedores" muestra el estado.
- **BLOQUEO pendiente de Kevin (Entra ID):** la prueba real devolvió **403 ErrorAccessDenied**: la app de Microsoft del ERP no tiene el
  permiso de aplicación **Mail.Send** con consentimiento de administrador. Al concederlo (Entra → App registrations → la app del ERP →
  API permissions → Microsoft Graph → Application → Mail.Send → Grant admin consent) el envío funciona sin tocar código. Recomendable
  además una *Application Access Policy* de Exchange que limite la app al buzón remitente.
- **Acceso de prueba TEMPORAL (eliminar al terminar):** proveedor `PROV-QA01` "PROVEEDOR DE PRUEBA (KEVIN) S.A.C." RUC **20999999991**
  (email kevinc.2703@gmail.com, cuenta portal `9a1c0000-0000-4000-8000-00000000f0f0`), OC **MM-QA0001** (PEN 5,900, CDC OFCENTRAL) y
  **MM-QA0002** (USD 1,180, proyecto 07CUSHAM26, TC 3.362), 2 compromisos en CxP. Invitación de 72 h generada por SQL. Cuatro XML UBL de
  prueba entregados (FQ01-00000001 completa; 0002/0003 parciales; 0004 excede el saldo → debe rechazarse).
  **Limpieza al terminar:** borrar comprobantes/transacciones/asientos/registros/compromisos/recepciones/movimientos de esas OC, las OC,
  el proveedor, la invitación y el usuario auth; el proyecto 07CUSHAM26 vuelve solo (triggers).

**Lo que muestra hoy (empresa, jun–dic 2026):** ingresos reales 69.1 M (CIPRL/valorizaciones del Excel), egresos reales 66.3 M,
previsto por cobrar 76.1 M (oct–nov), previsto por pagar 75.6 M, vencido sin pagar 22.5 M; saldo acumulado negativo (−60 M a dic) porque
el saldo inicial está en 0 y el Excel trae egresos 2025–2026 sin sus ingresos correspondientes: **el saldo solo tendrá sentido cuando
Finanzas fije el saldo de caja inicial y el flujo tenga todos los cobros**.
