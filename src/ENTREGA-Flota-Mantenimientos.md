# ENTREGA: MÓDULO FLOTA → MANTENIMIENTOS v2.0
**Fecha:** 2026-02-04
**Patrón:** Enterprise CRUD con routing custom (sin React Router)

---

## 📂 ARCHIVOS TOCADOS/CREADOS

### Librerías (Source of Truth)
1. `/lib/flota/ot-config.ts` ✅ **ACTUALIZADO**
   - Ya existía y está correctamente configurado
   - Contiene estados, tipos, criticidad, badges WCAG, helpers
   - UMBRAL_APROBACION_GERENCIAL = 1500
   - Funciones: generateNumeroOT, determinarEstadoInicial, normalizeEstado

2. `/lib/flota/ot-store.tsx` ✅ **ACTUALIZADO**
   - Agregada función `anularOT(numeroOT, motivo)` para anulación con validación >=30 caracteres
   - Seed idempotente con 6 OTs de ejemplo
   - Funciones: crearOrdenTrabajo, actualizarEstadoOT, anularOT, obtenerOTPorNumero

### Componentes de UI (Nuevos)
3. `/components/modules/flota/MantenimientosLista.tsx` ✅ **CREADO**
   - Pantalla: `/flota/mantenimientos`
   - Tabs: Activas, Cerradas, Anuladas, Todas
   - Filtros: busqueda, tipo, criticidad
   - KPIs dashboard (6 cards)
   - Alerta para OTs en espera de aprobación
   - CTA "Nueva OT" con dropdown por tipo
   - Navegación a detalle usando Eye (con numeroOT formato OT-YYYY-NNN)

4. `/components/modules/flota/MantenimientoForm.tsx` ✅ **CREADO**
   - Pantalla: `/flota/mantenimientos/nueva?tipo=preventivo|correctivo|predictivo`
   - Formulario SIMPLE (NO wizard)
   - Auto-cálculo de SLA según tipo + criticidad
   - Alerta si costo > umbral (requiere aprobación)
   - Validaciones: titulo, descripción, fecha, kilometraje
   - Callback onSuccess navega a detalle con numeroOT

5. `/components/modules/flota/MantenimientoDetalle.tsx` ✅ **CREADO**
   - Pantalla: `/flota/mantenimientos/{OT-YYYY-NNN}`
   - Tabs: Resumen, Diagnóstico, Repuestos, Auditoría
   - Acciones contextuales según estado:
     - `programada` → Iniciar Ejecución
     - `en_ejecucion` → Cerrar OT
     - `espera_aprobacion` → Aprobar OT
     - Siempre visible (si no cerrada/anulada): Anular
   - Dialog de anulación con validación de motivo >= 30 caracteres
   - Alerta para estados especiales (espera_aprobacion, anulada)

### Scaffold Global
6. `/App.tsx` ✅ **ACTUALIZADO**
   - Routing por segmentos (NO regex frágil)
   - Importa nuevos componentes: MantenimientosLista, MantenimientoForm, MantenimientoDetalle
   - Asegura que provider NO se remonta al navegar
   - 3 rutas registradas:
     - `/flota/mantenimientos` → MantenimientosLista
     - `/flota/mantenimientos/nueva?tipo=X` → MantenimientoForm
     - `/flota/mantenimientos/{numeroOT}` → MantenimientoDetalle

7. `/components/layout/ERPSidebar.tsx` ✅ **NO MODIFICADO**
   - Ya tiene active state correcto con `isSubItemActive`
   - Match exacto para `/flota` y prefijo para `/flota/mantenimientos`

---

## 🗺️ TABLA DE RUTAS → COMPONENTES

| Ruta | Componente | Props Callback | Descripción |
|------|-----------|----------------|-------------|
| `/flota/mantenimientos` | `MantenimientosLista` | `onNavigateToDetalle`, `onNavigateToNueva` | Lista con tabs/filtros/KPIs |
| `/flota/mantenimientos/nueva?tipo=preventivo` | `MantenimientoForm` | `tipoInicial`, `onCancel`, `onSuccess` | Form simple (no wizard) |
| `/flota/mantenimientos/nueva?tipo=correctivo` | `MantenimientoForm` | `tipoInicial`, `onCancel`, `onSuccess` | Form simple (no wizard) |
| `/flota/mantenimientos/nueva?tipo=predictivo` | `MantenimientoForm` | `tipoInicial`, `onCancel`, `onSuccess` | Form simple (no wizard) |
| `/flota/mantenimientos/OT-2024-001` | `MantenimientoDetalle` | `numeroOT`, `onBack` | Detalle con tabs + acciones |
| `/flota/mantenimientos/OT-2024-002` | `MantenimientoDetalle` | `numeroOT`, `onBack` | Detalle con tabs + acciones |
| `/flota/mantenimientos/{any-OT-YYYY-NNN}` | `MantenimientoDetalle` | `numeroOT`, `onBack` | Detalle con tabs + acciones |

