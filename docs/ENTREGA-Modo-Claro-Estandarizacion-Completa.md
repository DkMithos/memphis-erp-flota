# ENTREGA: Modo Claro — Estandarización Completa del ERP

**Fecha:** 2026-06-12
**Alcance:** Todos los módulos habilitados (Flota, Biomédico, CRM, BI & Reportería, Administración) + componentes globales
**Tipo:** Estandarización visual / coherencia gráfica del modo claro
**Regla transversal:** Todos los cambios aplican **solo al modo claro**; el modo oscuro se preserva intacto con overrides `dark:`

---

## 📋 RESUMEN EJECUTIVO

Esta entrega **cierra la Fase 2 (Modo Claro)** iniciada en `_NOTAS-PROGRESO-Branding-Memphis.md`. Se completó la estandarización de todos los módulos que quedaban pendientes y se unificó el comportamiento de KPIs, botones, íconos y cards en todo el sistema.

✅ KPIs unificados al **patrón Home** (caja de ícono de color sólido + ícono blanco + etiqueta/valor)
✅ Hovers de botones unificados (**negro/blanco** en outline/ghost, **rojo** en destructivos) — solo modo claro
✅ Cards de navegación unificadas al **patrón "Acceso Rápido"** (fondo gris→oscuro, borde izq de acento, caja de ícono→negra en hover)
✅ Íconos de título coherentes (negro en claro / amarillo en oscuro)
✅ Auditoría de coherencia ejecutada — modo claro coherente de punta a punta
✅ Modo oscuro **preservado** en el 100% de los cambios

---

## 🎨 CONVENCIONES APLICADAS (referencia)

### 1. KPI card — "patrón Home" (informativo, no clickeable)
```jsx
<Card>
  <CardContent className="p-4 flex items-center gap-4">
    <div className="size-10 bg-{color}-500 rounded-lg flex items-center justify-center shrink-0">
      <Icon className="size-5 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </CardContent>
</Card>
```

### 2. Hover de botón — light-only (outline / ghost)
```
hover:!bg-black hover:!text-white hover:!border-black
dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input
```
- **Destructivos:** `hover:!bg-red-700` (botón sólido) o `hover:!bg-red-100/200/300 hover:!text-red-700/800/900` (ghost), con `dark:` override.

### 3. Card de navegación — "patrón Acceso Rápido" (clickeable)
- Fondo gris `#E2E8F0` → `#94A3B8` en hover; borde izquierdo negro 4px; bordes finos `#64748B` → negros en hover; sombra en hover.
- Caja de ícono de color sólido + ícono blanco → **negra en hover** (`group-hover:!bg-black`).
- Chevron negro (claro) / amarillo (oscuro). Helper reutilizable `quickCardStyle()` + estado `hoveredCard` + hook `useDarkMode()`.

### 4. Ícono de título
```jsx
<div className="size-10/12 dark:bg-primary/10 rounded-lg ...">
  <Icon className="size-5/6 text-black dark:text-primary" />
</div>
```

---

## 🧩 COMPONENTES GLOBALES

| Archivo | Cambio |
|---|---|
| `components/ui/tabs.tsx` | Hover de pestañas: fondo `bg-black/10` → `bg-black/15` (un poco más visible). Borde amarillo en hover/activo preservado. Aplica a **todos los tabs del ERP**. |
| `components/layout/ERPTopbar.tsx` | Hover negro/blanco en los 4 botones del header: Notificaciones 🔔, Idioma 🌐, Tema ☀️, Usuario 👤 (el avatar amarillo se preserva). |

---

## 🚚 FLOTA (módulo completo)

### Dashboard (`FlotaDashboard.tsx`)
- **6 KPIs Enterprise** → patrón Home (Total Vehículos, Disponibilidad, MTTR, MTBF, Costo Total, SLA).
- Fila **Vehículos:** Total Vehículos y Activos → patrón **Acceso Rápido** (clickeables); En Taller, Inactivos, KM Promedio → patrón Home.
- Fila **Órdenes de Trabajo:** Total OTs → Acceso Rápido; En Ejecución, Espera Aprobación (mantiene click condicional), Cerradas → patrón Home.
- 3 cards **"Acciones rápidas"** (Gestionar Vehículos, Órdenes de Trabajo, Nueva OT) → patrón Acceso Rápido.

