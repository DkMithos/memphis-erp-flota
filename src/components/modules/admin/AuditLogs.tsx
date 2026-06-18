/**
 * Audit Logs — Historial de actividad del sistema
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Shield, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';

interface LogEntry {
  id: string;
  usuarioEmail: string;
  accion: string;
  entidadTipo: string;
  entidadId?: string;
  entidadLabel?: string;
  creadoEn: string;
}

const ACCION_CONFIG: Record<string, { label: string; color: string }> = {
  crear:    { label: 'Crear',    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  editar:   { label: 'Editar',   color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  eliminar: { label: 'Eliminar', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  aprobar:  { label: 'Aprobar',  color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  cerrar:   { label: 'Cerrar',   color: 'bg-slate-100 text-slate-800' },
  exportar: { label: 'Exportar', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  login:    { label: 'Login',    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

const ENTIDAD_LABELS: Record<string, string> = {
  vehiculo: 'Vehículo', orden_trabajo: 'Orden de Trabajo',
  proyecto: 'Proyecto', tarea: 'Tarea',
  cliente: 'Cliente', oportunidad: 'Oportunidad',
  articulo: 'Artículo', transaccion: 'Transacción',
  equipo_biomedico: 'Equipo Biomédico', proveedor: 'Proveedor',
};

function mapRow(r: Record<string, unknown>): LogEntry {
  return {
    id: r.id as string,
    usuarioEmail: (r.usuario_email as string) ?? 'Sistema',
    accion: r.accion as string,
    entidadTipo: r.entidad_tipo as string,
    entidadId: (r.entidad_id as string) ?? undefined,
    entidadLabel: (r.entidad_label as string) ?? undefined,
    creadoEn: r.creado_en as string,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AuditLogs() {
  const { tenantId } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('todos');
  const [filtroEntidad, setFiltroEntidad] = useState('todos');

  const fetchLogs = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false })
      .limit(200);
    if (data) setLogs((data as Record<string, unknown>[]).map(mapRow));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const logsFiltrados = logs.filter(l => {
    const matchSearch = !search ||
      l.usuarioEmail.toLowerCase().includes(search.toLowerCase()) ||
      (l.entidadLabel ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.entidadId ?? '').toLowerCase().includes(search.toLowerCase());
    const matchAccion = filtroAccion === 'todos' || l.accion === filtroAccion;
    const matchEntidad = filtroEntidad === 'todos' || l.entidadTipo === filtroEntidad;
    return matchSearch && matchAccion && matchEntidad;
  });

  const entidadesUnicas = [...new Set(logs.map(l => l.entidadTipo))].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Historial de las últimas 200 acciones realizadas en el sistema.
        </p>
        <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          <RefreshCw className="size-3.5" /> Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuario, entidad..." className="pl-9" />
        </div>
        <Select value={filtroAccion} onValueChange={setFiltroAccion}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Acción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las acciones</SelectItem>
            {Object.entries(ACCION_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEntidad} onValueChange={setFiltroEntidad}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Entidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las entidades</SelectItem>
            {entidadesUnicas.map(e => <SelectItem key={e} value={e}>{ENTIDAD_LABELS[e] ?? e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Cargando registros...</div>
          ) : logsFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <Shield className="size-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {logs.length === 0 ? 'No hay registros de auditoría aún' : 'Sin resultados para los filtros seleccionados'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsFiltrados.map(l => {
                  const accionCfg = ACCION_CONFIG[l.accion] ?? { label: l.accion, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(l.creadoEn)}
                      </TableCell>
                      <TableCell className="text-sm">{l.usuarioEmail}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${accionCfg.color} border-0`}>{accionCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ENTIDAD_LABELS[l.entidadTipo] ?? l.entidadTipo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.entidadLabel ?? l.entidadId ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