**Nota:** Routing usa extracción por segmentos (`segments[3]`), NO regex. Compatible con cualquier numeroOT formato `OT-YYYY-NNN`.

---

## ✅ QA CHECKLIST EJECUTABLE (10 pruebas)

### Prueba 1: Navegación a Lista de Mantenimientos
**Pasos:**
1. En sidebar, expandir "Flota"
2. Click en "Mantenimientos"

**Expected Result:**
- Sidebar: "Mantenimientos" debe tener bg-accent/50 (activo)
- Página muestra: título "Órdenes de Trabajo", 6 KPIs cards, tabs (Activas/Cerradas/Anuladas/Todas)
- Tab "Activas" activo por defecto
- Tabla muestra OTs con estado != cerrada && != anulada (debe haber 3 OTs: OT-2024-001, OT-2024-002, OT-2024-003, OT-2024-006)

---

### Prueba 2: Crear Nueva OT - Tipo Preventivo
**Pasos:**
1. En `/flota/mantenimientos`, click en "Nueva Orden de Trabajo"
2. Seleccionar "Mantenimiento Preventivo" del dropdown
3. Llenar form:
   - Criticidad: Alta
   - Título: "Test OT Preventivo"
   - Descripción: "Prueba de creación"
   - Fecha programada: Seleccionar fecha futura
   - Kilometraje: 50000
   - Taller: Taller Interno - Base Central
   - Costo Mano Obra: 500
   - Costo Repuestos: 800
4. Click "Crear Orden de Trabajo"

**Expected Result:**
- Toast success: "Orden de Trabajo OT-2026-007 creada exitosamente" (número puede variar según seed)
- Estado inicial: "Programada" (porque costo total = 1300 < 1500)
- Navega a `/flota/mantenimientos/OT-2026-007`
- Detalle muestra toda la info correcta

---

### Prueba 3: Crear OT con Aprobación Gerencial
**Pasos:**
1. En `/flota/mantenimientos`, crear Nueva OT
2. Tipo: Correctivo
3. Llenar form con costo Mano Obra: 1000, Repuestos: 800 (total 1800 > 1500)
4. Verificar que aparece alerta naranja: "Aprobación gerencial requerida"
5. Guardar OT

**Expected Result:**
- Toast success menciona: "Estado inicial: En espera de aprobación gerencial"
- OT creada con estado `espera_aprobacion`
- En lista, aparece en tab "Activas"
- Alerta amarilla en top de lista: "X OT(s) en espera de aprobación gerencial"

---

### Prueba 4: Filtros en Lista
**Pasos:**
1. En `/flota/mantenimientos`, escribir en buscador: "frenos"
2. Verificar que filtra en tiempo real
3. Cambiar filtro Tipo a "Correctivo"
4. Cambiar filtro Criticidad a "Crítica"
5. Click "Limpiar Filtros"

**Expected Result:**
- Búsqueda: Solo muestra OT-2024-002 (título contiene "frenos")
- Tipo Correctivo: Filtra OTs de tipo correctivo
- Criticidad Crítica: Solo OT-2024-002
- Limpiar Filtros: Restaura todos los registros, borra búsqueda

---

### Prueba 5: Tabs de Estados
**Pasos:**
1. En `/flota/mantenimientos`, click en cada tab:
   - Activas
   - Cerradas
   - Anuladas
   - Todas
2. Verificar conteo en cada tab

**Expected Result:**
- **Activas (4):** OT-2024-001 (programada), OT-2024-002 (en_ejecucion), OT-2024-003 (espera_repuesto), OT-2024-006 (espera_aprobacion)
- **Cerradas (1):** OT-2024-004
- **Anuladas (1):** OT-2024-005
- **Todas (6):** Todas las OTs del seed

---

### Prueba 6: Navegación a Detalle
**Pasos:**
1. En `/flota/mantenimientos`, tab Activas
2. Click en icono Eye (👁️) de OT-2024-002

