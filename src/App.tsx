import React, { useState, useEffect } from 'react';

// Auth
import { useAuth } from './auth/AuthProvider';
import { Login } from './components/auth/Login';

// Layout
import { ERPSidebar } from './components/layout/ERPSidebar';
import { ERPTopbar } from './components/layout/ERPTopbar';

// Shared
import { ResponsiveIndicator } from './components/shared/ResponsiveIndicator';

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

// Flota - Reportes
import { FlotaReporteVehiculos } from './components/modules/flota/reportes/FlotaReporteVehiculos';
import { FlotaReporteMantenimientos } from './components/modules/flota/reportes/FlotaReporteMantenimientos';
import { FlotaReporteDocumentos } from './components/modules/flota/reportes/FlotaReporteDocumentos';

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

// Proyectos
import { ProyectosDashboard } from './components/modules/proyectos/ProyectosDashboard';
import { ProyectosLista } from './components/modules/proyectos/ProyectosLista';
import { ProyectoDetalle } from './components/modules/proyectos/ProyectoDetalle';
import { ProyectosTareasGlobal } from './components/modules/proyectos/ProyectosTareasGlobal';
import { ProyectosProvider } from './lib/proyectos/proyectos-store';

// Placeholders
import {
  ProyectosCronograma,
  ProyectosValorizaciones,
  ProyectosRiesgos,
  ProyectosDocumentos,
  FinanzasFlujoCaja,
  FinanzasReportes,
} from './components/modules/placeholders';

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

// Admin
import { GestionUsuarios } from './components/modules/admin/GestionUsuarios';

// Stores
import { OTStoreProvider } from './lib/flota/ot-store';
import { VehiculosStoreProvider } from './lib/flota/vehiculos-store';
import { ProveedorStoreProvider } from './lib/proveedores/proveedores-store';
import { RequerimientoStoreProvider } from './lib/compras/requerimientos-store';
import { CotizacionStoreProvider } from './lib/compras/cotizaciones-store';
import { OrdenStoreProvider } from './lib/compras/ordenes-store';
import { RecepcionStoreProvider } from './lib/compras/recepciones-store';
import { EquiposStoreProvider } from './lib/biomedico/equipos-store';
import { MantenimientosStoreProvider } from './lib/biomedico/mantenimientos-store';
import { CalibracionesProvider } from './lib/biomedico/calibraciones-store';
import { IncidenciasProvider } from './lib/biomedico/incidencias-store';
import { DocumentosBioProvider } from './lib/biomedico/documentos-bio-store';
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

const ENABLE_PUBLIC_LEGACY_ROUTES = false;

