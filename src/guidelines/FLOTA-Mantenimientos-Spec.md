# KESA ERP - Mantenimientos (Órdenes de Trabajo)
## Especificación Técnica y Arquitectura UX

### **Documento de Diseño Enterprise**
**Módulo:** Flota  
**Pantalla:** Gestión de Órdenes de Trabajo (OT) - Vista Lista/Historial  
**Versión:** 1.0.0  
**Fecha:** 29/12/2024  
**Autor:** Lead UX Architect

---

## 1. CUMPLIMIENTO DE REQUERIMIENTOS SRS

### ✅ **CU-FLOTA-04 – Registrar mantenimiento correctivo**
- **Implementación:** Dropdown "Nueva Orden de Trabajo" → "Mantenimiento Correctivo"
- **Preparado para:** Formulario modal con campos:
  - Título y descripción del problema
  - Selección de criticidad (baja, media, alta, crítica)
  - Asignación de taller (interno/externo)
  - Estimación de costos
  - Fecha programada
  - Observaciones iniciales

### ✅ **CU-FLOTA-03 – Generar mantenimiento preventivo automático**
- **Implementación:** Dropdown "Nueva Orden de Trabajo" → "Mantenimiento Preventivo"
- **Características:**
  - Generación manual o automática (basada en km o tiempo)
  - Templates predefinidos (ej: "Mantenimiento 10,000 km")
  - Programación recurrente
  - Alertas de vencimiento
- **Sistema Automático:**
  - Detecta cuando se alcanza umbral de kilometraje
  - Crea OT automáticamente con estado "programada"
  - Usuario en auditoría: "sistema.automatico@kesa.com"

### ✅ **RF-FLOTA-091 – Integración con Inventario**
- **Implementación:** Campo `repuestos[]` en data model
- **Estructura de datos:**
  ```typescript
  repuestos: Array<{
    id: string,           // Referencia a inventario
    nombre: string,
    cantidad: number,
    costoUnitario: number,
    costoTotal: number
  }>
  ```
- **Flujo preparado:**
  1. Al crear/editar OT, seleccionar repuestos desde catálogo de Inventario
  2. Verificar disponibilidad en stock
  3. Reservar repuestos cuando OT cambia a "en_ejecucion"
  4. Descontar de inventario cuando OT se cierra
  5. Estado "espera_repuesto" cuando no hay stock disponible

### ✅ **RF-FLOTA-092 – Integración con Proveedores**
- **Implementación:** Campo `taller` en data model
- **Estructura de datos:**
  ```typescript
  taller: {
    id: string,          // Referencia a módulo Proveedores
    nombre: string,
    tipo: 'interno' | 'externo'
  }
  ```
- **Flujo preparado:**
  1. Talleres registrados como proveedores tipo "Servicio"
  2. Evaluación de desempeño por SLA cumplido
  3. Costos de terceros facturados por proveedores
  4. Historial de trabajos por taller

### ✅ **RF-FLOTA-093 – Integración con Finanzas**
- **Implementación:** Campo `costos` con desglose completo
- **Estructura de datos:**
  ```typescript
  costos: {
    manoObra: number,    // Centro de costos: FLOTA-MANO-OBRA
    repuestos: number,   // Centro de costos: FLOTA-REPUESTOS
    terceros: number,    // Centro de costos: FLOTA-SERVICIOS-EXTERNOS
    otros: number,       // Centro de costos: FLOTA-OTROS
    total: number
  }
  ```
- **Flujo preparado:**
  1. Costos estimados vs reales
  2. Generación automática de asientos contables al cerrar OT
  3. Reportes de costos por vehículo, por tipo de mantenimiento
  4. Aprobación gerencial para OTs con costo > umbral ($1,500 en ejemplo)

### ✅ **RNF-FLOTA-030 – Auditoría obligatoria**
- **Implementación:** Campo `auditoria` completo en cada OT
- **Estructura de datos:**
  ```typescript
  auditoria: {
    creadoPor: string,      // Email del usuario
    creadoEn: string,       // ISO timestamp
    modificadoPor: string | null,
    modificadoEn: string | null,
    cerradoPor: string | null,
    cerradoEn: string | null
  }
  ```
