import { ModulePlaceholderPage, defaultQuickActions } from '../shared/ModulePlaceholderPage';
import { Card, CardContent } from '../ui/card';
import { 
  Activity, Users, ShoppingCart, Package, DollarSign, FolderKanban,
  FileText, Cog, AlertCircle, ClipboardCheck, TrendingUp, CalendarDays,
  ListChecks, Calculator, CreditCard, Wallet, BarChart3, BoxIcon,
  ArrowRightLeft, PackageSearch, FileBarChart, Receipt, ShoppingBag,
  FileCheck, Star, Handshake, Target, PhoneCall, type LucideIcon
} from 'lucide-react';

interface PlaceholderPageProps {
  onNavigate?: (route: string) => void;
}

export function BiomedicoMantenimientos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Mantenimientos Biomédicos"
      moduleDescription="Órdenes de trabajo y mantenimientos para equipos médicos"
      moduleIcon={Cog}
      breadcrumbs={[
        { label: 'Biomédico', onClick: () => onNavigate?.('/biomedico') },
        { label: 'Mantenimientos' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function BiomedicoCalibraciones({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Calibraciones"
      moduleDescription="Gestión de calibraciones y certificaciones de equipos médicos"
      moduleIcon={ClipboardCheck}
      breadcrumbs={[
        { label: 'Biomédico', onClick: () => onNavigate?.('/biomedico') },
        { label: 'Calibraciones' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function BiomedicoIncidencias({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Incidencias"
      moduleDescription="Reporte y seguimiento de fallas e incidencias técnicas"
      moduleIcon={AlertCircle}
      breadcrumbs={[
        { label: 'Biomédico', onClick: () => onNavigate?.('/biomedico') },
        { label: 'Incidencias' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function BiomedicoDocumentos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Documentos y Certificados"
      moduleDescription="Gestión documental de certificaciones, manuales y protocolos"
      moduleIcon={FileText}
      breadcrumbs={[
        { label: 'Biomédico', onClick: () => onNavigate?.('/biomedico') },
        { label: 'Documentos' }
      ]}
      quickActions={[
        defaultQuickActions.import(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function ProyectosCronograma({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Cronograma Gantt"
      moduleDescription="Planificación temporal y diagrama de Gantt de proyectos"
      moduleIcon={CalendarDays}
      breadcrumbs={[
        { label: 'Proyectos', onClick: () => onNavigate?.('/proyectos') },
        { label: 'Cronograma' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function ProyectosTareas({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Tareas y Entregables"
      moduleDescription="Gestión de tareas, hitos y entregables del proyecto"
      moduleIcon={ListChecks}
      breadcrumbs={[
        { label: 'Proyectos', onClick: () => onNavigate?.('/proyectos') },
        { label: 'Tareas' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function ProyectosValorizaciones({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Valorizaciones"
      moduleDescription="Control de valorizaciones y avance financiero del proyecto"
      moduleIcon={Calculator}
      breadcrumbs={[
        { label: 'Proyectos', onClick: () => onNavigate?.('/proyectos') },
        { label: 'Valorizaciones' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function ProyectosRiesgos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Gestión de Riesgos"
      moduleDescription="Identificación, análisis y mitigación de riesgos del proyecto"
      moduleIcon={AlertCircle}
      breadcrumbs={[
        { label: 'Proyectos', onClick: () => onNavigate?.('/proyectos') },
        { label: 'Riesgos' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function ProyectosDocumentos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Documentos del Proyecto"
      moduleDescription="Repositorio de planos, especificaciones y documentación técnica"
      moduleIcon={FileText}
      breadcrumbs={[
        { label: 'Proyectos', onClick: () => onNavigate?.('/proyectos') },
        { label: 'Documentos' }
      ]}
      quickActions={[
        defaultQuickActions.import(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function FinanzasPresupuestos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Presupuestos"
      moduleDescription="Planificación y control presupuestario por centro de costos"
      moduleIcon={Calculator}
      breadcrumbs={[
        { label: 'Finanzas', onClick: () => onNavigate?.('/finanzas') },
        { label: 'Presupuestos' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function FinanzasCuentasPagar({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Cuentas por Pagar"
      moduleDescription="Control de obligaciones y pagos a proveedores"
      moduleIcon={CreditCard}
      breadcrumbs={[
        { label: 'Finanzas', onClick: () => onNavigate?.('/finanzas') },
        { label: 'Cuentas por Pagar' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function FinanzasFlujoCaja({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Flujo de Caja"
      moduleDescription="Análisis de ingresos, egresos y proyección de liquidez"
      moduleIcon={Wallet}
      breadcrumbs={[
        { label: 'Finanzas', onClick: () => onNavigate?.('/finanzas') },
        { label: 'Flujo de Caja' }
      ]}
      quickActions={[
        defaultQuickActions.export(),
        { label: 'Proyectar', icon: TrendingUp, variant: 'outline' }
      ]}
      status="empty"
    />
  );
}

export function FinanzasReportes({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Reportes Financieros"
      moduleDescription="Estados financieros, análisis de ratios y dashboards ejecutivos"
      moduleIcon={BarChart3}
      breadcrumbs={[
        { label: 'Finanzas', onClick: () => onNavigate?.('/finanzas') },
        { label: 'Reportes' }
      ]}
      quickActions={[
        defaultQuickActions.export(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function InventarioProductos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Productos y Repuestos"
      moduleDescription="Catálogo maestro de productos, repuestos y materiales"
      moduleIcon={BoxIcon}
      breadcrumbs={[
        { label: 'Inventario', onClick: () => onNavigate?.('/inventario') },
        { label: 'Productos' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.import()
      ]}
      status="empty"
    />
  );
}

export function InventarioMovimientos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Kardex y Movimientos"
      moduleDescription="Registro de entradas, salidas y transferencias de inventario"
      moduleIcon={ArrowRightLeft}
      breadcrumbs={[
        { label: 'Inventario', onClick: () => onNavigate?.('/inventario') },
        { label: 'Movimientos' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function InventarioOrdenes({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Órdenes de Salida/Entrada"
      moduleDescription="Gestión de órdenes de salida para consumo y entradas de almacén"
      moduleIcon={Receipt}
      breadcrumbs={[
        { label: 'Inventario', onClick: () => onNavigate?.('/inventario') },
        { label: 'Órdenes' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function InventarioStockCritico({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Stock Crítico"
      moduleDescription="Alerta de productos con stock bajo o agotados"
      moduleIcon={PackageSearch}
      breadcrumbs={[
        { label: 'Inventario', onClick: () => onNavigate?.('/inventario') },
        { label: 'Stock Crítico' }
      ]}
      quickActions={[
        defaultQuickActions.export(),
        { label: 'Generar Requerimiento', icon: ShoppingCart, variant: 'default' }
      ]}
      status="empty"
    />
  );
}

// ============================================================================
// COMPRAS - Solo submódulos (Requerimientos y Cotizaciones ahora tienen componentes reales)
// Órdenes y Recepciones ya tienen componentes reales - placeholders removidos
// ============================================================================

// ============================================================================
// PROVEEDORES - Solo submódulos (Directorio ahora tiene componente real)
// ============================================================================

export function ProveedoresEvaluaciones({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Evaluaciones de Proveedores"
      moduleDescription="Calificación y seguimiento de desempeño de proveedores"
      moduleIcon={Star}
      breadcrumbs={[
        { label: 'Proveedores', onClick: () => onNavigate?.('/proveedores') },
        { label: 'Evaluaciones' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function ProveedoresContratos({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Contratos y Acuerdos"
      moduleDescription="Gestión de contratos marco y acuerdos comerciales"
      moduleIcon={Handshake}
      breadcrumbs={[
        { label: 'Proveedores', onClick: () => onNavigate?.('/proveedores') },
        { label: 'Contratos' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.export()
      ]}
      status="empty"
    />
  );
}

export function ProveedoresTalleres({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Talleres Especializados"
      moduleDescription="Directorio de talleres para flota y equipos biomédicos"
      moduleIcon={Cog}
      breadcrumbs={[
        { label: 'Proveedores', onClick: () => onNavigate?.('/proveedores') },
        { label: 'Talleres' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

// ============================================================================
// CRM
// ============================================================================

export function CRMClientes({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Clientes"
      moduleDescription="Directorio y perfiles de clientes y contactos"
      moduleIcon={Users}
      breadcrumbs={[
        { label: 'CRM', onClick: () => onNavigate?.('/crm') },
        { label: 'Clientes' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.import()
      ]}
      status="empty"
    />
  );
}

export function CRMOportunidades({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Oportunidades de Negocio"
      moduleDescription="Pipeline de ventas y seguimiento de oportunidades"
      moduleIcon={Target}
      breadcrumbs={[
        { label: 'CRM', onClick: () => onNavigate?.('/crm') },
        { label: 'Oportunidades' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}

export function CRMActividades({ onNavigate }: PlaceholderPageProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Actividades y Seguimiento"
      moduleDescription="Registro de llamadas, reuniones y tareas comerciales"
      moduleIcon={PhoneCall}
      breadcrumbs={[
        { label: 'CRM', onClick: () => onNavigate?.('/crm') },
        { label: 'Actividades' }
      ]}
      quickActions={[
        defaultQuickActions.create(),
        defaultQuickActions.filter()
      ]}
      status="empty"
    />
  );
}