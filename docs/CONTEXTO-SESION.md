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
| Órdenes de compra | 02/07/26 (MM-001067) | 1,131 OCs + items | `migrado_de='oc-system'` / `'oc-excel-2024'` |
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
- ⏳ Pendiente FASE 5: cargas masivas Excel (vehículos y mantenimientos), vehículos
  administrativos (registro + alertas de vencimientos), QR público rediseñado (info
  básica + cumplimiento + último manto fecha/km), rework de VehiculoDetalle (consumo +
  historial nuevo); IA embebida (Kevin consigue API key de Claude en console.anthropic.com).

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
Dominio confirmado: mismo (`/proveedores`). **Siguiente: Fase B** (rol proveedor en Supabase
Auth, alta de credenciales por Memphis, RLS por RUC, UI del portal mínimo) — el end-to-end de
subida se prueba ahí.

### IA embebida (N18) · **EN PAUSA (2026-07-09)**
La jefatura decide primero el monto de créditos a cargar en console.anthropic.com antes de
generar la API key. Diseño previsto sin cambios (Edge Function con Claude API, respeta RLS).

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
