# Sprint QA Hardening — Memphis ERP

> Objetivo: dejar el sistema sin errores visibles antes de la visita del QA.
> Inicio: 2026-06-10
> Basado en `AUDITORIA-QA-Codigo.md`

## Tareas del sprint corto (1-2 días)

| # | Tarea | Estado |
|---|---|---|
| 1 | Eliminar/mover los 41 archivos `temp_*` de la raíz | ✅ Hecho |
| 2 | Silenciar `console.log` en producción | ✅ Hecho |
| 3 | Crear `tsconfig.json` strict + tipos React | ✅ Hecho |
| 4 | Code splitting con `React.lazy` para módulos pesados | ✅ Hecho |
| 5 | `<Suspense>` + `<ErrorBoundary>` en el render de rutas | ✅ Hecho |
| 6 | Monitor de errores global (listo para Sentry) | ✅ Hecho |
| 7 | Desactivar Rolling Release Vercel | ⬜ Requiere acción manual del admin en Vercel |
| 8 | Wrapper `safeLocalStorage` con try/catch | ✅ Hecho (helper creado) |

## Bitácora de avances

### Tarea 1 — Limpieza del repo ✅
- 44 archivos basura (`temp_*` + `pr_*.json`) movidos a `scripts/imports-historicos/`.
- `.gitignore` actualizado: `temp_*` y `scripts/imports-historicos/` excluidos.
- Raíz del proyecto limpia.

### Tarea 2 — Silenciar console.log en producción ✅
- Creado `src/lib/shared/logger.ts` (logger condicionado por entorno).
- `vite.config.ts`: `esbuild.pure = ['console.log','console.debug','console.info']` → elimina esos logs del bundle de producción.
- **Verificado en el bundle:** 0 `console.log`, se mantienen 109 `console.error` + 37 `console.warn`.
- En el dev server los logs siguen visibles (no se aplica tree-shaking en local).

### Tarea 3 — tsconfig.json + tipos ✅
- Creado `tsconfig.json` (Vite + React, `strict: true`, `skipLibCheck`, paths `@/*`).
- Creado `src/vite-env.d.ts` (tipos de `import.meta.env`).
- Instalados `@types/react` y `@types/react-dom` (faltaban).

### Tarea 4 — Code splitting ✅
- `vite.config.ts`: `manualChunks` para vendor (react / recharts / supabase / i18n).
- `React.lazy` para módulos pesados y poco usados: Contabilidad (9), BI (2), Inventario (4).
- **Resultado medido:**
  - Bundle principal: **2.6 MB → 1.7 MB**
  - `charts` (recharts, 568 KB) ahora carga solo al abrir BI
  - `supabase` (171 KB) + `i18n` (55 KB) en chunks aparte
  - Cada módulo lazy es un chunk de 5-15 KB bajo demanda

### Tarea 5 — Suspense + ErrorBoundary ✅
- `renderModule()` envuelto en `<Suspense fallback={<LoadingScreen/>}>` dentro del `<ErrorBoundary>` existente.
- Un crash en cualquier módulo lo captura el ErrorBoundary; la carga diferida muestra LoadingScreen.

### Tarea 6 — Monitor de errores global ✅
- Creado `src/lib/shared/error-monitor.ts`: captura `window.onerror` + `unhandledrejection`, con deduplicación.
- Wired en `main.tsx` con `initErrorMonitor()`.
- Listo para enchufar Sentry: `setErrorReporter(Sentry.captureException)` cuando se tenga DSN.

### Tarea 7 — Rolling Release Vercel ⬜
- **Acción manual pendiente del admin:** Vercel → Project Settings → Rolling Releases → Disable.
- (No se puede hacer por código/CLI; requiere la UI de Vercel.)

### Tarea 8 — safeLocalStorage ✅
- Creado `src/lib/shared/safe-storage.ts` (getStorageItem/setStorageItem/removeStorageItem con try/catch).
- Disponible para migrar gradualmente los 20 accesos directos a localStorage.

## Verificación final

- ✅ `npx vite build` exitoso, bundle principal reducido de 2.6 MB a 1.7 MB.
- ✅ Bundle de producción: 0 `console.log`, se mantienen error/warn.
- ✅ Preview en dev: app renderiza Login sin errores en consola.
- ✅ Lazy loading + Suspense no rompen la navegación inicial.

## Pendiente para el sprint medio (post-QA o si hay tiempo)

- Tests E2E con Playwright (smoke test de cada módulo)
- Tests unitarios para stores críticos
- Auditoría a11y con eslint-plugin-jsx-a11y
- try/catch en stores top (sustituir los 166 awaits sin protección)
- Reemplazar non-null assertions críticas por optional chaining
- Migrar los 20 accesos a localStorage al helper safeLocalStorage
- Instalar @sentry/react + DSN y conectar setErrorReporter
