# Auditoría QA integral — 2026-07-03

Doble perspectiva: **usuario común** (recorrido real de la app con un usuario temporal creado y luego eliminado) y **QA del cliente** (integridad de datos, seguridad, performance). Sin push ni deploy; fixes aplicados en local + DB.

---

## 1. Bugs encontrados y CORREGIDOS durante la auditoría

| # | Severidad | Bug | Fix | Verificado |
|---|-----------|-----|-----|------------|
| 1 | 🔴 Crítica | **Órdenes limitadas a 1000**: PostgREST corta en 1000 filas por request; con 1095 OCs, las 95 más antiguas (Excel 2024) desaparecían de la UI sin aviso. Empeoraba con cada orden nueva. | Paginación automática en `dbOrdenesCompra.list()` (helpers.ts) — loop `.range()` de a 1000. Preventivo igual en `dbGastosCajaChica.list()` (717 gastos y creciendo). | ✅ UI muestra 1095 (1046 activas + 49 anuladas = exacto con DB) |
| 2 | 🔴 Alta | **Caja Chica "Vista por Proyecto" sumaba USD + PEN sin convertir**: mostraba "Total: S/ 7,412.31" para HUÁNUCO cuando lo real es S/ 5,842.48 + $ 1,569.83 (≈ S/ 11,179.90). | Totales separados por moneda + equivalente al TC 3.40. | ✅ Muestra ambas monedas + equivalente |
| 3 | 🟠 Media | **React duplicate-key en FinanzasCajaChica** (40 errores de consola): la tabla de gastos por proyecto usaba `key={g.id}` (undefined) → riesgo de filas duplicadas/corruptas al re-render. | `key={g._dbId}`. | ✅ Consola 0 errores |
| 4 | 🟠 Media | **Admin → Usuarios roto (HTTP 400)**: el embed `usuarios_tenant → usuarios_roles` no tenía FK que PostgREST pudiera resolver. Además `osalazar@memphis.pe` tenía rol pero **no ficha** en usuarios_tenant (huérfano). | Ficha creada + FK compuesta `usuarios_roles(tenant_id,user_id) → usuarios_tenant` + reload de schema. | ✅ 3 usuarios listados con sus roles |
| 5 | 🟠 Media | **BI consultaba tabla inexistente** `contratos_proveedor` (404 en cada carga del dashboard). | Typo → `contratos_proveedores` (bi-store.tsx). | ✅ Sin 404 |
| 6 | 🟡 Baja | 5 funciones de trigger con `search_path` mutable (advisor de seguridad). | `ALTER FUNCTION … SET search_path = public` (×5). | ✅ Migración aplicada |

## 2. Recorrido como usuario — TODO FUNCIONA

- **Login + RBAC**: usuario nuevo con rol Administrador entra y opera end-to-end. ✓
- **Panorama de Proyectos**: 3 vistas (Por Fase / Por Año / Tabla); KPIs S/ 143.19M contratado, 11 proyectos, margen 49.6%; cohortes 2024/2025/2026 correctas. ✓
- **Proyecto360 (AMAZONAS)**: cuadra **al céntimo** con el backend (gasto S/ 12,705,957.83; utilidad −S/ 442,424.90; −3.6%). ✓
- **Órdenes**: orden por defecto última→antigua ✓, filtro por proyecto ✓, Excel/PDF ✓, detalle MM-xxx abre ✓ (con Exportar PDF y flujo de aprobación).
- **Recepciones**: "Nueva Recepción" muestra el selector de OCs aprobadas. ✓
- **Proveedores**: 138 filas sin crash. ✓ · **Flota**: 386 vehículos. ✓ · **Caja Chica**: 27 cajas, USD bien formateado. ✓
- **Consola y red**: 0 errores tras los fixes.

## 3. Hallazgos de DATOS (no bloqueantes — decisiones de negocio)

| Hallazgo | Detalle | Acción sugerida |
|---|---|---|
| 9 cajas con saldo negativo | Fieles al Excel (ej. CAJA 1 SOLES −624.59 igual en ambos) | Revisar con Administración: ¿sobregiros reales? |
| 1 gasto con fecha 1900 | Serial de Excel mal parseado en la carga anterior | Se corrige en la re-migración de caja (cierre 30-jun) |
| 454/717 gastos de caja sin proyecto | La mayoría son CCs internos (Oficina Central, etc.) — correcto por diseño | Muestreo de validación |
| 2 OCs sin centro de costo · 2 OCs total ≤ 0 · 15 OCs total ≠ subtotal+IGV | Herencia del Excel 2024 | Lista para revisión de Compras |
| 16 proveedores con RUC inválido (≠ 11 dígitos) | Migrados | Completar/corregir RUCs |
| DB tiene 27 cajas, Excel tiene 30 | Migración anterior llegó al 17-jun | Cubierto por la re-migración pendiente |
| ICA sin presupuesto ni monto_cobrado | No estaba en RESUMEN PROYECTOS | Dato pendiente del usuario / valorizaciones |

## 4. Seguridad

- ✅ **RLS habilitado en el 100% de las tablas** públicas.
- ✅ Funciones de trigger endurecidas (search_path fijo).
- ⚠️ Pendientes: extensión `pg_net` en schema public (moverla); **31 tablas con múltiples políticas permisivas** incluyendo rol `anon` (revisar si anon debe tener políticas en tablas de negocio).

## 5. Performance (clave para #10: cientos de usuarios concurrentes)

Del advisor (257 avisos):
- **145 FKs sin índice** — joins lentos a escala. Prioridad: tablas calientes (ordenes_compra, gastos_caja_chica, ordenes_trabajo, orden_items).
- **21 políticas RLS que re-evalúan `auth.*()` por fila** (initplan) — reescribir como `(select auth.uid())` para evaluar 1 vez.
- **31 multiple permissive policies** — consolidar.
- 59 índices sin uso (limpieza menor) · Auth server con máx. 10 conexiones (subir al escalar).

**Recomendación:** una migración de "optimización pre-producción" (índices FK calientes + initplan + consolidación de policies) antes del go-live multiusuario.

## 6. Nota de auditoría

- Usuario QA temporal `qa.auditoria@memphis.pe` creado para el recorrido y **eliminado** al finalizar (auth + identities + ficha + roles).
