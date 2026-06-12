# Auditoría QA de Código — Memphis ERP

> Auditoría original: 2026-06-10 (mañana) · **Re-auditoría: 2026-06-10 (tarde, post-sprints)**
> Objetivo: identificar problemas que un QA encontraría antes de su visita

---

# ✅ RE-AUDITORÍA (post sprint corto + sprint medio)

## Antes vs Después

| Métrica | Auditoría original | Re-auditoría | Estado |
|---|---|---|---|
| Archivos `temp_*`/`pr_*` en raíz | 41 | **0** | ✅ |
| `console.log` en bundle de producción | 128 | **0** | ✅ |
| `tsconfig.json` strict | No existía | **Sí** (+ @types/react) | ✅ |
| Bundle principal | 2.6 MB monolítico | **1.7 MB + 20 chunks** (lazy) | ✅ |
| Tests automatizados | 3 archivos huérfanos | **34 tests verdes (5 suites)** | ✅ |
| `npm run lint` | Crasheaba (sin eslint) | **Funcional — 0 errores** | ✅ |
| Bugs `rules-of-hooks` | 4 (crash latente) | **0** | ✅ |
| Stores con loading infinito | 5 | **0** (try/catch/finally) | ✅ |
| `localStorage` writes sin guardar | 4 | **0** | ✅ |
| Monitoreo de errores producción | Nada | **Sentry activo + verificado** | ✅ |
| ErrorBoundary + Suspense en rutas | Parcial | **Global en renderModule** | ✅ |
| Advisors seguridad Supabase | 7 hallazgos (no auditado antes) | **1 aceptado** (pg_net, no corregible) | ✅ |
| Errores Sentry en producción | — | **0 capturados** | ✅ |
| Crons (excel-sync / notif) | — | **395/395 y 12/12 OK, 0 fallos** | ✅ |

## Hallazgos NUEVOS de la re-auditoría (seguridad de BD)

La re-auditoría incluyó el linter de seguridad de Supabase (no corrido en la original):

| Hallazgo | Nivel | Resolución |
|---|---|---|
| `handle_new_user()` SECURITY DEFINER ejecutable vía RPC por anon/authenticated | WARN | ✅ `REVOKE EXECUTE` (migración `20260610000000`) |
| `rls_auto_enable()` ídem | WARN | ✅ `REVOKE EXECUTE` |
| `tenant_email_domains` RLS sin políticas | INFO | ✅ Política SELECT para authenticated |
| `tipos_comprobante_sunat` RLS sin políticas | INFO | ✅ Política SELECT para authenticated |
| `pg_net` en esquema public | WARN | ⚠️ **Aceptado** — pg_net no soporta `SET SCHEMA` (error 0A000); sus funciones viven en esquema `net`. Riesgo bajo, documentado |

## Hallazgos de performance (diferidos, no bloqueantes)

Linter de performance de Supabase: 257 avisos — **144 FKs sin índice** y **60 índices sin uso** (normales en una BD joven; impacto nulo al volumen actual de ~400 vehículos), 21 `auth_rls_initplan` y 31 `multiple_permissive_policies` (optimizaciones de RLS). Se abordarán cuando el volumen de datos lo justifique; quedan registrados aquí para trazabilidad.

## Pendientes conocidos (documentados, no críticos)

- **M5:** 69 non-null assertions (`!`) — diferido (bajo riesgo, mitigado por error-monitor global).
- **129 `console.log` en código fuente** — inofensivos: esbuild los elimina del bundle de producción (verificado: 0 en el bundle). Visibles solo en dev.
- **Pasada a11y completa** por ~40 diálogos de formularios (warning dev-only de Radix; no aparece en producción).
- **7 TODOs** en código (eran 6; +1 legítimo de trabajo en curso).
- **Tests E2E Playwright** — requieren credenciales de prueba.

## Veredicto

El sistema pasa los checks que un QA típico correría: build limpio, lint sin errores, tests verdes, consola de producción limpia, monitoreo activo, seguridad de BD revisada y endurecida, crons sanos. Los riesgos residuales están documentados con justificación.

---

# Auditoría original (2026-06-10 mañana) — histórico

> Build de producción: ✅ exitoso (2.6 MB)

## Resumen ejecutivo

