# Plan de Acción: Vista Gerencial de Proyectos — Memphis ERP

## Fecha: 2026-05-28 (actualizado)
## Solicitado por: Gerencia General
## Objetivo: Dashboard ejecutivo con vista general de todos los proyectos + vista ultra detallada por proyecto

---

## REGLA DE NEGOCIO CLAVE

> **Cálculo financiero = Órdenes de Compra + Cajas Chicas. NUNCA OTs.**
> Cada OT genera una OC. Si se suman ambas, se duplica. Las OTs son solo para control de mantenimientos (cantidad, estado, saldo preventivo), NO para cálculo de costos del proyecto.

---

## 1. DIAGNÓSTICO — Estado Actual

### 1.1 ¿Qué existe vs qué falta?

| Requerimiento de Gerencia | Estado | Detalle |
|---|---|---|
| Lista general de proyectos con KPIs | ⚠️ Parcial | ProyectosDashboard existe pero sin financiero consolidado |
| Monto contratado | ✅ Existe | `monto_contrato` en ProyectoDB |
| Adendas (montos individuales) | ❌ No existe | Solo hay `monto_adenda` como suma. Falta detalle por adenda |
| Utilidad y margen de ganancia | ❌ No existe | No hay cálculo |
| Presupuesto = techo/tope de gasto | ✅ Existe | `presupuesto` en ProyectoDB |
| Cuánto vamos gastando del techo | ❌ No calculado | `costo_real` es manual, no se alimenta de OCs + Caja Chica |
| Cuánto nos queda por gastar | ❌ No calculado | Depende del punto anterior |
| Gastos por OCs del proyecto | ⚠️ Parcial | `proyecto_id` existe en ordenes_compra, no se consolida |
| Gastos por Caja Chica del proyecto | ⚠️ Parcial | `proyecto_id` existe en gastos_caja_chica, no se consolida |
| Qué tiene el proyecto (activos) | ⚠️ Parcial | Solo vehículos. Equipos bio NO tienen proyecto_id |
| Flota: cantidad, tipos, mantenimientos | ✅ Existe | Proyecto360 ya calcula esto |
| Saldo preventivo por vehículo y total | ✅ Existe | calcSaldoPreventivo() funciona |
| Avance del proyecto | ✅ Existe | porcentaje_avance |
| Fase actual | ✅ Existe | Fases con estado |
| Riesgos | ⚠️ localStorage | No persiste en Supabase |
| Estado del proyecto | ✅ Existe | 5 estados |
| Responsable del proyecto | ⚠️ Texto libre | `gerente_proyecto` no es FK a usuario |
| Eficiencia del equipo | ❌ No existe | No hay métricas por persona |

---

## 2. ARQUITECTURA DE LAS DOS VISTAS

### VISTA 1: Panorama General (todos los proyectos)
**Ruta:** `/proyectos/gerencial`
**Propósito:** Gerencia abre una sola pantalla y ve el estado de TODOS los proyectos de un vistazo.

```
┌─────────────────────────────────────────────────────────────────┐
│  PANORAMA DE PROYECTOS                              [Exportar]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KPIs GLOBALES                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 8        │ │ S/ 15.2M │ │ S/ 8.7M  │ │ S/ 6.5M  │          │
│  │ Proyectos│ │ Ingreso  │ │ Gastado  │ │ Utilidad │          │
│  │ Activos  │ │ Total    │ │ Total    │ │ Est.     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  TABLA DE PROYECTOS                                             │
│  ┌─────┬──────────┬────────┬────────┬────────┬──────┬────────┐ │
│  │ ID  │ Nombre   │Ingreso │Gastado │ Saldo  │Margen│ Estado │ │
│  ├─────┼──────────┼────────┼────────┼────────┼──────┼────────┤ │
│  │PRY01│ GORE ICA │ 2.5M   │ 1.2M   │ 800K   │ 52%  │●En Ej.│ │
│  │PRY02│ MUN LIMA │ 1.8M   │ 1.6M   │ 50K    │ 11%  │⚠️Riesgo│ │
│  │PRY03│ GORE ARQ │ 3.0M   │ 0.5M   │ 1.5M   │ 83%  │●Inicio│ │
│  └─────┴──────────┴────────┴────────┴────────┴──────┴────────┘ │
│                                                                 │
│  Por cada fila: barra de consumo de presupuesto                 │
│  Click en fila → Vista Detallada del proyecto                   │
│                                                                 │
│  ALERTAS                                                        │
│  🔴 PRY-02: Presupuesto al 94% — solo quedan S/ 50K            │
│  🟡 PRY-05: 3 vehículos con preventivos agotados               │
│  🟡 PRY-01: Adenda pendiente de registro                       │
└─────────────────────────────────────────────────────────────────┘
```

