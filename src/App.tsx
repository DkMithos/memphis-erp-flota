import React, { useState, useEffect } from 'react';

// Auth
import { useAuth } from './auth/AuthProvider';
import { Login } from './components/auth/Login';

// Layout
import { ERPSidebar } from './components/layout/ERPSidebar';
import { ERPTopbar } from './components/layout/ERPTopbar';

// Shared
import { ResponsiveIndicator } from './components/shared/ResponsiveIndicator';
import { TutorialOnboarding } from './components/shared/TutorialOnboarding';
import { ConfirmDialogProvider } from './components/shared/ConfirmDialogProvider';

// Home
import { HomeWelcome } from './components/modules/HomeWelcome';

// Main Modules
import { Dashboard } from './components/modules/Dashboard';
import { Compras } from './components/modules/Compras';
import { Proveedores } from './components/modules/Proveedores';

// Flota
import { FlotaDashboard } from './components/modules/flota/FlotaDashboard';
import { VehiculosLista } from './components/modules/flota/VehiculosLista';
import { VehiculoDetalle } from './components/modules/flota/VehiculoDetalle';
import { VehiculoForm } from './components/modules/flota/VehiculoForm';
import { MantenimientosLista } from './components/modules/flota/MantenimientosLista';
import { MantenimientoDetalle } from './components/modules/flota/MantenimientoDetalle';
import { MantenimientoForm } from './components/modules/flota/MantenimientoForm';
import { FlotaPreventiveAnalytics } from './components/modules/flota/FlotaPreventiveAnalytics';
import { FlotaGPS } from './components/modules/flota/FlotaGPS';
import { FlotaPorProyecto } from './components/modules/flota/FlotaPorProyecto';

// Flota - Reportes
import { FlotaReporteVehiculos } from './components/modules/flota/reportes/FlotaReporteVehiculos';
import { FlotaReporteMantenimientos } from './components/modules/flota/reportes/FlotaReporteMantenimientos';
import { FlotaReporteDocumentos } from './components/modules/flota/reportes/FlotaReporteDocumentos';
import { FlotaReporteCostos } from './components/modules/flota/reportes/FlotaReporteCostos';

// Flota - Hojas de Vida QR
import { VehiclePublicView } from './components/modules/flota/VehiclePublicView';
import { VehiclePublicLifeSheet } from './components/modules/flota/VehiclePublicLifeSheet';
import { VehicleQRPrint } from './components/modules/flota/VehicleQRPrint';

// Biomédico
import { BiomedicoDashboard } from './components/modules/biomedico/BiomedicoDashboard';
import { BiomedicoEquipos } from './components/modules/biomedico/BiomedicoEquipos';
import { BiomedicoEquipoDetalle } from './components/modules/biomedico/BiomedicoEquipoDetalle';
import { BiomedicoEquipoForm } from './components/modules/biomedico/BiomedicoEquipoForm';
import { BiomedicoMantenimientos } from './components/modules/biomedico/BiomedicoMantenimientos';
import { BiomedicoMantenimientoDetalle } from './components/modules/biomedico/BiomedicoMantenimientoDetalle';
import { BiomedicoMantenimientoForm } from './components/modules/biomedico/BiomedicoMantenimientoForm';
import { BiomedicoCalibraciones } from './components/modules/biomedico/BiomedicoCalibraciones';
import { BiomedicoIncidencias } from './components/modules/biomedico/BiomedicoIncidencias';
import { BiomedicoDocumentos } from './components/modules/biomedico/BiomedicoDocumentos';
import { BiomedicoContratos } from './components/modules/biomedico/BiomedicoContratos';
import { BiomedicoContratoForm } from './components/modules/biomedico/BiomedicoContratoForm';

// Compras
import { RequerimientosLista } from './components/modules/compras/RequerimientosLista';
import { RequerimientoDetalle } from './components/modules/compras/RequerimientoDetalle';
import { RequerimientoForm } from './components/modules/compras/RequerimientoForm';
import { CotizacionesLista } from './components/modules/compras/CotizacionesLista';
import { CotizacionDetalle } from './components/modules/compras/CotizacionDetalle';
import { CotizacionForm } from './components/modules/compras/CotizacionForm';
import { OrdenesLista } from './components/modules/compras/OrdenesLista';
import { OrdenDetalle } from './components/modules/compras/OrdenDetalle';
import { OrdenForm } from './components/modules/compras/OrdenForm';
import { RecepcionesLista } from './components/modules/compras/RecepcionesLista';
import { RecepcionDetalle } from './components/modules/compras/RecepcionDetalle';
import { RecepcionForm } from './components/modules/compras/RecepcionForm';

