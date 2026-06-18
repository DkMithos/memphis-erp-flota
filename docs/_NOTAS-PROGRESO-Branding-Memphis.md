# 📝 Notas de Progreso — Branding Memphis ERP

> **⚠️ Archivo de trabajo interno** — Ayuda memoria mientras avanzamos.
> Al terminar, esto se convierte en `docs/06-CAMBIOS-REALIZADOS-Mayo-2026.md` formal.

**Última actualización**: 2026-06-12
**Estado general**: Modo oscuro completo · **Modo claro COMPLETO** ✅

> 📄 El cierre de la Fase 2 (Modo Claro) está documentado en
> **`docs/ENTREGA-Modo-Claro-Estandarizacion-Completa.md`** — estandarización de
> Flota, Biomédico, CRM, BI, Administración + componentes globales.

---

## 🌑 FASE 1 — MODO OSCURO (COMPLETADO)

### 🎨 Sistema de diseño base

**Archivo**: `src/styles/globals.css`
- ✅ Paleta Memphis aplicada (amarillo `#f0c000`, negro `#0D0D0D`, blanco)
- ✅ Variables CSS para tema claro y oscuro
- ✅ Focus rings amarillos forzados con `!important`
- ✅ Scrollbar Memphis amarillo
- ✅ Calendar picker icon en amarillo (size 18px)
- ✅ Body[data-scroll-locked] fix para Radix dropdowns

### 🧩 Componentes UI base modificados

- ✅ `src/components/ui/button.tsx` — hover `#d4a800` + active `#b8920a`
- ✅ `src/components/ui/input.tsx` — focus amarillo (sin sombra)
- ✅ `src/components/ui/tabs.tsx` — borde amarillo en hover/activo, borde sutil en inactivos
- ✅ `src/components/ui/label.tsx` — `mb-1.5` por defecto (espaciado uniforme)

### 📦 Componente nuevo creado

- ✅ `src/components/shared/PageNav.tsx`
  - Botón Home (navega a `/home`) + Volver (`window.history.back()`)
  - Props: `onHome?`, `onBack?`, `className?`
  - Aplicado en ~30 archivos del sistema

### 🎯 Patrones de diseño establecidos

1. **Header unificado**:
   ```
   <PageNav />
   <div flex items-center gap-3>
     <div size-12 bg-primary/10 rounded-lg>
       <Icon size-6 text-primary />
     </div>
     <div>
       <h2>Título</h2>
       <p>Descripción</p>
     </div>
   </div>
   ```

2. **Cards de navegación**: borde izquierdo amarillo `!border-l-[4px] !border-l-[#f0c000]` + flecha `›`
3. **Cards de acción**: borde inferior amarillo `!border-b-[4px] !border-b-[#f0c000]`, sin flecha
4. **Botón Volver**: `variant="ghost" size="sm" -ml-2` con `window.history.back()`

### 📋 Cambios por módulo

#### Flota
- ✅ `FlotaDashboard.tsx` — KPI cards con borde izq amarillo + flecha
- ✅ `FlotaGPS.tsx` — PageNav + ícono `Navigation`
- ✅ `FlotaPreventiveAnalytics.tsx` — PageNav + ícono `TrendingUp`
- ✅ `VehiculosLista.tsx` — PageNav + ícono `Car`
- ✅ `VehiculoDetalle.tsx` — PageNav unificado
- ✅ `VehiculoForm.tsx` — PageNav + ícono `Car`
- ✅ `MantenimientosLista.tsx` — PageNav + ícono `Wrench`, botón "Limpiar Filtros" con outline + X
- ✅ `MantenimientoDetalle.tsx` — PageNav + ícono `Wrench`
- ✅ `MantenimientoForm.tsx` — PageNav, eliminé ícono Lucide Calendar duplicado
- ✅ Reportes (4 archivos): Vehículos, Mantenimientos, Documentos, Costos — íconos en `text-primary` (eran `#0A66C2`)
- ✅ `VehicleQRPrint.tsx` — PageNav
- ✅ `VehiclePublicLifeSheet.tsx` — fondo `bg-background`, logo amarillo, sin azul

#### Biomédico
- ✅ `BiomedicoDashboard.tsx` — KPI cards con borde izq amarillo + Acciones rápidas con borde inferior amarillo
- ✅ `BiomedicoEquipos.tsx` — PageNav + ícono `Stethoscope`
- ✅ `BiomedicoMantenimientos.tsx` — PageNav + ícono `Wrench`
- ✅ `BiomedicoCalibraciones.tsx` — PageNav + ícono `ClipboardCheck`
- ✅ `BiomedicoIncidencias.tsx` — PageNav + ícono `AlertCircle`
- ✅ `BiomedicoContratos.tsx` — PageNav + ícono `FileText`
- ✅ `BiomedicoDocumentos.tsx` — PageNav + ícono `FileText`
- ✅ `BiomedicoEquipoDetalle.tsx` — PageNav + ícono `Stethoscope`
- ✅ `BiomedicoMantenimientoDetalle.tsx` — PageNav + ícono `Wrench`
- ✅ `BiomedicoEquipoForm.tsx` — PageNav arriba del título
- ✅ `BiomedicoMantenimientoForm.tsx` — PageNav arriba del título
- ✅ `BiomedicoContratoForm.tsx` — PageNav arriba del título
- ✅ `EquipoPublicView.tsx` — fondo `bg-background`, logo amarillo en cuadrado negro
- ✅ `EquipoQRPrint.tsx` — PageNav

