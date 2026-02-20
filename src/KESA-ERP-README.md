# KESA ERP - Sistema Empresarial Multi-Tenant

## 📋 Descripción General

KESA ERP es un prototipo UI/UX completo de un sistema empresarial multi-tenant, modular y escalable diseñado con estándares de calidad corporativa similares a Microsoft Dynamics 365, SAP Fiori, Oracle Cloud ERP y Monday.com.

## 🎨 Características de Diseño

### Estándares Implementados
- ✅ **ISO/IEC 25010** - Calidad del software
- ✅ **ISO/IEC 9241** - Ergonomía de la interacción humano-sistema
- ✅ **WCAG AA** - Accesibilidad web
- ✅ **Material Design 3** - Principios de diseño moderno
- ✅ **Responsive Design** - Adaptable a desktop, tablet y móvil
- ✅ **Dark Mode** - Modo oscuro completo

### Paleta de Colores
```css
Azul Primario: #0A66C2
Gris Secundario: #F3F4F6
Blanco: #FFFFFF
Negro: #111827
```

### Tipografía
- **Familia**: Inter
- **Tamaño de Contenido**: 14-16px
- **Tamaño de Títulos**: 20-24px
- **Pesos**: 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold)

## 📦 Módulos Implementados

### 1. Dashboard Principal
- KPIs en tiempo real (Órdenes pendientes, stock crítico, proyectos activos)
- Gráficos de tendencias con Recharts
- Panel de actividades recientes
- Estado de proyectos activos
- Ejecución presupuestal

### 2. Gestión de Proveedores
- ✅ Tabla con filtros inteligentes y búsqueda avanzada
- ✅ Información completa: RUC, Razón Social, Estado, Score
- ✅ Modal de creación/edición
- ✅ Vista detallada con tabs (Info general, Documentos, Historial)
- ✅ Sistema de puntuación (scoring)

### 3. Módulo de Compras (Flujo Completo)
- ✅ **Requerimientos de Compra**: Formulario con prioridades
- ✅ **Bandeja de Cotizaciones**: Gestión de solicitudes
- ✅ **Comparador de Cotizaciones**: Análisis de proveedores
- ✅ **Órdenes de Compra**: Generación y aprobación
- ✅ **Flujo de Aprobación**: Timeline visual
- ✅ **Recepción y Conformidad**: Control de entregas

### 4. Gestión de Inventario
- ✅ Kardex visual con gráficos
- ✅ Control de entradas y salidas
- ✅ Ficha detallada de productos
- ✅ Historial de movimientos
- ✅ Alertas de stock crítico
- ✅ Valorización de inventario

### 5. Módulo Financiero
- ✅ Presupuesto por centro de costo
- ✅ Ejecución financiera mensual
- ✅ Control de compromisos, devengados y pagos
- ✅ Gráficos de distribución de gastos
- ✅ Dashboard financiero

### 6. Gestión de Proyectos
- ✅ Vista general de proyectos
- ✅ Cronograma tipo timeline
- ✅ Costos asociados por categoría
- ✅ Documentos del proyecto
- ✅ Indicadores de progreso

### 7. Gestión de Flota
- ✅ Ficha completa del vehículo
- ✅ Mantenimientos preventivos
- ✅ Alertas y notificaciones
- ✅ Sistema QR
- ✅ Historial del vehículo

### 8. Equipos Biomédicos
- ✅ Ficha del equipo biomédico
- ✅ Mantenimiento preventivo/correctivo
- ✅ Certificados de calibración
- ✅ Historial técnico
- ✅ Control de criticidad

### 9. CRM - Gestión de Clientes
- ✅ Pipeline de oportunidades
- ✅ Ficha completa del cliente
- ✅ Historial de interacciones
- ✅ Valor ponderado de ventas
- ✅ Actividades recientes

### 10. Sistema de Autenticación
- ✅ Login con validación
- ✅ Recuperación de contraseña
- ✅ Opción "Recordarme"
- ✅ Integración SSO (Microsoft, Google)
- ✅ Selección de tenant (simulado)

## 🎯 Componentes UI Reutilizables

### Componentes Base
- ✅ Buttons (Primary, Secondary, Outline, Ghost)
- ✅ Inputs (Text, Email, Password, Number, Date)
- ✅ Select avanzados con búsqueda
- ✅ DatePickers con calendario
- ✅ Tablas con paginación y ordenamiento
- ✅ Formularios con validación
- ✅ Badges de estado
- ✅ Breadcrumbs
- ✅ Sidebar con navegación
- ✅ Topbar con búsqueda
- ✅ Modals y Dialogs
- ✅ Tabs
- ✅ Dropdowns
- ✅ Cards
- ✅ Charts (Line, Bar, Pie, Area)
- ✅ Progress bars
- ✅ Tooltips
- ✅ Avatars

