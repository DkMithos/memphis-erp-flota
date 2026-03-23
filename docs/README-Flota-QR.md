# 📱 KESA ERP - Flota QR & Vista Pública

Guía rápida del sistema de trazabilidad por QR para vehículos.

---

## 🎯 ¿Qué hace este sistema?

Permite generar códigos QR únicos para cada vehículo que, al escanearse, muestran su **hoja de vida pública** con:

- ✅ Identificación básica (placa, marca, modelo)
- ✅ Estado operativo actual
- ✅ Mantenimientos preventivos (contratados/usados/restantes)
- ✅ Documentación con estados de vencimiento
- ✅ Historial resumido de mantenimientos (sin costos)

---

## 🔐 Seguridad

- **URLs públicas con tokens UUID:** `/v/00010000-4001-a000-0001-000000000001`
- **NO expone IDs internos:** El QR no muestra códigos como `VH-001`
- **Control de habilitación:** El admin puede deshabilitar la vista pública con un switch
- **Información limitada:** No se exponen costos, auditoría ni datos sensibles

---

## 🚀 Cómo Usar

### Para Administradores (Web)

1. **Ver QR de un vehículo:**
   - Ir a **Flota** → **Vehículos** → Seleccionar vehículo (ej: `VH-001`)
   - Scroll hasta la sección **"Código QR del Vehículo"**

2. **Habilitar/Deshabilitar vista pública:**
   - En la sección de QR, usar el **switch "Vista pública habilitada"**
   - ✅ ON = QR funcional, información visible
   - ❌ OFF = QR bloqueado, mensaje de denegación

3. **Imprimir QR:**
   - Hacer clic en **"Imprimir QR"**
   - Layout optimizado para stickers A4
   - Pegar el sticker en el vehículo

4. **Ver vista pública (preview):**
   - Hacer clic en **"Ver Vista Pública"**
   - Muestra exactamente lo que verá un usuario externo

---

### Para Usuarios Externos (Mobile/Web)

1. **Escanear QR** con la cámara del smartphone
2. **Abrir URL** → Abre automáticamente `/v/:token`
3. **Ver información pública** del vehículo

**Si la vista está deshabilitada:**
- Muestra mensaje: "Vista pública deshabilitada"
- No expone información sensible
- Solo muestra placa y marca/modelo básico

---

## 📂 Archivos Clave

### Componentes Principales
```
/components/modules/flota/
├── VehicleQRSection.tsx        # Sección de QR en detalle de vehículo (con switch)
├── VehicleQRPrint.tsx          # Layout de impresión de QR
├── VehiclePublicView.tsx       # Controlador de ruta /v/:token
└── VehiclePublicLifeSheet.tsx  # Vista pública del vehículo
```

### Helpers y Lógica
```
/lib/flota/
├── vehiculos-store.tsx         # Store con campo publicToken y publicViewEnabled
├── vehicle-public.ts           # Helpers de token y QR URL
└── vehicle-lifecycle.ts        # Helpers de mantenimiento y documentos
```

### Routing
```
/App.tsx                        # Routing custom con ruta /v/:token
```

---

## 🧪 Testing Rápido

### Test 1: QR con Vista Habilitada ✅
1. Ir a `/flota/vehiculos/VH-001`
2. Verificar que el switch esté **ON**
3. Hacer clic en **"Ver Vista Pública"**
4. ✅ Debe mostrar la hoja de vida completa

### Test 2: QR con Vista Deshabilitada ❌
1. Ir a `/flota/vehiculos/VH-001`
2. Cambiar el switch a **OFF**
3. Hacer clic en **"Ver Vista Pública"**
4. ✅ Debe mostrar pantalla de denegación

### Test 3: Token Inválido ⚠️
1. Ir manualmente a `/v/token-invalido-123`
2. ✅ Debe mostrar "Vehículo no encontrado"

### Test 4: Print Layout 🖨️
1. Ir a `/flota/vehiculos/VH-001`
2. Hacer clic en **"Imprimir QR"**
3. ✅ Debe abrir layout de impresión con QR y URL

---

## 📊 Checklist QA Completo

Ver: `/ENTREGA-FINAL-Flota-QR-Cierre.md`

- [x] 10/10 QA Gates pasados
- [x] Routing `/v/:token` funcional
- [x] QR apunta a token (NO ID)
- [x] Control de habilitación implementado
- [x] Vista pública valida `publicViewEnabled`
- [x] Mobile responsive
- [x] Print layout optimizado
- [x] Sin rutas cliente/interno
- [x] Tokens auto-generados en nuevos vehículos
- [x] Backward compatibility mantenida

---

## 📖 Documentación Completa

1. **Entrega 1 - Base Técnica:**  
   `/ENTREGA-Flota-QR-Vista-Publica-Token.md`  
   Implementación de vista pública con token, routing custom y validación defensiva

2. **Entrega 2 - Cierre Final:**  
   `/ENTREGA-FINAL-Flota-QR-Cierre.md`  
   Eliminación de flujo multi-nivel, control de habilitación y checklist completo

---

## 🔧 Solución de Problemas

### QR no muestra información
- ✅ Verificar que `publicViewEnabled` esté en `true`
- ✅ Verificar que el vehículo tenga `publicToken` generado
- ✅ Revisar consola del navegador por errores

### Token no válido
- ✅ Verificar que el token existe en el store
- ✅ Si es un vehículo nuevo, verificar que se auto-generó el token
- ✅ Verificar función `generatePublicToken()` en `vehicle-public.ts`

### Print layout no funciona
- ✅ Verificar ruta `/flota/vehiculos/:id/print-qr`
- ✅ Verificar que `VehicleQRPrint.tsx` recibe `vehiculoId` correcto
- ✅ Usar Vista de Impresión del navegador (Ctrl/Cmd + P)

---

## 🎓 Mejores Prácticas

### Para Admins
1. **Siempre** habilitar vista pública solo para vehículos en operación activa
2. **Deshabilitar** vista pública temporalmente si el vehículo está en mantenimiento mayor
3. **Imprimir** QRs en material resistente para exteriores (stickers laminados)
4. **Actualizar** preventivos y documentos regularmente para mantener info precisa

### Para Desarrollo
1. **Tokens idempotentes:** No cambiar el token de un vehículo existente
2. **Validación defensiva:** Siempre asumir que arrays pueden ser undefined
3. **Props flexibles:** Soportar tanto `vehiculo` como `vehiculoId` en componentes
4. **Routing custom:** Mantener patrón de segmentos sin react-router-dom

---

## 📞 Soporte

**Documentación Técnica:** Ver archivos `/ENTREGA-*.md`  
**Arquitectura:** Ver `/lib/flota/vehicle-public.ts` (comentarios inline)  
**QA:** Ver `/ENTREGA-FINAL-Flota-QR-Cierre.md` (checklist completo)

---

**Versión:** 1.0.0  
**Estado:** ✅ Producción Ready  
**Última Actualización:** 2025-02-18
