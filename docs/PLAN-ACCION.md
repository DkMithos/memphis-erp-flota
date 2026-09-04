# Plan de acción — de aquí a que el equipo entre

> Fecha: **viernes 04/09/2026**.
> Contexto: Kevin decidió (N69) que **el equipo entra cuando el sistema esté al 100%**.
> Este plan existe para responder una sola pregunta: **¿qué es "al 100%"?** y cómo llegamos.

---

## 1. Dónde estamos, medido

Lo que tiene datos reales y se puede usar hoy:

| Módulo | Volumen |
|---|---|
| **Compras** | 1,297 órdenes · 239 requerimientos · 221 cotizaciones |
| **Proveedores** | 135 |
| **Flota** | 414 vehículos · 433 mantenimientos |
| **Fianzas** | 10 fianzas · 54 cartas · 62 cargos |
| **Finanzas · Caja chica** | 39 cajas · 978 gastos · 139 ingresos |
| **Proyectos** | 11 proyectos · 16 valorizaciones |

Lo que está **vacío**, y por qué importa:

| Vacío | Quién se queda sin trabajar | ¿Es un problema? |
|---|---|---|
| `plan_cuentas` (0) y `asientos_contables` (0) | **Walter** | **Sí. Bloqueante.** Sin plan de cuentas no hay contabilidad |
| `comprobantes_pago` (0) | **Richard** (flujo de facturas) y **Gerencia** (deuda) | **Sí. Bloqueante** para el módulo de CxP |
| `recepciones` (0) | Richard, José, Miguelangel | No: se llenará al operar |
| `transacciones`, `presupuestos` (0) | Carolina, Shirley | No: se llenarán al operar |
| `tareas_proyecto` (0) | Miguelangel | No: se llenarán al operar |

**La distinción importa.** Un módulo vacío porque nadie ha registrado nada todavía se llena solo
cuando el equipo entra. Un módulo vacío porque **le falta su configuración base** —el plan de
cuentas— no se llena nunca por sí mismo, y quien entre a él se va a encontrar con una pared.

---

## 2. Qué significa "al 100%"

Propongo esta definición, para que sea verificable y no una sensación:

> **El sistema está al 100% cuando cada persona del equipo puede abrir su módulo y hacer su
> trabajo completo del día sin necesitar el Excel.**

Con eso, la lista se vuelve concreta:

| Persona | ¿Puede hacer su trabajo hoy? | Qué falta |
|---|---|---|
| **Richard** (compras) | Casi. Crea requerimientos, cotizaciones y órdenes, aprueba, recepciona | El flujo de **facturas y pagos**, que es CxP |
| **Carolina y Shirley** (administración) | Caja chica sí. Fianzas sí | Nada bloqueante |
| **Walter** (contabilidad) | **No** | **Plan de cuentas** y periodos contables |
| **Miguelangel** (proyectos) | Parcial | Presupuesto de 4 proyectos; el resto se llena operando |
| **José** (flota) | Sí | Nada bloqueante |
| **Guillermo y Miguel** (gerencia) | **No** | El **tablero de análisis**, que es lo que pidieron |
| **Lisbet** (cargos) | Sí | Nada bloqueante |

**Tres huecos reales**: contabilidad sin configurar, CxP inexistente, y Gerencia sin tablero.

---

## 3. El plan, en cuatro fases

Las fases están ordenadas por **cuánta gente desbloquean**, no por dificultad.

### Fase 1 · Lo que se puede hacer ya, sin esperar a nadie (3–4 días)

Nada aquí depende de decisiones ni de datos de terceros.

| # | Qué | Desbloquea |
|---|---|---|
| 1.1 | **Tablero de Gerencia, Fase 1** — compromiso mensual, por proyecto, por centro de costo, concentración de proveedores. Con lo ya migrado alcanza | **Guillermo y Miguel** |
| 1.2 | **Alertas de vencimiento** en la campanita y en Teams. El caso que lo justifica ya ocurrió: GORE Huánuco entró a 4 días de renovar y lo vi yo por consulta, no el sistema | Carolina, Shirley |
| 1.3 | **`audit_logs` con triggers** sobre las tablas sensibles (órdenes, caja chica, comprobantes, roles, fianzas) | Control, antes de que entren 12 personas |
| 1.4 | **UI de solicitudes de edición** de órdenes. La tabla y las 53 históricas ya están migradas | Richard |
| 1.5 | **Primera corrida del Excel de Fianzas** — decisión de Kevin, es irreversible | Shirley, Carolina |

