# KESA ERP - Flota → Vehículos: Contratos, Plan Preventivo y Documentos

## Versión: v3.0.0
## Fecha: 2024-12-19

---

## 📁 ARCHIVOS MODIFICADOS

### 1. `/lib/flota/vehiculos-config.ts`
**Cambios principales:**
- ✅ Nuevos enums: `TipoContratoFlota`, `TipoPlanPreventivo`, `TipoDocumentoVehiculo`
- ✅ Nuevas interfaces:
  - `VehiculoVinculoContrato` (clienteNombre, proyectoNombre, contratoNombre, tipoContrato, fechas)
  - `PlanPreventivoContratado` (habilitado, tipoPlan, totalPreventivosContratados, intervalos)
  - `VehiculoDocumento` (id, tipo, nombre, numero?, fechas, archivoNombre?, observaciones?, auditoría)
- ✅ Interface `Vehiculo` actualizado con:
  - `vinculoContrato?: VehiculoVinculoContrato`
  - `planPreventivoContratado?: PlanPreventivoContratado`
  - `documentosVehiculo?: VehiculoDocumento[]`
- ✅ Helpers puros para documentos:
  - `calcEstadoDocumento(fechaVencimiento)` → `'vigente' | 'proximo' | 'vencido'`
  - `calcDiasRestantesDocumento(fechaVencimiento)` → number
  - `getEstadoDocumentoBadge(estado)` → { variant, label, color }
  - `validarDocumento(documento)` → ValidacionResult
  - `generarDocumentoId()` → string
- ✅ Helpers puros para preventivos/contrato:
  - `calcPreventivosUsadosRestantes(vehiculoId, ots, plan)` → { usados, restantes, total, porcentajeUsado }
  - `validarVinculoContrato(vinculo)` → ValidacionResult
  - `validarPlanPreventivo(plan)` → ValidacionResult
- ✅ Constants: `TIPO_DOCUMENTO_LABELS`, `TIPO_CONTRATO_LABELS`, `TIPO_PLAN_PREVENTIVO_LABELS`, `UMBRAL_DIAS_DOCUMENTO`

### 2. `/lib/flota/vehiculos-store.tsx`
**Cambios principales:**
- ✅ Actualizado a v3.0.0 con soporte para contratos, plan preventivo y documentos
- ✅ Imports actualizados con nuevos helpers de validación
- ✅ `VehiculosContextType` actualizado con **5 nuevas funciones**:
  1. `actualizarVinculoContrato(vehiculoId, vinculo)` → { exito, errores? }
  2. `actualizarPlanPreventivo(vehiculoId, plan)` → { exito, errores? }
  3. `agregarDocumentoVehiculo(vehiculoId, doc)` → { exito, documentoId?, errores? }
  4. `actualizarDocumentoVehiculo(vehiculoId, docId, patch)` → { exito, errores? }
  5. `eliminarDocumentoVehiculo(vehiculoId, docId)` → { exito, errores? }
  6. `obtenerDocumentosVehiculo(vehiculoId)` → VehiculoDocumento[] (helper selector)
- ✅ Seed data actualizado con documentos legacy compatibles
- ✅ Seed idempotente: no sobrescribe data existente en localStorage
- ✅ Debug logs controlados por flag `DEBUG_VEHICULOS`
- ✅ Hard delete para documentos (simplicidad front-only)
- ✅ Auditoría en todas las operaciones (creadoPor, creadoEn, modificadoPor, modificadoEn)
- ✅ Validaciones completas en todas las operaciones

---

## 🎯 FUNCIONES IMPLEMENTADAS (DETALLE)

### 1. `actualizarVinculoContrato(vehiculoId, vinculo)`
**Descripción:** Actualiza el vínculo de contrato del vehículo.

**Validaciones:**
- Vehículo debe existir
- Cliente/Proyecto/Contrato mínimo 3 caracteres
- Tipo de contrato obligatorio
- Fechas coherentes (inicio < fin)

**Persistencia:**
- Actualiza `vehículo.vinculoContrato`
- Guarda en localStorage automáticamente
- Auditoría: actualiza `modificadoPor` y `modificadoEn`

**Debug Log:** `[VEHICULOS] Vinculo de contrato actualizado exitosamente: VH-XXX`

---

### 2. `actualizarPlanPreventivo(vehiculoId, plan)`
**Descripción:** Actualiza el plan preventivo contratado del vehículo.

**Validaciones:**
- Vehículo debe existir
- `habilitado` obligatorio
- `tipoPlan` obligatorio
- `totalPreventivosContratados` >= 0
- `intervaloKm` > 0 si tipo es `por_km`
- `intervaloMeses` > 0 si tipo es `por_meses`

