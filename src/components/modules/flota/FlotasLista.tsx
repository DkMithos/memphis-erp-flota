/**
 * Flota → Flotas (rediseño 2026-07)
 * Lista de flotas por proyecto con su contrato y consumo agregado.
 */
import { useState } from 'react';
import { Layers, Truck, Bike, ArrowRight, Plus, Building2 } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { PageNav } from '../../shared/PageNav';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useFlotas, fmtMoneda } from '../../../lib/flota/flotas-store';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import { toast } from 'sonner';

interface Props { onNavigate: (route: string) => void; }

const TIPOS_FLOTA = ['moto', 'camioneta', 'ambulancia', 'bus', 'auto', 'van', 'otro'];

export function FlotasLista({ onNavigate }: Props) {
  const { flotas, loading, consumoPorFlota, crearFlota } = useFlotas();
  const { proyectos } = useProyectos();

  const nombreProyecto = (id: string | null) =>
    id ? ((proyectos as any[]).find(p => p._dbId === id)?.nombre ?? '—') : 'Interna (Memphis)';

  // ── Diálogo nueva flota ──
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('camioneta');
  const [interna, setInterna] = useState(false);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const limpiar = () => {
    setCodigo(''); setNombre(''); setTipo('camioneta');
    setInterna(false); setProyectoId(null); setDescripcion('');
  };

  const guardar = async () => {
    if (!interna && !proyectoId) { toast.error('Elige el proyecto o marca que es una flota interna'); return; }
    setGuardando(true);
    const r = await crearFlota({
      codigo, nombre, tipo,
      proyectoId: interna ? null : proyectoId,
      descripcion,
    });
    setGuardando(false);
    if (!r.exito) { toast.error(r.error ?? 'No se pudo crear la flota'); return; }
    toast.success(`Flota ${r.codigo} creada`);
    setOpen(false); limpiar();
    if (r.codigo) onNavigate(`/flota/flotas/${r.codigo}`);
  };

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Layers className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Flotas</h2>
            <p className="text-muted-foreground mt-1">
              Grupos de vehículos por proyecto (o internos de Memphis) con su contrato
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nueva Flota
        </Button>
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

      {/* Nueva flota */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) limpiar(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva flota</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Código <span className="text-red-500">*</span></Label>
                <Input placeholder="FL-MEM-CAM" value={codigo}
                  onChange={e => setCodigo(e.target.value.toUpperCase())} />
                <p className="text-xs text-muted-foreground mt-1">Convención: FL-{'{'}REGIÓN{'}'}-{'{'}TIPO{'}'}</p>
              </div>
              <div>
                <Label className="mb-1.5 block">Tipo de vehículo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_FLOTA.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Nombre <span className="text-red-500">*</span></Label>
              <Input placeholder="Vehículos propios - Memphis Maquinarias"
                value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>

            {/* Interna vs de proyecto */}
            <div className="rounded-md border p-3 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={interna}
                  onChange={e => { setInterna(e.target.checked); if (e.target.checked) setProyectoId(null); }} />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building2 className="size-4" /> Flota interna de Memphis
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Vehículos propios de la empresa: no pertenecen a ningún proyecto de cliente
                    ni consumen provisión de contrato.
                  </span>
                </span>
              </label>

              {!interna && (
                <div>
                  <Label className="mb-1.5 block">Proyecto <span className="text-red-500">*</span></Label>
                  <ProyectoSelector value={proyectoId} onChange={setProyectoId} nullable={false} />
                </div>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block">Descripción (opcional)</Label>
              <Textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="Detalle de la flota…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear flota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