export default function App() {
  const { user, profile, tenantName, loading } = useAuth();

  const [currentModule, setCurrentModule] = useState('dashboard');
  const [currentRoute, setCurrentRoute] = useState('/dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const handleToggleDarkMode = () => setDarkMode(!darkMode);

  const handleModuleChange = (moduleId: string, subRoute?: string) => {
    setCurrentModule(moduleId);
    setCurrentRoute(subRoute ? subRoute : `/${moduleId}`);
    setIsMobileSidebarOpen(false);
  };

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    const modulePart = route.split('/')[1];
    if (modulePart) setCurrentModule(modulePart);
  };

  const isSpecialRoute = () => {
    return (
      currentRoute.startsWith('/v/') ||
      (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr'))
    );
  };

  const isPublicAllowedWithoutAuth = () => {
    if (currentRoute.startsWith('/v/')) return true;
    if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr')) return true;
    if (ENABLE_PUBLIC_LEGACY_ROUTES && currentRoute.startsWith('/public/vehiculo/')) return true;
    return false;
  };

  // 1) Mientras carga la sesión
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  // 2) Si NO hay user y la ruta NO es pública: Login
  if (!user && !isPublicAllowedWithoutAuth()) {
    return <Login />;
  }

  const renderModule = () => {
    // =========================
    // RUTAS PÚBLICAS (SIN AUTH)
    // =========================

    // /v/:token
    if (currentRoute.startsWith('/v/')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const token = segments[1];
      if (token) return <VehiclePublicView token={token} onNavigate={navigateTo} />;
      return <div className="p-6 text-sm text-muted-foreground">Token inválido.</div>;
    }

    // /flota/vehiculos/:id/print-qr
    if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      const vehiculoId = segments[2];
      if (vehiculoId) return <VehicleQRPrint vehiculoId={vehiculoId} onNavigate={navigateTo} />;
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

    // =========================
    // RUTAS INTERNAS (CON AUTH)
    // =========================
    if (!user) return <Login />;

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

      return <BiomedicoDashboard onNavigate={navigateTo} />;
    }

    // Proyectos
    if (currentRoute.startsWith('/proyectos')) {
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
      if (currentRoute === '/proyectos/cronograma') return <ProyectosCronograma onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/valorizaciones') return <ProyectosValorizaciones onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/riesgos') return <ProyectosRiesgos onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/documentos') return <ProyectosDocumentos onNavigate={navigateTo} />;
      return <ProyectosDashboard onNavigate={navigateTo} />;
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
      if (currentRoute === '/inventario/ordenes') return <InventarioAlmacenes onNavigate={navigateTo} />;
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

        if (param && param !== 'nuevo' && !action) {
          return (
            <VehiculoDetalle
              vehiculoId={param}
              onBack={() => navigateTo('/flota/vehiculos')}
              onNavigate={navigateTo}
            />
          );
        }

        return <VehiculosLista onNavigate={navigateTo} />;
      }

      if (submodulo === 'mantenimientos') {
        if (param === 'nueva') {
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

      if (submodulo === 'analisis-preventivo') return <FlotaPreventiveAnalytics onNavigate={navigateTo} />;
      if (submodulo === 'dashboard' || !submodulo) return <FlotaDashboard onNavigate={navigateTo} />;

      return <FlotaDashboard onNavigate={navigateTo} />;
    }

    // Admin
    if (currentRoute.startsWith('/admin')) {
      if (currentRoute === '/admin/usuarios') return <GestionUsuarios />;
      return <GestionUsuarios />;
    }

    return <Dashboard />;
  };

  return (
    <ProyectosProvider>
    <FinanzasProvider>
    <CRMProvider>
    <RolesProvider>
    <InventarioProvider>
    <OTStoreProvider>
      <VehiculosStoreProvider>
        <ProveedorStoreProvider>
          <EvaluacionesProvider>
          <ContratosProvider>
          <TalleresProvider>
          <RequerimientoStoreProvider>
            <CotizacionStoreProvider>
              <OrdenStoreProvider>
                <RecepcionStoreProvider>
                  <EquiposStoreProvider>
                    <MantenimientosStoreProvider>
                      <CalibracionesProvider>
                        <IncidenciasProvider>
                          <DocumentosBioProvider>
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
                          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-0 lg:left-64 z-10 print:hidden">
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
                              tenantName={tenantName ?? 'KESA ERP'}
                              userName={profile?.nombre ?? user?.email ?? 'Usuario'}
                            />
                          </header>
                        )}

                        <main className={isSpecialRoute() ? '' : 'lg:ml-64 mt-16 p-4 md:p-6'}>
                          <div className={isSpecialRoute() ? '' : 'max-w-[1600px] mx-auto'}>
                            {renderModule()}
                          </div>
                        </main>

                        <Toaster />
                        {import.meta.env.DEV && <ResponsiveIndicator />}
                      </div>
                          </DocumentosBioProvider>
                        </IncidenciasProvider>
                      </CalibracionesProvider>
                    </MantenimientosStoreProvider>
                  </EquiposStoreProvider>
                </RecepcionStoreProvider>
              </OrdenStoreProvider>
            </CotizacionStoreProvider>
          </RequerimientoStoreProvider>
          </TalleresProvider>
          </ContratosProvider>
          </EvaluacionesProvider>
        </ProveedorStoreProvider>
      </VehiculosStoreProvider>
    </OTStoreProvider>
    </InventarioProvider>
    </RolesProvider>
    </CRMProvider>
    </FinanzasProvider>
    </ProyectosProvider>
  );
}