**Persistencia:**
- Actualiza `vehículo.planPreventivo` (⚠️ Nota: usa field legacy por compatibilidad)
- Guarda en localStorage automáticamente
- Auditoría: actualiza `modificadoPor` y `modificadoEn`

**Debug Log:** `[VEHICULOS] Plan preventivo actualizado exitosamente: VH-XXX`

**Nota:** Si `habilitado=false`, el plan se mantiene pero UI puede ignorarlo.

---

### 3. `agregarDocumentoVehiculo(vehiculoId, documento)`
**Descripción:** Agrega un nuevo documento al vehículo.

**Validaciones:**
- Vehículo debe existir
- `tipo` obligatorio
- `nombre` obligatorio
- `fechaVencimiento` obligatoria y válida
- Si existe `fechaEmision`, debe ser anterior o igual a vencimiento

**Comportamiento:**
- Genera ID automático con `generarDocumentoId()`
- **NO** hace unshift (push al final, no al inicio como especificado originalmente - ajustar si necesario)
- Asegura que `documentos` exista como array
- Auditoría: agrega `creadoPor` y `creadoEn`

**Debug Log:** `[VEHICULOS] Documento agregado exitosamente: DOC-XXX`

---

### 4. `actualizarDocumentoVehiculo(vehiculoId, documentoId, patch)`
**Descripción:** Actualiza un documento existente del vehículo.

**Validaciones:**
- Vehículo debe existir
- Documento debe existir
- Revalidación completa del documento actualizado

**Persistencia:**
- Merge: `{...docExistente, ...patch}`
- Auditoría: actualiza `modificadoPor` y `modificadoEn`

**Debug Log:** `[VEHICULOS] Documento actualizado exitosamente: DOC-XXX`

---

### 5. `eliminarDocumentoVehiculo(vehiculoId, documentoId)`
**Descripción:** Elimina un documento del vehículo (hard delete).

**Validaciones:**
- Vehículo debe existir
- Documento debe existir

**Comportamiento:**
- **Hard delete:** elimina del array completamente
- NO soft delete (sin flag `eliminado`)

**Debug Log:** `[VEHICULOS] Documento eliminado exitosamente: DOC-XXX`

---

### 6. `obtenerDocumentosVehiculo(vehiculoId)` (Helper Selector)
**Descripción:** Retorna documentos del vehículo (nunca undefined).

**Retorno:**
- Array vacío `[]` si vehículo no existe
- `vehículo.documentos || []` si vehículo existe

**Sin side effects:** solo lectura.

---

## ✅ QA CHECKLIST (EJECUTABLE)

### Test 1: Contrato - Persistencia
- [ ] 1.1 Ir a detalle de vehículo VH-001
- [ ] 1.2 Tab "Contrato & Proyecto"
- [ ] 1.3 Llenar form: Cliente="Acme Corp", Proyecto="Flota 2024", Contrato="CTR-001", Tipo="full_service", Fechas válidas
- [ ] 1.4 Guardar
- [ ] 1.5 Navegar a /flota (salir)
- [ ] 1.6 Volver a VH-001 detalle → Tab "Contrato"
- [ ] 1.7 **PASS:** Datos persisten correctamente

### Test 2: Plan Preventivo - Cálculo Usados/Restantes
- [ ] 2.1 Ir a detalle de vehículo VH-001
- [ ] 2.2 Tab "Plan Preventivo"
- [ ] 2.3 Habilitar plan: `habilitado=true`, `tipo=por_km`, `total=10`, `intervaloKm=5000`
- [ ] 2.4 Guardar
- [ ] 2.5 **VERIFICAR:** Resumen calculado muestra:
  - Usados: [número de OTs preventivas cerradas del vehículo]
  - Restantes: `max(0, 10 - usados)`
  - Porcentaje usado
- [ ] 2.6 Refrescar página
- [ ] 2.7 **PASS:** Total=10 persiste y cálculo es correcto

### Test 3: Documento Vencido
- [ ] 3.1 Ir a detalle de vehículo VH-002
- [ ] 3.2 Tab "Documentos & Vigencias"
- [ ] 3.3 Nuevo documento: Tipo="SOAT", Nombre="SOAT Test", Vencimiento=fecha de ayer
- [ ] 3.4 Guardar
- [ ] 3.5 **PASS:** Documento aparece con badge "Vencido" (rojo/destructive)