### Vehículos (`VehiculosLista.tsx`)
- **5 KPIs** → patrón Home (Total, Activos, En Taller, Inactivos, KM Promedio).
- Hover en **Anterior/Siguiente**; hover de fila → gris sutil `slate-100` (era el cream-amarillo `accent`).
- Íconos de acción (Eye / Wrench / FileText) → hover negro + ícono blanco.

### Vehículo → Detalle (`VehiculoDetalle.tsx`)
- Hover en Documentos, Nueva OT, Activar, Ver Historial OT.
- **Inactivar** y **Inactivar Vehículo** (diálogo) → hover rojo oscuro (`red-700`).
- Ícono Car del encabezado → negro en claro / amarillo en oscuro.

### Tabs del Vehículo
- `DocumentosTab.tsx`: ícono de título al patrón Memphis; Editar (negro) y Eliminar (rojo intenso `red-300/red-900`).
- `PlanPreventivoTab.tsx`: botón Restablecer → hover.
- `AdicionalesTab.tsx`: **3 KPIs** → patrón Home.

### QR del Vehículo (`VehicleQRSection.tsx`)
- Hover en Ver Vista Pública, Imprimir QR, Copiar URL.

### Mantenimientos (`MantenimientosLista.tsx`)
- **6 KPIs** → patrón Home (Total OTs, Programadas, En Ejecución, Espera Repuesto, Cerradas, Costo Total).

### Análisis Preventivo (`FlotaPreventiveAnalytics.tsx`)
- Helper `renderKPICard` → patrón Home (caja sólida + ícono blanco). Mapa de colores ampliado (info/purple).

### Monitoreo GPS (`FlotaGPS.tsx`)
- **4 KPIs** → caja sólida + ícono blanco **solo en modo claro** (oscuro tinte preservado).
- Botón **Lista** (toggle) → hover negro/blanco solo cuando inactivo.

### Reportes
- `FlotaReporteVehiculos/Mantenimientos/Documentos.tsx`: helper `renderKPICard` → patrón Home con variantes de color por card; hover en Limpiar Filtros, Excel, Anterior/Siguiente (CSV y PDF ya tenían).
- `FlotaReporteCostos.tsx`: **4 KPIs** → patrón Home; hover en Anterior/Siguiente.
- `FlotaPorProyecto.tsx`: **4 KPIs** → patrón Home.

---

## 🩺 BIOMÉDICO (módulo completo)

### Listas — KPIs al patrón Home
| Archivo | KPIs |
|---|---|
| `BiomedicoEquipos.tsx` | 4 (Total, Disponibilidad, Críticos, Valor Inventario) |
| `BiomedicoMantenimientos.tsx` | 4 (Total, Programados, En Ejecución, Tasa Completados) |
| `BiomedicoCalibraciones.tsx` | 4 (componente `KpiCard` reescrito) |
| `BiomedicoContratos.tsx` | 4 (vía `.map`) |
| `BiomedicoIncidencias.tsx` | 4 (componente `KpiCard` reescrito) |
| `BiomedicoEquipoDetalle.tsx` | 4 (stats de mantenimiento) |

### Dashboard (`BiomedicoDashboard.tsx`)
- 4 cards clickeables (Total Equipos, Mantenimientos, Calibraciones, Incidencias) → patrón **Acceso Rápido**.
- Sección **"Estado de la Flota"** (Operativos, En Mantenimiento, Fuera de Servicio, En Calibración): se agregó caja de ícono de color + se conservó la barra de progreso; borde de celda `slate-400`, borde de barra `slate-400`, alto de barra `12px`.
- **Eliminada** la sección redundante "Acciones rápidas" del fondo (duplicaba las cards de arriba).
- Botones: Ver equipos y Registrar contrato → negro/blanco; "Ver todo" (×2) → negro/blanco.

---

## 👥 CRM (módulo completo)

| Archivo | Cambios |
|---|---|
| `CRMDashboard.tsx` | 4 KPIs → Home; 3 Quick links → Acceso Rápido; "Ver todas" y "Mover a siguiente" → hover |
| `CRMClientes.tsx` | 4 KPIs → Home; íconos de fila (Eye/Pencil), "Ver oportunidades" y "Cerrar" → hover |
| `CRMOportunidades.tsx` | 4 KPIs → Home |
| `CRMActividades.tsx` | 4 KPIs → Home |

---