#### CRM
- ✅ `CRMDashboard.tsx` — Cards de navegación con borde izq amarillo
- ✅ `CRMClientes.tsx` — PageNav + ícono `Users`
- ✅ `CRMOportunidades.tsx` — PageNav + ícono `Target`
- ✅ `CRMActividades.tsx` — PageNav + ícono `CheckCircle2`

#### Compras
- ✅ `RequerimientosLista.tsx` — PageNav
- ✅ `CotizacionesLista.tsx` — PageNav
- ✅ `OrdenesLista.tsx` — PageNav
- ✅ `RecepcionesLista.tsx` — PageNav
- ✅ `RequerimientoDetalle.tsx` — PageNav + ícono `FileText`
- ✅ `CotizacionDetalle.tsx` — PageNav + ícono `FileText`
- ✅ `OrdenDetalle.tsx` — PageNav + ícono `ShoppingBag`
- ✅ `RecepcionDetalle.tsx` — PageNav + ícono `Package`
- ✅ `RequerimientoForm.tsx` — PageNav + ícono `ClipboardCheck`
- ✅ `CotizacionForm.tsx` — PageNav + ícono `FileText`
- ✅ `OrdenForm.tsx` — PageNav + ícono `ShoppingBag`
- ✅ `RecepcionForm.tsx` — PageNav + ícono `Package`

#### Inventario
- ✅ `InventarioDashboard.tsx` — PageNav + ícono `Package`
- ✅ `InventarioArticulos.tsx` — PageNav + ícono `Package`
- ✅ `InventarioAlmacenes.tsx` — PageNav + ícono `Warehouse`
- ✅ `InventarioMovimientos.tsx` — PageNav + ícono `ArrowLeftRight`
- ✅ Cambio terminológico: "Productos" → "Artículos" en `es.json`

#### Finanzas
- ✅ `FinanzasDashboard.tsx` — PageNav + ícono `DollarSign`
- ✅ `FinanzasTransacciones.tsx` — PageNav + ícono `ArrowLeftRight`
- ✅ `FinanzasPresupuestosModule.tsx` — PageNav + ícono `ClipboardList`
- ✅ `FinanzasCajaChica.tsx` — PageNav + ícono `Wallet`
- ✅ `FinanzasFlujoCaja.tsx` — PageNav + ícono `Wallet`
- ✅ `FinanzasReportes.tsx` — PageNav + ícono `FileBarChart`

#### Proyectos
- ✅ `ProyectosLista.tsx` — PageNav + ícono `FolderKanban`
- ✅ `ProyectosTareasGlobal.tsx` — PageNav + ícono `ListChecks`
- ✅ `ProyectosCronograma.tsx` — PageNav + ícono `CalendarDays`
- ✅ `ProyectosValorizaciones.tsx` — PageNav + ícono `Calculator`
- ✅ `ProyectosRiesgos.tsx` — PageNav + ícono `Shield`
- ✅ `ProyectosDocumentos.tsx` — PageNav + ícono `FileText`
- ✅ `ProyectoDetalle.tsx` — PageNav + ícono `FolderKanban`
- ✅ `TareaDetalle.tsx` — PageNav + ícono `ListChecks`
- ✅ `Proyecto360.tsx` — PageNav

#### Proveedores
- ✅ `ProveedoresDirectorio.tsx` — PageNav + ícono `Building2`
- ✅ `ProveedoresEvaluaciones.tsx` — PageNav + ícono `Star`
- ✅ `ProveedoresContratos.tsx` — PageNav + ícono `Handshake`
- ✅ `ProveedoresTalleres.tsx` — PageNav + ícono `Wrench`
- ✅ `ProveedorDetalle.tsx` — PageNav + ícono `Building2`
- ✅ `ProveedorForm.tsx` — PageNav + ícono `Building2`

#### BI & Reportería
- ✅ `BIDashboard.tsx` — Cards de módulo con fondo negro + borde amarillo (cambio especial)
- ✅ `ReporteCruzado.tsx` — PageNav + ícono `BarChart3`

#### Administración
- ✅ `GestionUsuarios.tsx` — PageNav + ícono `Shield`
- ✅ `GestionCatalogos.tsx` — PageNav + ícono `List` + agrupación por categorías con dropdown
- ✅ `GestionFlujoAprobacion.tsx` — PageNav + ícono `Shield`
- ✅ `CentrosCostoAdmin.tsx` — PageNav + ícono `Building2`

### 🔧 Mejoras funcionales adicionales

- ✅ Botón Volver con `window.history.back()` en lugar de rutas hardcodeadas
- ✅ Sidebar: ícono `LayoutDashboard` agregado para sub-items "Dashboard" (por label, no por href)
- ✅ Eliminé "Categorías" del menú Proveedores (redundante con Admin → Catálogos)
- ✅ Fix navigation loop en formularios biomédico (BiomedicoEquipoForm onCancel)
- ✅ Catálogos Configurables agrupados: Generales, Facturación, Flota, Otros Módulos

---

## ☀️ FASE 2 — MODO CLARO (EN PROGRESO)

### 🔐 Login (COMPLETO)

**Archivo**: `src/components/auth/Login.tsx`

- ✅ Split layout 50/50 (Brand Forward)
- ✅ Lado izquierdo: amarillo Memphis `#f0c000` con patrón de puntos
- ✅ Logo Memphis en cuadrado negro sólido con shadow-lg
- ✅ Título: "Bienvenido al sistema de / Memphis Maquinarias" (con `<br />`)
- ✅ Descripción en 2 líneas controladas con `<br />`
- ✅ Eliminado "Sistema operativo · v2.0"
- ✅ Lado derecho: negro Memphis `#0D0D0D` con `dark` class forzado
- ✅ Card oscuro con borde `#2D2D2D`
- ✅ Funciona idéntico en claro y oscuro