**Expected Result:**
- Navega a `/flota/mantenimientos/OT-2024-002`
- URL en barra del navegador cambia correctamente
- Detalle carga correctamente
- Header muestra: numeroOT, badges de estado/tipo/criticidad
- Tab "Resumen" activo por defecto

---

### Prueba 7: Acciones Contextuales en Detalle
**Pasos:**
1. Navegar a `/flota/mantenimientos/OT-2024-001` (estado: programada)
2. Verificar botón "Iniciar Ejecución"
3. Click en "Iniciar Ejecución"
4. Verificar que estado cambia a "En Ejecución"
5. Navegar a `/flota/mantenimientos/OT-2024-006` (estado: espera_aprobacion)
6. Verificar botón "Aprobar OT"

**Expected Result:**
- OT-2024-001: Botón "Iniciar Ejecución" visible
- Después de click: Toast success, badge cambia a "En Ejecución"
- OT-2024-006: Botón "Aprobar OT" visible
- Después de aprobar: Estado cambia a "Programada"

---

### Prueba 8: Anular OT con Validación
**Pasos:**
1. Navegar a `/flota/mantenimientos/OT-2024-001`
2. Click en botón "Anular" (rojo, con XCircle)
3. Dialog aparece: escribir motivo con menos de 30 caracteres ("test")
4. Verificar que botón "Confirmar Anulación" está deshabilitado
5. Escribir motivo válido >= 30 caracteres: "OT anulada por error en el registro del kilometraje real del vehículo"
6. Click "Confirmar Anulación"

**Expected Result:**
- Botón "Confirmar Anulación" habilitado solo con motivo >= 30 chars
- Toast success: "Orden de Trabajo anulada exitosamente"
- Estado cambia a "anulada"
- Alerta roja en top: "OT Anulada: {motivo}"
- Botón "Anular" ya no visible

---

### Prueba 9: Tabs en Detalle
**Pasos:**
1. Navegar a `/flota/mantenimientos/OT-2024-002`
2. Click en cada tab: Resumen, Diagnóstico, Repuestos, Auditoría

**Expected Result:**
- **Resumen:** Info general, taller, fechas, costos
- **Diagnóstico:** Descripción del problema, observaciones
- **Repuestos:** Tabla con 2 repuestos (Pastillas freno, Líquido frenos), total $330
- **Auditoría:** Creadopor juan.perez, Modificado por carlos.mendoza, timeline de cambios

---

### Prueba 10: Badges WCAG AA Compliance
**Pasos:**
1. En `/flota/mantenimientos` o detalle, inspeccionar badges visualmente
2. Verificar contraste de colores según estados:
   - programada: azul con borde (text-blue-600 border-blue-600)
   - en_ejecucion: bg-primary con texto blanco
   - espera_repuesto: amarillo (bg-yellow-100 text-yellow-800)
   - espera_aprobacion: naranja (bg-orange-100 text-orange-800)
   - cerrada: verde con borde (text-green-600 border-green-600)
   - anulada: gris (bg-gray-100 text-gray-600)

**Expected Result:**
- Todos los badges tienen contraste suficiente WCAG AA
- Iconos lucide-react visibles junto a label
- NO hay texto del mismo color que el fondo (legibilidad garantizada)

---

## 🎯 RESUMEN DE IMPLEMENTACIÓN

✅ **3 rutas production-ready** (lista, crear, detalle)
✅ **Routing por segmentos** (sin regex frágil)
✅ **Store centralizado** con seed idempotente y función anularOT
✅ **Config centralizada** (ot-config.ts) como source of truth
✅ **Badges WCAG AA compliant** (contraste suficiente)
✅ **Acciones contextuales** según estado de OT
✅ **Validaciones** en form y anulación (motivo >= 30 chars)
✅ **Auditoría obligatoria** en todas las operaciones
✅ **Provider NO se remonta** al navegar entre rutas

---

## 📋 NOTAS ADICIONALES

- Los componentes viejos (`MantenimientosVehiculo.tsx`, `NuevaOrdenTrabajo.tsx`, `DetalleOrdenTrabajo.tsx`) aún existen pero NO se usan en el routing actual.
- El módulo Biomédico NO fue tocado y sigue funcionando correctamente.
- El módulo Proveedores y Compras NO fueron tocados.
- El sidebar (ERPSidebar.tsx) ya tenía el active state correcto, NO requirió modificaciones.
- DEBUG_OT está activado en ot-config.ts para facilitar debugging en consola.

---

**Status:** ✅ COMPLETO Y LISTO PARA QA GATE