| Categoría | Hallazgos críticos | Riesgo |
|---|---|---|
| Higiene del repo | 41 archivos `temp_*` en raíz | 🔴 Alto (visible) |
| Logs en producción | 128 `console.log` + 134 `console.error/warn` | 🔴 Alto (DevTools lleno) |
| Configuración TS | Sin `tsconfig.json` | 🔴 Alto (sin checks estrictos) |
| Performance | Bundle único de 2.6 MB, 0 lazy loads | 🔴 Alto (carga inicial lenta) |
| Tests | 3 archivos test en todo el proyecto | 🔴 Alto (sin cobertura) |
| Monitoreo de errores | No hay Sentry/equivalente | 🔴 Alto (errores invisibles) |
| ErrorBoundary | Solo 3 usos en toda la app | 🟡 Medio (crashes propagan) |
| Manejo de excepciones | 166 awaits a Supabase sin try/catch en stores | 🟡 Medio |
| Non-null assertions | 69 `!` (riesgo NPE) | 🟡 Medio |
| Seguridad | ✅ Secretos en env vars | 🟢 OK |
| XSS | 1 `dangerouslySetInnerHTML` (shadcn chart, seguro) | 🟢 OK |
| Empty states | 99 manejados | 🟢 OK |

---

## 🔴 Hallazgos críticos (prioridad 1 — antes de QA)

### 1. **41 archivos `temp_*` en la raíz del proyecto**
**Síntoma:** `temp_excel_motos.json`, `temp_match_motos.py`, `temp_moto_b0.sql`...`b7.sql`, `temp_soat_*.sql`, etc. — 41 archivos basura en la raíz.

**Impacto:** Un QA al abrir el repo ve esto y huele a proyecto sin disciplina. Algunos contienen SQL de cargas masivas con datos sensibles.

**Fix:** Mover a `scripts/imports/` o eliminar (la mayoría son cargas históricas ya aplicadas).

### 2. **128 `console.log` y 134 `console.error/warn` en código de producción**
**Síntoma:** El QA abre el DevTools y ve un río de logs. Muchos son sensibles (emails de usuarios, datos de perfiles, errores de auth).

**Ejemplos:**
```ts
console.log('[auth] Sesión recuperada de localStorage para', recovered.user.email);
console.log('[auth] Profile cargado via fetch directo:', profileData.full_name || userId);
console.error("[auth.loadProfile]", error.message);
```

**Fix:** Envolver en `if (import.meta.env.DEV)` o usar un logger condicionado. Los `console.error` mantenerlos pero filtrar por nivel.

### 3. **No hay `tsconfig.json`**
**Síntoma:** El proyecto carece de configuración estricta de TypeScript. Vite transpila sin checks de tipos en producción.

**Impacto:** Errores de tipos (uso de `any`, propiedades inexistentes, parámetros mal tipados) llegan a producción sin alerta.

**Fix:** Crear `tsconfig.json` con `strict: true`, `noUnusedLocals`, `noImplicitAny`. Corregir lo que reviente.

### 4. **Bundle de 2.6 MB sin code splitting**
**Síntoma:** Un único `index-*.js` de 2.6 MB se descarga en la primera visita. **0 lazy imports / Suspense** en todo el código.

**Impacto:** Primera carga lenta (>5s en conexiones 3G). El QA lo verá en "Performance" del DevTools.

**Fix:** `React.lazy()` para módulos pesados (Contabilidad, BI, Inventario completo). Vite auto-divide.

### 5. **Solo 3 archivos de test**
**Síntoma:** Cero cobertura de tests automatizados.

**Impacto:** Cada refactor es ruleta rusa. Un QA preguntará "¿tests?" y la respuesta será "no".

**Fix:** Al menos:
- 1 E2E con Playwright: login + navegar a cada módulo (smoke test)
- Tests unitarios para stores críticos (auth, requerimientos, ordenes)
- Tests de las Edge Functions (con valores mock)

### 6. **Rolling Release Vercel sin desactivar**
Cada deploy queda atrapado al 10% canary hasta que alguien completa manualmente. Si llega un fix urgente durante la visita del QA, no se podrá desplegar inmediato.

**Fix:** Project Settings → Rolling Releases → Disable.

---

## 🟡 Hallazgos importantes (prioridad 2)

### 7. **No hay Sentry ni monitoreo de errores en producción**
Si la app crashea para un usuario, nadie se entera. El QA podría reportar "vi un error y desapareció" y no hay forma de reproducir.

**Fix:** Integrar Sentry (free tier hasta 5k events/mes). 15 min de setup.

### 8. **Solo 3 usos de `<ErrorBoundary>`**
Un crash en cualquier componente profundo tira toda la pantalla a blanco. Sin error boundary por módulo, el QA verá "white screen of death" recurrente.

**Fix:** Envolver cada módulo top-level con `<ErrorBoundary>`.

### 9. **166 `await supabase.*` sin `try/catch` en stores**
Una falla de red genera `Uncaught (in promise)` en consola. El QA verá rojos sin contexto.

**Fix:** Patrón común: cada función de store con try/catch + `toast.error` al usuario.

### 10. **69 non-null assertions (`!`)**
Cada `!` es una promesa al compilador que el valor no es null. Si falla, runtime error (`Cannot read property of undefined`).

**Fix:** Reemplazar por optional chaining (`?.`) o early return con default.