- **Trazabilidad:**
  - **Creación:** Usuario + timestamp
  - **Modificación:** Usuario + timestamp (cada cambio de estado)
  - **Cierre:** Usuario + timestamp + notas de cierre
  - **Anulación:** Usuario + timestamp + motivo obligatorio
- **Política estricta:**
  - ❌ NO se permite eliminar OTs
  - ✅ SÍ se permite anular con justificación
  - ✅ Todos los cambios quedan registrados
  - ✅ Footer visible: "Las OTs no se eliminan. Solo se anulan con registro de usuario y motivo."

---

## 2. ESTADOS DE ORDEN DE TRABAJO (ESTANDARIZADOS)

### **Estado 1: Programada** 
- **Color:** Azul outline
- **Icono:** Clock
- **Significado:** OT creada y programada, pendiente de inicio
- **Acciones permitidas:**
  - Editar detalles
  - Cambiar fecha programada
  - Asignar/reasignar taller
  - Iniciar ejecución
  - Anular
- **Siguiente estado:** En ejecución

### **Estado 2: En Ejecución**
- **Color:** Azul primary
- **Icono:** Wrench
- **Significado:** Trabajo en curso, taller ejecutando tareas
- **Acciones permitidas:**
  - Agregar repuestos
  - Registrar avances
  - Pausar (cambiar a espera_repuesto)
  - Cerrar OT
  - Solicitar aprobación (si costo excede umbral)
- **Siguiente estado:** Cerrada, Espera Repuesto, Espera Aprobación

### **Estado 3: Espera de Repuesto**
- **Color:** Amarillo
- **Icono:** Package
- **Significado:** Trabajo pausado, esperando llegada de repuestos
- **Acciones permitidas:**
  - Ver repuestos pendientes
  - Notificar llegada de repuesto
  - Reanudar ejecución
  - Anular si repuesto no llega
- **Siguiente estado:** En ejecución, Anulada
- **SLA:** Se pausa el conteo de SLA

### **Estado 4: Espera de Aprobación**
- **Color:** Naranja
- **Icono:** ShieldAlert
- **Significado:** OT requiere aprobación gerencial por costo elevado
- **Acciones permitidas:**
  - Aprobar (solo rol Gerente)
  - Rechazar (solo rol Gerente)
  - Editar presupuesto
- **Siguiente estado:** En ejecución (si aprueba), Anulada (si rechaza)
- **Regla de negocio:** Costos > $1,500 USD requieren aprobación

### **Estado 5: Cerrada**
- **Color:** Verde outline
- **Icono:** CheckCircle
- **Significado:** Trabajo completado exitosamente
- **Datos obligatorios:**
  - Fecha y hora de cierre
  - Usuario que cerró
  - Notas de cierre
  - Costos reales finales
  - SLA real calculado
- **Acciones permitidas:**
  - Solo lectura
  - Generar reporte
  - Exportar PDF
- **Siguiente estado:** FINAL (inmutable)

### **Estado 6: Anulada/Rechazada**
- **Color:** Gris
- **Icono:** XCircle
- **Significado:** OT cancelada, no ejecutada
- **Datos obligatorios:**
  - Motivo de anulación
  - Usuario que anuló
  - Timestamp
- **Acciones permitidas:**
  - Solo lectura
  - Ver motivo de anulación
- **Siguiente estado:** FINAL (inmutable)
- **Política:** NO se eliminan, quedan en historial

---

## 3. TIPOS DE MANTENIMIENTO

### **Preventivo**
- **Color:** Azul
- **Características:**
  - Programado por calendario o kilometraje
  - Generación automática
  - Incluye checklist estándar
  - SLA menos estricto
- **Ejemplos:**
  - Cambio de aceite cada 10,000 km
  - Revisión de frenos cada 6 meses
  - Mantenimiento mayor a los 50,000 km

### **Correctivo**
- **Color:** Rojo
- **Características:**
  - Generado por falla o incidente
  - Creación manual
  - Puede ser crítico
  - SLA estricto
- **Ejemplos:**
  - Reparación de frenos
  - Cambio de batería
  - Reparación de motor

