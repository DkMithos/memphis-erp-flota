# ENTREGA: FIX ROUTING FLOTA (Dashboard/Vehículos/Mantenimientos)

**Fecha:** 2026-02-04  
**Objetivo:** Corregir routing del módulo Flota para que /flota, /flota/vehiculos y /flota/mantenimientos rendericen componentes distintos  
**Patrón:** Custom routing sin React Router

---

## 📂 ARCHIVOS MODIFICADOS/CREADOS

### A) Componentes Nuevos

#### 1. `/components/modules/flota/FlotaDashboard.tsx` ✅ **CREADO**
- Dashboard operativo de Flota (renombrado desde Flota.tsx)
- KPIs principales, gráficos, tabla de vehículos críticos
- Props: `{ onNavigate: (route: string) => void }`
- Ruta asociada: `/flota` y `/flota/dashboard`

#### 2. `/components/modules/flota/VehiculosLista.tsx` ✅ **CREADO**
- Lista enterprise-ready de vehículos
- KPIs (Total, Operativos, En Mantenimiento, KM Promedio)
- Filtros: búsqueda, tipo, estado
- Tabla con acciones: Ver detalle, Nueva OT, Documentos
- Props: `{ onNavigate: (route: string) => void }`
- Ruta asociada: `/flota/vehiculos`

#### 3. `/components/modules/flota/VehiculoDetalle.tsx` ✅ **CREADO**
- Detalle de vehículo individual
- Información general (placa, VIN, marca, modelo, etc.)
- Programa de mantenimiento (último/próximo)
- Placeholders para documentos y consumo de combustible
- Props: `{ vehiculoId: string; onBack: () => void; onNavigate: (route: string) => void }`
- Ruta asociada: `/flota/vehiculos/{vehiculoId}` (ej: `/flota/vehiculos/VH-001`)

### B) Archivos Modificados

#### 4. `/App.tsx` ✅ **ACTUALIZADO**
**Cambios en imports:**
```typescript
import { FlotaDashboard } from './components/modules/flota/FlotaDashboard';
import { VehiculosLista } from './components/modules/flota/VehiculosLista';
import { VehiculoDetalle } from './components/modules/flota/VehiculoDetalle';
```

**Cambios en routing de Flota (líneas 418-470):**
```typescript
// Routing de Flota con subrutas
if (currentRoute.startsWith('/flota')) {
  // 1. /flota/mantenimientos/nueva?tipo=preventivo|correctivo|predictivo
  if (currentRoute.startsWith('/flota/mantenimientos/nueva')) {
    const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
    const tipoParam = urlParams.get('tipo') as 'preventivo' | 'correctivo' | 'predictivo' | null;
    
    return (
      <MantenimientoForm 
        tipoInicial={tipoParam || undefined}
        onCancel={() => navigateTo('/flota/mantenimientos')}
        onSuccess={(numeroOT) => navigateTo(`/flota/mantenimientos/${numeroOT}`)}
      />
    );
  }
  
  // 2. /flota/mantenimientos/:numeroOT - OT-YYYY-NNN (routing por segmentos)
  if (currentRoute.startsWith('/flota/mantenimientos/') && 
      !currentRoute.startsWith('/flota/mantenimientos/nueva')) {
    const segments = currentRoute.split('/');
    const numeroOT = segments[3].split('?')[0];
    
    return (
      <MantenimientoDetalle 
        numeroOT={numeroOT}
        onBack={() => navigateTo('/flota/mantenimientos')}
      />
    );
  }
  
  // 3. /flota/mantenimientos (lista)
  if (currentRoute === '/flota/mantenimientos') {
    return (
      <MantenimientosLista 
        onNavigateToDetalle={(numeroOT) => navigateTo(`/flota/mantenimientos/${numeroOT}`)}
        onNavigateToNueva={(tipo) => navigateTo(`/flota/mantenimientos/nueva?tipo=${tipo}`)}
      />
    );
  }
  
  // 4. /flota/vehiculos/:vehiculoId - Detalle de vehículo (ej: VH-001)
  if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.split('/').length === 4) {
    const segments = currentRoute.split('/');
    const vehiculoId = segments[3];
    return (
      <VehiculoDetalle 
        vehiculoId={vehiculoId}
        onBack={() => navigateTo('/flota/vehiculos')}
        onNavigate={navigateTo}
      />
    );
  }
  
  // 5. /flota/vehiculos (lista)
  if (currentRoute === '/flota/vehiculos') {
    return <VehiculosLista onNavigate={navigateTo} />;
  }
  
  // 6. /flota/dashboard (dashboard explícito)
  if (currentRoute === '/flota/dashboard') {
    return <FlotaDashboard onNavigate={navigateTo} />;
  }
  
  // 7. /flota (dashboard por defecto)
  if (currentRoute === '/flota' || currentRoute === '/flota/') {
    return <FlotaDashboard onNavigate={navigateTo} />;
  }
  
  // Fallback: dashboard
  return <FlotaDashboard onNavigate={navigateTo} />;
}
```