### 🎨 Sidebar

**Archivo**: `src/components/layout/ERPSidebar.tsx`

- ✅ `bg-[#1A1A1A]` siempre (Memphis Card color)
- ✅ `dark` class agregado al `<aside>` para forzar estilos oscuros
- ✅ Mismo color en claro y oscuro (coherencia total)

### 🌫️ Fondo de página

**Archivo**: `src/styles/globals.css`

- ✅ `--background: #F1F5F9` (slate-100) — era `#FAFBFC`
- ✅ Menos "glare" del blanco brillante
- ✅ Look profesional tipo Notion/Linear

### 🎴 Cards globales

**Archivo**: `src/components/ui/card.tsx`

- ✅ `border-slate-900 dark:border-border` — borde casi negro frío en claro

**Archivo**: `src/styles/globals.css`

- ✅ `--card: #F1F5F9` (mismo color que background, outline design)
- ✅ `--popover: #FFFFFF` (mantenido para flotantes)

### 📊 KPI Cards del Home

**Archivo**: `src/components/modules/HomeWelcome.tsx`

- ✅ Fondo: `bg-white dark:bg-card` (cards destacan sobre fondo gris)
- ✅ Borde: inline `style={{ border: '1px solid #64748B' }}` (1px slate-900, fino y oscuro definido)
- ✅ Sin borde izquierdo grueso (el cuadro del ícono ya comunica el tipo)
- ✅ Sombra: `shadow-sm`
- ✅ Íconos: cuadrado sólido del color del KPI + ícono blanco
  - Módulos activos: `bg-blue-500` + ícono blanco
  - Alertas: `bg-amber-500` + ícono blanco
  - Tareas: `bg-green-500` + ícono blanco
  - Tendencia: `bg-emerald-500` + ícono blanco
- ✅ Valor: `text-2xl font-bold`
- ✅ SIN hover (cards informativas, no clickeables)

### 📋 Estado del Sistema (Home)

**Archivo**: `src/components/modules/HomeWelcome.tsx`

- ✅ Reemplazados badges pastel por **punto de color + texto plano** (look Linear/Notion)
- ✅ Verde `bg-green-500` para estados OK
- ✅ Ámbar `bg-amber-500` para "En configuración"
- ✅ Labels en `text-foreground` (era `text-muted-foreground` - bajo contraste)
- ✅ Estados con `font-medium` para destacar
- ✅ Alineación vertical con `grid grid-cols-[1fr_160px]` — todos los puntos en la misma columna

### 📰 Actividad Reciente y Estado del Sistema (cards)

- ✅ Ambos con `bg-white dark:bg-card shadow-sm` + inline `style={{ border: '1px solid #64748B' }}`
- ✅ Coherencia visual con KPI cards
- ✅ Sin hover (informativos)

### 🧹 Limpieza Header Home

- ✅ Eliminado logo Memphis decorativo (era `opacity-20`, se veía difuso)
- ✅ Header solo con fecha + saludo + descripción

### 🩶 Cuadros de íconos (Accesos Rápidos)

- ✅ Modo claro: cada módulo con su color sólido + ícono blanco:
  - Flota → `bg-blue-500`
  - Biomédico → `bg-purple-500`
  - Compras → `bg-orange-500`
  - Proveedores → `bg-emerald-500`
  - Inventario → `bg-amber-500`
  - Finanzas → `bg-green-500`
  - Proyectos → `bg-indigo-500`
  - BI & Reportes → `bg-rose-500`
- ✅ Hover: `!bg-black !text-white` (con !important) en ambos modos
- ✅ Transition-colors para cambio suave

### 🔍 Topbar — Input de búsqueda

- ✅ Borde agregado: `border border-slate-300 dark:border-border` (era `border-0`)
- ✅ Bug del spinner corregido: wrapper div maneja translate, Loader2 interno maneja rotate (evita conflicto de transforms)
- ✅ Bug del spinner persistente al borrar texto corregido: agregado `setSearching(false)` + `clearTimeout` en el early return cuando q.length < 2
- ⚠️ Funcionalidad de búsqueda actualmente deshabilitada (decisión del jefe)

### 📊 KPI "Alertas pendientes" (Home)

- ✅ Color cambiado de `bg-amber-500` (ámbar advertencia) a `bg-red-500` (rojo urgencia)
- ✅ Más apropiado semánticamente para comunicar alertas

### 🎛️ Dashboard General — 8 Cards de Navegación

**Archivo**: `src/components/modules/Dashboard.tsx`

- ✅ Refactorizadas con mismo patrón que Accesos Rápidos del Home
- ✅ React `useState` para hover sin bugs
- ✅ Estructura: cuadro de color sólido con ícono blanco + título + número grande + descripción + flecha indicadora
- ✅ Borde 1px slate-500 normal, color modo (negro/amarillo) en hover
- ✅ Borde izquierdo 4px del color del modo (acento navegación siempre visible)
- ✅ Fondo: `#E2E8F0` (slate-200) en claro / `bg-card` en oscuro
- ✅ Hover bg: `#94A3B8` (slate-400) en claro / `bg-accent/30` en oscuro
- ✅ Sombra `hover:shadow-md`

