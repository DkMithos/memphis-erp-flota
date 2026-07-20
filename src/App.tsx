import React, { useState, useEffect, lazy, Suspense } from 'react';

// Auth
import { useAuth } from './auth/AuthProvider';
import { Login } from './components/auth/Login';
import { PendingAccess } from './components/auth/PendingAccess';
import { usePermissions } from './lib/rbac/usePermissions';

// Layout
import { ERPSidebar } from './components/layout/ERPSidebar';
import { ERPTopbar } from './components/layout/ERPTopbar';

// Shared
import { ResponsiveIndicator } from './components/shared/ResponsiveIndicator';
import { TutorialOnboarding } from './components/shared/TutorialOnboarding';
import { ConfirmDialogProvider } from './components/shared/ConfirmDialogProvider';
import { getStorageItem, setStorageItem } from './lib/shared/safe-storage';

// Home
import { HomeWelcome } from './components/modules/HomeWelcome';

// Main Modules
import { Dashboard } from './components/modules/Dashboard';
const Compras = lazy(() => import('./components/modules/Compras').then(m => ({ default: m.Compras })));
const Proveedores = lazy(() => import('./components/modules/Proveedores').then(m => ({ default: m.Proveedores })));

// Flota
const FlotaDashboard = lazy(() => import('./components/modules/flota/FlotaDashboard').then(m => ({ default: m.FlotaDashboard })));
const VehiculosLista = lazy(() => import('./components/modules/flota/VehiculosLista').then(m => ({ default: m.VehiculosLista })));
const VehiculoDetalle = lazy(() => import('./components/modules/flota/VehiculoDetalle').then(m => ({ default: m.VehiculoDetalle })));
const VehiculoForm = lazy(() => import('./components/modules/flota/VehiculoForm').then(m => ({ default: m.VehiculoForm })));
// Rediseño Flota 2026-07 (N17): flotas por proyecto, contratos y mantenimientos del plan.
// GPS, análisis preventivo, reportes y OTs salieron del módulo.
const FlotasLista = lazy(() => import('./components/modules/flota/FlotasLista').then(m => ({ default: m.FlotasLista })));
const FlotaDetalleView = lazy(() => import('./components/modules/flota/FlotaDetalleView').then(m => ({ default: m.FlotaDetalleView })));
const FlotaMantenimientos = lazy(() => import('./components/modules/flota/FlotaMantenimientos').then(m => ({ default: m.FlotaMantenimientos })));

// Flota - Hojas de Vida QR
import { VehiclePublicView } from './components/modules/flota/VehiclePublicView';
import { VehiclePublicLifeSheet } from './components/modules/flota/VehiclePublicLifeSheet';
import { VehicleQRPrint } from './components/modules/flota/VehicleQRPrint';

// Biomédico
const BiomedicoDashboard = lazy(() => import('./components/modules/biomedico/BiomedicoDashboard').then(m => ({ default: m.BiomedicoDashboard })));
const BiomedicoEquipos = lazy(() => import('./components/modules/biomedico/BiomedicoEquipos').then(m => ({ default: m.BiomedicoEquipos })));
const BiomedicoEquipoDetalle = lazy(() => import('./components/modules/biomedico/BiomedicoEquipoDetalle').then(m => ({ default: m.BiomedicoEquipoDetalle })));
const BiomedicoEquipoForm = lazy(() => import('./components/modules/biomedico/BiomedicoEquipoForm').then(m => ({ default: m.BiomedicoEquipoForm })));
const BiomedicoMantenimientos = lazy(() => import('./components/modules/biomedico/BiomedicoMantenimientos').then(m => ({ default: m.BiomedicoMantenimientos })));
const BiomedicoMantenimientoDetalle = lazy(() => import('./components/modules/biomedico/BiomedicoMantenimientoDetalle').then(m => ({ default: m.BiomedicoMantenimientoDetalle })));
const BiomedicoMantenimientoForm = lazy(() => import('./components/modules/biomedico/BiomedicoMantenimientoForm').then(m => ({ default: m.BiomedicoMantenimientoForm })));
const BiomedicoCalibraciones = lazy(() => import('./components/modules/biomedico/BiomedicoCalibraciones').then(m => ({ default: m.BiomedicoCalibraciones })));
const BiomedicoIncidencias = lazy(() => import('./components/modules/biomedico/BiomedicoIncidencias').then(m => ({ default: m.BiomedicoIncidencias })));
const BiomedicoDocumentos = lazy(() => import('./components/modules/biomedico/BiomedicoDocumentos').then(m => ({ default: m.BiomedicoDocumentos })));
const BiomedicoContratos = lazy(() => import('./components/modules/biomedico/BiomedicoContratos').then(m => ({ default: m.BiomedicoContratos })));
const BiomedicoContratoForm = lazy(() => import('./components/modules/biomedico/BiomedicoContratoForm').then(m => ({ default: m.BiomedicoContratoForm })));

// Compras
const RequerimientosLista = lazy(() => import('./components/modules/compras/RequerimientosLista').then(m => ({ default: m.RequerimientosLista })));
const RequerimientoDetalle = lazy(() => import('./components/modules/compras/RequerimientoDetalle').then(m => ({ default: m.RequerimientoDetalle })));
const RequerimientoForm = lazy(() => import('./components/modules/compras/RequerimientoForm').then(m => ({ default: m.RequerimientoForm })));
const CotizacionesLista = lazy(() => import('./components/modules/compras/CotizacionesLista').then(m => ({ default: m.CotizacionesLista })));
const CotizacionDetalle = lazy(() => import('./components/modules/compras/CotizacionDetalle').then(m => ({ default: m.CotizacionDetalle })));
const CotizacionForm = lazy(() => import('./components/modules/compras/CotizacionForm').then(m => ({ default: m.CotizacionForm })));
const OrdenesLista = lazy(() => import('./components/modules/compras/OrdenesLista').then(m => ({ default: m.OrdenesLista })));
const OrdenDetalle = lazy(() => import('./components/modules/compras/OrdenDetalle').then(m => ({ default: m.OrdenDetalle })));
const OrdenForm = lazy(() => import('./components/modules/compras/OrdenForm').then(m => ({ default: m.OrdenForm })));
const RecepcionesLista = lazy(() => import('./components/modules/compras/RecepcionesLista').then(m => ({ default: m.RecepcionesLista })));
const FacturasProveedores = lazy(() => import('./components/modules/compras/FacturasProveedores').then(m => ({ default: m.FacturasProveedores })));
const RecepcionDetalle = lazy(() => import('./components/modules/compras/RecepcionDetalle').then(m => ({ default: m.RecepcionDetalle })));
const RecepcionForm = lazy(() => import('./components/modules/compras/RecepcionForm').then(m => ({ default: m.RecepcionForm })));

