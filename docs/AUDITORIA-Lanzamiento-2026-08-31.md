# Auditoría de lanzamiento — Memphis ERP

> Fecha: **jueves 27/08/2026**. Objetivo: lanzamiento el **lunes 31/08/2026**.
> Corte de oc-system: **viernes 28/08** (N34).
> Días hábiles disponibles: **2** (jueves y viernes).

---

## Resumen

| Área | Estado |
|---|---|
| Seguridad de base de datos | ✅ 0 errores. RLS en 97/97 tablas, 113 políticas, ninguna tabla sin política |
| Build y tests | ✅ Build limpio · 34/34 tests · 4 errores de lint benignos |
| Datos de Compras | ✅ 1,286 OCs · 236 req · 217 cot · numeración sin colisión |
| Datos de Caja Chica | ✅ 39 cajas · 969 gastos · cuadra al 100% con el Excel |
| Datos de Flota | ✅ 414 vehículos, todos con QR funcional (RPC verificado) |
| **Usuarios del equipo** | 🔴 **BLOQUEANTE** |
| **Producción desactualizada** | 🔴 **BLOQUEANTE** |
| **Permisos por rol** | 🔴 **BLOQUEANTE** |

---

## 🔴 Bloqueantes

### B1 · El equipo no tiene cuentas, y el alta de usuarios está rota

Hoy hay **4 usuarios** en el tenant: Kevin, osalazar, un consultor y `admin@kesa.com`
(este último **sin rol asignado**). De los 4, solo 3 tienen rol. Las otras 99 cuentas de
`auth.users` son portales de proveedores y talleres.

Peor: el diálogo **"Nuevo Usuario"** de Administración usa `supabase.auth.signUp()`
(`GestionUsuarios.tsx:383`). Eso tiene tres problemas:

1. **`signUp` reemplaza la sesión del navegador.** El administrador que cree un usuario queda
   logueado como el usuario recién creado.
2. El administrador tiene que **inventar y teclear la contraseña** de cada persona, y luego
   comunicársela por fuera.
3. Depende del correo de confirmación; no hay SMTP propio configurado.

**Arreglo:** una Edge Function con la Admin API, igual al patrón que ya funciona en
`portal-proveedor-alta` y `portal-taller-alta`: crea la cuenta con `email_confirm: true` y
devuelve un enlace de un solo uso para que la persona fije su propia contraseña. El código de
referencia ya existe en el repo; es adaptarlo, no inventarlo.

**Depende de:** el archivo de usuarios y accesos que está armando Kevin.

### B2 · Producción está 3 días atrasada

Último despliegue en Vercel: **24/08**. No están desplegados:
- El arreglo del PDF de la orden (la sección PROVEEDOR salía vacía).
- El mapeo de la columna `contacto`.

La base sí tiene todos los cambios de hoy. Como son aditivos no rompen la versión vieja, pero el
equipo entraría el lunes a una versión sin el arreglo del PDF.

### B3 · Permisos por rol sin validar (N19)

Existen **8 roles**, **48 permisos** y **95 asignaciones**, pero nadie ha verificado que cada rol
vea y pueda hacer exactamente lo que corresponde. Con 4 usuarios daba igual; con el equipo
completo y datos financieros reales, no.

---

## 🟠 Importantes

### I1 · 23 órdenes pierden el descuento por ítem — y la fuente se apaga mañana

`orden_items` no tiene columna `descuento`. El legado sí lo guarda por ítem.

- **23 OCs** con **118 ítems** descontados, **S/3,025.53** de descuento.
  *(Al escribir esto estimé ~S/30,511 asumiendo que el descuento era un porcentaje. Al resolverlo
  se comprobó que es un MONTO: la cifra real es S/3,025.53.)*
- El PDF imprime la columna "Dscto" siempre en **S/0.00**, y el detalle **no cuadra con el
  subtotal**: diferencias de 14% a 25% (ej. MM-000590: ítems S/6,638.68 vs subtotal S/5,714.32).
- Afecta también a órdenes recién cargadas (MM-001159 tiene 25% de descuento).

