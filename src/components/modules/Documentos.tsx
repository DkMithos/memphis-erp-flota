/**
 * DOCUMENTOS — mirar y bajarse carpetas de SharePoint sin salir del ERP.
 *
 * Shirley pidió exactamente esto y nada más: ver los archivos del expediente OXI
 * y poder descargarlos. No hay que enlazarlos con proyectos ni con órdenes —
 * ella se entiende con esos documentos.
 *
 * Lo que se ve es lo que hay en Teams AHORA. Los archivos no se copian al ERP:
 * la carpeta se lista en vivo y, al descargar, Microsoft entrega un enlace de un
 * solo uso que caduca solo. Por eso no hay nada que sincronizar ni que se quede
 * viejo, y por eso una carpeta que alguien reordene en Teams se ve reordenada
 * aquí sin tocar nada.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderOpen, Folder, FileText, Download, ChevronRight, Home, RefreshCw,
  Loader2, AlertTriangle, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { usePermissions } from '../../lib/rbac/usePermissions';

interface ItemSharePoint {
  id: string;
  nombre: string;
  esCarpeta: boolean;
  elementos: number | null;
  tamano: number | null;
  mime: string | null;
  modificado: string | null;
}

interface Migaja {
  id: string | null;
  nombre: string;
}

/** "1,2 MB" · "340 KB" · "" cuando no aplica (carpetas). */
function tamanoLegible(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

/** Un icono que diga de un vistazo qué clase de archivo es. */
function iconoDe(item: ItemSharePoint) {
  if (item.esCarpeta) return <Folder className="size-5 text-amber-500 shrink-0" />;
  const n = item.nombre.toLowerCase();
  const color =
    /\.(pdf)$/.test(n) ? 'text-red-500'
    : /\.(xlsx?|xlsm|csv)$/.test(n) ? 'text-green-600'
    : /\.(docx?)$/.test(n) ? 'text-blue-600'
    : /\.(jpe?g|png|webp|gif)$/.test(n) ? 'text-purple-500'
    : 'text-muted-foreground';
  return <FileText className={`size-5 shrink-0 ${color}`} />;
}

export function Documentos() {
  const { can } = usePermissions();
  const puedeDescargar = can('documentos', 'exportar');

  const [items, setItems] = useState<ItemSharePoint[]>([]);
  const [migas, setMigas] = useState<Migaja[]>([]);
  const [raiz, setRaiz] = useState<{ nombre: string; ruta: string | null } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [bajando, setBajando] = useState<string | null>(null);

  /** `itemId` null = la raíz configurada. */
  const listar = useCallback(async (itemId: string | null, nombre?: string) => {
    setCargando(true);
    setError(null);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('documentos-sharepoint', {
        body: { accion: 'listar', item_id: itemId ?? undefined },
      });
      if (errFn) throw errFn;
      const r = data as {
        ok?: boolean; error?: string;
        carpeta?: { nombre: string; ruta: string | null };
        items?: ItemSharePoint[];
      };
      if (!r?.ok) throw new Error(r?.error ?? 'Respuesta inesperada');

      setItems(r.items ?? []);
      if (r.carpeta) setRaiz({ nombre: r.carpeta.nombre, ruta: r.carpeta.ruta ?? null });
      setBusqueda('');

      setMigas(prev => {
        if (itemId === null) return [];
        // Si ya estaba en el camino, se vuelve hasta ahí en vez de encadenar.
        const i = prev.findIndex(m => m.id === itemId);
        if (i >= 0) return prev.slice(0, i + 1);
        return [...prev, { id: itemId, nombre: nombre ?? 'Carpeta' }];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la carpeta');
      setItems([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void listar(null); }, [listar]);

  /**
   * Descargar. El enlace lo da Microsoft y caduca solo, así que no se guarda:
   * se pide, se usa y se olvida.
   */
  const descargar = async (item: ItemSharePoint) => {
    if (!puedeDescargar) return;
    setBajando(item.id);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('documentos-sharepoint', {
        body: { accion: 'descargar', item_id: item.id },
      });
      if (errFn) throw errFn;
      const r = data as { ok?: boolean; error?: string; enlace?: string };
      if (!r?.ok || !r.enlace) throw new Error(r?.error ?? 'No se obtuvo el enlace');

      const a = document.createElement('a');
      a.href = r.enlace;
      a.download = item.nombre;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(`No se pudo descargar "${item.nombre}". ` +
        (e instanceof Error ? e.message : ''), { duration: 8000 });
    } finally {
      setBajando(null);
    }
  };

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return t ? items.filter(i => i.nombre.toLowerCase().includes(t)) : items;
  }, [items, busqueda]);

  const carpetaActual = migas.length ? migas[migas.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <FolderOpen className="size-6" />
            Documentos
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {raiz?.nombre ?? 'Carpetas compartidas'}
            {raiz?.ruta && <span className="block text-xs mt-0.5">{raiz.ruta}</span>}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => listar(carpetaActual?.id ?? null, carpetaActual?.nombre)}
          disabled={cargando}
        >
          <RefreshCw className={`size-4 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Camino de vuelta */}
      <div className="flex items-center gap-1 flex-wrap text-sm">
        <button
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/50 disabled:opacity-60"
          onClick={() => listar(null)}
          disabled={cargando || migas.length === 0}
        >
          <Home className="size-4" />
          Inicio
        </button>
        {migas.map((m, i) => (
          <span key={m.id ?? i} className="flex items-center gap-1">
            <ChevronRight className="size-4 text-muted-foreground" />
            <button
              className="px-2 py-1 rounded hover:bg-accent/50 disabled:opacity-60 max-w-[240px] truncate"
              onClick={() => listar(m.id, m.nombre)}
              disabled={cargando || i === migas.length - 1}
              title={m.nombre}
            >
              {m.nombre}
            </button>
          </span>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">
            {cargando ? 'Cargando…' : `${visibles.length} ${visibles.length === 1 ? 'elemento' : 'elementos'}`}
          </CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar en esta carpeta…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="m-4 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
              <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">No se pudo abrir la carpeta</p>
                <p className="text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!error && (
            <div className="divide-y">
              {cargando && (
                <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                  Leyendo SharePoint…
                </p>
              )}

              {!cargando && visibles.length === 0 && (
                <p className="px-4 py-10 text-sm text-muted-foreground text-center">
                  {busqueda ? 'Nada coincide con lo buscado.' : 'Esta carpeta está vacía.'}
                </p>
              )}

              {!cargando && visibles.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30">
                  {iconoDe(item)}
                  <div className="min-w-0 flex-1">
                    {item.esCarpeta ? (
                      <button
                        className="text-sm font-medium text-left hover:underline truncate w-full"
                        onClick={() => listar(item.id, item.nombre)}
                        title={item.nombre}
                      >
                        {item.nombre}
                      </button>
                    ) : (
                      <p className="text-sm font-medium truncate" title={item.nombre}>{item.nombre}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {[
                        item.esCarpeta
                          ? `${item.elementos ?? 0} ${item.elementos === 1 ? 'elemento' : 'elementos'}`
                          : tamanoLegible(item.tamano),
                        fecha(item.modificado),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {item.esCarpeta ? (
                    <Badge variant="outline" className="shrink-0">Carpeta</Badge>
                  ) : (
                    <Button
                      variant="ghost" size="icon"
                      title={puedeDescargar ? 'Descargar' : 'No tienes permiso para descargar'}
                      disabled={!puedeDescargar || bajando === item.id}
                      onClick={() => descargar(item)}
                    >
                      {bajando === item.id
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Download className="size-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los archivos viven en SharePoint y se leen en vivo: lo que ves aquí es lo que hay en Teams
        ahora mismo. El ERP no guarda copias.
      </p>
    </div>
  );
}