### Fase 2 · Configuración base de Contabilidad (2–3 días + Walter)

Es el hueco más duro, porque **no lo puedo llenar solo**: el plan de cuentas es una decisión
contable de la empresa, no un dato que se deduzca.

| # | Qué | Quién |
|---|---|---|
| 2.1 | Cargar el **plan de cuentas** (PCGE) | Walter aporta el suyo; yo lo migro |
| 2.2 | Abrir **periodos contables** del ejercicio | Walter decide desde cuándo |
| 2.3 | **Registro de compras y ventas** en el formato que ya usa para SUNAT | Walter valida el formato |

**Sin el paso 2.1 el módulo de Contabilidad no sirve.** Es lo primero que hay que pedirle.

### Fase 3 · Cuentas por Pagar (5–7 días)

→ [PLAN-CxP.md](PLAN-CxP.md). Es el módulo que cierra dos cosas a la vez: el flujo completo de
Richard y la mitad que le falta al tablero de Gerencia.

| # | Qué |
|---|---|
| 3.1 | Registro de facturas de proveedor con su OC, detracción y retención |
| 3.2 | Programación de pagos y calendario |
| 3.3 | Tablero de Gerencia **Fase 2**: deuda total, vencido, antigüedad, calendario |

Depende de la **tabla de tipos de cambio**, que a su vez depende de que Contabilidad diga qué
fuente usa. Sin eso, ningún total mixto PEN/USD es defendible.

### Fase 4 · Endurecer antes de abrir (2–3 días)

| # | Qué |
|---|---|
| 4.1 | **RLS por rol** (→ [PLAN-RBAC-RLS.md](PLAN-RBAC-RLS.md)). Hoy RLS separa empresas, no roles: con un JWT válido la API devuelve datos que la UI oculta. Ya existe `auth_tiene_permiso()`, que era la pieza que faltaba |
| 4.2 | Repaso de las **21 pantallas con exportación** y del resto de módulos con el criterio de Caja Chica: orden útil, "Volver" correcto, botones que respondan al permiso |
| 4.3 | Recorrido de QA por rol, con un usuario de prueba por cada uno de los 9 roles |

---

## 4. Lo que necesito de otras personas, en un solo lugar

Esto **no avanza sin ellos** y conviene pedirlo todo junto, hoy:

| Quién | Qué | Bloquea |
|---|---|---|
| **Walter** | El **plan de cuentas** que usa la empresa · desde qué periodo abrir · si tiene archivo de **tipos de cambio** | Fase 2 completa y Fase 3 |
| **Richard** | Las **12 órdenes** cuya condición de pago no es una condición · los **59 ítems** marcados "REVISAR" donde la unidad traía un número | Cierra la limpieza de Compras |
| **Operaciones** | Imputar las **353 OCs sin proyecto** — son **12 decisiones**, no 353 | Corte por proyecto del tablero |
| **Miguelangel** | Presupuesto de **4 proyectos** | Presupuesto vs comprometido |
| **Shirley y Carolina** | Los **25 cargos** de carpetas sin fianza (BOMBEROS MOYOBAMBA, Independencia, Surco…): ¿se crean como fianzas históricas? | Solo esos 25 archivos |
| **Kevin** | ¿Se dispara la **primera corrida del Excel** de Fianzas? · ¿**bancos** entran al ERP? · ¿qué leyenda llevan las **56 órdenes** de oc-system sin firma? | 1.5, liquidez, PDF |

---

## 5. Orden recomendado y por qué

1. **Pedir hoy mismo lo del punto 4**, sobre todo el plan de cuentas de Walter. Es lo que más
   tarda en llegar y lo que más bloquea.
2. **Fase 1 en paralelo**, que no depende de nadie. Al terminarla, Gerencia ya tiene qué mirar.
3. **Fase 2** en cuanto Walter responda.
4. **Fase 3 (CxP)**, que es la más larga y la que cierra el círculo.
5. **Fase 4** justo antes de abrir las puertas.

**Estimación:** entre 12 y 17 días de trabajo, pero el camino crítico no es el código: es cuánto
tardan Walter y Operaciones en responder. Si el plan de cuentas llega hoy, se puede solapar todo.

**Lo que recomiendo no hacer:** abrir el sistema al equipo antes de la Fase 4. Doce personas
entrando a la vez a un sistema sin `audit_logs` y sin RLS por rol es exactamente el escenario en
el que un error no deja rastro.