El dato vive en oc-system, que se apaga el viernes. **Sí lo tengo en el volcado local**
(`ordenesCompra_full.json`), así que es recuperable, pero conviene hacerlo antes de que ese
volcado sea la única copia.

**Resuelto el 27/08** (commit `ec8e8d05`): columna `descuento` en `orden_items` y
`cotizacion_items`, `precio_total` pasa a neto, y 118 + 91 ítems rellenados desde el volcado.
Las órdenes descuadradas de oc-system bajaron de 24 a 3 (diferencias de céntimos).
De paso salió que el transform de cotizaciones trataba el descuento como porcentaje: se
recalcularon los totales de las 217 cotizaciones desde sus ítems.

### I2 · `audit_logs` no registra nada

La tabla existe, la pantalla de Auditoría existe, pero hay **0 filas y 0 triggers** que escriban
en ella. Para un ERP financiero con varios usuarios entrando el lunes, no tener rastro de quién
aprobó, modificó o anuló es una carencia de control real.

### I3 · Dos Edge Functions están abiertas a internet — CONFIRMADO

`excel-sync` y `notif-scheduler` están desplegadas con `verify_jwt: false` y usan la
**service role key**. Solo se protegen si la variable `CRON_SECRET` está configurada:

```
if (cronSecret) { ...valida el header... }   // si NO está seteada, no valida nada
```

**Confirmado que NO está seteada.** Dos evidencias:

1. El cron `notif-scheduler-diario` **no envía** el header `x-cron-secret`
   (`supabase/migrations/20260529000000_cron_notif_scheduler.sql`; el comentario dice que
   puede endurecerse "si se desea").
2. Esa llamada diaria devolvió **HTTP 200** hoy 27/08 a las 13:00 UTC
   (`net._http_response`). Si el secreto estuviera configurado habría devuelto 403.

**Impacto real:** cualquiera que conozca la URL puede disparar la sincronización de proyectos
o el envío de notificaciones a Teams. No hay inyección de datos arbitrarios — `excel-sync`
ignora el body y lee la configuración de la propia base — pero sí abuso de recursos, consumo
de cuota de Microsoft Graph y sobrescritura del espejo de proyectos a demanda.

**Arreglo (10 minutos):** setear `CRON_SECRET` en los secretos del proyecto y **volver a
programar el cron con el header** `x-cron-secret`, o el trabajo diario empezará a fallar con 403.
Nota: el cron `excel-sync-30min` (jobid 2) está **inactivo**, consistente con N27.

### I4 · `ms-debug` — sin riesgo (corrección)

Lo marqué como función de depuración viva. Al leer su código desplegado resultó que **ya estaba
neutralizada desde el 28/05**: devuelve 410 y no ejecuta nada, y tiene `verify_jwt: true`.
No es un riesgo, solo queda como resto. Borrarla requiere el dashboard o la CLI (el MCP no
expone borrado de funciones), así que queda como limpieza opcional, no como pendiente de
lanzamiento.

### I5 · `sunat-proxy` no tiene ninguna autenticación

`verify_jwt: false` y sin gate por secreto. Riesgo bajo (es un proxy de consulta), pero queda
abierta a abuso desde fuera.

---

## 🟡 Menores y deuda conocida

| # | Hallazgo | Nota |
|---|---|---|
| M1 | **343 OCs sin proyecto** | Ya conocido. Son CCs internos o compras sin imputar |
| M2 | ~~61~~ **40** OCs con subtotal ≠ suma de ítems | 37 del Excel 2024 (histórico agregado) + 3 por céntimos. Las 24 de I1 quedaron resueltas |
| M3 | 2 OCs con total 0 (MM-000057, MM-000061) y 2 sin CC (MM-000787, MM-000635) | Del legado |
| M4 | **7 de 9 flotas sin contrato** | El flujo de mantenimiento por QR no puede derivar tarifario sin contrato |
| M5 | 98 cuentas de portal de proveedores creadas, **solo 6 ingresos en total** al sistema | Los proveedores no se han onboardeado |
| M6 | 35 gastos de caja sin centro de costo | Menor |
| M7 | `flota_public_tokens` tabla muerta (0 filas) | Los tokens viven en `vehiculos.public_token`; la tabla sobra |
| M8 | `PROV-TEST1` ("PORTAL TEST S.A.C.") sigue en proveedores | Residuo de pruebas del portal |
| M9 | 4 errores de lint + 233 warnings | Los 4 errores son ternarios usados como sentencia; funcionan bien |
| M10 | `src/components/modules/placeholders.tsx` es código muerto | App.tsx importa los componentes reales |
| M11 | 66 FK sin índice, 89 índices sin uso | INFO del advisor. Irrelevante al volumen actual |