**Columnas de la tabla general:**
| Columna | Fuente |
|---------|--------|
| Código + Nombre | proyectos.codigo, nombre |
| Entidad/Cliente | proyectos.entidad_cliente |
| Responsable | proyectos.responsable (nuevo FK) |
| Ingreso Total | monto_contrato + Σ adendas |
| Presupuesto (Techo) | proyectos.presupuesto |
| Gastado | Σ OCs completadas + Σ Caja Chica aprobados |
| Saldo Disponible | Presupuesto − Gastado |
| % Consumo | Gastado / Presupuesto × 100 (barra visual) |
| Utilidad Est. | Ingreso Total − Gastado |
| Margen % | Utilidad / Ingreso × 100 |
| Avance % | porcentaje_avance |
| Flota | Conteo vehículos |
| Estado | Badge de color |

---

### VISTA 2: Detalle Ultra del Proyecto
**Ruta:** `/proyectos/gerencial/:dbId`
**Propósito:** Al hacer click en un proyecto, se abre TODO lo que Gerencia necesita saber.

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Volver    PRY-2026-001 · GORE ICA         ● En Ejecución     │
│              Gobierno Regional de Ica · OXI                     │
│              Responsable: Juan Pérez          Quedan 145 días   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ═══════════════ FINANCIERO ═══════════════                     │
│                                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ INGRESO   │ │ TECHO     │ │ GASTADO   │ │ UTILIDAD  │      │
│  │ TOTAL     │ │ (Presup.) │ │ REAL      │ │ ESTIMADA  │      │
│  │S/ 2,500,000│ │S/ 1,800,000│ │S/ 1,200,000│ │S/ 1,300,000│  │
│  │           │ │           │ │           │ │           │      │
│  │ Contrato: │ │           │ │ 67% del   │ │ Margen:   │      │
│  │ 2,000,000 │ │           │ │ techo     │ │ 52%       │      │
│  │ Adendas:  │ │           │ │           │ │           │      │
│  │ 500,000   │ │           │ │           │ │           │      │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘      │
│                                                                 │
│  CONSUMO DEL PRESUPUESTO                                        │
│  ████████████████████░░░░░░░░░  67%                             │
│  Gastado: S/ 1,200,000  │  Disponible: S/ 600,000              │
│                                                                 │
│  Desglose de gastos:                                            │
│  ├── Órdenes de Compra: S/ 1,050,000 (87.5%)                   │
│  │   ├── OC-2026-045: Repuestos Toyota — S/ 45,000             │
│  │   ├── OC-2026-051: Llantas Bridgestone — S/ 32,000          │
│  │   └── ... (ver todas)                                        │
│  └── Caja Chica: S/ 150,000 (12.5%)                            │
│      ├── Caja Soles: S/ 120,000                                │
│      └── Caja Dólares: $ 8,500 (~S/ 30,000)                    │
│                                                                 │
│  ═══════════════ ADENDAS ═══════════════                        │
│  ┌────┬──────────────────────┬───────────┬────────────┐        │
│  │ N° │ Descripción          │ Monto     │ Fecha      │        │
│  ├────┼──────────────────────┼───────────┼────────────┤        │
│  │ 1  │ Ampliación zona sur  │ S/ 300,000│ 15/03/2026 │        │
│  │ 2  │ Equipos adicionales  │ S/ 200,000│ 01/05/2026 │        │
│  └────┴──────────────────────┴───────────┴────────────┘        │
│                                                                 │
│  ═══════════════ ACTIVOS DEL PROYECTO ═══════════════           │
│                                                                 │
│  ┌─── FLOTA ───────────────────────────────────────────┐       │
│  │ 50 vehículos                                        │       │
│  │ ● 45 activos  ● 3 en taller  ● 2 inactivos         │       │
│  │                                                      │       │
│  │ Por tipo:                                            │       │
│  │  Camionetas: 40  │  Ambulancias: 8  │  Buses: 2     │       │
│  │                                                      │       │
│  │ MANTENIMIENTOS                                       │       │
│  │  Realizados: 120 de 200 (60%)                        │       │
│  │  Pendientes: 80                                      │       │
│  │  ████████████░░░░░░░░░  60%                          │       │
│  │                                                      │       │
│  │ SALDO PREVENTIVO (si hay contrato de mant. pagado)   │       │
│  │  Total contratado: S/ 500,000                        │       │
│  │  Consumido:        S/ 320,000 (64%)                  │       │
│  │  Disponible:       S/ 180,000                        │       │
│  │  ████████████████░░░░░░░░░  64%                      │       │
│  │                                                      │       │
│  │  Detalle por vehículo:                               │       │
│  │  ┌───────┬───────┬────────┬─────────┬───────┬────┐  │       │
│  │  │Placa  │Tipo   │Prev R/T│Contrat. │Consum.│Saldo│  │       │
│  │  ├───────┼───────┼────────┼─────────┼───────┼────┤  │       │
│  │  │ABC-123│Camion.│ 3/6    │ 12,000  │ 6,000 │6,000│  │       │
│  │  │DEF-456│Ambul. │ 2/4    │ 8,000   │ 4,000 │4,000│  │       │
│  │  │...    │       │        │         │       │     │  │       │
│  │  │TOTAL  │       │120/200 │500,000  │320,000│180K │  │       │
│  │  └───────┴───────┴────────┴─────────┴───────┴────┘  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─── EQUIPOS BIOMÉDICOS ──────────────────────────────┐       │
│  │ 15 equipos                                          │       │
│  │ ● 12 operativos  ● 2 en mantenimiento  ● 1 baja    │       │
│  │ Categorías: 8 diagnóstico, 5 tratamiento, 2 soporte │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  ═══════════════ AVANCE Y EJECUCIÓN ═══════════════             │
│                                                                 │
│  Avance general: 45%  ████████░░░░░░░░░░                        │
│  Fase actual: Fase 2 — Implementación                           │
│                                                                 │
│  ┌──────────────────┬────────┬─────────┬──────────────┐        │
│  │ Fase             │ Estado │ Avance  │ Presup/Costo │        │
│  ├──────────────────┼────────┼─────────┼──────────────┤        │
│  │ 1. Movilización  │ ✅ 100%│ ████████│ 200K / 195K  │        │
│  │ 2. Implementación│ ● 60%  │ ██████░░│ 800K / 480K  │        │
│  │ 3. Operación     │ ○ 0%   │ ░░░░░░░░│ 600K / 0     │        │
│  │ 4. Cierre        │ ○ 0%   │ ░░░░░░░░│ 200K / 0     │        │
│  └──────────────────┴────────┴─────────┴──────────────┘        │
│                                                                 │
│  ═══════════════ RIESGOS ACTIVOS ═══════════════                │
│  🔴 Alto: Retraso en entrega de equipos (impacto: cronograma)   │
│  🟡 Medio: Tipo de cambio USD/PEN volátil (impacto: costos)    │
│                                                                 │
│  ═══════════════ EQUIPO ═══════════════                         │
│  Responsable: Juan Pérez (última actualización: hace 2 días)    │
│  Miembros: 5 personas asignadas                                │
│  Tareas: 12 completadas, 8 en progreso, 3 pendientes           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. MODELO FINANCIERO (CORREGIDO)