### **Predictivo**
- **Color:** Morado
- **Características:**
  - Basado en telemetría y sensores
  - Previene fallas antes de ocurrir
  - Requiere integración con IoT
  - Futuro: ML para predecir fallos
- **Ejemplos:**
  - Reemplazo de componente por desgaste detectado
  - Calibración por comportamiento anómalo

---

## 4. NIVELES DE CRITICIDAD

### **Baja**
- **Badge:** Outline gris
- **SLA:** 7 días
- **Requiere aprobación:** No
- **Ejemplos:** Limpieza general, cambio de escobillas

### **Media**
- **Badge:** Secondary amarillo
- **SLA:** 3 días
- **Requiere aprobación:** No (si costo < $1,000)
- **Ejemplos:** Cambio de batería, reparación de luces

### **Alta**
- **Badge:** Amarillo sólido
- **SLA:** 24 horas
- **Requiere aprobación:** Sí (si costo > $1,500)
- **Ejemplos:** Reparación de frenos, cambio de neumáticos

### **Crítica**
- **Badge:** Rojo destructive
- **SLA:** 4 horas
- **Requiere aprobación:** Sí (siempre)
- **Vehículo:** Fuera de servicio inmediato
- **Ejemplos:** Falla de motor, sistema de frenos inoperativo

---

## 5. ARQUITECTURA DE FILTROS Y BÚSQUEDA

### **5.1 Barra de Búsqueda (Text Search)**
- Campo de texto libre con icono de lupa
- Busca en: Número OT, Título, Descripción
- Búsqueda en tiempo real (debounced)
- Destaca resultados con highlight

### **5.2 Filtros Avanzados**
```
┌─────────────────────────────────────────────────────┐
│ [Buscar OT...       ] [Estado▼] [Tipo▼]            │
│                       [Criticidad▼] [Taller▼]      │
│                                                      │
│ [Aplicar Filtros] [Limpiar Filtros]                │
│ Mostrando X de Y OTs                                │
└─────────────────────────────────────────────────────┘
```

**Filtros disponibles:**
1. **Estado:** Programada, En Ejecución, Espera Repuesto, Espera Aprobación, Cerrada, Anulada
2. **Tipo:** Preventivo, Correctivo, Predictivo
3. **Criticidad:** Crítica, Alta, Media, Baja
4. **Taller:** Todos, Interno, Externos específicos
5. **Rango de fechas:** (futuro) Fecha creación, Fecha programada, Fecha cierre

### **5.3 Ordenamiento de Tabla**
- Click en headers para ordenar ASC/DESC
- Campos ordenables:
  - N° OT
  - Fecha programada
  - Fecha creación
  - Criticidad (orden: crítica > alta > media > baja)
  - Costo
  - SLA

### **5.4 Paginación**
- 10, 25, 50, 100 items por página
- Navegación: Primera, Anterior, Siguiente, Última
- Indicador: "Mostrando 1-10 de 50"

---

## 6. TABS DE NAVEGACIÓN

### **Tab 1: Activas**
- **Incluye:** Programada, En Ejecución, Espera Repuesto, Espera Aprobación
- **Propósito:** Vista operativa de trabajos pendientes
- **Columnas especiales:**
  - SLA con countdown si está próximo a vencer
  - Botón "Iniciar" para programadas
  - Botón "Cerrar" para en ejecución

### **Tab 2: Cerradas**
- **Incluye:** Solo estado Cerrada
- **Propósito:** Historial de mantenimientos completados
- **Columnas especiales:**
  - SLA cumplido (verde) o excedido (rojo)
  - Cerrado por (usuario)
  - Fecha de cierre
  - Indicador de éxito (dentro de presupuesto)

### **Tab 3: Anuladas**
- **Incluye:** Solo estado Anulada
- **Propósito:** Auditoría de OTs canceladas
- **Columnas especiales:**
  - Motivo de anulación
  - Anulado por (usuario)
  - Fecha de anulación
- **Política:** No se eliminan del sistema, permanecen para auditoría

### **Tab 4: Todas**
- **Incluye:** Todos los estados
- **Propósito:** Vista completa de historial
- **Columnas:** Todas las columnas disponibles
- **Exportación:** Exportar historial completo