**Colores semánticos asignados**:
- Flota Vehicular → `bg-blue-500`
- OTs Pendientes → `bg-orange-500`
- Proyectos Activos → `bg-green-500`
- Equipos Biomédicos → `bg-purple-500`
- OC Pendientes → `bg-cyan-500`
- Requerimientos → `bg-indigo-500`
- Proveedores → `bg-emerald-500`
- Alertas → `bg-amber-500`

**Cambios adicionales**:
- ✅ Ícono de "Proveedores" cambiado de `DollarSign` a `Users` (más semántico)
- ✅ "Alertas" ahora navega a `/flota/mantenimientos`

### 📊 Directorio de Proveedores — Refinamiento UI

**Archivo**: `src/components/modules/proveedores/ProveedoresDirectorio.tsx`

**KPIs (5 cards)**:
- ✅ Estandarizados con mismo patrón que los KPIs del Home
- ✅ Cuadrito sólido + ícono blanco
- ✅ Borde uniforme 1px slate-500 (sin acento izquierdo, igual al Home)
- ✅ Colores semánticos:
  - Total Proveedores → blue + Building2
  - Activos → green + CheckCircle
  - Observados → amber + AlertCircle
  - Inactivos → slate + UserX
  - En Evaluación → indigo + Clock
- ✅ Sin hover (informativos)

**Botón "Limpiar filtros"** (Alert resumen):
- ✅ Cambiado de `variant="link"` (pasaba desapercibido) a `variant="outline"`
- ✅ Estado normal: fondo transparente, borde negro fino, texto negro, ícono X
- ✅ Hover: fondo amarillo Memphis `#f0c000`, texto y borde negro
- ✅ Mayor visibilidad y affordance de clickeable

### 🏷️ Gestión de Categorías de Proveedor

**Archivo**: `src/components/modules/proveedores/GestionCategorias.tsx`

**Indicadores de estado (Badge)**:
- ❌ Antes: `bg-green-100 text-green-700` — verde pastel, sin contraste
- ✅ Ahora: **fondo verde-600 sólido + texto blanco** (Activa)
- ✅ Outline slate para Inactiva (jerarquía visual)

**Ícono GripVertical (6 puntitos)**:
- ❌ Eliminado — comunicaba falsamente que las filas eran drag & drop
- ✅ Removido del import de lucide-react también

**Hover botones de acción por fila**:
- ✅ Editar (lápiz): hover **negro + ícono blanco**
- ✅ Desactivar: hover **naranja-500 sólido + texto blanco** (cuando está Activa)
- ✅ Activar: hover **verde-600 sólido + texto blanco** (cuando está Inactiva)
- ✅ Eliminar (basurero): hover **rojo-600 sólido + ícono blanco**
- ✅ Cancelar (al crear nueva): hover **negro + texto blanco** (consistente con outline secundarios)

**Navegación**:
- ✅ Agregado componente `<PageNav />` (botones Home + Volver) que faltaba

### 📝 Formulario Nuevo Proveedor

**Archivo**: `src/components/modules/proveedores/ProveedorForm.tsx`

**Botón Cancelar (header superior derecho)**:
- ✅ Mantiene `variant="ghost"` + agregado `border border-slate-400` para visibilidad
- ✅ Hover: fondo negro + texto blanco + borde negro