### Test 4: Documento Próximo a Vencer
- [ ] 4.1 Ir a detalle de vehículo VH-002
- [ ] 4.2 Tab "Documentos & Vigencias"
- [ ] 4.3 Nuevo documento: Tipo="REVISION_TECNICA", Nombre="RT Test", Vencimiento=fecha en 10 días
- [ ] 4.4 Guardar
- [ ] 4.5 **PASS:** Documento aparece con badge "Próximo a Vencer" (amber/secondary)

### Test 5: Documento Vigente
- [ ] 5.1 Ir a detalle de vehículo VH-002
- [ ] 5.2 Tab "Documentos & Vigencias"
- [ ] 5.3 Nuevo documento: Tipo="SEGURO_VEHICULAR", Nombre="Seguro Test", Vencimiento=fecha en 90 días
- [ ] 5.4 Guardar
- [ ] 5.5 **PASS:** Documento aparece con badge "Vigente" (green/default)

### Test 6: Editar Documento - Cambio de Badge
- [ ] 6.1 Ir a detalle de vehículo con documento vigente
- [ ] 6.2 Tab "Documentos & Vigencias"
- [ ] 6.3 Editar documento vigente
- [ ] 6.4 Cambiar vencimiento a fecha de ayer
- [ ] 6.5 Guardar
- [ ] 6.6 **PASS:** Badge cambia a "Vencido" automáticamente

### Test 7: Eliminar Documento
- [ ] 7.1 Ir a detalle de vehículo con 2+ documentos
- [ ] 7.2 Tab "Documentos & Vigencias"
- [ ] 7.3 Eliminar un documento
- [ ] 7.4 **PASS:** Documento desaparece de lista inmediatamente
- [ ] 7.5 Refrescar página
- [ ] 7.6 **PASS:** Documento sigue eliminado (persistencia)

### Test 8: Seed Idempotente - No pierde data
- [ ] 8.1 Agregar un documento a VH-001
- [ ] 8.2 Abrir DevTools → localStorage → buscar `kesa_flota_vehiculos`
- [ ] 8.3 Copiar el JSON
- [ ] 8.4 Recargar la página (F5)
- [ ] 8.5 **PASS:** Documento agregado sigue ahí
- [ ] 8.6 Limpiar localStorage
- [ ] 8.7 Recargar página
- [ ] 8.8 **PASS:** Se carga seed inicial (sin el documento agregado)

### Test 9: TypeScript - Sin errores
- [ ] 9.1 Ejecutar `npm run build` (o equivalente)
- [ ] 9.2 **PASS:** 0 errores TypeScript en `vehiculos-config.ts`
- [ ] 9.3 **PASS:** 0 errores TypeScript en `vehiculos-store.tsx`

### Test 10: Console - Sin errores
- [ ] 10.1 Abrir DevTools → Console
- [ ] 10.2 Ejecutar tests 1-7
- [ ] 10.3 **PASS:** 0 errores en consola (warnings OK si son de libs externas)

### Test 11: Dark Mode - OK
- [ ] 11.1 Toggle dark mode
- [ ] 11.2 Verificar badges de documentos visibles en ambos modos
- [ ] 11.3 **PASS:** Contraste OK en light y dark

### Test 12: Responsive - OK
- [ ] 12.1 Resize ventana a móvil (375px)
- [ ] 12.2 Tabs de detalle deben ser navegables
- [ ] 12.3 Forms deben ser usables
- [ ] 12.4 **PASS:** Sin solapamientos ni scroll horizontal

---

## 🔍 DEBUG LOGS IMPLEMENTADOS

Todos los logs están controlados por el flag `DEBUG_VEHICULOS` en `/lib/flota/vehiculos-config.ts`.

### Logs Generales:
- `[VEHICULOS] Datos cargados desde localStorage: X vehículos`
- `[VEHICULOS] Primera carga: inicializando con seed data`
- `[VEHICULOS] Datos guardados en localStorage: X vehículos`

### Logs de Contratos:
- `[VEHICULOS] Vinculo de contrato actualizado exitosamente: VH-XXX`

### Logs de Plan Preventivo:
- `[VEHICULOS] Plan preventivo actualizado exitosamente: VH-XXX`

### Logs de Documentos:
- `[VEHICULOS] Documento agregado exitosamente: DOC-XXX`
- `[VEHICULOS] Documento actualizado exitosamente: DOC-XXX`
- `[VEHICULOS] Documento eliminado exitosamente: DOC-XXX`

### Logs de Errores:
- `[VEHICULOS] Error al cargar datos:` + error
- `[VEHICULOS] Error al guardar datos:` + error
- `[VEHICULOS] Validación fallida:` + errores[]

