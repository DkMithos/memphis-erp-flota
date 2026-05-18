import { useRef, useState, useCallback } from 'react';
import { Bell, Search, Moon, Sun, Monitor, ChevronDown, LogOut, User, Settings, CheckCheck, Loader2, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { supabase } from '../../lib/supabase/client';

interface SearchResult {
  tipo: string;
  label: string;
  route: string;
}

const TIPO_BADGE: Record<string, string> = {
  'OT': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Vehículo': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Proyecto': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Cliente': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Artículo': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

interface ERPTopbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  themeMode?: 'light' | 'dark' | 'system';
  onSetTheme?: (mode: 'light' | 'dark' | 'system') => void;
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

export function ERPTopbar({ darkMode, onToggleDarkMode, themeMode = 'light', onSetTheme, tenantName, userName, onNavigate }: ERPTopbarProps) {

  const { t, i18n } = useTranslation();
  const { signOut, user, tenantId } = useAuth();
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotifications();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); setShowResults(false); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!tenantId) return;
      setSearching(true);
      try {
        const term = `%${q}%`;
        const [ots, vehiculos, proyectos, clientes, articulos] = await Promise.all([
          supabase.from('ordenes_trabajo').select('numero_ot,titulo').ilike('titulo', term).limit(3),
          supabase.from('vehiculos').select('codigo,placa,marca,modelo').or(`placa.ilike.${term},codigo.ilike.${term}`).limit(3),
          supabase.from('proyectos_proyecto').select('id,nombre').ilike('nombre', term).limit(3),
          supabase.from('clientes').select('codigo,razon_social').ilike('razon_social', term).limit(3),
          supabase.from('articulos').select('codigo,nombre').ilike('nombre', term).limit(3),
        ]);
        const res: SearchResult[] = [
          ...(ots.data ?? []).map((r: Record<string, string>) => ({ tipo: 'OT', label: `${r.numero_ot} — ${r.titulo}`, route: `/flota/mantenimientos/${r.numero_ot}` })),
          ...(vehiculos.data ?? []).map((r: Record<string, string>) => ({ tipo: 'Vehículo', label: `${r.placa} — ${r.marca} ${r.modelo}`, route: `/flota/vehiculos/${r.codigo}` })),
          ...(proyectos.data ?? []).map((r: Record<string, string>) => ({ tipo: 'Proyecto', label: r.nombre, route: `/proyectos/detalle/${r.id}` })),
          ...(clientes.data ?? []).map((r: Record<string, string>) => ({ tipo: 'Cliente', label: `${r.codigo} — ${r.razon_social}`, route: `/crm/clientes/${r.codigo}` })),
          ...(articulos.data ?? []).map((r: Record<string, string>) => ({ tipo: 'Artículo', label: `${r.codigo} — ${r.nombre}`, route: `/inventario/articulos/${r.codigo}` })),
        ];
        setResults(res);
        setShowResults(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [tenantId]);

  const handleResultClick = (route: string) => {
    onNavigate?.(route);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="flex items-center justify-end gap-2 flex-1">
      {/* Search Bar */}
      <div className="hidden md:flex flex-1 max-w-xl" ref={searchRef}>
        <div className="relative w-full">
          {searching
            ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
            : <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          }
          <Input
            placeholder={t('topbar.search_placeholder')}
            className="pl-10 bg-secondary border-0"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {showResults && results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border rounded-lg shadow-lg overflow-hidden">
              {results.map((r, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors text-sm"
                  onMouseDown={() => handleResultClick(r.route)}
                >
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TIPO_BADGE[r.tipo] ?? 'bg-muted text-muted-foreground'}`}>
                    {r.tipo}
                  </span>
                  <span className="truncate">{r.label}</span>
                </button>
              ))}
            </div>
          )}
          {showResults && query.length >= 2 && results.length === 0 && !searching && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
              {t('topbar.no_results')} &ldquo;{query}&rdquo;
            </div>
          )}
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
              <span className="font-semibold text-sm">{t('topbar.notifications')}</span>
              {noLeidas > 0 && (
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs gap-1"
                  onClick={marcarTodasLeidas}
                >
                  <CheckCheck className="size-3" /> {t('topbar.mark_all_read')}
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t('topbar.no_notifications')}
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

        {/* Language Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title={t('topbar.language')}>
              <Languages className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{t('topbar.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => i18n.changeLanguage('es')}>
              <span className="text-base">🇵🇪</span>
              <span>{t('topbar.lang_es')}</span>
              {i18n.language.startsWith('es') && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => i18n.changeLanguage('en')}>
              <span className="text-base">🇺🇸</span>
              <span>{t('topbar.lang_en')}</span>
              {i18n.language.startsWith('en') && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              {themeMode === 'system' ? <Monitor className="size-5" /> : darkMode ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{t('topbar.appearance')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onSetTheme?.('light')}>
              <Sun className="size-4" />
              <span>{t('topbar.light')}</span>
              {themeMode === 'light' && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onSetTheme?.('dark')}>
              <Moon className="size-4" />
              <span>{t('topbar.dark')}</span>
              {themeMode === 'dark' && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onSetTheme?.('system')}>
              <Monitor className="size-4" />
              <span>{t('topbar.system')}</span>
              {themeMode === 'system' && <span className="ml-auto text-primary text-xs">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
              <User className="size-4" />
              {t('topbar.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate?.('/admin/usuarios')}>
              <Settings className="size-4" />
              {t('topbar.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut()}
            >
              <LogOut className="size-4" />
              {t('topbar.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