### 11. **20 `localStorage.setItem/getItem` sin try/catch**
Modo privado / iframe / cookies bloqueadas → `localStorage` lanza. Si no se captura, crash.

**Fix:** Wrapper con try/catch o helper centralizado.

### 12. **6 TODOs en código de producción**
Marcadores de código incompleto que el QA encontrará si abre los archivos.

**Fix:** Resolver o convertir a issue de GitHub.

### 13. **Solo 39 `aria-*` en todo el código**
Accesibilidad mínima. Lectores de pantalla no funcionan bien.

**Fix:** Auditar formularios y botones con `eslint-plugin-jsx-a11y`.

### 14. **3 archivos `temp_*` en formatos varios (SQL, Python, JSON)** que no deberían estar versionados ni siquiera en gitignore están listados — son cargas históricas (motos, SOAT, etc.) que sirvieron una vez y deben moverse.

---

## 🟢 Lo que SÍ está bien

- ✅ Secretos correctamente en variables de entorno (`VITE_SUPABASE_*`)
- ✅ Sin `eval()` ni `new Function()` (no inyección de código)
- ✅ Sin XSS aparente (`dangerouslySetInnerHTML` único y es de shadcn chart)
- ✅ Sin URLs hardcoded de producción (solo 1, en un comentario)
- ✅ Build de producción exitoso
- ✅ 99 manejos de empty states encontrados (módulos no crashean sin datos)
- ✅ Multi-tenant con RLS activo en todas las tablas críticas
- ✅ Auth tiene fallback robusto (lo que reparamos hoy mismo)
- ✅ Patrón consistente de stores con providers + hooks

---

## Plan de mitigación priorizado (lo que sugiero hacer YA)

### Sprint corto antes de la visita del QA (1-2 días)

| Acción | Tiempo estimado | Impacto |
|---|---|---|
| Eliminar/mover los 41 archivos `temp_*` a `scripts/imports/` o `.gitignore` | 30 min | Alto visual |
| Crear `tsconfig.json` con `strict: true` y resolver errores fatales | 4-6 h | Alto |
| Wrapper `logger.ts` y reemplazar `console.log` por `logger.debug` (que se silencia en prod) | 2 h | Alto |
| Code splitting con `React.lazy` para Contabilidad, BI, Inventario | 2 h | Alto |
| `<ErrorBoundary>` por cada ruta top-level | 1 h | Alto |
| Setup Sentry (free tier) | 30 min | Alto |
| Desactivar Rolling Release Vercel | 5 min | Medio |
| Wrapper `safeLocalStorage` con try/catch | 30 min | Medio |
| Resolver los 6 TODO | 1-2 h | Bajo |

**Total ~12-18 horas de trabajo** = 2 días de un dev senior.

### Sprint medio (3-5 días siguientes)

| Acción | Tiempo |
|---|---|
| Tests E2E con Playwright: login + smoke test de cada módulo | 1 día |
| Tests unitarios para stores críticos | 1 día |
| Auditoría a11y con `eslint-plugin-jsx-a11y` y resolver lo crítico | 1 día |
| try/catch en los stores top (Auth, Requerimientos, Ordenes, Finanzas) | 1 día |
| Reemplazar non-null assertions críticas por optional chaining | 0.5 día |

### Sprint largo (1 semana+)

| Acción | Tiempo |
|---|---|
| Refactor para reducir bundle a <1 MB (lazy + tree-shaking + dependencias) | 1-2 días |
| Sistema de logs estructurados con niveles (debug/info/warn/error) | 0.5 día |
| Documentación técnica para QA (cómo correr, cómo probar, dónde están los errores) | 0.5 día |

---

## Cosas que el QA va a preguntar (anticipación)

| Pregunta del QA | Respuesta hoy | Respuesta tras mitigación |
|---|---|---|
| "¿Hay tests automatizados?" | "Solo 3 archivos" 🔴 | "Suite E2E + unitarios para stores" |
| "¿Cómo monitorean errores en producción?" | "Console logs" 🔴 | "Sentry + dashboards" |
| "¿Strict mode TypeScript?" | "No hay tsconfig" 🔴 | "Sí, strict + no implicit any" |
| "¿Tiempo de carga inicial?" | "~5-8s con 2.6 MB" 🔴 | "<2s con code splitting" |
| "¿Qué pasa si un módulo crashea?" | "White screen" 🔴 | "ErrorBoundary + reporte" |
| "¿Cómo manejan permisos?" | "RBAC + RLS" 🟢 | Igual |
| "¿Auth corporativo?" | "Entra ID + App Roles" 🟢 | Igual |
| "¿Backups?" | "Supabase diario" 🟡 | "+ política formal + prueba restore" |
| "¿Disaster recovery plan?" | "No documentado" 🔴 | "Documento + procedimiento" |