// Proveedores
import { ProveedoresDirectorio } from './components/modules/proveedores/ProveedoresDirectorio';
import { ProveedorDetalle } from './components/modules/proveedores/ProveedorDetalle';
import { ProveedorForm } from './components/modules/proveedores/ProveedorForm';
import { ProveedoresEvaluaciones } from './components/modules/proveedores/ProveedoresEvaluaciones';
import { ProveedoresContratos } from './components/modules/proveedores/ProveedoresContratos';
import { ProveedoresTalleres } from './components/modules/proveedores/ProveedoresTalleres';
import { GestionCategorias } from './components/modules/proveedores/GestionCategorias';

// Proyectos
import { ProyectosDashboard } from './components/modules/proyectos/ProyectosDashboard';
import { ProyectosLista } from './components/modules/proyectos/ProyectosLista';
import { ProyectoDetalle } from './components/modules/proyectos/ProyectoDetalle';
import { Proyecto360 } from './components/modules/proyectos/Proyecto360';
import { ProyectosPanorama } from './components/modules/proyectos/ProyectosPanorama';
import { ProyectosTareasGlobal } from './components/modules/proyectos/ProyectosTareasGlobal';
import { TareaDetalle } from './components/modules/proyectos/TareaDetalle';
import { ProyectosProvider } from './lib/proyectos/proyectos-store';

// Finanzas - módulos adicionales
import { FinanzasFlujoCaja } from './components/modules/finanzas/FinanzasFlujoCaja';
import { FinanzasReportes } from './components/modules/finanzas/FinanzasReportes';

// Proyectos - módulos adicionales
import { ProyectosCronograma } from './components/modules/proyectos/ProyectosCronograma';
import { ProyectosValorizaciones } from './components/modules/proyectos/ProyectosValorizaciones';
import { ProyectosRiesgos } from './components/modules/proyectos/ProyectosRiesgos';
import { ProyectosDocumentos } from './components/modules/proyectos/ProyectosDocumentos';

// Finanzas
import { FinanzasDashboard } from './components/modules/finanzas/FinanzasDashboard';
import { FinanzasTransacciones } from './components/modules/finanzas/FinanzasTransacciones';
import { FinanzasPresupuestosModule } from './components/modules/finanzas/FinanzasPresupuestosModule';
import { FinanzasCajaChica } from './components/modules/finanzas/FinanzasCajaChica';
import { FinanzasProvider } from './lib/finanzas/finanzas-store';

// CRM
import { CRMDashboard } from './components/modules/crm/CRMDashboard';
import { CRMClientes } from './components/modules/crm/CRMClientes';
import { CRMOportunidades } from './components/modules/crm/CRMOportunidades';
import { CRMActividades } from './components/modules/crm/CRMActividades';
import { CRMProvider } from './lib/crm/crm-store';

// Inventario
import { InventarioDashboard } from './components/modules/inventario/InventarioDashboard';
import { InventarioArticulos } from './components/modules/inventario/InventarioArticulos';
import { InventarioMovimientos } from './components/modules/inventario/InventarioMovimientos';
import { InventarioAlmacenes } from './components/modules/inventario/InventarioAlmacenes';

// BI
import { BIDashboard } from './components/modules/bi/BIDashboard';
import { ReporteCruzado } from './components/modules/bi/ReporteCruzado';
import { BIProvider } from './lib/bi/bi-store';

// Contabilidad
import { ContabilidadDashboard } from './components/modules/contabilidad/ContabilidadDashboard';
import { PlanCuentas } from './components/modules/contabilidad/PlanCuentas';
import { PeriodosContables } from './components/modules/contabilidad/PeriodosContables';
import { AsientosLista } from './components/modules/contabilidad/AsientosLista';
import { AsientoForm } from './components/modules/contabilidad/AsientoForm';
import { ComprobantesLista } from './components/modules/contabilidad/ComprobantesLista';
import { ComprobantePagoForm } from './components/modules/contabilidad/ComprobantePagoForm';
import { RegistroCompras } from './components/modules/contabilidad/RegistroCompras';
import { RegistroVentas } from './components/modules/contabilidad/RegistroVentas';
import { PeriodosProvider } from './lib/contabilidad/periodos-store';
import { PlanCuentasProvider } from './lib/contabilidad/plan-cuentas-store';
import { AsientosProvider } from './lib/contabilidad/asientos-store';
import { ComprobantesProvider } from './lib/contabilidad/comprobantes-store';

