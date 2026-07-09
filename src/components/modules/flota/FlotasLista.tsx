/**
 * Flota → Flotas (rediseño 2026-07)
 * Lista de flotas por proyecto con su contrato y consumo agregado.
 */
import { Layers, Truck, Bike, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { PageNav } from '../../shared/PageNav';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useFlotas, fmtMoneda } from '../../../lib/flota/flotas-store';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';

interface Props { onNavigate: (route: string) => void; }

export function FlotasLista({ onNavigate }: Props) {
  const { flotas, loading, consumoPorFlota } = useFlotas();
  const { proyectos } = useProyectos();

  const nombreProyecto = (id: string) =>
    (proyectos as any[]).find(p => p._dbId === id)?.nombre ?? '—';

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex items-center gap-3">
        <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
          <Layers className="size-6 text-black dark:text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Flotas</h2>
          <p className="text-muted-foreground mt-1">
            Grupos de vehículos por proyecto con su contrato de mantenimiento
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Flota</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Mantos (ejec./contr.)</TableHead>
                <TableHead className="text-right">Gastado</TableHead>
                <TableHead className="text-right">Saldo provisión</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : flotas.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay flotas registradas</TableCell></TableRow>
              ) : (
                flotas.map(f => {
                  const c = consumoPorFlota(f.id);
                  return (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer hover:!bg-slate-100 dark:hover:!bg-accent/50"
                      onClick={() => onNavigate(`/flota/flotas/${f.codigo}`)}
                    >
                      <TableCell className="font-mono text-sm">{f.codigo}</TableCell>
                      <TableCell className="font-medium">{f.nombre}</TableCell>
                      <TableCell className="text-sm">{nombreProyecto(f.proyectoId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {f.tipo === 'moto' ? <Bike className="size-3 mr-1" /> : <Truck className="size-3 mr-1" />}
                          {f.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.unidades}</TableCell>
                      <TableCell className="text-right">
                        {c.ejecutados.toLocaleString()} / {c.contratados.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{fmtMoneda(c.gastado, c.moneda)}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-500 font-medium">
                        {fmtMoneda(c.saldo, c.moneda)}
                      </TableCell>
                      <TableCell><ArrowRight className="size-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
