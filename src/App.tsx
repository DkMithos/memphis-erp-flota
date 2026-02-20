import React, { useState, useEffect } from 'react';

// Auth
import { Login } from './components/auth/Login';

// Layout
import { ERPSidebar } from './components/layout/ERPSidebar';
import { ERPTopbar } from './components/layout/ERPTopbar';

// Shared
import { ResponsiveIndicator } from './components/shared/ResponsiveIndicator';

// Main Modules
import { Dashboard } from './components/modules/Dashboard';
import { Proyectos } from './components/modules/Proyectos';
import { Finanzas } from './components/modules/Finanzas';
import { Inventario } from './components/modules/Inventario';
import { Compras } from './components/modules/Compras';
import { Proveedores } from './components/modules/Proveedores';
import { CRM } from './components/modules/CRM';

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

// Placeholders
import {
  BiomedicoCalibraciones,
  BiomedicoIncidencias,
  BiomedicoDocumentos,
  ProyectosCronograma,
  ProyectosTareas,
  ProyectosValorizaciones,
  ProyectosRiesgos,
  ProyectosDocumentos,
  FinanzasPresupuestos,
  FinanzasCuentasPagar,
  FinanzasFlujoCaja,
  FinanzasReportes,
  InventarioProductos,
  InventarioMovimientos,
  InventarioOrdenes,
  InventarioStockCritico,
  ProveedoresEvaluaciones,
  ProveedoresContratos,
  ProveedoresTalleres,
  CRMClientes,
  CRMOportunidades,
  CRMActividades,
} from './components/modules/placeholders';

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

// UI
import { Menu } from 'lucide-react';
import { Button } from './components/ui/button';
import { Sheet, SheetContent } from './components/ui/sheet';
import { Toaster } from './components/ui/sonner';

/**
 * FEATURE FLAG: Rutas públicas legacy (deshabilitadas por defecto)
 * Las rutas /public/vehiculo/:id están deprecadas en favor de /v/:token
 * Solo habilitar si se requiere compatibilidad retroactiva
 */