### Componentes Avanzados
- ✅ Data Tables con filtros
- ✅ Timeline visual
- ✅ Kardex gráfico
- ✅ Pipeline de ventas
- ✅ Dashboard widgets
- ✅ Notificaciones toast

## 📱 Diseño Responsive

### Breakpoints
```css
xs: < 640px   - Móvil
sm: 640px    - Móvil grande
md: 768px    - Tablet
lg: 1024px   - Desktop
xl: 1280px   - Desktop grande
2xl: 1536px  - Desktop XL
```

### Características Responsive
- ✅ Sidebar colapsable en móvil (Sheet/Drawer)
- ✅ Topbar adaptable
- ✅ Tablas con scroll horizontal en móvil
- ✅ Grids responsivos (1 col móvil, 2-4 cols desktop)
- ✅ Formularios en columna en móvil
- ✅ Navegación optimizada para touch

## 🌓 Dark Mode

El sistema incluye un modo oscuro completo que se activa mediante el botón en el topbar:

**Paleta Dark Mode:**
```css
Background: #0F172A
Card: #1E293B
Border: #334155
Text: #F1F5F9
Primary: #3B82F6
```

## 🚀 Tecnologías Utilizadas

- **React 18** - Framework principal
- **TypeScript** - Tipado estático
- **Tailwind CSS v4** - Sistema de diseño
- **Shadcn/UI** - Componentes base
- **Recharts** - Gráficos y visualizaciones
- **Lucide React** - Iconografía
- **React Hook Form** - Gestión de formularios

## 📊 Estructura del Proyecto

```
/
├── components/
│   ├── layout/
│   │   ├── ERPSidebar.tsx      # Navegación lateral
│   │   └── ERPTopbar.tsx       # Barra superior
│   ├── modules/
│   │   ├── Dashboard.tsx       # Dashboard principal
│   │   ├── Proveedores.tsx     # Gestión de proveedores
│   │   ├── Compras.tsx         # Módulo de compras
│   │   ├── Inventario.tsx      # Control de inventario
│   │   ├── Finanzas.tsx        # Gestión financiera
│   │   ├── Proyectos.tsx       # Gestión de proyectos
│   │   ├── Flota.tsx           # Gestión de flota
│   │   ├── Biomedico.tsx       # Equipos biomédicos
│   │   └── CRM.tsx             # CRM
│   ├── auth/
│   │   └── Login.tsx           # Autenticación
│   ├── shared/
│   │   └── ResponsiveIndicator.tsx
│   └── ui/                     # Componentes base (Shadcn)
├── styles/
│   └── globals.css            # Estilos globales y tokens
└── App.tsx                    # Componente principal
```

## 🎨 Sistema de Diseño

### Espaciado
El sistema utiliza una escala de espaciado consistente basada en 4px:
- 1 = 4px
- 2 = 8px
- 3 = 12px
- 4 = 16px
- 6 = 24px
- 8 = 32px

### Radios de Borde
- sm: 4px
- md: 6px
- lg: 8px (default)
- xl: 12px

### Sombras
Niveles sutiles de elevación para jerarquía visual

## ♿ Accesibilidad (WCAG AA)

- ✅ Contraste de color 4.5:1 mínimo
- ✅ Navegación por teclado completa
- ✅ Labels en todos los inputs
- ✅ Roles ARIA apropiados
- ✅ Focus visible
- ✅ Tamaños de toque ≥ 44x44px
- ✅ Texto alternativo en iconos

## 🔐 Seguridad y Multi-Tenancy

El prototipo incluye:
- Selección de tenant en el topbar
- Indicador visual del tenant activo
- Simulación de roles y permisos
- Separación lógica de datos por tenant

## 📝 Notas de Implementación

### Para Desarrollo
1. El indicador responsive (esquina inferior izquierda) muestra el breakpoint actual
2. Dark mode se almacena en el estado local
3. Todos los datos son simulados (mock data)
4. Los formularios tienen validación básica

### Para Producción
- Remover `ResponsiveIndicator` en producción
- Conectar con APIs reales
- Implementar gestión de estado global (Redux/Zustand)
- Agregar autenticación real (JWT, OAuth)
- Implementar sistema de roles y permisos
- Agregar validación de formularios con Zod
- Implementar lazy loading de módulos
- Agregar tests unitarios y E2E

## 🎯 Mejores Prácticas Implementadas

1. **Componentes Reutilizables**: Todos los componentes son modulares
2. **Tipado Fuerte**: TypeScript en toda la aplicación
3. **Consistencia Visual**: Sistema de diseño unificado
4. **Performance**: Componentes optimizados
5. **Mantenibilidad**: Código limpio y documentado
6. **Escalabilidad**: Arquitectura modular

## 📄 Licencia

Este es un prototipo UI/UX para demostración. Todos los datos son ficticios.

---

**Desarrollado con React + TypeScript + Tailwind CSS**
**Diseño corporativo inspirado en los mejores ERP del mercado**
