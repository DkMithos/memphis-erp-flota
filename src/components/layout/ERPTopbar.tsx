import { Bell, Search, Moon, Sun, ChevronDown, LogOut, User, Settings, CheckCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../lib/shared/useNotifications';

interface ERPTopbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  tenantName: string;
  userName: string;
  onNavigate?: (route: string) => void;
}

const TIPO_COLOR: Record<string, string> = {
  info:    'bg-blue-500',
  warning: 'bg-yellow-500',
  error:   'bg-red-500',
  success: 'bg-green-500',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

export function ERPTopbar({ darkMode, onToggleDarkMode, tenantName, userName, onNavigate }: ERPTopbarProps) {
  const { signOut, user } = useAuth();
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotifications();

  return (
    <div className="flex items-center justify-end gap-2 flex-1">
      {/* Search Bar */}
      <div className="hidden md:flex flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar en KESA ERP..." className="pl-10 bg-secondary border-0" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Tenant indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg mr-2">
          <div className="size-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-muted-foreground">{tenantName}</span>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              {noLeidas > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {noLeidas > 9 ? '9+' : noLeidas}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-semibold text-sm">Notificaciones</span>
              {noLeidas > 0 && (
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs gap-1"
                  onClick={marcarTodasLeidas}
                >
                  <CheckCheck className="size-3" /> Marcar todas
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Sin notificaciones
                </div>
              ) : (
                notificaciones.slice(0, 20).map(n => (
                  <div
                    key={n.id}
                    className={`p-3 cursor-pointer border-b last:border-0 hover:bg-accent transition-colors ${!n.leida ? 'bg-accent/40' : ''}`}
                    onClick={() => { if (!n.leida) marcarLeida(n.id); }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`size-2 rounded-full mt-2 shrink-0 ${TIPO_COLOR[n.tipo]}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.leida ? 'font-medium' : ''}`}>{n.titulo}</p>
                        {n.mensaje && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.mensaje}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.creadoEn)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dark Mode Toggle */}
        <Button variant="ghost" size="icon" onClick={onToggleDarkMode}>
          {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline">{userName}</span>
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p>{userName}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate?.('/perfil')}>
              <User className="size-4 mr-2" />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate?.('/admin/usuarios')}>
              <Settings className="size-4 mr-2" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut()}
            >
              <LogOut className="size-4 mr-2" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
