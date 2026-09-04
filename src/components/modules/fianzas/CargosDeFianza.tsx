/**
 * Cargos de una fianza — subir, ver y descargar desde el sistema.
 *
 * El archivo vive en Supabase Storage, en el bucket privado `cargos-fianzas`,
 * bajo `<tenant>/<fianza>/`. Nunca se expone una URL pública: para ver o
 * descargar se pide una URL firmada que caduca a los 5 minutos.
 *
 * Los cargos migrados de SharePoint conservan su enlace y se abren allá; los
 * nuevos se guardan aquí.
 */
import { useRef, useState } from 'react';
import { FileText, Upload, Eye, Download, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { useFianzas, type CargoFianza } from '../../../lib/fianzas/fianzas-store';

const MAX_BYTES = 20 * 1024 * 1024;

const peso = (b: number | null) => {
  if (b === null || b === undefined) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export function CargosDeFianza({ fianzaId, entidad }: { fianzaId: string; entidad: string }) {
  const { cargos, subirCargo, urlDeCargo, eliminarCargo } = useFianzas();
  const { can } = usePermissions();
  const puedeSubir = can('fianzas', 'cargos') || can('fianzas', 'crear');
  const puedeEliminar = can('fianzas', 'eliminar');

  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mios = cargos.filter(c => c.fianzaId === fianzaId);

  const elegir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setSubiendo(true);
    let ok = 0;
    for (const archivo of Array.from(archivos)) {
      if (archivo.size > MAX_BYTES) {
        toast.error(`"${archivo.name}" pesa más de 20 MB`);
        continue;
      }
      const err = await subirCargo({ fianzaId, archivo });
      if (err) toast.error(`No se pudo subir "${archivo.name}": ${err}`);
      else ok++;
    }
    setSubiendo(false);
    if (ok) toast.success(`${ok} cargo(s) subido(s)`);
  };

  const abrir = async (c: CargoFianza, descargar: boolean) => {
    const url = await urlDeCargo(c, descargar);
    if (!url) { toast.error('No se pudo abrir el archivo'); return; }
    window.open(url, '_blank', 'noopener');
  };

  const borrar = async (c: CargoFianza) => {
    const err = await eliminarCargo(c);
    if (err) { toast.error('No se pudo eliminar: ' + err); return; }
    toast.success('Cargo eliminado');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="size-4" /> Cargos ({mios.length})
        </CardTitle>
        {puedeSubir && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { void elegir(e.target.files); e.target.value = ''; }}
            />
            <Button size="sm" variant="outline" disabled={subiendo}
              onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" /> {subiendo ? 'Subiendo…' : 'Subir cargo'}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {mios.length === 0 ? (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Sin cargos registrados.</p>
            <p className="text-xs">
              PDF o imagen, hasta 20 MB. Los históricos siguen en SharePoint, en
              <span className="font-mono"> Administración / Fianzas / Cargos Fianzas / {entidad}</span>.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {mios.map(c => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.subidoPor ? `${c.subidoPor} · ` : ''}{fecha(c.subidoEn)}
                    {c.tamanoBytes ? ` · ${peso(c.tamanoBytes)}` : ''}
                    {!c.storagePath && c.sharepointUrl ? ' · en SharePoint' : ''}
                  </div>
                </div>
                {c.storagePath ? (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" aria-label="Ver" onClick={() => abrir(c, false)}>
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Descargar" onClick={() => abrir(c, true)}>
                      <Download className="size-4" />
                    </Button>
                    {puedeEliminar && (
                      <Button variant="ghost" size="sm" aria-label="Eliminar"
                        className="text-destructive" onClick={() => borrar(c)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ) : c.sharepointUrl ? (
                  <a href={c.sharepointUrl} target="_blank" rel="noreferrer"
                    className="text-xs underline inline-flex items-center gap-1">
                    abrir <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <Badge variant="secondary" className="text-xs">sin archivo</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
