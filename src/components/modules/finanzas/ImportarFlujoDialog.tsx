/**
 * IMPORTAR FLUJO FINANCIERO — trae una BD (BD CONTA, BD TI…) de SharePoint.
 *
 * Reutiliza el mismo patrón del selector de presupuesto: navega la carpeta del
 * sitio FlujoFinanciero, elige la BD .xlsx y la carga. El área sale sola del
 * nombre del archivo ("BD CONTA" → CONTA). La Edge Function `flujo-import`
 * reemplaza por área lo importado del Excel.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet, Folder, ChevronRight, Home, Loader2, AlertTriangle,
  CheckCircle2, RefreshCw,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { supabase } from '../../../lib/supabase/client';

interface ItemSP {
  id: string; nombre: string; esCarpeta: boolean; esExcel: boolean; area: string;
}
interface Miga { id: string | null; nombre: string; }
interface Resultado {
  ok: boolean; area?: string; archivo?: string; compromisos?: number;
  presupuestado?: number; pagado?: number; pendiente?: number;
  centros_costo_reconocidos?: number; proveedores_reconocidos?: number; error?: string;
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ImportarFlujoDialog({ onImportado }: { onImportado: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ItemSP[]>([]);
  const [migas, setMigas] = useState<Miga[]>([]);
  const [carpetaNombre, setCarpetaNombre] = useState('');
  const [driveId, setDriveId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<{ itemId: string; nombre: string; area: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const listar = useCallback(async (itemId: string | null, nombre?: string) => {
    setCargando(true);
    setError(null);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('flujo-import', {
        body: { accion: 'listar', item_id: itemId ?? undefined },
      });
      if (errFn) throw errFn;
      const r = data as { ok?: boolean; error?: string; items?: ItemSP[]; carpeta?: { nombre: string; drive_id: string } };
      if (!r?.ok) throw new Error(r?.error ?? 'Respuesta inesperada');
      setItems(r.items ?? []);
      if (r.carpeta) { setDriveId(r.carpeta.drive_id); setCarpetaNombre(r.carpeta.nombre); }
      setMigas(prev => {
        if (itemId === null) return [];
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

  useEffect(() => {
    if (!open) return;
    setArchivo(null); setResultado(null); setMigas([]);
    void listar(null);
  }, [open, listar]);

  const importar = async () => {
    if (!archivo || !driveId) return;
    setImportando(true);
    setResultado(null);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('flujo-import', {
        body: { accion: 'importar', area: archivo.area || undefined, drive_id: driveId, item_id: archivo.itemId },
      });
      if (errFn) throw errFn;
      const r = data as Resultado;
      if (!r?.ok) { setResultado({ ok: false, error: r?.error ?? 'No se pudo importar' }); return; }
      setResultado(r);
      onImportado();
    } catch (e) {
      setResultado({ ok: false, error: e instanceof Error ? e.message : 'No se pudo importar' });
    } finally {
      setImportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><RefreshCw className="size-4" /> Importar / actualizar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar flujo financiero desde Excel</DialogTitle>
        </DialogHeader>

        {resultado?.ok ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{resultado.area}: {resultado.compromisos} compromisos cargados</p>
                <p className="text-muted-foreground mt-1">
                  Presupuestado {soles(resultado.presupuestado ?? 0)} · pagado {soles(resultado.pagado ?? 0)} ·
                  {' '}{resultado.centros_costo_reconocidos} con centro de costo reconocido
                  {resultado.proveedores_reconocidos ? `, ${resultado.proveedores_reconocidos} con proveedor` : ''}.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setResultado(null); setArchivo(null); void listar(null); }}>
                Importar otra
              </Button>
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige la base de datos del área (por ejemplo <strong>BD CONTA</strong> o <strong>BD TI</strong>).
              Se reemplaza lo cargado antes de esa área.
            </p>

            <div className="flex items-center gap-1 flex-wrap text-sm">
              <button
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/50 disabled:opacity-60"
                onClick={() => listar(null)} disabled={cargando || migas.length === 0}
              >
                <Home className="size-3.5" /> {carpetaNombre || 'Inicio'}
              </button>
              {migas.map((m, i) => (
                <span key={m.id ?? i} className="flex items-center gap-1">
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  <button
                    className="px-2 py-1 rounded hover:bg-accent/50 disabled:opacity-60 max-w-[180px] truncate"
                    onClick={() => listar(m.id, m.nombre)} disabled={cargando || i === migas.length - 1} title={m.nombre}
                  >
                    {m.nombre}
                  </button>
                </span>
              ))}
            </div>

            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
              {error && (
                <div className="p-3 flex items-start gap-2 text-sm">
                  <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{error}</span>
                </div>
              )}
              {cargando && (
                <p className="px-3 py-8 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Leyendo SharePoint…
                </p>
              )}
              {!cargando && !error && items.length === 0 && (
                <p className="px-3 py-8 text-sm text-muted-foreground text-center">Esta carpeta está vacía.</p>
              )}
              {!cargando && items.map(it => {
                const sel = archivo?.itemId === it.id;
                return (
                  <button
                    key={it.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 ${sel ? 'bg-primary/10' : ''} ${!it.esCarpeta && !it.esExcel ? 'opacity-50' : ''}`}
                    disabled={!it.esCarpeta && !it.esExcel}
                    onClick={() => {
                      if (it.esCarpeta) listar(it.id, it.nombre);
                      else if (it.esExcel) setArchivo({ itemId: it.id, nombre: it.nombre, area: it.area });
                    }}
                  >
                    {it.esCarpeta
                      ? <Folder className="size-4 text-amber-500 shrink-0" />
                      : <FileSpreadsheet className={`size-4 shrink-0 ${it.esExcel ? 'text-green-600' : 'text-muted-foreground'}`} />}
                    <span className="flex-1 min-w-0 text-sm truncate" title={it.nombre}>{it.nombre}</span>
                    {it.esCarpeta
                      ? <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      : sel ? <Badge className="shrink-0">Elegido{it.area ? ` · ${it.area}` : ''}</Badge>
                        : it.esExcel ? <Badge variant="outline" className="shrink-0">{it.area || 'Excel'}</Badge> : null}
                  </button>
                );
              })}
            </div>

            {resultado?.error && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 flex items-start gap-2 text-sm">
                <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <span>{resultado.error}</span>
              </div>
            )}

            <DialogFooter className="items-center">
              {archivo && (
                <span className="text-xs text-muted-foreground mr-auto truncate max-w-[260px]" title={archivo.nombre}>
                  {archivo.nombre}{archivo.area ? ` → ${archivo.area}` : ''}
                </span>
              )}
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={importando}>Cancelar</Button>
              <Button onClick={importar} disabled={!archivo || importando}>
                {importando ? <><Loader2 className="size-4 animate-spin" /> Importando…</> : 'Importar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