## 📊 BI & REPORTERÍA

### Dashboard (`BIDashboard.tsx`)
- Componente **`KPICard`** reescrito al patrón Home (caja sólida + ícono blanco forzado vía `[&_svg]:text-white`); se removió el borde izquierdo de color. **8 KPIs** afectados.
- Componente **`ModuloCard`** (Resumen por Módulo, 6 cards) adaptado a modo claro:
  - Fondo `bg-card` (igual a los KPIs) en claro / negro en oscuro.
  - Borde amarillo `#f0c000` 2px; ícono negro (claro) / amarillo (oscuro).
  - Textos +2px (título/valores `text-base`, botón `text-sm`); etiquetas más oscuras (`gray-600`); título negro puro.
  - Botón "Ver Módulo" → borde `slate-400` + hover negro/blanco.

### Reporte Cruzado (`ReporteCruzado.tsx`)
- KPI "Total Registros" → patrón Home.
- Fix de alineación: checkboxes de "Módulos" con `items-center`; etiquetas con `!mb-0` (el `Label` global trae `mb-1.5` que descentraba el checkbox inline).

---

## 🛡️ ADMINISTRACIÓN (módulo completo)

| Archivo | Cambios |
|---|---|
| `GestionUsuarios.tsx` | 3 KPIs → Home (Activos/verde, Inactivos/slate, Suspendidos/rojo); 9 botones con hover (Roles, Desactivar, Activar, Suspender=rojo, Anterior/Siguiente, Cerrar, Permisos, Eliminar rol=rojo) |
| `AuditLogs.tsx` | Botón Actualizar → hover |
| `CentrosCostoAdmin.tsx` | Editar, Toggle, Cancelar → hover |
| `GestionModulos.tsx` | Restablecer → hover |
| `GestionCatalogos.tsx` | Íconos inline (Guardar=verde, Cancelar, Editar, Toggle), Agregar item → hover (Eliminar ya tenía rojo) |
| `GestionFlujoAprobacion.tsx` | Rediseño de contraste (ver abajo) |

### Caso especial — Flujo de Aprobación (`GestionFlujoAprobacion.tsx`)
**Problema:** las 3 cards de nivel (Estándar / Gerencial / Alta Dirección) usaban fondo tinte muy pálido (`bg-green/yellow/red-50`) → bajo contraste, la info no se leía.

**Solución (decisión del usuario):**
- Las 3 cards en **fondo neutro** (`bg-card` + borde `#64748B`); el color del nivel queda **solo en el badge** (verde/amarillo/rojo) y en la línea de tiempo superior.
- Inputs con **fondo blanco** para resaltar sobre el fondo neutro.
- **Borde izquierdo de color en hover** (sombra `inset 4px` por nivel — sin desplazar layout) con `transition-shadow`.
- Hover en los botones de aprobadores (1 / 2 / 3): no seleccionado → negro/blanco; seleccionado (amarillo) → `bg-primary/90`.

---

## ✅ VERIFICACIÓN DE COHERENCIA

- Se ejecutó una auditoría a nivel de código de los módulos no tocados; las inconsistencias estaban concentradas en **Administración** (ya resuelta) y **Contabilidad**.
- **Contabilidad NO se estandariza a propósito:** el módulo está construido (9 vistas) y definido en el menú, pero **no está registrado en `MODULES_DEFAULT`** (`lib/config/modules-config.ts`), por lo que el sidebar lo **oculta** (`cfg?.enabled ?? false`). Nadie lo ve → no aporta valor estilizarlo ahora.

### Estado final
| Módulo | Estado |
|---|---|
| Proveedores, Compras, Inventario, Finanzas, Proyectos | ✅ (sesiones previas) |
| Flota, Biomédico, CRM, BI & Reportería, Administración | ✅ (esta entrega) |
| Componentes globales (tabs, topbar, card, select, switch…) | ✅ |
| Contabilidad | ⏸️ Deshabilitado (omitido a propósito) |

---

## 📌 NOTAS / PENDIENTES MENORES

- En `BIDashboard.tsx`, el componente `ModuloCard` mantiene los props `color`/`bgColor` en su interfaz por compatibilidad (los call sites los siguen pasando pero el componente ya no los usa). Limpieza opcional futura.
- Verificación visual fina (espaciados/contraste real) corre por cuenta del revisor en `localhost`.