---

## 7. TABLA ENTERPRISE - COLUMNAS DETALLADAS

### **Vista "Activas"**
| Columna | Ancho | Ordenable | Descripción |
|---------|-------|-----------|-------------|
| N° OT | 120px | ✅ | Número único de orden |
| Título | 250px | ✅ | Título + descripción resumida |
| Tipo | 120px | ✅ | Badge: Preventivo/Correctivo/Predictivo |
| Estado | 150px | ✅ | Badge con icono |
| Criticidad | 100px | ✅ | Badge de nivel |
| Taller | 200px | ✅ | Nombre + badge interno/externo |
| Fecha Prog. | 120px | ✅ | Fecha con icono calendario |
| SLA | 120px | ✅ | Estimado o real con indicador |
| Costo | 150px | ✅ | Total + desglose MO/Rep |
| Acciones | 100px | ❌ | Botones Ver/Editar |

### **Vista "Cerradas"**
| Columna | Ancho | Ordenable | Descripción |
|---------|-------|-----------|-------------|
| N° OT | 120px | ✅ | Número único |
| Título | 250px | ✅ | Título + descripción |
| Tipo | 120px | ✅ | Badge tipo |
| Taller | 180px | ✅ | Nombre del taller |
| Fecha Cierre | 120px | ✅ | Fecha real de cierre |
| SLA | 150px | ✅ | Real vs estimado con indicador éxito/fallo |
| Costo | 120px | ✅ | Costo total final |
| Cerrado Por | 150px | ✅ | Usuario con icono |
| Acciones | 80px | ❌ | Solo Ver |

---

## 8. SISTEMA DE BADGES Y ESTADOS VISUALES

### **Paleta de Colores por Estado**
```css
/* Estados */
.estado-programada     { bg: outline, text: blue-600 }
.estado-en-ejecucion   { bg: primary, text: white }
.estado-espera-repuesto { bg: yellow-100, text: yellow-800 }
.estado-espera-aprobacion { bg: orange-100, text: orange-800 }
.estado-cerrada        { bg: outline, text: green-600 }
.estado-anulada        { bg: gray-100, text: gray-600 }

/* Tipos */
.tipo-preventivo       { bg: blue-100, text: blue-800 }
.tipo-correctivo       { bg: red-100, text: red-800 }
.tipo-predictivo       { bg: purple-100, text: purple-800 }

/* Criticidad */
.criticidad-baja       { variant: outline }
.criticidad-media      { variant: secondary }
.criticidad-alta       { bg: yellow-600, text: white }
.criticidad-critica    { variant: destructive }
```

### **Iconografía Estandarizada**
- **Programada:** Clock (reloj)
- **En Ejecución:** Wrench (llave inglesa)
- **Espera Repuesto:** Package (paquete)
- **Espera Aprobación:** ShieldAlert (escudo alerta)
- **Cerrada:** CheckCircle (check circular)
- **Anulada:** XCircle (X circular)

---

## 9. ACCIONES POR ESTADO (RBAC)

### **Matriz de Permisos**
| Acción | Programada | En Ejecución | Espera Rep. | Espera Aprob. | Cerrada | Anulada |
|--------|-----------|-------------|------------|--------------|---------|---------|
| **Ver Detalles** | Todos | Todos | Todos | Todos | Todos | Todos |
| **Editar** | Gestor+ | Mecánico+ | Gestor+ | ❌ | ❌ | ❌ |
| **Iniciar** | Mecánico+ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Agregar Repuestos** | Gestor+ | Mecánico+ | Mecánico+ | ❌ | ❌ | ❌ |
| **Cerrar** | ❌ | Mecánico+ | ❌ | ❌ | ❌ | ❌ |
| **Aprobar/Rechazar** | ❌ | ❌ | ❌ | Gerente | ❌ | ❌ |
| **Anular** | Gestor+ | Gestor+ | Gestor+ | Gerente | ❌ | ❌ |
| **Exportar** | Todos | Todos | Todos | Todos | Todos | Todos |

