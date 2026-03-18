/**
 * PROYECTOS — Gestión de Riesgos
 * Matriz de riesgos por impacto y probabilidad
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { AlertCircle, Plus, Shield, TrendingDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from 'sonner';

interface RiesgosProps { onNavigate?: (route: string) => void; }

interface Riesgo {
  id: string;
  titulo: string;
  descripcion: string;
  probabilidad: 'baja' | 'media' | 'alta';
  impacto: 'bajo' | 'medio' | 'alto';
  estado: 'activo' | 'mitigado' | 'cerrado';
  plan: string;
  proyectoNombre: string;
  proyectoId: string;
  nivel: 'bajo' | 'medio' | 'alto' | 'critico';
}

const NIVEL_MAP: Record<string, Record<string, Riesgo['nivel']>> = {
  alta: { alto: 'critico', medio: 'alto', bajo: 'medio' },
  media: { alto: 'alto', medio: 'medio', bajo: 'bajo' },
  baja: { alto: 'medio', medio: 'bajo', bajo: 'bajo' },
};

const NIVEL_STYLE: Record<string, { badge: string; dot: string }> = {
  critico: { badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
  alto: { badge: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  medio: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  bajo: { badge: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500' },
};

const STORAGE_KEY = 'kesa_riesgos_v1';

export function ProyectosRiesgos({ onNavigate }: RiesgosProps) {
  const { tenantId } = useAuth();
  const [riesgos, setRiesgos] = useState<Riesgo[]>([]);
  const [proyectos, setProyectos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', probabilidad: 'media', impacto: 'medio', plan: '', proyectoId: '' });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setRiesgos(JSON.parse(saved)); } catch {}
    }
    if (tenantId) {
      supabase.from('proyectos').select('id, nombre').then(({ data }) => {
        if (data) setProyectos(data as any);
      });
    }
  }, [tenantId]);

  const guardarRiesgos = (list: Riesgo[]) => {
    setRiesgos(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const agregarRiesgo = () => {
    if (!form.titulo) { toast.error('Ingrese un título'); return; }
    const nivel = NIVEL_MAP[form.probabilidad]?.[form.impacto] ?? 'bajo';
    const proyecto = proyectos.find(p => p.id === form.proyectoId);
    const nuevo: Riesgo = {
      id: crypto.randomUUID(),
      titulo: form.titulo,
      descripcion: form.descripcion,
      probabilidad: form.probabilidad as any,
      impacto: form.impacto as any,
      estado: 'activo',
      plan: form.plan,
      proyectoNombre: proyecto?.nombre ?? 'Sin proyecto',
      proyectoId: form.proyectoId,
      nivel,
    };
    guardarRiesgos([...riesgos, nuevo]);
    setShowDialog(false);
    setForm({ titulo: '', descripcion: '', probabilidad: 'media', impacto: 'medio', plan: '', proyectoId: '' });
    toast.success('Riesgo registrado');
  };

  const cambiarEstado = (id: string, estado: Riesgo['estado']) => {
    guardarRiesgos(riesgos.map(r => r.id === id ? { ...r, estado } : r));
  };

  const criticos = riesgos.filter(r => r.nivel === 'critico' && r.estado === 'activo').length;
  const altos = riesgos.filter(r => r.nivel === 'alto' && r.estado === 'activo').length;
  const activos = riesgos.filter(r => r.estado === 'activo').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gestión de Riesgos</h1>
            <p className="text-sm text-muted-foreground">Identificación, análisis y mitigación de riesgos</p>
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="size-4 mr-2" />
          Nuevo Riesgo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Activos', value: activos, color: 'text-foreground' },
          { label: 'Críticos', value: criticos, color: 'text-red-600' },
          { label: 'Altos', value: altos, color: 'text-orange-600' },
          { label: 'Mitigados', value: riesgos.filter(r => r.estado === 'mitigado').length, color: 'text-green-600' },
        ].map(k => (
          <Card key={k.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {riesgos.length === 0 ? (
            <div className="py-16 text-center">
              <Shield className="size-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay riesgos registrados</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowDialog(true)}>
                Registrar primer riesgo
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Riesgo</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Probabilidad</TableHead>
                  <TableHead>Impacto</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riesgos.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.titulo}</p>
                      {r.descripcion && <p className="text-xs text-muted-foreground truncate max-w-48">{r.descripcion}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{r.proyectoNombre}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{r.probabilidad}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{r.impacto}</Badge></TableCell>
                    <TableCell>
                      <Badge className={`text-xs capitalize border ${NIVEL_STYLE[r.nivel].badge}`}>{r.nivel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.estado === 'activo' ? 'destructive' : r.estado === 'mitigado' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {r.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.estado === 'activo' && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => cambiarEstado(r.id, 'mitigado')}>
                          Mitigar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="size-5" /> Nuevo Riesgo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Descripción breve del riesgo" />
            </div>
            <div>
              <Label>Proyecto</Label>
              <Select value={form.proyectoId} onValueChange={v => setForm(f => ({ ...f, proyectoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proyecto..." /></SelectTrigger>
                <SelectContent>
                  {proyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Probabilidad</Label>
                <Select value={form.probabilidad} onValueChange={v => setForm(f => ({ ...f, probabilidad: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impacto</Label>
                <Select value={form.impacto} onValueChange={v => setForm(f => ({ ...f, impacto: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bajo">Bajo</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Detalles del riesgo..." rows={2} />
            </div>
            <div>
              <Label>Plan de Mitigación</Label>
              <Textarea value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} placeholder="Acciones para mitigar o controlar..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={agregarRiesgo}>Registrar Riesgo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