```
PROYECTO
├── Monto Contrato (ingreso base)
├── Σ Adendas (tabla adendas_proyecto)
├── = INGRESO TOTAL
│
├── Presupuesto (TECHO — lo máximo que podemos gastar)
│
├── GASTO REAL (calculado automáticamente):
│   ├── Σ Órdenes de Compra (completadas/recibidas) del proyecto
│   └── Σ Gastos Caja Chica (aprobados) del proyecto
│   = GASTO TOTAL
│
│   ⚠️ LAS OTs NO ENTRAN EN EL CÁLCULO FINANCIERO
│   (cada OT genera una OC, sumar ambas duplicaría)
│
├── SALDO DISPONIBLE = Presupuesto − Gasto Total
├── % CONSUMO = Gasto Total / Presupuesto × 100
│
├── UTILIDAD ESTIMADA = Ingreso Total − Gasto Total
└── MARGEN % = Utilidad / Ingreso Total × 100
```

---

## 4. PLAN DE IMPLEMENTACIÓN

### Sprint 1 — Fundación (Semana 1-2)

| # | Tarea | Archivos |
|---|-------|----------|
| 1 | Migration: tabla `adendas_proyecto` | `supabase/migrations/` |
| 2 | Types + helpers + store para adendas | `types.ts`, `helpers.ts`, `proyectos-store.tsx` |
| 3 | `proyecto-financiero.ts` — queries Supabase: OCs + Caja Chica por proyecto, cálculos de utilidad/margen | Nuevo archivo |
| 4 | Migration: `proyecto_id` en `equipos_biomedicos` | `supabase/migrations/` |
| 5 | Actualizar equipos-store con `proyectoId` | `equipos-store.tsx` |

