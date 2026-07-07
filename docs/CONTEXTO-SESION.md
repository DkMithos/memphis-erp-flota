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

## 6. Pendientes (prioridad de arriba a abajo)

1. **Auditoría completa** post-lote de fixes (Kevin seguirá navegando y reportando).
2. Decisiones de Kevin sobre `OCs_para_revision_2026-07-06.xlsx` (17 órdenes).
3. RUC real de 2 proveedores peruanos: GEREMIE KEVIN CALLUCO QUISPE (PROV-0324) y
   MOMARENTO EIRL (PROV-0323).
4. ICA V6: sumar 555,965 al cobrado cuando emitan CIPRL.
5. **Optimización pre-producción masiva:** 145 FKs sin índice + 21 políticas RLS initplan
   + consolidar policies múltiples (advisors) — antes de cientos de usuarios concurrentes.
6. Integración **TC SBS/SUNAT** por fecha de emisión (+ backfill por `fecha_emision`).
7. **Rediseño módulo Flota** + sinceramiento de datos de flota.
8. Placeholders por construir: Cronograma/Valorizaciones/Riesgos/Documentos (Proyectos),
   Evaluaciones/Contratos/Talleres (Proveedores) son básicos.
9. Backup programado de Firebase antes de apagar oc-system.

## 7. Último lote entregado (2026-07-07, este commit)

Crashes: Lista de Proyectos (estado liquidacion), detalle de proveedor (bancos/cuentas jsonb),
rutas RQ-/detalles agnósticas, CORS excel-sync. Datos: ICA cobrado, consolidación de 9
proveedores duplicados, CC `GICAPATRUL` creado y 31 órdenes nuevas re-atribuidas a ICA,
`GLORETOBOM` enlazado a Loreto. UX: paginación+orden en gastos de caja y directorio de
proveedores, export Excel de gastos por caja, combobox con búsqueda (Proyecto/CC/cajas),
dashboard real de Proveedores, buscador global ampliado (proveedores/OCs/códigos) y que se
limpia al navegar, Dashboard con watchdog anti-cuelgue, notificaciones navegan a su entidad,
logo Memphis en el PDF de orden.