**Roles:**
- **Mecánico:** Ejecuta OTs, agrega repuestos, cierra trabajos
- **Gestor de Flota:** Crea OTs, programa, asigna talleres, aprueba hasta $1,500
- **Gerente:** Aprueba OTs críticas y de alto costo

---

## 10. INTEGRACIÓN CON OTROS MÓDULOS

### **10.1 Integración con Inventario (RF-FLOTA-091)**
**Flujo completo:**
```
1. [Crear OT] → Buscar repuestos en catálogo de Inventario
2. [Seleccionar repuesto] → Verificar stock disponible
   - Si hay stock: Agregar a OT
   - Si no hay stock: Estado "Espera Repuesto"
3. [Iniciar OT] → Reservar repuestos (estado: reservado)
4. [Ejecutar OT] → Consumir repuestos (descontar de inventario)
5. [Cerrar OT] → Actualizar costos reales de repuestos
```

**Endpoints preparados:**
- `GET /api/inventario/repuestos?search=filtro&categoria=flota`
- `POST /api/inventario/repuestos/{id}/reservar`
- `POST /api/inventario/repuestos/{id}/consumir`

### **10.2 Integración con Proveedores (RF-FLOTA-092)**
**Flujo completo:**
```
1. [Crear OT] → Seleccionar taller (interno o externo)
2. [Si externo] → Buscar en catálogo de Proveedores tipo "Taller"
3. [Asignar OT] → Notificar a proveedor (email/API)
4. [Cerrar OT] → Evaluar SLA cumplido
5. [Generar reporte] → KPI de desempeño por proveedor
```

**Endpoints preparados:**
- `GET /api/proveedores?tipo=taller&activo=true`
- `POST /api/proveedores/{id}/asignar-ot`
- `GET /api/proveedores/{id}/historial-ots`

### **10.3 Integración con Finanzas (RF-FLOTA-093)**
**Flujo completo:**
```
1. [Crear OT] → Estimar costos (MO + Repuestos + Terceros)
2. [Validar presupuesto] → Si > $1,500 → Estado "Espera Aprobación"
3. [Ejecutar OT] → Registrar costos reales
4. [Cerrar OT] → Generar asiento contable automático
   - Cuenta Débito: GASTO-FLOTA-MANTENIMIENTO
   - Cuenta Crédito: CAJA/BANCO o CUENTAS-POR-PAGAR
5. [Exportar] → Reporte de costos para auditoría financiera
```

**Centros de Costo:**
- `FLOTA-MANO-OBRA`: Costos de trabajo interno/externo
- `FLOTA-REPUESTOS`: Costos de piezas y materiales
- `FLOTA-SERVICIOS-EXTERNOS`: Costos de talleres externos
- `FLOTA-OTROS`: Costos diversos

**Endpoints preparados:**
- `POST /api/finanzas/asientos-contables` (al cerrar OT)
- `GET /api/finanzas/reportes/costos-flota?periodo=mes&vehiculo=VH-001`

---

## 11. EXPORTACIÓN DE DATOS

### **Formato Excel (.xlsx)**
**Hojas incluidas:**
1. **Resumen:** KPIs del periodo
2. **OTs Activas:** Todas las OTs pendientes
3. **OTs Cerradas:** Historial completado
4. **Análisis de Costos:** Desglose por categoría
5. **Análisis SLA:** Cumplimiento de tiempos

**Columnas exportadas:**
- Toda la información visible en tabla
- Campos adicionales: Observaciones, Notas de cierre
- Desglose completo de repuestos
- Auditoría completa

### **Formato PDF**
**Secciones:**
1. **Portada:** Logo, título, rango de fechas
2. **KPIs:** Gráficos de estado y costos
3. **Tabla de OTs:** Versión imprimible
4. **Detalle por OT:** (opcional) Ficha completa
5. **Footer:** Usuario, fecha de generación, firma digital

---

## 12. REGLAS DE NEGOCIO CRÍTICAS

### **Regla 1: Inmutabilidad del Historial**
- ❌ NO se puede eliminar una OT una vez creada
- ✅ SÍ se puede anular con justificación y auditoría
- **Motivo:** Trazabilidad total, compliance regulatorio