### Sprint 2 — Vista General (Semana 2-3)

| # | Tarea | Archivos |
|---|-------|----------|
| 6 | `ProyectosPanorama.tsx` — vista general con KPIs globales + tabla comparativa de todos los proyectos con barras de consumo y alertas | Nuevo |
| 7 | Queries paralelas para KPIs globales (totales de ingreso, gasto, utilidad de todos los proyectos) | `proyecto-financiero.ts` |
| 8 | Sistema de alertas: presupuesto >90%, preventivos agotados, proyectos retrasados | `proyecto-financiero.ts` |

### Sprint 3 — Vista Ultra Detallada (Semana 3-4)

| # | Tarea | Archivos |
|---|-------|----------|
| 9 | `ProyectoGerencial.tsx` — header + KPIs financieros + barra consumo | Nuevo |
| 10 | Sección financiera: desglose OCs + Caja Chica con tablas expandibles | Componente dentro de Gerencial |
| 11 | Sección adendas: tabla CRUD | Componente dentro de Gerencial |
| 12 | Sección activos - Flota: vehículos por tipo, mantenimientos, saldo preventivo por vehículo y total | Componente dentro de Gerencial |
| 13 | Sección activos - Equipos bio: conteo por categoría y estado | Componente dentro de Gerencial |
| 14 | Sección avance: fases con presupuesto vs costo por fase | Componente dentro de Gerencial |
| 15 | Sección riesgos + equipo | Componente dentro de Gerencial |

### Sprint 4 — Equipo y Pulido (Semana 4-5)

| # | Tarea | Archivos |
|---|-------|----------|
| 16 | Migration: `responsable_id` FK en proyectos | `supabase/migrations/` |
| 17 | Métricas de responsable: info al día, última actualización | `proyecto-financiero.ts` |
| 18 | Migrar riesgos de localStorage a Supabase | Migration + store |
| 19 | Exportar PDF/Excel de vista gerencial | `export-utils.ts` |
| 20 | Rutas + sidebar + navegación | `App.tsx`, `ERPSidebar.tsx` |

---

## 5. NOTA: Memphis vs ERP Estándar

La vista gerencial es universal pero con secciones condicionales:

```tsx
// En ProyectoGerencial.tsx
<SeccionFinanciera />          {/* Siempre — todos los tenants */}
<SeccionAdendas />             {/* Siempre — todos los tenants */}
<SeccionAvanceFases />         {/* Siempre — todos los tenants */}

{tieneFlota && <SeccionFlota />}              {/* Solo si el proyecto tiene vehículos */}
{tieneEquiposBio && <SeccionEquiposBio />}    {/* Solo si tiene equipos */}
```

No se necesitan feature flags complejos. Las secciones se muestran según los activos que tenga cada proyecto.

---

## 6. NOTIFICACIONES MICROSOFT TEAMS (Graph API)

### Objetivo
Que las alertas críticas del ERP lleguen como notificaciones de Teams a los usuarios correspondientes (gerencia, responsables de proyecto, equipo operativo).

### Arquitectura

```
Memphis ERP (Supabase)
       │
       ▼
  Edge Function: notify-teams
       │
       ▼
  Microsoft Graph API
       │
       ├── Chat 1:1 con usuario → notificación personal
       ├── Canal "Alertas ERP" → notificación grupal
       └── Activity Feed → badge en Teams
```

### Implementación

#### 6.1 — Registro de App en Azure AD
- Registrar aplicación en Azure Portal (portal.azure.com)
- Tipo: Application (daemon/service) — no necesita login de usuario
- Permisos Graph API requeridos (Application permissions):
  - `Chat.Create` — crear chats 1:1
  - `ChatMessage.Send` — enviar mensajes
  - `Channel.ReadBasic.All` — leer canales
  - `ChannelMessage.Send` — enviar a canales
  - `User.Read.All` — buscar usuarios por email
  - `TeamsActivity.Send` — enviar al Activity Feed
- Obtener: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- Guardar como secrets en Supabase Edge Functions

#### 6.2 — Mapeo de usuarios ERP ↔ Teams
- Tabla nueva o campo en `usuarios`:
  ```sql
  ALTER TABLE usuarios ADD COLUMN teams_email VARCHAR(255);
  ALTER TABLE usuarios ADD COLUMN teams_user_id VARCHAR(255);
  ALTER TABLE usuarios ADD COLUMN notificaciones_teams BOOLEAN DEFAULT TRUE;
  ```