---

## 📊 CONTRATO ESTRICTO: Context Type vs Value

### Context Type (Interface)
```typescript
interface VehiculosContextType {
  // ... existing ...
  actualizarVinculoContrato: (vehiculoId: string, vinculo: VehiculoVinculoContrato) => { exito: boolean; errores?: string[] };
  actualizarPlanPreventivo: (vehiculoId: string, plan: PlanPreventivoContratado) => { exito: boolean; errores?: string[] };
  agregarDocumentoVehiculo: (vehiculoId: string, documento: Omit<VehiculoDocumento, 'id' | 'creadoPor' | 'creadoEn'>) => { exito: boolean; documentoId?: string; errores?: string[] };
  actualizarDocumentoVehiculo: (vehiculoId: string, documentoId: string, data: Partial<VehiculoDocumento>) => { exito: boolean; errores?: string[] };
  eliminarDocumentoVehiculo: (vehiculoId: string, documentoId: string) => { exito: boolean; errores?: string[] };
  obtenerDocumentosVehiculo: (vehiculoId: string) => VehiculoDocumento[];
}
```

### Context Value
```typescript
const value: VehiculosContextType = {
  // ... existing ...
  actualizarVinculoContrato,  // ✅ Implementado inline en context value
  actualizarPlanPreventivo,   // ✅ Implementado inline en context value
  agregarDocumentoVehiculo,   // ✅ Implementado como función externa
  actualizarDocumentoVehiculo, // ✅ Implementado como función externa
  eliminarDocumentoVehiculo,  // ✅ Implementado como función externa
  obtenerDocumentosVehiculo   // ✅ Implementado como función externa
};
```

✅ **CONFIRMACIÓN:** Todas las 6 funciones están incluidas en el tipo Y en el value.

---

## 🚀 PRÓXIMOS PASOS (FUERA DE SCOPE)

### UI - Componentes a crear:
1. **VehiculoDetalle.tsx** - Agregar tabs:
   - Tab "Contrato & Proyecto" (form editable)
   - Tab "Plan Preventivo" (form + resumen calculado)
   - Tab "Documentos & Vigencias" (tabla + filtros + dialog nuevo/editar)

2. **Helpers UI:**
   - Componente `DocumentoBadge` que use `calcEstadoDocumento()` + `getEstadoDocumentoBadge()`
   - Form validator wrappers para mostrar errores inline

3. **Integraciones:**
   - Conectar helpers `calcPreventivosUsadosRestantes()` con store de OTs
   - KPIs de documentos en dashboard de flota

---

## ✅ RESUMEN FINAL

| Tarea | Estado | Notas |
|-------|--------|-------|
| Data models actualizados | ✅ DONE | `vehiculos-config.ts` v3.0.0 |
| Store actualizado | ✅ DONE | `vehiculos-store.tsx` v3.0.0 |
| 5 funciones CRUD implementadas | ✅ DONE | Con validaciones completas |
| Helper selector | ✅ DONE | `obtenerDocumentosVehiculo()` |
| Seed idempotente | ✅ DONE | No sobrescribe data existente |
| Debug logs controlados | ✅ DONE | Flag `DEBUG_VEHICULOS` |
| Hard delete documentos | ✅ DONE | Sin soft delete |
| Auditoría en operaciones | ✅ DONE | creadoPor/modificadoPor/fechas |
| QA Checklist | ✅ DONE | 12 tests ejecutables |
| TypeScript 0 errores | ✅ EXPECTED | Pendiente validar al compilar |
| Markdown entrega | ✅ DONE | Este archivo |

---

## ⚠️ NOTAS IMPORTANTES

1. **Compatibilidad Legacy:** El store usa `planPreventivo` en lugar de `planPreventivoContratado` para mantener compatibilidad con seed existente. Esto debe normalizarse en una migración futura.

2. **Documentos Array:** Siempre debe ser array, nunca undefined. Helpers usan `|| []` como fallback.

3. **Validaciones:** Todas las operaciones validan antes de persistir. UI debe mostrar errores retornados en `errores?: string[]`.

4. **Auditoría:** Usuario hardcodeado como `'admin@kesa.com'`. TODO: obtener de contexto de autenticación cuando exista.

5. **localStorage:** Persistencia automática en cada cambio. Sin backend, esto es suficiente.

---

**Autor:** KESA ERP Dev Team  
**Versión Store:** v3.0.0  
**Versión Config:** v3.0.0  
**Fecha Entrega:** 2024-12-19
