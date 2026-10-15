/**
 * Lista compacta de unidades con serie: la usan la pestaña "Equipamiento" del
 * vehículo (Flota) y la pestaña Flota del Proyecto 360. Agrupa por artículo y
 * deja imprimir el acta con lo que se ve.
 */
import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { usePagination } from '@/lib/shared/usePagination';
import { ESTADO_UNIDAD, fechaCorta, type Unidad } from '../../../lib/inventario/unidades';
import { imprimirActaUnidades } from '../../../lib/inventario/unidades-acta';

export function UnidadesCompacta({ unidades, titulo, proyecto, vacio = 'Sin equipamiento registrado por serie.', onIrAUnidades }: {
  unidades: Unidad[]; titulo?: string; proyecto?: string; vacio?: string; onIrAUnidades?: () => void;
}) {
  const porArticulo = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of unidades) m.set(u.articulo, (m.get(u.articulo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [unidades]);
  const pag = usePagination(unidades, 20);

  if (unidades.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center justify-between gap-2">
        <span>{vacio}</span>
        {onIrAUnidades && <Button variant="link" size="sm" onClick={onIrAUnidades}>Ir a Inventario › Unidades</Button>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {porArticulo.map(([a, n]) => <Badge key={a} variant="secondary">{a} × {n}</Badge>)}
        <div className="ml-auto flex gap-2">
          {onIrAUnidades && <Button variant="outline" size="sm" onClick={onIrAUnidades}>Ver en Unidades</Button>}
          <Button variant="outline" size="sm" onClick={() => imprimirActaUnidades(unidades, { tipo: 'inventario', titulo, proyecto })}>
            <Printer className="size-4 mr-1" /> Acta / listado
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Artículo</TableHead>
            <TableHead>N.º de serie</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Ingreso</TableHead>
            <TableHead>Documento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pag.paged.map(u => (
            <TableRow key={u.id}>
              <TableCell className="text-sm">{u.articulo}<div className="text-xs text-muted-foreground">{[u.marca, u.modelo].filter(Boolean).join(' · ')}</div></TableCell>
              <TableCell className="font-mono text-sm">{u.serie ?? <span className="text-muted-foreground italic">sin serie</span>}</TableCell>
              <TableCell><Badge className={`text-xs ${ESTADO_UNIDAD[u.estado]?.clase ?? ''}`}>{ESTADO_UNIDAD[u.estado]?.label ?? u.estado}</Badge></TableCell>
              <TableCell className="text-sm">{u.vehiculo_placa ?? u.vehiculo_codigo ?? '—'}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{fechaCorta(u.fecha_ingreso)}</TableCell>
              <TableCell className="text-sm">{u.documento_salida ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pag.totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">Mostrando {pag.paged.length} de {pag.totalItems} · página {pag.page} de {pag.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!pag.hasPrev} onClick={() => pag.setPage(pag.page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!pag.hasNext} onClick={() => pag.setPage(pag.page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
