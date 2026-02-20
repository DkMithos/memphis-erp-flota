import { Activity, AlertCircle, Calendar, CheckCircle2, Clock, TrendingUp, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { ModulePlaceholderPage, defaultQuickActions } from '../../shared/ModulePlaceholderPage';

interface BiomedicoDashboardProps {
  onNavigate?: (route: string) => void;
}

export function BiomedicoDashboard({ onNavigate }: BiomedicoDashboardProps) {
  return (
    <ModulePlaceholderPage
      moduleTitle="Biomédico - Dashboard"
      moduleDescription="Gestión integral de equipos médicos, mantenimientos, calibraciones y certificaciones"
      moduleIcon={Activity}
      quickActions={[
        defaultQuickActions.create(() => onNavigate?.('/biomedico/mantenimientos/nueva')),
        { label: 'Ver Equipos', icon: Activity, onClick: () => onNavigate?.('/biomedico/equipos'), variant: 'outline' }
      ]}
      status="ready"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate?.('/biomedico/equipos')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Equipos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">--</div>
            <p className="text-xs text-muted-foreground mt-1">Equipos registrados</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate?.('/biomedico/mantenimientos')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Mantenimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wrench className="size-5 text-primary" />
              <div className="text-2xl font-semibold">--</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendientes este mes</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate?.('/biomedico/calibraciones')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Calibraciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-yellow-600" />
              <div className="text-2xl font-semibold">--</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Próximas a vencer</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate?.('/biomedico/incidencias')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Incidencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 text-red-600" />
              <div className="text-2xl font-semibold">--</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Abiertas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Mantenimientos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="size-12 mx-auto mb-3 opacity-20" />
              <p>No hay mantenimientos registrados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Certificaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="size-12 mx-auto mb-3 opacity-20" />
              <p>No hay certificaciones pendientes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePlaceholderPage>
  );
}
