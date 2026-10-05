/**
 * Capacitaciones y certificados — pantalla principal del módulo.
 * Lista las sesiones por proyecto con su avance (firmas / certificados) y da
 * paso al catálogo de cursos y a las plantillas.
 */
import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Plus, BookOpen, LayoutTemplate, Users, Award, PenLine, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { PageNav } from '../../shared/PageNav';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { Paginador } from '../../shared/Paginador';
import { usePagination } from '../../../lib/shared/usePagination';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { dbCapacitaciones, dbCursos, dbPlantillas } from '../../../lib/capacitaciones/db';
import { fechaCorta, horasCortas } from '../../../lib/capacitaciones/datos';
import { urlPortalCertificados } from '../../../lib/capacitaciones/urls';
import { ESTADO_CAPACITACION, type Capacitacion, type Curso, type Plantilla, type EstadoCapacitacion } from '../../../lib/capacitaciones/types';
import { CapacitacionDialog } from './CapacitacionDialog';

interface Props { onNavigate: (r: string) => void }

export function CapacitacionesLista({ onNavigate }: Props) {
  const { tenantId } = useAuth();
  const { can } = usePermissions();
  const [caps, setCaps] = useState<Capacitacion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState(false);
  const [proyectoId, setProyectoId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('proyecto'));
  const [estado, setEstado] = useState<'todos' | EstadoCapacitacion>('todos');
  const [q, setQ] = useState('');

  const cargar = async () => {
    if (!tenantId) return;
    setCargando(true);
    try {
      const [c, cu, pl] = await Promise.all([dbCapacitaciones.listar(tenantId), dbCursos.listar(tenantId), dbPlantillas.listar(tenantId)]);
      setCaps(c); setCursos(cu); setPlantillas(pl);
    } catch (e: any) { toast.error(e.message); } finally { setCargando(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [tenantId]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return caps.filter(c =>
      (!proyectoId || c.proyecto_id === proyectoId) &&
      (estado === 'todos' || c.estado === estado) &&
      (!t || [c.codigo, c.titulo, c.lugar, c.instructor_nombre, c.proyecto?.codigo, c.proyecto?.nombre, c.entidad_beneficiaria].some(v => (v ?? '').toLowerCase().includes(t))),
    );
  }, [caps, proyectoId, estado, q]);

  const pag = usePagination(filtradas);
  // Al cambiar el filtro se vuelve a la primera página.
  useEffect(() => { pag.setPage(1); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [q, proyectoId, estado]);

  const kpi = useMemo(() => ({
    sesiones: filtradas.length,
    participantes: filtradas.reduce((s, c) => s + (c.total_participantes ?? 0), 0),
    firmas: filtradas.reduce((s, c) => s + (c.total_firmados ?? 0), 0),
    certificados: filtradas.reduce((s, c) => s + (c.total_certificados ?? 0), 0),
  }), [filtradas]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><GraduationCap className="size-6 text-primary" /> Capacitaciones y certificados</h1>
          <p className="text-sm text-muted-foreground">Asistencia con firma, emisión de certificados con QR y portal público de consulta por DNI.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onNavigate('/proyectos/capacitaciones/cursos')}><BookOpen className="size-4" /> Cursos</Button>
          <Button variant="outline" onClick={() => onNavigate('/proyectos/capacitaciones/plantillas')}><LayoutTemplate className="size-4" /> Plantillas</Button>
          <Button variant="ghost" asChild><a href={urlPortalCertificados()} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Portal público</a></Button>
          {can('proyectos', 'crear') && <Button onClick={() => setNueva(true)}><Plus className="size-4" /> Nueva capacitación</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icono={<GraduationCap className="size-5" />} label="Capacitaciones" valor={kpi.sesiones} />
        <Kpi icono={<Users className="size-5" />} label="Participantes" valor={kpi.participantes} />
        <Kpi icono={<PenLine className="size-5" />} label="Firmas registradas" valor={kpi.firmas} sub={kpi.participantes ? `${Math.round(kpi.firmas / kpi.participantes * 100)} %` : undefined} />
        <Kpi icono={<Award className="size-5" />} label="Certificados emitidos" valor={kpi.certificados} />
      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por código, título, lugar, instructor…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="sm:w-72"><ProyectoSelector value={proyectoId} onChange={setProyectoId} /></div>
          <Select value={estado} onValueChange={v => setEstado(v as any)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {(Object.keys(ESTADO_CAPACITACION) as EstadoCapacitacion[]).map(k => <SelectItem key={k} value={k}>{ESTADO_CAPACITACION[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Capacitación</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Participantes</TableHead>
                <TableHead className="text-center">Firmas</TableHead>
                <TableHead className="text-center">Certificados</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Cargando…</TableCell></TableRow>}
              {!cargando && filtradas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {caps.length === 0 ? 'Aún no hay capacitaciones. Cree la primera con "Nueva capacitación".' : 'Nada coincide con el filtro.'}
                </TableCell></TableRow>
              )}
              {pag.paged.map(c => {
                const est = ESTADO_CAPACITACION[c.estado] ?? ESTADO_CAPACITACION.programada;
                const tp = c.total_participantes ?? 0, tf = c.total_firmados ?? 0, tc = c.total_certificados ?? 0;
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => onNavigate(`/proyectos/capacitaciones/${c.id}`)}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{c.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.titulo}</div>
                      <div className="text-xs text-muted-foreground">{horasCortas(c.horas_total)}{c.lugar ? ` · ${c.lugar}` : ''}{c.instructor_nombre ? ` · ${c.instructor_nombre}` : ''}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.proyecto ? <><div className="font-mono text-xs">{c.proyecto.codigo}</div><div className="text-xs text-muted-foreground">{c.proyecto.nombre}</div></> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fechaCorta(c.fecha_inicio)}{c.fecha_fin && c.fecha_fin !== c.fecha_inicio ? ` → ${fechaCorta(c.fecha_fin)}` : ''}</TableCell>
                    <TableCell className="text-center">{tp}</TableCell>
                    <TableCell className="text-center">
                      <span className={tp && tf === tp ? 'text-green-700 dark:text-green-400 font-medium' : ''}>{tf}</span><span className="text-muted-foreground">/{tp}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={tp && tc === tp ? 'text-green-700 dark:text-green-400 font-medium' : ''}>{tc}</span><span className="text-muted-foreground">/{tp}</span>
                    </TableCell>
                    <TableCell><Badge className={est.color} variant="outline">{est.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Paginador {...pag} nombre="capacitaciones" />
        </CardContent>
      </Card>

      <CapacitacionDialog open={nueva} onOpenChange={setNueva} cursos={cursos} plantillas={plantillas}
        proyectoFijo={proyectoId} onGuardado={c => onNavigate(`/proyectos/capacitaciones/${c.id}`)} />
    </div>
  );
}

function Kpi({ icono, label, valor, sub }: { icono: React.ReactNode; label: string; valor: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{icono}</div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{valor}{sub && <span className="text-sm text-muted-foreground font-normal ml-2">{sub}</span>}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
