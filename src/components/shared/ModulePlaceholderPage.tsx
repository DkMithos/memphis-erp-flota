import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Settings, 
  Download,
  Upload,
  Filter,
  Search,
  Info,
  type LucideIcon
} from 'lucide-react';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  disabled?: boolean;
}

interface ModulePlaceholderPageProps {
  moduleTitle: string;
  moduleDescription: string;
  moduleIcon: LucideIcon;
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>;
  quickActions?: QuickAction[];
  showBackButton?: boolean;
  onBack?: () => void;
  status?: 'empty' | 'loading' | 'ready' | 'error';
  children?: React.ReactNode;
}

export function ModulePlaceholderPage({
  moduleTitle,
  moduleDescription,
  moduleIcon: Icon,
  breadcrumbs = [],
  quickActions = [],
  showBackButton = false,
  onBack,
  status = 'ready',
  children
}: ModulePlaceholderPageProps) {
  
  const renderStatusContent = () => {
    switch (status) {
      case 'empty':
        return (
          <Alert>
            <Info className="size-4" />
            <AlertDescription>
              No hay datos registrados. Utiliza las acciones rápidas para comenzar a agregar información.
            </AlertDescription>
          </Alert>
        );
      
      case 'loading':
        return (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground">Cargando datos del módulo...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      
      case 'error':
        return (
          <Alert variant="destructive">
            <AlertDescription>
              Error al cargar el módulo. Por favor, intenta nuevamente o contacta al administrador.
            </AlertDescription>
          </Alert>
        );
      
      default:
        return children;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {crumb.onClick ? (
                <button 
                  onClick={crumb.onClick}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}>
                  {crumb.label}
                </span>
              )}
              {index < breadcrumbs.length - 1 && <span>/</span>}
            </div>
          ))}
        </div>
      )}

      {/* Back Button */}
      {showBackButton && onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4 mr-2" />
          Volver
        </Button>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon className="size-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2>{moduleTitle}</h2>
              <Badge variant="outline" className="text-xs">
                En Desarrollo
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {moduleDescription}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                <action.icon className="size-4 mr-2" />
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Status/Content */}
      {renderStatusContent()}

      {/* Info Footer */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Módulo en Desarrollo</p>
              <p className="text-sm text-muted-foreground">
                Este módulo está siendo construido siguiendo los estándares Memphis ERP.
                La funcionalidad completa estará disponible próximamente con integración 
                a backend, validaciones y flujos de trabajo empresariales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const defaultQuickActions = {
  create: (onClick?: () => void): QuickAction => ({
    label: 'Crear Nuevo',
    icon: Plus,
    onClick,
    variant: 'default'
  }),
  import: (onClick?: () => void): QuickAction => ({
    label: 'Importar',
    icon: Upload,
    onClick,
    variant: 'outline'
  }),
  export: (onClick?: () => void): QuickAction => ({
    label: 'Exportar',
    icon: Download,
    onClick,
    variant: 'outline'
  }),
  filter: (onClick?: () => void): QuickAction => ({
    label: 'Filtrar',
    icon: Filter,
    onClick,
    variant: 'outline'
  }),
  search: (onClick?: () => void): QuickAction => ({
    label: 'Buscar',
    icon: Search,
    onClick,
    variant: 'outline'
  }),
  settings: (onClick?: () => void): QuickAction => ({
    label: 'Configurar',
    icon: Settings,
    onClick,
    variant: 'outline'
  })
};
