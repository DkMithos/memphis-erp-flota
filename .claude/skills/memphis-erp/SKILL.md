---
name: memphis-erp
description: Reglas de trabajo del ERP Memphis (React + Supabase, tenant KESA/Memphis). Úsalo al empezar cualquier tarea en este repo - código, migraciones, cargas de datos, QA o documentación - para no repetir las correcciones que Kevin ya dio. Cubre commits, migraciones, permisos, QA con usuario temporal, paginación, documentación obligatoria y qué no tocar.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# Reglas de trabajo del ERP Memphis

Memphis ERP es una SPA React 18 + TypeScript + Vite con Supabase (proyecto `icmuqwgrjgjoebnwunnf`, tenant
`e4b16a80-8500-418e-afaa-0e976b7d9b13`, RUC 20603847424, razón social MEMPHIS MAQUINARIAS SAC). Producción:
https://erp.memphismaquinarias.com (Vercel, despliega solo desde `main`). Dueño: Kevin Castillo.

## 1. Antes de tocar nada

- Lee `docs/CONTEXTO-SESION.md` (las últimas entradas) y, si el tema es finanzas/pagos,
  `docs/PLAN-ACCION-SPRINTS-PAGOS.md`; si es carga de datos, `docs/PLAN-CARGA-DATOS-ERP.md`.
- El routing es propio (`src/App.tsx`, `lazyModulo`, `navigateTo`), sin react-router. Las puertas de cada ruta
  están en `src/lib/rbac/rutas.ts`; los permisos son `modulo.accion` (`usePermissions().can('finanzas','ver')`)
  y en SQL `auth_tiene_permiso(modulo, accion)`. El tenant sale del JWT (`auth_tenant_id()`).
- Un usuario con dos roles conserva lo que le quitaste en uno: los permisos se suman.
- El rol **Administrador** ve TODA la información del sistema (regla de Kevin, 16/10/2026): todo módulo nuevo le da todos sus
  permisos y `can()` mantiene el comodín `isAdmin`; nunca excepciones por módulo. Lo que sí: cada persona común ve lo suyo.

## 2. Código

- Pantallas en `src/components/modules/<modulo>/`, acceso a datos en `src/lib/<modulo>/*.ts` (funciones
  `cargarX`, `rpc` con `(supabase as any).rpc`), tipos DB en `src/lib/supabase/types.ts`.
- **Toda tabla con bastante data se pagina** (`usePagination`, 20-30 por página) desde el primer commit. Para
  leer más de 1,000 filas de Supabase se pagina con `.range()` (PostgREST corta en 1,000).
- Filtros que el usuario elige se persisten con `usePersistedState('pantalla.filtro', valor)`.
- Diálogos: `onOpenChange={(o: boolean) => …}`; callbacks de `Select`: `(v: string) => …` (si no, TS7006).
- Fechas `YYYY-MM-DD` se formatean con `timeZone: 'UTC'` o cortando el string; nunca `new Date(iso)` directo.
- Exportar a Excel: `exportToExcelMultiHoja(nombre, [{ nombre, data, headersMap }])` o `BotonExportar`.
- Verifica con `npx tsc --noEmit -p tsconfig.json` y `npx vite build`. Hay errores TS preexistentes (ver
  CONTEXTO); comprueba con `git stash` que un error no es tuyo antes de ignorarlo.
- Pruebas con vitest (`npx vitest run <archivo>`); las que usan archivos reales del scratchpad llevan
  `it.skipIf(!existsSync(RUTA))`.

## 3. Base de datos

- Cambios de esquema y funciones: **migración en `supabase/migrations/<AAAAMMDDHHMMSS>_<nombre>.sql`** y
  aplicada con el MCP de Supabase (`apply_migration` con el mismo SQL). Nunca solo en la base.
