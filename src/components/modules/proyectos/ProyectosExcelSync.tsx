/**
 * ProyectosExcelSync — Espejo de RESUMEN.xlsx (canal OPERACIONES2)
 *
 * Fase A de coexistencia con Excel: el equipo sigue trabajando en su Excel
 * en SharePoint; esta vista refleja el estado en el ERP, sincronizado cada
 * 30 min vía pg_cron + Edge Function `excel-sync`. Botón "Sincronizar ahora"
 * para refresco manual.
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { toast } from 'sonner';

interface ProyectoEspejo {
  id: string;
  hoja: string;
  proyecto: string | null;
  owner: string | null;
  ciu: string | null;
  tipo: string | null;
  fase_actual: string | null;
  estado_actual: string | null;
  inversion_inicial: number | null;
  valor_modificado: number | null;
  monto_cobrado: number | null;
  monto_pendiente: number | null;
  items: number | null;
  acta_inicio: string | null;
  fecha_plazo: string | null;
  sincronizado_en: string;
  excel_url: string | null;
}

interface SyncConfig {
  id: string;
  nombre: string;
  excel_url: string | null;
  ultima_sincronizacion: string | null;
  ultimo_estado: string | null;
  ultimo_error: string | null;
}

const fmtMonto = (n: number | null) =>
  n === null
    ? '—'
    : new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

const fmtFecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-PE') : '—';

const tiempoTranscurrido = (iso: string | null) => {
  if (!iso) return 'nunca';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleString('es-PE');
};

const estadoColor: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-700',
  'REVISIÓN ESTADO': 'bg-amber-100 text-amber-700',
  SUSPENSIÓN: 'bg-red-100 text-red-700',
  'PLAZO VENCIDO': 'bg-red-100 text-red-700',
  ARBITRAJE: 'bg-red-100 text-red-700',
};

export function ProyectosExcelSync() {
  const [proyectos, setProyectos] = useState<ProyectoEspejo[]>([]);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [proyRes, cfgRes] = await Promise.all([
      supabase.from('proyectos_excel_sync').select('*').order('valor_modificado', { ascending: false, nullsFirst: false }),
      supabase.from('excel_sync_config').select('id, nombre, excel_url, ultima_sincronizacion, ultimo_estado, ultimo_error').eq('activo', true).limit(1).maybeSingle(),
    ]);
    setProyectos((proyRes.data as ProyectoEspejo[]) ?? []);
    setConfig((cfgRes.data as SyncConfig) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('excel-sync', { body: {} });
      if (error) throw new Error(error.message);
      const total = (data?.configs ?? []).reduce((s: number, c: any) => s + (c.upserts ?? 0), 0);
      toast.success(`Sincronización completada: ${total} proyectos actualizados`);
      await cargar();
    } catch (e: any) {
      toast.error(`Error al sincronizar: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const totales = proyectos.reduce(
    (acc, p) => ({
      inversion: acc.inversion + (p.inversion_inicial ?? 0),
      valor: acc.valor + (p.valor_modificado ?? 0),
      cobrado: acc.cobrado + (p.monto_cobrado ?? 0),
      pendiente: acc.pendiente + (p.monto_pendiente ?? 0),
    }),
    { inversion: 0, valor: 0, cobrado: 0, pendiente: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="size-6" /> Proyectos (espejo del Excel)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Refleja en vivo el archivo del canal <strong>OPERACIONES2 → OPERACIONES TEAM</strong>. Sincronización automática cada 30 minutos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config?.excel_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={config.excel_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 mr-1" /> Abrir Excel
              </a>
            </Button>
          )}
          <Button onClick={sincronizar} disabled={syncing} size="sm">
            <RefreshCw className={`size-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </Button>
        </div>
      </div>

      {/* Estado de la sincronización */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={config?.ultimo_estado === 'ok' ? 'default' : 'secondary'}>
              {config?.ultimo_estado ?? 'sin datos'}
            </Badge>
            <span className="text-muted-foreground">
              Última sincronización: <strong>{tiempoTranscurrido(config?.ultima_sincronizacion ?? null)}</strong>
            </span>
          </div>
          {config?.ultimo_error && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="size-3.5" />
              {config.ultimo_error.slice(0, 100)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Proyectos</p><p className="text-2xl font-bold">{proyectos.length}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Inversión inicial</p><p className="text-lg font-bold">{fmtMonto(totales.inversion)}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Valor modificado</p><p className="text-lg font-bold">{fmtMonto(totales.valor)}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Cobrado</p><p className="text-lg font-bold text-green-600">{fmtMonto(totales.cobrado)}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Pendiente</p><p className="text-lg font-bold text-amber-600">{fmtMonto(totales.pendiente)}</p></CardContent></Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cartera de proyectos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando…</div>
          ) : proyectos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aún no hay datos sincronizados. Da clic en <strong>Sincronizar ahora</strong> para reflejar el Excel.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>CIU</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Inversión inicial</TableHead>
                  <TableHead className="text-right">Valor mod.</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-center">Ítems</TableHead>
                  <TableHead>Fecha plazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyectos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.proyecto ?? p.hoja}</TableCell>
                    <TableCell>{p.owner ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.ciu ?? '—'}</TableCell>
                    <TableCell>{p.tipo ?? '—'}</TableCell>
                    <TableCell>{p.fase_actual ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${estadoColor[p.estado_actual ?? ''] ?? 'bg-slate-100 text-slate-700'}`}>
                        {p.estado_actual ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMonto(p.inversion_inicial)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMonto(p.valor_modificado)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-green-700">{fmtMonto(p.monto_cobrado)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-amber-700">{fmtMonto(p.monto_pendiente)}</TableCell>
                    <TableCell className="text-center">{p.items ?? '—'}</TableCell>
                    <TableCell className="text-xs">{fmtFecha(p.fecha_plazo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        El equipo continúa trabajando en el Excel original. El ERP se sincroniza cada 30 min vía Microsoft Graph. Cuando el equipo migre a Planner y luego al ERP, esta vista quedará como respaldo y eventualmente se desactiva.
      </p>
    </div>
  );
}