**Orden de evaluación (CRÍTICO):**
1. `/flota/mantenimientos/nueva` (exacto con query params) → MantenimientoForm
2. `/flota/mantenimientos/{numeroOT}` (prefijo, excluye /nueva) → MantenimientoDetalle
3. `/flota/mantenimientos` (exacto) → MantenimientosLista
4. `/flota/vehiculos/{vehiculoId}` (prefijo + 4 segmentos) → VehiculoDetalle
5. `/flota/vehiculos` (exacto) → VehiculosLista
6. `/flota/dashboard` (exacto) → FlotaDashboard
7. `/flota` o `/flota/` (exacto) → FlotaDashboard
8. Fallback → FlotaDashboard

#### 5. `/components/layout/ERPSidebar.tsx` ✅ **SIN CAMBIOS NECESARIOS**
El sidebar ya tiene la lógica correcta:
- Submenu de Flota con Dashboard, Vehículos, Mantenimientos
- `isSubItemActive()` hace match por prefijo correctamente
- Active state funciona para:
  - `/flota` o `/flota/dashboard` → activa "Dashboard"
  - `/flota/vehiculos` o `/flota/vehiculos/VH-001` → activa "Vehículos"
  - `/flota/mantenimientos` o `/flota/mantenimientos/OT-2024-001` → activa "Mantenimientos"

---