const ENABLE_PUBLIC_LEGACY_ROUTES = false;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [currentRoute, setCurrentRoute] = useState('/dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleModuleChange = (moduleId: string, subRoute?: string) => {
    setCurrentModule(moduleId);
    
    // Si hay subRoute, usarlo; si no, usar el módulo base
    if (subRoute) {
      setCurrentRoute(subRoute);
    } else {
      setCurrentRoute(`/${moduleId}`);
    }
    
    setIsMobileSidebarOpen(false);
  };

  // Función para navegar programáticamente
  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    
    // Extraer módulo de la ruta
    const modulePart = route.split('/')[1];
    if (modulePart) {
      setCurrentModule(modulePart);
    }
  };

  /**
   * Detecta si la ruta actual es una página especial (sin Sidebar/Topbar)
   * - Vistas públicas QR: /v/:token
   * - Print views: /flota/vehiculos/:id/print-qr
   */
  const isSpecialRoute = () => {
    return (
      currentRoute.startsWith('/v/') ||
      (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr'))
    );
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderModule = () => {
    // Routing de Biomédico
    if (currentRoute.startsWith('/biomedico')) {
      // /biomedico/mantenimientos/nuevo?equipo=EB-001
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

      // /biomedico/mantenimientos/:numero - MB-2024-001
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

      // /biomedico/mantenimientos (lista)
      if (currentRoute === '/biomedico/mantenimientos') {
        return (
          <BiomedicoMantenimientos
            onNavigateToNuevo={() => navigateTo('/biomedico/mantenimientos/nuevo')}
            onNavigateToDetalle={(numero) => navigateTo(`/biomedico/mantenimientos/${numero}`)}
          />
        );
      }

      // /biomedico/equipos/nuevo
      if (currentRoute === '/biomedico/equipos/nuevo') {
        return (
          <BiomedicoEquipoForm
            modo="crear"
            onCancel={() => navigateTo('/biomedico/equipos')}
            onSuccess={(codigo) => navigateTo(`/biomedico/equipos/${codigo}`)}
          />
        );
      }

      // /biomedico/equipos/:codigo/editar - EB-2024-001/editar
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

      // /biomedico/equipos/:codigo - EB-2024-001
      if (currentRoute.match(/^\/biomedico\/equipos\/EB-\d{4}-\d{3}$/)) {
        const segments = currentRoute.split('/');
        const codigo = segments[3];
        return (
          <BiomedicoEquipoDetalle
            codigoEquipo={codigo}
            onNavigateToEditar={() => navigateTo(`/biomedico/equipos/${codigo}/editar`)}
            onNavigateToMantenimiento={(numero) => navigateTo(`/biomedico/mantenimientos/${numero}`)}
            onNavigateToNuevoMantenimiento={() => {
              // Obtener el ID del equipo desde el store para pasarlo al formulario de mantenimiento
              // El ID es diferente del código (ej: EB-001 vs EB-2024-001)
              navigateTo(`/biomedico/mantenimientos/nuevo?equipo=${codigo}`);
            }}
            onBack={() => navigateTo('/biomedico/equipos')}
          />
        );
      }

      // /biomedico/equipos (lista)
      if (currentRoute === '/biomedico/equipos') {
        return (
          <BiomedicoEquipos
            onNavigateToNuevo={() => navigateTo('/biomedico/equipos/nuevo')}
            onNavigateToDetalle={(codigo) => navigateTo(`/biomedico/equipos/${codigo}`)}
          />
        );
      }

      // Fallback a los viejos componentes placeholder para otras rutas
      if (currentRoute === '/biomedico/calibraciones') return <BiomedicoCalibraciones onNavigate={navigateTo} />;
      if (currentRoute === '/biomedico/incidencias') return <BiomedicoIncidencias onNavigate={navigateTo} />;
      if (currentRoute === '/biomedico/documentos') return <BiomedicoDocumentos onNavigate={navigateTo} />;
      
      // Dashboard de biomédico
      return <BiomedicoDashboard onNavigate={navigateTo} />;
    }

    // Routing de Proyectos
    if (currentRoute.startsWith('/proyectos')) {
      if (currentRoute === '/proyectos/cronograma') return <ProyectosCronograma onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/tareas') return <ProyectosTareas onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/valorizaciones') return <ProyectosValorizaciones onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/riesgos') return <ProyectosRiesgos onNavigate={navigateTo} />;
      if (currentRoute === '/proyectos/documentos') return <ProyectosDocumentos onNavigate={navigateTo} />;
      return <Proyectos />;
    }

    // Routing de Finanzas
    if (currentRoute.startsWith('/finanzas')) {
      if (currentRoute === '/finanzas/presupuestos') return <FinanzasPresupuestos onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/cuentas-pagar') return <FinanzasCuentasPagar onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/flujo-caja') return <FinanzasFlujoCaja onNavigate={navigateTo} />;
      if (currentRoute === '/finanzas/reportes') return <FinanzasReportes onNavigate={navigateTo} />;
      return <Finanzas />;
    }

    // Routing de Inventario
    if (currentRoute.startsWith('/inventario')) {
      if (currentRoute === '/inventario/productos') return <InventarioProductos onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/movimientos') return <InventarioMovimientos onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/ordenes') return <InventarioOrdenes onNavigate={navigateTo} />;
      if (currentRoute === '/inventario/stock-critico') return <InventarioStockCritico onNavigate={navigateTo} />;
      return <Inventario />;
    }

    // Routing de Compras
    if (currentRoute.startsWith('/compras')) {
      // /compras/recepciones/nuevo?orden=OC-0001
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

      // /compras/recepciones/:id (detalle) - REC-0001
      if (currentRoute.startsWith('/compras/recepciones/') && !currentRoute.includes('/nuevo')) {
        const segments = currentRoute.split('/');
        const recepcionId = segments[3].split('?')[0];
        if (recepcionId.startsWith('REC-')) {
          return <RecepcionDetalle recepcionId={recepcionId} onNavigate={navigateTo} />;
        }
      }

      // /compras/recepciones (lista)
      if (currentRoute === '/compras/recepciones') return <RecepcionesLista onNavigate={navigateTo} />;

      // /compras/ordenes/nuevo?cot=COT-0001&tipo=oc
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

      // /compras/ordenes/:id/editar - OC-0001/editar o OS-0001/editar
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

      // /compras/ordenes/:id (detalle) - OC-0001 o OS-0001
      if (currentRoute.match(/^\/compras\/ordenes\/(OC|OS)-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const ordenId = segments[3];
        return <OrdenDetalle ordenId={ordenId} onNavigate={navigateTo} />;
      }

      // /compras/ordenes (lista)
      if (currentRoute === '/compras/ordenes') return <OrdenesLista onNavigate={navigateTo} />;

      // /compras/cotizaciones/nuevo?req=REQ-0001
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

      // /compras/cotizaciones/:id/editar
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

      // /compras/cotizaciones/:id (detalle)
      if (currentRoute.match(/^\/compras\/cotizaciones\/COT-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const cotizacionId = segments[3];
        return <CotizacionDetalle cotizacionId={cotizacionId} onNavigate={navigateTo} />;
      }

      // /compras/cotizaciones (lista)
      if (currentRoute === '/compras/cotizaciones') return <CotizacionesLista onNavigate={navigateTo} />;

      // /compras/requerimientos/nuevo
      if (currentRoute === '/compras/requerimientos/nuevo') {
        return (
          <RequerimientoForm
            onCancel={() => navigateTo('/compras/requerimientos')}
            onSuccess={(requerimientoId) => navigateTo(`/compras/requerimientos/${requerimientoId}`)}
          />
        );
      }

      // /compras/requerimientos/:id/editar
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

      // /compras/requerimientos/:id (detalle)
      if (currentRoute.match(/^\/compras\/requerimientos\/REQ-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const requerimientoId = segments[3];
        return <RequerimientoDetalle requerimientoId={requerimientoId} onNavigate={navigateTo} />;
      }

      // /compras/requerimientos (lista)
      if (currentRoute === '/compras/requerimientos') return <RequerimientosLista onNavigate={navigateTo} />;
      
      // Dashboard principal (redirige a requerimientos)
      return <Compras onNavigate={navigateTo} />;
    }

    // Routing de Proveedores
    if (currentRoute.startsWith('/proveedores')) {
      // /proveedores/directorio/nuevo
      if (currentRoute === '/proveedores/directorio/nuevo') {
        return (
          <ProveedorForm
            onCancel={() => navigateTo('/proveedores/directorio')}
            onSuccess={(proveedorId) => navigateTo(`/proveedores/directorio/${proveedorId}`)}
          />
        );
      }

      // /proveedores/directorio/:id/editar
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

      // /proveedores/directorio/:id (detalle)
      if (currentRoute.match(/^\/proveedores\/directorio\/PROV-\d{4}$/)) {
        const segments = currentRoute.split('/');
        const proveedorId = segments[3];
        return <ProveedorDetalle proveedorId={proveedorId} onNavigate={navigateTo} />;
      }

      // /proveedores/directorio
      if (currentRoute === '/proveedores/directorio') return <ProveedoresDirectorio onNavigate={navigateTo} />;
      
      // Otros submódulos
      if (currentRoute === '/proveedores/evaluaciones') return <ProveedoresEvaluaciones onNavigate={navigateTo} />;
      if (currentRoute === '/proveedores/contratos') return <ProveedoresContratos onNavigate={navigateTo} />;
      if (currentRoute === '/proveedores/talleres') return <ProveedoresTalleres onNavigate={navigateTo} />;
      
      // Dashboard principal (redirige al directorio)
      return <Proveedores onNavigate={navigateTo} />;
    }

    // Routing de CRM
    if (currentRoute.startsWith('/crm')) {
      if (currentRoute === '/crm/clientes') return <CRMClientes onNavigate={navigateTo} />;
      if (currentRoute === '/crm/oportunidades') return <CRMOportunidades onNavigate={navigateTo} />;
      if (currentRoute === '/crm/actividades') return <CRMActividades onNavigate={navigateTo} />;
      return <CRM />;
    }
    
    // ============================================================================
    // Routing de Vistas Públicas de Vehículos (QR + Hoja de Vida)
    // IMPORTANTE: Estas rutas NO requieren auth y NO muestran sidebar/topbar
    // Deben ir ANTES del routing de Flota para que no sean capturadas por /flota
    // ============================================================================
    
    // /v/:token - Nueva ruta pública con token (NUEVA IMPLEMENTACIÓN)
    if (currentRoute.startsWith('/v/')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      // segments: ['v', 'token-uuid']
      const token = segments[1];
      
      if (token) {
        return <VehiclePublicView token={token} onNavigate={navigateTo} />;
      }
    }
    
    // /flota/vehiculos/:id/print-qr - Ruta interna para impresión de QR
    if (currentRoute.startsWith('/flota/vehiculos/') && currentRoute.includes('/print-qr')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      // segments: ['flota', 'vehiculos', 'VH-001', 'print-qr']
      const vehiculoId = segments[2];
      
      if (vehiculoId) {
        return <VehicleQRPrint vehiculoId={vehiculoId} onNavigate={navigateTo} />;
      }
    }
    
    // /public/vehiculo/:id/print-qr (LEGACY - mantener por compatibilidad)
    if (ENABLE_PUBLIC_LEGACY_ROUTES && currentRoute.startsWith('/public/vehiculo/') && currentRoute.includes('/print-qr')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      // segments: ['public', 'vehiculo', 'VH-001', 'print-qr']
      const vehiculoId = segments[2];
      
      if (vehiculoId) {
        return <VehicleQRPrint vehiculoId={vehiculoId} onNavigate={navigateTo} />;
      }
    }
    
    // /public/vehiculo/:id?mode=public
    if (ENABLE_PUBLIC_LEGACY_ROUTES && currentRoute.startsWith('/public/vehiculo/')) {
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      // segments: ['public', 'vehiculo', 'VH-001']
      const vehiculoId = segments[2];
      
      if (vehiculoId) {
        return <VehiclePublicLifeSheet vehiculoId={vehiculoId} />;
      }
    }
    
    // Routing de Flota con subrutas (orden: más específico → más general)
    if (currentRoute.startsWith('/flota')) {
      // Limpiar query params y separar en segmentos
      const cleanPath = currentRoute.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean); // ['flota', 'vehiculos', 'nuevo']
      
      // segments[0] = 'flota'
      // segments[1] = submódulo ('vehiculos' | 'mantenimientos' | 'dashboard' | undefined)
      // segments[2] = id o acción ('nuevo' | 'VH-001' | 'OT-2024-001' | undefined)
      // segments[3] = acción sobre id ('editar' | undefined)
      
      const submodulo = segments[1];
      const param = segments[2];
      const action = segments[3];
      
      // ============================================================================
      // VEHÍCULOS
      // ============================================================================
      if (submodulo === 'vehiculos') {
        // /flota/vehiculos/nuevo
        if (param === 'nuevo') {
          return (
            <VehiculoForm
              modo="crear"
              onCancel={() => navigateTo('/flota/vehiculos')}
              onSuccess={(vehiculoId) => navigateTo(`/flota/vehiculos/${vehiculoId}`)}
            />
          );
        }
        
        // /flota/vehiculos/:id/editar (ej: /flota/vehiculos/VH-001/editar)
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
        
        // /flota/vehiculos/:id (detalle) (ej: /flota/vehiculos/VH-001)
        if (param && param !== 'nuevo' && !action) {
          return (
            <VehiculoDetalle 
              vehiculoId={param}
              onBack={() => navigateTo('/flota/vehiculos')}
              onNavigate={navigateTo}
            />
          );
        }
        
        // /flota/vehiculos (lista)
        return <VehiculosLista onNavigate={navigateTo} />;
      }
      
      // ============================================================================
      // MANTENIMIENTOS
      // ============================================================================
      if (submodulo === 'mantenimientos') {
        // /flota/mantenimientos/nueva (con o sin query params)
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
        
        // /flota/mantenimientos/:otId (detalle) (ej: /flota/mantenimientos/OT-2024-001)
        if (param && param !== 'nueva') {
          return (
            <MantenimientoDetalle 
              numeroOT={param}
              onBack={() => navigateTo('/flota/mantenimientos')}
            />
          );
        }
        
        // /flota/mantenimientos (lista)
        return (
          <MantenimientosLista 
            onNavigateToDetalle={(numeroOT) => navigateTo(`/flota/mantenimientos/${numeroOT}`)}
            onNavigateToNueva={(tipo) => navigateTo(`/flota/mantenimientos/nueva?tipo=${tipo}`)}
          />
        );
      }
      
      // ============================================================================
      // DASHBOARD
      // ============================================================================
      // /flota/reportes/vehiculos
      if (submodulo === 'reportes' && param === 'vehiculos') {
        return <FlotaReporteVehiculos onNavigate={navigateTo} />;
      }
      
      // /flota/reportes/mantenimientos
      if (submodulo === 'reportes' && param === 'mantenimientos') {
        return <FlotaReporteMantenimientos onNavigate={navigateTo} />;
      }
      
      // /flota/reportes/documentos
      if (submodulo === 'reportes' && param === 'documentos') {
        return <FlotaReporteDocumentos onNavigate={navigateTo} />;
      }
      
      // /flota/analisis-preventivo - Análisis Preventivo Enterprise
      if (submodulo === 'analisis-preventivo') {
        return <FlotaPreventiveAnalytics onNavigate={navigateTo} />;
      }
      
      // /flota/dashboard o /flota o /flota/
      if (submodulo === 'dashboard' || !submodulo) {
        return <FlotaDashboard onNavigate={navigateTo} />;
      }
      
      // Fallback: si llega aquí, algo inesperado → mostrar dashboard
      return <FlotaDashboard onNavigate={navigateTo} />;
    }
    
    // Dashboard principal
    return <Dashboard />;
  };

  return (
    <OTStoreProvider>
      <VehiculosStoreProvider>
        <ProveedorStoreProvider>
          <RequerimientoStoreProvider>
            <CotizacionStoreProvider>
              <OrdenStoreProvider>
                <RecepcionStoreProvider>
                  <EquiposStoreProvider>
                    <MantenimientosStoreProvider>
                      <div className="min-h-screen bg-background">
                        {/* Desktop Sidebar - Oculto en rutas especiales */}
                        {!isSpecialRoute() && (
                          <div className="hidden lg:block print:hidden">
                            <ERPSidebar 
                              currentModule={currentModule} 
                              onModuleChange={handleModuleChange}
                              currentRoute={currentRoute}
                            />
                          </div>
                        )}

                        {/* Mobile Sidebar - Oculto en rutas especiales */}
                        {!isSpecialRoute() && (
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

                        {/* Topbar - Responsive - Oculto en rutas especiales */}
                        {!isSpecialRoute() && (
                          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-0 lg:left-64 z-10 print:hidden">
                            {/* Mobile Menu Button */}
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
                              tenantName="Hospital Regional"
                              userName="Admin Usuario"
                            />
                          </header>
                        )}
                        
                        {/* Main - Sin margen/padding en rutas especiales */}
                        <main className={isSpecialRoute() ? '' : 'lg:ml-64 mt-16 p-4 md:p-6'}>
                          <div className={isSpecialRoute() ? '' : 'max-w-[1600px] mx-auto'}>
                            {renderModule()}
                          </div>
                        </main>

                        <Toaster />
                        
                        {/* Responsive indicator - comment out if not needed */}
                        <ResponsiveIndicator />
                      </div>
                    </MantenimientosStoreProvider>
                  </EquiposStoreProvider>
                </RecepcionStoreProvider>
              </OrdenStoreProvider>
            </CotizacionStoreProvider>
          </RequerimientoStoreProvider>
        </ProveedorStoreProvider>
      </VehiculosStoreProvider>
    </OTStoreProvider>
  );
}