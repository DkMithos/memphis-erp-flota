/**
 * Catálogo de cursos: nombre, descripción y temario (tema + horas). Las horas
 * totales las suma la base. Al programar una capacitación se copia el temario
 * del curso y desde ahí es editable por sesión.
 */
import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { PageNav } from '../../shared/PageNav';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { useConfirmAction } from '../../shared/ConfirmDialogProvider';
import { dbCursos } from '../../../lib/capacitaciones/db';
import { horasCortas, totalHoras } from '../../../lib/capacitaciones/datos';
import type { Curso, TemaTemario } from '../../../lib/capacitaciones/types';

interface Props { onNavigate: (r: string) => void }

export function TemarioEditor({ value, onChange }: { value: TemaTemario[]; onChange: (t: TemaTemario[]) => void }) {
  const set = (i: number, patch: Partial<TemaTemario>) => onChange(value.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="space-y-2">
      {value.map((t, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={t.tema} placeholder={`Tema ${i + 1}`} onChange={e => set(i, { tema: e.target.value })} className="flex-1" />
          <Input type="number" min={0} step={0.5} value={t.horas} onChange={e => set(i, { horas: Number(e.target.value) })} className="w-24" />
          <span className="text-xs text-muted-foreground w-10">horas</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Quitar tema">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { tema: '', horas: 0 }])}>
          <Plus className="size-4" /> Agregar tema
        </Button>
        <span className="text-sm text-muted-foreground">Total: <b>{horasCortas(totalHoras(value))}</b></span>
      </div>
    </div>
  );
}

const VACIO = (): Partial<Curso> => ({ codigo: '', nombre: '', descripcion: '', temario: [{ tema: '', horas: 0 }], activo: true });

export function CursosCatalogo({ onNavigate }: Props) {
  const { tenantId, profile } = useAuth();
  const { can } = usePermissions();
  const confirmar = useConfirmAction();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Partial<Curso> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const puedeEditar = can('proyectos', 'editar') || can('proyectos', 'crear');

  const cargar = async () => {
    if (!tenantId) return;
    setCargando(true);
    try { setCursos(await dbCursos.listar(tenantId)); } catch (e: any) { toast.error(e.message); } finally { setCargando(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [tenantId]);

  const guardar = async () => {
    if (!editando || !tenantId) return;
    if (!editando.nombre?.trim()) { toast.error('Ponga el nombre del curso'); return; }
    const temario = (editando.temario ?? []).filter(t => t.tema.trim());
    setGuardando(true);
    try {
      await dbCursos.guardar({
        ...editando, tenant_id: tenantId, nombre: editando.nombre.trim(), temario,
        codigo: editando.codigo?.trim() || null, descripcion: editando.descripcion?.trim() || null,
        creado_por: editando.id ? undefined : ((profile as any)?.nombre ?? null),
      } as any);
      toast.success('Curso guardado');
      setEditando(null);
      cargar();
    } catch (e: any) { toast.error(e.message); } finally { setGuardando(false); }
  };

  const eliminar = async (c: Curso) => {
    const ok = await confirmar({
      title: 'Eliminar curso',
      description: `¿Eliminar "${c.nombre}"? Las capacitaciones ya programadas conservan su propio temario.`,
      confirmLabel: 'Eliminar', variant: 'destructive',
    });
    if (!ok) return;
    try { await dbCursos.eliminar(c.id); toast.success('Curso eliminado'); cargar(); }
    catch (e: any) { toast.error(String(e.message).includes('foreign key') ? 'El curso está en uso: desactívelo en lugar de eliminarlo' : e.message); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageNav onBack={() => onNavigate('/proyectos/capacitaciones')} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><BookOpen className="size-6 text-primary" /> Cursos de capacitación</h1>
          <p className="text-sm text-muted-foreground">El temario y las horas que luego salen impresos en cada certificado.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate('/proyectos/capacitaciones')}><ArrowLeft className="size-4" /> Capacitaciones</Button>
          {puedeEditar && <Button onClick={() => setEditando(VACIO())}><Plus className="size-4" /> Nuevo curso</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Temario</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
              {!cargando && cursos.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aún no hay cursos. Cree el primero.</TableCell></TableRow>
              )}
              {cursos.map(c => (
                <TableRow key={c.id} className={!c.activo ? 'opacity-60' : ''}>
                  <TableCell className="font-mono text-xs">{c.codigo || '—'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.nombre}</div>
                    {c.descripcion && <div className="text-xs text-muted-foreground line-clamp-2">{c.descripcion}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <ul className="list-disc ml-4 space-y-0.5">
                      {c.temario.map((t, i) => <li key={i}>{t.tema} <span className="text-muted-foreground">({horasCortas(t.horas)})</span></li>)}
                    </ul>
                  </TableCell>
                  <TableCell className="text-right font-medium">{horasCortas(c.horas_total)}</TableCell>
                  <TableCell><Badge variant={c.activo ? 'default' : 'secondary'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell>
                    {puedeEditar && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditando({ ...c })} aria-label="Editar"><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => eliminar(c)} aria-label="Eliminar"><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={o => !o && setEditando(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editando?.id ? 'Editar curso' : 'Nuevo curso'}</DialogTitle></DialogHeader>
          {editando && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>Código</Label>
                  <Input value={editando.codigo ?? ''} onChange={e => setEditando({ ...editando, codigo: e.target.value })} placeholder="CUR-002" />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <Label>Nombre del curso *</Label>
                  <Input value={editando.nombre ?? ''} onChange={e => setEditando({ ...editando, nombre: e.target.value })} placeholder="Destrezas de Conducción y Soporte Vital Básico (BLS)" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Textarea rows={2} value={editando.descripcion ?? ''} onChange={e => setEditando({ ...editando, descripcion: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Temario</Label>
                <TemarioEditor value={editando.temario ?? []} onChange={temario => setEditando({ ...editando, temario })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editando.activo ?? true} onCheckedChange={v => setEditando({ ...editando, activo: v })} id="curso-activo" />
                <Label htmlFor="curso-activo">Curso activo (disponible al programar capacitaciones)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