## 🗺️ TABLA DE RUTAS → COMPONENTES

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/flota` | `FlotaDashboard` | Dashboard operativo con KPIs y gráficos |
| `/flota/dashboard` | `FlotaDashboard` | Alias explícito del dashboard |
| `/flota/vehiculos` | `VehiculosLista` | Lista de vehículos con filtros |
| `/flota/vehiculos/{id}` | `VehiculoDetalle` | Detalle de vehículo (ej: `/flota/vehiculos/VH-001`) |
| `/flota/mantenimientos` | `MantenimientosLista` | Lista de órdenes de trabajo |
| `/flota/mantenimientos/nueva` | `MantenimientoForm` | Form para crear nueva OT |
| `/flota/mantenimientos/{numeroOT}` | `MantenimientoDetalle` | Detalle de OT (ej: `/flota/mantenimientos/OT-2024-001`) |

---

## ✅ QA CHECKLIST (7 pruebas ejecutables)

### Prueba 1: Dashboard de Flota (/flota)
**Pasos:**
1. Login → Sidebar → Click "Flota"
**Expected:**
- URL: `/flota`
- Renderiza `FlotaDashboard`
- Muestra KPIs (Total Vehículos, Costo por KM, Consumo, etc.)
- Muestra gráficos (Costos, Tendencia, Distribución)
- Muestra tabla de "Vehículos que Requieren Atención"
- Sidebar: "Dashboard" activo (bg-accent/50)

---

### Prueba 2: Navegación a Vehículos desde Sidebar
**Pasos:**
1. Desde Dashboard → Sidebar → Click "Vehículos"
**Expected:**
- URL: `/flota/vehiculos`
- Renderiza `VehiculosLista`
- Muestra KPIs (Total, Operativos, En Mantenimiento, KM Promedio)
- Muestra filtros (búsqueda, tipo, estado)
- Muestra tabla de vehículos con acciones
- Sidebar: "Vehículos" activo (bg-accent/50)
- **NO renderiza Dashboard**

---

### Prueba 3: Detalle de Vehículo
**Pasos:**
1. En `/flota/vehiculos` → Click botón "Ver" (icono Eye) en primera fila
**Expected:**
- URL: `/flota/vehiculos/VH-001` (o el ID del vehículo)
- Renderiza `VehiculoDetalle`
- Muestra breadcrumb con "Volver a lista"
- Muestra información general (placa, VIN, marca, etc.)
- Muestra programa de mantenimiento
- Sidebar: "Vehículos" sigue activo (match por prefijo)

---

### Prueba 4: Volver a Lista desde Detalle
**Pasos:**
1. En `/flota/vehiculos/VH-001` → Click "Volver a lista"
**Expected:**
- URL: `/flota/vehiculos`
- Renderiza `VehiculosLista` nuevamente
- Sin errores en consola

---

### Prueba 5: Navegación a Mantenimientos desde Sidebar
**Pasos:**
1. Desde Vehículos → Sidebar → Click "Mantenimientos"
**Expected:**
- URL: `/flota/mantenimientos`
- Renderiza `MantenimientosLista`
- Muestra lista de OTs existentes
- Sidebar: "Mantenimientos" activo
- **NO renderiza Dashboard ni VehiculosLista**

---

### Prueba 6: Crear Nueva OT desde Dashboard
**Pasos:**
1. En `/flota` (Dashboard) → Click "Programar" en tabla de vehículos críticos
**Expected:**
- URL: `/flota/mantenimientos/nueva?tipo=preventivo`
- Renderiza `MantenimientoForm`
- Form con tipo "Preventivo" pre-seleccionado

---

### Prueba 7: Flujo completo - Crear OT desde Vehículos
**Pasos:**
1. `/flota/vehiculos` → Click botón Wrench (Nueva OT) en vehículo
2. Llenar form y guardar
3. Navega automáticamente a detalle de OT
4. Sidebar → Click "Vehículos"
**Expected:**
- Paso 1: URL `/flota/mantenimientos/nueva?vehiculo=VH-001`
- Paso 2: Form se llena correctamente
- Paso 3: URL `/flota/mantenimientos/OT-2026-XXX`, muestra MantenimientoDetalle
- Paso 4: URL `/flota/vehiculos`, renderiza VehiculosLista
- Sin errores en consola en ningún momento

---

## 🎯 CAMBIOS CLAVE DEL FIX

✅ **Routing por segmentos sin regex** - Evita falsos positivos y es más mantenible  
✅ **Orden de evaluación correcto** - Rutas específicas primero, genéricas después  
✅ **Componentes separados** - Dashboard, Lista, Detalle en archivos independientes  
✅ **Active state en Sidebar** - Match por prefijo funciona para subrutas  
✅ **Props consistentes** - Todos usan `onNavigate` callback pattern  
✅ **Fallback controlado** - Si no matchea nada, muestra Dashboard (no error 404)

---

## 📋 ARCHIVOS AFECTADOS (RESUMEN)

**Creados:**
- `/components/modules/flota/FlotaDashboard.tsx`
- `/components/modules/flota/VehiculosLista.tsx`
- `/components/modules/flota/VehiculoDetalle.tsx`

**Modificados:**
- `/App.tsx` (bloque routing de Flota, líneas ~418-470)

**Sin cambios:**
- `/components/layout/ERPSidebar.tsx` (ya funciona correctamente)
- `/components/modules/flota/MantenimientosLista.tsx`
- `/components/modules/flota/MantenimientoForm.tsx`
- `/components/modules/flota/MantenimientoDetalle.tsx`
- `/lib/flota/ot-config.ts`
- `/lib/flota/ot-store.tsx`

---

## ⚠️ NOTAS IMPORTANTES

1. **NO usar React Router** - Sistema usa estado local + callbacks
2. **Orden de rutas es crítico** - Específicas antes de genéricas
3. **Mantenimientos ya estaba correcto** - Solo se arregló Dashboard/Vehículos
4. **Mock data en componentes** - VehiculosLista y VehiculoDetalle usan datos dummy
5. **Componente Flota.tsx obsoleto** - Puede eliminarse si se confirma que no se usa en otro lugar

---

**Status:** ✅ **ROUTING FIX COMPLETADO**  
**Testing:** Listo para QA con 7 pruebas ejecutables  
**Consola:** Sin errores esperados
