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

---

# Sprint medio (en progreso)

| # | Tarea | Estado |
|---|---|---|
| M1 | Suite de tests unitarios para lógica de negocio crítica | ✅ Hecho (34 tests) |
| M2 | Componente `VisuallyHidden` + fix a11y de diálogos sin título | ✅ Hecho (parcial) |
| M3 | eslint funcional (`npm run lint` hoy falla — eslint no instalado) | ⬜ Pendiente |
| M4 | try/catch en stores top (166 awaits) — mitigado por error-monitor global | 🟡 Parcial |
| M5 | Reemplazar non-null assertions críticas por optional chaining | ⬜ Pendiente |
| M6 | Migrar accesos a localStorage al helper safeLocalStorage | ⬜ Pendiente |
| M7 | Conectar @sentry/react + DSN a setErrorReporter | ⬜ Pendiente (requiere cuenta Sentry) |

## Bitácora sprint medio

### M1 — Suite de tests unitarios ✅
- Instalado **Vitest 2** + `vitest.config.ts` (env de prueba para módulos que importan Supabase).
- Scripts: `npm test` (run) y `npm run test:watch`.
- **34 tests, 5 archivos, todos en verde**, cubriendo lógica de negocio crítica:
  - `approval-flow.test.ts` (8) — ruteo de aprobaciones por monto + conversión USD→PEN
  - `proyecto-financiero.test.ts` (10) — formato de montos + semáforos de ejecución/margen
  - `vehiculos-config.test.ts` (5) — saldo preventivo de flota (preventivos realizados/restantes, costos)
  - `ot-config.test.ts` (6) — generación/validación de correlativos de OT
  - `requerimientos-config.test.ts` (5) — normalización de email + correlativos REQ
- Son funciones puras (sin DB, sin red) → rápidas y deterministas.

### M2 — Accesibilidad de diálogos ✅ (parcial)
- Detectado warning real de Radix (dev-only): `DialogContent requires a DialogTitle`.
- Creado `src/components/ui/visually-hidden.tsx`.
- Sidebar móvil (`App.tsx`) ahora incluye `<SheetTitle>` oculto → **verificado en preview: el diálogo tiene `aria-labelledby` con texto** ("Menú de navegación").
- **Nota:** el warning es solo en modo dev (Radix lo elimina en producción), así que el QA NO lo verá en `erp.memphismaquinarias.com`. Queda pendiente una pasada completa por los ~40 diálogos/sheets de formularios para los que aún no tienen título visible (no urgente — no afecta producción).

### M4 — Manejo de errores en stores 🟡
- **Mitigación principal ya en lugar:** el `error-monitor.ts` global (sprint corto) captura cualquier `unhandledrejection` de un store que falle, lo deduplica y lo enruta por `logger.error` en vez de una traza roja cruda. Esto cubre el peor caso visible para el QA.
- Pendiente: try/catch explícito + `toast.error` al usuario en los stores más usados (Auth ya hecho, faltan Finanzas/Compras/Inventario).

## Pendiente sprint medio (siguiente iteración)

- **M3 eslint:** instalar eslint + config flat + `eslint-plugin-jsx-a11y`; corregir lo crítico. (Hoy `npm run lint` falla porque eslint no está instalado.)
- **M4:** try/catch + toast en stores Finanzas/Compras/Inventario.
- **M5:** reemplazar non-null assertions (`!`) críticas por `?.`.
- **M6:** migrar los 20 accesos directos a localStorage al helper `safe-storage.ts`.
- **M7:** crear cuenta Sentry, instalar `@sentry/react`, llamar `setErrorReporter(Sentry.captureException)` en `main.tsx`.
- **Pasada a11y completa:** títulos en los ~40 diálogos/sheets de formularios restantes.
- **Tests E2E (Playwright):** smoke test de login + navegación por módulos (requiere credenciales de prueba).
