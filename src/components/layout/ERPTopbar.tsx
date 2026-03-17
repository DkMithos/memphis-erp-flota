import { Bell, Search, Moon, Sun, ChevronDown, LogOut } from 'lucide-react';
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

interface ERPTopbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  tenantName: string;
  userName: string;
}

export function ERPTopbar({ darkMode, onToggleDarkMode, tenantName, userName }: ERPTopbarProps) {
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[ERPTopbar] Error al cerrar sesión:', err);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 flex-1">
      {/* Search Bar - Hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en KESA ERP..."
            className="pl-10 bg-secondary border-0"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Tenant Info - Hidden on small screens */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg mr-2">
          <div className="size-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-muted-foreground">{tenantName}</span>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full"></span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-96 overflow-y-auto">
              <div className="p-3 hover:bg-accent cursor-pointer border-b">
                <div className="flex items-start gap-3">
                  <div className="size-2 rounded-full bg-blue-500 mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm">Nueva orden de compra pendiente de aprobación</p>
                    <p className="text-xs text-muted-foreground mt-1">Hace 5 minutos</p>
                  </div>
                </div>
              </div>
              <div className="p-3 hover:bg-accent cursor-pointer border-b">
                <div className="flex items-start gap-3">
                  <div className="size-2 rounded-full bg-yellow-500 mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm">Stock crítico en 3 productos</p>
                    <p className="text-xs text-muted-foreground mt-1">Hace 1 hora</p>
                  </div>
                </div>
              </div>
              <div className="p-3 hover:bg-accent cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="size-2 rounded-full bg-green-500 mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm">Mantenimiento de vehículo completado</p>
                    <p className="text-xs text-muted-foreground mt-1">Hace 2 horas</p>
                  </div>
                </div>
              </div>
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
            <DropdownMenuItem>
              <Avatar className="size-4 mr-2">
                <AvatarFallback className="bg-muted text-xs">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>Configuración</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleSignOut}
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