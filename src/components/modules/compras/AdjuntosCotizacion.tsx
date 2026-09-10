/**
 * El documento del proveedor, adjunto a su cotización.
 *
 * Se abre en una pestaña nueva con una URL firmada de cinco minutos: el bucket
 * es privado y no queda ningún enlace permanente dando vueltas.
 */
import { useRef, useState } from 'react';
import { Paperclip, Upload, Download, Trash2, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import {
  useArchivosCotizacion, tamanoLegible, TIPOS_ACEPTADOS,
  type ArchivoCotizacion,
} from '../../../lib/compras/cotizacion-archivos';

interface Props {
  /** UUID interno de la cotización, no el número COT-NNNN. */
  cotizacionDbId: string | undefined;
}

const fecha = (s: string) =>
  new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function AdjuntosCotizacion({ cotizacionDbId }: Props) {
  const { can } = usePermissions();
  const { archivos, cargando, subir, urlDe, eliminar } = useArchivosCotizacion(cotizacionDbId);
  const [subiendo, setSubiendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const puedeAdjuntar = can('compras', 'crear') || can('compras', 'editar');
  const puedeBorrar = can('compras', 'eliminar') || can('compras', 'editar');

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidos = Array.from(e.target.files ?? []);
    if (elegidos.length === 0) return;
    setSubiendo(true);
    let subidos = 0;
    for (const f of elegidos) {
      const error = await subir(f);
      if (error) toast.error(`No se pudo adjuntar "${f.name}": ${error}`);
      else subidos++;
    }
    if (subidos > 0) {
      toast.success(subidos === 1 ? 'Documento adjuntado' : `${subidos} documentos adjuntados`);
    }
    setSubiendo(false);
    // Permite volver a elegir el mismo archivo si hizo falta repetir.
    if (input.current) input.current.value = '';
  };

  const abrir = async (a: ArchivoCotizacion, descargar: boolean) => {
    const url = await urlDe(a, descargar);
    if (!url) { toast.error('No se pudo abrir el documento'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const borrar = async (a: ArchivoCotizacion) => {
    if (!window.confirm(`¿Quitar "${a.nombre}" de esta cotización?`)) return;
    const error = await eliminar(a);
    if (error) toast.error('No se pudo quitar: ' + error);
    else toast.success('Documento quitado');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-5" />
          Documento de la Cotización ({archivos.length})
        </CardTitle>
        {puedeAdjuntar && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={TIPOS_ACEPTADOS}
              className="hidden"
              onChange={alElegir}
            />
            <Button size="sm" onClick={() => input.current?.click()} disabled={subiendo}>
              {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {subiendo ? 'Subiendo…' : 'Adjuntar'}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : archivos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Sin documento adjunto</p>
            <p className="text-xs mt-1">
              {puedeAdjuntar
                ? 'Adjunta el PDF que envió el proveedor. También vale una foto o el Excel.'
                : 'Nadie ha adjuntado todavía la cotización del proveedor.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {archivos.map(a => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <button
                    className="text-sm font-medium truncate hover:underline text-left w-full"
                    onClick={() => abrir(a, false)}
                    title={a.nombre}
                  >
                    {a.nombre}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {[tamanoLegible(a.tamanoBytes), fecha(a.subidoEn)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" title="Descargar" onClick={() => abrir(a, true)}>
                  <Download className="size-4" />
                </Button>
                {puedeBorrar && (
                  <Button
                    variant="ghost" size="icon" title="Quitar"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => borrar(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