- El email de Teams generalmente coincide con el email corporativo
- `teams_user_id` se obtiene via Graph API: `GET /users/{email}`

#### 6.3 — Edge Function: `notify-teams`
```
supabase/functions/notify-teams/index.ts
```
- Recibe: { tipo, titulo, mensaje, destinatarios[], proyectoId?, urgencia }
- Autentica con Azure AD (client_credentials flow)
- Envía mensaje a cada destinatario via Graph API
- Log en tabla `notificaciones_log`

#### 6.4 — Triggers de notificación

| Evento | Destinatario | Urgencia | Mensaje |
|--------|-------------|----------|---------|
| Presupuesto proyecto > 90% | Gerencia + Responsable | 🔴 Alta | "PRY-001: Presupuesto al 92%. Quedan S/ 80,000" |
| Presupuesto proyecto > 70% | Responsable | 🟡 Media | "PRY-001: Presupuesto al 75%" |
| OC aprobada > S/ 10,000 | Gerencia | 🔵 Info | "OC-2026-045 aprobada: S/ 45,000 — PRY-001" |
| Preventivos agotados (vehículo) | Responsable | 🔴 Alta | "Vehículo ABC-123: 0 preventivos restantes" |
| Proyecto sin actualizar > 7 días | Gerencia | 🟡 Media | "PRY-003: Sin actualización hace 10 días" |
| Adenda registrada | Gerencia | 🔵 Info | "PRY-001: Adenda N°2 — S/ 200,000" |
| Riesgo crítico creado | Gerencia + Responsable | 🔴 Alta | "PRY-002: Nuevo riesgo crítico registrado" |
| Tarea vencida | Asignado + Responsable | 🟡 Media | "Tarea 'Instalar equipos' vencida hace 3 días" |

#### 6.5 — Canal grupal "Alertas ERP Memphis"
- Crear Team o canal dedicado en Teams
- Las alertas de urgencia alta van tanto al canal como al chat personal
- Las de urgencia media/info solo al canal (menos ruido)

#### 6.6 — Configuración por usuario
- En perfil del ERP: toggle "Recibir notificaciones en Teams"
- Selector de qué tipos de alertas quiere recibir
- Horario de notificaciones (opcional, para no molestar fuera de horario)

### Sprint adicional

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 21 | Registrar app en Azure AD + permisos + secrets | Config |
| 22 | Tabla/campos para mapeo usuario-Teams | Migration |
| 23 | Edge Function `notify-teams` con Graph API auth | Nuevo |
| 24 | Integrar triggers en proyecto-financiero (alertas de presupuesto) | Modificación |
| 25 | Integrar triggers en OT/preventivos (alertas de flota) | Modificación |
| 26 | UI de configuración de notificaciones en perfil | Nuevo |
| 27 | Canal "Alertas ERP" + mensaje de bienvenida | Config Teams |

---

## 7. ORDEN FINAL DE EJECUCIÓN

### Sprint 1 — Fundación Financiera (Semana 1-2)
1. Migration: tabla `adendas_proyecto`
2. Types + helpers + store para adendas
3. `proyecto-financiero.ts` — queries OCs + Caja Chica, cálculos utilidad/margen
4. Migration: `proyecto_id` en `equipos_biomedicos`
5. Actualizar equipos-store con `proyectoId`

### Sprint 2 — Vista General de Proyectos (Semana 2-3)
6. `ProyectosPanorama.tsx` — KPIs globales + tabla comparativa + alertas
7. Queries paralelas para KPIs globales
8. Sistema de alertas automáticas

### Sprint 3 — Vista Ultra Detallada (Semana 3-4)
9. `ProyectoGerencial.tsx` — header + KPIs financieros + barra consumo
10. Desglose financiero: OCs + Caja Chica con tablas expandibles
11. Sección adendas CRUD
12. Sección flota: vehículos, mantenimientos, saldo preventivo por vehículo
13. Sección equipos biomédicos
14. Sección avance: fases con presupuesto vs costo
15. Sección riesgos + equipo

### Sprint 4 — Equipo y Responsables (Semana 4-5)
16. Migration: `responsable_id` FK en proyectos
17. Métricas de responsable
18. Migrar riesgos a Supabase
19. Exportar PDF/Excel
20. Rutas + sidebar + navegación

### Sprint 5 — Notificaciones Teams (Semana 5-6)
21. Registro app Azure AD + permisos
22. Mapeo usuarios ERP ↔ Teams
23. Edge Function `notify-teams`
24. Triggers de presupuesto y financiero
25. Triggers de flota/preventivos
26. UI configuración notificaciones
27. Canal grupal + testing