### Módulos que el lunes se verán vacíos

Si alguien entra a estos, no verá nada. Conviene decidir si se ocultan del menú o se avisa al equipo:

**Inventario** (0 artículos, 0 almacenes, 0 movimientos) · **CRM** (0 clientes, 0 oportunidades) ·
**Finanzas** (0 transacciones, 0 presupuestos) · **Contabilidad** (0 asientos) ·
**Biomédico** (0 equipos) · **Recepciones** (0) · **Facturas de proveedores** (0) ·
**Valorizaciones** (0) · **Tareas de proyecto** (0) · **Contratos y evaluaciones de proveedores** (0).

---

## Lo que sí está sólido

- **Seguridad:** 0 errores en el advisor. Los 4 warnings son por diseño: dos funciones
  `SECURITY DEFINER` intencionales (QR público y portal de talleres), `pg_net` en public (default
  de Supabase) y políticas permisivas múltiples donde conviven portal y tenant.
- **RLS completo:** 97 de 97 tablas con RLS activo y ninguna sin política.
- **Compras al día:** 1,286 OCs (incluidas las 64 del delta de ayer), MM-001117 sincronizada,
  próxima numeración MM-001223 sin colisión con el portal.
- **Caja chica cuadrada:** 39 cajas, 969 gastos, 139 ingresos — idéntico al Excel de Administración.
- **Flota:** 414 vehículos, todos con `public_token`; probé el RPC `vehiculo_public_by_token` y
  responde correctamente.
- **11 Edge Functions activas.**
- **Build limpio y 34/34 tests en verde.**

---

## Plan sugerido para los 2 días

**Jueves (hoy) — ✅ ejecutado**
1. ✅ Desplegado (commits `4467e842`, `336d0718`, `78d2b5ad`) — PDF de la orden resuelto.
2. ✅ Edge Function `usuarios-alta` v3 + pantalla `FijarClave` + pantalla de Administración
   reconectada. Probado contra el proyecto: alta con rol, dominio ajeno 422, sin sesión 401,
   sin permiso 403, no puede autodesactivarse, idempotente y conserva el cargo.
3. ✅ Descuentos rescatados antes del corte: 118 ítems de orden (S/3,025.53) y 91 de cotización
   (S/3,217.64). Las órdenes descuadradas de oc-system pasaron de 24 a 3 (por centavos).
4. ⏳ **`CRON_SECRET` sigue pendiente — requiere a Kevin** (ver receta abajo). `ms-debug` no era
   riesgo (I4).

### Receta para cerrar I3 (2 minutos, la hace Kevin)

El orden importa: si se setea el secreto sin tocar el cron, el trabajo diario empieza a fallar
con 403.

1. Dashboard → Project Settings → Edge Functions → Secrets → añadir `CRON_SECRET` con un valor
   aleatorio largo.
2. Pasarme ese valor y reprogramo el cron para que envíe el header `x-cron-secret`
   (guardándolo en Vault, no en texto plano dentro de `cron.job`).
3. Con eso, `excel-sync` y `notif-scheduler` dejan de estar abiertas.

**Viernes**
5. Corte de oc-system y backup de Firebase (N34 + Fase 7).
6. Cargar los usuarios del equipo en cuanto llegue el archivo, y afinar permisos por rol (B3).
7. Decidir qué módulos vacíos se ocultan del menú.

**Queda fuera del alcance del lunes:** el módulo de CxP (plan en [PLAN-CxP.md](PLAN-CxP.md)),
las alertas (N28) y los `audit_logs` (I2) — este último recomiendo priorizarlo justo después
del lanzamiento.