// Proveedores
const ProveedoresDirectorio = lazy(() => import('./components/modules/proveedores/ProveedoresDirectorio').then(m => ({ default: m.ProveedoresDirectorio })));
const ProveedorDetalle = lazy(() => import('./components/modules/proveedores/ProveedorDetalle').then(m => ({ default: m.ProveedorDetalle })));
const ProveedorForm = lazy(() => import('./components/modules/proveedores/ProveedorForm').then(m => ({ default: m.ProveedorForm })));
const ProveedoresEvaluaciones = lazy(() => import('./components/modules/proveedores/ProveedoresEvaluaciones').then(m => ({ default: m.ProveedoresEvaluaciones })));
const ProveedoresContratos = lazy(() => import('./components/modules/proveedores/ProveedoresContratos').then(m => ({ default: m.ProveedoresContratos })));
const ProveedoresTalleres = lazy(() => import('./components/modules/proveedores/ProveedoresTalleres').then(m => ({ default: m.ProveedoresTalleres })));
const GestionCategorias = lazy(() => import('./components/modules/proveedores/GestionCategorias').then(m => ({ default: m.GestionCategorias })));

// Proyectos
const ProyectosLista = lazy(() => import('./components/modules/proyectos/ProyectosLista').then(m => ({ default: m.ProyectosLista })));
const ProyectoDetalle = lazy(() => import('./components/modules/proyectos/ProyectoDetalle').then(m => ({ default: m.ProyectoDetalle })));
const Proyecto360 = lazy(() => import('./components/modules/proyectos/Proyecto360').then(m => ({ default: m.Proyecto360 })));
const ProyectosPanorama = lazy(() => import('./components/modules/proyectos/ProyectosPanorama').then(m => ({ default: m.ProyectosPanorama })));
const ProyectosExcelSync = lazy(() => import('./components/modules/proyectos/ProyectosExcelSync').then(m => ({ default: m.ProyectosExcelSync })));
const ProyectosTareasGlobal = lazy(() => import('./components/modules/proyectos/ProyectosTareasGlobal').then(m => ({ default: m.ProyectosTareasGlobal })));
const TareaDetalle = lazy(() => import('./components/modules/proyectos/TareaDetalle').then(m => ({ default: m.TareaDetalle })));
import { ProyectosProvider } from './lib/proyectos/proyectos-store';

// Finanzas - módulos adicionales
const FinanzasFlujoCaja = lazy(() => import('./components/modules/finanzas/FinanzasFlujoCaja').then(m => ({ default: m.FinanzasFlujoCaja })));
const FinanzasReportes = lazy(() => import('./components/modules/finanzas/FinanzasReportes').then(m => ({ default: m.FinanzasReportes })));

// Proyectos - módulos adicionales
const ProyectosCronograma = lazy(() => import('./components/modules/proyectos/ProyectosCronograma').then(m => ({ default: m.ProyectosCronograma })));
const ProyectosValorizaciones = lazy(() => import('./components/modules/proyectos/ProyectosValorizaciones').then(m => ({ default: m.ProyectosValorizaciones })));
const ProyectosRiesgos = lazy(() => import('./components/modules/proyectos/ProyectosRiesgos').then(m => ({ default: m.ProyectosRiesgos })));
const ProyectosDocumentos = lazy(() => import('./components/modules/proyectos/ProyectosDocumentos').then(m => ({ default: m.ProyectosDocumentos })));

// Finanzas
const FinanzasDashboard = lazy(() => import('./components/modules/finanzas/FinanzasDashboard').then(m => ({ default: m.FinanzasDashboard })));
const FinanzasTransacciones = lazy(() => import('./components/modules/finanzas/FinanzasTransacciones').then(m => ({ default: m.FinanzasTransacciones })));
const FinanzasPresupuestosModule = lazy(() => import('./components/modules/finanzas/FinanzasPresupuestosModule').then(m => ({ default: m.FinanzasPresupuestosModule })));
const FinanzasCajaChica = lazy(() => import('./components/modules/finanzas/FinanzasCajaChica').then(m => ({ default: m.FinanzasCajaChica })));
import { FinanzasProvider } from './lib/finanzas/finanzas-store';

// CRM
const CRMDashboard = lazy(() => import('./components/modules/crm/CRMDashboard').then(m => ({ default: m.CRMDashboard })));
const CRMClientes = lazy(() => import('./components/modules/crm/CRMClientes').then(m => ({ default: m.CRMClientes })));
const CRMOportunidades = lazy(() => import('./components/modules/crm/CRMOportunidades').then(m => ({ default: m.CRMOportunidades })));
const CRMActividades = lazy(() => import('./components/modules/crm/CRMActividades').then(m => ({ default: m.CRMActividades })));
import { CRMProvider } from './lib/crm/crm-store';

// Inventario (carga diferida)
const InventarioDashboard = lazy(() => import('./components/modules/inventario/InventarioDashboard').then(m => ({ default: m.InventarioDashboard })));
const InventarioArticulos = lazy(() => import('./components/modules/inventario/InventarioArticulos').then(m => ({ default: m.InventarioArticulos })));
const InventarioMovimientos = lazy(() => import('./components/modules/inventario/InventarioMovimientos').then(m => ({ default: m.InventarioMovimientos })));
const InventarioAlmacenes = lazy(() => import('./components/modules/inventario/InventarioAlmacenes').then(m => ({ default: m.InventarioAlmacenes })));