### **Regla 2: Aprobación por Umbral de Costo**
- **Umbral:** $1,500 USD (configurable por tenant)
- **Si costo estimado > umbral:**
  - Estado automático: "Espera Aprobación"
  - Notificación automática a Gerente
  - Bloqueo de ejecución hasta aprobación
- **Excepción:** OTs críticas pueden iniciarse y luego solicitar aprobación

### **Regla 3: SLA y Priorización**
- **Criticidad Crítica:** SLA 4 horas, prioridad absoluta
- **Criticidad Alta:** SLA 24 horas
- **Criticidad Media:** SLA 3 días
- **Criticidad Baja:** SLA 7 días
- **Excepción:** Estado "Espera Repuesto" pausa el SLA

### **Regla 4: Cambios de Estado Válidos**
```
Programada → En Ejecución, Anulada
En Ejecución → Cerrada, Espera Repuesto, Espera Aprobación, Anulada
Espera Repuesto → En Ejecución, Anulada
Espera Aprobación → En Ejecución (aprobada), Anulada (rechazada)
Cerrada → FINAL (inmutable)
Anulada → FINAL (inmutable)
```

### **Regla 5: Costos Estimados vs Reales**
- **Al crear:** Costos estimados obligatorios
- **Durante ejecución:** Costos pueden ajustarse
- **Al cerrar:** Costos reales obligatorios
- **Si variación > 20%:** Alerta al Gestor de Flota
- **Si variación > 50%:** Requiere justificación escrita

---

## 13. ACCESIBILIDAD (WCAG AA)

### ✅ **Contraste de Color**
- Badges con contraste mínimo 4.5:1
- Estados críticos con doble indicador (color + icono)
- Modo oscuro soportado en todos los badges

### ✅ **Navegación por Teclado**
- Tabs navegables con Arrow keys
- Tabla navegable con Tab
- Filtros accesibles con Tab/Enter
- Acciones rápidas con shortcuts (futuro)

### ✅ **Lectores de Pantalla**
- Labels descriptivos en filtros
- ARIA labels en iconos de acción
- Anuncio de cambios de estado
- Descripción de badges (ej: "Estado: En ejecución, criticidad alta")

### ✅ **Responsive Design**
- Mobile: Cards en lugar de tabla
- Tablet: Tabla con scroll horizontal
- Desktop: Tabla completa visible

---

## 14. PERFORMANCE Y ESCALABILIDAD

### **Optimizaciones Implementadas**
1. **Lazy loading de tabs:** Solo cargan al hacer click
2. **Paginación:** Máximo 100 items por página
3. **Virtualización:** (Futuro) Para listas > 500 items
4. **Debouncing:** Búsqueda con delay de 300ms
5. **Caching:** Filtros y estado guardados en sessionStorage

### **Escalabilidad**
- Arquitectura preparada para 10,000+ OTs por vehículo
- Índices de base de datos: `vehiculoId`, `estado`, `fechaCreacion`
- API RESTful con paginación y filtros server-side

---

## 15. PRÓXIMOS PASOS DE DESARROLLO

### **Fase 1: Funcionalidades Core (Sprint actual)**
- [x] Vista lista de OTs con filtros
- [x] Data model completo
- [x] Sistema de badges y estados
- [ ] Modal de creación de OT
- [ ] Modal de detalle de OT
- [ ] Cambios de estado con validación

### **Fase 2: Integraciones (Siguiente sprint)**
- [ ] Integración con Inventario (repuestos)
- [ ] Integración con Proveedores (talleres)
- [ ] Integración con Finanzas (asientos contables)
- [ ] Notificaciones por email/push

### **Fase 3: Funcionalidades Avanzadas**
- [ ] Generación automática de preventivos
- [ ] Templates de OT
- [ ] Checklists de inspección
- [ ] Firma digital de cierre
- [ ] Fotos de evidencia (antes/después)
- [ ] Integración con GPS/Telemetría

### **Fase 4: Analítica y Reportes**
- [ ] Dashboard de KPIs de mantenimiento
- [ ] Análisis predictivo de fallas
- [ ] Benchmarking entre vehículos
- [ ] Exportación avanzada con gráficos

---

**Fin de la especificación técnica**  
**Diseño listo para implementación en producción** ✅