**Botones "Agregar" (Contacto Principal) y "+ Agregar cuenta" (Cuentas Bancarias)**:
- ✅ Borde forzado `!border-slate-400` (#94A3B8) — necesario `!important` para sobreescribir `border-input` del variant outline
- ✅ Hover: fondo negro + texto blanco + borde negro
- ✅ Consistencia visual con el resto de botones outline secundarios

**Botón "Buscar" (consulta SUNAT por RUC)**:

Archivo: `src/components/ui/SunatRucInput.tsx`
- ✅ Borde `!border-slate-400` (#94A3B8)
- ✅ Hover: fondo negro + texto blanco + borde negro
- ✅ Mantiene `disabled` automático cuando RUC tiene <11 dígitos

**Botón "Cancelar" (final del formulario)**:
- ✅ Borde `!border-slate-400` (#94A3B8) — consistente con el resto
- ✅ Hover: fondo negro + texto blanco + borde negro

### 🔘 Componente Switch (Datos Tributarios)

**Archivos**: `src/components/ui/switch.tsx`, `src/components/modules/proveedores/ProveedorForm.tsx`

**Problema raíz encontrado**:
- Los switches de "Sujeto a Detracción" / "Sujeto a Retención" estaban implementados como `<button>` manuales (no usaban el componente Switch de shadcn)
- El thumb tenía `dark:bg-gray-900` que se mostraba como círculo negro
- La animación era manual sin easing → aparición seca, sin deslizamiento fluido

**Solución aplicada**:
- ✅ Reemplazado los `<button>` manuales por el componente `<Switch>` real
- ✅ Switch base mejorado (`switch.tsx`):
  - Dimensiones: `h-6 w-11` (track) + `size-5` (thumb)
  - Animación: `transition-transform duration-200 ease-in-out`
  - **Estado OFF**: track `bg-slate-300` + thumb blanco a la izquierda
  - **Estado ON**: track `bg-primary` (amarillo Memphis) + thumb **negro** a la derecha
  - Identidad Memphis: amarillo + negro

### 🎨 Íconos junto al título de página (sistema completo)

**Alcance**: 63 archivos (todos los módulos del ERP — Proyectos, Finanzas, Biomédico, Proveedores, CRM, Inventario, Compras, Flota, BI, Administración, Contabilidad, Compartido)

**Cambio aplicado**:
- ❌ Antes: cuadrito `bg-primary/10` (amarillo translúcido) + ícono `text-primary` (amarillo) — bajo contraste en modo claro
- ✅ Después:
  - Modo **claro**: cuadrito invisible (transparente) + ícono **negro** — limpio y con buen contraste
  - Modo **oscuro**: cuadrito amarillo translúcido + ícono amarillo Memphis (intacto)

**Patrón técnico**:
```jsx
// Antes
<div className="size-12 bg-primary/10 rounded-lg ...">
  <Icon className="size-6 text-primary" />
</div>

// Después
<div className="size-12 dark:bg-primary/10 rounded-lg ...">
  <Icon className="size-6 text-black dark:text-primary" />
</div>
```

**Excepción**: El ícono de `ProveedorForm.tsx` (Nuevo Proveedor) se modificó por separado anteriormente (Building2 size-6 con `style={{color: '#000'}}` inline) y se mantuvo así.

### 📊 Contratos de Proveedores — KPIs estandarizados

**Archivo**: `src/components/modules/proveedores/ProveedoresContratos.tsx`

- ❌ Antes: cuadritos pastel (`bg-green-100`, `bg-yellow-100`, `bg-blue-100`) con íconos coloridos
- ✅ Después: cuadritos sólidos + íconos blancos (patrón Home)
- ✅ Tamaño unificado: `size-10` + `size-5`

**KPIs afectados**:
- Contratos activos → verde + Handshake
- Por vencer (<30 días) → amarillo + CalendarDays
- Monto en contratos activos → azul + DollarSign

### 📊 Evaluaciones de Proveedores — KPIs estandarizados

**Archivo**: `src/components/modules/proveedores/ProveedoresEvaluaciones.tsx`

- ❌ Antes: cuadritos pastel (`bg-blue-100`) con íconos colorido (`text-blue-600`)
- ✅ Después: cuadritos sólidos (`bg-blue-500`, `bg-emerald-500`, `bg-green-500`) + íconos blancos
- ✅ Tamaño unificado: `size-10` + `size-5` (igual al patrón del Home)
- ✅ Estructura: `<Card>` wrapper mantenido (con el nuevo borde unificado slate-500)

**KPIs afectados**:
- Total evaluaciones → azul + Star
- Puntaje promedio → esmeralda + TrendingUp
- Excelente / Bueno → verde + Award

### 🎴 Card global — Unificación de borde (modo claro)

**Archivo**: `src/components/ui/card.tsx` (línea 10)

- ❌ Antes: `border-slate-900` (#0F172A, casi negro) — borde fuerte
- ✅ Después: `border-[#64748B]` (slate-500) — borde sutil, igual a los KPIs

**Modo oscuro**: intacto (`dark:border-border`)

**Alcance**: TODAS las cards del sistema (componente global). Beneficio: consistencia visual.
**Reversión**: 1 línea — cambiar `border-[#64748B]` por `border-slate-900` si no convence.

### 🟡 Dropdowns abiertos — Borde amarillo Memphis (modo claro)

**Archivos modificados**:
- `src/components/ui/select.tsx` (SelectTrigger)
- `src/components/ui/dropdown-menu.tsx` (DropdownMenuTrigger)
- `src/components/ui/popover.tsx` (PopoverTrigger)

**Patrón aplicado**:
```
data-[state=open]:!border-[#f0c000] dark:data-[state=open]:!border-input
```

**Resultado**:
- **Modo claro + cualquier dropdown abierto** → borde amarillo Memphis 🟡
- **Modo claro + cerrado** → border-input default
- **Modo oscuro** → intacto en ambos estados

**Mecanismo**: Radix primitives agregan `data-state="open"` al trigger automáticamente. Para los componentes con `asChild`, el className y atributos se propagan al elemento hijo vía Slot.

**Alcance**: TODOS los Select, DropdownMenu y Popover del sistema.

### 🔘 Hover global botón "Exportar" — 20 archivos (modo claro únicamente)

**Patrón aplicado**:
```
hover:!bg-black hover:!text-white hover:!border-black
dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input
```

**Comportamiento**:
- **Modo claro**: fondo negro + texto blanco + borde negro
- **Modo oscuro**: hover original de shadcn (intacto) — `bg-accent` + `text-accent-foreground` + `border-input`

**Módulos afectados**: BI (2), Biomédico (2), Compras (4), Contabilidad (2), Finanzas (2), Flota (6), Inventario (1), Proveedores (1)

**Método**: PowerShell con regex idempotente — preserva UTF-8 sin BOM

**Lección aprendida**: cuando se aplica un hover personalizado en modo claro, SIEMPRE agregar override `dark:hover:!...` para preservar el comportamiento original en modo oscuro. Patrón a seguir en futuros cambios.

### 🔘 Hover global botones "CSV" y "PDF" — 5 archivos / 9 botones (modo claro únicamente)

**Patrón aplicado**:
```
hover:!bg-black hover:!text-white hover:!border-black
dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input
```

**Archivos afectados**:
- biomedico/BiomedicoEquipos (PDF)
- finanzas/FinanzasReportes (CSV + PDF)
- flota/reportes/FlotaReporteDocumentos (CSV + PDF)
- flota/reportes/FlotaReporteMantenimientos (CSV + PDF)
- flota/reportes/FlotaReporteVehiculos (CSV + PDF)

**Comportamiento**:
- Modo claro: fondo negro + texto blanco + borde negro
- Modo oscuro: hover original de shadcn (intacto)

### 🔘 Hover global botón "Cancelar" — 42 archivos totales (modo claro únicamente)

**Segunda pasada** (este turno): 31 archivos adicionales con regex mejorada que maneja `=>` en callbacks

**Archivos adicionales por módulo**:
- Admin: GestionCatalogos
- Biomédico: Calibraciones, Contratos, Documentos, Incidencias
- Compras: OrdenDetalle, RecepcionDetalle
- Contabilidad: AsientoForm, ComprobantePagoForm, PeriodosContables, PlanCuentas
- CRM: Actividades, Clientes, Oportunidades
- Finanzas: CajaChica, Presupuestos, Transacciones
- Flota: DocumentosTab, AdicionalesTab, MantenimientoDetalle, VehiculoDetalle
- Inventario: Almacenes, Articulos, Movimientos
- Perfil: UserProfile
- Proveedores: Contratos, Evaluaciones, Talleres
- Proyectos: Documentos, Riesgos, TareaDetalle

**Total acumulado**: 42 archivos con hover Cancelar correcto (light-only + dark override)

### 🔘 Hover global botón "Cancelar" — primera pasada (11 archivos)

**Patrón aplicado**:
- variant="outline": `!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input`
- variant="ghost": `border border-slate-400 + las mismas clases de hover`

**Módulos afectados**:
- Admin: GestionUsuarios
- Biomédico: BiomedicoMantenimientoForm
- Compras: OrdenForm, CotizacionForm, RecepcionForm, RequerimientoForm
- Flota: VehiculoForm, MantenimientoForm
- Proveedores: ProveedorForm
- Proyectos: ProyectoDetalle, ProyectosLista, ValorizacionesTab

**Método**: PowerShell con regex idempotente — detecta variant + agrega clases sin duplicar

**Comportamiento**:
- Modo claro: borde slate-400 + hover negro/blanco
- Modo oscuro: hover original de shadcn (intacto)

### 📊 Finanzas → Dashboard — KPIs refactorizados

**Archivo**: `src/components/modules/finanzas/FinanzasDashboard.tsx`

- ❌ Antes: íconos pequeños (`size-4`) en CardHeader + colores en texto
- ✅ Después: patrón Home (cuadrito sólido + ícono blanco)

**KPIs afectados (4)**:
- Ingresos del Mes → green-500 + TrendingUp
- Egresos del Mes → red-500 + TrendingDown
- Balance → green-500 / red-500 (dinámico según signo)
- Pendientes Aprobación → yellow-500 / slate-400 (dinámico según valor)

**Lógica preservada**: cuadritos dinámicos en Balance (signo) y Pendientes (existencia de pendientes)

### ⬇️ Flecha ChevronDown del Select — Negra en modo claro

**Archivo**: `src/components/ui/select.tsx` (línea 51)

**Cambio**: `<ChevronDownIcon className="size-4 opacity-50" />` → `<ChevronDownIcon className="size-4 opacity-70 text-black dark:text-muted-foreground" />`

**Resultado**:
- **Modo claro**: ícono negro (visible y claro) 🖤
- **Modo oscuro**: ícono muted-foreground (intacto)

**Alcance**: TODOS los SelectTrigger del sistema (formularios, filtros, dropdowns)

### 📅 Calendar picker icon — Negro en modo claro

**Archivo**: `src/styles/globals.css`

**Cambio**: filtro CSS del calendar picker indicator nativo de `<input type="date">` y `<input type="datetime-local">`
- **Modo claro**: `filter: brightness(0)` → ⚫ Negro
- **Modo oscuro**: filtro amarillo Memphis (intacto)

**Mecanismo**: selectores con `:root:not(.dark)` y `.dark` para scoping por modo

**Alcance**: TODOS los `<input type="date">` y `<input type="datetime-local">` del sistema

### 📊 Finanzas → Reportes (P&G) — KPIs refactorizados

**Archivo**: `src/components/modules/finanzas/FinanzasReportes.tsx`

**KPIs afectados (4)** en pestaña P&G:
- Ingresos → green-500 + TrendingUp
- Egresos → red-500 + TrendingDown
- Utilidad Neta → blue-500 / orange-500 (dinámico según signo) + DollarSign
- Margen → purple-500 + Percent

**Import agregado**: `Percent` de lucide-react

### 📊 Finanzas → Flujo de Caja — KPIs refactorizados

**Archivo**: `src/components/modules/finanzas/FinanzasFlujoCaja.tsx`

**KPIs afectados (3)**:
- Total Ingresos → green-500 + ArrowUpRight
- Total Egresos → red-500 + ArrowDownRight
- Balance Neto → blue-500 / orange-500 (dinámico según signo) + DollarSign

### 📊 Finanzas → Transacciones — KPIs refactorizados

**Archivo**: `src/components/modules/finanzas/FinanzasTransacciones.tsx`

**KPIs afectados (3)**:
- Ingresos del Mes → green-500 + TrendingUp
- Egresos del Mes → red-500 + TrendingDown
- Pendientes Aprobación → yellow-500 + AlertCircle

### 🔘 Hover botón "Gestionar" — ProyectosDashboard

**Archivo**: `src/components/modules/proyectos/ProyectosDashboard.tsx`

- ✅ Hover negro+blanco aplicado (light mode + dark override)
- ✅ Único botón "Gestionar" en todo el ERP

### 📊 Proyectos → Dashboard — KPIs refactorizados

**Archivo**: `src/components/modules/proyectos/ProyectosDashboard.tsx`

**KPIs afectados (4)**:
- Proyectos Activos → blue-500 + Clock
- Completados este año → green-500 + CheckCircle2
- Presupuesto activos → emerald-600 (verde dinero) + DollarSign
- Tareas vencidas → red-500 / slate-400 (dinámico) + AlertTriangle

### 📊 Inventario → Dashboard — KPIs refactorizados

**Archivo**: `src/components/modules/inventario/InventarioDashboard.tsx`

- ❌ Antes: íconos pequeños (`size-4`) en CardHeader + colores en texto
- ✅ Después: patrón Home (cuadrito sólido + ícono blanco)

**KPIs afectados (4)**:
- Total Artículos → slate + Package (clickeable → /inventario/articulos, mantiene hover amarillo)
- Stock Crítico → red + AlertTriangle
- Bajo Mínimo → orange + TrendingDown
- Valor Total → amber + DollarSign

**Limpieza**: removidos `text-red-600`, `text-orange-600` de valores y subtextos (los cuadritos ya comunican la urgencia)

### 📊 Compras → Órdenes de Compra y Servicio — KPIs refactorizados

**Archivo**: `src/components/modules/compras/OrdenesLista.tsx`

- ❌ Antes: solo `CardHeader` + `CardContent` con texto plano (sin íconos)
- ✅ Después: patrón Home completo (cuadrito sólido + ícono blanco + valor + label)

**KPIs afectados (4)**:
- Total Órdenes → slate + ShoppingBag
- Pendientes → yellow + Clock
- En Ejecución → blue + Activity
- Total en Proceso → orange + DollarSign

**Imports agregados**: `Clock, Activity, DollarSign` de lucide-react

### 📊 Compras → Cotizaciones — KPIs refactorizados

**Archivo**: `src/components/modules/compras/CotizacionesLista.tsx`

- ❌ Antes: solo `CardHeader` + `CardContent` con texto plano (sin íconos)
- ✅ Después: patrón Home completo (cuadrito sólido + ícono blanco + valor + label)

**KPIs afectados (4)**:
- Total Cotizaciones → slate + FileText
- Pendientes → blue + Clock
- Aprobadas → green + CheckCircle
- Total Aprobado → orange + DollarSign

**Imports agregados**: `Clock, CheckCircle, DollarSign` de lucide-react

### 📊 Compras → Requerimientos — KPIs refactorizados

**Archivo**: `src/components/modules/compras/RequerimientosLista.tsx`

- ❌ Antes: solo `CardHeader` + `CardContent` con texto plano (sin íconos)
- ✅ Después: patrón Home completo (cuadrito sólido + ícono blanco + valor + label)

**KPIs afectados (4)**:
- Total Requerimientos → slate + ClipboardList
- Pendientes → blue + Clock
- Aprobados → green + CheckCircle
- Total Estimado → orange + DollarSign

**Imports agregados**: `ClipboardList, Clock, CheckCircle, DollarSign` de lucide-react

### 📊 Red de Talleres — KPI estandarizado

**Archivo**: `src/components/modules/proveedores/ProveedoresTalleres.tsx`

- ✅ KPI "Talleres activos": cuadrito azul sólido (`bg-blue-500`) + `Wrench` blanco
- ✅ Patrón unificado con Home (`size-10` + `size-5 text-white`)

### 🗺️ Red de Talleres — Botón "Mapa"

**Archivo**: `src/components/modules/proveedores/ProveedoresTalleres.tsx`

- ✅ Hover negro + texto blanco aplicado al botón "Mapa" (toggle de vista Lista/Mapa)
- Botón "Lista" intacto (es el activo amarillo por default)

### 🎨 Fondo de campos de formulario (Inputs/Select/Textarea)

**Archivo**: `src/styles/globals.css`

**Cambio**: `--input-background` en modo claro
- ❌ Antes: `#FFFFFF` (blanco puro, saturante visualmente)
- ✅ Después: `#E8EEF5` (slate-150 personalizado, descanso visual)

**Modo oscuro**: intacto en `#1A1A1A`

**Componentes afectados automáticamente** (al cambiar CSS variable):
- `Input`, `SelectTrigger`, `Textarea`, `InputOTP`, `Checkbox`

### 🏠 PageNav (Home + Volver) — Hover global

**Archivo**: `src/components/shared/PageNav.tsx`

- ✅ Hover aplicado a los dos botones (Home casita + Volver)
- ✅ Fondo negro + texto/ícono blanco
- ✅ Como es componente compartido, aplica **automáticamente** en todas las páginas que usan PageNav

### 🛡️ Refactorización: Prevención de bugs claro/oscuro

**Causa raíz arreglada (en sesión)**:
- ❌ `tailwind.config.js` sin `darkMode: 'class'` → `dark:` variants se activaban por preferencia del SO
- ✅ Agregado `darkMode: 'class'` → ahora `dark:` solo activa cuando `.dark` está en `<html>`

**Hook reactivo creado**:
- 📁 `src/hooks/useDarkMode.ts`
- Reemplaza el patrón anterior no-reactivo `document.documentElement.classList.contains('dark')`
- Usa `MutationObserver` para detectar cambios de modo en vivo (sin recarga)
- Aplicado en: `HomeWelcome.tsx`, `Dashboard.tsx`

**Documentación de convenciones**:
- 📁 `docs/CONVENCIONES-TEMAS-CLARO-OSCURO.md`
- Reglas: ✅ HACER vs ❌ NO HACER
- Checklist obligatorio antes de commit
- Guía de debugging
- Referencias a archivos clave

**Beneficio**: futuros cambios visuales tienen reglas claras a seguir. Bugs por contaminación entre modos quedan prevenidos.

### 🎨 Hover en dropdowns de Select (modo claro)

**Archivos**: `src/components/ui/select.tsx`, `src/styles/globals.css`

**Problema**: El hover en items de Select usaba `--accent: #FFF9E6` (amarillo pálido lavado) que no daba contraste suficiente

**Solución aplicada**:
- ✅ CSS directo en `globals.css` con selector `[data-slot="select-item"][data-highlighted]` y `:focus`
- ✅ Modo claro: hover negro `#0D0D0D` + texto blanco
- ✅ Modo oscuro: intacto (mantiene `--accent: #2D2500` con texto amarillo Memphis)
- ✅ Aplica globalmente a TODOS los Select del sistema

### 🟡 Botón "Ver todos" (Dashboard General)

- ✅ Cambiado de `variant="ghost"` a botón amarillo Memphis (igual que "Ver dashboard" del Home)
- ✅ Estilo: `bg-[#f0c000] text-black hover:bg-[#d4a800]`
- ✅ Ícono `ArrowRight` (era `ArrowUpRight`)
- ✅ Coherencia visual con el Home

### 🚀 Cards Accesos Rápidos del Home

- ✅ Bordes con **inline style + detección JS de modo**: detecta `document.documentElement.classList.contains('dark')` para aplicar negro (#000000) en claro o amarillo (#f0c000) en oscuro
- ✅ Borde completo (4 lados) solo en hover, borde izq 4px siempre visible
- ✅ Fondo modo claro: `#E2E8F0` (slate-200, distinguible del fondo página)
- ✅ Sombra: solo en hover `hover:shadow-md`
- ✅ Texto descripción `text-muted-foreground` → `group-hover:text-foreground` para contraste en hover
- ✅ Hover modo claro: fondo cambia a `#E2E8F0` (slate-200, sutil) usando React `useState` para trackear el card hovered (evita bug de DOM manipulation directa)
- ✅ Borde general: 1px negro en claro / 1px #2D2D2D en oscuro
- ✅ Borde izquierdo: 4px negro en claro / 4px amarillo Memphis en oscuro
- ✅ Flecha `›`: negro en claro / amarillo Memphis en oscuro
- ✅ Fondo: `bg-[#E2E8F0] dark:bg-card` (slate-200 en claro, Memphis dark en oscuro)
- ✅ Hover: borde `slate-900` + sombra `shadow-md` (sin cambiar el bg)
- ✅ Flecha indicador: `text-black dark:text-[#f0c000]` (negro en claro, amarillo Memphis en oscuro)
- ✅ Íconos: gris uniforme `text-slate-700` en reposo
- ✅ Íconos hover: `bg-black + text-white` (todos los 8 cards)
- ✅ Mantienen flecha `›` amarilla como indicador de navegación

---

## 📋 PENDIENTE / POR REVISAR

### Modo claro — ✅ COMPLETADO (ver `ENTREGA-Modo-Claro-Estandarizacion-Completa.md`)
- ✅ Topbar — hover negro/blanco en los 4 botones del header
- ✅ Dashboards individuales (Flota, Biomédico, CRM, BI, Administración) estandarizados
- ✅ Listas / tablas — KPIs al patrón Home + hovers de fila/acción
- ✅ Detalles — íconos de título + botones con hover
- ✅ Formularios — botones (Cancelar/Cerrar/Guardar) con hover
- ✅ Vistas públicas / QR — botones con hover

### Limpieza pendiente (menor, no bloquea PR)
- ⏳ Wrappers viejos sin uso: `Inventario.tsx`, `Finanzas.tsx`, `Proyectos.tsx`, `CRM.tsx`, etc.
- ⏸️ **Contabilidad: deshabilitado** — no registrado en `modules-config.ts`, el sidebar lo oculta. Se omite a propósito (nadie lo ve).
- ⏳ `BIDashboard.tsx`: props `color`/`bgColor` sin uso en `ModuloCard` (limpieza opcional)

### Documentación
- ✅ `ENTREGA-Modo-Claro-Estandarizacion-Completa.md` creado
- ⏳ Descripción del Pull Request (siguiente paso)

---

## 🎯 DECISIONES IMPORTANTES TOMADAS

1. **Sidebar siempre negro** (#1A1A1A) — coherencia entre modos
2. **Login split layout** — Brand Forward, no minimalista
3. **Cards en outline design** (mismo color que background) — menos saturación
4. **Borde slate-900** en lugar de negro puro — más amigable
5. **KPI cards sin hover** — diferenciar informativas vs interactivas
6. **Convención cards**:
   - Borde izquierdo grueso = navegación (clickeable, lleva a vista)
   - Borde inferior grueso amarillo = acción (crea algo nuevo)
   - Sin acento = informativa (no clickeable)
7. **Color del modo claro: slate-100 fondo, slate-900 bordes** — armonía cromática
8. **"Productos" → "Artículos"** — consistencia con código interno
9. **Catálogos agrupados con Select** — escalable cuando crezca la lista
10. **Documentación en español** siguiendo el patrón del equipo TI Memphis

---

## 📞 NOTAS PERSONALES

- El jefe usa documentación en `docs/` con prefijos `ENTREGA-`, `CHANGELOG-`, `PLAN-`, `QA-VALIDATION-`, `ROADMAP-`
- Convención de la sesión: explicación clara + ejemplos prácticos para onboarding
- Idioma: español
- Audiencia: jefe (decisor) + futuros devs (onboarding)