// BI (carga diferida — incluye recharts)
const BIDashboard = lazy(() => import('./components/modules/bi/BIDashboard').then(m => ({ default: m.BIDashboard })));
const ReporteCruzado = lazy(() => import('./components/modules/bi/ReporteCruzado').then(m => ({ default: m.ReporteCruzado })));
import { BIProvider } from './lib/bi/bi-store';

// Contabilidad (carga diferida — módulo pesado, no en ruta crítica)
const ContabilidadDashboard = lazy(() => import('./components/modules/contabilidad/ContabilidadDashboard').then(m => ({ default: m.ContabilidadDashboard })));
const PlanCuentas = lazy(() => import('./components/modules/contabilidad/PlanCuentas').then(m => ({ default: m.PlanCuentas })));
const PeriodosContables = lazy(() => import('./components/modules/contabilidad/PeriodosContables').then(m => ({ default: m.PeriodosContables })));
const AsientosLista = lazy(() => import('./components/modules/contabilidad/AsientosLista').then(m => ({ default: m.AsientosLista })));
const AsientoForm = lazy(() => import('./components/modules/contabilidad/AsientoForm').then(m => ({ default: m.AsientoForm })));
const ComprobantesLista = lazy(() => import('./components/modules/contabilidad/ComprobantesLista').then(m => ({ default: m.ComprobantesLista })));
const ComprobantePagoForm = lazy(() => import('./components/modules/contabilidad/ComprobantePagoForm').then(m => ({ default: m.ComprobantePagoForm })));
const RegistroCompras = lazy(() => import('./components/modules/contabilidad/RegistroCompras').then(m => ({ default: m.RegistroCompras })));
const RegistroVentas = lazy(() => import('./components/modules/contabilidad/RegistroVentas').then(m => ({ default: m.RegistroVentas })));
import { PeriodosProvider } from './lib/contabilidad/periodos-store';
import { PlanCuentasProvider } from './lib/contabilidad/plan-cuentas-store';
import { AsientosProvider } from './lib/contabilidad/asientos-store';
import { ComprobantesProvider } from './lib/contabilidad/comprobantes-store';

// Admin
const GestionUsuarios = lazy(() => import('./components/modules/admin/GestionUsuarios').then(m => ({ default: m.GestionUsuarios })));
const GestionCatalogos = lazy(() => import('./components/modules/admin/GestionCatalogos').then(m => ({ default: m.GestionCatalogos })));
const GestionFlujoAprobacion = lazy(() => import('./components/modules/admin/GestionFlujoAprobacion').then(m => ({ default: m.GestionFlujoAprobacion })));
const CentrosCostoAdmin = lazy(() => import('./components/modules/admin/CentrosCostoAdmin').then(m => ({ default: m.CentrosCostoAdmin })));
import { CentrosCostoProvider } from './lib/centros-costo/centros-costo-store';

// QR Público — Biomédico
import { EquipoPublicView } from './components/modules/biomedico/EquipoPublicView';
import { EquipoQRPrint } from './components/modules/biomedico/EquipoQRPrint';

// Perfil
const UserProfile = lazy(() => import('./components/modules/perfil/UserProfile').then(m => ({ default: m.UserProfile })));

// Portal de proveedores (ruta pública /portal, con su propio login por RUC)
const PortalProveedores = lazy(() => import('./components/portal/PortalProveedores').then(m => ({ default: m.PortalProveedores })));

// Stores
import { OTStoreProvider } from './lib/flota/ot-store';
import { VehiculosStoreProvider } from './lib/flota/vehiculos-store';
import { FlotasStoreProvider } from './lib/flota/flotas-store';
import { ProveedorStoreProvider } from './lib/proveedores/proveedores-store';
import { CatalogosProvider } from './lib/shared/catalogos-store';
import { TipoCambioProvider } from './lib/shared/tipo-cambio-store';
import { RequerimientoStoreProvider } from './lib/compras/requerimientos-store';
import { CotizacionStoreProvider } from './lib/compras/cotizaciones-store';
import { OrdenStoreProvider } from './lib/compras/ordenes-store';
import { RecepcionStoreProvider } from './lib/compras/recepciones-store';
import { EquiposStoreProvider } from './lib/biomedico/equipos-store';
import { SedesStoreProvider } from './lib/biomedico/sedes-store';
import { MantenimientosStoreProvider } from './lib/biomedico/mantenimientos-store';
import { CalibracionesProvider } from './lib/biomedico/calibraciones-store';
import { IncidenciasProvider } from './lib/biomedico/incidencias-store';
import { DocumentosBioProvider } from './lib/biomedico/documentos-bio-store';
import { ContratosBioProvider } from './lib/biomedico/contratos-bio-store';
import { EvaluacionesProvider } from './lib/proveedores/evaluaciones-store';
import { ContratosProvider } from './lib/proveedores/contratos-store';
import { TalleresProvider } from './lib/proveedores/talleres-store';
import { RolesProvider } from './lib/rbac/roles-store';
import { InventarioProvider } from './lib/inventario/inventario-store';

// UI
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './components/ui/button';
import { Sheet, SheetContent, SheetTitle } from './components/ui/sheet';
import { VisuallyHidden } from './components/ui/visually-hidden';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingScreen } from './components/ui/LoadingScreen';

const ENABLE_PUBLIC_LEGACY_ROUTES = false;

// ─── Helpers de tema ────────────────────────────────────────────────────────
function getInitialThemeMode(): 'light' | 'dark' | 'system' {
  const stored = getStorageItem('memphis-theme');
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'system';
}

