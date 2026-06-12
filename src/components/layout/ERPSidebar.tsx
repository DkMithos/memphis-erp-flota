import { 
  Home, 
  Users, 
  ShoppingCart, 
  Package, 
  DollarSign, 
  FolderKanban,
  Truck,
  Activity,
  UserCircle,
  Settings,
  ChevronDown,
  Building2,
  LayoutDashboard,
  Car,
  Wrench,
  FileText,
  Cog,
  AlertCircle,
  ClipboardCheck,
  TrendingUp,
  CalendarDays,
  ListChecks,
  Calculator,
  CreditCard,
  Wallet,
  BarChart3,
  BoxIcon,
  ArrowRightLeft,
  PackageSearch,
  FileBarChart,
  Receipt,
  ShoppingBag,
  FileCheck,
  Star,
  Handshake,
  Target,
  PhoneCall,
  MapPin,
  BookOpen,
  FolderOpen,
  Shield,
  GitBranch,
  Clock,
  AlertTriangle,
  Gauge,
  Thermometer,
  Printer,
  Search,
  Layers,
  Archive,
  BookOpenCheck,
  Hash,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '../ui/button';
import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { loadModulesConfig, type ModuleConfig } from '../../lib/config/modules-config';
import { useTranslation } from 'react-i18next';
import { MemphisIconSVG, PLATFORM } from '../../lib/config/branding';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  subItems?: SubItem[];
}

interface SubItem {
  label: string;
  href?: string;
  id?: string;
  subItems?: { label: string; href: string; id?: string }[];
}

interface ERPSidebarProps {
  currentModule: string;
  onModuleChange: (moduleId: string, subRoute?: string) => void;
  currentRoute?: string;
}

