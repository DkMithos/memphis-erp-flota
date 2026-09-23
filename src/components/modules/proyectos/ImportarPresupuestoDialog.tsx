/**
 * IMPORTAR PRESUPUESTO — selector de archivo de SharePoint para Compras.
 *
 * Antes había que averiguar a mano el drive_id/item_id del Excel; ahora Compras
 * elige el proyecto, navega el árbol de COMPRAS en SharePoint (el mismo que ven
 * en Teams), pincha la plantilla .xlsx y la importa. La navegación y la carga
 * las sirve la Edge Function `presupuesto-import`, limitada a la carpeta raíz
 * dada de alta con uso='presupuesto' (no se puede pedir un drive arbitrario).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet, Folder, ChevronRight, Home, Loader2, AlertTriangle,
  CheckCircle2, Upload, FileUp,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { supabase } from '../../../lib/supabase/client';

interface ProyectoOpt { id: string; codigo: string; nombre: string; }

interface ItemSP {
  id: string;
  nombre: string;
  esCarpeta: boolean;
  esExcel: boolean;
  elementos: number | null;
  tamano: number | null;
  modificado: string | null;
}
interface Miga { id: string | null; nombre: string; }

interface Resultado {
  ok: boolean;
  proyecto?: string;
  proyecto_id?: string;
  proyecto_creado?: boolean;
  formato?: 'plantilla-v1' | 'pro-for-004';
  hoja?: string;
  lineas?: number;
  hojas?: number;
  total_presupuestado_sin_igv?: number;
  total_presupuestado_con_igv?: number;
  cabecera?: { proyecto?: string; cui?: string; plazoDias?: number | null };
  error?: string;
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  /** Proyecto sugerido al abrir (el que está viendo el usuario). */
  proyectoIdInicial?: string | null;
  /** Se llama tras una importación correcta, con el proyecto_id cargado. */
  onImportado: (proyectoId: string) => void;
}

