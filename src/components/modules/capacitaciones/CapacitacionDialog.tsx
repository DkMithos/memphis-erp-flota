/**
 * Alta / edición de una capacitación. Elegir el curso copia su temario; desde
 * ahí se puede ajustar por sesión sin tocar el catálogo. La plantilla se
 * sugiere por proyecto + curso y se puede cambiar.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import { useAuth } from '../../../auth/AuthProvider';
import { dbCapacitaciones } from '../../../lib/capacitaciones/db';
import { sugerirPlantilla } from '../../../lib/capacitaciones/datos';
import type { Capacitacion, Curso, Plantilla, TemaTemario, EstadoCapacitacion } from '../../../lib/capacitaciones/types';
import { ESTADO_CAPACITACION } from '../../../lib/capacitaciones/types';
import { TemarioEditor } from './CursosCatalogo';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inicial?: Capacitacion | null;
  cursos: Curso[];
  plantillas: Plantilla[];
  proyectoFijo?: string | null;
  onGuardado: (c: Capacitacion) => void;
}

interface Form {
  proyecto_id: string | null;
  curso_id: string | null;
  plantilla_id: string | null;
  titulo: string;
  descripcion: string;
  temario: TemaTemario[];
  fecha_inicio: string;
  fecha_fin: string;
  lugar: string;
  ciudad: string;
  instructor_nombre: string;
  instructor_cargo: string;
  entidad_beneficiaria: string;
  estado: EstadoCapacitacion;
  observaciones: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);

function desde(c?: Capacitacion | null, proyectoFijo?: string | null): Form {
  return {
    proyecto_id: c?.proyecto_id ?? proyectoFijo ?? null,
    curso_id: c?.curso_id ?? null,
    plantilla_id: c?.plantilla_id ?? null,
    titulo: c?.titulo ?? '',
    descripcion: c?.descripcion ?? '',
    temario: c?.temario?.length ? c.temario : [],
    fecha_inicio: c?.fecha_inicio ?? hoy(),
    fecha_fin: c?.fecha_fin ?? '',
    lugar: c?.lugar ?? '',
    ciudad: c?.ciudad ?? '',
    instructor_nombre: c?.instructor_nombre ?? '',
    instructor_cargo: c?.instructor_cargo ?? '',
    entidad_beneficiaria: c?.entidad_beneficiaria ?? '',
    estado: c?.estado ?? 'programada',
    observaciones: c?.observaciones ?? '',
  };
}

export function CapacitacionDialog({ open, onOpenChange, inicial, cursos, plantillas, proyectoFijo, onGuardado }: Props) {
  const { tenantId, profile } = useAuth();
  const { proyectos } = useProyectos();
  const [f, setF] = useState<Form>(() => desde(inicial, proyectoFijo));
  const [guardando, setGuardando] = useState(false);
  const [plantillaManual, setPlantillaManual] = useState(!!inicial?.plantilla_id);

  const proyecto = useMemo(() => proyectos.find(p => p._dbId === f.proyecto_id) ?? null, [proyectos, f.proyecto_id]);
  const sugerida = useMemo(() => sugerirPlantilla(plantillas, { proyecto_id: f.proyecto_id, curso_id: f.curso_id }), [plantillas, f.proyecto_id, f.curso_id]);

  // Al abrir: formulario limpio (o el de la capacitación a editar) con la
  // plantilla sugerida ya puesta — si se dejara en null, el efecto de la
  // sugerencia no vuelve a correr porque la sugerencia no cambió.
  useEffect(() => {
    if (!open) return;
    const base = desde(inicial, proyectoFijo);
    const sug = sugerirPlantilla(plantillas, { proyecto_id: base.proyecto_id, curso_id: base.curso_id });
    setF({ ...base, plantilla_id: base.plantilla_id ?? sug?.id ?? null });
    setPlantillaManual(!!inicial?.plantilla_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inicial, proyectoFijo]);

  // Si no se eligió plantilla a mano, seguir la sugerencia.
  useEffect(() => {
    if (!plantillaManual) setF(prev => ({ ...prev, plantilla_id: sugerida?.id ?? null }));
  }, [sugerida, plantillaManual]);

  // Al elegir proyecto, proponer la entidad beneficiaria y la región como ciudad.
  const elegirProyecto = (id: string | null) => {
    const p = proyectos.find(x => x._dbId === id);
    setF(prev => ({
      ...prev, proyecto_id: id,
      entidad_beneficiaria: prev.entidad_beneficiaria || p?.entidadCliente || '',
      ciudad: prev.ciudad || p?.region || '',
    }));
  };

  const elegirCurso = (id: string) => {
    const c = cursos.find(x => x.id === id);
    setF(prev => ({
      ...prev, curso_id: id || null,
      titulo: c ? c.nombre : prev.titulo,
      descripcion: prev.descripcion || c?.descripcion || '',
      temario: c ? c.temario.map(t => ({ ...t })) : prev.temario,
    }));
  };

  const guardar = async () => {
    if (!tenantId) return;
    if (!f.titulo.trim()) { toast.error('Ponga el título de la capacitación'); return; }
    if (!f.fecha_inicio) { toast.error('Indique la fecha'); return; }
    if (f.fecha_fin && f.fecha_fin < f.fecha_inicio) { toast.error('La fecha de fin no puede ser anterior al inicio'); return; }
    setGuardando(true);
    try {
      const payload = {
        tenant_id: tenantId,
        proyecto_id: f.proyecto_id, curso_id: f.curso_id, plantilla_id: f.plantilla_id,
        titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null,
        temario: f.temario.filter(t => t.tema.trim()),
        fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin || null,
        lugar: f.lugar.trim() || null, ciudad: f.ciudad.trim() || null,
        instructor_nombre: f.instructor_nombre.trim() || null, instructor_cargo: f.instructor_cargo.trim() || null,
        entidad_beneficiaria: f.entidad_beneficiaria.trim() || null,
        estado: f.estado, observaciones: f.observaciones.trim() || null,
      };
      const guardada = inicial
        ? await dbCapacitaciones.actualizar(inicial.id, payload as any)
        : await dbCapacitaciones.crear({ ...payload, creado_por: profile?.nombre ?? profile?.email ?? null } as any);
      toast.success(inicial ? 'Capacitación actualizada' : `Capacitación ${guardada.codigo} creada`);
      onGuardado(guardada);
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); } finally { setGuardando(false); }
  };

  const set = (patch: Partial<Form>) => setF(prev => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial ? `Editar ${inicial.codigo}` : 'Nueva capacitación'}</DialogTitle>
          <DialogDescription>Una sesión de capacitación dictada dentro de la entrega de un proyecto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Proyecto</Label>
              <ProyectoSelector value={f.proyecto_id} onChange={elegirProyecto} disabled={!!proyectoFijo} />
              {proyecto?.entidadCliente && <p className="text-xs text-muted-foreground">{proyecto.entidadCliente}{proyecto.region ? ` · ${proyecto.region}` : ''}</p>}
            </div>
            <div className="space-y-1">
              <Label>Curso (catálogo)</Label>
              <Select value={f.curso_id ?? '_none'} onValueChange={v => elegirCurso(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Elegir curso" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin curso del catálogo</SelectItem>
                  {cursos.filter(c => c.activo || c.id === f.curso_id).map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Título que sale en el certificado *</Label>
            <Input value={f.titulo} onChange={e => set({ titulo: e.target.value })} placeholder="Destrezas de Conducción y Soporte Vital Básico (BLS)" />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea rows={2} value={f.descripcion} onChange={e => set({ descripcion: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Temario de esta sesión</Label>
            <TemarioEditor value={f.temario} onChange={temario => set({ temario })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={f.fecha_inicio} onChange={e => set({ fecha_inicio: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de fin</Label>
              <Input type="date" value={f.fecha_fin} onChange={e => set({ fecha_fin: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Lugar</Label>
              <Input value={f.lugar} onChange={e => set({ lugar: e.target.value })} placeholder="Sede del GORE" />
            </div>
            <div className="space-y-1">
              <Label>Ciudad (para la fecha del diploma)</Label>
              <Input value={f.ciudad} onChange={e => set({ ciudad: e.target.value })} placeholder="Cusco" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Instructor</Label>
              <Input value={f.instructor_nombre} onChange={e => set({ instructor_nombre: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Cargo / especialidad del instructor</Label>
              <Input value={f.instructor_cargo} onChange={e => set({ instructor_cargo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Entidad beneficiaria</Label>
              <Input value={f.entidad_beneficiaria} onChange={e => set({ entidad_beneficiaria: e.target.value })} placeholder="GORE CUSCO" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Plantilla del certificado</Label>
              <Select value={f.plantilla_id ?? '_none'} onValueChange={v => { setPlantillaManual(true); set({ plantilla_id: v === '_none' ? null : v }); }}>
                <SelectTrigger><SelectValue placeholder="Plantilla" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin plantilla (elegir al emitir)</SelectItem>
                  {plantillas.filter(p => p.activa || p.id === f.plantilla_id).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}{p.id === sugerida?.id ? ' · sugerida' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inicial && (
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={f.estado} onValueChange={v => set({ estado: v as EstadoCapacitacion })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ESTADO_CAPACITACION) as EstadoCapacitacion[]).map(k => <SelectItem key={k} value={k}>{ESTADO_CAPACITACION[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Observaciones internas</Label>
            <Textarea rows={2} value={f.observaciones} onChange={e => set({ observaciones: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear capacitación'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