export function ERPSidebar({ currentModule, onModuleChange, currentRoute = '' }: ERPSidebarProps) {
  const { t } = useTranslation();
  const { user, profile, tenantName, tenantLogoUrl } = useAuth();
  // Todos los módulos comienzan contraídos — se expande el activo al navegar
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [modulesConfig, setModulesConfig] = useState<ModuleConfig[]>(loadModulesConfig);

  // Re-leer config cuando GestionModulos guarda cambios
  useEffect(() => {
    const handler = () => setModulesConfig(loadModulesConfig());
    window.addEventListener('memphis-modules-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('memphis-modules-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: t('nav.home', 'Inicio'),
      icon: <Home className="size-5" />,
      href: '/home'
    },
    {
      id: 'dashboard',
      label: t('nav.dashboard'),
      icon: <LayoutDashboard className="size-5" />,
      href: '/dashboard'
    },
    {
      id: 'proveedores',
      label: t('nav.proveedores'),
      icon: <Users className="size-5" />,
      href: '/proveedores',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/proveedores' },
        { label: t('nav.sub.directorio'), href: '/proveedores/directorio' },
        { label: t('nav.sub.evaluaciones'), href: '/proveedores/evaluaciones' },
        { label: t('nav.sub.contratos'), href: '/proveedores/contratos' },
        { label: t('nav.sub.talleres'), href: '/proveedores/talleres' }
      ]
    },
    {
      id: 'compras',
      label: t('nav.compras'),
      icon: <ShoppingCart className="size-5" />,
      href: '/compras',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/compras' },
        { label: t('nav.sub.requerimientos'), href: '/compras/requerimientos' },
        { label: t('nav.sub.cotizaciones'), href: '/compras/cotizaciones' },
        { label: t('nav.sub.ordenes_compra'), href: '/compras/ordenes' },
        { label: t('nav.sub.recepciones'), href: '/compras/recepciones' }
      ]
    },
    {
      id: 'inventario',
      label: t('nav.inventario'),
      icon: <Package className="size-5" />,
      href: '/inventario',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/inventario' },
        { label: t('nav.sub.productos'), href: '/inventario/productos' },
        { label: t('nav.sub.almacenes'), href: '/inventario/almacenes' },
        { label: t('nav.sub.movimientos'), href: '/inventario/movimientos' },
        { label: t('nav.sub.stock_critico'), href: '/inventario/stock-critico' }
      ]
    },
    {
      id: 'contabilidad',
      label: t('nav.contabilidad', 'Contabilidad'),
      icon: <BookOpen className="size-5" />,
      href: '/contabilidad',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/contabilidad' },
        { label: t('nav.sub.plan_cuentas'), href: '/contabilidad/plan-cuentas' },
        { label: t('nav.sub.periodos'), href: '/contabilidad/periodos' },
        { label: t('nav.sub.libro_diario'), href: '/contabilidad/asientos' },
        { label: t('nav.sub.comprobantes'), href: '/contabilidad/comprobantes' },
        { label: t('nav.sub.reg_compras'), href: '/contabilidad/registro-compras' },
        { label: t('nav.sub.reg_ventas'), href: '/contabilidad/registro-ventas' },
      ]
    },
    {
      id: 'finanzas',
      label: t('nav.finanzas'),
      icon: <DollarSign className="size-5" />,
      href: '/finanzas',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/finanzas' },
        { label: t('nav.sub.transacciones'), href: '/finanzas/transacciones' },
        { label: t('nav.sub.presupuestos'), href: '/finanzas/presupuestos' },
        { label: t('nav.sub.cuentas_pagar'), href: '/finanzas/cuentas-pagar' },
        { label: t('nav.sub.caja_chica'), href: '/finanzas/caja-chica' },
        { label: t('nav.sub.flujo_caja'), href: '/finanzas/flujo-caja' },
        { label: t('nav.sub.reportes'), href: '/finanzas/reportes' }
      ]
    },
    {
      id: 'proyectos',
      label: t('nav.proyectos'),
      icon: <FolderKanban className="size-5" />,
      href: '/proyectos',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/proyectos' },
        { label: t('nav.sub.lista_proyectos'), href: '/proyectos/lista' },
        { label: t('nav.sub.tareas'), href: '/proyectos/tareas' },
        { label: t('nav.sub.cronograma'), href: '/proyectos/cronograma' },
        { label: t('nav.sub.valorizaciones'), href: '/proyectos/valorizaciones' },
        { label: t('nav.sub.riesgos'), href: '/proyectos/riesgos' },
        { label: t('nav.sub.documentos'), href: '/proyectos/documentos' }
      ]
    },
    {
      id: 'flota',
      label: t('nav.flota'),
      icon: <Truck className="size-5" />,
      href: '/flota',
      subItems: [
        {
          label: t('nav.sub.dashboard'),
          href: '/flota',
          id: 'flota-dashboard',
        },
        {
          label: t('nav.sub.vehiculos'),
          href: '/flota/vehiculos',
          id: 'flota-vehiculos',
        },
        {
          label: t('nav.sub.mantenimientos'),
          href: '/flota/mantenimientos',
          id: 'flota-mantenimientos',
        },
        {
          label: t('nav.sub.analisis_preventivo'),
          href: '/flota/analisis-preventivo',
          id: 'flota-analisis-preventivo',
        },
        {
          label: t('nav.sub.monitoreo_gps'),
          href: '/flota/gps',
          id: 'flota-gps',
        },
        {
          label: t('nav.sub.reporte_vehiculos'),
          href: '/flota/reportes/vehiculos',
          id: 'flota-reportes-vehiculos',
        },
        {
          label: t('nav.sub.reporte_mantenimientos'),
          href: '/flota/reportes/mantenimientos',
          id: 'flota-reportes-mantenimientos',
        },
        {
          label: t('nav.sub.reporte_documentos'),
          href: '/flota/reportes/documentos',
          id: 'flota-reportes-documentos',
        },
        {
          label: 'Costos por Vehículo',
          href: '/flota/reportes/costos',
          id: 'flota-reportes-costos',
        }
      ]
    },
    {
      id: 'biomedico',
      label: t('nav.biomedico'),
      icon: <Activity className="size-5" />,
      href: '/biomedico',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/biomedico' },
        { label: t('nav.sub.equipos'), href: '/biomedico/equipos' },
        { label: t('nav.sub.mantenimientos'), href: '/biomedico/mantenimientos' },
        { label: t('nav.sub.calibraciones'), href: '/biomedico/calibraciones' },
        { label: t('nav.sub.incidencias'), href: '/biomedico/incidencias' },
        { label: t('nav.sub.documentos'), href: '/biomedico/documentos' },
        { label: t('nav.sub.contratos_servicio', 'Contratos'), href: '/biomedico/contratos' }
      ]
    },
    {
      id: 'crm',
      label: t('nav.crm'),
      icon: <UserCircle className="size-5" />,
      href: '/crm',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/crm' },
        { label: t('nav.sub.clientes'), href: '/crm/clientes' },
        { label: t('nav.sub.oportunidades'), href: '/crm/oportunidades' },
        { label: t('nav.sub.actividades'), href: '/crm/actividades' }
      ]
    },
    {
      id: 'bi',
      label: t('nav.bi'),
      icon: <BarChart3 className="size-5" />,
      href: '/bi',
      subItems: [
        { label: t('nav.sub.dashboard'), href: '/bi', id: 'bi-dashboard' },
        { label: t('nav.sub.reporte_cruzado'), href: '/bi/cruzado', id: 'bi-cruzado' },
      ]
    },
    {
      id: 'admin',
      label: t('nav.admin'),
      icon: <Settings className="size-5" />,
      href: '/admin',
      subItems: [
        { label: t('nav.sub.usuarios_roles'), href: '/admin/usuarios', id: 'admin-usuarios' },
        { label: t('nav.sub.catalogs'), href: '/admin/catalogos', id: 'admin-catalogos' },
        { label: t('nav.sub.approval_flow'), href: '/admin/flujo-aprobacion', id: 'admin-flujo-aprobacion' },
        { label: t('nav.sub.cost_centers', 'Centros de Costo'), href: '/admin/centros-costo', id: 'admin-centros-costo' }
      ]
    }
  ];

  // Auto-expandir el menú padre cuando cambia la ruta
  useEffect(() => {
    const parentItem = navItems.find(item =>
      item.subItems && (
        currentRoute === item.href ||
        currentRoute.startsWith(item.href + '/')
      )
    );
    if (parentItem && !expandedItems.includes(parentItem.id)) {
      setExpandedItems(prev => [...prev, parentItem.id]);
    }
  }, [currentRoute]);

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getSubItemIcon = (href: string, label?: string) => {
    // Dashboard (genérico) — por href o por label
    if (href.includes('dashboard')) return <LayoutDashboard className="size-4" />;
    if (label && label.toLowerCase() === 'dashboard') return <LayoutDashboard className="size-4" />;
    // Flota
    if (href.includes('vehiculos')) return <Car className="size-4" />;
    if (href.includes('mantenimientos') && !href.includes('reporte')) return <Wrench className="size-4" />;
    if (href.includes('analisis-preventivo') || href.includes('analisis_preventivo')) return <Gauge className="size-4" />;
    if (href.includes('gps') || href.includes('monitoreo')) return <MapPin className="size-4" />;
    if (href.includes('reporte-vehiculos') || href.includes('reporte_vehiculos')) return <FileBarChart className="size-4" />;
    if (href.includes('reporte-mantenimientos') || href.includes('reporte_mantenimientos')) return <FileCheck className="size-4" />;
    if (href.includes('reporte-documentos') || href.includes('reporte_documentos')) return <FileText className="size-4" />;
    // Proveedores
    if (href.includes('directorio')) return <Building2 className="size-4" />;
    if (href.includes('evaluaciones')) return <Star className="size-4" />;
    if (href.includes('contratos')) return <Handshake className="size-4" />;
    if (href.includes('talleres')) return <Wrench className="size-4" />;
    if (href.includes('categorias')) return <Layers className="size-4" />;
    // Compras
    if (href.includes('requerimientos')) return <ClipboardCheck className="size-4" />;
    if (href.includes('cotizaciones')) return <FileText className="size-4" />;
    if (href.includes('ordenes-compra') || href.includes('ordenes_compra')) return <ShoppingBag className="size-4" />;
    if (href.includes('recepciones')) return <PackageSearch className="size-4" />;
    // Inventario
    if (href.includes('productos') || href.includes('articulos')) return <BoxIcon className="size-4" />;
    if (href.includes('almacenes')) return <Archive className="size-4" />;
    if (href.includes('movimientos')) return <ArrowRightLeft className="size-4" />;
    if (href.includes('ordenes')) return <ListChecks className="size-4" />;
    if (href.includes('stock')) return <AlertCircle className="size-4" />;
    // Contabilidad
    if (href.includes('plan-cuentas') || href.includes('plan_cuentas')) return <BookOpen className="size-4" />;
    if (href.includes('periodos')) return <CalendarDays className="size-4" />;
    if (href.includes('libro-diario') || href.includes('libro_diario')) return <BookOpenCheck className="size-4" />;
    if (href.includes('comprobantes')) return <Receipt className="size-4" />;
    if (href.includes('reg-compras') || href.includes('reg_compras')) return <ShoppingCart className="size-4" />;
    if (href.includes('reg-ventas') || href.includes('reg_ventas')) return <CreditCard className="size-4" />;
    // Finanzas
    if (href.includes('transacciones')) return <ArrowRightLeft className="size-4" />;
    if (href.includes('presupuestos')) return <Calculator className="size-4" />;
    if (href.includes('cuentas-pagar') || href.includes('cuentas_pagar')) return <CreditCard className="size-4" />;
    if (href.includes('caja-chica') || href.includes('caja_chica')) return <Wallet className="size-4" />;
    if (href.includes('flujo-caja') || href.includes('flujo_caja')) return <TrendingUp className="size-4" />;
    if (href.includes('reportes')) return <BarChart3 className="size-4" />;
    // Proyectos
    if (href.includes('lista') || href.includes('proyectos/lista')) return <FolderKanban className="size-4" />;
    if (href.includes('tareas')) return <ListChecks className="size-4" />;
    if (href.includes('cronograma')) return <CalendarDays className="size-4" />;
    if (href.includes('valorizaciones')) return <DollarSign className="size-4" />;
    if (href.includes('riesgos')) return <AlertTriangle className="size-4" />;
    if (href.includes('documentos')) return <FileText className="size-4" />;
    // Biomédico
    if (href.includes('equipos')) return <Thermometer className="size-4" />;
    if (href.includes('calibraciones')) return <Cog className="size-4" />;
    if (href.includes('incidencias')) return <AlertCircle className="size-4" />;
    // CRM
    if (href.includes('clientes')) return <Users className="size-4" />;
    if (href.includes('oportunidades')) return <Target className="size-4" />;
    if (href.includes('actividades')) return <PhoneCall className="size-4" />;
    // BI
    if (href.includes('cruzado')) return <FileBarChart className="size-4" />;
    // Admin
    if (href.includes('usuarios')) return <Users className="size-4" />;
    if (href.includes('catalogos') || href.includes('catalogs')) return <Cog className="size-4" />;
    if (href.includes('flujo-aprobacion') || href.includes('approval')) return <GitBranch className="size-4" />;
    if (href.includes('centros-costo') || href.includes('cost_centers')) return <Hash className="size-4" />;
    return null;
  };

  const isSubItemActive = (subItemHref: string) => {
    const moduleRoots = navItems
      .filter(i => i.subItems)
      .map(i => i.href);
    if (moduleRoots.includes(subItemHref)) {
      return currentRoute === subItemHref || currentRoute === subItemHref + '/';
    }
    // Detail routes: /proyectos/detalle/:id → highlight /proyectos/lista
    if (subItemHref.endsWith('/lista') && currentRoute.includes('/detalle/')) {
      const base = subItemHref.replace('/lista', '');
      if (currentRoute.startsWith(base + '/detalle/')) return true;
    }
    return currentRoute.startsWith(subItemHref + '/') || currentRoute === subItemHref;
  };

  return (
    <aside className="dark w-64 bg-[#1A1A1A] border-r border-border h-screen flex flex-col lg:fixed lg:left-0 lg:top-0 z-40">
      {/* Logo — branding por TENANT (nombre e imagen del cliente) — click = home */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0 cursor-pointer" onClick={() => onNavigate('/home')}>
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo del tenant si existe, sino ícono Memphis como fallback */}
          {tenantLogoUrl ? (
            <img
              src={tenantLogoUrl}
              alt={tenantName ?? PLATFORM.name}
              className="size-8 rounded-lg object-contain bg-white dark:bg-gray-900 p-0.5"
            />
          ) : (
            <div className="size-8 shrink-0 flex items-center justify-center">
              <MemphisIconSVG className="size-8" />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-sm font-bold text-foreground truncate block">
              {tenantName ?? PLATFORM.name}
            </span>
            <p className="text-xs text-muted-foreground leading-none truncate">
              {PLATFORM.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {navItems.filter(item => {
          if (item.id === 'admin' || item.id === 'home') return true; // siempre visible
          const cfg = modulesConfig.find(m => m.id === item.id);
          return cfg?.enabled ?? item.id === 'dashboard';
        }).map((item) => (
            <div key={item.id}>
              {item.id === 'admin' && (
                <div className="my-2 px-1">
                  <div className="border-t border-border/60" />
                </div>
              )}
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  currentModule === item.id
                    ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => {
                  if (item.subItems) {
                    if (expandedItems.includes(item.id)) {
                      setExpandedItems(prev => prev.filter(id => id !== item.id));
                    } else {
                      setExpandedItems(prev => [...prev, item.id]);
                    }
                  } else {
                    onModuleChange(item.id);
                  }
                }}
              >
                {item.icon}
                <span className="ml-3 flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs">
                    {item.badge}
                  </span>
                )}
                {item.subItems && (
                  <ChevronDown
                    className={`ml-auto size-4 transition-transform ${
                      expandedItems.includes(item.id) ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </Button>

              {item.subItems && expandedItems.includes(item.id) && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.subItems.map((subItem) => (
                    <Button
                      key={subItem.href}
                      variant="ghost"
                      className={`w-full justify-start text-sm pl-3 ${
                        isSubItemActive(subItem.href ?? '')
                          ? 'bg-primary/8 text-primary font-medium border-l-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/30 border-l-2 border-transparent'
                      }`}
                      onClick={() => onModuleChange(item.id, subItem.href)}
                    >
                      {getSubItemIcon(subItem.href ?? '', subItem.label)}
                      <span className="ml-2">{subItem.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* User info + Settings */}
      <div className="p-3 border-t border-border space-y-1">
        {user?.email && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-foreground truncate">
              {profile ? `${profile.nombre}${profile.apellido ? ' ' + profile.apellido : ''}` : user.email}
            </p>
            {profile && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => onModuleChange('admin')}
        >
          <Settings className="size-5" />
          <span className="ml-3">{t('nav.settings')}</span>
        </Button>
      </div>
    </aside>
  );
}