- Funciones `security definer` con `set search_path = public` que validan permiso al inicio.
- Reparaciones de datos puntuales van por `execute_sql` y se documentan; no en migraciones.
- En PL/pgSQL: `array_append` en vez de `||` con literales; `select … into` siempre antes de usar un `record`;
  `min(uuid)` no existe (usa `array_agg(... order by ...)[1]`); las subconsultas de un mismo `select` ven la
  foto previa a las funciones que ese mismo statement ejecuta (verifica en un statement aparte).
- pg_safeupdate: desde PostgREST se rechaza `DELETE`/`UPDATE` sin `WHERE` (temporales: `truncate`).
- Triggers que se disparan solos y hay que tener presentes: `trg_factura_compromiso`,
  `trg_comprobante_contabilizar` (se apaga con `set_config('app.sin_asiento','1',true)`),
  `set_transaccion_dimension`, `trg_transaccion_pago`, `trg_recepcion_kardex`, `trg_compromiso_a_cuota`.
- Claves únicas: `comprobantes_pago (tenant, ruc_emisor, tipo, serie, numero)`,
  `movimientos_bancarios (cuenta, numero_doc, fecha, importe)`, `flujo_compromisos` por OC / factura /
  valorización / cuota.
- Para cargas masivas usa el skill `memphis-carga-excel`.

## 4. QA

- Nunca con cuentas reales. Usuario temporal: `auth.users` (+ `auth.identities`, `usuarios_tenant`, `profiles`
  con `onboarding_completado = true`, `usuarios_roles`) con los campos token en `''` (si no, 500 al entrar);
  patrón en CONTEXTO 2026-10-09. Se borra al terminar y se comprueba `count = 0`.
- Pantalla: `preview_start {name: "Memphis ERP Dev Server"}` (puerto 3000); limpiar `localStorage` antes de
  entrar con otro usuario; login con setter nativo de `value` + `dispatchEvent('input')` y click al submit.
- SQL con permisos simulados: `set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated",
  "app_metadata":{"tenant_id":"…"}}', false)`.
- Datos de prueba (facturas, artículos, despachos) se borran; preferir `begin … rollback` cuando se pueda.

## 5. Entregas

- Commits **solo con Kevin como autor**: sin `Co-Authored-By`, sin menciones a herramientas. Mensaje en
  español, imperativo breve: `feat: …`, `fix: …`, `docs: …`. `git -c core.autocrlf=false commit -F msg` y
  `git push origin main`.
- Tras cada tarea: entrada en `docs/CONTEXTO-SESION.md` (fecha, qué se hizo, qué queda, bugs vistos), nota de
  avance en el plan de sprints si aplica, y memoria del proyecto.
- A socios, gerentes o externos nunca se les manda un link de artifact (pide cuenta): PDF o HTML autónomo o
  Excel por `SendUserFile`.
- Editar siempre en la raíz del repo (`C:\Users\URSULA\Proyectos\memphis-erp-flota`), no en worktrees.

## 6. No tocar

- `Contraseñas.xlsx` ni `CLAVE SOL GM.jpeg` (SharePoint). Legajos, boletas y remuneraciones: no se abren ni se
  cargan (BUK es el sistema de planilla).
- Cuentas de usuarios reales (dmendez, William, Shirley…): solo roles/permisos cuando Kevin lo pide.
- Los Excel de SharePoint: se copian al scratchpad, nunca se editan.

## 7. Series y códigos

Vehículos `VEH-AAAA-NNN`, OT `OT-AAAA-NNN`, requerimientos `RQ-NNNNN`, OC `MM-NNNNNN`, OS `MM-S-NNNNNN`,
cotizaciones `COT-NNNN`, recepciones `REC-NNNN`, lotes de pago `LP-…`, despachos `DSP-AAAA-NNNN`,
obligaciones `OBL-AAAA-NNN`, pagos históricos `HIST-AAAA-NNNN`, movimientos de kardex `MOV-AAAA-NNNN`.