export function ImportarPresupuestoDialog({ proyectoIdInicial, onImportado }: Props) {
  const [open, setOpen] = useState(false);

  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [proyectoId, setProyectoId] = useState<string | null>(proyectoIdInicial ?? null);
  // "Crear proyecto desde el presupuesto": un proyecto en idea nace aquí, con el
  // código que le da Operaciones y el total del Excel como presupuesto.
  const [modo, setModo] = useState<'existente' | 'nuevo'>('existente');
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');

  const [items, setItems] = useState<ItemSP[]>([]);
  const [migas, setMigas] = useState<Miga[]>([]);
  const [driveId, setDriveId] = useState<string>('');
  const [carpetaNombre, setCarpetaNombre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archivo, setArchivo] = useState<{ itemId: string; nombre: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Proyectos (todos: se puede importar a uno que aún no tiene presupuesto).
  useEffect(() => {
    if (!open) return;
    setProyectoId(proyectoIdInicial ?? null);
    (async () => {
      const { data } = await supabase
        .from('proyectos').select('id, codigo, nombre').order('codigo');
      setProyectos((data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string, codigo: (p.codigo as string) ?? '', nombre: (p.nombre as string) ?? '',
      })));
    })();
  }, [open, proyectoIdInicial]);

  const listar = useCallback(async (itemId: string | null, nombre?: string) => {
    setCargando(true);
    setError(null);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('presupuesto-import', {
        body: { accion: 'listar', item_id: itemId ?? undefined },
      });
      if (errFn) throw errFn;
      const r = data as {
        ok?: boolean; error?: string; items?: ItemSP[];
        carpeta?: { nombre: string; drive_id: string };
      };
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

  // Al abrir, cargar la raíz y limpiar lo anterior.
  useEffect(() => {
    if (!open) return;
    setArchivo(null); setResultado(null); setMigas([]);
    void listar(null);
  }, [open, listar]);

  const esNuevo = modo === 'nuevo';
  const destinoListo = esNuevo ? nuevoCodigo.trim().length > 0 && nuevoNombre.trim().length > 0 : !!proyectoId;

  const importar = async () => {
    if (!destinoListo || !archivo || !driveId) return;
    setImportando(true);
    setResultado(null);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('presupuesto-import', {
        body: {
          accion: 'importar', drive_id: driveId, item_id: archivo.itemId,
          ...(esNuevo
            ? { proyecto_nuevo: { codigo: nuevoCodigo.trim().toUpperCase(), nombre: nuevoNombre.trim() } }
            : { proyecto_id: proyectoId }),
        },
      });
      if (errFn) throw errFn;
      const r = data as Resultado;
      if (!r?.ok) { setResultado({ ok: false, error: r?.error ?? 'No se pudo importar' }); return; }
      setResultado(r);
      const idCargado = r.proyecto_id ?? proyectoId;
      if (idCargado) onImportado(idCargado);
    } catch (e) {
      setResultado({ ok: false, error: e instanceof Error ? e.message : 'No se pudo importar' });
    } finally {
      setImportando(false);
    }
  };

  const carpetaActual = migas.length ? migas[migas.length - 1] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" /> Importar presupuesto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar presupuesto desde Excel</DialogTitle>
        </DialogHeader>

        {/* Éxito */}
        {resultado?.ok ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  {resultado.proyecto_creado ? `Proyecto ${resultado.proyecto} creado con su presupuesto` : `Presupuesto cargado para ${resultado.proyecto}`}
                </p>
                <p className="text-muted-foreground mt-1">
                  {resultado.lineas} líneas ({resultado.hojas} partidas de gasto) ·
                  presupuestado {soles(resultado.total_presupuestado_con_igv ?? 0)} con IGV
                  {resultado.cabecera?.cui ? ` · CUI ${resultado.cabecera.cui}` : ''}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {resultado.formato === 'pro-for-004' ? 'Formato PRO-FOR-004 de Operaciones' : 'Plantilla presupuestal v1'}
                  {resultado.hoja ? ` · hoja «${resultado.hoja}»` : ''}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Proyecto destino */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-sm font-medium">1. ¿A qué proyecto?</p>
                <div className="flex rounded-md border text-xs overflow-hidden">
                  <button type="button" className={`px-2.5 py-1 ${!esNuevo ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`} onClick={() => setModo('existente')}>Existente</button>
                  <button type="button" className={`px-2.5 py-1 ${esNuevo ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`} onClick={() => setModo('nuevo')}>Proyecto nuevo</button>
                </div>
              </div>
              {esNuevo ? (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                  <Input value={nuevoCodigo} onChange={e => setNuevoCodigo(e.target.value)} placeholder="Código (ej. 08AYAPNP26)" className="font-mono uppercase" />
                  <Input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre del proyecto" />
                </div>
              ) : (
                <SearchableSelect
                  value={proyectoId}
                  onChange={setProyectoId}
                  options={proyectos.map(p => ({ value: p.id, label: `${p.codigo} — ${p.nombre}`, keywords: `${p.codigo} ${p.nombre}` }))}
                  placeholder="Elegir proyecto destino"
                  emptyText="Sin proyectos"
                  nullable={false}
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {esNuevo
                  ? 'El proyecto nace en idea con el CUI y el total con IGV del Excel como presupuesto; después Operaciones lo completa.'
                  : 'Vale la plantilla v1 o el PRO-FOR-004 de Operaciones (se reconoce solo). Si el proyecto ya tenía presupuesto, las partidas se actualizan por su código y las que ya no están quedan retiradas.'}
              </p>
            </div>

            {/* 2. Elegir archivo */}
            <div>
              <p className="text-sm font-medium mb-1.5">2. Elige la plantilla (.xlsx)</p>

              {/* Migas */}
              <div className="flex items-center gap-1 flex-wrap text-sm mb-2">
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/50 disabled:opacity-60"
                  onClick={() => listar(null)}
                  disabled={cargando || migas.length === 0}
                >
                  <Home className="size-3.5" /> {carpetaNombre || 'Inicio'}
                </button>
                {migas.map((m, i) => (
                  <span key={m.id ?? i} className="flex items-center gap-1">
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    <button
                      className="px-2 py-1 rounded hover:bg-accent/50 disabled:opacity-60 max-w-[180px] truncate"
                      onClick={() => listar(m.id, m.nombre)}
                      disabled={cargando || i === migas.length - 1}
                      title={m.nombre}
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
                  const seleccionado = archivo?.itemId === it.id;
                  return (
                    <button
                      key={it.id}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 ${seleccionado ? 'bg-primary/10' : ''} ${!it.esCarpeta && !it.esExcel ? 'opacity-50' : ''}`}
                      disabled={!it.esCarpeta && !it.esExcel}
                      onClick={() => {
                        if (it.esCarpeta) listar(it.id, it.nombre);
                        else if (it.esExcel) setArchivo({ itemId: it.id, nombre: it.nombre });
                      }}
                    >
                      {it.esCarpeta
                        ? <Folder className="size-4 text-amber-500 shrink-0" />
                        : <FileSpreadsheet className={`size-4 shrink-0 ${it.esExcel ? 'text-green-600' : 'text-muted-foreground'}`} />}
                      <span className="flex-1 min-w-0 text-sm truncate" title={it.nombre}>{it.nombre}</span>
                      {it.esCarpeta
                        ? <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        : seleccionado
                          ? <Badge className="shrink-0">Elegido</Badge>
                          : it.esExcel ? <Badge variant="outline" className="shrink-0">Excel</Badge> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {resultado?.error && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 flex items-start gap-2 text-sm">
                <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <span>{resultado.error}</span>
              </div>
            )}

            <DialogFooter className="items-center">
              {archivo && (
                <span className="text-xs text-muted-foreground mr-auto truncate max-w-[240px]" title={archivo.nombre}>
                  <FileUp className="size-3.5 inline mr-1" />{archivo.nombre}
                </span>
              )}
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={importando}>Cancelar</Button>
              <Button onClick={importar} disabled={!destinoListo || !archivo || importando}>
                {importando ? <><Loader2 className="size-4 animate-spin" /> Importando…</> : 'Importar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
