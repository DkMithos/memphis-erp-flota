/**
 * PROYECTOS — Documentos
 * Persistencia en Supabase — tabla documentos_proyecto
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { FileText, Plus, ExternalLink, Search, Folder, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from 'sonner';

interface DocumentosProps { onNavigate?: (route: string) => void; }

interface DocProyecto {
  id: string;
  nombre: string;
  tipo: string;
  url: string;
  proyecto: string;
  proyectoId: string;
  subidoPor: string;
  fecha: string;
}

const TIPOS = ['Plano', 'Especificación', 'Contrato', 'Acta', 'Informe', 'Cronograma', 'Presupuesto', 'Otro'];
const TIPO_ICONS: Record<string, string> = {
  Plano: '📐', Contrato: '📝', Acta: '📋', Informe: '📊', Presupuesto: '💰', Cronograma: '📅',
};

function mapRow(r: Record<string, unknown>): DocProyecto {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    tipo: r.tipo as string,
    url: r.url as string,
    proyecto: (r.proyecto_nombre as string) ?? 'Sin proyecto',
    proyectoId: (r.proyecto_id as string) ?? '',
    subidoPor: (r.subido_por as string) ?? '',
    fecha: ((r.creado_en as string) ?? '').split('T')[0],
  };
}

export function ProyectosDocumentos({ onNavigate }: DocumentosProps) {
  const { tenantId, user } = useAuth();
  const [docs, setDocs] = useState<DocProyecto[]>([]);
  const [proyectos, setProyectos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'Informe', url: '', proyectoId: '' });

  const fetchDocs = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('documentos_proyecto')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false });
    if (data) setDocs((data as Record<string, unknown>[]).map(mapRow));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    fetchDocs();
    supabase.from('proyectos').select('id, nombre').eq('tenant_id', tenantId).then(({ data }) => {
      if (data) setProyectos(data as Array<{ id: string; nombre: string }>);
    });
  }, [tenantId, fetchDocs]);

  const agregar = async () => {
    if (!form.nombre || !form.url) { toast.error('Nombre y URL son requeridos'); return; }
    if (!tenantId) return;
    setSaving(true);
    const proyecto = proyectos.find(p => p.id === form.proyectoId);
    const { error } = await supabase.from('documentos_proyecto').insert({
      tenant_id: tenantId,
      proyecto_id: form.proyectoId || null,
      proyecto_nombre: proyecto?.nombre ?? null,
      nombre: form.nombre,
      tipo: form.tipo,
      url: form.url,
      subido_por: user?.email ?? null,
    });
    setSaving(false);
    if (error) { toast.error('Error al guardar documento'); return; }
    toast.success('Documento registrado');
    setShowDialog(false);
    setForm({ nombre: '', tipo: 'Informe', url: '', proyectoId: '' });
    fetchDocs();
  };

  const eliminar = async (id: string) => {
    const { error } = await supabase.from('documentos_proyecto').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    setDocs(prev => prev.filter(d => d.id !== id));
    toast.success('Documento eliminado');
  };

  const docsFiltrados = docs.filter(d => {
    const matchSearch = d.nombre.toLowerCase().includes(search.toLowerCase()) ||
      d.proyecto.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || d.tipo === filtroTipo;
    return matchSearch && matchTipo;
  });

  const grupos = docsFiltrados.reduce<Record<string, DocProyecto[]>>((acc, d) => {
    const key = d.proyecto;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Documentos del Proyecto</h1>
            <p className="text-sm text-muted-foreground">Repositorio de planos, contratos y documentación técnica</p>
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="size-4" />
          Nuevo Documento
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documento..."
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Cargando documentos...</CardContent></Card>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Folder className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No hay documentos registrados</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowDialog(true)}>
              Subir primer documento
            </Button>
          </CardContent>
        </Card>
      ) : Object.keys(grupos).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sin resultados para tu búsqueda</CardContent></Card>
      ) : (
        Object.entries(grupos).map(([proyecto, docsList]) => (
          <Card key={proyecto}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Folder className="size-4 text-primary" />
                {proyecto}
                <Badge variant="secondary" className="text-xs">
                  {docsList.length} doc{docsList.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {docsList.map(d => (
                  <div key={d.id} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors group">
                    <span className="text-2xl shrink-0">{TIPO_ICONS[d.tipo] ?? '📄'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.nombre}</p>
                      <p className="text-xs text-muted-foreground">{d.tipo} · {d.fecha}</p>
                      {d.subidoPor && <p className="text-xs text-muted-foreground truncate">{d.subidoPor}</p>}
                      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm" variant="ghost" className="h-6 px-2 text-xs"
                          onClick={() => window.open(d.url, '_blank')}
                        >
                          <ExternalLink className="size-3" />Abrir
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => eliminar(d.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="size-5" /> Nuevo Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del documento"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Proyecto</Label>
                <Select value={form.proyectoId} onValueChange={v => setForm(f => ({ ...f, proyectoId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{proyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL del Documento *</Label>
              <Input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground mt-1">Enlace a Google Drive, SharePoint, etc.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={agregar} disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
