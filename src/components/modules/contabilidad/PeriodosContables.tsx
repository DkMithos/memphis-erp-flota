/**
 * Memphis ERP — Períodos Contables
 * Gestión de apertura, cierre y reapertura de períodos fiscales.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Plus, Lock, Unlock, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { usePeriodosStore } from '../../../lib/contabilidad/periodos-store';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const ESTADO_COLORS: Record<string, string> = {
  abierto: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cerrado: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  ajuste:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export function PeriodosContables() {
  const { periodos, loading, periodoActual, crearPeriodo, cerrarPeriodo, reabrirPeriodo } = usePeriodosStore();
  const confirmAction = useConfirmAction();
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 });
  const [guardando, setGuardando] = useState(false);

  async function handleCrear() {
    setGuardando(true);
    try { await crearPeriodo(nuevo); setModalNuevo(false); }
    catch (e: any) { toast.error(e.message); }
    finally { setGuardando(false); }
  }

  async function handleCerrar(id: string) {
    const ok = await confirmAction({ title: 'Confirmar cierre', description: '¿Cerrar este período? Ya no se podrán registrar asientos.', confirmLabel: 'Cerrar' });
    if (!ok) return;
    const r = await cerrarPeriodo(id);
    if (!r.ok) toast.error(r.error);
  }

  async function handleReabrir(id: string) {
    const ok = await confirmAction({ title: 'Confirmar reapertura', description: '¿Reabrir este período?', confirmLabel: 'Reabrir' });
    if (!ok) return;
    const r = await reabrirPeriodo(id);
    if (!r.ok) toast.error(r.error);
  }

  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 - i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Calendar className="size-5 text-primary" />Períodos Contables</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{periodos.length} período(s) registrado(s)</p>
        </div>
        <Button size="sm" onClick={() => setModalNuevo(true)} className="gap-1.5">
          <Plus className="size-3.5" /> Nuevo Período
        </Button>
      </div>

      {periodoActual && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Período activo: {periodoActual.nombre}</p>
              <p className="text-xs text-muted-foreground">Abierto desde {new Date(periodoActual.creadoEn).toLocaleDateString('es-PE')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!periodoActual && periodos.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0" />
            <p className="text-sm font-medium">No hay período abierto. Los asientos no pueden registrarse.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Historial de Períodos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : periodos.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Calendar className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin períodos. Crea el primero para empezar.</p>
              <Button size="sm" onClick={() => setModalNuevo(true)} className="gap-1.5">
                <Plus className="size-3.5" /> Crear período
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {periodos.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.estado === 'cerrado' && p.fechaCierre
                        ? `Cerrado el ${new Date(p.fechaCierre).toLocaleDateString('es-PE')}`
                        : `Creado ${new Date(p.creadoEn).toLocaleDateString('es-PE')}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${ESTADO_COLORS[p.estado]}`}>
                    {p.estado}
                  </Badge>
                  <div className="flex gap-1">
                    {p.estado === 'abierto' && (
                      <Button variant="outline" size="sm" onClick={() => handleCerrar(p.id)} className="gap-1 text-xs h-7">
                        <Lock className="size-3" /> Cerrar
                      </Button>
                    )}
                    {p.estado === 'cerrado' && (
                      <Button variant="outline" size="sm" onClick={() => handleReabrir(p.id)} className="gap-1 text-xs h-7">
                        <Unlock className="size-3" /> Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalNuevo} onOpenChange={setModalNuevo}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo Período Contable</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Año</Label>
              <Select value={String(nuevo.anio)} onValueChange={v => setNuevo(p => ({...p, anio: Number(v)}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{anios.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mes</Label>
              <Select value={String(nuevo.mes)} onValueChange={v => setNuevo(p => ({...p, mes: Number(v)}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m,i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalNuevo(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCrear} disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear Período'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
