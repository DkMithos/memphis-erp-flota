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
  PhoneCall
} from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';

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
  const [expandedItems, setExpandedItems] = useState<string[]>(['flota']);

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="size-5" />,
      href: '/dashboard'
    },
    {
      id: 'proveedores',
      label: 'Proveedores',
      icon: <Users className="size-5" />,
      href: '/proveedores',
      subItems: [
        { label: 'Dashboard', href: '/proveedores' },
        { label: 'Directorio', href: '/proveedores/directorio' },
        { label: 'Evaluaciones', href: '/proveedores/evaluaciones' },
        { label: 'Contratos', href: '/proveedores/contratos' },
        { label: 'Talleres', href: '/proveedores/talleres' }
      ]
    },
    {
      id: 'compras',
      label: 'Compras',
      icon: <ShoppingCart className="size-5" />,
      href: '/compras',
      badge: '3',
      subItems: [
        { label: 'Dashboard', href: '/compras' },
        { label: 'Requerimientos', href: '/compras/requerimientos' },
        { label: 'Cotizaciones', href: '/compras/cotizaciones' },
        { label: 'Órdenes de Compra', href: '/compras/ordenes' },
        { label: 'Recepciones', href: '/compras/recepciones' }
      ]
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: <Package className="size-5" />,
      href: '/inventario',
      subItems: [
        { label: 'Dashboard', href: '/inventario' },
        { label: 'Productos', href: '/inventario/productos' },
        { label: 'Movimientos', href: '/inventario/movimientos' },
        { label: 'Órdenes', href: '/inventario/ordenes' },
        { label: 'Stock Crítico', href: '/inventario/stock-critico' }
      ]
    },
    {
      id: 'finanzas',
      label: 'Finanzas',
      icon: <DollarSign className="size-5" />,
      href: '/finanzas',
      subItems: [
        { label: 'Dashboard', href: '/finanzas' },
        { label: 'Presupuestos', href: '/finanzas/presupuestos' },
        { label: 'Cuentas por Pagar', href: '/finanzas/cuentas-pagar' },
        { label: 'Flujo de Caja', href: '/finanzas/flujo-caja' },
        { label: 'Reportes', href: '/finanzas/reportes' }
      ]
    },
    {
      id: 'proyectos',
      label: 'Proyectos',
      icon: <FolderKanban className="size-5" />,
      href: '/proyectos',
      subItems: [
        { label: 'Dashboard', href: '/proyectos' },
        { label: 'Cronograma', href: '/proyectos/cronograma' },
        { label: 'Tareas', href: '/proyectos/tareas' },
        { label: 'Valorizaciones', href: '/proyectos/valorizaciones' },
        { label: 'Riesgos', href: '/proyectos/riesgos' },
        { label: 'Documentos', href: '/proyectos/documentos' }
      ]
    },
    {
      id: 'flota',
      label: 'Flota',
      icon: <Truck className="size-5" />,
      href: '/flota',
      subItems: [
        { 
          label: 'Dashboard', 
          href: '/flota',
          id: 'flota-dashboard',
        },
        { 
          label: 'Vehículos', 
          href: '/flota/vehiculos',
          id: 'flota-vehiculos',
        },
        { 
          label: 'Mantenimientos', 
          href: '/flota/mantenimientos',
          id: 'flota-mantenimientos',
        },
        { 
          label: 'Análisis Preventivo', 
          href: '/flota/analisis-preventivo',
          id: 'flota-analisis-preventivo',
        },
        { 
          label: 'Reporte Vehículos',
          href: '/flota/reportes/vehiculos',
          id: 'flota-reportes-vehiculos',
        },
        { 
          label: 'Reporte Mantenimientos',
          href: '/flota/reportes/mantenimientos',
          id: 'flota-reportes-mantenimientos',
        },
        { 
          label: 'Reporte Documentos',
          href: '/flota/reportes/documentos',
          id: 'flota-reportes-documentos',
        }
      ]
    },
    {
      id: 'biomedico',
      label: 'Biomédico',
      icon: <Activity className="size-5" />,
      href: '/biomedico',
      subItems: [
        { label: 'Dashboard', href: '/biomedico' },
        { label: 'Equipos', href: '/biomedico/equipos' },
        { label: 'Mantenimientos', href: '/biomedico/mantenimientos' },
        { label: 'Calibraciones', href: '/biomedico/calibraciones' },
        { label: 'Incidencias', href: '/biomedico/incidencias' },
        { label: 'Documentos', href: '/biomedico/documentos' }
      ]
    },
    {
      id: 'crm',
      label: 'CRM',
      icon: <UserCircle className="size-5" />,
      href: '/crm',
      subItems: [
        { label: 'Dashboard', href: '/crm' },
        { label: 'Clientes', href: '/crm/clientes' },
        { label: 'Oportunidades', href: '/crm/oportunidades' },
        { label: 'Actividades', href: '/crm/actividades' }
      ]
    }
  ];

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getSubItemIcon = (href: string) => {
    if (href.includes('dashboard')) return <LayoutDashboard className="size-4" />;
    if (href.includes('vehiculos')) return <Car className="size-4" />;
    if (href.includes('mantenimientos')) return <Wrench className="size-4" />;
    return null;
  };

  const isSubItemActive = (subItemHref: string) => {
    // Match exacto para Dashboard de Flota
    if (subItemHref === '/flota') {
      return currentRoute === '/flota' || currentRoute === '/flota/';
    }
    
    // Match por prefijo para sub-rutas
    // Esto permite que /flota/vehiculos/VH-001 active el submenú "Vehículos"
    // y que /flota/mantenimientos/OT-2024-002 active "Mantenimientos"
    return currentRoute.startsWith(subItemHref + '/') || currentRoute === subItemHref;
  };

  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col lg:fixed lg:left-0 lg:top-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <Building2 className="size-8 text-primary" />
        <span className="ml-3 text-xl font-semibold">KESA ERP</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {navItems.map((item) => (
            <div key={item.id}>
              <Button
                variant={currentModule === item.id && !item.subItems ? 'secondary' : 'ghost'}
                className={`w-full justify-start ${
                  currentModule === item.id && !item.subItems
                    ? 'bg-accent text-accent-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => {
                  if (item.subItems) {
                    toggleExpand(item.id);
                    // Expandir y navegar al primer subitem por defecto
                    if (!expandedItems.includes(item.id)) {
                      onModuleChange(item.id, item.subItems[0].href);
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
                      className={`w-full justify-start text-sm ${
                        isSubItemActive(subItem.href)
                          ? 'bg-accent/50 text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                      }`}
                      onClick={() => onModuleChange(item.id, subItem.href)}
                    >
                      {getSubItemIcon(subItem.href)}
                      <span className="ml-2">{subItem.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <Settings className="size-5" />
          <span className="ml-3">Configuración</span>
        </Button>
      </div>
    </aside>
  );
}