function applyTheme(mode: 'light' | 'dark' | 'system'): boolean {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  if (isDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  return isDark;
}
// ────────────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, profile, tenantName, loading, signOut } = useAuth();
  const { isAdmin, sinRolConfirmado, loading: permsLoading } = usePermissions();

  const [currentModule, setCurrentModule] = useState(() => {
    const path = window.location.pathname || '/home';
    return path.split('/')[1] || 'home';
  });
  const [currentRoute, setCurrentRoute] = useState(() => {
    return window.location.pathname || '/home';
  });
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(getInitialThemeMode);
  const [darkMode, setDarkMode] = useState<boolean>(() => applyTheme(getInitialThemeMode()));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // Sidebar de escritorio colapsable (preferencia persistente por navegador)
  const [sidebarColapsado, setSidebarColapsado] = useState<boolean>(() => {
    try { return localStorage.getItem('erp-sidebar-colapsado') === '1'; } catch { return false; }
  });
  const toggleSidebar = () => {
    setSidebarColapsado(prev => {
      const next = !prev;
      try { localStorage.setItem('erp-sidebar-colapsado', next ? '1' : '0'); } catch { /* storage bloqueado */ }
      return next;
    });
  };

  // Aplicar tema, persistir en localStorage y escuchar cambios del sistema
  useEffect(() => {
    setStorageItem('memphis-theme', themeMode);
    const isDark = applyTheme(themeMode);
    setDarkMode(isDark);

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        setDarkMode(e.matches);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [themeMode]);

  // Listener del botón atrás/adelante del navegador
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/home';
      setCurrentRoute(path);
      const modulePart = path.split('/')[1] || 'home';
      setCurrentModule(modulePart);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSetTheme = (mode: 'light' | 'dark' | 'system') => setThemeMode(mode);
  const handleToggleDarkMode = () => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');

  const handleModuleChange = (moduleId: string, subRoute?: string) => {
    const route = subRoute ? subRoute : `/${moduleId}`;
    setCurrentModule(moduleId);
    setCurrentRoute(route);
    setIsMobileSidebarOpen(false);
    if (window.location.pathname !== route) {
      window.history.pushState({ route }, '', route);
    }
    window.scrollTo(0, 0);
  };

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    const modulePart = route.split('/')[1];
    if (modulePart) setCurrentModule(modulePart);
    // Sync URL del navegador (deep linking + botón atrás)
    if (window.location.pathname !== route) {
      window.history.pushState({ route }, '', route);
    }
    window.scrollTo(0, 0);
  };

  const publicNavigateTo = (route: string) => {
    const allowed = route.startsWith('/v/') ||
      route.startsWith('/e/') ||
      (route.startsWith('/flota/vehiculos/') && route.includes('/print-qr')) ||
      (route.startsWith('/biomedico/equipos/') && route.includes('/print-qr'));
    if (!allowed) return;
    navigateTo(route);
  };

  const isSpecialRoute = () => {
    return (
      currentRoute.startsWith('/v/') ||
      (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr'))
    );
  };

  const isPublicAllowedWithoutAuth = () => {
    if (currentRoute.startsWith('/v/')) return true;
    if (currentRoute.startsWith('/e/')) return true; // QR público biomédico
    if (currentRoute.startsWith('/portal')) return true; // Portal de proveedores (N20)
    if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr')) return true;
    if (ENABLE_PUBLIC_LEGACY_ROUTES && currentRoute.startsWith('/public/vehiculo/')) return true;
    return false;
  };

  // ─── Renderizar componentes de rutas públicas (sin auth, sin providers) ───
  const renderPublicRoute = (): React.ReactNode | null => {
    // /portal — Portal de proveedores (login propio por RUC; aislado por RLS)
    if (currentRoute.startsWith('/portal')) {
      return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando portal…</div>}>
          <PortalProveedores route={currentRoute} onNavigate={navigateTo} />
        </Suspense>
      );
    }

    // /v/:token
    if (currentRoute.startsWith('/v/')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const token = segments[1];
      if (token) return <VehiclePublicView token={token} onNavigate={publicNavigateTo} />;
      return <div className="p-6 text-sm text-muted-foreground">Token inválido.</div>;
    }

    // /e/:token — QR público equipo biomédico
    if (currentRoute.startsWith('/e/')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const token = segments[1];
      if (token) return <EquipoPublicView token={token} />;
      return <div className="p-6 text-sm text-muted-foreground">Token inválido.</div>;
    }

    // /flota/vehiculos/:id/print-qr
    if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const vehiculoId = segments[2];
      if (vehiculoId) return <VehicleQRPrint vehiculoId={vehiculoId} onNavigate={publicNavigateTo} />;
      return <div className="p-6 text-sm text-muted-foreground">Vehículo inválido.</div>;
    }

    // /public/vehiculo/:id (legacy)
    if (ENABLE_PUBLIC_LEGACY_ROUTES && currentRoute.startsWith('/public/vehiculo/')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const vehiculoId = segments[2];
      if (vehiculoId) return <VehiclePublicLifeSheet vehiculoId={vehiculoId} />;
      return <div className="p-6 text-sm text-muted-foreground">Vehículo inválido.</div>;
    }

    return null;
  };

  // 1) Rutas públicas: renderizar inmediatamente SIN esperar auth ni providers
  if (isPublicAllowedWithoutAuth()) {
    const publicContent = renderPublicRoute();
    if (publicContent) {
      return <div className="min-h-screen bg-background">{publicContent}</div>;
    }
  }

  // 2) Mientras carga la sesión
  if (loading) {
    return <LoadingScreen message="Iniciando sesión..." />;
  }

  // 3) Si NO hay user: Login
  if (!user) {
    return <Login />;
  }

  // 3.b) Cuenta de PROVEEDOR dentro del ERP → siempre al portal (/portal).
  //      Su acceso real lo limita RLS; esto solo evita que vea el shell interno.
  if ((user as any)?.app_metadata?.tipo === 'proveedor') {
    window.location.replace('/portal');
    return <LoadingScreen message="Abriendo portal de proveedores..." />;
  }

  // 4) Gate de acceso: usuario autenticado y la consulta CONFIRMÓ cero roles.
  //    Un timeout o error de red NO manda aquí (sinRolConfirmado queda false) —
  //    antes producía falsos "cuenta pendiente de aprobación".
  if (!permsLoading && !isAdmin && sinRolConfirmado) {
    return (
      <PendingAccess
        email={user.email}
        nombre={profile?.nombre ?? null}
        onSignOut={signOut}
      />
    );
  }

  const renderModule = () => {
    // =========================
    // RUTAS INTERNAS (CON AUTH)
    // =========================
    if (!user) return <Login />;

    // Home de bienvenida — ruta raíz y /home
    if (currentRoute === '/home' || currentRoute === '/' || currentRoute === '') {
      return <HomeWelcome onNavigate={navigateTo} />;
    }

    // Biomédico
    if (currentRoute.startsWith('/biomedico')) {
      if (currentRoute.startsWith('/biomedico/mantenimientos/nuevo')) {
        const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
        const equipoIdParam = urlParams.get('equipo');
        return (
          <BiomedicoMantenimientoForm
            equipoIdInicial={equipoIdParam || undefined}
            onCancel={() => window.history.back()}
            onSuccess={(numero) => navigateTo(`/biomedico/mantenimientos/${numero}`)}
          />
        );
      }

      if (currentRoute.match(/^\/biomedico\/mantenimientos\/MB-\d{4}-\d{3}$/)) {
        const segments = currentRoute.split('/');
        const numero = segments[3];
        return (
          <BiomedicoMantenimientoDetalle
            numeroMantenimiento={numero}
            onBack={() => navigateTo('/biomedico/mantenimientos')}
            onNavigateToEquipo={(codigo) => navigateTo(`/biomedico/equipos/${codigo}`)}
          />
        );
      }

      if (currentRoute === '/biomedico/mantenimientos') {
        return (
          <BiomedicoMantenimientos
            onNavigateToNuevo={() => navigateTo('/biomedico/mantenimientos/nuevo')}
            onNavigateToDetalle={(numero) => navigateTo(`/biomedico/mantenimientos/${numero}`)}
          />
        );
      }

      if (currentRoute === '/biomedico/equipos/nuevo') {
        return (
          <BiomedicoEquipoForm
            modo="crear"
            onCancel={() => window.history.back()}
            onSuccess={(codigo) => navigateTo(`/biomedico/equipos/${codigo}`)}
          />
        );
      }

      // /biomedico/equipos/:codigo/print-qr
      if (currentRoute.match(/^\/biomedico\/equipos\/EB-\d{4}-\d{3}\/print-qr$/)) {
        const segments = currentRoute.split('/');
        const codigo = segments[3];
        return <EquipoQRPrint codigoEquipo={codigo} onNavigate={navigateTo} />;
      }

      if (currentRoute.match(/^\/biomedico\/equipos\/EB-\d{4}-\d{3}\/editar$/)) {
        const segments = currentRoute.split('/');
        const codigo = segments[3];
        return (
          <BiomedicoEquipoForm
            modo="editar"
            codigoEquipo={codigo}
            onCancel={() => window.history.back()}
            onSuccess={(codigo) => navigateTo(`/biomedico/equipos/${codigo}`)}
          />
        );
      }

      if (currentRoute.match(/^\/biomedico\/equipos\/EB-\d{4}-\d{3}$/)) {
        const segments = currentRoute.split('/');
        const codigo = segments[3];
        return (
          <BiomedicoEquipoDetalle
            codigoEquipo={codigo}
            onNavigateToEditar={() => navigateTo(`/biomedico/equipos/${codigo}/editar`)}
            onNavigateToMantenimiento={(numero) => navigateTo(`/biomedico/mantenimientos/${numero}`)}
            onNavigateToNuevoMantenimiento={() => navigateTo(`/biomedico/mantenimientos/nuevo?equipo=${codigo}`)}
            onNavigate={navigateTo}
            onBack={() => navigateTo('/biomedico/equipos')}
          />
        );
      }

      if (currentRoute === '/biomedico/equipos') {
        return (
          <BiomedicoEquipos
            onNavigateToNuevo={() => navigateTo('/biomedico/equipos/nuevo')}
            onNavigateToDetalle={(codigo) => navigateTo(`/biomedico/equipos/${codigo}`)}
          />
        );
      }

      if (currentRoute === '/biomedico/calibraciones') return <BiomedicoCalibraciones onNavigate={navigateTo} />;
      if (currentRoute === '/biomedico/incidencias') return <BiomedicoIncidencias onNavigate={navigateTo} />;
      if (currentRoute === '/biomedico/documentos') return <BiomedicoDocumentos onNavigate={navigateTo} />;

      // Contratos de servicio biomédico
      if (currentRoute === '/biomedico/contratos/nuevo') {
        return (
          <BiomedicoContratoForm
            onCancel={() => window.history.back()}
            onSuccess={() => navigateTo('/biomedico/contratos')}
          />
        );
      }
      if (currentRoute.match(/^\/biomedico\/contratos\/CB-\d{4}-\d{3}\/editar$/)) {
        const contratoId = currentRoute.match(/CB-\d{4}-\d{3}/)![0];
        return (
          <BiomedicoContratoForm
            contratoId={contratoId}
            onCancel={() => window.history.back()}
            onSuccess={() => navigateTo('/biomedico/contratos')}
          />
        );
      }
      if (currentRoute === '/biomedico/contratos') return <BiomedicoContratos onNavigate={navigateTo} />;

      return <BiomedicoDashboard onNavigate={navigateTo} />;
    }

    // Proyectos
    if (currentRoute.startsWith('/proyectos')) {
      // Vista 360° del proyecto: /proyectos/360/:dbId
      if (currentRoute.startsWith('/proyectos/360/')) {
        const segments = currentRoute.split('/');
        const dbId = segments[3];
        if (dbId) {
          return <Proyecto360 proyectoDbId={dbId} onNavigate={navigateTo} />;
        }
      }

      // Detalle de proyecto por dbId: /proyectos/detalle/:dbId
      if (currentRoute.startsWith('/proyectos/detalle/')) {
        const segments = currentRoute.split('/');
        const dbId = segments[3];
        if (dbId) {
          return (
            <ProyectoDetalle
              proyectoDbId={dbId}
              onBack={() => navigateTo('/proyectos/lista')}
            />
          );
        }
      }
      if (currentRoute === '/proyectos/lista') {
        return (
          <ProyectosLista
            onNavigate={navigateTo}
            onVerDetalle={(dbId) => navigateTo(`/proyectos/detalle/${dbId}`)}
          />
        );
      }
      if (currentRoute === '/proyectos/tareas') return <ProyectosTareasGlobal onNavigate={navigateTo} />;
      if (currentRoute.startsWith('/proyectos/tareas/')) {
        const tareaDbId = currentRoute.split('/')[3];
        if (tareaDbId) return <TareaDetalle tareaDbId={tareaDbId} onNavigate={navigateTo} onBack={() => navigateTo('/proyectos/tareas')} />;
      }
      if (currentRoute === '/proyectos/cronograma') return <ProyectosCronograma onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/valorizaciones') return <ProyectosValorizaciones onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/riesgos') return <ProyectosRiesgos onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/documentos') return <ProyectosDocumentos onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/excel-sync') return <ProyectosExcelSync />;
      // Default: Panorama General como dashboard de proyectos
      return <ProyectosPanorama onNavigate={navigateTo} />;
    }

    // Contabilidad
    if (currentRoute.startsWith('/contabilidad')) {
      if (currentRoute === '/contabilidad/plan-cuentas') return <PlanCuentas />;
      if (currentRoute === '/contabilidad/periodos') return <PeriodosContables />;
      if (currentRoute === '/contabilidad/asientos/nuevo') return <AsientoForm onNavigate={navigateTo} />;
      if (currentRoute.startsWith('/contabilidad/asientos/AST-')) {
        const numero = currentRoute.split('/')[3];
        return <AsientosLista onNavigate={navigateTo} detalleNumero={numero} />;
      }
      if (currentRoute === '/contabilidad/asientos') return <AsientosLista onNavigate={navigateTo} />;
      if (currentRoute === '/contabilidad/comprobantes/nuevo') return <ComprobantePagoForm onNavigate={navigateTo} />;
      if (currentRoute === '/contabilidad/comprobantes') return <ComprobantesLista onNavigate={navigateTo} />;
      if (currentRoute === '/contabilidad/registro-compras') return <RegistroCompras onNavigate={navigateTo} />;
      if (currentRoute === '/contabilidad/registro-ventas') return <RegistroVentas onNavigate={navigateTo} />;
      return <ContabilidadDashboard onNavigate={navigateTo} />;
    }

    // Finanzas
    if (currentRoute.startsWith('/finanzas')) {
      if (currentRoute === '/finanzas/transacciones') return <FinanzasTransacciones onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/presupuestos') return <FinanzasPresupuestosModule onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/cuentas-pagar') return <FinanzasTransacciones onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/caja-chica') return <FinanzasCajaChica onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/flujo-caja') return <FinanzasFlujoCaja onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/reportes') return <FinanzasReportes onNavigate={navigateTo} />;
      return <FinanzasDashboard onNavigate={navigateTo} />;
    }

    // Inventario
    if (currentRoute.startsWith('/inventario')) {
      if (currentRoute === '/inventario/articulos') return <InventarioArticulos onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/productos') return <InventarioArticulos onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/movimientos') return <InventarioMovimientos onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/almacenes') return <InventarioAlmacenes onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/ordenes') return <InventarioMovimientos onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/stock-critico') return <InventarioDashboard onNavigate={navigateTo} />;
      return <InventarioDashboard onNavigate={navigateTo} />;
    }

    // Compras
    if (currentRoute.startsWith('/compras')) {
      if (currentRoute === '/compras/facturas') return <FacturasProveedores onNavigate={navigateTo} />;

      if (currentRoute.startsWith('/compras/recepciones/nuevo')) {
        const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
        const ordenIdParam = urlParams.get('orden');
        return (
          <RecepcionForm
            ordenIdParam={ordenIdParam || undefined}
            onCancel={() => navigateTo('/compras/recepciones')}
            onSuccess={(recepcionId) => navigateTo(`/compras/recepciones/${recepcionId}`)}
          />
        );
      }

      if (currentRoute.startsWith('/compras/recepciones/') && !currentRoute.includes('/nuevo')) {
        const segments = currentRoute.split('/');
        const recepcionId = segments[3].split('?')[0];
        if (recepcionId.startsWith('REC-')) {
          return <RecepcionDetalle recepcionId={recepcionId} onNavigate={navigateTo} />;
        }
      }

      if (currentRoute === '/compras/recepciones') return <RecepcionesLista onNavigate={navigateTo} />;

      if (currentRoute.startsWith('/compras/ordenes/nuevo')) {
        const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
        const cotizacionIdParam = urlParams.get('cot');
        const tipoParam = urlParams.get('tipo') as 'oc' | 'os' | null;
        return (
          <OrdenForm
            cotizacionIdParam={cotizacionIdParam || undefined}
            tipoParam={tipoParam || undefined}
            onCancel={() => navigateTo('/compras/ordenes')}
            onSuccess={(ordenId) => navigateTo(`/compras/ordenes/${ordenId}`)}
          />
        );
      }

      // Detalle/editar de orden: id agnóstico al formato (OC/OS-NNNN, MM-NNNNNN, MM-S-NNNNNN, …migradas)
      if (currentRoute.match(/^\/compras\/ordenes\/[^/]+\/editar$/)) {
        const segments = currentRoute.split('/');
        const ordenId = decodeURIComponent(segments[3]);
        return (
          <OrdenForm
            ordenId={ordenId}
            onCancel={() => navigateTo(`/compras/ordenes/${ordenId}`)}
            onSuccess={(id) => navigateTo(`/compras/ordenes/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/compras\/ordenes\/[^/]+$/)) {
        const segments = currentRoute.split('/');
        const ordenId = decodeURIComponent(segments[3].split('?')[0]);
        return <OrdenDetalle ordenId={ordenId} onNavigate={navigateTo} />;
      }

      if (currentRoute === '/compras/ordenes') return <OrdenesLista onNavigate={navigateTo} />;

      if (currentRoute.startsWith('/compras/cotizaciones/nuevo')) {
        const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
        const requerimientoIdParam = urlParams.get('req');
        return (
          <CotizacionForm
            requerimientoIdParam={requerimientoIdParam || undefined}
            onCancel={() => navigateTo('/compras/cotizaciones')}
            onSuccess={(cotizacionId) => navigateTo(`/compras/cotizaciones/${cotizacionId}`)}
          />
        );
      }

      // Detalle/editar agnóstico al formato del número: COT-0001, NC 0191-26, PTE..., o uuid.
      // (Los números migrados de oc-system no siguen el patrón COT-NNNN; un patrón estricto
      // los mandaba al fallback de Compras, que redirige a Requerimientos.)
      if (currentRoute.match(/^\/compras\/cotizaciones\/[^/]+\/editar$/)) {
        const segments = currentRoute.split('/');
        const cotizacionId = decodeURIComponent(segments[3]);
        return (
          <CotizacionForm
            cotizacionId={cotizacionId}
            onCancel={() => navigateTo(`/compras/cotizaciones/${cotizacionId}`)}
            onSuccess={(id) => navigateTo(`/compras/cotizaciones/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/compras\/cotizaciones\/[^/]+$/)) {
        const segments = currentRoute.split('/');
        const cotizacionId = decodeURIComponent(segments[3]);
        return <CotizacionDetalle cotizacionId={cotizacionId} onNavigate={navigateTo} />;
      }

      if (currentRoute === '/compras/cotizaciones') return <CotizacionesLista onNavigate={navigateTo} />;

      if (currentRoute === '/compras/requerimientos/nuevo') {
        return (
          <RequerimientoForm
            onCancel={() => navigateTo('/compras/requerimientos')}
            onSuccess={(requerimientoId) => navigateTo(`/compras/requerimientos/${requerimientoId}`)}
          />
        );
      }

      // Detalle/editar agnóstico al formato del número: REQ-0001 (antiguo) o RQ-00210 (serie del legado)
      if (currentRoute.match(/^\/compras\/requerimientos\/[^/]+\/editar$/)) {
        const segments = currentRoute.split('/');
        const requerimientoId = decodeURIComponent(segments[3]);
        return (
          <RequerimientoForm
            requerimientoId={requerimientoId}
            onCancel={() => navigateTo(`/compras/requerimientos/${requerimientoId}`)}
            onSuccess={(id) => navigateTo(`/compras/requerimientos/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/compras\/requerimientos\/[^/]+$/) && currentRoute !== '/compras/requerimientos/nuevo') {
        const segments = currentRoute.split('/');
        const requerimientoId = decodeURIComponent(segments[3]);
        return <RequerimientoDetalle requerimientoId={requerimientoId} onNavigate={navigateTo} />;
      }

      if (currentRoute === '/compras/requerimientos') return <RequerimientosLista onNavigate={navigateTo} />;
      return <Compras onNavigate={navigateTo} />;
    }

    // Proveedores
    if (currentRoute.startsWith('/proveedores')) {
      if (currentRoute === '/proveedores/directorio/nuevo') {
        return (
          <ProveedorForm
            onCancel={() => navigateTo('/proveedores/directorio')}
            onSuccess={(proveedorId) => navigateTo(`/proveedores/directorio/${proveedorId}`)}
          />
        );
      }

      // Detalle/editar agnóstico al formato del código (PROV-0101, futuros formatos, o uuid)
      if (currentRoute.match(/^\/proveedores\/directorio\/[^/]+\/editar$/)) {
        const segments = currentRoute.split('/');
        const proveedorId = decodeURIComponent(segments[3]);
        return (
          <ProveedorForm
            proveedorId={proveedorId}
            onCancel={() => navigateTo(`/proveedores/directorio/${proveedorId}`)}
            onSuccess={(id) => navigateTo(`/proveedores/directorio/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/proveedores\/directorio\/[^/]+$/) && currentRoute !== '/proveedores/directorio/nuevo') {
        const segments = currentRoute.split('/');
        const proveedorId = decodeURIComponent(segments[3]);
        return <ProveedorDetalle proveedorId={proveedorId} onNavigate={navigateTo} />;
      }

      if (currentRoute === '/proveedores/directorio') return <ProveedoresDirectorio onNavigate={navigateTo} />;
      if (currentRoute === '/proveedores/evaluaciones') return <ProveedoresEvaluaciones onNavigate={navigateTo} />;
      if (currentRoute === '/proveedores/contratos') return <ProveedoresContratos onNavigate={navigateTo} />;
      if (currentRoute === '/proveedores/talleres') return <ProveedoresTalleres onNavigate={navigateTo} />;
      if (currentRoute === '/proveedores/categorias') return <GestionCategorias />;
      return <Proveedores onNavigate={navigateTo} />;
    }

    // CRM
    if (currentRoute.startsWith('/crm')) {
      if (currentRoute === '/crm/clientes') return <CRMClientes onNavigate={navigateTo} />;
      if (currentRoute === '/crm/oportunidades') return <CRMOportunidades onNavigate={navigateTo} />;
      if (currentRoute === '/crm/actividades') return <CRMActividades onNavigate={navigateTo} />;
      return <CRMDashboard onNavigate={navigateTo} />;
    }

    // Flota
    if (currentRoute.startsWith('/flota')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const submodulo = segments[1];
      const param = segments[2];
      const action = segments[3];

      if (submodulo === 'vehiculos') {
        if (param === 'nuevo') {
          return (
            <VehiculoForm
              modo="crear"
              onCancel={() => navigateTo('/flota/vehiculos')}
              onSuccess={(vehiculoId) => navigateTo(`/flota/vehiculos/${vehiculoId}`)}
            />
          );
        }

        if (param && action === 'editar') {
          return (
            <VehiculoForm
              modo="editar"
              vehiculoId={param}
              onCancel={() => navigateTo(`/flota/vehiculos/${param}`)}
              onSuccess={(id) => navigateTo(`/flota/vehiculos/${id}`)}
            />
          );
        }

        if (param && param !== 'nuevo' && (!action || ['documentos', 'contrato', 'plan-preventivo'].includes(action))) {
          return (
            <VehiculoDetalle
              vehiculoId={param}
              onBack={() => window.history.back()}
              onNavigate={navigateTo}
              initialTab={action}
            />
          );
        }

        return <VehiculosLista onNavigate={navigateTo} />;
      }

      // Rediseño 2026-07: flotas por proyecto + mantenimientos del plan
      if (submodulo === 'flotas') {
        if (param) return <FlotaDetalleView codigo={param} onNavigate={navigateTo} />;
        return <FlotasLista onNavigate={navigateTo} />;
      }

      if (submodulo === 'mantenimientos') {
        return <FlotaMantenimientos onNavigate={navigateTo} />;
      }

      // GPS / análisis preventivo / reportes salieron del módulo (N17) → dashboard
      return <FlotaDashboard onNavigate={navigateTo} />;
    }

    // BI
    if (currentRoute.startsWith('/bi')) {
      if (currentRoute === '/bi/cruzado') return <ReporteCruzado />;
      return <BIDashboard onNavigate={navigateTo} />;
    }

    // Perfil de usuario
    if (currentRoute === '/perfil') {
      return <UserProfile />;
    }

    // Admin
    if (currentRoute.startsWith('/admin')) {
      if (currentRoute === '/admin/usuarios') return <GestionUsuarios />;
      if (currentRoute === '/admin/catalogos') return <GestionCatalogos />;
      if (currentRoute === '/admin/flujo-aprobacion') return <GestionFlujoAprobacion />;
      if (currentRoute === '/admin/centros-costo') return <CentrosCostoAdmin />;
      return <GestionUsuarios />;
    }

    return <Dashboard onNavigate={navigateTo} />;
  };

  return (
    <ConfirmDialogProvider>
    <PeriodosProvider>
    <PlanCuentasProvider>
    <AsientosProvider>
    <ComprobantesProvider>
    <BIProvider>
    <ProyectosProvider>
    <CentrosCostoProvider>
    <FinanzasProvider>
    <CRMProvider>
    <TipoCambioProvider>
    <CatalogosProvider>
    <RolesProvider>
    <InventarioProvider>
    <OTStoreProvider>
      <FlotasStoreProvider>
      <VehiculosStoreProvider>
        <ProveedorStoreProvider>
          <EvaluacionesProvider>
          <ContratosProvider>
          <TalleresProvider>
          <RequerimientoStoreProvider>
            <CotizacionStoreProvider>
              <OrdenStoreProvider>
                <RecepcionStoreProvider>
                  <SedesStoreProvider>
                  <EquiposStoreProvider>
                    <MantenimientosStoreProvider>
                      <CalibracionesProvider>
                        <IncidenciasProvider>
                          <DocumentosBioProvider>
                          <ContratosBioProvider>
                      <div className="min-h-screen bg-background">
                        {/* Desktop Sidebar (colapsable) */}
                        {!isSpecialRoute() && user && !sidebarColapsado && (
                          <div className="hidden lg:block print:hidden">
                            <ERPSidebar
                              currentModule={currentModule}
                              onModuleChange={handleModuleChange}
                              currentRoute={currentRoute}
                            />
                          </div>
                        )}

                        {/* Mobile Sidebar */}
                        {!isSpecialRoute() && user && (
                          <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                            <SheetContent side="left" className="p-0 w-64 print:hidden">
                              <VisuallyHidden>
                                <SheetTitle>Menú de navegación</SheetTitle>
                              </VisuallyHidden>
                              <ERPSidebar
                                currentModule={currentModule}
                                onModuleChange={handleModuleChange}
                                currentRoute={currentRoute}
                              />
                            </SheetContent>
                          </Sheet>
                        )}

                        {/* Topbar */}
                        {!isSpecialRoute() && user && (
                          <header className={`h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-0 z-30 print:hidden ${sidebarColapsado ? 'lg:left-0' : 'lg:left-64'}`}>
                            {/* Móvil: abre el drawer */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="lg:hidden"
                              onClick={() => setIsMobileSidebarOpen(true)}
                            >
                              <Menu className="size-5" />
                            </Button>

                            {/* Escritorio: colapsa/expande el sidebar */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hidden lg:inline-flex"
                              onClick={toggleSidebar}
                              title={sidebarColapsado ? 'Mostrar menú' : 'Ocultar menú'}
                              aria-label={sidebarColapsado ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
                            >
                              {sidebarColapsado ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
                            </Button>

                            <div className="flex-1 lg:hidden" />

                            <ERPTopbar
                              darkMode={darkMode}
                              onToggleDarkMode={handleToggleDarkMode}
                              themeMode={themeMode}
                              onSetTheme={handleSetTheme}
                              tenantName={tenantName ?? 'Memphis ERP'}
                              userName={profile?.nombre ?? user?.email ?? 'Usuario'}
                              onNavigate={navigateTo}
                              currentRoute={currentRoute}
                            />
                          </header>
                        )}

                        {/* Sin clase de transición: transition-[margin] del CSS estático congela el valor */}
                        <main className={isSpecialRoute() ? '' : `mt-16 p-4 md:p-6 ${sidebarColapsado ? '' : 'lg:ml-64'}`}>
                          <div className={isSpecialRoute() ? '' : 'max-w-[1600px] mx-auto'}>
                            <ErrorBoundary>
                              <Suspense fallback={<LoadingScreen message="Cargando módulo..." />}>
                                {renderModule()}
                              </Suspense>
                            </ErrorBoundary>
                          </div>
                        </main>

                        {/* Tutorial de onboarding — primer login */}
                        {user && profile && (profile as any).onboarding_completado === false && !onboardingDone && (
                          <TutorialOnboarding onComplete={() => setOnboardingDone(true)} />
                        )}

                        <Toaster />
                        {import.meta.env.DEV && <ResponsiveIndicator />}
                      </div>
                          </ContratosBioProvider>
                          </DocumentosBioProvider>
                        </IncidenciasProvider>
                      </CalibracionesProvider>
                    </MantenimientosStoreProvider>
                  </EquiposStoreProvider>
                  </SedesStoreProvider>
                </RecepcionStoreProvider>
              </OrdenStoreProvider>
            </CotizacionStoreProvider>
          </RequerimientoStoreProvider>
          </TalleresProvider>
          </ContratosProvider>
          </EvaluacionesProvider>
        </ProveedorStoreProvider>
      </VehiculosStoreProvider>
      </FlotasStoreProvider>
    </OTStoreProvider>
    </InventarioProvider>
    </RolesProvider>
    </CatalogosProvider>
    </TipoCambioProvider>
    </CRMProvider>
    </FinanzasProvider>
    </CentrosCostoProvider>
    </ProyectosProvider>
    </BIProvider>
    </ComprobantesProvider>
    </AsientosProvider>
    </PlanCuentasProvider>
    </PeriodosProvider>
    </ConfirmDialogProvider>
  );
}