// Admin
import { GestionUsuarios } from './components/modules/admin/GestionUsuarios';
import { GestionCatalogos } from './components/modules/admin/GestionCatalogos';
import { GestionFlujoAprobacion } from './components/modules/admin/GestionFlujoAprobacion';
import { CentrosCostoAdmin } from './components/modules/admin/CentrosCostoAdmin';
import { CentrosCostoProvider } from './lib/centros-costo/centros-costo-store';

// QR Público — Biomédico
import { EquipoPublicView } from './components/modules/biomedico/EquipoPublicView';
import { EquipoQRPrint } from './components/modules/biomedico/EquipoQRPrint';

// Perfil
import { UserProfile } from './components/modules/perfil/UserProfile';

// Stores
import { OTStoreProvider } from './lib/flota/ot-store';
import { GPSProvider } from './lib/flota/gps-store';
import { VehiculosStoreProvider } from './lib/flota/vehiculos-store';
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
import { Menu } from 'lucide-react';
import { Button } from './components/ui/button';
import { Sheet, SheetContent } from './components/ui/sheet';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingScreen } from './components/ui/LoadingScreen';

const ENABLE_PUBLIC_LEGACY_ROUTES = false;

// ─── Helpers de tema ────────────────────────────────────────────────────────
function getInitialThemeMode(): 'light' | 'dark' | 'system' {
  try {
    const stored = localStorage.getItem('memphis-theme');
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch { /* SSR / modo privado */ }
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
  const { user, profile, tenantName, loading } = useAuth();

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

  // Aplicar tema, persistir en localStorage y escuchar cambios del sistema
  useEffect(() => {
    localStorage.setItem('memphis-theme', themeMode);
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
    if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr')) return true;
    if (ENABLE_PUBLIC_LEGACY_ROUTES && currentRoute.startsWith('/public/vehiculo/')) return true;
    return false;
  };

  // ─── Renderizar componentes de rutas públicas (sin auth, sin providers) ───
  const renderPublicRoute = (): React.ReactNode | null => {
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
            onCancel={() => navigateTo('/biomedico/mantenimientos')}
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
            onCancel={() => navigateTo('/biomedico/equipos')}
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
            onCancel={() => navigateTo(`/biomedico/equipos/${codigo}`)}
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
            onCancel={() => navigateTo('/biomedico/contratos')}
            onSuccess={() => navigateTo('/biomedico/contratos')}
          />
        );
      }
      if (currentRoute.match(/^\/biomedico\/contratos\/CB-\d{4}-\d{3}\/editar$/)) {
        const contratoId = currentRoute.match(/CB-\d{4}-\d{3}/)![0];
        return (
          <BiomedicoContratoForm
            contratoId={contratoId}
            onCancel={() => navigateTo('/biomedico/contratos')}
            onSuccess={() => navigateTo('/biomedico/contratos')}
          />
        );
      }
      if (currentRoute === '/biomedico/contratos') return <BiomedicoContratos onNavigate={navigateTo} />;

      return <BiomedicoDashboard onNavigate={navigateTo} />;
    }

    // Proyectos
    if (currentRoute.startsWith('/proyectos')) {
      // Panorama General (vista ejecutiva de todos los proyectos)
      if (currentRoute === '/proyectos/panorama') {
        return <ProyectosPanorama onNavigate={navigateTo} />;
      }
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
      return <ProyectosDashboard onNavigate={navigateTo} />;
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

      if (currentRoute.match(/^\/compras\/ordenes\/(OC|OS)-\d{4}\/editar$/)) {
        const segments = currentRoute.split('/');
        const ordenId = segments[3];
        return (
          <OrdenForm
            ordenId={ordenId}
            onCancel={() => navigateTo(`/compras/ordenes/${ordenId}`)}
            onSuccess={(id) => navigateTo(`/compras/ordenes/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/compras\/ordenes\/(OC|OS)-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const ordenId = segments[3];
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

      if (currentRoute.match(/^\/compras\/cotizaciones\/COT-\d{4}\/editar$/)) {
        const segments = currentRoute.split('/');
        const cotizacionId = segments[3];
        return (
          <CotizacionForm
            cotizacionId={cotizacionId}
            onCancel={() => navigateTo(`/compras/cotizaciones/${cotizacionId}`)}
            onSuccess={(id) => navigateTo(`/compras/cotizaciones/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/compras\/cotizaciones\/COT-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const cotizacionId = segments[3];
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

      if (currentRoute.match(/^\/compras\/requerimientos\/REQ-\d{4}\/editar$/)) {
        const segments = currentRoute.split('/');
        const requerimientoId = segments[3];
        return (
          <RequerimientoForm
            requerimientoId={requerimientoId}
            onCancel={() => navigateTo(`/compras/requerimientos/${requerimientoId}`)}
            onSuccess={(id) => navigateTo(`/compras/requerimientos/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/compras\/requerimientos\/REQ-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const requerimientoId = segments[3];
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

      if (currentRoute.match(/^\/proveedores\/directorio\/PROV-\d{4}\/editar$/)) {
        const segments = currentRoute.split('/');
        const proveedorId = segments[3];
        return (
          <ProveedorForm
            proveedorId={proveedorId}
            onCancel={() => navigateTo(`/proveedores/directorio/${proveedorId}`)}
            onSuccess={(id) => navigateTo(`/proveedores/directorio/${id}`)}
          />
        );
      }

      if (currentRoute.match(/^\/proveedores\/directorio\/PROV-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const proveedorId = segments[3];
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
              onBack={() => navigateTo('/flota/vehiculos')}
              onNavigate={navigateTo}
              initialTab={action}
            />
          );
        }

        return <VehiculosLista onNavigate={navigateTo} />;
      }

      if (submodulo === 'mantenimientos') {
        if (param === 'nueva') {
          const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
          const tipoParam = urlParams.get('tipo') as 'preventivo' | 'correctivo' | 'predictivo' | null;
          const vehiculoParam = urlParams.get('vehiculo') || undefined;

          return (
            <MantenimientoForm
              tipoInicial={tipoParam || undefined}
              vehiculoIdInicial={vehiculoParam}
              onCancel={() => navigateTo('/flota/mantenimientos')}
              onSuccess={(numeroOT) => navigateTo(`/flota/mantenimientos/${numeroOT}`)}
            />
          );
        }

        if (param && param !== 'nueva') {
          return <MantenimientoDetalle numeroOT={param} onBack={() => navigateTo('/flota/mantenimientos')} />;
        }

        return (
          <MantenimientosLista
            onNavigateToDetalle={(numeroOT) => navigateTo(`/flota/mantenimientos/${numeroOT}`)}
            onNavigateToNueva={(tipo) => navigateTo(`/flota/mantenimientos/nueva?tipo=${tipo}`)}
          />
        );
      }

      if (submodulo === 'reportes' && param === 'vehiculos') return <FlotaReporteVehiculos onNavigate={navigateTo} />;
      if (submodulo === 'reportes' && param === 'mantenimientos') return <FlotaReporteMantenimientos onNavigate={navigateTo} />;
      if (submodulo === 'reportes' && param === 'documentos') return <FlotaReporteDocumentos onNavigate={navigateTo} />;
      if (submodulo === 'reportes' && param === 'costos') return <FlotaReporteCostos onNavigate={navigateTo} />;

      if (submodulo === 'por-proyecto') return <FlotaPorProyecto onNavigate={navigateTo} />;
      if (submodulo === 'analisis-preventivo') return <FlotaPreventiveAnalytics onNavigate={navigateTo} />;
      if (submodulo === 'gps') return <FlotaGPS onNavigate={navigateTo} />;
      if (submodulo === 'dashboard' || !submodulo) return <FlotaDashboard onNavigate={navigateTo} />;

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
      <GPSProvider>
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
                        {/* Desktop Sidebar */}
                        {!isSpecialRoute() && user && (
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
                          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-0 lg:left-64 z-30 print:hidden">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="lg:hidden"
                              onClick={() => setIsMobileSidebarOpen(true)}
                            >
                              <Menu className="size-5" />
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
                            />
                          </header>
                        )}

                        <main className={isSpecialRoute() ? '' : 'lg:ml-64 mt-16 p-4 md:p-6'}>
                          <div className={isSpecialRoute() ? '' : 'max-w-[1600px] mx-auto'}>
                            <ErrorBoundary>
                              {renderModule()}
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
      </GPSProvider>
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