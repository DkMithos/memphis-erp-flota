/**
 * Tarifas de viáticos (la política, editable por Administración). Son los topes
 * que se SUGIEREN al solicitar y los que marcan "excede" en la rendición; no bloquean.
 */
import { useEffect, useState } from 'react';
import { Plus, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { PageNav } from '../../shared/PageNav';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { cargarTarifas, fechaCorta, guardarTarifa, soles, type Tarifa } from '../../../lib/viajes/viajes';

const CONCEPTOS: Record<string, string> = { alimentacion: 'Alimentación (por día)', hospedaje: 'Hospedaje (por noche)', adelanto_sin_hospedaje: 'Adelanto por día sin hospedaje', adelanto_con_hospedaje: 'Adelanto por día con hospedaje', movilidad: 'Movilidad y otros', otro: 'Otro' };

export function ViaticosTarifas({ onNavigate }: { onNavigate?: (r: string) => void }) {
  const { tenantId } = useAuth();
  const { can } = usePermissions();
  const puede = can('viajes', 'tarifas');
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Tarifa> | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => cargarTarifas().then(setTarifas).catch(e => toast.error(String(e))).finally(() => setLoading(false));
  useEffect(() => { void cargar(); }, []);

  const guardar = async () => {
    if (!edit) return;
    if (!edit.descripcion?.trim() || edit.monto === undefined) { toast.error('Descripción y monto son obligatorios'); return; }
    setGuardando(true);
    try {
      await guardarTarifa({ ...edit, tenant_id: tenantId ?? undefined, moneda: 'PEN', vigente_desde: edit.vigente_desde ?? new Date().toISOString().slice(0, 10), activo: edit.activo ?? true, requiere_sustento: edit.requiere_sustento ?? false, unidad: edit.unidad ?? 'dia' });
      toast.success('Tarifa guardada'); setEdit(null); await cargar();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };
  void onNavigate;

  return (
    <div className="space-y-4">
      <PageNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Settings2 className="size-6" /> Tarifas de viáticos</h1>
          <p className="text-sm text-muted-foreground">Política de pasajes y viáticos v01 (05/01/2026). Son topes de referencia: el viaje puede pedir más con justificación, y la aprobación de jefatura o Gerencia convalida el exceso. Para cambiar un monto, crea una tarifa nueva con su fecha de vigencia y cierra la anterior.</p></div>
        {puede && <Button onClick={() => setEdit({ concepto: 'otro', unidad: 'dia', activo: true, requiere_sustento: false, vigente_desde: new Date().toISOString().slice(0, 10) })}><Plus className="size-4 mr-1" /> Nueva tarifa</Button>}
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Unidad</TableHead><TableHead>Sustento</TableHead><TableHead>Vigencia</TableHead><TableHead>Estado</TableHead>{puede && <TableHead></TableHead>}</TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground"><Loader2 className="inline size-4 animate-spin mr-2" />Cargando…</TableCell></TableRow>}
            {tarifas.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{CONCEPTOS[t.concepto] ?? t.concepto}</TableCell>
                <TableCell className="text-sm">{t.descripcion}{t.notas ? <div className="text-xs text-muted-foreground">{t.notas}</div> : null}</TableCell>
                <TableCell className="text-right text-sm">{soles(t.monto)}</TableCell>
                <TableCell className="text-sm">{t.unidad}</TableCell>
                <TableCell className="text-sm">{t.requiere_sustento ? 'Con comprobante' : 'Sin comprobante'}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{fechaCorta(t.vigente_desde)}{t.vigente_hasta ? ` → ${fechaCorta(t.vigente_hasta)}` : ''}</TableCell>
                <TableCell><Badge variant={t.activo ? 'default' : 'secondary'} className="text-xs">{t.activo ? 'activa' : 'inactiva'}</Badge></TableCell>
                {puede && <TableCell><Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Editar</Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!edit} onOpenChange={(o: boolean) => !o && !guardando && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? 'Editar tarifa' : 'Nueva tarifa'}</DialogTitle><DialogDescription>El monto aplica desde la fecha de vigencia a los viajes nuevos.</DialogDescription></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Concepto</Label>
                <Select value={edit.concepto ?? 'otro'} onValueChange={(v: string) => setEdit(e => ({ ...e, concepto: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONCEPTOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div className="col-span-2"><Label>Descripción</Label><Input value={edit.descripcion ?? ''} onChange={e => setEdit(x => ({ ...x, descripcion: e.target.value }))} /></div>
              <div><Label>Monto S/</Label><Input type="number" step="0.01" value={edit.monto ?? ''} onChange={e => setEdit(x => ({ ...x, monto: Number(e.target.value) }))} /></div>
              <div><Label>Unidad</Label><Select value={edit.unidad ?? 'dia'} onValueChange={(v: string) => setEdit(x => ({ ...x, unidad: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dia">Por día</SelectItem><SelectItem value="noche">Por noche</SelectItem><SelectItem value="viaje">Por viaje</SelectItem></SelectContent></Select></div>
              <div><Label>Vigente desde</Label><Input type="date" value={edit.vigente_desde ?? ''} onChange={e => setEdit(x => ({ ...x, vigente_desde: e.target.value }))} /></div>
              <div><Label>Vigente hasta</Label><Input type="date" value={edit.vigente_hasta ?? ''} onChange={e => setEdit(x => ({ ...x, vigente_hasta: e.target.value || null }))} /></div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!edit.requiere_sustento} onCheckedChange={(v: boolean | 'indeterminate') => setEdit(x => ({ ...x, requiere_sustento: v === true }))} /> Requiere comprobante</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.activo ?? true} onCheckedChange={(v: boolean | 'indeterminate') => setEdit(x => ({ ...x, activo: v === true }))} /> Activa</label>
              <div className="col-span-2"><Label>Notas</Label><Input value={edit.notas ?? ''} onChange={e => setEdit(x => ({ ...x, notas: e.target.value }))} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)} disabled={guardando}>Cancelar</Button><Button onClick={guardar} disabled={guardando}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
